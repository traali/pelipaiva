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
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
      <motion.button
        whileTap={{ scale: 0.95 }}
        transition={springTactile.snappy}
        onClick={() => onSelectProfile('all')}
        className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap cursor-pointer transition-all border flex items-center gap-1.5 ${
          activeProfileId === 'all'
            ? 'bg-pitch text-text-inverse border-pitch shadow-sm shadow-pitch/20'
            : 'bg-surface-elevated text-text-secondary border-border-subtle hover:text-text-primary'
        }`}
      >
        <span>👨‍👩‍👧‍👦</span>
        <span>Koko perhe ({profiles.length} {profiles.length === 1 ? 'joukkue' : 'joukkuetta'})</span>
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
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all border ${
                  isPlayerActive
                    ? 'bg-pitch text-text-inverse border-pitch shadow-sm shadow-pitch/20'
                    : 'bg-surface-elevated text-text-secondary border-border-subtle hover:text-text-primary'
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-pitch text-text-inverse border-pitch shadow-sm shadow-pitch/20'
                      : 'bg-surface-elevated text-text-secondary border-border-subtle hover:text-text-primary'
                  }`}
                >
                  <span>{p.sport === 'football' ? '⚽' : p.sport === 'floorball' ? '🏑' : p.sport === 'basketball' ? '🏀' : '🏐'}</span>
                  <span>{hasMultipleTeams ? p.teamName : `${p.playerName} (${p.teamName})`}</span>
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
        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-surface-elevated/70 border border-border-strong text-text-muted hover:text-text-primary cursor-pointer shrink-0"
      >
        <Plus className="w-3 h-3" />
        <span>Lisää joukkue</span>
      </motion.button>
    </div>
  );
};
