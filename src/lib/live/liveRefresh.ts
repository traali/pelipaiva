import type { PelipaivaDB } from '../storage/db';
import type { MatchdayEvent } from '../../types/matchday';
import { torneopalGet, tasoLiveScore } from '../api/torneopalClient';
import { isEventLive } from '../agents/eventPhase';

const ev0 = (evs: MatchdayEvent[]) => evs[0]!;

export const LIVE_REFRESH_MS = 60_000;
export const LIVE_BACKOFF_MAX_MS = 10 * 60_000;

type LiveFed = 'palloliitto' | 'salibandy';
const FED_SPORT = { palloliitto: 'football', salibandy: 'floorball' } as const;

/** TASO federation + match id of a stored football/floorball game (`<fed>_<team>_<match>`), else null. */
export function tasoLiveRef(ev: Pick<MatchdayEvent, 'officialFixtureId'>): { fed: LiveFed; matchId: string } | null {
  const m = /^(palloliitto|salibandy)_[^_]+_(\d+)$/.exec(ev.officialFixtureId || '');
  return m ? { fed: m[1] as LiveFed, matchId: m[2]! } : null;
}

/** TASO match id of a stored Palloliitto game (`palloliitto_<team>_<match>`), else null. */
export function palloliittoMatchId(ev: Pick<MatchdayEvent, 'officialFixtureId'>): string | null {
  const r = tasoLiveRef(ev);
  return r && r.fed === 'palloliitto' ? r.matchId : null;
}

/** The family's Palloliitto and Salibandyliitto games that are on right now. Local only: no network. */
export async function liveOfficialGames(db: PelipaivaDB, now: Date = new Date()): Promise<MatchdayEvent[]> {
  const all = await db.events.toArray();
  return all.filter((ev) => !ev.isTraining && tasoLiveRef(ev) !== null && isEventLive(ev, now));
}

interface TasoMatchPayload {
  match?: Record<string, unknown>;
}

/**
 * Refresh the live games' score from TASO getMatch, one call per distinct match.
 * Only updates fields on existing events; a failed call leaves the stored game as is.
 * Returns how many games were live and how many calls failed.
 */
export async function refreshLiveGames(
  db: PelipaivaDB,
  now: Date = new Date()
): Promise<{ live: number; failed: number }> {
  const games = await liveOfficialGames(db, now);
  if (games.length === 0) return { live: 0, failed: 0 };
  const byMatch = new Map<string, MatchdayEvent[]>();
  for (const ev of games) {
    const r = tasoLiveRef(ev)!;
    const id = `${r.fed}:${r.matchId}`;
    byMatch.set(id, [...(byMatch.get(id) || []), ev]);
  }
  let failed = 0;
  for (const [key, evs] of byMatch) {
    const [fed, matchId] = key.split(':') as [LiveFed, string];
    const json = await torneopalGet<TasoMatchPayload>(fed, 'getMatch', { match_id: matchId }, undefined, FED_SPORT[fed]);
    const m = json?.match;
    if (!m) {
      failed++;
      continue;
    }
    const stamp = new Date().toISOString();
    const status = String(m.status ?? '').toLowerCase();
    let patch: Partial<MatchdayEvent>;
    if (status === 'played' && /^\d+$/.test(String(m.fs_A ?? '')) && /^\d+$/.test(String(m.fs_B ?? ''))) {
      patch = { score: `${Number(m.fs_A)}–${Number(m.fs_B)}`, liveScore: undefined, liveBreak: undefined, liveUpdatedAt: stamp };
    } else {
      // Never trust a stuck "Live" past the slot: isEventLive already ended it locally.
      const live = isEventLive(ev0(evs), new Date()) ? tasoLiveScore(m) : null;
      patch = live
        ? { liveScore: live.score, liveBreak: live.isBreak, liveUpdatedAt: stamp }
        : { liveUpdatedAt: stamp };
    }
    for (const ev of evs) await db.events.update(ev.id, patch);
  }
  return { live: games.length, failed };
}

/**
 * Every ~60 s while the tab is visible and a game is live, refresh its score.
 * Hidden tab: no timer work. Back to visible: immediate refresh. Errors back off
 * (2×, up to 10 min). Nothing live: only a local DB check, no network.
 */
export function startLiveRefresh(
  db: PelipaivaDB,
  opts: { intervalMs?: number; doc?: Document; refresh?: typeof refreshLiveGames } = {}
): () => void {
  const interval = opts.intervalMs ?? LIVE_REFRESH_MS;
  const doc = opts.doc ?? document;
  const refresh = opts.refresh ?? refreshLiveGames;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let delay = interval;
  let running = false;
  let stopped = false;

  const schedule = (ms: number) => {
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (!stopped && !doc.hidden) timer = setTimeout(tick, ms);
  };
  const tick = async () => {
    if (stopped || doc.hidden || running) return;
    running = true;
    try {
      const r = await refresh(db);
      delay = r.failed > 0 ? Math.min(delay * 2, LIVE_BACKOFF_MAX_MS) : interval;
    } catch (err) {
      console.warn('[PELIPAIVA:LIVE]', err);
      delay = Math.min(delay * 2, LIVE_BACKOFF_MAX_MS);
    } finally {
      running = false;
    }
    schedule(delay);
  };
  const onVisibility = () => {
    if (doc.hidden) {
      if (timer) clearTimeout(timer);
      timer = undefined;
    } else {
      void tick();
    }
  };
  doc.addEventListener('visibilitychange', onVisibility);
  void tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    doc.removeEventListener('visibilitychange', onVisibility);
  };
}
