import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Trophy,
  BarChart3,
  Award,
  Swords,
  BrainCircuit,
  Sparkles
} from 'lucide-react';
import { FullMatchStats } from '../types/matchday';
import { springTactile } from '../lib/motion/springs';

interface MatchStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stats: FullMatchStats;
  homeTeam: string;
  awayTeam: string;
}

type StatsTab = 'stats' | 'standings' | 'scorers' | 'h2h' | 'scout';

export const MatchStatsModal: React.FC<MatchStatsModalProps> = ({
  isOpen,
  onClose,
  stats,
  homeTeam,
  awayTeam
}) => {
  const [activeTab, setActiveTab] = useState<StatsTab>('stats');

  if (!stats) return null;

  const teamStats = stats.teamStats;
  const homeStats = teamStats?.home;
  const awayStats = teamStats?.away;

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
                  <div className="text-3xl md:text-4xl font-black font-tabular tracking-tight text-text-primary flex items-center justify-center gap-2">
                    <span className="text-pitch">{stats.liveScore?.home ?? 0}</span>
                    <span className="text-text-muted text-xl font-normal">-</span>
                    <span className="text-radar">{stats.liveScore?.away ?? 0}</span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-base border border-border-strong text-text-secondary mt-1">
                    {stats.liveScore?.period || 'Päättynyt'}
                  </span>
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

            {/* Navigation Sub-Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none border-b border-border-subtle">
              {[
                { id: 'stats', label: 'Tilastot', icon: BarChart3 },
                { id: 'standings', label: 'Sarjataulukko', icon: Trophy },
                { id: 'scorers', label: 'Maalipörssi', icon: Award },
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

            {/* TAB 2: League Standings Table */}
            {activeTab === 'standings' && (
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
                            className={`transition-colors ${
                              isHome
                                ? 'bg-pitch/10 font-bold text-pitch'
                                : isAway
                                ? 'bg-radar/10 font-bold text-radar'
                                : 'hover:bg-surface-elevated/50 text-text-primary'
                            }`}
                          >
                            <td className="py-2.5 px-3 font-bold">{row.rank}.</td>
                            <td className="py-2.5 px-3 font-semibold truncate max-w-[130px]">
                              {row.teamName}
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
            )}

            {/* TAB 3: Top Scorers (Maalipörssi) */}
            {activeTab === 'scorers' && (
              <div className="flex flex-col gap-2">
                {stats.topScorers.map((scorer) => (
                  <div
                    key={scorer.rank}
                    className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated/60 border border-border-subtle"
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-6 w-6 rounded-full bg-surface-elevated border border-border-strong flex items-center justify-center font-bold text-xs text-text-primary font-tabular">
                        {scorer.rank}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-text-primary">
                          {scorer.playerName}
                        </div>
                        <div className="text-[11px] text-text-muted">{scorer.teamName}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-black text-pitch font-tabular">
                        {scorer.goals} maalia
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {scorer.matchesPlayed} ottelussa
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 4: Head to Head History */}
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

            {/* TAB 5: Tactical Scout Analysis */}
            {activeTab === 'scout' && (
              <div className="p-4 rounded-2xl bg-surface-elevated/60 border border-border-subtle flex flex-col gap-3">
                <div className="flex items-center gap-2 text-pitch font-bold text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>Pelipäivä AI - Otteluennakko</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {stats.scoutAnalysis}
                </p>
                <div className="flex items-center justify-between p-3 rounded-xl bg-surface-base/60 border border-border-subtle text-xs">
                  <span>Kotijoukkueen kuntopuntari:</span>
                  <span className="font-bold text-pitch">7 Voittoa peräkkäin 🔥</span>
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="mt-5 pt-3 border-t border-border-subtle flex items-center justify-between text-[11px] text-text-muted">
              <span>Lähde: Palloliitto Tulospalvelu / Torneopal</span>
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
    </AnimatePresence>
  );
};
