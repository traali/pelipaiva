import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { refreshLiveGames, startLiveRefresh, palloliittoMatchId, LIVE_REFRESH_MS } from '../../src/lib/live/liveRefresh';
import { liveText, startLabel } from '../../src/lib/agents/eventPhase';
import type { MatchdayEvent } from '../../src/types/matchday';
import { createTestDb, deleteTestDb } from '../helpers/setupDexie';
import type { PelipaivaDB } from '../../src/lib/storage/db';
import recorded from '../fixtures/json/taso-spl-live-sequence-hjk-ols-2026-10-17.json';

// Real getMatch polls of HJK–OLS (4291688): 4–0 at 14:13:12, 4–1 at 14:14:15 Helsinki.
const seq = recorded.sequence;
const PROFILE = 'aapo';
const liveGame = (over: Partial<MatchdayEvent> = {}): MatchdayEvent =>
  ({
    id: `fixture-${PROFILE}-palloliitto_60797_4291688`, profileId: PROFILE, title: 'HJK vs OLS', eventType: 'match', isTraining: false,
    sport: 'football', homeTeam: 'HJK', awayTeam: 'OLS', startTime: '2026-10-17T13:00:00+03:00', endTime: '2026-10-17T12:00:00.000Z',
    officialFixtureId: 'palloliitto_60797_4291688', liveScore: '4–0', liveUpdatedAt: '2026-10-17T11:13:12.000Z', ...over,
  }) as unknown as MatchdayEvent;

let db: PelipaivaDB;
let answer: () => Response;
const fetchMock = vi.fn(async () => answer());

class FakeDoc extends EventTarget {
  hidden = false;
  set(hidden: boolean) { this.hidden = hidden; this.dispatchEvent(new Event('visibilitychange')); }
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-17T14:14:20+03:00'));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  fetchMock.mockClear();
  answer = () => new Response(JSON.stringify({ call: { status: 'ok' }, match: seq[1]!.match }), { status: 200 });
  vi.stubGlobal('fetch', fetchMock);
  db = createTestDb();
  await db.events.put(liveGame());
});
afterEach(async () => {
  vi.useRealTimers();
  await deleteTestDb(db);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('refreshLiveGames (recorded HJK–OLS sequence)', () => {
  it('match id comes from the stored fixture id', () => {
    expect(palloliittoMatchId(liveGame())).toBe('4291688');
    expect(palloliittoMatchId({ officialFixtureId: 'salibandy_1_2' })).toBeNull();
  });

  it('4–0 → 4–1 on its own, with one signed getMatch call and a fresh "päivitetty" time', async () => {
    const r = await refreshLiveGames(db);
    expect(r).toEqual({ live: 1, failed: 0 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/spl\.torneopal\.net\/taso\/rest\/getMatch\?match_id=4291688&hash=[0-9a-f]{64}$/);
    const ev = (await db.events.get(liveGame().id))!;
    expect(ev.liveScore).toBe('4–1');
    expect(ev.score).toBeUndefined();
    expect(liveText(ev)).toBe('Käynnissä 4–1 (päivitetty klo 14.14)');
    expect(startLabel(ev)).toMatch(/^● Käynnissä 4–1 \(päivitetty klo 14\.14\) · alkoi$/);
  });

  it('a failed call keeps the stored game and its last score', async () => {
    answer = () => new Response('', { status: 403 });
    const r = await refreshLiveGames(db);
    expect(r.failed).toBe(1);
    const ev = (await db.events.get(liveGame().id))!;
    expect(ev.liveScore).toBe('4–0');
    expect(await db.events.count()).toBe(1);
  });

  it('nothing live → no network calls', async () => {
    await db.events.put(liveGame({ startTime: '2026-10-17T18:00:00+03:00', endTime: '2026-10-17T17:00:00.000Z', liveScore: undefined }));
    expect(await refreshLiveGames(db)).toEqual({ live: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('TASO "Played" turns the live score into the final score', async () => {
    answer = () => new Response(JSON.stringify({ call: { status: 'ok' }, match: { ...seq[1]!.match, status: 'Played', fs_A: '4', fs_B: '1' } }), { status: 200 });
    await refreshLiveGames(db);
    const ev = (await db.events.get(liveGame().id))!;
    expect(ev.score).toBe('4–1');
    expect(ev.liveScore).toBeUndefined();
  });
});

describe('startLiveRefresh scheduling', () => {
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

  it('refreshes now and then every 60 s while visible; stops when hidden; immediate refresh on return', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const doc = new FakeDoc();
    const refresh = vi.fn(async () => ({ live: 1, failed: 0 }));
    const stop = startLiveRefresh(db, { doc: doc as unknown as Document, refresh });
    await flush();
    expect(refresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(LIVE_REFRESH_MS);
    expect(refresh).toHaveBeenCalledTimes(2);
    doc.set(true);
    await vi.advanceTimersByTimeAsync(LIVE_REFRESH_MS * 5);
    expect(refresh).toHaveBeenCalledTimes(2);
    doc.set(false);
    await flush();
    expect(refresh).toHaveBeenCalledTimes(3);
    stop();
  });

  it('backs off on errors (60 → 120 → 240 s) and returns to 60 s after success', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const doc = new FakeDoc();
    const t0 = Date.now();
    const at: number[] = [];
    const failed = [1, 1, 0, 0];
    const refresh = vi.fn(async () => { at.push(Date.now() - t0); return { live: 1, failed: failed.shift() ?? 0 }; });
    const stop = startLiveRefresh(db, { doc: doc as unknown as Document, refresh });
    await vi.advanceTimersByTimeAsync(480_000);
    // fail at 0 → +120 s; fail at 120 → +240 s; ok at 360 → +60 s
    expect(at).toEqual([0, 120_000, 360_000, 420_000, 480_000]);
    stop();
  });
});

describe('service worker never caches TASO', () => {
  it('vite PWA config routes torneopal hosts NetworkOnly, and TASO fetches use no-store', () => {
    const cfg = readFileSync(new URL('../../vite.config.ts', import.meta.url), 'utf8');
    expect(cfg).toMatch(/torneopal[\s\S]{0,80}handler: 'NetworkOnly'/);
    const client = readFileSync(new URL('../../src/lib/api/torneopalClient.ts', import.meta.url), 'utf8');
    expect(client).toContain('cache: "no-store"');
  });
});
