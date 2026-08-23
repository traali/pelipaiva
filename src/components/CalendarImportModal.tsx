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
  onImport: (
    playerName: string,
    teamName: string,
    sport: SportType,
    icsUrl: string,
    colorHex?: string
  ) => Promise<void>;
  initialSport?: SportType;
  initialTeamUrl?: string;
  initialTeamName?: string;
  initialPlayerName?: string;
  existingPlayers?: string[];
}

export const CalendarImportModal: React.FC<CalendarImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  initialSport,
  initialTeamUrl,
  initialTeamName,
  initialPlayerName,
  existingPlayers = []
}) => {
  const [playerName, setPlayerName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [sport, setSport] = useState<SportType>('football');
  const [icsUrl, setIcsUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [colorHex, setColorHex] = useState(pickNextTeamColor([]).hex);
  const [playerHint, setPlayerHint] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setPlayerName(initialPlayerName || '');
    setTeamName(initialTeamName || '');
    setSport(initialSport || 'football');
    setIcsUrl(initialTeamUrl || '');
    setColorHex(pickNextTeamColor([]).hex);
    setShowGuide(false);
    setPlayerHint('');
    setIsLoading(false);
    setImportError(null);
  }, [isOpen, initialPlayerName, initialTeamName, initialSport, initialTeamUrl]);

  const handleUrlChange = (val: string) => {
    setIcsUrl(val);
    const parsed = parseAssociationUrl(val);
    if (parsed?.sport && parsed.sport !== 'other') {
      setSport(parsed.sport);
    }
  };

  const detectedAssoc = parseAssociationUrl(icsUrl);
  const who = playerName.trim();

  const runImport = async (
    name: string,
    team: string,
    nextSport: SportType,
    url: string,
    hex?: string
  ) => {
    if (!name.trim() || !url.trim()) return;
    setIsLoading(true);
    setImportError(null);
    try {
      await onImport(name.trim(), team, nextSport, url, hex);
      onClose();
    } catch (err) {
      console.error(err);
      setImportError('Otteluita ei löytynyt. Tarkista osoite ja verkko.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!who) {
      setPlayerHint('Valitse ensin kenelle joukkue lisätään.');
      return;
    }
    if (!teamName || !icsUrl) return;
    await runImport(who, teamName, sport, icsUrl, colorHex);
  };

  const handleCup = async (cup: (typeof EXAMPLE_TOURNAMENTS)[number]) => {
    setTeamName(cup.teamName);
    setSport(cup.sport);
    setIcsUrl(cup.url);
    setColorHex(cup.colorHex);
    if (!who) {
      setPlayerHint('Valitse pelaaja, sitten napauta turnausta uudestaan.');
      return;
    }
    await runImport(who, cup.teamName, cup.sport, cup.url, cup.colorHex);
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
            className="liquid-glass relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl p-6 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-pitch/15 p-2 text-pitch">
                  <Calendar className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary">
                    {who ? `Lisää joukkue — ${who}` : 'Lisää joukkue tai turnaus'}
                  </h3>
                  <p className="text-xs text-text-muted">
                    Sama lapsi voi olla sarjassa ja useassa cupissa
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-full p-2 text-text-muted hover:bg-surface-elevated hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold text-text-secondary">
                Kenelle?
              </label>
              {existingPlayers.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {existingPlayers.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setPlayerName(p);
                        setPlayerHint('');
                      }}
                      className={`min-h-11 cursor-pointer rounded-lg border px-3 text-xs font-semibold transition-all ${
                        playerName === p
                          ? 'border-pitch bg-pitch text-text-inverse shadow-sm shadow-pitch/20'
                          : 'border-border-subtle bg-surface text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPlayerName('')}
                    className="min-h-11 cursor-pointer rounded-lg border border-border-subtle bg-surface px-3 text-[11px] font-medium text-text-muted hover:text-text-primary"
                  >
                    + Uusi lapsi
                  </button>
                </div>
              )}
              <input
                type="text"
                required
                placeholder="esim. Simo"
                value={playerName}
                onChange={(e) => {
                  setPlayerName(e.target.value);
                  setPlayerHint('');
                }}
                className="w-full rounded-xl border border-border-strong bg-surface-elevated px-3.5 py-2.5 text-sm text-text-primary focus:border-pitch focus:outline-none"
              />
              {playerHint ? (
                <p className="mt-1.5 text-xs font-medium text-whistle">{playerHint}</p>
              ) : null}
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold text-text-secondary">
                Esimerkkiturnaukset — napauta, niin se liitetään valittuun lapseen
              </label>
              <div className="flex flex-col gap-1.5">
                {EXAMPLE_TOURNAMENTS.map((cup) => (
                  <button
                    key={cup.id}
                    type="button"
                    disabled={isLoading}
                    onClick={() => void handleCup(cup)}
                    className="flex min-h-11 items-center gap-2 rounded-xl border border-border-subtle bg-surface-elevated px-3 py-2 text-left disabled:opacity-50"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ background: cup.colorHex }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-semibold text-text-primary">
                        {cup.name}
                      </span>
                      <span className="block truncate text-[11px] text-text-muted">
                        {cup.teamName}
                      </span>
                    </span>
                    <Plus className="ml-auto h-4 w-4 shrink-0 text-pitch" />
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold text-text-secondary">
                Pikahaku seuroista
              </label>
              <input
                type="text"
                placeholder="HJK, Honka, ErVi, TOPOLA..."
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
                className="w-full rounded-xl border border-pitch/30 bg-pitch/10 px-3.5 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-pitch focus:outline-none"
              />
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-secondary">
                  Joukkue / turnaus
                </label>
                <input
                  type="text"
                  required
                  placeholder="esim. PPJ/Laru sin · Helsinki Cup"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full rounded-xl border border-border-strong bg-surface-elevated px-3.5 py-2.5 text-sm text-text-primary focus:border-pitch focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-text-secondary">Laji</label>
                <select
                  value={sport}
                  onChange={(e) => setSport(e.target.value as SportType)}
                  className="w-full rounded-xl border border-border-strong bg-surface-elevated px-3.5 py-2.5 text-sm text-text-primary focus:border-pitch focus:outline-none"
                >
                  <option value="football">Jalkapallo</option>
                  <option value="floorball">Salibandy</option>
                  <option value="basketball">Koripallo</option>
                  <option value="volleyball">Lentopallo</option>
                  <option value="icehockey">Jääkiekko</option>
                  <option value="futsal">Futsal</option>
                  <option value="other">Muu / treenit</option>
                </select>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-semibold text-text-secondary">
                    Liiton joukkuesivu tai .ics
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowGuide(!showGuide)}
                    className="flex cursor-pointer items-center gap-0.5 text-[11px] text-pitch hover:underline"
                  >
                    <HelpCircle className="h-3 w-3" />
                    <span>Tuetut lähteet</span>
                  </button>
                </div>

                <input
                  type="url"
                  required
                  placeholder="https://tulospalvelu.palloliitto.fi/team/..."
                  value={icsUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className="w-full rounded-xl border border-border-strong bg-surface-elevated px-3.5 py-2.5 font-mono text-xs text-text-primary focus:border-pitch focus:outline-none"
                />

                {detectedAssoc && (
                  <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-pitch/10 px-3 py-1.5 text-xs font-medium text-pitch">
                    <Trophy className="h-3.5 w-3.5" />
                    <span>
                      {getAssociationName(detectedAssoc.association)} · {detectedAssoc.teamId}
                    </span>
                  </div>
                )}

                {showGuide && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2 flex flex-col gap-1.5 rounded-xl border border-border-subtle bg-surface-elevated p-3 text-[11px] text-text-secondary"
                  >
                    <div>Palloliitto: tulospalvelu.palloliitto.fi/team/id</div>
                    <div>Salibandy: tulospalvelu.salibandy.fi/team/id</div>
                    <div>Basket.fi / Espoo Liikkuu: …/team/id</div>
                    <div>Torneopal / KW Memorial: *.torneopal.fi/taso/joukkue.php</div>
                    <div>Kalenterit: Nimenhuuto, MyClub, Jopox (.ics)</div>
                  </motion.div>
                )}

                <p className="mt-1.5 flex items-center gap-1 text-[11px] text-text-muted">
                  <ShieldCheck className="h-3.5 w-3.5 text-pitch" />
                  Tallentuu vain tähän selaimeen.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-text-secondary">
                  Joukkueen väri
                </label>
                <TeamColorPicker value={colorHex} onChange={(hex) => setColorHex(hex)} />
              </div>

              {importError && (
                <p className="text-xs font-semibold text-stoppage">{importError}</p>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer rounded-xl px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary"
                >
                  Peruuta
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-pitch px-5 py-2.5 text-xs font-bold text-text-inverse shadow-md shadow-pitch/25 hover:brightness-110 disabled:opacity-50"
                >
                  {isLoading ? (
                    'Haetaan otteluita…'
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      <span>{who ? `Lisää joukkue · ${who}` : 'Lisää joukkue'}</span>
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
