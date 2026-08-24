import { MatchdayEvent, PlayerProfile } from '../../types/matchday';
import { ExtractedSportsEvent, parseFreeformSportsMessage } from './messageParserNLP';
import { parsePastedSpreadsheetText } from './tableAndExcelParser';
import { resolveSportsVenue } from '../geo/sportsGeocoder';
import { fetchFmiMatchWeather } from '../weather/fmiWeatherEngine';
import { calculateParkingEase } from '../parking/parkingEaseEngine';
import { generateMatchdayBriefing } from './deterministicReasoner';
import { getFinnishTimezoneOffset } from '../stats/statsEngine';
import { runMissionControlGraph } from '../agents';

export interface FamilyLogisticsPlan {
  date: string;
  hasConflicts: boolean;
  conflictDetails: string[];
  departureSchedule: Array<{
    time: string;
    action: string;
    childName: string;
    venueName: string;
    driverRole?: string;
  }>;
  summaryNarrative: string;
  whatsAppShareText: string;
}

export interface CopilotQueryResult {
  answer: string;
  relevantEvents: MatchdayEvent[];
  confidence: number;
}

/**
 * Converts extracted sports event to a full MatchdayEvent.
 */
export async function convertExtractedToMatchdayEvent(
  extracted: ExtractedSportsEvent,
  profileId: string,
  _playerName = 'Pelaaja'
): Promise<MatchdayEvent> {
  if (!extracted.dateStr || !extracted.kickoffTime) {
    throw new Error('Viestistä puuttuu päivä tai kellonaika');
  }
  if (extracted.confidenceScore < 0.5) {
    throw new Error('Viestiä ei tunnistettu otteluksi');
  }
  const venue = await resolveSportsVenue(extracted.venueHint || 'Kenttä ilmoitetaan');

  const offset = getFinnishTimezoneOffset(new Date(`${extracted.dateStr}T12:00:00Z`));
  const startTime = new Date(`${extracted.dateStr}T${extracted.kickoffTime}:00${offset}`).toISOString();
  const endTime = new Date(`${extracted.dateStr}T${extracted.endTime}:00${offset}`).toISOString();
  const warmupTime = new Date(`${extracted.dateStr}T${extracted.warmupTime}:00${offset}`).toISOString();

  const isTraining = extracted.eventType === 'training';

  const matchEvent: MatchdayEvent = {
    id: `event-ai-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    profileId,
    sport: extracted.sport,
    eventType: extracted.eventType,
    isTraining,
    title: extracted.title,
    homeTeam: extracted.homeTeam,
    awayTeam: extracted.awayTeam,
    isHomeMatch: extracted.isHomeMatch,
    startTime,
    endTime,
    warmupTime,
    venue,
    volunteerDuty: extracted.volunteerDuties.length > 0 ? extracted.volunteerDuties.join(' • ') : undefined,
    stats: undefined,
    reconciliationStatus: 'auto_matched',
    confidenceScore: extracted.confidenceScore
  };

  const weather = await fetchFmiMatchWeather(venue.coordinates, startTime, endTime);
  const parking = calculateParkingEase(venue.name, venue.coordinates, new Date(startTime));
  if (weather) matchEvent.weather = weather;
  matchEvent.parking = parking;
  matchEvent.briefing = generateMatchdayBriefing(matchEvent, [matchEvent]);

  return matchEvent;
}

/**
 * Plans family carpooling and logistics across multiple kids.
 */
export function planFamilyLogistics(
  events: MatchdayEvent[],
  profiles: PlayerProfile[],
  targetDate?: string
): FamilyLogisticsPlan {
  const now = targetDate
    ? new Date(`${targetDate}T12:00:00${getFinnishTimezoneOffset(new Date(`${targetDate}T12:00:00Z`))}`)
    : new Date();
  const snap = runMissionControlGraph(events, profiles, now);
  const date = targetDate || snap.weekendLabel;

  if (!snap.nextEvent && snap.days.every((d) => d.events.length === 0)) {
    return {
      date,
      hasConflicts: false,
      conflictDetails: [],
      departureSchedule: [],
      summaryNarrative: 'Ei merkittyjä otteluita tai harjoituksia tälle viikonlopulle.',
      whatsAppShareText: 'Ei otteluita tänä viikonloppuna.'
    };
  }

  return {
    date,
    hasConflicts: snap.conflicts.length > 0,
    conflictDetails: snap.conflicts.map((c) => c.message),
    departureSchedule: snap.carpool.map((step) => ({
      time: step.leaveBy,
      action: step.action,
      childName: step.childName,
      venueName: step.venueName,
      driverRole: step.driverSlot
    })),
    summaryNarrative: snap.summary,
    whatsAppShareText: snap.whatsAppShareText
  };
}

/**
 * Answers natural language questions against the family schedule in local Dexie database.
 */
export function queryFamilySchedule(
  query: string,
  events: MatchdayEvent[],
  profiles: PlayerProfile[]
): CopilotQueryResult {
  const norm = query.toLowerCase().trim();

  const namedProfile = profiles.find((p) => p.playerName && norm.includes(p.playerName.toLowerCase()));
  const scopedEvents = namedProfile ? events.filter((e) => e.profileId === namedProfile.id) : events;

  if (
    norm.includes('kyyti') ||
    norm.includes('kyydit') ||
    norm.includes('kuski') ||
    norm.includes('carpool')
  ) {
    const plan = planFamilyLogistics(scopedEvents, profiles);
    return {
      answer: plan.whatsAppShareText || plan.summaryNarrative,
      relevantEvents: scopedEvents.slice(0, 8),
      confidence: 0.9
    };
  }

  // 1. Volunteer duties query
  if (norm.includes('kahvio') || norm.includes('toimitsija') || norm.includes('vuoro') || norm.includes('kirjuri')) {
    const dutyEvents = scopedEvents.filter((e) => e.volunteerDuty && e.volunteerDuty.length > 0);
    if (dutyEvents.length === 0) {
      return {
        answer: 'Sinulla ei ole merkittyjä kahvio- tai toimitsijavuoroja tulevissa otteluissa.',
        relevantEvents: [],
        confidence: 0.95
      };
    }
    const list = dutyEvents
      .map((e) => {
        const d = new Date(e.startTime).toLocaleDateString('fi-FI', {
          weekday: 'short',
          day: 'numeric',
          month: 'numeric',
          timeZone: 'Europe/Helsinki'
        });
        return `• ${d} klo ${new Date(e.startTime).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Helsinki' })} @ ${e.venue.name}: ${e.volunteerDuty}`;
      })
      .join('\n');
    return {
      answer: `Löysin seuraavat vanhempien vuorot:\n${list}`,
      relevantEvents: dutyEvents,
      confidence: 0.95
    };
  }

  // Surface / Footwear before "milloin" so AG chips are not stolen by next-game.
  if (norm.includes('kengät') || norm.includes('nappikset') || norm.includes('tekonurmi') || norm.includes('alusta')) {
    const turfEvents = scopedEvents.filter((e) => e.venue.surface === 'artificial_turf_3g');
    return {
      answer: `Kalenterissasi on ${turfEvents.length} tekonurmella pelattavaa ottelua. Tekonurmelle suositellaan pyöreänappisia AG-kenkiä polvien ja nilkkojen säästämiseksi.`,
      relevantEvents: turfEvents,
      confidence: 0.9
    };
  }

  // Next game query
  if (norm.includes('seuraava') || norm.includes('milloin') || norm.includes('huomenna') || norm.includes('tuleva')) {
    const upcoming = scopedEvents
      .filter((e) => new Date(e.startTime) >= new Date())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    if (upcoming.length === 0) {
      return {
        answer: 'Ei tulevia otteluita kalenterissa.',
        relevantEvents: [],
        confidence: 0.9
      };
    }

    const next = upcoming[0]!;
    const profile = profiles.find((p) => p.id === next.profileId);
    const childName = profile?.playerName || 'Pelaaja';
    const dateStr = new Date(next.startTime).toLocaleDateString('fi-FI', {
      weekday: 'long',
      day: 'numeric',
      month: 'numeric',
      timeZone: 'Europe/Helsinki'
    });
    const timeStr = new Date(next.startTime).toLocaleTimeString('fi-FI', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Helsinki'
    });
    const warmupStr = new Date(next.warmupTime).toLocaleTimeString('fi-FI', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Helsinki'
    });

    return {
      answer: `Seuraava ottelu on ${childName}:lla ${dateStr} klo ${timeStr} (alkulämpö klo ${warmupStr}) kentällä ${next.venue.name}. Vastassa on ${next.awayTeam}.`,
      relevantEvents: [next],
      confidence: 0.95
    };
  }

  // Generic fallback
  return {
    answer: `Perheen kalenterissa on yhteensä ${events.length} merkittyä ottelua ja harjoitusta ${profiles.length} joukkueelle. Voit kysyä esimerkiksi seuraavasta pelistä, kahviovuoroista tai kyytisuunnitelmasta!`,
    relevantEvents: events.slice(0, 3),
    confidence: 0.8
  };
}

export {
  parseFreeformSportsMessage,
  parsePastedSpreadsheetText
};

export async function parseExcelFileBuffer(
  buffer: ArrayBuffer,
  sport: Parameters<typeof import('./tableAndExcelParser').parseExcelFileBuffer>[1] = 'football',
  defaultPlayer = 'Maija'
) {
  const mod = await import('./tableAndExcelParser');
  return mod.parseExcelFileBuffer(buffer, sport, defaultPlayer);
}

export async function parseScheduleImage(
  imageSource: File | Blob | string,
  sport: Parameters<typeof import('./ocrImageParser').parseScheduleImage>[1] = 'football',
  defaultPlayer = 'Maija',
  onProgress?: import('./ocrImageParser').OcrProgressCallback
) {
  const mod = await import('./ocrImageParser');
  return mod.parseScheduleImage(imageSource, sport, defaultPlayer, onProgress);
}
