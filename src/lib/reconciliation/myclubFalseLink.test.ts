import { describe, it, expect } from 'vitest';
import { parseICSFeed } from '../calendar/icsParser';
import { reconcileCalendarWithOfficial } from './reconciliationEngine';
import type { OfficialLeagueFixture } from '../../types/matchday';

// Real ToPoLa Tytöt 2014-15 MyClub rows for 14.11.2026 (URLs removed) and the
// one official TASO game of TOPOLA (WU12, team 5756346) that day.
const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:topola.myclub.fi-11509684',
  'DTSTART;TZID=Europe/Helsinki:20261114T123000',
  'DTEND;TZID=Europe/Helsinki:20261114T150000',
  'DESCRIPTION:Paikalla klo 12:30\\, peli alkaa klo 13:30',
  'LOCATION:Lauttasaaren yhteiskoulu Vanha\\, Isokaari 19\\, 00200 Helsinki\\, Suomi',
  'SUMMARY:Tytöt 2014-15 joukkue (kausi 2026-27): WU13 2div. ToPoLa vs. HNMKY/Stadi',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:topola.myclub.fi-11509850',
  'DTSTART;TZID=Europe/Helsinki:20261114T133000',
  'DTEND;TZID=Europe/Helsinki:20261114T160000',
  'DESCRIPTION:Paikalla klo 13:30\\, peli alkaa klo 14:30',
  'LOCATION:Munkkiniemen ruotsalainen YA\\, Solnantie 18-20',
  'SUMMARY:Tytöt 2014-15 joukkue (kausi 2026-27): WU12 2div. ToPo vs. ToPoLa ',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:topola.myclub.fi-11905966',
  'DTSTART;TZID=Europe/Helsinki:20261114T130000',
  'DTEND;TZID=Europe/Helsinki:20261114T143000',
  'DESCRIPTION:Open Gym-vuoro LYK:n uudessa halliss kaikille seuran junioreille.',
  'LOCATION:Lauttasaaren Yhteiskoulu Uusi\\, Isokaari 19\\, 00200 Helsinki\\, Suomi',
  'SUMMARY:Junioripelaajat: Open Gym ToPoLan junioripelaajille (13:00-14:30)',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const official: OfficialLeagueFixture = {
  id: 'basket_5756346_1010390',
  teamId: '5756346',
  association: 'basket',
  sport: 'basketball',
  leagueName: 'WU12 2div',
  homeTeam: 'TOPO/White',
  awayTeam: 'TOPOLA',
  isHome: false,
  startTime: '2026-11-14T14:30:00+02:00',
  venueName: 'Munkkiniemen ruotsalainen yläaste',
  fetchedAt: '2026-11-14T10:00:00.000Z',
  status: 'upcoming',
};

describe('MyClub rows only link to the official game they are', () => {
  it('links the ToPo game and leaves the HNMKY/Stadi game and Open Gym alone', async () => {
    const events = await parseICSFeed(ICS, 'p:lilli:myclub', 'basketball', 'Lilli:n joukkue');
    expect(events).toHaveLength(3);
    const res = reconcileCalendarWithOfficial(events, [official]);
    const byUid = (uid: string) => res.get(events.find((e) => e.id.includes(uid))!.id)!;
    expect(byUid('11509850').officialFixture?.id).toBe(official.id);
    expect(byUid('11509850').status).not.toBe('unlinked');
    expect(byUid('11509684').status).toBe('unlinked');
    expect(byUid('11905966').status).toBe('unlinked');
  });
});
