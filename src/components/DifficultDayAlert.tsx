import React from 'react';
import { AlertTriangle, Car } from 'lucide-react';
import type { DifficultDayWarning } from '../lib/agents';

interface DifficultDayAlertProps {
  warnings: DifficultDayWarning[];
  onOpenLogistics: () => void;
}

export const DifficultDayAlert: React.FC<DifficultDayAlertProps> = ({
  warnings,
  onOpenLogistics
}) => {
  if (!warnings || warnings.length === 0) return null;

  const first = warnings[0]!;
  const isCritical = first.severity === 'critical';

  return (
    <div
      className={`mb-4 rounded-2xl border p-4 transition-all shadow-sm ${
        isCritical
          ? 'border-whistle/40 bg-whistle/10 text-text-primary ring-1 ring-whistle/20'
          : 'border-floodlight/40 bg-floodlight/10 text-text-primary ring-1 ring-floodlight/20'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold text-sm ${
              isCritical ? 'bg-whistle text-white' : 'bg-floodlight text-canvas'
            }`}
          >
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-text-secondary">
                AI Tilannevaroitus
              </span>
              <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-bold text-text-primary border border-border-subtle">
                {first.label}
              </span>
            </div>
            <h3 className="text-sm font-bold text-text-primary mt-0.5">
              {first.headline}
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenLogistics}
          className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-surface-elevated px-3 py-1.5 text-xs font-bold text-text-primary shadow-sm hover:bg-surface-elevated/80 border border-border-strong transition-all cursor-pointer"
        >
          <Car className="h-3.5 w-3.5 text-pitch" />
          <span>Kuskijako</span>
        </button>
      </div>

      <div className="mt-3 space-y-1.5 pl-1">
        {first.reasons.map((reason, idx) => (
          <p key={idx} className="text-xs text-text-secondary flex items-start gap-1.5">
            <span className="text-text-muted">•</span>
            <span>{reason}</span>
          </p>
        ))}
      </div>

      <div className="mt-3 pt-2.5 border-t border-border-subtle/40 flex items-center justify-between text-xs text-text-muted">
        <span className="font-medium text-text-primary">💡 {first.suggestedAction}</span>
      </div>
    </div>
  );
};
