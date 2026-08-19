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

  it('generates appropriate league names for floorball', () => {
    const stats = generateOrResolveMatchStats('ErVi P11', 'Oilers Black', 'floorball');
    expect(stats.leagueName).toContain('Salibandyliitto');
  });
});
