import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Plus, CheckCircle2, MapPin, Clock, Shirt, User, X, Camera, Loader2, Link2 } from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import { SportType, MatchdayEvent } from '../types/matchday';
import { parseFreeformSportsMessage, ExtractedSportsEvent } from '../lib/ai/messageParserNLP';
import { convertExtractedToMatchdayEvent } from '../lib/ai/localAiEngine';
import { applyEventChatUpdate } from '../lib/ai/eventChatEngine';
import { db } from '../lib/storage/db';
import { pickNextTeamColor } from '../lib/sport/teamColors';

import { generateStableProfileId } from '../lib/clubs/attachTeam';
import { parseFamilyWhatsAppMessage } from '../lib/sync/familyWhatsApp';
import { syncFamilyRosterCycle } from '../lib/sync/familyCloud';
import { extractTextFromImage } from '../lib/ai/ocrImageParser';

import { rankEventCandidatesForMessage, CandidateRankingResult } from '../lib/ai/eventCandidateRanker';

interface QuickDropInBarProps {
  existingPlayers: string[];
  activeProfilePlayerName?: string;
  onEventCreated?: () => void;
}

export const QuickDropInBar: React.FC<QuickDropInBarProps> = ({
  existingPlayers = [],
  activeProfilePlayerName,
  onEventCreated
}) => {
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState(
    activeProfilePlayerName && activeProfilePlayerName !== 'all'
      ? activeProfilePlayerName
      : existingPlayers[0] || 'Maija'
  );
  const [selectedSport, setSelectedSport] = useState<SportType>('football');
  const [previewEvent, setPreviewEvent] = useState<ExtractedSportsEvent | null>(null);
  const [rankingResult, setRankingResult] = useState<CandidateRankingResult | null>(null);
  const [familyJoinCode, setFamilyJoinCode] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOcrLoading(true);
    setIsExpanded(true);
    setOcrStatus('Luetaan kuvaa tekoälyllä...');
    try {
      const extracted = await extractTextFromImage(file, (p) => {
        if (p.status === 'recognizing text') {
          setOcrStatus(`Tunnistetaan tekstiä (${Math.round(p.progress * 100)}%)...`);
        }
      });
      if (extracted && extracted.trim().length > 0) {
        setText(extracted.trim());
        setOcrStatus('');
      } else {
        setSaveError('Kuvasta ei löytynyt luettavaa tekstiä.');
        setTimeout(() => setSaveError(''), 4000);
      }
    } catch (err: any) {
      setSaveError('Kuvan lukeminen epäonnistui.');
      setTimeout(() => setSaveError(''), 4000);
    } finally {
      setIsOcrLoading(false);
      setOcrStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Sync active player if profile changes
  useEffect(() => {
    if (activeProfilePlayerName && activeProfilePlayerName !== 'all') {
      setSelectedPlayer(activeProfilePlayerName);
    }
  }, [activeProfilePlayerName]);

  // Live parse text with 250ms debounce as user types or pastes
  useEffect(() => {
    const trimmed = text.trim();
    if (trimmed.length <= 5) {
      setPreviewEvent(null);
      setRankingResult(null);
      setFamilyJoinCode(null);
      return;
    }

    const timer = setTimeout(async () => {
      // Check for family code / whatsapp invite join
      const waParse = parseFamilyWhatsAppMessage(trimmed);
      if (waParse.type === 'join' && waParse.familyCode) {
        setFamilyJoinCode(waParse.familyCode);
        return;
      } else {
        setFamilyJoinCode(null);
      }

      try {
        const events = await db.events.toArray();
        const profiles = await db.profiles.toArray();

        // 1. Run local AI ranker to find matching candidate events from best to weakest
        const ranking = rankEventCandidatesForMessage(trimmed, events, profiles);
        setRankingResult(ranking);

        // Auto-select detected player if mentioned in text
        const resolvedPlayer = ranking.detectedPlayerName || selectedPlayer;
        if (ranking.detectedPlayerName && ranking.detectedPlayerName !== selectedPlayer) {
          setSelectedPlayer(ranking.detectedPlayerName);
        }

        // 2. Parse new event preview as fallback
        const parsed = parseFreeformSportsMessage(trimmed, resolvedPlayer);
        setPreviewEvent(parsed);
        setSelectedSport(parsed.sport);
      } catch (e) {
        console.warn('Failed to rank candidate events', e);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [text, existingPlayers, selectedPlayer]);

  const handleUpdateSpecificMatch = async (targetEvent: MatchdayEvent) => {
    setIsSaving(true);
    try {
      const { updatedEvent } = await applyEventChatUpdate(targetEvent, text);
      await db.events.put(updatedEvent);
      setSaveSuccess(true);
      setTimeout(() => {
        setText('');
        setPreviewEvent(null);
        setRankingResult(null);
        setIsExpanded(false);
        setSaveSuccess(false);
        onEventCreated?.();
      }, 1000);
    } catch (err: any) {
      setSaveError(err?.message || 'Päivitys epäonnistui');
      setTimeout(() => setSaveError(''), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleJoinFamily = async (code: string) => {
    setIsSaving(true);
    const res = await syncFamilyRosterCycle(code, db);
    setIsSaving(false);
    if (res.success) {
      setSaveSuccess(true);
      setTimeout(() => {
        setText('');
        setFamilyJoinCode(null);
        setIsExpanded(false);
        setSaveSuccess(false);
        onEventCreated?.();
      }, 1000);
    } else {
      // Failure must never be silent (M-09): surface the reason.
      setSaveError(res.error || 'Liittyminen epäonnistui. Tarkista koodi ja verkko.');
      setTimeout(() => setSaveError(''), 4000);
    }
  };

  const handleSave = async () => {
    if (!previewEvent) return;
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
        profileId = generateStableProfileId(selectedPlayer.trim(), `manual:${selectedSport}`);
        await db.profiles.add({
          id: profileId,
          playerName: selectedPlayer.trim() || 'Pelaaja',
          teamName:
            previewEvent.homeTeam && previewEvent.homeTeam !== 'Oma joukkue'
              ? previewEvent.homeTeam
              : `${selectedSport === 'floorball' ? 'Salibandy' : selectedSport === 'basketball' ? 'Koripallo' : 'Jalkapallo'}`,
          sport: selectedSport,
          primaryColor: swatch.label,
          calendarUrl: '',
          colorHex: swatch.hex
        });
      }

      const matchEvent = await convertExtractedToMatchdayEvent(
        previewEvent,
        profileId,
        selectedPlayer
      );
      await db.events.put(matchEvent);

      setSaveSuccess(true);
      setTimeout(() => {
        setText('');
        setPreviewEvent(null);
        setIsExpanded(false);
        setSaveSuccess(false);
        onEventCreated?.();
      }, 1000);
    } catch (err: any) {
      setSaveError(err?.message || 'Tallennus epäonnistui');
      setTimeout(() => setSaveError(''), 4000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full mb-5">
      <div className="liquid-glass rounded-2xl p-3 border border-border-strong shadow-lg focus-within:border-pitch transition-all">
        {/* Input Bar Header */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-pitch/15 text-pitch shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>

          <input
            type="text"
            value={text}
            onFocus={() => setIsExpanded(true)}
            onChange={(e) => setText(e.target.value)}
            placeholder="💬 Liitä teksti WhatsAppista, MyClubista tai kirjoita oma merkintä..."
            className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none font-medium"
          />

          {text && (
            <button
              type="button"
              onClick={() => {
                setText('');
                setPreviewEvent(null);
              }}
              className="p-1 rounded-full text-text-muted hover:text-text-primary cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Hidden File Input for Camera / Screenshot OCR */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
            id="quick-dropin-ocr-input"
          />
          <label
            htmlFor="quick-dropin-ocr-input"
            title="Lue otteluohjelma tai viesti kuvasta tekoälyllä"
            className="p-1.5 px-2 rounded-xl bg-surface-elevated border border-border-strong text-text-secondary hover:text-pitch hover:border-pitch cursor-pointer shrink-0 transition-all flex items-center gap-1.5 text-xs font-bold"
          >
            {isOcrLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-pitch" />
            ) : (
              <Camera className="w-3.5 h-3.5 text-pitch" />
            )}
            <span className="text-[11px]">Kuva</span>
          </label>

          {familyJoinCode && !saveSuccess && (
            <motion.button
              whileTap={{ scale: 0.94 }}
              transition={springTactile.snappy}
              onClick={() => handleJoinFamily(familyJoinCode)}
              disabled={isSaving}
              className="py-1.5 px-3 rounded-xl bg-pitch text-text-inverse text-xs font-bold flex items-center gap-1.5 hover:brightness-110 cursor-pointer shrink-0 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Liity ({familyJoinCode})</span>
            </motion.button>
          )}

          {previewEvent && !familyJoinCode && !saveSuccess && (
            <motion.button
              whileTap={{ scale: 0.94 }}
              transition={springTactile.snappy}
              onClick={handleSave}
              disabled={isSaving}
              className="py-1.5 px-3 rounded-xl bg-pitch text-text-inverse text-xs font-bold flex items-center gap-1 hover:brightness-110 cursor-pointer shrink-0 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tallenna</span>
            </motion.button>
          )}
        </div>

        {/* Expanded View with Player Selector & Live Event Preview */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={springTactile.gentle}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-2 border-t border-border-subtle flex flex-col gap-2.5">
                {/* OCR Loading Banner */}
                {isOcrLoading && (
                  <div className="p-2.5 rounded-xl bg-pitch/10 border border-pitch/30 text-pitch text-xs font-bold flex items-center gap-2 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    <span>{ocrStatus || 'Luetaan kuvaa tekoälyllä...'}</span>
                  </div>
                )}
                {/* Child & Sport Selector */}
                <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-text-muted">👤 Pelaaja:</span>
                    {existingPlayers.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setSelectedPlayer(p)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border cursor-pointer ${
                          selectedPlayer === p
                            ? 'bg-pitch text-text-inverse border-pitch'
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
                      placeholder="Muu nimi"
                      className="px-2 py-0.5 rounded-md bg-surface border border-border-strong text-text-primary text-[11px] font-bold w-20 focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-text-muted">Laji:</span>
                    <select
                      value={selectedSport}
                      onChange={(e) => setSelectedSport(e.target.value as SportType)}
                      className="px-2 py-0.5 rounded-md bg-surface border border-border-strong text-text-primary text-[11px] font-semibold focus:outline-none"
                    >
                      <option value="football">⚽ Futis</option>
                      <option value="floorball">🏑 Säbä</option>
                      <option value="basketball">🏀 Koris</option>
                      <option value="volleyball">🏐 Lentis</option>
                      <option value="icehockey">🏒 Lätkä</option>
                    </select>
                  </div>
                </div>

                {/* Multiline textarea if user wants to paste large text */}
                <textarea
                  rows={2}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Esim: Lauantaina 24.8. harkkapeli Väiskillä klo 16.30 (kokoontuminen 15.45). Mustat paidat. Maijalla kahviovuoro klo 16-18."
                  className="w-full p-2.5 rounded-xl bg-surface-elevated border border-border-subtle text-text-primary text-xs focus:outline-none focus:border-pitch resize-none"
                />

                {/* Auto-Detected Player Pill */}
                {rankingResult?.detectedPlayerName && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pitch/10 border border-pitch/30 text-pitch text-xs font-bold">
                    <span>✨</span>
                    <span>Tunnistettu tekstistä pelaajalle: <strong>{rankingResult.detectedPlayerName}</strong></span>
                  </div>
                )}

                {/* RANKED CANDIDATE MATCHES LIST (Best to Weakest) */}
                {rankingResult && rankingResult.candidates.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-text-secondary">
                      <span className="flex items-center gap-1">
                        <Link2 className="w-3.5 h-3.5 text-pitch" />
                        <span>AI:n löytämät ottelut (parhaasta heikompaan):</span>
                      </span>
                      <span className="text-text-muted">
                        {rankingResult.candidates.length} ehdotus{rankingResult.candidates.length > 1 ? 'ta' : ''}
                      </span>
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {rankingResult.candidates.map((cand, idx) => {
                        const isTop = idx === 0;
                        const candDate = new Date(cand.event.startTime).toLocaleDateString('fi-FI', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'numeric'
                        });
                        const candTime = new Date(cand.event.startTime).toLocaleTimeString('fi-FI', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'Europe/Helsinki'
                        });

                        return (
                          <motion.div
                            key={cand.event.id}
                            initial={{ opacity: 0, y: 3 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-3.5 rounded-2xl border transition-all flex flex-col gap-2 ${
                              isTop
                                ? 'bg-surface border-pitch shadow-sm shadow-pitch/10'
                                : 'bg-surface/70 border-border-subtle hover:border-border-strong'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                                    cand.matchPercentage >= 80
                                      ? 'bg-pitch/20 text-pitch border border-pitch/40'
                                      : 'bg-whistle/20 text-whistle border border-whistle/40'
                                  }`}
                                >
                                  {isTop ? '🥇 Paras osuma' : `${idx + 1}. Vaihtoehto`} ({cand.matchPercentage}%)
                                </span>
                                <span className="text-xs font-black text-text-primary truncate">
                                  {cand.event.isTraining
                                    ? cand.event.title
                                    : `${cand.event.homeTeam} vs ${cand.event.awayTeam}`}
                                </span>
                              </div>

                              {cand.profile && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-surface-elevated text-text-secondary shrink-0">
                                  👤 {cand.profile.playerName}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-text-secondary flex-wrap">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-pitch" />
                                <span>{candDate} klo {candTime}</span>
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1 truncate max-w-[220px]">
                                <MapPin className="w-3 h-3 text-radar" />
                                <span className="truncate">{cand.event.venue.name}</span>
                              </span>
                            </div>

                            {/* AI Suggestion Narrative */}
                            <div className="text-xs text-text-secondary bg-surface-elevated p-2 rounded-xl border border-border-subtle/80 flex flex-col gap-0.5">
                              <div className="text-[10px] font-bold text-pitch uppercase tracking-wider">
                                {cand.matchReason}
                              </div>
                              <div className="text-[11px] text-text-primary font-medium">
                                {cand.suggestedActionText}
                              </div>
                            </div>

                            <div className="pt-1 flex items-center justify-between border-t border-border-subtle/60">
                              <button
                                type="button"
                                onClick={() => handleUpdateSpecificMatch(cand.event)}
                                disabled={isSaving}
                                className={`py-1.5 px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all ${
                                  isTop
                                    ? 'bg-pitch text-text-inverse hover:brightness-110 shadow-pitch/20'
                                    : 'bg-surface-elevated border border-border-strong text-text-primary hover:border-pitch hover:text-pitch'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Yhdistä tähän otteluun</span>
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Fallback Option: Create As A Brand New Event */}
                {previewEvent && (
                  <div className="pt-2 border-t border-border-subtle/80">
                    <div className="text-[11px] font-bold text-text-secondary mb-1.5 flex items-center gap-1">
                      <span>✨</span>
                      <span>
                        {rankingResult && rankingResult.candidates.length > 0
                          ? 'Tai luo kokonaan uusi erillinen tapahtuma:'
                          : 'Luo uusi tapahtuma kalenteriin:'}
                      </span>
                    </div>

                    <motion.div
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 rounded-xl bg-surface border border-border-subtle flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-black text-text-primary">
                          <span className="text-pitch">✨</span>
                          <span>{previewEvent.title}</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-pitch/15 text-pitch font-bold">
                          {previewEvent.dateStr}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-text-secondary flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-pitch" />
                          <span>Aloitus klo {previewEvent.kickoffTime} (Alkulämpö {previewEvent.warmupTime})</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-radar" />
                          <span>{previewEvent.venueHint}</span>
                        </span>
                      </div>

                      {previewEvent.kitColor && (
                        <div className="text-[11px] text-pitch font-semibold flex items-center gap-1">
                          <Shirt className="w-3 h-3" />
                          <span>{previewEvent.kitColor}</span>
                        </div>
                      )}

                      {previewEvent.volunteerDuties.length > 0 && (
                        <div className="text-[11px] text-whistle font-semibold">
                          <span>{previewEvent.volunteerDuties.join(' • ')}</span>
                        </div>
                      )}

                      <div className="mt-1 flex items-center justify-between pt-1.5 border-t border-border-subtle">
                        <span className="text-[10px] text-text-muted flex items-center gap-1">
                          <User className="w-3 h-3 text-pitch" />
                          <span>Lisätään pelaajalle <strong>{selectedPlayer}</strong></span>
                        </span>

                        <button
                          type="button"
                          onClick={handleSave}
                          disabled={isSaving}
                          className="py-1.5 px-3 rounded-lg bg-surface-elevated border border-border-strong hover:border-pitch text-text-primary text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-pitch" />
                          <span>Tallenna uutena tapahtumana</span>
                        </button>
                      </div>
                    </motion.div>
                  </div>
                )}

                {saveSuccess && (
                  <div className="p-2 rounded-xl bg-pitch/20 border border-pitch text-pitch text-xs font-bold flex items-center gap-1.5 animate-bounce">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Tallennettu onnistuneesti pelaajalle {selectedPlayer}!</span>
                  </div>
                )}

                {saveError && (
                  <div className="p-2 rounded-xl bg-red-500/20 border border-red-500 text-red-400 text-xs font-bold flex items-center gap-1.5">
                    <span>⚠️ {saveError}</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
