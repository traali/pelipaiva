import React from 'react';
import { Trophy } from 'lucide-react';
import type { TournamentBlock } from '../lib/agents';
import { formatFiTime } from '../lib/agents';

interface TournamentWeekendPanelProps {
  blocks: TournamentBlock[];
}

export const TournamentWeekendPanel: React.FC<TournamentWeekendPanelProps> = ({ blocks }) => {
  if (blocks.length === 0) return null;

  return (
    <section className="mb-4 rounded-lg border border-border-subtle bg-surface-elevated p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-floodlight" />
        <h2 className="text-sm font-semibold text-text-primary">Turnauspäivä</h2>
      </div>
      <ul className="flex flex-col gap-3">
        {blocks.map((b) => (
          <li key={b.id}>
            <div className="text-sm font-semibold text-text-primary">
              {b.childName} · {b.name}
            </div>
            <div className="mt-0.5 text-xs text-text-secondary">
              {b.matchCount} peliä · {formatFiTime(b.firstKickoff)}–{formatFiTime(b.lastEnd)} ·{' '}
              {b.venueName}
            </div>
            <div className="mt-1 font-tabular text-sm font-semibold text-floodlight">
              Lähde klo {b.leaveBy}
            </div>
            <p className="mt-1 text-xs text-text-muted">{b.packingNote}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};
