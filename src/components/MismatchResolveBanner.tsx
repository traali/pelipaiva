import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { MatchdayEvent } from '../types/matchday';

export type MismatchDecision = 'use_official' | 'keep_calendar' | 'unlink' | 'dismiss';

interface MismatchResolveBannerProps {
  event: MatchdayEvent;
  conflictWarning?: string;
  resolving?: boolean;
  onResolve?: (eventId: string, decision: MismatchDecision) => void;
  onDismissConflict?: () => void;
}

export const MismatchResolveBanner: React.FC<MismatchResolveBannerProps> = ({
  event,
  conflictWarning,
  resolving = false,
  onResolve,
  onDismissConflict
}) => {
  const flags = event.mismatchFlags;
  const hasMismatch = Boolean(flags && (flags.timeMismatch || flags.venueMismatch));
  if (!hasMismatch && !conflictWarning) return null;

  const mismatchText = flags?.timeMismatch
    ? `Aikataulu eroaa: kalenteri ${flags.calendarStartTime || '—'} → liitto ${flags.officialStartTime || '—'}`
    : flags?.venueMismatch
      ? `Kenttä eroaa: ${flags.calendarVenueName || 'kalenteri'} → ${flags.officialVenueName || 'liitto'}`
      : null;

  return (
    <div className="mb-3 rounded-2xl border border-whistle/35 bg-whistle/10 p-3 flex flex-col gap-2.5">
      {conflictWarning && (
        <div className="flex items-start gap-2 text-whistle">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-xs font-semibold leading-snug flex-1 min-w-0 break-words">
            {conflictWarning}
          </p>
          {onDismissConflict && (
            <button
              type="button"
              onClick={onDismissConflict}
              className="p-1.5 rounded-lg text-whistle/70 hover:text-whistle hover:bg-whistle/15 cursor-pointer"
              aria-label="Piilota päällekkäisyysvaroitus"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {hasMismatch && mismatchText && (
        <>
          {conflictWarning && <div className="h-px bg-whistle/20" />}
          <div className="flex items-start gap-2 text-whistle">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-xs font-semibold leading-snug flex-1 min-w-0 break-words">
              {mismatchText}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              disabled={resolving}
              onClick={() => onResolve?.(event.id, 'use_official')}
              className="min-h-[40px] px-3 rounded-xl bg-pitch text-text-inverse text-[11px] font-bold hover:brightness-110 disabled:opacity-50 cursor-pointer"
            >
              {resolving ? 'Tallennetaan…' : 'Päivitä liiton tietoon'}
            </button>
            <button
              type="button"
              disabled={resolving}
              onClick={() => onResolve?.(event.id, 'keep_calendar')}
              className="min-h-[40px] px-3 rounded-xl bg-surface-elevated text-text-secondary border border-border-subtle text-[11px] font-semibold hover:text-text-primary disabled:opacity-50 cursor-pointer"
            >
              Säilytä oma
            </button>
            <button
              type="button"
              disabled={resolving}
              onClick={() => onResolve?.(event.id, 'dismiss')}
              className="min-h-[40px] px-3 rounded-xl text-text-muted text-[11px] font-semibold hover:text-text-primary cursor-pointer"
            >
              Piilota
            </button>
          </div>
        </>
      )}
    </div>
  );
};
