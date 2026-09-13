import fs from 'node:fs';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { MatchdayEvent } from '../../src/types/matchday';

vi.mock('motion/react', async () => {
  const ReactModule = await import('react');

  const stripMotionProps = (props: Record<string, unknown>) => {
    const next = { ...props };
    delete next.animate;
    delete next.exit;
    delete next.initial;
    delete next.layout;
    delete next.transition;
    delete next.whileHover;
    delete next.whileTap;
    return next;
  };

  const passthrough = (tag: 'div' | 'button') => {
    return ({ children, ...props }: Record<string, unknown>) =>
      ReactModule.createElement(tag, stripMotionProps(props), children);
  };

  return {
    AnimatePresence: ({ children }: { children?: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    motion: {
      button: passthrough('button'),
      div: passthrough('div'),
    },
  };
});

vi.mock('../../src/hooks/useMatchdayLogistics', () => ({
  surfaceLabel: () => 'Tekonurmi 3G',
  useMatchdayLogistics: () => ({
    transitPlan: {
      mode: 'walk',
      distanceKm: 0.8,
      travelMinutes: 12,
      transitLabel: '🚶 Kävely 12 min',
      isSelfTransit: true,
    },
    isPast: false,
    formattedKickoff: '18.00',
    formattedWarmup: '17.15',
    isTournament: false,
    isTraining: false,
    isSchool: false,
    isOther: false,
    isOut: false,
    isOutExpanded: false,
    setIsOutExpanded: () => undefined,
    handleToggleAttendance: async () => undefined,
    dismissedConflicts: [],
    consolidatedConflictGroups: [
      {
        id: 'group-1',
        conflicts: [{ id: 'c1' }],
        severity: 'warn',
        maxOverlap: 20,
        maxTravel: 15,
        childA: 'Arto',
        childB: 'Arto',
        isSameChild: true,
        title: 'Päällekkäisyys (20 min)',
        message: 'Kentät vaihtuvat nopeasti saman illan aikana.',
        suggestedFix: 'Sovi lähtö ajoissa.',
        subItems: [],
      },
    ],
    dismissConflict: () => undefined,
    restoreConflict: () => undefined,
    showDismissedConflicts: false,
    setShowDismissedConflicts: () => undefined,
  }),
}));

vi.mock('../../src/components/NappisvahtiPill', () => ({
  NappisvahtiPill: () => React.createElement('div', null, 'Nappisvahti stub'),
}));

vi.mock('../../src/components/ParkingEaseBadge', () => ({
  ParkingEaseBadge: () => React.createElement('div', null, 'Parking stub'),
}));

vi.mock('../../src/components/MatchdayCardWeatherBadge', () => ({
  MatchdayCardWeatherBadge: ({ weather }: { weather: { temperatureC: number } }) =>
    React.createElement('div', null, `Sää ${weather.temperatureC}°C`),
}));

vi.mock('../../src/components/WeatherSatelliteDrawer', () => ({
  WeatherSatelliteDrawer: () => null,
}));

vi.mock('../../src/components/MatchStatsModal', () => ({
  MatchStatsModal: () => null,
}));

vi.mock('../../src/components/VenueCorrectionModal', () => ({
  VenueCorrectionModal: () => null,
}));

vi.mock('../../src/components/EventChatModal', () => ({
  EventChatModal: () => null,
}));

vi.mock('../../src/components/EventInlineDropIn', () => ({
  EventInlineDropIn: () => React.createElement('div', null, 'EventInlineDropIn stub'),
}));

vi.mock('../../src/components/matchday', () => ({
  TalkooDutyTag: ({ duty }: { duty: string }) => React.createElement('span', null, duty),
}));

vi.mock('../../src/components/MismatchResolveBanner', () => ({
  MismatchResolveBanner: ({ conflictWarning }: { conflictWarning?: string }) =>
    conflictWarning ? React.createElement('div', null, conflictWarning) : null,
}));

vi.mock('../../src/components/EventMergeModal', () => ({
  EventMergeModal: () => null,
}));

import { MatchdayCard } from '../../src/components/MatchdayCard';

const event: MatchdayEvent = {
  id: 'evt-1',
  profileId: 'profile-1',
  sport: 'football',
  eventType: 'match',
  isTraining: false,
  title: 'PPJ/Laru vs HJK',
  homeTeam: 'PPJ/Laru',
  awayTeam: 'HJK',
  isHomeMatch: true,
  startTime: '2026-09-14T15:00:00.000Z',
  endTime: '2026-09-14T16:30:00.000Z',
  warmupTime: '2026-09-14T14:15:00.000Z',
  venue: {
    name: 'Jätkäsaari Arena',
    normalizedName: 'jatkasaari arena',
    coordinates: { lat: 60.15, lng: 24.91 },
    isIndoor: false,
    surface: 'artificial_turf_3g',
    hasFloodlights: true,
  },
  volunteerDuty: 'Kahviovuoro',
  weather: {
    temperatureC: 15,
    feelsLikeC: 13,
    windSpeedMs: 4,
    windGustMs: 6,
    precipitationMmh: 0,
    rainTimeline: [],
    turfCondition: 'dry',
  },
  lightning: {
    status: 'danger',
    nearestStrikeKm: 8,
    strikesWithin30kmCount: 3,
    suspendMatchRecommended: true,
    downpourWarning: false,
    alertMessage: 'Salamavaara lähellä kenttää',
  },
  parking: {
    easeScore: 'moderate',
    easeScoreValue: 50,
    lotName: 'P-Areena',
    coordinates: { lat: 60.15, lng: 24.91 },
    feeZone: 'A',
    parkingDiscRequired: false,
    walkingTimeMinutes: 5,
    walkingDistanceMeters: 300,
    warnings: [],
    mapsNavigationUrl: 'https://example.com/parking',
  },
  briefing: {
    scoutSummary: 'Tiivistelmä',
    gearAndPackingAdvice: {
      clothing: 'Takki mukaan.',
      footwear: 'FG_FIRM_GROUND',
      footwearReason: 'Kuiva kenttä.',
      kitRecommendation: 'Kotipeliasu',
      spectatorGear: 'Huoltajalle sadetakki.',
    },
    recommendedDepartureTime: '2026-09-14T14:20:00.000Z',
    departureCountdownMinutes: 25,
    conflictWarning: 'Aikataulu eroaa kalenterista',
    postMatchWhatsAppTemplate: 'Valmis viesti',
  },
  notes: 'Muista juomapullo ja vaihtosukat.',
};

describe('MatchdayCard mobile default view', () => {
  it('keeps only the primary mobile content visible before extras are opened', () => {
    const markup = renderToStaticMarkup(
      React.createElement(MatchdayCard, {
        event,
        playerName: 'Arto',
        colorHex: '#0f766e',
        showConflictWarnings: true,
        showSmartGearAdvice: true,
      })
    );

    expect(markup).toContain('Arto');
    expect(markup).toContain('⚽ Jalkapallo');
    expect(markup).toContain('🟢 Osallistuu');
    expect(markup).not.toContain('Arto osallistuu');
    expect(markup).toContain('PPJ/Laru');
    expect(markup).toContain('HJK');
    expect(markup).toContain('Ottelu klo 18.00');
    expect(markup).toContain('Jätkäsaari Arena');
    expect(markup).toContain('Sää 15°C');
    expect(markup).toContain('Salamavaara lähellä kenttää');
    expect(markup).toContain('Kentät vaihtuvat nopeasti saman illan aikana.');
    expect(markup).toContain('Lisätiedot');
    expect(markup).toContain('Kävele paikalle (12 min)');

    expect(markup).not.toContain('Kahviovuoro');
    expect(markup).not.toContain('🚶 Kävely 12 min');
    expect(markup).not.toContain('Avaa tilastokeskus');
    expect(markup).not.toContain('Kotipeliasu');
    expect(markup).not.toContain('Muista juomapullo ja vaihtosukat.');
    expect(markup).not.toContain('EventInlineDropIn stub');
  });
});

describe('Requested supporting copy and spacing tweaks', () => {
  it('updates the drop-in placeholder, add button copy, and sticky filter spacing', () => {
    const quickDropInBar = fs.readFileSync('/home/runner/work/pelipaiva/pelipaiva/src/components/QuickDropInBar.tsx', 'utf8');
    const multiProfileHeader = fs.readFileSync('/home/runner/work/pelipaiva/pelipaiva/src/components/MultiProfileHeader.tsx', 'utf8');
    const appSource = fs.readFileSync('/home/runner/work/pelipaiva/pelipaiva/src/App.tsx', 'utf8');

    expect(quickDropInBar).toContain("placeholder=\"Liitä viesti tai .ics-linkki\"");
    expect(multiProfileHeader).toContain('<span>Lisää</span>');
    expect(appSource).toContain('py-1.5');
    expect(appSource).toContain('mb-2');
    expect(appSource).toContain('gap-1.5');
  });
});
