import { describe, it, expect } from 'vitest';
import { parseICSFeed, isTrainingEvent, extractFeedCategories } from './icsParser';

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
BEGIN:VEVENT
UID:volley-999@torneopal.com
DTSTAMP:20260819T100000Z
DTSTART:20260822T120000Z
DTEND:20260822T133000Z
SUMMARY:PuMa Volley vs LP Viesti
LOCATION:Töölön Kisahalli
DESCRIPTION:Torneopal Lentopallo N2.
END:VEVENT
END:VCALENDAR`;

describe('ICS Calendar Parser', () => {
  it('correctly distinguishes training from matches', () => {
    expect(isTrainingEvent('Lajiharjoitukset: Puotila')).toBe(true);
    expect(isTrainingEvent('Fysiikkatreenit')).toBe(true);
    expect(isTrainingEvent('HJK T13 vs EPS Valkoinen')).toBe(false);
  });

  it('correctly parses matches, teams, and venue from .ics feed', async () => {
    const events = await parseICSFeed(SAMPLE_ICS, 'profile-1', 'football');
    expect(events.length).toBe(3);

    const matchEvent = events[0]!;
    expect(matchEvent.isTraining).toBe(false);
    expect(matchEvent.homeTeam).toBe('HJK T13');
    expect(matchEvent.awayTeam).toBe('EPS Valkoinen');
    expect(matchEvent.volunteerDuty).toContain('☕ Kahviovuoro');
    expect(matchEvent.venue.name).toContain('Puotila');

    const trainingEvent = events[1]!;
    expect(trainingEvent.isTraining).toBe(true);
    expect(trainingEvent.eventType).toBe('training');
    expect(trainingEvent.title).toContain('Salibandy Harjoitukset');
    expect(trainingEvent.venue.isIndoor).toBe(true);

    const volleyEvent = events[2]!;
    expect(volleyEvent.isTraining).toBe(false);
    expect(volleyEvent.homeTeam).toBe('PuMa Volley');
    expect(volleyEvent.awayTeam).toBe('LP Viesti');
  });

  it('expands recurring events via RRULE with deterministic IDs', async () => {
    const RECURRING_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Test//EN
BEGIN:VEVENT
UID:recurring-weekly-practice@club.fi
DTSTAMP:20260819T100000Z
DTSTART:20260901T150000Z
DTEND:20260901T163000Z
RRULE:FREQ=WEEKLY;COUNT=4
SUMMARY:Viikoittaiset futistreenit
LOCATION:Käpylän tekonurmi
DESCRIPTION:Harjoitukset
END:VEVENT
END:VCALENDAR`;

    const events = await parseICSFeed(RECURRING_ICS, 'profile-1', 'football');
    expect(events.length).toBe(4);
    expect(events[0]!.id).toContain('recurring-weekly-practice');
    expect(events[0]!.isTraining).toBe(true);
    expect(events[1]!.startTime).toContain('2026-09-08');
    expect(events[2]!.startTime).toContain('2026-09-15');
    expect(events[3]!.startTime).toContain('2026-09-22');
  });

  it('extracts distinct categories and squad classes from Nimenhuuto/MyClub feeds', () => {
    const NIMENHUUTO_SAMPLE = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Nimenhuuto.com//NONSGML Calendar//EN
BEGIN:VEVENT
UID:e1@nimenhuuto.com
SUMMARY:Treenit 18:30-20:00
CATEGORIES:Treenit
END:VEVENT
BEGIN:VEVENT
UID:e2@nimenhuuto.com
SUMMARY:Peli kilpa: Indians vs Oilers
CATEGORIES:Peli kilpa
END:VEVENT
BEGIN:VEVENT
UID:e3@nimenhuuto.com
SUMMARY:Peli haastaja: Indians vs ErVi
CATEGORIES:Peli haastaja
END:VEVENT
BEGIN:VEVENT
UID:e4@nimenhuuto.com
SUMMARY:Vanhempainilta ja kauden avaus
CATEGORIES:Muu
END:VEVENT
BEGIN:VEVENT
UID:e5@nimenhuuto.com
SUMMARY:Treenit 17:00-18:30
CATEGORIES:Treenit
END:VEVENT
END:VCALENDAR`;

    const categories = extractFeedCategories(NIMENHUUTO_SAMPLE);
    expect(categories).toEqual([
      { name: 'Treenit', count: 2 },
      { name: 'Peli kilpa', count: 1 },
      { name: 'Peli haastaja', count: 1 },
      { name: 'Muu', count: 1 }
    ]);
  });

  it('filters out excluded squads/categories using squadFilters exclusion list', async () => {
    const NIMENHUUTO_SAMPLE = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:e1@nimenhuuto.com
SUMMARY:Treenit 18:30-20:00
CATEGORIES:Treenit
DTSTART:20260820T153000Z
DTEND:20260820T170000Z
END:VEVENT
BEGIN:VEVENT
UID:e2@nimenhuuto.com
SUMMARY:Peli kilpa: Indians vs Oilers
CATEGORIES:Peli kilpa
DTSTART:20260821T150000Z
DTEND:20260821T163000Z
END:VEVENT
BEGIN:VEVENT
UID:e3@nimenhuuto.com
SUMMARY:Peli haastaja: Indians vs ErVi
CATEGORIES:Peli haastaja
DTSTART:20260822T150000Z
DTEND:20260822T163000Z
END:VEVENT
END:VCALENDAR`;

    // Filter out "Peli haastaja"
    const filteredEvents = await parseICSFeed(
      NIMENHUUTO_SAMPLE,
      'profile-1',
      'floorball',
      'Westend Indians',
      ['Peli haastaja']
    );

    expect(filteredEvents.length).toBe(2);
    expect(filteredEvents.some((e) => e.title.includes('Peli kilpa'))).toBe(true);
    expect(filteredEvents.some((e) => e.title.includes('Treenit'))).toBe(true);
    expect(filteredEvents.some((e) => e.title.includes('Peli haastaja'))).toBe(false);
  });
});
