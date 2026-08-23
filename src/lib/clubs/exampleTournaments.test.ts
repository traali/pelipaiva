import { describe, it, expect } from 'vitest';
import {
  EXAMPLE_TOURNAMENTS,
  exampleTournamentFromUrl,
  isCupName,
  isUglyTeamName,
  mergeOfficialWithCupFallback
} from './exampleTournaments';

describe('example tournaments', () => {
  it('ships Helsinki Cup plus the two parent-provided cups', () => {
    expect(EXAMPLE_TOURNAMENTS.map((t) => t.id).sort()).toEqual(
      ['esli2026-topola', 'hc2026-ppj-sin', 'kwm2026-ervi'].sort()
    );
  });

  it('maps Espoo Liikkuu and KW Memorial URLs', () => {
    expect(exampleTournamentFromUrl('https://espooliikkuutournament.fi/team/203621')?.clubName).toBe(
      'Touhun Pojat Lauttasaari'
    );
    expect(
      exampleTournamentFromUrl(
        'https://kwmemorialcup26.torneopal.fi/taso/joukkue.php?joukkue=34013'
      )?.sport
    ).toBe('floorball');
  });

  it('does not treat Palloliitto team 203621 as Espoo Liikkuu', () => {
    expect(exampleTournamentFromUrl('https://tulospalvelu.palloliitto.fi/team/203621')).toBeUndefined();
  });

  it('does not treat Palloliitto league 185085 as Helsinki Cup', () => {
    expect(exampleTournamentFromUrl('https://tulospalvelu.palloliitto.fi/team/185085/info')).toBeUndefined();
    expect(
      exampleTournamentFromUrl(
        'https://tulospalvelu.palloliitto.fi/team/185085/info?season=hc2026&category=B13-8'
      )?.name
    ).toBe('Helsinki Cup 2026');
  });

  it('detects cup names the way football-stats treats Helsinki Cup', () => {
    expect(isCupName('Helsinki Cup 2026')).toBe(true);
    expect(isCupName('Espoo Liikkuu Tournament 2026')).toBe(true);
    expect(isCupName('KW Memorial Cup')).toBe(true);
    expect(isCupName('P13 Kolmonen')).toBe(false);
  });

  it('rejects association-prefix names with raw team ids', () => {
    expect(isUglyTeamName('Basket.fi / ToPo (5756346)')).toBe(true);
    expect(isUglyTeamName('Salibandy / ErVi (25301)')).toBe(true);
    expect(isUglyTeamName('TOPOLA')).toBe(false);
  });

  it('replaces leaked league fixtures with canned cup matches', () => {
    const cup = EXAMPLE_TOURNAMENTS.find((t) => t.id === 'esli2026-topola')!;
    const merged = mergeOfficialWithCupFallback(cup, {
      teamId: '203621',
      association: 'basket',
      sport: 'basketball',
      teamName: 'Basket.fi / ToPo (5756346)',
      leagueName: 'Koripalloliitto U14 Aluesarja',
      fixtures: [
        {
          id: 'fake',
          teamId: '5756346',
          association: 'basket',
          sport: 'basketball',
          leagueName: 'Koripalloliitto U14 Aluesarja',
          homeTeam: 'Basket.fi / ToPo (5756346)',
          awayTeam: 'Tapiolan Honka',
          isHome: true,
          startTime: new Date().toISOString(),
          venueName: 'Munkkiniemen yhteiskoulu',
          status: 'upcoming',
          fetchedAt: new Date().toISOString()
        }
      ]
    });
    expect(merged?.leagueName).toBe('Espoo Liikkuu Tournament 2026');
    expect(merged?.teamName).toBe('TOPOLA');
    expect(merged?.fixtures.some((f) => f.homeTeam === 'TOPOLA' || f.awayTeam === 'TOPOLA')).toBe(true);
  });
});
