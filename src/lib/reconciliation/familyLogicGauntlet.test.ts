/**
 * Super-prompt gauntlet: every family stitch / tournament / clock rule.
 * Cases are the real weekend shapes (football league, Indians cup, kids basket).
 */
import { describe, it, expect } from 'vitest';
import type { MatchdayEvent } from '../../types/matchday';
import { tournamentAgent } from '../agents/tournamentAgent';
import type { PlayerProfile } from '../../types/matchday';
import {
  stitchCalendarEventsWithFixtures,
  fixtureInvolvesOwnTeam,
  isKickoffAfterKokoontuminen,
  applyOfficialKickoffKeepCalendarArrival,
  normalizeTournamentArrival,
  isTournamentish,
  ownTeamFromCalendar
} from './reconciliationEngine';

const hall = {
  name: 'Utti-halli Kouvola',
  normalizedName: 'utti-halli',
  coordinates: { lat: 60.89, lng: 26.91 },
  isIndoor: true,
  surface: 'indoor_synthetic' as const,
  hasFloodlights: true
};

function ev(partial: Partial<MatchdayEvent> & Pick<MatchdayEvent, 'id'>): MatchdayEvent {
  return {
    profileId: 'p-simo',
    sport: 'floorball',
    eventType: 'match',
    isTraining: false,
    title: 'Ottelu',
    homeTeam: 'Westend Indians P14 Yellow',
    awayTeam: '',
    isHomeMatch: true,
    startTime: '2026-09-13T12:00:00.000Z',
    endTime: '2026-09-13T13:00:00.000Z',
    warmupTime: '2026-09-13T12:00:00.000Z',
    venue: hall,
    ...partial
  };
}

function taso(
  id: string,
  home: string,
  away: string,
  start: string,
  extra: Partial<MatchdayEvent> = {}
): MatchdayEvent {
  return ev({
    id: `fixture-ssbl-${id}`,
    officialFixtureId: id,
    title: `${home} vs ${away}`,
    homeTeam: home,
    awayTeam: away,
    startTime: start,
    endTime: new Date(new Date(start).getTime() + 60 * 60_000).toISOString(),
    ...extra
  });
}

const profiles: PlayerProfile[] = [
  {
    id: 'p-simo',
    playerName: 'Simo',
    teamName: 'Westend Indians P14 Yellow',
    sport: 'floorball',
    primaryColor: 'keltainen',
    calendarUrl: '',
    colorHex: '#eab308'
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

describe('FAMILY LOGIC GAUNTLET', () => {
  describe('A. clocks', () => {
    it('league: TASO kickoff, MyClub kokoontuminen kept', () => {
      const cal = ev({
        id: 'myclub-fb',
        sport: 'football',
        title: 'PPJ Laru Sininen vs EPS Valkoinen',
        homeTeam: 'PPJ Laru Sininen',
        awayTeam: 'EPS Valkoinen',
        startTime: '2026-09-12T06:15:00.000Z',
        warmupTime: '2026-09-12T06:15:00.000Z'
      });
      const fix = taso('spl1', 'PPJ/Laru Sininen', 'EPS/Valkoinen', '2026-09-12T07:00:00.000Z', {
        sport: 'football'
      });
      const card = stitchCalendarEventsWithFixtures([cal, fix])[0]!;
      expect(card.startTime).toBe('2026-09-12T07:00:00.000Z');
      expect(card.warmupTime).toBe('2026-09-12T06:15:00.000Z');
      expect(card.id).toBe('myclub-fb');
    });

    it('turnaus: DTSTART is meetup; invented −45 min is undone', () => {
      const n = normalizeTournamentArrival({
        startTime: '2026-09-13T12:00:00.000Z',
        warmupTime: '2026-09-13T11:15:00.000Z'
      });
      expect(n.warmupTime).toBe('2026-09-13T12:00:00.000Z');
    });

    it('kickoff after meetup = yes; 12.00 before 15.00 meetup = no; equal = yes; 4 min early = slack', () => {
      const meetup = ev({
        id: 'nh',
        eventType: 'tournament',
        isTournament: true,
        startTime: '2026-09-13T12:00:00.000Z'
      });
      expect(isKickoffAfterKokoontuminen(meetup, '2026-09-13T13:00:00.000Z')).toBe(true);
      expect(isKickoffAfterKokoontuminen(meetup, '2026-09-13T09:00:00.000Z')).toBe(false);
      expect(isKickoffAfterKokoontuminen(meetup, '2026-09-13T12:00:00.000Z')).toBe(true);
      expect(isKickoffAfterKokoontuminen(meetup, '2026-09-13T11:56:00.000Z')).toBe(true);
      expect(isKickoffAfterKokoontuminen(meetup, '2026-09-13T11:50:00.000Z')).toBe(false);
    });

    it('applyOfficialKickoffKeepCalendarArrival never moves kokoontuminen after kickoff', () => {
      const e = applyOfficialKickoffKeepCalendarArrival(
        {
          startTime: '2026-09-12T06:15:00.000Z',
          warmupTime: '2026-09-12T06:15:00.000Z',
          endTime: '2026-09-12T08:00:00.000Z'
        },
        { startTime: '2026-09-12T07:00:00.000Z', endTime: '2026-09-12T08:30:00.000Z' }
      );
      expect(new Date(e.warmupTime!).getTime()).toBeLessThan(new Date(e.startTime).getTime());
    });
  });

  describe('B. who is playing', () => {
    const yellowCal = ev({
      id: 'cal',
      title: 'Westend Indians P14: Turnaus Yellow',
      homeTeam: 'Westend Indians P14 Yellow',
      eventType: 'tournament'
    });

    it('own team home or away — TASO missing colour still ok', () => {
      expect(
        fixtureInvolvesOwnTeam(yellowCal, {
          homeTeam: 'Westend Indians Yellow',
          awayTeam: 'SB Vantaa',
          title: 'x'
        })
      ).toBe(true);
      expect(
        fixtureInvolvesOwnTeam(yellowCal, {
          homeTeam: 'Westend Indians',
          awayTeam: 'Oilers',
          title: 'x'
        })
      ).toBe(true);
    });

    it('Yellow ≠ Black, P14 ≠ P12, pool without Indians, own-team extractor', () => {
      expect(
        fixtureInvolvesOwnTeam(yellowCal, {
          homeTeam: 'Westend Indians Black',
          awayTeam: 'Oilers',
          title: 'x'
        })
      ).toBe(false);
      expect(
        fixtureInvolvesOwnTeam(yellowCal, {
          homeTeam: 'Westend Indians P12 Yellow',
          awayTeam: 'Oilers',
          title: 'x'
        })
      ).toBe(false);
      expect(
        fixtureInvolvesOwnTeam(yellowCal, {
          homeTeam: 'SB Vantaa Orange',
          awayTeam: 'Oilers White',
          title: 'x'
        })
      ).toBe(false);
      expect(ownTeamFromCalendar(yellowCal)).toContain('Indians');
    });
  });

  describe('C. stitch family weekend', () => {
    it('Nimenhuuto 15.00 + own morning + own 16.00 lists both; Black/pool stay off', () => {
      const cal = ev({
        id: 'nh-15',
        eventType: 'tournament',
        isTournament: true,
        title: 'Westend Indians P14: Turnaus Yellow',
        startTime: '2026-09-13T12:00:00.000Z'
      });
      const morning = taso('m', 'Westend Indians Yellow', 'SB Vantaa', '2026-09-13T09:00:00.000Z');
      const black = taso('b', 'Westend Indians Black', 'Oilers', '2026-09-13T13:00:00.000Z');
      const pool = taso('p', 'SB Vantaa', 'Oilers', '2026-09-13T13:10:00.000Z');
      const own = taso('o', 'SB Vantaa', 'Westend Indians Yellow', '2026-09-13T13:00:00.000Z');
      const stitched = stitchCalendarEventsWithFixtures([cal, morning, black, pool, own]);
      const card = stitched.find((e) => e.id === 'nh-15')!;
      expect(card.startTime).toBe('2026-09-13T13:00:00.000Z');
      expect(card.officialGameTimes?.map((g) => g.officialFixtureId)).toEqual(['m', 'o']);
      expect(stitched.some((e) => e.id === 'fixture-ssbl-b')).toBe(true);
    });

    it('two own TASO games after meetup fold onto one card', () => {
      const cal = ev({
        id: 'nh',
        eventType: 'tournament',
        isTournament: true,
        title: 'Westend Indians P14 Yellow',
        startTime: '2026-09-13T12:00:00.000Z'
      });
      const g1 = taso('g1', 'Westend Indians Yellow', 'A', '2026-09-13T12:30:00.000Z');
      const g2 = taso('g2', 'B', 'Westend Indians Yellow', '2026-09-13T14:00:00.000Z');
      const stitched = stitchCalendarEventsWithFixtures([cal, g1, g2]);
      expect(stitched.filter((e) => !e.id.startsWith('fixture-'))).toHaveLength(1);
      expect(stitched[0]!.officialGameTimes).toHaveLength(2);
      expect(stitched[0]!.warmupTime).toBe('2026-09-13T12:00:00.000Z');
      expect(stitched[0]!.startTime).toBe('2026-09-13T12:30:00.000Z');
    });

    it('training never stitches', () => {
      const treeni = ev({
        id: 'tr',
        isTraining: true,
        eventType: 'training',
        title: 'Treeni',
        startTime: '2026-09-13T12:00:00.000Z'
      });
      const fix = taso('x', 'Westend Indians Yellow', 'Oilers', '2026-09-13T12:30:00.000Z');
      const stitched = stitchCalendarEventsWithFixtures([treeni, fix]);
      expect(stitched.find((e) => e.id === 'tr')!.officialFixtureId).toBeUndefined();
      expect(stitched.some((e) => e.id === 'fixture-ssbl-x')).toBe(true);
    });

    it('football calendar does not swallow floorball TASO', () => {
      const cal = ev({
        id: 'fb',
        sport: 'football',
        title: 'PPJ Laru Sininen vs EPS',
        homeTeam: 'PPJ Laru Sininen',
        awayTeam: 'EPS Valkoinen',
        startTime: '2026-09-13T12:00:00.000Z',
        warmupTime: '2026-09-13T11:15:00.000Z'
      });
      const fbFix = taso('fb', 'Westend Indians Yellow', 'Oilers', '2026-09-13T12:30:00.000Z', {
        sport: 'floorball'
      });
      const stitched = stitchCalendarEventsWithFixtures([cal, fbFix]);
      expect(stitched.find((e) => e.id === 'fb')!.officialFixtureId).toBeUndefined();
    });

    it('basketball kids: stitch by team+time with empty lineup (no players required)', () => {
      const cal = ev({
        id: 'myclub-koris',
        sport: 'basketball',
        title: 'HNMKY T13 vs ToPoLa',
        homeTeam: 'HNMKY T13',
        awayTeam: 'ToPoLa',
        startTime: '2026-09-13T09:00:00.000Z',
        warmupTime: '2026-09-13T09:00:00.000Z',
        venue: {
          name: 'Töölön Kisahalli',
          normalizedName: 'kisahalli',
          coordinates: { lat: 60.18, lng: 24.93 },
          isIndoor: true,
          surface: 'indoor_parquet',
          hasFloodlights: true
        }
      });
      const fix = taso('b1', 'HNMKY T13', 'ToPoLa', '2026-09-13T09:45:00.000Z', {
        sport: 'basketball'
      });
      const card = stitchCalendarEventsWithFixtures([cal, fix]).find((e) => e.id === 'myclub-koris')!;
      expect(card.officialFixtureId).toBe('b1');
      expect(card.startTime).toBe('2026-09-13T09:45:00.000Z');
      expect(card.warmupTime).toBe('2026-09-13T09:00:00.000Z');
    });

    it('Helsinki calendar day, not UTC, around midnight', () => {
      // 23:00 and 23:30 EEST Saturday 12.9. — same FI day, UTC still 12.9.
      const cal = ev({
        id: 'late',
        sport: 'football',
        title: 'PPJ Laru Sininen vs EPS Valkoinen',
        homeTeam: 'PPJ Laru Sininen',
        awayTeam: 'EPS Valkoinen',
        startTime: '2026-09-12T20:00:00.000Z',
        warmupTime: '2026-09-12T20:00:00.000Z'
      });
      const fix = taso('night', 'PPJ/Laru Sininen', 'EPS/Valkoinen', '2026-09-12T20:30:00.000Z', {
        sport: 'football'
      });
      const card = stitchCalendarEventsWithFixtures([cal, fix]).find((e) => e.id === 'late')!;
      expect(card.officialFixtureId).toBe('night');

      // 00:15 FI Sunday gathering vs 00:45 FI kickoff — UTC date is still Saturday.
      const sunCal = ev({
        id: 'sun-am',
        sport: 'football',
        title: 'PPJ Laru Sininen vs EPS Valkoinen',
        homeTeam: 'PPJ Laru Sininen',
        awayTeam: 'EPS Valkoinen',
        startTime: '2026-09-12T21:15:00.000Z',
        warmupTime: '2026-09-12T21:15:00.000Z'
      });
      const sunFix = taso('dawn', 'PPJ/Laru Sininen', 'EPS/Valkoinen', '2026-09-12T21:45:00.000Z', {
        sport: 'football'
      });
      expect(stitchCalendarEventsWithFixtures([sunCal, sunFix]).find((e) => e.id === 'sun-am')!.officialFixtureId).toBe(
        'dawn'
      );
    });
  });

  describe('D. tournament day cards', () => {
    it('Sat / Sun / 26.9. are three cards; two kids at same hall are two cards', () => {
      const sat = ev({
        id: 'sat',
        eventType: 'tournament',
        tournamentName: 'Utti-cup',
        startTime: '2026-09-12T09:00:00.000Z'
      });
      const sun = ev({
        id: 'sun',
        eventType: 'tournament',
        tournamentName: 'Utti-cup',
        startTime: '2026-09-13T13:00:00.000Z'
      });
      const later = ev({
        id: 'later',
        eventType: 'tournament',
        tournamentName: 'Utti-cup',
        startTime: '2026-09-26T07:00:00.000Z'
      });
      const aada = ev({
        id: 'aada-sun',
        profileId: 'p-aada',
        sport: 'basketball',
        eventType: 'tournament',
        tournamentName: 'Utti-cup',
        title: 'HNMKY T13',
        homeTeam: 'HNMKY T13',
        startTime: '2026-09-13T13:00:00.000Z'
      });
      const blocks = tournamentAgent([sat, sun, later, aada], profiles);
      const simo = blocks.filter((b) => b.profileId === 'p-simo');
      expect(simo.map((b) => b.date)).toEqual(['2026-09-12', '2026-09-13', '2026-09-26']);
      expect(blocks.filter((b) => b.date === '2026-09-13')).toHaveLength(2);
    });

    it('turnaus keyword is detected; treeni is not', () => {
      expect(isTournamentish(ev({ id: 't', title: 'Westend Indians P14 Turnaus Yellow', eventType: 'match' }))).toBe(
        true
      );
      expect(isTournamentish(ev({ id: 'm', title: 'Sarjapeli', eventType: 'match' }))).toBe(false);
    });
  });
});
