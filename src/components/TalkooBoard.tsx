import React from 'react';
import { ClipboardList } from 'lucide-react';
import type { TalkooBalance } from '../lib/agents';
import { formatFiTime } from '../lib/agents';

interface TalkooBoardProps {
  talkoo: TalkooBalance;
}

export const TalkooBoard: React.FC<TalkooBoardProps> = ({ talkoo }) => {
  if (talkoo.shifts.length === 0) return null;

  return (
    <section className="mb-4 rounded-lg border border-border-subtle bg-surface-elevated p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <ClipboardList className="h-4 w-4 text-whistle" />
        <h2 className="text-sm font-semibold text-text-primary">Talkoovahti</h2>
        {talkoo.overloadedParent && (
          <span className="rounded-sm bg-whistle/15 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-whistle">
            Kuorma
          </span>
        )}
      </div>
      <p className="mb-2 text-xs text-text-secondary">{talkoo.recommendation}</p>
      <ul className="flex flex-col gap-1">
        {talkoo.shifts.map((s) => (
          <li key={`${s.eventId}-${s.role}`} className="flex min-h-11 items-center gap-2 text-sm">
            <span className="w-14 font-tabular font-semibold text-text-primary">
              {formatFiTime(s.startTime)}
            </span>
            <span className="text-text-primary">{s.childName}</span>
            <span className="text-text-secondary">{s.roleLabel}</span>
            <span className="ml-auto truncate text-xs text-text-muted">{s.venueName}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};
