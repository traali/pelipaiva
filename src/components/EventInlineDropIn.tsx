import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  ClipboardPaste,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Car,
  Clock,
  Shirt,
  MapPin,
  Coffee,
  BookOpen
} from 'lucide-react';
import type { MatchdayEvent, PlayerProfile } from '../types/matchday';
import { applyEventChatUpdate } from '../lib/ai/eventChatEngine';
import { db } from '../lib/storage/db';
import { springTactile } from '../lib/motion/springs';

interface EventInlineDropInProps {
  event: MatchdayEvent;
  profile?: PlayerProfile;
  onEventUpdated?: (updated: MatchdayEvent) => void;
  compact?: boolean;
}

export const EventInlineDropIn: React.FC<EventInlineDropInProps> = ({
  event,
  profile,
  onEventUpdated,
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    changes: string[];
    timestamp: number;
  } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText.trim()) {
          setText(clipText.trim());
          if (!isOpen) setIsOpen(true);
        }
      }
    } catch {
      // Clipboard permission denied or unsupported
    }
  };

  const handleApplyUpdate = async () => {
    if (!text.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      const result = await applyEventChatUpdate(event, text.trim(), profile);

      // Save to IndexedDB
      await db.events.put(result.updatedEvent);

      // Notify parent
      onEventUpdated?.(result.updatedEvent);

      setFeedback({
        message: result.aiResponse,
        changes: result.appliedChanges,
        timestamp: Date.now()
      });

      setText('');
      // Auto-collapse after 4 seconds of feedback
      setTimeout(() => {
        setIsOpen(false);
      }, 4000);
    } catch (err) {
      console.error('Failed to apply inline event update:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleApplyUpdate();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedText = e.dataTransfer.getData('text');
    if (droppedText) {
      setText(droppedText.trim());
      if (!isOpen) setIsOpen(true);
    }
  };

  const isSchool = event.sport === 'school' || event.eventType === 'school';

  return (
    <div
      className={`my-3 rounded-2xl border transition-all ${
        isOpen
          ? 'border-pitch/40 bg-pitch/5 shadow-sm'
          : 'border-border-subtle bg-surface-elevated/40 hover:border-pitch/30 hover:bg-surface-elevated/80'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {/* Header Toggle / Quick Trigger Bar */}
      <div className="flex items-center justify-between p-2.5 sm:p-3">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 text-left text-xs font-semibold text-text-secondary hover:text-text-primary cursor-pointer transition-colors flex-1"
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Sulje tapahtuman pikapäivitys' : 'Avaa tapahtuman pikapäivitys'}
        >
          <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-pitch/15 text-pitch shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-text-primary">
              {isSchool ? 'Liitä Wilma-ohjeet tai huomiot' : 'Liitä viesti tai kyytijako tähän peliin'}
            </span>
            <span className="text-[10px] text-text-muted hidden sm:inline">
              (WhatsApp, kyydit, kenttämuutos)
            </span>
          </div>
        </button>

        <div className="flex items-center gap-1.5">
          {!isOpen && (
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              title="Liitä leikepöydältä"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-surface border border-border-subtle text-[11px] font-bold text-text-secondary hover:text-pitch hover:border-pitch/40 cursor-pointer transition-all shadow-xs"
            >
              <ClipboardPaste className="w-3 h-3" />
              <span className="hidden xs:inline">Liitä</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label={isOpen ? 'Sulje' : 'Avaa'}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface cursor-pointer transition-colors"
          >
            {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Drop-In Zone */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={springTactile.snappy}
            className="px-3 pb-3 pt-0 flex flex-col gap-2.5"
          >
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={compact ? 2 : 3}
                placeholder={
                  isSchool
                    ? 'Liitä Wilma-viesti, kokeen lukuohjeet, huomiot tai tilakoodi (esim. "Koe luvut 1-6 eli s. 8-29, luokka B12")...'
                    : 'Liitä valmentajan WhatsApp-viesti, kyytijako (esim. "Per kuskaa: Simo, Valo..."), kenttämuutos tai peliasun väri...'
                }
                className={`w-full rounded-xl border bg-surface p-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-pitch transition-all resize-none ${
                  isDragOver ? 'border-pitch ring-2 ring-pitch/30 bg-pitch/10' : 'border-border-subtle'
                }`}
                disabled={isProcessing}
                autoFocus
              />

              {isDragOver && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-pitch/20 text-xs font-bold text-pitch backdrop-blur-xs">
                  Pudota teksti tähän
                </div>
              )}
            </div>

            {/* Quick Context Hints */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-[10px] text-text-muted font-medium">
              <span className="shrink-0 font-bold text-text-secondary">Tunnistaa suoraan:</span>
              <span className="inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded bg-surface border border-border-subtle">
                <Car className="w-2.5 h-2.5 text-pitch" /> Kyytiringit
              </span>
              <span className="inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded bg-surface border border-border-subtle">
                <MapPin className="w-2.5 h-2.5 text-radar" /> Kenttämuutokset
              </span>
              <span className="inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded bg-surface border border-border-subtle">
                <Shirt className="w-2.5 h-2.5 text-floodlight" /> Peliasun väri
              </span>
              <span className="inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded bg-surface border border-border-subtle">
                <Coffee className="w-2.5 h-2.5 text-whistle" /> Kahviovuorot
              </span>
              <span className="inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded bg-surface border border-border-subtle">
                <BookOpen className="w-2.5 h-2.5 text-pitch" /> Kokeen sivut
              </span>
              <span className="inline-flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded bg-surface border border-border-subtle">
                <Clock className="w-2.5 h-2.5 text-pitch" /> Aikataulut & Tulokset
              </span>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border-subtle">
              <span className="text-[10px] text-text-muted">
                Paina <kbd className="font-mono font-bold bg-surface px-1 py-0.5 rounded border border-border-subtle">Ctrl+Enter</kbd> tallentaaksesi
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setText('');
                    setIsOpen(false);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-text-muted hover:text-text-primary cursor-pointer transition-colors"
                >
                  Peruuta
                </button>

                <button
                  type="button"
                  onClick={handleApplyUpdate}
                  disabled={!text.trim() || isProcessing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pitch text-text-inverse text-xs font-bold shadow-xs hover:brightness-110 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Jäsennetään...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Päivitä peliin</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Feedback Toast / Banner */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={springTactile.snappy}
            className="m-2.5 p-2.5 rounded-xl bg-pitch/15 border border-pitch/30 text-pitch text-xs flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between gap-2 font-bold">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Päivitys tallennettu onnistuneesti!</span>
              </div>
              <button
                type="button"
                onClick={() => setFeedback(null)}
                className="text-[10px] opacity-70 hover:opacity-100 cursor-pointer"
              >
                Sulje
              </button>
            </div>

            {feedback.changes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {feedback.changes.map((ch, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface text-text-primary border border-border-subtle text-[11px] font-semibold"
                  >
                    {ch}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
