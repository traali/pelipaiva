import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  __resetParkkisNearbyCache,
  countNearby,
  distanceTo,
  inParkkisTileRegion,
  isStaleDate,
  loadParkkisNearby,
  tileKeysAround
} from './parkkisNearby';

// Real Parkkis snapshot tile (parkkis.pages.dev/data/tiles/1243_6016.json, 12.11.2026).
const tile = JSON.parse(
  readFileSync(resolve(__dirname, '../../../tests/fixtures/json/parkkis-tile-1243_6016-2026-11-12.json'), 'utf8')
);
// Lauttasaari TN B, TASO coordinates.
const LAT = 60.163573520062;
const LNG = 24.867501722732;

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
}
function html() {
  return new Response('<!doctype html><html></html>', { headers: { 'content-type': 'text/html' } });
}

describe('nearby parking from Parkkis data', () => {
  beforeEach(() => __resetParkkisNearbyCache());

  it('uses the same tile grid as Parkkis', () => {
    expect(tileKeysAround(LAT, LNG)).toContain('1243_6016');
    expect(inParkkisTileRegion(LAT, LNG)).toBe(true);
    expect(inParkkisTileRegion(60.6459, 24.8375)).toBe(false); // Hyvinkää: no tiles
  });

  it('counts like Parkkis: only allowed (paid/free) areas inside 300 m, each once', () => {
    const allowed = tile.slots.filter((f: { properties: { category: string } }) => ['paid', 'free'].includes(f.properties.category));
    const all = countNearby([tile], LAT, LNG, 100000);
    expect(all.paid + all.free).toBe(allowed.length);
    const near = countNearby([tile, tile], LAT, LNG);
    expect(near.paid + near.free).toBeGreaterThan(0);
    expect(near.paid + near.free).toBeLessThan(allowed.length);
    expect(near.espoo).toBe(0); // Lauttasaari is Helsinki
  });

  it('a point inside a polygon is at distance 0', () => {
    const square = { type: 'Polygon' as const, coordinates: [[[24.86, 60.16], [24.87, 60.16], [24.87, 60.17], [24.86, 60.17], [24.86, 60.16]]] };
    expect(distanceTo(square, 60.165, 24.865)).toBe(0);
    expect(distanceTo(square, 60.2, 24.865)).toBeGreaterThan(3000);
  });

  it('carries Parkkis data date and flags old data', async () => {
    const fetcher = (async (url: string) => {
      if (url.endsWith('/manifest.json')) return json({ generated_at: '2026-11-12T11:03:31.324Z' });
      if (url.endsWith('/1243_6016.json')) return json(tile);
      return html(); // missing tile = SPA HTML on Parkkis
    }) as unknown as typeof fetch;
    const fresh = await loadParkkisNearby(LAT, LNG, fetcher, new Date('2026-11-13T12:00:00Z'));
    expect(fresh?.dataDate).toBe('2026-11-12T11:03:31.324Z');
    expect(fresh?.isStale).toBe(false);
    expect(fresh!.paid + fresh!.free).toBeGreaterThan(0);
    expect(fresh!.radiusM).toBe(300);
    __resetParkkisNearbyCache();
    const old = await loadParkkisNearby(LAT, LNG, fetcher, new Date('2026-11-20T12:00:00Z'));
    expect(old?.isStale).toBe(true);
  });

  it('no tiles, no numbers', async () => {
    const fetcher = (async () => html()) as unknown as typeof fetch;
    expect(await loadParkkisNearby(LAT, LNG, fetcher)).toBeNull();
    expect(await loadParkkisNearby(60.6459, 24.8375, fetcher)).toBeNull();
  });

  it('a failed tile never yields a partial 300 m total, and is retried', async () => {
    let fail = true;
    // A spot in tile 1243_6016 within 300 m of the neighbouring tile to the south.
    const lat = 60.1615;
    const keys = tileKeysAround(lat, LNG);
    expect(keys.length).toBeGreaterThan(1);
    const other = keys.find((k) => k !== '1243_6016')!;
    const fetcher = (async (url: string) => {
      if (url.endsWith('/manifest.json')) return json({ generated_at: '2026-11-12T11:03:31.324Z' });
      if (url.endsWith('/1243_6016.json')) return json(tile);
      if (fail && url.endsWith(`/${other}.json`)) return new Response('', { status: 503 });
      return html();
    }) as unknown as typeof fetch;
    expect(await loadParkkisNearby(lat, LNG, fetcher)).toBeNull();
    fail = false;
    expect(await loadParkkisNearby(lat, LNG, fetcher)).not.toBeNull();
  });

  it('a missing date is stale', () => {
    expect(isStaleDate(null)).toBe(true);
    expect(isStaleDate('not a date')).toBe(true);
  });
});
