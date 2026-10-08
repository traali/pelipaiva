/**
 * Links from a TASO/Torneopal game to the exact match page:
 *   1. primary   — Arto's own sport app (football-stats, floorball-stats, …)
 *   2. secondary — the federation's own tulospalvelu match page
 *
 * Both take TASO's match_id. We only build a link when the event carries a
 * fixture id that came from the federation API (`${association}_${teamId}_${match_id}`).
 * User-made, ICS, MyClub/Nimenhuuto and WhatsApp events have no such id and get
 * no link. A guessed id would open the wrong game, so there is no fallback.
 */
import type { AssociationType, SportType } from '../../types/matchday';
import { shouldTryAssociationEndpoint } from '../api/torneopalClient';
import { parseAssociationUrl } from '../api/associationUrlParser';

export type FederationSport = 'football' | 'floorball' | 'basketball' | 'volleyball';

/** tulospalvelu SPA hosts. `/match/:id` calls getMatch({ match_id: id }). */
export const FEDERATION_MATCH_HOST: Record<FederationSport, string> = {
  football: 'https://tulospalvelu.palloliitto.fi',
  floorball: 'https://tulospalvelu.salibandy.fi',
  basketball: 'https://tulospalvelu.basket.fi',
  volleyball: 'https://tulospalvelu.lentopallo.fi',
};

/**
 * Live Cloudflare Pages hosts of the satellite apps (deploy-neighbors.yml
 * project names football-stats, floorball-stats, basketball-stats,
 * volleyball-stats). football-stats.pages.dev does not answer, and
 * basketball-stats.pages.dev / volleyball-stats.pages.dev are other people's apps.
 */
export const SATELLITE_APP_HOST: Record<FederationSport, string> = {
  football: 'https://football-stats-agk.pages.dev',
  floorball: 'https://floorball-stats.pages.dev',
  basketball: 'https://basketball-stats-byu.pages.dev',
  volleyball: 'https://volleyball-stats-7xq.pages.dev',
};

export const SATELLITE_APP_NAME: Record<FederationSport, string> = {
  football: 'Football Stats',
  floorball: 'Floorball Stats',
  basketball: 'Basketball Stats',
  volleyball: 'Volleyball Stats',
};

const SATELLITE_REPO_HOST: Record<string, string> = {
  'football-stats': SATELLITE_APP_HOST.football,
  'floorball-stats': SATELLITE_APP_HOST.floorball,
  'basketball-stats': SATELLITE_APP_HOST.basketball,
  'volleyball-stats': SATELLITE_APP_HOST.volleyball,
  ...SATELLITE_APP_HOST,
};

/**
 * Satellite app URL. The apps use hash routes: a path URL opens the home page
 * and the match is missed. `#/match/<match_id>` opens that exact game.
 */
export function liveSatelliteUrl(sport: string, matchId: string, query = '', embed = false): string {
  if (sport === 'parkkis') return 'https://parkkis.pages.dev/?embed=true';
  const host = SATELLITE_REPO_HOST[sport] || SATELLITE_APP_HOST.football;
  const raw = matchId.includes('_') ? matchId.split('_').pop() || matchId : matchId;
  const numeric = /^\d+$/.test(raw);
  const q = encodeURIComponent((query || raw).trim());
  const hash = numeric ? `#/match/${encodeURIComponent(raw)}` : `#/search?q=${q}`;
  const flag = embed ? (hash.includes('?') ? '&embed=true' : '?embed=true') : '';
  return `${host}/${hash}${flag}`;
}

export interface ParsedOfficialFixtureId {
  association: AssociationType;
  teamId: string;
  matchId: string;
}

/**
 * `${association}_${teamId}_${match_id}` — as built by torneopalClient.mapFixture.
 * Accepts the same id inside an event id (`fixture-${profileId}-${fixtureId}`).
 * Rejects the no-match_id fallback (`…_2026-10-08`), HTML row keys (`…_nro227`)
 * and cup seeds (`football-stats_…`).
 */
const FIXTURE_ID_RE = /(?:^|-)(palloliitto|salibandy|basket|torneopal)_([A-Za-z0-9]+)_([1-9]\d*)$/;

export function parseOfficialFixtureId(id: string | undefined | null): ParsedOfficialFixtureId | null {
  if (!id || typeof id !== 'string') return null;
  const m = FIXTURE_ID_RE.exec(id.trim());
  if (!m) return null;
  return { association: m[1] as AssociationType, teamId: m[2]!, matchId: m[3]! };
}

const ASSOCIATION_SPORT: Partial<Record<AssociationType, FederationSport>> = {
  palloliitto: 'football',
  salibandy: 'floorball',
  basket: 'basketball',
};

function isFederationSport(sport: SportType | string | undefined): sport is FederationSport {
  return sport === 'football' || sport === 'floorball' || sport === 'basketball' || sport === 'volleyball';
}

/**
 * Generic `torneopal` ids: torneopalClient asks a non-cup *.torneopal.fi host
 * first, and that host's match_id need not exist on the federation site. Only
 * link when the federation API (picked by sport) is what answered:
 * tulospalvelu.lentopallo.fi, lentopallo.torneopal.fi (its REST is not JSON,
 * so the client falls through to the federation API) or a cup subdomain
 * (skipped by the client). The profile URL must be for the same team.
 */
function torneopalSportFromSource(teamId: string, associationUrl: string | undefined): FederationSport | null {
  if (!associationUrl) return null;
  const parsed = parseAssociationUrl(associationUrl);
  if (!parsed || parsed.association !== 'torneopal' || parsed.teamId !== teamId) return null;
  if (!isFederationSport(parsed.sport)) return null;
  // Player pages carry no real team id.
  if (parsed.playerId) return null;
  if (!parsed.subdomain) return parsed.sport;
  if (parsed.subdomain === 'lentopallo') return parsed.sport === 'volleyball' ? 'volleyball' : null;
  return shouldTryAssociationEndpoint(parsed.subdomain) ? null : parsed.sport;
}

export interface MatchLinkSource {
  id?: string;
  sport?: SportType | string;
  officialFixtureId?: string;
}

export interface FederationMatchLinks {
  sport: FederationSport;
  matchId: string;
  /** Primary: Arto's sport app at this match. */
  appUrl: string;
  appName: string;
  /** Secondary: federation tulospalvelu match page. */
  federationUrl: string;
}

/**
 * Links for one TASO game, or null when there is no reliable match_id.
 * `associationUrl` is the profile's federation URL; needed only for generic
 * `torneopal` ids.
 */
export function federationMatchLinks(
  source: MatchLinkSource,
  opts: { associationUrl?: string } = {}
): FederationMatchLinks | null {
  const parsed =
    parseOfficialFixtureId(source.officialFixtureId) ||
    (source.id && source.id.startsWith('fixture-') ? parseOfficialFixtureId(source.id) : null);
  if (!parsed) return null;

  const sport =
    ASSOCIATION_SPORT[parsed.association] ??
    (parsed.association === 'torneopal'
      ? torneopalSportFromSource(parsed.teamId, opts.associationUrl)
      : null);
  if (!sport) return null;

  return {
    sport,
    matchId: parsed.matchId,
    appUrl: `${SATELLITE_APP_HOST[sport]}/#/match/${parsed.matchId}`,
    appName: SATELLITE_APP_NAME[sport],
    federationUrl: `${FEDERATION_MATCH_HOST[sport]}/match/${parsed.matchId}`,
  };
}
