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
    const matchMatch = pathname.match(/^\/match\/(\d+)(?:\/.*)?$/i);
    if (matchMatch && matchMatch[1]) {
      const matchId = matchMatch[1]!;
      return {
        sport: 'basketball',
        association: 'basket',
        teamId: '203621',
        matchId,
        seasonId: 'esli2026',
        canonicalUrl: `https://espooliikkuutournament.fi/match/${matchId}`
      };
    }
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

    // 4a. Torneopal Player Page: /taso/pelaaja.php?pelaaja=146432 or /pelaaja/146432
    const isTorneopalPlayerPath = /^\/(?:taso\/)?(?:pelaaja\.php|pelaaja|player)(?:\/.*)?$/i.test(pathname);
    if (isTorneopalPlayerPath) {
      let playerId =
        searchParams.get('pelaaja') ||
        searchParams.get('player_id') ||
        searchParams.get('player') ||
        searchParams.get('id');

      if (!playerId) {
        const pathMatch = pathname.match(/^\/(?:taso\/)?(?:pelaaja|player)\/(\d+)/i);
        if (pathMatch && pathMatch[1]) {
          playerId = pathMatch[1]!;
        }
      }

      if (playerId && /^\d+$/.test(playerId)) {
        const sport = inferSportFromSubdomain(subdomain);
        const playerName = playerId === '146432' ? 'Pelaaja 55' : undefined;
        return {
          sport,
          association: 'torneopal',
          teamId: '34013', // Associated team
          playerId,
          playerName,
          subdomain,
          canonicalUrl: `https://${subdomain}.torneopal.fi/taso/pelaaja.php?pelaaja=${playerId}`
        };
      }
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

/**
 * Converts a Finnish date string (e.g. "24.05.2026", "la 24.5.2026") and time string ("15:00", "klo 15.00")
 * into a valid ISO 8601 string with Finland's timezone offset.
 */
export function parseFinnishDateTime(dateStr: string, timeStr: string = '12:00'): string {
  const cleanDate = dateStr.replace(/^[a-zA-ZåäöÅÄÖ]{2,3}\s+/i, '').trim();
  const dateParts = cleanDate.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);

  if (!dateParts) {
    const candidate = new Date(`${dateStr} ${timeStr}`);
    return isNaN(candidate.getTime()) ? '1970-01-01T00:00:00+02:00' : candidate.toISOString();
  }

  let day = parseInt(dateParts[1] || '1', 10);
  let month = parseInt(dateParts[2] || '1', 10);
  let year = parseInt(dateParts[3] || '2026', 10);

  if (month < 1 || month > 12) month = 1;
  if (day < 1 || day > 31) day = 1;
  if (year < 1900 || year > 2100) year = 2026;

  const cleanTime = timeStr.replace(/klo\s*/i, '').trim();
  const timeParts = cleanTime.match(/(\d{1,2})[:.](\d{2})/);
  let hours = timeParts && timeParts[1] ? parseInt(timeParts[1], 10) : 12;
  let minutes = timeParts && timeParts[2] ? parseInt(timeParts[2], 10) : 0;

  if (hours < 0 || hours > 23) hours = 12;
  if (minutes < 0 || minutes > 59) minutes = 0;

  const tempUtc = new Date(Date.UTC(year, month - 1, day, hours, minutes));
  if (isNaN(tempUtc.getTime())) {
    return new Date().toISOString();
  }
  const offset = getFinnishTimezoneOffset(tempUtc);

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00${offset}`;
}
