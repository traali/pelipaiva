import React from 'react';
import { ExternalLink, BarChart3 } from 'lucide-react';
import type { FederationMatchLinks } from '../lib/sport/federationLinks';

const SPORT_EMOJI: Record<FederationMatchLinks['sport'], string> = {
  football: '⚽',
  floorball: '🏑',
  basketball: '🏀',
  volleyball: '🏐',
};

interface MatchSourceLinksProps {
  links: FederationMatchLinks | null | undefined;
  /** Smaller variant for a game row inside a tournament list. */
  dense?: boolean;
  /** Light text for dark surfaces (live toast). */
  onDark?: boolean;
  className?: string;
}

/**
 * Primary: Arto's sport app at this exact match. Secondary, smaller:
 * the federation tulospalvelu match page. Both open in a new tab.
 * Renders nothing without a real TASO match_id.
 */
export const MatchSourceLinks: React.FC<MatchSourceLinksProps> = ({ links, dense = false, onDark = false, className = '' }) => {
  if (!links) return null;
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} data-testid="match-source-links">
      <a
        href={links.appUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        aria-label={`Avaa ottelu: ${links.appName} (uusi välilehti)`}
        className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-pitch/40 bg-pitch/15 font-bold text-pitch hover:bg-pitch/25 transition-colors focus-visible:ring-2 focus-visible:ring-pitch ${
          dense ? 'px-3 text-xs' : 'flex-1 sm:flex-none px-4 text-sm'
        }`}
      >
        {dense ? <BarChart3 className="w-4 h-4 shrink-0" /> : <span aria-hidden="true">{SPORT_EMOJI[links.sport]}</span>}
        <span className="whitespace-nowrap">{dense ? 'Ottelu' : 'Avaa ottelu'}</span>
        {!dense && <span className="whitespace-nowrap text-[11px] font-semibold opacity-80">{links.appName}</span>}
        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
      </a>
      <a
        href={links.federationUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Avaa tulospalvelussa (uusi välilehti)"
        title="Avaa tulospalvelussa"
        className={`inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl px-3 text-xs font-semibold underline-offset-2 hover:underline transition-colors focus-visible:ring-2 focus-visible:ring-pitch ${
          onDark ? 'text-slate-300 hover:text-white' : 'text-text-secondary hover:text-text-primary'
        }`}
      >
        <span className="whitespace-nowrap">Tulospalvelu</span>
        <ExternalLink className="w-3 h-3 shrink-0" />
      </a>
    </div>
  );
};
