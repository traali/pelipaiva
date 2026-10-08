import { describe, it, expect } from 'vitest';
import type { HomeLocation, MatchdayEvent, PlayerProfile } from '../../types/matchday';
import { conflictAgent } from './conflictAgent';
import { carpoolAgent, driverSlotLabel } from './carpoolAgent';
import { planFamilyLogistics } from '../ai/localAiEngine';

// Two kids, two venues (Otahalli Espoo vs Töölön Pallokenttä), overlapping Saturday games.
const profiles: PlayerProfile[] = [
  { id: 'p-tuomas', playerName: 'Tuomas', teamName: 'Westend Indians P14', sport: 'floorball', primaryColor: 'sininen', calendarUrl: '', colorHex: '#3b82f6' },
  { id: 'p-aino', playerName: 'Aino', teamName: 'HJK T13 Sininen', sport: 'football', primaryColor: 'sininen', calendarUrl: '', colorHex: '#ef4444' }
];

function game(id: string, profileId: string, start: string, end: string, warmup: string, name: string, lat: number, lng: number, sport: MatchdayEvent['sport']): MatchdayEvent {
  return {
    id,
    profileId,
    sport,
    eventType: 'match',
    isTraining: false,
    title: `${name} ottelu`,
    homeTeam: 'Koti',
    awayTeam: 'Vieras',
    isHomeMatch: true,
    startTime: start,
    endTime: end,
    warmupTime: warmup,
    venue: { name, normalizedName: name.toLowerCase(), coordinates: { lat, lng } }
  } as MatchdayEvent;
}

const events = [
  game('t', 'p-tuomas', '2027-05-15T07:00:00.000Z', '2027-05-15T08:15:00.000Z', '2027-05-15T06:15:00.000Z', 'Otahalli Espoo', 60.1841, 24.8315, 'floorball'),
  game('a', 'p-aino', '2027-05-15T07:30:00.000Z', '2027-05-15T08:45:00.000Z', '2027-05-15T06:45:00.000Z', 'Töölön Pallokenttä', 60.1873, 24.9258, 'football')
];

const home: HomeLocation = {
  name: 'Koti',
  address: 'Tikkurila, Vantaa',
  coordinates: { lat: 60.2925, lng: 25.0444 },
  defaultTransitMode: 'car'
} as HomeLocation;

const invented = /~\s*\d+\s*min|\d+\s*min\s*ajo|siirtymä\s*~|ajoaika\s*\d/i;

describe('two-driver advice for overlapping games at different venues', () => {
  it('with a home: states the clash and says two drivers are needed', () => {
    const [c, ...rest] = conflictAgent(events, profiles, home);
    expect(rest).toHaveLength(0);
    expect(c?.message).toContain('Päällekkäisyys');
    expect(c?.suggestedFix).toMatch(/kaksi kuskia|yksi vanhempi per kenttä/i);
  });

  it('without a home: same advice, and no guessed drive minutes in the text', () => {
    const [c] = conflictAgent(events, profiles);
    expect(c?.message).toContain('Päällekkäisyys');
    expect(c?.message).toContain('päällekkäin 90 min');
    expect(c?.suggestedFix).toMatch(/kaksi kuskia/i);
    expect(`${c?.message} ${c?.suggestedFix}`).not.toMatch(invented);
  });

  it('logistics plan carries the advice next to each conflict', () => {
    const plan = planFamilyLogistics(events, profiles, '2027-05-15', undefined);
    expect(plan.hasConflicts).toBe(true);
    expect(plan.conflictFixes).toHaveLength(plan.conflictDetails.length);
    expect(plan.conflictFixes[0]).toMatch(/kaksi kuskia/i);
  });

  it('carpool gives each kid their own driver, shown with a readable label', () => {
    const conflicts = conflictAgent(events, profiles, home);
    const legs = carpoolAgent(events, profiles, conflicts, home);
    expect(legs.map((l) => driverSlotLabel(l.driverSlot))).toEqual(['Kuski 1', 'Kuski 2']);
    expect(driverSlotLabel('oma-kyyti')).toBe('Omatoiminen kulku');
    expect(driverSlotLabel('yhteiskyyti')).toBe('Yhteiskyyti');
  });
});
