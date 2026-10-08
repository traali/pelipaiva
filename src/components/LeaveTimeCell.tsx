import React from 'react';
import type { TransitPlan } from '../types/matchday';

interface LeaveTimeCellProps {
  departureTime: string;
  countdownMinutes: number;
  hasDepartureTime: boolean;
  transitPlan: TransitPlan;
  transitEmoji: string;
  isLive: boolean;
  onOpenHomeModal?: () => void;
  onOpenVenueModal?: () => void;
  size?: 'lg' | 'xl';
}

/** The "Lähde" cell. Without a home or a venue pin there is no leave time to show. */
export const LeaveTimeCell: React.FC<LeaveTimeCellProps> = ({
  departureTime,
  countdownMinutes,
  hasDepartureTime,
  transitPlan,
  transitEmoji,
  isLive,
  onOpenHomeModal,
  onOpenVenueModal,
  size = 'lg'
}) => {
  const timeClass =
    size === 'xl'
      ? 'font-tabular text-xl sm:text-2xl font-black text-floodlight mt-0.5'
      : 'font-tabular text-lg font-black text-floodlight mt-0.5';

  if (hasDepartureTime) {
    return (
      <div className="flex flex-col items-center" data-testid="leave-time">
        <span className="text-[10px] font-bold uppercase tracking-wider text-floodlight flex items-center gap-1">
          {/Lähde$/.test(transitEmoji) ? transitEmoji : `${transitEmoji} Lähde`}
        </span>
        <span className={timeClass}>{departureTime}</span>
        <span className="text-[10px] text-text-muted mt-0.5">
          {countdownMinutes > 0 ? `${countdownMinutes} min` : isLive ? 'Käynnissä' : 'Menty'}
        </span>
      </div>
    );
  }

  if (transitPlan.needsHome) {
    return (
      <button
        type="button"
        onClick={onOpenHomeModal}
        disabled={!onOpenHomeModal}
        data-testid="add-home-prompt"
        className="touch-target min-h-[44px] flex flex-col items-center justify-center rounded-lg px-1 text-center cursor-pointer hover:bg-floodlight/10 active:scale-95"
      >
        <span className="text-[10px] font-bold uppercase tracking-wider text-floodlight">🏠 Lähde</span>
        <span className="text-[11px] font-bold leading-tight text-text-primary mt-0.5">
          Lisää kotiosoite, niin näet lähtöajan
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenVenueModal}
      disabled={!onOpenVenueModal}
      className="touch-target min-h-[44px] flex flex-col items-center justify-center rounded-lg px-1 text-center cursor-pointer hover:bg-whistle/10 active:scale-95"
    >
      <span className="text-[10px] font-bold uppercase tracking-wider text-whistle">📍 Lähde</span>
      <span className={timeClass}>—</span>
      <span className="text-[10px] text-text-muted">Kentän sijainti puuttuu</span>
    </button>
  );
};
