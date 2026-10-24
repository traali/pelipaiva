import { describe, it, expect } from 'vitest';
import { ageClassLabelFor, mapFixture, tasoAgeClass } from './torneopalClient';
import type { ParsedAssociationUrl } from '../../types/matchday';
import real from '../../../tests/fixtures/json/taso-floorball-age-class-2026-10-24.json';

// Real Salibandy TASO payloads captured 24.10.2026.
const R = real as unknown as Record<string, any>;
const team = (teamId: string): ParsedAssociationUrl => ({
  sport: 'floorball',
  association: 'salibandy',
  teamId,
  canonicalUrl: `https://tulospalvelu.salibandy.fi/team/${teamId}`,
});
const by = (t: any) => Number(t.birthyear);

describe('floorball age class label (real payloads)', () => {
  it('getTeam gives birthyear; getMatch gives age_group', () => {
    expect(R.getTeam_25301.birthyear).toBe('2013');
    expect(R.floorball_getMatch_949684.age_group).toBe('P14');
    expect(tasoAgeClass(R.floorball_getMatch_949684)).toEqual({ label: 'P14', birthYear: 2013 });
  });

  it("today's Westend Indians Yellow games (P14 = 2013) show nothing extra", () => {
    for (const k of ['floorball_getMatch_949684', 'floorball_getMatch_949686']) {
      const f = mapFixture(R[k], team('25301'), 'Westend Indians Yellow', by(R.getTeam_25301))!;
      expect(f.ageClassLabel).toBeUndefined();
    }
  });

  it('last-season P13 game is still the 2013 birth year: no label', () => {
    const m = R.getMatches_25301_sample[0];
    expect(m.age_group).toBe('P13');
    expect(ageClassLabelFor(m, 2013)).toBeUndefined();
  });

  it('SB Vantaa Orange (born 2015) playing in P14 gets "P14 (2013)"', () => {
    expect(R.getTeam_28543.birthyear).toBe('2015');
    const f = mapFixture(R.floorball_getMatch_949661, team('28543'), 'SB Vantaa Orange', by(R.getTeam_28543))!;
    expect(f.ageClassLabel).toBe('P14 (2013)');
    const w = mapFixture(R.floorball_getMatch_949661, team('25301'), 'Westend Indians Yellow', by(R.getTeam_25301))!;
    expect(w.ageClassLabel).toBeUndefined();
  });

  it('no team birth year -> no label', () => {
    expect(ageClassLabelFor(R.floorball_getMatch_949661, undefined)).toBeUndefined();
  });
});
