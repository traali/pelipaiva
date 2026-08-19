import { describe, it, expect } from 'vitest';
import {
  buildImageryUrl,
  getImageryLoopTimestamps,
  WEATHER_IMAGERY_LAYERS
} from './radarSatelliteEngine';

describe('Radar & Satellite Imagery Engine', () => {
  const mockCoords = { lat: 60.1872, lng: 24.9248 };

  it('builds valid FMI rain radar WMS URL', () => {
    const url = buildImageryUrl('fmi_rain_radar', mockCoords);
    expect(url).toContain('openwms.fmi.fi');
    expect(url).toContain('Radar:suomi_rr_euref');
    expect(url).toContain('BBOX=');
    expect(url).toContain('TIME=');
  });

  it('builds valid EUMETSAT Fog and Low Cloud WMS URL', () => {
    const url = buildImageryUrl('eumetsat_fog', mockCoords);
    expect(url).toContain('eumetview.eumetsat.int');
    expect(url).toContain('msg_fes:rgb_fog');
  });

  it('builds valid EUMETSAT Natural Color WMS URL', () => {
    const url = buildImageryUrl('eumetsat_natural', mockCoords);
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
});
