/**
 * TASO club → team directory.
 *
 * Every club and team shown comes straight from the federation TASO API
 * (getClubs / getClub). There is no static fallback: if TASO does not answer,
 * callers get an explicit error and must say so.
 */
import type { AssociationType, SportType } from "../../types/matchday";
import { torneopalGet } from "./torneopalClient";

export type DirectorySport = "football" | "floorball" | "basketball" | "volleyball";

const SPORTS: Record<DirectorySport, { association: AssociationType; teamHost: string }> = {
  football: { association: "palloliitto", teamHost: "https://tulospalvelu.palloliitto.fi" },
  floorball: { association: "salibandy", teamHost: "https://tulospalvelu.salibandy.fi" },
  basketball: { association: "basket", teamHost: "https://tulospalvelu.basket.fi" },
  volleyball: { association: "torneopal", teamHost: "https://tulospalvelu.lentopallo.fi" },
};

export const DIRECTORY_SPORTS: DirectorySport[] = ["football", "floorball", "basketball", "volleyball"];

export function isDirectorySport(sport: SportType | string | undefined): sport is DirectorySport {
  return typeof sport === "string" && Object.prototype.hasOwnProperty.call(SPORTS, sport);
}

export interface TasoClub {
  clubId: string;
  sport: DirectorySport;
  /** Name exactly as TASO has it. */
  name: string;
  abbreviation: string;
  city: string;
  /** Nicer casing when TASO's abbreviation is the same name (e.g. "WESTEND INDIANS" → "Westend Indians"). */
  displayName: string;
}

export interface TasoTeam {
  teamId: string;
  clubId: string;
  sport: DirectorySport;
  teamName: string;
  yob: string;
  ageGroup: string;
  categoryName: string;
  tournamentName: string;
  season: string;
  isCurrentSeason: boolean;
  /** team_name · yob/age_group · tournament_name (only the parts TASO sent). */
  label: string;
  /** Series/category name when TASO sent one. */
  detail: string;
  /** Federation team page; parseAssociationUrl accepts it. */
  url: string;
}

export type DirectoryError = "unavailable" | "unsupported-sport";
export type DirectoryResult<T> = { ok: true; data: T } | { ok: false; error: DirectoryError };

export const CLUBS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const STALE_CLUBS_MAX_MS = 60 * 24 * 60 * 60 * 1000;
const TEAMS_TTL_MS = 30 * 60 * 1000;
const STORAGE_PREFIX = "pelipaiva:taso-clubs:v1:";

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return value == null ? "" : String(value).trim();
}

/** Lowercase, strip diacritics (ä→a, ö→o, å→a) and punctuation so Finnish names match however typed. */
export function foldFi(value: string): string {
  return value
    .normalize("NFC")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isPlaceholderClub(name: string): boolean {
  return name.startsWith("#") || /ei\s+seuraa\s+tiedossa/i.test(name);
}

export function teamPageUrl(sport: DirectorySport, teamId: string): string {
  return `${SPORTS[sport].teamHost}/team/${teamId}`;
}

function toClub(raw: unknown, sport: DirectorySport): TasoClub | null {
  if (!isRecord(raw)) return null;
  const clubId = str(raw.club_id);
  const name = str(raw.name);
  if (!/^\d+$/.test(clubId) || !name || isPlaceholderClub(name)) return null;
  if (str(raw.archived) === "1") return null;
  const abbreviation = str(raw.abbrevation);
  const displayName =
    abbreviation && abbreviation.toLowerCase() === name.toLowerCase() ? abbreviation : name;
  return { clubId, sport, name, abbreviation, city: str(raw.city_name), displayName };
}

// ---------------------------------------------------------------------------
// Club list cache: memory + localStorage, per sport.
// ---------------------------------------------------------------------------

interface StoredClubs {
  v: 1;
  at: number;
  clubs: Array<[string, string, string, string]>;
}

const memClubs = new Map<DirectorySport, { at: number; clubs: TasoClub[] }>();
const inflightClubs = new Map<DirectorySport, Promise<TasoClub[] | null>>();
const memTeams = new Map<string, { at: number; teams: TasoTeam[] }>();

function storage(): Storage | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null;
  }
}

function readStored(sport: DirectorySport): { at: number; clubs: TasoClub[] } | null {
  const ls = storage();
  if (!ls) return null;
  try {
    const raw = ls.getItem(STORAGE_PREFIX + sport);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredClubs;
    if (!parsed || parsed.v !== 1 || typeof parsed.at !== "number" || !Array.isArray(parsed.clubs)) return null;
    const clubs = parsed.clubs
      .map((row) =>
        Array.isArray(row)
          ? toClub({ club_id: row[0], name: row[1], abbrevation: row[2], city_name: row[3] }, sport)
          : null
      )
      .filter((c): c is TasoClub => c !== null);
    return clubs.length > 0 ? { at: parsed.at, clubs } : null;
  } catch {
    return null;
  }
}

function writeStored(sport: DirectorySport, at: number, clubs: TasoClub[]): void {
  const ls = storage();
  if (!ls) return;
  const payload: StoredClubs = {
    v: 1,
    at,
    clubs: clubs.map((c) => [c.clubId, c.name, c.abbreviation, c.city]),
  };
  try {
    ls.setItem(STORAGE_PREFIX + sport, JSON.stringify(payload));
  } catch {
    // Quota or private mode: the memory cache still works for this session.
  }
}

async function fetchClubs(sport: DirectorySport): Promise<TasoClub[] | null> {
  const json = await torneopalGet<{ clubs?: unknown }>(
    SPORTS[sport].association,
    "getClubs",
    {},
    undefined,
    sport
  );
  const rows = json && Array.isArray(json.clubs) ? json.clubs : null;
  if (!rows) return null;
  const clubs = rows.map((r) => toClub(r, sport)).filter((c): c is TasoClub => c !== null);
  if (clubs.length === 0) return null;
  const at = Date.now();
  memClubs.set(sport, { at, clubs });
  writeStored(sport, at, clubs);
  return clubs;
}

async function loadClubs(sport: DirectorySport): Promise<TasoClub[] | null> {
  const now = Date.now();
  const mem = memClubs.get(sport);
  if (mem && now - mem.at < CLUBS_TTL_MS) return mem.clubs;
  const stored = readStored(sport);
  if (stored && now - stored.at < CLUBS_TTL_MS) {
    memClubs.set(sport, stored);
    return stored.clubs;
  }
  let pending = inflightClubs.get(sport);
  if (!pending) {
    pending = fetchClubs(sport).finally(() => inflightClubs.delete(sport));
    inflightClubs.set(sport, pending);
  }
  const fresh = await pending;
  if (fresh) return fresh;
  // TASO is down: an older copy of TASO's own list is still real data.
  const stale = mem ?? stored;
  if (stale && now - stale.at < STALE_CLUBS_MAX_MS) return stale.clubs;
  return null;
}

function clubScore(club: TasoClub, q: string, tokens: string[]): number {
  let best = Number.POSITIVE_INFINITY;
  for (const field of [club.name, club.abbreviation]) {
    const f = foldFi(field);
    if (!f) continue;
    const padded = ` ${f}`;
    let s = Number.POSITIVE_INFINITY;
    if (f === q) s = 0;
    else if (f.startsWith(q)) s = 1;
    else if (padded.includes(` ${q}`)) s = 2;
    else if (f.includes(q)) s = 3;
    else if (tokens.length > 1 && tokens.every((t) => padded.includes(` ${t}`))) s = 4;
    if (s < best) best = s;
  }
  return best;
}

/** Case- and accent-insensitive search on club name and abbreviation. Queries under 2 letters return []. */
export async function searchClubs(
  sport: SportType,
  query: string,
  limit = 8
): Promise<DirectoryResult<TasoClub[]>> {
  if (!isDirectorySport(sport)) return { ok: false, error: "unsupported-sport" };
  const q = foldFi(query);
  if (q.length < 2) return { ok: true, data: [] };
  const clubs = await loadClubs(sport);
  if (!clubs) return { ok: false, error: "unavailable" };
  const tokens = q.split(" ").filter(Boolean);
  const hits = clubs
    .map((club) => ({ club, score: clubScore(club, q, tokens) }))
    .filter((h) => Number.isFinite(h.score))
    .sort((a, b) => a.score - b.score || a.club.displayName.localeCompare(b.club.displayName, "fi"))
    .slice(0, Math.max(1, limit))
    .map((h) => h.club);
  return { ok: true, data: hits };
}

// ---------------------------------------------------------------------------
// Club → teams
// ---------------------------------------------------------------------------

function pickCategory(team: Rec): Rec | undefined {
  const primary = isRecord(team.primary_category) ? team.primary_category : undefined;
  if (primary && str(primary.tournament_name)) return primary;
  const categories = Array.isArray(team.categories) ? team.categories.filter(isRecord) : [];
  // Only an active category; an old 2022 series would mislabel the team.
  return categories.find(
    (c) => (str(c.tournament_active) === "1" || str(c.competition_active) === "1") && str(c.tournament_name)
  );
}

function firstYear(value: string): number {
  const m = value.match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : 0;
}

function toTeam(raw: unknown, sport: DirectorySport, clubId: string): TasoTeam | null {
  if (!isRecord(raw)) return null;
  if (str(raw.status) !== "active") return null;
  const teamId = str(raw.team_id);
  const teamName = str(raw.team_name);
  if (!/^\d+$/.test(teamId) || !teamName) return null;
  const yob = str(raw.yob);
  const ageGroup = str(raw.age_group);
  const cat = pickCategory(raw);
  const tournamentName = str(cat?.tournament_name);
  const categoryName = str(cat?.category_name);
  const season = str(cat?.tournament_season) || str(cat?.competition_season);
  const isCurrentSeason =
    str(cat?.tournament_active) === "1" || str(cat?.competition_active) === "1";
  const label = [teamName, yob || ageGroup, tournamentName].filter(Boolean).join(" · ");
  return {
    teamId,
    clubId,
    sport,
    teamName,
    yob,
    ageGroup,
    categoryName,
    tournamentName,
    season,
    isCurrentSeason,
    label,
    detail: categoryName,
    url: teamPageUrl(sport, teamId),
  };
}

function seasonYear(t: TasoTeam): number {
  return firstYear(t.season) || firstYear(t.tournamentName);
}

/** Current season first, then newest season, then junior teams (youngest first), then name. */
export function compareTeams(a: TasoTeam, b: TasoTeam): number {
  if (a.isCurrentSeason !== b.isCurrentSeason) return a.isCurrentSeason ? -1 : 1;
  const sy = seasonYear(b) - seasonYear(a);
  if (sy !== 0) return sy;
  const ya = firstYear(a.yob);
  const yb = firstYear(b.yob);
  if (Boolean(ya) !== Boolean(yb)) return ya ? -1 : 1;
  if (ya !== yb) return yb - ya;
  return a.teamName.localeCompare(b.teamName, "fi") || a.detail.localeCompare(b.detail, "fi");
}

/** Active teams of one club, straight from TASO getClub. Archived teams are dropped. */
export async function getClubTeams(
  sport: SportType,
  clubId: string
): Promise<DirectoryResult<TasoTeam[]>> {
  if (!isDirectorySport(sport)) return { ok: false, error: "unsupported-sport" };
  const id = str(clubId);
  if (!/^\d+$/.test(id)) return { ok: false, error: "unavailable" };
  const key = `${sport}:${id}`;
  const cached = memTeams.get(key);
  if (cached && Date.now() - cached.at < TEAMS_TTL_MS) return { ok: true, data: cached.teams };
  const json = await torneopalGet<{ club?: unknown }>(
    SPORTS[sport].association,
    "getClub",
    { club_id: id },
    undefined,
    sport
  );
  const club = json && isRecord(json.club) ? json.club : null;
  if (!club || !Array.isArray(club.teams)) return { ok: false, error: "unavailable" };
  const teams = club.teams
    .map((t) => toTeam(t, sport, id))
    .filter((t): t is TasoTeam => t !== null)
    .sort(compareTeams);
  memTeams.set(key, { at: Date.now(), teams });
  return { ok: true, data: teams };
}

/** Narrow a team list by free text (all words must match label or series). */
export function filterTeams(teams: TasoTeam[], filter: string): TasoTeam[] {
  const tokens = foldFi(filter).split(" ").filter(Boolean);
  if (tokens.length === 0) return teams;
  return teams.filter((t) => {
    const hay = foldFi(`${t.label} ${t.detail} ${t.ageGroup}`);
    return tokens.every((tok) => hay.includes(tok));
  });
}

/** Test hook: forget memory caches (localStorage is left to the caller). */
export function clearTasoDirectoryCache(): void {
  memClubs.clear();
  inflightClubs.clear();
  memTeams.clear();
}
