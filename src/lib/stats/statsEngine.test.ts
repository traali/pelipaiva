import { describe, it, expect } from 'vitest';
import { generateOrResolveMatchStats } from './statsEngine';

describe('Stats Engine', () => {
  it('generates full match and league stats for football', () => {
    const stats = generateOrResolveMatchStats('HJK T13', 'EPS Valkoinen', 'football');
    expect(stats.leagueName).toContain('Palloliitto');
    expect(stats.homeStanding.rank).toBe(1);
    expect(stats.awayStanding.rank).toBe(3);
    expect(stats.standingsTable.length).toBeGreaterThanOrEqual(6);
    expect(stats.topScorers.length).toBeGreaterThanOrEqual(5);
    expect(stats.teamStats?.home.possessionPercent).toBe(57);
    expect(stats.teamStats?.away.possessionPercent).toBe(43);
    expect(stats.headToHeadHistory.length).toBeGreaterThanOrEqual(3);
  });

  it('provides player-level statistics and squad rosters', () => {
    const stats = generateOrResolveMatchStats('HJK T13', 'EPS Valkoinen', 'football');
    expect(stats.squadRosters.home.players.length).toBeGreaterThanOrEqual(8);
    expect(stats.squadRosters.away.players.length).toBeGreaterThanOrEqual(7);

    const topScorer = stats.squadRosters.home.players.find((p) => p.jerseyNumber === 10);
    expect(topScorer?.playerName).toBe('Maija Oinonen');
    expect(topScorer?.goals).toBe(11);
    expect(topScorer?.assists).toBe(4);
    expect(topScorer?.position).toBe('FW');

    const captain = stats.squadRosters.home.players.find((p) => p.isCaptain);
    expect(captain).toBeDefined();
    expect(captain?.jerseyNumber).toBe(4);
  });

  it('generates appropriate league names for floorball', () => {
    const stats = generateOrResolveMatchStats('ErVi P11', 'Oilers Black', 'floorball');
    expect(stats.leagueName).toContain('Salibandyliitto');
  });
});
