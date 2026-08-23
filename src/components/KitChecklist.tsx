import React, { useEffect, useState } from 'react';
import { Check, Shirt } from 'lucide-react';
import type { SportKitPlan } from '../lib/agents';
import { sportLabelFi } from '../lib/sport/sportMeta';

interface KitChecklistProps {
  plan: SportKitPlan;
  eventId?: string;
  compact?: boolean;
}

function kitStorageKey(eventId: string): string {
  return `pelipaiva_kit_${eventId}`;
}

function readPacked(eventId?: string): Record<string, boolean> {
  if (!eventId || typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(kitStorageKey(eventId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as Record<string, boolean>;
  } catch {
    return {};
  }
}

export const KitChecklist: React.FC<KitChecklistProps> = ({ plan, eventId, compact }) => {
  const [packed, setPacked] = useState<Record<string, boolean>>(() => readPacked(eventId));
  const items = compact ? plan.playerItems.filter((i) => i.required).slice(0, 5) : plan.playerItems;
  const kitLabel =
    plan.kitSet === 'ykkönen' ? 'Ykköspaita' : plan.kitSet === 'vieras' ? 'Vieraspaita' : 'Treenipaita';

  useEffect(() => {
    setPacked(readPacked(eventId));
  }, [eventId]);

  useEffect(() => {
    if (!eventId || typeof window === 'undefined') return;
    try {
      localStorage.setItem(kitStorageKey(eventId), JSON.stringify(packed));
    } catch {
      /* quota / private mode */
    }
  }, [eventId, packed]);

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-elevated p-3.5">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Shirt className="h-4 w-4 text-pitch" />
          <span>Kassi · {sportLabelFi(plan.sport)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-full border border-border-strong"
            style={{ background: plan.kitColors.primary }}
            title="Peliasun väri"
          />
          <span className="text-xs font-medium text-text-secondary">{kitLabel}</span>
        </div>
      </div>
      <p className="mb-2 text-xs text-text-secondary">
        {plan.footwearLabel}: {plan.footwearWhy}
      </p>
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const on = packed[item.id];
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setPacked((p) => ({ ...p, [item.id]: !p[item.id] }))}
                className="flex min-h-11 w-full items-center gap-2 rounded-md px-1 text-left"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border ${
                    on ? 'border-pitch bg-pitch text-text-inverse' : 'border-border-strong text-transparent'
                  }`}
                >
                  <Check className="h-3 w-3" />
                </span>
                <span className={`text-sm ${on ? 'text-text-muted line-through' : 'text-text-primary'}`}>
                  {item.label}
                </span>
                {item.weatherDriven && (
                  <span className="ml-auto text-[11px] font-medium uppercase tracking-wide text-radar">Sää</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
