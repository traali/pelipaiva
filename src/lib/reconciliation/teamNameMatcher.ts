/**
 * Multilingual color map: maps Finnish, Swedish, English variations to canonical Finnish tokens.
 */
export const MULTILINGUAL_COLORS: Record<string, string> = {
  // Blue
  sininen: 'sininen',
  blå: 'sininen',
  blue: 'sininen',
  sin: 'sininen',

  // White
  valkoinen: 'valkoinen',
  vit: 'valkoinen',
  white: 'valkoinen',
  valk: 'valkoinen',

  // Black
  musta: 'musta',
  svart: 'musta',
  black: 'musta',
  mus: 'musta',

  // Red
  punainen: 'punainen',
  röd: 'punainen',
  red: 'punainen',
  pun: 'punainen',

  // Yellow
  keltainen: 'keltainen',
  gul: 'keltainen',
  yellow: 'keltainen',
  kelt: 'keltainen',

  // Green
  vihreä: 'vihreä',
  grön: 'vihreä',
  green: 'vihreä',
  vihr: 'vihreä',

  // Orange
  oranssi: 'oranssi',
  orange: 'oranssi',
  ora: 'oranssi',
  or: 'oranssi',

  // Striped
  raita: 'raita',
  randig: 'raita',
  striped: 'raita'
};

/**
 * Curated club alias mappings.
 */
export const CLUB_ALIASES: Record<string, string[]> = {
  hjk: ['helsingin jalkapalloklubi', 'klubi', 'hjk ry', 'hjk helsinki'],
  käpa: ['käpylän pallo', 'kapa', 'käpa ry'],
  grifk: ['grankulla ifk', 'grani', 'ifk grankulla'],
  ervi: ['eräviikingit', 'eräviikingit ry', 'eraviikingit', 'erä viikingit'],
  tips: ['tikkurilan palloseura', 'tips ry'],
  vjs: ['vantaan jalkapalloseura', 'vjs ry'],
  honka: ['fc honka', 'tapiolan honka', 'honka ry'],
  ilves: ['tampereen ilves', 'ilves ry', 'ilves jalkapallo', 'ilves salibandy'],
  tps: ['turun palloseura', 'tps ry', 'tps salibandy', 'tps jalkapallo'],
  eps: ['espoon palloseura', 'eps ry', 'espoon seura', 'espoon pallo seura'],
  ppj: ['pallo-pojat juniorit', 'ppj ry', 'pallopojat'],
  hps: ['helsingin palloseura', 'hps ry'],
  hifk: ['idrottsföreningen kamraterna i helsingfors', 'hifk rf', 'ifk helsingfors', 'röda', 'hifk'],
  gnistan: ['if gnistan', 'gnistan ry', 'kipinä'],
  'pk-35': ['pallokerho-35', 'pk 35', 'pk35', 'pk-35'],
  pk35: ['pallokerho-35', 'pk 35', 'pk35', 'pk-35'],
  'åifk': ['åbo ifk', 'abo ifk', 'aifk', 'åifk'],
  aifk: ['åbo ifk', 'abo ifk', 'aifk', 'åifk'],
  oilers: ['esport oilers', 'oilers salibandy'],
  classic: ['salibandy club classic', 'sc classic'],
  indians: ['westend indians', 'heimo'],
  spv: ['seinäjoen peliveljet', 'spv salibandy'],
  hnmky: ['helsingin nmky', 'namika'],
  topo: ['torpan pojat', 'topo ry'],
  puhu: ['puhu juniorit', 'pussihukat'],
  ktp: ['kotkan työväen palloilijat', 'ktp basket', 'ktp ry'],
  puma: ['puma volley', 'puma-volley', 'puma volley n2', 'puma ry']
};

/**
 * Normalizes club name against alias dictionary.
 */
export function getCanonicalClub(rawClub: string): string {
  const lower = rawClub.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(CLUB_ALIASES)) {
    if (lower === canonical || aliases.includes(lower)) {
      return canonical;
    }
  }
  return lower;
}

export interface NormalizedTeamResult {
  club: string;
  squad: string;
  ageGroup: string;
  color: string;
  normalized: string;
}

export class NormalizedTeamName extends Array<string> implements NormalizedTeamResult {
  club: string = '';
  squad: string = '';
  ageGroup: string = '';
  color: string = '';
  normalized: string = '';

  constructor(normalized: string, club: string, squad: string, ageGroup: string, color: string) {
    super();
    this.normalized = normalized;
    this.club = club;
    this.squad = squad;
    this.ageGroup = ageGroup;
    this.color = color;

    const tokens = new Set<string>();
    const addToken = (str?: string) => {
      if (!str) return;
      tokens.add(str);
      tokens.add(str.toLowerCase());
      tokens.add(str.replace(/[-\s]/g, '').toLowerCase());
      tokens.add(str.replace(/-/g, ' ').toLowerCase());
      const transliterated = str
        .toLowerCase()
        .replace(/å/g, 'a')
        .replace(/ä/g, 'a')
        .replace(/ö/g, 'o');
      tokens.add(transliterated);
      tokens.add(transliterated.replace(/[-\s]/g, ''));
      tokens.add(transliterated.replace(/-/g, ' '));
      for (const t of str.split(/[-\s]/)) {
        if (t) {
          tokens.add(t.toLowerCase());
          tokens.add(t.toLowerCase().replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o'));
        }
      }
    };

    addToken(normalized);
    addToken(club);
    addToken(squad);
    addToken(ageGroup);
    addToken(color);

    this.push(...tokens);
  }

  toString(): string {
    return this.normalized;
  }
}

/**
 * Parses and normalizes a team name into club, age group, squad/level, and color.
 */
export function normalizeTeamName(rawName: string): NormalizedTeamName {
  if (!rawName) {
    return new NormalizedTeamName('', '', '', '', '');
  }

  let text = rawName
    .toLowerCase()
    .replace(/[._\-\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract color using token boundary
  let matchedColor = '';
  for (const [token, canonical] of Object.entries(MULTILINGUAL_COLORS)) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, 'i');
    if (regex.test(text)) {
      matchedColor = canonical;
      text = text.replace(regex, ' ').replace(/\s+/g, ' ').trim();
      break;
    }
  }

  // Extract Age Group: e.g. T13, P11, F08, U14, B-pojat, C-tytöt
  let matchedAge = '';
  const ageMatch = text.match(/(?:^|\s)([tpfu]\s*\d{1,2}|b\s*pojat|c\s*tytöt|a\s*pojat)(?:$|\s)/i);
  if (ageMatch && ageMatch[1]) {
    matchedAge = ageMatch[1].replace(/\s+/g, '').toUpperCase();
    text = text.replace(ageMatch[1], ' ').replace(/\s+/g, ' ').trim();
  }

  // Extract 4-digit birth year: e.g. 2013, 2014, 2015, 2012
  const yearMatch = text.match(/(?:^|\s)(200\d|201\d|202\d|199\d)(?:$|\s)/);
  if (yearMatch && yearMatch[1]) {
    if (!matchedAge) {
      matchedAge = `P${yearMatch[1].slice(2)}`;
    }
    text = text.replace(yearMatch[1], ' ').replace(/\s+/g, ' ').trim();
  }

  // Extract Squad Level / District: Kilpa, Haaste, Harraste, Akatemia, Edustus, Laru, Töölö, Eira, Väke, Jätkäsaari, United, 1, 2, etc.
  let matchedSquad = '';
  const squadMatch = text.match(/(?:^|\s)(kilpa|haaste|harraste|akatemia|edustus|green|white|black|blue|red|laru|lauttasaari|töölö|eira|väke|jätkäsaari|kantsu|malmi|united|city|1|2|3)(?:$|\s)/i);
  if (squadMatch && squadMatch[1]) {
    matchedSquad = squadMatch[1].toLowerCase();
    text = text.replace(squadMatch[1], ' ').replace(/\s+/g, ' ').trim();
  }

  // Check known club prefixes from remaining text
  let canonicalClub = '';
  const trimmed = text.replace(/\s+/g, ' ').trim();

  // Direct alias check first
  const directClub = getCanonicalClub(trimmed);
  if (directClub && directClub !== trimmed) {
    canonicalClub = directClub;
  } else {
    // Prefix scan against known club keys
    for (const clubKey of Object.keys(CLUB_ALIASES)) {
      const aliases = [clubKey, ...(CLUB_ALIASES[clubKey] || [])];
      for (const alias of aliases) {
        const lowerAlias = alias.toLowerCase();
        if (trimmed === lowerAlias || trimmed.startsWith(lowerAlias + ' ') || trimmed.endsWith(' ' + lowerAlias)) {
          canonicalClub = clubKey;
          break;
        }
      }
      if (canonicalClub) break;
    }
    if (!canonicalClub) {
      canonicalClub = directClub || trimmed;
    }
  }

  // Build unified normalized string
  const parts = [canonicalClub, matchedAge, matchedSquad, matchedColor].filter(Boolean);
  const normalized = parts.join(' ').trim() || text || rawName.trim().toLowerCase();

  return new NormalizedTeamName(
    normalized,
    canonicalClub,
    matchedSquad,
    matchedAge,
    matchedColor
  );
}

/**
 * Calculates string Dice / Sørensen similarity coefficient for bigrams.
 */
function diceCoefficient(strA: string, strB: string): number {
  if (strA === strB) return 1.0;
  if (!strA || !strB) return 0.0;
  if (strA.length < 2 || strB.length < 2) return strA === strB ? 1.0 : 0.0;

  const getBigrams = (str: string) => {
    const s = str.toLowerCase();
    const bigrams = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bigram = s.substring(i, i + 2);
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }
    return bigrams;
  };

  const bigramsA = getBigrams(strA);
  const bigramsB = getBigrams(strB);

  let intersection = 0;
  for (const [bigram, countA] of bigramsA) {
    if (bigramsB.has(bigram)) {
      intersection += Math.min(countA, bigramsB.get(bigram)!);
    }
  }

  const total = strA.length - 1 + (strB.length - 1);
  return total > 0 ? (2.0 * intersection) / total : 0.0;
}

/**
 * Computes semantic similarity (0.0 to 1.0) between two team names.
 */
export function calculateTeamSimilarity(nameA: string, nameB: string): number {
  if (!nameA || !nameB) return 0.0;

  const normA = normalizeTeamName(nameA);
  const normB = normalizeTeamName(nameB);

  // Exact normalized match
  if (normA.normalized === normB.normalized && normA.normalized.length > 0) {
    return 1.0;
  }

  // Club match check
  const clubA = normA.club;
  const clubB = normB.club;
  const clubMatch =
    clubA === clubB ||
    (clubA.length > 2 && clubB.length > 2 && (clubA.includes(clubB) || clubB.includes(clubA)));

  // If clubs are completely different, they cannot be the same team
  if (!clubMatch) {
    const dice = diceCoefficient(clubA, clubB);
    return Math.min(0.40, dice * 0.5);
  }

  // Same club: compute component matches
  let score = 0.6; // Base club match weight

  if (normA.ageGroup && normB.ageGroup) {
    if (normA.ageGroup === normB.ageGroup) {
      score += 0.2;
    } else {
      score -= 0.3; // Different age groups in same club
    }
  } else if (!normA.ageGroup || !normB.ageGroup) {
    score += 0.1; // One has no age tag
  }

  if (normA.color && normB.color) {
    if (normA.color === normB.color) {
      score += 0.2;
    } else {
      score -= 0.2; // Different squads (Sininen vs Valkoinen)
    }
  } else if (normA.squad && normB.squad) {
    if (normA.squad === normB.squad) {
      score += 0.2;
    } else {
      score -= 0.2;
    }
  } else {
    score += 0.1;
  }

  return Math.max(0.0, Math.min(1.0, Math.round(score * 100) / 100));
}
