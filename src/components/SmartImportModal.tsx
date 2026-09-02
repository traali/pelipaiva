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
  AlertTriangle,
  ShieldCheck,
  Edit3
} from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import { SportType, type FamilyManualEvent } from '../types/matchday';
import {
  parseMultipleSportsMessages,
  parsePastedSpreadsheetText,
  parseExcelFileBuffer,
  parseScheduleImage,
  convertExtractedToMatchdayEvent
} from '../lib/ai/localAiEngine';
import { ExtractedSportsEvent } from '../lib/ai/messageParserNLP';
import { db } from '../lib/storage/db';
import { recordManualFamilyEvent } from '../lib/sync/familyCloud';
import { pickNextTeamColor } from '../lib/sport/teamColors';
import { generateStableProfileId } from '../lib/clubs/attachTeam';
import { EXAMPLE_TOURNAMENTS } from '../lib/clubs/exampleTournaments';
import { type ClubPreset } from '../lib/clubs/popularClubsCatalog';
import { parseAssociationUrl } from '../lib/stats/statsEngine';
import { extractFeedCategories, type FeedCategory } from '../lib/calendar/icsParser';
import { fetchRawIcsFeed } from '../lib/clubs/ingestOfficial';
import {
  ClassicUrlImportTab,
  MessageNlpImportTab,
  SpreadsheetImportTab,
  CameraOcrImportTab
} from './import/tabs';

export type ImportTab = 'classic' | 'message' | 'table' | 'ocr';

interface SmartImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPlayers: string[];
  initialSport?: SportType;
  initialTeamUrl?: string;
  initialTeamName?: string;
  initialPlayerName?: string;
  initialColorHex?: string;
  initialSquadFilters?: string[];
  editingProfileId?: string;
  initialTab?: ImportTab;
  onEventsImported?: () => void;
  onImportClassic?: (
    playerName: string,
    teamName: string,
    sport: SportType,
    url: string,
    colorHex?: string,
    squadFilters?: string[],
    editingProfileId?: string
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
  initialColorHex,
  initialSquadFilters,
  editingProfileId,
  initialTab = 'message',
  onEventsImported,
  onImportClassic
}) => {
  const isEditing = Boolean(initialTeamUrl || initialTeamName || editingProfileId);
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
  const [clubSearchQuery, setClubSearchQuery] = useState('');
  const [clubMatches, setClubMatches] = useState<ClubPreset[]>([]);
  const [discoveredCategories, setDiscoveredCategories] = useState<FeedCategory[]>([]);
  const [excludedCategories, setExcludedCategories] = useState<string[]>([]);
  const [isScanningCategories, setIsScanningCategories] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const scanIcsCategories = async (urlToScan: string) => {
    const trimmed = urlToScan.trim();
    if (!trimmed || !/\.ics|webcal:|nimenhuuto\.com|myclub\.fi|jopox\.fi/i.test(trimmed)) {
      setDiscoveredCategories([]);
      return;
    }
    setIsScanningCategories(true);
    try {
      const text = await fetchRawIcsFeed(trimmed);
      if (text) {
        const cats = extractFeedCategories(text);
        setDiscoveredCategories(cats);
      } else {
        setDiscoveredCategories([]);
      }
    } catch {
      setDiscoveredCategories([]);
    } finally {
      setIsScanningCategories(false);
    }
  };

  // Query active sports for the selected player from profiles and events
  useEffect(() => {
    let isMounted = true;
    (async () => {
      if (!selectedPlayer) return;
      try {
        const allProfiles = await db.profiles.toArray();
        const profiles = allProfiles.filter(
          (p) => (p.playerName || '').trim().toLowerCase() === selectedPlayer.trim().toLowerCase()
        );
        const profileIds = new Set(profiles.map((p) => p.id));
        const allEvents = await db.events.toArray();
        const events = allEvents.filter((e) => profileIds.has(e.profileId));
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
        }
      } catch (e) {
        console.warn('Failed to query player sports in SmartImportModal', e);
      }
    })();
    return () => { isMounted = false; };
  }, [selectedPlayer]);

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
      setActiveTab(initialTeamUrl || initialTeamName || editingProfileId ? 'classic' : initialTab);
      setColorHex(initialColorHex || pickNextTeamColor([]).hex);
      setSuccessMessage('');
      setErrorMessage('');
      setDiscoveredCategories([]);
      setExcludedCategories(initialSquadFilters || []);
      setIsSaving(false);
      if (initialTeamUrl) {
        scanIcsCategories(initialTeamUrl);
      }
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, initialPlayerName, initialSport, initialTeamUrl, initialTeamName, initialColorHex, initialSquadFilters, editingProfileId, initialTab, existingPlayers]);

  const handleUrlChange = (val: string) => {
    setClassicUrl(val);
    setErrorMessage('');
    if (!isEditing) {
      const parsed = parseAssociationUrl(val);
      if (parsed?.sport && parsed.sport !== 'other') {
        setSelectedSport(parsed.sport);
      }
    }
    scanIcsCategories(val);
  };

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

    if (
      file.name.endsWith('.csv') ||
      file.name.endsWith('.tsv') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls')
    ) {
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

      const sync = await db.syncState.get('family').catch(() => null);
      for (const extracted of usable) {
        const fullEvent = await convertExtractedToMatchdayEvent(extracted, profileId, selectedPlayer);
        await db.events.put(fullEvent);
        const manualEvent: FamilyManualEvent = {
          id: fullEvent.id,
          title: fullEvent.title || `${fullEvent.homeTeam || ''} vs ${fullEvent.awayTeam || ''}`,
          startTime: fullEvent.startTime,
          endTime: fullEvent.endTime,
          profileIds: [profileId],
          notes: fullEvent.notes,
          authorDeviceId: 'device',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await recordManualFamilyEvent(sync?.syncKey || '', manualEvent, db);
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
          colorHex,
          excludedCategories.length > 0 ? excludedCategories : undefined,
          editingProfileId
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
                  {isEditing ? <Edit3 className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
                </div>
                <div>
                  <h3 id="smart-import-title" className="text-lg font-black text-text-primary">
                    {isEditing ? 'Muokkaa joukkueen tietoja' : 'Tuo joukkue tai otteluita'}
                  </h3>
                  <p className="text-xs text-text-muted">
                    {isEditing
                      ? 'Päivitä joukkueen nimi, laji, väri tai kalenterin suodatukset'
                      : 'Liitä liiton sarjasivu, .ics-linkki, WhatsApp-viesti tai taulukko'}
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

            {activeTab === 'classic' && (
              <ClassicUrlImportTab
                isEditing={isEditing}
                exampleTournaments={EXAMPLE_TOURNAMENTS}
                handleSelectCupPreset={handleSelectCupPreset}
                clubSearchQuery={clubSearchQuery}
                setClubSearchQuery={setClubSearchQuery}
                clubMatches={clubMatches as any}
                setClubMatches={setClubMatches as any}
                setClassicTeamName={setClassicTeamName}
                setSelectedSport={setSelectedSport}
                setClassicUrl={handleUrlChange}
                setColorHex={setColorHex}
                classicUrl={classicUrl}
                classicTeamName={classicTeamName}
                colorHex={colorHex}
                discoveredCategories={discoveredCategories}
                excludedCategories={excludedCategories}
                setExcludedCategories={setExcludedCategories}
                isScanningCategories={isScanningCategories}
                scanIcsCategories={scanIcsCategories}
                handleClassicSubmit={handleClassicSubmit}
                isSaving={isSaving}
                selectedPlayer={selectedPlayer}
              />
            )}

            {activeTab === 'message' && (
              <MessageNlpImportTab
                pastedMessage={pastedMessage}
                setPastedMessage={setPastedMessage}
                handleParseMessage={handleParseMessage}
                parseNotice={parseNotice}
                extractedMessageEvents={extractedMessageEvents}
                handleSaveEvents={handleSaveEvents}
                isSaving={isSaving}
                selectedPlayer={selectedPlayer}
              />
            )}

            {activeTab === 'table' && (
              <SpreadsheetImportTab
                pastedTableText={pastedTableText}
                setPastedTableText={setPastedTableText}
                handleFileUpload={handleFileUpload}
                handleParseTable={handleParseTable}
                parseNotice={parseNotice}
                extractedTableEvents={extractedTableEvents}
                handleSaveEvents={handleSaveEvents}
                isSaving={isSaving}
              />
            )}

            {activeTab === 'ocr' && (
              <CameraOcrImportTab
                handleImageOcr={handleImageOcr}
                isOcrProcessing={isOcrProcessing}
                ocrStatus={ocrStatus}
                ocrProgress={ocrProgress}
                parseNotice={parseNotice}
                ocrExtractedEvents={ocrExtractedEvents}
                handleSaveEvents={handleSaveEvents}
                isSaving={isSaving}
                selectedPlayer={selectedPlayer}
              />
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
