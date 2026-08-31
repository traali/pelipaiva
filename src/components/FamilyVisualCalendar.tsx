import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Navigation,
  Trophy,
  AlertTriangle,
  Coffee,
  Sparkles,
  Users
} from 'lucide-react';
import { MatchdayEvent, PlayerProfile } from '../types/matchday';
import type { FamilyConflict } from '../lib/agents';
import { helsinkiDateISO, formatFiTime } from '../lib/agents/time';
import { getContrastTextColor } from '../lib/sport/teamColors';

export interface FamilyVisualCalendarProps {
  events: MatchdayEvent[];
  profiles: PlayerProfile[];
  conflicts?: FamilyConflict[];
  onSelectEvent?: (event: MatchdayEvent) => void;
  onNavigate?: (event: MatchdayEvent) => void;
  onClearFilter?: () => void;
}

export type CalendarGranularity = 'month' | 'week' | 'day';

export const WEEKDAYS_FI = ['Ma', 'Ti', 'Ke', 'To', 'Pe', 'La', 'Su'];
export const MONTH_NAMES_FI = [
  'Tammikuu', 'Helmikuu', 'Maaliskuu', 'Huhtikuu', 'Toukokuu', 'Kesäkuu',
  'Heinäkuu', 'Elokuu', 'Syyskuu', 'Lokakuu', 'Marraskuu', 'Joulukuu'
];

/** Returns the Monday date of the week for given date in Helsinki time */
export function getMondayOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

/** Formats a Date to YYYY-MM-DD in local time */
export function formatDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const FamilyVisualCalendar: React.FC<FamilyVisualCalendarProps> = ({
  events,
  profiles,
  conflicts,
  onSelectEvent,
  onNavigate,
  onClearFilter
}) => {
  const profileMap = useMemo(() => {
    const map = new Map<string, PlayerProfile>();
    for (const p of profiles) {
      map.set(p.id, p);
    }
    return map;
  }, [profiles]);

  const todayISO = useMemo(() => helsinkiDateISO(new Date()), []);

  // Find default active date (first upcoming event date or today)
  const defaultDateISO = useMemo(() => {
    const sorted = [...events].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    const upcoming = sorted.find((ev) => helsinkiDateISO(new Date(ev.startTime)) >= todayISO);
    return upcoming ? helsinkiDateISO(new Date(upcoming.startTime)) : todayISO;
  }, [events, todayISO]);

  const [selectedDateISO, setSelectedDateISO] = useState<string>(defaultDateISO);
  const [granularity, setGranularity] = useState<CalendarGranularity>('month');

  // Month navigation state: First day of current view month
  const [viewDate, setViewDate] = useState<Date>(() => {
    const [y, m] = defaultDateISO.split('-').map(Number);
    return new Date(y ?? new Date().getFullYear(), (m ?? 1) - 1, 1);
  });

  // Map events by date ISO string (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, MatchdayEvent[]>();
    for (const ev of events) {
      const key = helsinkiDateISO(new Date(ev.startTime));
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(ev);
    }
    // Sort events within each day by start time
    for (const [, dayEvents] of map.entries()) {
      dayEvents.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    }
    return map;
  }, [events]);

  // Conflict days map for instant lookup
  const conflictDateSet = useMemo(() => {
    const set = new Set<string>();
    if (!conflicts) return set;
    for (const c of conflicts) {
      const evA = events.find((e) => e.id === c.eventAId);
      if (evA) {
        set.add(helsinkiDateISO(new Date(evA.startTime)));
      }
    }
    return set;
  }, [conflicts, events]);

  // Month stats calculation
  const currentMonthStats = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    let matchesCount = 0;
    let trainingsCount = 0;
    let talkooCount = 0;

    for (const ev of events) {
      const d = new Date(ev.startTime);
      if (d.getFullYear() === year && d.getMonth() === month) {
        if (ev.isTraining) {
          trainingsCount++;
        } else {
          matchesCount++;
        }
        if (ev.volunteerDuty) {
          talkooCount++;
        }
      }
    }

    return { matchesCount, trainingsCount, talkooCount, total: matchesCount + trainingsCount };
  }, [events, viewDate]);

  // Build 7-column calendar matrix for current view month
  const monthMatrix = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday-based indexing: 0 = Mon, ..., 6 = Sun
    const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInMonth = lastDayOfMonth.getDate();

    const cells: Array<{
      date: Date;
      dateISO: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      events: MatchdayEvent[];
      hasConflict: boolean;
      hasTalkoo: boolean;
    }> = [];

    // Leading days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const d = new Date(year, month - 1, dayNum);
      const iso = formatDateKey(d);
      const dayEvents = eventsByDate.get(iso) || [];
      cells.push({
        date: d,
        dateISO: iso,
        dayNum,
        isCurrentMonth: false,
        isToday: iso === todayISO,
        events: dayEvents,
        hasConflict: conflictDateSet.has(iso),
        hasTalkoo: dayEvents.some((e) => Boolean(e.volunteerDuty))
      });
    }

    // Days in current month
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const iso = formatDateKey(d);
      const dayEvents = eventsByDate.get(iso) || [];
      cells.push({
        date: d,
        dateISO: iso,
        dayNum: day,
        isCurrentMonth: true,
        isToday: iso === todayISO,
        events: dayEvents,
        hasConflict: conflictDateSet.has(iso),
        hasTalkoo: dayEvents.some((e) => Boolean(e.volunteerDuty))
      });
    }

    // Trailing days to fill last week
    const remaining = (7 - (cells.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const iso = formatDateKey(d);
      const dayEvents = eventsByDate.get(iso) || [];
      cells.push({
        date: d,
        dateISO: iso,
        dayNum: i,
        isCurrentMonth: false,
        isToday: iso === todayISO,
        events: dayEvents,
        hasConflict: conflictDateSet.has(iso),
        hasTalkoo: dayEvents.some((e) => Boolean(e.volunteerDuty))
      });
    }

    return cells;
  }, [viewDate, eventsByDate, todayISO, conflictDateSet]);

  // Week days calculation for 'week' granularity
  const currentWeekDays = useMemo(() => {
    const [y, m, d] = selectedDateISO.split('-').map(Number);
    const selectedDate = new Date(y ?? new Date().getFullYear(), (m ?? 1) - 1, d ?? 1);
    const monday = getMondayOfWeek(selectedDate);

    const weekDays: Array<{
      date: Date;
      dateISO: string;
      dayNum: number;
      weekdayName: string;
      isToday: boolean;
      events: MatchdayEvent[];
      hasConflict: boolean;
    }> = [];

    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      const iso = formatDateKey(day);
      const dayEvents = eventsByDate.get(iso) || [];
      weekDays.push({
        date: day,
        dateISO: iso,
        dayNum: day.getDate(),
        weekdayName: WEEKDAYS_FI[i] || '',
        isToday: iso === todayISO,
        events: dayEvents,
        hasConflict: conflictDateSet.has(iso)
      });
    }

    return weekDays;
  }, [selectedDateISO, eventsByDate, todayISO, conflictDateSet]);

  // Active selected day events list
  const selectedDayEvents = useMemo(() => {
    return eventsByDate.get(selectedDateISO) || [];
  }, [eventsByDate, selectedDateISO]);

  // Navigation handlers
  const handlePrev = () => {
    if (granularity === 'month') {
      setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    } else if (granularity === 'week') {
      const [y, m, d] = selectedDateISO.split('-').map(Number);
      const cur = new Date(y ?? new Date().getFullYear(), (m ?? 1) - 1, d ?? 1);
      cur.setDate(cur.getDate() - 7);
      const nextIso = formatDateKey(cur);
      setSelectedDateISO(nextIso);
      setViewDate(new Date(cur.getFullYear(), cur.getMonth(), 1));
    } else {
      const [y, m, d] = selectedDateISO.split('-').map(Number);
      const cur = new Date(y ?? new Date().getFullYear(), (m ?? 1) - 1, d ?? 1);
      cur.setDate(cur.getDate() - 1);
      const nextIso = formatDateKey(cur);
      setSelectedDateISO(nextIso);
      setViewDate(new Date(cur.getFullYear(), cur.getMonth(), 1));
    }
  };

  const handleNext = () => {
    if (granularity === 'month') {
      setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    } else if (granularity === 'week') {
      const [y, m, d] = selectedDateISO.split('-').map(Number);
      const cur = new Date(y ?? new Date().getFullYear(), (m ?? 1) - 1, d ?? 1);
      cur.setDate(cur.getDate() + 7);
      const nextIso = formatDateKey(cur);
      setSelectedDateISO(nextIso);
      setViewDate(new Date(cur.getFullYear(), cur.getMonth(), 1));
    } else {
      const [y, m, d] = selectedDateISO.split('-').map(Number);
      const cur = new Date(y ?? new Date().getFullYear(), (m ?? 1) - 1, d ?? 1);
      cur.setDate(cur.getDate() + 1);
      const nextIso = formatDateKey(cur);
      setSelectedDateISO(nextIso);
      setViewDate(new Date(cur.getFullYear(), cur.getMonth(), 1));
    }
  };

  const handleJumpToToday = () => {
    const now = new Date();
    setSelectedDateISO(todayISO);
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // Header Title String based on active granularity
  const viewTitle = useMemo(() => {
    if (granularity === 'month') {
      return `${MONTH_NAMES_FI[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
    }
    if (granularity === 'week') {
      const start = currentWeekDays[0]?.date;
      const end = currentWeekDays[6]?.date;
      if (!start || !end) return '';
      return `${start.getDate()}.${start.getMonth() + 1}. – ${end.getDate()}.${end.getMonth() + 1}.${end.getFullYear()}`;
    }
    const [y, m, d] = selectedDateISO.split('-').map(Number);
    const date = new Date(y ?? new Date().getFullYear(), (m ?? 1) - 1, d ?? 1);
    const weekday = date.toLocaleDateString('fi-FI', { weekday: 'long' });
    const capitalized = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    return `${capitalized} ${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
  }, [granularity, viewDate, currentWeekDays, selectedDateISO]);

  if (events.length === 0) {
    return (
      <div className="p-8 text-center text-text-muted text-xs bg-surface-elevated/50 rounded-3xl border border-border-subtle flex flex-col items-center gap-3 my-4">
        <CalendarIcon className="w-8 h-8 text-text-muted opacity-50" />
        <div className="font-bold text-text-primary">Ei merkittyjä tapahtumia valitulla suodatuksella</div>
        <p className="text-[11px] text-text-secondary max-w-xs">
          Tuo joukkueen otteluohjelma sarjalinkillä tai kalenteritiedostolla nähdäksesi tapahtumat kalenterissa.
        </p>
        {onClearFilter && (
          <button
            type="button"
            onClick={onClearFilter}
            className="mt-1 px-4 py-2 rounded-xl bg-pitch text-text-inverse font-bold text-xs hover:brightness-110 cursor-pointer shadow-sm"
          >
            Näytä koko perheen ottelut
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-8" data-testid="family-visual-calendar">
      {/* 1. Header Toolbar: Navigation & Granularity Switcher */}
      <div className="rounded-3xl border border-border-strong/80 bg-surface/80 backdrop-blur-md p-3.5 sm:p-4.5 flex flex-col gap-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Month / Week Title & Arrows */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Edellinen"
              className="p-2 rounded-xl bg-surface-elevated border border-border-subtle text-text-primary hover:border-pitch transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-pitch"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <h2 className="text-sm sm:text-base font-black text-text-primary tracking-tight px-1 min-w-[140px] text-center sm:text-left">
              {viewTitle}
            </h2>

            <button
              type="button"
              onClick={handleNext}
              aria-label="Seuraava"
              className="p-2 rounded-xl bg-surface-elevated border border-border-subtle text-text-primary hover:border-pitch transition-all cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-pitch"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleJumpToToday}
              className="ml-1 px-3 py-1.5 rounded-xl border border-pitch/30 bg-pitch/10 text-pitch font-bold text-xs hover:bg-pitch hover:text-text-inverse transition-all cursor-pointer min-h-[40px] flex items-center justify-center"
            >
              Tänään
            </button>
          </div>

          {/* Granularity Segmented Switcher */}
          <div
            role="tablist"
            aria-label="Kalenterinäkymä"
            className="flex rounded-2xl bg-surface-elevated p-1 border border-border-subtle shrink-0"
          >
            {(['month', 'week', 'day'] as CalendarGranularity[]).map((g) => {
              const active = granularity === g;
              const labels: Record<CalendarGranularity, string> = {
                month: 'Kuukausi',
                week: 'Viikko',
                day: 'Päivä'
              };
              return (
                <button
                  key={g}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setGranularity(g)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer min-h-[36px] flex items-center justify-center ${
                    active
                      ? 'bg-pitch text-text-inverse shadow-xs'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {labels[g]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Monthly Summary Statistics Strip */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border-subtle/60 text-[11px] font-bold text-text-secondary">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-pitch" />
            <span>Kuukauden tilanne:</span>
          </div>
          <span className="px-2 py-0.5 rounded-md bg-surface-elevated border border-border-subtle text-text-primary">
            ⚽ {currentMonthStats.matchesCount} ottelua
          </span>
          <span className="px-2 py-0.5 rounded-md bg-surface-elevated border border-border-subtle text-text-primary">
            🏃 {currentMonthStats.trainingsCount} treenit
          </span>
          {currentMonthStats.talkooCount > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-whistle/20 text-whistle border border-whistle/30 flex items-center gap-1">
              <Coffee className="w-3 h-3" />
              <span>{currentMonthStats.talkooCount} talkoot</span>
            </span>
          )}
        </div>
      </div>

      {/* 2. Main Calendar Content: Month Grid / Week Grid / Day List */}
      <AnimatePresence mode="wait">
        {granularity === 'month' && (
          <motion.div
            key="month-view"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-3"
          >
            {/* Weekday Header Row */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center">
              {WEEKDAYS_FI.map((wd, i) => (
                <div
                  key={wd}
                  className={`py-1.5 text-[11px] font-black uppercase tracking-wider ${
                    i >= 5 ? 'text-whistle' : 'text-text-muted'
                  }`}
                >
                  {wd}
                </div>
              ))}
            </div>

            {/* Month Day Cells Grid */}
            <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
              {monthMatrix.map((cell) => {
                const isSelected = cell.dateISO === selectedDateISO;
                const hasEvents = cell.events.length > 0;

                return (
                  <button
                    key={cell.dateISO}
                    type="button"
                    onClick={() => setSelectedDateISO(cell.dateISO)}
                    className={`relative p-1 sm:p-2 min-h-[58px] sm:min-h-[72px] rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'border-pitch ring-2 ring-pitch/30 bg-pitch/10 shadow-sm'
                        : cell.isCurrentMonth
                        ? 'border-border-subtle bg-surface-elevated/70 hover:bg-surface-elevated hover:border-border-strong'
                        : 'border-border-subtle/30 bg-surface/30 opacity-40 hover:opacity-70'
                    } ${cell.isToday ? 'font-black' : ''}`}
                  >
                    {/* Top Row in cell: Day number + conflict / talkoo badges */}
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-xs sm:text-sm leading-none ${
                          cell.isToday
                            ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-pitch text-text-inverse font-black'
                            : cell.isCurrentMonth
                            ? 'text-text-primary font-bold'
                            : 'text-text-muted font-medium'
                        }`}
                      >
                        {cell.dayNum}
                      </span>

                      {/* Small badge indicators */}
                      <div className="flex items-center gap-0.5">
                        {cell.hasConflict && (
                          <span
                            title="Päällekkäisyys tai tiukka siirtymä"
                            className="text-[10px] text-stoppage animate-pulse"
                          >
                            ⚠️
                          </span>
                        )}
                        {cell.hasTalkoo && (
                          <span title="Talkoovuoro" className="text-[10px] text-whistle">
                            ☕
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row in cell: Child / Player color dots & event count */}
                    {hasEvents && (
                      <div className="mt-1 flex flex-col gap-0.5 w-full">
                        {/* Mobile dots row */}
                        <div className="flex items-center gap-1 sm:hidden flex-wrap">
                          {cell.events.slice(0, 3).map((ev) => {
                            const prof = profileMap.get(ev.profileId);
                            return (
                              <span
                                key={ev.id}
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: prof?.colorHex || '#10b981' }}
                              />
                            );
                          })}
                          {cell.events.length > 3 && (
                            <span className="text-[8px] font-bold text-text-muted">
                              +{cell.events.length - 3}
                            </span>
                          )}
                        </div>

                        {/* Desktop event pill previews */}
                        <div className="hidden sm:flex flex-col gap-0.5">
                          {cell.events.slice(0, 2).map((ev) => {
                            const prof = profileMap.get(ev.profileId);
                            const startTime = formatFiTime(ev.startTime);
                            return (
                              <div
                                key={ev.id}
                                className="text-[9px] font-bold px-1 py-0.2 rounded truncate leading-tight flex items-center gap-1 shadow-2xs"
                                style={{
                                  backgroundColor: `${prof?.colorHex || '#10b981'}25`,
                                  color: prof?.colorHex || '#10b981',
                                  borderLeft: `2px solid ${prof?.colorHex || '#10b981'}`
                                }}
                              >
                                <span className="font-mono">{startTime}</span>
                                <span className="truncate">{prof?.playerName || ev.title}</span>
                              </div>
                            );
                          })}
                          {cell.events.length > 2 && (
                            <span className="text-[8px] font-extrabold text-pitch pl-1">
                              +{cell.events.length - 2} muuta
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {granularity === 'week' && (
          <motion.div
            key="week-view"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 md:grid-cols-7 gap-2.5"
          >
            {currentWeekDays.map((wDay) => {
              const isSelected = wDay.dateISO === selectedDateISO;
              return (
                <div
                  key={wDay.dateISO}
                  onClick={() => setSelectedDateISO(wDay.dateISO)}
                  className={`p-3 rounded-2xl border flex flex-col gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'border-pitch ring-2 ring-pitch/30 bg-pitch/5'
                      : 'border-border-subtle bg-surface-elevated/60 hover:border-border-strong'
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-border-subtle/60 pb-1.5">
                    <div>
                      <span className="text-[10px] uppercase font-black tracking-wider text-text-muted">
                        {wDay.weekdayName}
                      </span>
                      <div className="text-sm font-black text-text-primary leading-tight">
                        {wDay.dayNum}.{wDay.date.getMonth() + 1}.
                      </div>
                    </div>
                    {wDay.isToday && (
                      <span className="px-1.5 py-0.5 rounded-full bg-pitch text-text-inverse text-[9px] font-black">
                        Tänään
                      </span>
                    )}
                  </div>

                  {wDay.events.length === 0 ? (
                    <div className="py-4 text-center text-[11px] text-text-muted">Ei tapahtumia</div>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {wDay.events.map((ev) => {
                        const prof = profileMap.get(ev.profileId);
                        const timeStr = `${formatFiTime(ev.startTime)}`;
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onSelectEvent && !ev.isTraining) onSelectEvent(ev);
                            }}
                            className="p-2 rounded-xl border border-border-subtle bg-surface flex flex-col gap-1 hover:border-pitch transition-all"
                            style={{
                              borderLeft: `3px solid ${prof?.colorHex || '#10b981'}`
                            }}
                          >
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-mono font-black text-pitch">{timeStr}</span>
                              <span
                                className="font-bold px-1.5 py-0.2 rounded"
                                style={{
                                  backgroundColor: prof?.colorHex || '#10b981',
                                  color: getContrastTextColor(prof?.colorHex)
                                }}
                              >
                                {prof?.playerName}
                              </span>
                            </div>
                            <div className="text-xs font-bold text-text-primary line-clamp-2">
                              {ev.title}
                            </div>
                            <div className="text-[10px] text-text-secondary truncate">
                              📍 {ev.venue.name}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Selected Day Schedule Breakdown */}
      <div className="rounded-3xl border border-border-strong/70 bg-surface/90 backdrop-blur-sm p-4 sm:p-5 flex flex-col gap-3.5 shadow-sm mt-1">
        <div className="flex items-center justify-between border-b border-border-subtle/80 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-pitch/15 text-pitch">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-text-primary">
                {(() => {
                  const [y, m, d] = selectedDateISO.split('-').map(Number);
                  const date = new Date(y ?? new Date().getFullYear(), (m ?? 1) - 1, d ?? 1);
                  const fiWeekday = date.toLocaleDateString('fi-FI', { weekday: 'long' });
                  const capitalized = fiWeekday.charAt(0).toUpperCase() + fiWeekday.slice(1);
                  return `${capitalized} ${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
                })()}
              </h3>
              <p className="text-[11px] text-text-muted">
                {selectedDayEvents.length === 0
                  ? 'Ei tapahtumia tälle päivälle'
                  : `${selectedDayEvents.length} tapahtumaa valittuna päivänä`}
              </p>
            </div>
          </div>

          {selectedDayEvents.length > 0 && (
            <span className="text-[11px] font-black px-2.5 py-1 rounded-full bg-pitch/15 text-pitch border border-pitch/30">
              {selectedDayEvents.length} kpl
            </span>
          )}
        </div>

        {selectedDayEvents.length === 0 ? (
          <div className="py-6 text-center text-xs text-text-muted flex flex-col items-center gap-1.5">
            <Users className="w-5 h-5 opacity-40" />
            <span>Ei pelejä tai treenejä merkittynä tälle päivälle.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {selectedDayEvents.map((ev) => {
              const profile = profileMap.get(ev.profileId);
              const isOut = ev.attendanceStatus === 'out';
              const timeStr = `${formatFiTime(ev.startTime)} – ${formatFiTime(ev.endTime)}`;

              return (
                <div
                  key={ev.id}
                  onClick={() => {
                    if (onSelectEvent && !ev.isTraining) onSelectEvent(ev);
                  }}
                  className={`p-4 rounded-2xl ${
                    isOut
                      ? 'bg-surface/40 border-dashed border-border-strong/60 opacity-65 grayscale-20'
                      : 'bg-surface-elevated border border-border-strong'
                  } flex flex-col gap-2.5 relative overflow-hidden transition-all ${
                    !ev.isTraining ? 'hover:border-pitch cursor-pointer' : ''
                  }`}
                >
                  {/* Left Player Color Indicator Bar */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2.5"
                    style={{ backgroundColor: profile?.colorHex || '#10b981' }}
                  />

                  {/* Top Bar: Time, Player Badge, Sport Badge */}
                  <div className="flex items-center justify-between pl-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black font-mono text-pitch flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{timeStr}</span>
                      </span>
                      <span
                        className="text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xs"
                        style={{
                          backgroundColor: profile?.colorHex || '#10b981',
                          color: getContrastTextColor(profile?.colorHex)
                        }}
                      >
                        {profile?.playerName}
                      </span>
                      {isOut && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-stoppage/15 text-stoppage flex items-center gap-0.5">
                          ⛔ Poisjäänti
                        </span>
                      )}
                    </div>

                    <span className="text-xs font-bold text-text-secondary">
                      {ev.sport === 'football'
                        ? '⚽ Jalkapallo'
                        : ev.sport === 'floorball'
                        ? '🏑 Salibandy'
                        : ev.sport === 'basketball'
                        ? '🏀 Koripallo'
                        : ev.sport === 'volleyball'
                        ? '🏐 Lentopallo'
                        : '🏅 Urheilu'}
                    </span>
                  </div>

                  {/* Event Title */}
                  <h4 className={`text-base font-extrabold ${isOut ? 'line-through text-text-muted' : 'text-text-primary'} pl-2 leading-tight`}>
                    {ev.title}
                  </h4>

                  {/* Conflict warnings */}
                  {(() => {
                    const related = !isOut ? conflicts?.filter((c) => c.eventAId === ev.id || c.eventBId === ev.id) || [] : [];
                    if (related.length === 0) return null;
                    return (
                      <div className="pl-2 flex flex-col gap-1.5">
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

                  {/* Talkoo Duty Notification */}
                  {Boolean(ev.volunteerDuty) && (
                    <div className="pl-2 p-2 rounded-xl bg-whistle/15 border border-whistle/30 text-whistle text-xs font-bold flex items-center gap-1.5">
                      <Coffee className="w-3.5 h-3.5 shrink-0" />
                      <span>Talkoovuoro / kahvio: {ev.volunteerDuty}</span>
                    </div>
                  )}

                  {/* Bottom details: Venue & Navigation */}
                  <div className="pl-2 flex items-center justify-between text-xs text-text-secondary pt-1.5 border-t border-border-subtle gap-2">
                    <div className="flex items-center gap-1.5 truncate min-w-0">
                      <MapPin className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <span className="truncate">{ev.venue.name}</span>
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
                            const isApprox = ev.venue?.isApproximateLocation;
                            const coords = ev.parking?.coordinates || (!isApprox ? ev.venue.coordinates : undefined);
                            const hasValidCoords = coords && (coords.lat !== 0 || coords.lng !== 0);
                            const destination =
                              hasValidCoords
                                ? `${coords.lat},${coords.lng}`
                                : encodeURIComponent(ev.venue?.name || 'Kenttä');
                            window.open(
                              `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
                              '_blank',
                              'noopener,noreferrer'
                            );
                          }
                        }}
                        className="min-h-[44px] px-3.5 rounded-xl bg-pitch text-text-inverse font-bold text-xs flex items-center gap-1.5 hover:brightness-110 cursor-pointer transition-all shadow-xs shrink-0 focus-visible:ring-2 focus-visible:ring-pitch"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        <span>Reitti</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
