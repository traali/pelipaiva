import React, { useEffect, useMemo, useRef, useState } from "react";
import { Search, Loader2, ChevronLeft, Check, AlertTriangle, RefreshCw } from "lucide-react";
import type { SportType } from "../../types/matchday";
import {
  DIRECTORY_SPORTS,
  filterTeams,
  getClubTeams,
  isDirectorySport,
  searchClubs,
  type DirectorySport,
  type TasoClub,
  type TasoTeam,
} from "../../lib/api/tasoDirectory";

const SPORT_LABEL: Record<DirectorySport, string> = {
  football: "⚽ Jalkapallo",
  floorball: "🏑 Salibandy",
  basketball: "🏀 Koripallo",
  volleyball: "🏐 Lentopallo",
};

const SEARCH_DEBOUNCE_MS = 250;
const CLUB_RESULTS = 6;
const TEAM_ROWS = 40;

const MSG_UNAVAILABLE = "Tulospalvelu ei vastaa juuri nyt";
const MSG_NOT_FOUND = "Ei löytynyt";

type ClubState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; clubs: TasoClub[] }
  | { kind: "error" };

type TeamState =
  | { kind: "loading" }
  | { kind: "ok"; teams: TasoTeam[] }
  | { kind: "error" };

export interface TasoTeamSearchProps {
  sport: SportType;
  onSportChange: (sport: SportType) => void;
  onPickTeam: (team: TasoTeam, club: TasoClub) => void;
  selectedPlayer: string;
}

/**
 * Club → team picker backed only by the TASO directory. Selecting a team hands
 * the real team page URL to the import form; nothing here is invented.
 */
export const TasoTeamSearch: React.FC<TasoTeamSearchProps> = ({
  sport,
  onSportChange,
  onPickTeam,
  selectedPlayer,
}) => {
  const [query, setQuery] = useState("");
  const [clubState, setClubState] = useState<ClubState>({ kind: "idle" });
  const [club, setClub] = useState<TasoClub | null>(null);
  const [teamState, setTeamState] = useState<TeamState>({ kind: "loading" });
  const [teamFilter, setTeamFilter] = useState("");
  const [pickedTeamId, setPickedTeamId] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  const searchSeq = useRef(0);
  const teamSeq = useRef(0);

  const supported = isDirectorySport(sport);
  // A club belongs to one sport's directory; switching sport hides it.
  const activeClub = club && club.sport === sport ? club : null;

  // Debounced club search against the real TASO club list.
  useEffect(() => {
    const seq = ++searchSeq.current;
    if (!supported || activeClub) return;
    if (query.trim().length < 2) {
      setClubState({ kind: "idle" });
      return;
    }
    setClubState({ kind: "loading" });
    const timer = window.setTimeout(async () => {
      const res = await searchClubs(sport, query, CLUB_RESULTS);
      if (seq !== searchSeq.current) return;
      setClubState(res.ok ? { kind: "ok", clubs: res.data } : { kind: "error" });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query, sport, supported, activeClub, retryTick]);

  // Teams of the picked club.
  useEffect(() => {
    if (!activeClub) return;
    const seq = ++teamSeq.current;
    setTeamState({ kind: "loading" });
    void getClubTeams(activeClub.sport, activeClub.clubId).then((res) => {
      if (seq !== teamSeq.current) return;
      setTeamState(res.ok ? { kind: "ok", teams: res.data } : { kind: "error" });
    });
  }, [activeClub, retryTick]);

  const visibleTeams = useMemo(
    () => (teamState.kind === "ok" ? filterTeams(teamState.teams, teamFilter) : []),
    [teamState, teamFilter]
  );

  const chooseClub = (c: TasoClub) => {
    setClub(c);
    setTeamFilter("");
    setPickedTeamId(null);
  };

  const backToClubs = () => {
    setClub(null);
    setPickedTeamId(null);
    setTeamFilter("");
  };

  const chooseTeam = (team: TasoTeam) => {
    if (!activeClub) return;
    setPickedTeamId(team.teamId);
    onPickTeam(team, activeClub);
  };

  const unavailable = (
    <div role="alert" className="mt-2 flex flex-col gap-2 rounded-xl border border-stoppage/30 bg-stoppage/10 p-3 text-xs">
      <span className="flex items-center gap-1.5 font-bold text-stoppage">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {MSG_UNAVAILABLE}
      </span>
      <span className="text-text-muted">Yritä hetken päästä uudelleen tai liitä joukkueen linkki alle.</span>
      <button
        type="button"
        onClick={() => setRetryTick((n) => n + 1)}
        className="inline-flex min-h-[44px] items-center justify-center gap-1.5 self-start rounded-xl border border-border-strong bg-surface px-4 text-xs font-bold text-text-primary hover:border-pitch cursor-pointer"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Yritä uudelleen
      </button>
    </div>
  );

  return (
    <section aria-label="Hae seura ja joukkue tulospalvelusta" className="flex flex-col gap-2">
      <label htmlFor="taso-club-search" className="flex items-center gap-1 text-xs font-semibold text-text-secondary">
        <Search className="h-3.5 w-3.5 text-pitch" />
        <span>Hae seura tulospalvelusta, valitse joukkue</span>
      </label>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="group" aria-label="Laji">
        {DIRECTORY_SPORTS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={sport === s}
            onClick={() => onSportChange(s)}
            className={`min-h-[44px] rounded-xl border px-3 text-xs font-bold transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-pitch ${
              sport === s
                ? "border-pitch bg-pitch text-text-inverse shadow-sm"
                : "border-border-subtle bg-surface text-text-secondary hover:text-text-primary"
            }`}
          >
            {SPORT_LABEL[s]}
          </button>
        ))}
      </div>

      {!supported ? (
        <p className="rounded-xl border border-border-subtle bg-surface p-3 text-xs text-text-muted">
          Seurahaku toimii jalkapallossa, salibandyssa, koripallossa ja lentopallossa. Valitse laji yltä tai liitä linkki alle.
        </p>
      ) : !activeClub ? (
        <>
          <div className="relative">
            <input
              id="taso-club-search"
              type="search"
              inputMode="search"
              autoComplete="off"
              enterKeyHint="search"
              value={query}
              placeholder="Seuran nimi, esim. Westend tai PPJ"
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-pitch/30 bg-pitch/10 px-3.5 py-2 text-base text-text-primary placeholder:text-text-muted focus:border-pitch focus:outline-none sm:text-sm"
            />
            {clubState.kind === "loading" && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-pitch" aria-hidden="true" />
            )}
          </div>
          <div aria-live="polite">
            {clubState.kind === "loading" && (
              <p className="flex items-center gap-1.5 text-xs text-text-muted">
                <span>Haetaan seuroja tulospalvelusta…</span>
              </p>
            )}
            {clubState.kind === "error" && unavailable}
            {clubState.kind === "ok" && clubState.clubs.length === 0 && (
              <p className="rounded-xl border border-border-subtle bg-surface p-3 text-xs">
                <span className="font-bold text-text-primary">{MSG_NOT_FOUND}</span>
                <span className="block text-text-muted">
                  Tarkista kirjoitusasu tai laji. Voit myös liittää joukkueen linkin alle.
                </span>
              </p>
            )}
            {clubState.kind === "ok" && clubState.clubs.length > 0 && (
              <ul className="flex flex-col gap-1" aria-label="Seurat">
                {clubState.clubs.map((c) => (
                  <li key={c.clubId}>
                    <button
                      type="button"
                      onClick={() => chooseClub(c)}
                      className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface px-3 py-2 text-left text-sm transition-all hover:border-pitch cursor-pointer focus-visible:ring-2 focus-visible:ring-pitch"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-text-primary">{c.displayName}</span>
                        {(c.city || (c.abbreviation && c.abbreviation !== c.displayName)) && (
                          <span className="block truncate text-[11px] text-text-muted">
                            {[c.abbreviation !== c.displayName ? c.abbreviation : "", c.city].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 text-[11px] font-bold text-pitch">Joukkueet ›</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={backToClubs}
              aria-label="Takaisin seurahakuun"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border-subtle bg-surface text-text-secondary hover:text-text-primary cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-text-primary">{activeClub.displayName}</p>
              <p className="text-[11px] text-text-muted">Valitse joukkue{selectedPlayer.trim() ? ` pelaajalle ${selectedPlayer.trim()}` : ""}</p>
            </div>
          </div>

          <div aria-live="polite">
            {teamState.kind === "loading" && (
              <p className="flex items-center gap-1.5 text-xs text-text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-pitch" />
                <span>Haetaan joukkueita…</span>
              </p>
            )}
            {teamState.kind === "error" && unavailable}
            {teamState.kind === "ok" && teamState.teams.length === 0 && (
              <p className="rounded-xl border border-border-subtle bg-surface p-3 text-xs">
                <span className="font-bold text-text-primary">{MSG_NOT_FOUND}</span>
                <span className="block text-text-muted">Seuralla ei ole tulospalvelussa aktiivisia joukkueita.</span>
              </p>
            )}
            {teamState.kind === "ok" && teamState.teams.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {teamState.teams.length > 8 && (
                  <input
                    type="search"
                    inputMode="search"
                    autoComplete="off"
                    value={teamFilter}
                    aria-label="Rajaa joukkueita"
                    placeholder="Rajaa: syntymävuosi, P11, Yellow…"
                    onChange={(e) => setTeamFilter(e.target.value)}
                    className="min-h-[44px] w-full rounded-xl border border-border-strong bg-surface-elevated px-3.5 py-2 text-base text-text-primary placeholder:text-text-muted focus:border-pitch focus:outline-none sm:text-sm"
                  />
                )}
                {visibleTeams.length === 0 ? (
                  <p className="text-xs font-bold text-text-primary">{MSG_NOT_FOUND}</p>
                ) : (
                  <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto" aria-label="Joukkueet">
                    {visibleTeams.slice(0, TEAM_ROWS).map((t) => {
                      const picked = pickedTeamId === t.teamId;
                      return (
                        <li key={t.teamId}>
                          <button
                            type="button"
                            aria-pressed={picked}
                            onClick={() => chooseTeam(t)}
                            className={`flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-pitch ${
                              picked ? "border-pitch bg-pitch/15" : "border-border-subtle bg-surface hover:border-pitch"
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block font-bold text-text-primary">{t.label}</span>
                              {t.detail && <span className="block text-[11px] text-text-muted">{t.detail}</span>}
                            </span>
                            {picked ? (
                              <Check className="h-4 w-4 shrink-0 text-pitch" aria-hidden="true" />
                            ) : (
                              <span className="shrink-0 text-[11px] font-bold text-pitch">Valitse</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {visibleTeams.length > TEAM_ROWS && (
                  <p className="text-[11px] text-text-muted">
                    Näytetään {TEAM_ROWS} / {visibleTeams.length}. Rajaa hakua yllä.
                  </p>
                )}
              </div>
            )}
          </div>
          {pickedTeamId && (
            <p className="rounded-xl border border-pitch/30 bg-pitch/10 p-2.5 text-xs font-semibold text-text-primary">
              Joukkue valittu tulospalvelusta. Tarkista tiedot alta ja paina Tuo joukkue.
            </p>
          )}
        </div>
      )}
    </section>
  );
};
