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
  if (/\b(?:tänään|tämän\s+päivän)\b/i.test(norm)) {
    return now.toISOString().split('T')[0] || '2026-08-24';
  }
  if (/\b(?:huomenna|huomisen|huomiseen|huomiselle)\b/i.test(norm)) {
    const tmrw = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return tmrw.toISOString().split('T')[0] || '2026-08-25';
  }
  if (/\b(?:ylihuomenna|ylihuomisen|ylihuomiseen)\b/i.test(norm)) {
    const dayAfter = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    return dayAfter.toISOString().split('T')[0] || '2026-08-26';
  }

  // Weekdays with inflections (-na, -n, -in, -lle, -ksi) and common typos
  const weekdayPatterns: Array<{ day: number; pattern: RegExp }> = [
    { day: 1, pattern: /\b(?:ma|maanantai(?:na|n|lle|ksi)?)\b/i },
    { day: 2, pattern: /\b(?:ti|tiistai(?:na|n|lle|ksi)?)\b/i },
    { day: 3, pattern: /\b(?:ke|keskiviikko(?:na|n|lle|ksi)?|keskiviikon|keskiviikona)\b/i },
    { day: 4, pattern: /\b(?:to|torstai(?:na|n|lle|ksi)?|torstain)\b/i },
    { day: 5, pattern: /\b(?:pe|perjantai(?:na|n|lle|ksi)?|perjatai(?:na|n|lle|ksi)?|perjatain?|perjantain)\b/i },
    { day: 6, pattern: /\b(?:la|lauantai(?:na|n|lle|ksi)?|lavantai(?:na|n)?|lauantain)\b/i },
    { day: 0, pattern: /\b(?:su|sunnuntai(?:na|n|lle|ksi)?|sunnustai(?:na|n)?|sunnuntain)\b/i }
  ];

  for (const { day: targetDay, pattern } of weekdayPatterns) {
    if (pattern.test(norm)) {
      const currentDay = now.getDay();
      let diff = targetDay - currentDay;
      if (diff <= 0) diff += 7; // Next occurrence
      const targetDate = new Date(now.getTime() + diff * 24 * 60 * 60 * 1000);
      return targetDate.toISOString().split('T')[0] || '2026-08-24';
    }
  }

  return '';
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

  if (!kickoff) {
    return { kickoff: '', warmup: warmup || '', end: end || '' };
  }
  if (!end) {
    const [hStr = '15', mStr = '00'] = kickoff.split(':');
    const h = Number(hStr);
    const m = Number(mStr);
    const endH = ((h + 1) % 24).toString().padStart(2, '0');
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

  // Check classroom / school room in school context only
  const isSchoolContext = /koe|oppitunti|koulu|wilma|matematiik|kotitalou|äidinkiel|opettaja|luokka|yMA/i.test(text);
  if (isSchoolContext) {
    const classMatch = text.match(/\b(?:luokassa|tilassa|salissa|luokka|tila)\s+([A-ZÄÖÅa-zäöå0-9-]{1,10})\b/i);
    if (classMatch && classMatch[1]) {
      const r = classMatch[1].trim();
      if (!r.toLowerCase().includes('klo') && !r.toLowerCase().includes('on') && !r.toLowerCase().includes('retk')) {
        return `Luokka ${r}`;
      }
    }
    const roomMatch = text.match(/\b([A-Z]\s*\d{1,3})\b/);
    if (roomMatch && roomMatch[1]) {
      return `Luokka ${roomMatch[1].replace(/\s+/g, ' ')}`;
    }
  }

  // Check common venue patterns: "Tapiola 2 kentällä", "Lauttasaaren peruskoululla", "@ Väiski"
  const venuePatterns = [
    /([a-zA-Z0-9äöåÄÖÅ\s-]{2,30})\s+(?:koululla|koulu|ruokalassa|ruokala|auditoriossa|auditorio|luokassa|opistolla|opisto)/i,
    /([a-zA-Z0-9äöåÄÖÅ\s-]{2,25})\s+(?:kentällä|kenttä|areenalla|areena|hallilla|halli|nurmella|nurmi|tekonurmella|tekonurmi|sali|liikuntasali)/i,
    /(?:kenttänä|kentällä|paikkana|pelipaikka|paikka|pelataan|tilassa)\s*(?:on|:)?\s*([a-zA-Z0-9äöåÄÖÅ\s-]{3,30}?)(?:\s+(?:klo|lauantaina|sunnuntaina|kokoontuminen|$))/i,
    /@\s*([a-zA-Z0-9äöåÄÖÅ\s-]{3,25}?)(?:\r?\n|$)/i,
    /\b([A-ZÄÖÅa-zäöå0-9-]+(?:\s+[A-ZÄÖÅa-zäöå0-9-]+){0,2}\s+(?:koulu|lukio|opisto|halli|areena|tekonurmi|nurmi|kenttä|tn|kupla|center|sali))\b/i
  ];

  for (const pattern of venuePatterns) {
    const m = text.match(pattern);
    if (m && m[1]) {
      let cand = m[1].trim();
      cand = cand.replace(/^(?:peli|ottelu|tapahtuma|sarjapeli|treenit|harjoitukset|matsi)\s+/i, '').trim();
      const lower = cand.toLowerCase();
      // Exclude false positives from non-venue Finnish words
      const isBogus =
        lower === 'peli' ||
        lower === 'ottelu' ||
        lower === 'harjoitukset' ||
        lower.includes('klo') ||
        lower.includes('muistutus') ||
        lower.includes('futistreenit') ||
        lower.includes('tiedonhallinta') ||
        lower.includes('hallinto') ||
        lower.includes('hallitus') ||
        lower.includes('kotitalous') ||
        lower.includes('matematiikka') ||
        lower.includes('koe');

      if (cand.length > 2 && !isBogus) {
        return cand;
      }
    }
  }

  return '';
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
 * Primary Parser: Extracts single primary matchday event from raw message.
 */
export function parseFreeformSportsMessage(
  rawText: string,
  defaultPlayer = 'Maija'
): ExtractedSportsEvent {
  const all = parseMultipleSportsMessages(rawText, defaultPlayer);
  return all[0] || parseSingleFreeformBlock(rawText, defaultPlayer);
}

/**
 * Extracts a match kickoff time from a line, ensuring dates like 24.8.2026 are not confused with times.
 */
function extractMatchTimeInLine(line: string): string | null {
  // Explicit klo 16:30 or klo 16.30
  const kloMatch = line.match(/\b(?:klo|kello)\s*([012]?\d)[:.]([0-5]\d)\b/i);
  if (kloMatch && kloMatch[1] && kloMatch[2]) {
    const hh = kloMatch[1].padStart(2, '0');
    return `${hh}:${kloMatch[2]}`;
  }

  // Colon time 16:30
  const colonMatch = line.match(/\b([012]?\d):([0-5]\d)\b/);
  if (colonMatch && colonMatch[1] && colonMatch[2]) {
    const hh = colonMatch[1].padStart(2, '0');
    return `${hh}:${colonMatch[2]}`;
  }

  // Dot time 16.30 (must be 06.00-23.59 and not part of a date like 24.8.2026)
  const dotMatch = line.match(/\b([012]?\d)\.([0-5]\d)(?!\.\d)\b/);
  if (dotMatch && dotMatch[1] && dotMatch[2]) {
    const hNum = parseInt(dotMatch[1], 10);
    if (hNum >= 6 && hNum <= 23 && !line.includes(`${dotMatch[1]}.${dotMatch[2]}.`)) {
      const hh = dotMatch[1].padStart(2, '0');
      return `${hh}:${dotMatch[2]}`;
    }
  }

  return null;
}

/**
 * Multi-Match Parser: Extracts multiple matchday events from weekend / tournament messages.
 */
export function parseMultipleSportsMessages(
  rawText: string,
  defaultPlayer = 'Maija'
): ExtractedSportsEvent[] {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) {
    return [parseSingleFreeformBlock(rawText, defaultPlayer)];
  }

  // Extract global context from whole text
  const globalDateHint = extractDateFromFinnishText(rawText);
  const globalVenueHint = extractVenueFromFinnishText(rawText);
  const globalVolunteerDuties = extractVolunteerDutiesFromText(rawText);
  const globalKitColor = extractKitColorFromText(rawText);

  // Find lines that represent individual matches
  const matchBlocks: Array<{ line: string; time: string; opponent?: string }> = [];

  for (const line of lines) {
    const isDutyOnly =
      /^(?:kahvio|toimitsija|kirjuri|järkkäri|kioski|grilli|makkara)/i.test(line) ||
      (/\b(?:kahviovuoro|toimitsijavuoro|kioskivuoro)\b/i.test(line) && !/\b(?:vs\.?|vastaan)\b/i.test(line));

    if (isDutyOnly) continue;

    const timeStr = extractMatchTimeInLine(line);
    const hasVs = /\b(?:vs\.?|vastaan)\s+([a-zA-ZäöåÄÖÅ0-9\s-]+)/i.exec(line);

    if (timeStr) {
      const isHeaderGreeting =
        /^(?:moi|hei|terve|muistutus|turnaus|lauantaina|sunnuntaina)/i.test(line) &&
        !hasVs &&
        line.length > 50;

      if (!isHeaderGreeting && (hasVs || /^(?:klo|\d{1,2}[:.]\d{2})/i.test(line))) {
        matchBlocks.push({
          line,
          time: timeStr,
          opponent: hasVs ? hasVs[1]?.trim() : undefined
        });
      }
    }
  }

  if (matchBlocks.length > 1) {
    const results: ExtractedSportsEvent[] = [];
    for (const match of matchBlocks) {
      const syntheticText = `${match.line}\n@ ${globalVenueHint}\n${globalDateHint}`;
      const parsed = parseSingleFreeformBlock(syntheticText, defaultPlayer);
      if (globalDateHint && parsed.dateStr === '2026-08-24') {
        parsed.dateStr = globalDateHint;
      }
      if (globalVenueHint && (!parsed.venueHint || parsed.venueHint === 'Töölön Pallokenttä 1 (Bollis)' || parsed.venueHint === globalDateHint)) {
        parsed.venueHint = globalVenueHint;
      }
      if (globalKitColor && !parsed.kitColor) {
        parsed.kitColor = globalKitColor;
      }
      if (globalVolunteerDuties.length > 0 && parsed.volunteerDuties.length === 0) {
        parsed.volunteerDuties = globalVolunteerDuties;
      }
      results.push(parsed);
    }
    return results;
  }

  return [parseSingleFreeformBlock(rawText, defaultPlayer)];
}

function parseSingleFreeformBlock(
  rawText: string,
  _defaultPlayer = 'Maija'
): ExtractedSportsEvent {
  const norm = normalizeText(rawText);

  // 1. Sport / Category
  let sport: SportType = 'football';
  let isSchool = false;
  let isOtherEvent = false;

  // Other appointment / hobby patterns (checked first to prioritize specific appointments over general subjects)
  const otherKeywords = [
    'hammaslääkäri', 'lääkäri', 'terveydenhoitaja', 'neuvola', 'fysioterapia', 'optikko',
    'soittotunti', 'pianotunti', 'kitaratunti', 'viulutunti', 'bänditreenit', 'kuoro', 'laulutunti',
    'musiikkiopisto', 'kuviskoulu', 'kuvataidekoulu', 'teatteri', 'sirkus',
    'tanssitunti', 'baletti', 'showtanssi', 'ratsastus', 'partio', 'partiokokous',
    'uimakoulu', 'synttärit', 'syntymäpäivä', 'kaverisynttärit', 'shakki', 'koodikerho'
  ];

  // School detection patterns
  const schoolKeywords = [
    'matematiikka', 'kotitalous', 'äidinkieli', 'suomen kieli', 'englanti', 'ruotsi',
    'fysiikka', 'kemia', 'biologia', 'maantieto', 'historia', 'yhteiskuntaoppi',
    'uskonto', 'elämänkatsomustieto', 'kuvataide', 'käsityö', 'musiikki', 'opinto-ohjaus',
    'tiedonhallinta', 'tiedonhallintataidot', 'tietotekniikka',
    'koe', 'kokeet', 'sanis', 'sanakoe', 'pistari', 'tentti', 'välikoe',
    'oppitunti', 'koulupäivä', 'lukujärjestys', 'wilma', 'läksyt', 'luokassa', 'koululla',
    'kouluretki', 'luokkaretki', 'leirikoulu', 'taksvärkki', 'tet-harjoittelu', 'tet',
    'päiväkoti', 'eskari', 'esikoulu', 'varhaiskasvatus', 'iltapäiväkerho'
  ];

  if (otherKeywords.some((k) => norm.includes(k))) {
    sport = 'other';
    isOtherEvent = true;
  } else if (schoolKeywords.some((k) => norm.includes(k)) || /\byMA\d|\bÄI\d|\bENA\d|\bRUB\d|\bFY\d|\bKE\d/i.test(rawText)) {
    sport = 'school';
    isSchool = true;
  } else if (norm.includes('salibandy') || norm.includes('säbä') || norm.includes('floorball')) {
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
  let customTitle = '';

  if (isSchool) {
    eventType = 'school';
    // Build descriptive title from school subjects/exam
    const detectedSubjects: string[] = [];
    if (/matematiikka|yma/i.test(rawText)) detectedSubjects.push('Matematiikka');
    if (/kotitalou/i.test(rawText)) detectedSubjects.push('Kotitalous');
    if (/äidinkiel/i.test(rawText)) detectedSubjects.push('Äidinkieli');
    if (/englann|ena/i.test(rawText)) detectedSubjects.push('Englanti');
    if (/ruotsi|rub/i.test(rawText)) detectedSubjects.push('Ruotsi');
    if (/fysiik/i.test(rawText)) detectedSubjects.push('Fysiikka');
    if (/kemia/i.test(rawText)) detectedSubjects.push('Kemia');
    if (/biologi/i.test(rawText)) detectedSubjects.push('Biologia');
    if (/maantie/i.test(rawText)) detectedSubjects.push('Maantieto');
    if (/historia/i.test(rawText)) detectedSubjects.push('Historia');
    if (/uskonto/i.test(rawText)) detectedSubjects.push('Uskonto');
    if (/kuvataide|kuvis/i.test(rawText)) detectedSubjects.push('Kuvataide');
    if (/käsityö/i.test(rawText)) detectedSubjects.push('Käsityö');
    if (/musiikki/i.test(rawText)) detectedSubjects.push('Musiikki');
    if (/tiedonhallinta/i.test(rawText)) detectedSubjects.push('Tiedonhallinta');

    const isExam = /\b(?:koe|kokeet|sanis|tentti|välikoe)\b/i.test(rawText);
    if (detectedSubjects.length > 0) {
      customTitle = `${detectedSubjects.join(' & ')}${isExam ? ' (Koe)' : ''}`;
    } else if (isExam) {
      customTitle = 'Koulukoe';
    } else if (norm.includes('vanhempainilta')) {
      eventType = 'meeting';
      customTitle = 'Vanhempainilta';
    } else if (norm.includes('kehityskeskustelu')) {
      eventType = 'meeting';
      customTitle = 'Kehityskeskustelu';
    } else if (norm.includes('retki')) {
      customTitle = 'Kouluretki';
    } else {
      customTitle = 'Koulupäivä / Oppitunti';
    }
  } else if (isOtherEvent) {
    eventType = 'other';
    if (norm.includes('hammaslääkäri')) customTitle = 'Hammaslääkäri';
    else if (norm.includes('lääkäri')) customTitle = 'Lääkäriaika';
    else if (norm.includes('neuvola')) customTitle = 'Neuvola';
    else if (norm.includes('synttärit') || norm.includes('syntymäpäivä')) customTitle = 'Synttärit';
    else if (norm.includes('pianotunti')) customTitle = 'Pianotunti';
    else if (norm.includes('kitaratunti')) customTitle = 'Kitaratunti';
    else if (norm.includes('soittotunti')) customTitle = 'Soittotunti';
    else if (norm.includes('bändi')) customTitle = 'Bänditreenit';
    else if (norm.includes('kuoro')) customTitle = 'Kuoroharjoitukset';
    else if (norm.includes('partio')) customTitle = 'Partio';
    else if (norm.includes('sirkus')) customTitle = 'Sirkusharjoitukset';
    else if (norm.includes('tanssi') || norm.includes('baletti')) customTitle = 'Tanssitunti';
    else if (norm.includes('ratsastus')) customTitle = 'Ratsastustunti';
    else if (norm.includes('uimakoulu') || norm.includes('uinti')) customTitle = 'Uimakoulu / Uinti';
    else customTitle = 'Muu meno';
  } else if (norm.includes('treenit') || norm.includes('harjoitukset') || norm.includes('fysiikka') || norm.includes('lajivuoro')) {
    eventType = 'training';
  } else if (norm.includes('turnaus') || norm.includes('turnausottelu') || norm.includes('pelitapahtuma')) {
    eventType = 'tournament';
  } else if (norm.includes('vanhempainilta')) {
    eventType = 'meeting';
    customTitle = 'Vanhempainilta';
    sport = 'school';
  } else if (norm.includes('kehityskeskustelu')) {
    eventType = 'meeting';
    customTitle = 'Kehityskeskustelu';
    sport = 'school';
  } else if (norm.includes('konsertti') || norm.includes('esiintyminen')) {
    eventType = 'meeting';
    customTitle = 'Konsertti / Esiintyminen';
    sport = 'other';
  } else if (norm.includes('juhla') || norm.includes('kevätjuhla') || norm.includes('joulujuhla')) {
    eventType = 'meeting';
    customTitle = 'Koulun juhla';
    sport = 'school';
  } else if (norm.includes('palaveri') || norm.includes('kokous')) {
    eventType = 'meeting';
    customTitle = 'Kokous';
    sport = 'other';
  }

  // 3. Teams & Opponent
  let homeTeam = isSchool || isOtherEvent ? '' : 'Oma joukkue';
  let awayTeam = isSchool || isOtherEvent ? '' : 'Vastustaja';
  let isHomeMatch = true;
  if (!isSchool && !isOtherEvent) {
    if (/\bvieras(?:peli|ottelu)?\b|\baway\b/.test(norm) || /\s@\s/.test(rawText)) {
      isHomeMatch = false;
    }

    const vsLine = rawText.split(/\r?\n/).find((l) => /\b(?:vs\.?|vastaan)\b/i.test(l));
    if (vsLine) {
      const parts = vsLine.split(/\b(?:vs\.?|vastaan)\b/i);
      if (parts[0] && parts[1]) {
        let candHome = parts[0].trim();
        for (let i = 0; i < 3; i++) {
          candHome = candHome
            .replace(/^(?:tapahtuma|sarjapeli|ottelu|peli|matsi|harjoituspeli|harkkapeli|turnaus|\b(?:la|su|pe|ma|ti|ke|to)\b|klo|kello)[:\s-]+/i, '')
            .trim();
        }
        let candAway = parts[1]
          .replace(/\s+(?:klo|alkaa|kentällä|@|paikalla|kokoontuminen).*$/i, '')
          .trim();

        if (candHome && !candHome.toLowerCase().includes('klo') && !/^\d{1,2}[:.]\d{2}$/.test(candHome) && candHome.length >= 2) {
          homeTeam = candHome;
        }
        if (candAway && !candAway.toLowerCase().includes('klo') && candAway.length >= 2) {
          awayTeam = candAway;
        }
      }
    } else if (norm.includes('harkkapeli') || norm.includes('harjoitusottelu') || norm.includes('harjoituspeli')) {
      homeTeam = 'Oma joukkue';
      awayTeam = 'Harjoitusottelu';
    }
  }

  // 4. Date & Times
  const dateStr = extractDateFromFinnishText(rawText);
  const times = extractTimesFromFinnishText(rawText);

  // For school and non-sport events, warmupTime defaults to kickoffTime (no 45min warmup)
  if (isSchool || isOtherEvent || eventType === 'meeting') {
    times.warmup = times.kickoff;
  }

  // 5. Venue
  const venueHint = extractVenueFromFinnishText(rawText);

  // 6. Duties & Kit
  const volunteerDuties = extractVolunteerDutiesFromText(rawText);
  const kitColor = extractKitColorFromText(rawText);

  let title = '';
  if (customTitle) {
    title = venueHint ? `${customTitle} @ ${venueHint}` : customTitle;
  } else if (eventType === 'training') {
    title = `Harjoitukset @ ${venueHint || 'kenttä ilmoitetaan'}`;
  } else if (eventType === 'meeting') {
    title = `${customTitle || 'Koulun tilaisuus'} @ ${venueHint || 'koulu'}`;
  } else if (awayTeam === 'Harjoitusottelu') {
    title = `Harjoitusottelu @ ${venueHint || 'kenttä ilmoitetaan'}`;
  } else {
    title = `${homeTeam} vs ${awayTeam}`;
  }

  let confidenceScore = 0.15;
  if (dateStr) confidenceScore += 0.3;
  if (times.kickoff) confidenceScore += 0.25;
  if (isSchool || isOtherEvent) {
    confidenceScore += 0.25;
  } else if (awayTeam !== 'Vastustaja' && homeTeam !== 'Oma joukkue') {
    confidenceScore += 0.25;
  } else if (eventType === 'training' && (venueHint || times.kickoff)) {
    confidenceScore += 0.2;
  } else if (eventType === 'meeting' && (venueHint || times.kickoff)) {
    confidenceScore += 0.3;
  }
  if (venueHint) confidenceScore += 0.1;
  if (confidenceScore > 0.98) confidenceScore = 0.98;

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
    confidenceScore
  };
}
