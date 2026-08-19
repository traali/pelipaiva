import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Plus, ShieldCheck } from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import { SportType } from '../types/matchday';

interface CalendarImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (playerName: string, teamName: string, sport: SportType, icsUrl: string) => Promise<void>;
}

export const CalendarImportModal: React.FC<CalendarImportModalProps> = ({
  isOpen,
  onClose,
  onImport
}) => {
  const [playerName, setPlayerName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [sport, setSport] = useState<SportType>('football');
  const [icsUrl, setIcsUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName || !icsUrl) return;
    setIsLoading(true);
    try {
      await onImport(playerName || teamName, teamName, sport, icsUrl);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
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
            className="liquid-glass relative w-full max-w-md rounded-3xl p-6 shadow-2xl z-10"
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-pitch/15 text-pitch">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">Lisää ottelukalenteri</h3>
                  <p className="text-xs text-text-muted">Nimenhuuto, MyClub, Jopox tai iCal</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-elevated cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Pelaajan nimi (valinnainen)
                </label>
                <input
                  type="text"
                  placeholder="esim. Maija"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-sm focus:outline-none focus:border-pitch"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Joukkue / Ryhmä *
                </label>
                <input
                  type="text"
                  required
                  placeholder="esim. HJK T13 Sininen"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-sm focus:outline-none focus:border-pitch"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Laji</label>
                <select
                  value={sport}
                  onChange={(e) => setSport(e.target.value as SportType)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-sm focus:outline-none focus:border-pitch"
                >
                  <option value="football">⚽ Jalkapallo</option>
                  <option value="floorball">🏑 Salibandy</option>
                  <option value="basketball">🏀 Koripallo</option>
                  <option value="icehockey">🏒 Jääkiekko</option>
                  <option value="futsal">👟 Futsal</option>
                  <option value="other">🏅 Muu urheilu</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  iCal-syötteen URL-osoite (.ics) *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://nimenhuuto.com/calendar/ical/..."
                  value={icsUrl}
                  onChange={(e) => setIcsUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-sm focus:outline-none focus:border-pitch font-mono text-xs"
                />
                <p className="text-[11px] text-text-muted mt-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-pitch" />
                  Syöte tallentuu vain tähän laitteeseen (100% paikallinen).
                </p>
              </div>

              <div className="pt-3 border-t border-border-subtle flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary cursor-pointer"
                >
                  Peruuta
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-pitch text-text-inverse text-xs font-bold shadow-md shadow-pitch/25 hover:brightness-110 active:brightness-95 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    'Haetaan...'
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Tallenna kalenteri</span>
                    </>
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
