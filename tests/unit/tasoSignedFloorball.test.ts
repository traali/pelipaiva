import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { fetchTorneopalTeamData, tasoRequestUrl, listTorneopalAttempts } from '../../src/lib/api/torneopalClient';
import { ingestOfficialForProfile } from '../../src/lib/clubs/ingestOfficial';
import { notificationStore } from '../../src/lib/notifications/notificationStore';
import { refreshLiveGames, tasoLiveRef } from '../../src/lib/live/liveRefresh';
import type { MatchdayEvent, ParsedAssociationUrl } from '../../src/types/matchday';
import { createTestDb, deleteTestDb } from '../helpers/setupDexie';
import type { PelipaivaDB } from '../../src/lib/storage/db';
import recorded from '../fixtures/json/taso-salibandy-signed-team-25301-2026-10-24.json';

// Real answers salibandy-api.torneopal.net gave signed calls for Westend Indians
// Yellow (25301) on 24.10.2026 ~15:10 Helsinki, during 949684 (Live 1–3).
// Badly signed calls get HTTP 200 with the body "Not allowed 2".
type Rec = { url: string; status: number; body: unknown };
const rec = recorded as unknown as Record<'getTeam' | 'getMatches' | 'getMatch', Rec>;
const SALT = 'ysnyp4h6e9egetkc3s3v';
const KEY = 'zsn3anknxzcfzc23k53jqdcd4pymutsf';
const TEAM_ID = '25301';
const URL_ = `https://tulospalvelu.salibandy.fi/team/${TEAM_ID}`;
const parsed: ParsedAssociationUrl = { sport: 'floorball', association: 'salibandy', teamId: TEAM_ID, canonicalUrl: URL_ };

/** Salibandy TASO: answers the recorded body only when `hash` is valid and the key is in Accept. */
function signedSalibandy() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = new URL(String(input));
    const method = u.pathname.split('/').pop()!;
    const params = [...u.searchParams].filter(([k]) => k !== 'hash');
    const want = createHash('sha256').update(`${method}?${SALT}` + params.map(([k, v]) => `&${k}=${v}`).join('')).digest('hex');
    const accept = (init?.headers as Record<string, string> | undefined)?.Accept;
    const r = (rec as Record<string, Rec>)[method];
    if (u.hostname !== 'salibandy-api.torneopal.net' || u.searchParams.get('hash') !== want || accept !== `json/${KEY}` || !r)
      return new Response('Not allowed 2', { status: 200 });
    return new Response(JSON.stringify(r.body), { status: 200 });
  });
}
const notAllowed = () => vi.fn(async () => new Response('Not allowed 2', { status: 200 }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-24T12:10:00Z'));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Salibandyliitto TASO request signing', () => {
  it('reproduces the recorded signed URLs byte for byte', async () => {
    const [ep] = listTorneopalAttempts('salibandy', undefined, 'floorball');
    expect(ep!.base).toBe('https://salibandy-api.torneopal.net/taso/rest');
    for (const r of Object.values(rec)) {
      const u = new URL(r.url);
      const params = Object.fromEntries([...u.searchParams].filter(([k]) => k !== 'hash'));
      expect(await tasoRequestUrl(ep!.base, u.pathname.split('/').pop()!, params)).toBe(r.url);
    }
  });

  it("loads today's Westend Indians Yellow games from the signed answers", async () => {
    vi.stubGlobal('fetch', signedSalibandy());
    const data = await fetchTorneopalTeamData(parsed);
    expect(data?.teamName).toBe('Westend Indians Yellow');
    const byStart = Object.fromEntries(data!.fixtures.map((f) => [f.startTime, f]));
    expect(byStart['2026-10-24T15:00:00+03:00']?.awayTeam).toBe('SB Vantaa Valkoinen');
    expect(byStart['2026-10-24T17:45:00+03:00']?.awayTeam).toBe('KorsKa Scorpions');
  });

  it('"Not allowed 2" is a failure (null), never an empty season', async () => {
    vi.stubGlobal('fetch', notAllowed());
    expect(await fetchTorneopalTeamData(parsed)).toBeNull();
  });
});

describe('floorball failures and live refresh', () => {
  let db: PelipaivaDB;
  const PROFILE = 'simo';
  const stored = (id: string, start: string): MatchdayEvent =>
    ({
      id: `fixture-${PROFILE}-${id}`, profileId: PROFILE, title: 'Westend Indians Yellow vs X', eventType: 'match', isTraining: false,
      sport: 'floorball', startTime: start, endTime: new Date(Date.parse(start) + 90 * 60_000).toISOString(),
      officialFixtureId: `salibandy_${TEAM_ID}_${id}`,
    }) as unknown as MatchdayEvent;

  beforeEach(async () => {
    db = await createTestDb();
    await db.events.bulkPut([stored('949684', '2026-10-24T12:00:00.000Z'), stored('949686', '2026-10-24T14:45:00.000Z')]);
  });
  afterEach(async () => { await deleteTestDb(db); });

  it('"Not allowed" keeps stored games and raises "Salibandyliiton tietoja ei saatu juuri nyt"', async () => {
    vi.stubGlobal('fetch', notAllowed());
    const push = vi.spyOn(notificationStore, 'push');
    await ingestOfficialForProfile({
      profileId: PROFILE, playerName: 'Simo', teamName: 'Westend Indians Yellow', sport: 'floorball', url: URL_, database: db, includeWeather: false,
    });
    expect(await db.events.where('profileId').equals(PROFILE).count()).toBe(2);
    expect(push.mock.calls.some(([n]) => /Salibandyliiton tietoja ei saatu juuri nyt/.test(JSON.stringify(n)))).toBe(true);
  });

  it('live refresh polls the floorball game signed and stores its score', async () => {
    expect(tasoLiveRef({ officialFixtureId: 'salibandy_25301_949684' })).toEqual({ fed: 'salibandy', matchId: '949684' });
    const f = signedSalibandy();
    vi.stubGlobal('fetch', f);
    const r = await refreshLiveGames(db, new Date('2026-10-24T12:10:00Z'));
    expect(r).toEqual({ live: 1, failed: 0 });
    expect(String(f.mock.calls[0]![0])).toContain('salibandy-api.torneopal.net/taso/rest/getMatch?match_id=949684&hash=');
    expect((await db.events.get(`fixture-${PROFILE}-949684`))?.liveScore).toBe('1–3');
  });

  it('live refresh on "Not allowed" counts a failure and leaves the game untouched', async () => {
    vi.stubGlobal('fetch', notAllowed());
    expect(await refreshLiveGames(db, new Date('2026-10-24T12:10:00Z'))).toEqual({ live: 1, failed: 1 });
    expect(await db.events.count()).toBe(2);
  });
});
