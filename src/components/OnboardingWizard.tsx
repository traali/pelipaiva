import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Trash2,
  ArrowRight,
  UserPlus,
  Sparkles,
  Link,
  Plus,
  User,
  Users
} from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import { EXAMPLE_TOURNAMENTS } from '../lib/clubs/exampleTournaments';
import type { SportType } from '../types/matchday';

interface AddedSource {
  id: string;
  playerName: string;
  sourceType: 'torneopal' | 'ics' | 'text';
  name: string;
  sport: SportType;
  url?: string;
}

interface OnboardingWizardProps {
  onStartDemo: () => void;
  onOpenImportModal?: (initialSport?: SportType, initialTeamUrl?: string, initialTeamName?: string) => void;
  onOpenFamilyShare?: () => void;
  onOpenSmartImport?: () => void;
  onQuickAddTeam: (
    playerName: string,
    teamName: string,
    sport: SportType,
    url: string
  ) => Promise<{ success: boolean; error?: string } | void>;
  onFinishOnboarding?: () => void;
  existingProfilesCount?: number;
}

const PRESET_TORNEOPAL_TEAMS: Array<{
  name: string;
  sport: SportType;
  url: string;
  association: string;
  colorHex: string;
}> = [
  {
    name: 'PPJ/Laru sin · P13 Kolmonen',
    sport: 'football',
    url: 'https://tulospalvelu.palloliitto.fi/team/185085/info',
    association: 'Palloliitto',
    colorHex: '#3b82f6'
  },
  {
    name: 'PPJ/Laru mus · P13 Vitonen',
    sport: 'football',
    url: 'https://tulospalvelu.palloliitto.fi/team/185083/info',
    association: 'Palloliitto',
    colorHex: '#64748b'
  },
  {
    name: 'PPJ/Laru oran · P13 Vitonen',
    sport: 'football',
    url: 'https://tulospalvelu.palloliitto.fi/team/185086/info',
    association: 'Palloliitto',
    colorHex: '#f97316'
  },
  ...EXAMPLE_TOURNAMENTS.map((cup) => ({
    name: `${cup.name} · ${cup.teamName}`,
    sport: cup.sport,
    url: cup.url,
    association: cup.name,
    colorHex: cup.colorHex
  }))
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onStartDemo,
  onOpenFamilyShare,
  onOpenSmartImport,
  onQuickAddTeam,
  onFinishOnboarding,
  existingProfilesCount = 0
}) => {
  // Wizard state: active player being configured
  const [activePlayerName, setActivePlayerName] = useState<string>('');
  const [nameInputDraft, setNameInputDraft] = useState<string>('');
  const [isNamingStep, setIsNamingStep] = useState<boolean>(true);

  // All added sources across family
  const [addedSources, setAddedSources] = useState<AddedSource[]>([]);

  // Custom .ics state
  const [customIcsUrl, setCustomIcsUrl] = useState('');
  const [customSport, setCustomSport] = useState<SportType>('football');
  const [showCustomIcsInput, setShowCustomIcsInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Group added sources by player name
  const playerGroups = React.useMemo(() => {
    const map = new Map<string, AddedSource[]>();
    for (const src of addedSources) {
      if (!map.has(src.playerName)) map.set(src.playerName, []);
      map.get(src.playerName)!.push(src);
    }
    return Array.from(map.entries());
  }, [addedSources]);

  const currentPlayerSources = addedSources.filter(
    (s) => s.playerName.toLowerCase() === activePlayerName.trim().toLowerCase()
  );

  const handleConfirmPlayerName = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = nameInputDraft.trim();
    if (!trimmed) return;
    setErrorMessage('');
    setActivePlayerName(trimmed);
    setIsNamingStep(false);
  };

  const handleAddPresetTorneopal = async (team: (typeof PRESET_TORNEOPAL_TEAMS)[0]) => {
    if (!activePlayerName) return;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await onQuickAddTeam(activePlayerName, team.name, team.sport, team.url);
      if (res && res.success === false) {
        setErrorMessage(res.error || 'Otteluiden haku epäonnistui. Tarkista verkko.');
        return;
      }
      setAddedSources((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          playerName: activePlayerName,
          sourceType: 'torneopal',
          name: team.name,
          sport: team.sport,
          url: team.url
        }
      ]);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Lisäys epäonnistui');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCustomIcs = async () => {
    if (!activePlayerName) return;
    const trimmedUrl = customIcsUrl.trim();
    if (!trimmedUrl) return;

    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await onQuickAddTeam(activePlayerName, `${activePlayerName}:n joukkue`, customSport, trimmedUrl);
      if (res && res.success === false) {
        setErrorMessage(res.error || 'Kalenterin nouto epäonnistui. Tarkista linkki.');
        return;
      }
      setAddedSources((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          playerName: activePlayerName,
          sourceType: 'ics',
          name: `${activePlayerName}:n iCal / MyClub`,
          sport: customSport,
          url: trimmedUrl
        }
      ]);
      setCustomIcsUrl('');
      setShowCustomIcsInput(false);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Lisäys epäonnistui');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveSource = (id: string) => {
    setAddedSources((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAddNewPlayer = () => {
    setErrorMessage('');
    setNameInputDraft('');
    setActivePlayerName('');
    setIsNamingStep(true);
    setShowCustomIcsInput(false);
  };

  const handleSwitchToExistingPlayer = (playerName: string) => {
    setActivePlayerName(playerName);
    setNameInputDraft(playerName);
    setIsNamingStep(false);
    setShowCustomIcsInput(false);
  };

  const totalSourcesCount = addedSources.length || existingProfilesCount;

  return (
    <div className="min-h-screen bg-canvas text-text-primary px-4 py-6 md:py-10 flex flex-col justify-between">
      <div className="max-w-xl mx-auto w-full space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-pitch text-text-inverse flex items-center justify-center font-black text-sm">
              P
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-text-primary">
                Perheen kalenteriasetus
              </h1>
              <p className="text-[11px] text-text-muted">
                Lisää pelaajat ja heidän joukkueensa
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onStartDemo}
            className="text-[11px] font-bold text-pitch hover:underline cursor-pointer"
          >
            Lataa esimerkkidata
          </button>
        </div>

        {/* FAMILY ROSTER SUMMARY (if players already added) */}
        {playerGroups.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-surface-elevated/90 border border-pitch/30 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-pitch">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                <span>Perheen kokoonpano ({totalSourcesCount} joukkuetta):</span>
              </span>
              <button
                type="button"
                onClick={handleAddNewPlayer}
                className="text-[11px] text-pitch hover:underline font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>+ Lisää pelaaja</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {playerGroups.map(([name, sources]) => {
                const isActive = !isNamingStep && activePlayerName.toLowerCase() === name.toLowerCase();
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => handleSwitchToExistingPlayer(name)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                      isActive
                        ? 'bg-pitch text-text-inverse border-pitch shadow-sm shadow-pitch/20'
                        : 'bg-surface text-text-secondary border-border-strong hover:text-text-primary'
                    }`}
                  >
                    <span>{name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                      isActive ? 'bg-white/25 text-white' : 'bg-pitch/15 text-pitch'
                    }`}>
                      {sources.length} {sources.length === 1 ? 'lähde' : 'lähdettä'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* MAIN STEP CARD */}
        <div className="liquid-glass rounded-3xl p-5 border border-border-strong shadow-xl space-y-5">
          {/* STEP 1: ADD / NAME PLAYER */}
          {isNamingStep ? (
            <form onSubmit={handleConfirmPlayerName} className="space-y-4">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-1.5 mb-2">
                  <UserPlus className="w-4 h-4 text-pitch" />
                  <span>1. Lisää pelaaja / lapsi:</span>
                </label>
                <p className="text-xs text-text-muted mb-3">
                  Kirjoita lapsen tai pelaajan etunimi aloittaaksesi:
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={nameInputDraft}
                    onChange={(e) => setNameInputDraft(e.target.value)}
                    placeholder="esim. Otso, Sofia, Matias..."
                    className="flex-1 px-4 py-3 rounded-2xl bg-surface border border-border-strong text-text-primary text-sm font-bold focus:outline-none focus:border-pitch"
                  />
                  <button
                    type="submit"
                    disabled={!nameInputDraft.trim()}
                    className="py-3 px-5 rounded-2xl bg-pitch text-text-inverse font-bold text-xs hover:brightness-110 cursor-pointer disabled:opacity-40 transition-all shrink-0 flex items-center gap-1.5 shadow-md shadow-pitch/20"
                  >
                    <span>Jatka</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick Start Alternative Actions */}
                <div className="pt-4 border-t border-border-subtle flex flex-col gap-2">
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    Tai aloita suoraan:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {onOpenFamilyShare && (
                      <button
                        type="button"
                        onClick={onOpenFamilyShare}
                        className="p-3 rounded-2xl bg-surface border border-border-strong text-left hover:border-pitch cursor-pointer transition-all flex items-center gap-2.5"
                      >
                        <span className="text-base">🔑</span>
                        <div>
                          <div className="text-xs font-bold text-text-primary">Minulla on Perhe-koodi</div>
                          <div className="text-[10px] text-text-muted">Liity toisen vanhemman luomaan perheeseen</div>
                        </div>
                      </button>
                    )}

                    {onOpenSmartImport && (
                      <button
                        type="button"
                        onClick={onOpenSmartImport}
                        className="p-3 rounded-2xl bg-surface border border-border-strong text-left hover:border-pitch cursor-pointer transition-all flex items-center gap-2.5"
                      >
                        <span className="text-base">💬</span>
                        <div>
                          <div className="text-xs font-bold text-text-primary">Liitä WhatsApp-viesti</div>
                          <div className="text-[10px] text-text-muted">AI-tunnistus otteluille ja turnauksille</div>
                        </div>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={onStartDemo}
                    className="mt-1 p-2.5 rounded-xl bg-pitch/10 text-pitch border border-pitch/25 text-xs font-bold flex items-center justify-center gap-2 hover:bg-pitch hover:text-text-inverse transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Kokeile esimerkkidatalla (HJK, PPJ, Honka, TOPOLA)</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* STEP 2: ATTACH SOURCES TO ACTIVE PLAYER */
            <div className="space-y-4">
              {/* Error Message Alert */}
              {errorMessage && (
                <div
                  role="alert"
                  className="p-3 rounded-2xl bg-stoppage/15 border border-stoppage/30 text-stoppage text-xs font-bold flex items-center gap-2 animate-shake"
                >
                  <span>⚠️ {errorMessage}</span>
                </div>
              )}

              {/* Active Player Banner */}
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-pitch/20 text-pitch flex items-center justify-center font-bold text-xs">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-black text-text-primary">
                      Pelaaja: <span className="text-pitch">{activePlayerName}</span>
                    </div>
                    <div className="text-[11px] text-text-muted">
                      Valitse tai liitä joukkueet tälle pelaajalle (1 tai useampi):
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddNewPlayer}
                  className="text-xs font-bold text-pitch hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Vaihda / Uusi</span>
                </button>
              </div>

              {/* Ready Torneopal Teams */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-text-muted">Valmiit joukkueet:</div>
                {PRESET_TORNEOPAL_TEAMS.map((team) => {
                  const isAdded = currentPlayerSources.some((s) => s.name === team.name);
                  return (
                    <button
                      key={team.name}
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleAddPresetTorneopal(team)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between text-xs transition-all cursor-pointer ${
                        isAdded
                          ? 'bg-pitch/15 border-pitch text-pitch font-bold'
                          : 'bg-surface-elevated text-text-primary border-border-subtle hover:border-pitch'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ background: team.colorHex }}
                        />
                        <span className="truncate">{team.name}</span>
                      </div>

                      <div className="text-[11px] flex items-center gap-1 shrink-0">
                        {isAdded ? (
                          <span className="flex items-center gap-1 text-pitch font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Lisätty</span>
                          </span>
                        ) : (
                          <span className="text-text-muted hover:text-pitch font-semibold">
                            + Lisää
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom .ics / MyClub / WhatsApp */}
              <div className="space-y-2 pt-2 border-t border-border-subtle">
                <div className="text-[11px] font-bold text-text-muted">Muu kalenteri tai viesti:</div>

                {!showCustomIcsInput ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCustomIcsInput(true)}
                      className="p-2 rounded-xl bg-surface border border-border-strong hover:border-pitch text-text-secondary hover:text-text-primary text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Link className="w-3.5 h-3.5 text-pitch" />
                      <span>MyClub / iCal linkki</span>
                    </button>

                    {onOpenSmartImport && (
                      <button
                        type="button"
                        onClick={onOpenSmartImport}
                        className="p-2 rounded-xl bg-pitch/15 border border-pitch/30 hover:bg-pitch hover:text-text-inverse text-pitch text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>WhatsApp / Excel</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-surface border border-pitch/40 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-text-primary">
                      <span>Liitä MyClub / Nimenhuuto .ics-osoite:</span>
                      <select
                        value={customSport}
                        onChange={(e) => setCustomSport(e.target.value as SportType)}
                        className="px-2 py-0.5 rounded-md bg-surface-elevated border border-border-strong text-text-primary text-[11px]"
                      >
                        <option value="football">Jalkapallo</option>
                        <option value="floorball">Salibandy</option>
                        <option value="basketball">Koripallo</option>
                        <option value="volleyball">Lentopallo</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={customIcsUrl}
                        onChange={(e) => setCustomIcsUrl(e.target.value)}
                        placeholder="https://... tai webcal://..."
                        className="flex-1 px-3 py-1.5 rounded-xl bg-surface-elevated border border-border-strong text-text-primary text-xs focus:outline-none focus:border-pitch"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomIcs}
                        disabled={!customIcsUrl.trim() || isLoading}
                        className="py-1.5 px-3 rounded-xl bg-pitch text-text-inverse font-bold text-xs hover:brightness-110 cursor-pointer disabled:opacity-50"
                      >
                        Lisää
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Added Sources List for Active Player */}
              {currentPlayerSources.length > 0 && (
                <div className="mt-3 p-3 rounded-2xl bg-surface border border-pitch/30 space-y-1.5">
                  <div className="text-xs font-bold text-pitch flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{activePlayerName}:lle lisätyt lähteet ({currentPlayerSources.length}):</span>
                  </div>
                  {currentPlayerSources.map((src) => (
                    <div
                      key={src.id}
                      className="p-2 rounded-xl bg-surface-elevated text-xs flex items-center justify-between"
                    >
                      <span className="font-semibold text-text-primary">{src.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSource(src.id)}
                        className="text-text-muted hover:text-radar p-1 cursor-pointer"
                        title="Poista lähde"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Loop to Next Player OR Finish */}
              <div className="pt-3 border-t border-border-subtle flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleAddNewPlayer}
                  className="w-full py-2.5 px-4 rounded-xl bg-surface border border-border-strong hover:border-pitch text-text-primary text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4 text-pitch" />
                  <span>+ Tallenna ja lisää seuraava pelaaja</span>
                </button>

                {onFinishOnboarding && totalSourcesCount > 0 && (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    transition={springTactile.snappy}
                    type="button"
                    onClick={onFinishOnboarding}
                    className="w-full py-3.5 px-4 rounded-2xl bg-pitch text-text-inverse font-black text-sm flex items-center justify-center gap-2 hover:brightness-110 shadow-lg shadow-pitch/20 cursor-pointer"
                  >
                    <span>Valmis, avaa Pelipäivä ({totalSourcesCount} joukkuetta)</span>
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
