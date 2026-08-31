import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ParkingInfo } from '../types/matchday';
import { Car, ChevronRight } from 'lucide-react';
import { springTactile } from '../lib/motion/springs';
import { ParkingDetailModal } from './ParkingDetailModal';

interface ParkingProps {
  parking: ParkingInfo;
  venueName?: string;
  compact?: boolean;
}

export const ParkingEaseBadge: React.FC<ParkingProps> = ({ parking, venueName = 'Kenttä', compact = false }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isTight = parking.easeScore === 'tight';
  const isModerate = parking.easeScore === 'moderate';

  const statusColor = isTight
    ? 'text-stoppage bg-stoppage/10 border-stoppage/30'
    : isModerate
    ? 'text-whistle bg-whistle/10 border-whistle/30'
    : 'text-pitch bg-pitch/10 border-pitch/30';

  const scoreLabel = isTight
    ? '🔴 Ahdas parkki'
    : isModerate
    ? '🟡 Kohtalainen'
    : '🟢 Helppo parkki';

  if (compact) {
    return (
      <>
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          whileHover={{ scale: 1.01 }}
          transition={springTactile.snappy}
          onClick={() => setIsModalOpen(true)}
          className="touch-target min-h-[44px] w-full text-left px-3 py-2 rounded-xl bg-surface-elevated/40 border border-border-subtle hover:border-pitch/40 text-xs text-text-secondary hover:text-text-primary flex items-center justify-between gap-2 cursor-pointer transition-colors group"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Car className="w-3.5 h-3.5 text-text-muted shrink-0" />
            <span className="truncate text-xs font-medium">Parkki: {parking.lotName}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusColor}`}>
              {scoreLabel}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-pitch transition-colors" />
          </div>
        </motion.button>

        {/* Interactive Parking Map & Guide Modal */}
        <ParkingDetailModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          parking={parking}
          venueName={venueName}
        />
      </>
    );
  }

  return (
    <>
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        whileHover={{ scale: 1.01 }}
        transition={springTactile.snappy}
        onClick={() => setIsModalOpen(true)}
        className="w-full text-left flex flex-col justify-between p-3.5 rounded-2xl bg-surface-elevated/70 border border-border-subtle hover:border-pitch/40 cursor-pointer transition-all group"
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
            <Car className="w-4 h-4 text-pitch" />
            <span>Parkki</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
              {scoreLabel}
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-text-muted group-hover:text-pitch transition-colors" />
          </div>
        </div>

        <div className="text-xs font-medium text-text-primary truncate">{parking.lotName}</div>
        <div className="flex items-center justify-between text-[11px] text-text-secondary mt-1">
          <span className="truncate mr-2">{parking.feeZone}</span>
          <span className="font-tabular font-semibold text-text-primary shrink-0">
            {parking.walkingTimeMinutes} min kävely ({parking.walkingDistanceMeters}m)
          </span>
        </div>
      </motion.button>

      {/* Interactive Parking Map & Guide Modal */}
      <ParkingDetailModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        parking={parking}
        venueName={venueName}
      />
    </>
  );
};
