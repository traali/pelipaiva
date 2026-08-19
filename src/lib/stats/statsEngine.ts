import { FullMatchStats, SportType, TeamSquadRoster } from '../../types/matchday';

/**
 * Generates or extracts full league and matchday stats for a given fixture,
 * including division-wide player rosters for all competing clubs.
 */
export function generateOrResolveMatchStats(
  homeTeam: string,
  awayTeam: string,
  sport: SportType = 'football'
): FullMatchStats {
  const isFootball = sport === 'football';
  const isFloorball = sport === 'floorball';

  const leagueName = isFootball
    ? 'Palloliitto T13 Eteläinen Ykkönen (Lohko 1)'
    : isFloorball
    ? 'Salibandyliitto P11 Kilpasarja'
    : 'Koripalloliitto U14 Aluesarja';

  const homeRoster: TeamSquadRoster = {
    teamName: homeTeam,
    coachName: 'Mikael Salo',
    players: [
      { jerseyNumber: 1, playerName: 'Emma Korhonen', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 4, playerName: 'Venla Mäkelä', position: 'DF', goals: 1, assists: 2, matchesPlayed: 8, yellowCards: 1, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 6, playerName: 'Kerttu Lahtinen', position: 'DF', goals: 0, assists: 1, matchesPlayed: 7, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 8, playerName: 'Aada Koskinen', position: 'MF', goals: 4, assists: 6, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 10, playerName: 'Maija Oinonen', position: 'FW', goals: 11, assists: 4, matchesPlayed: 8, yellowCards: 1, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 11, playerName: 'Sofia Nieminen', position: 'FW', goals: 6, assists: 3, matchesPlayed: 7, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 14, playerName: 'Helmi Järvinen', position: 'MF', goals: 3, assists: 2, matchesPlayed: 6, yellowCards: 0, redCards: 0, isStartingLineup: false },
      { jerseyNumber: 19, playerName: 'Iida Heikkinen', position: 'DF', goals: 0, assists: 0, matchesPlayed: 5, yellowCards: 0, redCards: 0, isStartingLineup: false }
    ]
  };

  const awayRoster: TeamSquadRoster = {
    teamName: awayTeam || 'EPS Valkoinen',
    coachName: 'Jari Virtanen',
    players: [
      { jerseyNumber: 12, playerName: 'Lotta Rantanen', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 3, playerName: 'Alisa Kivi', position: 'DF', goals: 0, assists: 1, matchesPlayed: 8, yellowCards: 2, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 5, playerName: 'Oona Lehto', position: 'DF', goals: 1, assists: 0, matchesPlayed: 7, yellowCards: 1, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 7, playerName: 'Minea Vainio', position: 'MF', goals: 3, assists: 4, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 9, playerName: 'Ella Virtanen', position: 'FW', goals: 7, assists: 2, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 13, playerName: 'Sara Aalto', position: 'MF', goals: 2, assists: 1, matchesPlayed: 6, yellowCards: 1, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 16, playerName: 'Emilia Tuominen', position: 'FW', goals: 1, assists: 0, matchesPlayed: 5, yellowCards: 0, redCards: 0, isStartingLineup: false }
    ]
  };

  const honkaRoster: TeamSquadRoster = {
    teamName: 'FC Honka Musta',
    coachName: 'Sami Hyypiä',
    players: [
      { jerseyNumber: 1, playerName: 'Nea Saarinen', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 7, playerName: 'Aada Korhonen', position: 'FW', goals: 9, assists: 5, matchesPlayed: 8, yellowCards: 1, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 10, playerName: 'Inka Lindroos', position: 'MF', goals: 5, assists: 4, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 15, playerName: 'Roosa Laine', position: 'DF', goals: 2, assists: 1, matchesPlayed: 7, yellowCards: 2, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 22, playerName: 'Vilma Jokinen', position: 'MF', goals: 3, assists: 3, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true }
    ]
  };

  const vjsRoster: TeamSquadRoster = {
    teamName: 'VJS Tytöt',
    coachName: 'Petri Tiainen',
    players: [
      { jerseyNumber: 1, playerName: 'Pihla Rantala', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 11, playerName: 'Siiri Lehtonen', position: 'FW', goals: 5, assists: 2, matchesPlayed: 8, yellowCards: 0, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 8, playerName: 'Fanny Ekman', position: 'MF', goals: 3, assists: 3, matchesPlayed: 8, yellowCards: 1, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 4, playerName: 'Alma Vuorela', position: 'DF', goals: 1, assists: 0, matchesPlayed: 7, yellowCards: 1, redCards: 0, isStartingLineup: true }
    ]
  };

  const ppjRoster: TeamSquadRoster = {
    teamName: 'PPJ Sininen',
    coachName: 'Kari Martonen',
    players: [
      { jerseyNumber: 1, playerName: 'Lilli Hämäläinen', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 9, playerName: 'Mila Rautiainen', position: 'FW', goals: 4, assists: 1, matchesPlayed: 8, yellowCards: 0, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 14, playerName: 'Nelli Toivonen', position: 'MF', goals: 2, assists: 2, matchesPlayed: 7, yellowCards: 2, redCards: 0, isStartingLineup: true }
    ]
  };

  const valttiRoster: TeamSquadRoster = {
    teamName: 'Valtti/IHK YJ',
    coachName: 'Antti Muurinen',
    players: [
      { jerseyNumber: 1, playerName: 'Lumi Peltonen', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 10, playerName: 'Enni Karjalainen', position: 'FW', goals: 2, assists: 1, matchesPlayed: 8, yellowCards: 1, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 5, playerName: 'Hilla Mattila', position: 'DF', goals: 1, assists: 0, matchesPlayed: 8, yellowCards: 1, redCards: 0, isStartingLineup: true }
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
    liveScore: {
      home: 2,
      away: 1,
      isLive: false,
      period: 'Päättynyt'
    },
    goalsTimeline: [
      { minute: 14, player: 'Maija Oinonen', team: 'home', assistPlayer: 'Aada K.' },
      { minute: 31, player: 'Ella Virtanen', team: 'away', isPenalty: false },
      { minute: 58, player: 'Sofia Nieminen', team: 'home', assistPlayer: 'Maija Oinonen' }
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
      { rank: 1, playerName: 'Maija Oinonen', teamName: homeTeam, goals: 11, matchesPlayed: 8 },
      { rank: 2, playerName: 'Aada Korhonen', teamName: 'FC Honka Musta', goals: 9, matchesPlayed: 8 },
      { rank: 3, playerName: 'Ella Virtanen', teamName: awayTeam || 'EPS Valkoinen', goals: 7, matchesPlayed: 8 },
      { rank: 4, playerName: 'Sofia Nieminen', teamName: homeTeam, goals: 6, matchesPlayed: 7 },
      { rank: 5, playerName: 'Siiri Lehtonen', teamName: 'VJS Tytöt', goals: 5, matchesPlayed: 8 }
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
      },
      {
        opponentName: 'VJS Tytöt',
        homeResult: { result: 'win', score: '4 - 0' },
        awayResult: { result: 'win', score: '2 - 1' }
      },
      {
        opponentName: 'PPJ Sininen',
        homeResult: { result: 'win', score: '5 - 1' },
        awayResult: { result: 'draw', score: '2 - 2' }
      }
    ],
    squadRosters: {
      home: homeRoster,
      away: awayRoster
    },
    divisionRosters,
    scoutAnalysis: `${homeTeam} johtaa sarjaa tappiottomalla tilastolla (7V-1T-0H). ${awayTeam || 'Vastustaja'} on vaarallinen vastaiskujoukkue, jonka ykköshyökkääjä Ella Virtanen on tehnyt 7 maalia tällä kaudella.`
  };
}
