import { describe, expect, it } from 'vitest';
import { formatTimelineDayChipLabel, nextTimelineEventDayKeys } from './TimelineCalendarView';

describe('TimelineCalendarView timeline helpers', () => {
  it('returns only next event day keys after today, limited to six', () => {
    const keys = [
      '2026-09-10',
      '2026-09-13',
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20'
    ];
    expect(nextTimelineEventDayKeys(keys, '2026-09-13')).toEqual([
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19'
    ]);
  });

  it('formats day chip labels as short Finnish weekday and date', () => {
    const date = new Date(Date.UTC(2026, 8, 14, 9, 0, 0));
    expect(formatTimelineDayChipLabel(date)).toBe('Ma 14.9');
  });
});
