import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Plus, ShieldCheck, HelpCircle, Trophy } from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import { SportType } from '../types/matchday';
import { parseAssociationUrl, getAssociationName } from '../lib/stats/statsEngine';
import { searchPopularClubs } from '../lib/clubs/popularClubsCatalog';
import { EXAMPLE_TOURNAMENTS } from '../lib/clubs/exampleTournaments';
import { TeamColorPicker } from './TeamColorPicker';
import { pickNextTeamColor } from '../lib/sport/teamColors';

interface CalendarImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (playerName: string, teamName: string, sport: SportType, icsUrl: string, colorHex?: string) => Promise<void>;
  initialSport?: SportType;
  initialTeamUrl?: string;
  initialTeamName?: string;
  existingPlayers?: string[];
}

export const CalendarImportModal: React.FC<CalendarImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  initialSport,
  initialTeamUrl,
  initialTeamName,
  existingPlayers = []
}) => {
  const [playerName, setPlayerName] = useState('');
  const [teamName, setTeamName] = useState(initialTeamName || '');
  const [sport, setSport] = useState<SportType>(initialSport || 'football');
  const [icsUrl, setIcsUrl] = useState(initialTeamUrl || '');
  const [isLoading, setIsLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [colorHex, setColorHex] = useState(pickNextTeamColor([]).hex);

  useEffect(() => {
    if (isOpen) {
      if (initialTeamName) setTeamName(initialTeamName);
      if (initialSport) setSport(initialSport);
      if (initialTeamUrl) setIcsUrl(initialTeamUrl);
    }
  }, [isOpen, initialTeamName, initialSport, initialTeamUrl]);

  // Auto-detect sports association URL and auto-update sport
  const handleUrlChange = (val: string) => {
    setIcsUrl(val);
    const parsed = parseAssociationUrl(val);
    if (parsed) {
      if (parsed.sport && parsed.sport !== 'other') {
        setSport(parsed.sport);
      }
    }
  };

  const detectedAssoc = parseAssociationUrl(icsUrl);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName || !icsUrl) return;
    setIsLoading(true);
    try {
      await onImport(playerName || teamName, teamName, sport, icsUrl, colorHex);
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
            className="liquid-glass relative w-full max-w-md rounded-3xl p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-pitch/15 text-pitch">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">Lisää ottelukalenteri</h3>
                  <p className="text-xs text-text-muted">Nimenhuuto, MyClub, Jopox tai Palloliitto / Torneopal</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-elevated cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Example tournaments for testing */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                Esimerkkiturnaukset
              </label>
              <div className="flex flex-col gap-1.5">
                {EXAMPLE_TOURNAMENTS.map((cup) => (
                  <button
                    key={cup.id}
                    type="button"
                    onClick={() => {
                      setTeamName(cup.teamName);
                      setSport(cup.sport);
                      setIcsUrl(cup.url);
                      setColorHex(cup.colorHex);
                    }}
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-border-subtle bg-surface-elevated px-3 py-2 text-left"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ background: cup.colorHex }}
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-text-primary truncate">
                        {cup.name}
                      </span>
                      <span className="block text-[11px] text-text-muted truncate">
                        {cup.teamName}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Club Preset Search */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-text-secondary mb-1">
                ⚡ Pikahaku suomalaisista seuroista (valinnainen)
              </label>
              <input
                type="text"
                placeholder="Kirjoita seura, esim. HJK, Honka, ErVi, Classic, ToPo..."
                onChange={(e) => {
                  const q = e.target.value;
                  if (q.trim().length > 1) {
                    const found = searchPopularClubs(q);
                    if (found.length > 0) {
                      const top = found[0]!;
                      setTeamName(top.name);
                      setSport(top.sport);
                      setIcsUrl(top.sampleTeamUrl);
                      setColorHex(top.colorHex);
                    }
                  }
                }}
                className="w-full px-3.5 py-2 rounded-xl bg-pitch/10 border border-pitch/30 text-text-primary text-xs focus:outline-none focus:border-pitch placeholder:text-text-muted"
              />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-text-secondary">
                    👤 Kenelle pelaajalle / lapselle liitetään? *
                  </label>
                  <span className="text-[11px] text-pitch font-medium">Perhenäkymä</span>
                </div>

                {existingPlayers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {existingPlayers.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPlayerName(p)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border cursor-pointer transition-all ${
                          playerName === p
                            ? 'bg-pitch text-text-inverse border-pitch shadow-sm shadow-pitch/20'
                            : 'bg-surface text-text-secondary border-border-subtle hover:text-text-primary'
                        }`}
                      >
                        👤 {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setPlayerName('')}
                      className="px-2 py-1 rounded-lg text-[11px] font-medium bg-surface text-text-muted border border-border-subtle hover:text-text-primary cursor-pointer"
                    >
                      + Uusi lapsi
                    </button>
                  </div>
                )}

                <input
                  type="text"
                  required
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
                  <option value="volleyball">🏐 Lentopallo</option>
                  <option value="icehockey">🏒 Jääkiekko</option>
                  <option value="futsal">👟 Futsal</option>
                  <option value="other">🏅 Muu urheilu / Treenit</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-text-secondary">
                    iCal-syötteen tai liiton joukkuesivun URL *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowGuide(!showGuide)}
                    className="text-[11px] text-pitch hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>Tuetut lähteet</span>
                  </button>
                </div>

                <input
                  type="url"
                  required
                  placeholder="https://tulospalvelu.palloliitto.fi/team/... tai .ics"
                  value={icsUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-sm focus:outline-none focus:border-pitch font-mono text-xs"
                />

                {detectedAssoc && (
                  <div className="mt-1.5 px-3 py-1.5 rounded-lg bg-pitch/10 text-pitch text-xs flex items-center gap-1.5 font-medium">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Tunnistettu: {getAssociationName(detectedAssoc.association)} (Joukkue ID: {detectedAssoc.teamId})</span>
                  </div>
                )}

                {/* Collapsible In-Modal Helper Guide */}
                {showGuide && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 p-3 rounded-xl bg-surface-elevated text-[11px] text-text-secondary border border-border-subtle flex flex-col gap-1.5"
                  >
                    <div><strong>⚽ Palloliitto:</strong> tulospalvelu.palloliitto.fi/team/{'{id}'}</div>
                    <div><strong>🏑 Salibandy:</strong> tulospalvelu.salibandy.fi/team/{'{id}'}</div>
                    <div><strong>🏀 Basket.fi:</strong> basket.fi/basket/sarjat/joukkue/?team_id={'{id}'}</div>
                    <div><strong>🏐 Torneopal:</strong> *.torneopal.fi/taso/joukkue.php?joukkue={'{id}'}</div>
                    <div><strong>🏀 Espoo Liikkuu:</strong> espooliikkuutournament.fi/team/{'{id}'}</div>
                    <div><strong>🏑 KW Memorial:</strong> kwmemorialcup*.torneopal.fi/taso/joukkue.php</div>
                    <div><strong>📅 Kalenterit:</strong> Nimenhuuto, MyClub, Jopox (.ics)</div>
                  </motion.div>
                )}

                <p className="text-[11px] text-text-muted mt-1.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-pitch" />
                  100% Yksityinen: tallentuu vain puhelimesi selaimeen (Dexie IndexedDB).
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Joukkueen väri
                </label>
                <TeamColorPicker
                  value={colorHex}
                  onChange={(hex) => setColorHex(hex)}
                />
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

