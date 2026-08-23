import type {
  AssociationType,
  FullMatchStats,
  HeadToHeadMatch,
  OfficialLeagueFixture,
  OfficialTeamData,
  ParsedAssociationUrl,
  PlayerDetailedStats,
  SportType,
  StandingRow,
  TeamSquadRoster,
  TopScorer,
} from "../../types/matchday";
import { proxiedUrl } from "./proxyUrl";

/** Public SPA keys used by official tulospalvelu frontends. */
const TUPA_KEY = "tpqgz8ddy2rt9w8xuyxr";

const ENDPOINTS: Partial<
  Record<AssociationType, { base: string; apiKey: string }>
> = {
  palloliitto: {
    base: "https://spl.torneopal.fi/taso/rest",
    apiKey: "4h7dznqdxwtp3hsfdyf5r793uahfxy7x",
  },
  salibandy: {
    base: "https://salibandy-api.torneopal.net/taso/rest",
    apiKey: "zsn3anknxzcfzc23k53jqdcd4pymutsf",
  },
  basket: {
    base: "https://tupa.api.torneopal.com/taso/rest",
    apiKey: TUPA_KEY,
  },
  torneopal: {
    base: "https://tupa.api.torneopal.com/taso/rest",
    apiKey: TUPA_KEY,
  },
};

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

function namesMatch(a: string, b: string): boolean {
  const n = (s: string) =>
    s
      .toLowerCase()
      .replace(/[./_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  const na = n(a);
  const nb = n(b);
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
}

function finnishIso(dateStr: string, timeStr: string): string {
  const date = str(dateStr);
  const time = str(timeStr) || "12:00:00";
  if (!date) return new Date().toISOString();
  const hhmm = time.length === 5 ? `${time}:00` : time;
  const offset = isFinnishSummerTime(date) ? "+03:00" : "+02:00";
  const iso = `${date}T${hhmm}${offset}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : iso;
}

function isFinnishSummerTime(dateStr: string): boolean {
  const d = new Date(`${dateStr}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return true;
  const year = d.getUTCFullYear();
  const march = new Date(Date.UTC(year, 2, 31));
  const oct = new Date(Date.UTC(year, 9, 31));
  const lastSunMarch = new Date(Date.UTC(year, 2, 31 - march.getUTCDay(), 1));
  const lastSunOct = new Date(Date.UTC(year, 9, 31 - oct.getUTCDay(), 1));
  const t = d.getTime();
  return t >= lastSunMarch.getTime() && t < lastSunOct.getTime();
}

async function torneopalGet<T>(
  association: AssociationType,
  method: string,
  params: Record<string, string>,
  subdomain?: string
): Promise<T | null> {
  const endpoint = ENDPOINTS[association];
  const attempts: Array<{ base: string; apiKey: string }> = [];
  if (subdomain) {
    attempts.push({
      base: `https://${subdomain}.torneopal.fi/taso/rest`,
      apiKey: TUPA_KEY,
    });
  }
  if (endpoint) attempts.push(endpoint);

  for (const ep of attempts) {
    const search = new URLSearchParams({
      api_key: ep.apiKey,
      ...params,
    });
    const url = `${ep.base}/${method}?${search.toString()}`;

    try {
      const res = await fetch(proxiedUrl(url), {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text) continue;
      let json: T & { call?: { status?: string } };
      try {
        json = JSON.parse(text) as T & { call?: { status?: string } };
      } catch {
        continue;
      }
      if (json && typeof json === "object" && json.call?.status && json.call.status !== "ok") {
        continue;
      }
      return json;
    } catch (err) {
      console.warn("[PELIPAIVA:TORNEOPAL]", method, err);
    }
  }
  return null;
}

interface TorneopalTeamPayload {
  team?: Record<string, unknown>;
}

interface TorneopalMatchesPayload {
  matches?: Record<string, unknown>[];
}

interface TorneopalGroupPayload {
  group?: Record<string, unknown>;
}

function isActivePlayer(player: Record<string, unknown>): boolean {
  if (str(player.inactive) === "1") return false;
  const removed = str(player.removed);
  if (removed && !removed.startsWith("0000")) {
    const when = new Date(removed.replace(" ", "T"));
    if (!Number.isNaN(when.getTime()) && when.getTime() < Date.now()) return false;
  }
  return true;
}

function mapPosition(raw: string): PlayerDetailedStats["position"] {
  const p = raw.toLowerCase();
  if (/maalivahti|mv|gk|goal/.test(p)) return "GK";
  if (/puolust|back|df|pak/.test(p)) return "DF";
  if (/hyökk|forward|fw|laituri/.test(p)) return "FW";
  return "MF";
}

function blankStanding(teamName: string): StandingRow {
  return {
    rank: 0,
    teamName,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
    form: [],
  };
}

function mapStanding(row: Record<string, unknown>): StandingRow {
  return {
    rank: num(row.current_standing),
    teamName: str(row.team_name),
    played: num(row.matches_played),
    won: num(row.matches_won),
    drawn: num(row.matches_tied),
    lost: num(row.matches_lost),
    goalsFor: num(row.goals_for),
    goalsAgainst: num(row.goals_against),
    goalDifference: num(row.goals_diff),
    points: num(row.points),
    form: [],
  };
}

function pickCurrentGroup(groups: Record<string, unknown>[]): Record<string, unknown> | null {
  const published = groups.filter((g) => str(g.competition_status) === "published");
  const pool = published.length > 0 ? published : groups;
  return (
    pool.find((g) => str(g.group_current) === "1") ||
    pool[0] ||
    null
  );
}

function mapFixture(
  match: Record<string, unknown>,
  parsed: ParsedAssociationUrl,
  teamName: string
): OfficialLeagueFixture {
  const home = str(match.team_A_name);
  const away = str(match.team_B_name);
  const statusRaw = str(match.status).toLowerCase();
  const status: OfficialLeagueFixture["status"] =
    statusRaw === "played"
      ? "played"
      : statusRaw === "cancelled" || statusRaw === "forfeit"
        ? "cancelled"
        : statusRaw === "postponed"
          ? "postponed"
          : "upcoming";
  const homeScore = str(match.fs_A) === "" ? undefined : num(match.fs_A);
  const awayScore = str(match.fs_B) === "" ? undefined : num(match.fs_B);
  const lat = num(match.venue_lat);
  const lng = num(match.venue_lon);
  const startTime = finnishIso(str(match.date), str(match.time));
  const durationMin = num(match.playing_time_min) || 90;
  const endTime = new Date(new Date(startTime).getTime() + durationMin * 60 * 1000).toISOString();
  const matchId = str(match.match_id);

  return {
    id: `${parsed.association}_${parsed.teamId}_${matchId || str(match.date)}`,
    teamId: parsed.teamId,
    association: parsed.association,
    sport: parsed.sport,
    leagueName: str(match.competition_name) || [str(match.category_name), str(match.group_name)].filter(Boolean).join(" · "),
    homeTeam: home,
    awayTeam: away,
    isHome: namesMatch(home, teamName) || str(match.team_A_id) === parsed.teamId,
    startTime,
    endTime,
    venueName: str(match.venue_name) || "Kenttä ilmoitetaan",
    venueLat: lat || undefined,
    venueLng: lng || undefined,
    venueCity: str(match.venue_city_name) || undefined,
    competitionId: str(match.competition_id) || undefined,
    categoryId: str(match.category_id) || undefined,
    groupId: str(match.group_id) || undefined,
    status,
    score:
      homeScore != null && awayScore != null ? `${homeScore}–${awayScore}` : undefined,
    homeScore,
    awayScore,
    officialMatchUrl: parsed.canonicalUrl,
    matchId,
    round: str(match.round_name) || undefined,
    fetchedAt: new Date().toISOString(),
  };
}

function mapRoster(
  team: Record<string, unknown>,
  teamName: string
): TeamSquadRoster {
  const playersRaw = Array.isArray(team.players) ? (team.players as Record<string, unknown>[]) : [];
  const players: PlayerDetailedStats[] = playersRaw
    .filter(isActivePlayer)
    .map((p) => ({
      jerseyNumber: num(p.shirt_number),
      playerName: `${str(p.first_name)} ${str(p.last_name)}`.trim(),
      position: mapPosition(str(p.position_fi) || str(p.position) || str(p.position_en)),
      goals: num(p.goals),
      assists: num(p.assists),
      matchesPlayed: num(p.matches_played) || num(p.matches),
      yellowCards: num(p.warnings) || num(p.yellow_cards),
      redCards: num(p.suspensions) || num(p.red_cards),
      isCaptain: str(p.captain) === "1" || str(p.captain).toLowerCase() === "yes",
      isStartingLineup: undefined,
    }))
    .filter((p) => p.playerName.length > 0)
    .sort((a, b) => a.jerseyNumber - b.jerseyNumber);

  const coaches = Array.isArray(team.officials_paavalmentaja)
    ? (team.officials_paavalmentaja as Record<string, unknown>[])
    : [];
  const coach = coaches[0];
  const coachName = coach
    ? `${str(coach.first_name)} ${str(coach.last_name)}`.trim()
    : undefined;

  return { teamName, coachName, players };
}

function mapTopScorers(group: Record<string, unknown>): TopScorer[] {
  const stats = Array.isArray(group.player_statistics)
    ? (group.player_statistics as Record<string, unknown>[])
    : [];
  return stats
    .map((p) => ({
      rank: num(p.standing),
      playerName: str(p.player_name) || `${str(p.first_name)} ${str(p.last_name)}`.trim(),
      teamName: str(p.team_name),
      goals: num(p.goals),
      matchesPlayed: num(p.matches_played) || num(p.matches),
    }))
    .filter((p) => p.goals > 0 && p.playerName)
    .sort((a, b) => b.goals - a.goals || a.playerName.localeCompare(b.playerName, "fi"))
    .slice(0, 15)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

export async function fetchTorneopalTeamData(
  parsed: ParsedAssociationUrl
): Promise<OfficialTeamData | null> {
  const teamJson = await torneopalGet<TorneopalTeamPayload>(
    parsed.association,
    "getTeam",
    { team_id: parsed.teamId },
    parsed.subdomain
  );
  const team = teamJson?.team;
  if (!team) return null;

  const teamName = str(team.team_name) || `Joukkue ${parsed.teamId}`;
  const groups = Array.isArray(team.groups) ? (team.groups as Record<string, unknown>[]) : [];
  const currentGroup = pickCurrentGroup(groups);

  const today = new Date();
  const start = new Date(today.getTime() - 21 * 86400000).toISOString().slice(0, 10);
  const end = new Date(today.getTime() + 90 * 86400000).toISOString().slice(0, 10);

  const matchParams: Record<string, string> = {
    team_id: parsed.teamId,
    start_date: start,
    end_date: end,
  };
  if (parsed.seasonId) matchParams.competition_id = parsed.seasonId;
  if (parsed.leagueId) matchParams.category_id = parsed.leagueId;

  const [matchesJson, groupJson] = await Promise.all([
    torneopalGet<TorneopalMatchesPayload>(parsed.association, "getMatches", matchParams, parsed.subdomain),
    currentGroup
      ? torneopalGet<TorneopalGroupPayload>(
          parsed.association,
          "getGroup",
          {
            competition_id: str(currentGroup.competition_id) || parsed.seasonId || "",
            category_id: str(currentGroup.category_id) || parsed.leagueId || "",
            group_id: str(currentGroup.group_id),
          },
          parsed.subdomain
        )
      : Promise.resolve(null),
  ]);

  const fixtures = (matchesJson?.matches || []).map((m) => mapFixture(m, parsed, teamName));
  const group = groupJson?.group || {};
  const teamRows = Array.isArray(group.teams) ? (group.teams as Record<string, unknown>[]) : [];
  const standings = teamRows.map(mapStanding).filter((r) => r.teamName);
  const roster = mapRoster(team, teamName);
  const leagueName =
    str(currentGroup?.competition_name) ||
    str(group.competition_name) ||
    str(currentGroup?.category_name) ||
    str(group.category_name) ||
    fixtures[0]?.leagueName ||
    "Sarja";

  return {
    teamId: parsed.teamId,
    association: parsed.association,
    sport: parsed.sport,
    teamName,
    leagueName,
    fixtures,
    standings: standings.length > 0 ? standings : undefined,
    roster: roster.players.length > 0 ? roster : undefined,
    divisionRosters: roster.players.length > 0 ? { [teamName]: roster } : undefined,
    topScorers: mapTopScorers(group),
    competitionId: str(currentGroup?.competition_id) || undefined,
    categoryId: str(currentGroup?.category_id) || undefined,
    groupId: str(currentGroup?.group_id) || undefined,
    sourceUrl: parsed.canonicalUrl,
    fetchedAt: new Date().toISOString(),
  };
}

export function buildMatchStatsFromOfficial(
  data: OfficialTeamData,
  fixture: OfficialLeagueFixture
): FullMatchStats | undefined {
  const table = data.standings ?? [];
  const homeStanding =
    table.find((r) => namesMatch(r.teamName, fixture.homeTeam)) ?? blankStanding(fixture.homeTeam);
  const awayStanding =
    table.find((r) => namesMatch(r.teamName, fixture.awayTeam)) ?? blankStanding(fixture.awayTeam);

  const ourRoster = data.roster;
  const squadRosters = {
    home: fixture.isHome ? ourRoster : undefined,
    away: fixture.isHome ? undefined : ourRoster,
  };

  const playedPair = (data.fixtures || []).filter((f) => {
    if (f.status !== "played" || f.homeScore == null || f.awayScore == null) return false;
    const same =
      (namesMatch(f.homeTeam, fixture.homeTeam) && namesMatch(f.awayTeam, fixture.awayTeam)) ||
      (namesMatch(f.homeTeam, fixture.awayTeam) && namesMatch(f.awayTeam, fixture.homeTeam));
    return same;
  });

  const headToHeadHistory: HeadToHeadMatch[] = playedPair.map((f) => ({
    date: f.startTime.slice(0, 10),
    competition: f.leagueName,
    homeTeam: f.homeTeam,
    awayTeam: f.awayTeam,
    homeScore: f.homeScore ?? 0,
    awayScore: f.awayScore ?? 0,
  }));

  const hasScore = fixture.homeScore != null && fixture.awayScore != null;
  const liveScore = hasScore
    ? {
        home: fixture.homeScore as number,
        away: fixture.awayScore as number,
        isLive: false,
        period: fixture.status === "played" ? "Pelattu" : "Tulos",
      }
    : undefined;

  const hasAnything =
    table.length > 0 ||
    (ourRoster && ourRoster.players.length > 0) ||
    (data.topScorers && data.topScorers.length > 0) ||
    headToHeadHistory.length > 0 ||
    Boolean(liveScore);

  if (!hasAnything) return undefined;

  return {
    leagueName: fixture.leagueName || data.leagueName || "Sarja",
    round: fixture.round,
    scoreType: data.sport === "volleyball" ? "sets" : data.sport === "basketball" ? "points" : "goals",
    liveScore,
    goalsTimeline: [],
    homeStanding,
    awayStanding,
    standingsTable: table,
    topScorers: data.topScorers ?? [],
    headToHeadHistory,
    commonOpponents: [],
    squadRosters: {
      home: squadRosters.home ?? { teamName: fixture.homeTeam, players: [] },
      away: squadRosters.away ?? { teamName: fixture.awayTeam, players: [] },
    },
    divisionRosters: data.divisionRosters ?? {},
    scoutAnalysis: "",
  };
}

export function hasRenderableStats(stats?: FullMatchStats): boolean {
  if (!stats) return false;
  return Boolean(
    stats.standingsTable?.length ||
      stats.topScorers?.length ||
      stats.headToHeadHistory?.length ||
      stats.squadRosters?.home?.players?.length ||
      stats.squadRosters?.away?.players?.length ||
      stats.liveScore ||
      stats.teamStats
  );
}

export function sportLabel(sport: SportType): string {
  switch (sport) {
    case "football":
      return "Jalkapallo";
    case "floorball":
      return "Salibandy";
    case "basketball":
      return "Koripallo";
    case "volleyball":
      return "Lentopallo";
    case "icehockey":
      return "Jääkiekko";
    case "futsal":
      return "Futsal";
    case "training":
      return "Harjoitus";
    default:
      return "Ottelu";
  }
}
