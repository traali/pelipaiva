/**
 * Live = kicked off, slot not ended, no final score. One rule for every view
 * (Päivä, Tiivis, Kortit, Kalenteri) so a game in progress never shows an
 * "alkaa" countdown in one view and nothing in another.
 */
export function isEventLive(
  ev: { startTime: string; endTime: string; score?: unknown },
  now: Date = new Date()
): boolean {
  if (ev.score !== undefined && ev.score !== null && ev.score !== '') return false;
  const start = new Date(ev.startTime).getTime();
  const end = new Date(ev.endTime).getTime();
  const t = now.getTime();
  return Number.isFinite(start) && Number.isFinite(end) && start <= t && t < end;
}

/** Header label for a calendar row: "Käynnissä · alkoi klo" while live, else the view's own "… alkaa klo". */
export function startLabel(
  ev: { startTime: string; endTime: string; score?: unknown; isTraining?: boolean; sport?: string },
  now: Date = new Date()
): string {
  if (isEventLive(ev, now)) return '● Käynnissä · alkoi';
  if (ev.isTraining) return 'Treeni alkaa';
  if (ev.sport === 'school') return 'Koulu';
  if (ev.sport === 'other') return 'Alkaa';
  return 'Ottelu alkaa';
}
