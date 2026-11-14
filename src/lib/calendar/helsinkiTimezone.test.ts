import { describe, it, expect } from 'vitest';
import { parseICSFeed } from './icsParser';

// MyClub's real VTIMEZONE (14.11.2026): rules only start at the next switches.
const MYCLUB_VTZ = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Helsinki',
  'BEGIN:DAYLIGHT',
  'DTSTART:20270328T040000',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0300',
  'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
  'TZNAME:EEST',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'DTSTART:20261025T030000',
  'TZOFFSETFROM:+0300',
  'TZOFFSETTO:+0200',
  'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
  'TZNAME:EET',
  'END:STANDARD',
  'END:VTIMEZONE',
];

function feed(withVtz: boolean): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    ...(withVtz ? MYCLUB_VTZ : []),
    'BEGIN:VEVENT',
    'UID:summer@test',
    'DTSTART;TZID=Europe/Helsinki:20261024T090000',
    'DTEND;TZID=Europe/Helsinki:20261024T104500',
    'SUMMARY:Junioripelaajat: Open Gym (9:00-10:45)',
    'LOCATION:Lauttasaaren Yhteiskoulu Uusi',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:winter@test',
    'DTSTART;TZID=Europe/Helsinki:20261114T130000',
    'DTEND;TZID=Europe/Helsinki:20261114T143000',
    'SUMMARY:Junioripelaajat: Open Gym (13:00-14:30)',
    'LOCATION:Lauttasaaren Yhteiskoulu Uusi',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

describe('Europe/Helsinki times from club calendars', () => {
  for (const withVtz of [true, false]) {
    it(`summer and winter rows keep their wall clock (${withVtz ? 'MyClub VTIMEZONE' : 'no VTIMEZONE'})`, async () => {
      const events = await parseICSFeed(feed(withVtz), 'p:test', 'basketball', 'Test');
      const byUid = (u: string) => events.find((e) => e.id.includes(u))!;
      expect(new Date(byUid('summer').startTime).toISOString()).toBe('2026-10-24T06:00:00.000Z');
      expect(new Date(byUid('winter').startTime).toISOString()).toBe('2026-11-14T11:00:00.000Z');
    });
  }
});
