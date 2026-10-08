import React from 'react';
import type { VenueInfo } from '../types/matchday';
import { parkkisVenueUrl } from '../lib/parking/parkkisLink';

/**
 * One honest parking entry: Pelipäivä has no parking facts of its own,
 * so it opens Arto's Parkkis app at the venue. No venue pin, no link.
 */
export const ParkkisLink: React.FC<{ venue: VenueInfo | undefined; className?: string }> = ({ venue, className }) => {
  const href = parkkisVenueUrl(venue);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="parkkis-link"
      aria-label={`Pysäköinti: avaa Parkkis kohteessa ${venue?.name || 'kenttä'}`}
      className={
        className ||
        'inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border-subtle bg-surface-elevated px-3 text-xs font-bold text-text-primary hover:border-pitch transition-all'
      }
    >
      <span aria-hidden="true">🅿️</span>
      <span>Pysäköinti</span>
      <span className="text-[10px] font-semibold text-text-muted">Parkkis</span>
    </a>
  );
};
