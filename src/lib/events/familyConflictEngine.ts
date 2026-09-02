/**
 * Multi-Sport Family Conflict & Logistics Engine
 * Detects schedule overlaps and tight transit bottlenecks across multiple children and sports.
 */

import type { MatchdayEvent, PlayerProfile } from '../../types/matchday'

export interface FamilyConflictClash {
  id: string
  event1: MatchdayEvent
  event2: MatchdayEvent
  playerName1: string
  playerName2: string
  sport1: string
  sport2: string
  venue1: string
  venue2: string
  conflictType: 'direct_overlap' | 'tight_transit'
  drivingMinutesNeeded: number
  availableBufferMinutes: number
  advisoryFinnish: string
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function estimateDrivingMinutes(
  coords1?: { latitude?: number; longitude?: number; lat?: number; lng?: number },
  coords2?: { latitude?: number; longitude?: number; lat?: number; lng?: number }
): number {
  const lat1 = coords1?.latitude ?? coords1?.lat
  const lon1 = coords1?.longitude ?? coords1?.lng
  const lat2 = coords2?.latitude ?? coords2?.lat
  const lon2 = coords2?.longitude ?? coords2?.lng

  if (lat1 != null && lon1 != null && lat2 != null && lon2 != null) {
    const distKm = haversineDistanceKm(lat1, lon1, lat2, lon2)
    // Urban transit: ~25 km/h avg speed in Helsinki/Espoo + 7 min parking/walking buffer
    return Math.ceil((distKm / 25) * 60 + 7)
  }
  // Default regional transit estimate if coordinates missing
  return 20
}

/**
 * Evaluates all family events across players and identifies schedule clashes.
 */
export function detectFamilyConflicts(
  events: MatchdayEvent[],
  profiles: PlayerProfile[]
): FamilyConflictClash[] {
  const profileMap = new Map<string, PlayerProfile>(profiles.map((p) => [p.id, p]))
  const clashes: FamilyConflictClash[] = []

  // Filter valid upcoming or today's events
  const validEvents = events.filter((e) => e.startTime && !e.isHidden)

  for (let i = 0; i < validEvents.length; i++) {
    for (let j = i + 1; j < validEvents.length; j++) {
      const e1 = validEvents[i]
      const e2 = validEvents[j]

      // Only check events belonging to different players or different events
      if (e1.id === e2.id) continue

      const p1 = profileMap.get(e1.profileId)
      const p2 = profileMap.get(e2.profileId)
      const name1 = p1?.playerName || 'Pelaaja 1'
      const name2 = p2?.playerName || 'Pelaaja 2'

      const e1Start = new Date(e1.warmupTime || e1.startTime).getTime()
      const e1End = new Date(e1.endTime || new Date(e1Start + 90 * 60 * 1000)).getTime()
      const e2Start = new Date(e2.warmupTime || e2.startTime).getTime()
      const e2End = new Date(e2.endTime || new Date(e2Start + 90 * 60 * 1000)).getTime()

      // 1. Direct Time Overlap Check
      const hasDirectOverlap = e1Start < e2End && e2Start < e1End

      if (hasDirectOverlap) {
        clashes.push({
          id: `clash_${e1.id}_${e2.id}`,
          event1: e1,
          event2: e2,
          playerName1: name1,
          playerName2: name2,
          sport1: e1.sport,
          sport2: e2.sport,
          venue1: e1.venue?.name || 'Kenttä 1',
          venue2: e2.venue?.name || 'Kenttä 2',
          conflictType: 'direct_overlap',
          drivingMinutesNeeded: estimateDrivingMinutes(e1.venue?.coordinates, e2.venue?.coordinates),
          availableBufferMinutes: 0,
          advisoryFinnish: `⚠️ Päällekkäisyys: ${name1} (${e1.sport}) ja ${name2} (${e2.sport}) pelaavat samanaikaisesti eri paikoissa (${e1.venue?.name || 'Kenttä'} vs ${e2.venue?.name || 'Kenttä'}). Tarvitaan kaksi kuskia tai kimppakyyti!`,
        })
        continue
      }

      // 2. Tight Transit Gap Check (Consecutive matches with insufficient travel time)
      const [first, second] = e1End <= e2Start ? [e1, e2] : [e2, e1]
      const firstEnd = Math.min(e1End, e2End)
      const secondStart = Math.max(e1Start, e2Start)
      const gapMinutes = Math.floor((secondStart - firstEnd) / (60 * 1000))

      // If venues are different and gap is under 45 minutes
      const sameVenue = first.venue?.name && second.venue?.name && first.venue.name.toLowerCase() === second.venue.name.toLowerCase()

      if (!sameVenue && gapMinutes >= 0 && gapMinutes < 40) {
        const neededTransit = estimateDrivingMinutes(first.venue?.coordinates, second.venue?.coordinates)
        if (gapMinutes < neededTransit) {
          const fName = profileMap.get(first.profileId)?.playerName || 'Pelaaja 1'
          const sName = profileMap.get(second.profileId)?.playerName || 'Pelaaja 2'

          clashes.push({
            id: `tight_${first.id}_${second.id}`,
            event1: first,
            event2: second,
            playerName1: fName,
            playerName2: sName,
            sport1: first.sport,
            sport2: second.sport,
            venue1: first.venue?.name || 'Kenttä 1',
            venue2: second.venue?.name || 'Kenttä 2',
            conflictType: 'tight_transit',
            drivingMinutesNeeded: neededTransit,
            availableBufferMinutes: gapMinutes,
            advisoryFinnish: `⏱️ Tiukka siirtymä: Pelien välillä on vain ${gapMinutes} min, mutta siirtymä kohteesta ${first.venue?.name || 'Kenttä'} kohteeseen ${second.venue?.name || 'Kenttä'} kestää n. ${neededTransit} min. Lähde heti päätösvihellyksestä!`,
          })
        }
      }
    }
  }

  return clashes
}
