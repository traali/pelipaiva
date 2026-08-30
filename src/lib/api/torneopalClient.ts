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
import { helsinkiDateISO, addHelsinkiDays } from "../agents/time";

/** Public SPA keys used by official tulospalvelu frontends. */
const TUPA_KEY = "tpqgz8ddy2rt9w8xuyxr";
const PALL_KEY = "4h7dznqdxwtp3hsfdyf5r793uahfxy7x";
const SALIBANDY_KEY = "zsn3anknxzcfzc23k53jqdcd4pymutsf";

const ENDPOINTS: Partial<
  Record<AssociationType, { base: string; apiKey: string; referer: string }>
> = {
  palloliitto: {
    base: "https://spl.torneopal.net/taso/rest",
    apiKey: PALL_KEY,
    referer: "https://tulospalvelu.palloliitto.fi/",
  },
  salibandy: {
    base: "https://salibandy-api.torneopal.net/taso/rest",
    apiKey: SALIBANDY_KEY,
    referer: "https://tulospalvelu.salibandy.fi/",
  },
  basket: {
    base: "https://koripallo-api.torneopal.net/taso/rest",
    apiKey: TUPA_KEY,
    referer: "https://tulospalvelu.basket.fi/",
  },
  torneopal: {
    base: "https://tupa.api.torneopal.com/taso/rest",
    apiKey: TUPA_KEY,
    referer: "https://tupa.torneopal.fi/",
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

function finnishIso(dateStr: string, timeStr: string): string | null {
  const date = str(dateStr);
  const time = str(timeStr) || "12:00:00";
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const hhmm = time.length === 5 ? `${time}:00` : time;
  const offset = isFinnishSummerTime(date) ? "+03:00" : "+02:00";
  const iso = `${date}T${hhmm}${offset}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : iso;
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

export function isTorneopalCompetitionId(raw?: string): boolean {
  if (!raw) return false;
  return /^[a-z0-9][a-z0-9_-]{1,32}$/i.test(raw);
}

export function looksLikeCupRequest(parsed: ParsedAssociationUrl): boolean {
  const blob = [parsed.canonicalUrl, parsed.seasonId, parsed.subdomain, parsed.leagueId]
    .filter(Boolean)
    .join(" ");
  return /cup|turnaus|tournament|memorial|hc20|esli|kwmemorial|espooliikkuu/i.test(blob);
}

export function shouldTryAssociationEndpoint(subdomain?: string): boolean {
  if (!subdomain) return true;
  return !/memorial|kwmemorial|cup|turnaus/i.test(subdomain);
}

export function buildGetMatchesParams(parsed: ParsedAssociationUrl): Record<string, string> {
  const params: Record<string, string> = { team_id: parsed.teamId, per_page: "100" };
  if (!looksLikeCupRequest(parsed)) {
    const todayIso = helsinkiDateISO();
    params.start_date = addHelsinkiDays(todayIso, -21);
    params.end_date = addHelsinkiDays(todayIso, 90);
  }
  if (parsed.seasonId) params.competition_id = parsed.seasonId;
  if (parsed.leagueId && (/^\d+$/.test(parsed.leagueId) || looksLikeCupRequest(parsed))) {
    params.category_id = parsed.leagueId;
  }
  return params;
}

function federationEndpoint(
  association: AssociationType,
  sport?: SportType
): { base: string; apiKey: string; referer: string } | undefined {
  if (association === "salibandy" || sport === "floorball") return ENDPOINTS.salibandy;
  if (association === "palloliitto" || sport === "football") return ENDPOINTS.palloliitto;
  if (association === "basket" || sport === "basketball") return ENDPOINTS.basket;
  return ENDPOINTS.torneopal;
}

export function listTorneopalAttempts(
  association: AssociationType,
  subdomain?: string,
  sport?: SportType
): Array<{ base: string; apiKey: string; referer: string }> {
  type Attempt = { base: string; apiKey: string; referer: string };
  const attempts: Attempt[] = [];
  const seen = new Set<string>();
  const push = (ep: Attempt | undefined) => {
    if (!ep) return;
    const k = `${ep.base}|${ep.apiKey}`;
    if (seen.has(k)) return;
    seen.add(k);
    attempts.push(ep);
  };

  // Dedicated cup hosts 403 without a matching Referer. Browsers cannot set
  // Referer, and OPTIONS preflight on Accept: json/{key} stalls ingest. Skip
  // those hosts and go straight to the sport federation API.
  if (subdomain && shouldTryAssociationEndpoint(subdomain)) {
    const base = `https://${subdomain}.torneopal.fi/taso/rest`;
    const referer = `https://${subdomain}.torneopal.fi/`;
    if (sport === "floorball" || association === "salibandy") {
      push({ base, apiKey: SALIBANDY_KEY, referer });
      push({ base, apiKey: TUPA_KEY, referer });
      push({ base, apiKey: PALL_KEY, referer });
    } else if (sport === "football" || association === "palloliitto") {
      push({ base, apiKey: PALL_KEY, referer });
      push({ base, apiKey: TUPA_KEY, referer });
      push({ base, apiKey: SALIBANDY_KEY, referer });
    } else {
      push({ base, apiKey: TUPA_KEY, referer });
      push({ base, apiKey: SALIBANDY_KEY, referer });
      push({ base, apiKey: PALL_KEY, referer });
    }
  }
  push(federationEndpoint(association, sport));
  return attempts;
}

async function torneopalGet<T>(
  association: AssociationType,
  method: string,
  params: Record<string, string>,
  subdomain?: string,
  sport?: SportType
): Promise<T | null> {
  const attempts = listTorneopalAttempts(association, subdomain, sport);

  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v) clean[k] = v;
  }

  // Overall deadline: 4 endpoints × 10 s each could hang ingest ~40 s. Cap the
  // whole attempt sequence at 25 s so refresh/join UIs stay responsive (M-25/V45).
  const deadline = Date.now() + 25_000;

  for (const ep of attempts) {
    const remaining = deadline - Date.now();
    if (remaining <= 500) break;
    const search = new URLSearchParams(clean);
    const url = `${ep.base}/${method}?${search.toString()}`;

    try {
      const res = await fetch(url, {
        headers: {
          Accept: `json/${ep.apiKey}`,
          Referer: ep.referer,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        },
        referrerPolicy: "origin",
        signal: AbortSignal.timeout(Math.min(10000, remaining)),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text || text === "no access" || text.startsWith("Not allowed")) continue;
      let json: T & { call?: { status?: string } };
      try {
        json = JSON.parse(text) as T & { call?: { status?: string } };
      } catch {
        continue;
      }
      if (!json || typeof json !== "object") continue;
      if (json.call?.status && json.call.status !== "ok") continue;
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

interface TorneopalGroupsPayload {
  groups?: Record<string, unknown>[];
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

export function mapFixture(
  match: Record<string, unknown>,
  parsed: ParsedAssociationUrl,
  teamName: string
): OfficialLeagueFixture | null {
  const startTime = finnishIso(str(match.date), str(match.time));
  if (!startTime) return null;
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
    round: str(match.round_name) || str(match.round_id) || undefined,
    stage: str(match.stage_name) || str(match.stage) || str(match.group_name) || undefined,
    matchNumber: str(match.match_number) || undefined,
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

async function collectCupGroupMatches(
  parsed: ParsedAssociationUrl,
  competitionId: string,
  categoryId: string,
  teamName: string
): Promise<Record<string, unknown>[]> {
  const groupsJson = await torneopalGet<TorneopalGroupsPayload>(
    parsed.association,
    "getGroups",
    { competition_id: competitionId, category_id: categoryId },
    parsed.subdomain,
    parsed.sport
  );
  const groups = Array.isArray(groupsJson?.groups) ? groupsJson!.groups : [];
  const rows: Record<string, unknown>[] = [];
  const chunks: Record<string, unknown>[][] = [];
  for (let i = 0; i < groups.length; i += 4) chunks.push(groups.slice(i, i + 4));
  for (const chunk of chunks) {
    const found = await Promise.all(
      chunk.map((g) =>
        torneopalGet<TorneopalGroupPayload>(
          parsed.association,
          "getGroup",
          {
            competition_id: competitionId,
            category_id: categoryId,
            group_id: str(g.group_id),
            matches: "1",
          },
          parsed.subdomain,
          parsed.sport
        )
      )
    );
    for (const full of found) {
      const matches = full?.group?.matches;
      if (!Array.isArray(matches)) continue;
      for (const m of matches as Record<string, unknown>[]) {
        if (
          namesMatch(str(m.team_A_name), teamName) ||
          namesMatch(str(m.team_B_name), teamName) ||
          str(m.team_A_id) === parsed.teamId ||
          str(m.team_B_id) === parsed.teamId
        ) {
          rows.push(m);
        }
      }
    }
  }
  return rows;
}

export async function fetchTorneopalTeamData(
  parsed: ParsedAssociationUrl
): Promise<OfficialTeamData | null> {
  const teamJson = await torneopalGet<TorneopalTeamPayload>(
    parsed.association,
    "getTeam",
    { team_id: parsed.teamId },
    parsed.subdomain,
    parsed.sport
  );
  const team = teamJson?.team;
  if (!team) return null;

  const teamName = str(team.team_name) || `Joukkue ${parsed.teamId}`;
  const groups = Array.isArray(team.groups) ? (team.groups as Record<string, unknown>[]) : [];
  const categories = Array.isArray(team.categories) ? (team.categories as Record<string, unknown>[]) : [];
  const primary = (team.primary_category as Record<string, unknown> | undefined) || categories[0];
  let currentGroup = pickCurrentGroup(groups);
  const keepCupIds = looksLikeCupRequest(parsed);
  const competitionId = keepCupIds && parsed.seasonId
    ? parsed.seasonId
    : str(currentGroup?.competition_id) || parsed.seasonId || str(primary?.competition_id);
  const categoryId = keepCupIds && parsed.leagueId
    ? parsed.leagueId
    : str(currentGroup?.category_id) || parsed.leagueId || str(primary?.category_id);

  const matchParams = buildGetMatchesParams({
    ...parsed,
    seasonId: competitionId || parsed.seasonId,
    leagueId: categoryId || parsed.leagueId
  });

  const [matchesJson, groupJson] = await Promise.all([
    torneopalGet<TorneopalMatchesPayload>(parsed.association, "getMatches", matchParams, parsed.subdomain, parsed.sport),
    currentGroup
      ? torneopalGet<TorneopalGroupPayload>(
          parsed.association,
          "getGroup",
          {
            competition_id: competitionId,
            category_id: categoryId,
            group_id: str(currentGroup.group_id),
            matches: "1",
          },
          parsed.subdomain,
          parsed.sport
        )
      : Promise.resolve(null),
  ]);

  let rawMatches = Array.isArray(matchesJson?.matches) ? matchesJson!.matches : [];
  const claimedTotal = num(
    (matchesJson as { call?: { total_result_count?: unknown } } | null)?.call?.total_result_count
  );
  // Cups often return total_result_count > 0 with matches: []. Always walk
  // getGroups/getGroup when we have competition+category (KW Memorial).
  if (
    rawMatches.length === 0 &&
    competitionId &&
    categoryId &&
    (looksLikeCupRequest(parsed) || claimedTotal > 0)
  ) {
    rawMatches = await collectCupGroupMatches(parsed, competitionId, categoryId, teamName);
  } else if (Array.isArray(groupJson?.group?.matches) && rawMatches.length === 0) {
    rawMatches = groupJson!.group!.matches as Record<string, unknown>[];
  }

  let fixtures = rawMatches
    .map((m) => mapFixture(m, parsed, teamName))
    .filter((f): f is NonNullable<typeof f> => Boolean(f))
    .filter((f) => new Date(f.startTime).getUTCFullYear() >= 2024);
  if (looksLikeCupRequest(parsed)) {
    const cupRows = fixtures.filter((f) => /turnaus|tournament|cup|memorial/i.test(f.leagueName));
    if (cupRows.length) fixtures = cupRows;
  }
  const group = groupJson?.group || {};
  const teamRows = Array.isArray(group.teams) ? (group.teams as Record<string, unknown>[]) : [];
  const standings = teamRows.map(mapStanding).filter((r) => r.teamName);
  const roster = mapRoster(team, teamName);
  const leagueName =
    (keepCupIds && (fixtures[0]?.leagueName || str(group.competition_name))) ||
    str(currentGroup?.competition_name) ||
    str(group.competition_name) ||
    str(primary?.competition_name) ||
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
    competitionId: competitionId || undefined,
    categoryId: categoryId || undefined,
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
