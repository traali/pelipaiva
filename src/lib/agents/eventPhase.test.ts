import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { isEventLive, startLabel } from './eventPhase';

const now = new Date('2026-10-17T10:48:00Z'); // 13.48 Helsinki
const at = (minFromNow: number) => new Date(now.getTime() + minFromNow * 60_000).toISOString();
const live = { startTime: at(-20), endTime: at(50) };

describe('isEventLive', () => {
  it('started 20 min ago, not ended, no score → live', () => {
    expect(isEventLive(live, now)).toBe(true);
  });
  it('final score means over even inside the slot', () => {
    expect(isEventLive({ ...live, score: '2–1' }, now)).toBe(false);
  });
  it('not yet started / already ended → not live', () => {
    expect(isEventLive({ startTime: at(10), endTime: at(80) }, now)).toBe(false);
    expect(isEventLive({ startTime: at(-120), endTime: at(-30) }, now)).toBe(false);
  });
});

describe('startLabel', () => {
  it('live game reads Käynnissä, never "alkaa"', () => {
    expect(startLabel({ ...live, sport: 'football' }, now)).toMatch(/Käynnissä/);
    expect(startLabel({ ...live, sport: 'football' }, now)).not.toMatch(/alkaa/i);
  });
  it('upcoming keeps the old labels', () => {
    expect(startLabel({ startTime: at(60), endTime: at(120), sport: 'football' }, now)).toBe('Ottelu alkaa');
    expect(startLabel({ startTime: at(60), endTime: at(120), isTraining: true }, now)).toBe('Treeni alkaa');
  });
});

describe('every view uses the shared live rule', () => {
  const src = (f: string) => readFileSync(new URL(`../../components/${f}`, import.meta.url), 'utf8');
  it('Päivä/Tiivis (TimelineCalendarView) and Kalenteri (FamilyVisualCalendar) label via startLabel', () => {
    for (const f of ['TimelineCalendarView.tsx', 'FamilyVisualCalendar.tsx']) {
      expect(src(f)).toContain('{startLabel(ev)} klo');
      expect(src(f)).not.toMatch(/'Ottelu alkaa'\} klo \{timeStr\}/);
    }
  });
  it('Kortit (HeroMatchCard, MatchdayCard) swap "Ottelu alkaa" for Käynnissä while live', () => {
    expect(src('HeroMatchCard.tsx')).toContain('isLive ? `● ${liveText(event)} · alkoi`');
    expect(src('HeroMatchCard.tsx')).toContain('isLive ? `${liveText(event)} · alkoi`');
    expect(src('MatchdayCard.tsx')).toContain('isLive ? `${liveText(event)} · alkoi`');
  });
});
