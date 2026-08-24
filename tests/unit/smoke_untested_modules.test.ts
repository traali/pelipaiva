import { describe, it, expect } from 'vitest';
import { ingestSourceForProfile, ingestIcsForProfile } from '../../src/lib/clubs/ingestOfficial';
import { searchPopularClubs } from '../../src/lib/clubs/popularClubsCatalog';
import { proxiedUrl, DEFAULT_PROXY_URL } from '../../src/lib/api/proxyUrl';
import { calculateFeelsLike } from '../../src/lib/weather/fmiWeatherEngine';

/**
 * Smoke coverage for the five modules flagged zero-tested (M-37/V23).
 * These are export-contract tests: they pin signatures and pure-logic
 * behavior; network paths are asserted to fail fast/closed rather than
 * fabricate (guards against regression of the M-04 constitution).
 * OCR is intentionally not exercised at runtime here — it fetches CDN
 * worker/wasm assets and belongs in the browser e2e tier (see M-23).
 */
describe('smoke: previously untested modules', () => {
  it('proxyUrl builds encoded proxy target and keeps default worker base', () => {
    const url = proxiedUrl('https://example.org/feed.ics?a=1&b=2');
    expect(url.startsWith(DEFAULT_PROXY_URL)).toBe(true);
    expect(url).toContain(encodeURIComponent('https://example.org/feed.ics?a=1&b=2'));
  });

  it('popularClubsCatalog search returns typed presets with required fields', () => {
    const hits = searchPopularClubs('HJK');
    for (const club of hits) {
      expect(club.id).toBeTruthy();
      expect(club.name).toBeTruthy();
      expect(club.sampleTeamUrl).toMatch(/^https:/);
      expect(['football', 'floorball', 'basketball', 'volleyball', 'icehockey', 'futsal']).toContain(club.sport);
    }
  });

  it('fmiWeatherEngine feels-like math is monotonic in wind chill and heat humidity', () => {
    const mild = calculateFeelsLike(10, 3, 60);
    const windy = calculateFeelsLike(10, 12, 60);
    expect(windy).toBeLessThanOrEqual(mild); // wind cannot make it feel warmer
    const hotDry = calculateFeelsLike(30, 2, 30);
    const hotHumid = calculateFeelsLike(30, 2, 80);
    expect(hotHumid).toBeGreaterThanOrEqual(hotDry);
  });

  it('ingest fails closed on unreachable sources instead of fabricating (M-04)', async () => {
    // Invalid scheme can never parse as association or cup → ICS path via
    // proxy → network-free environments must yield 0 events, not synthetic ones.
    const n = await ingestIcsForProfile({
      profileId: 'smoke-test',
      teamName: 'Test',
      sport: 'football',
      url: 'https://invalid.invalid/feed.ics'
    });
    expect(n).toBe(0);

    // Federation-shaped URL whose upstream cannot resolve: must yield zero
    // imported fixtures — never a synthetic season (count-only; persistence
    // is structurally unreachable because officialData===null early-returns
    // before any bulkPut, per ingestOfficial.ts).
    const m = await ingestSourceForProfile({
      profileId: 'smoke-test-2',
      playerName: 'Test',
      teamName: 'Test',
      sport: 'football',
      url: 'https://tulospalvelu.palloliitto.fi/team/00000000/info'
    });
    expect(m).toBe(0);
  }, 30_000);
});
