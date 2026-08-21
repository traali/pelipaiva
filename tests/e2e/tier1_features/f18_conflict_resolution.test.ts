import { describe, it, expect } from 'vitest';
import { applyResolutionDecision } from '../../../src/lib/reconciliation/reconciliationEngine';
import { MatchdayEvent, OfficialLeagueFixture } from '../../../src/types/matchday';

describe('Feature 18: 1-Tap Conflict Resolution Actions', () => {
  const officialFixture: OfficialLeagueFixture = {
    id: 'spl_101',
    teamId: '60341',
    association: 'palloliitto',
    sport: 'football',
    leagueName: 'T13 Ykkönen',
    homeTeam: 'HJK T13 Sininen',
    awayTeam: 'EPS',
    isHome: true,
    startTime: '2026-05-16T13:00:00.000Z', // 16:00 EEST
    venueName: 'Puotilan Tekonurmi (Bubu)',
    status: 'upcoming',
    fetchedAt: new Date().toISOString()
  };

  const calendarEvent: MatchdayEvent = {
    id: 'ev-conflict-1',
    profileId: 'p1',
    sport: 'football',
    eventType: 'match',
    isTraining: false,
    title: 'HJK vs EPS',
    homeTeam: 'HJK T13 Sininen',
    awayTeam: 'EPS',
    isHomeMatch: true,
    startTime: '2026-05-16T12:00:00.000Z', // 15:00 EEST (discrepancy)
    endTime: '2026-05-16T13:30:00.000Z',
    warmupTime: '2026-05-16T11:15:00.000Z',
    venue: {
      name: 'Väinämöisen kenttä',
      normalizedName: 'vainamoinen',
      coordinates: { lat: 60.1741, lng: 24.9192 },
      isIndoor: false,
      surface: 'sand_artificial_turf',
      hasFloodlights: true
    }
  };

  it('should apply "use_official" action: adopt official kickoff time, recompute warmup, and set user override metadata', () => {
    const updated = applyResolutionDecision(calendarEvent, officialFixture, 'use_official');

    expect(updated.startTime).toBe(officialFixture.startTime);
    expect(updated.officialFixtureId).toBe(officialFixture.id);
    expect(updated.userOverride?.action).toBe('adopt_official');
    expect(updated.reconciliationStatus).toBe('manual_matched');
    expect(new Date(updated.warmupTime).getTime()).toBe(
      new Date(officialFixture.startTime).getTime() - 45 * 60000
    );
  });

  it('should apply "keep_calendar" action: retain private calendar times and mark override status', () => {
    const updated = applyResolutionDecision(calendarEvent, officialFixture, 'keep_calendar');

    expect(updated.startTime).toBe(calendarEvent.startTime);
    expect(updated.venue.name).toBe(calendarEvent.venue.name);
    expect(updated.officialFixtureId).toBe(officialFixture.id);
    expect(updated.userOverride?.action).toBe('keep_calendar');
  });

  it('should apply "unlink" action: sever link and clear officialFixtureId', () => {
    const linkedEvent: MatchdayEvent = {
      ...calendarEvent,
      officialFixtureId: officialFixture.id,
      reconciliationStatus: 'auto_matched'
    };

    const unlinked = applyResolutionDecision(linkedEvent, officialFixture, 'unlink');

    expect(unlinked.officialFixtureId).toBeUndefined();
    expect(unlinked.reconciliationStatus).toBe('unlinked');
    expect(unlinked.userOverride?.action).toBe('unlink');
  });

  it('should preserve existing matchday briefing and notes across resolution actions', () => {
    const eventWithBriefing: MatchdayEvent = {
      ...calendarEvent,
      volunteerDuty: '☕ Kahviovuoro'
    };

    const result = applyResolutionDecision(eventWithBriefing, officialFixture, 'use_official');
    expect(result.volunteerDuty).toBe('☕ Kahviovuoro');
  });

  it('should include timestamped audit log in userOverride record', () => {
    const result = applyResolutionDecision(calendarEvent, officialFixture, 'use_official');
    expect(result.userOverride?.appliedAt).toBeDefined();
    expect(new Date(result.userOverride!.appliedAt).getTime()).not.toBeNaN();
    expect(result.userOverride?.notes).toBeDefined();
  });
});
