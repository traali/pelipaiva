import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fetchTorneopalTeamData,
  isOwnTeamMatch,
  keepOwnTeamMatches,
  mapFixture,
} from '../../src/lib/api/torneopalClient';
import { ingestOfficialForProfile } from '../../src/lib/clubs/ingestOfficial';
import type { MatchdayEvent, ParsedAssociationUrl } from '../../src/types/matchday';
import { createTestDb, deleteTestDb } from '../helpers/setupDexie';
import type { PelipaivaDB } from '../../src/lib/storage/db';
import groupPayload from '../fixtures/json/taso-getGroup-football-etejp26-P11-17-2026-10-08.json';
import teamPayload from '../fixtures/json/taso-getTeam-football-35121815-2026-10-08.json';

// Real TASO payloads for PPJ/Eira Oranssi (football P11, team 35121815), captured
// 8.10.2026 and trimmed to match/standing fields (no player, referee or contact data).
// Its group etejp26/P11/17 lists 156 games; 18 of them are PPJ/Eira Oranssi's.

const TEAM_ID = '35121815';
const TEAM_NAME = 'PPJ/Eira Oranssi';
const URL_ = `https://tulospalvelu.palloliitto.fi/team/${TEAM_ID}`;
const parsed: ParsedAssociationUrl = {
  sport: 'football',
  association: 'palloliitto',
  teamId: TEAM_ID,
  canonicalUrl: URL_,
};

type Raw = Record<string, unknown>;
const groupMatches = (groupPayload as { group: { matches: Raw[] } }).group.matches;
const involvesTeam = (m: { team_A_id?: unknown; team_B_id?: unknown }) =>
  String(m.team_A_id) === TEAM_ID || String(m.team_B_id) === TEAM_ID;
const ownMatchIds = new Set(groupMatches.filter(involvesTeam).map((m) => String(m.match_id)));

function tasoFetch(opts: { group?: unknown; fail?: boolean } = {}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (opts.fail) throw new TypeError('Failed to fetch');
    if (url.hostname !== 'spl.torneopal.net') return new Response('', { status: 404 });
    const method = url.pathname.split('/').pop();
    const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (method === 'getTeam') return json(teamPayload);
    // The team's own getMatches window is empty after its spring series (true on 8.10.2026).
    if (method === 'getMatches') return json({ call: { status: 'ok', total_result_count: 0 }, matches: [] });
    if (method === 'getGroup') return opts.group === null ? new Response('', { status: 503 }) : json(opts.group ?? groupPayload);
    return new Response('', { status: 404 });
  });
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('own games only (real PPJ/Eira Oranssi group payload)', () => {
  it('before: taking the raw group listing made 138 of 156 games foreign', () => {
    expect(groupMatches).toHaveLength(156);
    const before = groupMatches.map((m) => mapFixture(m, parsed, TEAM_NAME)!).filter(Boolean);
    expect(before).toHaveLength(156);
    expect(groupMatches.filter((m) => !involvesTeam(m))).toHaveLength(138);
    expect(ownMatchIds.size).toBe(18);
  });

  it('after: fetchTorneopalTeamData keeps all 18 own games and 0 foreign', async () => {
    vi.stubGlobal('fetch', tasoFetch());
    const data = await fetchTorneopalTeamData(parsed);
    expect(data).not.toBeNull();
    const fixtures = data!.fixtures;
    const foreign = fixtures.filter(
      (f) => f.homeTeam !== TEAM_NAME && f.awayTeam !== TEAM_NAME
    );
    expect(foreign).toHaveLength(0);
    expect(new Set(fixtures.map((f) => f.matchId))).toEqual(ownMatchIds);
    expect(fixtures).toHaveLength(18);
    expect(data!.fixturesComplete).toBe(true);
    // Home/away comes from the ids, not a loose name match.
    for (const f of fixtures) {
      const raw = groupMatches.find((m) => String(m.match_id) === f.matchId)!;
      expect(f.isHome).toBe(String(raw.team_A_id) === TEAM_ID);
    }
  });

  it('marks the fixture list incomplete when the group call fails', async () => {
    vi.stubGlobal('fetch', tasoFetch({ group: null }));
    const data = await fetchTorneopalTeamData(parsed);
    expect(data!.fixtures).toHaveLength(0);
    expect(data!.fixturesComplete).toBe(false);
  });

  it('decides by team id; name match only when a match has no ids, and never by substring', () => {
    const m = (a: string, b: string, an = 'X', bn = 'Y') => ({ team_A_id: a, team_B_id: b, team_A_name: an, team_B_name: bn });
    expect(isOwnTeamMatch(m(TEAM_ID, '1'), TEAM_ID, TEAM_NAME)).toBe(true);
    expect(isOwnTeamMatch(m('1', TEAM_ID), TEAM_ID, TEAM_NAME)).toBe(true);
    // Ids present but not ours: a same-named row is still not ours.
    expect(isOwnTeamMatch(m('1', '2', TEAM_NAME, 'HJK'), TEAM_ID, TEAM_NAME)).toBe(false);
    // No ids: exact normalized name.
    expect(isOwnTeamMatch(m('', '', 'PPJ/Eira Oranssi', 'HJK'), TEAM_ID, TEAM_NAME)).toBe(true);
    expect(isOwnTeamMatch(m('', '', 'ppj / eira  oranssi', 'HJK'), TEAM_ID, TEAM_NAME)).toBe(true);
    expect(isOwnTeamMatch(m('', '0', 'HJK', 'ppj-eira oranssi'), TEAM_ID, TEAM_NAME)).toBe(true);
    expect(isOwnTeamMatch(m('', '', 'PPJ', 'HJK'), TEAM_ID, TEAM_NAME)).toBe(false);
    expect(isOwnTeamMatch(m('', '', 'PPJ/Eira Oranssi 2', 'HJK'), TEAM_ID, TEAM_NAME)).toBe(false);
    expect(keepOwnTeamMatches(groupMatches, TEAM_ID, TEAM_NAME)).toHaveLength(18);
  });
});

describe('re-ingest prunes foreign games already stored on phones', () => {
  let db: PelipaivaDB;
  const PROFILE = `p:aino:tulospalvelu.palloliitto.fi:${TEAM_ID}`;

  // What an earlier build stored: every group game as this child's event.
  async function seedOldBuildState() {
    await db.profiles.put({
      id: PROFILE,
      playerName: 'Aino',
      teamName: TEAM_NAME,
      sport: 'football',
      primaryColor: 'oranssi',
      calendarUrl: URL_,
      colorHex: '#f97316',
    });
    const old = groupMatches.map((m) => mapFixture(m, parsed, TEAM_NAME)!);
    await db.officialFixtures.bulkPut(old);
    const events = old.map(
      (f) =>
        ({
          id: `fixture-${PROFILE}-${f.id}`,
          profileId: PROFILE,
          title: `${f.homeTeam} vs ${f.awayTeam}`,
          eventType: 'match',
          isTraining: false,
          sport: 'football',
          homeTeam: f.homeTeam,
          awayTeam: f.awayTeam,
          startTime: f.startTime,
          endTime: f.endTime,
          venue: { name: f.venueName },
          officialFixtureId: f.id,
        }) as unknown as MatchdayEvent
    );
    // Parent-made and calendar events for the same child must survive.
    events.push({
      id: 'manual-aino-1',
      profileId: PROFILE,
      title: 'Kesäleiri',
      eventType: 'training',
      isTraining: true,
      sport: 'football',
      startTime: '2026-06-23T09:00:00+03:00',
      endTime: '2026-06-23T12:00:00+03:00',
      venue: { name: 'Eläintarha' },
    } as unknown as MatchdayEvent);
    events.push({
      id: 'ics-aino-1',
      profileId: PROFILE,
      title: 'Treenit',
      eventType: 'training',
      isTraining: true,
      sport: 'football',
      startTime: '2026-06-24T17:00:00+03:00',
      endTime: '2026-06-24T18:30:00+03:00',
      venue: { name: 'Eläintarha' },
    } as unknown as MatchdayEvent);
    await db.events.bulkPut(events);
  }

  const officialEvents = async () =>
    (await db.events.where('profileId').equals(PROFILE).toArray()).filter((e) => e.id.startsWith('fixture-'));

  beforeEach(async () => {
    db = createTestDb();
    await db.open();
    await seedOldBuildState();
  });
  afterEach(async () => {
    await deleteTestDb(db);
  });

  it('156 stored (138 foreign) → 18 own after re-ingest; parent and calendar events kept', async () => {
    const before = await officialEvents();
    expect(before).toHaveLength(156);
    expect(before.filter((e) => e.homeTeam !== TEAM_NAME && e.awayTeam !== TEAM_NAME)).toHaveLength(138);

    vi.stubGlobal('fetch', tasoFetch());
    await ingestOfficialForProfile({
      profileId: PROFILE,
      playerName: 'Aino',
      teamName: TEAM_NAME,
      sport: 'football',
      url: URL_,
      database: db,
      includeWeather: false,
    });

    const after = await officialEvents();
    expect(after.filter((e) => e.homeTeam !== TEAM_NAME && e.awayTeam !== TEAM_NAME)).toHaveLength(0);
    expect(after).toHaveLength(18);
    expect(new Set(after.map((e) => e.officialFixtureId!.split('_').pop()))).toEqual(ownMatchIds);
    expect(await db.events.get('manual-aino-1')).toBeDefined();
    expect(await db.events.get('ics-aino-1')).toBeDefined();
    const cached = await db.officialFixtures.where('teamId').equals(TEAM_ID).toArray();
    expect(cached).toHaveLength(18);
  });

  it('a complete TASO answer with no own games removes all stored official games, nothing else', async () => {
    const onlyOthers = structuredClone(groupPayload) as { group: { matches: Raw[] } };
    onlyOthers.group.matches = onlyOthers.group.matches.filter((m) => !involvesTeam(m));
    vi.stubGlobal('fetch', tasoFetch({ group: onlyOthers }));
    await ingestOfficialForProfile({
      profileId: PROFILE,
      playerName: 'Aino',
      teamName: TEAM_NAME,
      sport: 'football',
      url: URL_,
      database: db,
      includeWeather: false,
    });
    expect(await officialEvents()).toHaveLength(0);
    expect(await db.officialFixtures.where('teamId').equals(TEAM_ID).count()).toBe(0);
    expect(await db.events.get('manual-aino-1')).toBeDefined();
    expect(await db.events.get('ics-aino-1')).toBeDefined();
  });

  it('a failed or partial fetch keeps the offline cache untouched', async () => {
    vi.stubGlobal('fetch', tasoFetch({ fail: true }));
    await ingestOfficialForProfile({
      profileId: PROFILE, playerName: 'Aino', teamName: TEAM_NAME, sport: 'football', url: URL_, database: db, includeWeather: false,
    });
    expect(await officialEvents()).toHaveLength(156);

    vi.stubGlobal('fetch', tasoFetch({ group: null }));
    await ingestOfficialForProfile({
      profileId: PROFILE, playerName: 'Aino', teamName: TEAM_NAME, sport: 'football', url: URL_, database: db, includeWeather: false,
    });
    expect(await officialEvents()).toHaveLength(156);
  });
});
