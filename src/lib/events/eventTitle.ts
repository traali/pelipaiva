/**
 * The NLP parser fills unknown sides with the placeholders "Oma joukkue" and
 * "Vastustaja". They are parser sentinels, not team names, and must never be
 * shown to a family as if they were real teams.
 */
const HOME_PLACEHOLDER = 'oma joukkue';
const AWAY_PLACEHOLDER = 'vastustaja';

function clean(s: string | undefined): string {
  return (s || '').trim();
}

export function isPlaceholderTeam(name: string | undefined): boolean {
  const n = clean(name).toLowerCase();
  return n === HOME_PLACEHOLDER || n === AWAY_PLACEHOLDER;
}

/** Drop parser placeholders from a "Home vs Away" title; plain titles pass through. */
export function honestTitle(title: string | undefined): string {
  const t = clean(title);
  const m = /^(.*?)\s+vs\.?\s+(.*)$/i.exec(t);
  if (!m) return t;
  const home = clean(m[1]);
  const away = clean(m[2]);
  const homeKnown = !!home && !isPlaceholderTeam(home);
  const awayKnown = !!away && !isPlaceholderTeam(away);
  if (homeKnown && awayKnown) return t;
  if (homeKnown) return `${home} – vastustaja ei tiedossa`;
  if (awayKnown) return `Vastaan ${away}`;
  return 'Peli – joukkueet ei tiedossa';
}

/** Heading text for a game card: real teams, or an honest note when a side is unknown. */
export function matchHeading(event: { homeTeam?: string; awayTeam?: string; title?: string }): string {
  return honestTitle(`${clean(event.homeTeam) || 'Oma joukkue'} vs ${clean(event.awayTeam) || 'Vastustaja'}`);
}
