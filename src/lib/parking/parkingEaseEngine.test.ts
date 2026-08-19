import { describe, it, expect } from 'vitest';
import { calculateParkingDiscTime, calculateParkingEase } from './parkingEaseEngine';

describe('ParkkiSakko Parking Ease Engine', () => {
  it('correctly rounds arrival time up to next half or whole hour per Tieliikennelaki 2020', () => {
    const time1 = new Date('2026-08-20T17:14:00');
    expect(calculateParkingDiscTime(time1)).toBe('17.30');

    const time2 = new Date('2026-08-20T17:35:00');
    expect(calculateParkingDiscTime(time2)).toBe('18.00');

    const time3 = new Date('2026-08-20T17:30:00');
    expect(calculateParkingDiscTime(time3)).toBe('17.30');
  });

  it('assigns TIGHT ease score to high-density venues like Töölö / Bollis', () => {
    const parking = calculateParkingEase('Töölön Pallokenttä 1', { lat: 60.1872, lng: 24.9248 }, new Date('2026-08-20T18:00:00'));
    expect(parking.easeScore).toBe('tight');
    expect(parking.easeScoreValue).toBeLessThanOrEqual(30);
    expect(parking.walkingTimeMinutes).toBeGreaterThanOrEqual(4);
  });

  it('assigns EASY/MODERATE ease score to suburban sports hubs like Tapiola', () => {
    const parking = calculateParkingEase('Tapiolan Urheilupuisto', { lat: 60.1785, lng: 24.7865 }, new Date('2026-08-20T11:00:00'));
    expect(parking.easeScore).toBe('easy');
    expect(parking.feeZone).toContain('Pysäköintikiekko 4h');
  });
});
