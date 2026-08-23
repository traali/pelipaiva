import { describe, it, expect } from 'vitest';
import { EXAMPLE_TOURNAMENTS, exampleTournamentFromUrl, isCupName } from './exampleTournaments';

describe('example tournaments', () => {
  it('ships Helsinki Cup plus the two parent-provided cups', () => {
    expect(EXAMPLE_TOURNAMENTS.map((t) => t.id).sort()).toEqual(
      ['esli2026-topola', 'hc2026-ppj-sin', 'kwm2026-ervi'].sort()
    );
  });

  it('maps Espoo Liikkuu, Helsinki Cup and KW Memorial URLs', () => {
    expect(exampleTournamentFromUrl('https://espooliikkuutournament.fi/team/203621')?.clubName).toBe(
      'Touhun Pojat Lauttasaari'
    );
    expect(
      exampleTournamentFromUrl('https://tulospalvelu.palloliitto.fi/team/185085/info')?.name
    ).toContain('Helsinki Cup');
    expect(
      exampleTournamentFromUrl(
        'https://kwmemorialcup26.torneopal.fi/taso/joukkue.php?joukkue=34013'
      )?.sport
    ).toBe('floorball');
  });

  it('detects cup names the way football-stats treats Helsinki Cup', () => {
    expect(isCupName('Helsinki Cup 2026')).toBe(true);
    expect(isCupName('Espoo Liikkuu Tournament 2026')).toBe(true);
    expect(isCupName('KW Memorial Cup')).toBe(true);
    expect(isCupName('P13 Kolmonen')).toBe(false);
  });
});
