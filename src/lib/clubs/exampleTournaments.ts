import type { OfficialTeamData, SportType } from '../../types/matchday';

export interface ExampleTournament {
  id: string;
  name: string;
  teamName: string;
  clubName: string;
  sport: SportType;
  primaryColor: string;
  colorHex: string;
  url: string;
  teamId: string;
  competitionId?: string;
  categoryId?: string;
  note: string;
  source: 'football-stats' | 'torneopal' | 'espooliikkuu';
}

/**
 * Real cups the parent asked to test with.
 * Helsinki Cup is NOT the Palloliitto league page for team 185085 (P13 Kolmonen).
 */
export const EXAMPLE_TOURNAMENTS: ExampleTournament[] = [
  {
    id: 'hc2026-ppj-sin',
    name: 'Helsinki Cup 2026',
    teamName: 'PPJ/Laru sin',
    clubName: 'PPJ',
    sport: 'football',
    primaryColor: 'sininen',
    colorHex: '#3b82f6',
    url: 'https://tulospalvelu.palloliitto.fi/team/185085/info?season=hc2026&category=B13-8',
    teamId: '185085',
    competitionId: 'hc2026',
    categoryId: 'B13-8',
    note: 'Football-stats: /turnaukset/hc2026/B13-8/185085 · ei P13 Kolmonen',
    source: 'football-stats',
  },
  {
    id: 'esli2026-topola',
    name: 'Espoo Liikkuu Tournament 2026',
    teamName: 'TOPOLA',
    clubName: 'Touhun Pojat Lauttasaari',
    sport: 'basketball',
    primaryColor: 'syaani',
    colorHex: '#21C3F7',
    url: 'https://espooliikkuutournament.fi/team/203621',
    teamId: '203621',
    competitionId: 'esli2026',
    categoryId: 'WU12F',
    note: 'Esport Center 2 · Girls 2015 Fun · lohko B',
    source: 'espooliikkuu',
  },
  {
    id: 'kwm2026-indians',
    name: 'KW Memorial Cup 2026',
    teamName: 'Indians',
    clubName: 'Westend Indians',
    sport: 'floorball',
    primaryColor: 'keltainen',
    colorHex: '#ca8a04',
    url: 'https://kwmemorialcup26.torneopal.fi/taso/joukkue.php?joukkue=34013&turnaus=Er%C3%A4Viikingit_0005&sarja=2546',
    teamId: '34013',
    competitionId: 'EräViikingit_0005',
    categoryId: '2546',
    note: 'Arena Center Myllypuro (Kenttä 6) · P14 Haastaja Lohko B & Jatko-ottelut',
    source: 'torneopal',
  }
];

export function isCupName(name?: string): boolean {
  if (!name) return false;
  return /turnaus|tournament|cup|memorial|cupis|helsinki cup|espoo liikkuu|kw memorial/i.test(name);
}

export function exampleTournamentFromUrl(url?: string): ExampleTournament | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const raw = url.trim().toLowerCase();
  if (!raw) return undefined;
  if (
    (raw.includes('espooliikkuutournament.fi') || raw.includes('espooliikkuu')) &&
    (/203621/.test(raw) || /topola/i.test(raw))
  ) {
    return EXAMPLE_TOURNAMENTS.find((t) => t.id === 'esli2026-topola');
  }
  if (
    (raw.includes('kwmemorial') || raw.includes('kwmc') || raw.includes('er%c3%a4viikingit_0005') || raw.includes('eräviikingit_0005')) &&
    (/34013/.test(raw) || /99412/.test(raw) || /indians/i.test(raw))
  ) {
    return EXAMPLE_TOURNAMENTS.find((t) => t.id === 'kwm2026-indians');
  }
  if (
    /185085/.test(raw) &&
    (raw.includes('hc2026') || raw.includes('helsinki cup') || raw.includes('helsinkicup'))
  ) {
    return EXAMPLE_TOURNAMENTS.find((t) => t.id === 'hc2026-ppj-sin');
  }
  return undefined;
}

export function isUglyTeamName(name?: string): boolean {
  if (!name) return true;
  if (/\(\d{4,}\)\s*$/.test(name)) return true;
  if (/^(basket\.fi|salibandy|koripallo|palloliitto)\s*[/(]/i.test(name)) return true;
  if (/^joukkue\s+\d+/i.test(name)) return true;
  return false;
}

/** Prefer live cup matches. Never replace real league rows with canned HJK/KäPa. */
export function mergeOfficialWithCupFallback(
  cup: ExampleTournament | undefined,
  official: OfficialTeamData | null | undefined
): OfficialTeamData | null {
  if (!cup) return official ?? null;
  const liveCup = (official?.fixtures || []).filter((f) => isCupName(f.leagueName));
  if (liveCup.length > 0) {
    const teamName =
      official?.teamName && !isUglyTeamName(official.teamName) ? official.teamName : cup.teamName;
    return {
      ...official!,
      teamName,
      leagueName: cup.name,
      fixtures: liveCup,
      competitionId: official?.competitionId || cup.competitionId,
      categoryId: official?.categoryId || cup.categoryId
    };
  }
  // Never fall back to canned cup matches: an empty live cup stays empty.
  return official ?? null;
}
