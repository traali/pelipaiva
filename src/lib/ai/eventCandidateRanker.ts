import type { MatchdayEvent, PlayerProfile, SportType } from '../../types/matchday';
import { extractDateFromFinnishText, extractTimesFromFinnishText } from './messageParserNLP';
import { eventDayKey } from '../agents/time';
import { sportLabelFi } from '../sport/sportMeta';

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
  detectedSport?: SportType;
  candidates: RankedEventCandidate[];
  isNewEventRecommended: boolean;
  newEventPreviewTitle: string;
}

/**
 * Detects the sport from text keywords.
 */
export function detectSportFromText(text: string): SportType | undefined {
  if (!text || typeof text !== 'string') return undefined;
  const lowered = text.toLowerCase();
  // School *venue* locatives ("säbätreenit koululla", "koulun salissa") describe
  // where a sport happens, not a school event. Strip them for the primary
  // classification and only use them as a last-resort school signal below.
  const SCHOOL_VENUE_LOCATIVE = /(?:^|[^a-zäöå0-9])[a-zäöå0-9_-]*koulu(?:lla|ssa|lle|lta|n)(?=$|[^a-zäöå0-9])/gi;
  const hasSchoolVenueLocative = new RegExp(SCHOOL_VENUE_LOCATIVE.source, 'i').test(lowered);
  const norm = lowered.replace(SCHOOL_VENUE_LOCATIVE, ' ');

  // 1. School (Wilma, exams, classes, school subjects, daycare)
  if (
    norm.includes('wilma') ||
    norm.includes('oppitunti') ||
    norm.includes('läksyt') ||
    norm.includes('koulupäivä') ||
    norm.includes('koulukuvaus') ||
    norm.includes('vanhempainvartti') ||
    norm.includes('todistusten jako') ||
    norm.includes('todistustenjako') ||
    norm.includes('laboratoriotyö') ||
    norm.includes('labratyö') ||
    /\b(?:yMA|MAA|MAB|ÄI|ENA|RUB|FY|KE|BI|GE|HI|YH|UE|ET|FF|PS|TE)\d{1,2}\b/i.test(text) ||
    /(?:^|[^a-zäöå0-9_-])(?:[a-zäöå0-9_-]*(?:koe|kokeet|kokeen|kokeita|kokeisiin|kokeessa)|koeviik[a-zäöå0-9_]*|koepäiv[a-zäöå0-9_]*|koetilaisuus[a-zäöå0-9_]*)(?:$|[^a-zäöå0-9])/i.test(norm) ||
    /(?:^|[^a-zäöå0-9])(?:oppitunti[a-zäöå0-9_]*|koulutunti[a-zäöå0-9_]*|kaksoistunti[a-zäöå0-9_]*|tukitunti[a-zäöå0-9_]*|tukiopetus[a-zäöå0-9_]*|palkkitunti[a-zäöå0-9_]*)(?:$|[^a-zäöå0-9])/i.test(norm) ||
    /(?:ruotsin?|englannin?|äidinkiel[a-zäöå0-9_]*|suomen?|saksan?|ranskan?|espanjan?|venäjän?|matemat[a-zäöå0-9_]*|matikan?|fysiik[a-zäöå0-9_]*|kemian?|biologian?|maantied[a-zäöå0-9_]*|historian?|yhteiskuntaop[a-zäöå0-9_]*|uskonnon?|elämänkatsomus[a-zäöå0-9_]*|filosofian?|psykologian?|terveystied[a-zäöå0-9_]*|kotitalou[a-zäöå0-9_]*|köksän?|käsityö[a-zäöå0-9_]*|kässä[a-zäöå0-9_]*|kuvataite[a-zäöå0-9_]*|kuvis[a-zäöå0-9_]*|musiikin?|liikunnan?)\s+(?:oppi)?tunti[a-zäöå0-9_]*/i.test(norm) ||
    /(?:ruotsin|englannin|äidinkielen|matikan|fysiikan|kemian|biologian|historian|kuvis|köksä|kässä|musiikin|liikunta)tunti[a-zäöå0-9_]*/i.test(norm) ||
    /(?:^|[^a-zäöå0-9])(?:koulu[a-zäöå0-9_]*|koululla|koulussa|koulun|luokka|luokassa|opettaja[a-zäöå0-9_]*|rehtori[a-zäöå0-9_]*|matematiikka|kotitalous|äidinkieli|ruotsi|englanti|fysiikka|kemia|historia|uskonto|tiedonhallinta|luokkaretki[a-zäöå0-9_]*|kouluretki[a-zäöå0-9_]*|leirikoulu[a-zäöå0-9_]*|esikoulu[a-zäöå0-9_]*|eskari[a-zäöå0-9_]*|päiväkoti[a-zäöå0-9_]*|iltapäiväkerho[a-zäöå0-9_]*|ip-kerho[a-zäöå0-9_]*|kehityskeskustelu[a-zäöå0-9_]*|vanhempainilta[a-zäöå0-9_]*|päättäjäiset[a-zäöå0-9_]*|kevätjuhla[a-zäöå0-9_]*|joulujuhla[a-zäöå0-9_]*|syysjuhla[a-zäöå0-9_]*|lakkiaiset[a-zäöå0-9_]*|penkkarit[a-zäöå0-9_]*|vanhojentanssit[a-zäöå0-9_]*|kotitehtäv[a-zäöå0-9_]*)(?:$|[^a-zäöå0-9])/i.test(norm)
  ) {
    return 'school';
  }

  // 2. Other non-sport / personal appointments
  if (
    /(?:^|[^a-zäöå0-9])(?:hammaslääkäri[a-zäöå0-9_]*|lääkäri[a-zäöå0-9_]*|neuvola[a-zäöå0-9_]*|terveydenhoitaja[a-zäöå0-9_]*|optikko[a-zäöå0-9_]*|partio[a-zäöå0-9_]*|soittotunti[a-zäöå0-9_]*|pianotunti[a-zäöå0-9_]*|kitaratunti[a-zäöå0-9_]*|viulutunti[a-zäöå0-9_]*|bänditreeni[a-zäöå0-9_]*|kuoro[a-zäöå0-9_]*|synttäri[a-zäöå0-9_]*|syntymäpäivä[a-zäöå0-9_]*|kerho[a-zäöå0-9_]*|sirkus[a-zäöå0-9_]*|tanssitunti[a-zäöå0-9_]*|baletti[a-zäöå0-9_]*|ratsastus[a-zäöå0-9_]*|uimakoulu[a-zäöå0-9_]*|muskari[a-zäöå0-9_]*|elokuvat|teatteri[a-zäöå0-9_]*)(?:$|[^a-zäöå0-9])/i.test(norm) ||
    norm.includes('hammaslääkäri') ||
    norm.includes('pianotunti') ||
    norm.includes('soittotunti') ||
    norm.includes('syntymäpäivä') ||
    norm.includes('partio')
  ) {
    return 'other';
  }

  // 3. Futsal (check before football because Palloliitto organizes both)
  if (
    /(?:^|[^a-zäöå0-9])(?:futsal[a-zäöå0-9_]*|kady|gft|mad max|akaa futsal|ilves fs|vieska futsal|sovo|riemu)(?:$|[^a-zäöå0-9])/i.test(norm) ||
    norm.includes('futsal')
  ) {
    return 'futsal';
  }

  // 4. Floorball (Salibandy / Säbä)
  if (
    /(?:^|[^a-zäöå0-9])(?:salibandy[a-zäöå0-9_]*|säbä[a-zäöå0-9_]*|sähly[a-zäöå0-9_]*|floorball[a-zäöå0-9_]*|reikäpallo[a-zäöå0-9_]*|suojalasit|fliiga|f-liiga|indians|westend indians|ervii|eräviikingit|tiikerit|hawks|blackbirds|oilers|classic|spv|nokian krp)(?:$|[^a-zäöå0-9])/i.test(norm) ||
    norm.includes('salibandy') ||
    norm.includes('säbä') ||
    norm.includes('sähly')
  ) {
    return 'floorball';
  }

  // 5. Basketball (Koripallo / Koris)
  if (
    /(?:^|[^a-zäöå0-9])(?:koripallo[a-zäöå0-9_]*|koris[a-zäöå0-9_]*|basket[a-zäöå0-9_]*|donkki[a-zäöå0-9_]*|korisliiga|topo|topola|torpan pojat|hnmky|namika|honka basket|tapiolan honka|wartti|puhu|pantterit|lepy|tikka basket|toppari)(?:$|[^a-zäöå0-9])/i.test(norm) ||
    norm.includes('koripallo') ||
    norm.includes('koris')
  ) {
    return 'basketball';
  }

  // 6. Volleyball (Lentopallo / Lentis)
  if (
    /(?:^|[^a-zäöå0-9])(?:lentopallo[a-zäöå0-9_]*|lentis[a-zäöå0-9_]*|volley[a-zäöå0-9_]*|hihalyönti[a-zäöå0-9_]*|sormilyönti[a-zäöå0-9_]*|mestaruusliiga|puijo|puijo wolley|valepa|lp viesti|puma-volley|hurrikaani|akaa-volley|vampula|vaasan kiisto)(?:$|[^a-zäöå0-9])/i.test(norm) ||
    norm.includes('lentopallo') ||
    norm.includes('lentis')
  ) {
    return 'volleyball';
  }

  // 7. Ice Hockey (Jääkiekko / Lätkä)
  if (
    /(?:^|[^a-zäöå0-9])(?:jääkiekko[a-zäöå0-9_]*|lätkä[a-zäöå0-9_]*|kiekko[a-zäöå0-9_]*|hockey[a-zäöå0-9_]*|luistimet|luistelu[a-zäöå0-9_]*|kaulasuoja[a-zäöå0-9_]*|jäähalli[a-zäöå0-9_]*|kaukalo[a-zäöå0-9_]*|tekojää[a-zäöå0-9_]*|aamujää[a-zäöå0-9_]*|jäätreeni[a-zäöå0-9_]*|leijonat|hifk|jokerit|tappara|kiekko-espoo|kärpät|lukko|ässät|kalpa|pelicans|saipa|jyp|hpk|kookoo|jukurit|mestis|sm-liiga)(?:$|[^a-zäöå0-9])/i.test(norm) ||
    norm.includes('jääkiekko') ||
    norm.includes('lätkä') ||
    norm.includes('jäähalli')
  ) {
    return 'icehockey';
  }

  // 8. Football (Jalkapallo / Futis)
  if (
    /(?:^|[^a-zäöå0-9])(?:jalkapallo[a-zäöå0-9_]*|futis[a-zäöå0-9_]*|nappikset[a-zäöå0-9_]*|säärisuojat[a-zäöå0-9_]*|viheriö|nurmi|tekonurmi|bollis|spl|ppj|pallo-pojat|hjk|honka|vjs|pk-35|gnistan|käpa|fcfj|eps|ebk|palloliitto|piirisarja|veikkausliiga|ykkösliiga|ykkönen|11vs11|8vs8|5vs5)(?:$|[^a-zäöå0-9])/i.test(norm) ||
    norm.includes('jalkapallo') ||
    norm.includes('futis')
  ) {
    return 'football';
  }

  // 9. Training (General conditioning / Gym / Physical workout)
  if (
    /(?:^|[^a-zäöå0-9])(?:fysiikkatreeni[a-zäöå0-9_]*|fysiikka[a-zäöå0-9_]*|kuntosali[a-zäöå0-9_]*|punttisali[a-zäöå0-9_]*|puntti[a-zäöå0-9_]*|juoksutreeni[a-zäöå0-9_]*|juoksulenkki[a-zäöå0-9_]*|oheisharjoitus[a-zäöå0-9_]*|oheistreeni[a-zäöå0-9_]*|oheiset|kehonhuolto[a-zäöå0-9_]*|venyttely[a-zäöå0-9_]*|kuntopiiri[a-zäöå0-9_]*|lenkki[a-zäöå0-9_]*|lenkille)(?:$|[^a-zäöå0-9])/i.test(norm) ||
    norm.includes('fysiikkatreenit') ||
    norm.includes('kuntosali') ||
    norm.includes('punttisali') ||
    norm.includes('oheisharjoitus')
  ) {
    return 'training';
  }

  // 10. Last resort: a bare school venue ("Juhla koululla") is still a school event
  if (hasSchoolVenueLocative) {
    return 'school';
  }

  return undefined;
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
  const detectedSport = detectSportFromText(message);

  const targetDateStr = extractDateFromFinnishText(message);
  const times = extractTimesFromFinnishText(message);

  const activeEvents = allEvents.filter((e) => !e.isHidden);

  const scoredList: RankedEventCandidate[] = [];

  for (const event of activeEvents) {
    let score = 0;
    const reasons: string[] = [];
    const eventProfile = profiles.find((p) => p.id === event.profileId);
    const eventDateStr = eventDayKey(event.startTime);

    // 1. Player match (+35 points)
    if (detectedProfile && event.profileId === detectedProfile.id) {
      score += 35;
      reasons.push(`Pelaaja: ${detectedProfile.playerName}`);
    }

    // 1.5 Sport match (+25 points if match, -35 points penalty if explicit mismatch)
    if (detectedSport) {
      if (event.sport === detectedSport) {
        score += 25;
        reasons.push(`Laji: ${sportLabelFi(event.sport)}`);
      } else {
        score -= 35;
      }
    } else if (eventProfile?.sport && event.sport === eventProfile.sport) {
      score += 5;
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
    detectedSport,
    candidates: scoredList,
    isNewEventRecommended,
    newEventPreviewTitle: norm.includes('treenit') ? 'Uudet harjoitukset' : 'Uusi ottelu'
  };
}
