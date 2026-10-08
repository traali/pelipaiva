import type {
  SportType,
  AssociationType,
  ParsedAssociationUrl,
} from "../../types/matchday";


export const SUBDOMAIN_SPORT_MAP: Record<string, SportType> = {
  // Volleyball (Lentopalloliitto)
  lentopallo: 'volleyball',
  lentis: 'volleyball',
  volley: 'volleyball',
  volleyball: 'volleyball',

  // Floorball (Salibandyliitto)
  salibandy: 'floorball',
  sb: 'floorball',
  floorball: 'floorball',

  // Football (Palloliitto)
  spl: 'football',
  palloliitto: 'football',
  jalkapallo: 'football',
  futis: 'football',
  football: 'football',
  soccer: 'football',

  // Futsal
  futsal: 'futsal',

  // Ice Hockey
  jaakiekko: 'icehockey',
  kiekko: 'icehockey',
  hockey: 'icehockey',
  icehockey: 'icehockey',

  // Basketball
  koripallo: 'basketball',
  basket: 'basketball',
  basketball: 'basketball'
};

/**
 * Normalizes a user-entered URL string: trims whitespace, strips angle brackets,
 * and ensures a valid http/https protocol prefix so WHATWG URL parser succeeds.
 */
export function normalizeUrlString(rawUrl: string): string | null {
  if (typeof rawUrl !== 'string') return null;

  let cleaned = rawUrl.trim();
  if (!cleaned) return null;

  // Remove surrounding quotes or angle brackets: <https://...>
  cleaned = cleaned.replace(/^<|>$/g, '').replace(/^['"]|['"]$/g, '');
  cleaned = cleaned.trim();
  if (!cleaned) return null;

  // Handle protocol-relative URLs
  if (cleaned.startsWith('//')) {
    cleaned = 'https:' + cleaned;
  } else if (!/^https?:\/\//i.test(cleaned)) {
    // If no protocol specified, default to https://
    cleaned = 'https://' + cleaned;
  }

  return cleaned;
}

/**
 * Infers SportType from a Torneopal subdomain string.
 */
export function inferSportFromSubdomain(subdomain: string): SportType {
  const normalized = subdomain.toLowerCase().trim();
  if (SUBDOMAIN_SPORT_MAP[normalized]) {
    return SUBDOMAIN_SPORT_MAP[normalized]!;
  }
  if (normalized.includes('lentopallo') || normalized.includes('volley') || normalized.includes('lentis')) {
    return 'volleyball';
  }
  if (normalized.includes('futsal')) {
    return 'futsal';
  }
  if (
    normalized.includes('salibandy') ||
    normalized.includes('floorball') ||
    normalized.startsWith('sb') ||
    normalized.includes('memorial') ||
    normalized.includes('kwmemorial')
  ) {
    return 'floorball';
  }
  if (
    normalized.includes('kori') ||
    normalized.includes('basket') ||
    normalized.includes('espooliikkuu') ||
    normalized.includes('esli')
  ) {
    return 'basketball';
  }
  if (normalized.includes('kiekko') || normalized.includes('hockey') || normalized.includes('jaakiekko')) {
    return 'icehockey';
  }
  if (normalized.includes('futis') || normalized.includes('spl') || normalized.includes('jalkapallo') || normalized.includes('football')) {
    return 'football';
  }
  return 'other';
}

/**
 * Main URL parser for Finnish sports associations.
 * Parses Palloliitto, Salibandyliitto, Basket.fi, and Torneopal URLs.
 * Returns ParsedAssociationUrl if valid, or null if not recognized / malformed.
 */
export function parseAssociationUrl(rawUrl: string): ParsedAssociationUrl | null {
  const normalized = normalizeUrlString(rawUrl);
  if (!normalized) return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(normalized);
  } catch {
    return null;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const pathname = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;

  // 0. Custom tournament SPAs (Torneopal-backed)
  if (hostname === 'espooliikkuutournament.fi' || hostname === 'www.espooliikkuutournament.fi') {
    const teamMatch = pathname.match(/^\/team\/(\d+)(?:\/.*)?$/i);
    if (teamMatch && teamMatch[1]) {
      const teamId = teamMatch[1]!;
      return {
        sport: 'basketball',
        association: 'basket',
        teamId,
        seasonId: searchParams.get('turnaus') || 'esli2026',
        leagueId: searchParams.get('sarja') || searchParams.get('category') || undefined,
        canonicalUrl: `https://espooliikkuutournament.fi/team/${teamId}`
      };
    }
    // A match URL names no team. Fail the parse rather than pick a team.
    return null;
  }

  // 1. ⚽ Football: Palloliitto Tulospalvelu (tulospalvelu.palloliitto.fi)
  if (hostname === 'tulospalvelu.palloliitto.fi' || hostname === 'www.tulospalvelu.palloliitto.fi') {
    const teamMatch = pathname.match(/^\/team\/(\d+)(?:\/([a-zA-Z0-9_-]+))?(?:\/.*)?$/i);
    if (teamMatch && teamMatch[1]) {
      const teamId = teamMatch[1]!;
      const tab = searchParams.get('tab') || (teamMatch[2] ? String(teamMatch[2]) : undefined);
      const seasonId = searchParams.get('season') || searchParams.get('season_id') || undefined;
      const leagueId = searchParams.get('category') || searchParams.get('category_id') || searchParams.get('league') || searchParams.get('league_id') || searchParams.get('series') || undefined;

      const q = new URLSearchParams();
      if (seasonId) q.set('season', seasonId);
      if (leagueId) q.set('category', leagueId);
      const query = q.toString();

      return {
        sport: 'football',
        association: 'palloliitto',
        teamId,
        tab,
        seasonId,
        leagueId,
        canonicalUrl: `https://tulospalvelu.palloliitto.fi/team/${teamId}${query ? `?${query}` : ''}`
      };
    }
    return null;
  }

  // 2. 🏑 Floorball: Salibandyliitto Tulospalvelu (tulospalvelu.salibandy.fi)
  if (hostname === 'tulospalvelu.salibandy.fi' || hostname === 'www.tulospalvelu.salibandy.fi') {
    const teamMatch = pathname.match(/^\/team\/(\d+)(?:\/([a-zA-Z0-9_-]+))?(?:\/.*)?$/i);
    if (teamMatch && teamMatch[1]) {
      const teamId = teamMatch[1]!;
      const tab = searchParams.get('tab') || (teamMatch[2] ? String(teamMatch[2]) : undefined);
      const seasonId = searchParams.get('season') || searchParams.get('season_id') || undefined;
      const leagueId = searchParams.get('series') || searchParams.get('series_id') || searchParams.get('category') || searchParams.get('category_id') || searchParams.get('league') || searchParams.get('league_id') || searchParams.get('sarja') || undefined;

      return {
        sport: 'floorball',
        association: 'salibandy',
        teamId,
        tab,
        seasonId,
        leagueId,
        canonicalUrl: `https://tulospalvelu.salibandy.fi/team/${teamId}`
      };
    }
    return null;
  }

  // 3. 🏀 Basketball: Basket.fi / Koripalloliitto (basket.fi / www.basket.fi / tulospalvelu.basket.fi)
  if (
    hostname === 'basket.fi' ||
    hostname === 'www.basket.fi' ||
    hostname === 'tulospalvelu.basket.fi' ||
    hostname === 'www.tulospalvelu.basket.fi'
  ) {
    // 3a. Modern tulospalvelu path e.g. /team/5756346 or /team/5756346/info
    const teamPathMatch = pathname.match(/^\/team\/(\d+)(?:\/([a-zA-Z0-9_-]+))?(?:\/.*)?$/i);
    if (teamPathMatch && teamPathMatch[1]) {
      const teamId = teamPathMatch[1]!;
      const tab = searchParams.get('tab') || (teamPathMatch[2] ? String(teamPathMatch[2]) : undefined);
      const seasonId = searchParams.get('season') || searchParams.get('season_id') || undefined;
      const leagueId = searchParams.get('category') || searchParams.get('category_id') || searchParams.get('league') || searchParams.get('league_id') || undefined;

      return {
        sport: 'basketball',
        association: 'basket',
        teamId,
        tab,
        seasonId,
        leagueId,
        canonicalUrl: `https://tulospalvelu.basket.fi/team/${teamId}`
      };
    }

    // 3b. Classic basket.fi path /basket/sarjat/joukkue/?team_id=...
    const isBasketPath = /^\/(?:basket\/)?(?:sarjat\/)?joukkue(?:\/.*)?$/i.test(pathname);
    if (isBasketPath) {
      let teamId: string | null =
        searchParams.get('team_id') ||
        searchParams.get('teamId') ||
        searchParams.get('joukkue_id');

      if (!teamId) {
        const pathMatch = pathname.match(/^\/(?:basket\/)?(?:sarjat\/)?joukkue\/(\d+)/i);
        if (pathMatch && pathMatch[1]) {
          teamId = pathMatch[1]!;
        }
      }

      if (teamId && /^\d+$/.test(teamId)) {
        const seasonId = searchParams.get('season_id') || searchParams.get('season') || undefined;
        const leagueId = searchParams.get('league_id') || searchParams.get('sarja_id') || searchParams.get('league') || searchParams.get('category') || undefined;

        return {
          sport: 'basketball',
          association: 'basket',
          teamId,
          seasonId,
          leagueId,
          canonicalUrl: `https://basket.fi/basket/sarjat/joukkue/?team_id=${teamId}`
        };
      }
    }
    return null;
  }

  // 4. 🏐 Volleyball: Lentopalloliitto Tulospalvelu (tulospalvelu.lentopallo.fi)
  if (hostname === 'tulospalvelu.lentopallo.fi' || hostname === 'www.tulospalvelu.lentopallo.fi') {
    const teamMatch = pathname.match(/^\/team\/(\d+)(?:\/([a-zA-Z0-9_-]+))?(?:\/.*)?$/i);
    if (teamMatch && teamMatch[1]) {
      const teamId = teamMatch[1]!;
      const tab = searchParams.get('tab') || (teamMatch[2] ? String(teamMatch[2]) : undefined);
      const seasonId = searchParams.get('season') || searchParams.get('season_id') || undefined;
      const leagueId =
        searchParams.get('series') ||
        searchParams.get('series_id') ||
        searchParams.get('category') ||
        searchParams.get('category_id') ||
        searchParams.get('league') ||
        searchParams.get('league_id') ||
        searchParams.get('sarja') ||
        undefined;

      return {
        sport: 'volleyball',
        association: 'torneopal',
        teamId,
        tab,
        seasonId,
        leagueId,
        canonicalUrl: `https://tulospalvelu.lentopallo.fi/team/${teamId}`
      };
    }
    return null;
  }

  // 5. 🏐 Volleyball & Generic Torneopal (*.torneopal.fi)
  if (hostname.endsWith('.torneopal.fi')) {
    const rawSubdomain = hostname.replace(/\.torneopal\.fi$/i, '').replace(/^www\./i, '');
    const subdomain = rawSubdomain || 'taso';

    // 4a. Torneopal player page (/taso/pelaaja.php?pelaaja=…): the URL names a
    // player, not a team. Fail the parse rather than invent a team or a name.
    if (/^\/(?:taso\/)?(?:pelaaja\.php|pelaaja|player)(?:\/.*)?$/i.test(pathname)) {
      return null;
    }

    const isTorneopalPath = /^\/(?:taso\/)?(?:joukkue\.php|joukkue)(?:\/.*)?$/i.test(pathname);
    if (isTorneopalPath) {
      let teamId: string | null =
        searchParams.get('joukkue') ||
        searchParams.get('team_id') ||
        searchParams.get('team') ||
        searchParams.get('id');

      if (!teamId) {
        const pathMatch = pathname.match(/^\/(?:taso\/)?joukkue\/(\d+)/i);
        if (pathMatch && pathMatch[1]) {
          teamId = pathMatch[1]!;
        }
      }

      if (teamId && /^\d+$/.test(teamId)) {
        const leagueId = searchParams.get('sarja') || searchParams.get('sarja_id') || undefined;
        const seasonId = searchParams.get('turnaus') || searchParams.get('kausi') || searchParams.get('season') || undefined;
        const sport = inferSportFromSubdomain(subdomain);
        const qs = new URLSearchParams({ joukkue: teamId });
        if (seasonId) qs.set('turnaus', seasonId);
        if (leagueId) qs.set('sarja', leagueId);

        return {
          sport,
          association: 'torneopal',
          teamId,
          subdomain,
          leagueId,
          seasonId,
          canonicalUrl: `https://${subdomain}.torneopal.fi/taso/joukkue.php?${qs.toString()}`
        };
      }
    }
    return null;
  }

  return null;
}

/**
 * Returns true if the given URL is a valid sports association team URL.
 */
export function isAssociationUrl(rawUrl: string): boolean {
  return parseAssociationUrl(rawUrl) !== null;
}

/**
 * Returns the human-readable display name of a Finnish sports association.
 */
export function getAssociationName(association: AssociationType): string {
  switch (association) {
    case 'palloliitto':
      return 'Palloliitto (Tulospalvelu)';
    case 'salibandy':
      return 'Salibandyliitto (Tulospalvelu)';
    case 'basket':
      return 'Koripalloliitto (Basket.fi)';
    case 'torneopal':
      return 'Torneopal Taso';
    default:
      return 'Urheiluliitto';
  }
}

/**
 * Returns a short label for the association.
 */
export function getAssociationShortName(association: AssociationType): string {
  switch (association) {
    case 'palloliitto':
      return 'Palloliitto';
    case 'salibandy':
      return 'Salibandyliitto';
    case 'basket':
      return 'Basket.fi';
    case 'torneopal':
      return 'Torneopal';
    default:
      return 'Liitto';
  }
}

/**
 * Returns the human-readable Finnish name of a sport.
 */
export function getSportName(sport: SportType): string {
  switch (sport) {
    case 'football':
      return 'Jalkapallo';
    case 'floorball':
      return 'Salibandy';
    case 'basketball':
      return 'Koripallo';
    case 'volleyball':
      return 'Lentopallo';
    case 'icehockey':
      return 'Jääkiekko';
    case 'futsal':
      return 'Futsal';
    case 'training':
      return 'Harjoitukset';
    default:
      return 'Urheilu';
  }
}

/**
 * Formats a canonical team page URL given the association, teamId, and optional subdomain.
 */
export function formatCanonicalTeamUrl(
  association: AssociationType,
  teamId: string,
  subdomain?: string
): string {
  const cleanId = String(teamId).trim();
  switch (association) {
    case 'palloliitto':
      return `https://tulospalvelu.palloliitto.fi/team/${cleanId}`;
    case 'salibandy':
      return `https://tulospalvelu.salibandy.fi/team/${cleanId}`;
    case 'basket':
      return `https://basket.fi/basket/sarjat/joukkue/?team_id=${cleanId}`;
    case 'torneopal': {
      const sub = (subdomain || 'lentopallo').toLowerCase().trim();
      return `https://${sub}.torneopal.fi/taso/joukkue.php?joukkue=${cleanId}`;
    }
    default:
      return '';
  }
}

/**
 * Helper to extract only the teamId from a raw association URL.
 */
export function extractTeamIdFromUrl(rawUrl: string): string | null {
  const parsed = parseAssociationUrl(rawUrl);
  return parsed ? parsed.teamId : null;
}

/**
 * Helper to extract only the AssociationType from a raw association URL.
 */
export function getAssociationFromUrl(rawUrl: string): AssociationType | null {
  const parsed = parseAssociationUrl(rawUrl);
  return parsed ? parsed.association : null;
}


/**
 * Detects association federation type from raw URL string.
 */
export function detectAssociationType(rawUrl: string): AssociationType | null {
  const parsed = parseAssociationUrl(rawUrl);
  return parsed ? parsed.association : null;
}

/**
 * Returns canonical normalized URL for an association team link.
 */
export function normalizeAssociationUrl(rawUrl: string): string | null {
  const parsed = parseAssociationUrl(rawUrl);
  return parsed ? parsed.canonicalUrl : null;
}


/**
 * Calculates Finnish timezone offset (+02:00 EET / +03:00 EEST) for a given Date.
 * Finland observes DST from last Sunday of March to last Sunday of October.
 */
export function getFinnishTimezoneOffset(date: Date): string {
  const year = date.getUTCFullYear();

  // Last Sunday in March
  const marchLastDay = new Date(Date.UTC(year, 2, 31));
  const marchLastSunday = new Date(Date.UTC(year, 2, 31 - marchLastDay.getUTCDay(), 1, 0, 0));

  // Last Sunday in October
  const octLastDay = new Date(Date.UTC(year, 9, 31));
  const octLastSunday = new Date(Date.UTC(year, 9, 31 - octLastDay.getUTCDay(), 1, 0, 0));

  const time = date.getTime();
  if (time >= marchLastSunday.getTime() && time < octLastSunday.getTime()) {
    return '+03:00'; // EEST
  }
  return '+02:00'; // EET
}

/** Returned when a date or kickoff time is missing or invalid. Callers skip it. */
/**
 * "la 24.05.2026" + "15:00" -> "2026-05-24T15:00:00+03:00" (Helsinki).
 * A missing time can also sit in the date cell ("24.05.2026 klo 15.00").
 * Missing or invalid date/time returns null (parse failure, no event): no
 * guessed noon, no clamped month, no "now", no 1970 placeholder.
 */
export function parseFinnishDateTime(dateStr: string, timeStr: string = ''): string | null {
  const cleanDate = (dateStr || '').replace(/^[a-zA-ZåäöÅÄÖ]{2,3}\s+/i, '').trim();
  const dateParts = cleanDate.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!dateParts) return null;

  const day = parseInt(dateParts[1]!, 10);
  const month = parseInt(dateParts[2]!, 10);
  const year = parseInt(dateParts[3]!, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;

  const afterDate = cleanDate.slice((dateParts.index ?? 0) + dateParts[0].length);
  // The time cell first; if it holds no time, a time printed in the date cell.
  const timeRe = /(\d{1,2})[:.](\d{2})/;
  const timeParts =
    (timeStr || '').replace(/klo\s*/i, '').match(timeRe) || afterDate.replace(/klo\s*/i, '').match(timeRe);
  if (!timeParts) return null;
  const hours = parseInt(timeParts[1]!, 10);
  const minutes = parseInt(timeParts[2]!, 10);
  if (hours > 23 || minutes > 59) return null;

  const tempUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  if (isNaN(tempUtc.getTime()) || tempUtc.getUTCDate() !== day) return null;
  const offset = getFinnishTimezoneOffset(tempUtc);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00${offset}`;
}
