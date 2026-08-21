import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  CheckCircle2,
  Trash2,
  ArrowRight,
  UserPlus,
  Sparkles,
  Link
} from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import type { SportType } from '../types/matchday';

interface AddedSource {
  id: string;
  playerName: string;
  sourceType: 'torneopal' | 'ics' | 'text';
  name: string;
  sport: SportType;
  url?: string;
  rawText?: string;
}

interface OnboardingWizardProps {
  onStartDemo: () => void;
  onOpenImportModal: (initialSport?: SportType, initialTeamUrl?: string, initialTeamName?: string) => void;
  onOpenFamilyShare: () => void;
  onOpenSmartImport?: () => void;
  onQuickAddTeam: (playerName: string, teamName: string, sport: SportType, url: string) => Promise<void>;
  onFinishOnboarding?: () => void;
  existingProfilesCount?: number;
}

const PRESET_TORNEOPAL_TEAMS: Array<{
  name: string;
  sport: SportType;
  icon: string;
  url: string;
  association: string;
}> = [
  {
    name: 'PPJ Laru Sininen (185085)',
    sport: 'football',
    icon: '⚽',
    url: 'https://tulospalvelu.palloliitto.fi/team/185085/info',
    association: 'Palloliitto'
  },
  {
    name: 'PPJ Laru Valkoinen (185083)',
    sport: 'football',
    icon: '⚽',
    url: 'https://tulospalvelu.palloliitto.fi/team/185083/info',
    association: 'Palloliitto'
  },
  {
    name: 'PPJ Laru Oranssi (185086)',
    sport: 'football',
    icon: '⚽',
    url: 'https://tulospalvelu.palloliitto.fi/team/185086/info',
    association: 'Palloliitto'
  },
  {
    name: 'Salibandy / ErVi (25301)',
    sport: 'floorball',
    icon: '🏑',
    url: 'https://tulospalvelu.salibandy.fi/team/25301/info',
    association: 'Salibandyliitto'
  },
  {
    name: 'Basket.fi / ToPo (5756346)',
    sport: 'basketball',
    icon: '🏀',
    url: 'https://tulospalvelu.basket.fi/team/5756346/info',
    association: 'Basket.fi'
  }
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onStartDemo,
  onOpenSmartImport,
  onQuickAddTeam,
  onFinishOnboarding,
  existingProfilesCount = 0
}) => {
  const [playerNameInput, setPlayerNameInput] = useState('Maija');
  const [addedSources, setAddedSources] = useState<AddedSource[]>([]);
  const [customIcsUrl, setCustomIcsUrl] = useState('');
  const [customSport, setCustomSport] = useState<SportType>('football');
  const [showCustomIcsInput, setShowCustomIcsInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
    (s) => s.playerName.toLowerCase() === playerNameInput.trim().toLowerCase()
  );

  const handleAddPresetTorneopal = async (team: (typeof PRESET_TORNEOPAL_TEAMS)[0]) => {
    const activeName = playerNameInput.trim() || 'Pelaaja';
    setIsLoading(true);
    try {
      await onQuickAddTeam(activeName, team.name, team.sport, team.url);
      setAddedSources((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          playerName: activeName,
          sourceType: 'torneopal',
          name: team.name,
          sport: team.sport,
          url: team.url
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddCustomIcs = async () => {
    const activeName = playerNameInput.trim() || 'Pelaaja';
    const trimmedUrl = customIcsUrl.trim();
    if (!trimmedUrl) return;

    setIsLoading(true);
    try {
      await onQuickAddTeam(activeName, `${activeName}:n joukkue`, customSport, trimmedUrl);
      setAddedSources((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          playerName: activeName,
          sourceType: 'ics',
          name: `${activeName}:n iCal / MyClub`,
          sport: customSport,
          url: trimmedUrl
        }
      ]);
      setCustomIcsUrl('');
      setShowCustomIcsInput(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveSource = (id: string) => {
    setAddedSources((prev) => prev.filter((s) => s.id !== id));
  };

  const handleStartNextPlayer = (name: string) => {
    setPlayerNameInput(name);
    setShowCustomIcsInput(false);
  };

  const totalSourcesCount = addedSources.length || existingProfilesCount;

  return (
    <div className="min-h-screen bg-canvas text-text-primary px-4 py-6 md:py-10 flex flex-col justify-between">
      <div className="max-w-xl mx-auto w-full space-y-4">
        {/* Title */}
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
                Lisää perheenjäsen kerrallaan ja liitä hänen joukkueensa
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

        {/* Existing Configured Players Badges */}
        {playerGroups.length > 0 && (
          <div className="p-3 rounded-2xl bg-surface-elevated/90 border border-pitch/30 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-pitch">
              <span>Perheen kokoonpano ({totalSourcesCount} lähdettä lisätty):</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {playerGroups.map(([name, sources]) => (
                <div
                  key={name}
                  className="px-2.5 py-1 rounded-xl bg-surface border border-border-strong text-xs font-semibold flex items-center gap-1.5"
                >
                  <span className="text-text-primary font-bold">👤 {name}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-pitch/15 text-pitch font-extrabold">
                    {sources.length}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ACTIVE PLAYER SETUP CARD */}
        <div className="liquid-glass rounded-3xl p-5 border border-border-strong shadow-xl space-y-4">
          {/* 1. Player Name */}
          <div>
            <label className="text-xs font-bold text-text-primary block mb-1.5">
              1. Pelaajan / lapsen nimi:
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={playerNameInput}
                onChange={(e) => setPlayerNameInput(e.target.value)}
                placeholder="esim. Maija, Eemil, Ville..."
                className="flex-1 px-3.5 py-2 rounded-xl bg-surface border border-border-strong text-text-primary text-xs font-bold focus:outline-none focus:border-pitch"
              />
              <div className="flex items-center gap-1">
                {['Maija', 'Eemil', 'Ville'].map((quickName) => (
                  <button
                    key={quickName}
                    type="button"
                    onClick={() => handleStartNextPlayer(quickName)}
                    className={`px-2.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer ${
                      playerNameInput.toLowerCase() === quickName.toLowerCase()
                        ? 'bg-pitch text-text-inverse border-pitch'
                        : 'bg-surface text-text-secondary border-border-subtle hover:text-text-primary'
                    }`}
                  >
                    {quickName}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. Add Data Sources for this Player */}
          <div>
            <label className="text-xs font-bold text-text-primary block mb-2">
              2. Valitse tai tuo kalenterit <span className="text-pitch">{playerNameInput || 'pelaajalle'}</span>:
            </label>

            {/* Ready Torneopal / Association Teams */}
            <div className="space-y-1.5 mb-3">
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
                    <div className="flex items-center gap-2">
                      <span>{team.icon}</span>
                      <span>{team.name}</span>
                    </div>

                    <div className="text-[11px] flex items-center gap-1 shrink-0">
                      {isAdded ? (
                        <span className="flex items-center gap-1 text-pitch font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Lisätty</span>
                        </span>
                      ) : (
                        <span className="text-text-muted hover:text-pitch font-semibold">
                          + Valitse
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom URL / Nimenhuuto / MyClub / WhatsApp Options */}
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
                      <option value="football">⚽ Futis</option>
                      <option value="floorball">🏑 Säbä</option>
                      <option value="basketball">🏀 Koris</option>
                      <option value="volleyball">🏐 Lentis</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="url"
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

            {/* Currently Added Sources for this Player */}
            {currentPlayerSources.length > 0 && (
              <div className="mt-3 p-3 rounded-2xl bg-surface border border-pitch/30 space-y-1.5">
                <div className="text-xs font-bold text-pitch flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{playerNameInput}:lle valitut lähteet ({currentPlayerSources.length}):</span>
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
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Action Buttons: Next Player OR Finish */}
          <div className="pt-2 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {['Maija', 'Eemil', 'Ville']
                .filter((n) => n.toLowerCase() !== playerNameInput.toLowerCase())
                .map((nextKid) => (
                  <button
                    key={nextKid}
                    type="button"
                    onClick={() => handleStartNextPlayer(nextKid)}
                    className="flex-1 py-2 px-3 rounded-xl bg-surface border border-border-strong hover:border-pitch text-text-primary text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5 text-pitch" />
                    <span>+ Lisää {nextKid}</span>
                  </button>
                ))}
            </div>

            {onFinishOnboarding && totalSourcesCount > 0 && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                transition={springTactile.snappy}
                type="button"
                onClick={onFinishOnboarding}
                className="w-full py-3.5 px-4 rounded-2xl bg-pitch text-text-inverse font-black text-sm flex items-center justify-center gap-2 hover:brightness-110 shadow-lg shadow-pitch/20 cursor-pointer"
              >
                <span>🚀 Valmis! Avaa kalenteri ({totalSourcesCount} joukkuetta)</span>
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
