/**
 * Live Matchday Streamer & Event Dispatcher
 * Manages real-time goal, period, and penalty notifications across sport satellites.
 */

export type LiveSportType = 'football' | 'floorball' | 'basketball' | 'volleyball'

export type LiveEventType = 'goal' | 'point' | 'penalty_2min' | 'yellow_card' | 'red_card' | 'period_end' | 'match_final'

export interface LiveMatchEvent {
  id: string
  matchId: string
  sport: LiveSportType
  eventType: LiveEventType
  homeTeam: string
  awayTeam: string
  newScore: { home: number; away: number }
  scorerName?: string
  scorerShirtNumber?: string
  assistName?: string
  period: string | number
  minuteOrTime: string
  timestamp: string
  venueName?: string
}

type LiveListener = (event: LiveMatchEvent) => void

class MatchdayStreamer {
  private listeners: Set<LiveListener> = new Set()
  private broadcastChannel: BroadcastChannel | null = null

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('pelipaiva_live_stream')
        this.broadcastChannel.onmessage = (msgEvent) => {
          if (msgEvent.data && msgEvent.data.type === 'MATCHDAY_LIVE_EVENT') {
            this.notifyListeners(msgEvent.data.payload)
          }
        }
      } catch (err) {
        console.warn('[STREAMER] BroadcastChannel unavailable', err)
      }
    }
  }

  public subscribe(listener: LiveListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  public emit(event: LiveMatchEvent): void {
    this.notifyListeners(event)

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'MATCHDAY_LIVE_EVENT',
          payload: event,
        })
      } catch (err) {
        console.warn('[STREAMER] Broadcast failed', err)
      }
    }
  }

  private notifyListeners(event: LiveMatchEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        console.error('[STREAMER] Listener error', err)
      }
    }
  }
}

export const matchdayStreamer = new MatchdayStreamer()
