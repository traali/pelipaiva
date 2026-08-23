import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Navigation,
  Trophy
} from 'lucide-react';
import { MatchdayEvent, PlayerProfile } from '../types/matchday';
import { helsinkiDateISO } from '../lib/agents/time';
import { sportLabelFi } from '../lib/sport/sportMeta';
import { springTactile } from '../lib/motion/springs';
import { getContrastTextColor } from '../lib/sport/teamColors';

interface TimelineCalendarViewProps {
  events: MatchdayEvent[];
  profiles: PlayerProfile[];
  viewMode: 'timeline' | 'calendar';
  onNavigate?: (event: MatchdayEvent) => void;
  onSelectEvent?: (event: MatchdayEvent) => void;
}

export const TimelineCalendarView: React.FC<TimelineCalendarViewProps> = ({
  events,
  profiles,
  viewMode,
  onNavigate,
  onSelectEvent
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

  const todayISO = helsinkiDateISO(new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string>(() => {
    const hasToday = groupedByDay.some((g) => g.dateStr === todayISO);
    if (hasToday) return todayISO;
    const upcoming = groupedByDay.find((g) => g.dateStr >= todayISO);
    return upcoming?.dateStr || groupedByDay[0]?.dateStr || todayISO;
  });

  const activeDayData = useMemo(() => {
    const found = groupedByDay.find((g) => g.dateStr === selectedDayKey);
    if (found) return found;
    const hasToday = groupedByDay.find((g) => g.dateStr === todayISO);
    if (hasToday) return hasToday;
    return groupedByDay[0];
  }, [groupedByDay, selectedDayKey, todayISO]);

  if (events.length === 0) {
    return (
      <div className="p-8 text-center text-text-muted text-xs bg-surface-elevated/50 rounded-2xl border border-border-subtle">
        Ei merkittyjä tapahtumia valitulla suodatuksella.
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

                return (
                  <motion.div
                    key={ev.id}
                    whileTap={{ scale: 0.99 }}
                    transition={springTactile.gentle}
                    onClick={() => onSelectEvent?.(ev)}
                    className="p-3.5 rounded-2xl bg-surface-elevated border border-border-subtle hover:border-pitch/40 transition-all flex flex-col gap-2.5 relative overflow-hidden shadow-xs cursor-pointer"
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

                    {/* Bottom Row: Venue, Nappisvahti & Navigation */}
                    <div className="pl-1.5 pt-2 border-t border-border-subtle/60 flex items-center justify-between text-xs text-text-secondary gap-2">
                      <div className="flex items-center gap-1.5 truncate min-w-0">
                        <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        <span className="truncate font-medium">{ev.venue.name}</span>
                        {ev.venue.surface && (
                          <span className="text-[10px] text-text-muted shrink-0">
                            • {ev.venue.surface}
                          </span>
                        )}
                      </div>

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
                              '_blank'
                            );
                          }
                        }}
                        className="min-h-[44px] px-3 rounded-xl bg-pitch/15 text-pitch hover:bg-pitch hover:text-text-inverse text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shrink-0 focus-visible:ring-2 focus-visible:ring-pitch"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Reitti</span>
                      </button>
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

  // 2. CALENDAR DAY-MATRIX VIEW (Week grid + day breakdown)
  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* Day Selector Pills Grid */}
      <div className="flex rounded-2xl bg-surface-elevated p-1.5 border border-border-subtle gap-1 overflow-x-auto scrollbar-none">
        {groupedByDay.map((dg) => {
          const isSelected = dg.dateStr === (activeDayData?.dateStr || selectedDayKey);
          const weekdayShort = dg.date.toLocaleDateString('fi-FI', { weekday: 'short' });
          const dayNum = dg.date.getDate();

          return (
            <button
              key={dg.dateStr}
              type="button"
              onClick={() => setSelectedDayKey(dg.dateStr)}
              className={`flex-1 min-w-[64px] py-2 px-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                isSelected
                  ? 'bg-pitch text-text-inverse shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface'
              }`}
            >
              <span className="text-[10px] uppercase font-bold tracking-wider">
                {weekdayShort}
              </span>
              <span className="text-base font-black leading-none">{dayNum}</span>
              <span
                className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-white/25 text-white' : 'bg-pitch/15 text-pitch'
                }`}
              >
                {dg.events.length} {dg.events.length === 1 ? 'peli' : 'peliä'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Selected Day Schedule */}
      {activeDayData && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-sm font-black text-text-primary flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-pitch" />
              {activeDayData.label}
            </span>
            <span className="text-xs text-text-muted">
              {activeDayData.events.length} tapahtumaa
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {activeDayData.events.map((ev) => {
              const profile = profileMap.get(ev.profileId);
              const start = new Date(ev.startTime);
              const end = new Date(ev.endTime);
              const timeStr = `${start.toLocaleTimeString('fi-FI', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Helsinki'
              })} – ${end.toLocaleTimeString('fi-FI', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Europe/Helsinki'
              })}`;

              return (
                <div
                  key={ev.id}
                  className="p-4 rounded-2xl bg-surface-elevated border border-border-strong flex flex-col gap-2.5 relative overflow-hidden"
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2"
                    style={{ backgroundColor: profile?.colorHex || '#3b82f6' }}
                  />

                  <div className="flex items-center justify-between pl-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black font-mono text-pitch">{timeStr}</span>
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xs"
                        style={{
                          backgroundColor: profile?.colorHex || '#3b82f6',
                          color: getContrastTextColor(profile?.colorHex)
                        }}
                      >
                        {profile?.playerName}
                      </span>
                    </div>

                    <span className="text-xs font-bold text-text-secondary">
                      {ev.sport === 'football' ? '⚽ Jalkapallo' : ev.sport === 'floorball' ? '🏑 Salibandy' : '🏀 Koripallo'}
                    </span>
                  </div>

                  <div className="pl-2 text-sm font-bold text-text-primary line-clamp-2 break-words">
                    {ev.title}
                  </div>

                  <div className="pl-2 flex items-center justify-between text-xs text-text-secondary pt-1 border-t border-border-subtle">
                    <div className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <span className="truncate">{ev.venue.name}</span>
                    </div>

                    <button
                      type="button"
                      aria-label={`Navigoi kentälle ${ev.venue.name}`}
                      onClick={() => {
                        const coords = ev.parking?.coordinates || ev.venue.coordinates;
                        window.open(
                          `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}`,
                          '_blank'
                        );
                      }}
                      className="min-h-[44px] px-3.5 rounded-xl bg-pitch text-text-inverse font-bold text-xs flex items-center gap-1.5 hover:brightness-110 cursor-pointer transition-all shadow-xs focus-visible:ring-2 focus-visible:ring-pitch"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Reitti</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
