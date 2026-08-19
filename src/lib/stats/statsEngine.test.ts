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

  it('provides player-level statistics and squad rosters for all division teams', () => {
    const stats = generateOrResolveMatchStats('HJK T13', 'EPS Valkoinen', 'football');
    expect(stats.divisionRosters).toBeDefined();
    expect(stats.divisionRosters['HJK T13']?.players.length).toBeGreaterThanOrEqual(8);
    expect(stats.divisionRosters['FC Honka Musta']?.players.length).toBeGreaterThanOrEqual(5);
    expect(stats.divisionRosters['VJS Tytöt']?.players.length).toBeGreaterThanOrEqual(4);

    const honkaStar = stats.divisionRosters['FC Honka Musta']?.players.find((p) => p.jerseyNumber === 7);
    expect(honkaStar?.playerName).toBe('Aada Korhonen');
    expect(honkaStar?.goals).toBe(9);
    expect(honkaStar?.isCaptain).toBe(true);
  });

  it('generates appropriate league names for floorball', () => {
    const stats = generateOrResolveMatchStats('ErVi P11', 'Oilers Black', 'floorball');
    expect(stats.leagueName).toContain('Salibandyliitto');
  });
});
