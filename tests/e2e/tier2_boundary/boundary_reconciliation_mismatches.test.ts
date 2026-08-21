import { describe, it, expect } from 'vitest';
import {
  reconcileCalendarWithOfficial,
  computeMismatchDiagnostics,
  applyResolutionDecision
} from '../../../src/lib/reconciliation/reconciliationEngine';
import { calculateTeamSimilarity, normalizeTeamName } from '../../../src/lib/reconciliation/teamNameMatcher';
import { MatchdayEvent, OfficialLeagueFixture } from '../../../src/types/matchday';

describe('Tier 2 Boundary: Reconciliation, Fuzzy Join & Mismatch Diagnostics', () => {
  const createMockEvent = (overrides: Partial<MatchdayEvent> = {}): MatchdayEvent => ({
    id: 'cal-event-1',
    profileId: 'prof-1',
    sport: 'football',
    eventType: 'match',
    isTraining: false,
    title: 'HJK T13 Sininen vs EPS Valkoinen',
    homeTeam: 'HJK T13 Sininen',
    awayTeam: 'EPS Valkoinen',
    isHomeMatch: true,
    startTime: '2026-05-16T15:00:00.000Z',
    endTime: '2026-05-16T16:30:00.000Z',
    warmupTime: '2026-05-16T14:15:00.000Z',
    venue: {
      name: 'Töölö PK 1 TN',
      normalizedName: 'toolo pk 1 tn',
      coordinates: { lat: 60.186, lng: 24.925 },
      isIndoor: false,
      surface: 'artificial_turf_3g',
      hasFloodlights: true
    },
    ...overrides
  });

  const createMockFixture = (overrides: Partial<OfficialLeagueFixture> = {}): OfficialLeagueFixture => ({
    id: 'palloliitto_60341_fix1',
    teamId: '60341',
    association: 'palloliitto',
    sport: 'football',
    leagueName: 'T13 Ykkönen',
    homeTeam: 'HJK T13 Sininen',
    awayTeam: 'EPS Valkoinen',
    isHome: true,
    startTime: '2026-05-16T15:00:00.000Z',
    venueName: 'Töölö PK 1 TN',
    status: 'upcoming',
    fetchedAt: '2026-05-16T08:00:00.000Z',
    ...overrides
  });

  // 1. Empty inputs
  it('should return empty map when calendar events list is empty', () => {
    const result = reconcileCalendarWithOfficial([], [createMockFixture()]);
    expect(result.size).toBe(0);
  });

  it('should return unlinked results for all events when official fixtures list is empty', () => {
    const event = createMockEvent();
    const result = reconcileCalendarWithOfficial([event], []);

    expect(result.size).toBe(1);
    expect(result.get('cal-event-1')?.status).toBe('unlinked');
    expect(result.get('cal-event-1')?.confidenceScore).toBe(0);
  });

  // 2. Unrelated opponents (0-similarity)
  it('should not match completely unrelated opponent clubs (0 similarity)', () => {
    const event = createMockEvent({ homeTeam: 'HJK', awayTeam: 'Real Madrid' });
    const fixture = createMockFixture({ homeTeam: 'HJK', awayTeam: 'FC Honka' });

    const result = reconcileCalendarWithOfficial([event], [fixture]);
    const item = result.get(event.id);
    expect(item?.status).toBe('unlinked');
    expect(item?.confidenceScore).toBeLessThan(0.60);
  });

  // 3. Time window boundary tolerances (±3 hours / 180 minutes)
  it('should match within ±179 minutes time difference (within 3h boundary)', () => {
    const event = createMockEvent({ startTime: '2026-05-16T15:00:00.000Z' });
    const fixture = createMockFixture({ startTime: '2026-05-16T17:59:00.000Z' }); // +179 min

    const result = reconcileCalendarWithOfficial([event], [fixture]);
    const item = result.get(event.id);
    expect(item?.status).toBe('candidate_match');
    expect(item?.confidenceScore).toBeGreaterThanOrEqual(0.60);
  });

  it('should NOT match when time difference exceeds 180 minutes (e.g. 181 min / 3h 1m)', () => {
    const event = createMockEvent({ startTime: '2026-05-16T15:00:00.000Z' });
    const fixture = createMockFixture({ startTime: '2026-05-16T18:01:00.000Z' }); // +181 min

    const result = reconcileCalendarWithOfficial([event], [fixture]);
    const item = result.get(event.id);
    expect(item?.status).toBe('unlinked');
  });

  // 4. Exact timestamp match (1.0 time score)
  it('should auto-match with high confidence (>=0.85) on exact time and matching opponent', () => {
    const event = createMockEvent();
    const fixture = createMockFixture();

    const result = reconcileCalendarWithOfficial([event], [fixture]);
    const item = result.get(event.id);

    expect(item?.status).toBe('auto_matched');
    expect(item?.confidenceScore).toBeGreaterThanOrEqual(0.85);
    expect(item?.officialFixture?.id).toBe(fixture.id);
    expect(item?.mismatches?.hasKickoffMismatch).toBe(false);
  });

  // 5. Inverted Home / Away Reversals
  it('should match inverted Home/Away fixtures (Calendar: A vs B, League: B vs A)', () => {
    const event = createMockEvent({
      homeTeam: 'EPS Valkoinen',
      awayTeam: 'HJK T13 Sininen',
      isHomeMatch: false
    });
    const fixture = createMockFixture({
      homeTeam: 'HJK T13 Sininen',
      awayTeam: 'EPS Valkoinen',
      isHome: true
    });

    const result = reconcileCalendarWithOfficial([event], [fixture]);
    const item = result.get(event.id);

    expect(item?.status).toBe('auto_matched');
    expect(item?.confidenceScore).toBeGreaterThanOrEqual(0.85);
  });

  // 6. Overlapping substring clubs (HJK vs HJS vs HIFK)
  it('should distinguish distinct Finnish clubs with overlapping acronyms (HJK, HJS, HIFK)', () => {
    const simHjkHjs = calculateTeamSimilarity('HJK T13', 'HJS T13');
    const simHjkHifk = calculateTeamSimilarity('HJK T13', 'HIFK T13');
    const simHonkaFcHonka = calculateTeamSimilarity('FC Honka Musta', 'Honka Musta');

    expect(simHjkHjs).toBeLessThan(0.70);
    expect(simHjkHifk).toBeLessThan(0.70);
    expect(simHonkaFcHonka).toBeGreaterThanOrEqual(0.85);
  });

  // 7. Team names with punctuation, slashes, and diacritics
  it('should normalize club names with special punctuation (GrIFK, TiPS, PK-35, VJS/PPJ YJ, ÅIFK)', () => {
    expect(normalizeTeamName('GrIFK')).toContain('grifk');
    expect(normalizeTeamName('PK-35')).toContain('pk35');
    expect(normalizeTeamName('TiPS T12')).toContain('tips');
    expect(normalizeTeamName('VJS/PPJ YJ')).toContain('vjs');
    expect(normalizeTeamName('ÅIFK')).toContain('aifk');
  });

  // 8. Venue Mismatch Diagnostics (Same city, different pitch)
  it('should flag venue mismatch when official pitch differs from calendar pitch', () => {
    const event = createMockEvent({
      venue: {
        name: 'Töölö PK 1 TN',
        normalizedName: 'toolo pk 1 tn',
        isIndoor: false,
        surface: 'artificial_turf_3g',
        hasFloodlights: true
      }
    });
    const fixture = createMockFixture({ venueName: 'Brahenkenttä (Väiski)' });

    const diag = computeMismatchDiagnostics(event, fixture);
    expect(diag.hasVenueMismatch).toBe(true);
    expect(diag.calendarVenueName).toBe('Töölö PK 1 TN');
    expect(diag.officialVenueName).toBe('Brahenkenttä (Väiski)');
  });

  it('should NOT flag venue mismatch when venue names are identical or substrings', () => {
    const event = createMockEvent({
      venue: {
        name: 'Töölö PK 1 TN',
        normalizedName: 'toolo pk 1 tn',
        isIndoor: false,
        surface: 'artificial_turf_3g',
        hasFloodlights: true
      }
    });
    const fixture = createMockFixture({ venueName: 'Töölö PK 1 TN' });

    const diag = computeMismatchDiagnostics(event, fixture);
    expect(diag.hasVenueMismatch).toBe(false);
  });

  // 9. Kickoff Mismatch Format Checks
  it('should compute exact minute time difference and format kickoff strings', () => {
    const event = createMockEvent({ startTime: '2026-05-16T15:00:00.000Z' });
    const fixture = createMockFixture({ startTime: '2026-05-16T15:30:00.000Z' });

    const diag = computeMismatchDiagnostics(event, fixture);
    expect(diag.hasKickoffMismatch).toBe(true);
    expect(diag.timeDiffMinutes).toBe(30);
    expect(diag.calendarStartTime).toBeDefined();
    expect(diag.officialStartTime).toBeDefined();
  });

  it('should ignore kickoff differences under 5 minutes', () => {
    const event = createMockEvent({ startTime: '2026-05-16T15:00:00.000Z' });
    const fixture = createMockFixture({ startTime: '2026-05-16T15:02:00.000Z' }); // 2 min diff

    const diag = computeMismatchDiagnostics(event, fixture);
    expect(diag.hasKickoffMismatch).toBe(false);
    expect(diag.timeDiffMinutes).toBe(2);
  });

  // 10. Ambiguous Multiple Candidate Matches
  it('should flag candidate_match rather than auto_matched when two candidate fixtures have close scores', () => {
    const event = createMockEvent({ startTime: '2026-05-16T15:00:00.000Z' });
    const fix1 = createMockFixture({ id: 'fix-1', startTime: '2026-05-16T15:00:00.000Z' });
    const fix2 = createMockFixture({ id: 'fix-2', startTime: '2026-05-16T15:05:00.000Z' });

    const result = reconcileCalendarWithOfficial([event], [fix1, fix2]);
    const item = result.get(event.id);
    expect(item?.status).toBe('candidate_match');
  });

  // 11. 1-Tap Resolution Decisions
  it('should apply "use_official" decision adopting official start time, warmup time, and venue', () => {
    const event = createMockEvent({ startTime: '2026-05-16T14:30:00.000Z' });
    const fixture = createMockFixture({ startTime: '2026-05-16T15:00:00.000Z' });

    const updated = applyResolutionDecision(event, fixture, 'use_official');

    expect(updated.startTime).toBe(fixture.startTime);
    expect(updated.officialFixtureId).toBe(fixture.id);
    expect(updated.reconciliationStatus).toBe('manual_matched');
    expect(updated.userOverride?.action).toBe('adopt_official');
    expect(new Date(updated.warmupTime!).getTime()).toBe(
      new Date(fixture.startTime).getTime() - 45 * 60 * 1000
    );
  });

  it('should apply "keep_calendar" decision retaining calendar time while linking fixture', () => {
    const calStart = '2026-05-16T14:30:00.000Z';
    const event = createMockEvent({ startTime: calStart });
    const fixture = createMockFixture({ startTime: '2026-05-16T15:00:00.000Z' });

    const updated = applyResolutionDecision(event, fixture, 'keep_calendar');

    expect(updated.startTime).toBe(calStart);
    expect(updated.officialFixtureId).toBe(fixture.id);
    expect(updated.reconciliationStatus).toBe('manual_matched');
    expect(updated.userOverride?.action).toBe('keep_calendar');
  });

  it('should apply "unlink" decision clearing fixture link and resetting status to unlinked', () => {
    const event = createMockEvent({ officialFixtureId: 'palloliitto_60341_fix1' });
    const fixture = createMockFixture();

    const updated = applyResolutionDecision(event, fixture, 'unlink');

    expect(updated.officialFixtureId).toBeUndefined();
    expect(updated.reconciliationStatus).toBe('unlinked');
    expect(updated.userOverride?.action).toBe('unlink');
  });

  // 12. Non-match calendar events
  it('should mark training and meeting events as unlinked without running fuzzy match', () => {
    const trainingEvent = createMockEvent({ isTraining: true, eventType: 'training', title: 'Lajiharjoitus' });
    const meetingEvent = createMockEvent({ eventType: 'meeting', title: 'Vanhempainilta' });
    const fixture = createMockFixture();

    const result = reconcileCalendarWithOfficial([trainingEvent, meetingEvent], [fixture]);

    expect(result.get(trainingEvent.id)?.status).toBe('unlinked');
    expect(result.get(meetingEvent.id)?.status).toBe('unlinked');
  });
});
