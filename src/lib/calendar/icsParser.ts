import ICAL from 'ical.js';
import { MatchdayEvent, SportType } from '../../types/matchday';
import { resolveSportsVenue } from '../geo/sportsGeocoder';

export async function parseICSFeed(
  icsContent: string,
  profileId: string,
  defaultSport: SportType = 'football'
): Promise<MatchdayEvent[]> {
  const jcalData = ICAL.parse(icsContent);
  const comp = new ICAL.Component(jcalData);
  const vevents = comp.getAllSubcomponents('vevent');

  const parsedEvents: MatchdayEvent[] = [];

  for (const veventComp of vevents) {
    const event = new ICAL.Event(veventComp);
    const summary = event.summary || '';
    const description = event.description || '';
    const location = event.location || '';

    // Convert to native JS Date for ISO string representation
    const startJs = event.startDate ? event.startDate.toJSDate() : new Date();
    const endJs = event.endDate ? event.endDate.toJSDate() : new Date(startJs.getTime() + 90 * 60000);
    const startIso = startJs.toISOString();
    const endIso = endJs.toISOString();

    const lowerSummary = summary.toLowerCase();
    const lowerDesc = description.toLowerCase();

    // 1. Detect Sport
    let sport: SportType = defaultSport;
    if (lowerSummary.includes('salibandy') || lowerSummary.includes('säbä') || lowerSummary.includes('sb')) {
      sport = 'floorball';
    } else if (lowerSummary.includes('koripallo') || lowerSummary.includes('basket') || lowerSummary.includes('kb')) {
      sport = 'basketball';
    } else if (lowerSummary.includes('jääkiekko') || lowerSummary.includes('hockey')) {
      sport = 'icehockey';
    } else if (lowerSummary.includes('futsal')) {
      sport = 'futsal';
    } else if (lowerSummary.includes('treenit') || lowerSummary.includes('harjoitukset')) {
      sport = 'training';
    }

    // 2. Detect Volunteer Duty
    let volunteerDuty: string | undefined;
    if (lowerDesc.includes('kahvio') || lowerDesc.includes('buffet') || lowerSummary.includes('kahvio')) {
      volunteerDuty = '☕ Kahviovuoro';
    } else if (lowerDesc.includes('toimitsija') || lowerDesc.includes('kirjuri') || lowerDesc.includes('kello')) {
      volunteerDuty = '⏱️ Toimitsijavuoro (Kirjuri/Kello)';
    } else if (lowerDesc.includes('järkkäri') || lowerDesc.includes('järjestyksenvalvoja')) {
      volunteerDuty = '🦺 Järjestyksenvalvonta';
    }

    // 3. Extract Home & Away Teams
    let homeTeam = summary;
    let awayTeam = '';
    const isHomeMatch = true;

    if (summary.includes(' vs ') || summary.includes(' - ')) {
      const parts = summary.split(/\s+(?:vs|-)\s+/i);
      homeTeam = (parts[0] ?? '').replace(/^(ottelu|peli|sarjapeli):\s*/i, '').trim();
      awayTeam = parts[1] ? parts[1].replace(/\(.*\)/, '').trim() : '';
    }

    // 4. Calculate Warmup Time
    const warmupOffsetMinutes = sport === 'floorball' ? 35 : sport === 'football' ? 45 : 30;
    const warmupIso = new Date(startJs.getTime() - warmupOffsetMinutes * 60000).toISOString();

    // 5. Geocode Venue
    const venue = await resolveSportsVenue(location || summary);

    // 6. Stable Unique Hash ID
    const hashId = `${profileId}_${startIso}_${summary.replace(/\W+/g, '_')}`;

    parsedEvents.push({
      id: hashId,
      profileId,
      sport,
      title: summary,
      homeTeam: homeTeam || summary,
      awayTeam,
      isHomeMatch,
      startTime: startIso,
      endTime: endIso,
      warmupTime: warmupIso,
      venue,
      volunteerDuty
    });
  }

  return parsedEvents;
}
