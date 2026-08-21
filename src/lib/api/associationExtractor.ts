import type {
  OfficialLeagueFixture,
  OfficialTeamData,
  ParsedAssociationUrl,
  PlayerDetailedStats,
  StandingRow,
  TeamSquadRoster
} from '../../types/matchday';

import {
  parseFinnishDateTime,
  getFinnishTimezoneOffset,
  extractVenueAndField,
  normalizePlayerPosition,
  cleanHtmlText,
  parseHtmlTableRows,
  parseTorneopalHtml,
  generateSyntheticOfficialTeamData,
  extractOfficialTeamData,
  DEFAULT_PROXY_URL,
  type ExtractorOptions
} from '../stats/statsEngine';

export {
  parseFinnishDateTime,
  getFinnishTimezoneOffset,
  extractVenueAndField,
  normalizePlayerPosition,
  cleanHtmlText,
  parseHtmlTableRows,
  parseTorneopalHtml,
  generateSyntheticOfficialTeamData,
  extractOfficialTeamData,
  DEFAULT_PROXY_URL,
  type ExtractorOptions
};

export type {
  OfficialLeagueFixture,
  OfficialTeamData,
  ParsedAssociationUrl,
  PlayerDetailedStats,
  StandingRow,
  TeamSquadRoster
};

/**
 * Strips HTML tags and unescapes standard XML entities.
 */
function cleanText(rawHtml: string): string {
  return cleanHtmlText(rawHtml);
}

/**
 * Extracts official fixtures from federation HTML.
 */
export function extractFixturesFromHtml(
  html: string,
  parsedUrl: ParsedAssociationUrl
): OfficialLeagueFixture[] {
  const fixtures: OfficialLeagueFixture[] = [];
  if (!html || typeof html !== 'string') return fixtures;

  // Extract team name from header if present
  let headerTeamName = '';
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match && h1Match[1]) {
    headerTeamName = cleanText(h1Match[1]);
  }

  // Match all <tr> elements inside tbody or fixture containers
  const trRegex = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const trAttrs = trMatch[1] || '';
    const trContent = trMatch[2] || '';

    // Check if this row is a fixture / match row
    const isFixtureRow =
      trAttrs.includes('fixture-row') ||
      trAttrs.includes('match-item') ||
      trAttrs.includes('game-row') ||
      trAttrs.includes('ottelurivi') ||
      trContent.includes('match-date') ||
      trContent.includes('ottelucard') ||
      trContent.includes('details-link') ||
      trContent.includes('erapisteet') ||
      trAttrs.includes('data-match-id');

    if (!isFixtureRow) continue;

    // Match ID
    let matchId = '';
    const matchIdAttr = trAttrs.match(/data-match-id=["']([^"']+)["']/i);
    if (matchIdAttr && matchIdAttr[1]) {
      matchId = matchIdAttr[1];
    } else {
      const linkMatch = trContent.match(/href=["'][^"']*(?:match|ottelu|game|id=)[/=]?([a-zA-Z0-9_-]+)["']/i);
      if (linkMatch && linkMatch[1]) {
        matchId = linkMatch[1];
      } else {
        matchId = `m-${fixtures.length + 1}`;
      }
    }

    // Extract cell values via td tags
    const tds: string[] = [];
    const tdRegex = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      tds.push(cleanText(tdMatch[1] || ''));
    }

    if (tds.length < 4) continue;

    let dateStr = '';
    let timeStr = '';
    let homeTeam = '';
    let score = '';
    let awayTeam = '';
    let venueName = 'Tuntematon kenttä';
    let setScores: string[] | undefined;

    // Association-specific column layouts
    if (tds.length === 4) {
      dateStr = tds[0] || '';
      homeTeam = tds[1] || '';
      awayTeam = tds[2] || '';
      venueName = tds[3] || venueName;
    } else if (parsedUrl.association === 'torneopal') {
      dateStr = tds[0] || '';
      timeStr = tds[1] || '';
      homeTeam = tds[2] || '';
      score = tds[3] || '-';
      awayTeam = tds[4] || '';
      venueName = tds[5] || venueName;
      if (tds[6] && tds[6] !== '-' && tds[6].includes('-')) {
        setScores = tds[6].split(',').map((s) => s.trim());
      }
    } else {
      dateStr = tds[0] || '';
      timeStr = tds[1] || '';
      homeTeam = tds[2] || '';
      score = tds[3] || '-';
      awayTeam = tds[4] || '';
      venueName = tds[5] || venueName;
    }

    // Status classification
    let status: 'upcoming' | 'played' | 'cancelled' | 'postponed' = 'upcoming';
    const rowClassLower = trAttrs.toLowerCase();
    if (rowClassLower.includes('played') || rowClassLower.includes('pelattu') || (score && score !== '-' && /\d+/.test(score))) {
      status = 'played';
    } else if (rowClassLower.includes('cancelled') || rowClassLower.includes('peruttu')) {
      status = 'cancelled';
    } else if (rowClassLower.includes('postponed') || rowClassLower.includes('siirretty')) {
      status = 'postponed';
    }

    // Scores
    let homeScore: number | undefined;
    let awayScore: number | undefined;
    if (score && score !== '-') {
      const scoreMatch = score.match(/(\d+)\s*[-:]\s*(\d+)/);
      if (scoreMatch && scoreMatch[1] && scoreMatch[2]) {
        homeScore = parseInt(scoreMatch[1], 10);
        awayScore = parseInt(scoreMatch[2], 10);
      }
    }

    // Determine home/away relation
    const myTeamLower = (headerTeamName || '').toLowerCase();
    const isHome = myTeamLower ? homeTeam.toLowerCase().includes(myTeamLower) : true;

    const startTime = parseFinnishDateTime(dateStr, timeStr);
    const { fieldNumber } = extractVenueAndField(venueName);

    const fixture: OfficialLeagueFixture = {
      id: `${parsedUrl.association}_${parsedUrl.teamId}_${matchId}`,
      teamId: parsedUrl.teamId,
      association: parsedUrl.association,
      sport: parsedUrl.sport,
      leagueName: headerTeamName ? `${headerTeamName} Sarja` : 'Virallinen Sarja',
      homeTeam,
      awayTeam,
      isHome,
      startTime,
      venueName,
      fieldNumber,
      status,
      score: score !== '-' ? score : undefined,
      homeScore,
      awayScore,
      setScores,
      matchId,
      fetchedAt: new Date().toISOString()
    };

    fixtures.push(fixture);
  }

  return fixtures;
}

/**
 * Extracts league standings table rows from federation HTML.
 */
export function extractStandingsFromHtml(html: string): StandingRow[] {
  const standings: StandingRow[] = [];
  if (!html || typeof html !== 'string') return standings;

  const trRegex = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const trAttrs = trMatch[1] || '';
    const trContent = trMatch[2] || '';

    const isStandingsRow =
      trAttrs.includes('standings-row') ||
      trAttrs.includes('standing-row') ||
      trAttrs.includes('data-rank') ||
      trAttrs.includes('data-sija') ||
      (trAttrs.includes('row') && trContent.includes('data-rank'));

    if (!isStandingsRow) continue;

    const tds: string[] = [];
    const tdRegex = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      tds.push(cleanText(tdMatch[1] || ''));
    }

    if (tds.length < 5) continue;

    const rank = parseInt(tds[0] || '0', 10) || standings.length + 1;
    const teamName = tds[1] || '';
    const played = parseInt(tds[2] || '0', 10);
    const won = parseInt(tds[3] || '0', 10);
    let drawn = 0;
    let lost = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;
    let goalDifference = 0;
    let points = 0;

    if (tds.length >= 10) {
      drawn = parseInt(tds[4] || '0', 10);
      lost = parseInt(tds[5] || '0', 10);
      goalsFor = parseInt(tds[6] || '0', 10);
      goalsAgainst = parseInt(tds[7] || '0', 10);
      goalDifference = parseInt((tds[8] || '0').replace('+', ''), 10);
      points = parseInt(tds[9] || '0', 10);
    } else if (tds.length >= 7) {
      lost = parseInt(tds[4] || '0', 10);
      points = parseInt(tds[tds.length - 1] || '0', 10);
    }

    standings.push({
      rank,
      teamName,
      played,
      won,
      drawn,
      lost,
      goalsFor,
      goalsAgainst,
      goalDifference,
      points,
      form: ['W']
    });
  }

  return standings;
}

/**
 * Extracts player roster from federation HTML.
 */
export function extractRosterFromHtml(html: string): TeamSquadRoster | undefined {
  if (!html || typeof html !== 'string') return undefined;

  let teamName = 'Oma joukkue';
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match && h1Match[1]) {
    teamName = cleanText(h1Match[1]);
  }

  const players: PlayerDetailedStats[] = [];

  // Match the roster / pelaajat section or table
  const rosterTableMatch = html.match(/<(?:section|div|table)[^>]*(?:roster|pelaaja)[^>]*>([\s\S]*?)<\/(?:section|div|table)>/i);
  const searchArea = rosterTableMatch ? rosterTableMatch[0] : html;

  const trRegex = /<tr\b([^>]*)>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trRegex.exec(searchArea)) !== null) {
    const trContent = trMatch[2] || '';

    // Ignore header rows
    if (trContent.includes('<th')) continue;

    const tds: string[] = [];
    const tdRegex = /<td\b[^>]*>([\s\S]*?)<\/td>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      tds.push(cleanText(tdMatch[1] || ''));
    }

    if (tds.length >= 2) {
      const jerseyNumber = parseInt(tds[0] || '0', 10);
      let playerName = tds[1] || '';
      if (!playerName || /^\d+$/.test(playerName)) continue;

      let isCaptain = false;
      if (playerName.includes('(C)')) {
        isCaptain = true;
        playerName = playerName.replace('(C)', '').trim();
      }

      const rawPos = (tds[2] || '').toUpperCase();
      let position: 'GK' | 'DF' | 'MF' | 'FW' = 'MF';
      if (rawPos.includes('GK') || rawPos.includes('MAALIVAHTI') || rawPos.includes('MV') || rawPos.includes('LIBERO')) {
        position = 'GK';
      } else if (rawPos.includes('DF') || rawPos.includes('PUOLUSTAJA') || rawPos.includes('P') || rawPos.includes('KESKITORJUJA')) {
        position = 'DF';
      } else if (rawPos.includes('FW') || rawPos.includes('HYÖKKÄÄJÄ') || rawPos.includes('H') || rawPos.includes('HAKKURI') || rawPos.includes('YLEISPELAAJA')) {
        position = 'FW';
      } else if (rawPos.includes('PASSARI') || rawPos.includes('PG') || rawPos.includes('SG') || rawPos.includes('SF')) {
        position = 'MF';
      }

      const goals = parseInt(tds[3] || '0', 10) || 0;
      const yellowCards = parseInt(tds[4] || '0', 10) || 0;

      players.push({
        jerseyNumber,
        playerName,
        position,
        goals,
        assists: 0,
        matchesPlayed: 1,
        yellowCards,
        redCards: 0,
        isCaptain
      });
    }
  }

  if (players.length === 0) return undefined;

  return {
    teamName,
    players
  };
}

/**
 * Fetches and parses official team data from a federation URL.
 */
export async function fetchOfficialTeamData(
  parsedUrl: ParsedAssociationUrl,
  customFetch: typeof fetch = fetch
): Promise<OfficialTeamData> {
  const res = await customFetch(parsedUrl.canonicalUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch official team data from ${parsedUrl.canonicalUrl}: HTTP ${res.status}`);
  }

  const html = await res.text();
  const fixtures = extractFixturesFromHtml(html, parsedUrl);
  const standings = extractStandingsFromHtml(html);
  const roster = extractRosterFromHtml(html);

  let teamName = parsedUrl.teamId;
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match && h1Match[1]) {
    teamName = cleanText(h1Match[1]);
  }

  return {
    teamId: parsedUrl.teamId,
    association: parsedUrl.association,
    sport: parsedUrl.sport,
    teamName,
    fixtures,
    standings: standings.length > 0 ? standings : undefined,
    roster,
    sourceUrl: parsedUrl.canonicalUrl,
    fetchedAt: new Date().toISOString()
  };
}
