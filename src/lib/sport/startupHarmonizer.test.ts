import { describe, it, expect } from 'vitest';
import { harmonizeStartupSports } from './startupHarmonizer';
import type { MatchdayEvent, PlayerProfile, VenueInfo } from '../../types/matchday';

function makeMockVenue(overrides: Partial<VenueInfo> = {}): VenueInfo {
  return {
    name: 'Töölön Pallokenttä',
    normalizedName: 'toolon pallokentta',
    coordinates: { lat: 60.1872, lng: 24.9248 },
    isIndoor: false,
    surface: 'artificial_turf_3g',
    hasFloodlights: true,
    ...overrides
  };
}

function makeMockProfile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    id: 'p:default',
    playerName: 'Pelaaja',
    teamName: 'Joukkue',
    sport: 'football',
    primaryColor: 'sininen',
    calendarUrl: '',
    colorHex: '#3b82f6',
    ...overrides
  };
}

function makeMockEvent(overrides: Partial<MatchdayEvent> = {}): MatchdayEvent {
  return {
    id: 'ev-default',
    profileId: 'p:default',
    sport: 'football',
    eventType: 'match',
    isTraining: false,
    title: 'Testitapahtuma',
    homeTeam: 'Oma joukkue',
    awayTeam: 'Vastustaja',
    isHomeMatch: true,
    startTime: '2026-08-20T15:00:00Z',
    endTime: '2026-08-20T16:30:00Z',
    warmupTime: '2026-08-20T14:30:00Z',
    venue: makeMockVenue(),
    ...overrides
  };
}

describe('Startup Harmonizer (harmonizeStartupSports)', () => {
  it('preserves all legitimate multi-sport events without overwriting to football', () => {
    const profiles: PlayerProfile[] = [
      makeMockProfile({
        id: 'p:simo-football',
        playerName: 'Simo',
        teamName: 'PPJ Laru',
        sport: 'football',
        primaryColor: 'sininen',
        colorHex: '#3b82f6'
      }),
      makeMockProfile({
        id: 'p:simo-hockey',
        playerName: 'Simo',
        teamName: 'Jokerit',
        sport: 'icehockey',
        primaryColor: 'punainen',
        colorHex: '#ef4444'
      }),
      makeMockProfile({
        id: 'p:simo-school',
        playerName: 'Simo',
        teamName: 'Koulu',
        sport: 'school',
        primaryColor: 'vihreä',
        colorHex: '#22c55e'
      })
    ];

    const events: MatchdayEvent[] = [
      makeMockEvent({
        id: 'ev-football',
        profileId: 'p:simo-football',
        sport: 'football',
        eventType: 'match',
        isTraining: false,
        title: 'PPJ vs HJK',
        homeTeam: 'PPJ Laru',
        awayTeam: 'HJK'
      }),
      makeMockEvent({
        id: 'ev-hockey',
        profileId: 'p:simo-hockey',
        sport: 'icehockey',
        eventType: 'training',
        isTraining: true,
        title: 'Lätkätreenit Pirkkolan jäähallissa',
        homeTeam: 'Jokerit',
        awayTeam: '',
        venue: makeMockVenue({
          name: 'Pirkkolan jäähalli',
          normalizedName: 'pirkkolan jaahalli',
          isIndoor: true,
          surface: 'ice'
        })
      }),
      makeMockEvent({
        id: 'ev-school',
        profileId: 'p:simo-school',
        sport: 'school',
        eventType: 'school',
        isTraining: false,
        title: 'Matematiikan koe',
        homeTeam: 'Koulu',
        awayTeam: '',
        venue: makeMockVenue({
          name: 'Lauttasaaren yhteiskoulu',
          normalizedName: 'lauttasaaren yhteiskoulu',
          isIndoor: true,
          surface: 'indoor_parquet'
        })
      }),
      makeMockEvent({
        id: 'ev-volleyball',
        profileId: 'p:simo-hockey',
        sport: 'volleyball',
        eventType: 'match',
        isTraining: false,
        title: 'PuMa Volley vs LP Viesti',
        homeTeam: 'PuMa Volley',
        awayTeam: 'LP Viesti',
        venue: makeMockVenue({
          name: 'Kisahalli',
          normalizedName: 'kisahalli',
          isIndoor: true,
          surface: 'indoor_parquet'
        })
      }),
      makeMockEvent({
        id: 'ev-futsal',
        profileId: 'p:simo-football',
        sport: 'futsal',
        eventType: 'match',
        isTraining: false,
        title: 'Futsal-Liiga: KaDy vs GFT',
        homeTeam: 'KaDy',
        awayTeam: 'GFT',
        venue: makeMockVenue({
          name: 'Jyväskylän monitoimitalo',
          normalizedName: 'jyvaskylan monitoimitalo',
          isIndoor: true,
          surface: 'indoor_parquet'
        })
      }),
      makeMockEvent({
        id: 'ev-other',
        profileId: 'p:simo-school',
        sport: 'other',
        eventType: 'other',
        isTraining: false,
        title: 'Hammaslääkäri klo 14:00',
        homeTeam: '',
        awayTeam: '',
        venue: makeMockVenue({
          name: 'Terveysasema',
          normalizedName: 'terveysasema',
          isIndoor: true,
          surface: 'indoor_parquet'
        })
      })
    ];

    const result = harmonizeStartupSports(profiles, events);

    // None of the valid events should have their sport altered to football
    const changedSports = result.eventUpdates.filter((u) => u.updates.sport && u.updates.sport === 'football');
    expect(changedSports.length).toBe(0);

    // Events should remain untouched in their sport
    expect(result.eventUpdates.find((u) => u.id === 'ev-hockey')?.updates.sport).toBeUndefined();
    expect(result.eventUpdates.find((u) => u.id === 'ev-school')?.updates.sport).toBeUndefined();
    expect(result.eventUpdates.find((u) => u.id === 'ev-volleyball')?.updates.sport).toBeUndefined();
    expect(result.eventUpdates.find((u) => u.id === 'ev-futsal')?.updates.sport).toBeUndefined();
    expect(result.eventUpdates.find((u) => u.id === 'ev-other')?.updates.sport).toBeUndefined();
  });

  it('heals corrupted events that were mistakenly marked as football back to their true sport', () => {
    const profiles: PlayerProfile[] = [
      makeMockProfile({
        id: 'p:child-1',
        playerName: 'Minea',
        teamName: 'Jääkiekkoilijat',
        sport: 'icehockey',
        colorHex: '#3b82f6'
      })
    ];

    const corruptedEvents: MatchdayEvent[] = [
      makeMockEvent({
        id: 'ev-corrupted-hockey',
        profileId: 'p:child-1',
        sport: 'football', // corrupted!
        eventType: 'training',
        isTraining: true,
        title: 'Lätkätreenit jäähallilla',
        venue: makeMockVenue({
          name: 'Kauniaisten jäähalli',
          normalizedName: 'kauniaisten jaahalli',
          isIndoor: true,
          surface: 'ice'
        })
      }),
      makeMockEvent({
        id: 'ev-corrupted-school',
        profileId: 'p:child-1',
        sport: 'football', // corrupted!
        eventType: 'school',
        isTraining: false,
        title: 'Fysiikan koe',
        venue: makeMockVenue({
          name: 'Koulu',
          normalizedName: 'koulu',
          isIndoor: true,
          surface: 'indoor_parquet'
        })
      }),
      makeMockEvent({
        id: 'ev-corrupted-futsal',
        profileId: 'p:child-1',
        sport: 'football', // corrupted!
        eventType: 'match',
        isTraining: false,
        title: 'Futsal-ottelu',
        venue: makeMockVenue({
          name: 'Palloiluhalli',
          normalizedName: 'palloiluhalli',
          isIndoor: true,
          surface: 'indoor_parquet'
        })
      }),
      makeMockEvent({
        id: 'ev-corrupted-hockey-generic-title',
        profileId: 'p:child-1',
        sport: 'football', // corrupted on an icehockey profile!
        eventType: 'training',
        isTraining: true,
        title: 'Harjoitukset klo 17',
        venue: makeMockVenue({
          name: 'Jäähalli',
          normalizedName: 'jaahalli',
          isIndoor: true,
          surface: 'ice'
        })
      })
    ];

    const result = harmonizeStartupSports(profiles, corruptedEvents);

    expect(result.eventUpdates.find((u) => u.id === 'ev-corrupted-hockey')?.updates.sport).toBe('icehockey');
    expect(result.eventUpdates.find((u) => u.id === 'ev-corrupted-school')?.updates.sport).toBe('school');
    expect(result.eventUpdates.find((u) => u.id === 'ev-corrupted-futsal')?.updates.sport).toBe('futsal');
    expect(result.eventUpdates.find((u) => u.id === 'ev-corrupted-hockey-generic-title')?.updates.sport).toBe('icehockey');
  });

  it('harmonizes venues and surfaces accurately for Pyrkkä, school gyms and ice rinks', () => {
    const profiles: PlayerProfile[] = [
      makeMockProfile({ id: 'p:1', playerName: 'Alex', teamName: 'PPJ', sport: 'football', colorHex: '#10b981' })
    ];

    const events: MatchdayEvent[] = [
      makeMockEvent({
        id: 'ev-pyrkka',
        profileId: 'p:1',
        sport: 'football',
        eventType: 'match',
        title: 'PPJ vs HJK',
        venue: makeMockVenue({
          name: 'Pyrkkä',
          normalizedName: 'pyrkka',
          coordinates: { lat: 0, lng: 0 },
          isIndoor: true, // wrong!
          surface: 'sand' as any
        })
      }),
      makeMockEvent({
        id: 'ev-school-gym',
        profileId: 'p:1',
        sport: 'basketball',
        eventType: 'match',
        title: 'ToPo vs Honka',
        venue: makeMockVenue({
          name: 'Lauttasaaren yhteiskoulu',
          normalizedName: 'lauttasaaren yhteiskoulu',
          isIndoor: false, // wrong!
          surface: 'artificial_turf_3g'
        })
      }),
      makeMockEvent({
        id: 'ev-ice-rink',
        profileId: 'p:1',
        sport: 'icehockey',
        eventType: 'match',
        title: 'HIFK vs Kiekko-Espoo',
        venue: makeMockVenue({
          name: 'Matinkylän jäähalli',
          normalizedName: 'matinkylan jaahalli',
          isIndoor: false, // wrong!
          surface: 'artificial_turf_3g' // wrong!
        })
      })
    ];

    const result = harmonizeStartupSports(profiles, events);

    const pyrkkaUpdate = result.eventUpdates.find((u) => u.id === 'ev-pyrkka')?.updates.venue;
    expect(pyrkkaUpdate?.isIndoor).toBe(false);
    expect(pyrkkaUpdate?.surface).toBe('artificial_turf_3g');
    expect(pyrkkaUpdate?.coordinates?.lat).toBeCloseTo(60.16357, 4);

    const gymUpdate = result.eventUpdates.find((u) => u.id === 'ev-school-gym')?.updates.venue;
    expect(gymUpdate?.isIndoor).toBe(true);
    expect(gymUpdate?.surface).toBe('indoor_parquet');

    const iceUpdate = result.eventUpdates.find((u) => u.id === 'ev-ice-rink')?.updates.venue;
    expect(iceUpdate?.isIndoor).toBe(true);
    expect(iceUpdate?.surface).toBe('ice');
  });

  it('heals profile sport when teamName indicates floorball, basketball, volleyball, etc.', () => {
    const profiles: PlayerProfile[] = [
      makeMockProfile({
        id: 'p:indians',
        playerName: 'Leo',
        teamName: 'Westend Indians P12',
        sport: 'football', // accidentally defaulted to football
        colorHex: '#3b82f6'
      }),
      makeMockProfile({
        id: 'p:bad-cal',
        playerName: 'Simo',
        teamName: 'PPJ Laru',
        sport: 'football',
        calendarUrl: 'https://tulospalvelu.palloliitto.fi/team/185085', // association URL in calendar field!
        colorHex: '#3b82f6'
      })
    ];

    const result = harmonizeStartupSports(profiles, []);

    expect(result.profileUpdates.find((u) => u.id === 'p:indians')?.updates.sport).toBe('floorball');

    const calUpdate = result.profileUpdates.find((u) => u.id === 'p:bad-cal')?.updates;
    expect(calUpdate?.associationUrl).toBe('https://tulospalvelu.palloliitto.fi/team/185085');
    expect(calUpdate?.calendarUrl).toBeUndefined();
  });

  it('does not strip a football event of its sport because of generic conditioning words', () => {
    const profile = makeMockProfile({ id: 'p:ppj', teamName: 'PPJ P12', sport: 'football' });
    const ev = makeMockEvent({ id: 'ev-fys', profileId: 'p:ppj', sport: 'football', title: 'Fysiikkatreenit' });
    const { eventUpdates } = harmonizeStartupSports([profile], [ev]);
    expect(eventUpdates.find((u) => u.id === 'ev-fys')?.updates.sport).toBeUndefined();
  });

  it('fills a missing event sport with training from conditioning keywords', () => {
    const profile = makeMockProfile({ id: 'p:x', teamName: 'Joukkue', sport: 'football' });
    const ev = makeMockEvent({ id: 'ev-gym', profileId: 'p:x', title: 'Kuntosali', sport: undefined as unknown as MatchdayEvent['sport'] });
    const { eventUpdates } = harmonizeStartupSports([profile], [ev]);
    expect(eventUpdates.find((u) => u.id === 'ev-gym')?.updates.sport).toBe('training');
  });
});
