import { describe, it, expect } from 'vitest';
import { stitchCalendarEventsWithFixtures } from '../../../src/lib/reconciliation/reconciliationEngine';
import { calculateTeamSimilarity } from '../../../src/lib/reconciliation/teamNameMatcher';
import { parseICSFeed } from '../../../src/lib/calendar/icsParser';
import { generateIcsCalendarFeed } from '../../../src/lib/calendar/calendarFeedGenerator';
import { MatchdayEvent, PlayerProfile } from '../../../src/types/matchday';
import { loadIcsFixture } from '../../helpers/fixtureLoader';

const defaultVenue = {
  name: 'Väinämöinen tn',
  normalizedName: 'vainamoinen tn',
  address: 'Väinämöisenkatu 4, 00100 Helsinki',
  coordinates: { lat: 60.1742, lng: 24.9189 },
  isIndoor: false,
  surface: 'artificial_turf_3g' as const,
  hasFloodlights: true,
};

function createMockEvent(partial: Partial<MatchdayEvent>): MatchdayEvent {
  return {
    id: 'ev-' + Math.random().toString(36).slice(2, 8),
    profileId: 'profile-tuomas',
    sport: 'football',
    eventType: 'match',
    isTraining: false,
    title: 'PPJ Laru Sininen vs EPS Valkoinen',
    homeTeam: 'PPJ Laru Sininen',
    awayTeam: 'EPS Valkoinen',
    isHomeMatch: true,
    startTime: '2026-09-12T07:00:00.000Z',
    endTime: '2026-09-12T08:30:00.000Z',
    warmupTime: '2026-09-12T06:15:00.000Z',
    venue: defaultVenue,
    ...partial,
  };
}

describe('Feature 26: Multi-Source Event Reconciliation, Stitching & Feed Export Verification', () => {
  const profileTuomas: PlayerProfile = {
    id: 'profile-tuomas',
    playerName: 'Tuomas',
    teamName: 'PPJ Laru Sininen',
    sport: 'football',
    primaryColor: 'sininen',
    colorHex: '#0055a5',
    calendarUrl: 'https://id.myclub.fi/flow/calendar_subscriptions/9577.ics',
  };

  const profileSimo: PlayerProfile = {
    id: 'profile-simo',
    playerName: 'Simo',
    teamName: 'EräViikingit P12 Musta',
    sport: 'floorball',
    primaryColor: 'musta',
    colorHex: '#111111',
  };

  describe('Invariant 1: Deduplication Cardinality & Bare Fixture Suppression', () => {
    it('merges 100% of paired Torneopal and MyClub events into exactly 1 event card and suppresses bare fixtures', async () => {
      // 1. MyClub Event (earlier arrival time, informal venue name)
      const myClubEvent = createMockEvent({
        id: 'myclub-match-101',
        profileId: profileTuomas.id,
        title: 'PPJ Laru Sininen vs EPS Valkoinen',
        homeTeam: 'PPJ Laru Sininen',
        awayTeam: 'EPS Valkoinen',
        startTime: '2026-09-12T06:15:00.000Z', // 09:15 EEST gathering
        warmupTime: '2026-09-12T06:15:00.000Z',
        attendanceStatus: 'in',
        venue: {
          name: 'Väiski tekonurmi',
          normalizedName: 'vaiski tekonurmi',
          coordinates: { lat: 60.174, lng: 24.918 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true,
        },
      });

      // 2. Torneopal Bare League Fixture (official kickoff, official registered pitch)
      const bareTorneopalFixture = createMockEvent({
        id: 'fixture-spl-88219',
        profileId: profileTuomas.id,
        officialFixtureId: 'spl_88219',
        title: 'PPJ/Laru Sininen vs EPS/Valkoinen',
        homeTeam: 'PPJ/Laru Sininen',
        awayTeam: 'EPS/Valkoinen',
        startTime: '2026-09-12T07:00:00.000Z', // 10:00 EEST kickoff
        tournamentName: 'P13 Kakkonen Syksy',
        venue: {
          name: 'Väinämöinen tn',
          normalizedName: 'vainamoinen tn',
          address: 'Väinämöisenkatu 4, 00100 Helsinki',
          coordinates: { lat: 60.1742, lng: 24.9189 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true,
        },
      });

      // 3. Unrelated bare fixture (e.g. another match later in the season, unpaired)
      const unpairedFixture = createMockEvent({
        id: 'fixture-spl-99100',
        officialFixtureId: 'spl_99100',
        title: 'PPJ/Laru Sininen vs KäPa/United',
        homeTeam: 'PPJ/Laru Sininen',
        awayTeam: 'KäPa/United',
        startTime: '2026-09-19T10:00:00.000Z',
        tournamentName: 'P13 Kakkonen Syksy',
      });

      const input = [myClubEvent, bareTorneopalFixture, unpairedFixture];
      const stitched = stitchCalendarEventsWithFixtures(input);

      // Total result count must be exactly 2: 1 merged card + 1 unpaired bare fixture
      expect(stitched).toHaveLength(2);

      // The paired event card must have adopted the calendar ID, suppressed the paired bare fixture
      const merged = stitched.find((e) => e.id === myClubEvent.id);
      expect(merged).toBeDefined();
      expect(stitched.find((e) => e.id === bareTorneopalFixture.id)).toBeUndefined();

      // Official fixture link and reconciliation metadata
      expect(merged!.officialFixtureId).toBe('spl_88219');
      expect(merged!.reconciliationStatus).toBe('auto_matched');
      expect(merged!.tournamentName).toBe('P13 Kakkonen Syksy');

      // The unpaired fixture remains intact as a bare fixture
      const remainingUnpaired = stitched.find((e) => e.id === unpairedFixture.id);
      expect(remainingUnpaired).toBeDefined();
      expect(remainingUnpaired!.officialFixtureId).toBe('spl_99100');
    });
  });

  describe('Invariant 2: Kickoff vs. Warmup Timing Synchronization', () => {
    it('strictly sources kickoff time from Torneopal as startTime and preserves warmupTime from MyClub', () => {
      const myClubEvent = createMockEvent({
        id: 'mc-kickoff-warmup-1',
        title: 'Ottelu: Westend Indians vs Oilers Black',
        homeTeam: 'Westend Indians',
        awayTeam: 'Oilers Black',
        startTime: '2026-10-03T07:15:00.000Z', // 10:15 coach gathering
        warmupTime: '2026-10-03T07:15:00.000Z',
      });

      const torneopalFixture = createMockEvent({
        id: 'fixture-ssbl-5512',
        officialFixtureId: 'ssbl_5512',
        title: 'Westend Indians vs Oilers Black',
        homeTeam: 'Westend Indians',
        awayTeam: 'Oilers Black',
        startTime: '2026-10-03T08:00:00.000Z', // 11:00 official kickoff
        endTime: '2026-10-03T09:30:00.000Z',
      });

      const stitched = stitchCalendarEventsWithFixtures([myClubEvent, torneopalFixture]);
      expect(stitched).toHaveLength(1);

      const card = stitched[0]!;
      // Official kickoff is set as startTime
      expect(card.startTime).toBe('2026-10-03T08:00:00.000Z');
      // Coach gathering time is preserved as warmupTime
      expect(card.warmupTime).toBe('2026-10-03T07:15:00.000Z');
      expect(card.endTime).toBe('2026-10-03T09:30:00.000Z');
    });

    it('handles identical kickoff and calendar start time gracefully', () => {
      const myClubEvent = createMockEvent({
        id: 'mc-exact-start',
        title: 'ErVi vs Classic',
        homeTeam: 'ErVi',
        awayTeam: 'Classic',
        startTime: '2026-10-10T11:00:00.000Z',
      });

      const torneopalFixture = createMockEvent({
        id: 'fixture-ssbl-7711',
        officialFixtureId: 'ssbl_7711',
        title: 'ErVi vs Classic',
        homeTeam: 'ErVi',
        awayTeam: 'Classic',
        startTime: '2026-10-10T11:00:00.000Z',
      });

      const stitched = stitchCalendarEventsWithFixtures([myClubEvent, torneopalFixture]);
      expect(stitched).toHaveLength(1);
      expect(stitched[0]!.startTime).toBe('2026-10-10T11:00:00.000Z');
      expect(stitched[0]!.officialFixtureId).toBe('ssbl_7711');
    });
  });

  describe('Invariant 3: Multi-Squad Separation & Cross-Squad False Merge Prevention', () => {
    it('prevents cross-squad false merges between Sininen and Valkoinen squads', async () => {
      const nimenhuutoIcs = loadIcsFixture('nimenhuuto_hjk_multisquad.ics');
      const events = await parseICSFeed(nimenhuutoIcs, 'profile-hjk-club', 'football');

      // Find the Sininen and Valkoinen matches from the parsed real feed
      const sininenCal = events.find((e) => e.title.includes('Sininen vs EPS'));
      const valkoinenCal = events.find((e) => e.title.includes('Valkoinen vs FC Espoo'));
      expect(sininenCal).toBeDefined();
      expect(valkoinenCal).toBeDefined();

      // Create official fixtures for Sininen and Valkoinen
      const sininenFixture = createMockEvent({
        id: 'fixture-spl-sininen-88',
        officialFixtureId: 'spl_sininen_88',
        title: 'HJK/Sininen vs EPS/Musta',
        homeTeam: 'HJK/Sininen',
        awayTeam: 'EPS/Musta',
        startTime: '2026-05-16T12:00:00.000Z', // 15:00 kickoff (EEST)
      });

      const valkoinenFixture = createMockEvent({
        id: 'fixture-spl-valkoinen-99',
        officialFixtureId: 'spl_valkoinen_99',
        title: 'HJK/Valkoinen vs FC Espoo/Sininen',
        homeTeam: 'HJK/Valkoinen',
        awayTeam: 'FC Espoo/Sininen',
        startTime: '2026-05-16T14:00:00.000Z', // 17:00 kickoff (EEST)
      });

      // Stitch together
      const stitched = stitchCalendarEventsWithFixtures([
        sininenCal!,
        valkoinenCal!,
        sininenFixture,
        valkoinenFixture,
      ]);

      // Both should stitch with their respective squad only!
      expect(stitched).toHaveLength(2);

      const stitchedSininen = stitched.find((e) => e.id === sininenCal!.id);
      const stitchedValkoinen = stitched.find((e) => e.id === valkoinenCal!.id);

      expect(stitchedSininen).toBeDefined();
      expect(stitchedValkoinen).toBeDefined();

      expect(stitchedSininen!.officialFixtureId).toBe('spl_sininen_88');
      expect(stitchedValkoinen!.officialFixtureId).toBe('spl_valkoinen_99');
    });

    it('rejects cross-squad merge even when kickoff times are within ±180 min on the same day', () => {
      // Sininen calendar event
      const sininenCal = createMockEvent({
        id: 'cal-sininen-lonely',
        title: 'HJK T13 Sininen vs Honka',
        homeTeam: 'HJK T13 Sininen',
        awayTeam: 'Honka',
        startTime: '2026-05-16T11:00:00.000Z',
      });

      // Valkoinen official fixture 30 min later
      const valkoinenFix = createMockEvent({
        id: 'fixture-spl-valk-conflict',
        officialFixtureId: 'spl_valk_conflict',
        title: 'HJK T13 Valkoinen vs Honka',
        homeTeam: 'HJK T13 Valkoinen',
        awayTeam: 'Honka',
        startTime: '2026-05-16T11:30:00.000Z',
      });

      const stitched = stitchCalendarEventsWithFixtures([sininenCal, valkoinenFix]);

      // MUST NOT MERGE due to squad color penalty (sininen vs valkoinen)
      expect(stitched).toHaveLength(2);
      expect(stitched.find((e) => e.id === sininenCal.id)?.officialFixtureId).toBeUndefined();
      expect(stitched.find((e) => e.id === valkoinenFix.id)).toBeDefined();
    });
  });

  describe('Invariant 4: Metadata Enrichment (Attendance, Talkoo Duties, Jersey Colors)', () => {
    it('preserves MyClub attendance status, volunteer duties and kit guidance through stitching', async () => {
      const erviIcs = loadIcsFixture('myclub_ervi_talkoovahti.ics');
      const events = await parseICSFeed(erviIcs, profileSimo.id, 'floorball');

      // ErVi P12 Musta event has talkoovahti: Kirjuri, Kello, Järkkäri, Kioskivuoro
      const erviMustaMatch = events.find((e) => e.title.includes('Musta vs Oilers'));
      expect(erviMustaMatch).toBeDefined();
      expect(erviMustaMatch!.volunteerDuty).toBeDefined();

      const ssblFixture = createMockEvent({
        id: 'fixture-ssbl-ervi-1',
        officialFixtureId: 'ssbl_ervi_1',
        sport: 'floorball',
        title: 'ErVi Musta vs Oilers',
        homeTeam: 'ErVi Musta',
        awayTeam: 'Oilers',
        startTime: '2026-04-11T11:00:00.000Z', // 14:00 kickoff
        venue: {
          name: 'Mosahalli',
          normalizedName: 'mosahalli',
          address: 'Erätie 3, 00730 Helsinki',
          coordinates: { lat: 60.2505, lng: 25.0189 },
          isIndoor: true,
          surface: 'indoor_synthetic',
          hasFloodlights: true,
        },
      });

      const stitched = stitchCalendarEventsWithFixtures([erviMustaMatch!, ssblFixture]);
      expect(stitched).toHaveLength(1);

      const card = stitched[0]!;
      expect(card.officialFixtureId).toBe('ssbl_ervi_1');
      expect(card.startTime).toBe('2026-04-11T11:00:00.000Z');
      expect(card.warmupTime).toBe('2026-04-11T10:15:00.000Z'); // from description: kokoontuminen klo 13:15
      expect(card.volunteerDuty).toContain('Kirjuri');
    });

    it('preserves OUT attendance status and manual volunteer duties', () => {
      const calEvent = createMockEvent({
        id: 'cal-with-duty-and-out',
        title: 'PPJ Laru Sininen vs VJS',
        attendanceStatus: 'out',
        volunteerDuty: '☕ Kahviovuoro (klo 14:30 - 16:30)',
        startTime: '2026-09-12T06:15:00.000Z',
      });

      const fix = createMockEvent({
        id: 'fixture-spl-7722',
        officialFixtureId: 'spl_7722',
        title: 'PPJ/Laru Sininen vs VJS',
        homeTeam: 'PPJ/Laru Sininen',
        awayTeam: 'VJS',
        startTime: '2026-09-12T07:00:00.000Z',
      });

      const stitched = stitchCalendarEventsWithFixtures([calEvent, fix]);
      expect(stitched).toHaveLength(1);
      expect(stitched[0]!.attendanceStatus).toBe('out');
      expect(stitched[0]!.volunteerDuty).toBe('☕ Kahviovuoro (klo 14:30 - 16:30)');
    });
  });

  describe('Invariant 5: Authoritative Venue Adoption & Mismatch Diagnostics', () => {
    it('adopts Torneopal official venue while recording non-breaking mismatch diagnostics when colloquial name was used', () => {
      const calEvent = createMockEvent({
        id: 'cal-venue-colloquial',
        title: 'HJK T13 Sininen vs EPS',
        homeTeam: 'HJK T13 Sininen',
        awayTeam: 'EPS',
        startTime: '2026-05-16T11:15:00.000Z',
        venue: {
          name: 'Bubu tekonurmi (Bollis 6)',
          normalizedName: 'bubu tekonurmi bollis 6',
          coordinates: { lat: 60.187, lng: 24.928 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true,
        },
      });

      const fix = createMockEvent({
        id: 'fixture-spl-bubu',
        officialFixtureId: 'spl_bubu_01',
        title: 'HJK Sininen vs EPS',
        homeTeam: 'HJK Sininen',
        awayTeam: 'EPS',
        startTime: '2026-05-16T12:00:00.000Z',
        venue: {
          name: 'Töölö PK 6 tn',
          normalizedName: 'toolo pk 6 tn',
          address: 'Urheilukatu 5, 00250 Helsinki',
          coordinates: { lat: 60.1874, lng: 24.9278 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true,
        },
      });

      const stitched = stitchCalendarEventsWithFixtures([calEvent, fix]);
      expect(stitched).toHaveLength(1);

      const card = stitched[0]!;
      // Official venue is adopted
      expect(card.venue?.name).toBe('Töölö PK 6 tn');
      expect(card.venue?.address).toBe('Urheilukatu 5, 00250 Helsinki');

      // Mismatch flags recorded for UI banner
      expect(card.mismatchFlags?.venueMismatch).toBe(true);
      expect(card.mismatchFlags?.calendarVenueName).toBe('Bubu tekonurmi (Bollis 6)');
      expect(card.mismatchFlags?.officialVenueName).toBe('Töölö PK 6 tn');
    });
  });

  describe('Invariant 6: Europe/Helsinki Midnight Boundary Date Partitioning', () => {
    it('uses helsinkiDayKey to correctly partition events near UTC midnight', () => {
      // In EEST (UTC+3):
      // 2026-06-12T20:30:00.000Z is 23:30 on June 12 in Helsinki.
      // 2026-06-12T21:30:00.000Z is 00:30 on June 13 in Helsinki.
      // Even though their UTC date strings and times are within 60 min,
      // they fall on DIFFERENT Helsinki calendar days!
      const calJune12 = createMockEvent({
        id: 'cal-eve-june12',
        title: 'PPJ Sininen vs Honka',
        homeTeam: 'PPJ Sininen',
        awayTeam: 'Honka',
        startTime: '2026-06-12T20:30:00.000Z', // 23:30 June 12 Helsinki
      });

      const fixJune13 = createMockEvent({
        id: 'fixture-spl-june13',
        officialFixtureId: 'spl_june13',
        title: 'PPJ Sininen vs Honka',
        homeTeam: 'PPJ Sininen',
        awayTeam: 'Honka',
        startTime: '2026-06-12T21:30:00.000Z', // 00:30 June 13 Helsinki
      });

      const stitched = stitchCalendarEventsWithFixtures([calJune12, fixJune13]);
      // Must NOT stitch across midnight boundary of Helsinki calendar day
      expect(stitched).toHaveLength(2);
      expect(stitched.find((e) => e.id === calJune12.id)?.officialFixtureId).toBeUndefined();
    });

    it('correctly stitches events when both fall on the same Helsinki day regardless of UTC day', () => {
      // Both at 01:00 and 01:45 Helsinki time on June 13 (22:00 and 22:45 UTC on June 12)
      const calSame = createMockEvent({
        id: 'cal-night-same',
        title: 'PPJ Sininen vs Honka',
        homeTeam: 'PPJ Sininen',
        awayTeam: 'Honka',
        startTime: '2026-06-12T22:00:00.000Z', // 01:00 June 13 Helsinki
      });

      const fixSame = createMockEvent({
        id: 'fixture-spl-night-same',
        officialFixtureId: 'spl_night_same',
        title: 'PPJ Sininen vs Honka',
        homeTeam: 'PPJ Sininen',
        awayTeam: 'Honka',
        startTime: '2026-06-12T22:45:00.000Z', // 01:45 June 13 Helsinki
      });

      const stitched = stitchCalendarEventsWithFixtures([calSame, fixSame]);
      expect(stitched).toHaveLength(1);
      expect(stitched[0]!.officialFixtureId).toBe('spl_night_same');
    });
  });

  describe('Invariant 7: RFC 5545 Feed Export Verification (generateIcsCalendarFeed)', () => {
    it('verifies DTSTART kickoff timing, venue and departure fallback in DESCRIPTION, and SUMMARY formatting', () => {
      const eventWithBriefing = createMockEvent({
        id: 'ev-export-1',
        profileId: profileTuomas.id,
        title: 'PPJ/Laru Sininen vs EPS/Valkoinen',
        homeTeam: 'PPJ/Laru Sininen',
        awayTeam: 'EPS/Valkoinen',
        startTime: '2026-09-12T07:00:00.000Z', // 10:00 EEST kickoff
        endTime: '2026-09-12T08:30:00.000Z',
        warmupTime: '2026-09-12T06:15:00.000Z', // 09:15 EEST gathering
        volunteerDuty: '☕ Kahviovuoro klo 09:00 - 11:30',
        venue: {
          name: 'Väinämöinen tn',
          normalizedName: 'vainamoinen tn',
          address: 'Väinämöisenkatu 4, 00100 Helsinki',
          coordinates: { lat: 60.1742, lng: 24.9189 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true,
        },
        briefing: {
          recommendedDepartureTime: '2026-09-12T05:35:00.000Z', // 08:35 EEST departure
          gearAndPackingAdvice: {
            kitRecommendation: 'Sininen (vara: Keltainen)',
            essentialGear: ['Säärisuojat', 'Juomapullo', 'Nappikset'],
          },
        } as any,
      });

      const feed = generateIcsCalendarFeed([eventWithBriefing], [profileTuomas], {
        calendarTitle: 'FamDay Perhe',
      });

      // SUMMARY formatted with player name + fixture for Google Nest voice queries
      expect(feed).toContain('SUMMARY:Tuomas: PPJ/Laru Sininen vs EPS/Valkoinen');

      // DTSTART strictly kickoff time in UTC
      expect(feed).toContain('DTSTART:20260912T070000Z');
      expect(feed).toContain('DTEND:20260912T083000Z');

      // RFC 5545 LOCATION and GEO
      expect(feed).toContain('LOCATION:Väinämöinen tn\\, Väinämöisenkatu 4\\, 00100 Helsinki');
      expect(feed).toContain('GEO:60.1742;24.9189');

      // DESCRIPTION rich embeddings:
      // Gathering time
      expect(feed).toContain('Kokoontuminen: klo 09:15');
      // Recommended departure time
      expect(feed).toContain('Kotoalähtöaika: klo 08:35');
      // Kit recommendation
      expect(feed).toContain('Peliasu: Sininen (vara: Keltainen)');
      // Volunteer duty
      expect(feed).toContain('Talkoovuoro: ☕ Kahviovuoro klo 09:00 - 11:30');
      // Embedded venue inside DESCRIPTION
      expect(feed).toContain('Pelipaikka: Väinämöinen tn\\, Väinämöisenkatu 4\\, 00100 Helsinki');
    });

    it('verifies departure time fallback via (ev as any).leaveHomeBy when briefing is absent', () => {
      const eventWithLeaveHomeBy = createMockEvent({
        id: 'ev-export-fallback',
        profileId: profileTuomas.id,
        title: 'HJK vs Honka',
        startTime: '2026-09-12T11:00:00.000Z',
        venue: {
          name: 'Sahara tn',
          normalizedName: 'sahara tn',
          coordinates: { lat: 60.187, lng: 24.926 },
          isIndoor: false,
          surface: 'artificial_turf_3g',
          hasFloodlights: true,
        },
        leaveHomeBy: '2026-09-12T09:45:00.000Z', // 12:45 EEST
      } as any);

      const feed = generateIcsCalendarFeed([eventWithLeaveHomeBy], [profileTuomas]);
      expect(feed).toContain('Kotoalähtöaika: klo 12:45');
      expect(feed).toContain('Pelipaikka: Sahara tn');
    });
  });

  describe('Challenger 1 Adversarial Edge Cases & Invariant Hardening', () => {
    it('prevents doubleheader greedy overwrite and maintains 1-to-1 pairings for rapid successive matches', () => {
      const cal1 = createMockEvent({
        id: 'cal-dh-1',
        title: 'HJK Sininen vs Honka',
        homeTeam: 'HJK Sininen',
        awayTeam: 'Honka',
        startTime: '2026-06-15T06:30:00.000Z', // 09:30 FI
      });
      const cal2 = createMockEvent({
        id: 'cal-dh-2',
        title: 'HJK Sininen vs TPS',
        homeTeam: 'HJK Sininen',
        awayTeam: 'TPS',
        startTime: '2026-06-15T08:00:00.000Z', // 11:00 FI
      });
      const fix1 = createMockEvent({
        id: 'fixture-spl-dh-1',
        officialFixtureId: 'spl_dh_1',
        title: 'HJK Sininen vs Honka',
        homeTeam: 'HJK Sininen',
        awayTeam: 'Honka',
        startTime: '2026-06-15T07:00:00.000Z', // 10:00 FI
      });
      const fix2 = createMockEvent({
        id: 'fixture-spl-dh-2',
        officialFixtureId: 'spl_dh_2',
        title: 'HJK Sininen vs TPS',
        homeTeam: 'HJK Sininen',
        awayTeam: 'TPS',
        startTime: '2026-06-15T08:30:00.000Z', // 11:30 FI
      });

      const stitched = stitchCalendarEventsWithFixtures([cal1, cal2, fix1, fix2]);
      expect(stitched).toHaveLength(2);

      const sCal1 = stitched.find((e) => e.id === 'cal-dh-1');
      const sCal2 = stitched.find((e) => e.id === 'cal-dh-2');
      const bare1 = stitched.find((e) => e.id === 'fixture-spl-dh-1');
      const bare2 = stitched.find((e) => e.id === 'fixture-spl-dh-2');

      expect(sCal1?.officialFixtureId).toBe('spl_dh_1');
      expect(sCal1?.title).toBe('HJK Sininen vs Honka');
      expect(sCal2?.officialFixtureId).toBe('spl_dh_2');
      expect(sCal2?.title).toBe('HJK Sininen vs TPS');
      expect(bare1).toBeUndefined();
      expect(bare2).toBeUndefined();
    });

    it('enforces two-sided team matching and prevents friendly match from swallowing official league fixture', () => {
      const calPaired = createMockEvent({
        id: 'cal-paired',
        title: 'HJK vs Honka',
        homeTeam: 'HJK',
        awayTeam: 'Honka',
        startTime: '2026-06-15T06:30:00.000Z',
      });
      const fixPaired = createMockEvent({
        id: 'fixture-spl-paired',
        officialFixtureId: 'spl_paired',
        title: 'HJK vs Honka',
        homeTeam: 'HJK',
        awayTeam: 'Honka',
        startTime: '2026-06-15T07:00:00.000Z',
      });

      const calDistinctOpp = createMockEvent({
        id: 'cal-distinct-opp',
        title: 'HJK vs Tampere United',
        homeTeam: 'HJK',
        awayTeam: 'Tampere United',
        startTime: '2026-06-15T08:30:00.000Z',
      });
      const fixDistinctOpp = createMockEvent({
        id: 'fixture-spl-distinct-opp',
        officialFixtureId: 'spl_distinct_opp',
        title: 'HJK vs KuPS',
        homeTeam: 'HJK',
        awayTeam: 'KuPS',
        startTime: '2026-06-15T09:00:00.000Z',
      });

      const stitched = stitchCalendarEventsWithFixtures([
        calPaired,
        fixPaired,
        calDistinctOpp,
        fixDistinctOpp,
      ]);

      expect(stitched).toHaveLength(3);
      const distinctCal = stitched.find((e) => e.id === 'cal-distinct-opp');
      const distinctFix = stitched.find((e) => e.id === 'fixture-spl-distinct-opp');

      expect(distinctCal?.officialFixtureId).toBeUndefined();
      expect(distinctCal?.title).toBe('HJK vs Tampere United');
      expect(distinctFix).toBeDefined();
      expect(distinctFix?.officialFixtureId).toBe('spl_distinct_opp');
    });

    it('adopts official venue immediately when calendar venue is undefined or empty', () => {
      // Case A: cal.venue is undefined
      const calUndefinedVenue = createMockEvent({
        id: 'cal-no-venue',
        title: 'HJK vs Honka',
        homeTeam: 'HJK',
        awayTeam: 'Honka',
        venue: undefined,
      });
      const fixFullVenueA = createMockEvent({
        id: 'fixture-spl-venue-a',
        officialFixtureId: 'fix_a',
        title: 'HJK vs Honka',
        homeTeam: 'HJK',
        awayTeam: 'Honka',
        venue: {
          name: 'Väinämöinen tn',
          normalizedName: 'vainamoinen tn',
          address: 'Väinämöisenkatu 4',
        } as any,
      });

      const resA = stitchCalendarEventsWithFixtures([calUndefinedVenue, fixFullVenueA]);
      expect(resA).toHaveLength(1);
      expect(resA[0]!.venue?.name).toBe('Väinämöinen tn');
      expect(resA[0]!.mismatchFlags?.venueMismatch).toBeUndefined();

      // Case B: cal.venue is empty string
      const calEmptyVenue = createMockEvent({
        id: 'cal-empty-venue',
        title: 'HJK vs Honka',
        homeTeam: 'HJK',
        awayTeam: 'Honka',
        venue: { name: '', normalizedName: '' } as any,
      });
      const fixFullVenueB = createMockEvent({
        id: 'fixture-spl-venue-b',
        officialFixtureId: 'fix_b',
        title: 'HJK vs Honka',
        homeTeam: 'HJK',
        awayTeam: 'Honka',
        venue: {
          name: 'Töölö PK 6 tn',
          normalizedName: 'toolo pk 6 tn',
          address: 'Urheilukatu 5',
        } as any,
      });

      const resB = stitchCalendarEventsWithFixtures([calEmptyVenue, fixFullVenueB]);
      expect(resB).toHaveLength(1);
      expect(resB[0]!.venue?.name).toBe('Töölö PK 6 tn');
    });

    it('recognizes PPJ Laru and PPJ/Lauttasaari as squad synonyms with similarity >= 0.70', () => {
      const sim = calculateTeamSimilarity('PPJ Laru', 'PPJ/Lauttasaari');
      expect(sim).toBeGreaterThanOrEqual(0.70);

      const calLaru = createMockEvent({
        id: 'cal-laru',
        title: 'PPJ Laru vs Honka',
        homeTeam: 'PPJ Laru',
        awayTeam: 'Honka',
        startTime: '2026-06-15T06:15:00.000Z',
      });
      const fixLauttasaari = createMockEvent({
        id: 'fixture-spl-lauttasaari',
        officialFixtureId: 'spl_laru_1',
        title: 'PPJ/Lauttasaari vs Honka',
        homeTeam: 'PPJ/Lauttasaari',
        awayTeam: 'Honka',
        startTime: '2026-06-15T07:00:00.000Z',
      });

      const stitched = stitchCalendarEventsWithFixtures([calLaru, fixLauttasaari]);
      expect(stitched).toHaveLength(1);
      expect(stitched[0]!.officialFixtureId).toBe('spl_laru_1');
      expect(stitched[0]!.reconciliationStatus).toBe('auto_matched');
    });

    it('strictly prevents false merge on away games where only one opponent matches (KäPa vs Honka vs Honka vs HJK)', () => {
      // Calendar event: Honka vs HJK Sininen (HJK Sininen away at Honka)
      const calAway = createMockEvent({
        id: 'cal-away-hjk',
        title: 'Honka vs HJK Sininen',
        homeTeam: 'Honka',
        awayTeam: 'HJK Sininen',
        isHomeMatch: false,
        startTime: '2026-06-15T09:15:00.000Z',
      });

      // Unrelated fixture: KäPa vs Honka (Honka playing KäPa, HJK not involved)
      const fixUnrelated = createMockEvent({
        id: 'fixture-spl-kapa-honka',
        officialFixtureId: 'spl_kapa_honka',
        title: 'KäPa vs Honka',
        homeTeam: 'KäPa',
        awayTeam: 'Honka',
        isHomeMatch: false,
        startTime: '2026-06-15T10:00:00.000Z',
      });

      const stitched = stitchCalendarEventsWithFixtures([calAway, fixUnrelated]);
      expect(stitched).toHaveLength(2);

      const calCard = stitched.find((e) => e.id === 'cal-away-hjk');
      const fixCard = stitched.find((e) => e.id === 'fixture-spl-kapa-honka');

      expect(calCard?.officialFixtureId).toBeUndefined();
      expect(calCard?.title).toBe('Honka vs HJK Sininen');
      expect(fixCard).toBeDefined();
      expect(fixCard?.officialFixtureId).toBe('spl_kapa_honka');
    });
  });
});
