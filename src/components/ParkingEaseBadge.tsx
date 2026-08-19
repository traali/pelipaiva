import React from 'react';
import { ParkingInfo } from '../types/matchday';
import { Car } from 'lucide-react';

interface ParkingProps {
  parking: ParkingInfo;
}

export const ParkingEaseBadge: React.FC<ParkingProps> = ({ parking }) => {
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
    : '🟢 Helppo pysäköidä';

  return (
    <div className="flex flex-col justify-between p-3.5 rounded-2xl bg-surface-elevated/70 border border-border-subtle">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <Car className="w-4 h-4 text-text-secondary" />
          <span>ParkkiSakko-indeksi</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
          {scoreLabel}
        </span>
      </div>
      <div className="text-xs font-medium text-text-primary truncate">{parking.lotName}</div>
      <div className="flex items-center justify-between text-[11px] text-text-secondary mt-1">
        <span className="truncate mr-2">{parking.feeZone}</span>
        <span className="font-tabular font-semibold text-text-primary shrink-0">
          {parking.walkingTimeMinutes} min kävely ({parking.walkingDistanceMeters}m)
        </span>
      </div>
    </div>
  );
};
