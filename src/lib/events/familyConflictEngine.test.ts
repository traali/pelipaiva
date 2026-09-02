import { describe, it, expect } from 'vitest'
import { detectFamilyConflicts } from './familyConflictEngine'
import type { MatchdayEvent, PlayerProfile } from '../../types/matchday'

describe('familyConflictEngine', () => {
  const p1: PlayerProfile = {
    id: 'p1',
    playerName: 'Tuomas',
    teamName: 'Westend Indians Yellow',
    sport: 'floorball',
    primaryColor: 'kelta',
    calendarUrl: 'https://example.com/cal1.ics',
    colorHex: '#F59E0B',
  }

  const p2: PlayerProfile = {
    id: 'p2',
    playerName: 'Aino',
    teamName: 'HJK Sininen',
    sport: 'football',
    primaryColor: 'sini',
    calendarUrl: 'https://example.com/cal2.ics',
    colorHex: '#3B82F6',
  }

  it('detects direct schedule overlap between siblings in different sports', () => {
    const e1: MatchdayEvent = {
      id: 'e1',
      profileId: 'p1',
      sport: 'floorball',
      eventType: 'match',
      isTraining: false,
      title: 'Westend Indians vs SB-Pro',
      homeTeam: 'Westend Indians',
      awayTeam: 'SB-Pro',
      isHomeMatch: true,
      startTime: '2026-09-05T14:00:00Z',
      endTime: '2026-09-05T15:30:00Z',
      warmupTime: '2026-09-05T13:30:00Z',
      venue: {
        name: 'Otahalli Espoo',
        normalizedName: 'otahalli espoo',
        coordinates: { lat: 60.185, lng: 24.832 },
        isIndoor: true,
        surface: 'indoor_synthetic',
        hasFloodlights: true,
      },
    }

    const e2: MatchdayEvent = {
      id: 'e2',
      profileId: 'p2',
      sport: 'football',
      eventType: 'match',
      isTraining: false,
      title: 'HJK vs Honka',
      homeTeam: 'HJK',
      awayTeam: 'Honka',
      isHomeMatch: true,
      startTime: '2026-09-05T14:30:00Z',
      endTime: '2026-09-05T16:00:00Z',
      warmupTime: '2026-09-05T13:45:00Z',
      venue: {
        name: 'Töölön Pallokenttä',
        normalizedName: 'toolon pallokentta',
        coordinates: { lat: 60.188, lng: 24.927 },
        isIndoor: false,
        surface: 'artificial_turf_3g',
        hasFloodlights: true,
      },
    }

    const conflicts = detectFamilyConflicts([e1, e2], [p1, p2])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]!.conflictType).toBe('direct_overlap')
    expect(conflicts[0]!.playerName1).toBe('Tuomas')
    expect(conflicts[0]!.playerName2).toBe('Aino')
    expect(conflicts[0]!.advisoryFinnish).toContain('Päällekkäisyys')
  })

  it('detects tight transit bottleneck when driving time exceeds available gap', () => {
    const e1: MatchdayEvent = {
      id: 'e1',
      profileId: 'p1',
      sport: 'floorball',
      eventType: 'match',
      isTraining: false,
      title: 'Salibandy Match 1',
      homeTeam: 'Indians',
      awayTeam: 'Oilers',
      isHomeMatch: true,
      startTime: '2026-09-05T11:00:00Z',
      endTime: '2026-09-05T12:00:00Z',
      warmupTime: '2026-09-05T10:30:00Z',
      venue: {
        name: 'Arena Center Hakaniemi',
        normalizedName: 'arena center hakaniemi',
        coordinates: { lat: 60.179, lng: 24.952 },
        isIndoor: true,
        surface: 'indoor_synthetic',
        hasFloodlights: true,
      },
    }

    const e2: MatchdayEvent = {
      id: 'e2',
      profileId: 'p2',
      sport: 'football',
      eventType: 'match',
      isTraining: false,
      title: 'Futismatsi 2',
      homeTeam: 'HJK',
      awayTeam: 'KäPa',
      isHomeMatch: true,
      startTime: '2026-09-05T12:15:00Z',
      endTime: '2026-09-05T13:30:00Z',
      warmupTime: '2026-09-05T12:10:00Z', // Only 10 min gap, but Hakaniemi -> Otahalli takes ~20 min
      venue: {
        name: 'Otahalli Espoo',
        normalizedName: 'otahalli espoo',
        coordinates: { lat: 60.185, lng: 24.832 },
        isIndoor: true,
        surface: 'artificial_turf_3g',
        hasFloodlights: true,
      },
    }

    const conflicts = detectFamilyConflicts([e1, e2], [p1, p2])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]!.conflictType).toBe('tight_transit')
    expect(conflicts[0]!.advisoryFinnish).toContain('Tiukka siirtymä')
  })
})
