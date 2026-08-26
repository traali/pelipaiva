import type { MatchdayEvent, PlayerProfile, EventChatMessage } from '../../types/matchday';
import { resolveSportsVenue } from '../geo/sportsGeocoder';
import { fetchFmiMatchWeather } from '../weather/fmiWeatherEngine';
import { calculateParkingEase } from '../parking/parkingEaseEngine';
import { extractTimesFromFinnishText } from './messageParserNLP';
import { getFinnishTimezoneOffset } from '../stats/statsEngine';

export interface EventChatResult {
  updatedEvent: MatchdayEvent;
  aiResponse: string;
  appliedChanges: string[];
}

/**
 * Parses freeform natural language user messages entered directly into an event (chat-like)
 * and applies changes (kickoff time, warmup time, score, kit, venue, volunteer duties, player stats).
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

  // 1. Score detection (e.g. "tulos 3-2", "voitettiin 4-1", "hävittiin 0-3", "päättyi 2–2")
  const scoreMatch = norm.match(/(?:tulos|päättyi|voitettiin|hävittiin|lopputulos)?\s*(\d{1,2})\s*[-–:]\s*(\d{1,2})/i);
  if (scoreMatch) {
    const scoreStr = `${scoreMatch[1]}–${scoreMatch[2]}`;
    updated.score = scoreStr;
    appliedChanges.push(`Tulos päivitetty: ${scoreStr}`);
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

  // Also append to notes
  const noteSnippet = appliedChanges.length > 0 ? appliedChanges.join('; ') : message;
  updated.notes = updated.notes ? `${updated.notes}\n• ${noteSnippet}` : `• ${noteSnippet}`;

  const aiResponse = appliedChanges.length > 0
    ? `Selvä! Päivitin tiedot: ${appliedChanges.join(', ')}.`
    : `Muistiinpano tallennettu tapahtuman tietoihin: "${message}"`;

  return {
    updatedEvent: updated,
    aiResponse,
    appliedChanges
  };
}
