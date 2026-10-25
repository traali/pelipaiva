import { describe, it, expect, vi } from 'vitest'
import { matchdayStreamer, liveEventMatchLinks, type LiveMatchEvent } from './matchdayStreamer'

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

describe('liveEventMatchLinks', () => {
  it('links from a TASO fixture id: sport app first, tulospalvelu second', () => {
    expect(
      liveEventMatchLinks({ matchId: 'x', officialFixtureId: 'salibandy_25301_924881', sport: 'floorball' })
    ).toMatchObject({
      appUrl: 'https://floorball-stats.pages.dev/#/match/924881',
      federationUrl: 'https://tulospalvelu.salibandy.fi/match/924881',
    })
    expect(liveEventMatchLinks({ matchId: 'palloliitto_60341_4208643', sport: 'football' })?.matchId).toBe('4208643')
  })

  it('no link from a bare or unknown id', () => {
    expect(liveEventMatchLinks({ matchId: '913481', sport: 'floorball' })).toBeNull()
    expect(liveEventMatchLinks({ matchId: '', sport: 'football' })).toBeNull()
  })
})
