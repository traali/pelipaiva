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
        <h2 className="text-sm font-bold text-text-primary">Viikonloppu</h2>
        <p className="text-xs font-medium text-text-muted">{weekendLabel}</p>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {days.map((day) => {
          const isPast = day.isPast;
          const isToday = day.isToday;

          return (
            <div
              key={day.date}
              className={`rounded-2xl border p-3.5 transition-all ${
                isToday
                  ? 'border-pitch/50 bg-surface-elevated shadow-card ring-1 ring-pitch/20'
                  : isPast
                    ? 'border-border-subtle/50 bg-surface-elevated/40 opacity-75'
                    : 'border-border-subtle bg-surface-elevated'
              }`}
            >
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-text-primary">
                  {day.label}
                </span>
                {isToday && (
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-pitch text-text-inverse">
                    Tänään
                  </span>
                )}
                {isPast && (
                  <span className="text-[10px] font-medium text-text-muted">
                    Menneet
                  </span>
                )}
              </div>

              {day.events.length === 0 ? (
                <p className="text-xs text-text-muted py-2">Ei pelejä</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {day.events.map((ev) => (
                    <li key={ev.eventId}>
                      <button
                        type="button"
                        onClick={() => onSelectEvent?.(ev.eventId)}
                        className={`flex min-h-[44px] w-full items-center gap-2 rounded-xl px-1.5 py-1 text-left transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-pitch ${
                          ev.isPast ? 'opacity-60 text-text-muted' : 'text-text-primary'
                        }`}
                      >
                        <span
                          className="h-8 w-1 shrink-0 rounded-full"
                          style={{ background: ev.colorHex }}
                        />
                        <span className="w-12 shrink-0 font-tabular text-xs font-bold">
                          {ev.time}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold">
                            {ev.childName}
                          </span>
                          <span className="block truncate text-[11px] text-text-muted">
                            {ev.venueName}
                          </span>
                        </span>
                        <SportGlyph sport={ev.sport} className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
