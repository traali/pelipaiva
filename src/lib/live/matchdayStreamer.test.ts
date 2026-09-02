import { describe, it, expect, vi } from 'vitest'
import { matchdayStreamer, type LiveMatchEvent } from './matchdayStreamer'

describe('matchdayStreamer', () => {
  it('subscribes and receives emitted live goal events', () => {
    const callback = vi.fn()
    const unsubscribe = matchdayStreamer.subscribe(callback)

    const sampleGoal: LiveMatchEvent = {
      id: 'evt-1',
      matchId: '913481',
      sport: 'floorball',
      eventType: 'goal',
      homeTeam: 'SB-Pro Valkoinen',
      awayTeam: 'Westend Indians Yellow',
      newScore: { home: 3, away: 15 },
      scorerName: 'Tuomas Hyrkkö',
      scorerShirtNumber: '28',
      assistName: 'Lepola',
      period: '3',
      minuteOrTime: '42:15',
      timestamp: new Date().toISOString(),
      venueName: 'Otahalli Espoo',
    }

    matchdayStreamer.emit(sampleGoal)

    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback).toHaveBeenCalledWith(sampleGoal)

    unsubscribe()
    matchdayStreamer.emit(sampleGoal)
    expect(callback).toHaveBeenCalledTimes(1) // No new calls after unsubscribe
  })
})
