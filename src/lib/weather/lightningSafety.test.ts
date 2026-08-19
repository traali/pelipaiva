import { describe, it, expect } from 'vitest';
import { compute30_30Rule } from './lightningSafety';

describe('30/30 Lightning Safety State Machine', () => {
  const venueCoords = { lat: 60.1872, lng: 24.9248 }; // Töölö sports park

  it('triggers DANGER and sets 30-min resume countdown when strike is within 10 km', () => {
    const now = Date.now();
    const strikeCoords = { lat: 60.20, lng: 24.93, timeIso: new Date(now - 5 * 60000).toISOString() }; // ~1.5 km away, 5 mins ago

    const alert = compute30_30Rule(venueCoords, [strikeCoords], now);
    expect(alert.status).toBe('danger');
    expect(alert.suspendMatchRecommended).toBe(true);
    expect(alert.resumeCountdownMinutes).toBe(25); // 30 - 5
    expect(alert.nearestStrikeKm).toBeLessThan(10);
  });

  it('triggers WATCH when strike is within 20 km but further than 10 km', () => {
    const now = Date.now();
    const strikeCoords = { lat: 60.30, lng: 24.95, timeIso: new Date(now).toISOString() }; // ~12.5 km away

    const alert = compute30_30Rule(venueCoords, [strikeCoords], now);
    expect(alert.status).toBe('watch');
    expect(alert.suspendMatchRecommended).toBe(false);
  });

  it('reports CLEAR when no strikes are within 30 km', () => {
    const alert = compute30_30Rule(venueCoords, [], Date.now());
    expect(alert.status).toBe('clear');
    expect(alert.suspendMatchRecommended).toBe(false);
  });
});
