import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Send, Search, Loader2 } from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import { MatchdayEvent, PlayerProfile } from '../types/matchday';
import { queryFamilyScheduleWithLLM, CopilotQueryResult } from '../lib/ai/localAiEngine';

interface AskCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: MatchdayEvent[];
  profiles: PlayerProfile[];
}

export const AskCopilotModal: React.FC<AskCopilotModalProps> = ({
  isOpen,
  onClose,
  events,
  profiles
}) => {
  const [query, setQuery] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [result, setResult] = useState<CopilotQueryResult | null>(null);

  const firstChild = profiles[0]?.playerName || 'lapsella';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);


  const sampleQuestions = [
    '☕ Onko minulla kahviovuoroa tällä viikolla?',
    `⚽ Milloin on ${firstChild}:n seuraava peli?`,
    '👟 Milloin pelataan tekonurmella (AG)?',
    '🚗 Miten viikonlopun kyydit hoidetaan?'
  ];

  const handleAsk = async (textToAsk?: string) => {
    const q = textToAsk || query;
    if (!q.trim() || isThinking) return;
    if (textToAsk) setQuery(textToAsk);

    setIsThinking(true);
    try {
      const res = await queryFamilyScheduleWithLLM(q, events, profiles);
      setResult(res);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ask-copilot-title"
        >
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
            className="liquid-glass relative w-full max-w-lg rounded-3xl p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-pitch/15 text-pitch">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="ask-copilot-title" className="text-lg font-black text-text-primary">
                    Kysy Pelipäivältä
                  </h3>
                  <p className="text-xs text-text-muted flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-pitch animate-pulse" />
                    100% Laitekohtainen tekoäly & aikataulujärki
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Sulje kyselyikkuna"
                className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-elevated cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-text-secondary mb-2">
                💡 Kysy esimerkiksi:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {sampleQuestions.map((sq) => (
                  <button
                    key={sq}
                    type="button"
                    onClick={() => handleAsk(sq)}
                    className="px-2.5 py-1 rounded-xl bg-surface-elevated border border-border-subtle hover:border-pitch text-text-secondary hover:text-text-primary text-[11px] font-medium cursor-pointer text-left transition-all"
                  >
                    {sq}
                  </button>
                ))}
              </div>
            </div>

            {/* Query Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAsk();
              }}
              className="flex items-center gap-2 mb-4"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Kirjoita kysymys suomeksi..."
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-xs focus:outline-none focus:border-pitch"
                />
                <Search className="absolute right-3 top-2.5 w-4 h-4 text-text-muted" />
              </div>
              <button
                type="submit"
                disabled={!query.trim() || isThinking}
                aria-label="Lähetä kysymys"
                className="p-2.5 rounded-xl bg-pitch text-text-inverse hover:brightness-110 cursor-pointer disabled:opacity-50 flex items-center justify-center min-w-[40px]"
              >
                {isThinking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>

            {/* Result Box */}
            {result && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-surface border border-pitch/30 flex flex-col gap-2.5"
                aria-live="polite"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-pitch flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Pelipäivä Äly vastaa:</span>
                  </span>
                </div>

                <div className="text-xs text-text-primary whitespace-pre-line leading-relaxed">
                  {result.answer}
                </div>

                {result.relevantEvents.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-border-subtle flex flex-col gap-1">
                    <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">
                      Aiheeseen liittyvät ottelut:
                    </span>
                    {result.relevantEvents.map((ev) => (
                      <div key={ev.id} className="text-[11px] text-text-secondary flex items-center gap-1">
                        <span>•</span>
                        <span className="font-semibold">{ev.title}</span>
                        <span>(@ {ev.venue.name})</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
