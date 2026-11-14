import { PARKKIS_BASE_URL } from '../../types/contracts';

/**
 * Nearby parking counted from Parkkis's own published snapshot
 * (parkkis.pages.dev/data/tiles/*.json + manifest.json, CORS *). Pelipäivä
 * invents nothing: no tiles, no count. The snapshot date always travels with
 * the count so stale data is never shown as current.
 */

/** Must match Parkkis web/src/lib/venueTiles.ts. */
const TILE_LAT = 0.01;
const TILE_LON = 0.02;
const TILE_REGION = { minLon: 24.45, maxLon: 25.3, minLat: 60.08, maxLat: 60.42 };
/** Same radius and rules as Parkkis's own "Sallittu pysäköinti" line (web/src/lib/allowed.ts). */
export const NEARBY_RADIUS_M = 300;
/** Older than this and the UI calls the data old. */
export const PARKKIS_STALE_AFTER_DAYS = 3;

export interface ParkkisNearby {
  /** Helsinki street-parking areas where parking is allowed and paid. */
  paid: number;
  /** Helsinki street-parking areas where parking is allowed and free. */
  free: number;
  /** Sum of the city's `paikat_ala` where given. */
  spaces: number;
  /** Espoo public parking areas (Yleinen pysäköintialue). */
  espoo: number;
  radiusM: number;
  /** ISO time of Parkkis's data snapshot (manifest generated_at). */
  dataDate: string | null;
  isStale: boolean;
}

export function inParkkisTileRegion(lat: number, lng: number): boolean {
  const r = TILE_REGION;
  return lng >= r.minLon && lng <= r.maxLon && lat >= r.minLat && lat <= r.maxLat;
}

export function tileKeysAround(lat: number, lng: number, radiusM = NEARBY_RADIUS_M): string[] {
  const dLat = radiusM / 111320;
  const dLon = radiusM / (111320 * Math.cos((lat * Math.PI) / 180));
  const keys: string[] = [];
  for (let ix = Math.floor((lng - dLon) / TILE_LON); ix <= Math.floor((lng + dLon) / TILE_LON); ix++)
    for (let iy = Math.floor((lat - dLat) / TILE_LAT); iy <= Math.floor((lat + dLat) / TILE_LAT); iy++)
      keys.push(`${ix}_${iy}`);
  return keys;
}

type Pos = number[];
type Geometry =
  | { type: 'Point'; coordinates: Pos }
  | { type: 'MultiPoint' | 'LineString'; coordinates: Pos[] }
  | { type: 'MultiLineString' | 'Polygon'; coordinates: Pos[][] }
  | { type: 'MultiPolygon'; coordinates: Pos[][][] }
  | { type: 'GeometryCollection'; geometries: Geometry[] };
export interface ParkkisFeature { geometry?: Geometry | null; properties?: Record<string, unknown> | null }
type XY = [number, number];

/** Port of Parkkis distanceTo(): local metres around the venue, 0 inside a polygon. */
function parts(g: Geometry, lat: number, lng: number): { lines: XY[][]; polygons: XY[][][] } {
  const kx = 111320 * Math.cos((lat * Math.PI) / 180);
  const ky = 110540;
  const xy = (c: Pos): XY => [((c[0] ?? lng) - lng) * kx, ((c[1] ?? lat) - lat) * ky];
  const ring = (r: Pos[]) => r.map(xy);
  switch (g.type) {
    case 'Point':
      return { lines: [[xy(g.coordinates)]], polygons: [] };
    case 'MultiPoint':
      return { lines: g.coordinates.map((c) => [xy(c)]), polygons: [] };
    case 'LineString':
      return { lines: [ring(g.coordinates)], polygons: [] };
    case 'MultiLineString':
      return { lines: g.coordinates.map(ring), polygons: [] };
    case 'Polygon':
      return { lines: g.coordinates.map(ring), polygons: [g.coordinates.map(ring)] };
    case 'MultiPolygon':
      return { lines: g.coordinates.flatMap((p) => p.map(ring)), polygons: g.coordinates.map((p) => p.map(ring)) };
    case 'GeometryCollection': {
      const all = g.geometries.map((x) => parts(x, lat, lng));
      return { lines: all.flatMap((a) => a.lines), polygons: all.flatMap((a) => a.polygons) };
    }
    default:
      return { lines: [], polygons: [] };
  }
}

function segDist(a: XY, b: XY): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, -(a[0] * dx + a[1] * dy) / len)) : 0;
  return Math.hypot(a[0] + t * dx, a[1] + t * dy);
}

function inRing(r: XY[]): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i]!;
    const [xj, yj] = r[j]!;
    if (yi > 0 !== yj > 0 && 0 < ((xj - xi) * (0 - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function distanceTo(g: Geometry | null | undefined, lat: number, lng: number): number {
  if (!g) return Number.POSITIVE_INFINITY;
  const { lines, polygons } = parts(g, lat, lng);
  for (const p of polygons) if (p[0] && inRing(p[0]) && !p.slice(1).some(inRing)) return 0;
  let best = Number.POSITIVE_INFINITY;
  for (const l of lines) {
    if (l.length === 1) best = Math.min(best, Math.hypot(l[0]![0], l[0]![1]));
    for (let i = 1; i < l.length; i++) best = Math.min(best, segDist(l[i - 1]!, l[i]!));
  }
  return best;
}

export function isStaleDate(iso: string | null, now = new Date()): boolean {
  if (!iso) return true;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return true;
  return now.getTime() - t > PARKKIS_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

/** Parkkis allowedNear(): allowed (paid/free) Helsinki areas + Espoo public areas, each feature once. */
export function countNearby(
  tiles: Array<{ slots?: ParkkisFeature[]; espoo?: ParkkisFeature[] } | null>,
  lat: number,
  lng: number,
  radiusM = NEARBY_RADIUS_M
): { paid: number; free: number; spaces: number; espoo: number } {
  const out = { paid: 0, free: 0, spaces: 0, espoo: 0 };
  const seen = new Set<string>();
  const key = (layer: string, f: ParkkisFeature) =>
    `${layer}:${String(f.properties?.id ?? f.properties?.espoo_id ?? JSON.stringify(f.geometry).slice(0, 120))}`;
  for (const t of tiles) {
    if (!t) continue;
    for (const f of t.slots || []) {
      const cat = f.properties?.category;
      if (cat !== 'paid' && cat !== 'free') continue;
      const k = key('slots', f);
      if (seen.has(k) || distanceTo(f.geometry, lat, lng) > radiusM) continue;
      seen.add(k);
      if (cat === 'paid') out.paid++;
      else out.free++;
      const n = Number(f.properties?.paikat_ala);
      if (Number.isFinite(n) && n > 0) out.spaces += n;
    }
    for (const f of t.espoo || []) {
      if (f.properties?.class !== 'yleinenpysakointialue') continue;
      const k = key('espoo', f);
      if (seen.has(k) || distanceTo(f.geometry, lat, lng) > radiusM) continue;
      seen.add(k);
      out.espoo++;
    }
  }
  return out;
}

const cache = new Map<string, Promise<ParkkisNearby | null>>();
let manifestPromise: Promise<string | null> | null = null;

async function fetchJson(url: string, fetcher: typeof fetch): Promise<unknown | null> {
  const r = await fetcher(url, { signal: AbortSignal.timeout(6000) });
  // A missing tile is answered with the SPA's HTML: that means "no data", not an error.
  if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) return null;
  return r.json();
}

/**
 * Parking near a venue from Parkkis's snapshot, or null when Parkkis has no
 * tiles there (outside the capital region) or the fetch fails.
 */
export function loadParkkisNearby(
  lat: number,
  lng: number,
  fetcher: typeof fetch = fetch,
  now = new Date()
): Promise<ParkkisNearby | null> {
  if (!inParkkisTileRegion(lat, lng)) return Promise.resolve(null);
  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = (async () => {
    try {
      manifestPromise ??= fetchJson(`${PARKKIS_BASE_URL}/data/manifest.json`, fetcher)
        .then((m) => (m && typeof (m as { generated_at?: unknown }).generated_at === 'string' ? (m as { generated_at: string }).generated_at : null))
        .catch(() => null);
      const [dataDate, ...tiles] = await Promise.all([
        manifestPromise,
        ...tileKeysAround(lat, lng).map((k) =>
          fetchJson(`${PARKKIS_BASE_URL}/data/tiles/${k}.json`, fetcher).catch(() => null)
        )
      ]);
      const got = tiles as Array<{ slots?: ParkkisFeature[]; espoo?: ParkkisFeature[] } | null>;
      if (!got.some(Boolean)) return null;
      const counts = countNearby(got, lat, lng);
      const date = (dataDate as string | null) ?? null;
      if (!date) manifestPromise = null; // retry the date next time
      return { ...counts, radiusM: NEARBY_RADIUS_M, dataDate: date, isStale: isStaleDate(date, now) };
    } catch {
      return null;
    }
  })();
  cache.set(key, p);
  p.then((v) => { if (!v) cache.delete(key); });
  return p;
}

/** Test hook. */
export function __resetParkkisNearbyCache(): void {
  cache.clear();
  manifestPromise = null;
}
