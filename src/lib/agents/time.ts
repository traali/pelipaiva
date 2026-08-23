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
  return new Date(iso).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
}

export function formatFiWeekday(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00+03:00`);
  return d.toLocaleDateString('fi-FI', { weekday: 'short' });
}

export function addHelsinkiDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00+03:00`);
  d.setDate(d.getDate() + days);
  return helsinkiDateISO(d);
}

/** Friday 16:00 → Sunday night of the nearest sports weekend. */
export function sportsWeekendRange(now: Date = new Date()): { start: Date; end: Date; label: string } {
  const iso = helsinkiDateISO(now);
  const dow = new Date(`${iso}T12:00:00+03:00`).getDay(); // 0 Sun … 6 Sat
  let fridayOffset = 5 - dow;
  if (dow === 0) fridayOffset = -2;
  if (dow === 6) fridayOffset = -1;
  const friday = addHelsinkiDays(iso, fridayOffset);
  const sunday = addHelsinkiDays(friday, 2);
  const start = new Date(`${friday}T16:00:00+03:00`);
  const end = new Date(`${sunday}T23:59:59+03:00`);
  const friLabel = new Date(`${friday}T12:00:00+03:00`).toLocaleDateString('fi-FI', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric'
  });
  const sunLabel = new Date(`${sunday}T12:00:00+03:00`).toLocaleDateString('fi-FI', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric'
  });
  return { start, end, label: `${friLabel} – ${sunLabel}` };
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

/** Urban Helsinki driving estimate: ~2.1 min/km + 8 min parkki. */
export function estimateDriveMinutes(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const km = haversineKm(lat1, lng1, lat2, lng2);
  if (km < 0.25) return 4;
  return Math.round(km * 2.1 + 8);
}
