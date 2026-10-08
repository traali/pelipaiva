import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CLUBS_TTL_MS,
  clearTasoDirectoryCache,
  filterTeams,
  getClubTeams,
  searchClubs,
  foldFi,
} from '../../src/lib/api/tasoDirectory';
import { parseAssociationUrl } from '../../src/lib/api/associationUrlParser';
import clubsFloorball from '../fixtures/json/taso-getClubs-floorball-2026-10-08.json';
import club757 from '../fixtures/json/taso-getClub-floorball-757-2026-10-08.json';
import club52 from '../fixtures/json/taso-getClub-football-52-2026-10-08.json';

// Real TASO payloads captured 8.10.2026 (trimmed: a few clubs/teams, no personal contact fields).

class MemoryStorage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(k: string) { return this.map.has(k) ? this.map.get(k)! : null; }
  key(i: number) { return Array.from(this.map.keys())[i] ?? null; }
  removeItem(k: string) { this.map.delete(k); }
  setItem(k: string, v: string) { this.map.set(k, String(v)); }
}

type Route = (url: URL) => unknown | Response | Promise<unknown>;

function mockFetch(route: Route) {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const out = await route(url);
    if (out instanceof Response) return out;
    return new Response(JSON.stringify(out), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

let storage: MemoryStorage;

beforeEach(() => {
  clearTasoDirectoryCache();
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('searchClubs (real getClubs payload)', () => {
  it('finds Westend Indians in floorball via the salibandy TASO host with the app key', async () => {
    const fetchFn = mockFetch(() => clubsFloorball);
    const res = await searchClubs('floorball', 'westend');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data.map((c) => c.clubId)).toEqual(['757']);
    expect(res.data[0]!.name).toBe('WESTEND INDIANS');
    expect(res.data[0]!.displayName).toBe('Westend Indians');
    expect(res.data[0]!.city).toBe('Espoo');
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(String(url)).toBe('https://salibandy-api.torneopal.net/taso/rest/getClubs?');
    expect((init as RequestInit).headers).toMatchObject({ Accept: 'json/zsn3anknxzcfzc23k53jqdcd4pymutsf' });
  });

  it('never returns the "# EI SEURAA TIEDOSSA" placeholder or nameless clubs', async () => {
    const payload = structuredClone(clubsFloorball) as { clubs: Record<string, unknown>[] };
    payload.clubs.push({ ...payload.clubs[1]!, club_id: '9001', name: null, abbrevation: 'seuraa' });
    payload.clubs.push({ ...payload.clubs[1]!, club_id: '9002', name: '', abbrevation: 'seuraa' });
    mockFetch(() => payload);
    for (const q of ['ei seuraa', 'tiedossa', 'seuraa', '# ei']) {
      const res = await searchClubs('floorball', q);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data).toEqual([]);
    }
  });

  it('matches Finnish letters case-insensitively, with or without ä/ö/å', async () => {
    mockFetch(() => clubsFloorball);
    const ids = async (q: string) => {
      const r = await searchClubs('floorball', q);
      return r.ok ? r.data.map((c) => c.clubId) : ['ERROR'];
    };
    expect(await ids('bärs')).toEqual(['24']);
    expect(await ids('BÄRS')).toEqual(['24']);
    expect(await ids('bars')).toEqual(['24']);
    expect(await ids('Töölön')).toEqual(['60']);
    expect(await ids('åland')).toEqual(['989']);
    expect(await ids('aland')).toEqual(['989']);
    expect(await ids('ylikylä')).toEqual(['4480']);
  });

  it('matches the abbreviation and ranks prefix hits first', async () => {
    mockFetch(() => clubsFloorball);
    const bbu = await searchClubs('floorball', 'bbu');
    expect(bbu.ok && bbu.data.map((c) => c.clubId)).toEqual(['29']);
    const bk = await searchClubs('floorball', 'bk');
    // "BK-BÄRS" starts with bk; "BK EÅT" is not in the trimmed sample, BÄRBÄR does not contain "bk".
    expect(bk.ok && bk.data[0]!.clubId).toBe('24');
  });

  it('ignores 1-letter queries without calling TASO', async () => {
    const fetchFn = mockFetch(() => clubsFloorball);
    const res = await searchClubs('floorball', 'w');
    expect(res).toEqual({ ok: true, data: [] });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('caches getClubs in memory and localStorage, and refetches after the TTL', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-08T06:00:00Z'));
    const fetchFn = mockFetch(() => clubsFloorball);
    await searchClubs('floorball', 'westend');
    await searchClubs('floorball', 'indians');
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(storage.getItem('pelipaiva:taso-clubs:v1:floorball')).toContain('WESTEND INDIANS');

    clearTasoDirectoryCache(); // new session: memory gone, localStorage stays
    const fromStorage = await searchClubs('floorball', 'westend');
    expect(fromStorage.ok && fromStorage.data[0]!.clubId).toBe('757');
    expect(fetchFn).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date(Date.now() + CLUBS_TTL_MS + 1000));
    await searchClubs('floorball', 'westend');
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('returns an explicit error when TASO fails, never the static catalog', async () => {
    mockFetch(() => {
      throw new TypeError('Failed to fetch');
    });
    expect(await searchClubs('football', 'HJK')).toEqual({ ok: false, error: 'unavailable' });
    clearTasoDirectoryCache();
    mockFetch(() => new Response('no access', { status: 200 }));
    expect(await searchClubs('floorball', 'westend')).toEqual({ ok: false, error: 'unavailable' });
    clearTasoDirectoryCache();
    mockFetch(() => ({ call: { status: 'error' }, clubs: [] }));
    expect(await searchClubs('floorball', 'westend')).toEqual({ ok: false, error: 'unavailable' });
    clearTasoDirectoryCache();
    mockFetch(() => new Response('', { status: 503 }));
    expect(await searchClubs('floorball', 'westend')).toEqual({ ok: false, error: 'unavailable' });
  });

  it('says unsupported for sports without a TASO directory, without calling out', async () => {
    const fetchFn = mockFetch(() => clubsFloorball);
    expect(await searchClubs('icehockey', 'kiekko')).toEqual({ ok: false, error: 'unsupported-sport' });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe('getClubTeams (real getClub payloads)', () => {
  it('Westend Indians: active teams only, labelled from TASO, with URLs the importer parses', async () => {
    const fetchFn = mockFetch((url) => {
      expect(url.pathname).toBe('/taso/rest/getClub');
      expect(url.searchParams.get('club_id')).toBe('757');
      return club757;
    });
    const res = await getClubTeams('floorball', '757');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ids = res.data.map((t) => t.teamId);
    expect(ids).not.toContain('33105'); // archived in TASO
    expect(ids).toEqual(['30070', '28632', '25301', '6494', '3567']);
    const yellow = res.data.find((t) => t.teamId === '25301')!;
    expect(yellow.label).toBe('Westend Indians Yellow · 2013 · Etelä-Suomi 2026-27');
    expect(yellow.detail).toBe('U14 Pojat VALK B ES');
    expect(yellow.url).toBe('https://tulospalvelu.salibandy.fi/team/25301');
    expect(res.data.find((t) => t.teamId === '3567')!.label).toBe('Westend Indians V · Etelä-Suomi 2026-27');
    for (const t of res.data) {
      const parsed = parseAssociationUrl(t.url);
      expect(parsed?.teamId).toBe(t.teamId);
      expect(parsed?.sport).toBe('floorball');
    }
    await getClubTeams('floorball', '757');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('PPJ football: drops archived teams and puts the current season first', async () => {
    mockFetch(() => club52);
    const res = await getClubTeams('football', '52');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ids = res.data.map((t) => t.teamId);
    expect(ids).not.toContain('183454');
    expect(ids).not.toContain('35121816');
    expect(ids).toEqual(['35121815', '35119141', '35226307', '35202403', '35121566']);
    expect(res.data.at(-1)!.isCurrentSeason).toBe(false); // 2025 series, no longer active
    // No primary category: label uses the active TASO category, never an invented one.
    expect(res.data.find((t) => t.teamId === '35226307')!.label).toBe('HooGee/Sinivalkoinen · Talviliiga 2026 - 2027');
    for (const t of res.data) {
      expect(t.url).toBe(`https://tulospalvelu.palloliitto.fi/team/${t.teamId}`);
      expect(parseAssociationUrl(t.url)?.sport).toBe('football');
    }
  });

  it('returns an explicit error state when getClub fails', async () => {
    mockFetch(() => new Response('', { status: 500 }));
    expect(await getClubTeams('floorball', '757')).toEqual({ ok: false, error: 'unavailable' });
    mockFetch(() => ({ call: { status: 'ok' } }));
    expect(await getClubTeams('floorball', '758')).toEqual({ ok: false, error: 'unavailable' });
    expect(await getClubTeams('floorball', '../x')).toEqual({ ok: false, error: 'unavailable' });
  });

  it('filterTeams narrows by year or series words', async () => {
    mockFetch(() => club757);
    const res = await getClubTeams('floorball', '757');
    if (!res.ok) throw new Error('expected ok');
    expect(filterTeams(res.data, '2013').map((t) => t.teamId)).toEqual(['25301']);
    expect(filterTeams(res.data, 'yellow 2014').map((t) => t.teamId)).toEqual(['28632']);
    expect(filterTeams(res.data, 'tytöt').map((t) => t.teamId)).toEqual(['30070']);
    expect(filterTeams(res.data, '')).toHaveLength(5);
  });
});

describe('foldFi', () => {
  it('folds Finnish and Swedish letters and punctuation', () => {
    expect(foldFi('ETU-TÖÖLÖN Karhut')).toBe('etu toolon karhut');
    expect(foldFi('FBC Åland')).toBe('fbc aland');
  });
});
