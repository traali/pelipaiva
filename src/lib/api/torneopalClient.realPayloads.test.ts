import { describe, it, expect } from 'vitest';
import { buildMatchStatsFromOfficial, mapFixture } from './torneopalClient';
import type { OfficialTeamData, ParsedAssociationUrl } from '../../types/matchday';
import real from '../../../tests/fixtures/json/taso-real-matches-2026-10-08.json';

// Real TASO payloads captured 8.10.2026 (trimmed to the fields mapFixture reads).
const R = real as Record<string, Record<string, unknown>>;

const team = (sport: ParsedAssociationUrl['sport'], association: ParsedAssociationUrl['association'], teamId: string): ParsedAssociationUrl => ({
  sport,
  association,
  teamId,
  canonicalUrl: `https://example.invalid/team/${teamId}`,
});

const ppjSin = team('football', 'palloliitto', '185085');

describe('TASO truth gates (real payloads)', () => {
  it('getMatch "0"/"0" on an unplayed football game is not a 0–0 result', () => {
    const f = mapFixture(R.football_fixture_getMatch_4208643!, ppjSin, 'PPJ/Laru sin')!;
    expect(f.status).toBe('upcoming');
    expect(f.score).toBeUndefined();
    expect(f.homeScore).toBeUndefined();
    expect(f.awayScore).toBeUndefined();
  });

  it('getMatches blank score on the same game stays blank', () => {
    const f = mapFixture(R.football_fixture_getMatches_4208643!, ppjSin, 'PPJ/Laru sin')!;
    expect(f.status).toBe('upcoming');
    expect(f.score).toBeUndefined();
  });

  it('stale 2022 floorball "Fixture" with 0–0 has no score', () => {
    const f = mapFixture(R.floorball_stale_fixture_444224!, team('floorball', 'salibandy', '25301'), 'Westend Indians Yellow')!;
    expect(f.status).toBe('upcoming');
    expect(f.score).toBeUndefined();
  });

  it('upcoming basketball game read through getMatch has no 0–0', () => {
    const f = mapFixture(R.basketball_fixture_getMatch_1010390!, team('basketball', 'basket', '5756346'), 'TOPOLA')!;
    expect(f.status).toBe('upcoming');
    expect(f.score).toBeUndefined();
  });

  it('played games keep their real score', () => {
    expect(mapFixture(R.floorball_played_913481!, team('floorball', 'salibandy', '25301'), 'Westend Indians Yellow')!.score).toBe('3–15');
    expect(mapFixture(R.basketball_played_1010355!, team('basketball', 'basket', '5756346'), 'TOPOLA')!.score).toBe('62–14');
    expect(mapFixture(R.volleyball_played_753797!, team('volleyball', 'torneopal', '57672'), 'EsIsku/M1')!.score).toBe('3–2');
  });

  it('TASO "Forfeited" is a walkover result, not an upcoming game', () => {
    const f = mapFixture(R.football_forfeited_4208570!, ppjSin, 'LePa/keltainen')!;
    expect(f.status).toBe('played');
    expect(f.isWalkover).toBe(true);
    expect(f.score).toBe('0–3');
  });

  it('a game stays live until the slot TASO reserved ends', () => {
    // Volleyball: kickoff 20:20, TASO reserved until 23:20, no playing_time_min.
    const f = mapFixture(R.volleyball_played_753797!, team('volleyball', 'torneopal', '57672'), 'EsIsku/M1')!;
    expect(new Date(f.endTime!).getTime() - new Date(f.startTime).getTime()).toBe(3 * 60 * 60 * 1000);
    // Football: 18:00–19:10 reserved, playing time 70.
    const g = mapFixture(R.football_fixture_getMatch_4208643!, ppjSin, 'PPJ/Laru sin')!;
    expect(g.startTime).toBe('2026-10-08T18:00:00+03:00');
    expect(new Date(g.endTime!).toISOString()).toBe('2026-10-08T16:10:00.000Z');
  });

  it('stats view builds no "Tulos 0–0" for an upcoming game', () => {
    const fixture = mapFixture(R.football_fixture_getMatch_4208643!, ppjSin, 'PPJ/Laru sin')!;
    const data = {
      teamName: 'PPJ/Laru sin',
      sport: 'football',
      association: 'palloliitto',
      fixtures: [fixture],
      standings: [{ rank: 15, teamName: 'PPJ/Laru sin', played: 9, won: 4, drawn: 0, lost: 5, goalsFor: 22, goalsAgainst: 38, goalDifference: -16, points: 12, form: [] }],
    } as unknown as OfficialTeamData;
    const stats = buildMatchStatsFromOfficial(data, fixture);
    expect(stats?.liveScore).toBeUndefined();
  });
});
