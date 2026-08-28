import { describe, it, expect } from 'vitest';
import { generateIcsCalendarFeed, formatIcsDateUtc, escapeIcsText } from '../../../src/lib/calendar/calendarFeedGenerator';
import { MatchdayEvent, PlayerProfile } from '../../../src/types/matchday';

describe('Tier 1 Feature 22: Live Family Calendar (webcal://) & RFC 5545 Feed Generator', () => {
  const sampleProfiles: PlayerProfile[] = [
    {
      id: 'prof-simo',
      playerName: 'Simo',
      teamName: 'PPJ/Laru sin',
      sport: 'football',
      primaryColor: 'sininen',
      colorHex: '#0044bb',
      calendarUrl: 'https://example.com/cal.ics'
    },
    {
      id: 'prof-aada',
      playerName: 'Aada',
      teamName: 'TOPOLA',
      sport: 'basketball',
      primaryColor: 'keltainen',
      colorHex: '#f59e0b',
      calendarUrl: 'https://example.com/basket.ics'
    }
  ];

  const sampleEvents: MatchdayEvent[] = [
    {
      id: 'ev-match-1',
      profileId: 'prof-simo',
      title: 'PPJ/Laru sin vs Gnistan',
      homeTeam: 'PPJ/Laru sin',
      awayTeam: 'Gnistan',
      sport: 'football',
      startTime: '2026-09-12T15:30:00.000Z',
      endTime: '2026-09-12T16:30:00.000Z',
      warmupTime: '2026-09-12T14:45:00.000Z',
      leaveHomeBy: '2026-09-12T14:15:00.000Z',
      venue: {
        name: 'Väinämöisen kenttä',
        address: 'Väinämöisenkatu 4, 00100 Helsinki',
        coordinates: { lat: 60.1712, lng: 24.9195 },
        surface: 'artificial_turf_3g',
        isIndoor: false,
        hasFloodlights: true,
        normalizedName: 'vainamoisen kentta'
      },
      kitAdvice: {
        primaryJerseyColor: 'Sininen',
        alternateJerseyColor: 'Musta'
      },
      notes: 'Simo menee Ekin kyydillä. Lähtö klo 15:00',
      volunteerDuty: 'Kahviovuoro klo 14:30–16:30'
    },
    {
      id: 'ev-exam-1',
      profileId: 'prof-simo',
      title: 'Matematiikka (Koe)',
      sport: 'school',
      eventType: 'school',
      startTime: '2026-09-14T08:15:00.000Z',
      endTime: '2026-09-14T09:45:00.000Z',
      venue: {
        name: 'Lauttasaaren yhteiskoulu',
        address: 'Isokaari 19'
      },
      notes: 'Koe luvut 1–5 (s. 8–29), luokka T 36'
    }
  ];

  it('formats UTC dates correctly according to iCalendar spec', () => {
    const formatted = formatIcsDateUtc('2026-09-12T15:30:00.000Z');
    expect(formatted).toBe('20260912T153000Z');
  });

  it('escapes special characters properly in iCalendar text', () => {
    const escaped = escapeIcsText('PPJ, Laru; Sininen\nUusi rivi');
    expect(escaped).toBe('PPJ\\, Laru\\; Sininen\\nUusi rivi');
  });

  it('generates valid RFC 5545 VCALENDAR wrapper with X-WR-CALNAME and REFRESH-INTERVAL', () => {
    const ics = generateIcsCalendarFeed(sampleEvents, sampleProfiles, {
      familyCode: 'PERHE-2'
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('PRODID:-//FamDay//FamDay Family Calendar 1.0//FI');
    expect(ics).toContain('X-WR-CALNAME:FamDay (PERHE-2)');
    expect(ics).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT1H');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('encodes carpool notes, kit colors, volunteer duties, and Wilma exams into VEVENT descriptions', () => {
    const ics = generateIcsCalendarFeed(sampleEvents, sampleProfiles, {
      familyCode: 'PERHE-2'
    });

    expect(ics).toContain('SUMMARY:Simo: PPJ/Laru sin vs Gnistan');
    expect(ics).toContain('Väinämöisen kenttä\\, Väinämöisenkatu 4\\, 00100 Helsinki');
    expect(ics).toContain('GEO:60.1712;24.9195');
    expect(ics).toContain('Simo menee Ekin kyydillä. Lähtö klo 15:00');
    expect(ics).toContain('Kahviovuoro klo 14:30–16:30');
    expect(ics).toContain('Peliasu: Sininen');
    expect(ics).toContain('Matematiikka (Koe)');
    expect(ics).toContain('Koe luvut 1–5 (s. 8–29)\\, luokka T 36');
  });

  it('attaches 30-minute VALARM reminders by default', () => {
    const ics = generateIcsCalendarFeed(sampleEvents, sampleProfiles);
    expect(ics).toContain('BEGIN:VALARM');
    expect(ics).toContain('TRIGGER:-PT30M');
    expect(ics).toContain('ACTION:DISPLAY');
    expect(ics).toContain('END:VALARM');
  });
});
