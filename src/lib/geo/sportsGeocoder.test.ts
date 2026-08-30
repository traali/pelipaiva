import { describe, it, expect } from 'vitest';
import { resolveSportsVenue, NATIONAL_FIELD_ALIASES } from './sportsGeocoder';

describe('National Sports Geocoder', () => {
  it('resolves common Finnish field slang nicknames accurately', async () => {
    const bubu = await resolveSportsVenue('Puotila Bubu kenttä 1');
    expect(bubu.name).toContain('Puotilan Tekonurmi');
    expect(bubu.surface).toBe('artificial_turf_3g');
    expect(bubu.isIndoor).toBe(false);

    const vaiski = await resolveSportsVenue('Väiski');
    expect(vaiski.name).toContain('Väinämöisen kenttä');
    expect(vaiski.surface).toBe('sand_artificial_turf');

    const mosahalli = await resolveSportsVenue('Tapanilan Mosahalli');
    expect(mosahalli.isIndoor).toBe(true);
    expect(mosahalli.surface).toBe('indoor_synthetic');

    const esport = await resolveSportsVenue('Esport Center 2');
    expect(esport.name).toContain('Esport');
    expect(esport.isIndoor).toBe(true);
    expect(esport.coordinates.lat).toBeCloseTo(60.1756, 2);

    const lyk = await resolveSportsVenue('Lauttasaaren Yhteiskoulu Uusi, Isokaari 19, 00200 Helsinki, Suomi');
    expect(lyk.name).toContain('Lauttasaaren yhteiskoulu');
    expect(lyk.isIndoor).toBe(true);
    expect(lyk.surface).toBe('indoor_parquet');
    expect(lyk.coordinates.lat).toBeCloseTo(60.1601, 2);
    expect(lyk.coordinates.lng).toBeCloseTo(24.8785, 2);

    const kauppi = await resolveSportsVenue('Kauppi TN 1');
    expect(kauppi.name).toContain('Kaupin');
    expect(kauppi.coordinates.lat).toBeCloseTo(61.5034, 2);
  });

  it('contains over 25 curated national slang and venue aliases', () => {
    expect(Object.keys(NATIONAL_FIELD_ALIASES).length).toBeGreaterThan(25);
  });
});
