import { describe, it, expect } from 'vitest';
import { pickNextTeamColor, colorFromNameHint, TEAM_COLOR_SWATCHES } from './teamColors';

describe('teamColors', () => {
  it('never reuses a taken hex until the palette is exhausted', () => {
    const used: string[] = [];
    for (let i = 0; i < TEAM_COLOR_SWATCHES.length; i++) {
      const next = pickNextTeamColor(used);
      expect(used.includes(next.hex)).toBe(false);
      used.push(next.hex);
    }
    expect(used).toHaveLength(TEAM_COLOR_SWATCHES.length);
  });

  it('reads kit colour from a Finnish team name', () => {
    expect(colorFromNameHint('PPJ/Laru sin')?.label).toBe('sininen');
    expect(colorFromNameHint('PPJ/Laru oran')?.label).toBe('oranssi');
    expect(colorFromNameHint('PPJ/Laru mus')?.label).toBe('harmaa');
  });
});
