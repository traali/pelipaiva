import { describe, it, expect } from 'vitest';
import ICAL from 'ical.js';
import {
  generateIcsCalendarFeed,
  escapeIcsText
} from '../../../src/lib/calendar/calendarFeedGenerator';
import { stitchCalendarEventsWithFixtures } from '../../../src/lib/reconciliation/reconciliationEngine';
import { MatchdayEvent, PlayerProfile } from '../../../src/types/matchday';

function createMockEvent(partial: Partial<MatchdayEvent>): MatchdayEvent {
  return {
    id: 'ev-' + Math.random().toString(36).slice(2, 8),
    profileId: 'prof-tuomas',
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
    venue: {
      name: 'Väinämöinen tn',
      normalizedName: 'vainamoinen tn',
      address: 'Väinämöisenkatu 4, 00100 Helsinki',
      coordinates: { lat: 60.1742, lng: 24.9189 },
      isIndoor: false,
      surface: 'artificial_turf_3g',
      hasFloodlights: true
    },
    ...partial
  };
}

const profileTuomas: PlayerProfile = {
  id: 'prof-tuomas',
  playerName: 'Tuomas',
  teamName: 'PPJ Laru Sininen',
  sport: 'football',
  primaryColor: 'sininen',
  colorHex: '#0055a5'
};

const profileAada: PlayerProfile = {
  id: 'prof-aada',
  playerName: 'Aada',
  teamName: 'TOPOLA T12',
  sport: 'basketball',
  primaryColor: 'keltainen',
  colorHex: '#f59e0b'
};

describe('Adversarial Stress Suite — M2 RFC 5545 Feed Export & Voice Assistant Query Fidelity', () => {

  // ==========================================================================
  // SUITE 1: RFC 5545 SPECIFICATION & ICAL.JS INGESTION
  // ==========================================================================
  describe('1. RFC 5545 Standard Compliance & Structural Integrity', () => {
    it('strictly outputs CRLF (\\r\\n) line endings across the entire feed', () => {
      const event = createMockEvent({
        notes: 'Ensimmäinen rivi\nToinen rivi\r\nKolmas rivi'
      });
      const feed = generateIcsCalendarFeed([event], [profileTuomas]);

      // Assert feed contains CRLF
      expect(feed).toContain('\r\n');

      // Split by CRLF: no raw lonely LF or CR should remain in lines
      const rawLines = feed.split('\r\n');
      for (let i = 0; i < rawLines.length; i++) {
        expect(rawLines[i]).not.toContain('\r');
        expect(rawLines[i]).not.toContain('\n');
      }
    });

    it('generates fully compliant RFC 5545 calendar that parses cleanly with ical.js', () => {
      const events = [
        createMockEvent({
          id: 'ev-1',
          title: 'PPJ vs EPS, Lohko A; Kierros 1',
          venue: {
            name: 'Väinämöinen tn, Helsinki',
            address: 'Väinämöisenkatu 4, 00100 Helsinki',
            coordinates: { lat: 60.1742, lng: 24.9189 }
          },
          notes: 'Muistiinpano: Ota mukaan juomapullo, säärisuojat; peli alkaa heti.',
          volunteerDuty: 'Kahvio & kirjuri, klo 10:00–12:00'
        })
      ];

      const feed = generateIcsCalendarFeed(events, [profileTuomas], {
        calendarTitle: 'FamDay Perhe; Testi, Kalenteri'
      });

      // ical.js parse must succeed without throwing
      const jcal = ICAL.parse(feed);
      expect(jcal).toBeDefined();

      const comp = new ICAL.Component(jcal);
      expect(comp.name).toBe('vcalendar');
      expect(comp.getFirstPropertyValue('version')).toBe('2.0');
      expect(comp.getFirstPropertyValue('calscale')).toBe('GREGORIAN');
      expect(comp.getFirstPropertyValue('method')).toBe('PUBLISH');
      expect(comp.getFirstPropertyValue('x-wr-timezone')).toBe('Europe/Helsinki');

      const vevents = comp.getAllSubcomponents('vevent');
      expect(vevents).toHaveLength(1);

      const parsedEvent = new ICAL.Event(vevents[0]);
      expect(parsedEvent.uid).toBe('famday-ev-1@famday.app');
      expect(parsedEvent.summary).toBe('Tuomas: PPJ vs EPS, Lohko A; Kierros 1');
      expect(parsedEvent.location).toBe('Väinämöinen tn, Helsinki, Väinämöisenkatu 4, 00100 Helsinki');
      expect(parsedEvent.description).toContain('Kahvio & kirjuri, klo 10:00–12:00');
    });

    it('correctly escapes RFC 5545 special characters (backslashes, semicolons, commas, newlines)', () => {
      const complexText = 'Talo \\ Katu; Kaupunki, Maa\nUusi rivi\r\nKolmas rivi';
      const escaped = escapeIcsText(complexText);

      expect(escaped).toBe('Talo \\\\ Katu\\; Kaupunki\\, Maa\\nUusi rivi\\nKolmas rivi');
    });

    it('preserves UTF-8 Scandinavian characters (ä, ö, å) and emojis without corrupting or mangling', () => {
      const event = createMockEvent({
        title: 'KäPa/Kupittaa Äijät vs GrIFK Åland',
        notes: 'Peli-iloa! ⚽🥅🔥 Lämpöä riittää ☀️',
        venue: {
          name: 'Väinämöisen kenttä (Töölö)',
          address: 'Väinämöisenkatu 4, Helsinki'
        }
      });

      const feed = generateIcsCalendarFeed([event], [profileTuomas]);
      expect(feed).toContain('SUMMARY:Tuomas: KäPa/Kupittaa Äijät vs GrIFK Åland');
      expect(feed).toContain('⚽🥅🔥 Lämpöä riittää ☀️');
      expect(feed).toContain('Väinämöisen kenttä (Töölö)');

      const jcal = ICAL.parse(feed);
      const comp = new ICAL.Component(jcal);
      const parsedEvent = new ICAL.Event(comp.getAllSubcomponents('vevent')[0]);
      expect(parsedEvent.summary).toBe('Tuomas: KäPa/Kupittaa Äijät vs GrIFK Åland');
      expect(parsedEvent.description).toContain('⚽🥅🔥 Lämpöä riittää ☀️');
    });

    it('generates a valid empty calendar feed when event list is empty', () => {
      const feed = generateIcsCalendarFeed([], []);
      expect(feed).toContain('BEGIN:VCALENDAR');
      expect(feed).toContain('VERSION:2.0');
      expect(feed).toContain('END:VCALENDAR');
      expect(feed).not.toContain('BEGIN:VEVENT');

      const jcal = ICAL.parse(feed);
      const comp = new ICAL.Component(jcal);
      expect(comp.getAllSubcomponents('vevent')).toHaveLength(0);
    });

    it('supports disabling VALARM alarms via options.includeAlarms = false', () => {
      const event = createMockEvent({});
      const feedWithAlarm = generateIcsCalendarFeed([event], [profileTuomas], { includeAlarms: true });
      const feedWithoutAlarm = generateIcsCalendarFeed([event], [profileTuomas], { includeAlarms: false });

      expect(feedWithAlarm).toContain('BEGIN:VALARM');
      expect(feedWithoutAlarm).not.toContain('BEGIN:VALARM');

      const compWithout = new ICAL.Component(ICAL.parse(feedWithoutAlarm));
      const vevent = compWithout.getAllSubcomponents('vevent')[0];
      expect(vevent.getAllSubcomponents('valarm')).toHaveLength(0);
    });
  });

  // ==========================================================================
  // SUITE 2: GOOGLE NEST / VOICE ASSISTANT QUERY FIDELITY
  // ==========================================================================
  describe('2. Google Nest / Voice Assistant Query Fidelity (DTSTART vs warmupTime)', () => {
    it('ensures DTSTART is strictly the match kickoff time so voice queries return the exact start time', () => {
      // Coach gathering at 09:15 EEST (06:15 UTC)
      // Match kickoff at 10:00 EEST (07:00 UTC)
      const stitchedEvent = createMockEvent({
        id: 'ev-nest-test-1',
        profileId: profileTuomas.id,
        title: 'PPJ Laru Sininen vs EPS Valkoinen',
        startTime: '2026-09-12T07:00:00.000Z', // 10:00 EEST kickoff
        endTime: '2026-09-12T08:30:00.000Z',
        warmupTime: '2026-09-12T06:15:00.000Z', // 09:15 EEST gathering
        venue: {
          name: 'Väinämöinen tn',
          address: 'Väinämöisenkatu 4, 00100 Helsinki'
        }
      });

      const feed = generateIcsCalendarFeed([stitchedEvent], [profileTuomas]);
      const comp = new ICAL.Component(ICAL.parse(feed));
      const vevent = comp.getAllSubcomponents('vevent')[0];
      const parsedEvent = new ICAL.Event(vevent);

      // Voice assistant queries event.startDate:
      // "Hey Google, when is Tuomas's match on Saturday?"
      // Answer must be 07:00:00 UTC (10:00 Finnish local time)
      const startDateUtc = parsedEvent.startDate.toJSDate().toISOString();
      expect(startDateUtc).toBe('2026-09-12T07:00:00.000Z');
      expect(feed).toContain('DTSTART:20260912T070000Z');

      // The gathering time must NOT be the DTSTART
      expect(feed).not.toContain('DTSTART:20260912T061500Z');

      // Gathering time must be cleanly available in DESCRIPTION
      expect(parsedEvent.description).toContain('Kokoontuminen:');
      expect(parsedEvent.description).toContain('15');
    });

    it('embeds departure time, kit advice, volunteer duty, and pitch cleanly in DESCRIPTION for voice readouts', () => {
      const event = createMockEvent({
        profileId: profileTuomas.id,
        title: 'Westend Indians vs Oilers',
        startTime: '2026-10-03T08:00:00.000Z',
        endTime: '2026-10-03T09:30:00.000Z',
        warmupTime: '2026-10-03T07:15:00.000Z',
        venue: {
          name: 'Otahalli',
          address: 'Otaranta 6, 02150 Espoo'
        },
        briefing: {
          recommendedDepartureTime: '2026-10-03T06:40:00.000Z',
          gearAndPackingAdvice: {
            kitRecommendation: 'Keltainen pelipaita (vara: Musta)',
            essentialGear: ['Maila', 'Suojalasit', 'Juomapullo']
          }
        } as any,
        volunteerDuty: '⏱️ Toimitsijavuoro: Kello klo 11:00–12:30',
        notes: 'Kimppakyyti Korhosen perheen kanssa.'
      });

      const feed = generateIcsCalendarFeed([event], [profileTuomas]);
      const comp = new ICAL.Component(ICAL.parse(feed));
      const vevent = comp.getAllSubcomponents('vevent')[0];
      const desc = vevent.getFirstPropertyValue('description') as string;

      // Assert all elements are present in DESCRIPTION for voice assistance
      expect(desc).toContain('⏰ Kokoontuminen:');
      expect(desc).toContain('🚗 Kotoalähtöaika:');
      expect(desc).toContain('👕 Peliasu: Keltainen pelipaita (vara: Musta)');
      expect(desc).toContain('☕ Talkoovuoro: ⏱️ Toimitsijavuoro: Kello klo 11:00–12:30');
      expect(desc).toContain('📍 Pelipaikka: Otahalli, Otaranta 6, 02150 Espoo');
      expect(desc).toContain('📝 Huomiot & Kyydit: Kimppakyyti Korhosen perheen kanssa.');
    });

    it('handles kitAdvice root object fallback if briefing.gearAndPackingAdvice is absent', () => {
      const event = createMockEvent({
        profileId: profileTuomas.id,
        kitAdvice: {
          primaryJerseyColor: 'Valkoinen',
          alternateJerseyColor: 'Sininen'
        } as any
      });

      const feed = generateIcsCalendarFeed([event], [profileTuomas]);
      expect(feed).toContain('👕 Peliasu: Valkoinen (varapaita: Sininen)');
    });

    it('defaults DTEND to startTime + 60min when endTime is missing or identical to startTime', () => {
      const eventNoEnd = createMockEvent({
        startTime: '2026-09-12T10:00:00.000Z',
        endTime: undefined
      });

      const eventSameEnd = createMockEvent({
        startTime: '2026-09-12T10:00:00.000Z',
        endTime: '2026-09-12T10:00:00.000Z'
      });

      const feed1 = generateIcsCalendarFeed([eventNoEnd], [profileTuomas]);
      const feed2 = generateIcsCalendarFeed([eventSameEnd], [profileTuomas]);

      expect(feed1).toContain('DTSTART:20260912T100000Z');
      expect(feed1).toContain('DTEND:20260912T110000Z');

      expect(feed2).toContain('DTSTART:20260912T100000Z');
      expect(feed2).toContain('DTEND:20260912T110000Z');
    });
  });

  // ==========================================================================
  // SUITE 3: SUMMARY FORMATTING, PLAYER PREFIXING & DEDUPLICATION
  // ==========================================================================
  describe('3. SUMMARY Player Name Prefixing & Deduplication', () => {
    it('prefixes player name when title does not contain the player name', () => {
      const event = createMockEvent({
        profileId: profileTuomas.id,
        title: 'HJK vs Honka'
      });

      const feed = generateIcsCalendarFeed([event], [profileTuomas]);
      expect(feed).toContain('SUMMARY:Tuomas: HJK vs Honka');
    });

    it('does not duplicate player name when title already starts with player name', () => {
      const event = createMockEvent({
        profileId: profileTuomas.id,
        title: 'Tuomas: HJK vs Honka'
      });

      const feed = generateIcsCalendarFeed([event], [profileTuomas]);
      expect(feed).toContain('SUMMARY:Tuomas: HJK vs Honka');
      expect(feed).not.toContain('SUMMARY:Tuomas: Tuomas:');
    });

    it('does not duplicate player name when title contains player name case-insensitively', () => {
      const event = createMockEvent({
        profileId: profileTuomas.id,
        title: 'tuomas harkkapeli'
      });

      const feed = generateIcsCalendarFeed([event], [profileTuomas]);
      expect(feed).toContain('SUMMARY:tuomas harkkapeli');
      expect(feed).not.toContain('SUMMARY:Tuomas: tuomas');
    });

    it('correctly associates different events with different sibling player profiles', () => {
      const eventTuomas = createMockEvent({
        id: 'ev-tuomas',
        profileId: profileTuomas.id,
        title: 'PPJ Sininen vs EPS'
      });

      const eventAada = createMockEvent({
        id: 'ev-aada',
        profileId: profileAada.id,
        title: 'TOPOLA vs PuHu Juniorit',
        sport: 'basketball'
      });

      const feed = generateIcsCalendarFeed([eventTuomas, eventAada], [profileTuomas, profileAada]);

      expect(feed).toContain('SUMMARY:Tuomas: PPJ Sininen vs EPS');
      expect(feed).toContain('SUMMARY:Aada: TOPOLA vs PuHu Juniorit');
    });

    it('gracefully retains bare event title when profileId is absent or unmapped', () => {
      const unmappedEvent = createMockEvent({
        id: 'ev-unmapped',
        profileId: undefined,
        title: 'Koko seuran vanhempainilta'
      });

      const feed = generateIcsCalendarFeed([unmappedEvent], [profileTuomas]);
      expect(feed).toContain('SUMMARY:Koko seuran vanhempainilta');
    });

    it('demonstrates substring edge case where child name is part of opponent team name', () => {
      // Substring edge case: Child "Olli", opponent "HIFK Kollit"
      // "HIFK Kollit vs Kiekko-Vantaa".toLowerCase().includes("olli") is TRUE!
      // But Unicode word-boundary matching ensures the player name is still prefixed!
      const profileOlli: PlayerProfile = {
        id: 'prof-olli',
        playerName: 'Olli',
        teamName: 'Jokerit',
        sport: 'ice_hockey' as any,
        primaryColor: 'sininen',
        colorHex: '#0033aa'
      };

      const event = createMockEvent({
        id: 'ev-olli',
        profileId: profileOlli.id,
        title: 'HIFK Kollit vs Kiekko-Vantaa'
      });

      const feed = generateIcsCalendarFeed([event], [profileOlli]);
      // Fixed behavior: Token boundary regex avoids false substring collision
      expect(feed).toContain('SUMMARY:Olli: HIFK Kollit vs Kiekko-Vantaa');
    });

    it('formats gathering and departure times in Europe/Helsinki timezone regardless of host environment', () => {
      const event = createMockEvent({
        startTime: '2026-09-12T07:00:00.000Z', // 10:00 EEST
        warmupTime: '2026-09-12T06:15:00.000Z', // 09:15 EEST
        briefing: {
          recommendedDepartureTime: '2026-09-12T05:35:00.000Z' // 08:35 EEST
        } as any
      });
      const feed = generateIcsCalendarFeed([event], [profileTuomas]);
      expect(feed).toContain('⏰ Kokoontuminen: klo 09:15');
      expect(feed).toContain('🚗 Kotoalähtöaika: klo 08:35');
    });
  });

  // ==========================================================================
  // SUITE 4: ADVERSARIAL STRESS & FAILURE MODE MINING
  // ==========================================================================
  describe('4. Adversarial Stress & Failure Mode Mining', () => {
    it('handles malformed startTime gracefully with safe fallback in dtEnd calculation', () => {
      const brokenEvent = createMockEvent({
        startTime: 'invalid-datetime-string',
        endTime: undefined
      });

      // formatIcsDateUtc('invalid-datetime-string') returns '19700101T000000Z'
      // Guard isNaN(startMs) ensures no RangeError is thrown and safe fallback is emitted
      expect(() => {
        const feed = generateIcsCalendarFeed([brokenEvent], [profileTuomas]);
        expect(feed).toContain('DTSTART:19700101T000000Z');
        expect(feed).toContain('DTEND:19700101T010000Z');
      }).not.toThrow();
    });

    it('stress-tests extreme multi-line notes, special symbols, and volunteer duty tags', () => {
      const longNotes = 'Linja 1: Ota paita.\n'.repeat(50) + 'Erikoismerkit: ;;; ,,, \\\\\\ "quotes" <script>alert("xss")</script>';
      const event = createMockEvent({
        id: 'ev-extreme-payload',
        notes: longNotes,
        volunteerDuty: '☕ Kahviovuoro (klo 10:00–12:00, 1. vuoro); 🦺 Järkkäri (klo 12:00–14:00)'
      });

      const feed = generateIcsCalendarFeed([event], [profileTuomas]);
      expect(feed).toBeDefined();

      // Must still be 100% valid RFC 5545 parseable by ical.js
      const jcal = ICAL.parse(feed);
      const comp = new ICAL.Component(jcal);
      const vevent = comp.getAllSubcomponents('vevent')[0];
      expect(vevent).toBeDefined();

      const parsedEvent = new ICAL.Event(vevent);
      expect(parsedEvent.description).toContain('<script>alert("xss")</script>');
    });

    it('verifies end-to-end flow from stitching to RFC 5545 feed generation', () => {
      // 1. MyClub Event (earlier arrival time, informal venue name)
      const myClubEvent = createMockEvent({
        id: 'myclub-match-stitching',
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
          address: 'Väinämöisenkatu 4, Helsinki'
        }
      });

      // 2. Torneopal Bare League Fixture (official kickoff, official pitch)
      const torneopalFixture = createMockEvent({
        id: 'fixture-spl-9988',
        profileId: profileTuomas.id,
        officialFixtureId: 'spl_9988',
        title: 'PPJ/Laru Sininen vs EPS/Valkoinen',
        homeTeam: 'PPJ/Laru Sininen',
        awayTeam: 'EPS/Valkoinen',
        startTime: '2026-09-12T07:00:00.000Z', // 10:00 EEST kickoff
        endTime: '2026-09-12T08:30:00.000Z',
        tournamentName: 'P13 Kakkonen Syksy',
        venue: {
          name: 'Väinämöinen tn',
          normalizedName: 'vainamoinen tn',
          address: 'Väinämöisenkatu 4, 00100 Helsinki'
        }
      });

      // Stitch
      const stitched = stitchCalendarEventsWithFixtures([myClubEvent, torneopalFixture]);
      expect(stitched).toHaveLength(1);

      // Export to ICS feed
      const feed = generateIcsCalendarFeed(stitched, [profileTuomas]);

      // Assertions on the final exported feed
      expect(feed).toContain('SUMMARY:Tuomas: PPJ/Laru Sininen vs EPS/Valkoinen');
      expect(feed).toContain('DTSTART:20260912T070000Z');
      expect(feed).toContain('DTEND:20260912T083000Z');
      expect(feed).toContain('LOCATION:Väinämöinen tn\\, Väinämöisenkatu 4\\, 00100 Helsinki');
      expect(feed).toContain('Pelipaikka: Väinämöinen tn\\, Väinämöisenkatu 4\\, 00100 Helsinki');
      expect(feed).toContain('Kokoontuminen:');
    });
  });
});
