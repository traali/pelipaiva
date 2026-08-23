import { describe, it, expect } from 'vitest';
import { resolveEventTimes, parseICSFeed } from '../../../src/lib/calendar/icsParser';
import { loadIcsFixture } from '../../helpers/fixtureLoader';

describe('Feature 9: Dual Timestamp & Daylight Saving Time Disentanglement', () => {
  it('should disentangle warmup DTSTART (14:15) vs explicit kickoff in description (Kickoff klo 15:00)', () => {
    const dtStart = new Date('2026-05-16T12:00:00.000Z');
    dtStart.setHours(14, 15, 0, 0);
    const dtEnd = new Date(dtStart.getTime() + 135 * 60000);
    const title = 'HJK T13 vs EPS';
    const description = 'Paikalle Bubuun. Kickoff klo 15:00. Varusteet sininen peliasu.';

    const times = resolveEventTimes(dtStart, dtEnd, title, description, false);

    expect(times.warmupTime.toISOString()).toBe(dtStart.toISOString());
    expect(times.kickoffTime.getHours()).toBe(15);
    expect(times.kickoffTime.getMinutes()).toBe(0);
  });

  it('should handle DTSTART as kickoff time with explicit gathering in description (Kokoontuminen klo 14:15)', () => {
    const dtStart = new Date('2026-05-16T12:00:00.000Z'); // 15:00 EEST
    dtStart.setHours(15, 0, 0, 0);
    const dtEnd = new Date(dtStart.getTime() + 90 * 60000);
    const title = 'Ottelu vs Honka';
    const description = 'Kokoontuminen klo 14:15 pukukopissa. Peli alkaa 15:00.';

    const times = resolveEventTimes(dtStart, dtEnd, title, description, false);

    expect(times.kickoffTime.getHours()).toBe(15);
    expect(times.warmupTime.getHours()).toBe(14);
    expect(times.warmupTime.getMinutes()).toBe(15);
  });

  it('should default to 15 min warmup for training events and 45 min for matches without explicit text', () => {
    const start = new Date('2026-05-16T15:00:00.000Z');
    const end = new Date('2026-05-16T16:30:00.000Z');

    const trainingTimes = resolveEventTimes(start, end, 'Harjoitukset', '', true);
    expect(trainingTimes.warmupTime.getTime()).toBe(start.getTime() - 15 * 60000);

    const matchTimes = resolveEventTimes(start, end, 'Peli vs KäPa', '', false);
    expect(matchTimes.warmupTime.getTime()).toBe(start.getTime() - 45 * 60000);
  });

  it('should parse real-world DST transition ICS feed across Spring (EEST) and Fall (EET) cleanly', async () => {
    const icsContent = loadIcsFixture('dst_fall_spring_transitions.ics');
    const events = await parseICSFeed(icsContent, 'profile-dst-test', 'football');

    expect(events.length).toBeGreaterThanOrEqual(2);

    // Spring match (March: EET/EEST)
    const springEvent = events.find((e) => e.title.includes('TiPS'));
    expect(springEvent).toBeDefined();
    expect(new Date(springEvent!.startTime).getUTCMonth()).toBe(2); // March

    // Fall match (October: EEST/EET)
    const fallEvent = events.find((e) => e.title.includes('VJS'));
    expect(fallEvent).toBeDefined();
    expect(new Date(fallEvent!.startTime).getUTCMonth()).toBe(9); // October
  });

  it('should maintain chronological event ordering across DST boundary feeds', async () => {
    const icsContent = loadIcsFixture('dst_fall_spring_transitions.ics');
    const events = await parseICSFeed(icsContent, 'profile-ordering', 'football');

    for (let i = 0; i < events.length - 1; i++) {
      const current = new Date(events[i]!.startTime).getTime();
      const next = new Date(events[i + 1]!.startTime).getTime();
      expect(current).toBeLessThanOrEqual(next);
    }
  });
});
