import ICAL from 'ical.js';
import {
  MatchdayEvent,
  SportType,
  EventType,
  ParsedTitleResult,
  VolunteerDutyResult
} from '../../types/matchday';
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
    'pelipalaveri',
    'fysiikkatreenit',
    'teoriaharjoitus',
    'kokoontuminen',
    'träning'
  ];

  // If explicit "vs" or " v " with another team, it's a match unless specified as internal drill
  if ((text.includes(' vs ') || text.includes(' v ')) && !text.includes('sisäinen')) {
    return false;
  }

  return trainingKeywords.some((kw) => text.includes(kw));
}

/**
 * Classifies the type of calendar event.
 */
export function classifyCalendarEvent(title: string, description: string = ''): EventType {
  const text = `${title} ${description}`.toLowerCase();

  if (
    text.includes('vanhempainilta') ||
    text.includes('palaveri') ||
    text.includes('möte') ||
    text.includes('seurakokous') ||
    text.includes('infotilaisuus') ||
    text.includes('kausipalaveri') ||
    text.includes('joukkuepalaveri')
  ) {
    return 'meeting';
  }

  if (
    text.includes('turnaus') ||
    text.includes('turnering') ||
    text.includes('tournament') ||
    text.includes('pelitapahtuma') ||
    text.includes('lopputurnaus') ||
    text.includes('kutsuturnaus') ||
    text.includes('cup-turnaus') ||
    text.includes('turnauspeli')
  ) {
    return 'tournament';
  }

  if (isTrainingEvent(title, description)) {
    return 'training';
  }

  if (
    text.includes(' vs ') ||
    text.includes(' - ') ||
    text.includes(' v ') ||
    text.includes('ottelu') ||
    text.includes('peli') ||
    text.includes('sarjapeli') ||
    text.includes('seriematch') ||
    text.includes('friendly') ||
    text.includes('harjoitusottelu')
  ) {
    return 'match';
  }

  return 'other';
}

/**
 * Parses complex Finnish match titles into structured components.
 * Examples:
 * - "HJK T13 Sininen vs EPS"
 * - "HJK-EPS peli"
 * - "Peli @ Bubu vs Honka"
 * - "Ottelu: VJS - PPJ (Kierros 4)"
 * - "Seriematch: IFK - GrIFK"
 * - "Friendly: KäPa vs Ilves"
 * - "Turnaus / Pelitapahtuma"
 */
export function parseMatchTitle(rawTitle: string, defaultTeamName?: string): ParsedTitleResult {
  if (!rawTitle) {
    return {
      eventType: 'other',
      homeTeam: defaultTeamName || 'Oma Joukkue',
      awayTeam: '',
      isHomeMatch: true
    };
  }

  let text = rawTitle.trim();
  const eventType = classifyCalendarEvent(text);

  let isFriendly = false;
  if (/^(?:friendly|harjoitusottelu|träningsmatch):\s*/i.test(text)) {
    isFriendly = true;
    text = text.replace(/^(?:friendly|harjoitusottelu|träningsmatch):\s*/i, '');
  }

  // Check for round information: e.g. "(Kierros 4)" or "(Kierros 2/10)"
  let roundInfo: string | undefined;
  const roundMatch = text.match(/\((?:kierros|omgång|round)\s*(\d+(?:\/\d+)?)\)/i);
  if (roundMatch) {
    roundInfo = roundMatch[0];
    text = text.replace(roundMatch[0], '').trim();
  }

  // Check for embedded venue hint, e.g. "Peli @ Bubu vs Honka" or "@ Väiski"
  let embeddedVenueHint: string | undefined;
  const venueAtMatch = text.match(/@\s*([a-zA-Z0-9åäöÅÄÖ\s\-_]+?)(?:\s+(?:vs|-|v)\s+|$)/i);
  if (venueAtMatch && venueAtMatch[1]) {
    const candidateVenue = venueAtMatch[1].trim();
    if (candidateVenue.length > 1 && !candidateVenue.toLowerCase().includes('peli')) {
      embeddedVenueHint = candidateVenue;
    }
  }

  // Strip prefixes like "Ottelu:", "Peli:", "Sarjapeli:", "Seriematch:", "Match:"
  text = text.replace(/^(?:peli|ottelu|sarjapeli|sarjaottelu|seriematch|match|sarja):\s*/i, '');

  // Strip suffix " peli" or " ottelu", e.g. "HJK-EPS peli" -> "HJK-EPS"
  text = text.replace(/\s+(?:peli|ottelu|match)$/i, '');

  let homeTeam = text;
  let awayTeam = '';
  let isHomeMatch = true;

  if (eventType !== 'training' && eventType !== 'meeting') {
    // Check "@ Opponent" or "@ Venue vs Opponent"
    if (text.startsWith('@') || text.includes(' @ ')) {
      const parts = text.split(/\s*@\s*/);
      if (parts.length === 2) {
        const left = parts[0]?.trim() || '';
        const right = parts[1]?.trim() || '';

        if (right.includes(' vs ')) {
          const vsParts = right.split(' vs ');
          homeTeam = vsParts[0]?.trim() || '';
          awayTeam = vsParts[1]?.trim() || '';
        } else if (left.length > 0 && !left.toLowerCase().includes('peli')) {
          homeTeam = right;
          awayTeam = left;
          isHomeMatch = false;
        } else {
          homeTeam = right;
          awayTeam = defaultTeamName || '';
          isHomeMatch = false;
        }
      }
    } else {
      // Split on standard delimiters: " vs ", " - ", " v "
      const delimiters = [' vs ', ' - ', ' v ', '-'];
      for (const delim of delimiters) {
        if (text.includes(delim)) {
          const parts = text.split(delim);
          if (parts.length >= 2) {
            homeTeam = (parts[0] || '').trim();
            awayTeam = (parts[1] || '').trim();
            break;
          }
        }
      }
    }
  }

  // Determine isHomeMatch if defaultTeamName is provided
  if (defaultTeamName && awayTeam) {
    const defaultLower = defaultTeamName.toLowerCase();
    if (awayTeam.toLowerCase().includes(defaultLower)) {
      isHomeMatch = false;
    } else if (homeTeam.toLowerCase().includes(defaultLower)) {
      isHomeMatch = true;
    }
  }

  return {
    eventType,
    homeTeam: homeTeam || defaultTeamName || 'Oma Joukkue',
    awayTeam,
    isHomeMatch,
    embeddedVenueHint,
    roundInfo,
    isFriendly: isFriendly || undefined
  };
}

/**
 * Disentangles arrival/warmup DTSTART vs kickoff time from summary and description.
 */
export function resolveEventTimes(
  dtStart: Date,
  dtEnd: Date,
  title: string,
  description: string = '',
  isTraining: boolean = false,
  defaultWarmupOffsetMins?: number
): { kickoffTime: Date; warmupTime: Date; endTime: Date } {
  const text = `${title} ${description}`;
  const defaultOffset = defaultWarmupOffsetMins !== undefined
    ? defaultWarmupOffsetMins
    : (isTraining ? 15 : 45);

  let kickoffTime = new Date(dtStart.getTime());
  let warmupTime = new Date(dtStart.getTime() - defaultOffset * 60 * 1000);
  let endTime = new Date(dtEnd.getTime());

  // Look for explicit kickoff / match start times in description:
  // e.g. "Kickoff klo 15:00", "Peli alkaa klo 15.00", "Ottelu klo 15:00", "Ottelun alku: 15:00"
  const kickoffRegex = /(?:kickoff|peli alkaa|ottelu alkaa|ottelu|alku|aloitus)\s*(?:klo)?\s*(\d{1,2})[:.](\d{2})/i;
  const kickoffMatch = text.match(kickoffRegex);

  // Look for explicit gathering / warmup times:
  // e.g. "Kokoontuminen klo 14:15", "Paikalle klo 14:15", "Alkulämpö klo 14:15"
  const warmupRegex = /(?:kokoontuminen|paikalle|alkulämpö|lämpö|kokoontumisaika)\s*(?:klo)?\s*(\d{1,2})[:.](\d{2})/i;
  const warmupMatch = text.match(warmupRegex);

  if (kickoffMatch && kickoffMatch[1] && kickoffMatch[2]) {
    const kHour = parseInt(kickoffMatch[1], 10);
    const kMin = parseInt(kickoffMatch[2], 10);
    
    // Construct new kickoff date using same day/year as dtStart
    const explicitKickoff = new Date(dtStart);
    explicitKickoff.setHours(kHour, kMin, 0, 0);

    // If dtStart was the gathering time, dtStart is the warmup time!
    if (Math.abs(explicitKickoff.getTime() - dtStart.getTime()) <= 3 * 3600 * 1000) {
      if (explicitKickoff.getTime() >= dtStart.getTime()) {
        kickoffTime = explicitKickoff;
        warmupTime = dtStart;
      } else {
        kickoffTime = explicitKickoff;
        warmupTime = new Date(kickoffTime.getTime() - defaultOffset * 60 * 1000);
      }
    }
  }

  if (warmupMatch && warmupMatch[1] && warmupMatch[2]) {
    const wHour = parseInt(warmupMatch[1], 10);
    const wMin = parseInt(warmupMatch[2], 10);
    const explicitWarmup = new Date(dtStart);
    explicitWarmup.setHours(wHour, wMin, 0, 0);

    if (Math.abs(explicitWarmup.getTime() - kickoffTime.getTime()) <= 3 * 3600 * 1000) {
      warmupTime = explicitWarmup;
    }
  }

  // Ensure warmup is strictly before kickoff
  if (warmupTime.getTime() >= kickoffTime.getTime()) {
    warmupTime = new Date(kickoffTime.getTime() - defaultOffset * 60 * 1000);
  }

  // Ensure endTime is after kickoff
  if (endTime.getTime() <= kickoffTime.getTime()) {
    endTime = new Date(kickoffTime.getTime() + 90 * 60 * 1000);
  }

  return {
    kickoffTime,
    warmupTime,
    endTime
  };
}

/**
 * Extracts volunteer duty details and exact duty time windows (Talkoovahti).
 */
export function extractVolunteerDuty(
  summary: string,
  description: string = ''
): VolunteerDutyResult | undefined {
  const text = `${summary} ${description}`;
  const textLower = text.toLowerCase();

  type DutyRole =
    | 'kahvio'
    | 'toimitsija'
    | 'kello_kirjuri'
    | 'jarjestysmies'
    | 'kioski'
    | 'kyyti'
    | 'makkara'
    | 'striimaus'
    | 'ensiapu';

  let role: DutyRole | undefined;
  let roleLabel = '';

  if (textLower.includes('kahviovuoro') || textLower.includes('kahvio')) {
    role = 'kahvio';
    roleLabel = '☕ Kahviovuoro';
  } else if (textLower.includes('kello ja kirjuri') || textLower.includes('kirjuri/kello') || textLower.includes('kirjuri')) {
    role = 'kello_kirjuri';
    roleLabel = '📝 Kirjuri/Kello';
  } else if (textLower.includes('toimitsija') || textLower.includes('toimitsijavuoro')) {
    role = 'toimitsija';
    roleLabel = '⏱️ Toimitsijavuoro';
  } else if (textLower.includes('järkkäri') || textLower.includes('järjestyksenvalvoja') || textLower.includes('liivimies') || textLower.includes('järjestysmies')) {
    role = 'jarjestysmies';
    roleLabel = '🦺 Järjestyksenvalvoja';
  } else if (textLower.includes('kioski') || textLower.includes('kioskivuoro')) {
    role = 'kioski';
    roleLabel = '🍿 Kioski';
  } else if (textLower.includes('makkaranpaisto') || textLower.includes('makkara') || textLower.includes('grilli')) {
    role = 'makkara';
    roleLabel = '🌭 Makkaranpaisto';
  } else if (textLower.includes('striimaus') || textLower.includes('kuvaus') || textLower.includes('livestriimi')) {
    role = 'striimaus';
    roleLabel = '📹 Striimaus';
  } else if (textLower.includes('ensiapu') || textLower.includes('ea-vuoro')) {
    role = 'ensiapu';
    roleLabel = '🩹 Ensiapu';
  } else if (textLower.includes('kyyti') || textLower.includes('kuski') || textLower.includes('kuljetus')) {
    role = 'kyyti';
    roleLabel = '🚗 Kyytivastaava';
  }

  if (!role) return undefined;

  // Extract time window: e.g. "klo 14:30 - 16:00" or "14:30-16:00" or "14.30 - 16.00"
  const timeWindowRegex = /(?:klo\s*)?(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})/i;
  const twMatch = text.match(timeWindowRegex);

  let timeWindow: string | undefined;
  let dutyTag = roleLabel;

  if (twMatch && twMatch[1] && twMatch[2]) {
    timeWindow = `klo ${twMatch[1].replace('.', ':')} - ${twMatch[2].replace('.', ':')}`;
    dutyTag = `${roleLabel} (${timeWindow})`;
  }

  return {
    dutyTag,
    role,
    timeWindow
  };
}

/**
 * Detects distinct squad groups inside a shared multi-squad iCalendar feed.
 */
export function detectSquadGroups(icsContent: string): { squadName: string; eventCount: number }[] {
  const squadKeywords = [
    'Sininen',
    'Valkoinen',
    'Musta',
    'Punainen',
    'Keltainen',
    'Vihreä',
    'Kilpa',
    'Haaste',
    'Harraste',
    'Akatemia',
    'Edustus',
    'T1',
    'T2',
    'P1',
    'P2',
    'Blue',
    'White',
    'Black'
  ];

  const counts: Record<string, number> = {};

  try {
    const jcalData = ICAL.parse(icsContent);
    const vcalendar = new ICAL.Component(jcalData);
    const vevents = vcalendar.getAllSubcomponents('vevent');

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);
      const fullText = `${event.summary || ''} ${event.description || ''}`;

      for (const squad of squadKeywords) {
        // Match word boundaries: e.g. "Sininen" or "T1"
        const regex = new RegExp(`\\b${squad}\\b`, 'i');
        if (regex.test(fullText)) {
          counts[squad] = (counts[squad] || 0) + 1;
        }
      }
    }
  } catch (e) {
    console.error('Failed to parse ICS for squad detection', e);
  }

  return Object.entries(counts)
    .map(([squadName, eventCount]) => ({ squadName, eventCount }))
    .sort((a, b) => b.eventCount - a.eventCount);
}

/**
 * Filters an ICS string feed down to events belonging to a specific squad.
 */
export function splitICSBySquad(icsContent: string, squadName: string): string {
  try {
    const jcalData = ICAL.parse(icsContent);
    const vcalendar = new ICAL.Component(jcalData);
    const vevents = vcalendar.getAllSubcomponents('vevent');

    const regex = new RegExp(`\\b${squadName}\\b`, 'i');

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);
      const fullText = `${event.summary || ''} ${event.description || ''}`;
      if (!regex.test(fullText)) {
        vcalendar.removeSubcomponent(vevent);
      }
    }

    return vcalendar.toString();
  } catch (e) {
    console.error('Failed to split ICS by squad', e);
    return icsContent;
  }
}

/**
 * Parses raw iCalendar (.ics) string feeds from Nimenhuuto, MyClub, Jopox, or Torneopal.
 * Timezone-safe (RFC 5545) with deterministic volunteer duty detection.
 */
export async function parseICSFeed(
  icsContent: string,
  profileId: string,
  sport: SportType = 'football',
  defaultTeamName?: string
): Promise<MatchdayEvent[]> {
  const events: MatchdayEvent[] = [];

  try {
    const jcalData = ICAL.parse(icsContent);
    const vcalendar = new ICAL.Component(jcalData);
    const vevents = vcalendar.getAllSubcomponents('vevent');

    const venueCache = new Map<string, any>();

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);

      const title = event.summary || 'Tuntematon tapahtuma';
      const location = event.location || 'Töölön Pallokenttä';
      const description = event.description || '';

      // Timezone-safe JS dates from ICAL
      const startDate = event.startDate ? event.startDate.toJSDate() : new Date();
      const endDate = event.endDate
        ? event.endDate.toJSDate()
        : new Date(startDate.getTime() + 90 * 60 * 1000);

      const isTraining = isTrainingEvent(title, description);
      const parsedTitle = parseMatchTitle(title, defaultTeamName);

      const { kickoffTime, warmupTime, endTime } = resolveEventTimes(
        startDate,
        endDate,
        title,
        description,
        isTraining
      );

      // Volunteer duty detection (Talkoovahti)
      const dutyResult = extractVolunteerDuty(title, description);

      // Geocode venue with LIPAS.fi and Slang aliases (use embedded hint if available)
      const venueQuery = parsedTitle.embeddedVenueHint || location;
      let venue = venueCache.get(venueQuery);
      if (!venue) {
        venue = await geocodeSportsVenue(venueQuery);
        venueCache.set(venueQuery, venue);
      }

      events.push({
        id: event.uid || `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        profileId,
        sport,
        eventType: parsedTitle.eventType,
        isTraining,
        title,
        homeTeam: parsedTitle.homeTeam,
        awayTeam: parsedTitle.awayTeam,
        isHomeMatch: parsedTitle.isHomeMatch,
        startTime: kickoffTime.toISOString(),
        endTime: endTime.toISOString(),
        warmupTime: warmupTime.toISOString(),
        venue,
        volunteerDuty: dutyResult ? dutyResult.dutyTag : undefined
      });
    }
  } catch (error) {
    console.error('Failed to parse ICS feed:', error);
  }

  // Return chronological sort
  return events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
}
