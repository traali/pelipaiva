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
  useMatchdayLogistics: ({ event }: { event: MatchdayEvent }) => ({
    transitPlan: {
      mode: 'walk',
      distanceKm: 0.8,
      travelMinutes: 12,
      transitLabel: '🚶 Kävely 12 min',
      isSelfTransit: true,
    },
    isPast: false,
    formattedKickoff: event.eventType === 'tournament' ? '10.00' : event.eventType === 'training' ? '18.30' : '18.00',
    formattedWarmup: event.eventType === 'tournament' ? '09.15' : event.eventType === 'training' ? '18.15' : '17.15',
    isTournament: event.eventType === 'tournament',
    isTraining: Boolean(event.isTraining || event.eventType === 'training'),
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
import { MultiProfileHeader } from '../../src/components/MultiProfileHeader';
import { QuickDropInBar } from '../../src/components/QuickDropInBar';

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
    expect(markup).toContain('🟢 Osallistuu · Arto');
    expect(markup).not.toContain('Arto osallistuu');
    expect(markup).toContain('PPJ/Laru');
    expect(markup).toContain('HJK');
    expect(markup).toContain('Ottelu klo 18.00');
    expect(markup).toContain('Jätkäsaari Arena');
    expect(markup).toContain('Sää 15°C');
    expect(markup).toContain('Salamavaara lähellä kenttää');
    expect(markup).toContain('Kentät vaihtuvat nopeasti saman illan aikana.');
    expect(markup).toContain('Lisätiedot');
    expect(markup).toMatch(/aria-controls="[^"]+"/);
    expect(markup).toContain('Kävele paikalle (12 min)');

    expect(markup).not.toContain('Kahviovuoro');
    expect(markup).not.toContain('🚶 Kävely 12 min');
    expect(markup).not.toContain('Avaa tilastokeskus');
    expect(markup).not.toContain('Kotipeliasu');
    expect(markup).not.toContain('Muista juomapullo ja vaihtosukat.');
    expect(markup).not.toContain('EventInlineDropIn stub');
  });

  it('reveals the moved secondary sections when extras are opened', () => {
    const markup = renderToStaticMarkup(
      React.createElement(MatchdayCard, {
        event,
        playerName: 'Arto',
        colorHex: '#0f766e',
        initialShowExtras: true,
        showConflictWarnings: true,
        showSmartGearAdvice: true,
      })
    );

    expect(markup).toContain('Vähemmän');
    expect(markup).toContain('Kahviovuoro');
    expect(markup).toContain('🚶 Kävely 12 min');
    expect(markup).toContain('Avaa tilastokeskus');
    expect(markup).toContain('Takki mukaan. Huoltajalle sadetakki.');
    expect(markup).toContain('Muista juomapullo ja vaihtosukat.');
    expect(markup).toContain('EventInlineDropIn stub');
  });
});

describe('Requested supporting copy and spacing tweaks', () => {
  it('includes the sport badge in training and tournament labels', () => {
    const trainingMarkup = renderToStaticMarkup(
      React.createElement(MatchdayCard, {
        event: {
          ...event,
          id: 'evt-training',
          eventType: 'training',
          isTraining: true,
          title: 'PPJ harjoitus',
        },
        playerName: 'Arto',
        colorHex: '#0f766e',
      })
    );

    const tournamentMarkup = renderToStaticMarkup(
      React.createElement(MatchdayCard, {
        event: {
          ...event,
          id: 'evt-tournament',
          eventType: 'tournament',
          title: 'Mini Cup',
          officialGameTimes: [
            { startTime: '2026-09-14T10:00:00.000Z', title: 'PPJ vs HJK' },
            { startTime: '2026-09-14T12:00:00.000Z', title: 'PPJ vs Honka', score: '2-1' },
          ],
        },
        playerName: 'Arto',
        colorHex: '#0f766e',
      })
    );

    expect(trainingMarkup).toContain('Harjoitus · ⚽ Jalkapallo');
    expect(tournamentMarkup).toContain('Turnaus · ⚽ Jalkapallo');
  });

  it('shows official game times even before extras are opened', () => {
    const markup = renderToStaticMarkup(
      React.createElement(MatchdayCard, {
        event: {
          ...event,
          id: 'evt-tournament-list',
          eventType: 'tournament',
          title: 'Mini Cup',
          officialGameTimes: [
            { startTime: '2026-09-14T10:00:00.000Z', title: 'PPJ vs HJK' },
            { startTime: '2026-09-14T12:00:00.000Z', title: 'PPJ vs Honka', score: '2-1' },
          ],
        },
        playerName: 'Arto',
        colorHex: '#0f766e',
      })
    );

    expect(markup).toContain('PPJ vs HJK');
    expect(markup).toContain('PPJ vs Honka');
    expect(markup).toContain('2-1');
  });

  it('renders the shorter quick drop-in placeholder', () => {
    const markup = renderToStaticMarkup(
      React.createElement(QuickDropInBar, {
        existingPlayers: ['Arto'],
        activeProfilePlayerName: 'Arto',
      })
    );

    expect(markup).toContain('Liitä viesti tai .ics-linkki');
  });

  it('renders the add-profile button as “Lisää” while keeping the add aria-label', () => {
    const markup = renderToStaticMarkup(
      React.createElement(MultiProfileHeader, {
        profiles: [],
        activeProfileId: 'all',
        onSelectProfile: () => undefined,
        onAddProfile: () => undefined,
      })
    );

    expect(markup).toContain('>Lisää<');
    expect(markup).toContain('aria-label="Lisää joukkue tai turnaus"');
  });
});
