import type { SportType } from '../../types/matchday';

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
  note: string;
  source: 'football-stats' | 'torneopal' | 'espooliikkuu';
}

/**
 * Test cups: Helsinki Cup already lives in football-stats
 * (`/turnaukset/hc2026/B13-8/185085`). Basketball + floorball cups
 * from parent-provided team pages.
 */
export const EXAMPLE_TOURNAMENTS: ExampleTournament[] = [
  {
    id: 'hc2026-ppj-sin',
    name: 'Helsinki Cup 2026',
    teamName: 'PPJ/Laru sin · B13 8v8',
    clubName: 'PPJ',
    sport: 'football',
    primaryColor: 'sininen',
    colorHex: '#3b82f6',
    url: 'https://tulospalvelu.palloliitto.fi/team/185085/info',
    teamId: '185085',
    note: 'Football-stats: /turnaukset/hc2026/B13-8/185085',
    source: 'football-stats'
  },
  {
    id: 'esli2026-topola',
    name: 'Espoo Liikkuu Tournament 2026',
    teamName: 'TOPOLA · Girls 2015 Fun',
    clubName: 'Touhun Pojat Lauttasaari',
    sport: 'basketball',
    primaryColor: 'syaani',
    colorHex: '#21C3F7',
    url: 'https://espooliikkuutournament.fi/team/203621',
    teamId: '203621',
    note: 'Esport Center 2 · lohko B',
    source: 'espooliikkuu'
  },
  {
    id: 'kwm2026-ervi',
    name: 'KW Memorial Cup 2026',
    teamName: 'EräViikingit · KW Memorial',
    clubName: 'EräViikingit',
    sport: 'floorball',
    primaryColor: 'tummansininen',
    colorHex: '#1d4ed8',
    url: 'https://kwmemorialcup26.torneopal.fi/taso/joukkue.php?joukkue=34013&turnaus=Er%C3%A4Viikingit_0005&sarja=2546',
    teamId: '34013',
    note: 'Torneopal turnaus=EräViikingit_0005 · sarja=2546',
    source: 'torneopal'
  }
];

export function isCupName(name?: string): boolean {
  if (!name) return false;
  return /turnaus|tournament|cup|memorial|cupis/i.test(name);
}

export function exampleTournamentFromUrl(url: string): ExampleTournament | undefined {
  const raw = url.trim().toLowerCase();
  return EXAMPLE_TOURNAMENTS.find(
    (t) =>
      raw.includes(t.teamId) ||
      raw.includes(t.url.toLowerCase()) ||
      (t.id === 'esli2026-topola' && raw.includes('espooliikkuutournament.fi')) ||
      (t.id === 'kwm2026-ervi' && raw.includes('kwmemorialcup'))
  );
}
