import { describe, it, expect } from 'vitest';
import { isIndoorEvent } from './isIndoorEvent';
import { parseLightningWfs } from '../weather/fmiWeatherEngine';

describe('isIndoorEvent', () => {
  it('treats floorball and *halli* as indoor even if surface was turf', () => {
    expect(
      isIndoorEvent({
        sport: 'floorball',
        venue: { isIndoor: false, name: 'Tuusulan Salibandyhalli' }
      })
    ).toBe(true);
    expect(
      isIndoorEvent({
        sport: 'football',
        venue: { isIndoor: false, name: 'Väinämöinen tn' }
      })
    ).toBe(false);
    expect(
      isIndoorEvent({
        sport: 'football',
        venue: { isIndoor: true, name: 'Pajulahden palloiluhalli' }
      })
    ).toBe(true);
  });
});

describe('parseLightningWfs', () => {
  it('parses FMI positions and ignores empty collections', () => {
    expect(parseLightningWfs('<wfs:FeatureCollection numberReturned="0">')).toEqual([]);
    const xml = `<gmlcov:positions>60.40 25.03 1757770000 60.41 25.04 1757770060</gmlcov:positions>`;
    const s = parseLightningWfs(xml);
    expect(s).toHaveLength(2);
    expect(s[0]!.lat).toBeCloseTo(60.4);
  });
});
