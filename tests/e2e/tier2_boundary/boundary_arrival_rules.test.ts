import { describe, it, expect } from 'vitest';
import {
  determineFootwear,
  calculateDepartureCountdown,
  generateMatchdayBriefing
} from '../../../src/lib/ai/deterministicReasoner';
import { ArrivalRules, MatchdayEvent } from '../../../src/types/matchday';

describe('Tier 2 Boundary: Arrival Rules, Countdown Reasoning & Weather Edge Cases', () => {
  const createMockEvent = (overrides: Partial<MatchdayEvent> = {}): MatchdayEvent => ({
    id: 'arr-event-1',
    profileId: 'prof-1',
    sport: 'football',
    eventType: 'match',
    isTraining: false,
    title: 'HJK T13 Sininen vs EPS',
    homeTeam: 'HJK T13 Sininen',
    awayTeam: 'EPS',
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
    parking: {
      name: 'Töölön parkki',
      walkingTimeMinutes: 3,
      costType: 'paid',
      spacesEstimate: 50
    },
    ...overrides
  });

  // 1. Zero and extreme arrival offsets
  it('should calculate departure correctly when warmup and departure buffer offsets are 0 minutes', () => {
    const event = createMockEvent();
    const rules: ArrivalRules = {
      profileId: 'prof-1',
      defaultSport: 'football',
      warmupOffsetsMinutes: {
        homeMatch: 0,
        awayMatch: 0,
        training: 0,
        tournament: 0
      },
      departureBufferMinutes: 0,
      defaultDrivingEstimateMinutes: 0
    };

    const result = calculateDepartureCountdown(event, rules);
    const kickoffTime = new Date(event.startTime).getTime();
    // walkingTime = 3 min, duty = 0
    expect(result.leaveHomeDate.getTime()).toBe(kickoffTime - 3 * 60 * 1000);
  });

  it('should handle large offsets (e.g. 180 min warmup, 60 min driving, 30 min buffer) safely', () => {
    const event = createMockEvent();
    const rules: ArrivalRules = {
      profileId: 'prof-1',
      defaultSport: 'football',
      warmupOffsetsMinutes: {
        homeMatch: 180,
        awayMatch: 180,
        training: 60,
        tournament: 90
      },
      departureBufferMinutes: 30,
      defaultDrivingEstimateMinutes: 60
    };

    const result = calculateDepartureCountdown(event, rules);
    const kickoffTime = new Date(event.startTime).getTime();
    // Total offset = 180 + 60 + 30 + 3 = 273 minutes
    expect(result.leaveHomeDate.getTime()).toBe(kickoffTime - 273 * 60 * 1000);
  });

  // 2. Missing or undefined arrival rules fallback
  it('should fallback to default values (home 45m, driving 20m, buffer 10m, walk 3m = 78m total) when rules are undefined', () => {
    const event = createMockEvent({ isHomeMatch: true });
    const result = calculateDepartureCountdown(event, undefined);
    const kickoffTime = new Date(event.startTime).getTime();

    // Default: 45 + 20 + 10 + 3 = 78 min
    expect(result.leaveHomeDate.getTime()).toBe(kickoffTime - 78 * 60 * 1000);
  });

  it('should use 60 min warmup default for away matches when rules are undefined', () => {
    const event = createMockEvent({ isHomeMatch: false });
    const result = calculateDepartureCountdown(event, undefined);
    const kickoffTime = new Date(event.startTime).getTime();

    // Default away: 60 + 20 + 10 + 3 = 93 min
    expect(result.leaveHomeDate.getTime()).toBe(kickoffTime - 93 * 60 * 1000);
  });

  it('should use 15 min warmup default for training sessions when rules are undefined', () => {
    const event = createMockEvent({ isTraining: true, eventType: 'training' });
    const result = calculateDepartureCountdown(event, undefined);
    const kickoffTime = new Date(event.startTime).getTime();

    // Default training: 15 + 20 + 10 + 3 = 48 min
    expect(result.leaveHomeDate.getTime()).toBe(kickoffTime - 48 * 60 * 1000);
  });

  // 3. Volunteer duty buffer addition
  it('should add volunteer duty arrival buffer (default 15m) when volunteerDuty is present', () => {
    const eventWithoutDuty = createMockEvent({ volunteerDuty: undefined });
    const eventWithDuty = createMockEvent({ volunteerDuty: '☕ Kahviovuoro (klo 14:30 - 16:00)' });

    const rules: ArrivalRules = {
      profileId: 'prof-1',
      defaultSport: 'football',
      volunteerDutyArrivalBufferMinutes: 20
    };

    const res1 = calculateDepartureCountdown(eventWithoutDuty, rules);
    const res2 = calculateDepartureCountdown(eventWithDuty, rules);

    // Difference between leaving home with duty vs without duty should be exactly 20 mins
    expect(res1.leaveHomeDate.getTime() - res2.leaveHomeDate.getTime()).toBe(20 * 60 * 1000);
  });

  // 4. Footwear reasoning under extreme weather conditions
  it('should recommend TF_TURF_SHOES for extreme arctic freezing weather (-30°C) on artificial turf', () => {
    const { footwear, reason } = determineFootwear('artificial_turf_3g', -30, 0, false);
    expect(footwear).toBe('TF_TURF_SHOES');
    expect(reason).toContain('Jäätynyt tekonurmi');
  });

  it('should recommend AG_ARTIFICIAL_GRASS for extreme heatwave (+40°C) on artificial turf', () => {
    const { footwear } = determineFootwear('artificial_turf_3g', 40, 0, false);
    expect(footwear).toBe('AG_ARTIFICIAL_GRASS');
  });

  it('should recommend SG_SOFT_GROUND for torrential downpour (50 mm/h) on natural grass', () => {
    const { footwear, reason } = determineFootwear('natural_grass', 15, 50, false);
    expect(footwear).toBe('SG_SOFT_GROUND');
    expect(reason).toContain('Märkä luonnonnurmi');
  });

  it('should recommend FG_FIRM_GROUND for dry sunny day on natural grass', () => {
    const { footwear, reason } = determineFootwear('natural_grass', 20, 0, false);
    expect(footwear).toBe('FG_FIRM_GROUND');
    expect(reason).toContain('Normaali nurmikenkä');
  });

  it('should recommend TF_TURF_SHOES for sand artificial turf across freezing and warm temperatures', () => {
    const resCold = determineFootwear('sand_artificial_turf', -5, 0, false);
    const resWarm = determineFootwear('sand_artificial_turf', 22, 0, false);
    expect(resCold.footwear).toBe('TF_TURF_SHOES');
    expect(resWarm.footwear).toBe('TF_TURF_SHOES');
  });

  it('should recommend INDOOR_NON_MARKING for any indoor facility regardless of outdoor temperature or surface', () => {
    const res1 = determineFootwear('wooden_parquet', -25, 10, true);
    const res2 = determineFootwear('pulastic_synthetic', 35, 0, true);
    const res3 = determineFootwear('artificial_turf_3g', 0, 0, true);

    expect(res1.footwear).toBe('INDOOR_NON_MARKING');
    expect(res2.footwear).toBe('INDOOR_NON_MARKING');
    expect(res3.footwear).toBe('INDOOR_NON_MARKING');
  });

  // 5. Concurrent sibling and multi-event conflict detection
  it('should detect exact same time concurrent event conflict and generate AI warning', () => {
    const event1 = createMockEvent({
      id: 'event-sibling-1',
      title: 'Maija: HJK T13 vs EPS',
      startTime: '2026-05-16T15:00:00.000Z',
      endTime: '2026-05-16T16:30:00.000Z'
    });
    const event2 = createMockEvent({
      id: 'event-sibling-2',
      title: 'Matti: Honka P12 vs TiPS',
      startTime: '2026-05-16T15:00:00.000Z',
      endTime: '2026-05-16T16:30:00.000Z'
    });

    const briefing = generateMatchdayBriefing(event1, [event1, event2]);
    expect(briefing.conflictWarning).toBeDefined();
    expect(briefing.conflictWarning).toContain('AIKATAULURUUHKI');
    expect(briefing.conflictWarning).toContain('Matti: Honka P12 vs TiPS');
  });

  it('should detect partial overlapping event conflict', () => {
    const event1 = createMockEvent({
      id: 'event-overlap-1',
      title: 'Peli 1',
      startTime: '2026-05-16T15:00:00.000Z',
      endTime: '2026-05-16T16:30:00.000Z'
    });
    const event2 = createMockEvent({
      id: 'event-overlap-2',
      title: 'Peli 2',
      startTime: '2026-05-16T16:00:00.000Z', // overlaps last 30 mins of Peli 1
      endTime: '2026-05-16T17:30:00.000Z'
    });

    const briefing = generateMatchdayBriefing(event1, [event1, event2]);
    expect(briefing.conflictWarning).toBeDefined();
    expect(briefing.conflictWarning).toContain('Peli 2');
  });

  it('should NOT generate conflict warning for back-to-back non-overlapping events', () => {
    const event1 = createMockEvent({
      id: 'event-b2b-1',
      startTime: '2026-05-16T12:00:00.000Z',
      endTime: '2026-05-16T13:30:00.000Z'
    });
    const event2 = createMockEvent({
      id: 'event-b2b-2',
      startTime: '2026-05-16T14:00:00.000Z',
      endTime: '2026-05-16T15:30:00.000Z'
    });

    const briefing = generateMatchdayBriefing(event1, [event1, event2]);
    expect(briefing.conflictWarning).toBeUndefined();
  });

  // 6. Clothing & gear advice across temperature bands
  it('should recommend arctic layers (pipo, hanskat, toppatakki) when temperature is below 6°C', () => {
    const event = createMockEvent({
      weather: { temperatureC: 2, precipitationMmh: 0, windSpeedMs: 4, symbolCode: 'clear' }
    });

    const briefing = generateMatchdayBriefing(event);
    expect(briefing.gearAndPackingAdvice.clothing).toContain('pipo');
    expect(briefing.gearAndPackingAdvice.spectatorGear).toContain('Toppatakki');
  });

  it('should recommend rain gear (sateenvarjo) when outdoor precipitation > 0.5 mm/h', () => {
    const event = createMockEvent({
      weather: { temperatureC: 14, precipitationMmh: 3.5, windSpeedMs: 2, symbolCode: 'rain' }
    });

    const briefing = generateMatchdayBriefing(event);
    expect(briefing.gearAndPackingAdvice.spectatorGear).toContain('sateenvarjo');
  });

  // 7. WhatsApp template generation
  it('should generate Finnish WhatsApp post-match announcement template', () => {
    const event = createMockEvent({ homeTeam: 'HJK T13', awayTeam: 'EPS Valkoinen' });
    const briefing = generateMatchdayBriefing(event);

    expect(briefing.postMatchWhatsAppTemplate).toContain('HJK T13');
    expect(briefing.postMatchWhatsAppTemplate).toContain('EPS Valkoinen');
    expect(briefing.postMatchWhatsAppTemplate).toContain('[SYÖTÄ TULOS]');
  });
});
