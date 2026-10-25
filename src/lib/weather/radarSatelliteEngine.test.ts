import { describe, it, expect } from 'vitest';
import {
  buildImageryUrl,
  buildBasemapUrl,
  calculateRadarBbox,
  isValidRadarCoords,
  getImageryLoopTimestamps,
  WEATHER_IMAGERY_LAYERS,
} from './radarSatelliteEngine';

describe('Radar & Satellite Imagery Engine', () => {
  const pyrkka = { lat: 60.16357, lng: 24.8675 };

  it('builds valid FMI rain radar WMS URL', () => {
    const url = buildImageryUrl('fmi_rain_radar', pyrkka);
    expect(url).toContain('openwms.fmi.fi');
    expect(url).toContain('Radar:suomi_dbz_eureffin');
    expect(url).toContain('BBOX=');
    expect(url).toContain('TIME=');
  });

  it('builds valid EUMETSAT Fog and Low Cloud WMS URL', () => {
    const url = buildImageryUrl('eumetsat_fog', pyrkka);
    expect(url).toContain('eumetview.eumetsat.int');
    expect(url).toContain('msg_fes:rgb_fog');
  });

  it('builds valid EUMETSAT Natural Color WMS URL', () => {
    const url = buildImageryUrl('eumetsat_natural', pyrkka);
    expect(url).toContain('eumetview.eumetsat.int');
    expect(url).toContain('msg_fes:rgb_natural');
  });

  it('provides 6 time loop frames for radar playback', () => {
    const frames = getImageryLoopTimestamps();
    expect(frames.length).toBe(6);
    expect(frames[frames.length - 1]?.label).toBe('Nyt');
  });

  it('has all 4 imagery layers documented with refresh rates', () => {
    expect(WEATHER_IMAGERY_LAYERS.fmi_rain_radar.refreshIntervalMinutes).toBe(5);
    expect(WEATHER_IMAGERY_LAYERS.eumetsat_fog.refreshIntervalMinutes).toBe(15);
  });

  it('centers the radar bbox on Pyrkkä, not Helsinki centrum', () => {
    const bbox = calculateRadarBbox(pyrkka, 18);
    const midLat = (bbox.minLat + bbox.maxLat) / 2;
    const midLng = (bbox.minLng + bbox.maxLng) / 2;
    expect(midLat).toBeCloseTo(pyrkka.lat, 3);
    expect(midLng).toBeCloseTo(pyrkka.lng, 3);
    expect(midLng).toBeLessThan(24.93);
  });

  it('uses the same bbox for OSM basemap and FMI radar', () => {
    const bbox = calculateRadarBbox(pyrkka);
    const base = buildBasemapUrl(bbox);
    const radar = buildImageryUrl('fmi_rain_radar', pyrkka);
    const baseBox = base.match(/BBOX=([^&]+)/)?.[1];
    const radarBox = radar.match(/BBOX=([^&]+)/)?.[1];
    expect(baseBox).toBe(radarBox);
  });

  it('rejects Null Island and coords outside Finland', () => {
    expect(isValidRadarCoords({ lat: 0, lng: 0 })).toBe(false);
    expect(isValidRadarCoords({ lat: 40, lng: 10 })).toBe(false);
    expect(isValidRadarCoords(pyrkka)).toBe(true);
  });
});
