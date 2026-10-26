import { describe, expect, it } from 'vitest';
import { resolveSportsVenue } from './sportsGeocoder';

describe('resolveSportsVenue sport indoor rule', () => {
  it('never labels a floorball hall as outdoor turf', async () => {
    const v = await resolveSportsVenue('Esport Areena kenttä 3', { lat: 60.2, lng: 24.7, sport: 'floorball' });
    expect(v.isIndoor).toBe(true);
    expect(v.surface).not.toBe('artificial_turf_3g');
  });
  it('treats Finnish "areena" as indoor even without sport', async () => {
    const v = await resolveSportsVenue('Esport Areena kenttä 3', { lat: 60.2, lng: 24.7 });
    expect(v.isIndoor).toBe(true);
  });
  it('keeps football on outdoor turf', async () => {
    const v = await resolveSportsVenue('Koskelantie nap TN', { lat: 60.2, lng: 24.9, sport: 'football' });
    expect(v.isIndoor).toBe(false);
  });
  it('gives ice hockey an ice surface', async () => {
    const v = await resolveSportsVenue('Tapiolan harjoitushalli', { lat: 60.2, lng: 24.8, sport: 'icehockey' });
    expect(v.surface).toBe('ice');
    expect(v.isIndoor).toBe(true);
  });
});
