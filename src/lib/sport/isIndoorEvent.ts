const INDOOR_SPORTS = new Set([
  'floorball',
  'basketball',
  'volleyball',
  'futsal',
  'ice_hockey',
  'handball',
  'ringette'
]);

/** Salibandy/koris/lentis and *halli* names are indoor — no tekonurmi, no sadetutka. */
export function isIndoorEvent(event: {
  sport?: string;
  venue?: { isIndoor?: boolean; name?: string };
}): boolean {
  if (event.venue?.isIndoor) return true;
  if (event.sport && INDOOR_SPORTS.has(event.sport)) return true;
  return /halli|areena|sali|otteluhalli|kisahalli/i.test(event.venue?.name || '');
}
