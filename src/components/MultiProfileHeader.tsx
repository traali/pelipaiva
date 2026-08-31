import React from 'react';
import { motion } from 'motion/react';
import { PlayerProfile } from '../types/matchday';
import { springTactile } from '../lib/motion/springs';
import { User, Plus, Users, Calendar, RefreshCw } from 'lucide-react';

interface MultiProfileHeaderProps {
  profiles: PlayerProfile[];
  activeProfileId: string;
  onSelectProfile: (id: string) => void;
  onAddProfile: () => void;
  onOpenFamilyManage?: () => void;
  onOpenCalendarSubscribe?: () => void;
  onRefresh?: () => void;
  isSyncing?: boolean;
}

export const MultiProfileHeader: React.FC<MultiProfileHeaderProps> = ({
  profiles,
  activeProfileId,
  onSelectProfile,
  onAddProfile,
  onOpenFamilyManage,
  onOpenCalendarSubscribe,
  onRefresh,
  isSyncing
}) => {
  // Group profiles by playerName (normalized casing)
  const playerGroups = React.useMemo(() => {
    const map = new Map<string, PlayerProfile[]>();
    for (const p of profiles) {
      const raw = (p.playerName || 'Pelaaja').trim();
      const name = raw.charAt(0).toUpperCase() + raw.slice(1);
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(p);
    }
    return Array.from(map.entries());
  }, [profiles]);

  return (
    <div className="flex flex-col gap-2">
      {/* Top Utility Action Bar */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenFamilyManage && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              transition={springTactile.snappy}
              onClick={onOpenFamilyManage}
              aria-label="Hallitse perheen pelaajia ja joukkueita"
              title="Hallitse perheen pelaajia ja joukkueita"
              className="touch-target min-h-[44px] inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-pitch px-3.5 text-xs font-bold text-text-inverse shadow-xs focus-visible:ring-2 focus-visible:ring-pitch"
            >
              <Users className="h-4 w-4" />
              <span>Perhe</span>
              {playerGroups.length > 0 && (
                <span className="ml-0.5 rounded-full bg-black/20 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                  {playerGroups.length}
                </span>
              )}
            </motion.button>
          )}

          {onOpenCalendarSubscribe && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              transition={springTactile.snappy}
              onClick={onOpenCalendarSubscribe}
              aria-label="Tilaa elävä perhekalenteri puhelimeen"
              title="Tilaa elävä iCal-kalenteri puhelimeen"
              className="touch-target min-h-[44px] inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border-strong bg-surface-elevated px-3 text-xs font-bold text-text-primary hover:text-pitch hover:border-pitch transition-all focus-visible:ring-2 focus-visible:ring-pitch"
            >
              <Calendar className="h-4 w-4 text-pitch" />
              <span>Tilaa kalenteri</span>
            </motion.button>
          )}

          {onRefresh && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              transition={springTactile.snappy}
              onClick={onRefresh}
              disabled={isSyncing}
              aria-label="Päivitä löydökset, kulkumatkat ja perhetiedot"
              title="Päivitä löydökset, kulkumatkat ja perhetiedot"
              className="touch-target min-h-[44px] inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border-strong bg-surface-elevated px-3 text-xs font-bold text-text-primary hover:text-pitch hover:border-pitch transition-all focus-visible:ring-2 focus-visible:ring-pitch cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 text-pitch ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Päivitetään…' : 'Päivitä'}</span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Profiles Carousel Bar */}
      <nav
        aria-label="Pelaaja- ja joukkueprofiilit"
        role="tablist"
        className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none"
      >
        <motion.button
          role="tab"
          aria-selected={activeProfileId === 'all'}
          whileTap={{ scale: 0.95 }}
          transition={springTactile.snappy}
          onClick={() => onSelectProfile('all')}
          className={`touch-target min-h-[44px] inline-flex shrink-0 items-center rounded-xl border px-3.5 text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-pitch ${
            activeProfileId === 'all'
              ? 'border-pitch bg-pitch text-text-inverse shadow-xs'
              : 'border-border-subtle bg-surface-elevated text-text-secondary hover:text-text-primary'
          }`}
        >
          Kaikki profiilit
        </motion.button>

        {playerGroups.map(([playerName, playerProfiles]) => {
          const hasMultipleTeams = playerProfiles.length > 1;
          const isPlayerActive = activeProfileId === `player:${playerName}`;

          return (
            <React.Fragment key={playerName}>
              {hasMultipleTeams ? (
                <motion.button
                  role="tab"
                  aria-selected={isPlayerActive}
                  whileTap={{ scale: 0.95 }}
                  transition={springTactile.snappy}
                  onClick={() => onSelectProfile(`player:${playerName}`)}
                  className={`touch-target min-h-[44px] inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-pitch ${
                    isPlayerActive
                      ? 'border-pitch bg-pitch text-text-inverse shadow-xs'
                      : 'border-border-subtle bg-surface-elevated text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <User className="w-4 h-4" />
                  <span>{playerName} ({playerProfiles.length} tiimiä)</span>
                </motion.button>
              ) : null}

              {playerProfiles.map((p) => {
                const isSelected = activeProfileId === p.id;
                return (
                  <motion.button
                    key={p.id}
                    role="tab"
                    aria-selected={isSelected}
                    whileTap={{ scale: 0.95 }}
                    transition={springTactile.snappy}
                    onClick={() => onSelectProfile(p.id)}
                    className={`touch-target min-h-[44px] inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-pitch ${
                      isSelected
                        ? 'border-pitch bg-pitch text-text-inverse shadow-xs'
                        : 'border-border-subtle bg-surface-elevated text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full ring-1 ring-black/20 shrink-0"
                      style={{ background: p.colorHex }}
                    />
                    <span>{hasMultipleTeams ? p.teamName : `${p.playerName} · ${p.teamName}`}</span>
                  </motion.button>
                );
              })}
            </React.Fragment>
          );
        })}

        <motion.button
          whileTap={{ scale: 0.95 }}
          transition={springTactile.snappy}
          onClick={onAddProfile}
          aria-label="Lisää joukkue tai turnaus"
          title="Lisää joukkue tai turnaus valitulle pelaajalle"
          className="touch-target min-h-[44px] inline-flex shrink-0 items-center gap-1 rounded-xl border border-border-strong bg-surface-elevated px-3 text-xs font-bold text-text-muted hover:text-pitch hover:border-pitch transition-all focus-visible:ring-2 focus-visible:ring-pitch"
        >
          <Plus className="w-4 h-4" />
          <span>+ Joukkue</span>
        </motion.button>
      </nav>
    </div>
  );
};
