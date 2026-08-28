import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Send,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Clock,
  MapPin,
  Coffee
} from 'lucide-react';
import type { MatchdayEvent, PlayerProfile } from '../types/matchday';
import { applyEventChatUpdate } from '../lib/ai/eventChatEngine';
import { springTactile } from '../lib/motion/springs';
import { EventMergeModal } from './EventMergeModal';
import { Link2 } from 'lucide-react';

interface EventChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: MatchdayEvent;
  allEvents?: MatchdayEvent[];
  profile?: PlayerProfile;
  onEventUpdated: (updatedEvent: MatchdayEvent) => void;
}

export const EventChatModal: React.FC<EventChatModalProps> = ({
  isOpen,
  onClose,
  event,
  allEvents = [],
  profile,
  onEventUpdated
}) => {
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [localEvent, setLocalEvent] = useState<MatchdayEvent>(event);
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isProcessing) return;

    setIsProcessing(true);
    setInputText('');

    try {
      const { updatedEvent } = await applyEventChatUpdate(localEvent, text, profile);
      setLocalEvent(updatedEvent);
      onEventUpdated(updatedEvent);
    } catch (err) {
      console.error('Failed to apply chat update', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const quickPrompts = [
    { label: '⚽ Tulos 3-2', text: 'Tulos 3-2' },
    { label: '⏰ Alkulämpö 16.30', text: 'Alkulämpö klo 16.30, peli 17.30' },
    { label: '🎽 Sininen pelipaita', text: 'Pelataan sinisellä pelipaidalla' },
    { label: '☕ Kahviovuoro 16-18', text: 'Kahviovuoro klo 16.00 - 18.00' },
    { label: '📍 Kenttävaihto TN2', text: 'Kenttä vaihdettu: TN2' }
  ];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const chatMessages = localEvent.chatMessages || [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="Tapahtuman pikapäivitys"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={springTactile.gentle}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-border-subtle bg-surface-elevated shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border-subtle/60 bg-surface/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-pitch/20 text-pitch flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-text-primary truncate">
                  {event.isTraining ? event.title : `${event.homeTeam} vs ${event.awayTeam || '—'}`}
                </div>
                <div className="text-[10px] text-text-secondary flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-pitch" />
                  <span>Päivitä tietoja vapaamuotoisesti chatin lailla</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-surface border border-border-subtle hover:border-pitch text-text-secondary hover:text-pitch text-[11px] font-bold cursor-pointer transition-colors"
                title="Yhdistä tämä tapahtuma toiseen otteluun, piilota tai poista"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Yhdistä / Poista</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full hover:bg-surface text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Current Event Summary Pills */}
          <div className="p-3 bg-surface/40 border-b border-border-subtle/40 flex flex-wrap gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-elevated border border-border-subtle text-text-secondary font-medium">
              <Clock className="w-3 h-3 text-pitch" />
              <span>
                {new Date(localEvent.startTime).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki' })}
                {localEvent.score ? ` (Tulos: ${localEvent.score})` : ''}
              </span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-elevated border border-border-subtle text-text-secondary font-medium truncate max-w-[200px]">
              <MapPin className="w-3 h-3 text-pitch" />
              <span className="truncate">{localEvent.venue.name}</span>
            </span>
            {localEvent.volunteerDuty && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-whistle/15 border border-whistle/30 text-whistle font-semibold">
                <Coffee className="w-3 h-3" />
                <span>{localEvent.volunteerDuty}</span>
              </span>
            )}
          </div>

          {/* Chat Messages Log */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-[180px] max-h-[360px]">
            {chatMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-6 text-text-muted text-xs space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-surface flex items-center justify-center text-xl">
                  💬
                </div>
                <p className="max-w-xs">
                  Kirjoita tai liitä tähän WhatsApp-viesti, alkulämpöaika, lopputulos tai kenttämuutos.
                </p>
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div key={msg.id} className="flex flex-col gap-1 items-end">
                  <div className="max-w-[85%] p-3 rounded-2xl bg-pitch text-text-inverse text-xs rounded-br-xs font-medium shadow-sm">
                    {msg.text}
                  </div>
                  {msg.appliedChanges && msg.appliedChanges.length > 0 && (
                    <div className="max-w-[85%] p-2 rounded-xl bg-pitch/10 border border-pitch/20 text-[11px] text-pitch flex flex-col gap-0.5">
                      {msg.appliedChanges.map((change, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>{change}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <span className="text-[10px] text-text-muted font-tabular pr-1">
                    {new Date(msg.timestamp).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-3 py-2 bg-surface/50 border-t border-border-subtle/40 overflow-x-auto flex gap-1.5 scrollbar-none">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(p.text)}
                className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-surface text-text-secondary hover:text-text-primary text-[11px] font-medium border border-border-subtle/60 shrink-0 cursor-pointer transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-surface/80 border-t border-border-subtle flex items-center gap-2"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Kirjoita viesti tai päivitys tapahtumaan..."
              className="flex-1 bg-surface-elevated border border-border-subtle focus:border-pitch rounded-xl px-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isProcessing}
              className="p-2.5 rounded-xl bg-pitch text-text-inverse font-bold disabled:opacity-40 hover:brightness-110 cursor-pointer transition-all shadow-sm shadow-pitch/20"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </motion.div>
      </div>

      <EventMergeModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        sourceEvent={localEvent}
        allEvents={allEvents}
        onEventMerged={(merged) => {
          onEventUpdated(merged);
          onClose();
        }}
        onEventDeleted={() => {
          onClose();
        }}
        onEventHidden={() => {
          onClose();
        }}
      />
    </AnimatePresence>
  );
};
