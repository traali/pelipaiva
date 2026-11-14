import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveSportsVenue, venueCoreName, __resetVenueNetworkCache } from './sportsGeocoder';
import { venueLocationStatus } from './venueLocation';

const fx = (name: string) =>
  JSON.parse(readFileSync(resolve(__dirname, `../../../tests/fixtures/json/${name}`), 'utf8'));
const lipas = fx('lipas-halls-capital-2026-11-14.json');
const photonPaavola = fx('photon-paavolatalo-hyvinkaa-2026-11-14.json');
const EMPTY_LIPAS = { items: [], pagination: { 'total-pages': 1 } };

function mockFetch(routes: Array<[RegExp, unknown]>) {
  const calls: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    calls.push(String(url));
    for (const [re, body] of routes) if (re.test(String(url))) return new Response(JSON.stringify(body), { status: 200 });
    return new Response('{}', { status: 404 });
  });
  return calls;
}

describe('venue fallback when TASO sends no coordinates', () => {
  beforeEach(() => __resetVenueNetworkCache());
  afterEach(() => vi.unstubAllGlobals());

  it('TASO coordinates win and are marked as TASO', async () => {
    const calls = mockFetch([]);
    const v = await resolveSportsVenue('Otahalli Otaniemi', { lat: 60.184810968974, lng: 24.837403252354, city: 'Espoo', sport: 'floorball' });
    expect(venueLocationStatus(v)).toBe('exact');
    expect(v.locationSource).toBe('taso');
    expect(calls).toHaveLength(0);
  });

  it('LIPAS is asked with a valid page size and a full name match is exact', async () => {
    const calls = mockFetch([[/api\.lipas\.fi/, lipas]]);
    const v = await resolveSportsVenue('Tapiolan liikuntahalli', { sport: 'floorball' });
    expect(calls[0]).toContain('page-size=100');
    expect(calls[0]).not.toContain('page-size=200');
    expect(venueLocationStatus(v)).toBe('exact');
    expect(v.locationSource).toBe('lipas');
    expect(v.lipasId).toBeGreaterThan(0);
  });

  it('a partial LIPAS name match is only approximate', async () => {
    mockFetch([[/api\.lipas\.fi/, lipas]]);
    const v = await resolveSportsVenue('AC Ruskeasuo kenttä 3', { sport: 'floorball' });
    expect(venueLocationStatus(v)).toBe('approximate');
    expect(v.name).toBe('AC Ruskeasuo kenttä 3');
    expect(v.isApproximateLocation).toBe(true);
  });

  it('OpenStreetMap: a sports-centre name match in the right city is exact', async () => {
    mockFetch([[/api\.lipas\.fi/, EMPTY_LIPAS], [/servicemap/, { results: [] }], [/photon\.komoot\.io/, photonPaavola]]);
    const v = await resolveSportsVenue('Paavolatalon liikuntahalli', { city: 'Hyvinkää', sport: 'floorball' });
    expect(venueLocationStatus(v)).toBe('exact');
    expect(v.locationSource).toBe('osm');
    // TASO's own pin for this hall is 60.6459031, 24.8375503: same building.
    expect(v.coordinates.lat).toBeCloseTo(60.6458, 3);
  });

  it('OpenStreetMap hits in another city are rejected', async () => {
    mockFetch([[/api\.lipas\.fi/, EMPTY_LIPAS], [/servicemap/, { results: [] }], [/photon\.komoot\.io/, photonPaavola]]);
    const v = await resolveSportsVenue('Paavolatalon liikuntahalli', { city: 'Tampere', sport: 'floorball' });
    expect(venueLocationStatus(v)).toBe('search');
    expect(v.coordinates).toEqual({ lat: 0, lng: 0 });
    expect(v.city).toBe('Tampere');
  });

  it('nothing found: unknown, never a made-up pin', async () => {
    mockFetch([[/api\.lipas\.fi/, EMPTY_LIPAS], [/servicemap/, { results: [] }], [/photon\.komoot\.io/, { features: [] }]]);
    const v = await resolveSportsVenue('Kenttä X', { sport: 'football' });
    expect(venueLocationStatus(v)).toBe('search');
    expect(v.isApproximateLocation).toBe(true);
  });

  it('placeholder names do not hit the network', async () => {
    const calls = mockFetch([]);
    await resolveSportsVenue('Kenttä ilmoitetaan', { sport: 'football' });
    expect(calls).toHaveLength(0);
  });

  it('LIPAS halls in another capital-region city are not matched', async () => {
    mockFetch([[/api\.lipas\.fi/, lipas], [/servicemap/, { results: [] }], [/photon\.komoot\.io/, { features: [] }]]);
    // Tapiolan liikuntahalli is in Espoo; a Vantaa game must not get its pin.
    const v = await resolveSportsVenue('Tapiolan liikuntahalli', { city: 'Vantaa', sport: 'floorball' });
    expect(v.locationSource).not.toBe('lipas');
    const espoo = await resolveSportsVenue('Tapiolan liikuntahalli', { city: 'Espoo', sport: 'floorball' });
    expect(espoo.locationSource).toBe('lipas');
    expect(espoo.city).toBe('Espoo');
  });

  it('a failed lookup (offline) is retried on the next refresh', async () => {
    vi.stubGlobal('fetch', async () => { throw new TypeError('offline'); });
    const off = await resolveSportsVenue('Tapiolan liikuntahalli', { sport: 'floorball' });
    expect(venueLocationStatus(off)).toBe('search');
    mockFetch([[/api\.lipas\.fi/, lipas]]);
    const on = await resolveSportsVenue('Tapiolan liikuntahalli', { sport: 'floorball' });
    expect(venueLocationStatus(on)).toBe('exact');
  });

  it('core name drops court suffixes', () => {
    expect(venueCoreName('AC Ruskeasuo kenttä 3')).toBe('AC Ruskeasuo');
    expect(venueCoreName('Lauttasaari TN B')).toBe('Lauttasaari');
    expect(venueCoreName('Sipoon Areena kenttä 1')).toBe('Sipoon Areena');
    expect(venueCoreName('Paavolatalon liikuntahalli')).toBe('Paavolatalon liikuntahalli');
  });
});
