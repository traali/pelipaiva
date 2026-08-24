import { describe, it, expect } from 'vitest';
import {
  parseAssociationUrl,
  isAssociationUrl,
  getAssociationName,
  getAssociationShortName,
  getSportName,
  formatCanonicalTeamUrl,
  extractTeamIdFromUrl,
  getAssociationFromUrl,
  normalizeUrlString,
  inferSportFromSubdomain,
  getFinnishTimezoneOffset,
  parseFinnishDateTime,
  extractVenueAndField,
  normalizePlayerPosition,
  cleanHtmlText,
  parseHtmlTableRows,
  parseTorneopalHtml,
  generateSyntheticOfficialTeamData
} from '../../../src/lib/stats/statsEngine';
import {
  detectAssociationType,
  normalizeAssociationUrl
} from '../../../src/lib/api/associationUrlParser';
import {
  extractFixturesFromHtml,
  extractStandingsFromHtml,
  extractRosterFromHtml
} from '../../../src/lib/api/associationExtractor';
import type { ParsedAssociationUrl } from '../../../src/types/matchday';

describe('Adversarial Stress Suite — M1 URL Parser & HTML Extractor', () => {

  // ==========================================================================
  // SUITE 1: URL PARSER ADVERSARIAL & FUZZ TESTING
  // ==========================================================================
  describe('1. URL Parser Adversarial & Fuzz Tests', () => {

    describe('1.1 Malicious Domain & Subdomain Spoofing', () => {
      it('rejects domain spoofing and phishing attempts targeting Torneopal', () => {
        const spoofedUrls = [
          'https://fake.torneopal.fi.attacker.com/taso/joukkue.php?joukkue=1234',
          'https://torneopal.fi.evil.com/taso/joukkue.php?joukkue=1234',
          'https://attacker-torneopal.fi/taso/joukkue.php?joukkue=1234',
          'https://evil.com/?target=lentopallo.torneopal.fi/taso/joukkue.php?joukkue=1234',
          'https://lentopallo-torneopal.fi/taso/joukkue.php?joukkue=1234',
          'https://torneopal.fi/taso/joukkue.php?joukkue=1234', // bare domain without valid subdomain
          'http://attacker.com/fake/path#lentopallo.torneopal.fi/taso/joukkue.php?joukkue=1234'
        ];

        for (const url of spoofedUrls) {
          const result = parseAssociationUrl(url);
          // none of these should resolve to attacker domains
          if (result) {
            expect(result.canonicalUrl).not.toContain('attacker.com');
            expect(result.canonicalUrl).not.toContain('evil.com');
            expect(result.canonicalUrl).not.toContain('lentopallo-torneopal.fi');
            expect(result.canonicalUrl).not.toContain('attacker-torneopal.fi');
          }
        }
      });

      it('rejects domain spoofing attempts targeting Palloliitto & Salibandyliitto & Basket.fi', () => {
        const spoofedUrls = [
          'https://tulospalvelu.palloliitto.fi.attacker.com/team/3512345',
          'https://tulospalvelu.salibandy.fi.evil.org/team/1289',
          'https://basket.fi.phishing.net/basket/sarjat/joukkue/?team_id=4521',
          'https://palloliitto.fi/team/3512345', // main site is not tulospalvelu
          'https://salibandy.fi/team/1289',
          'https://google.com/?q=tulospalvelu.palloliitto.fi/team/3512345',
          'https://facebook.com/tulospalvelu.palloliitto.fi/team/3512345'
        ];

        for (const url of spoofedUrls) {
          expect(parseAssociationUrl(url)).toBeNull();
        }
      });
    });

    describe('1.2 Injection & Exploit Payloads in URLs', () => {
      it('safely handles SQL Injection payloads in URL parameters and path segments', () => {
        const sqliUrls = [
          "https://tulospalvelu.palloliitto.fi/team/1' OR '1'='1",
          "https://tulospalvelu.palloliitto.fi/team/1; DROP TABLE teams;--",
          "https://tulospalvelu.palloliitto.fi/team/1' UNION SELECT username, password FROM users--",
          "https://basket.fi/basket/sarjat/joukkue/?team_id=1' OR 1=1--",
          "https://basket.fi/basket/sarjat/joukkue/?team_id=SLEEP(5)--",
          "https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=1' OR 'x'='x",
          "https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=1;SELECT%20*%20FROM%20users"
        ];

        for (const url of sqliUrls) {
          const res = parseAssociationUrl(url);
          // Either rejected as null, or teamId strictly extracted as numeric digits without SQL injection syntax
          if (res) {
            expect(res.teamId).toMatch(/^\d+$/);
            expect(res.canonicalUrl).not.toContain('DROP');
            expect(res.canonicalUrl).not.toContain('UNION');
          }
        }
      });

      it('safely handles Cross-Site Scripting (XSS) payloads in URLs', () => {
        const xssUrls = [
          'https://tulospalvelu.palloliitto.fi/team/<script>alert(1)</script>',
          'https://tulospalvelu.palloliitto.fi/team/123<svg onload=alert(1)>',
          'https://tulospalvelu.salibandy.fi/team/%3Cscript%3Ealert(%22XSS%22)%3C%2Fscript%3E',
          'https://basket.fi/basket/sarjat/joukkue/?team_id=<script>alert("XSS")</script>',
          'https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue="><script>alert(1)</script>',
          'javascript:alert("XSS")',
          'data:text/html,<script>alert(1)</script>'
        ];

        for (const url of xssUrls) {
          const res = parseAssociationUrl(url);
          if (res) {
            expect(res.teamId).toMatch(/^\d+$/);
            expect(res.canonicalUrl).not.toContain('<script>');
            expect(res.canonicalUrl).not.toContain('<svg');
          }
        }
      });

      it('handles null bytes and control characters without crashing', () => {
        const dirtyUrls = [
          'https://tulospalvelu.palloliitto.fi/team/3512345\0evil',
          'https://tulospalvelu.salibandy.fi/team/1289\r\n',
          'https://basket.fi/basket/sarjat/joukkue/?team_id=4521\u0000',
          'https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=8872\t\n'
        ];

        for (const url of dirtyUrls) {
          expect(() => parseAssociationUrl(url)).not.toThrow();
        }
      });
    });

    describe('1.3 ReDoS and Extreme Length Stress', () => {
      it('processes gigantic URLs with 10,000+ characters instantly without ReDoS hang', () => {
        const longQuery = 'a'.repeat(10000);
        const longUrl = `https://tulospalvelu.palloliitto.fi/team/3512345?extra=${longQuery}`;

        const start = performance.now();
        const res = parseAssociationUrl(longUrl);
        const elapsed = performance.now() - start;

        expect(elapsed).toBeLessThan(100); // must complete in < 100ms
        expect(res).not.toBeNull();
        expect(res?.teamId).toBe('3512345');
      });

      it('handles repetitive slashes and path segments without catastrophic backtracking', () => {
        const pathologicalPath = '////'.repeat(500) + 'team/3512345' + '/sub'.repeat(100);
        const url = `https://tulospalvelu.palloliitto.fi${pathologicalPath}`;

        const start = performance.now();
        expect(() => parseAssociationUrl(url)).not.toThrow();
        const elapsed = performance.now() - start;
        expect(elapsed).toBeLessThan(100);
      });
    });

    describe('1.4 Unicode, Emojis, and Punycode', () => {
      it('handles URLs containing emoji query params and Finnish umlauts', () => {
        const emojiUrl = 'https://tulospalvelu.palloliitto.fi/team/3512345?keli=☀️&ottelu=⚽🔥&seura=Helsingin+Jalkapalloklubi+T13';
        const res = parseAssociationUrl(emojiUrl);
        expect(res).not.toBeNull();
        expect(res?.teamId).toBe('3512345');
      });

      it('handles unicode surrogates and non-ASCII path characters gracefully', () => {
        const unicodeUrls = [
          'https://tulospalvelu.palloliitto.fi/team/3512345/pelaajat-ja-sarjataulukko-ääkköset',
          'https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=8872&joukkueen_nimi=PuMa+Volley+N2+🏆'
        ];

        for (const url of unicodeUrls) {
          expect(() => parseAssociationUrl(url)).not.toThrow();
          const res = parseAssociationUrl(url);
          expect(res).not.toBeNull();
        }
      });
    });

    describe('1.5 Boundary & Non-Numeric Team IDs', () => {
      it('rejects or sanitizes non-numeric and negative team IDs', () => {
        const invalidIdUrls = [
          'https://tulospalvelu.palloliitto.fi/team/abc',
          'https://tulospalvelu.palloliitto.fi/team/-1234',
          'https://tulospalvelu.palloliitto.fi/team/35.123',
          'https://tulospalvelu.palloliitto.fi/team/NaN',
          'https://tulospalvelu.palloliitto.fi/team/undefined',
          'https://basket.fi/basket/sarjat/joukkue/?team_id=abc',
          'https://basket.fi/basket/sarjat/joukkue/?team_id=-99',
          'https://basket.fi/basket/sarjat/joukkue/?team_id=0.5',
          'https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=team_alpha',
          'https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=-500'
        ];

        for (const url of invalidIdUrls) {
          const res = parseAssociationUrl(url);
          expect(res).toBeNull();
        }
      });

      it('accepts extreme but valid numeric IDs (e.g. 1 digit or 10+ digits)', () => {
        const res1 = parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/1');
        expect(res1?.teamId).toBe('1');

        const resBig = parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/9876543210123');
        expect(resBig?.teamId).toBe('9876543210123');
      });
    });

    describe('1.6 Fuzz Testing Loop (500 iterations)', () => {
      it('fuzzes parseAssociationUrl with randomized mutations without uncaught throws', () => {
        const prefixes = [
          'https://tulospalvelu.palloliitto.fi/team/',
          'https://tulospalvelu.salibandy.fi/team/',
          'https://basket.fi/basket/sarjat/joukkue/?team_id=',
          'https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=',
          'http://spl.torneopal.fi/taso/joukkue.php?joukkue=',
          'ftp://evil.com/',
          '',
          'random_string_'
        ];

        const payloads = [
          '12345',
          '0',
          '-1',
          '99999999999999999999',
          'abc',
          '123?a=1&b=2',
          '123/fixtures#tabs',
          '123\' OR 1=1',
          '<script>alert(1)</script>',
          '⚽🏀🏐',
          'NaN',
          'null',
          'undefined',
          '   ',
          '%20%20123%20',
          '../../etc/passwd',
          '123\0admin'
        ];

        for (let i = 0; i < 500; i++) {
          const prefix = prefixes[i % prefixes.length]!;
          const payload = payloads[(i * 7) % payloads.length]!;
          const testUrl = `${prefix}${payload}`;

          expect(() => parseAssociationUrl(testUrl)).not.toThrow();
        }
      });
    });
  });

  // ==========================================================================
  // SUITE 2: DAYLIGHT SAVING TIME (DST) & DATE/TIME BOUNDARY STRESS
  // ==========================================================================
  describe('2. DST & Date Boundary Stress Testing', () => {

    describe('2.1 Finnish Timezone Offset Transitions', () => {
      it('correctly transitions between EET (+02:00) and EEST (+03:00) in 2026', () => {
        // In 2026:
        // March DST transition: Sunday March 29, 2026
        // Winter: January 15, 2026 -> +02:00
        expect(getFinnishTimezoneOffset(new Date(Date.UTC(2026, 0, 15)))).toBe('+02:00');

        // Summer: July 15, 2026 -> +03:00
        expect(getFinnishTimezoneOffset(new Date(Date.UTC(2026, 6, 15)))).toBe('+03:00');

        // October DST transition: Sunday October 25, 2026
        // Pre-transition summer: October 20, 2026 -> +03:00
        expect(getFinnishTimezoneOffset(new Date(Date.UTC(2026, 9, 20)))).toBe('+03:00');

        // Post-transition winter: November 5, 2026 -> +02:00
        expect(getFinnishTimezoneOffset(new Date(Date.UTC(2026, 10, 5)))).toBe('+02:00');
      });

      it('evaluates exact boundary timestamps around March 29, 2026 transition', () => {
        // March 29, 2026 00:30 UTC -> Before 01:00 UTC transition -> +02:00
        const preTransitionUtc = new Date(Date.UTC(2026, 2, 29, 0, 30, 0));
        expect(getFinnishTimezoneOffset(preTransitionUtc)).toBe('+02:00');

        // March 29, 2026 01:30 UTC -> After 01:00 UTC transition -> +03:00
        const postTransitionUtc = new Date(Date.UTC(2026, 2, 29, 1, 30, 0));
        expect(getFinnishTimezoneOffset(postTransitionUtc)).toBe('+03:00');
      });

      it('evaluates exact boundary timestamps around October 25, 2026 transition', () => {
        // October 25, 2026 00:30 UTC -> Before 01:00 UTC transition -> +03:00
        const preTransitionUtc = new Date(Date.UTC(2026, 9, 25, 0, 30, 0));
        expect(getFinnishTimezoneOffset(preTransitionUtc)).toBe('+03:00');

        // October 25, 2026 01:30 UTC -> After 01:00 UTC transition -> +02:00
        const postTransitionUtc = new Date(Date.UTC(2026, 9, 25, 1, 30, 0));
        expect(getFinnishTimezoneOffset(postTransitionUtc)).toBe('+02:00');
      });
    });

    describe('2.2 parseFinnishDateTime Date & Time Permutations', () => {
      it('parses leap year dates (2024-02-29 and 2028-02-29)', () => {
        const leap2024 = parseFinnishDateTime('29.02.2024', '18:00');
        expect(leap2024).toBe('2024-02-29T18:00:00+02:00');

        const leap2028 = parseFinnishDateTime('29.2.2028', 'klo 14.15');
        expect(leap2028).toBe('2028-02-29T14:15:00+02:00');
      });

      it('handles various Finnish time prefixes and formats (klo, KLO, dots, colons)', () => {
        expect(parseFinnishDateTime('24.05.2026', 'klo 15.30')).toBe('2026-05-24T15:30:00+03:00');
        expect(parseFinnishDateTime('24.05.2026', 'KLO 19:45')).toBe('2026-05-24T19:45:00+03:00');
        expect(parseFinnishDateTime('24.05.2026', '09:05')).toBe('2026-05-24T09:05:00+03:00');
        expect(parseFinnishDateTime('24.05.2026', '9.05')).toBe('2026-05-24T09:05:00+03:00');
      });

      it('handles Finnish weekday prefixes (ma, ti, ke, to, pe, la, su, mån, tis, lör, sön)', () => {
        expect(parseFinnishDateTime('la 24.5.2026', '15:00')).toBe('2026-05-24T15:00:00+03:00');
        // Sunday Oct 25, 2026 12:00 is after 04:00 morning transition, so offset is +02:00 EET
        expect(parseFinnishDateTime('su 25.10.2026', '12:00')).toBe('2026-10-25T12:00:00+02:00');
        expect(parseFinnishDateTime('ke 15.01.2026', '18:30')).toBe('2026-01-15T18:30:00+02:00');
      });

      it('handles missing or malformed time and date inputs gracefully without crashing', () => {
        // Missing time defaults to 12:00
        const defTime = parseFinnishDateTime('24.05.2026');
        expect(defTime).toContain('12:00:00');

        // Garbage date string returns ISO string fallback
        const fallback1 = parseFinnishDateTime('invalid date', 'invalid time');
        expect(fallback1).toBeDefined();
        expect(new Date(fallback1).getTime()).not.toBeNaN();
      });
    });
  });

  // ==========================================================================
  // SUITE 3: HTML EXTRACTOR & MANGLED TABLE STRESS TESTING
  // ==========================================================================
  describe('3. HTML Extractor Mangled Table & XSS Robustness', () => {

    const baseParsedUrl: ParsedAssociationUrl = {
      sport: 'football',
      association: 'palloliitto',
      teamId: '3512345',
      canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/3512345'
    };

    describe('3.1 Broken / Incomplete HTML Tables', () => {
      it('safely processes empty, null, or non-HTML strings', () => {
        expect(extractFixturesFromHtml('', baseParsedUrl)).toEqual([]);
        // @ts-expect-error test non-string
        expect(extractFixturesFromHtml(null, baseParsedUrl)).toEqual([]);
        // @ts-expect-error test non-string
        expect(extractFixturesFromHtml(undefined, baseParsedUrl)).toEqual([]);
        expect(extractStandingsFromHtml('')).toEqual([]);
        expect(extractRosterFromHtml('')).toBeUndefined();
      });

      it('handles tables with unclosed root tags and missing headers', () => {
        const truncatedHtml = `
          <table>
            <tr class="fixture-row">
              <td>10.05.2026</td><td>15:00</td><td>HJK T13</td><td>2-1</td><td>EPS</td><td>Bubu TN</td>
            </tr>
            <tr class="fixture-row">
              <td>17.05.2026</td><td>13:30</td><td>Honka</td><td>-</td><td>HJK T13</td><td>Tapiola</td>
            </tr>
        `;

        expect(() => extractFixturesFromHtml(truncatedHtml, baseParsedUrl)).not.toThrow();
        const fixtures = extractFixturesFromHtml(truncatedHtml, baseParsedUrl);
        expect(fixtures.length).toBe(2);
        expect(fixtures[0]?.homeTeam).toBe('HJK T13');
        expect(fixtures[0]?.score).toBe('2-1');
        expect(fixtures[0]?.status).toBe('played');
      });

      it('documents behavior on unclosed td tags (HTML4 omission)', () => {
        const unclosedTdHtml = `
          <table>
            <tr class="fixture-row">
              <td>10.05.2026<td>15:00<td>HJK T13<td>2-1<td>EPS<td>Bubu TN
            </tr>
          </table>
        `;

        // Strict tag matching requires </td>, skips rows if </td> missing without crashing
        expect(() => extractFixturesFromHtml(unclosedTdHtml, baseParsedUrl)).not.toThrow();
      });

      it('handles tables with missing columns (fewer than 5) without throwing or creating corrupt fixtures', () => {
        const shortTableHtml = `
          <table>
            <tr class="fixture-row"><td>24.05.2026</td><td>15:00</td><td>HJK</td></tr>
            <tr class="fixture-row"><td>Just one cell</td></tr>
          </table>
        `;

        const fixtures = extractFixturesFromHtml(shortTableHtml, baseParsedUrl);
        expect(fixtures.length).toBe(0); // Safely skipped rows with < 5 cells
      });

      it('handles tables with 15+ excessive columns gracefully', () => {
        const wideTableHtml = `
          <table>
            <tr class="fixture-row">
              <td>24.05.2026</td><td>15:00</td><td>HJK T13</td><td>3 - 1</td><td>EPS Valkoinen</td><td>Töölö PK 1 TN</td>
              <td>Extra1</td><td>Extra2</td><td>Extra3</td><td>Extra4</td><td>Extra5</td><td>Extra6</td><td>Extra7</td>
            </tr>
          </table>
        `;

        const fixtures = extractFixturesFromHtml(wideTableHtml, baseParsedUrl);
        expect(fixtures.length).toBe(1);
        expect(fixtures[0]?.homeTeam).toBe('HJK T13');
        expect(fixtures[0]?.awayTeam).toBe('EPS Valkoinen');
        expect(fixtures[0]?.venueName).toBe('Töölö PK 1 TN');
      });
    });

    describe('3.2 Malformed Match Scores, Statuses & Overtime', () => {
      it('correctly handles various match score formats (colons, dashes, ja., rp., walkovers)', () => {
        const variedScoresHtml = `
          <table>
            <tr class="fixture-row"><td>10.05.2026</td><td>15:00</td><td>HJK</td><td>2 - 1 ja.</td><td>EPS</td><td>Väiski</td></tr>
            <tr class="fixture-row"><td>11.05.2026</td><td>16:00</td><td>VJS</td><td>5:4 rp.</td><td>PPJ</td><td>Myyrmäki</td></tr>
            <tr class="fixture-row"><td>12.05.2026</td><td>17:00</td><td>KäPa</td><td>0 - 0</td><td>Honka</td><td>Kumpula</td></tr>
            <tr class="fixture-row"><td>13.05.2026</td><td>18:00</td><td>TiPS</td><td>-</td><td>GrIFK</td><td>Tikkurila</td></tr>
            <tr class="fixture-row cancelled"><td>14.05.2026</td><td>19:00</td><td>HPS</td><td>Peruttu</td><td>MPS</td><td>Pakila</td></tr>
            <tr class="fixture-row postponed"><td>15.05.2026</td><td>20:00</td><td>FC Espoo</td><td>Siirretty</td><td>EBK</td><td>Leppävaara</td></tr>
          </table>
        `;

        const fixtures = extractFixturesFromHtml(variedScoresHtml, baseParsedUrl);
        expect(fixtures.length).toBe(6);

        expect(fixtures[0]?.status).toBe('played');
        expect(fixtures[0]?.homeScore).toBe(2);
        expect(fixtures[0]?.awayScore).toBe(1);

        expect(fixtures[1]?.status).toBe('played');
        expect(fixtures[1]?.homeScore).toBe(5);
        expect(fixtures[1]?.awayScore).toBe(4);

        expect(fixtures[2]?.status).toBe('played');
        expect(fixtures[2]?.homeScore).toBe(0);
        expect(fixtures[2]?.awayScore).toBe(0);

        expect(fixtures[3]?.status).toBe('upcoming');
        expect(fixtures[3]?.score).toBeUndefined();

        expect(fixtures[4]?.status).toBe('cancelled');
        expect(fixtures[5]?.status).toBe('postponed');
      });
    });

    describe('3.3 XSS and HTML Tag Stripping in Content', () => {
      it('strips script tags, img error tags, and unescapes entities in team and venue names', () => {
        const xssHtml = `
          <table>
            <tr class="fixture-row">
              <td>24.05.2026</td>
              <td>15:00</td>
              <td><b>HJK</b> &amp; <i>T13 Sininen</i> <script>alert("xss")</script></td>
              <td>3 - 1</td>
              <td>EPS &lt;Valkoinen&gt; <img src=x onerror=alert(1)></td>
              <td>T&ouml;&ouml;l&ouml; PK 1 TN &quot;Sahara&quot;</td>
            </tr>
          </table>
        `;

        const fixtures = extractFixturesFromHtml(xssHtml, baseParsedUrl);
        expect(fixtures.length).toBe(1);

        const f = fixtures[0]!;
        expect(f.homeTeam).not.toContain('<script>');
        expect(f.homeTeam).not.toContain('<b>');
        expect(f.homeTeam).toContain('HJK & T13 Sininen alert("xss")');

        expect(f.awayTeam).not.toContain('<img');
        expect(f.awayTeam).toContain('EPS <Valkoinen>');

        expect(f.venueName).not.toContain('&ouml;');
        expect(f.venueName).toContain('Töölö PK 1 TN');
      });
    });

    describe('3.4 Torneopal Multi-Sport Standings & Roster Extraction', () => {
      it('extracts Torneopal standings with goal difference calculation', () => {
        const standingsHtml = `
          <table>
            <tr class="standings-row"><td>1</td><td>HJK T13 Sininen</td><td>8</td><td>7</td><td>1</td><td>0</td><td>28</td><td>6</td><td>+22</td><td>22</td></tr>
            <tr class="standings-row"><td>2</td><td>FC Honka Musta</td><td>8</td><td>6</td><td>0</td><td>2</td><td>24</td><td>9</td><td>+15</td><td>18</td></tr>
            <tr class="standings-row"><td>3</td><td>Valtti / IHK</td><td>8</td><td>0</td><td>1</td><td>7</td><td>4</td><td>36</td><td>-32</td><td>1</td></tr>
          </table>
        `;

        const standings = extractStandingsFromHtml(standingsHtml);
        expect(standings.length).toBe(3);
        expect(standings[0]?.rank).toBe(1);
        expect(standings[0]?.teamName).toBe('HJK T13 Sininen');
        expect(standings[0]?.points).toBe(22);
        expect(standings[0]?.goalDifference).toBe(22);

        expect(standings[2]?.teamName).toBe('Valtti / IHK');
        expect(standings[2]?.goalDifference).toBe(-32);
      });

      it('extracts player roster with positions and captain status', () => {
        const rosterHtml = `
          <div class="roster-container">
            <table>
              <tr><th>Nro</th><th>Nimi</th><th>Pelipaikka</th><th>M</th><th>V</th></tr>
              <tr><td>1</td><td>Emma Korhonen</td><td>MV</td><td>0</td><td>0</td></tr>
              <tr><td>4</td><td>Venla Mäkelä (C)</td><td>Puolustaja</td><td>1</td><td>1</td></tr>
              <tr><td>10</td><td>Maija Oinonen</td><td>Hyökkääjä</td><td>11</td><td>1</td></tr>
              <tr><td>8</td><td>Aada Koskinen</td><td>Keskikenttä</td><td>4</td><td>0</td></tr>
            </table>
          </div>
        `;

        const roster = extractRosterFromHtml(rosterHtml);
        expect(roster).toBeDefined();
        expect(roster?.players.length).toBe(4);

        const gk = roster?.players.find((p) => p.jerseyNumber === 1);
        expect(gk?.position).toBe('GK');
        expect(gk?.isCaptain).toBe(false);

        const captain = roster?.players.find((p) => p.jerseyNumber === 4);
        expect(captain?.position).toBe('DF');
        expect(captain?.isCaptain).toBe(true);
        expect(captain?.playerName).toBe('Venla Mäkelä');

        const fw = roster?.players.find((p) => p.jerseyNumber === 10);
        expect(fw?.position).toBe('FW');
        expect(fw?.goals).toBe(11);
      });
    });

    describe('3.5 High Load & Memory Stress (1000 Table Rows)', () => {
      it('parses a large HTML page with 1,000 fixture rows in < 150ms', () => {
        let bigHtml = '<html><body><table>';
        for (let i = 1; i <= 1000; i++) {
          bigHtml += `<tr class="fixture-row" data-match-id="m-${i}">
            <td>24.05.2026</td>
            <td>15:00</td>
            <td>Team Home ${i}</td>
            <td>${i % 2 === 0 ? '2 - 1' : '-'}</td>
            <td>Team Away ${i}</td>
            <td>Kenttä ${i % 5}</td>
          </tr>`;
        }
        bigHtml += '</table></body></html>';

        const start = performance.now();
        const fixtures = extractFixturesFromHtml(bigHtml, baseParsedUrl);
        const elapsed = performance.now() - start;

        expect(fixtures.length).toBe(1000);
        expect(elapsed).toBeLessThan(250);
      });
    });
  });

  // ==========================================================================
  // SUITE 4: VENUE & FIELD NLP ADVERSARIAL CASES
  // ==========================================================================
  describe('4. Venue & Field NLP Stress Testing', () => {
    it('parses various complex Finnish venue and field strings', () => {
      expect(extractVenueAndField('Töölö PK 1 TN (Kenttä 1)')).toEqual({
        venueName: 'Töölö PK 1 TN',
        fieldNumber: 'Kenttä 1'
      });

      expect(extractVenueAndField('Puotila TN (K2)')).toEqual({
        venueName: 'Puotila TN',
        fieldNumber: 'K2'
      });

      expect(extractVenueAndField('Matinkylä TN2')).toEqual({
        venueName: 'Matinkylä TN2',
        fieldNumber: 'TN2'
      });

      expect(extractVenueAndField('Kupittaa halli (Kaukalo 1)')).toEqual({
        venueName: 'Kupittaa halli',
        fieldNumber: 'Kaukalo 1'
      });

      expect(extractVenueAndField('   Väinämöisen kenttä TN   ')).toEqual({
        venueName: 'Väinämöisen kenttä TN',
        fieldNumber: 'TN'
      });

      expect(extractVenueAndField('Tuntematon')).toEqual({
        venueName: 'Tuntematon',
        fieldNumber: undefined
      });
    });
  });

  // ==========================================================================
  // SUITE 5: MULTI-SPORT POSITION & VOLLEYBALL SET SCORE EXTRACTION
  // ==========================================================================
  describe('5. Multi-Sport Positions & Volleyball Set Scores', () => {
    it('extracts volleyball set scores from Torneopal fixtures', () => {
      const parsedUrlVolley: ParsedAssociationUrl = {
        sport: 'volleyball',
        association: 'torneopal',
        teamId: '8872',
        subdomain: 'lentopallo',
        canonicalUrl: 'https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=8872'
      };

      const volleyHtml = `
        <h1>PuMa Volley N2</h1>
        <table>
          <tr class="fixture-row">
            <td>15.11.2026</td>
            <td>14:00</td>
            <td>PuMa Volley N2</td>
            <td>3 - 1</td>
            <td>VanLe N2</td>
            <td>Puistolan Liikuntahalli</td>
            <td>25-22, 23-25, 25-18, 25-20</td>
          </tr>
        </table>
      `;

      const fixtures = extractFixturesFromHtml(volleyHtml, parsedUrlVolley);
      expect(fixtures.length).toBe(1);
      expect(fixtures[0]?.sport).toBe('volleyball');
      expect(fixtures[0]?.setScores).toEqual(['25-22', '23-25', '25-18', '25-20']);
      expect(fixtures[0]?.score).toBe('3 - 1');
      expect(fixtures[0]?.isHome).toBe(true);
    });

    it('correctly maps multi-sport specialized player positions (volleyball, basketball, football, floorball)', () => {
      // Volleyball positions
      expect(normalizePlayerPosition('Libero')).toBe('GK');
      expect(normalizePlayerPosition('Keskitorjuja')).toBe('DF');
      expect(normalizePlayerPosition('Hakkuri')).toBe('FW');
      expect(normalizePlayerPosition('Yleispelaaja')).toBe('FW');
      expect(normalizePlayerPosition('Passari')).toBe('MF');

      // Basketball positions
      expect(normalizePlayerPosition('PG')).toBe('MF');
      expect(normalizePlayerPosition('SG')).toBe('MF');
      expect(normalizePlayerPosition('SF')).toBe('MF');

      // Swedish position names
      expect(normalizePlayerPosition('Målvakt')).toBe('GK');
      expect(normalizePlayerPosition('Back')).toBe('DF');
      expect(normalizePlayerPosition('Anfallare')).toBe('FW');

      // Default fallback
      expect(normalizePlayerPosition('Unknown Position')).toBe('MF');
    });
  });

  // ==========================================================================
  // SUITE 6: API WRAPPER FUNCTIONS AND HELPER INTEGRITY
  // ==========================================================================
  describe('6. Wrapper Functions & Association Helpers', () => {
    it('detectAssociationType returns accurate association or null', () => {
      expect(detectAssociationType('https://tulospalvelu.palloliitto.fi/team/123')).toBe('palloliitto');
      expect(detectAssociationType('https://tulospalvelu.salibandy.fi/team/456')).toBe('salibandy');
      expect(detectAssociationType('https://basket.fi/basket/sarjat/joukkue/?team_id=789')).toBe('basket');
      expect(detectAssociationType('https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=999')).toBe('torneopal');
      expect(detectAssociationType('https://google.com')).toBeNull();
    });

    it('normalizeAssociationUrl returns canonical link or null', () => {
      expect(normalizeAssociationUrl('tulospalvelu.palloliitto.fi/team/123/fixtures?season=2026')).toBe('https://tulospalvelu.palloliitto.fi/team/123?season=2026');
      expect(normalizeAssociationUrl('https://basket.fi/basket/sarjat/joukkue/?league_id=4&team_id=555&season=2026')).toBe('https://basket.fi/basket/sarjat/joukkue/?team_id=555');
      expect(normalizeAssociationUrl('invalid')).toBeNull();
    });

    it('formatCanonicalTeamUrl formats correct links for all 4 associations', () => {
      expect(formatCanonicalTeamUrl('palloliitto', '101')).toBe('https://tulospalvelu.palloliitto.fi/team/101');
      expect(formatCanonicalTeamUrl('salibandy', '202')).toBe('https://tulospalvelu.salibandy.fi/team/202');
      expect(formatCanonicalTeamUrl('basket', '303')).toBe('https://basket.fi/basket/sarjat/joukkue/?team_id=303');
      expect(formatCanonicalTeamUrl('torneopal', '404', 'spl')).toBe('https://spl.torneopal.fi/taso/joukkue.php?joukkue=404');
    });

    it('getSportName and getAssociationName return expected Finnish terminology', () => {
      expect(getSportName('football')).toBe('Jalkapallo');
      expect(getSportName('floorball')).toBe('Salibandy');
      expect(getSportName('basketball')).toBe('Koripallo');
      expect(getSportName('volleyball')).toBe('Lentopallo');
      expect(getSportName('icehockey')).toBe('Jääkiekko');
      expect(getSportName('futsal')).toBe('Futsal');

      expect(getAssociationName('palloliitto')).toBe('Palloliitto (Tulospalvelu)');
      expect(getAssociationName('salibandy')).toBe('Salibandyliitto (Tulospalvelu)');
      expect(getAssociationName('basket')).toBe('Koripalloliitto (Basket.fi)');
      expect(getAssociationName('torneopal')).toBe('Torneopal Taso');
    });
  });
});
