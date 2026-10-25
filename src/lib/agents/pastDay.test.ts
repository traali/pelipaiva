import { describe, expect, it } from 'vitest';
import { isFinishedGame, isPastHelsinkiDay } from './time';

const at = (iso: string) => new Date(iso);

describe('isPastHelsinkiDay: games stay until Helsinki midnight', () => {
  // Su 4.10.2026 10:15–11:25 EEST (UTC+3), like TASO match 4208631.
  const morning = { startTime: '2026-10-04T07:15:00.000Z', endTime: '2026-10-04T08:25:00.000Z' };

  it('keeps a played game on the main view for the rest of its Helsinki day', () => {
    expect(isPastHelsinkiDay(morning, at('2026-10-04T08:30:00.000Z'))).toBe(false); // 11.30, just ended
    expect(isPastHelsinkiDay(morning, at('2026-10-04T18:00:00.000Z'))).toBe(false); // 21.00
    expect(isPastHelsinkiDay(morning, at('2026-10-04T20:59:59.000Z'))).toBe(false); // 23.59.59
  });

  it('moves it to "aiemmat" at Helsinki midnight, not UTC midnight', () => {
    expect(isPastHelsinkiDay(morning, at('2026-10-04T21:00:00.000Z'))).toBe(true); // 00.00 Ma 5.10.
    expect(isPastHelsinkiDay(morning, at('2026-10-04T23:30:00.000Z'))).toBe(true); // 02.30, still 4.10. in UTC
  });

  it('a late game is not past at 23.45 on its own day', () => {
    const evening = { startTime: '2026-10-04T19:00:00.000Z', endTime: '2026-10-04T20:30:00.000Z' }; // 22.00–23.30
    expect(isPastHelsinkiDay(evening, at('2026-10-04T20:45:00.000Z'))).toBe(false);
  });

  it('a game over midnight belongs to the day it ends', () => {
    const overnight = { startTime: '2026-10-04T20:00:00.000Z', endTime: '2026-10-04T21:30:00.000Z' }; // 23.00–00.30
    expect(isPastHelsinkiDay(overnight, at('2026-10-04T21:15:00.000Z'))).toBe(false); // 00.15 Ma 5.10.
    expect(isPastHelsinkiDay(overnight, at('2026-10-05T21:00:00.000Z'))).toBe(true); // 00.00 Ti 6.10.
  });

  describe('DST end (Su 25.10.2026, 04.00 EEST -> 03.00 EET)', () => {
    it('Saturday midnight is still UTC+3', () => {
      const sat = { startTime: '2026-10-24T14:00:00.000Z', endTime: '2026-10-24T15:15:00.000Z' };
      expect(isPastHelsinkiDay(sat, at('2026-10-24T20:59:59.000Z'))).toBe(false);
      expect(isPastHelsinkiDay(sat, at('2026-10-24T21:00:00.000Z'))).toBe(true);
    });

    it('Sunday midnight is UTC+2: a game is still today at 23.30 EET', () => {
      const sun = { startTime: '2026-10-25T08:00:00.000Z', endTime: '2026-10-25T09:00:00.000Z' }; // 10.00–11.00 EET
      expect(isPastHelsinkiDay(sun, at('2026-10-25T21:30:00.000Z'))).toBe(false); // 23.30 EET (a fixed +3 would say past)
      expect(isPastHelsinkiDay(sun, at('2026-10-25T21:59:59.000Z'))).toBe(false);
      expect(isPastHelsinkiDay(sun, at('2026-10-25T22:00:00.000Z'))).toBe(true); // 00.00 Ma 26.10.
    });
  });

  describe('DST start (Su 29.3.2026, 03.00 EET -> 04.00 EEST)', () => {
    it('Saturday midnight is UTC+2', () => {
      const sat = { startTime: '2026-03-28T10:00:00.000Z', endTime: '2026-03-28T11:00:00.000Z' };
      expect(isPastHelsinkiDay(sat, at('2026-03-28T21:30:00.000Z'))).toBe(false); // 23.30 EET
      expect(isPastHelsinkiDay(sat, at('2026-03-28T22:00:00.000Z'))).toBe(true); // 00.00 Su 29.3.
    });

    it('Sunday midnight is UTC+3', () => {
      const sun = { startTime: '2026-03-29T07:00:00.000Z', endTime: '2026-03-29T08:00:00.000Z' }; // 10.00–11.00 EEST
      expect(isPastHelsinkiDay(sun, at('2026-03-29T20:59:59.000Z'))).toBe(false);
      expect(isPastHelsinkiDay(sun, at('2026-03-29T21:00:00.000Z'))).toBe(true);
    });
  });

  it('never hides a game with unknown times', () => {
    expect(isPastHelsinkiDay({}, at('2030-01-01T00:00:00.000Z'))).toBe(false);
    expect(isPastHelsinkiDay({ startTime: 'not a date', endTime: '' }, at('2030-01-01T00:00:00.000Z'))).toBe(false);
  });

  it('falls back to the start time when the end is missing', () => {
    expect(isPastHelsinkiDay({ startTime: '2026-10-04T07:15:00.000Z' }, at('2026-10-04T20:00:00.000Z'))).toBe(false);
    expect(isPastHelsinkiDay({ startTime: '2026-10-04T07:15:00.000Z' }, at('2026-10-04T21:00:00.000Z'))).toBe(true);
  });
});

describe('isFinishedGame', () => {
  const game = { startTime: '2026-10-04T07:15:00.000Z', endTime: '2026-10-04T08:25:00.000Z' };
  it('is live (not finished) during the slot without a final score', () => {
    expect(isFinishedGame(game, at('2026-10-04T07:30:00.000Z'))).toBe(false);
  });
  it('is finished after the slot, or as soon as TASO has the score', () => {
    expect(isFinishedGame(game, at('2026-10-04T08:25:00.000Z'))).toBe(true);
    expect(isFinishedGame({ ...game, score: '2–3' }, at('2026-10-04T07:30:00.000Z'))).toBe(true);
  });
});
