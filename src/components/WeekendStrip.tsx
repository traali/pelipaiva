import React from 'react';
import type { WeekendDayStrip } from '../lib/agents';
import { SportGlyph } from './SportGlyph';

interface WeekendStripProps {
  days: WeekendDayStrip[];
  weekendLabel: string;
  onSelectEvent?: (eventId: string) => void;
}

export const WeekendStrip: React.FC<WeekendStripProps> = ({ days, weekendLabel, onSelectEvent }) => {
  const total = days.reduce((n, d) => n + d.events.length, 0);
  if (total === 0) return null;

  return (
    <section className="mb-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-text-primary">Viikonloppu</h2>
        <p className="text-xs text-text-muted">{weekendLabel}</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {days.map((day) => (
          <div key={day.date} className="rounded-lg border border-border-subtle bg-surface-elevated p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {day.label}
            </div>
            {day.events.length === 0 ? (
              <p className="text-xs text-text-muted">Ei pelejä</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {day.events.map((ev) => (
                  <li key={ev.eventId}>
                    <button
                      type="button"
                      onClick={() => onSelectEvent?.(ev.eventId)}
                      className="flex min-h-11 w-full items-center gap-2 rounded-md text-left"
                    >
                      <span
                        className="h-8 w-1 shrink-0 rounded-full"
                        style={{ background: ev.colorHex }}
                      />
                      <span className="w-11 shrink-0 font-tabular text-sm font-semibold text-text-primary">
                        {ev.time}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-text-primary">
                          {ev.childName}
                        </span>
                        <span className="block truncate text-xs text-text-muted">{ev.venueName}</span>
                      </span>
                      <SportGlyph sport={ev.sport} className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
