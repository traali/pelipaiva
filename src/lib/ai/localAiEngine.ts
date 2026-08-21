import { MatchdayEvent, PlayerProfile } from '../../types/matchday';
import { ExtractedSportsEvent, parseFreeformSportsMessage } from './messageParserNLP';
import { parseExcelFileBuffer, parsePastedSpreadsheetText } from './tableAndExcelParser';
import { parseScheduleImage } from './ocrImageParser';
import { resolveSportsVenue } from '../geo/sportsGeocoder';
import { fetchFmiMatchWeather } from '../weather/fmiWeatherEngine';
import { calculateParkingEase } from '../parking/parkingEaseEngine';
import { generateMatchdayBriefing } from './deterministicReasoner';
import { generateOrResolveMatchStats } from '../stats/statsEngine';

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
  const target: string =
    targetDate ||
    (events[0]?.startTime ? events[0].startTime.split('T')[0] || '' : '') ||
    new Date().toISOString().split('T')[0] ||
    '2026-08-24';
  const daysEvents = events.filter((e) => e.startTime.startsWith(target));

  if (daysEvents.length === 0) {
    return {
      date: target,
      hasConflicts: false,
      conflictDetails: [],
      departureSchedule: [],
      summaryNarrative: 'Ei merkittyjä otteluita tai harjoituksia tälle päivälle.',
      whatsAppShareText: 'Ei otteluita tänään.'
    };
  }

  // Sort events chronologically by warmup arrival
  const sorted = [...daysEvents].sort(
    (a, b) => new Date(a.warmupTime).getTime() - new Date(b.warmupTime).getTime()
  );

  const conflictDetails: string[] = [];
  const scheduleItems: FamilyLogisticsPlan['departureSchedule'] = [];

  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i]!;
    const profile = profiles.find((p) => p.id === curr.profileId);
    const childName = profile?.playerName || 'Lapsi';

    const warmupFormatted = new Date(curr.warmupTime).toLocaleTimeString('fi-FI', {
      hour: '2-digit',
      minute: '2-digit'
    });
    const kickoffFormatted = new Date(curr.startTime).toLocaleTimeString('fi-FI', {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Check overlap with next event
    if (i < sorted.length - 1) {
      const next = sorted[i + 1]!;
      const nextProfile = profiles.find((p) => p.id === next.profileId);
      const nextChild = nextProfile?.playerName || 'Toinen lapsi';

      const currEnd = new Date(curr.endTime).getTime();
      const nextStart = new Date(next.startTime).getTime();

      if (currEnd > nextStart && curr.venue.name !== next.venue.name) {
        conflictDetails.push(
          `⚠️ Päällekkäisyys: ${childName} (${curr.venue.name}) ja ${nextChild} (${next.venue.name}) pelaavat samaan aikaan eri kentillä!`
        );
      }
    }

    scheduleItems.push({
      time: warmupFormatted,
      action: `Saapuminen alkulämpöön: ${curr.title} (Kickoff ${kickoffFormatted})`,
      childName,
      venueName: curr.venue.name,
      driverRole: i === 0 ? 'Vanhempi 1' : 'Vanhempi 2'
    });
  }

  const hasConflicts = conflictDetails.length > 0;
  const summaryNarrative = hasConflicts
    ? `Tälle päivälle osuu ${sorted.length} tapahtumaa. Havaitut päällekkäisyydet vaativat kahden kuskin jakoa: ${conflictDetails.join(' ')}`
    : `Päivän ohjelmassa on ${sorted.length} tapahtumaa ilman logistiikkaristiriitoja. Yksi kuski ehtii hoitaa kuljetukset.`;

  const whatsAppShareText = `🚗 Pelipäivän Kyytisuunnitelma (${target}):\n` +
    scheduleItems.map((s) => `• klo ${s.time}: ${s.childName} ➔ ${s.venueName} (${s.action})`).join('\n') +
    (hasConflicts ? `\n\nHuom: ${conflictDetails.join('\n')}` : '\n\nKaikki aikataulut sujuvat!');

  return {
    date: target,
    hasConflicts,
    conflictDetails,
    departureSchedule: scheduleItems,
    summaryNarrative,
    whatsAppShareText
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

  // Generic fallback
  return {
    answer: `Perheen kalenterissa on yhteensä ${events.length} merkittyä ottelua ja harjoitusta ${profiles.length} joukkueelle. Voit kysyä esimerkiksi seuraavasta pelistä, kahviovuoroista tai kyytisuunnitelmasta!`,
    relevantEvents: events.slice(0, 3),
    confidence: 0.8
  };
}

export {
  parseFreeformSportsMessage,
  parsePastedSpreadsheetText,
  parseExcelFileBuffer,
  parseScheduleImage
};
