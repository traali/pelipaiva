import { MatchdayEvent, PlayerProfile } from '../../types/matchday';
import { ExtractedSportsEvent, parseFreeformSportsMessage, parseMultipleSportsMessages } from './messageParserNLP';
import { parseExcelFileBuffer, parsePastedSpreadsheetText } from './tableAndExcelParser';
import { parseScheduleImage } from './ocrImageParser';
import { resolveSportsVenue } from '../geo/sportsGeocoder';
import { fetchFmiMatchWeather } from '../weather/fmiWeatherEngine';
import { calculateParkingEase } from '../parking/parkingEaseEngine';
import { generateMatchdayBriefing } from './deterministicReasoner';
import { generateOrResolveMatchStats } from '../stats/statsEngine';
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
  const venue = await resolveSportsVenue(extracted.venueHint);

  const startTime = new Date(`${extracted.dateStr}T${extracted.kickoffTime}:00+03:00`).toISOString();
  const endTime = new Date(`${extracted.dateStr}T${extracted.endTime}:00+03:00`).toISOString();
  const warmupTime = new Date(`${extracted.dateStr}T${extracted.warmupTime}:00+03:00`).toISOString();

  const isTraining = extracted.eventType === 'training';
  const matchStats = isTraining
    ? undefined
    : generateOrResolveMatchStats(extracted.homeTeam, extracted.awayTeam, extracted.sport);

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
    stats: matchStats,
    reconciliationStatus: 'auto_matched',
    confidenceScore: extracted.confidenceScore
  };

  const weather = await fetchFmiMatchWeather(venue.coordinates, startTime, endTime);
  const parking = calculateParkingEase(venue.name, venue.coordinates, new Date(startTime));
  matchEvent.weather = weather;
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
  const now = targetDate ? new Date(`${targetDate}T12:00:00+03:00`) : new Date();
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

  // 1. Volunteer duties query
  if (norm.includes('kahvio') || norm.includes('toimitsija') || norm.includes('vuoro') || norm.includes('kirjuri')) {
    const dutyEvents = events.filter((e) => e.volunteerDuty && e.volunteerDuty.length > 0);
    if (dutyEvents.length === 0) {
      return {
        answer: 'Sinulla ei ole merkittyjä kahvio- tai toimitsijavuoroja tulevissa otteluissa.',
        relevantEvents: [],
        confidence: 0.95
      };
    }
    const list = dutyEvents
      .map((e) => {
        const d = new Date(e.startTime).toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' });
        return `• ${d} klo ${new Date(e.startTime).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' })} @ ${e.venue.name}: ${e.volunteerDuty}`;
      })
      .join('\n');
    return {
      answer: `Löysin seuraavat vanhempien vuorot:\n${list}`,
      relevantEvents: dutyEvents,
      confidence: 0.95
    };
  }

  // 2. Next game query
  if (norm.includes('seuraava') || norm.includes('milloin') || norm.includes('huomenna') || norm.includes('tuleva')) {
    const upcoming = events
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
    const dateStr = new Date(next.startTime).toLocaleDateString('fi-FI', { weekday: 'long', day: 'numeric', month: 'numeric' });
    const timeStr = new Date(next.startTime).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
    const warmupStr = new Date(next.warmupTime).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });

    return {
      answer: `Seuraava ottelu on ${childName}:lla ${dateStr} klo ${timeStr} (alkulämpö klo ${warmupStr}) kentällä ${next.venue.name}. Vastassa on ${next.awayTeam}.`,
      relevantEvents: [next],
      confidence: 0.95
    };
  }

  // 3. Surface / Footwear query
  if (norm.includes('kengät') || norm.includes('nappikset') || norm.includes('tekonurmi') || norm.includes('alusta')) {
    const turfEvents = events.filter((e) => e.venue.surface === 'artificial_turf_3g');
    return {
      answer: `Kalenterissasi on ${turfEvents.length} tekonurmella pelattavaa ottelua. Tekonurmelle suositellaan pyöreänappisia AG-kenkiä polvien ja nilkkojen säästämiseksi.`,
      relevantEvents: turfEvents,
      confidence: 0.9
    };
  }

  // 4. Logistics & Carpooling query
  if (
    norm.includes('kyyti') ||
    norm.includes('kuski') ||
    norm.includes('aja') ||
    norm.includes('kuljetus') ||
    norm.includes('ristiriita') ||
    norm.includes('auto')
  ) {
    const plan = planFamilyLogistics(events, profiles);
    if (plan.departureSchedule.length === 0) {
      return {
        answer: 'Ei aktiivisia kyytitarpeita tai siirtymiä tulevalle viikonlopulle.',
        relevantEvents: [],
        confidence: 0.95
      };
    }
    const schedule = plan.departureSchedule
      .map((s) => `• Klo ${s.time}: Lähtö kohteeseen ${s.venueName} (${s.childName})`)
      .join('\n');
    const conflictNote = plan.hasConflicts
      ? `\n\n⚠️ Huomio: ${plan.conflictDetails.join(' ')}`
      : '\n\n✅ Ei logistiikkaristiriitoja kyydeissä.';
    return {
      answer: `Viikonlopun kuskisuunnitelma:\n${schedule}${conflictNote}`,
      relevantEvents: events.slice(0, 3),
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

/**
 * Enhanced query with On-Device LLM (Chrome Built-in Prompt API / window.ai)
 * with instant fallback to deterministic Finnish sports reasoner.
 */
export async function queryFamilyScheduleWithLLM(
  query: string,
  events: MatchdayEvent[],
  profiles: PlayerProfile[]
): Promise<CopilotQueryResult> {
  const fallback = queryFamilySchedule(query, events, profiles);

  // Check if browser has on-device Gemini Nano / window.ai available
  if (typeof window !== 'undefined' && (window as any).ai?.languageModel) {
    try {
      const capabilities = await (window as any).ai.languageModel.capabilities();
      if (capabilities.available === 'readily') {
        const session = await (window as any).ai.languageModel.create({
          systemPrompt:
            'Olet Pelipäivä-sovelluksen perheavustaja. Vastaa ystävällisesti, lyhyesti ja selkeästi suomeksi perheen urheilukysymyksiin annetun aikatauludatan pohjalta.'
        });
        const context = `Kalenterin tiedot: ${JSON.stringify(
          events.slice(0, 5).map((e) => ({
            peli: e.title,
            aika: e.startTime,
            paikka: e.venue.name,
            talkoot: e.volunteerDuty
          }))
        )}`;
        const response = await session.prompt(`${context}\nKysymys: ${query}`);
        if (response && response.trim().length > 0) {
          return {
            answer: response.trim(),
            relevantEvents: fallback.relevantEvents,
            confidence: 0.98
          };
        }
      }
    } catch {
      // Fallback silently to deterministic reasoning
    }
  }

  return fallback;
}

export {
  parseFreeformSportsMessage,
  parseMultipleSportsMessages,
  parsePastedSpreadsheetText,
  parseExcelFileBuffer,
  parseScheduleImage
};
