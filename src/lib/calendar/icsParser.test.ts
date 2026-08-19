import { describe, it, expect } from 'vitest';
import { parseICSFeed } from './icsParser';

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Nimenhuuto.com//NONSGML Calendar//EN
BEGIN:VEVENT
UID:match-12345@nimenhuuto.com
DTSTAMP:20260819T100000Z
DTSTART:20260820T150000Z
DTEND:20260820T163000Z
SUMMARY:HJK T13 vs EPS Valkoinen
LOCATION:Puotilan tekonurmi (Bubu)
DESCRIPTION:Kahviovuoro klo 14:30 - 16:00. Muista suojalasit ja pelipassi.
END:VEVENT
BEGIN:VEVENT
UID:training-67890@nimenhuuto.com
DTSTAMP:20260819T100000Z
DTSTART:20260821T140000Z
DTEND:20260821T153000Z
SUMMARY:Salibandy Harjoitukset
LOCATION:Tapanilan Mosahalli
DESCRIPTION:Toimitsijavuoro (Kirjuri/Kello).
END:VEVENT
END:VCALENDAR`;

describe('ICS Calendar Parser', () => {
  it('correctly parses matches, teams, and venue from .ics feed', async () => {
    const events = await parseICSFeed(SAMPLE_ICS, 'profile-1', 'football');
    expect(events.length).toBe(2);

    const matchEvent = events[0]!;
    expect(matchEvent.sport).toBe('football');
    expect(matchEvent.homeTeam).toBe('HJK T13');
    expect(matchEvent.awayTeam).toBe('EPS Valkoinen');
    expect(matchEvent.volunteerDuty).toBe('☕ Kahviovuoro');
    expect(matchEvent.venue.name).toContain('Puotila');

    const trainingEvent = events[1]!;
    expect(trainingEvent.sport).toBe('floorball');
    expect(trainingEvent.volunteerDuty).toBe('⏱️ Toimitsijavuoro (Kirjuri/Kello)');
    expect(trainingEvent.venue.isIndoor).toBe(true);
  });
});
