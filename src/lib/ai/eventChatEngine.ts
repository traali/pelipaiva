import type { MatchdayEvent, PlayerProfile, EventChatMessage } from '../../types/matchday';
import { resolveSportsVenue } from '../geo/sportsGeocoder';
import { fetchFmiMatchWeather } from '../weather/fmiWeatherEngine';
import { calculateParkingEase } from '../parking/parkingEaseEngine';
import {
  extractTimesFromFinnishText,
  extractCarpoolAssignmentsFromText,
  extractKitColorFromText
} from './messageParserNLP';
import { getFinnishTimezoneOffset } from '../stats/statsEngine';

export interface EventChatResult {
  updatedEvent: MatchdayEvent;
  aiResponse: string;
  appliedChanges: string[];
}

/**
 * Parses freeform natural language user messages entered directly into an event (chat-like)
 * and applies changes (kickoff time, warmup time, score, kit, venue, volunteer duties, carpools, player stats).
 */
export async function applyEventChatUpdate(
  event: MatchdayEvent,
  message: string,
  _profile?: PlayerProfile
): Promise<EventChatResult> {
  const norm = message.toLowerCase().trim();
  const appliedChanges: string[] = [];
  const updated: MatchdayEvent = { ...event };
  const eventDateStr = event.startTime.split('T')[0] || new Date().toISOString().split('T')[0];
  const offset = getFinnishTimezoneOffset(new Date(`${eventDateStr}T12:00:00Z`));
  const targetPlayerName = _profile?.playerName;

  // 1. Score detection (e.g. "tulos 3-2", "voitettiin 4-1", "hävittiin 0-3", "päättyi 2–2", "lopputulos 1-1", "FT 3-2")
  // MUST require explicit score keyword or hyphen format (never colon times like 15:30)
  const explicitScoreMatch = norm.match(/\b(?:tulos|päättyi|voitettiin|hävittiin|lopputulos|ft)\s*[:=]?\s*(\d{1,2})\s*[-–:]\s*(\d{1,2})\b/i);
  let resolvedScore: string | null = null;

  if (explicitScoreMatch && explicitScoreMatch[1] && explicitScoreMatch[2]) {
    resolvedScore = `${explicitScoreMatch[1]}–${explicitScoreMatch[2]}`;
  } else {
    // Implicit score like "4-2" or "3–1" (only hyphens, never colons, realistic scores <= 20, not time ranges like 15-17)
    const implicitScoreMatch = norm.match(/(?:^|\s)(\d{1,2})\s*[-–]\s*(\d{1,2})(?:\s|$|[!.,])/);
    if (implicitScoreMatch && implicitScoreMatch[1] && implicitScoreMatch[2]) {
      const s1 = parseInt(implicitScoreMatch[1], 10);
      const s2 = parseInt(implicitScoreMatch[2], 10);
      // Ensure it's not a time range like "14-16" or "15-17" when preceded by klo or duty hours
      const isTimeRange = norm.includes('klo') || norm.includes('vuoro') || (s1 >= 8 && s2 >= 9 && s2 <= 23 && s2 > s1 && (s2 - s1) <= 4);
      if (!isTimeRange && s1 <= 20 && s2 <= 20) {
        resolvedScore = `${s1}–${s2}`;
      }
    }
  }

  if (resolvedScore) {
    updated.score = resolvedScore;
    appliedChanges.push(`Tulos päivitetty: ${resolvedScore}`);
  }

  // 2. Times (Kickoff / Warmup)
  const times = extractTimesFromFinnishText(message);
  if (times.kickoff) {
    const startIso = new Date(`${eventDateStr}T${times.kickoff}:00${offset}`).toISOString();
    updated.startTime = startIso;
    if (times.end) {
      updated.endTime = new Date(`${eventDateStr}T${times.end}:00${offset}`).toISOString();
    } else {
      const startD = new Date(startIso);
      const endD = new Date(startD.getTime() + 60 * 60 * 1000);
      updated.endTime = endD.toISOString();
    }
    appliedChanges.push(`Aloitusaika päivitetty: klo ${times.kickoff}`);
  }

  if (times.warmup) {
    updated.warmupTime = new Date(`${eventDateStr}T${times.warmup}:00${offset}`).toISOString();
    appliedChanges.push(`Alkulämpö / kokoontuminen päivitetty: klo ${times.warmup}`);
  }

  // 3. Volunteer duties / Talkoovuoro (e.g. "kahviovuoro klo 14-16", "toimitsijavuoro")
  if (norm.includes('kahvio') || norm.includes('toimitsija') || norm.includes('kirjuri') || norm.includes('makkara') || norm.includes('kioski')) {
    let dutyText = '☕ Talkoovuoro';
    if (norm.includes('kahvio')) dutyText = '☕ Kahviovuoro';
    else if (norm.includes('toimitsija') || norm.includes('kirjuri')) dutyText = '⏱️ Toimitsijavuoro';
    else if (norm.includes('makkara') || norm.includes('kioski')) dutyText = '🌭 Kioski-/makkaravuoro';

    const timeWindowMatch = norm.match(/(\d{1,2}(?:[.:]\d{2})?)\s*[-–]\s*(\d{1,2}(?:[.:]\d{2})?)/);
    if (timeWindowMatch && timeWindowMatch[1] && timeWindowMatch[2]) {
      dutyText += ` (klo ${timeWindowMatch[1].replace('.', ':')} - ${timeWindowMatch[2].replace('.', ':')})`;
    }
    updated.volunteerDuty = dutyText;
    appliedChanges.push(`Talkootehtävä asetettu: ${dutyText}`);
  }

  // 3.5 Structured Carpool & Ride Roster detection
  const carpool = extractCarpoolAssignmentsFromText(message, targetPlayerName);
  if (carpool.playerSummary) {
    appliedChanges.push(carpool.playerSummary);
  } else if (norm.includes('kyyti') || norm.includes('lähtö') || norm.includes('kyydit')) {
    const kyytiNote = `🚗 Kyyti: ${message.trim()}`;
    appliedChanges.push(kyytiNote);
  }

  // 3.6 Kit / Peliasu color detection
  const kit = extractKitColorFromText(message);
  if (kit) {
    appliedChanges.push(`👕 Peliasu: ${kit}`);
    if (updated.briefing) {
      updated.briefing = {
        ...updated.briefing,
        gearAndPackingAdvice: {
          ...updated.briefing.gearAndPackingAdvice,
          kitRecommendation: kit
        }
      };
    }
  }

  // 3.7 School notes / Exam pages (e.g. "sivut 22-27", "luokka T 36", "tiivistelmävihko mukaan")
  const schoolPagesMatch = message.match(/(?:sivut|sivuilta|s\.)\s*(\d+[\s–-]+\d+)/i);
  const classroomMatch = message.match(/\b(?:luokka|luokassa|tila)\s+([A-Za-z0-9\s-]+)\b/i);
  if (schoolPagesMatch && schoolPagesMatch[1]) {
    appliedChanges.push(`📚 Kokeen sivut: ${schoolPagesMatch[1]}`);
  }
  if (classroomMatch && classroomMatch[1]) {
    appliedChanges.push(`🏫 Tila: Luokka ${classroomMatch[1].trim()}`);
  }

  // 4. Venue change (e.g. "kenttä vaihdettu: Bollis 2", "pelipaikka Talin halli", "kenttänä Pirkkola TN2")
  const venueMatch = message.match(/(?:kenttä|pelipaikka|sijainti|paikkana|kenttänä)\s*(?:vaihdettu|on|:)?\s*([A-Za-z0-9äöåÄÖÅ\s\-_/]{3,35})/i);
  if (venueMatch && venueMatch[1]) {
    const rawVenue = venueMatch[1].trim();
    if (rawVenue.length > 3 && !rawVenue.includes('klo') && !rawVenue.includes('tulos')) {
      const resolved = await resolveSportsVenue(rawVenue);
      updated.venue = resolved;
      const coords = resolved.coordinates || { lat: 60.169, lng: 24.938 };
      const weather = await fetchFmiMatchWeather(coords, updated.startTime, updated.endTime);
      const parking = calculateParkingEase(resolved.name, coords, new Date(updated.startTime));
      if (weather) updated.weather = weather;
      if (parking) updated.parking = parking;
      appliedChanges.push(`Kenttä päivitetty: ${resolved.name} (sää ja parkkitiedot päivitetty)`);
    }
  }

  // 5. Player personal stats (e.g. "tein 2 maalia ja 1 syötön", "3 maalia", "tähtipelaaja")
  const goalsMatch = norm.match(/(\d+)\s*(?:maali|häkki|kassi|osuma)/i);
  const assistsMatch = norm.match(/(\d+)\s*(?:syöttö|passi)/i);
  const starMatch = norm.includes('tsemppari') || norm.includes('tähtipelaaja') || norm.includes('ottelun tähti');
  if (goalsMatch || assistsMatch || starMatch) {
    const existingLog = updated.playerLog || {};
    const newGoals = (goalsMatch && goalsMatch[1]) ? parseInt(goalsMatch[1], 10) : (existingLog.goals || 0);
    const newAssists = (assistsMatch && assistsMatch[1]) ? parseInt(assistsMatch[1], 10) : (existingLog.assists || 0);
    updated.playerLog = {
      ...existingLog,
      goals: newGoals,
      assists: newAssists,
      points: newGoals + newAssists,
      starPlayerAward: starMatch ? true : existingLog.starPlayerAward,
      loggedAt: new Date().toISOString()
    };
    appliedChanges.push(`Pelaajatilastot tallennettu: ${newGoals} maalia, ${newAssists} syöttöä`);
  }

  // Mark event as having WhatsApp / Chat updates
  updated.hasWhatsAppUpdates = true;
  updated.reconciliationStatus = 'auto_matched';

  // Append applied changes to notes
  if (appliedChanges.length > 0) {
    const newNotes = appliedChanges.join('\n• ');
    updated.notes = updated.notes ? `${updated.notes}\n• ${newNotes}` : `• ${newNotes}`;
  } else {
    updated.notes = updated.notes ? `${updated.notes}\n• ${message}` : `• ${message}`;
  }

  // Append to chat messages thread
  const newMsg: EventChatMessage = {
    id: `msg-${Date.now()}`,
    sender: 'user',
    text: message,
    timestamp: new Date().toISOString(),
    appliedChanges: appliedChanges.length > 0 ? appliedChanges : undefined
  };

  const existingMsgs = updated.chatMessages || [];
  updated.chatMessages = [...existingMsgs, newMsg];

  const aiResponse = appliedChanges.length > 0
    ? `Selvä! Päivitin tiedot: ${appliedChanges.join(', ')}.`
    : `Muistiinpano tallennettu tapahtuman tietoihin: "${message}"`;

  return {
    updatedEvent: updated,
    aiResponse,
    appliedChanges
  };
}
