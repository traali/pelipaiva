import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Navigation,
  Trophy,
  AlertTriangle
} from 'lucide-react';
import { MatchdayEvent, PlayerProfile } from '../types/matchday';
import type { FamilyConflict } from '../lib/agents';
import { helsinkiDateISO } from '../lib/agents/time';
import { sportLabelFi } from '../lib/sport/sportMeta';
import { springTactile } from '../lib/motion/springs';
import { getContrastTextColor } from '../lib/sport/teamColors';
import { FamilyVisualCalendar } from './FamilyVisualCalendar';

interface TimelineCalendarViewProps {
  events: MatchdayEvent[];
  profiles: PlayerProfile[];
  viewMode: 'timeline' | 'calendar';
  conflicts?: FamilyConflict[];
  onNavigate?: (event: MatchdayEvent) => void;
  onSelectEvent?: (event: MatchdayEvent) => void;
  onClearFilter?: () => void;
}

function surfaceLabel(surface?: string, indoor?: boolean): string | null {
  if (!surface) return null;
  if (indoor) {
    if (surface === 'indoor_parquet') return 'Parketti';
    if (surface === 'indoor_synthetic') return 'Sisäalusta';
    return 'Sisähalli';
  }
  switch (surface) {
    case 'artificial_turf_3g':
      return 'Tekonurmi 3G';
    case 'sand_artificial_turf':
      return 'Hiekkatekonurmi';
    case 'natural_grass':
      return 'Luonnonnurmi';
    case 'indoor_parquet':
      return 'Parketti';
    case 'indoor_synthetic':
      return 'Sisäalusta';
    case 'gravel':
      return 'Hiekka';
    default:
      return surface.replace(/_/g, ' ');
  }
}

export const TimelineCalendarView: React.FC<TimelineCalendarViewProps> = ({
  events,
  profiles,
  viewMode,
  conflicts,
  onNavigate,
  onSelectEvent,
  onClearFilter
}) => {
  const profileMap = useMemo(() => {
    const map = new Map<string, PlayerProfile>();
    for (const p of profiles) {
      map.set(p.id, p);
    }
    return map;
  }, [profiles]);

  // Group events by YYYY-MM-DD
  const groupedByDay = useMemo(() => {
    const map = new Map<string, { date: Date; dateStr: string; label: string; events: MatchdayEvent[] }>();
    const sorted = [...events].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );

    for (const ev of sorted) {
      const d = new Date(ev.startTime);
      const key = helsinkiDateISO(d);
      if (!map.has(key)) {
        const fiLabel = d.toLocaleDateString('fi-FI', {
          weekday: 'long',
          day: 'numeric',
          month: 'numeric',
          timeZone: 'Europe/Helsinki'
        });
        const capitalized = fiLabel.charAt(0).toUpperCase() + fiLabel.slice(1);
        map.set(key, {
          date: d,
          dateStr: key,
          label: capitalized,
          events: []
        });
      }
      map.get(key)!.events.push(ev);
    }
    return Array.from(map.values());
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="p-8 text-center text-text-muted text-xs bg-surface-elevated/50 rounded-2xl border border-border-subtle flex flex-col items-center gap-3 my-4">
        <div>Ei merkittyjä tapahtumia valitulla suodatuksella.</div>
        {onClearFilter && (
          <button
            type="button"
            onClick={onClearFilter}
            className="px-4 py-2 rounded-xl bg-pitch text-text-inverse font-bold text-xs hover:brightness-110 cursor-pointer shadow-sm"
          >
            Näytä koko perheen ottelut
          </button>
        )}
      </div>
    );
  }

  // 1. TIMELINE LIST VIEW (Dense, highly scannable chronological matrix)
  if (viewMode === 'timeline') {
    return (
      <div className="flex flex-col gap-5 pb-8">
        {groupedByDay.map((dayGroup) => (
          <div key={dayGroup.dateStr} className="flex flex-col gap-2">
            {/* Sticky Day Section Header */}
            <div className="sticky top-12 z-20 -mx-4 px-4 py-2 bg-canvas/95 backdrop-blur-md border-y border-border-subtle/80 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-pitch/15 text-pitch">
                  <CalendarIcon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-black tracking-wide text-text-primary">
                  {dayGroup.label}
                </span>
              </div>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-surface-elevated text-text-secondary border border-border-subtle">
                {dayGroup.events.length} {dayGroup.events.length === 1 ? 'ottelu' : 'ottelua'}
              </span>
            </div>

            {/* Dense Timeline Rows */}
            <div className="flex flex-col gap-2">
              {dayGroup.events.map((ev) => {
                const profile = profileMap.get(ev.profileId);
                const start = new Date(ev.startTime);
                const end = new Date(ev.endTime);
                const tz = { hour: '2-digit' as const, minute: '2-digit' as const, timeZone: 'Europe/Helsinki' };
                const timeStr = `${start.toLocaleTimeString('fi-FI', tz)} – ${end.toLocaleTimeString('fi-FI', tz)}`;

                const isTournament = ev.eventType === 'tournament' || Boolean(ev.tournamentName);
                // Honest affordance (M-44): only matches/tournaments open stats —
                // trainings must not present as clickable. Interactive rows are
                // keyboard-operable (role=button + Enter/Space).
                const isInteractive = !ev.isTraining;

                return (
                  <motion.div
                    key={ev.id}
                    whileTap={isInteractive ? { scale: 0.99 } : undefined}
                    transition={springTactile.gentle}
                    onClick={isInteractive ? () => onSelectEvent?.(ev) : undefined}
                    role={isInteractive ? 'button' : undefined}
                    tabIndex={isInteractive ? 0 : undefined}
                    aria-disabled={isInteractive ? undefined : true}
                    onKeyDown={
                      isInteractive
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelectEvent?.(ev);
                            }
                          }
                        : undefined
                    }
                    className={`p-3.5 rounded-2xl bg-surface-elevated border border-border-subtle hover:border-pitch/40 transition-all flex flex-col gap-2.5 relative overflow-hidden shadow-xs ${isInteractive ? 'cursor-pointer' : ''}`}
                  >
                    {/* Left color bar indicator for child */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1.5"
                      style={{ backgroundColor: profile?.colorHex || '#3b82f6' }}
                    />

                    {/* Top Row: Time + Player + Badges */}
                    <div className="flex items-center justify-between gap-2 pl-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black font-mono tracking-tight text-text-primary flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-pitch shrink-0" />
                          {timeStr}
                        </span>

                        <span
                          className="text-[11px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 truncate max-w-[140px] shadow-xs"
                          style={{
                            backgroundColor: profile?.colorHex || '#3b82f6',
                            color: getContrastTextColor(profile?.colorHex)
                          }}
                        >
                          <span>{profile?.playerName || 'Pelaaja'}</span>
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isTournament && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-pitch/15 text-pitch flex items-center gap-0.5">
                            <Trophy className="w-3 h-3" />
                            Turnaus
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-text-muted">{sportLabelFi(ev.sport)}</span>
                      </div>
                    </div>

                    {/* Middle Row: Match Title & Opponent */}
                    <div className="pl-1.5 flex items-baseline justify-between gap-2">
                      <div className="text-sm font-bold text-text-primary line-clamp-2 break-words leading-snug">
                        {ev.title}
                      </div>
                      {ev.isHomeMatch !== undefined && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted shrink-0">
                          {ev.isHomeMatch ? 'Kotipeli' : 'Vieraspeli'}
                        </span>
                      )}
                    </div>

                    {/* Overlap & Driving Transition Warning */}
                    {(() => {
                      const related = conflicts?.filter((c) => c.eventAId === ev.id || c.eventBId === ev.id) || [];
                      if (related.length === 0) return null;
                      return (
                        <div className="pl-1.5 flex flex-col gap-1.5">
                          {related.map((c) => (
                            <div
                              key={c.id}
                              role="alert"
                              className={`p-2 rounded-xl text-[11px] font-bold border flex items-start gap-1.5 ${
                                c.severity === 'critical'
                                  ? 'bg-stoppage/15 border-stoppage/30 text-stoppage'
                                  : 'bg-whistle/15 border-whistle/30 text-whistle'
                              }`}
                            >
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <div>
                                  {c.overlapMinutes > 0
                                    ? `⚠️ Päällekkäisyys (${c.overlapMinutes} min)`
                                    : `🚗 Tiukka siirtymä (~${c.travelMinutesEstimate} min ajo)`}
                                </div>
                                <div className="text-[10px] font-medium opacity-90 mt-0.5 leading-tight">
                                  {c.message}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Bottom Row: Venue, Nappisvahti & Navigation / Result */}
                    <div className="pl-1.5 pt-2 border-t border-border-subtle/60 flex items-center justify-between text-xs text-text-secondary gap-2">
                      <div className="flex items-center gap-1.5 truncate min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        <span className="truncate font-medium">{ev.venue.name}</span>
                        {surfaceLabel(ev.venue.surface, ev.venue.isIndoor) && (
                          <span className="text-[10px] text-text-muted shrink-0">
                            • {surfaceLabel(ev.venue.surface, ev.venue.isIndoor)}
                          </span>
                        )}
                      </div>

                      {new Date(ev.endTime) <= new Date() || ev.score !== undefined ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="min-h-[36px] px-2.5 rounded-xl bg-surface border border-border-strong text-text-primary font-mono font-black text-xs flex items-center gap-1 shadow-2xs">
                            <Trophy className="w-3.5 h-3.5 text-pitch" />
                            <span>{ev.score ? `Tulos: ${ev.score}` : 'Päättynyt'}</span>
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Navigoi kentälle ${ev.venue.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onNavigate) {
                              onNavigate(ev);
                            } else {
                              const coords = ev.parking?.coordinates || ev.venue.coordinates;
                              window.open(
                                `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`,
                                '_blank',
                                'noopener,noreferrer'
                              );
                            }
                          }}
                          className="min-h-[44px] px-3 rounded-xl bg-pitch/15 text-pitch hover:bg-pitch hover:text-text-inverse text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-pitch"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Reitti</span>
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 2. VISUAL FAMILY CALENDAR VIEW (Month, Week & Day Visual Views)
  return (
    <FamilyVisualCalendar
      events={events}
      profiles={profiles}
      conflicts={conflicts}
      onSelectEvent={onSelectEvent}
      onNavigate={onNavigate}
      onClearFilter={onClearFilter}
    />
  );
};
