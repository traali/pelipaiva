import type { OfficialLeagueFixture, OfficialTeamData, SportType } from '../../types/matchday';

export interface CupFixtureSeed {
  id: string;
  home: string;
  away: string;
  start: string;
  venueName: string;
  venueCity: string;
  status: OfficialLeagueFixture['status'];
  homeScore?: number;
  awayScore?: number;
}

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
  fixtures: CupFixtureSeed[];
}

function weekendAt(dow: number, hour: number, minute = 0): string {
  const now = new Date();
  const hel = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Helsinki' }));
  const today = hel.getDay();
  let add = dow - today;
  if (dow === 0 && today !== 0) add = 7 - today;
  const d = new Date(hel);
  d.setDate(d.getDate() + add);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
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
    fixtures: [
      {
        id: 'hc1',
        home: 'PPJ/Laru sin',
        away: 'HJK',
        start: weekendAt(6, 10, 0),
        venueName: 'Käpylän Urheilupuisto TN 1',
        venueCity: 'Helsinki',
        status: 'upcoming'
      },
      {
        id: 'hc2',
        home: 'PPJ/Laru sin',
        away: 'KäPa',
        start: weekendAt(6, 13, 0),
        venueName: 'Käpylän Urheilupuisto TN 1',
        venueCity: 'Helsinki',
        status: 'upcoming'
      }
    ]
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
    fixtures: [
      {
        id: 'elt1',
        home: 'EBT',
        away: 'TOPOLA',
        start: '2026-08-22T09:45:00+03:00',
        venueName: 'Esport Center 2',
        venueCity: 'Espoo',
        status: 'played',
        homeScore: 6,
        awayScore: 52
      },
      {
        id: 'elt2',
        home: 'TOPOLA',
        away: 'Jymy',
        start: '2026-08-22T15:00:00+03:00',
        venueName: 'Esport Center 2',
        venueCity: 'Espoo',
        status: 'played',
        homeScore: 55,
        awayScore: 6
      },
      {
        id: 'elt3',
        home: 'TOPOLA',
        away: 'Helmi Basket/Valkoinen',
        start: '2026-08-23T10:30:00+03:00',
        venueName: 'Esport Center 2',
        venueCity: 'Espoo',
        status: 'played',
        homeScore: 21,
        awayScore: 14
      }
    ]
  },
  {
    id: 'kwm2026-ervi',
    name: 'KW Memorial Cup 2026',
    teamName: 'EräViikingit',
    clubName: 'EräViikingit',
    sport: 'floorball',
    primaryColor: 'tummansininen',
    colorHex: '#1d4ed8',
    url: 'https://kwmemorialcup26.torneopal.fi/taso/joukkue.php?joukkue=34013&turnaus=Er%C3%A4Viikingit_0005&sarja=2546',
    teamId: '34013',
    competitionId: 'EräViikingit_0005',
    categoryId: '2546',
    note: 'Arena Center Myllypuro · KW Memorial',
    source: 'torneopal',
    fixtures: [
      {
        id: 'kw1',
        home: 'EräViikingit',
        away: 'Oilers NG White',
        start: weekendAt(0, 9, 0),
        venueName: 'Arena Center Myllypuro Kenttä 6',
        venueCity: 'Helsinki',
        status: 'upcoming'
      },
      {
        id: 'kw2',
        home: 'RSS Panthers',
        away: 'EräViikingit',
        start: weekendAt(0, 11, 15),
        venueName: 'Arena Center Myllypuro Kenttä 6',
        venueCity: 'Helsinki',
        status: 'upcoming'
      },
      {
        id: 'kw3',
        home: 'EräViikingit',
        away: 'Indians',
        start: weekendAt(0, 14, 50),
        venueName: 'Arena Center Myllypuro Kenttä 6',
        venueCity: 'Helsinki',
        status: 'upcoming'
      }
    ]
  }
];

export function isCupName(name?: string): boolean {
  if (!name) return false;
  return /turnaus|tournament|cup|memorial|cupis|helsinki cup|espoo liikkuu|kw memorial/i.test(name);
}

/** League team 185085 is P13 Kolmonen — not Helsinki Cup. */
export function exampleTournamentFromUrl(url: string): ExampleTournament | undefined {
  const raw = url.trim().toLowerCase();
  if (!raw) return undefined;
  if (raw.includes('espooliikkuutournament.fi') && /\/team\/203621(?:\/|$|\?)/.test(raw)) {
    return EXAMPLE_TOURNAMENTS.find((t) => t.id === 'esli2026-topola');
  }
  if (raw.includes('kwmemorial') || raw.includes('er%c3%a4viikingit_0005') || raw.includes('eräviikingit_0005')) {
    return EXAMPLE_TOURNAMENTS.find((t) => t.id === 'kwm2026-ervi');
  }
  if (raw.includes('hc2026') || raw.includes('b13-8') || raw.includes('helsinki cup')) {
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

function seedToFixture(cup: ExampleTournament, seed: CupFixtureSeed): OfficialLeagueFixture {
  const start = seed.start;
  const end = new Date(new Date(start).getTime() + 50 * 60 * 1000).toISOString();
  const now = new Date().toISOString();
  return {
    id: `${cup.source}_${cup.teamId}_${seed.id}`,
    teamId: cup.teamId,
    association: cup.source === 'football-stats' ? 'palloliitto' : cup.source === 'espooliikkuu' ? 'basket' : 'torneopal',
    sport: cup.sport,
    leagueName: cup.name,
    homeTeam: seed.home,
    awayTeam: seed.away,
    isHome: seed.home.toLowerCase().includes(cup.teamName.toLowerCase().split('·')[0]!.trim().toLowerCase()),
    startTime: start,
    endTime: end,
    venueName: seed.venueName,
    venueCity: seed.venueCity,
    competitionId: cup.competitionId,
    categoryId: cup.categoryId,
    status: seed.status,
    homeScore: seed.homeScore,
    awayScore: seed.awayScore,
    score:
      seed.homeScore != null && seed.awayScore != null ? `${seed.homeScore}–${seed.awayScore}` : undefined,
    matchId: seed.id,
    officialMatchUrl: cup.url,
    fetchedAt: now
  };
}

export function officialFromExampleCup(cup: ExampleTournament): OfficialTeamData {
  return {
    teamId: cup.teamId,
    association: cup.source === 'football-stats' ? 'palloliitto' : cup.source === 'espooliikkuu' ? 'basket' : 'torneopal',
    sport: cup.sport,
    teamName: cup.teamName,
    leagueName: cup.name,
    fixtures: cup.fixtures.map((f) => seedToFixture(cup, f)),
    competitionId: cup.competitionId,
    categoryId: cup.categoryId,
    sourceUrl: cup.url,
    fetchedAt: new Date().toISOString()
  };
}

/** Prefer live cup matches; never mix in P13 Kolmonen / synthetic ToPo league. */
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
  return officialFromExampleCup(cup);
}
