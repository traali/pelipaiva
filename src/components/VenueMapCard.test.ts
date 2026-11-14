import { describe, it, expect } from 'vitest';
import { parkkisNearbyText, worldPixel } from './VenueMapCard';

const base = { paid: 0, free: 0, spaces: 0, espoo: 0, radiusM: 300, dataDate: '2026-11-12T11:03:31.324Z', isStale: false };

describe('parking line under the map', () => {
  it('uses Parkkis wording with the data date', () => {
    expect(parkkisNearbyText({ ...base, paid: 2, free: 9, spaces: 140 }, false)).toBe(
      'Sallittu pysäköinti 300 m säteellä: 2 maksullista ja 9 maksutonta katupysäköintialuetta (140 paikkaa) Helsingin kaupungin aineistossa. Parkkis-tieto 12.11.'
    );
  });

  it('says old data is old', () => {
    expect(parkkisNearbyText({ ...base, espoo: 1, isStale: true }, false)).toBe(
      'Sallittu pysäköinti 300 m säteellä: 1 yleinen pysäköintialue Espoon kaupungin aineistossa. Parkkis-tieto 12.11. – voi olla vanhentunut.'
    );
  });

  it('nothing known is said plainly, and approximate locations say so', () => {
    expect(parkkisNearbyText(base, true)).toBe(
      'Sallittu pysäköinti 300 m säteellä arvioidusta sijainnista: ei tietoa. Tarkista kyltit paikan päällä. Parkkis-tieto 12.11.'
    );
    expect(parkkisNearbyText({ ...base, dataDate: null, isStale: true }, false)).toContain('Parkkis-tieto päiväys tuntematon – voi olla vanhentunut');
  });
});

describe('static map tiles', () => {
  it('matches OSM slippy-map tile numbering', () => {
    // Same tile numbers as the OSM wiki formula (Slippy map tilenames)
    const { x, y } = worldPixel(60.163573520062, 24.867501722732, 16);
    expect(Math.floor(x / 256)).toBe(Math.floor(((24.867501722732 + 180) / 360) * 2 ** 16));
    const latRad = (60.163573520062 * Math.PI) / 180;
    expect(Math.floor(y / 256)).toBe(Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * 2 ** 16));
  });
});
