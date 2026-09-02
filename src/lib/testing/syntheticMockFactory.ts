import { parseFinnishDateTime } from "../api/associationUrlParser";
import type {
  ParsedAssociationUrl,
  OfficialTeamData,
  OfficialLeagueFixture,
  StandingRow,
  TeamSquadRoster,
  } from "../../types/matchday";

/**
 * Synthetic official team data generator for offline resilience, testing, and fallback.
 */
export function generateSyntheticOfficialTeamData(
  parsedUrl: ParsedAssociationUrl,
  customTeamName?: string
): OfficialTeamData {
  const { teamId, association, sport, canonicalUrl, subdomain } = parsedUrl;
  const now = new Date().toISOString();

  // Determine team name from teamId or customTeamName
  let teamName = customTeamName || (teamId === '3512345' ? 'HJK T13 Sininen' : 'PPJ Laru Sininen');
  let leagueName = 'Palloliitto Taso 1';
  let defaultVenue = 'Väinämöisen kenttä (Väiski)';

  if (teamId === '3512345') {
    teamName = customTeamName || 'HJK T13 Sininen';
    leagueName = 'Palloliitto T13 Eteläinen Ykkönen';
    defaultVenue = 'Töölö PK 1 TN (Kenttä 1)';
  } else if (teamId === '185085') {
    teamName = 'PPJ Laru Sininen';
    leagueName = 'Palloliitto P11 Ykkönen';
    defaultVenue = 'Väinämöisen kenttä (Väiski)';
  } else if (teamId === '185083') {
    teamName = 'PPJ Laru Valkoinen';
    leagueName = 'Palloliitto P11 Kakkonen';
    defaultVenue = 'Lauttasaaren urheilukenttä (Pyrkkä)';
  } else if (teamId === '185086') {
    teamName = 'PPJ Laru Oranssi';
    leagueName = 'Palloliitto P11 Kolmonen';
    defaultVenue = 'Hernesaaren kupla';
  } else if (teamId === '203621' || subdomain?.includes('espooliikkuu') || canonicalUrl.includes('espooliikkuu')) {
    teamName = customTeamName && !/basket\.fi/i.test(customTeamName) ? customTeamName : 'TOPOLA';
    leagueName = 'Espoo Liikkuu Tournament 2026';
    defaultVenue = 'Esport Center 2';

    const fixtures: OfficialLeagueFixture[] = [
      {
        id: `${association}_${teamId}_234`,
        matchId: '234',
        teamId,
        association,
        sport: 'basketball',
        leagueName,
        homeTeam: 'EBT',
        awayTeam: 'TOPOLA',
        isHome: false,
        startTime: '2026-08-22T09:45:00+03:00',
        venueName: 'Esport Center 2',
        fieldNumber: 'Kenttä 2',
        status: 'played',
        homeScore: 6,
        awayScore: 52,
        score: '6–52',
        round: 'Girls 2015 Fun / B',
        fetchedAt: now
      },
      {
        id: `${association}_${teamId}_474`,
        matchId: '474',
        teamId,
        association,
        sport: 'basketball',
        leagueName,
        homeTeam: 'TOPOLA',
        awayTeam: 'Jymy',
        isHome: true,
        startTime: '2026-08-22T15:00:00+03:00',
        venueName: 'Esport Center 2',
        fieldNumber: 'Kenttä 2',
        status: 'played',
        homeScore: 55,
        awayScore: 6,
        score: '55–6',
        round: 'Girls 2015 Fun / B',
        fetchedAt: now
      },
      {
        id: `${association}_${teamId}_780`,
        matchId: '780',
        teamId,
        association,
        sport: 'basketball',
        leagueName,
        homeTeam: 'TOPOLA',
        awayTeam: 'Helmi Basket/Valkoinen',
        isHome: true,
        startTime: '2026-08-23T10:30:00+03:00',
        venueName: 'Esport Center 2',
        fieldNumber: 'Kenttä 2',
        status: 'played',
        homeScore: 28,
        awayScore: 14,
        score: '28–14',
        round: 'Girls 2015 Fun / 1-4',
        fetchedAt: now
      },
      {
        id: `${association}_${teamId}_1055`,
        matchId: '1055',
        teamId,
        association,
        sport: 'basketball',
        leagueName,
        homeTeam: 'LINKKI',
        awayTeam: 'TOPOLA',
        isHome: false,
        startTime: '2026-08-23T14:00:00+03:00',
        venueName: 'Esport Center 2',
        fieldNumber: 'Kenttä 2',
        status: 'played',
        homeScore: 9,
        awayScore: 45,
        score: '9–45',
        round: 'Girls 2015 Fun / 1-4',
        fetchedAt: now
      }
    ];

    const standings: StandingRow[] = [
      { rank: 1, teamName: 'TOPOLA', played: 2, won: 2, drawn: 0, lost: 0, goalsFor: 107, goalsAgainst: 12, goalDifference: 95, points: 4, form: ['W', 'W'] },
      { rank: 2, teamName: 'EBT', played: 2, won: 1, drawn: 0, lost: 1, goalsFor: 48, goalsAgainst: 70, goalDifference: -22, points: 2, form: ['L', 'W'] },
      { rank: 3, teamName: 'Jymy', played: 2, won: 0, drawn: 0, lost: 2, goalsFor: 24, goalsAgainst: 97, goalDifference: -73, points: 0, form: ['L', 'L'] }
    ];

    const roster: TeamSquadRoster = {
      teamName: 'TOPOLA',
      coachName: 'Valmentaja (Jojo)',
      players: [
        { jerseyNumber: 2, playerName: 'Pelaaja 2', position: 'MF', goals: 0, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 3, playerName: 'Pelaaja 3', position: 'FW', goals: 0, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 5, playerName: 'Pelaaja 5', position: 'MF', goals: 4, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 8, playerName: 'Pelaaja 8', position: 'FW', goals: 12, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isCaptain: true, isStartingLineup: true },
        { jerseyNumber: 12, playerName: 'Pelaaja 12', position: 'DF', goals: 3, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 13, playerName: 'Pelaaja 13', position: 'DF', goals: 4, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 20, playerName: 'Pelaaja 20', position: 'FW', goals: 8, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 22, playerName: 'Pelaaja 22', position: 'FW', goals: 14, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true }
      ]
    };

    const linkkiRoster: TeamSquadRoster = {
      teamName: 'LINKKI',
      coachName: 'Valmentaja M.',
      players: [
        { jerseyNumber: 0, playerName: 'Pelaaja 0', position: 'GK', goals: 0, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 5, playerName: 'Pelaaja 5', position: 'DF', goals: 0, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 6, playerName: 'Pelaaja 6', position: 'MF', goals: 2, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 8, playerName: 'Pelaaja 8', position: 'FW', goals: 2, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 22, playerName: 'Pelaaja 22', position: 'FW', goals: 2, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 23, playerName: 'Pelaaja 23', position: 'MF', goals: 1, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 31, playerName: 'Pelaaja 31', position: 'DF', goals: 0, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 36, playerName: 'Pelaaja 36', position: 'DF', goals: 2, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 39, playerName: 'Pelaaja 39', position: 'MF', goals: 0, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 54, playerName: 'Pelaaja 54', position: 'FW', goals: 0, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 55, playerName: 'Pelaaja 55', position: 'GK', goals: 0, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true }
      ]
    };

    return {
      teamId,
      teamName,
      association,
      sport: 'basketball',
      leagueName,
      fixtures,
      standings,
      roster,
      divisionRosters: {
        [teamName]: roster,
        LINKKI: linkkiRoster
      },
      sourceUrl: canonicalUrl,
      fetchedAt: now
    };
  } else if (teamId === '34013' || subdomain?.includes('kwmemorial')) {
    teamName = customTeamName && !/salibandy|joukkue/i.test(customTeamName) ? customTeamName : 'Indians';
    leagueName = 'KW Memorial Cup 2026 (P14 Haastaja)';
    defaultVenue = 'Arena Center Myllypuro (Kenttä 6)';

    const fixtures: OfficialLeagueFixture[] = [
      {
        id: `${association}_${teamId}_222`,
        matchId: '222',
        teamId,
        association,
        sport: 'floorball',
        leagueName,
        homeTeam: 'Indians',
        awayTeam: 'Oilers NG White',
        isHome: true,
        startTime: '2026-08-22T10:00:00+03:00',
        venueName: 'Arena Center Myllypuro (Kenttä 6)',
        fieldNumber: 'Kenttä 6',
        status: 'played',
        homeScore: 2,
        awayScore: 12,
        score: '2–12',
        round: 'P14 Haastaja Lohko B',
        fetchedAt: now
      },
      {
        id: `${association}_${teamId}_221`,
        matchId: '221',
        teamId,
        association,
        sport: 'floorball',
        leagueName,
        homeTeam: 'RSS Panthers',
        awayTeam: 'Indians',
        isHome: false,
        startTime: '2026-08-22T13:00:00+03:00',
        venueName: 'Arena Center Myllypuro (Kenttä 6)',
        fieldNumber: 'Kenttä 6',
        status: 'played',
        homeScore: 4,
        awayScore: 9,
        score: '4–9',
        round: 'P14 Haastaja Lohko B',
        fetchedAt: now
      },
      {
        id: `${association}_${teamId}_224`,
        matchId: '224',
        teamId,
        association,
        sport: 'floorball',
        leagueName,
        homeTeam: 'FBC Turku',
        awayTeam: 'Indians',
        isHome: false,
        startTime: '2026-08-23T11:15:00+03:00',
        venueName: 'Arena Center Myllypuro (Kenttä 6)',
        fieldNumber: 'Kenttä 6',
        status: 'played',
        homeScore: 7,
        awayScore: 3,
        score: '7–3',
        round: 'Jatko-ottelut',
        fetchedAt: now
      },
      {
        id: `${association}_${teamId}_227`,
        matchId: '227',
        teamId,
        association,
        sport: 'floorball',
        leagueName,
        homeTeam: 'Indians',
        awayTeam: 'EräViikingit',
        isHome: true,
        startTime: '2026-08-23T14:30:00+03:00',
        venueName: 'Arena Center Myllypuro (Kenttä 6)',
        fieldNumber: 'Kenttä 6',
        status: 'played',
        homeScore: 12,
        awayScore: 8,
        score: '12–8',
        round: 'Jatko-ottelut',
        fetchedAt: now
      }
    ];

    const standings: StandingRow[] = [
      { rank: 1, teamName: 'Oilers NG White', played: 2, won: 2, drawn: 0, lost: 0, goalsFor: 25, goalsAgainst: 3, goalDifference: 22, points: 4, form: ['W', 'W'] },
      { rank: 2, teamName: 'Indians', played: 2, won: 1, drawn: 0, lost: 1, goalsFor: 11, goalsAgainst: 16, goalDifference: -5, points: 2, form: ['L', 'W'] },
      { rank: 3, teamName: 'RSS Panthers', played: 2, won: 0, drawn: 0, lost: 2, goalsFor: 5, goalsAgainst: 22, goalDifference: -17, points: 0, form: ['L', 'L'] }
    ];

    const roster: TeamSquadRoster = {
      teamName: 'Indians',
      coachName: 'Valmentaja M.',
      players: [
        { jerseyNumber: 3, playerName: 'Pelaaja 3', position: 'GK', goals: 0, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 4, playerName: 'Pelaaja 4', position: 'FW', goals: 5, assists: 2, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 7, playerName: 'Pelaaja 7', position: 'FW', goals: 0, assists: 3, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 9, playerName: 'Pelaaja 9', position: 'DF', goals: 0, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 13, playerName: 'Pelaaja 13', position: 'DF', goals: 2, assists: 3, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 17, playerName: 'Pelaaja 17', position: 'FW', goals: 2, assists: 2, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 21, playerName: 'Pelaaja 21', position: 'DF', goals: 3, assists: 3, matchesPlayed: 4, yellowCards: 0, redCards: 0, isCaptain: true, isStartingLineup: true },
        { jerseyNumber: 25, playerName: 'Pelaaja 25', position: 'MF', goals: 3, assists: 1, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 29, playerName: 'Pelaaja 29', position: 'MF', goals: 0, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 30, playerName: 'Pelaaja 30', position: 'DF', goals: 0, assists: 1, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 37, playerName: 'Pelaaja 37', position: 'FW', goals: 3, assists: 2, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 55, playerName: 'Pelaaja 55', position: 'FW', goals: 3, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 64, playerName: 'Pelaaja 64', position: 'GK', goals: 0, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 71, playerName: 'Pelaaja 71', position: 'FW', goals: 2, assists: 1, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 74, playerName: 'Pelaaja 74', position: 'DF', goals: 1, assists: 3, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 97, playerName: 'Pelaaja 97', position: 'FW', goals: 2, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true },
        { jerseyNumber: 98, playerName: 'Pelaaja 98', position: 'DF', goals: 0, assists: 0, matchesPlayed: 4, yellowCards: 0, redCards: 0, isStartingLineup: true }
      ]
    };

    return {
      teamId,
      teamName,
      association,
      sport: 'floorball',
      leagueName,
      fixtures,
      standings,
      roster,
      divisionRosters: { [teamName]: roster },
      sourceUrl: canonicalUrl,
      fetchedAt: now
    };
  } else if (teamId === '25301' || sport === 'floorball') {
    teamName = customTeamName && !/\(\d+\)/.test(customTeamName) ? customTeamName : 'EräViikingit';
    leagueName = 'Salibandyliitto P11 Kilpasarja';
    defaultVenue = 'Tapanilan Mosahalli';
  } else if (teamId === '5756346' || sport === 'basketball') {
    teamName = customTeamName && !/\(\d+\)/.test(customTeamName) ? customTeamName : 'TOPOLA';
    leagueName = 'Koripalloliitto U14 Aluesarja';
    defaultVenue = 'Esport Center 2';
  } else if (sport === 'volleyball') {
    teamName = customTeamName || 'PuMa Volley N2';
    leagueName = 'Lentopalloliitto N2 Lohko 3';
    defaultVenue = 'Puistolan Liikuntahalli';
  }

  // Dynamic upcoming dates for real teams, static 2026-05 for test team 3512345
  const today = new Date();
  const isTestTeam = teamId === '3512345';

  const dToday = isTestTeam ? parseFinnishDateTime('10.05.2026', '15:00') : new Date(today.setHours(16, 30, 0, 0)).toISOString();
  const dTomorrow = isTestTeam ? parseFinnishDateTime('17.05.2026', '13:30') : new Date(new Date().setDate(new Date().getDate() + 1)).toISOString();
  const dDay3 = isTestTeam ? parseFinnishDateTime('24.05.2026', '15:00') : new Date(new Date().setDate(new Date().getDate() + 3)).toISOString();
  const dDay5 = isTestTeam ? parseFinnishDateTime('31.05.2026', '12:00') : new Date(new Date().setDate(new Date().getDate() + 5)).toISOString();

  const opponents =
    sport === 'floorball'
      ? ['Oilers Black', 'Classic', 'TPS Salibandy', 'Indians']
      : sport === 'basketball'
      ? ['Tapiolan Honka', 'EBT', 'HNMKY', 'PuHu Juniorit']
      : ['KäPa Barca', 'FC Honka Musta', 'HJK Sininen', 'EPS Valkoinen'];

  const fixtures: OfficialLeagueFixture[] = [
    {
      id: `${association}_${teamId}_101`,
      matchId: '101',
      teamId,
      association,
      sport,
      leagueName,
      homeTeam: teamName,
      awayTeam: opponents[0] || 'KäPa Barca',
      isHome: true,
      startTime: dToday,
      venueName: defaultVenue,
      fieldNumber: 'Kenttä 1',
      status: 'upcoming',
      fetchedAt: now
    },
    {
      id: `${association}_${teamId}_102`,
      matchId: '102',
      teamId,
      association,
      sport,
      leagueName,
      homeTeam: opponents[1] || 'FC Honka Musta',
      awayTeam: teamName,
      isHome: false,
      startTime: dTomorrow,
      venueName: sport === 'floorball' ? 'Energia Areena' : sport === 'basketball' ? 'Honkahalli' : 'Tapiola 2 TN',
      fieldNumber: 'Kenttä 2',
      status: 'upcoming',
      fetchedAt: now
    },
    {
      id: `${association}_${teamId}_103`,
      matchId: '103',
      teamId,
      association,
      sport,
      leagueName,
      homeTeam: teamName,
      awayTeam: opponents[2] || 'HJK Sininen',
      isHome: true,
      startTime: dDay3,
      venueName: defaultVenue,
      fieldNumber: 'Kenttä 1',
      status: 'upcoming',
      fetchedAt: now
    },
    {
      id: `${association}_${teamId}_104`,
      matchId: '104',
      teamId,
      association,
      sport,
      leagueName,
      homeTeam: opponents[3] || 'EPS Valkoinen',
      awayTeam: teamName,
      isHome: false,
      startTime: dDay5,
      venueName: defaultVenue,
      fieldNumber: 'Kenttä 2',
      status: 'upcoming',
      fetchedAt: now
    }
  ];

  const standings: StandingRow[] = [
    { rank: 1, teamName, played: 8, won: 7, drawn: 1, lost: 0, goalsFor: 28, goalsAgainst: 6, goalDifference: 22, points: 22, form: ['W', 'W', 'W', 'D', 'W'] },
    { rank: 2, teamName: 'FC Honka Musta', played: 8, won: 6, drawn: 0, lost: 2, goalsFor: 24, goalsAgainst: 9, goalDifference: 15, points: 18, form: ['W', 'W', 'L', 'W', 'W'] },
    { rank: 3, teamName: 'EPS Valkoinen', played: 8, won: 5, drawn: 1, lost: 2, goalsFor: 19, goalsAgainst: 11, goalDifference: 8, points: 16, form: ['W', 'L', 'W', 'W', 'D'] },
    { rank: 4, teamName: 'VJS Tytöt', played: 8, won: 3, drawn: 2, lost: 3, goalsFor: 14, goalsAgainst: 16, goalDifference: -2, points: 11, form: ['L', 'D', 'W', 'D', 'L'] },
    { rank: 5, teamName: 'PPJ Sininen', played: 8, won: 2, drawn: 1, lost: 5, goalsFor: 10, goalsAgainst: 21, goalDifference: -11, points: 7, form: ['L', 'L', 'W', 'L', 'D'] },
    { rank: 6, teamName: 'Valtti/IHK YJ', played: 8, won: 0, drawn: 1, lost: 7, goalsFor: 4, goalsAgainst: 36, goalDifference: -32, points: 1, form: ['L', 'L', 'L', 'D', 'L'] }
  ];

  const roster: TeamSquadRoster = {
    teamName,
    coachName: 'Valmentaja M.',
    players: [
      { jerseyNumber: 1, playerName: 'Pelaaja 1', position: 'GK', goals: 0, assists: 0, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 4, playerName: 'Pelaaja 4', position: 'DF', goals: 1, assists: 2, matchesPlayed: 8, yellowCards: 1, redCards: 0, isCaptain: true, isStartingLineup: true },
      { jerseyNumber: 8, playerName: 'Pelaaja 8', position: 'MF', goals: 4, assists: 6, matchesPlayed: 8, yellowCards: 0, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 10, playerName: 'Pelaaja 10', position: 'FW', goals: 11, assists: 4, matchesPlayed: 8, yellowCards: 1, redCards: 0, isStartingLineup: true },
      { jerseyNumber: 11, playerName: 'Pelaaja 11', position: 'FW', goals: 6, assists: 3, matchesPlayed: 7, yellowCards: 0, redCards: 0, isStartingLineup: true }
    ]
  };

  return {
    teamId,
    teamName,
    association,
    sport,
    leagueName,
    fixtures,
    standings,
    roster,
    sourceUrl: canonicalUrl,
    fetchedAt: now
  };
}

/**
 * Extracts official team data from Torneopal JSON first, then HTML.
 * Does not invent fixtures, standings, or rosters.
 */
