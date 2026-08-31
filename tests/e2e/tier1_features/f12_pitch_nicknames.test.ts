import { describe, it, expect } from 'vitest';
import {
  NATIONAL_FIELD_ALIASES,
  resolveSportsVenue
} from '../../../src/lib/geo/sportsGeocoder';

describe('Feature 12: 100+ National Pitch Slang Nicknames', () => {
  it('should contain at least 100 curated national pitch slang nicknames and facilities', () => {
    const aliasCount = Object.keys(NATIONAL_FIELD_ALIASES).length;
    expect(aliasCount).toBeGreaterThanOrEqual(100);
  });

  it('should resolve iconic Helsinki pitch slang nicknames (Bubu, Väiski, Sahara, Bollis, Kisis, Braku)', async () => {
    const bubu = await resolveSportsVenue('Bubu');
    expect(bubu.name).toContain('Puotilan Tekonurmi');
    expect(bubu.surface).toBe('artificial_turf_3g');

    const vaiski = await resolveSportsVenue('Väiski');
    expect(vaiski.name).toContain('Väinämöisen kenttä');
    expect(vaiski.surface).toBe('sand_artificial_turf');

    const sahara = await resolveSportsVenue('Sahara');
    expect(sahara.name).toContain('Töölön Sahara');

    const bollis = await resolveSportsVenue('Bollis 1');
    expect(bollis.name).toContain('Töölön Pallokenttä');

    const kisis = await resolveSportsVenue('Kisis');
    expect(kisis.name).toContain('Töölön Kisahalli');
    expect(kisis.isIndoor).toBe(true);

    const braku = await resolveSportsVenue('Braku');
    expect(braku.name).toContain('Brahenkenttä');
  });

  it('should resolve Espoo and Vantaa facilities (Honkahalli, Matinari, Lepuski, Mosahalli, Energia Areena)', async () => {
    const honka = await resolveSportsVenue('Honkahalli');
    expect(honka.name).toContain('Honkahalli');
    expect(honka.isIndoor).toBe(true);
    expect(honka.surface).toBe('indoor_parquet');

    const matinari = await resolveSportsVenue('Matinari');
    expect(matinari.name).toContain('Matinkylän');

    const lepuski = await resolveSportsVenue('Lepuski TN');
    expect(lepuski.name).toContain('Leppävaaran');

    const mosahalli = await resolveSportsVenue('Mosahalli 1');
    expect(mosahalli.name).toContain('Mosahalli');
    expect(mosahalli.isIndoor).toBe(true);

    const energia = await resolveSportsVenue('Energia Areena');
    expect(energia.name).toContain('Energia Areena');
  });

  it('should resolve national regional sports hubs (Kauppi, Kupittaa, Vehkalampi, Heinäpää, Kisapuisto)', async () => {
    const kauppi = await resolveSportsVenue('Kauppi TN 1');
    expect(kauppi.name).toContain('Kaupin Urheilupuisto');
    expect(kauppi.coordinates.lat).toBeCloseTo(61.5034, 2);

    const kupittaa = await resolveSportsVenue('Kupittaa 5');
    expect(kupittaa.name).toContain('Kupittaan Tekonurmi');
    expect(kupittaa.coordinates.lng).toBeCloseTo(22.2885, 2);

    const vehkalampi = await resolveSportsVenue('Vehkalampi TN');
    expect(vehkalampi.name).toContain('Vehkalammen');

    const heinapaa = await resolveSportsVenue('Heinis');
    expect(heinapaa.name).toContain('Heinäpään Tekonurmi');

    const kisapuisto = await resolveSportsVenue('Kisapuisto TN');
    expect(kisapuisto.name).toContain('Kisapuiston');
  });

  it('should provide fallback coordinates and safe defaults for unknown field names without fabricating Helsinki coordinates', async () => {
    const unknown = await resolveSportsVenue('Joku Satunnainen Kyläkenttä');
    expect(unknown.name).toBe('Joku Satunnainen Kyläkenttä');
    expect(unknown.coordinates.lat).toBe(0);
    expect(unknown.coordinates.lng).toBe(0);
    expect(unknown.isApproximateLocation).toBe(true);
    expect(unknown.hasFloodlights).toBe(true);
  });
});
