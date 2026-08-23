import React from 'react';
import { motion } from 'motion/react';
import { PlayerProfile } from '../types/matchday';
import { springTactile } from '../lib/motion/springs';
import { User, Plus, Users } from 'lucide-react';

interface MultiProfileHeaderProps {
  profiles: PlayerProfile[];
  activeProfileId: string;
  onSelectProfile: (id: string) => void;
  onAddProfile: () => void;
  onOpenFamilyManage?: () => void;
}

export const MultiProfileHeader: React.FC<MultiProfileHeaderProps> = ({
  profiles,
  activeProfileId,
  onSelectProfile,
  onAddProfile,
  onOpenFamilyManage
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
      className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 scrollbar-none"
    >
      {onOpenFamilyManage && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          transition={springTactile.snappy}
          onClick={onOpenFamilyManage}
          aria-label="Hallitse perheen pelaajia ja joukkueita"
          title="Hallitse perheen pelaajia ja joukkueita"
          className="touch-target inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-pitch px-3.5 text-xs font-bold text-text-inverse shadow-xs focus-visible:ring-2 focus-visible:ring-pitch"
        >
          <Users className="h-4 w-4" />
          <span>Perhe</span>
        </motion.button>
      )}

      <motion.button
        role="tab"
        aria-selected={activeProfileId === 'all'}
        whileTap={{ scale: 0.95 }}
        transition={springTactile.snappy}
        onClick={() => onSelectProfile('all')}
        className={`touch-target inline-flex shrink-0 items-center rounded-xl border px-3.5 text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-pitch ${
          activeProfileId === 'all'
            ? 'border-pitch bg-pitch text-text-inverse shadow-xs'
            : 'border-border-subtle bg-surface-elevated text-text-secondary hover:text-text-primary'
        }`}
      >
        Kaikki
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
                className={`touch-target inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-pitch ${
                  isPlayerActive
                    ? 'border-pitch bg-pitch text-text-inverse shadow-xs'
                    : 'border-border-subtle bg-surface-elevated text-text-secondary hover:text-text-primary'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>{playerName} ({playerProfiles.length} lajia/tiimiä)</span>
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
                  className={`touch-target inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 text-xs font-bold transition-all focus-visible:ring-2 focus-visible:ring-pitch ${
                    isSelected
                      ? 'border-pitch bg-pitch text-text-inverse shadow-xs'
                      : 'border-border-subtle bg-surface-elevated text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full ring-1 ring-black/20"
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
        className="touch-target inline-flex shrink-0 items-center gap-1 rounded-xl border border-border-strong bg-surface-elevated px-3 text-xs font-bold text-text-muted hover:text-pitch hover:border-pitch transition-all focus-visible:ring-2 focus-visible:ring-pitch"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>+ Joukkue</span>
      </motion.button>
    </nav>
  );
};
