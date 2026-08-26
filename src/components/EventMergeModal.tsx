import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Link2,
  Trash2,
  EyeOff,
  CheckCircle2,
  Clock,
  MapPin,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import type { MatchdayEvent } from '../types/matchday';
import { springTactile } from '../lib/motion/springs';
import { db } from '../lib/storage/db';

interface EventMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceEvent: MatchdayEvent;
  allEvents: MatchdayEvent[];
  onEventMerged?: (mergedTargetEvent: MatchdayEvent, deletedSourceId: string) => void;
  onEventDeleted?: (eventId: string) => void;
  onEventHidden?: (eventId: string) => void;
}

export const EventMergeModal: React.FC<EventMergeModalProps> = ({
  isOpen,
  onClose,
  sourceEvent,
  allEvents,
  onEventMerged,
  onEventDeleted,
  onEventHidden
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Candidate events to merge into (exclude the source event itself and hidden ones)
  const candidateEvents = useMemo(() => {
    const sourceDateStr = sourceEvent.startTime.split('T')[0];
    return allEvents
      .filter((e) => e.id !== sourceEvent.id && !e.isHidden)
      .sort((a, b) => {
        // Prioritize events on the exact same date
        const aDate = a.startTime.split('T')[0];
        const bDate = b.startTime.split('T')[0];
        if (aDate === sourceDateStr && bDate !== sourceDateStr) return -1;
        if (bDate === sourceDateStr && aDate !== sourceDateStr) return 1;
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      });
  }, [allEvents, sourceEvent]);

  if (!isOpen) return null;

  const handleMerge = async () => {
    if (!selectedTargetId || isProcessing) return;
    const target = allEvents.find((e) => e.id === selectedTargetId);
    if (!target) return;

    setIsProcessing(true);
    try {
      // Merge properties from sourceEvent into target
      const mergedTarget: MatchdayEvent = {
        ...target,
        score: target.score || sourceEvent.score,
        volunteerDuty: target.volunteerDuty || sourceEvent.volunteerDuty,
        hasWhatsAppUpdates: true,
        reconciliationStatus: 'auto_matched'
      };

      // Merge chat messages and notes
      if (sourceEvent.chatMessages && sourceEvent.chatMessages.length > 0) {
        const existing = mergedTarget.chatMessages || [];
        mergedTarget.chatMessages = [...existing, ...sourceEvent.chatMessages];
      }

      if (sourceEvent.notes) {
        mergedTarget.notes = mergedTarget.notes
          ? `${mergedTarget.notes}\n${sourceEvent.notes}`
          : sourceEvent.notes;
      }

      // If source had custom times or playerLog, combine them
      if (sourceEvent.playerLog) {
        mergedTarget.playerLog = {
          ...target.playerLog,
          ...sourceEvent.playerLog
        };
      }

      // Update target event in DB
      await db.events.put(mergedTarget);

      // Delete source event from DB
      await db.events.delete(sourceEvent.id);

      setSuccessMessage('Tapahtumat yhdistetty onnistuneesti!');
      setTimeout(() => {
        onEventMerged?.(mergedTarget, sourceEvent.id);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Failed to merge events', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Haluatko varmasti poistaa tapahtuman "${sourceEvent.isTraining ? sourceEvent.title : `${sourceEvent.homeTeam} vs ${sourceEvent.awayTeam}`}"?`)) {
      return;
    }
    try {
      await db.events.delete(sourceEvent.id);
      onEventDeleted?.(sourceEvent.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete event', err);
    }
  };

  const handleHide = async () => {
    try {
      await db.events.update(sourceEvent.id, { isHidden: true });
      onEventHidden?.(sourceEvent.id);
      onClose();
    } catch (err) {
      console.error('Failed to hide event', err);
    }
  };

  const sourceDateLabel = new Date(sourceEvent.startTime).toLocaleDateString('fi-FI', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric'
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={springTactile.gentle}
          className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-border-subtle bg-surface-elevated shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border-subtle/60 bg-surface/80">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-pitch/20 text-pitch flex items-center justify-center shrink-0">
                <Link2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">Hallitse tapahtumaa</h3>
                <p className="text-[11px] text-text-secondary">
                  Yhdistä toiseen otteluun, piilota tai poista
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-surface text-text-muted hover:text-text-primary transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {successMessage ? (
            <div className="p-8 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-pitch/20 text-pitch flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="text-sm font-bold text-text-primary">{successMessage}</div>
            </div>
          ) : (
            <div className="p-4 overflow-y-auto space-y-4">
              {/* Selected Source Event Card */}
              <div className="p-3.5 rounded-2xl bg-surface border border-border-subtle flex flex-col gap-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  Valittu tapahtuma (lähde):
                </div>
                <div className="text-sm font-black text-text-primary">
                  {sourceEvent.isTraining ? sourceEvent.title : `${sourceEvent.homeTeam} vs ${sourceEvent.awayTeam || '—'}`}
                </div>
                <div className="flex items-center gap-3 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-pitch" />
                    <span>{sourceDateLabel} klo {new Date(sourceEvent.startTime).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}</span>
                  </span>
                  <span className="flex items-center gap-1 truncate">
                    <MapPin className="w-3 h-3 text-pitch" />
                    <span className="truncate">{sourceEvent.venue.name}</span>
                  </span>
                </div>
              </div>

              {/* Action 1: Merge into existing fixture */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-pitch" />
                    <span>Yhdistä olemassa olevaan otteluun:</span>
                  </span>
                  <span className="text-[10px] text-text-muted">
                    Valitse oikea ottelu alta
                  </span>
                </div>

                {candidateEvents.length === 0 ? (
                  <div className="p-4 rounded-xl bg-surface/50 border border-border-subtle text-xs text-text-muted text-center">
                    Ei muita otteluita kalenterissa joihin yhdistää.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {candidateEvents.map((cand) => {
                      const isSelected = selectedTargetId === cand.id;
                      const candDate = new Date(cand.startTime).toLocaleDateString('fi-FI', {
                        weekday: 'short',
                        day: 'numeric',
                        month: 'numeric'
                      });
                      const isSameDay = cand.startTime.split('T')[0] === sourceEvent.startTime.split('T')[0];

                      return (
                        <button
                          key={cand.id}
                          type="button"
                          onClick={() => setSelectedTargetId(cand.id)}
                          className={`w-full text-left p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                            isSelected
                              ? 'bg-pitch/15 border-pitch text-text-primary shadow-xs'
                              : 'bg-surface hover:bg-surface-elevated border-border-subtle text-text-secondary'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {isSameDay && (
                                <span className="px-1.5 py-0.2 rounded-md bg-pitch/20 text-pitch text-[9px] font-black uppercase">
                                  Sama päivä
                                </span>
                              )}
                              <span className="text-xs font-bold text-text-primary truncate">
                                {cand.isTraining ? cand.title : `${cand.homeTeam} vs ${cand.awayTeam || '—'}`}
                              </span>
                            </div>
                            <div className="text-[11px] text-text-muted mt-0.5 flex items-center gap-2">
                              <span>{candDate} klo {new Date(cand.startTime).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })}</span>
                              <span>•</span>
                              <span className="truncate">{cand.venue.name}</span>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isSelected ? (
                              <CheckCircle2 className="w-5 h-5 text-pitch" />
                            ) : (
                              <div className="w-4 h-4 rounded-full border border-border-strong" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedTargetId && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleMerge}
                    className="w-full mt-2 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl bg-pitch text-text-inverse font-bold text-xs shadow-md shadow-pitch/20 hover:brightness-110 cursor-pointer transition-all"
                  >
                    <Link2 className="w-4 h-4" />
                    <span>Yhdistä tiedot valittuun otteluun</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Action 2 & 3: Hide or Delete */}
              <div className="pt-3 border-t border-border-subtle/60 flex items-center justify-between gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleHide}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface border border-border-subtle hover:border-border-strong text-text-secondary hover:text-text-primary text-xs font-semibold cursor-pointer transition-all"
                >
                  <EyeOff className="w-3.5 h-3.5 text-text-muted" />
                  <span>Piilota tapahtuma</span>
                </button>

                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stoppage/10 border border-stoppage/30 hover:bg-stoppage/20 text-stoppage text-xs font-bold cursor-pointer transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5 text-stoppage" />
                  <span>Poista tapahtuma</span>
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
