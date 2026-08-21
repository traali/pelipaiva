import { describe, it, expect } from 'vitest';
import {
  calculateDepartureCountdown,
  generateMatchdayBriefing
} from '../../../src/lib/ai/deterministicReasoner';
import { MatchdayEvent, ArrivalRules } from '../../../src/types/matchday';

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
    parking: {
      easeScore: 'easy',
      easeScoreValue: 85,
      lotName: 'Puotilan P-alue',
      coordinates: { lat: 60.2135, lng: 25.1095 },
      feeZone: 'Maksuton',
      parkingDiscRequired: false,
      walkingTimeMinutes: 3,
      walkingDistanceMeters: 200,
      warnings: [],
      mapsNavigationUrl: 'https://maps.google.com'
    }
  };

  it('should apply default arrival rules (45m home, 60m away, 15m training)', () => {
    const homeCountdown = calculateDepartureCountdown(baseEvent);
    const homeKickoff = new Date(baseEvent.startTime).getTime();
    const homeDiffMins = (homeKickoff - homeCountdown.leaveHomeDate.getTime()) / 60000;
    // 45m warmup + 20m drive + 10m buffer + 3m walk = 78m
    expect(homeDiffMins).toBe(78);

    const awayEvent: MatchdayEvent = { ...baseEvent, isHomeMatch: false };
    const awayCountdown = calculateDepartureCountdown(awayEvent);
    const awayDiffMins = (homeKickoff - awayCountdown.leaveHomeDate.getTime()) / 60000;
    // 60m warmup + 20m drive + 10m buffer + 3m walk = 93m
    expect(awayDiffMins).toBe(93);

    const trainingEvent: MatchdayEvent = { ...baseEvent, isTraining: true, eventType: 'training' };
    const trainingCountdown = calculateDepartureCountdown(trainingEvent);
    const trainDiffMins = (homeKickoff - trainingCountdown.leaveHomeDate.getTime()) / 60000;
    // 15m warmup + 20m drive + 10m buffer + 3m walk = 48m
    expect(trainDiffMins).toBe(48);
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

    const countdown = calculateDepartureCountdown(baseEvent, customRules);
    const kickoff = new Date(baseEvent.startTime).getTime();
    const totalDiffMins = (kickoff - countdown.leaveHomeDate.getTime()) / 60000;
    // 30m warmup + 25m drive + 20m buffer + 3m walk = 78m
    expect(totalDiffMins).toBe(78);
  });

  it('should add volunteer duty arrival buffer when volunteer duty is assigned', () => {
    const dutyEvent: MatchdayEvent = {
      ...baseEvent,
      volunteerDuty: '☕ Kahviovuoro (klo 14:30 - 16:00)'
    };

    const withoutDuty = calculateDepartureCountdown(baseEvent);
    const withDuty = calculateDepartureCountdown(dutyEvent);

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

    const countdown = calculateDepartureCountdown(tournamentEvent, rules);
    const kickoff = new Date(tournamentEvent.startTime).getTime();
    const totalDiffMins = (kickoff - countdown.leaveHomeDate.getTime()) / 60000;
    // 40m tournament warmup + 20m drive + 10m buffer + 3m walk = 73m
    expect(totalDiffMins).toBe(73);
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
