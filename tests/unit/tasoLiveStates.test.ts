import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mapFixture, tasoLiveScore } from '../../src/lib/api/torneopalClient';
import { isEventLive, startLabel } from '../../src/lib/agents/eventPhase';
import type { ParsedAssociationUrl } from '../../src/types/matchday';
import snap from '../fixtures/json/taso-spl-live-states-2026-10-17.json';

// Real signed TASO answers from 17.10.2026 (see _source in the fixture).
type Raw = Record<string, unknown>;
const rows = snap.getMatchesRows as Raw[];
const row = (id: string) => rows.find((m) => m.match_id === id)!;
const card = (id: string) => (snap.getMatch as Record<string, Raw>)[id]!;
const at = (hhmm: string) => new Date(`2026-10-17T${hhmm}:00+03:00`);
const parsed = (teamId: string): ParsedAssociationUrl => ({
  sport: 'football', association: 'palloliitto', teamId, canonicalUrl: `https://tulospalvelu.palloliitto.fi/team/${teamId}`,
});
const asEvent = (m: Raw, teamId: string) => {
  const f = mapFixture(m, parsed(teamId), '')!;
  return { ...f, endTime: f.endTime! };
};

// Mapping runs at the recording time (14:03 Helsinki), while those games were on.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-17T14:03:00+03:00'));
});
afterEach(() => vi.useRealTimers());

describe('1. status Live before kickoff (card opened, clock not started)', () => {
  const pre = snap.preKickoff as Raw; // 4313216 at 13:48, kickoff 13:50, Live 0–0
  it('no 0–0 live score, and it reads "Ottelu alkaa", not Käynnissä, before kickoff', () => {
    expect(tasoLiveScore(pre)).toBeNull();
    const ev = asEvent(pre, String(pre.team_A_id));
    expect(ev.liveScore).toBeUndefined();
    expect(isEventLive(ev, at('13:48'))).toBe(false);
    expect(startLabel(ev, at('13:48'))).toBe('Ottelu alkaa');
  });
  it('after kickoff it reads Käynnissä', () => {
    const ev = asEvent(pre, String(pre.team_A_id));
    expect(startLabel(ev, at('13:51'))).toMatch(/^● Käynnissä/);
  });
});

describe('2. list feed carries the running score in fs_A/fs_B (live_A empty)', () => {
  it('getMatches rows: running score read from fs_A/fs_B', () => {
    expect(row('4313452').live_A).toBe('');
    expect(tasoLiveScore(row('4313452'))?.score).toBe('2–0');
    expect(tasoLiveScore(row('4353585'))?.score).toBe('0–0'); // Ilves–SJK, clock running since 14:01:11
  });
  it('getMatch: same game, score from live_A/live_B', () => {
    expect(tasoLiveScore(card('4353585'))?.score).toBe('0–0');
  });
  it('Ilves–SJK in a list shows "Käynnissä 0–0", not just vs', () => {
    const ev = asEvent(row('4353585'), '60745');
    expect(ev.status).toBe('upcoming');
    expect(ev.score).toBeUndefined(); // never a final score while live
    expect(startLabel(ev, at('14:03'))).toBe('● Käynnissä 0–0 · alkoi');
  });
});

describe('3. status Break (half-time) is in progress with the score', () => {
  it('HJK–OLS 4–0 and TPS–FC KTP 0–1 at half-time (list rows and getMatch)', () => {
    for (const m of [row('4291688'), card('4291688')]) expect(tasoLiveScore(m)).toEqual({ score: '4–0', isBreak: true });
    for (const m of [row('4336888'), card('4336888')]) expect(tasoLiveScore(m)).toEqual({ score: '0–1', isBreak: true });
    const ev = asEvent(row('4336888'), '60627');
    expect(isEventLive(ev, at('14:03'))).toBe(true);
    expect(startLabel(ev, at('14:03'))).toBe('● Käynnissä 0–1 · tauko · alkoi');
  });
  it('a played game keeps its final score and no live score', () => {
    const ev = asEvent(row('4031811'), String(row('4031811').team_A_id));
    expect(ev.score).toBe('2–1');
    expect(ev.liveScore).toBeUndefined();
  });
});
