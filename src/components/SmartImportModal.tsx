import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  MessageSquare,
  FileSpreadsheet,
  Camera,
  Calendar,
  Sparkles,
  CheckCircle2,
  Loader2,
  Upload,
  Plus,
  Trophy,
  AlertTriangle,
  HelpCircle,
  ShieldCheck,
  Search
} from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import { SportType } from '../types/matchday';
import {
  parseMultipleSportsMessages,
  parsePastedSpreadsheetText,
  parseExcelFileBuffer,
  parseScheduleImage,
  convertExtractedToMatchdayEvent
} from '../lib/ai/localAiEngine';
import { ExtractedSportsEvent } from '../lib/ai/messageParserNLP';
import { db } from '../lib/storage/db';
import { pickNextTeamColor } from '../lib/sport/teamColors';
import { generateStableProfileId } from '../lib/clubs/attachTeam';
import { EXAMPLE_TOURNAMENTS } from '../lib/clubs/exampleTournaments';
import { searchPopularClubs, type ClubPreset } from '../lib/clubs/popularClubsCatalog';
import { parseAssociationUrl, getAssociationName } from '../lib/stats/statsEngine';
import { TeamColorPicker } from './TeamColorPicker';

export type ImportTab = 'classic' | 'message' | 'table' | 'ocr';

interface SmartImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPlayers: string[];
  initialSport?: SportType;
  initialTeamUrl?: string;
  initialTeamName?: string;
  initialPlayerName?: string;
  initialTab?: ImportTab;
  onEventsImported?: () => void;
  onImportClassic?: (
    playerName: string,
    teamName: string,
    sport: SportType,
    url: string,
    colorHex?: string
  ) => Promise<{ success: boolean; count?: number; error?: string } | void>;
}

export const SmartImportModal: React.FC<SmartImportModalProps> = ({
  isOpen,
  onClose,
  existingPlayers = [],
  initialSport,
  initialTeamUrl,
  initialTeamName,
  initialPlayerName,
  initialTab = 'message',
  onEventsImported,
  onImportClassic
}) => {
  const [activeTab, setActiveTab] = useState<ImportTab>(initialTab);
  const [selectedPlayer, setSelectedPlayer] = useState(initialPlayerName || existingPlayers[0] || 'Maija');
  const [selectedSport, setSelectedSport] = useState<SportType>(initialSport || 'football');
  const [playerActiveSports, setPlayerActiveSports] = useState<SportType[]>([]);
  const [customPlayerDraft, setCustomPlayerDraft] = useState('');

  // Tab 1: Freeform / WhatsApp messages (multi-match support)
  const [pastedMessage, setPastedMessage] = useState('');
  const [extractedMessageEvents, setExtractedMessageEvents] = useState<ExtractedSportsEvent[]>([]);

  // Tab 2: Table / Excel
  const [pastedTableText, setPastedTableText] = useState('');
  const [extractedTableEvents, setExtractedTableEvents] = useState<ExtractedSportsEvent[]>([]);

  // Tab 3: OCR
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrExtractedEvents, setOcrExtractedEvents] = useState<ExtractedSportsEvent[]>([]);

  // Tab 4: URL / Federation / .ics / Preset Cups
  const [classicUrl, setClassicUrl] = useState(initialTeamUrl || '');
  const [classicTeamName, setClassicTeamName] = useState(initialTeamName || '');
  const [colorHex, setColorHex] = useState(pickNextTeamColor([]).hex);
  const [showGuide, setShowGuide] = useState(false);
  const [clubSearchQuery, setClubSearchQuery] = useState('');
  const [clubMatches, setClubMatches] = useState<ClubPreset[]>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Query active sports for the selected player from profiles and events
  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!selectedPlayer) return;
      try {
        const profiles = await db.profiles.where('playerName').equals(selectedPlayer).toArray();
        const events = await db.events.where('playerName').equals(selectedPlayer).toArray();
        const sportsSet = new Set<SportType>();
        for (const p of profiles) {
          if (p.sport) sportsSet.add(p.sport as SportType);
        }
        for (const e of events) {
          if (e.sport) sportsSet.add(e.sport as SportType);
        }
        const sportsList = Array.from(sportsSet);
        if (isMounted) {
          setPlayerActiveSports(sportsList);
          if (sportsList.length > 0 && !initialSport && !sportsList.includes(selectedSport)) {
            setSelectedSport(sportsList[0]!);
          }
        }
      } catch (e) {
        console.warn('Failed to query player sports in SmartImportModal', e);
      }
    })();
    return () => { isMounted = false; };
  }, [selectedPlayer, initialSport]);

  // Handle escape key — never abandon an in-flight save/import (M-45/V61)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSaving && !isOcrProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSaving, isOcrProcessing, onClose]);

  // Sync initial props when opened (only on open transition)
  const prevIsOpen = useRef(false);
  // Deferred close timers must die with the modal, or they fire post-close (M-45/N13).
  const closeTimersRef = useRef<number[]>([]);
  useEffect(() => {
    const timers = closeTimersRef;
    return () => {
      for (const t of timers.current) window.clearTimeout(t);
      timers.current = [];
    };
  }, []);
  // Explicit feedback when a parse produces nothing — silence is a failure (M-09/H7).
  const [parseNotice, setParseNotice] = useState('');
  useEffect(() => {
    if (isOpen && !prevIsOpen.current) {
      setSelectedPlayer(initialPlayerName || existingPlayers[0] || 'Maija');
      setSelectedSport(initialSport || 'football');
      setClassicUrl(initialTeamUrl || '');
      setClassicTeamName(initialTeamName || '');
      setActiveTab(initialTeamUrl || initialTeamName ? 'classic' : initialTab);
      setColorHex(pickNextTeamColor([]).hex);
      setSuccessMessage('');
      setErrorMessage('');
      setIsSaving(false);
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, initialPlayerName, initialSport, initialTeamUrl, initialTeamName, initialTab]);

  const handleUrlChange = (val: string) => {
    setClassicUrl(val);
    setErrorMessage('');
    const parsed = parseAssociationUrl(val);
    if (parsed?.sport && parsed.sport !== 'other') {
      setSelectedSport(parsed.sport);
    }
  };

  const detectedAssoc = parseAssociationUrl(classicUrl);

  // Parse multi-match freeform text
  const handleParseMessage = () => {
    const trimmed = pastedMessage.trim();
    if (!trimmed) return;
    setErrorMessage('');
    const results = parseMultipleSportsMessages(trimmed, selectedPlayer);
    setExtractedMessageEvents(results);
    setParseNotice(
      results.length === 0
        ? 'Mitään ei tunnistettu. Varmista että viestissä on päivä ja kellonaika (esim. "ti 17.4 klo 18.30") ja vastustaja.'
        : ''
    );
    if (results.length > 0 && results[0]?.sport) {
      setSelectedSport(results[0].sport);
    }
  };

  // Parse table
  const handleParseTable = () => {
    if (!pastedTableText.trim()) return;
    setErrorMessage('');
    const res = parsePastedSpreadsheetText(pastedTableText, selectedSport, selectedPlayer);
    setExtractedTableEvents(res.events);
    setParseNotice(
      res.events.length === 0
        ? 'Taulukosta ei löytynyt otteluita. Vaadi sarakkeita: päivä, kellonaika, vastustaja, kenttä.'
        : ''
    );
  };

  // Excel / Image file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage('');

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
      const buffer = await file.arrayBuffer();
      const res = await parseExcelFileBuffer(buffer, selectedSport, selectedPlayer);
      setExtractedTableEvents(res.events);
      setActiveTab('table');
    } else if (file.type.startsWith('image/')) {
      await handleImageOcr(file);
    }
  };

  // Image OCR
  const handleImageOcr = async (file: File | Blob) => {
    setIsOcrProcessing(true);
    setOcrStatus('Käynnistetään paikallinen tekoäly-OCR...');
    setOcrProgress(0.1);
    setErrorMessage('');

    try {
      const res = await parseScheduleImage(file, selectedSport, selectedPlayer, (p) => {
        setOcrStatus(`Luetaan kuvaa: ${Math.round(p.progress * 100)}%`);
        setOcrProgress(p.progress);
      });
      setOcrExtractedEvents(res.freeformEvents);
      setParseNotice(
        res.freeformEvents.length === 0
          ? 'Kuvasta ei tunnistettu otteluita. Kuvakaappauksen tulee näyttää ajat ja vastustajat selkeästi.'
          : ''
      );
      setActiveTab('ocr');
    } catch (err) {
      console.error(err);
      setErrorMessage('OCR-tunnistus epäonnistui. Kokeile liittää teksti suoraan WhatsApp-välilehdelle.');
    } finally {
      setIsOcrProcessing(false);
    }
  };

  // Save extracted events to IndexedDB
  const handleSaveEvents = async (eventsToSave: ExtractedSportsEvent[]) => {
    const usable = eventsToSave.filter((e) => e.confidenceScore >= 0.5 && e.dateStr && e.kickoffTime);
    if (usable.length === 0) return;
    setIsSaving(true);
    setErrorMessage('');

    try {
      const existingProfiles = await db.profiles.toArray();
      let profile = existingProfiles.find(
        (p) => p.playerName.toLowerCase() === selectedPlayer.toLowerCase() && p.sport === selectedSport
      );

      let profileId = profile?.id;
      if (!profileId) {
        const swatch = pickNextTeamColor(existingProfiles.map((p) => p.colorHex));
        profileId = generateStableProfileId(selectedPlayer.trim(), `manual:${selectedSport}`);
        await db.profiles.add({
          id: profileId,
          playerName: selectedPlayer.trim() || 'Pelaaja',
          teamName:
            usable[0]?.homeTeam && usable[0].homeTeam !== 'Oma joukkue'
              ? usable[0].homeTeam
              : `${selectedSport === 'floorball' ? 'Salibandy' : selectedSport === 'basketball' ? 'Koripallo' : 'Jalkapallo'}`,
          sport: selectedSport,
          primaryColor: swatch.label,
          calendarUrl: '',
          colorHex: swatch.hex
        });
      }

      for (const extracted of usable) {
        const fullEvent = await convertExtractedToMatchdayEvent(extracted, profileId, selectedPlayer);
        await db.events.put(fullEvent);
      }

      setSuccessMessage(`Tallennettu ${usable.length} ottelua pelaajalle ${selectedPlayer}!`);
      closeTimersRef.current.push(
        window.setTimeout(() => {
        setSuccessMessage('');
        onEventsImported?.();
        onClose();
      }, 1100)
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Tallennus epäonnistui');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Classic URL / Cup import with robust error feedback
  const handleClassicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const who = selectedPlayer.trim();
    const url = classicUrl.trim();
    if (!who || !url) {
      setErrorMessage('Täytä pelaajan nimi ja kalenterin osoite.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      if (onImportClassic) {
        const res = await onImportClassic(
          who,
          classicTeamName || 'Oma joukkue',
          selectedSport,
          url,
          colorHex
        );
        if (res && res.success === false) {
          setErrorMessage(res.error || 'Otteluiden noutaminen epäonnistui. Tarkista osoite tai kokeile myöhemmin.');
          return;
        }
      }
      setSuccessMessage(`Joukkue tuotu onnistuneesti pelaajalle ${who}!`);
      closeTimersRef.current.push(
        window.setTimeout(() => {
        setSuccessMessage('');
        onEventsImported?.();
        onClose();
      }, 1000)
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Nouto epäonnistui. Tarkista verkko tai linkin muoto.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectCupPreset = (cup: (typeof EXAMPLE_TOURNAMENTS)[number]) => {
    setClassicTeamName(cup.teamName);
    setSelectedSport(cup.sport);
    setClassicUrl(cup.url);
    setColorHex(cup.colorHex);
    setActiveTab('classic');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-canvas/80 backdrop-blur-md"
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="smart-import-title"
            initial={{ scale: 0.92, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 10 }}
            transition={springTactile.gentle}
            className="liquid-glass relative w-full max-w-xl rounded-3xl p-5 sm:p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-pitch/15 text-pitch">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="smart-import-title" className="text-lg font-black text-text-primary">
                    Tuo joukkue tai otteluita
                  </h3>
                  <p className="text-xs text-text-muted">
                    Liitä liiton sarjasivu, .ics-linkki, WhatsApp-viesti tai taulukko
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Sulje"
                className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-elevated cursor-pointer focus-visible:ring-2 focus-visible:ring-pitch"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Target Child & Sport Selector */}
            <div className="mb-4 p-3.5 rounded-2xl bg-surface-elevated/70 border border-border-strong flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-bold text-text-primary">
                  👤 Kenelle lapselle / pelaajalle lisätään?
                </label>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {existingPlayers.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setSelectedPlayer(p);
                        setCustomPlayerDraft('');
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer transition-all ${
                        selectedPlayer === p && !customPlayerDraft
                          ? 'bg-pitch text-text-inverse border-pitch shadow-sm'
                          : 'bg-surface text-text-secondary border-border-subtle hover:text-text-primary'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={customPlayerDraft}
                    onChange={(e) => {
                      setCustomPlayerDraft(e.target.value);
                      if (e.target.value.trim()) {
                        setSelectedPlayer(e.target.value.trim());
                      } else if (existingPlayers[0]) {
                        setSelectedPlayer(existingPlayers[0]);
                      }
                    }}
                    placeholder="+ Uusi nimi"
                    className="px-2.5 py-1 rounded-lg bg-surface border border-border-strong text-text-primary text-xs font-bold w-28 focus:outline-none focus:border-pitch"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Laji</label>
                <select
                  value={selectedSport}
                  onChange={(e) => setSelectedSport(e.target.value as SportType)}
                  className="px-2.5 py-1 rounded-lg bg-surface border border-border-strong text-text-primary text-xs font-medium focus:outline-none focus:border-pitch"
                >
                  {playerActiveSports.length > 0 ? (
                    <>
                      <optgroup label={`⭐ ${selectedPlayer}n lajit`}>
                        {[
                          { type: 'football', label: '⚽ Jalkapallo' },
                          { type: 'floorball', label: '🏑 Salibandy' },
                          { type: 'basketball', label: '🏀 Koripallo' },
                          { type: 'volleyball', label: '🏐 Lentopallo' },
                          { type: 'icehockey', label: '🏒 Jääkiekko' },
                          { type: 'futsal', label: '👟 Futsal' },
                          { type: 'school', label: '🏫 Koulu / Wilma' },
                          { type: 'other', label: '📌 Muu / treenit' }
                        ]
                          .filter((s) => playerActiveSports.includes(s.type as SportType))
                          .map((s) => (
                            <option key={s.type} value={s.type}>
                              {s.label}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Muut lajit">
                        {[
                          { type: 'football', label: '⚽ Jalkapallo' },
                          { type: 'floorball', label: '🏑 Salibandy' },
                          { type: 'basketball', label: '🏀 Koripallo' },
                          { type: 'volleyball', label: '🏐 Lentopallo' },
                          { type: 'icehockey', label: '🏒 Jääkiekko' },
                          { type: 'futsal', label: '👟 Futsal' },
                          { type: 'school', label: '🏫 Koulu / Wilma' },
                          { type: 'other', label: '📌 Muu / treenit' }
                        ]
                          .filter((s) => !playerActiveSports.includes(s.type as SportType))
                          .map((s) => (
                            <option key={s.type} value={s.type}>
                              {s.label}
                            </option>
                          ))}
                      </optgroup>
                    </>
                  ) : (
                    <>
                      <option value="football">⚽ Jalkapallo</option>
                      <option value="floorball">🏑 Salibandy</option>
                      <option value="basketball">🏀 Koripallo</option>
                      <option value="volleyball">🏐 Lentopallo</option>
                      <option value="icehockey">🏒 Jääkiekko</option>
                      <option value="futsal">👟 Futsal</option>
                      <option value="school">🏫 Koulu / Wilma</option>
                      <option value="other">📌 Muu / treenit</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Tab Navigation */}
            <div
              role="tablist"
              aria-label="Tuontitavat"
              className="flex items-center gap-1 p-1 rounded-2xl bg-surface-elevated border border-border-subtle mb-4 overflow-x-auto"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'classic'}
                onClick={() => setActiveTab('classic')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'classic'
                    ? 'bg-pitch text-text-inverse shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Liitto / .ics</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'message'}
                onClick={() => setActiveTab('message')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'message'
                    ? 'bg-pitch text-text-inverse shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'table'}
                onClick={() => setActiveTab('table')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'table'
                    ? 'bg-pitch text-text-inverse shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel / Sheets</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'ocr'}
                onClick={() => setActiveTab('ocr')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'ocr'
                    ? 'bg-pitch text-text-inverse shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Kuvakaappaus</span>
              </button>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-2xl bg-stoppage/15 border border-stoppage/30 text-stoppage text-xs font-bold flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* TAB 1: Classic URL & Preset Cups & Club Search */}
            {activeTab === 'classic' && (
              <div className="flex flex-col gap-4">
                {/* Preset Cups Carousel */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-text-secondary">
                    Valmiit turnaukset (1-napin liitos):
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {EXAMPLE_TOURNAMENTS.map((cup) => (
                      <button
                        key={cup.id}
                        type="button"
                        onClick={() => handleSelectCupPreset(cup)}
                        className="flex items-center gap-2 p-2 rounded-xl border border-border-subtle bg-surface-elevated text-left hover:border-pitch cursor-pointer transition-all"
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ background: cup.colorHex }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-bold text-text-primary">{cup.name}</div>
                          <div className="truncate text-[10px] text-text-muted">{cup.teamName}</div>
                        </div>
                        <Plus className="h-3.5 w-3.5 shrink-0 text-pitch" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Club Quick Finder */}
                <div>
                  <label className="mb-1 block text-xs font-semibold text-text-secondary flex items-center gap-1">
                    <Search className="w-3.5 h-3.5 text-pitch" />
                    <span>Pikahaku seuroista (HJK, Honka, ErVi, TOPOLA...):</span>
                  </label>
                  <input
                    type="text"
                    value={clubSearchQuery}
                    placeholder="Kirjoita seuran nimi..."
                    onChange={(e) => {
                      // Suggest only — nothing fills the form until the user
                      // explicitly taps a result (M-27: silent autofill imported
                      // the wrong club's season under a child's name).
                      const q = e.target.value;
                      setClubSearchQuery(q);
                      setClubMatches(q.trim().length > 1 ? searchPopularClubs(q).slice(0, 5) : []);
                    }}
                    className="w-full rounded-xl border border-pitch/30 bg-pitch/10 px-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-pitch focus:outline-none"
                  />
                  {clubMatches.length > 0 && (
                    <div className="mt-1.5 flex flex-col gap-1" role="listbox" aria-label="Seuraehdotukset">
                      {clubMatches.map((club) => (
                        <button
                          key={club.id}
                          type="button"
                          role="option"
                          aria-selected={false}
                          onClick={() => {
                            setClassicTeamName(club.name);
                            setSelectedSport(club.sport);
                            setClassicUrl(club.sampleTeamUrl);
                            setColorHex(club.colorHex);
                            setClubMatches([]);
                            setClubSearchQuery('');
                          }}
                          className="text-left p-2 rounded-lg bg-surface-elevated border border-border-subtle hover:border-pitch/50 text-[11px] text-text-primary cursor-pointer"
                        >
                          <span className="font-bold">{club.name}</span>
                          <span className="text-text-secondary"> · {club.city}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <form onSubmit={handleClassicSubmit} className="flex flex-col gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1">
                      Joukkueen nimi *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="esim. HJK T13 Sininen tai PPJ/Laru"
                      value={classicTeamName}
                      onChange={(e) => setClassicTeamName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-xs focus:outline-none focus:border-pitch"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-text-secondary">
                        Liiton joukkuesivu tai .ics-osoite *
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowGuide(!showGuide)}
                        className="flex cursor-pointer items-center gap-0.5 text-[11px] text-pitch hover:underline"
                      >
                        <HelpCircle className="h-3 w-3" />
                        <span>Tuetut osoitteet</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      required
                      placeholder="https://tulospalvelu.palloliitto.fi/team/... tai webcal://..."
                      value={classicUrl}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-surface-elevated border border-border-strong text-text-primary font-mono text-xs focus:outline-none focus:border-pitch"
                    />

                    {detectedAssoc && (
                      <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-pitch/10 px-3 py-1.5 text-xs font-medium text-pitch">
                        <Trophy className="h-3.5 w-3.5" />
                        <span>
                          {getAssociationName(detectedAssoc.association)} · Tiimi #{detectedAssoc.teamId}
                        </span>
                      </div>
                    )}

                    {showGuide && (
                      <div className="mt-2 flex flex-col gap-1 rounded-xl border border-border-subtle bg-surface-elevated p-3 text-[11px] text-text-secondary">
                        <div>⚽ Palloliitto: tulospalvelu.palloliitto.fi/team/{'{id}'}</div>
                        <div>🏑 Salibandy: tulospalvelu.salibandy.fi/team/{'{id}'}</div>
                        <div>🏀 Basket.fi: basket.fi/.../?team_id={'{id}'}</div>
                        <div>🏐 Lentopallo: tulospalvelu.lentopallo.fi/team/{'{id}'}</div>
                        <div>🏐 Torneopal: *.torneopal.fi/taso/joukkue.php?joukkue={'{id}'}</div>
                        <div>📅 Kalenterit: Nimenhuuto, MyClub, Jopox (.ics / webcal://)</div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-text-secondary">
                      Joukkueen väri
                    </label>
                    <TeamColorPicker value={colorHex} onChange={(hex) => setColorHex(hex)} />
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="mt-2 py-3 px-4 rounded-xl bg-pitch text-text-inverse font-bold text-xs flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer shadow-md shadow-pitch/25 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    <span>{isSaving ? 'Haetaan otteluita…' : `Tuo joukkue · ${selectedPlayer}`}</span>
                  </button>
                </form>
              </div>
            )}

            {/* TAB 2: WhatsApp Multi-Match Parser */}
            {activeTab === 'message' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-text-secondary">
                  Liitä valmentajan WhatsApp-viesti (tukee myös koko viikonlopun turnausviestejä):
                </p>
                <textarea
                  rows={4}
                  value={pastedMessage}
                  onChange={(e) => setPastedMessage(e.target.value)}
                  placeholder="Esim: Lauantaina 24.8. turnaus Väiskillä:&#10;klo 10:00 vs KäPa&#10;klo 13:00 vs Honka&#10;Mustat paidat päälle. Maijalla kahviovuoro klo 12-14."
                  className="w-full p-3 rounded-2xl bg-surface-elevated border border-border-strong text-text-primary text-xs focus:outline-none focus:border-pitch resize-none"
                />

                <button
                  type="button"
                  onClick={handleParseMessage}
                  disabled={!pastedMessage.trim()}
                  className="py-2.5 px-4 rounded-xl bg-pitch text-text-inverse text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Jäsennä ottelutiedot tekoälyllä</span>
                </button>

                {parseNotice && (
                  <p role="status" className="p-2.5 rounded-xl bg-whistle/15 border border-whistle/40 text-[11px] font-semibold text-text-primary">
                    {parseNotice}
                  </p>
                )}

                <div aria-live="polite">
                  {extractedMessageEvents.length > 0 && (
                    <div className="mt-3 p-4 rounded-2xl bg-surface border border-pitch/40 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-pitch flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Tunnistettu {extractedMessageEvents.length} {extractedMessageEvents.length === 1 ? 'tapahtuma' : 'ottelua'}:</span>
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-pitch/15 text-pitch font-bold">
                          {extractedMessageEvents[0]?.dateStr}
                        </span>
                      </div>

                      <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                        {extractedMessageEvents.map((ev, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl bg-surface-elevated border border-border-subtle text-xs">
                            <div className="font-bold text-text-primary">{ev.title}</div>
                            <div className="text-[11px] text-text-secondary mt-0.5">
                              📍 {ev.venueHint || (ev.sport === 'school' ? 'Koulu' : 'Paikka ilmoitetaan')} • ⏰ {ev.sport === 'school' || ev.sport === 'other' || ev.eventType === 'school' || ev.eventType === 'meeting' || ev.eventType === 'other' ? `Klo ${ev.kickoffTime}` : `Klo ${ev.kickoffTime} (Alkulämpö ${ev.warmupTime})`}
                            </div>
                            {ev.volunteerDuties.length > 0 && (
                              <div className="text-[11px] text-whistle font-semibold mt-0.5">
                                {ev.volunteerDuties.join(' • ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSaveEvents(extractedMessageEvents)}
                        disabled={isSaving}
                        className="mt-1 py-2.5 px-3 rounded-xl bg-pitch text-text-inverse text-xs font-bold flex items-center justify-center gap-1.5 hover:brightness-110 cursor-pointer shadow-md shadow-pitch/20"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Tallenna kaikki {extractedMessageEvents.length} ottelua ({selectedPlayer})</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: Table / Excel */}
            {activeTab === 'table' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-text-secondary">
                    Kopioi taulukko Sheetsistä tai pudota tiedosto (.xlsx, .csv):
                  </p>
                  <label className="px-2.5 py-1 rounded-lg bg-surface text-text-primary text-[11px] font-bold border border-border-strong hover:border-pitch cursor-pointer flex items-center gap-1">
                    <Upload className="w-3 h-3" />
                    <span>Lataa tiedosto</span>
                    <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>

                <textarea
                  rows={4}
                  value={pastedTableText}
                  onChange={(e) => setPastedTableText(e.target.value)}
                  placeholder="Pvm&#9;Klo&#9;Ottelu&#9;Kenttä&#9;Kahviovuoro&#10;24.8.&#9;15:00&#9;HJK vs Honka&#9;Väiski&#9;Maija&#10;31.8.&#9;12:00&#9;EPS vs HJK&#9;Tapiola 2&#9;Eemil"
                  className="w-full p-3 rounded-2xl bg-surface-elevated border border-border-strong text-text-primary text-xs focus:outline-none focus:border-pitch resize-none font-mono"
                />

                <button
                  type="button"
                  onClick={handleParseTable}
                  disabled={!pastedTableText.trim()}
                  className="py-2.5 px-4 rounded-xl bg-pitch text-text-inverse text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Jäsennä taulukon ottelut</span>
                </button>

                {parseNotice && (
                  <p role="status" className="p-2.5 rounded-xl bg-whistle/15 border border-whistle/40 text-[11px] font-semibold text-text-primary">
                    {parseNotice}
                  </p>
                )}

                <div aria-live="polite">
                  {extractedTableEvents.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                      <div className="text-xs font-bold text-text-primary">
                        Löydetty {extractedTableEvents.length} ottelua:
                      </div>
                      <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5">
                        {extractedTableEvents.map((ev, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl bg-surface border border-border-subtle text-xs flex items-center justify-between">
                            <div>
                              <span className="font-bold">{ev.dateStr} klo {ev.kickoffTime}</span>: {ev.title} @ {ev.venueHint}
                              {ev.volunteerDuties.length > 0 && (
                                <div className="text-[11px] text-whistle font-semibold">{ev.volunteerDuties.join(', ')}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSaveEvents(extractedTableEvents)}
                        disabled={isSaving}
                        className="py-2.5 px-4 rounded-xl bg-pitch text-text-inverse text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Tallenna kaikki {extractedTableEvents.length} ottelua</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: OCR Screenshot */}
            {activeTab === 'ocr' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-text-secondary">
                  Lataa kuvakaappaus otteluohjelmasta tai kahviovuorolistasta:
                </p>

                <div className="p-6 rounded-2xl border-2 border-dashed border-border-strong hover:border-pitch transition-all flex flex-col items-center justify-center gap-2 text-center bg-surface-elevated/40">
                  <Camera className="w-8 h-8 text-pitch" />
                  <div className="text-xs font-bold text-text-primary">Valitse tai pudota kuva tähän</div>
                  <p className="text-[11px] text-text-muted">PNG, JPG, WebP, Screenshot</p>
                  <label className="mt-2 px-3 py-1.5 rounded-xl bg-pitch text-text-inverse text-xs font-bold hover:brightness-110 cursor-pointer">
                    <span>Valitse kuvatiedosto</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleImageOcr(f);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                <div aria-live="polite">
                  {isOcrProcessing && (
                    <div className="p-4 rounded-2xl bg-surface border border-pitch/30 flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-pitch animate-spin shrink-0" />
                      <div className="flex-1">
                        <div className="text-xs font-bold text-text-primary">{ocrStatus}</div>
                        <div className="w-full bg-border-subtle h-1.5 rounded-full mt-1.5 overflow-hidden">
                          <div
                            className="bg-pitch h-full transition-all duration-300"
                            style={{ width: `${Math.round(ocrProgress * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  {!isOcrProcessing && parseNotice && (
                    <p role="status" className="mt-3 p-2.5 rounded-xl bg-whistle/15 border border-whistle/40 text-[11px] font-semibold text-text-primary">
                      {parseNotice}
                    </p>
                  )}

                  {ocrExtractedEvents.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                      <div className="text-xs font-bold text-text-primary">
                        OCR tunnisti {ocrExtractedEvents.length} ottelua:
                      </div>
                      <div className="max-h-48 overflow-y-auto flex flex-col gap-1.5">
                        {ocrExtractedEvents.map((ev, idx) => (
                          <div key={idx} className="p-2.5 rounded-xl bg-surface border border-border-subtle text-xs">
                            <span className="font-bold">{ev.dateStr} klo {ev.kickoffTime}</span>: {ev.title} @ {ev.venueHint}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSaveEvents(ocrExtractedEvents)}
                        disabled={isSaving}
                        className="py-2.5 px-4 rounded-xl bg-pitch text-text-inverse text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Tallenna {ocrExtractedEvents.length} ottelua</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}


            {/* Success Message Banner */}
            {successMessage && (
              <div
                role="status"
                className="mt-4 p-3 rounded-2xl bg-pitch/20 border border-pitch text-pitch text-xs font-bold flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-border-subtle flex items-center gap-1.5 text-[11px] text-text-muted">
              <ShieldCheck className="w-3.5 h-3.5 text-pitch shrink-0" />
              <span>100% Paikallinen tekoäly & IndexedDB tallennus tällä puhelimella.</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
