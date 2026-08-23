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
  // Group profiles by playerName
  const playerGroups = React.useMemo(() => {
    const map = new Map<string, PlayerProfile[]>();
    for (const p of profiles) {
      const name = p.playerName || 'Pelaaja';
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(p);
    }
    return Array.from(map.entries());
  }, [profiles]);

  return (
    <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {onOpenFamilyManage && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          transition={springTactile.snappy}
          onClick={onOpenFamilyManage}
          title="Hallitse perheen pelaajia ja joukkueita"
          className="touch-target inline-flex shrink-0 items-center gap-1.5 rounded-md bg-pitch px-3 text-xs font-semibold text-text-inverse"
        >
          <Users className="h-4 w-4" />
          <span>Perhe</span>
        </motion.button>
      )}

      <motion.button
        whileTap={{ scale: 0.95 }}
        transition={springTactile.snappy}
        onClick={() => onSelectProfile('all')}
        className={`touch-target inline-flex shrink-0 items-center rounded-md border px-3 text-xs font-semibold ${
          activeProfileId === 'all'
            ? 'border-pitch bg-surface-elevated text-pitch'
            : 'border-border-subtle bg-surface-elevated text-text-secondary'
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
                whileTap={{ scale: 0.95 }}
                transition={springTactile.snappy}
                onClick={() => onSelectProfile(`player:${playerName}`)}
                className={`touch-target inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-xs font-semibold ${
                  isPlayerActive
                    ? 'border-pitch bg-pitch text-text-inverse'
                    : 'border-border-subtle bg-surface-elevated text-text-secondary'
                }`}
              >
                <User className="w-3 h-3" />
                <span>{playerName} ({playerProfiles.length} lajia/tiimiä)</span>
              </motion.button>
            ) : null}

            {playerProfiles.map((p) => {
              const isSelected = activeProfileId === p.id;
              return (
                <motion.button
                  key={p.id}
                  whileTap={{ scale: 0.95 }}
                  transition={springTactile.snappy}
                  onClick={() => onSelectProfile(p.id)}
                  className={`touch-target inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-xs font-medium ${
                    isSelected
                      ? 'border-pitch bg-pitch text-text-inverse'
                      : 'border-border-subtle bg-surface-elevated text-text-secondary'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
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
        title="Lisää pelaaja tai joukkue"
        className="touch-target inline-flex shrink-0 items-center gap-1 rounded-md border border-border-strong bg-surface-elevated px-3 text-xs font-medium text-text-muted"
      >
        <Plus className="w-3 h-3" />
        <span>+ Joukkue</span>
      </motion.button>
    </div>
  );
};
