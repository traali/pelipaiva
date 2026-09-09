import { describe, it, expect } from 'vitest';
import { stitchCalendarEventsWithFixtures } from './reconciliationEngine';
import { parseICSFeed } from '../calendar/icsParser';
import { generateIcsCalendarFeed } from '../calendar/calendarFeedGenerator';
import { MatchdayEvent, PlayerProfile } from '../../types/matchday';

const defaultVenue = {
  name: 'Väinämöinen tn',
  normalizedName: 'vainamoinen tn',
  coordinates: { lat: 60.1742, lng: 24.9189 },
  isIndoor: false,
  surface: 'artificial_turf_3g' as const,
  hasFloodlights: true,
};

function mockEvent(partial: Partial<MatchdayEvent>): MatchdayEvent {
  return {
    id: 'ev-test',
    profileId: 'profile-tuomas',
    sport: 'football',
    eventType: 'match',
    isTraining: false,
    title: 'Test Match',
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

describe('Torneopal & MyClub Reconciliation & Stitching Engine', () => {
  const profile: PlayerProfile = {
    id: 'profile-tuomas',
    playerName: 'Tuomas',
    teamName: 'PPJ Laru Sininen',
    sport: 'football',
    primaryColor: 'sininen',
    colorHex: '#0055a5',
    calendarUrl: 'https://id.myclub.fi/flow/calendar_subscriptions/9577.ics',
  };

  it('correctly parses real MyClub iCal feed and stitches with official Torneopal fixture', async () => {
    // 1. Real-world MyClub iCal feed entry
    const REAL_MYCLUB_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//myClub//myClub Calendar//FI
CALSCALE:GREGORIAN
BEGIN:VEVENT
UID:myclub-event-9577-44812@myclub.fi
DTSTART:20260912T061500Z
DTEND:20260912T083000Z
SUMMARY:Peli: PPJ Laru Sininen vs EPS Valkoinen
LOCATION:Väinämöisen kenttä tn, Helsinki
DESCRIPTION:Sarja: P13 Kakkonen\\nKokoontuminen klo 09:15, peli alkaa klo 10:00.\\nPelipaita: Sininen (vara keltainen).\\nValmentaja: 040-1234567
CATEGORIES:Pelit, P13 Sininen
X-MYCLUB-STATUS:IN
END:VEVENT
END:VCALENDAR`;

    const parsedEvents = await parseICSFeed(REAL_MYCLUB_ICS, profile.id, 'football');
    expect(parsedEvents).toHaveLength(1);
    const myClubEvent = parsedEvents[0]!;

    expect(myClubEvent.id).toBe('myclub-event-9577-44812@myclub.fi');
    expect(myClubEvent.title).toContain('PPJ Laru Sininen vs EPS Valkoinen');
    expect(myClubEvent.attendanceStatus).toBe('in');
    expect(myClubEvent.venue?.name).toBe('Väinämöisen kenttä tn, Helsinki');

    // 2. Real-world Torneopal official fixture (e.g. from Palloliitto SPL TASO API)
    const torneopalFixture = mockEvent({
      id: 'fixture-spl-109283',
      profileId: profile.id,
      officialFixtureId: 'spl_109283',
      sport: 'football',
      eventType: 'match',
      isTraining: false,
      title: 'PPJ/Laru Sininen vs EPS/Valkoinen',
      homeTeam: 'PPJ/Laru Sininen',
      awayTeam: 'EPS/Valkoinen',
      startTime: '2026-09-12T07:00:00.000Z', // 10:00 local kickoff (EEST)
      endTime: '2026-09-12T08:30:00.000Z',
      tournamentName: 'P13 Kakkonen Syksy',
      venue: {
        name: 'Väinämöinen tn',
        normalizedName: 'vainamoinen tn',
        coordinates: { lat: 60.1742, lng: 24.9189 },
        isIndoor: false,
        surface: 'artificial_turf_3g',
        hasFloodlights: true,
      },
    });

    // 3. Perform the dynamic stitch
    const rawEvents = [myClubEvent, torneopalFixture];
    const stitched = stitchCalendarEventsWithFixtures(rawEvents);

    // INVARIANT 1: Exactly 1 event returned (bare Torneopal fixture suppressed, zero card duplicates)
    expect(stitched).toHaveLength(1);
    const card = stitched[0]!;

    // INVARIANT 2: Official fixture link and reconciliation status
    expect(card.id).toBe('myclub-event-9577-44812@myclub.fi');
    expect(card.officialFixtureId).toBe('spl_109283');
    expect(card.reconciliationStatus).toBe('auto_matched');
    expect(card.tournamentName).toBe('P13 Kakkonen Syksy');

    // INVARIANT 3: Official kickoff (10:00) vs coach warmup gathering (09:15)
    expect(card.startTime).toBe('2026-09-12T07:00:00.000Z'); // 10:00 EEST match kickoff
    expect(card.warmupTime).toBe('2026-09-12T06:15:00.000Z'); // 09:15 EEST coach gathering

    // INVARIANT 4: MyClub attendance preserved
    expect(card.attendanceStatus).toBe('in');

    // INVARIANT 5: Authoritative Torneopal venue adopted and venue mismatch diagnostics recorded
    expect(card.venue?.name).toBe('Väinämöinen tn');
    expect(card.mismatchFlags?.venueMismatch).toBe(true);
    expect(card.mismatchFlags?.calendarVenueName).toBe('Väinämöisen kenttä tn, Helsinki');
    expect(card.mismatchFlags?.officialVenueName).toBe('Väinämöinen tn');

    // 4. Verification: Feed generation for Google Calendar & Google Nest
    const icsFeed = generateIcsCalendarFeed(stitched, [profile], {
      familyCode: 'TEST99',
      calendarTitle: 'FamDay Kalenteri',
    });

    // In Google Calendar / Nest, the event summary and details must be clean and spoken clearly
    expect(icsFeed).toContain('BEGIN:VCALENDAR');
    expect(icsFeed).toContain('SUMMARY:Tuomas: PPJ/Laru Sininen vs EPS/Valkoinen');
    expect(icsFeed).toContain('DTSTART:20260912T070000Z'); // 10:00 match start for voice assistants
    expect(icsFeed).toContain('Kokoontuminen: klo 09:15'); // Mentioned in description
    expect(icsFeed).toContain('Pelipaikka: Väinämöinen tn'); // Embedded in description
    expect(icsFeed).toContain('LOCATION:Väinämöinen tn');
    expect(icsFeed).toContain('END:VCALENDAR');
  });

  it('stitches squad-only MyClub title (e.g. PPJ Laru 2013: PIIRISARJA - SININEN) with Torneopal fixture', () => {
    const myClubEvent = mockEvent({
      id: 'myclub-squad-only',
      profileId: profile.id,
      title: 'PPJ Laru 2013: PIIRISARJA - SININEN',
      homeTeam: 'PPJ Laru 2013: PIIRISARJA',
      awayTeam: 'SININEN',
      startTime: '2026-09-12T06:15:00.000Z',
      endTime: '2026-09-12T08:30:00.000Z',
      warmupTime: '2026-09-12T06:15:00.000Z',
      attendanceStatus: 'in',
    });

    const torneopalFixture = mockEvent({
      id: 'fixture-spl-99881',
      profileId: profile.id,
      officialFixtureId: 'spl_99881',
      title: 'PPJ/Laru Sininen vs HooGee/Sininen',
      homeTeam: 'PPJ/Laru Sininen',
      awayTeam: 'HooGee/Sininen',
      startTime: '2026-09-12T07:00:00.000Z',
      endTime: '2026-09-12T08:30:00.000Z',
      tournamentName: 'P13 Kakkonen Syksy',
    });

    const stitched = stitchCalendarEventsWithFixtures([myClubEvent, torneopalFixture]);
    expect(stitched).toHaveLength(1);
    const card = stitched[0]!;

    expect(card.title).toBe('PPJ/Laru Sininen vs HooGee/Sininen');
    expect(card.officialFixtureId).toBe('spl_99881');
    expect(card.startTime).toBe('2026-09-12T07:00:00.000Z');
    expect(card.warmupTime).toBe('2026-09-12T06:15:00.000Z');
  });

  it('stitches Floorball Torneopal game with MyClub event without duplicate cards', () => {
    const myClubFloorball = mockEvent({
      id: 'myclub-salibandy-101',
      sport: 'floorball',
      title: 'Salibandyottelu: Indians vs Oilers',
      homeTeam: 'Westend Indians',
      awayTeam: 'Oilers',
      startTime: '2026-09-12T06:30:00.000Z', // 09:30 gathering
      endTime: '2026-09-12T08:30:00.000Z',
      warmupTime: '2026-09-12T06:30:00.000Z',
      attendanceStatus: 'in',
      venue: {
        name: 'Otahalli sali 1',
        normalizedName: 'otahalli sali 1',
        coordinates: { lat: 60.1834, lng: 24.8312 },
        isIndoor: true,
        surface: 'indoor_synthetic',
        hasFloodlights: true,
      },
    });

    const torneopalFloorball = mockEvent({
      id: 'fixture-ssbl-77665',
      officialFixtureId: 'ssbl_77665',
      sport: 'floorball',
      title: 'Westend Indians vs Oilers Black',
      homeTeam: 'Westend Indians',
      awayTeam: 'Oilers Black',
      startTime: '2026-09-12T07:00:00.000Z', // 10:00 match start
      endTime: '2026-09-12T08:30:00.000Z',
      warmupTime: '2026-09-12T06:30:00.000Z',
      venue: {
        name: 'Otahalli',
        normalizedName: 'otahalli',
        coordinates: { lat: 60.1834, lng: 24.8312 },
        isIndoor: true,
        surface: 'indoor_synthetic',
        hasFloodlights: true,
      },
    });

    const stitched = stitchCalendarEventsWithFixtures([myClubFloorball, torneopalFloorball]);
    expect(stitched).toHaveLength(1);
    const card = stitched[0]!;

    expect(card.title).toBe('Westend Indians vs Oilers Black');
    expect(card.officialFixtureId).toBe('ssbl_77665');
    expect(card.startTime).toBe('2026-09-12T07:00:00.000Z'); // 10:00 kickoff
    expect(card.warmupTime).toBe('2026-09-12T06:30:00.000Z'); // 09:30 gathering
    expect(card.attendanceStatus).toBe('in');
  });
});
