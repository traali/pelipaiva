import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Calendar,
  Sparkles,
  CheckCircle2,
  QrCode,
  UserPlus,
  PlusCircle,
  ArrowRight,
  Check
} from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import type { SportType } from '../types/matchday';

interface AddedTeamEntry {
  playerName: string;
  teamName: string;
  sport: SportType;
  url: string;
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

const DEFAULT_PLAYERS = ['Maija', 'Eemil', 'Ville'];

const READY_TEAMS: Array<{
  name: string;
  sport: SportType;
  sportLabel: string;
  icon: string;
  url: string;
  badge: string;
}> = [
  {
    name: 'PPJ Laru Sininen (185085)',
    sport: 'football',
    sportLabel: 'Jalkapallo',
    icon: '⚽',
    url: 'https://tulospalvelu.palloliitto.fi/team/185085/info',
    badge: 'Palloliitto'
  },
  {
    name: 'PPJ Laru Valkoinen (185083)',
    sport: 'football',
    sportLabel: 'Jalkapallo',
    icon: '⚽',
    url: 'https://tulospalvelu.palloliitto.fi/team/185083/info',
    badge: 'Palloliitto'
  },
  {
    name: 'PPJ Laru Oranssi (185086)',
    sport: 'football',
    sportLabel: 'Jalkapallo',
    icon: '⚽',
    url: 'https://tulospalvelu.palloliitto.fi/team/185086/info',
    badge: 'Palloliitto'
  },
  {
    name: 'Salibandy (25301)',
    sport: 'floorball',
    sportLabel: 'Salibandy / ErVi',
    icon: '🏑',
    url: 'https://tulospalvelu.salibandy.fi/team/25301/info',
    badge: 'Salibandyliitto'
  },
  {
    name: 'Basket.fi (5756346)',
    sport: 'basketball',
    sportLabel: 'Koripallo / ToPo',
    icon: '🏀',
    url: 'https://tulospalvelu.basket.fi/team/5756346/info',
    badge: 'Basket.fi'
  }
];

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  onStartDemo,
  onOpenImportModal,
  onOpenFamilyShare,
  onOpenSmartImport,
  onQuickAddTeam,
  onFinishOnboarding,
  existingProfilesCount = 0
}) => {
  const [selectedPlayer, setSelectedPlayer] = useState('Maija');
  const [addedTeams, setAddedTeams] = useState<AddedTeamEntry[]>([]);
  const [loadingTeam, setLoadingTeam] = useState<string | null>(null);

  const handleToggleTeam = async (team: (typeof READY_TEAMS)[0]) => {
    const isAlreadyAdded = addedTeams.some(
      (t) =>
        t.playerName.toLowerCase() === selectedPlayer.toLowerCase() &&
        t.teamName === team.name
    );

    if (isAlreadyAdded) return; // already added

    setLoadingTeam(team.name);
    try {
      await onQuickAddTeam(selectedPlayer.trim() || 'Maija', team.name, team.sport, team.url);
      setAddedTeams((prev) => [
        ...prev,
        {
          playerName: selectedPlayer.trim() || 'Maija',
          teamName: team.name,
          sport: team.sport,
          url: team.url
        }
      ]);
    } finally {
      setLoadingTeam(null);
    }
  };

  // Group teams by child
  const playerSummary = addedTeams.reduce<Record<string, AddedTeamEntry[]>>((acc, curr) => {
    if (!acc[curr.playerName]) acc[curr.playerName] = [];
    acc[curr.playerName]!.push(curr);
    return acc;
  }, {});

  const totalTeamsCount = addedTeams.length || existingProfilesCount;

  return (
    <div className="min-h-screen bg-canvas text-text-primary px-4 py-6 md:py-10 flex flex-col justify-between">
      <div className="max-w-xl mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pitch/15 text-pitch border border-pitch/30 text-[11px] font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Suomalaisen Urheiluperheen Tilannekeskus</span>
          </div>

          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-text-primary mb-2">
            Lisää perheesi <span className="text-pitch">Pelipäivään</span>
          </h1>

          <p className="text-xs md:text-sm text-text-secondary">
            Kaikki ottelut, kenttäsäät, pysäköinti ja kyydit samassa paikassa. Ei käyttäjätilejä.
          </p>
        </div>

        {/* MAIN INTERACTIVE CARD */}
        <div className="liquid-glass rounded-3xl p-5 md:p-7 border border-pitch/30 shadow-2xl space-y-5">
          {/* STEP 1: Select or Type Player */}
          <div>
            <label className="text-xs font-black uppercase tracking-wider text-text-muted flex items-center gap-1.5 mb-2.5">
              <span>1. Kenelle pelaajalle / lapselle lisätään tietoja?</span>
            </label>

            <div className="flex items-center gap-1.5 flex-wrap">
              {DEFAULT_PLAYERS.map((p) => {
                const count = playerSummary[p]?.length || 0;
                const isSelected = selectedPlayer.toLowerCase() === p.toLowerCase();
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPlayer(p)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-pitch text-text-inverse border-pitch shadow-md shadow-pitch/20'
                        : 'bg-surface-elevated text-text-secondary border-border-subtle hover:text-text-primary'
                    }`}
                  >
                    <span>👤 {p}</span>
                    {count > 0 && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                        isSelected ? 'bg-white/25 text-white' : 'bg-pitch/20 text-pitch'
                      }`}>
                        {count} {count === 1 ? 'joukkue' : 'joukkuetta'}
                      </span>
                    )}
                  </button>
                );
              })}

              <input
                type="text"
                value={DEFAULT_PLAYERS.includes(selectedPlayer) ? '' : selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
                placeholder="+ Muu nimi..."
                className="px-3 py-2 rounded-xl bg-surface border border-border-strong text-text-primary text-xs font-bold focus:outline-none focus:border-pitch w-28 placeholder:text-text-muted"
              />
            </div>
          </div>

          {/* STEP 2: Select Teams for Active Player */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <label className="text-xs font-black uppercase tracking-wider text-text-primary flex items-center gap-1.5">
                <span>2. Valitse <span className="text-pitch">{selectedPlayer}</span>:n joukkueet:</span>
              </label>
              <span className="text-[11px] text-text-muted">Voit valita useita</span>
            </div>

            <div className="space-y-2">
              {READY_TEAMS.map((team) => {
                const isAdded = addedTeams.some(
                  (t) =>
                    t.playerName.toLowerCase() === selectedPlayer.toLowerCase() &&
                    t.teamName === team.name
                );
                const isLoading = loadingTeam === team.name;

                return (
                  <button
                    key={team.name}
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleToggleTeam(team)}
                    className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                      isAdded
                        ? 'bg-pitch/15 border-pitch text-text-primary'
                        : 'bg-surface-elevated/70 border-border-subtle hover:border-pitch text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl shrink-0">{team.icon}</span>
                      <div>
                        <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                          <span>{team.name}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-surface border border-border-subtle text-text-muted font-normal">
                            {team.badge}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-muted">{team.sportLabel}</div>
                      </div>
                    </div>

                    <div className="shrink-0 pl-2">
                      {isAdded ? (
                        <div className="h-6 w-6 rounded-full bg-pitch text-text-inverse flex items-center justify-center shadow-sm">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : isLoading ? (
                        <div className="text-[11px] text-pitch font-bold animate-pulse">
                          Tallennetaan...
                        </div>
                      ) : (
                        <div className="h-6 w-6 rounded-full border border-border-strong text-text-muted flex items-center justify-center hover:border-pitch hover:text-pitch">
                          <PlusCircle className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Custom .ics or Smart Text Import */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5">
              <button
                type="button"
                onClick={() =>
                  onOpenImportModal('football', '', `${selectedPlayer}:n joukkue`)
                }
                className="p-2.5 rounded-xl bg-surface border border-border-strong hover:border-pitch text-text-secondary hover:text-text-primary text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-pitch shrink-0" />
                <span className="truncate">+ Muu kalenteri (.ics / MyClub)</span>
              </button>

              {onOpenSmartImport && (
                <button
                  type="button"
                  onClick={onOpenSmartImport}
                  className="p-2.5 rounded-xl bg-pitch/10 border border-pitch/30 hover:bg-pitch hover:text-text-inverse text-pitch text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">✨ Liitä WhatsApp / Excel</span>
                </button>
              )}
            </div>
          </div>

          {/* STEP 3: Summary of the Family So Far */}
          {Object.keys(playerSummary).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3.5 rounded-2xl bg-surface border border-pitch/40 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-pitch flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Perheen kokoonpano valmiina:</span>
                </span>
                <span className="font-extrabold text-text-primary">
                  {totalTeamsCount} {totalTeamsCount === 1 ? 'joukkue' : 'joukkuetta'}
                </span>
              </div>

              <div className="space-y-1.5">
                {Object.entries(playerSummary).map(([pName, teams]) => (
                  <div
                    key={pName}
                    className="p-2 rounded-xl bg-surface-elevated text-xs flex items-center justify-between"
                  >
                    <span className="font-bold text-text-primary">👤 {pName}</span>
                    <span className="text-[11px] text-text-secondary truncate max-w-[200px]">
                      {teams.map((t) => t.teamName).join(' • ')}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ACTIONS: Add Next Child OR Finish */}
          <div className="pt-2 flex flex-col gap-2.5">
            {/* Suggest adding next child if unconfigured */}
            {DEFAULT_PLAYERS.filter((n) => !playerSummary[n] && n !== selectedPlayer).length > 0 && (
              <div className="flex items-center justify-between bg-surface-elevated/60 p-2.5 rounded-xl border border-border-subtle">
                <span className="text-xs text-text-muted">Lisää seuraava lapsi:</span>
                <div className="flex items-center gap-1.5">
                  {DEFAULT_PLAYERS.filter((n) => !playerSummary[n] && n !== selectedPlayer).map((nextKid) => (
                    <button
                      key={nextKid}
                      type="button"
                      onClick={() => setSelectedPlayer(nextKid)}
                      className="px-2.5 py-1 rounded-lg bg-surface border border-border-strong hover:border-pitch text-text-primary font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus className="w-3 h-3 text-pitch" />
                      <span>+ {nextKid}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Finish Button */}
            {onFinishOnboarding && totalTeamsCount > 0 && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                transition={springTactile.snappy}
                type="button"
                onClick={onFinishOnboarding}
                className="w-full py-3.5 px-4 rounded-2xl bg-pitch text-text-inverse font-black text-sm flex items-center justify-center gap-2 hover:brightness-110 shadow-lg shadow-pitch/25 cursor-pointer transition-all"
              >
                <span>🚀 Valmis! Avaa Pelipäivä ({totalTeamsCount} joukkuetta)</span>
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            )}
          </div>

          {/* Quick Demo & Family Sync */}
          <div className="flex items-center justify-between gap-2 pt-3 border-t border-border-subtle text-xs">
            <button
              onClick={onStartDemo}
              className="font-bold text-text-secondary hover:text-pitch flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-pitch" />
              <span>Lataa valmis esimerkki</span>
            </button>

            <button
              onClick={onOpenFamilyShare}
              className="text-text-muted hover:text-text-primary flex items-center gap-1 cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-whistle" />
              <span>Skannaa QR-koodi</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center pt-6">
        <p className="text-xs text-text-muted">
          Pelipäivä • 100% Paikallinen PWA • Ei käyttäjätilejä, ei pilvitallennusta
        </p>
      </footer>
    </div>
  );
};
