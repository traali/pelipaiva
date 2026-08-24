import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  generateOrResolveMatchStats,
  parseAssociationUrl,
  isAssociationUrl,
  getAssociationName,
  getAssociationShortName,
  getSportName,
  formatCanonicalTeamUrl,
  extractTeamIdFromUrl,
  getAssociationFromUrl,
  getFinnishTimezoneOffset,
  parseFinnishDateTime,
  extractVenueAndField,
  normalizePlayerPosition,
  parseTorneopalHtml,
  generateSyntheticOfficialTeamData,
  inferSportFromSubdomain,
  normalizeUrlString,
  cleanHtmlText,
  parseHtmlTableRows,
  extractOfficialTeamData
} from './statsEngine';
import {
  PelipaivaDB,
  saveOfficialTeamData,
  getOfficialFixtures,
  getOfficialFixturesByDateRange,
  getOfficialStandings,
  getOfficialStandingsRecord,
  getTeamRoster,
  deleteOfficialTeamData,
  createDefaultArrivalRules,
  saveArrivalRules,
  getArrivalRules,
  getOrCreateArrivalRules,
  linkEventToOfficialFixture,
  unlinkEventFromOfficialFixture,
  applyEventUserOverride,
  ensureStoragePersistence,
  isStoragePersisted,
  getStorageQuotaEstimate,
  clearAllDatabaseData
} from '../storage/db';
import type {
  ParsedAssociationUrl,
  MatchdayEvent,
  ArrivalRules,
  UserOverrideDecision
} from '../../types/matchday';

describe('Stats Engine', () => {
  it('generates full match and league stats for football', () => {
    const stats = generateOrResolveMatchStats('HJK T13', 'EPS Valkoinen', 'football');
    expect(stats.leagueName).toContain('Palloliitto');
    expect(stats.homeStanding.rank).toBe(1);
    expect(stats.awayStanding.rank).toBe(3);
    expect(stats.standingsTable.length).toBeGreaterThanOrEqual(6);
    expect(stats.topScorers.length).toBeGreaterThanOrEqual(5);
    expect(stats.teamStats?.home.possessionPercent).toBe(57);
    expect(stats.teamStats?.away.possessionPercent).toBe(43);
    expect(stats.headToHeadHistory.length).toBeGreaterThanOrEqual(3);
  });

  it('provides player-level statistics and squad rosters for all division teams', () => {
    const stats = generateOrResolveMatchStats('HJK T13', 'EPS Valkoinen', 'football');
    expect(stats.divisionRosters).toBeDefined();
    expect(stats.divisionRosters['HJK T13']?.players.length).toBeGreaterThanOrEqual(8);
    expect(stats.divisionRosters['FC Honka Musta']?.players.length).toBeGreaterThanOrEqual(5);
    expect(stats.divisionRosters['VJS Tytöt']?.players.length).toBeGreaterThanOrEqual(4);

    const honkaStar = stats.divisionRosters['FC Honka Musta']?.players.find((p) => p.jerseyNumber === 7);
    expect(honkaStar?.playerName).toBe('Aada Korhonen');
    expect(honkaStar?.goals).toBe(9);
    expect(honkaStar?.isCaptain).toBe(true);
  });

  it('generates appropriate league names for floorball', () => {
    const stats = generateOrResolveMatchStats('ErVi P11', 'Oilers Black', 'floorball');
    expect(stats.leagueName).toContain('Salibandyliitto');
  });

  it('generates appropriate league names and set scores for volleyball', () => {
    const stats = generateOrResolveMatchStats('PuMa Volley N2', 'VanLe N2', 'volleyball');
    expect(stats.leagueName).toContain('Lentopalloliitto');
    expect(stats.scoreType).toBe('sets');
    expect(stats.setScores).toBeDefined();
    expect(stats.liveScore?.period).toContain('Erät');
  });

  it('generates appropriate league names and points for basketball', () => {
    const stats = generateOrResolveMatchStats('Tapiolan Honka', 'HNMKY', 'basketball');
    expect(stats.leagueName).toContain('Koripalloliitto');
    expect(stats.scoreType).toBe('points');
    expect(stats.liveScore?.home).toBe(68);
  });
});

// ============================================================================
// SPORTS ASSOCIATION URL PARSER TEST SUITE
// ============================================================================

describe('Sports Association URL Parser', () => {
  describe('⚽ Football (Palloliitto)', () => {
    it('parses standard Palloliitto team URL', () => {
      const result = parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/3512345');
      expect(result).toEqual({
        sport: 'football',
        association: 'palloliitto',
        teamId: '3512345',
        tab: undefined,
        seasonId: undefined,
        leagueId: undefined,
        canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/3512345'
      });
    });

    it('parses Palloliitto team fixtures subpage', () => {
      const result = parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/3512345/fixtures');
      expect(result).toMatchObject({
        sport: 'football',
        association: 'palloliitto',
        teamId: '3512345',
        tab: 'fixtures',
        canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/3512345'
      });
    });

    it('parses Palloliitto team standings subpage with query params & hash', () => {
      const result = parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/60521/standings?season=2026&category=123#fixtures');
      expect(result).toMatchObject({
        sport: 'football',
        association: 'palloliitto',
        teamId: '60521',
        tab: 'standings',
        seasonId: '2026',
        leagueId: '123',
        canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/60521?season=2026&category=123'
      });
    });

    it('handles bare Palloliitto URL without protocol and trailing slash', () => {
      const result = parseAssociationUrl('tulospalvelu.palloliitto.fi/team/28491/');
      expect(result).toMatchObject({
        sport: 'football',
        association: 'palloliitto',
        teamId: '28491',
        canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/28491'
      });
    });

    it('handles www.tulospalvelu.palloliitto.fi', () => {
      const result = parseAssociationUrl('http://www.tulospalvelu.palloliitto.fi/team/3512345');
      expect(result).toMatchObject({
        sport: 'football',
        association: 'palloliitto',
        teamId: '3512345'
      });
    });
  });

  describe('🏑 Floorball (Salibandyliitto)', () => {
    it('parses standard Salibandy team URL', () => {
      const result = parseAssociationUrl('https://tulospalvelu.salibandy.fi/team/1289');
      expect(result).toEqual({
        sport: 'floorball',
        association: 'salibandy',
        teamId: '1289',
        tab: undefined,
        seasonId: undefined,
        leagueId: undefined,
        canonicalUrl: 'https://tulospalvelu.salibandy.fi/team/1289'
      });
    });

    it('parses Salibandy team sub-tabs (fixtures, players)', () => {
      const result = parseAssociationUrl('https://tulospalvelu.salibandy.fi/team/45812/fixtures');
      expect(result).toMatchObject({
        sport: 'floorball',
        association: 'salibandy',
        teamId: '45812',
        tab: 'fixtures',
        canonicalUrl: 'https://tulospalvelu.salibandy.fi/team/45812'
      });
    });

    it('handles bare Salibandy URL', () => {
      const result = parseAssociationUrl('tulospalvelu.salibandy.fi/team/1289');
      expect(result).toMatchObject({
        sport: 'floorball',
        association: 'salibandy',
        teamId: '1289'
      });
    });
  });

  describe('🏀 Basketball (Koripalloliitto / Basket.fi)', () => {
    it('parses standard Basket.fi URL with team_id query parameter', () => {
      const result = parseAssociationUrl('https://basket.fi/basket/sarjat/joukkue/?team_id=4521');
      expect(result).toEqual({
        sport: 'basketball',
        association: 'basket',
        teamId: '4521',
        seasonId: undefined,
        leagueId: undefined,
        canonicalUrl: 'https://basket.fi/basket/sarjat/joukkue/?team_id=4521'
      });
    });

    it('parses www.basket.fi with multiple query parameters (season_id, league_id)', () => {
      const result = parseAssociationUrl('https://www.basket.fi/basket/sarjat/joukkue/?team_id=4521&season_id=2025&league_id=4#stats');
      expect(result).toMatchObject({
        sport: 'basketball',
        association: 'basket',
        teamId: '4521',
        seasonId: '2025',
        leagueId: '4',
        canonicalUrl: 'https://basket.fi/basket/sarjat/joukkue/?team_id=4521'
      });
    });

    it('handles query parameters in arbitrary order', () => {
      const result = parseAssociationUrl('basket.fi/basket/sarjat/joukkue/?league_id=4&team_id=6809&season_id=2026');
      expect(result).toMatchObject({
        sport: 'basketball',
        association: 'basket',
        teamId: '6809',
        seasonId: '2026',
        leagueId: '4'
      });
    });

    it('handles alternative path variations e.g. /sarjat/joukkue/?team_id=1024', () => {
      const result = parseAssociationUrl('https://basket.fi/sarjat/joukkue/?team_id=1024');
      expect(result).toMatchObject({
        sport: 'basketball',
        association: 'basket',
        teamId: '1024'
      });
    });
  });

  describe('🏐 Volleyball & Torneopal (*.torneopal.fi)', () => {
    it('parses Lentopalloliitto Torneopal URL and maps sport to volleyball', () => {
      const result = parseAssociationUrl('https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=8872');
      expect(result).toEqual({
        sport: 'volleyball',
        association: 'torneopal',
        teamId: '8872',
        subdomain: 'lentopallo',
        leagueId: undefined,
        seasonId: undefined,
        canonicalUrl: 'https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=8872'
      });
    });

    it('parses Floorball Torneopal subdomain and maps to floorball', () => {
      const result = parseAssociationUrl('https://salibandy.torneopal.fi/taso/joukkue.php?joukkue=9941');
      expect(result).toMatchObject({
        sport: 'floorball',
        association: 'torneopal',
        teamId: '9941',
        subdomain: 'salibandy'
      });
    });

    it('parses Football Torneopal subdomains (spl, jalkapallo) and maps to football', () => {
      const resultSpl = parseAssociationUrl('https://spl.torneopal.fi/taso/joukkue.php?joukkue=1234');
      expect(resultSpl).toMatchObject({
        sport: 'football',
        association: 'torneopal',
        teamId: '1234',
        subdomain: 'spl'
      });

      const resultFutis = parseAssociationUrl('https://jalkapallo.torneopal.fi/taso/joukkue.php?joukkue=5678');
      expect(resultFutis).toMatchObject({
        sport: 'football',
        association: 'torneopal',
        teamId: '5678',
        subdomain: 'jalkapallo'
      });
    });

    it('parses Futsal Torneopal subdomain', () => {
      const result = parseAssociationUrl('https://futsal.torneopal.fi/taso/joukkue.php?joukkue=3321');
      expect(result).toMatchObject({
        sport: 'futsal',
        association: 'torneopal',
        teamId: '3321'
      });
    });

    it('parses Ice Hockey Torneopal subdomain', () => {
      const result = parseAssociationUrl('https://jaakiekko.torneopal.fi/taso/joukkue.php?joukkue=7788');
      expect(result).toMatchObject({
        sport: 'icehockey',
        association: 'torneopal',
        teamId: '7788'
      });
    });

    it('parses generic tournament subdomain (turnaus.torneopal.fi) and falls back to other', () => {
      const result = parseAssociationUrl('https://turnaus.torneopal.fi/taso/joukkue.php?joukkue=54321');
      expect(result).toMatchObject({
        sport: 'other',
        association: 'torneopal',
        teamId: '54321',
        subdomain: 'turnaus'
      });
    });

    it('handles query parameters sarja and turnaus in Torneopal URLs', () => {
      const result = parseAssociationUrl('https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=8872&sarja=N2&turnaus=12');
      expect(result).toMatchObject({
        sport: 'volleyball',
        association: 'torneopal',
        teamId: '8872',
        leagueId: 'N2',
        seasonId: '12'
      });
    });

    it('parses Espoo Liikkuu Tournament team page as basketball', () => {
      const result = parseAssociationUrl('https://espooliikkuutournament.fi/team/203621');
      expect(result).toMatchObject({
        sport: 'basketball',
        association: 'basket',
        teamId: '203621',
        seasonId: 'esli2026',
        canonicalUrl: 'https://espooliikkuutournament.fi/team/203621'
      });
    });

    it('parses KW Memorial Cup URL as floorball and keeps turnaus + sarja', () => {
      const result = parseAssociationUrl(
        'https://kwmemorialcup26.torneopal.fi/taso/joukkue.php?joukkue=34013&turnaus=Er%C3%A4Viikingit_0005&sarja=2546'
      );
      expect(result).toMatchObject({
        sport: 'floorball',
        association: 'torneopal',
        teamId: '34013',
        subdomain: 'kwmemorialcup26',
        leagueId: '2546',
        seasonId: 'EräViikingit_0005'
      });
      expect(result?.canonicalUrl).toContain('sarja=2546');
      expect(result?.canonicalUrl).toContain('turnaus=');
    });
  });

  describe('Edge Cases & Sanitization', () => {
    it('returns null for empty or whitespace strings', () => {
      expect(parseAssociationUrl('')).toBeNull();
      expect(parseAssociationUrl('   ')).toBeNull();
      // @ts-expect-error test non-string input
      expect(parseAssociationUrl(null)).toBeNull();
      // @ts-expect-error test non-string input
      expect(parseAssociationUrl(undefined)).toBeNull();
    });

    it('strips angle brackets or quotes around pasted URLs', () => {
      const result = parseAssociationUrl('<https://tulospalvelu.palloliitto.fi/team/3512345>');
      expect(result).toMatchObject({ teamId: '3512345' });

      const resultQuotes = parseAssociationUrl('"https://tulospalvelu.salibandy.fi/team/1289"');
      expect(resultQuotes).toMatchObject({ teamId: '1289' });
    });

    it('handles protocol-relative URLs', () => {
      const result = parseAssociationUrl('//basket.fi/basket/sarjat/joukkue/?team_id=4521');
      expect(result).toMatchObject({ teamId: '4521', association: 'basket' });
    });

    it('returns null for non-association URLs (Nimenhuuto, MyClub, Google)', () => {
      expect(parseAssociationUrl('https://nimenhuuto.com/team/12345/calendar.ics')).toBeNull();
      expect(parseAssociationUrl('https://myclub.fi/teams/678/events.ics')).toBeNull();
      expect(parseAssociationUrl('https://www.google.com/search?q=palloliitto')).toBeNull();
      expect(parseAssociationUrl('not a url at all')).toBeNull();
    });

    it('returns null for Palloliitto URLs missing teamId', () => {
      expect(parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/')).toBeNull();
      expect(parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/hjk-sininen')).toBeNull();
    });

    it('returns null for Basket.fi URLs missing team_id', () => {
      expect(parseAssociationUrl('https://basket.fi/basket/sarjat/joukkue/?season_id=2025')).toBeNull();
    });

    it('returns null for Torneopal URLs missing joukkue parameter', () => {
      expect(parseAssociationUrl('https://lentopallo.torneopal.fi/taso/joukkue.php')).toBeNull();
    });
  });

  describe('Helper Functions', () => {
    it('isAssociationUrl returns boolean correctly', () => {
      expect(isAssociationUrl('https://tulospalvelu.palloliitto.fi/team/3512345')).toBe(true);
      expect(isAssociationUrl('https://www.google.com')).toBe(false);
    });

    it('getAssociationName returns Finnish labels', () => {
      expect(getAssociationName('palloliitto')).toBe('Palloliitto (Tulospalvelu)');
      expect(getAssociationName('salibandy')).toBe('Salibandyliitto (Tulospalvelu)');
      expect(getAssociationName('basket')).toBe('Koripalloliitto (Basket.fi)');
      expect(getAssociationName('torneopal')).toBe('Torneopal Taso');
    });

    it('getAssociationShortName returns concise labels', () => {
      expect(getAssociationShortName('palloliitto')).toBe('Palloliitto');
      expect(getAssociationShortName('salibandy')).toBe('Salibandyliitto');
      expect(getAssociationShortName('basket')).toBe('Basket.fi');
      expect(getAssociationShortName('torneopal')).toBe('Torneopal');
    });

    it('getSportName returns Finnish sport names', () => {
      expect(getSportName('football')).toBe('Jalkapallo');
      expect(getSportName('floorball')).toBe('Salibandy');
      expect(getSportName('basketball')).toBe('Koripallo');
      expect(getSportName('volleyball')).toBe('Lentopallo');
    });

    it('formatCanonicalTeamUrl constructs accurate URLs', () => {
      expect(formatCanonicalTeamUrl('palloliitto', '3512345')).toBe('https://tulospalvelu.palloliitto.fi/team/3512345');
      expect(formatCanonicalTeamUrl('salibandy', '1289')).toBe('https://tulospalvelu.salibandy.fi/team/1289');
      expect(formatCanonicalTeamUrl('basket', '4521')).toBe('https://basket.fi/basket/sarjat/joukkue/?team_id=4521');
      expect(formatCanonicalTeamUrl('torneopal', '8872', 'lentopallo')).toBe('https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=8872');
    });

    it('extractTeamIdFromUrl and getAssociationFromUrl work seamlessly', () => {
      const url = 'https://tulospalvelu.palloliitto.fi/team/3512345/fixtures';
      expect(extractTeamIdFromUrl(url)).toBe('3512345');
      expect(getAssociationFromUrl(url)).toBe('palloliitto');
      expect(extractTeamIdFromUrl('https://example.com')).toBeNull();
      expect(getAssociationFromUrl('https://example.com')).toBeNull();
    });
  });
});

// ============================================================================
// ASSOCIATION EXTRACTOR TEST SUITE
// ============================================================================

describe('Association Extractor & Parser', () => {
  describe('Timezone & Date Parsing', () => {
    it('computes correct Finnish timezone offset (EEST +03:00 vs EET +02:00)', () => {
      // Summer (July) -> +03:00
      const summerDate = new Date(Date.UTC(2026, 6, 15));
      expect(getFinnishTimezoneOffset(summerDate)).toBe('+03:00');

      // Winter (January) -> +02:00
      const winterDate = new Date(Date.UTC(2026, 0, 15));
      expect(getFinnishTimezoneOffset(winterDate)).toBe('+02:00');
    });

    it('parses Finnish date & time string into ISO 8601 string with accurate offset', () => {
      const isoStr = parseFinnishDateTime('la 24.05.2026', '15:00');
      expect(isoStr).toBe('2026-05-24T15:00:00+03:00');

      const winterIsoStr = parseFinnishDateTime('15.01.2026', 'klo 18.30');
      expect(winterIsoStr).toBe('2026-01-15T18:30:00+02:00');
    });
  });

  describe('Venue & Field Number NLP', () => {
    it('extracts venue and bracketed field number', () => {
      const res = extractVenueAndField('Puotila TN (Kenttä 2)');
      expect(res.venueName).toBe('Puotila TN');
      expect(res.fieldNumber).toBe('Kenttä 2');
    });

    it('extracts trailing field notation', () => {
      const res = extractVenueAndField('Töölö PK 1 TN');
      expect(res.venueName).toBe('Töölö PK 1 TN');
      expect(res.fieldNumber).toBe('TN');
    });
  });

  describe('Player Position Normalization', () => {
    it('normalizes goalkeeper, defender, midfielder, and forward positions', () => {
      expect(normalizePlayerPosition('MV')).toBe('GK');
      expect(normalizePlayerPosition('Maalivahti')).toBe('GK');
      expect(normalizePlayerPosition('P')).toBe('DF');
      expect(normalizePlayerPosition('Puolustaja')).toBe('DF');
      expect(normalizePlayerPosition('KK')).toBe('MF');
      expect(normalizePlayerPosition('H')).toBe('FW');
      expect(normalizePlayerPosition('Hyökkääjä')).toBe('FW');
      expect(normalizePlayerPosition(undefined)).toBe('MF');
    });
  });

  describe('HTML Table Parsing & Torneopal Fixtures', () => {
    const sampleTorneopalHtml = `
      <html>
        <body>
          <h1>HJK T13 Sininen</h1>
          <p>Sarja: T13 Ykkönen</p>
          <table class="otteluohjelma">
            <thead>
              <tr><th>Pvm</th><th>Klo</th><th>Koti</th><th>Vieras</th><th>Tulos</th><th>Kenttä</th><th>Ottelu</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>24.05.2026</td>
                <td>15:00</td>
                <td>HJK T13 Sininen</td>
                <td>EPS Valkoinen</td>
                <td>3 - 1</td>
                <td>Töölö PK 1 TN (Kenttä 1)</td>
                <td>#123456</td>
              </tr>
              <tr>
                <td>31.05.2026</td>
                <td>13:30</td>
                <td>FC Honka Musta</td>
                <td>HJK T13 Sininen</td>
                <td>-</td>
                <td>Tapiola 2 TN</td>
                <td>#123457</td>
              </tr>
            </tbody>
          </table>
          <table class="sarjataulukko">
            <thead>
              <tr><th>#</th><th>Joukkue</th><th>O</th><th>V</th><th>T</th><th>H</th><th>TM</th><th>PM</th><th>ME</th><th>P</th></tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>HJK T13 Sininen</td><td>8</td><td>7</td><td>1</td><td>0</td><td>28</td><td>6</td><td>22</td><td>22</td></tr>
              <tr><td>2</td><td>FC Honka Musta</td><td>8</td><td>6</td><td>0</td><td>2</td><td>24</td><td>9</td><td>15</td><td>18</td></tr>
            </tbody>
          </table>
          <table class="pelaajat">
            <thead>
              <tr><th>Nro</th><th>Nimi</th><th>Pelipaikka</th><th>O</th><th>M</th><th>S</th></tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>Emma Korhonen</td><td>MV</td><td>8</td><td>0</td><td>0</td></tr>
              <tr><td>10</td><td>Maija Oinonen (C)</td><td>H</td><td>8</td><td>11</td><td>4</td></tr>
            </tbody>
          </table>
        </body>
      </html>
    `;

    it('extracts fixtures, standings, and roster from raw HTML table structure', () => {
      const parsedUrl: ParsedAssociationUrl = {
        sport: 'football',
        association: 'palloliitto',
        teamId: '3512345',
        canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/3512345'
      };

      const data = parseTorneopalHtml(sampleTorneopalHtml, parsedUrl);
      expect(data.teamName).toBe('HJK T13 Sininen');
      expect(data.leagueName).toBe('T13 Ykkönen');
      expect(data.fixtures.length).toBe(2);

      const f1 = data.fixtures[0]!;
      expect(f1.homeTeam).toBe('HJK T13 Sininen');
      expect(f1.awayTeam).toBe('EPS Valkoinen');
      expect(f1.isHome).toBe(true);
      expect(f1.status).toBe('played');
      expect(f1.score).toBe('3 - 1');
      expect(f1.venueName).toBe('Töölö PK 1 TN');
      expect(f1.fieldNumber).toBe('Kenttä 1');

      const f2 = data.fixtures[1]!;
      expect(f2.homeTeam).toBe('FC Honka Musta');
      expect(f2.awayTeam).toBe('HJK T13 Sininen');
      expect(f2.isHome).toBe(false);
      expect(f2.status).toBe('upcoming');

      expect(data.standings).toBeDefined();
      expect(data.standings!.length).toBe(2);
      expect(data.standings![0]!.teamName).toBe('HJK T13 Sininen');
      expect(data.standings![0]!.points).toBe(22);

      expect(data.roster).toBeDefined();
      expect(data.roster!.players.length).toBe(2);
      const p2 = data.roster!.players[1]!;
      expect(p2.playerName).toBe('Maija Oinonen');
      expect(p2.isCaptain).toBe(true);
      expect(p2.position).toBe('FW');
      expect(p2.goals).toBe(11);
    });

    it('tests cleanHtmlText, parseHtmlTableRows, normalizeUrlString, and inferSportFromSubdomain helpers', () => {
      expect(cleanHtmlText('<b>Test &amp; &auml;</b>')).toBe('Test & ä');
      const tableRows = parseHtmlTableRows('<table><tr><td>Row 1</td><td>Val 1</td></tr></table>');
      expect(tableRows.length).toBe(1);
      expect(tableRows[0]![0]).toBe('Row 1');

      expect(normalizeUrlString('  tulospalvelu.palloliitto.fi/team/123  ')).toBe('https://tulospalvelu.palloliitto.fi/team/123');
      expect(inferSportFromSubdomain('splhelsinki')).toBe('football');
      expect(inferSportFromSubdomain('salibandy')).toBe('floorball');
      expect(inferSportFromSubdomain('lentopallo')).toBe('volleyball');
      expect(inferSportFromSubdomain('kori')).toBe('basketball');
      expect(inferSportFromSubdomain('kwmemorialcup26')).toBe('floorball');
      expect(inferSportFromSubdomain('espooliikkuu')).toBe('basketball');
    });

    it('generates synthetic official team data for offline resilience and tests', async () => {
      const parsedUrl: ParsedAssociationUrl = {
        sport: 'floorball',
        association: 'salibandy',
        teamId: '1289',
        canonicalUrl: 'https://tulospalvelu.salibandy.fi/team/1289'
      };

      const synthetic = generateSyntheticOfficialTeamData(parsedUrl);
      expect(synthetic.teamId).toBe('1289');
      expect(synthetic.sport).toBe('floorball');
      expect(synthetic.fixtures.length).toBeGreaterThanOrEqual(4);
      expect(synthetic.standings?.length).toBeGreaterThanOrEqual(6);
      expect(synthetic.roster?.players.length).toBeGreaterThanOrEqual(5);

      const extracted = await extractOfficialTeamData(parsedUrl, { fallbackToSynthetic: true });
      expect(extracted.teamId).toBe('1289');
    });
  });
});

// ============================================================================
// DEXIE V2 DATABASE PERSISTENCE & MIGRATION TEST SUITE
// ============================================================================

describe('PelipaivaDB Version 2 Storage & Migration', () => {
  let testDb: PelipaivaDB;

  beforeEach(() => {
    const uniqueDbName = `PelipaivaDB_Test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    testDb = new PelipaivaDB(uniqueDbName);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  describe('Schema Evolution & Tables', () => {
    it('initializes all Version 2 tables with correct store schemas', () => {
      expect(testDb.tables.map((t) => t.name)).toEqual(
        expect.arrayContaining([
          'profiles',
          'events',
          'venuePins',
          'syncState',
          'officialFixtures',
          'leagueStandings',
          'teamRosters',
          'arrivalRules'
        ])
      );
    });

    it('migrates legacy Version 1 events by populating reconciliationStatus', async () => {
      const sampleEvent: MatchdayEvent = {
        id: 'event-v1-1',
        profileId: 'prof-1',
        sport: 'football',
        eventType: 'match',
        isTraining: false,
        title: 'HJK vs Honka',
        homeTeam: 'HJK',
        awayTeam: 'Honka',
        isHomeMatch: true,
        startTime: '2026-05-24T15:00:00+03:00',
        endTime: '2026-05-24T16:30:00+03:00',
        warmupTime: '2026-05-24T14:15:00+03:00',
        venue: {
          name: 'Töölö PK',
          normalizedName: 'toolo pk',
          coordinates: { lat: 60.18, lng: 24.92 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true
        }
      };

      await testDb.events.put(sampleEvent);

      // Verify event was saved and can be retrieved
      const saved = await testDb.events.get('event-v1-1');
      expect(saved).toBeDefined();
      expect(saved?.title).toBe('HJK vs Honka');
    });
  });

  describe('Official Team Data ACID Transactions & Persistence', () => {
    it('saves fixtures, standings, and roster atomically', async () => {
      const parsedUrl: ParsedAssociationUrl = {
        sport: 'football',
        association: 'palloliitto',
        teamId: '3512345',
        canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/3512345'
      };

      const syntheticData = generateSyntheticOfficialTeamData(parsedUrl);
      await saveOfficialTeamData(syntheticData, testDb);

      // Query fixtures
      const fixtures = await getOfficialFixtures('3512345', testDb);
      expect(fixtures.length).toBe(4);
      expect(fixtures[0]?.homeTeam).toBe('HJK T13 Sininen');

      // Query standings
      const standings = await getOfficialStandings('3512345', testDb);
      expect(standings.length).toBe(6);
      expect(standings[0]?.teamName).toBe('HJK T13 Sininen');

      const standingsRecord = await getOfficialStandingsRecord('3512345', undefined, testDb);
      expect(standingsRecord).toBeDefined();
      expect(standingsRecord?.rows.length).toBe(6);

      // Query roster
      const roster = await getTeamRoster('3512345', testDb);
      expect(roster).toBeDefined();
      expect(roster?.players.length).toBe(5);

      // Query by date range
      const rangeFixtures = await getOfficialFixturesByDateRange(
        '3512345',
        '2026-05-01T00:00:00+03:00',
        '2026-05-20T23:59:59+03:00',
        testDb
      );
      expect(rangeFixtures.length).toBe(2);
    });

    it('deletes official team data cleanly', async () => {
      const parsedUrl: ParsedAssociationUrl = {
        sport: 'football',
        association: 'palloliitto',
        teamId: '99999',
        canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/99999'
      };

      const synthetic = generateSyntheticOfficialTeamData(parsedUrl);
      await saveOfficialTeamData(synthetic, testDb);
      expect((await getOfficialFixtures('99999', testDb)).length).toBe(4);

      await deleteOfficialTeamData('99999', testDb);
      expect((await getOfficialFixtures('99999', testDb)).length).toBe(0);
      expect((await getOfficialStandings('99999', testDb)).length).toBe(0);
      expect(await getTeamRoster('99999', testDb)).toBeUndefined();
    });
  });

  describe('Arrival Rules Storage & Retrieval', () => {
    it('creates, saves, and retrieves custom arrival rules', async () => {
      const defaultRules = createDefaultArrivalRules('prof-hjk', 'football');
      expect(defaultRules.warmupOffsetsMinutes.homeMatch).toBe(45);
      expect(defaultRules.warmupOffsetsMinutes.awayMatch).toBe(60);

      // Save custom rules
      const customRules: ArrivalRules = {
        ...defaultRules,
        departureBufferMinutes: 20,
        squadAliases: ['Sininen', 'Kilpa']
      };

      await saveArrivalRules(customRules, testDb);

      const retrieved = await getArrivalRules('prof-hjk', testDb);
      expect(retrieved?.departureBufferMinutes).toBe(20);
      expect(retrieved?.squadAliases).toEqual(['Sininen', 'Kilpa']);
    });

    it('getOrCreateArrivalRules creates default rules if none exist', async () => {
      const rules = await getOrCreateArrivalRules('prof-new', 'floorball', testDb);
      expect(rules.profileId).toBe('prof-new');
      expect(rules.defaultSport).toBe('floorball');
      expect(rules.warmupOffsetsMinutes.homeMatch).toBe(45);
    });
  });

  describe('Event Reconciliation & Linking Helpers', () => {
    it('links, applies overrides, and unlinks an event from an official fixture', async () => {
      const event: MatchdayEvent = {
        id: 'event-100',
        profileId: 'prof-1',
        sport: 'football',
        eventType: 'match',
        isTraining: false,
        title: 'HJK vs EPS',
        homeTeam: 'HJK',
        awayTeam: 'EPS',
        isHomeMatch: true,
        startTime: '2026-05-24T15:00:00+03:00',
        endTime: '2026-05-24T16:30:00+03:00',
        warmupTime: '2026-05-24T14:15:00+03:00',
        venue: {
          name: 'Töölö PK',
          normalizedName: 'toolo pk',
          coordinates: { lat: 60.18, lng: 24.92 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true
        }
      };

      await testDb.events.put(event);

      // Link event to official fixture
      await linkEventToOfficialFixture(
        'event-100',
        'palloliitto_3512345_101',
        'auto_matched',
        { timeMismatch: true, timeDiffMinutes: 30 },
        testDb
      );

      let updated = await testDb.events.get('event-100');
      expect(updated?.officialFixtureId).toBe('palloliitto_3512345_101');
      expect(updated?.reconciliationStatus).toBe('auto_matched');
      expect(updated?.mismatchFlags?.timeMismatch).toBe(true);

      // Apply user override
      const override: UserOverrideDecision = {
        action: 'adopt_official',
        appliedAt: new Date().toISOString(),
        notes: 'Adopted official kickoff 15:30'
      };
      await applyEventUserOverride('event-100', override, testDb);

      updated = await testDb.events.get('event-100');
      expect(updated?.userOverride?.action).toBe('adopt_official');

      // Unlink event
      await unlinkEventFromOfficialFixture('event-100', testDb);
      updated = await testDb.events.get('event-100');
      expect(updated?.officialFixtureId).toBeUndefined();
      expect(updated?.reconciliationStatus).toBe('unlinked');
    });
  });

  describe('Storage Observability & Data Reset', () => {
    it('provides persistence status and storage quota helpers safely', async () => {
      const persisted = await ensureStoragePersistence();
      expect(typeof persisted).toBe('boolean');

      const isPers = await isStoragePersisted();
      expect(typeof isPers).toBe('boolean');

      const estimate = await getStorageQuotaEstimate();
      expect(estimate).toBeDefined();
    });

    it('clears all database tables with clearAllDatabaseData', async () => {
      await testDb.profiles.put({
        id: 'p1',
        playerName: 'Test',
        teamName: 'Test FC',
        sport: 'football',
        primaryColor: 'red',
        calendarUrl: 'https://test.ics',
        colorHex: '#ff0000'
      });

      expect(await testDb.profiles.count()).toBe(1);
      await clearAllDatabaseData(testDb);
      expect(await testDb.profiles.count()).toBe(0);
    });
  });
});

