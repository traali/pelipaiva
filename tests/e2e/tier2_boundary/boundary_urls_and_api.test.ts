import { describe, it, expect } from 'vitest';
import {
  parseAssociationUrl,
  detectAssociationType,
  normalizeAssociationUrl,
  normalizeUrlString,
  inferSportFromSubdomain
} from '../../../src/lib/api/associationUrlParser';
import {
  extractFixturesFromHtml,
  cleanHtmlText,
  parseHtmlTableRows,
  parseTorneopalHtml
} from '../../../src/lib/api/associationExtractor';
import { ParsedAssociationUrl } from '../../../src/types/matchday';

describe('Tier 2 Boundary: URLs, API Ingestion & HTML Extraction', () => {
  // 1. Empty, whitespace and null/undefined handling
  it('should return null for empty string URL input', () => {
    expect(parseAssociationUrl('')).toBeNull();
    expect(detectAssociationType('')).toBeNull();
    expect(normalizeAssociationUrl('')).toBeNull();
  });

  it('should return null for whitespace-only strings (spaces, tabs, newlines)', () => {
    const whitespaces = ['   ', '\t\t', '\n\n', '   \t\r\n   ', '               '];
    for (const ws of whitespaces) {
      expect(parseAssociationUrl(ws)).toBeNull();
      expect(detectAssociationType(ws)).toBeNull();
      expect(normalizeAssociationUrl(ws)).toBeNull();
    }
  });

  it('should return null safely for non-string types cast to any (null, undefined, object, number)', () => {
    expect(parseAssociationUrl(null as any)).toBeNull();
    expect(parseAssociationUrl(undefined as any)).toBeNull();
    expect(parseAssociationUrl(12345 as any)).toBeNull();
    expect(parseAssociationUrl({} as any)).toBeNull();
    expect(parseAssociationUrl([] as any)).toBeNull();
  });

  // 2. Non-HTTP protocols & dangerous schemes
  it('should reject ftp:// protocol URLs', () => {
    const ftp = 'ftp://tulospalvelu.palloliitto.fi/team/60341';
    expect(parseAssociationUrl(ftp)).toBeNull();
  });

  it('should reject javascript: pseudo-protocol XSS attempts', () => {
    const js = 'javascript:alert("XSS")';
    expect(parseAssociationUrl(js)).toBeNull();
    const js2 = 'javascript://tulospalvelu.palloliitto.fi/team/60341';
    expect(parseAssociationUrl(js2)).toBeNull();
  });

  it('should reject local file:/// protocol URLs', () => {
    const file = 'file:///etc/passwd';
    expect(parseAssociationUrl(file)).toBeNull();
    const file2 = 'file:///C:/dev2/pelipaiva/team/60341';
    expect(parseAssociationUrl(file2)).toBeNull();
  });

  it('should reject inline data: protocol URIs', () => {
    const dataUri = 'data:text/html,<html><body>tulospalvelu.palloliitto.fi/team/60341</body></html>';
    expect(parseAssociationUrl(dataUri)).toBeNull();
  });

  it('should reject blob: URLs', () => {
    const blob = 'blob:https://tulospalvelu.palloliitto.fi/team/60341';
    expect(parseAssociationUrl(blob)).toBeNull();
  });

  // 3. Incomplete URL paths
  it('should reject incomplete Palloliitto URL paths missing teamId', () => {
    expect(parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/')).toBeNull();
    expect(parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team')).toBeNull();
    expect(parseAssociationUrl('https://tulospalvelu.palloliitto.fi/')).toBeNull();
  });

  it('should reject incomplete Salibandyliitto URL paths missing teamId', () => {
    expect(parseAssociationUrl('https://tulospalvelu.salibandy.fi/team/')).toBeNull();
    expect(parseAssociationUrl('https://tulospalvelu.salibandy.fi/team')).toBeNull();
    expect(parseAssociationUrl('https://tulospalvelu.salibandy.fi/series/')).toBeNull();
  });

  it('should reject incomplete Basket.fi URL paths missing team_id query or numeric path', () => {
    expect(parseAssociationUrl('https://basket.fi/basket/sarjat/joukkue/')).toBeNull();
    expect(parseAssociationUrl('https://basket.fi/basket/sarjat/joukkue/?season_id=2026')).toBeNull();
    expect(parseAssociationUrl('https://basket.fi/joukkue/')).toBeNull();
  });

  it('should reject Torneopal URL without joukkue query parameter', () => {
    expect(parseAssociationUrl('https://lentopallo.torneopal.fi/taso/joukkue.php')).toBeNull();
    expect(parseAssociationUrl('https://salibandy.torneopal.fi/taso/sarja.php?sarja=1')).toBeNull();
  });

  // 4. Non-numeric & edge-case team IDs
  it('should reject non-numeric team IDs (alphanumeric, words, UUIDs)', () => {
    expect(parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/hjk_t13')).toBeNull();
    expect(parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/abc-def-123')).toBeNull();
    expect(parseAssociationUrl('https://tulospalvelu.salibandy.fi/team/superteam')).toBeNull();
    expect(parseAssociationUrl('https://basket.fi/basket/sarjat/joukkue/?team_id=honka_p12')).toBeNull();
  });

  it('should reject negative team IDs across all associations', () => {
    expect(parseAssociationUrl('https://tulospalvelu.palloliitto.fi/team/-12345')).toBeNull();
    expect(parseAssociationUrl('https://tulospalvelu.salibandy.fi/team/-99')).toBeNull();
    expect(parseAssociationUrl('https://basket.fi/basket/sarjat/joukkue/?team_id=-500')).toBeNull();
    expect(parseAssociationUrl('https://lentopallo.torneopal.fi/taso/joukkue.php?joukkue=-4521')).toBeNull();
  });

  it('should handle extremely large numeric team IDs without crash or loss of string precision', () => {
    const hugeId = '98765432109876543210';
    const parsed = parseAssociationUrl(`https://tulospalvelu.palloliitto.fi/team/${hugeId}`);
    expect(parsed).not.toBeNull();
    expect(parsed?.teamId).toBe(hugeId);
  });

  // 5. Special characters & URL encoding
  it('should properly handle URL-encoded Finnish diacritics (ä/ö/å) and spaces in query parameters', () => {
    const url = 'https://tulospalvelu.palloliitto.fi/team/60341?category=Tyt%C3%B6t%2013%20Ykk%C3%B6nen&season=kes%C3%A4_2026';
    const parsed = parseAssociationUrl(url);
    expect(parsed).not.toBeNull();
    expect(parsed?.teamId).toBe('60341');
    expect(parsed?.leagueId).toBe('Tytöt 13 Ykkönen');
    expect(parsed?.seasonId).toBe('kesä_2026');
  });

  // 6. Security hardening: SQL injection and XSS payloads in URLs
  it('should safely parse URLs containing SQL injection payloads without throwing', () => {
    const sqlUrl = 'https://tulospalvelu.palloliitto.fi/team/60341?category=%27%20OR%201%3D1%20--&tab=fixtures';
    const parsed = parseAssociationUrl(sqlUrl);
    expect(parsed).not.toBeNull();
    expect(parsed?.teamId).toBe('60341');
    expect(parsed?.leagueId).toBe("' OR 1=1 --");
  });

  it('should safely parse URLs containing XSS script payloads in query params', () => {
    const xssUrl = 'https://tulospalvelu.salibandy.fi/team/45210?tab=%3Cscript%3Ealert(%22XSS%22)%3C%2Fscript%3E';
    const parsed = parseAssociationUrl(xssUrl);
    expect(parsed).not.toBeNull();
    expect(parsed?.teamId).toBe('45210');
    expect(parsed?.tab).toBe('<script>alert("XSS")</script>');
  });

  // 7. Trailing garbage, repeated query parameters, extra subdomains
  it('should handle trailing garbage subpaths, hashes, and query delimiters', () => {
    const raw = 'https://tulospalvelu.palloliitto.fi/team/60341/fixtures/extra/garbage?foo=bar&&&baz=1#section/tab';
    const parsed = parseAssociationUrl(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.teamId).toBe('60341');
    expect(parsed?.canonicalUrl).toBe('https://tulospalvelu.palloliitto.fi/team/60341');
  });

  it('should handle repeated query parameters deterministically', () => {
    const raw = 'https://basket.fi/basket/sarjat/joukkue/?team_id=12894&team_id=99999&season_id=2026&season_id=2025';
    const parsed = parseAssociationUrl(raw);
    expect(parsed).not.toBeNull();
    expect(parsed?.teamId).toBe('12894');
  });

  it('should handle complex multi-level subdomains for Torneopal sport inference', () => {
    expect(inferSportFromSubdomain('splhelsinki')).toBe('football');
    expect(inferSportFromSubdomain('etela.salibandy')).toBe('floorball');
    expect(inferSportFromSubdomain('nuorten.lentopallo')).toBe('volleyball');
    expect(inferSportFromSubdomain('futsal-liiga')).toBe('futsal');
    expect(inferSportFromSubdomain('unknown-custom-domain')).toBe('other');
  });

  // 8. HTML Extraction Boundary Cases
  it('should return empty fixtures when extracting from empty string or non-HTML text', () => {
    const dummyUrl: ParsedAssociationUrl = {
      sport: 'football',
      association: 'palloliitto',
      teamId: '60341',
      canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/60341'
    };

    expect(extractFixturesFromHtml('', dummyUrl)).toEqual([]);
    expect(extractFixturesFromHtml('500 Internal Server Error: Database Connection Failed', dummyUrl)).toEqual([]);
    expect(extractFixturesFromHtml('{"error": "Not Found", "code": 404}', dummyUrl)).toEqual([]);
  });

  it('should parse malformed HTML with unclosed tags without throwing error', () => {
    const malformed = `
      <div class="match-item" data-match-id="m999">
        <table class="table">
          <tr class="fixture-row" data-match-id="m999">
            <td class="match-date">16.05.2026 klo 15:00
            <td><b>HJK T13</b> vs <span>EPS Valkoinen
            <td>Töölö PK 1 TN
    `;

    const dummyUrl: ParsedAssociationUrl = {
      sport: 'football',
      association: 'palloliitto',
      teamId: '60341',
      canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/60341'
    };

    const fixtures = extractFixturesFromHtml(malformed, dummyUrl);
    expect(Array.isArray(fixtures)).toBe(true);
  });

  it('should handle truncated HTML tables with missing columns safely', () => {
    const truncatedTable = `
      <table>
        <tr class="fixture-row" data-match-id="trunc-1">
          <td class="match-date">16.05.2026</td>
          <!-- missing opponent and venue columns -->
        </tr>
        <tr class="fixture-row" data-match-id="trunc-2">
          <!-- completely empty td row -->
          <td></td>
        </tr>
      </table>
    `;

    const dummyUrl: ParsedAssociationUrl = {
      sport: 'football',
      association: 'palloliitto',
      teamId: '60341',
      canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/60341'
    };

    const fixtures = extractFixturesFromHtml(truncatedTable, dummyUrl);
    expect(Array.isArray(fixtures)).toBe(true);
  });

  it('should clean dangerous script and iframe tags from extracted HTML text', () => {
    const htmlWithScripts = `
      <h1>HJK T13 <script>alert("Pwned")</script><iframe src="evil.com"></iframe> Sininen</h1>
      <table class="sarjataulukko">
        <thead><tr><th>#</th><th>Joukkue</th><th>P</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>HJK<script>malicious()</script> Sininen</td><td>18</td></tr>
        </tbody>
      </table>
    `;

    const cleaned = cleanHtmlText(htmlWithScripts);
    expect(cleaned).not.toContain('<script>');
    expect(cleaned).not.toContain('<iframe>');
    expect(cleaned).toContain('HJK T13');
  });

  it('should handle extreme numbers of fixtures (>120 rows) without performance degradation', () => {
    let bigTableHtml = '<h1>Marathon League</h1><table class="fixtures"><tbody>';
    for (let i = 1; i <= 150; i++) {
      const pad = i.toString().padStart(3, '0');
      bigTableHtml += `<tr class="fixture-row" data-match-id="match-${pad}">
        <td class="match-date">01.06.2026 klo 18:00</td>
        <td>Team Alpha ${pad}</td>
        <td>Team Beta ${pad}</td>
        <td>0 - 0</td>
        <td>Kenttä ${i}</td>
      </tr>`;
    }
    bigTableHtml += '</tbody></table>';

    const dummyUrl: ParsedAssociationUrl = {
      sport: 'football',
      association: 'palloliitto',
      teamId: '99999',
      canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/99999'
    };

    const startTime = performance.now();
    const fixtures = extractFixturesFromHtml(bigTableHtml, dummyUrl);
    const duration = performance.now() - startTime;

    expect(fixtures.length).toBe(150);
    expect(fixtures[0]?.id).toBe('palloliitto_99999_match-001');
    expect(fixtures[149]?.id).toBe('palloliitto_99999_match-150');
    expect(duration).toBeLessThan(300); // Must parse 150 fixtures in under 300ms
  });

  it('should handle invalid or impossible date and time strings in HTML gracefully', () => {
    const invalidDateHtml = `
      <table>
        <tr class="fixture-row" data-match-id="inv-1">
          <td class="match-date">30.02.2026 klo 25:99</td>
          <td>HJK</td>
          <td>Honka</td>
          <td>Töölö</td>
        </tr>
      </table>
    `;

    const dummyUrl: ParsedAssociationUrl = {
      sport: 'football',
      association: 'palloliitto',
      teamId: '60341',
      canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/60341'
    };

    const fixtures = extractFixturesFromHtml(invalidDateHtml, dummyUrl);
    expect(fixtures.length).toBe(1);
    expect(fixtures[0]?.startTime).toBeDefined();
    expect(typeof fixtures[0]?.startTime).toBe('string');
  });
});
