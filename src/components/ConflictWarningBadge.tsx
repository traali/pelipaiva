import React from 'react'
import type { FamilyConflictClash } from '../lib/events/familyConflictEngine'
import { AlertTriangle, Clock, Users, ArrowRight } from 'lucide-react'

interface ConflictWarningBadgeProps {
  clash: FamilyConflictClash
}

export const ConflictWarningBadge: React.FC<ConflictWarningBadgeProps> = ({ clash }) => {
  const isDirect = clash.conflictType === 'direct_overlap'

  return (
    <div
      className={`p-3.5 rounded-2xl border transition-all ${
        isDirect
          ? 'bg-rose-950/30 border-rose-500/40 text-rose-100 shadow-sm'
          : 'bg-amber-950/30 border-amber-500/40 text-amber-100 shadow-sm'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5 font-bold text-xs">
        {isDirect ? (
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
        ) : (
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
        )}
        <span className={isDirect ? 'text-rose-300' : 'text-amber-300'}>
          {isDirect ? 'Perheen Aikataulupäällekkäisyys' : 'Tiukka Siirtymäaikataulu'}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-slate-300">{clash.advisoryFinnish}</p>

      <div className="mt-2.5 pt-2 border-t border-slate-700/40 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5 truncate">
          <Users className="w-3.5 h-3.5 text-slate-500" />
          <span>{clash.playerName1} ({clash.sport1})</span>
          <ArrowRight className="w-3 h-3 text-slate-600" />
          <span>{clash.playerName2} ({clash.sport2})</span>
        </div>
        <span className="font-semibold text-slate-300 shrink-0">
          {clash.drivingMinutesNeeded} min siirtymä
        </span>
      </div>
    </div>
  )
}
