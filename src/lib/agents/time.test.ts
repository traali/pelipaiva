import { describe, expect, it } from 'vitest';
import { eventDayKey, parseHelsinkiClockOnEventDate } from './time';

describe('eventDayKey', () => {
  it('keeps a late Helsinki evening on that Finnish day, not the UTC date', () => {
    expect(eventDayKey('2026-10-04T21:30:00.000Z')).toBe('2026-10-05');
  });

  it('keeps a morning kickoff on the TASO date', () => {
    expect(eventDayKey('2026-10-04T10:00:00+03:00')).toBe('2026-10-04');
    expect(eventDayKey('2026-10-04T07:00:00.000Z')).toBe('2026-10-04');
  });
});

describe('parseHelsinkiClockOnEventDate', () => {
  it('parses HH:MM on the same Helsinki date as event', () => {
    const parsed = parseHelsinkiClockOnEventDate('2026-03-29T08:00:00.000Z', '11:15');
    expect(parsed).toBe('2026-03-29T08:15:00.000Z');
  });

  it('parses HH.MM on the same Helsinki date as event', () => {
    const parsed = parseHelsinkiClockOnEventDate('2026-10-25T08:00:00.000Z', '11.15');
    expect(parsed).toBe('2026-10-25T09:15:00.000Z');
  });

  it('returns undefined for invalid clock text', () => {
    expect(parseHelsinkiClockOnEventDate('2026-10-25T08:00:00.000Z', 'abc')).toBeUndefined();
  });
});
