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
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
      <motion.button
        whileTap={{ scale: 0.95 }}
        transition={springTactile.snappy}
        onClick={() => onSelectProfile('all')}
        className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all border ${
          activeProfileId === 'all'
            ? 'bg-pitch text-text-inverse border-pitch shadow-sm shadow-pitch/20'
            : 'bg-surface-elevated text-text-secondary border-border-subtle hover:text-text-primary'
        }`}
      >
        Kaikki pelit
      </motion.button>

      {profiles.map((p) => {
        const isSelected = activeProfileId === p.id;
        return (
          <motion.button
            key={p.id}
            whileTap={{ scale: 0.95 }}
            transition={springTactile.snappy}
            onClick={() => onSelectProfile(p.id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap cursor-pointer transition-all border ${
              isSelected
                ? 'bg-pitch text-text-inverse border-pitch shadow-sm shadow-pitch/20'
                : 'bg-surface-elevated text-text-secondary border-border-subtle hover:text-text-primary'
            }`}
          >
            <User className="w-3 h-3" />
            <span>{p.playerName} ({p.teamName})</span>
          </motion.button>
        );
      })}

      <motion.button
        whileTap={{ scale: 0.95 }}
        transition={springTactile.snappy}
        onClick={onAddProfile}
        title="Lisää pelaaja tai kalenterisyöte"
        className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-surface-elevated/70 border border-border-strong text-text-muted hover:text-text-primary cursor-pointer"
      >
        <Plus className="w-3 h-3" />
        <span>Lisää joukkue</span>
      </motion.button>
    </div>
  );
};
