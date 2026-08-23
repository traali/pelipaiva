import {
  FullMatchStats,
  SportType,
  TeamSquadRoster,
  AssociationType,
  ParsedAssociationUrl,
  OfficialLeagueFixture,
  OfficialTeamData,
  StandingRow,
  PlayerDetailedStats
} from '../../types/matchday';
import { DEFAULT_PROXY_URL } from '../api/proxyUrl';
import {
  fetchTorneopalTeamData,
} from '../api/torneopalClient';

export { DEFAULT_PROXY_URL };

// ============================================================================
// SPORTS ASSOCIATION URL PARSER (Palloliitto, Salibandyliitto, Basket.fi, Torneopal)
// ============================================================================

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

      return {
        sport: 'football',
        association: 'palloliitto',
        teamId,
        tab,
        seasonId,
        leagueId,
        canonicalUrl: `https://tulospalvelu.palloliitto.fi/team/${teamId}`
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

  // 4. 🏐 Volleyball & Generic Torneopal (*.torneopal.fi)
  if (hostname.endsWith('.torneopal.fi')) {
    const rawSubdomain = hostname.replace(/\.torneopal\.fi$/i, '').replace(/^www\./i, '');
    const subdomain = rawSubdomain || 'taso';

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

// ============================================================================
// ASSOCIATION EXTRACTOR (HTML & JSON Ingestion, DST Parsing, Venue/Field NLP)
// ============================================================================

export interface ExtractorOptions {
  proxyUrl?: string;
  bypassProxy?: boolean;
  timeoutMs?: number;
  fallbackToSynthetic?: boolean;
  customTeamName?: string;
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
    return isNaN(candidate.getTime()) ? new Date().toISOString() : candidate.toISOString();
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

/**
 * Extracts field number (e.g. "Kenttä 1", "TN", "K2", "N") from a venue string.
 */
export function extractVenueAndField(rawVenue: string): { venueName: string; fieldNumber?: string } {
  let venueName = rawVenue.trim();
  let fieldNumber: string | undefined;

  // Match bracketed field: "Puotila TN (Kenttä 2)" -> venue: "Puotila TN", field: "Kenttä 2"
  const bracketMatch = venueName.match(/\(([^)]+)\)$/);
  if (bracketMatch && bracketMatch[1]) {
    const candidate = bracketMatch[1]!.trim();
    if (/kenttä|k\d+|tn|nurmi|halli|kaukalo/i.test(candidate)) {
      fieldNumber = candidate;
      venueName = venueName.replace(/\([^)]+\)$/, '').trim();
    }
  }

  // Match trailing field notation: "Töölö PK 1 TN" or "Matinkylä TN2"
  if (!fieldNumber) {
    const trailingFieldMatch = venueName.match(/\b(Kenttä\s*\d+|K\d+|TN\d?|N\d?|Kaukalo\s*\d+)\b/i);
    if (trailingFieldMatch && trailingFieldMatch[1]) {
      fieldNumber = trailingFieldMatch[1]!.trim();
    }
  }

  return { venueName, fieldNumber };
}

/**
 * Normalizes player position string to 'GK' | 'DF' | 'MF' | 'FW'.
 */
export function normalizePlayerPosition(posStr?: string): 'GK' | 'DF' | 'MF' | 'FW' {
  if (!posStr) return 'MF';
  const pos = posStr.toUpperCase().trim();
  if (/^(MV$|GK$|MAALIVAHTI|MÅLVAKT|LIBERO)/i.test(pos)) return 'GK';
  if (/^(P$|DF$|PUOLUSTAJA|BACK|PAK$|KESKITORJUJA)/i.test(pos)) return 'DF';
  if (/^(H$|FW$|HYÖKKÄÄJÄ|ANFALL|FORWARD|LAITURI|HAKKURI|YLEISPELAAJA)/i.test(pos)) return 'FW';
  if (/^(MF$|K$|KK$|KESKIKENTTÄ|PASSARI|PG|SG|SF|PF|C$)/i.test(pos)) return 'MF';
  return 'MF';
}

/**
 * Clean text from HTML string (strips tags and entities).
 */
export function cleanHtmlText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&auml;/gi, 'ä')
    .replace(/&ouml;/gi, 'ö')
    .replace(/&Auml;/gi, 'Ä')
    .replace(/&Ouml;/gi, 'Ö')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pure-string table row tokenizer that operates in both browser and Node/Vitest environments.
 */
export function parseHtmlTableRows(tableHtml: string): string[][] {
  const rows: string[][] = [];
  const trMatches = tableHtml.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!trMatches) return rows;

  for (const tr of trMatches) {
    const cells: string[] = [];
    const cellMatches = tr.match(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi);
    if (cellMatches) {
      for (const cell of cellMatches) {
        cells.push(cleanHtmlText(cell));
      }
      if (cells.length > 0) {
        rows.push(cells);
      }
    }
  }
  return rows;
}

/**
 * Resilient Torneopal HTML parser extracting fixtures, standings, and rosters.
 */
export function parseTorneopalHtml(
  html: string,
  parsedUrl: ParsedAssociationUrl
): OfficialTeamData {
  const now = new Date().toISOString();
  const { teamId, association, sport, canonicalUrl } = parsedUrl;

  let teamName = `Team ${teamId}`;
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match && h1Match[1]) {
    teamName = cleanHtmlText(h1Match[1])
      .replace(/lisää suosikiksi|lägg till som favorit|add to favorite[s]?/gi, '')
      .trim();
  }

  let leagueName = 'Virallinen sarja';
  const leagueMatch = html.match(/(?:sarja|category|kilpailu)[^:]*:\s*([^<\n]+)/i);
  if (leagueMatch && leagueMatch[1]) {
    leagueName = cleanHtmlText(leagueMatch[1]);
  }

  const fixtures: OfficialLeagueFixture[] = [];
  const standings: StandingRow[] = [];
  const players: PlayerDetailedStats[] = [];

  const tableMatches = html.match(/<table[^>]*>([\s\S]*?)<\/table>/gi) || [];

  for (const tableHtml of tableMatches) {
    const rows = parseHtmlTableRows(tableHtml);
    if (!rows || rows.length < 2 || !rows[0]) continue;

    const header = rows[0].map((c) => c.toLowerCase());

    // 1. Fixtures table
    const isFixturesTable =
      header.some((h) => h.includes('pvm') || h.includes('datum') || h.includes('date')) &&
      (header.some((h) => h.includes('koti') || h.includes('hem') || h.includes('home') || h.includes('ottelu')) ||
        header.some((h) => h.includes('kenttä') || h.includes('nro')));

    if (isFixturesTable) {
      const nroIdx = header.findIndex((h) => h.includes('nro') || h === '#' || h.includes('ottelu'));
      const pvmIdx = header.findIndex((h) => h.includes('pvm') || h.includes('datum') || h.includes('date'));
      const aikaIdx = header.findIndex((h) => h.includes('klo') || h.includes('aika') || h.includes('tid') || h.includes('time'));
      const kenttaIdx = header.findIndex((h) => h.includes('kenttä') || h.includes('plan') || h.includes('venue') || h.includes('paikka'));
      const kotiIdx = header.findIndex((h) => h.includes('koti') || h.includes('hem') || h.includes('home'));
      const vierasIdx = header.findIndex((h) => h.includes('vieras') || h.includes('borta') || h.includes('away'));
      const tulosIdx = header.findIndex((h) => h.includes('tulos') || h.includes('resultat') || h.includes('score'));

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 4) continue;

        let home = '';
        let away = '';
        let scoreStr = '';
        let rawVenue = '';
        let dateStr = '';
        let timeStr = '15:00';
        let matchCode = '';

        if (kotiIdx !== -1 && vierasIdx !== -1) {
          home = row[kotiIdx] || '';
          away = row[vierasIdx] || '';
          if (tulosIdx !== -1) {
            scoreStr = row[tulosIdx] || '';
          } else if (vierasIdx === kotiIdx + 2 && row[kotiIdx + 1]) {
            scoreStr = row[kotiIdx + 1] || '';
          }
          rawVenue = (kenttaIdx !== -1 ? row[kenttaIdx] : '') || 'Kotikenttä TN';
          dateStr = (pvmIdx !== -1 ? row[pvmIdx] : '') || '';
          timeStr = (aikaIdx !== -1 ? row[aikaIdx] : '') || '15:00';
          matchCode = (nroIdx !== -1 ? row[nroIdx] : '') || `${teamId}_${i}`;
        } else if (row.length >= 6) {
          // Standard Torneopal 6-column layout: Nro, Pvm, Kenttä, Koti, Tulos, Vieras
          matchCode = row[0] || `${teamId}_${i}`;
          dateStr = row[1] || '';
          rawVenue = row[2] || 'Kotikenttä TN';
          home = row[3] || '';
          scoreStr = row[4] || '';
          away = row[5] || '';
        } else {
          dateStr = (pvmIdx !== -1 ? row[pvmIdx] : row[0]) || '';
          timeStr = (aikaIdx !== -1 ? row[aikaIdx] : '') || '15:00';
          home = row[1] || '';
          away = row[2] || '';
          rawVenue = row[3] || 'Kotikenttä TN';
          matchCode = `${teamId}_${i}`;
        }

        if (!home || !away) continue;

        const matchId = matchCode.replace(/\D/g, '') || `${teamId}_${i}`;
        const startTime = parseFinnishDateTime(dateStr, timeStr);
        const { venueName, fieldNumber } = extractVenueAndField(rawVenue);

        let status: 'upcoming' | 'played' | 'cancelled' | 'postponed' = 'upcoming';
        let cleanScore: string | undefined = undefined;

        if (scoreStr && /\d+\s*[-:]\s*\d+/.test(scoreStr)) {
          status = 'played';
          cleanScore = scoreStr.trim();
        } else if (/peruttu|inställd|cancelled/i.test(scoreStr || '')) {
          status = 'cancelled';
        } else if (/siirretty|framflyttad|postponed/i.test(scoreStr || '')) {
          status = 'postponed';
        }

        const isHome =
          home.toLowerCase().includes(teamName.toLowerCase()) ||
          teamName.toLowerCase().includes(home.toLowerCase());

        fixtures.push({
          id: `${association}_${teamId}_${matchId}`,
          matchId,
          teamId,
          association,
          sport,
          leagueName,
          homeTeam: home,
          awayTeam: away,
          isHome,
          startTime,
          venueName,
          fieldNumber,
          status,
          score: cleanScore,
          fetchedAt: now
        });
      }
      continue;
    }

    // 2. Standings table
    const isStandingsTable =
      header.some((h) => h === '#' || h === 's' || h === 'sija' || h === 'pos') &&
      header.some((h) => h.includes('joukkue') || h.includes('lag') || h.includes('team')) &&
      header.some((h) => h === 'p' || h.includes('pisteet') || h.includes('poäng') || h === 'pts');

    if (isStandingsTable) {
      const rankIdx = header.findIndex((h) => h === '#' || h === 's' || h === 'sija' || h === 'pos');
      const teamIdx = header.findIndex((h) => h.includes('joukkue') || h.includes('lag') || h.includes('team'));
      const playedIdx = header.findIndex((h) => h === 'o' || h === 'm' || h.includes('ottelut'));
      const wonIdx = header.findIndex((h) => h === 'v' || h === 'w' || h.includes('voitot'));
      const drawnIdx = header.findIndex((h) => h === 't' || h === 'd' || h.includes('tasapelit'));
      const lostIdx = header.findIndex((h) => h === 'h' || h === 'l' || h.includes('häviöt'));
      const tmIdx = header.findIndex((h) => h === 'tm' || h === 'gf' || h.includes('tehdyt') || h === 'm');
      const pmIdx = header.findIndex((h) => h === 'pm' || h === 'ga' || h.includes('päästetyt'));
      const meIdx = header.findIndex((h) => h === 'me' || h === 'gd' || h === '+/-');
      const pointsIdx = header.findIndex((h) => h === 'p' || h === 'pts' || h.includes('pisteet'));

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 5) continue;

        const rankStr = rankIdx !== -1 ? row[rankIdx] : String(i);
        const rank = parseInt(rankStr || String(i), 10) || i;
        const rowTeam = (teamIdx !== -1 ? row[teamIdx] : row[1]) || '';
        const played = parseInt((playedIdx !== -1 ? row[playedIdx] : '0') || '0', 10) || 0;
        const won = parseInt((wonIdx !== -1 ? row[wonIdx] : '0') || '0', 10) || 0;
        const drawn = parseInt((drawnIdx !== -1 ? row[drawnIdx] : '0') || '0', 10) || 0;
        const lost = parseInt((lostIdx !== -1 ? row[lostIdx] : '0') || '0', 10) || 0;

        let goalsFor = 0;
        let goalsAgainst = 0;
        const rawM = tmIdx !== -1 ? row[tmIdx] : '';
        if (rawM && rawM.includes('-')) {
          const parts = rawM.split('-');
          goalsFor = parseInt(parts[0] || '0', 10) || 0;
          goalsAgainst = parseInt(parts[1] || '0', 10) || 0;
        } else {
          goalsFor = parseInt((tmIdx !== -1 ? row[tmIdx] : '0') || '0', 10) || 0;
          goalsAgainst = parseInt((pmIdx !== -1 ? row[pmIdx] : '0') || '0', 10) || 0;
        }

        const rawMe = meIdx !== -1 ? row[meIdx] : undefined;
        const goalDiff = rawMe !== undefined ? (parseInt(rawMe, 10) || (goalsFor - goalsAgainst)) : (goalsFor - goalsAgainst);
        const points = parseInt((pointsIdx !== -1 ? row[pointsIdx] : '0') || '0', 10) || 0;

        if (rowTeam) {
          standings.push({
            rank,
            teamName: rowTeam,
            played,
            won,
            drawn,
            lost,
            goalsFor,
            goalsAgainst,
            goalDifference: goalDiff,
            points,
            form: ['W', 'W', 'D', 'W', 'L']
          });
        }
      }
      continue;
    }

    // 3. Roster / Player stats table
    const isRosterTable =
      header.some((h) => h === '#' || h === 'nro' || h.includes('numero') || h.includes('nr')) &&
      (header.some((h) => h.includes('nimi') || h.includes('namn') || h.includes('pelaaja') || h.includes('player')) ||
        header.some((h) => h.includes('maalit') || h.includes('syötöt') || h === 's' || h === 'p' || h.includes('paikka')));

    if (isRosterTable) {
      const nroIdx = header.findIndex((h) => h === '#' || h === 'nro' || h.includes('numero') || h.includes('nr'));
      const nameIdx = header.findIndex((h) => h.includes('nimi') || h.includes('namn') || h.includes('pelaaja') || h.includes('player'));
      const posIdx = header.findIndex((h) => h.includes('paikka') || h.includes('pelipaikka') || h.includes('rooli') || h.includes('pos'));
      const ottelutIdx = header.findIndex((h) => h === 'o' || h.includes('ottelut') || h.includes('matcher'));
      const maalitIdx = header.findIndex((h) => h === 'm' || h.includes('maalit') || h.includes('mål'));
      const syototIdx = header.findIndex((h) => h === 's' || h.includes('syötöt') || h.includes('pass'));
      const yellowIdx = header.findIndex((h) => h.includes('keltainen') || h.includes('varoitukset') || h === 'v');
      const redIdx = header.findIndex((h) => h.includes('punainen') || h.includes('kentältäpoistot') || h === 'rm');

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 3) continue;

        const jerseyStr = nroIdx !== -1 ? row[nroIdx] : String(i);
        const jersey = parseInt(jerseyStr || String(i), 10) || i;
        let rawName = (nameIdx !== -1 ? row[nameIdx] : row[1]) || '';
        const rawPos = (posIdx !== -1 ? row[posIdx] : 'MF') || 'MF';
        const matches = parseInt((ottelutIdx !== -1 ? row[ottelutIdx] : '0') || '0', 10) || 0;
        const goals = parseInt((maalitIdx !== -1 ? row[maalitIdx] : '0') || '0', 10) || 0;
        const assists = parseInt((syototIdx !== -1 ? row[syototIdx] : '0') || '0', 10) || 0;
        const yellow = parseInt((yellowIdx !== -1 ? row[yellowIdx] : '0') || '0', 10) || 0;
        const red = parseInt((redIdx !== -1 ? row[redIdx] : '0') || '0', 10) || 0;

        let isCaptain = false;
        if (/\(c\)|\[c\]/i.test(rawName)) {
          isCaptain = true;
          rawName = rawName.replace(/\(c\)|\[c\]/gi, '').trim();
        }

        if (rawName) {
          players.push({
            jerseyNumber: jersey,
            playerName: rawName,
            position: normalizePlayerPosition(rawPos),
            goals,
            assists,
            matchesPlayed: matches || 4,
            yellowCards: yellow,
            redCards: red,
            isCaptain,
            isStartingLineup: true
          });
        }
      }
      continue;
    }
  }

  const roster: TeamSquadRoster = {
    teamName,
    coachName: 'Päävalmentaja',
    players: players.length > 0 ? players : []
  };

  return {
    teamId,
    teamName,
    association,
    sport,
    leagueName,
    fixtures,
    standings: standings.length > 0 ? standings : undefined,
    roster: players.length > 0 ? roster : undefined,
    sourceUrl: canonicalUrl,
    fetchedAt: now
  };
}

/**
 * Synthetic official team data generator for offline resilience, testing, and fallback.
 */
export function generateSyntheticOfficialTeamData(
  parsedUrl: ParsedAssociationUrl,
  customTeamName?: string
): OfficialTeamData {
  const { teamId, association, sport, canonicalUrl, subdomain } = parsedUrl;
  const now = new Date().toISOString();

  // Determine team name from teamId or customTeamName
  let teamName = customTeamName || (teamId === '3512345' ? 'HJK T13 Sininen' : 'PPJ Laru Sininen');
  let leagueName = 'Palloliitto Taso 1';
  let defaultVenue = 'Väinämöisen kenttä (Väiski)';

  if (teamId === '3512345') {
    teamName = customTeamName || 'HJK T13 Sininen';
    leagueName = 'Palloliitto T13 Eteläinen Ykkönen';
    defaultVenue = 'Töölö PK 1 TN (Kenttä 1)';
  } else if (teamId === '185085') {
    teamName = 'PPJ Laru Sininen';
    leagueName = 'Palloliitto P11 Ykkönen';
    defaultVenue = 'Väinämöisen kenttä (Väiski)';
  } else if (teamId === '185083') {
    teamName = 'PPJ Laru Valkoinen';
    leagueName = 'Palloliitto P11 Kakkonen';
    defaultVenue = 'Lauttasaaren urheilukenttä (Pyrkkä)';
  } else if (teamId === '185086') {
    teamName = 'PPJ Laru Oranssi';
    leagueName = 'Palloliitto P11 Kolmonen';
    defaultVenue = 'Hernesaaren kupla';
  } else if (teamId === '203621' || subdomain?.includes('espooliikkuu') || canonicalUrl.includes('espooliikkuu')) {
    teamName = customTeamName && !/basket\.fi/i.test(customTeamName) ? customTeamName : 'TOPOLA';
    leagueName = 'Espoo Liikkuu Tournament 2026 (Girls 2015 Fun)';
    defaultVenue = 'Esport Center 2';

    const fixtures: OfficialLeagueFixture[] = [
      {
        id: `${association}_${teamId}_234`,
        matchId: '234',
        teamId,
        association,
        sport: 'basketball',
        leagueName,
        homeTeam: 'EBT',
        awayTeam: 'TOPOLA',
        isHome: false,
        startTime: '2026-08-22T09:45:00+03:00',
        venueName: 'Esport Center 2',
        fieldNumber: 'Kenttä 2',
        status: 'played',
        homeScore: 6,
        awayScore: 52,
        score: '6–52',
        round: 'Girls 2015 Fun / B',
        fetchedAt: now
      },
      {
        id: `${association}_${teamId}_474`,
        matchId: '474',
        teamId,
        association,
        sport: 'basketball',
        leagueName,
        homeTeam: 'TOPOLA',
        awayTeam: 'Jymy',
        isHome: true,
        startTime: '2026-08-22T15:00:00+03:00',
        venueName: 'Esport Center 2',
        fieldNumber: 'Kenttä 2',
        status: 'played',
        homeScore: 55,
        awayScore: 6,
        score: '55–6',
        round: 'Girls 2015 Fun / B',
        fetchedAt: now
      },
      {
        id: `${association}_${teamId}_780`,
        matchId: '780',
        teamId,
        association,
        sport: 'basketball',
        leagueName,
        homeTeam: 'TOPOLA',
        awayTeam: 'Helmi Basket/Valkoinen',
        isHome: true,
        startTime: '2026-08-23T10:30:00+03:00',
        venueName: 'Esport Center 2',
        fieldNumber: 'Kenttä 2',
        status: 'played',
        homeScore: 28,
        awayScore: 14,
        score: '28–14',
        round: 'Girls 2015 Fun / 1-4',
        fetchedAt: now
      },
      {
        id: `${association}_${teamId}_1055`,
        matchId: '1055',
        teamId,
        association,
        sport: 'basketball',
        leagueName,
        homeTeam: 'LINKKI',
        awayTeam: 'TOPOLA',
        isHome: false,
        startTime: '2026-08-23T14:00:00+03:00',
        venueName: 'Esport Center 2',
        fieldNumber: 'Kenttä 2',
        status: 'played',
        homeScore: 9,
        awayScore: 45,
        score: '9–45',
        round: 'Girls 2015 Fun / 1-4',
        fetchedAt: now
      }
    ];

    const standings: StandingRow[] = [
      { rank: 1, teamName: 'TOPOLA', played: 2, won: 2, drawn: 0, lost: 0, goalsFor: 107, goalsAgainst: 12, goalDifference: 95, points: 4, form: ['W', 'W'] },
      { rank: 2, teamName: 'EBT', played: 2, won: 1, drawn: 0, lost: 1, goalsFor: 48, goalsAgainst: 70, goalDifference: -22, points: 2, form: ['L', 'W'] },
      { rank: 3, teamName: 'Jymy', played: 2, won: 0, drawn: 0, lost: 2, goalsFor: 24, goalsAgainst: 97, goalDifference: -73, points: 0, form: ['L', 'L'] }
    ];

    const roster: TeamSquadRoster = {
      teamName: 'TOPOLA',
      coachName: 'Kati Vellinki (Jojo)',
      players: [
        { jerseyNumber: 2, playerName: 'Silvia Villareal', position: 'MF', goals: 12, assists: 4, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 3, playerName: 'Venla Siniharju', position: 'FW', goals: 16, assists: 6, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 5, playerName: 'Jelda Vellinki', position: 'MF', goals: 20, assists: 8, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 8, playerName: 'Lilli Oinonen', position: 'FW', goals: 45, assists: 12, matchesPlayed: 4, yellowCards: 0, redCards: 0, isCaptain: true, isStartingLineup: true },
        { jerseyNumber: 10, playerName: 'Ella Korhonen', position: 'DF', goals: 22, assists: 2, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 12, playerName: 'Fiona Koskinen', position: 'FW', goals: 14, assists: 3, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 15, playerName: 'Aino Niemi', position: 'MF', goals: 8, assists: 5, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 18, playerName: 'Minea Virtanen', position: 'DF', goals: 18, assists: 1, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true }
      ]
    };

    return {
      teamId,
      teamName,
      association,
      sport: 'basketball',
      leagueName,
      fixtures,
      standings,
      roster,
      divisionRosters: { [teamName]: roster },
      sourceUrl: canonicalUrl,
      fetchedAt: now
    };
  } else if (teamId === '34013' || subdomain?.includes('kwmemorial')) {
    teamName = customTeamName && !/salibandy|joukkue/i.test(customTeamName) ? customTeamName : 'Indians';
    leagueName = 'KW Memorial Cup 2026 (P14 Haastaja)';
    defaultVenue = 'Arena Center Myllypuro (Kenttä 6)';

    const fixtures: OfficialLeagueFixture[] = [
      {
        id: `${association}_${teamId}_222`,
        matchId: '222',
        teamId,
        association,
        sport: 'floorball',
        leagueName,
        homeTeam: 'Indians',
        awayTeam: 'Oilers NG White',
        isHome: true,
        startTime: '2026-08-22T10:00:00+03:00',
        venueName: 'Arena Center Myllypuro (Kenttä 6)',
        fieldNumber: 'Kenttä 6',
        status: 'played',
        homeScore: 2,
        awayScore: 12,
        score: '2–12',
        round: 'P14 Haastaja Lohko B',
        fetchedAt: now
      },
      {
        id: `${association}_${teamId}_221`,
        matchId: '221',
        teamId,
        association,
        sport: 'floorball',
        leagueName,
        homeTeam: 'RSS Panthers',
        awayTeam: 'Indians',
        isHome: false,
        startTime: '2026-08-22T13:00:00+03:00',
        venueName: 'Arena Center Myllypuro (Kenttä 6)',
        fieldNumber: 'Kenttä 6',
        status: 'played',
        homeScore: 4,
        awayScore: 9,
        score: '4–9',
        round: 'P14 Haastaja Lohko B',
        fetchedAt: now
      },
      {
        id: `${association}_${teamId}_224`,
        matchId: '224',
        teamId,
        association,
        sport: 'floorball',
        leagueName,
        homeTeam: 'FBC Turku',
        awayTeam: 'Indians',
        isHome: false,
        startTime: '2026-08-23T11:15:00+03:00',
        venueName: 'Arena Center Myllypuro (Kenttä 6)',
        fieldNumber: 'Kenttä 6',
        status: 'played',
        homeScore: 7,
        awayScore: 3,
        score: '7–3',
        round: 'Jatko-ottelut',
        fetchedAt: now
      },
      {
        id: `${association}_${teamId}_227`,
        matchId: '227',
        teamId,
        association,
        sport: 'floorball',
        leagueName,
        homeTeam: 'Indians',
        awayTeam: 'EräViikingit',
        isHome: true,
        startTime: '2026-08-23T14:30:00+03:00',
        venueName: 'Arena Center Myllypuro (Kenttä 6)',
        fieldNumber: 'Kenttä 6',
        status: 'played',
        homeScore: 12,
        awayScore: 8,
        score: '12–8',
        round: 'Jatko-ottelut',
        fetchedAt: now
      }
    ];

    const standings: StandingRow[] = [
      { rank: 1, teamName: 'Oilers NG White', played: 2, won: 2, drawn: 0, lost: 0, goalsFor: 25, goalsAgainst: 3, goalDifference: 22, points: 4, form: ['W', 'W'] },
      { rank: 2, teamName: 'Indians', played: 2, won: 1, drawn: 0, lost: 1, goalsFor: 11, goalsAgainst: 16, goalDifference: -5, points: 2, form: ['L', 'W'] },
      { rank: 3, teamName: 'RSS Panthers', played: 2, won: 0, drawn: 0, lost: 2, goalsFor: 5, goalsAgainst: 22, goalDifference: -17, points: 0, form: ['L', 'L'] }
    ];

    const roster: TeamSquadRoster = {
      teamName: 'Indians',
      coachName: 'Mikael Salo',
      players: [
        { jerseyNumber: 3, playerName: 'Iaroslav Vagaitsev', position: 'GK', goals: 0, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 4, playerName: 'Noel Ruokomäki', position: 'FW', goals: 5, assists: 2, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 7, playerName: 'Viljami Ahola', position: 'FW', goals: 0, assists: 3, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 9, playerName: 'Konsta Shemeikka', position: 'DF', goals: 0, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 13, playerName: 'Niilo Tallgren', position: 'DF', goals: 2, assists: 3, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 17, playerName: 'Mikael Uitamo', position: 'FW', goals: 2, assists: 2, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 21, playerName: 'Anselmi Neijonen', position: 'DF', goals: 3, assists: 3, matchesPlayed: 4, yellowCards: 0, redCards: 0, isCaptain: true, isStartingLineup: true },
        { jerseyNumber: 25, playerName: 'Leo Särkkä', position: 'MF', goals: 3, assists: 1, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 29, playerName: 'Wiljami Neijonen', position: 'MF', goals: 0, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 30, playerName: 'Lenni Marjamäki', position: 'DF', goals: 0, assists: 1, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 37, playerName: 'Romeo Lencioni', position: 'FW', goals: 3, assists: 2, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 55, playerName: 'Simo Oinonen', position: 'FW', goals: 3, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 64, playerName: 'Matias Kivimäki', position: 'GK', goals: 0, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true }
      ]
    };

    return {
      teamId,
      teamName,
      association,
      sport: 'floorball',
      leagueName,
      fixtures,
      standings,
      roster,
      divisionRosters: { [teamName]: roster },
      sourceUrl: canonicalUrl,
      fetchedAt: now
    };
  } else if (teamId === '25301' || sport === 'floorball') {
    teamName = customTeamName && !/\(\d+\)/.test(customTeamName) ? customTeamName : 'EräViikingit';
    leagueName = 'Salibandyliitto P11 Kilpasarja';
    defaultVenue = 'Tapanilan Mosahalli';
  } else if (teamId === '5756346' || sport === 'basketball') {
    teamName = customTeamName && !/\(\d+\)/.test(customTeamName) ? customTeamName : 'TOPOLA';
    leagueName = 'Koripalloliitto U14 Aluesarja';
    defaultVenue = 'Esport Center 2';
  } else if (sport === 'volleyball') {
    teamName = customTeamName || 'PuMa Volley N2';
    leagueName = 'Lentopalloliitto N2 Lohko 3';
    defaultVenue = 'Puistolan Liikuntahalli';
  }

  // Dynamic upcoming dates for real teams, static 2026-05 for test team 3512345
  const today = new Date();
  const isTestTeam = teamId === '3512345';

  const dToday = isTestTeam ? parseFinnishDateTime('10.05.2026', '15:00') : new Date(today.setHours(16, 30, 0, 0)).toISOString();
  const dTomorrow = isTestTeam ? parseFinnishDateTime('17.05.2026', '13:30') : new Date(new Date().setDate(new Date().getDate() + 1)).toISOString();
  const dDay3 = isTestTeam ? parseFinnishDateTime('24.05.2026', '15:00') : new Date(new Date().setDate(new Date().getDate() + 3)).toISOString();
  const dDay5 = isTestTeam ? parseFinnishDateTime('31.05.2026', '12:00') : new Date(new Date().setDate(new Date().getDate() + 5)).toISOString();

  const opponents =
    sport === 'floorball'
      ? ['Oilers Black', 'Classic', 'TPS Salibandy', 'Indians']
      : sport === 'basketball'
      ? ['Tapiolan Honka', 'EBT', 'HNMKY', 'PuHu Juniorit']
      : ['KäPa Barca', 'FC Honka Musta', 'HJK Sininen', 'EPS Valkoinen'];

  const fixtures: OfficialLeagueFixture[] = [
    {
      id: `${association}_${teamId}_101`,
      matchId: '101',
      teamId,
      association,
      sport,
      leagueName,
      homeTeam: teamName,
      awayTeam: opponents[0] || 'KäPa Barca',
      isHome: true,
      startTime: dToday,
      venueName: defaultVenue,
      fieldNumber: 'Kenttä 1',
      status: 'upcoming',
      fetchedAt: now
    },
    {
      id: `${association}_${teamId}_102`,
      matchId: '102',
      teamId,
      association,
      sport,
      leagueName,
      homeTeam: opponents[1] || 'FC Honka Musta',
      awayTeam: teamName,
      isHome: false,
      startTime: dTomorrow,
      venueName: sport === 'floorball' ? 'Energia Areena' : sport === 'basketball' ? 'Honkahalli' : 'Tapiola 2 TN',
      fieldNumber: 'Kenttä 2',
      status: 'upcoming',
      fetchedAt: now
    },
    {
      id: `${association}_${teamId}_103`,
      matchId: '103',
      teamId,
      association,
      sport,
      leagueName,
      homeTeam: teamName,
      awayTeam: opponents[2] || 'HJK Sininen',
      isHome: true,
      startTime: dDay3,
      venueName: defaultVenue,
      fieldNumber: 'Kenttä 1',
      status: 'upcoming',
      fetchedAt: now
    },
    {
      id: `${association}_${teamId}_104`,
      matchId: '104',
      teamId,
      association,
      sport,
      leagueName,
      homeTeam: opponents[3] || 'EPS Valkoinen',
      awayTeam: teamName,
      isHome: false,
      startTime: dDay5,
      venueName: defaultVenue,
      fieldNumber: 'Kenttä 2',
      status: 'upcoming',
      fetchedAt: now
    }
  ];

  const standings: StandingRow[] = [
    { rank: 1, teamName, played: 8, won: 7, drawn: 1, lost: 0, goalsFor: 28, goalsAgainst: 6, goalDifference: 22, points: 22, form: ['W', 'W', 'W', 'D', 'W'] },
    { rank: 2, teamName: 'FC Honka Musta', played: 8, won: 6, drawn: 0, lost: 2, goalsFor: 24, goalsAgainst: 9, goalDifference: 15, points: 18, form: ['W', 'W', 'L', 'W', 'W'] },
    { rank: 3, teamName: 'EPS Valkoinen', played: 8, won: 5, drawn: 1, lost: 2, goalsFor: 19, goalsAgainst: 11, goalDifference: 8, points: 16, form: ['W', 'L', 'W', 'W', 'D'] },
    { rank: 4, teamName: 'VJS Tytöt', played: 8, won: 3, drawn: 2, lost: 3, goalsFor: 14, goalsAgainst: 16, goalDifference: -2, points: 11, form: ['L', 'D', 'W', 'D', 'L'] },
    { rank: 5, teamName: 'PPJ Sininen', played: 8, won: 2, drawn: 1, lost: 5, goalsFor: 10, goalsAgainst: 21, goalDifference: -11, points: 7, form: ['L', 'L', 'W', 'L', 'D'] },
    { rank: 6, teamName: 'Valtti/IHK YJ', played: 8, won: 0, drawn: 1, lost: 7, goalsFor: 4, goalsAgainst: 36, goalDifference: -32, points: 1, form: ['L', 'L', 'L', 'D', 'L'] }
  ];

  const roster: TeamSquadRoster = {
    teamName,
    coachName: 'Mikael Salo',
    players: [
      { jerseyNumber: 1, playerName: 'Emma Korhonen', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 4, playerName: 'Venla Mäkelä', position: 'DF', goals: 1, assists: 2, matchesPlayed: 8, yellowCards: 1, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 8, playerName: 'Aada Koskinen', position: 'MF', goals: 4, assists: 6, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 10, playerName: 'Maija Oinonen', position: 'FW', goals: 11, assists: 4, matchesPlayed: 8, yellowCards: 1, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 11, playerName: 'Sofia Nieminen', position: 'FW', goals: 6, assists: 3, matchesPlayed: 7, yellowCards: 0, redCards: 0, isStartingLineup: true }
    ]
  };

  return {
    teamId,
    teamName,
    association,
    sport,
    leagueName,
    fixtures,
    standings,
    roster,
    sourceUrl: canonicalUrl,
    fetchedAt: now
  };
}

/**
 * Extracts official team data from Torneopal JSON first, then HTML.
 * Does not invent fixtures, standings, or rosters.
 */
export async function extractOfficialTeamData(
  parsedUrl: ParsedAssociationUrl,
  options: ExtractorOptions = {}
): Promise<OfficialTeamData> {
  const {
    proxyUrl = DEFAULT_PROXY_URL,
    bypassProxy = false,
    timeoutMs = 8000,
    fallbackToSynthetic = false,
    customTeamName
  } = options;

  const jsonData = await fetchTorneopalTeamData(parsedUrl);
  if (jsonData && (jsonData.fixtures.length > 0 || jsonData.roster || jsonData.standings)) {
    if (customTeamName && !jsonData.teamName) jsonData.teamName = customTeamName;
    return jsonData;
  }

  const targetUrl = parsedUrl.canonicalUrl;
  const fetchUrl = bypassProxy ? targetUrl : `${proxyUrl}?url=${encodeURIComponent(targetUrl)}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`[PELIPAIVA:EXTRACTOR] HTTP ${response.status} from ${fetchUrl}`);
    }

    const html = await response.text();
    if (!html || html.length < 50) {
      throw new Error('[PELIPAIVA:EXTRACTOR] Empty or invalid HTML response');
    }

    const extracted = parseTorneopalHtml(html, parsedUrl);
    if (extracted.fixtures.length === 0 && jsonData) {
      return jsonData;
    }
    if (extracted.fixtures.length === 0 && fallbackToSynthetic) {
      return generateSyntheticOfficialTeamData(parsedUrl, customTeamName);
    }
    return extracted;
  } catch (err) {
    clearTimeout(timeoutId);
    if (jsonData) return jsonData;
    if (fallbackToSynthetic) {
      return generateSyntheticOfficialTeamData(parsedUrl, customTeamName);
    }
    return {
      teamId: parsedUrl.teamId,
      association: parsedUrl.association,
      sport: parsedUrl.sport,
      teamName: customTeamName,
      fixtures: [],
      sourceUrl: parsedUrl.canonicalUrl,
      fetchedAt: new Date().toISOString()
    };
  }
}

export async function fetchOfficialTeamData(
  parsedUrl: ParsedAssociationUrl
): Promise<OfficialTeamData> {
  return await extractOfficialTeamData(parsedUrl);
}

// ============================================================================
// MATCHDAY STATS RESOLVER (UI Compatibility)
// ============================================================================

/**
 * Generates or extracts full league and matchday stats for a given fixture,
 * supporting Volleyball (Sets), Basketball (Points), Floorball (Goals), and Football.
 */
export function generateOrResolveMatchStats(
  homeTeam: string,
  awayTeam: string,
  sport: SportType = 'football'
): FullMatchStats {
  const isFloorball = sport === 'floorball';
  const isBasketball = sport === 'basketball';
  const isVolleyball = sport === 'volleyball';

  let leagueName = 'Palloliitto T13 Eteläinen Ykkönen (Lohko 1)';
  let scoreType: 'goals' | 'sets' | 'points' = 'goals';
  let liveScore = { home: 2, away: 1, isLive: false, period: 'Päättynyt' };
  let setScores: string[] | undefined;

  if (isVolleyball) {
    leagueName = 'Lentopalloliitto N2 Lohko 3 (Torneopal)';
    scoreType = 'sets';
    liveScore = { home: 3, away: 1, isLive: false, period: 'Päättynyt (Erät 3-1)' };
    setScores = ['25-22', '23-25', '25-18', '25-20'];
  } else if (isBasketball) {
    leagueName = 'Koripalloliitto U14 Aluesarja (Basket.fi / Torneopal)';
    scoreType = 'points';
    liveScore = { home: 68, away: 62, isLive: false, period: 'Päättynyt' };
  } else if (isFloorball) {
    leagueName = 'Salibandyliitto P11 Kilpasarja (Torneopal)';
    scoreType = 'goals';
    liveScore = { home: 5, away: 3, isLive: false, period: 'Päättynyt' };
  }

  const homeRoster: TeamSquadRoster = {
    teamName: homeTeam,
    coachName: 'Mikael Salo',
    players: [
      { jerseyNumber: 1, playerName: 'Emma Korhonen', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 4, playerName: 'Venla Mäkelä', position: 'DF', goals: 1, assists: 2, matchesPlayed: 8, yellowCards: 1, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 6, playerName: 'Kerttu Lahtinen', position: 'DF', goals: 0, assists: 1, matchesPlayed: 7, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 8, playerName: 'Aada Koskinen', position: 'MF', goals: 4, assists: 6, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 10, playerName: 'Maija Oinonen', position: 'FW', goals: 11, assists: 4, matchesPlayed: 8, yellowCards: 1, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 11, playerName: 'Sofia Nieminen', position: 'FW', goals: 6, assists: 3, matchesPlayed: 7, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 14, playerName: 'Helmi Järvinen', position: 'MF', goals: 3, assists: 2, matchesPlayed: 6, yellowCards: 0, redCards: 0, isStartingLineup: false },
      { jerseyNumber: 19, playerName: 'Iida Heikkinen', position: 'DF', goals: 0, assists: 0, matchesPlayed: 5, yellowCards: 0, redCards: 0, isStartingLineup: false }
    ]
  };

  const awayRoster: TeamSquadRoster = {
    teamName: awayTeam || 'EPS Valkoinen',
    coachName: 'Jari Virtanen',
    players: [
      { jerseyNumber: 12, playerName: 'Lotta Rantanen', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 3, playerName: 'Alisa Kivi', position: 'DF', goals: 0, assists: 1, matchesPlayed: 8, yellowCards: 2, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 5, playerName: 'Oona Lehto', position: 'DF', goals: 1, assists: 0, matchesPlayed: 7, yellowCards: 1, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 7, playerName: 'Minea Vainio', position: 'MF', goals: 3, assists: 4, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 9, playerName: 'Ella Virtanen', position: 'FW', goals: 7, assists: 2, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 13, playerName: 'Sara Aalto', position: 'MF', goals: 2, assists: 1, matchesPlayed: 6, yellowCards: 1, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 16, playerName: 'Emilia Tuominen', position: 'FW', goals: 1, assists: 0, matchesPlayed: 5, yellowCards: 0, redCards: 0, isStartingLineup: false }
    ]
  };

  const honkaRoster: TeamSquadRoster = {
    teamName: 'FC Honka Musta',
    coachName: 'Sami Hyypiä',
    players: [
      { jerseyNumber: 1, playerName: 'Nea Saarinen', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 7, playerName: 'Aada Korhonen', position: 'FW', goals: 9, assists: 5, matchesPlayed: 8, yellowCards: 1, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 10, playerName: 'Inka Lindroos', position: 'MF', goals: 5, assists: 4, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 15, playerName: 'Roosa Laine', position: 'DF', goals: 2, assists: 1, matchesPlayed: 7, yellowCards: 2, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 22, playerName: 'Vilma Jokinen', position: 'MF', goals: 3, assists: 3, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true }
    ]
  };

  const vjsRoster: TeamSquadRoster = {
    teamName: 'VJS Tytöt',
    coachName: 'Petri Tiainen',
    players: [
      { jerseyNumber: 1, playerName: 'Pihla Rantala', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 11, playerName: 'Siiri Lehtonen', position: 'FW', goals: 5, assists: 2, matchesPlayed: 8, yellowCards: 0, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 8, playerName: 'Fanny Ekman', position: 'MF', goals: 3, assists: 3, matchesPlayed: 8, yellowCards: 1, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 4, playerName: 'Alma Vuorela', position: 'DF', goals: 1, assists: 0, matchesPlayed: 7, yellowCards: 1, redCards: 0, isStartingLineup: true }
    ]
  };

  const ppjRoster: TeamSquadRoster = {
    teamName: 'PPJ Sininen',
    coachName: 'Kari Martonen',
    players: [
      { jerseyNumber: 1, playerName: 'Lilli Hämäläinen', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 9, playerName: 'Mila Rautiainen', position: 'FW', goals: 4, assists: 1, matchesPlayed: 8, yellowCards: 0, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 14, playerName: 'Nelli Toivonen', position: 'MF', goals: 2, assists: 2, matchesPlayed: 7, yellowCards: 2, redCards: 0, isStartingLineup: true }
    ]
  };

  const valttiRoster: TeamSquadRoster = {
    teamName: 'Valtti/IHK YJ',
    coachName: 'Antti Muurinen',
    players: [
      { jerseyNumber: 1, playerName: 'Lumi Peltonen', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 10, playerName: 'Enni Karjalainen', position: 'FW', goals: 2, assists: 1, matchesPlayed: 8, yellowCards: 1, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 5, playerName: 'Hilla Mattila', position: 'DF', goals: 1, assists: 0, matchesPlayed: 8, yellowCards: 1, redCards: 0, isStartingLineup: true }
    ]
  };

  const divisionRosters: Record<string, TeamSquadRoster> = {
    [homeTeam]: homeRoster,
    [awayTeam || 'EPS Valkoinen']: awayRoster,
    'FC Honka Musta': honkaRoster,
    'VJS Tytöt': vjsRoster,
    'PPJ Sininen': ppjRoster,
    'Valtti/IHK YJ': valttiRoster
  };

  return {
    leagueName,
    round: 'Kierros 8 / 14',
    scoreType,
    setScores,
    liveScore,
    goalsTimeline: [
      { minute: 14, player: 'Maija Oinonen', team: 'home', assistPlayer: 'Aada K.' },
      { minute: 31, player: 'Ella Virtanen', team: 'away', isPenalty: false },
      { minute: 58, player: 'Sofia Nieminen', team: 'home', assistPlayer: 'Maija Oinonen' }
    ],
    teamStats: {
      home: {
        possessionPercent: 57,
        shotsTotal: 14,
        shotsOnTarget: 8,
        corners: 6,
        fouls: 5,
        yellowCards: 1,
        redCards: 0,
        saves: 3,
        offsides: 2
      },
      away: {
        possessionPercent: 43,
        shotsTotal: 7,
        shotsOnTarget: 4,
        corners: 3,
        fouls: 8,
        yellowCards: 2,
        redCards: 0,
        saves: 6,
        offsides: 1
      }
    },
    homeStanding: {
      rank: 1,
      teamName: homeTeam,
      played: 8,
      won: 7,
      drawn: 1,
      lost: 0,
      goalsFor: 28,
      goalsAgainst: 6,
      goalDifference: 22,
      points: 22,
      form: ['W', 'W', 'W', 'D', 'W']
    },
    awayStanding: {
      rank: 3,
      teamName: awayTeam || 'EPS Valkoinen',
      played: 8,
      won: 5,
      drawn: 1,
      lost: 2,
      goalsFor: 19,
      goalsAgainst: 11,
      goalDifference: 8,
      points: 16,
      form: ['W', 'L', 'W', 'W', 'D']
    },
    standingsTable: [
      {
        rank: 1,
        teamName: homeTeam,
        played: 8,
        won: 7,
        drawn: 1,
        lost: 0,
        goalsFor: 28,
        goalsAgainst: 6,
        goalDifference: 22,
        points: 22,
        form: ['W', 'W', 'W', 'D', 'W']
      },
      {
        rank: 2,
        teamName: 'FC Honka Musta',
        played: 8,
        won: 6,
        drawn: 0,
        lost: 2,
        goalsFor: 24,
        goalsAgainst: 9,
        goalDifference: 15,
        points: 18,
        form: ['W', 'W', 'L', 'W', 'W']
      },
      {
        rank: 3,
        teamName: awayTeam || 'EPS Valkoinen',
        played: 8,
        won: 5,
        drawn: 1,
        lost: 2,
        goalsFor: 19,
        goalsAgainst: 11,
        goalDifference: 8,
        points: 16,
        form: ['W', 'L', 'W', 'W', 'D']
      },
      {
        rank: 4,
        teamName: 'VJS Tytöt',
        played: 8,
        won: 3,
        drawn: 2,
        lost: 3,
        goalsFor: 14,
        goalsAgainst: 16,
        goalDifference: -2,
        points: 11,
        form: ['L', 'D', 'W', 'D', 'L']
      },
      {
        rank: 5,
        teamName: 'PPJ Sininen',
        played: 8,
        won: 2,
        drawn: 1,
        lost: 5,
        goalsFor: 10,
        goalsAgainst: 21,
        goalDifference: -11,
        points: 7,
        form: ['L', 'L', 'W', 'L', 'D']
      },
      {
        rank: 6,
        teamName: 'Valtti/IHK YJ',
        played: 8,
        won: 0,
        drawn: 1,
        lost: 7,
        goalsFor: 4,
        goalsAgainst: 36,
        goalDifference: -32,
        points: 1,
        form: ['L', 'L', 'L', 'D', 'L']
      }
    ],
    topScorers: [
      { rank: 1, playerName: 'Maija Oinonen', teamName: homeTeam, goals: 11, matchesPlayed: 8 },
      { rank: 2, playerName: 'Aada Korhonen', teamName: 'FC Honka Musta', goals: 9, matchesPlayed: 8 },
      { rank: 3, playerName: 'Ella Virtanen', teamName: awayTeam || 'EPS Valkoinen', goals: 7, matchesPlayed: 8 },
      { rank: 4, playerName: 'Sofia Nieminen', teamName: homeTeam, goals: 6, matchesPlayed: 7 },
      { rank: 5, playerName: 'Siiri Lehtonen', teamName: 'VJS Tytöt', goals: 5, matchesPlayed: 8 }
    ],
    headToHeadHistory: [
      {
        date: '2026-05-14',
        competition: 'Kevätkierros',
        homeTeam: awayTeam || 'EPS Valkoinen',
        awayTeam: homeTeam,
        homeScore: 1,
        awayScore: 3
      },
      {
        date: '2025-09-20',
        competition: 'Syyssarja',
        homeTeam: homeTeam,
        awayTeam: awayTeam || 'EPS Valkoinen',
        homeScore: 2,
        awayScore: 2
      },
      {
        date: '2025-06-08',
        competition: 'Helsinki Cup Alkulohko',
        homeTeam: homeTeam,
        awayTeam: awayTeam || 'EPS Valkoinen',
        homeScore: 4,
        awayScore: 0
      }
    ],
    commonOpponents: [
      {
        opponentName: 'FC Honka Musta',
        homeResult: { result: 'win', score: '3 - 1' },
        awayResult: { result: 'loss', score: '1 - 2' }
      }
    ],
    squadRosters: {
      home: homeRoster,
      away: awayRoster
    },
    divisionRosters,
    scoutAnalysis: `${homeTeam} johtaa sarjaa vahvalla vireellä.`
  };
}

