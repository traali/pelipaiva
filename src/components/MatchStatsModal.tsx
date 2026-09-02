import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Trophy,
  BarChart3,
  Award,
  Swords,
  BrainCircuit,
  Sparkles,
  GitCompare,
  Users,
  Star,
  Check,
  Plus,
  Minus,
  Save,
  Target,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { FullMatchStats, PlayerMatchLog, SportType } from '../types/matchday';
import { springTactile } from '../lib/motion/springs';
import { SatelliteEmbedDrawer } from './SatelliteEmbedDrawer';

interface MatchStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats?: FullMatchStats | null;
  homeTeam: string;
  awayTeam: string;
  playerName?: string;
  playerLog?: PlayerMatchLog;
  score?: string;
  sport?: SportType;
  onSavePlayerLog?: (log: PlayerMatchLog, updatedScore?: string) => void;
}

type StatsTab = 'stats' | 'player_log' | 'roster' | 'standings' | 'scorers' | 'common' | 'h2h' | 'scout';

function blankStanding(teamName: string) {
  return {
    rank: 0,
    teamName,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: [] as Array<'W' | 'D' | 'L'>
  };
}

export const MatchStatsModal: React.FC<MatchStatsModalProps> = ({
  isOpen,
  onClose,
  stats: statsProp,
  homeTeam,
  awayTeam,
  playerName,
  playerLog,
  score,
  sport = 'football',
  onSavePlayerLog
}) => {
  const stats: FullMatchStats = statsProp ?? {
    leagueName: 'Ei virallisia tilastoja',
    homeStanding: blankStanding(homeTeam),
    awayStanding: blankStanding(awayTeam),
    standingsTable: [],
    topScorers: [],
    headToHeadHistory: [],
    commonOpponents: [],
    squadRosters: {
      home: { teamName: homeTeam, players: [] },
      away: { teamName: awayTeam, players: [] }
    },
    divisionRosters: {},
    scoutAnalysis: 'Tulospalvelu ei palauttanut ottelukohtaisia tilastoja tälle ottelulle.'
  };
  const [activeTab, setActiveTab] = useState<StatsTab>('stats');
  const [selectedTeamName, setSelectedTeamName] = useState<string>(homeTeam);
  const [isSatelliteDrawerOpen, setIsSatelliteDrawerOpen] = useState(false);

  // Local state for recording player stats
  const [logGoals, setLogGoals] = useState<number>(playerLog?.goals ?? 0);
  const [logAssists, setLogAssists] = useState<number>(playerLog?.assists ?? 0);
  const [logPoints, setLogPoints] = useState<number>(playerLog?.points ?? 0);
  const [logSaves, setLogSaves] = useState<number>(playerLog?.saves ?? 0);
  const [logMinutes, setLogMinutes] = useState<number>(playerLog?.minutesPlayed ?? (sport === 'floorball' ? 45 : 60));
  const [logStarAward, setLogStarAward] = useState<boolean>(playerLog?.starPlayerAward ?? false);
  const [logNotes, setLogNotes] = useState<string>(playerLog?.notes ?? '');
  const [matchScoreInput, setMatchScoreInput] = useState<string>(score || `${stats?.liveScore?.home ?? 0}–${stats?.liveScore?.away ?? 0}`);
  const [isSavedFeedback, setIsSavedFeedback] = useState<boolean>(false);

  useEffect(() => {
    setLogGoals(playerLog?.goals ?? 0);
    setLogAssists(playerLog?.assists ?? 0);
    setLogPoints(playerLog?.points ?? 0);
    setLogSaves(playerLog?.saves ?? 0);
    setLogMinutes(playerLog?.minutesPlayed ?? (sport === 'floorball' ? 45 : 60));
    setLogStarAward(playerLog?.starPlayerAward ?? false);
    setLogNotes(playerLog?.notes ?? '');
    setMatchScoreInput(score || `${stats?.liveScore?.home ?? 0}–${stats?.liveScore?.away ?? 0}`);
  }, [playerLog, score, stats, sport]);

  const handleSaveLog = () => {
    const updatedLog: PlayerMatchLog = {
      goals: logGoals,
      assists: logAssists,
      points: logPoints,
      saves: logSaves,
      minutesPlayed: logMinutes,
      starPlayerAward: logStarAward,
      notes: logNotes.trim() || undefined,
      loggedAt: new Date().toISOString()
    };
    if (onSavePlayerLog) {
      onSavePlayerLog(updatedLog, matchScoreInput.trim() || undefined);
    }
    setIsSavedFeedback(true);
    setTimeout(() => setIsSavedFeedback(false), 2500);
  };

  if (!stats) return null;

  const teamStats = stats.teamStats;
  const homeStats = teamStats?.home;
  const awayStats = teamStats?.away;
  
  // Resolve current active squad roster across the entire division
  const currentRoster =
    stats.divisionRosters?.[selectedTeamName] ||
    (selectedTeamName === homeTeam
      ? stats.squadRosters?.home
      : stats.squadRosters?.away);

  // Comparison Bar Helper Component
  const ComparisonBar: React.FC<{
    label: string;
    homeVal: number;
    awayVal: number;
    suffix?: string;
    higherIsBetter?: boolean;
  }> = ({ label, homeVal, awayVal, suffix = '', higherIsBetter = true }) => {
    const total = homeVal + awayVal || 1;
    const homePercent = Math.round((homeVal / total) * 100);
    const awayPercent = 100 - homePercent;
    const homeLeading = higherIsBetter ? homeVal > awayVal : homeVal < awayVal;
    const awayLeading = higherIsBetter ? awayVal > homeVal : awayVal < homeVal;

    return (
      <div className="flex flex-col gap-1.5 py-2.5 border-b border-border-subtle/50 last:border-b-0">
        <div className="flex items-center justify-between text-xs font-semibold">
          <span
            className={`font-tabular text-sm ${
              homeLeading ? 'text-pitch font-black' : 'text-text-primary'
            }`}
          >
            {homeVal}
            {suffix}
          </span>
          <span className="text-text-secondary font-medium">{label}</span>
          <span
            className={`font-tabular text-sm ${
              awayLeading ? 'text-radar font-black' : 'text-text-primary'
            }`}
          >
            {awayVal}
            {suffix}
          </span>
        </div>

        {/* Two-Sided Visual Progress Bar */}
        <div className="h-2 w-full flex rounded-full overflow-hidden bg-surface-elevated gap-0.5">
          <div
            style={{ width: `${homePercent}%` }}
            className={`h-full rounded-l-full transition-all ${
              homeLeading ? 'bg-pitch' : 'bg-pitch/50'
            }`}
          />
          <div
            style={{ width: `${awayPercent}%` }}
            className={`h-full rounded-r-full transition-all ${
              awayLeading ? 'bg-radar' : 'bg-radar/50'
            }`}
          />
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
            role="dialog"
            aria-modal="true"
            aria-labelledby="match-stats-title"
            initial={{ scale: 0.92, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 10 }}
            transition={springTactile.gentle}
            className="liquid-glass relative w-full max-w-xl rounded-3xl p-5 md:p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
          >
            {/* Top Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-pitch/15 text-pitch">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-pitch uppercase tracking-wider">
                    {stats.leagueName}
                  </div>
                  <div className="text-xs text-text-muted">{stats.round || 'Sarjaottelu'}</div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full text-text-muted hover:text-text-primary hover:bg-surface-elevated cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Match Scoreboard Hero Card */}
            <div className="p-5 rounded-2xl bg-surface-elevated/70 border border-border-subtle mb-5 text-center">
              <div className="grid grid-cols-3 items-center">
                {/* Home Team */}
                <div className="text-left">
                  <div className="text-sm md:text-base font-bold text-text-primary truncate">
                    {homeTeam}
                  </div>
                  <div className="text-xs text-text-muted">
                    Sarjasijoitus: {stats.homeStanding.rank}. ({stats.homeStanding.points}p)
                  </div>
                </div>

                {/* Score / Live Clock */}
                <div className="flex flex-col items-center">
                  {stats.isSynthetic ? (
                    <>
                      <span className="text-2xl md:text-3xl font-black text-text-secondary">vs</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-base border border-border-strong text-text-secondary mt-1">
                        Ei tuloksia vielä
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="text-3xl md:text-4xl font-black font-tabular tracking-tight text-text-primary flex items-center justify-center gap-2">
                        <span className="text-pitch">{stats.liveScore?.home ?? 0}</span>
                        <span className="text-text-muted text-xl font-normal">-</span>
                        <span className="text-radar">{stats.liveScore?.away ?? 0}</span>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-base border border-border-strong text-text-secondary mt-1">
                        {stats.liveScore?.period || 'Päättynyt'}
                      </span>
                    </>
                  )}
                </div>

                {/* Away Team */}
                <div className="text-right">
                  <div className="text-sm md:text-base font-bold text-text-primary truncate">
                    {awayTeam}
                  </div>
                  <div className="text-xs text-text-muted">
                    Sarjasijoitus: {stats.awayStanding.rank}. ({stats.awayStanding.points}p)
                  </div>
                </div>
              </div>

              {/* Goal Scorer Events Timeline */}
              {stats.goalsTimeline && stats.goalsTimeline.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border-subtle/50 flex flex-col gap-1.5 text-xs text-text-secondary">
                  {stats.goalsTimeline.map((goal, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center gap-1.5 ${
                        goal.team === 'home' ? 'justify-start text-left' : 'justify-end text-right'
                      }`}
                    >
                      <span className="font-bold text-pitch font-tabular">{goal.minute}'</span>
                      <span className="font-semibold text-text-primary">⚽ {goal.player}</span>
                      {goal.assistPlayer && (
                        <span className="text-[10px] text-text-muted">({goal.assistPlayer})</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Satellite Launcher Banner */}
            <div className="mb-4 flex items-center justify-between p-3 rounded-2xl bg-surface-elevated/70 border border-border-subtle">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-text-primary">
                  {sport === 'volleyball' ? '🏐 Volleyball Stats Pro' : '⚽ Football Stats (Night Captain)'}
                </span>
                <span className="text-[10px] text-text-muted hidden sm:inline">
                  {sport === 'volleyball' ? 'Erätilastot & joukkuemuodot' : 'Syväanalyysi, H2H & pelaajakortit'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsSatelliteDrawerOpen(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border shadow-xs ${
                  sport === 'volleyball'
                    ? 'bg-orange-500/15 border-orange-500/30 text-orange-400 hover:bg-orange-500/25'
                    : 'bg-amber-400/15 border-amber-400/30 text-amber-300 hover:bg-amber-400/25'
                }`}
              >
                <span>Avaa tilastot</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Navigation Sub-Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none border-b border-border-subtle">
              {[
                { id: 'stats', label: 'Ottelutilastot', icon: BarChart3 },
                { id: 'player_log', label: playerName ? `🌟 ${playerName} (Omat tilastot)` : '🌟 Omat tilastot', icon: Star },
                { id: 'roster', label: 'Pelaajat & Kokoonpanot', icon: Users },
                { id: 'standings', label: 'Sarjataulukko', icon: Trophy },
                { id: 'scorers', label: 'Maalipörssi', icon: Award },
                { id: 'common', label: 'Yhteiset vastustajat', icon: GitCompare },
                { id: 'h2h', label: 'Keskinäiset (H2H)', icon: Swords },
                { id: 'scout', label: 'Taktinen katsaus', icon: BrainCircuit }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as StatsTab)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
                      isActive
                        ? 'bg-pitch text-text-inverse shadow-sm shadow-pitch/20 font-bold'
                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: Match Stats Comparison Bars */}
            {activeTab === 'stats' && homeStats && awayStats && (
              <div className="flex flex-col p-4 rounded-2xl bg-surface-elevated/40 border border-border-subtle">
                <ComparisonBar
                  label="Pallonhallinta"
                  homeVal={homeStats.possessionPercent}
                  awayVal={awayStats.possessionPercent}
                  suffix="%"
                />
                <ComparisonBar
                  label="Maalintekoyritykset"
                  homeVal={homeStats.shotsTotal}
                  awayVal={awayStats.shotsTotal}
                />
                <ComparisonBar
                  label="Laukaukset kohti maalia"
                  homeVal={homeStats.shotsOnTarget}
                  awayVal={awayStats.shotsOnTarget}
                />
                <ComparisonBar
                  label="Kulmapotkut"
                  homeVal={homeStats.corners}
                  awayVal={awayStats.corners}
                />
                <ComparisonBar
                  label="Torjunnat"
                  homeVal={homeStats.saves}
                  awayVal={awayStats.saves}
                />
                <ComparisonBar
                  label="Keltaiset kortit"
                  homeVal={homeStats.yellowCards}
                  awayVal={awayStats.yellowCards}
                  higherIsBetter={false}
                />
                <ComparisonBar
                  label="Rikkeet"
                  homeVal={homeStats.fouls}
                  awayVal={awayStats.fouls}
                  higherIsBetter={false}
                />
              </div>
            )}

            {/* TAB: Player Performance Logger & Highlights */}
            {activeTab === 'player_log' && (
              <div className="flex flex-col gap-4 p-4 rounded-2xl bg-surface-elevated/50 border border-border-subtle">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-text-primary flex items-center gap-1.5">
                      <Star className="w-4 h-4 text-whistle fill-whistle" />
                      <span>{playerName ? `${playerName} — Ottelun suoritukset` : 'Omat ottelutilastot'}</span>
                    </h3>
                    <p className="text-xs text-text-muted mt-0.5">
                      Kirjaa maalit, syötöt, peliaika ja ottelun kohokohdat muistiin.
                    </p>
                  </div>
                  {isSavedFeedback && (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-pitch/20 text-pitch border border-pitch/30 flex items-center gap-1 animate-pulse">
                      <Check className="w-3.5 h-3.5" />
                      Tallennettu!
                    </span>
                  )}
                </div>

                {/* Counter Steppers Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {/* Goals */}
                  <div className="p-3 rounded-xl bg-surface-base border border-border-subtle flex flex-col items-center justify-between">
                    <span className="text-[11px] font-bold text-text-secondary">
                      {sport === 'basketball' ? '🏀 Pisteet' : '⚽ Maalit'}
                    </span>
                    <span className="text-2xl font-black font-tabular my-1 text-pitch">
                      {sport === 'basketball' ? logPoints : logGoals}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          sport === 'basketball'
                            ? setLogPoints((v) => Math.max(0, v - (v >= 2 ? 2 : 1)))
                            : setLogGoals((v) => Math.max(0, v - 1))
                        }
                        className="w-7 h-7 rounded-lg bg-surface-elevated hover:bg-border-strong flex items-center justify-center text-text-primary font-bold cursor-pointer transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          sport === 'basketball'
                            ? setLogPoints((v) => v + 2)
                            : setLogGoals((v) => v + 1)
                        }
                        className="w-7 h-7 rounded-lg bg-pitch text-text-inverse hover:brightness-110 flex items-center justify-center font-bold cursor-pointer transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Assists */}
                  <div className="p-3 rounded-xl bg-surface-base border border-border-subtle flex flex-col items-center justify-between">
                    <span className="text-[11px] font-bold text-text-secondary">👟 Syötöt</span>
                    <span className="text-2xl font-black font-tabular my-1 text-radar">{logAssists}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLogAssists((v) => Math.max(0, v - 1))}
                        className="w-7 h-7 rounded-lg bg-surface-elevated hover:bg-border-strong flex items-center justify-center text-text-primary font-bold cursor-pointer transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogAssists((v) => v + 1)}
                        className="w-7 h-7 rounded-lg bg-radar text-text-inverse hover:brightness-110 flex items-center justify-center font-bold cursor-pointer transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Saves / Torjunnat */}
                  <div className="p-3 rounded-xl bg-surface-base border border-border-subtle flex flex-col items-center justify-between">
                    <span className="text-[11px] font-bold text-text-secondary">🧤 Torjunnat</span>
                    <span className="text-2xl font-black font-tabular my-1 text-text-primary">{logSaves}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLogSaves((v) => Math.max(0, v - 1))}
                        className="w-7 h-7 rounded-lg bg-surface-elevated hover:bg-border-strong flex items-center justify-center text-text-primary font-bold cursor-pointer transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogSaves((v) => v + 1)}
                        className="w-7 h-7 rounded-lg bg-surface-elevated hover:bg-border-strong flex items-center justify-center text-text-primary font-bold cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Minutes */}
                  <div className="p-3 rounded-xl bg-surface-base border border-border-subtle flex flex-col items-center justify-between col-span-2 sm:col-span-1">
                    <span className="text-[11px] font-bold text-text-secondary">⏱️ Peliaika</span>
                    <span className="text-2xl font-black font-tabular my-1 text-text-primary">
                      {logMinutes} <span className="text-xs font-normal text-text-muted">min</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLogMinutes((v) => Math.max(0, v - 5))}
                        className="w-7 h-7 rounded-lg bg-surface-elevated hover:bg-border-strong flex items-center justify-center text-text-primary font-bold cursor-pointer transition-colors"
                      >
                        -5
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogMinutes((v) => v + 5)}
                        className="w-7 h-7 rounded-lg bg-surface-elevated hover:bg-border-strong flex items-center justify-center text-text-primary font-bold cursor-pointer transition-colors"
                      >
                        +5
                      </button>
                    </div>
                  </div>

                  {/* Star Player / Tsemppari Toggle */}
                  <div
                    onClick={() => setLogStarAward((v) => !v)}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all col-span-2 sm:col-span-2 ${
                      logStarAward
                        ? 'bg-whistle/15 border-whistle text-whistle'
                        : 'bg-surface-base border-border-subtle text-text-secondary hover:border-border-strong'
                    }`}
                  >
                    <Star
                      className={`w-6 h-6 transition-all ${
                        logStarAward ? 'text-whistle fill-whistle scale-110' : 'text-text-muted'
                      }`}
                    />
                    <span className="text-xs font-bold text-center">
                      {logStarAward ? '🌟 Tsemppari / Ottelun tähti palkittu!' : 'Merkitse tsemppari / tähdistöpelaaja'}
                    </span>
                  </div>
                </div>

                {/* Score & Notes Row */}
                <div className="flex flex-col gap-2.5 pt-2 border-t border-border-subtle">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-text-secondary whitespace-nowrap">
                      Lopputulos:
                    </label>
                    <input
                      type="text"
                      value={matchScoreInput}
                      onChange={(e) => setMatchScoreInput(e.target.value)}
                      placeholder="esim. 4–2"
                      className="px-3 py-1.5 rounded-xl bg-surface-base border border-border-strong text-xs font-mono font-bold text-text-primary max-w-[120px] text-center focus-visible:ring-2 focus-visible:ring-pitch"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-text-secondary">
                      Omat muistiinpanot & fiilikset pelistä:
                    </label>
                    <textarea
                      value={logNotes}
                      onChange={(e) => setLogNotes(e.target.value)}
                      placeholder="Esim. Loistava prässi toisella jaksolla, hieno syöttö Maijan maaliin!"
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl bg-surface-base border border-border-subtle text-xs text-text-primary placeholder:text-text-muted focus-visible:ring-2 focus-visible:ring-pitch resize-none"
                    />
                  </div>
                </div>

                {/* Save Button */}
                <button
                  type="button"
                  onClick={handleSaveLog}
                  className="w-full py-2.5 rounded-xl bg-pitch text-text-inverse text-xs font-bold flex items-center justify-center gap-2 hover:brightness-110 cursor-pointer shadow-sm transition-all"
                >
                  <Save className="w-4 h-4" />
                  <span>Tallenna ottelutilastot</span>
                </button>
              </div>
            )}

            {/* TAB 2: Squad Rosters & Individual Player Stats (ALL TEAMS) */}
            {activeTab === 'roster' && (
              <div className="flex flex-col gap-3">
                {/* Division-Wide Team Selector Bar */}
                <div>
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5 px-1">
                    Valitse sarjan joukkue ({stats.standingsTable.length} joukkuetta):
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
                    {stats.standingsTable.map((team) => {
                      const isSelected = selectedTeamName === team.teamName;
                      const isHome = team.teamName === homeTeam;
                      const isAway = team.teamName === awayTeam;
                      return (
                        <button
                          key={team.teamName}
                          onClick={() => setSelectedTeamName(team.teamName)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all border ${
                            isSelected
                              ? 'bg-pitch text-text-inverse border-pitch shadow-sm shadow-pitch/20'
                              : 'bg-surface-elevated text-text-secondary border-border-subtle hover:text-text-primary'
                          }`}
                        >
                          {team.teamName}
                          {isHome ? ' (Koti)' : isAway ? ' (Vieras)' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Coach and Squad Header */}
                {currentRoster && currentRoster.players.length > 0 && (
                  <div className="p-3 rounded-2xl bg-surface-elevated/70 border border-border-subtle text-xs text-text-secondary flex items-center justify-between">
                    <div>
                      <span className="font-bold text-text-primary text-sm">{currentRoster.teamName}</span>
                      {currentRoster.coachName && (
                        <div className="text-[11px] text-text-muted mt-0.5">
                          Valmentaja: <strong>{currentRoster.coachName}</strong>
                        </div>
                      )}
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-surface-base font-semibold text-text-primary text-xs border border-border-subtle">
                      {currentRoster.players.length} pelaajaa listalla
                    </span>
                  </div>
                )}

                {/* Empty / GDPR-protected Roster Notice */}
                {(!currentRoster || currentRoster.players.length === 0) && (
                  <div className="p-5 rounded-2xl bg-surface-elevated/60 border border-border-subtle text-center flex flex-col items-center gap-2 text-xs">
                    <div className="w-10 h-10 rounded-full bg-surface border border-border-strong flex items-center justify-center text-text-muted text-base">
                      🛡️
                    </div>
                    <div className="font-bold text-text-primary text-sm">
                      {selectedTeamName}: Pelaajaluettelo ei julkinen
                    </div>
                    <p className="text-text-secondary max-w-sm leading-relaxed">
                      Palloliiton ja urheiluliittojen tietosuojakäytännön (GDPR) vuoksi juniorisarjojen pelaajalistoja ei julkaista avoimessa Tulospalvelussa.
                    </p>
                    <div className="mt-1 text-[11px] text-pitch font-semibold">
                      💡 Voit kirjata oman lapsen suoritukset ja fiilikset <strong>🌟 Omat tilastot</strong> -välilehdellä!
                    </div>
                  </div>
                )}

                {/* Players List Grid */}
                <div className="flex flex-col gap-2">
                  {currentRoster?.players.map((player) => (
                    <div
                      key={player.jerseyNumber}
                      className="p-3 rounded-2xl bg-surface-elevated/60 border border-border-subtle flex items-center justify-between gap-3 hover:border-pitch/30 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        {/* Jersey Number Circle */}
                        <div className="h-8 w-8 rounded-full bg-surface-elevated border border-border-strong flex items-center justify-center font-black text-xs text-text-primary font-tabular shrink-0">
                          #{player.jerseyNumber}
                        </div>

                        <div>
                          <div className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                            <span>{player.playerName}</span>
                            {player.isCaptain && (
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-whistle/20 text-whistle border border-whistle/30">
                                C
                              </span>
                            )}
                            <span className="text-[10px] text-text-muted px-1 py-0.2 rounded bg-surface-base font-semibold">
                              {player.position}
                            </span>
                          </div>
                          <div className="text-[10px] text-text-muted mt-0.5">
                            {player.matchesPlayed} ottelua pelattu
                          </div>
                        </div>
                      </div>

                      {/* Goals, Assists, Cards Stats */}
                      <div className="flex items-center gap-3 text-right shrink-0">
                        {sport === 'floorball' ? (
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-black text-pitch font-tabular">
                              {player.goals} + {player.assists} = {player.goals + player.assists} p
                            </span>
                            <span className="text-[10px] text-text-muted">
                              {player.goals}M, {player.assists}S
                            </span>
                          </div>
                        ) : (
                          <>
                            {player.goals > 0 && (
                              <div className="flex flex-col items-end">
                                <span className="text-xs font-black text-pitch font-tabular flex items-center gap-0.5">
                                  <Target className="w-3 h-3 text-pitch" />
                                  {player.goals} maalia
                                </span>
                                {player.assists > 0 && (
                                  <span className="text-[10px] text-text-secondary">
                                    +{player.assists} syöttöä
                                  </span>
                                )}
                              </div>
                            )}

                            {player.goals === 0 && player.assists > 0 && (
                              <span className="text-xs font-semibold text-text-secondary">
                                {player.assists} syöttöä
                              </span>
                            )}

                            {player.goals === 0 && player.assists === 0 && (
                              <span className="text-xs text-text-muted">Puolustava</span>
                            )}
                          </>
                        )}

                        {player.yellowCards > 0 && (
                          <span className="text-[10px] px-1 py-0.5 rounded bg-whistle/20 text-whistle font-bold">
                            🟨 {player.yellowCards}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: League Standings Table */}
            {activeTab === 'standings' && (
              <div className="flex flex-col gap-2">
                <div className="text-[11px] text-text-muted px-1">
                  💡 Klikkaa mitä tahansa joukkuetta nähdäksesi heidän pelaajakokoonpanonsa ja maalitilastonsa.
                </div>
                <div className="rounded-2xl border border-border-subtle overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface-elevated text-text-muted text-[11px] font-semibold border-b border-border-subtle">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Joukkue</th>
                          <th className="py-2.5 px-2 text-center">O</th>
                          <th className="py-2.5 px-2 text-center">V</th>
                          <th className="py-2.5 px-2 text-center">T</th>
                          <th className="py-2.5 px-2 text-center">H</th>
                          <th className="py-2.5 px-2 text-center">ME</th>
                          <th className="py-2.5 px-3 text-right">Pisteet</th>
                          <th className="py-2.5 px-3 text-center">Kunto</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle/50">
                        {stats.standingsTable.map((row) => {
                          const isHome = row.teamName === homeTeam;
                          const isAway = row.teamName === awayTeam;
                          return (
                            <tr
                              key={row.rank}
                              onClick={() => {
                                setSelectedTeamName(row.teamName);
                                setActiveTab('roster');
                              }}
                              className={`transition-colors cursor-pointer hover:brightness-110 ${
                                isHome
                                  ? 'bg-pitch/10 font-bold text-pitch'
                                  : isAway
                                  ? 'bg-radar/10 font-bold text-radar'
                                  : 'hover:bg-surface-elevated/50 text-text-primary'
                              }`}
                            >
                              <td className="py-2.5 px-3 font-bold">{row.rank}.</td>
                              <td className="py-2.5 px-3 font-semibold truncate max-w-[130px] flex items-center justify-between gap-1">
                                <span>{row.teamName}</span>
                                <ChevronRight className="w-3 h-3 opacity-50 shrink-0" />
                              </td>
                              <td className="py-2.5 px-2 text-center font-tabular">{row.played}</td>
                              <td className="py-2.5 px-2 text-center font-tabular">{row.won}</td>
                              <td className="py-2.5 px-2 text-center font-tabular">{row.drawn}</td>
                              <td className="py-2.5 px-2 text-center font-tabular">{row.lost}</td>
                              <td className="py-2.5 px-2 text-center font-tabular">
                                {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black font-tabular text-sm">
                                {row.points}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {row.form.map((f, fIdx) => (
                                    <span
                                      key={fIdx}
                                      className={`h-2 w-2 rounded-full ${
                                        f === 'W'
                                          ? 'bg-pitch'
                                          : f === 'D'
                                          ? 'bg-whistle'
                                          : 'bg-stoppage'
                                      }`}
                                      title={f === 'W' ? 'Voitto' : f === 'D' ? 'Tasapeli' : 'Tappio'}
                                    />
                                  ))}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Top Scorers (Maalipörssi) */}
            {activeTab === 'scorers' && (
              <div className="flex flex-col gap-2">
                {stats.topScorers.map((scorer) => (
                  <div
                    key={scorer.rank}
                    onClick={() => {
                      setSelectedTeamName(scorer.teamName);
                      setActiveTab('roster');
                    }}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated/60 border border-border-subtle cursor-pointer hover:border-pitch/30 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-6 w-6 rounded-full bg-surface-elevated border border-border-strong flex items-center justify-center font-bold text-xs text-text-primary font-tabular">
                        {scorer.rank}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-text-primary group-hover:text-pitch transition-colors">
                          {scorer.playerName}
                        </div>
                        <div className="text-[11px] text-text-muted">{scorer.teamName}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-black text-pitch font-tabular">
                        {scorer.goals} {sport === 'basketball' ? 'pistettä' : 'maalia'}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {scorer.matchesPlayed} ottelussa
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 5: Common Opponents (Yhteiset vastustajat) */}
            {activeTab === 'common' && (
              <div className="flex flex-col gap-3">
                <div className="text-xs font-bold text-text-muted uppercase tracking-wider">
                  Yhteiset vastustajat ({stats.commonOpponents?.length || 0})
                </div>
                {stats.commonOpponents?.map((c, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-surface-elevated/60 border border-border-subtle text-xs"
                  >
                    <div className="font-bold text-text-primary mb-2 flex items-center justify-between">
                      <span>vs {c.opponentName}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-lg bg-surface-base border border-border-subtle flex items-center justify-between">
                        <span className="text-text-muted truncate max-w-[90px]">{homeTeam}</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-bold ${
                              c.homeResult.result === 'win'
                                ? 'text-pitch'
                                : c.homeResult.result === 'draw'
                                ? 'text-whistle'
                                : 'text-stoppage'
                            }`}
                          >
                            {c.homeResult.result === 'win'
                              ? 'V'
                              : c.homeResult.result === 'draw'
                              ? 'T'
                              : 'H'}
                          </span>
                          <span className="font-tabular text-[11px] text-text-secondary">
                            ({c.homeResult.score})
                          </span>
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-surface-base border border-border-subtle flex items-center justify-between">
                        <span className="text-text-muted truncate max-w-[90px]">{awayTeam}</span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-bold ${
                              c.awayResult.result === 'win'
                                ? 'text-pitch'
                                : c.awayResult.result === 'draw'
                                ? 'text-whistle'
                                : 'text-stoppage'
                            }`}
                          >
                            {c.awayResult.result === 'win'
                              ? 'V'
                              : c.awayResult.result === 'draw'
                              ? 'T'
                              : 'H'}
                          </span>
                          <span className="font-tabular text-[11px] text-text-secondary">
                            ({c.awayResult.score})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 6: Head to Head History */}
            {activeTab === 'h2h' && (
              <div className="flex flex-col gap-2.5">
                {stats.headToHeadHistory.map((h2h, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-surface-elevated/60 border border-border-subtle flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="text-[10px] text-text-muted font-medium">
                        {h2h.date} • {h2h.competition}
                      </div>
                      <div className="font-bold text-text-primary mt-0.5">
                        {h2h.homeTeam} vs {h2h.awayTeam}
                      </div>
                    </div>
                    <div className="text-base font-black text-text-primary font-tabular px-3 py-1 rounded-lg bg-surface-elevated border border-border-strong">
                      {h2h.homeScore} - {h2h.awayScore}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 7: Tactical Scout Analysis */}
            {activeTab === 'scout' && (
              <div className="p-4 rounded-2xl bg-surface-elevated/60 border border-border-subtle flex flex-col gap-3">
                <div className="flex items-center gap-2 text-pitch font-bold text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>Pelipäivä AI - Otteluennakko</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {stats.scoutAnalysis}
                </p>
                {!stats.isSynthetic && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-surface-base/60 border border-border-subtle text-xs">
                    <span>Kotijoukkueen kuntopuntari:</span>
                    <span className="font-bold text-pitch">7 Voittoa peräkkäin 🔥</span>
                  </div>
                )}
              </div>
            )}

            {/* Modal Footer */}
            <div className="mt-5 pt-3 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-muted">
              <span>{stats.isSynthetic ? 'Arvioitu esikatselu — ei virallista lähdettä' : 'Lähde: Palloliitto Tulospalvelu / Torneopal'}</span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl bg-surface-elevated border border-border-strong text-text-primary font-bold hover:border-pitch cursor-pointer"
              >
                Sulje
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Embedded Satellite Analytics Drawer */}
      <SatelliteEmbedDrawer
        isOpen={isSatelliteDrawerOpen}
        onClose={() => setIsSatelliteDrawerOpen(false)}
        title={sport === 'volleyball' ? `Volleyball Stats: ${homeTeam} vs ${awayTeam}` : `Football Stats: ${homeTeam} vs ${awayTeam}`}
        subtitle="Interaktiivinen syväanalyysi & Night Captain -tilastot"
        embedUrl={
          sport === 'volleyball'
            ? `https://volleyball-stats.pages.dev/match/${encodeURIComponent(`${homeTeam}-${awayTeam}`)}?embed=true&theme=night-captain`
            : `https://football-stats.pages.dev/match/${encodeURIComponent(`${homeTeam}-${awayTeam}`)}?embed=true&theme=night-captain`
        }
        sourceRepo={sport === 'volleyball' ? 'volleyball-stats' : 'football-stats'}
      />
    </AnimatePresence>
  );
};
