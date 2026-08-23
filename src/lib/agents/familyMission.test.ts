import { describe, it, expect } from 'vitest';
import type { MatchdayEvent, PlayerProfile } from '../../types/matchday';
import { conflictAgent } from './conflictAgent';
import { buildSportKitPlan } from './kitAgent';
import { runMissionControlGraph } from './planner';
import { tournamentAgent } from './tournamentAgent';
import { volunteerAgent } from './volunteerAgent';

function isoOn(dayOffset: number, hour: number, minute = 0): string {
  const d = new Date('2026-08-22T12:00:00+03:00');
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const profiles: PlayerProfile[] = [
  {
    id: 'p-simo',
    playerName: 'Simo',
    teamName: 'PPJ/Laru sin',
    sport: 'football',
    primaryColor: 'sininen',
    calendarUrl: '',
    colorHex: '#3b82f6'
  },
  {
    id: 'p-aada',
    playerName: 'Aada',
    teamName: 'HNMKY T13',
    sport: 'basketball',
    primaryColor: 'punainen',
    calendarUrl: '',
    colorHex: '#ef4444'
  }
];

function ev(partial: Partial<MatchdayEvent> & Pick<MatchdayEvent, 'id' | 'profileId' | 'startTime'>): MatchdayEvent {
  const start = new Date(partial.startTime);
  return {
    sport: 'football',
    eventType: 'match',
    isTraining: false,
    title: 'Ottelu',
    homeTeam: 'Koti',
    awayTeam: 'Vieras',
    isHomeMatch: true,
    endTime: new Date(start.getTime() + 90 * 60000).toISOString(),
    warmupTime: new Date(start.getTime() - 45 * 60000).toISOString(),
    venue: {
      name: 'Lauttasaari TN B',
      normalizedName: 'lauttasaari',
      coordinates: { lat: 60.16, lng: 24.87 },
      isIndoor: false,
      surface: 'artificial_turf_3g',
      hasFloodlights: true
    },
    ...partial
  };
}

describe('conflictAgent', () => {
  it('flags two kids at different venues overlapping', () => {
    const events = [
      ev({ id: 'a', profileId: 'p-simo', startTime: isoOn(0, 11, 0) }),
      ev({
        id: 'b',
        profileId: 'p-aada',
        sport: 'basketball',
        startTime: isoOn(0, 11, 30),
        venue: {
          name: 'Töölön Kisahalli',
          normalizedName: 'kisahalli',
          coordinates: { lat: 60.18, lng: 24.93 },
          isIndoor: true,
          surface: 'indoor_parquet',
          hasFloodlights: true
        }
      })
    ];
    const conflicts = conflictAgent(events, profiles);
    expect(conflicts.length).toBe(1);
    expect(conflicts[0]?.severity).toBe('critical');
  });

  it('does not flag same-venue overlap as a two-driver crisis', () => {
    const events = [
      ev({ id: 'a', profileId: 'p-simo', startTime: isoOn(0, 11, 0) }),
      ev({ id: 'b', profileId: 'p-aada', startTime: isoOn(0, 11, 15) })
    ];
    const conflicts = conflictAgent(events, profiles);
    expect(conflicts.length).toBe(0);
  });
});

describe('kitAgent', () => {
  it('packs non-marking shoes for floorball indoor', () => {
    const event = ev({
      id: 'fb',
      profileId: 'p-simo',
      sport: 'floorball',
      startTime: isoOn(0, 18, 0),
      venue: {
        name: 'Mosahalli',
        normalizedName: 'mosahalli',
        coordinates: { lat: 60.26, lng: 25.02 },
        isIndoor: true,
        surface: 'indoor_synthetic',
        hasFloodlights: true
      }
    });
    const plan = buildSportKitPlan(event, profiles[0]);
    expect(plan.footwearLabel).toMatch(/non-marking|sisä/i);
    expect(plan.playerItems.some((i) => /suojalasit/i.test(i.label))).toBe(true);
  });

  it('adds rain shell when precipitation is high', () => {
    const event = ev({
      id: 'rain',
      profileId: 'p-simo',
      startTime: isoOn(0, 16, 0),
      weather: {
        temperatureC: 8,
        feelsLikeC: 5,
        windSpeedMs: 6,
        windGustMs: 10,
        rainProbabilityPercent: 80,
        precipitationMmh: 2.4,
        rainTimeline: [],
        turfCondition: 'slick'
      }
    });
    const plan = buildSportKitPlan(event, profiles[0]);
    expect(plan.playerItems.some((i) => i.id === 'rain-shell' || /sade/i.test(i.label))).toBe(true);
  });
});

describe('volunteerAgent', () => {
  it('marks overloaded talkoo when one child has two shifts', () => {
    const events = [
      ev({
        id: 't1',
        profileId: 'p-simo',
        startTime: isoOn(0, 10, 0),
        volunteerDuty: 'Kahviovuoro (klo 09:30 - 11:00)'
      }),
      ev({
        id: 't2',
        profileId: 'p-simo',
        startTime: isoOn(0, 14, 0),
        volunteerDuty: 'Kirjuri (klo 13:30 - 15:30)'
      })
    ];
    const talkoo = volunteerAgent(events, profiles);
    expect(talkoo.overloadedParent).toBe(true);
    expect(talkoo.shifts.length).toBe(2);
  });
});

describe('tournamentAgent', () => {
  it('groups two same-day same-venue matches as a tournament day', () => {
    const events = [
      ev({
        id: 'c1',
        profileId: 'p-aada',
        eventType: 'tournament',
        tournamentName: 'Urhea mini-cup',
        startTime: isoOn(0, 16, 0),
        venue: {
          name: 'Urhea-halli',
          normalizedName: 'urhea',
          coordinates: { lat: 60.2, lng: 24.95 },
          isIndoor: true,
          surface: 'indoor_parquet',
          hasFloodlights: true
        }
      }),
      ev({
        id: 'c2',
        profileId: 'p-aada',
        eventType: 'tournament',
        tournamentName: 'Urhea mini-cup',
        startTime: isoOn(0, 18, 0),
        venue: {
          name: 'Urhea-halli',
          normalizedName: 'urhea',
          coordinates: { lat: 60.2, lng: 24.95 },
          isIndoor: true,
          surface: 'indoor_parquet',
          hasFloodlights: true
        }
      })
    ];
    const blocks = tournamentAgent(events, profiles);
    expect(blocks.length).toBe(1);
    expect(blocks[0]?.matchCount).toBe(2);
  });
});

describe('runMissionControlGraph', () => {
  it('emits leave-by and share text for a weekend with two kids', () => {
    const events = [
      ev({ id: 'a', profileId: 'p-simo', startTime: isoOn(0, 11, 0) }),
      ev({
        id: 'b',
        profileId: 'p-aada',
        sport: 'basketball',
        startTime: isoOn(0, 11, 30),
        venue: {
          name: 'Töölön Kisahalli',
          normalizedName: 'kisahalli',
          coordinates: { lat: 60.18, lng: 24.93 },
          isIndoor: true,
          surface: 'indoor_parquet',
          hasFloodlights: true
        }
      })
    ];
    const snap = runMissionControlGraph(events, profiles, new Date('2026-08-22T08:00:00+03:00'));
    expect(snap.leaveBy).toBeTruthy();
    expect(snap.whatsAppShareText.includes('PELIPÄIVÄ')).toBe(true);
    expect(snap.conflicts.length).toBe(1);
  });
});
