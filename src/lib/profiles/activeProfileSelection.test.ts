import { describe, expect, it } from 'vitest';
import type { MatchdayEvent, PlayerProfile } from '../../types/matchday';
import {
  activePlayerNameForSelection,
  filterEventsByActiveProfileId,
  groupedPlayerNameFromActiveProfileId
} from './activeProfileSelection';

describe('activeProfileSelection', () => {
  const profiles: PlayerProfile[] = [
    {
      id: 'p1',
      playerName: 'Simo',
      teamName: 'Red',
      sport: 'football',
      primaryColor: 'red',
      calendarUrl: 'https://example.com/red.ics',
      colorHex: '#ff0000'
    },
    {
      id: 'p2',
      playerName: ' simo ',
      teamName: 'Blue',
      sport: 'football',
      primaryColor: 'blue',
      calendarUrl: 'https://example.com/blue.ics',
      colorHex: '#0000ff'
    },
    {
      id: 'p3',
      playerName: 'Aada',
      teamName: 'Green',
      sport: 'football',
      primaryColor: 'green',
      calendarUrl: 'https://example.com/green.ics',
      colorHex: '#00ff00'
    },
    {
      id: 'player:custom-id',
      playerName: 'Iiro',
      teamName: 'Black',
      sport: 'football',
      primaryColor: 'black',
      calendarUrl: 'https://example.com/black.ics',
      colorHex: '#111111'
    }
  ];

  const events: MatchdayEvent[] = [
    {
      id: 'e1',
      profileId: 'p1',
      sport: 'football',
      eventType: 'match',
      isTraining: false,
      title: 'Red match',
      homeTeam: 'Red',
      awayTeam: 'Opposition',
      isHomeMatch: true,
      startTime: '2026-09-14T10:00:00.000Z',
      endTime: '2026-09-14T11:00:00.000Z',
      warmupTime: '2026-09-14T09:15:00.000Z',
      venue: {
        name: 'Arena',
        normalizedName: 'arena',
        coordinates: { lat: 60.1, lng: 24.9 },
        isIndoor: false,
        surface: 'artificial_turf_3g',
        hasFloodlights: true
      },
      attendanceStatus: 'in'
    },
    {
      id: 'e2',
      profileId: 'p2',
      sport: 'football',
      eventType: 'match',
      isTraining: false,
      title: 'Blue match',
      homeTeam: 'Blue',
      awayTeam: 'Opposition',
      isHomeMatch: false,
      startTime: '2026-09-14T12:00:00.000Z',
      endTime: '2026-09-14T13:00:00.000Z',
      warmupTime: '2026-09-14T11:15:00.000Z',
      venue: {
        name: 'Arena',
        normalizedName: 'arena',
        coordinates: { lat: 60.1, lng: 24.9 },
        isIndoor: false,
        surface: 'artificial_turf_3g',
        hasFloodlights: true
      },
      attendanceStatus: 'in'
    },
    {
      id: 'e3',
      profileId: 'p3',
      sport: 'football',
      eventType: 'match',
      isTraining: false,
      title: 'Green match',
      homeTeam: 'Green',
      awayTeam: 'Opposition',
      isHomeMatch: true,
      startTime: '2026-09-14T14:00:00.000Z',
      endTime: '2026-09-14T15:00:00.000Z',
      warmupTime: '2026-09-14T13:15:00.000Z',
      venue: {
        name: 'Arena',
        normalizedName: 'arena',
        coordinates: { lat: 60.1, lng: 24.9 },
        isIndoor: false,
        surface: 'artificial_turf_3g',
        hasFloodlights: true
      },
      attendanceStatus: 'in'
    },
    {
      id: 'e4',
      profileId: 'player:custom-id',
      sport: 'football',
      eventType: 'match',
      isTraining: false,
      title: 'Black match',
      homeTeam: 'Black',
      awayTeam: 'Opposition',
      isHomeMatch: false,
      startTime: '2026-09-14T16:00:00.000Z',
      endTime: '2026-09-14T17:00:00.000Z',
      warmupTime: '2026-09-14T15:15:00.000Z',
      venue: {
        name: 'Arena',
        normalizedName: 'arena',
        coordinates: { lat: 60.1, lng: 24.9 },
        isIndoor: false,
        surface: 'artificial_turf_3g',
        hasFloodlights: true
      },
      attendanceStatus: 'in'
    }
  ];

  it('decodes grouped player selections for display', () => {
    expect(groupedPlayerNameFromActiveProfileId('player:%20Simo%20')).toBe('Simo');
    expect(activePlayerNameForSelection('player:Simo%20Jr', profiles)).toBe('Simo Jr');
  });

  it('includes every matching profile for grouped player selections', () => {
    const filtered = filterEventsByActiveProfileId(events, profiles, 'player:%20SIMO%20');
    expect(filtered.map((event) => event.id)).toEqual(['e1', 'e2']);
  });

  it('keeps exact profile id selection behavior unchanged', () => {
    const filtered = filterEventsByActiveProfileId(events, profiles, 'p1');
    expect(filtered.map((event) => event.id)).toEqual(['e1']);
    expect(activePlayerNameForSelection('p2', profiles)).toBe(' simo ');
  });

  it('prefers exact profile ids even when they start with player:', () => {
    const filtered = filterEventsByActiveProfileId(events, profiles, 'player:custom-id');
    expect(filtered.map((event) => event.id)).toEqual(['e4']);
    expect(activePlayerNameForSelection('player:custom-id', profiles)).toBe('Iiro');
  });
});
