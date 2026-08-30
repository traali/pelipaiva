import type { FullMatchStats, SportType, TeamSquadRoster } from '../../src/types/matchday';

/**
 * Generates synthetic match stats for test fixtures and visual mock verification.
 * Isolated strictly to tests/ to prevent synthetic generators in production bundle.
 */
export function generateOrResolveMatchStats(
  homeTeam: string,
  awayTeam: string,
  sport: SportType = 'football'
): FullMatchStats {
  const isFloorball = sport === 'floorball';
  const isBasketball = sport === 'basketball';
  const isVolleyball = sport === 'volleyball';

  let leagueName = 'Palloliitto T13 Eteläinen Ykkönen (Lohko 1)';
  let scoreType: 'goals' | 'sets' | 'points' = 'goals';
  let liveScore = { home: 0, away: 0, isLive: false, period: 'Ei alkanut' };
  let setScores: string[] | undefined;

  if (isVolleyball) {
    leagueName = 'Lentopalloliitto N2 Lohko 3 (Torneopal)';
    scoreType = 'sets';
  } else if (isBasketball) {
    leagueName = 'Koripalloliitto U14 Aluesarja (Basket.fi / Torneopal)';
    scoreType = 'points';
  } else if (isFloorball) {
    leagueName = 'Salibandyliitto P11 Kilpasarja (Torneopal)';
    scoreType = 'goals';
  }

  const homeRoster: TeamSquadRoster = {
    teamName: homeTeam,
    coachName: 'Valmentaja M.',
    players: [
      { jerseyNumber: 1, playerName: 'Pelaaja 1', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 4, playerName: 'Pelaaja 4', position: 'DF', goals: 1, assists: 2, matchesPlayed: 8, yellowCards: 1, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 6, playerName: 'Pelaaja 6', position: 'DF', goals: 0, assists: 1, matchesPlayed: 7, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 8, playerName: 'Pelaaja 8', position: 'MF', goals: 4, assists: 6, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 10, playerName: 'Pelaaja 10', position: 'FW', goals: 11, assists: 4, matchesPlayed: 8, yellowCards: 1, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 11, playerName: 'Pelaaja 11', position: 'FW', goals: 6, assists: 3, matchesPlayed: 7, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 14, playerName: 'Pelaaja 14', position: 'MF', goals: 3, assists: 2, matchesPlayed: 6, yellowCards: 0, redCards: 0, isStartingLineup: false },
      { jerseyNumber: 19, playerName: 'Pelaaja 19', position: 'DF', goals: 0, assists: 0, matchesPlayed: 5, yellowCards: 0, redCards: 0, isStartingLineup: false }
    ]
  };

  const awayRoster: TeamSquadRoster = {
    teamName: awayTeam || 'EPS Valkoinen',
    coachName: 'Valmentaja J.',
    players: [
      { jerseyNumber: 12, playerName: 'Pelaaja 12', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 3, playerName: 'Pelaaja 3', position: 'DF', goals: 0, assists: 1, matchesPlayed: 8, yellowCards: 2, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 5, playerName: 'Pelaaja 5', position: 'DF', goals: 1, assists: 0, matchesPlayed: 7, yellowCards: 1, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 7, playerName: 'Pelaaja 7', position: 'MF', goals: 3, assists: 4, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 9, playerName: 'Pelaaja 9', position: 'FW', goals: 7, assists: 2, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 13, playerName: 'Pelaaja 13', position: 'MF', goals: 2, assists: 1, matchesPlayed: 6, yellowCards: 1, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 16, playerName: 'Pelaaja 16', position: 'FW', goals: 1, assists: 0, matchesPlayed: 5, yellowCards: 0, redCards: 0, isStartingLineup: false }
    ]
  };

  const honkaRoster: TeamSquadRoster = {
    teamName: 'FC Honka Musta',
    coachName: 'Valmentaja S.',
    players: [
      { jerseyNumber: 1, playerName: 'Pelaaja 1', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 7, playerName: 'Pelaaja 7', position: 'FW', goals: 9, assists: 5, matchesPlayed: 8, yellowCards: 1, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 10, playerName: 'Pelaaja 10', position: 'MF', goals: 5, assists: 4, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 15, playerName: 'Pelaaja 15', position: 'DF', goals: 2, assists: 1, matchesPlayed: 7, yellowCards: 2, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 22, playerName: 'Pelaaja 22', position: 'MF', goals: 3, assists: 3, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true }
    ]
  };

  const vjsRoster: TeamSquadRoster = {
    teamName: 'VJS Tytöt',
    coachName: 'Valmentaja P.',
    players: [
      { jerseyNumber: 1, playerName: 'Pelaaja 1', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 11, playerName: 'Pelaaja 11', position: 'FW', goals: 5, assists: 2, matchesPlayed: 8, yellowCards: 0, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 8, playerName: 'Pelaaja 8', position: 'MF', goals: 3, assists: 3, matchesPlayed: 8, yellowCards: 1, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 4, playerName: 'Pelaaja 4', position: 'DF', goals: 1, assists: 0, matchesPlayed: 7, yellowCards: 1, redCards: 0, isStartingLineup: true }
    ]
  };

  const ppjRoster: TeamSquadRoster = {
    teamName: 'PPJ Sininen',
    coachName: 'Valmentaja K.',
    players: [
      { jerseyNumber: 1, playerName: 'Pelaaja 1', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 9, playerName: 'Pelaaja 9', position: 'FW', goals: 4, assists: 1, matchesPlayed: 8, yellowCards: 0, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 14, playerName: 'Pelaaja 14', position: 'MF', goals: 2, assists: 2, matchesPlayed: 7, yellowCards: 2, redCards: 0, isStartingLineup: true }
    ]
  };

  const valttiRoster: TeamSquadRoster = {
    teamName: 'Valtti/IHK YJ',
    coachName: 'Valmentaja A.',
    players: [
      { jerseyNumber: 1, playerName: 'Pelaaja 1', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 10, playerName: 'Pelaaja 10', position: 'FW', goals: 2, assists: 1, matchesPlayed: 8, yellowCards: 1, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 5, playerName: 'Pelaaja 5', position: 'DF', goals: 1, assists: 0, matchesPlayed: 8, yellowCards: 1, redCards: 0, isStartingLineup: true }
    ]
  };

  const divisionRosters: Record<string, TeamSquadRoster> = {
    [homeTeam]: homeRoster,
    [awayTeam || 'EPS Valkoinen']: awayRoster,
    'FC Honka Musta': honkaRoster,
    'VJS Tytöt': vjsRoster,
    'PPJ Sininen': ppjRoster,
    'Valtti/IHK YJ': valttiRoster
  };

  return {
    leagueName,
    round: 'Kierros 8 / 14',
    scoreType,
    setScores,
    liveScore,
    isSynthetic: true,
    goalsTimeline: [
      { minute: 14, player: 'Pelaaja 10', team: 'home', assistPlayer: 'Pelaaja 8' },
      { minute: 31, player: 'Pelaaja 9', team: 'away', isPenalty: false },
      { minute: 58, player: 'Pelaaja 11', team: 'home', assistPlayer: 'Pelaaja 10' }
    ],
    teamStats: {
      home: {
        possessionPercent: 57,
        shotsTotal: 14,
        shotsOnTarget: 8,
        corners: 6,
        fouls: 5,
        yellowCards: 1,
        redCards: 0,
        saves: 3,
        offsides: 2
      },
      away: {
        possessionPercent: 43,
        shotsTotal: 7,
        shotsOnTarget: 4,
        corners: 3,
        fouls: 8,
        yellowCards: 2,
        redCards: 0,
        saves: 6,
        offsides: 1
      }
    },
    homeStanding: {
      rank: 1,
      teamName: homeTeam,
      played: 8,
      won: 7,
      drawn: 1,
      lost: 0,
      goalsFor: 28,
      goalsAgainst: 6,
      goalDifference: 22,
      points: 22,
      form: ['W', 'W', 'W', 'D', 'W']
    },
    awayStanding: {
      rank: 3,
      teamName: awayTeam || 'EPS Valkoinen',
      played: 8,
      won: 5,
      drawn: 1,
      lost: 2,
      goalsFor: 19,
      goalsAgainst: 11,
      goalDifference: 8,
      points: 16,
      form: ['W', 'L', 'W', 'W', 'D']
    },
    standingsTable: [
      {
        rank: 1,
        teamName: homeTeam,
        played: 8,
        won: 7,
        drawn: 1,
        lost: 0,
        goalsFor: 28,
        goalsAgainst: 6,
        goalDifference: 22,
        points: 22,
        form: ['W', 'W', 'W', 'D', 'W']
      },
      {
        rank: 2,
        teamName: 'FC Honka Musta',
        played: 8,
        won: 6,
        drawn: 0,
        lost: 2,
        goalsFor: 24,
        goalsAgainst: 9,
        goalDifference: 15,
        points: 18,
        form: ['W', 'W', 'L', 'W', 'W']
      },
      {
        rank: 3,
        teamName: awayTeam || 'EPS Valkoinen',
        played: 8,
        won: 5,
        drawn: 1,
        lost: 2,
        goalsFor: 19,
        goalsAgainst: 11,
        goalDifference: 8,
        points: 16,
        form: ['W', 'L', 'W', 'W', 'D']
      },
      {
        rank: 4,
        teamName: 'VJS Tytöt',
        played: 8,
        won: 3,
        drawn: 2,
        lost: 3,
        goalsFor: 14,
        goalsAgainst: 16,
        goalDifference: -2,
        points: 11,
        form: ['L', 'D', 'W', 'D', 'L']
      },
      {
        rank: 5,
        teamName: 'PPJ Sininen',
        played: 8,
        won: 2,
        drawn: 1,
        lost: 5,
        goalsFor: 10,
        goalsAgainst: 21,
        goalDifference: -11,
        points: 7,
        form: ['L', 'L', 'W', 'L', 'D']
      },
      {
        rank: 6,
        teamName: 'Valtti/IHK YJ',
        played: 8,
        won: 0,
        drawn: 1,
        lost: 7,
        goalsFor: 4,
        goalsAgainst: 36,
        goalDifference: -32,
        points: 1,
        form: ['L', 'L', 'L', 'D', 'L']
      }
    ],
    topScorers: [
      { rank: 1, playerName: 'Pelaaja 10', teamName: homeTeam, goals: 11, matchesPlayed: 8 },
      { rank: 2, playerName: 'Pelaaja 7', teamName: 'FC Honka Musta', goals: 9, matchesPlayed: 8 },
      { rank: 3, playerName: 'Pelaaja 9', teamName: awayTeam || 'EPS Valkoinen', goals: 7, matchesPlayed: 8 },
      { rank: 4, playerName: 'Pelaaja 11', teamName: homeTeam, goals: 6, matchesPlayed: 7 },
      { rank: 5, playerName: 'Pelaaja 11B', teamName: 'VJS Tytöt', goals: 5, matchesPlayed: 8 }
    ],
    headToHeadHistory: [
      {
        date: '2026-05-14',
        competition: 'Kevätkierros',
        homeTeam: awayTeam || 'EPS Valkoinen',
        awayTeam: homeTeam,
        homeScore: 1,
        awayScore: 3
      },
      {
        date: '2025-09-20',
        competition: 'Syyssarja',
        homeTeam: homeTeam,
        awayTeam: awayTeam || 'EPS Valkoinen',
        homeScore: 2,
        awayScore: 2
      },
      {
        date: '2025-06-08',
        competition: 'Helsinki Cup Alkulohko',
        homeTeam: homeTeam,
        awayTeam: awayTeam || 'EPS Valkoinen',
        homeScore: 4,
        awayScore: 0
      }
    ],
    commonOpponents: [
      {
        opponentName: 'FC Honka Musta',
        homeResult: { result: 'win', score: '3 - 1' },
        awayResult: { result: 'loss', score: '1 - 2' }
      }
    ],
    squadRosters: {
      home: homeRoster,
      away: awayRoster
    },
    divisionRosters,
    scoutAnalysis: `${homeTeam} johtaa sarjaa vahvalla vireellä.`
  };
}
