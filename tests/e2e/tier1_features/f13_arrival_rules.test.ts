import { describe, it, expect } from 'vitest';
import {
  calculateDepartureCountdown,
  generateMatchdayBriefing
} from '../../../src/lib/ai/deterministicReasoner';
import { MatchdayEvent, ArrivalRules, HomeLocation } from '../../../src/types/matchday';

const HOME: HomeLocation = {
  name: 'Koti',
  address: 'Testikatu 1',
  coordinates: { lat: 60.2, lng: 25.0 },
  maxWalkingDistanceKm: 1.5,
  maxCyclingDistanceKm: 5,
  defaultTransitMode: 'car'
};

describe('Feature 13: Configurable Match & Training Arrival Rules', () => {
  const baseEvent: MatchdayEvent = {
    id: 'ev-test-1',
    profileId: 'prof-1',
    sport: 'football',
    eventType: 'match',
    isTraining: false,
    title: 'HJK vs EPS',
    homeTeam: 'HJK',
    awayTeam: 'EPS',
    isHomeMatch: true,
    startTime: '2026-05-16T15:00:00.000Z',
    endTime: '2026-05-16T16:30:00.000Z',
    warmupTime: '2026-05-16T14:15:00.000Z',
    venue: {
      name: 'Puotilan Tekonurmi',
      normalizedName: 'puotila',
      coordinates: { lat: 60.2132, lng: 25.1098 },
      isIndoor: false,
      surface: 'artificial_turf_3g',
      hasFloodlights: true
    },
  };

  it('should apply default arrival rules (45m home, 60m away, 15m training)', () => {
    const homeCountdown = calculateDepartureCountdown(baseEvent, undefined, HOME);
    const homeKickoff = new Date(baseEvent.startTime).getTime();
    const homeDiffMins = (homeKickoff - homeCountdown.leaveHomeDate.getTime()) / 60000;
    // 45m warmup + drive from the saved home + 10m buffer
    const drive = homeCountdown.transitPlan.travelMinutes;
    expect(drive).toBeGreaterThan(0);
    expect(homeDiffMins).toBe(45 + drive + 10);

    const awayEvent: MatchdayEvent = { ...baseEvent, isHomeMatch: false };
    const awayCountdown = calculateDepartureCountdown(awayEvent, undefined, HOME);
    const awayDiffMins = (homeKickoff - awayCountdown.leaveHomeDate.getTime()) / 60000;
    // 60m warmup + drive + 10m buffer
    expect(awayDiffMins).toBe(60 + drive + 10);

    const trainingEvent: MatchdayEvent = { ...baseEvent, isTraining: true, eventType: 'training' };
    const trainingCountdown = calculateDepartureCountdown(trainingEvent, undefined, HOME);
    const trainDiffMins = (homeKickoff - trainingCountdown.leaveHomeDate.getTime()) / 60000;
    // 15m warmup + drive + 10m buffer
    expect(trainDiffMins).toBe(15 + drive + 10);
  });

  it('should apply custom user-configured warmup offsets and departure buffers', () => {
    const customRules: ArrivalRules = {
      profileId: 'prof-1',
      defaultSport: 'football',
      warmupOffsetsMinutes: {
        homeMatch: 30,
        awayMatch: 45,
        training: 10,
        tournament: 60
      },
      departureBufferMinutes: 20,
      defaultDrivingEstimateMinutes: 25
    };

    const countdown = calculateDepartureCountdown(baseEvent, customRules, HOME);
    const kickoff = new Date(baseEvent.startTime).getTime();
    const totalDiffMins = (kickoff - countdown.leaveHomeDate.getTime()) / 60000;
    // 30m warmup + real drive + 20m buffer (defaultDrivingEstimateMinutes is not used)
    expect(totalDiffMins).toBe(30 + countdown.transitPlan.travelMinutes + 20);
  });

  it('should add volunteer duty arrival buffer when volunteer duty is assigned', () => {
    const dutyEvent: MatchdayEvent = {
      ...baseEvent,
      volunteerDuty: '☕ Kahviovuoro (klo 14:30 - 16:00)'
    };

    const withoutDuty = calculateDepartureCountdown(baseEvent, undefined, HOME);
    const withDuty = calculateDepartureCountdown(dutyEvent, undefined, HOME);

    const diff = (withoutDuty.leaveHomeDate.getTime() - withDuty.leaveHomeDate.getTime()) / 60000;
    // Extra 15 min volunteer arrival buffer
    expect(diff).toBe(15);
  });

  it('should calculate tournament warmup offsets correctly', () => {
    const tournamentEvent: MatchdayEvent = {
      ...baseEvent,
      eventType: 'tournament',
      isTraining: false
    };

    const rules: ArrivalRules = {
      profileId: 'prof-1',
      defaultSport: 'football',
      warmupOffsetsMinutes: {
        homeMatch: 45,
        awayMatch: 60,
        training: 15,
        tournament: 40
      },
      departureBufferMinutes: 10,
      defaultDrivingEstimateMinutes: 20
    };

    const countdown = calculateDepartureCountdown(tournamentEvent, rules, HOME);
    const kickoff = new Date(tournamentEvent.startTime).getTime();
    const totalDiffMins = (kickoff - countdown.leaveHomeDate.getTime()) / 60000;
    // 40m tournament warmup + drive + 10m buffer
    expect(totalDiffMins).toBe(40 + countdown.transitPlan.travelMinutes + 10);
  });

  it('shows no leave time without a saved home (no guessed drive)', () => {
    const noHome = calculateDepartureCountdown(baseEvent);
    expect(noHome.hasDepartureTime).toBe(false);
    expect(noHome.departureTime).toBe('');
    expect(noHome.transitPlan.needsHome).toBe(true);
    expect(noHome.transitPlan.transitLabel).not.toMatch(/~20 min/);
  });

  it('should incorporate custom arrival rules into matchday briefing generation', () => {
    const customRules: ArrivalRules = {
      profileId: 'prof-1',
      defaultSport: 'football',
      warmupOffsetsMinutes: {
        homeMatch: 50,
        awayMatch: 70,
        training: 20,
        tournament: 45
      },
      departureBufferMinutes: 15,
      defaultDrivingEstimateMinutes: 30
    };

    const briefing = generateMatchdayBriefing(baseEvent, [], customRules);
    expect(briefing.recommendedDepartureTime).toBeDefined();
    expect(briefing.gearAndPackingAdvice.kitRecommendation).toContain('Kotipeliasu');
  });
});
