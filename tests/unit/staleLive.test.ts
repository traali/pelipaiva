import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mapFixture } from '../../src/lib/api/torneopalClient';
import { isEventLive, startLabel } from '../../src/lib/agents/eventPhase';
import { liveOfficialGames, refreshLiveGames } from '../../src/lib/live/liveRefresh';
import type { MatchdayEvent, ParsedAssociationUrl } from '../../src/types/matchday';
import { createTestDb, deleteTestDb } from '../helpers/setupDexie';
import type { PelipaivaDB } from '../../src/lib/storage/db';
import snap from '../fixtures/json/taso-spl-stale-live-sisu-2025.json';

// Real TASO answers (17.10.2026): two 2025 SISU/Valkoinen games still on status "Live".
const stale = snap.matches as Record<string, unknown>[];
const parsed: ParsedAssociationUrl = { sport: 'football', association: 'palloliitto', teamId: String(stale[0]!.team_A_id), canonicalUrl: 'https://tulospalvelu.palloliitto.fi/team/x' };
let db: PelipaivaDB;
const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-17T14:35:00+03:00'));
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockClear();
  db = createTestDb();
});
afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  await deleteTestDb(db);
});

describe('stuck TASO "Live" from an earlier day (3891605, 3891623)', () => {
  it('is not running: no live score, no Käynnissä', () => {
    for (const m of stale) {
      expect(m.status).toBe('Live');
      const f = mapFixture(m, parsed, 'SISU/Valkoinen')!;
      expect(f.liveScore).toBeUndefined();
      const ev = { ...f, endTime: f.endTime! };
      expect(isEventLive(ev)).toBe(false);
      expect(startLabel(ev)).not.toMatch(/Käynnissä/);
    }
  });

  it('never triggers polling, even if a live score was stored', async () => {
    for (const m of stale) {
      const f = mapFixture(m, parsed, 'SISU/Valkoinen')!;
      await db.events.put({
        id: `fixture-s-${f.id}`, profileId: 's', title: 'x', eventType: 'match', isTraining: false, sport: 'football',
        startTime: f.startTime, endTime: f.endTime!, officialFixtureId: f.id, liveScore: '7–0',
      } as unknown as MatchdayEvent);
    }
    expect(await liveOfficialGames(db)).toHaveLength(0);
    expect(await refreshLiveGames(db)).toEqual({ live: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
