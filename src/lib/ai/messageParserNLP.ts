import { SportType, EventType } from '../../types/matchday';
import { NATIONAL_FIELD_ALIASES } from '../geo/sportsGeocoder';

export interface ExtractedSportsEvent {
  title: string;
  eventType: EventType;
  sport: SportType;
  homeTeam: string;
  awayTeam: string;
  isHomeMatch: boolean;
  dateStr: string; // YYYY-MM-DD
  kickoffTime: string; // HH:mm
  warmupTime: string; // HH:mm
  endTime: string; // HH:mm
  venueHint: string;
  kitColor?: string;
  volunteerDuties: string[];
  rawNotes: string;
  confidenceScore: number;
}

/**
 * Normalizes Finnish text for token matching.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[,\.;:!\?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts dates from Finnish text (e.g. "24.8.", "24.8.2026", "lauantaina", "huomenna", "tänään", "su 15.9.").
 */
export function extractDateFromFinnishText(text: string, baseDate = new Date()): string {
  const now = new Date(baseDate);

  // Check for absolute dates: DD.MM. or DD.MM.YYYY
  const dateMatch = text.match(/\b(\d{1,2})\.(\d{1,2})\.(?:(\d{4})|(?!\d))/);
  if (dateMatch && dateMatch[1] && dateMatch[2]) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10) - 1;
    const year = dateMatch[3] ? parseInt(dateMatch[3], 10) : now.getFullYear();
    const d = new Date(year, month, day, 12, 0, 0);
    return d.toISOString().split('T')[0] || '2026-08-24';
  }

  // Check for relative words
  const norm = text.toLowerCase();
  if (norm.includes('tänään')) {
    return now.toISOString().split('T')[0] || '2026-08-24';
  }
  if (norm.includes('huomenna')) {
    const tmrw = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return tmrw.toISOString().split('T')[0] || '2026-08-25';
  }
  if (norm.includes('ylihuomenna')) {
    const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    return dayAfter.toISOString().split('T')[0] || '2026-08-26';
  }

  // Weekdays (ma, ti, ke, to, pe, la, su)
  const weekdays: Record<string, number> = {
    maanantai: 1,
    ma: 1,
    tiistai: 2,
    ti: 2,
    keskiviikko: 3,
    ke: 3,
    torstai: 4,
    to: 4,
    perjantai: 5,
    pe: 5,
    lauantai: 6,
    la: 6,
    sunnuntai: 0,
    su: 0
  };

  for (const [dayName, targetDay] of Object.entries(weekdays)) {
    const regex = new RegExp(`\\b${dayName}(?:na)?\\b`, 'i');
    if (regex.test(norm)) {
      const currentDay = now.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7; // Next occurrence
      const targetDate = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
      return targetDate.toISOString().split('T')[0] || '2026-08-24';
    }
  }

  // Default to today
  return now.toISOString().split('T')[0] || '2026-08-24';
}

/**
 * Extracts kickoff and warmup timestamps.
 */
export function extractTimesFromFinnishText(text: string): {
  kickoff: string;
  warmup: string;
  end: string;
} {
  const norm = text.toLowerCase();

  // Pattern: "kokoontuminen klo 14:15", "paikalla 14.15", "alkulämpö 14:15"
  let warmup = '';
  const warmupMatch = norm.match(
    /(?:kokoontuminen|paikalla|alkulämpö|kokoontua|saapuminen)\s*(?:klo|kello|klo:)?\s*(\d{1,2})[:.](\d{2})/i
  );
  if (warmupMatch && warmupMatch[1] && warmupMatch[2]) {
    const hh = warmupMatch[1].padStart(2, '0');
    const mm = warmupMatch[2];
    warmup = `${hh}:${mm}`;
  }

  // Pattern: "klo 15:00", "klo 15.00 - 16.30", "15:00 alkaen", "ottelu klo 15:00"
  let kickoff = '';
  let end = '';

  const rangeMatch = norm.match(
    /(?:klo|kello)?\s*(\d{1,2})[:.](\d{2})\s*(?:-|–|klo)?\s*(\d{1,2})[:.](\d{2})/i
  );
  if (rangeMatch && rangeMatch[1] && rangeMatch[2] && rangeMatch[3] && rangeMatch[4]) {
    const h1 = rangeMatch[1].padStart(2, '0');
    const m1 = rangeMatch[2];
    const h2 = rangeMatch[3].padStart(2, '0');
    const m2 = rangeMatch[4];
    kickoff = `${h1}:${m1}`;
    end = `${h2}:${m2}`;
  } else {
    const singleTimeMatch = norm.match(/(?:klo|kello|klo:)?\s*(\d{1,2})[:.](\d{2})/i);
    if (singleTimeMatch && singleTimeMatch[1] && singleTimeMatch[2]) {
      const hh = singleTimeMatch[1].padStart(2, '0');
      const mm = singleTimeMatch[2];
      kickoff = `${hh}:${mm}`;
    }
  }

  if (!kickoff) kickoff = '15:00';
  if (!end) {
    const [hStr = '15', mStr = '00'] = kickoff.split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    const endH = (h + 1).toString().padStart(2, '0');
    end = `${endH}:${m.toString().padStart(2, '0')}`;
  }

  if (!warmup) {
    const [hStr = '15', mStr = '00'] = kickoff.split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    let totalMins = h * 60 + m - 45;
    if (totalMins < 0) totalMins += 24 * 60;
    const wH = Math.floor(totalMins / 60).toString().padStart(2, '0');
    const wM = (totalMins % 60).toString().padStart(2, '0');
    warmup = `${wH}:${wM}`;
  }

  return { kickoff, warmup, end };
}

/**
 * Extracts Finnish pitch/venue names from message text.
 */
export function extractVenueFromFinnishText(text: string): string {
  const norm = normalizeText(text);

  // Check known pitch aliases sorted by length descending (e.g. "bollis 2" before "bollis")
  const sortedAliases = Object.keys(NATIONAL_FIELD_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    if (norm.includes(alias) && NATIONAL_FIELD_ALIASES[alias]?.name) {
      return NATIONAL_FIELD_ALIASES[alias].name;
    }
  }

  // Check common venue patterns: "Bollis 2 kentällä", "kentällä X", "@ X", "paikkana X", "Väiskillä", "Sahara tn"
  const venuePatterns = [
    /([a-zA-Z0-9äöåÄÖÅ\s-]{2,25})\s+(?:kentällä|kenttä|areenalla|areena|hallilla|halli|nurmella|nurmi|tekonurmella|tekonurmi)/i,
    /(?:kenttänä|kentällä|paikkana|pelipaikka|paikka|pelataan)\s*(?:on|:)?\s*([a-zA-Z0-9äöåÄÖÅ\s-]{3,30}?)(?:\s+(?:klo|lauantaina|sunnuntaina|kokoontuminen|$))/i,
    /@\s*([a-zA-Z0-9äöåÄÖÅ\s-]{3,25})/i,
    /([a-zA-Z0-9äöåÄÖÅ\s-]+(?:halli|areena|tekonurmi|nurmi|kenttä|tn|kupla|center))/i
  ];

  for (const pattern of venuePatterns) {
    const m = text.match(pattern);
    if (m && m[1]) {
      const cand = m[1].trim();
      if (cand.length > 2 && !cand.toLowerCase().includes('klo') && !cand.toLowerCase().includes('muistutus') && !cand.toLowerCase().includes('futistreenit')) {
        return cand;
      }
    }
  }

  return 'Töölön Pallokenttä 1 (Bollis)';
}

/**
 * Extracts volunteer duties from message text.
 */
export function extractVolunteerDutiesFromText(text: string): string[] {
  const duties: string[] = [];
  const lines = text.split(/\r?\n/);

  const dutyKeywords = [
    { key: 'kahvio', tag: '☕ Kahviovuoro' },
    { key: 'kahvila', tag: '☕ Kahviovuoro' },
    { key: 'kioski', tag: '☕ Kioskivuoro' },
    { key: 'toimitsija', tag: '⏱️ Toimitsijavuoro' },
    { key: 'kirjuri', tag: '📝 Kirjuri' },
    { key: 'kello', tag: '⏱️ Kellomies' },
    { key: 'järjestysmies', tag: '🦺 Järjestysmies' },
    { key: 'järkkäri', tag: '🦺 Järkkärivuoro' },
    { key: 'liivimies', tag: '🦺 Liivimies' },
    { key: 'makkara', tag: '🌭 Makkaranpaisto' },
    { key: 'grilli', tag: '🌭 Grillivuoro' },
    { key: 'kuvaus', tag: '📹 Kuvaus / Striimaus' },
    { key: 'striimi', tag: '📹 Kuvaus / Striimaus' },
    { key: 'kyyti', tag: '🚗 Kyytirinki' }
  ];

  for (const line of lines) {
    const norm = line.toLowerCase();
    for (const item of dutyKeywords) {
      if (norm.includes(item.key)) {
        // Extract names or times if on same line
        const cleaned = line.trim();
        if (cleaned.length < 80) {
          duties.push(`${item.tag}: ${cleaned}`);
        } else {
          duties.push(item.tag);
        }
        break;
      }
    }
  }

  return Array.from(new Set(duties));
}

/**
 * Extracts kit/peliasu color advice.
 */
export function extractKitColorFromText(text: string): string | undefined {
  const norm = text.toLowerCase();
  if (
    norm.includes('mustat pelipaidat') ||
    norm.includes('musta pelipaita') ||
    norm.includes('mustat paidat') ||
    norm.includes('musta paita') ||
    norm.includes('mustat asut')
  ) {
    return 'Musta peliasu (Vieraspaita)';
  }
  if (
    norm.includes('valkoiset pelipaidat') ||
    norm.includes('valkoinen pelipaita') ||
    norm.includes('valkoiset paidat') ||
    norm.includes('valkoinen paita') ||
    norm.includes('valkoiset asut')
  ) {
    return 'Valkoinen peliasu (Kakkospaita)';
  }
  if (
    norm.includes('siniset pelipaidat') ||
    norm.includes('sininen pelipaita') ||
    norm.includes('siniset paidat') ||
    norm.includes('sininen paita')
  ) {
    return 'Sininen peliasu (Kotipaita)';
  }
  if (norm.includes('keltainen pelipaita') || norm.includes('keltaiset paidat') || norm.includes('keltainen paita')) {
    return 'Keltainen peliasu';
  }
  if (norm.includes('vihreä pelipaita') || norm.includes('vihreät paidat') || norm.includes('vihreä paita')) {
    return 'Vihreä peliasu';
  }
  if (norm.includes('punainen pelipaita') || norm.includes('punaiset paidat') || norm.includes('punainen paita')) {
    return 'Punainen peliasu';
  }
  return undefined;
}

/**
 * Primary Parser: Extracts matchday event from raw message.
 */
export function parseFreeformSportsMessage(
  rawText: string,
  _defaultPlayer = 'Maija'
): ExtractedSportsEvent {
  const norm = normalizeText(rawText);

  // 1. Sport
  let sport: SportType = 'football';
  if (norm.includes('salibandy') || norm.includes('säbä') || norm.includes('floorball')) {
    sport = 'floorball';
  } else if (norm.includes('koripallo') || norm.includes('koris') || norm.includes('basket')) {
    sport = 'basketball';
  } else if (norm.includes('lentopallo') || norm.includes('lentis') || norm.includes('volley')) {
    sport = 'volleyball';
  } else if (norm.includes('jääkiekko') || norm.includes('lätkä') || norm.includes('hockey')) {
    sport = 'icehockey';
  } else if (norm.includes('futsal')) {
    sport = 'futsal';
  }

  // 2. Event Type
  let eventType: EventType = 'match';
  if (norm.includes('treenit') || norm.includes('harjoitukset') || norm.includes('fysiikka') || norm.includes('lajivuoro')) {
    eventType = 'training';
  } else if (norm.includes('turnaus') || norm.includes('turnausottelu') || norm.includes('pelitapahtuma')) {
    eventType = 'tournament';
  } else if (norm.includes('vanhempainilta') || norm.includes('palaveri')) {
    eventType = 'meeting';
  }

  // 3. Teams & Opponent
  let homeTeam = 'Oma joukkue';
  let awayTeam = 'Vastustaja';
  let isHomeMatch = true;

  const vsMatch = rawText.match(/\b([a-zA-ZäöåÄÖÅ]{2,}[a-zA-Z0-9äöåÄÖÅ\s-]*?)\s+(?:vs\.?|vastaan)\s+([a-zA-ZäöåÄÖÅ]{2,}[a-zA-Z0-9äöåÄÖÅ\s-]*)/i);
  if (vsMatch && vsMatch[1] && vsMatch[2]) {
    const candHome = vsMatch[1].trim();
    const candAway = vsMatch[2].trim();
    if (!candHome.toLowerCase().includes('klo') && !candAway.toLowerCase().includes('klo')) {
      homeTeam = candHome;
      awayTeam = candAway;
    }
  } else if (norm.includes('harkkapeli') || norm.includes('harjoitusottelu') || norm.includes('harjoituspeli')) {
    homeTeam = 'Oma joukkue';
    awayTeam = 'Harjoitusottelu';
  }

  // 4. Date & Times
  const dateStr = extractDateFromFinnishText(rawText);
  const times = extractTimesFromFinnishText(rawText);

  // 5. Venue
  const venueHint = extractVenueFromFinnishText(rawText);

  // 6. Duties & Kit
  const volunteerDuties = extractVolunteerDutiesFromText(rawText);
  const kitColor = extractKitColorFromText(rawText);

  const title =
    eventType === 'training'
      ? `Harjoitukset @ ${venueHint}`
      : awayTeam === 'Harjoitusottelu'
        ? `Harjoitusottelu @ ${venueHint}`
        : `${homeTeam} vs ${awayTeam}`;

  return {
    title,
    eventType,
    sport,
    homeTeam,
    awayTeam,
    isHomeMatch,
    dateStr,
    kickoffTime: times.kickoff,
    warmupTime: times.warmup,
    endTime: times.end,
    venueHint,
    kitColor,
    volunteerDuties,
    rawNotes: rawText.trim(),
    confidenceScore: 0.95
  };
}
