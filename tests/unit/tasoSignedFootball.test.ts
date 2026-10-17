import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchTorneopalTeamData,
  tasoHash,
  tasoRequestUrl,
  listTorneopalAttempts,
} from '../../src/lib/api/torneopalClient';
import { ingestOfficialForProfile } from '../../src/lib/clubs/ingestOfficial';
import { notificationStore } from '../../src/lib/notifications/notificationStore';
import type { MatchdayEvent, ParsedAssociationUrl } from '../../src/types/matchday';
import { createTestDb, deleteTestDb } from '../helpers/setupDexie';
import type { PelipaivaDB } from '../../src/lib/storage/db';
import recorded from '../fixtures/json/taso-spl-signed-team-185085-2026-10-17.json';

// Real responses spl.torneopal.net gave the signed calls for PPJ/Laru sin on
// 17.10.2026. Since ~Oct 2026 the same calls without `hash` get an empty 403.
type Rec = { url: string; status: number; body: unknown };
const rec = recorded as unknown as Record<'getTeam' | 'getMatches' | 'getGroup', Rec>;
const TEAM_ID = '185085';
const URL_ = `https://tulospalvelu.palloliitto.fi/team/${TEAM_ID}`;
const parsed: ParsedAssociationUrl = { sport: 'football', association: 'palloliitto', teamId: TEAM_ID, canonicalUrl: URL_ };

/** Serves the recordings only for exactly the signed URL Taso accepted; anything else is Taso's 403. */
function signedTaso() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const hit = (['getTeam', 'getMatches', 'getGroup'] as const).map((k) => rec[k]).find((r) => r.url === url);
    return hit ? new Response(JSON.stringify(hit.body), { status: 200 }) : new Response('', { status: 403 });
  });
}
const unsignedOnly = () => vi.fn(async () => new Response('', { status: 403 }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-17T10:30:00Z'));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Palloliitto TASO request signing', () => {
  it('matches the hash Taso accepted for getMatch 4208631 (football-stats#18)', async () => {
    expect(await tasoHash('getMatch', { match_id: '4208631' })).toBe(
      '72bc620417894b41f41cd5f82634bd140889c33f4896a1148b34fc3a081d3fa6'
    );
  });

  it('reproduces the recorded signed URLs byte for byte', async () => {
    for (const r of (['getTeam', 'getMatches', 'getGroup'] as const).map((k) => rec[k])) {
      const u = new URL(r.url);
      const params = Object.fromEntries([...u.searchParams].filter(([k]) => k !== 'hash'));
      const method = u.pathname.split('/').pop()!;
      expect(await tasoRequestUrl('https://spl.torneopal.net/taso/rest', method, params)).toBe(r.url);
    }
  });

  it('signs only spl.torneopal.net; floorball, basketball and volleyball hosts unchanged', async () => {
    for (const sport of ['floorball', 'basketball', 'volleyball'] as const) {
      const [ep] = listTorneopalAttempts('torneopal', undefined, sport);
      const url = await tasoRequestUrl(ep!.base, 'getTeam', { team_id: '1' });
      expect(url).not.toContain('hash=');
    }
  });

  it('loads real PPJ/Laru sin games with Helsinki times from the signed answers', async () => {
    vi.stubGlobal('fetch', signedTaso());
    const data = await fetchTorneopalTeamData(parsed);
    expect(data?.teamName).toBe('PPJ/Laru sin');
    expect(data?.fixturesComplete).toBe(true);
    const byStart = Object.fromEntries(data!.fixtures.map((f) => [f.startTime, f]));
    expect(byStart['2026-10-08T18:00:00+03:00']?.awayTeam).toBe('Kasiysi/PEP YJ2');
    expect(byStart['2026-10-08T18:00:00+03:00']?.status).toBe('played');
    expect(byStart['2026-10-04T10:15:00+03:00']?.homeTeam).toBe('EsPa/Keltainen 3');
  });

  it('without a valid signature (Taso 403) the client returns null, not an empty season', async () => {
    vi.stubGlobal('fetch', unsignedOnly());
    expect(await fetchTorneopalTeamData(parsed)).toBeNull();
  });
});

describe('failed Palloliitto fetch is an error, never "no games", never a prune', () => {
  let db: PelipaivaDB;
  const PROFILE = 'simo';
  const stored = (id: string): MatchdayEvent =>
    ({
      id: `fixture-${PROFILE}-${id}`, profileId: PROFILE, title: 'PPJ/Laru sin vs X', eventType: 'match', isTraining: false,
      sport: 'football', startTime: '2026-10-08T15:00:00.000Z', endTime: '2026-10-08T16:30:00.000Z', officialFixtureId: id,
    }) as unknown as MatchdayEvent;

  beforeEach(async () => {
    db = await createTestDb();
    await db.events.bulkPut([stored('a'), stored('b')]);
  });
  afterEach(async () => { await deleteTestDb(db); });

  it('keeps stored games and raises "Palloliiton tietoja ei saatu juuri nyt"', async () => {
    vi.stubGlobal('fetch', unsignedOnly());
    const push = vi.spyOn(notificationStore, 'push');
    await ingestOfficialForProfile({
      profileId: PROFILE, playerName: 'Simo', teamName: 'PPJ/Laru sin', sport: 'football', url: URL_, database: db, includeWeather: false,
    });
    expect(await db.events.where('profileId').equals(PROFILE).count()).toBe(2);
    expect(push.mock.calls.some(([n]) => /Palloliiton tietoja ei saatu juuri nyt/.test(JSON.stringify(n)))).toBe(true);
  });
});
