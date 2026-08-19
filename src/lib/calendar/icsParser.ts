import ICAL from 'ical.js';
import { MatchdayEvent, SportType, EventType } from '../../types/matchday';
import { geocodeSportsVenue } from '../geo/sportsGeocoder';

/**
 * Checks if an event is a training session, practice, or non-match exercise.
 */
export function isTrainingEvent(title: string, description: string = ''): boolean {
  const text = `${title} ${description}`.toLowerCase();
  const trainingKeywords = [
    'harjoitukset',
    'harjoitus',
    'treenit',
    'treeni',
    'fysiikka',
    'lajiharjoitus',
    'lajivuoro',
    'kuntopiiri',
    'aamujää',
    'jäätreenit',
    'valmennus',
    'taitotreenit',
    'pukukoppipalaveri',
    'fysiikkatreenit'
  ];

  // If explicit "vs" or " - " with another team, it's a match unless specified as internal drill
  if (text.includes(' vs ') && !text.includes('sisäinen')) {
    return false;
  }

  return trainingKeywords.some((kw) => text.includes(kw));
}

/**
 * Parses raw iCalendar (.ics) string feeds from Nimenhuuto, MyClub, Jopox, or Torneopal.
 * Timezone-safe (RFC 5545) with deterministic volunteer duty detection.
 */
export async function parseICSFeed(
  icsContent: string,
  profileId: string,
  sport: SportType = 'football'
): Promise<MatchdayEvent[]> {
  const events: MatchdayEvent[] = [];

  try {
    const jcalData = ICAL.parse(icsContent);
    const vcalendar = new ICAL.Component(jcalData);
    const vevents = vcalendar.getAllSubcomponents('vevent');

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);

      const title = event.summary || 'Tuntematon tapahtuma';
      const location = event.location || 'Töölön Pallokenttä';
      const description = event.description || '';

      // Preserve full UTC date / local timezone offset safely
      const startDate = event.startDate ? event.startDate.toJSDate() : new Date();
      const endDate = event.endDate
        ? event.endDate.toJSDate()
        : new Date(startDate.getTime() + 90 * 60 * 1000);

      // Warmup is typically 45 mins before match, 15 mins before training
      const isTraining = isTrainingEvent(title, description);
      const warmupOffsetMinutes = isTraining ? 15 : 45;
      const warmupDate = new Date(startDate.getTime() - warmupOffsetMinutes * 60 * 1000);

      // Volunteer duty detection (Talkoovahti)
      let volunteerDuty: string | undefined;
      const descLower = description.toLowerCase();
      if (descLower.includes('kahviovuoro') || descLower.includes('kahvio')) {
        volunteerDuty = '☕ Kahviovuoro';
      } else if (descLower.includes('toimitsija') || descLower.includes('kirjuri')) {
        volunteerDuty = '⏱️ Toimitsijavuoro';
      } else if (descLower.includes('järkkäri') || descLower.includes('järjestyksenvalvoja')) {
        volunteerDuty = '🛡️ Järjestyksenvalvoja';
      } else if (descLower.includes('kirjuri') || descLower.includes('kello')) {
        volunteerDuty = '📝 Kirjuri/Kello';
      }

      // Extract Opponents & Matchup
      let homeTeam = title;
      let awayTeam = '';
      let isHomeMatch = true;

      if (!isTraining) {
        // Strip common prefixes like "Peli: ", "Ottelu: ", "Sarjapeli: "
        const cleanedTitle = title.replace(/^(peli|ottelu|sarjapeli|sarjaottelu|turnauspeli):\s*/i, '');
        const vsDelimiters = [' vs ', ' - ', ' v ', ' @ '];
        for (const delim of vsDelimiters) {
          if (cleanedTitle.includes(delim)) {
            const parts = cleanedTitle.split(delim);
            homeTeam = (parts[0] || '').trim();
            awayTeam = (parts[1] || '').trim();
            if (delim === ' @ ') {
              // Away match notation
              isHomeMatch = false;
              const temp = homeTeam;
              homeTeam = awayTeam;
              awayTeam = temp;
            }
            break;
          }
        }
      }

      // Determine EventType
      let eventType: EventType = 'match';
      if (isTraining) {
        eventType = 'training';
      } else if (descLower.includes('turnaus') || title.toLowerCase().includes('turnaus') || descLower.includes('torneopal')) {
        eventType = 'tournament';
      }

      // Geocode venue with LIPAS.fi and Slang aliases
      const venue = await geocodeSportsVenue(location);

      events.push({
        id: event.uid || `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        profileId,
        sport,
        eventType,
        isTraining,
        title,
        homeTeam,
        awayTeam,
        isHomeMatch,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        warmupTime: warmupDate.toISOString(),
        venue,
        volunteerDuty
      });
    }
  } catch (error) {
    console.error('Failed to parse ICS feed:', error);
  }

  // Return chronological sort
  return events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}
