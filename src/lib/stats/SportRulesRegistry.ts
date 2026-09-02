import type { SportType } from "../../types/matchday";

export interface SportScoringStrategy {
  pointsForWin: number;
  pointsForDraw: number;
  pointsForLoss: number;
  hasDraws: boolean;
  periodsName: string;
  calculatePoints: (won: number, drawn: number, lost: number) => number;
  calculateDifference: (scored: number, conceded: number) => number;
  formatScore: (homeScore: number, awayScore: number, extraInfo?: string) => string;
}

export const FootballStrategy: SportScoringStrategy = {
  pointsForWin: 3,
  pointsForDraw: 1,
  pointsForLoss: 0,
  hasDraws: true,
  periodsName: "Puoliaika",
  calculatePoints: (won, drawn) => won * 3 + drawn * 1,
  calculateDifference: (scored, conceded) => scored - conceded,
  formatScore: (h, a) => `${h} - ${a}`,
};

export const FloorballStrategy: SportScoringStrategy = {
  pointsForWin: 2,
  pointsForDraw: 1,
  pointsForLoss: 0,
  hasDraws: true,
  periodsName: "Erä",
  calculatePoints: (won, drawn) => won * 2 + drawn * 1,
  calculateDifference: (scored, conceded) => scored - conceded,
  formatScore: (h, a) => `${h} - ${a}`,
};

export const BasketballStrategy: SportScoringStrategy = {
  pointsForWin: 2,
  pointsForDraw: 0,
  pointsForLoss: 0,
  hasDraws: false,
  periodsName: "Neljännes",
  calculatePoints: (won) => won * 2,
  calculateDifference: (scored, conceded) => scored - conceded,
  formatScore: (h, a) => `${h} - ${a}`,
};

export const VolleyballStrategy: SportScoringStrategy = {
  pointsForWin: 3, // 3-0 / 3-1: 3 pts, 3-2: 2 pts
  pointsForDraw: 0,
  pointsForLoss: 0,
  hasDraws: false,
  periodsName: "Erä",
  calculatePoints: (won) => won * 3,
  calculateDifference: (scored, conceded) => scored - conceded,
  formatScore: (h, a, extra) => (extra ? `${h} - ${a} (${extra})` : `${h} - ${a}`),
};

export const IceHockeyStrategy: SportScoringStrategy = {
  pointsForWin: 3,
  pointsForDraw: 1,
  pointsForLoss: 0,
  hasDraws: true,
  periodsName: "Erä",
  calculatePoints: (won, drawn) => won * 3 + drawn * 1,
  calculateDifference: (scored, conceded) => scored - conceded,
  formatScore: (h, a) => `${h} - ${a}`,
};

export const SportRulesRegistry = {
  strategies: {
    football: FootballStrategy,
    futsal: FootballStrategy,
    floorball: FloorballStrategy,
    basketball: BasketballStrategy,
    volleyball: VolleyballStrategy,
    icehockey: IceHockeyStrategy,
    other: FootballStrategy,
    school: FootballStrategy,
    training: FootballStrategy,
  } as Record<SportType, SportScoringStrategy>,

  get(sport: SportType): SportScoringStrategy {
    return this.strategies[sport] || FootballStrategy;
  },

  calculatePoints(sport: SportType, won: number, drawn: number, lost: number): number {
    return this.get(sport).calculatePoints(won, drawn, lost);
  },

  calculateDifference(sport: SportType, scored: number, conceded: number): number {
    return this.get(sport).calculateDifference(scored, conceded);
  },
};
