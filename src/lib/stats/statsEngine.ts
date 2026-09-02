import { generateSyntheticOfficialTeamData } from "../testing/syntheticMockFactory";
import { parseFinnishDateTime } from "../api/associationUrlParser";
import type {
  TeamSquadRoster,
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
// RE-EXPORTS FROM SPECIALIZED MODULES (Decoupled SRP Architecture)
// ============================================================================
export {
  SUBDOMAIN_SPORT_MAP,
  normalizeUrlString,
  inferSportFromSubdomain,
  parseAssociationUrl,
  isAssociationUrl,
  getAssociationName,
  getAssociationShortName,
  getSportName,
  formatCanonicalTeamUrl,
  extractTeamIdFromUrl,
  getAssociationFromUrl,
  detectAssociationType,
  normalizeAssociationUrl,
  getFinnishTimezoneOffset,
  parseFinnishDateTime,
} from '../api/associationUrlParser';

export {
  generateSyntheticOfficialTeamData,
} from '../testing/syntheticMockFactory';

export {
  SportRulesRegistry,
  FootballStrategy,
  FloorballStrategy,
  BasketballStrategy,
  VolleyballStrategy,
  IceHockeyStrategy,
  type SportScoringStrategy,
} from './SportRulesRegistry';

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

    // Try to detect section/stage header right before this table (e.g. Alkulohko B, Jatko-ottelut, Sijat 1-4)
    let tableStage: string | undefined = undefined;
    const tableIndex = html.indexOf(tableHtml);
    if (tableIndex > 0) {
      const precedingHtml = html.slice(Math.max(0, tableIndex - 500), tableIndex);
      const headingMatch =
        precedingHtml.match(/<(?:h[2-5]|div|caption)[^>]*class=["'][^"']*(?:otsikko|stage|title|sarja|lohko)[^"']*["'][^>]*>([\s\S]*?)<\/(?:h[2-5]|div|caption)>/i) ||
        precedingHtml.match(/<(?:h[2-5]|caption)[^>]*>([\s\S]*?)<\/(?:h[2-5]|caption)>/i);
      if (headingMatch && headingMatch[1]) {
        const text = cleanHtmlText(headingMatch[1]);
        if (text && text.length > 2 && text.length < 80 && !/suosikiksi/i.test(text)) {
          tableStage = text;
        }
      }
    }

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
        if (startTime.startsWith('1970-01-01')) continue;
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
          round: tableStage || leagueName,
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
            form: []
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

  // Cup subdomains and basket SPA shells have no fixture tables. Worker
  // proxy 403s those hosts — skip HTML instead of failing the ingest.
  const skipHtml =
    parsedUrl.association === 'basket' ||
    Boolean(parsedUrl.subdomain && /cup|memorial|turnaus|tournament|kwmemorial/i.test(parsedUrl.subdomain));
  if (skipHtml) {
    return (
      jsonData || {
        teamId: parsedUrl.teamId,
        association: parsedUrl.association,
        sport: parsedUrl.sport,
        teamName: customTeamName,
        fixtures: [],
        sourceUrl: parsedUrl.canonicalUrl,
        fetchedAt: new Date().toISOString()
      }
    );
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

