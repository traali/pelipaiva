import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { matchdayStreamer, type LiveMatchEvent } from '../lib/live/matchdayStreamer'
import { springTactile } from '../lib/motion/springs'
import { X, ExternalLink, Zap } from 'lucide-react'

interface LiveMatchToastProps {
  onOpenSatelliteDrawer?: (sport: string, matchId: string, title: string) => void
}

export const LiveMatchToast: React.FC<LiveMatchToastProps> = ({ onOpenSatelliteDrawer }) => {
  const [currentEvent, setCurrentEvent] = useState<LiveMatchEvent | null>(null)

  useEffect(() => {
    const unsubscribe = matchdayStreamer.subscribe((event) => {
      setCurrentEvent(event)

      // Auto-dismiss after 8 seconds
      const timer = setTimeout(() => {
        setCurrentEvent((prev) => (prev?.id === event.id ? null : prev))
      }, 8000)

      return () => clearTimeout(timer)
    })

    return () => unsubscribe()
  }, [])

  if (!currentEvent) return null

  const sportIcon =
    currentEvent.sport === 'football'
      ? '⚽'
      : currentEvent.sport === 'floorball'
      ? '🏑'
      : currentEvent.sport === 'basketball'
      ? '🏀'
      : '🏐'

  const sportBadgeColor =
    currentEvent.sport === 'football'
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
      : currentEvent.sport === 'floorball'
      ? 'bg-[#5BC0BE]/20 text-[#6FFFE9] border-[#5BC0BE]/30'
      : currentEvent.sport === 'basketball'
      ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
      : 'bg-blue-500/20 text-blue-300 border-blue-500/30'

  return (
    <AnimatePresence>
      <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full px-4 sm:px-0 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={springTactile.snappy}
          className="pointer-events-auto bg-[#1C2541]/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-2xl text-slate-100 flex flex-col gap-3"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">{sportIcon}</span>
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${sportBadgeColor}`}>
                {currentEvent.eventType === 'goal' ? 'MAALI! 🔥' : 'LIVE TAPAHTUMA'}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {currentEvent.period}. erä ({currentEvent.minuteOrTime})
              </span>
            </div>

            <button
              onClick={() => setCurrentEvent(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Teams & Score */}
          <div className="flex items-center justify-between bg-[#0B132B]/80 rounded-xl px-3 py-2 border border-slate-800">
            <span className="font-bold text-xs sm:text-sm text-slate-200 truncate max-w-[110px]">
              {currentEvent.homeTeam}
            </span>
            <div className="font-black text-base sm:text-lg text-white font-mono px-2">
              {currentEvent.newScore.home} – {currentEvent.newScore.away}
            </div>
            <span className="font-bold text-xs sm:text-sm text-[#5BC0BE] truncate max-w-[110px]">
              {currentEvent.awayTeam}
            </span>
          </div>

          {/* Scorer Info */}
          {currentEvent.scorerName && (
            <div className="text-xs text-slate-300 flex items-center justify-between">
              <div className="flex items-center gap-1.5 truncate">
                <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-bold truncate">
                  {currentEvent.scorerShirtNumber ? `#${currentEvent.scorerShirtNumber} ` : ''}
                  {currentEvent.scorerName}
                </span>
                {currentEvent.assistName && (
                  <span className="text-slate-400 text-[11px] truncate">({currentEvent.assistName})</span>
                )}
              </div>
            </div>
          )}

          {/* Action button */}
          {onOpenSatelliteDrawer && (
            <button
              onClick={() => {
                onOpenSatelliteDrawer(
                  currentEvent.sport,
                  currentEvent.matchId,
                  `${currentEvent.homeTeam} vs ${currentEvent.awayTeam}`
                )
                setCurrentEvent(null)
              }}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-[#3A506B] hover:bg-[#5BC0BE] hover:text-[#0B132B] transition-all text-xs font-bold text-slate-100 cursor-pointer"
            >
              <span>Avaa tilastokeskus</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
