import React, { useState } from 'react';
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
  Plus
} from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import { SportType } from '../types/matchday';
import {
  parseFreeformSportsMessage,
  parsePastedSpreadsheetText,
  parseExcelFileBuffer,
  parseScheduleImage,
  convertExtractedToMatchdayEvent
} from '../lib/ai/localAiEngine';
import { ExtractedSportsEvent } from '../lib/ai/messageParserNLP';
import { db } from '../lib/storage/db';
import { pickNextTeamColor } from '../lib/sport/teamColors';

interface SmartImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingPlayers: string[];
  onEventsImported?: () => void;
  onImportClassic?: (playerName: string, teamName: string, sport: SportType, url: string) => Promise<void>;
}

type ImportTab = 'message' | 'table' | 'ocr' | 'classic';

export const SmartImportModal: React.FC<SmartImportModalProps> = ({
  isOpen,
  onClose,
  existingPlayers = [],
  onEventsImported,
  onImportClassic
}) => {
  const [activeTab, setActiveTab] = useState<ImportTab>('message');
  const [selectedPlayer, setSelectedPlayer] = useState(existingPlayers[0] || 'Maija');
  const [selectedSport, setSelectedSport] = useState<SportType>('football');

  // Tab 1: Freeform text
  const [pastedMessage, setPastedMessage] = useState('');
  const [extractedMessageEvent, setExtractedMessageEvent] = useState<ExtractedSportsEvent | null>(null);

  // Tab 2: Table / Excel
  const [pastedTableText, setPastedTableText] = useState('');
  const [extractedTableEvents, setExtractedTableEvents] = useState<ExtractedSportsEvent[]>([]);

  // Tab 3: OCR
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrExtractedEvents, setOcrExtractedEvents] = useState<ExtractedSportsEvent[]>([]);

  // Tab 4: Classic URL
  const [classicUrl, setClassicUrl] = useState('');
  const [classicTeamName, setClassicTeamName] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Handle parsing freeform message
  const handleParseMessage = () => {
    if (!pastedMessage.trim()) return;
    const res = parseFreeformSportsMessage(pastedMessage, selectedPlayer);
    setExtractedMessageEvent(res);
  };

  // Handle parsing pasted table
  const handleParseTable = () => {
    if (!pastedTableText.trim()) return;
    const res = parsePastedSpreadsheetText(pastedTableText, selectedSport, selectedPlayer);
    setExtractedTableEvents(res.events);
  };

  // Handle Excel file drop/upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const buffer = await file.arrayBuffer();
      const res = parseExcelFileBuffer(buffer, selectedSport, selectedPlayer);
      setExtractedTableEvents(res.events);
      setActiveTab('table');
    } else if (file.type.startsWith('image/')) {
      await handleImageOcr(file);
    }
  };

  // Handle Image OCR
  const handleImageOcr = async (file: File | Blob) => {
    setIsOcrProcessing(true);
    setOcrStatus('Käynnistetään paikallinen tekoäly-OCR...');
    setOcrProgress(0.1);

    try {
      const res = await parseScheduleImage(file, selectedSport, selectedPlayer, (p) => {
        setOcrStatus(`Luetaan kuvaa: ${Math.round(p.progress * 100)}%`);
        setOcrProgress(p.progress);
      });
      setOcrExtractedEvents(res.freeformEvents);
      setActiveTab('ocr');
    } catch (err) {
      console.error(err);
      setOcrStatus('OCR epäonnistui. Kokeile liittää teksti suoraan.');
    } finally {
      setIsOcrProcessing(false);
    }
  };

  // Save events to local IndexedDB
  const handleSaveEvents = async (eventsToSave: ExtractedSportsEvent[]) => {
    if (eventsToSave.length === 0) return;
    setIsSaving(true);

    try {
      // Find or create profile for selectedPlayer
      const existingProfiles = await db.profiles.toArray();
      let profile = existingProfiles.find(
        (p) => p.playerName.toLowerCase() === selectedPlayer.toLowerCase() && p.sport === selectedSport
      );

      let profileId = profile?.id;
      if (!profileId) {
        const swatch = pickNextTeamColor(existingProfiles.map((p) => p.colorHex));
        profileId = `profile-${Date.now()}`;
        await db.profiles.add({
          id: profileId,
          playerName: selectedPlayer.trim() || 'Pelaaja',
          teamName:
            eventsToSave[0]?.homeTeam && eventsToSave[0].homeTeam !== 'Oma joukkue'
              ? eventsToSave[0].homeTeam
              : `${selectedSport === 'floorball' ? 'Salibandy' : selectedSport === 'basketball' ? 'Koripallo' : 'Jalkapallo'}`,
          sport: selectedSport,
          primaryColor: swatch.label,
          calendarUrl: '',
          colorHex: swatch.hex
        });
      }

      for (const extracted of eventsToSave) {
        const fullEvent = await convertExtractedToMatchdayEvent(extracted, profileId, selectedPlayer);
        await db.events.put(fullEvent);
      }

      setSuccessMessage(`Tallennettu ${eventsToSave.length} ottelua pelaajalle ${selectedPlayer}!`);
      setTimeout(() => {
        setSuccessMessage('');
        onEventsImported?.();
        onClose();
      }, 1200);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-canvas/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 10 }}
            transition={springTactile.gentle}
            className="liquid-glass relative w-full max-w-xl rounded-3xl p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-pitch/15 text-pitch">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-text-primary">Pelipäivä Äly-tuonti</h3>
                  <p className="text-xs text-text-muted">
                    Liitä WhatsApp-viesti, Excel/Sheets-taulukko tai kuvakaappaus
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-elevated cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Player & Sport Selection Header */}
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
                      onClick={() => setSelectedPlayer(p)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer ${
                        selectedPlayer === p
                          ? 'bg-pitch text-text-inverse border-pitch shadow-sm'
                          : 'bg-surface text-text-secondary border-border-subtle hover:text-text-primary'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <input
                    type="text"
                    value={selectedPlayer}
                    onChange={(e) => setSelectedPlayer(e.target.value)}
                    placeholder="Kirjoita nimi"
                    className="px-2.5 py-1 rounded-lg bg-surface border border-border-strong text-text-primary text-xs font-bold w-28 focus:outline-none focus:border-pitch"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Laji</label>
                <select
                  value={selectedSport}
                  onChange={(e) => setSelectedSport(e.target.value as SportType)}
                  className="px-2.5 py-1 rounded-lg bg-surface border border-border-strong text-text-primary text-xs font-medium focus:outline-none"
                >
                  <option value="football">⚽ Jalkapallo</option>
                  <option value="floorball">🏑 Salibandy</option>
                  <option value="basketball">🏀 Koripallo</option>
                  <option value="volleyball">🏐 Lentopallo</option>
                  <option value="icehockey">🏒 Jääkiekko</option>
                </select>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-surface-elevated border border-border-subtle mb-4 overflow-x-auto">
              <button
                onClick={() => setActiveTab('message')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'message'
                    ? 'bg-pitch text-text-inverse shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>WhatsApp-viesti</span>
              </button>

              <button
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

              <button
                onClick={() => setActiveTab('classic')}
                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'classic'
                    ? 'bg-pitch text-text-inverse shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>.ics / Liitto</span>
              </button>
            </div>

            {/* TAB 1: WhatsApp Message Parser */}
            {activeTab === 'message' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-text-secondary">
                  Liitä valmentajan tai jojon viesti (esim. WhatsAppista tai sähköpostista):
                </p>
                <textarea
                  rows={4}
                  value={pastedMessage}
                  onChange={(e) => setPastedMessage(e.target.value)}
                  placeholder="Esim: Lauantaina 24.8. peli Väiskillä klo 16:30 (kokoontuminen 15:45). Mustat paidat päälle. Maijalla kahviovuoro klo 16-18, tuokaa maitoa ja mokkapaloja."
                  className="w-full p-3 rounded-2xl bg-surface-elevated border border-border-strong text-text-primary text-xs focus:outline-none focus:border-pitch resize-none"
                />

                <button
                  type="button"
                  onClick={handleParseMessage}
                  disabled={!pastedMessage.trim()}
                  className="py-2.5 px-4 rounded-xl bg-pitch text-text-inverse text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Jäsennä ottelutiedot tekoälyllä</span>
                </button>

                {extractedMessageEvent && (
                  <div className="mt-3 p-4 rounded-2xl bg-surface border border-pitch/40 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-pitch">✨ Tunnistettu ottelu</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-pitch/15 text-pitch font-bold">
                        Pvm: {extractedMessageEvent.dateStr}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-text-primary">{extractedMessageEvent.title}</div>
                    <div className="text-xs text-text-secondary">
                      📍 {extractedMessageEvent.venueHint} • ⏰ Aloitus klo {extractedMessageEvent.kickoffTime} (Alkulämpö {extractedMessageEvent.warmupTime})
                    </div>

                    {extractedMessageEvent.kitColor && (
                      <div className="text-xs text-pitch font-semibold">
                        👕 Peliasu: {extractedMessageEvent.kitColor}
                      </div>
                    )}

                    {extractedMessageEvent.volunteerDuties.length > 0 && (
                      <div className="text-xs text-whistle font-semibold flex items-center gap-1">
                        <span>{extractedMessageEvent.volunteerDuties.join(' • ')}</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleSaveEvents([extractedMessageEvent])}
                      disabled={isSaving}
                      className="mt-2 py-2 px-3 rounded-xl bg-pitch text-text-inverse text-xs font-bold flex items-center justify-center gap-1.5 hover:brightness-110 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Tallenna {selectedPlayer}:n kalenteriin</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Table / Excel */}
            {activeTab === 'table' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-text-secondary">
                    Kopioi ja liitä taulukkorivit Google Sheetsistä tai pudota .xlsx / .csv -tiedosto:
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
            )}

            {/* TAB 3: OCR Screenshot */}
            {activeTab === 'ocr' && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-text-secondary">
                  Lataa kuvakaappaus tai valokuva otteluohjelmasta / kahviovuorolistasta:
                </p>

                <div className="p-6 rounded-2xl border-2 border-dashed border-border-strong hover:border-pitch transition-all flex flex-col items-center justify-center gap-2 text-center bg-surface-elevated/40">
                  <Camera className="w-8 h-8 text-pitch" />
                  <div className="text-xs font-bold text-text-primary">Valitse tai pudota kuva tähän</div>
                  <p className="text-[11px] text-text-muted">Tuetut muodot: PNG, JPG, WebP, Screenshot</p>
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
            )}

            {/* TAB 4: Classic URL */}
            {activeTab === 'classic' && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!classicUrl) return;
                  await onImportClassic?.(selectedPlayer, classicTeamName || 'Oma joukkue', selectedSport, classicUrl);
                  onClose();
                }}
                className="flex flex-col gap-3"
              >
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Joukkueen nimi *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="esim. HJK T13 Sininen"
                    value={classicTeamName}
                    onChange={(e) => setClassicTeamName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-xs focus:outline-none focus:border-pitch"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">
                    Kalenterin .ics-osoite tai Palloliitto / Torneopal -linkki *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://nimenhuuto.com/... tai https://tulospalvelu.palloliitto.fi/team/..."
                    value={classicUrl}
                    onChange={(e) => setClassicUrl(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-xs focus:outline-none focus:border-pitch"
                  />
                </div>

                <button
                  type="submit"
                  className="py-2.5 px-4 rounded-xl bg-pitch text-text-inverse text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tuo kalenteri</span>
                </button>
              </form>
            )}

            {/* Success Message Banner */}
            {successMessage && (
              <div className="mt-4 p-3 rounded-2xl bg-pitch/20 border border-pitch text-pitch text-xs font-bold flex items-center gap-2 animate-bounce">
                <CheckCircle2 className="w-4 h-4" />
                <span>{successMessage}</span>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
