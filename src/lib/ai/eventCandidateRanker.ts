import type { MatchdayEvent, PlayerProfile } from '../../types/matchday';
import { extractDateFromFinnishText, extractTimesFromFinnishText } from './messageParserNLP';

export interface RankedEventCandidate {
  event: MatchdayEvent;
  score: number; // 0 - 100
  matchPercentage: number; // e.g. 95
  matchReason: string; // e.g. "Sama pelaaja (Simo) ja sama päivä (pe 28.8.)"
  suggestedActionText: string; // e.g. "Lisätään kyyti klo 15:30 ja huomautus: lähtö Ekin luota"
  profile?: PlayerProfile;
}

export interface CandidateRankingResult {
  detectedPlayerName?: string;
  detectedProfile?: PlayerProfile;
  candidates: RankedEventCandidate[];
  isNewEventRecommended: boolean;
  newEventPreviewTitle: string;
}

/**
 * Detects the mentioned player name from text, taking into account Finnish case forms.
 */
export function detectPlayerFromText(text: string, profiles: PlayerProfile[]): PlayerProfile | undefined {
  const norm = text.toLowerCase();
  for (const profile of profiles) {
    const name = profile.playerName.trim().toLowerCase();
    if (name.length < 2) continue;
    // Matches "Simo", "Simon", "Simolle", "Simolla", "Simosta", "Simoa", "Simolta"
    const regex = new RegExp(`\\b${name}(?:lla|llä|lle|n|ta|tä|sta|stä|lta|ltä)?\\b`, 'i');
    if (regex.test(norm)) {
      return profile;
    }
  }
  return undefined;
}

/**
 * Generates an AI summary of what will be updated if merged into the target event.
 */
export function generateSuggestedUpdateNarrative(message: string, _event?: MatchdayEvent): string {
  const norm = message.toLowerCase();
  const suggestions: string[] = [];

  // Score
  const scoreMatch = norm.match(/(?:tulos|päättyi|voitettiin|hävittiin|lopputulos)?\s*(\d{1,2})\s*[-–:]\s*(\d{1,2})/i);
  if (scoreMatch) {
    suggestions.push(`Tulos ${scoreMatch[1]}–${scoreMatch[2]}`);
  }

  // Times
  const times = extractTimesFromFinnishText(message);
  if (times.kickoff) {
    suggestions.push(`Aloitusaika klo ${times.kickoff}`);
  }
  if (times.warmup) {
    suggestions.push(`Kokoontuminen klo ${times.warmup}`);
  }

  // Volunteer
  if (norm.includes('kahvio')) suggestions.push('☕ Kahviovuoro');
  else if (norm.includes('toimitsija') || norm.includes('kirjuri')) suggestions.push('⏱️ Toimitsijavuoro');
  else if (norm.includes('makkara') || norm.includes('kioski')) suggestions.push('🌭 Kioskivuoro');

  // Kyyti
  if (norm.includes('kyyti') || norm.includes('lähtö') || norm.includes('kyydit')) {
    const timeMatch = norm.match(/(\d{1,2}[:.]\d{2})/);
    suggestions.push(`🚗 Kyytirinki${timeMatch && timeMatch[1] ? ` (lähtö klo ${timeMatch[1].replace('.', ':')})` : ''}`);
  }

  // Kit
  if (norm.includes('mustat paidat') || norm.includes('musta paita')) suggestions.push('🎽 Musta peliasu');
  else if (norm.includes('valkoiset paidat') || norm.includes('valkoinen paita')) suggestions.push('🎽 Valkoinen peliasu');
  else if (norm.includes('siniset paidat') || norm.includes('sininen paita')) suggestions.push('🎽 Sininen peliasu');

  // Venue
  if (norm.includes('kenttä vaihdettu') || norm.includes('pelipaikka')) {
    suggestions.push('📍 Uusi kenttäsijainti');
  }

  if (suggestions.length === 0) {
    return `Lisätään viesti ottelun tietoihin: "${message.length > 50 ? `${message.substring(0, 47)}...` : message}"`;
  }

  return `Päivitetään otteluun: ${suggestions.join(' • ')}`;
}

/**
 * Evaluates and ranks all existing events against a natural language message from best to weakest match.
 */
export function rankEventCandidatesForMessage(
  message: string,
  allEvents: MatchdayEvent[],
  profiles: PlayerProfile[]
): CandidateRankingResult {
  const norm = message.toLowerCase().trim();
  const detectedProfile = detectPlayerFromText(message, profiles);
  const detectedPlayerName = detectedProfile?.playerName;

  const targetDateStr = extractDateFromFinnishText(message);
  const times = extractTimesFromFinnishText(message);

  const activeEvents = allEvents.filter((e) => !e.isHidden);

  const scoredList: RankedEventCandidate[] = [];

  for (const event of activeEvents) {
    let score = 0;
    const reasons: string[] = [];
    const eventProfile = profiles.find((p) => p.id === event.profileId);
    const eventDateStr = event.startTime.split('T')[0];

    // 1. Player match (+35 points)
    if (detectedProfile && event.profileId === detectedProfile.id) {
      score += 35;
      reasons.push(`Pelaaja: ${detectedProfile.playerName}`);
    }

    // 2. Date match (+40 points for exact date, +15 for upcoming near match)
    if (targetDateStr && eventDateStr === targetDateStr) {
      score += 40;
      reasons.push(`Sama päivä (${new Date(event.startTime).toLocaleDateString('fi-FI', { weekday: 'short', day: 'numeric', month: 'numeric' })})`);
    } else if (!targetDateStr) {
      const diffDays = (new Date(event.startTime).getTime() - Date.now()) / (24 * 3600 * 1000);
      if (diffDays >= -0.5 && diffDays <= 7) {
        score += 15;
        reasons.push('Seuraava tuleva ottelu');
      }
    }

    // 3. Opponent / Team match (+20 points)
    const away = (event.awayTeam || '').toLowerCase();
    const home = (event.homeTeam || '').toLowerCase();
    if (away.length > 2 && norm.includes(away)) {
      score += 25;
      reasons.push(`Vastustaja: ${event.awayTeam}`);
    } else if (home.length > 2 && norm.includes(home) && home !== 'oma joukkue') {
      score += 20;
      reasons.push(`Joukkue: ${event.homeTeam}`);
    }

    // 4. Venue match (+15 points)
    const venueName = (event.venue.name || '').toLowerCase();
    if (venueName.length > 3 && norm.includes(venueName.split(' ')[0] || '')) {
      score += 15;
      reasons.push(`Kenttä: ${event.venue.name}`);
    }

    // 5. Time match (+10 points)
    if (times.kickoff) {
      const eventTimeStr = new Date(event.startTime).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
      if (eventTimeStr === times.kickoff) {
        score += 15;
        reasons.push(`Aloitusaika klo ${times.kickoff}`);
      }
    }

    // 6. Context keywords (kyyti, peli, harkat)
    if (norm.includes('peli') && !event.isTraining) {
      score += 5;
    } else if ((norm.includes('treenit') || norm.includes('harkat')) && event.isTraining) {
      score += 10;
    }

    if (score > 10) {
      const matchPercentage = Math.min(Math.round(score * 1.1), 98);
      scoredList.push({
        event,
        score,
        matchPercentage,
        matchReason: reasons.join(' • ') || 'Ajoittuu lähelle',
        suggestedActionText: generateSuggestedUpdateNarrative(message, event),
        profile: eventProfile
      });
    }
  }

  // Sort candidates from best to weakest
  scoredList.sort((a, b) => b.score - a.score);

  const topCandidate = scoredList[0];
  const isNewEventRecommended = !topCandidate || topCandidate.score < 30;

  return {
    detectedPlayerName,
    detectedProfile,
    candidates: scoredList,
    isNewEventRecommended,
    newEventPreviewTitle: norm.includes('treenit') ? 'Uudet harjoitukset' : 'Uusi ottelu'
  };
}
