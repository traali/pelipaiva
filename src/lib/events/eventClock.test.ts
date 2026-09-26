import { describe, it, expect } from 'vitest';
import { isInventedWarmup, shouldShowKokoontuminen, clockHeadline, arrivalPhaseLabel } from './eventClock';

describe('eventClock', () => {
  it('hides default 15 min treeni kokoontuminen', () => {
    const treeni = {
      startTime: '2026-09-14T15:45:00.000Z',
      warmupTime: '2026-09-14T15:30:00.000Z',
      isTraining: true,
      eventType: 'training'
    };
    expect(isInventedWarmup(treeni)).toBe(true);
    expect(shouldShowKokoontuminen(treeni)).toBe(false);
    expect(clockHeadline('training', '18.45')).toBe('Treeni klo 18.45');
  });

  it('shows real MyClub kokoontuminen on a league game', () => {
    const match = {
      startTime: '2026-09-12T10:00:00.000Z',
      warmupTime: '2026-09-12T09:15:00.000Z',
      officialFixtureId: 'spl_1',
      eventType: 'match'
    };
    expect(isInventedWarmup(match)).toBe(false);
    expect(shouldShowKokoontuminen(match)).toBe(true);
    expect(clockHeadline('match', '13.00')).toBe('Ottelu klo 13.00');
  });

  it('tournament first game vs meetup-only', () => {
    expect(clockHeadline('tournament', '16.00', { gameCount: 2 })).toBe('Turnaus, 2 peliä');
    expect(clockHeadline('tournament', '15.00', { warmupEqualsKickoff: true })).toBe(
      'Kokoontuminen klo 15.00'
    );
  });

  it('names the arrival column from the source of the time', () => {
    expect(
      arrivalPhaseLabel({
        startTime: '2026-09-26T08:00:00.000Z',
        warmupTime: '2026-09-26T07:00:00.000Z',
        eventType: 'tournament'
      })
    ).toBe('Kokoontuminen');
    expect(
      arrivalPhaseLabel({
        startTime: '2026-09-26T08:00:00.000Z',
        warmupTime: '2026-09-26T07:15:00.000Z',
        eventType: 'match'
      })
    ).toBe('Alkulämpö');
    expect(
      arrivalPhaseLabel({ startTime: '2026-09-26T06:00:00.000Z', sport: 'school', eventType: 'school' })
    ).toBe('Saapuminen');
  });
});
