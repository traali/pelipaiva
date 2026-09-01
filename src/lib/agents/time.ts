import { getFinnishTimezoneOffset } from '../stats/statsEngine';

/** Helsinki-local YYYY-MM-DD (sv-SE locale yields ISO date). */
export function helsinkiDateISO(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Helsinki',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

export function formatFiTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Helsinki'
  });
}

/**
 * EET/EEST-correct UTC offset ("+02:00"/"+03:00") for a Helsinki-local date
 * (M-51/F-12: replaces the hardcoded "+03:00" that breaks October fall-back).
 */
export function helsinkiOffsetForDateISO(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  if (!y || !m || !d) return '+03:00';
  // Probe midday UTC of that local date — safely inside either offset regime.
  return getFinnishTimezoneOffset(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
}

function helsinkiWall(isoDate: string, time = '12:00:00'): Date {
  const offset = getFinnishTimezoneOffset(new Date(`${isoDate}T12:00:00Z`));
  const hhmm = time.length === 5 ? `${time}:00` : time;
  return new Date(`${isoDate}T${hhmm}${offset}`);
}

export function formatFiWeekday(isoDate: string): string {
  return helsinkiWall(isoDate).toLocaleDateString('fi-FI', {
    weekday: 'short',
    timeZone: 'Europe/Helsinki'
  });
}

export function addHelsinkiDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const utc = Date.UTC(y ?? new Date().getUTCFullYear(), (m || 1) - 1, (d || 1) + days);
  return new Date(utc).toISOString().slice(0, 10);
}

/** Monday 00:00 → Sunday 23:59 of current week (Helsinki). */
export function sportsWeekRange(now: Date = new Date()): { start: Date; end: Date; label: string } {
  const iso = helsinkiDateISO(now);
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  const wd =
    weekdayMap[
      new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Helsinki', weekday: 'short' }).format(now)
    ] ?? 1;
  const mondayOffset = wd === 0 ? -6 : 1 - wd;
  const monday = addHelsinkiDays(iso, mondayOffset);
  const sunday = addHelsinkiDays(monday, 6);
  const start = helsinkiWall(monday, '00:00:00');
  const end = helsinkiWall(sunday, '23:59:59');
  const monLabel = helsinkiWall(monday).toLocaleDateString('fi-FI', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'Europe/Helsinki'
  });
  const sunLabel = helsinkiWall(sunday).toLocaleDateString('fi-FI', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    timeZone: 'Europe/Helsinki'
  });
  return { start, end, label: `${monLabel} – ${sunLabel}` };
}




export function eventsInRange<T extends { startTime: string }>(
  events: T[],
  start: Date,
  end: Date
): T[] {
  const a = start.getTime();
  const b = end.getTime();
  return events.filter((e) => {
    const t = new Date(e.startTime).getTime();
    return t >= a && t <= b;
  });
}

export function overlapMinutes(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const s = Math.max(new Date(aStart).getTime(), new Date(bStart).getTime());
  const e = Math.min(new Date(aEnd).getTime(), new Date(bEnd).getTime());
  return Math.max(0, Math.round((e - s) / 60000));
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Urban Helsinki driving estimate: ~2.1 min/km + 8 min parkki.
 *  Returns 0 when either venue has no geocoded coordinates (lat=0, lng=0),
 *  which is the fallback sentinel from resolveSportsVenue for unknown venues.
 *  Callers must treat 0 as "unknown", not "same location". */
export function estimateDriveMinutes(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  // (0, 0) is the null-island fallback from resolveSportsVenue when geocoding fails.
  // Computing haversine against the equator gives ~7 000 km → ~15 000 min. Guard it.
  if ((lat1 === 0 && lng1 === 0) || (lat2 === 0 && lng2 === 0)) return 0;
  const km = haversineKm(lat1, lng1, lat2, lng2);
  if (km < 0.25) return 4;
  return Math.round(km * 2.1 + 8);
}
