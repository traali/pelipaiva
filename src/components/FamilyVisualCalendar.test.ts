import { describe, it, expect } from 'vitest';
import {
  WEEKDAYS_FI,
  MONTH_NAMES_FI,
  getMondayOfWeek,
  formatDateKey
} from './FamilyVisualCalendar';

describe('FamilyVisualCalendar logic helpers', () => {
  it('defines the 7 Finnish weekday abbreviations starting with Monday (Ma)', () => {
    expect(WEEKDAYS_FI).toEqual(['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su']);
  });

  it('defines all 12 Finnish month names correctly', () => {
    expect(MONTH_NAMES_FI.length).toBe(12);
    expect(MONTH_NAMES_FI[0]).toBe('Tammikuu');
    expect(MONTH_NAMES_FI[7]).toBe('Elokuu');
    expect(MONTH_NAMES_FI[11]).toBe('Joulukuu');
  });

  it('computes Monday of week correctly for Sunday dates', () => {
    // 2026-08-30 is a Sunday. Monday of that week is 2026-08-24.
    const sunday = new Date(2026, 7, 30);
    const monday = getMondayOfWeek(sunday);

    expect(monday.getFullYear()).toBe(2026);
    expect(monday.getMonth()).toBe(7); // August (0-indexed 7)
    expect(monday.getDate()).toBe(24);
  });

  it('computes Monday of week correctly for Wednesday dates', () => {
    // 2026-08-26 is a Wednesday. Monday of that week is 2026-08-24.
    const wednesday = new Date(2026, 7, 26);
    const monday = getMondayOfWeek(wednesday);

    expect(monday.getDate()).toBe(24);
  });

  it('formats Date to YYYY-MM-DD local format cleanly', () => {
    const d = new Date(2026, 7, 15); // 15.8.2026
    expect(formatDateKey(d)).toBe('2026-08-15');
  });
});
