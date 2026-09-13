import { describe, expect, it } from 'vitest';
import { parseHelsinkiClockOnEventDate } from './time';

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
