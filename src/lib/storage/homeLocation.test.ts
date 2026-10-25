import { describe, it, expect, vi, beforeEach } from 'vitest';

const stored: { value: { key: string; syncKey: string } | undefined } = { value: undefined };
vi.mock('./db', () => ({
  db: { syncState: { get: async () => stored.value } }
}));

import { getHomeLocation, parseStoredHomeLocation } from './homeLocation';

const home = {
  name: 'Koti',
  address: 'Testikatu 1',
  coordinates: { lat: 60.17, lng: 24.94 },
  maxWalkingDistanceKm: 1.5,
  maxCyclingDistanceKm: 5
};

describe('home storage has no default home', () => {
  beforeEach(() => {
    stored.value = undefined;
  });

  it('getHomeLocation returns null when nothing is saved', async () => {
    expect(await getHomeLocation()).toBeNull();
  });

  it('a saved (or family-synced) home is read back', async () => {
    stored.value = { key: 'home_location', syncKey: JSON.stringify(home) };
    expect((await getHomeLocation())?.coordinates).toEqual(home.coordinates);
  });

  it('rejects stored homes without numeric coordinates', () => {
    expect(parseStoredHomeLocation('{"name":"x"}')).toBeNull();
    expect(parseStoredHomeLocation('not json')).toBeNull();
    expect(parseStoredHomeLocation(null)).toBeNull();
  });
});
