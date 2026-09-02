import React from 'react';
import { motion } from 'motion/react';
import { PlayerProfile } from '../types/matchday';
import { springTactile } from '../lib/motion/springs';
import { User, Plus } from 'lucide-react';

interface MultiProfileHeaderProps {
  profiles: PlayerProfile[];
  activeProfileId: string;
  onSelectProfile: (id: string) => void;
  onAddProfile: () => void;
}

export const MultiProfileHeader: React.FC<MultiProfileHeaderProps> = ({
  profiles,
  activeProfileId,
  onSelectProfile,
  onAddProfile
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
    <nav
      aria-label="Pelaaja- ja joukkueprofiilit"
      role="tablist"
      className="flex flex-nowrap items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5"
    >
      <motion.button
        role="tab"
        aria-selected={activeProfileId === 'all'}
        whileTap={{ scale: 0.95 }}
        transition={springTactile.snappy}
        onClick={() => onSelectProfile('all')}
        className={`touch-target min-h-[44px] inline-flex shrink-0 items-center rounded-xl border px-3 text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-pitch cursor-pointer ${
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
                className={`touch-target min-h-[44px] inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-pitch cursor-pointer ${
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
                  className={`touch-target min-h-[44px] inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-pitch cursor-pointer ${
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
        className="touch-target min-h-[44px] inline-flex shrink-0 items-center gap-1 rounded-xl border border-border-strong bg-surface-elevated px-3 text-xs font-bold text-text-muted hover:text-pitch hover:border-pitch transition-all focus-visible:ring-2 focus-visible:ring-pitch cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        <span>+ Joukkue</span>
      </motion.button>
    </nav>
  );
};
