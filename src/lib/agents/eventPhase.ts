/**
 * Live = kicked off, slot not ended, no final score. One rule for every view
 * (Päivä, Tiivis, Kortit, Kalenteri) so a game in progress never shows an
 * "alkaa" countdown in one view and nothing in another.
 */
export function isEventLive(
  ev: { startTime: string; endTime: string; score?: unknown; liveScore?: string },
  now: Date = new Date()
): boolean {
  if (ev.score !== undefined && ev.score !== null && ev.score !== '') return false;
  const start = new Date(ev.startTime).getTime();
  const end = new Date(ev.endTime).getTime();
  const t = now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || t >= end) return false;
  // A TASO running score means the whistle blew, even a few minutes early.
  return start <= t || Boolean(ev.liveScore);
}

/** "Käynnissä 1–0", "Käynnissä 0–1 · tauko", or plain "Käynnissä" when TASO has no running score yet. */
export function liveText(ev: { liveScore?: string; liveBreak?: boolean }): string {
  if (!ev.liveScore) return 'Käynnissä';
  return `Käynnissä ${ev.liveScore}${ev.liveBreak ? ' · tauko' : ''}`;
}

/** Header label for a calendar row: "Käynnissä · alkoi klo" while live, else the view's own "… alkaa klo". */
export function startLabel(
  ev: { startTime: string; endTime: string; score?: unknown; liveScore?: string; liveBreak?: boolean; isTraining?: boolean; sport?: string },
  now: Date = new Date()
): string {
  if (isEventLive(ev, now)) return `● ${liveText(ev)} · alkoi`;
  if (ev.isTraining) return 'Treeni alkaa';
  if (ev.sport === 'school') return 'Koulu';
  if (ev.sport === 'other') return 'Alkaa';
  return 'Ottelu alkaa';
}
