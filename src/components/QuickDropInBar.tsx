import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Plus, CheckCircle2, MapPin, Clock, Shirt, User, X } from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import { SportType } from '../types/matchday';
import { parseFreeformSportsMessage, ExtractedSportsEvent } from '../lib/ai/messageParserNLP';
import { convertExtractedToMatchdayEvent } from '../lib/ai/localAiEngine';
import { db } from '../lib/storage/db';
import { pickNextTeamColor } from '../lib/sport/teamColors';

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
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync active player if profile changes
  useEffect(() => {
    if (activeProfilePlayerName && activeProfilePlayerName !== 'all') {
      setSelectedPlayer(activeProfilePlayerName);
    }
  }, [activeProfilePlayerName]);

  // Live parse text as user types or pastes
  useEffect(() => {
    const trimmed = text.trim();
    if (trimmed.length > 8) {
      // Check if text mentions an existing child name
      const mentionedChild = existingPlayers.find((p) =>
        new RegExp(`\\b${p}\\b`, 'i').test(trimmed)
      );
      if (mentionedChild && mentionedChild !== selectedPlayer) {
        setSelectedPlayer(mentionedChild);
      }

      const parsed = parseFreeformSportsMessage(trimmed, selectedPlayer);
      setPreviewEvent(parsed);
      setSelectedSport(parsed.sport);
    } else {
      setPreviewEvent(null);
    }
  }, [text, existingPlayers]);

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
        profileId = `profile-${Date.now()}`;
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
              onClick={() => {
                setText('');
                setPreviewEvent(null);
              }}
              className="p-1 rounded-full text-text-muted hover:text-text-primary cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {previewEvent && !saveSuccess && (
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

                {/* Real-Time Extracted Preview Card */}
                {previewEvent && (
                  <motion.div
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-surface border border-pitch/40 flex flex-col gap-1.5"
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
                        <span>Kickoff klo {previewEvent.kickoffTime} (Alkulämpö {previewEvent.warmupTime})</span>
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
                        className="py-1.5 px-3 rounded-lg bg-pitch text-text-inverse text-xs font-bold flex items-center gap-1 hover:brightness-110 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Tallenna tapahtuma</span>
                      </button>
                    </div>
                  </motion.div>
                )}

                {saveSuccess && (
                  <div className="p-2 rounded-xl bg-pitch/20 border border-pitch text-pitch text-xs font-bold flex items-center gap-1.5 animate-bounce">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Tallennettu onnistuneesti pelaajalle {selectedPlayer}!</span>
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
