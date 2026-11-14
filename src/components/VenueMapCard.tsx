import React, { useEffect, useMemo, useState } from 'react';
import { MapPin, Navigation, Search } from 'lucide-react';
import type { VenueInfo } from '../types/matchday';
import {
  mappableCoordinates,
  venueDirectionsUrl,
  venueLocationLabel,
  venueLocationStatus,
  venueMapUrl,
  venueSearchQuery
} from '../lib/geo/venueLocation';
import { parkkisVenueUrl } from '../lib/parking/parkkisLink';
import { isStaleDate, loadParkkisNearby, type ParkkisNearby } from '../lib/parking/parkkisNearby';

const TILE = 256;

/** Web-Mercator world pixel of a point at zoom z (OSM slippy-map tiles). */
export function worldPixel(lat: number, lng: number, z: number): { x: number; y: number } {
  const scale = TILE * 2 ** z;
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale
  };
}

function fiDate(iso: string | null): string {
  if (!iso) return 'päiväys tuntematon';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return 'päiväys tuntematon';
  return d.toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric', timeZone: 'Europe/Helsinki' });
}

/** Static OpenStreetMap tiles around the venue: no API key, no map library. */
const StaticVenueMap: React.FC<{ lat: number; lng: number; approximate: boolean; height: number }> = ({
  lat,
  lng,
  approximate,
  height
}) => {
  const z = approximate ? 14 : 16;
  const { x, y } = worldPixel(lat, lng, z);
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  const n = 2 ** z;
  const tiles: Array<{ key: string; src: string; left: number; top: number }> = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++) {
      const ix = tx + dx;
      const iy = ty + dy;
      if (iy < 0 || iy >= n) continue;
      tiles.push({
        key: `${ix}_${iy}`,
        src: `https://tile.openstreetmap.org/${z}/${((ix % n) + n) % n}/${iy}.png`,
        left: ix * TILE - x,
        top: iy * TILE - y
      });
    }
  return (
    <div className="relative w-full overflow-hidden bg-surface-elevated" style={{ height }} aria-hidden="true">
      {tiles.map((t) => (
        <img
          key={t.key}
          src={t.src}
          alt=""
          width={TILE}
          height={TILE}
          loading="lazy"
          decoding="async"
          draggable={false}
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute max-w-none select-none"
          style={{ left: `calc(50% + ${t.left}px)`, top: `calc(50% + ${t.top}px)`, width: TILE, height: TILE }}
          onError={(e) => {
            (e.target as HTMLImageElement).style.visibility = 'hidden';
          }}
        />
      ))}
      {approximate ? (
        <span
          data-testid="venue-map-approx-area"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-whistle bg-whistle/20"
          style={{ width: 110, height: 110 }}
        />
      ) : (
        <MapPin
          data-testid="venue-map-pin"
          className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-full fill-stoppage text-white drop-shadow"
        />
      )}
      <span className="absolute bottom-0 right-0 bg-white/80 px-1 text-[9px] text-black">© OpenStreetMap</span>
    </div>
  );
};

function useParkkisNearby(lat: number | undefined, lng: number | undefined): ParkkisNearby | null {
  const [state, setState] = useState<{ key: string; value: ParkkisNearby | null } | null>(null);
  const key = lat !== undefined && lng !== undefined ? `${lat},${lng}` : '';
  useEffect(() => {
    if (!key || lat === undefined || lng === undefined) return;
    let alive = true;
    loadParkkisNearby(lat, lng).then((value) => {
      if (alive) setState({ key, value });
    });
    return () => {
      alive = false;
    };
  }, [key, lat, lng]);
  if (!state || state.key !== key || !state.value) return null;
  // Staleness is judged against now, not when the snapshot was first read.
  return { ...state.value, isStale: isStaleDate(state.value.dataDate) };
}

/** Same wording as Parkkis's own "Sallittu pysäköinti" line, plus the data date. */
export function parkkisNearbyText(n: ParkkisNearby, approximate: boolean): string {
  const head = `Sallittu pysäköinti ${n.radiusM} m säteellä${approximate ? ' arvioidusta sijainnista' : ''}:`;
  const parts: string[] = [];
  if (n.paid) parts.push(`${n.paid} maksullista`);
  if (n.free) parts.push(`${n.free} maksutonta`);
  const hel = parts.length
    ? `${parts.join(' ja ')} katupysäköintialuetta${n.spaces ? ` (${n.spaces} paikkaa)` : ''} Helsingin kaupungin aineistossa`
    : '';
  const esp = n.espoo
    ? `${n.espoo} ${n.espoo === 1 ? 'yleinen pysäköintialue' : 'yleistä pysäköintialuetta'} Espoon kaupungin aineistossa`
    : '';
  const body = [hel, esp].filter(Boolean).join(', ');
  const facts = body ? `${head} ${body}.` : `${head} ei tietoa. Tarkista kyltit paikan päällä.`;
  return `${facts} Parkkis-tieto ${fiDate(n.dataDate)}${n.isStale ? ' – voi olla vanhentunut.' : ''}`;
}

/**
 * Where the game is and where to park: a small map that opens the phone's map
 * app, honest location label, directions, and Parkkis (with nearby parking
 * counted from Parkkis's own published data when it has any there).
 */
export const VenueMapCard: React.FC<{
  venue: VenueInfo | undefined;
  mapHeight?: number;
  className?: string;
}> = ({ venue, mapHeight = 132, className }) => {
  const status = venueLocationStatus(venue);
  const coords = mappableCoordinates(venue);
  const nearby = useParkkisNearby(coords?.lat, coords?.lng);
  const mapUrl = useMemo(() => venueMapUrl(venue), [venue]);
  const dirUrl = useMemo(() => venueDirectionsUrl(venue), [venue]);
  const parkkisUrl = parkkisVenueUrl(venue);
  if (!venue || status === 'none') return null;
  const approximate = status === 'approximate';
  const btn =
    'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-border-subtle bg-surface-elevated px-3 text-xs font-bold text-text-primary hover:border-pitch transition-all focus-visible:ring-2 focus-visible:ring-pitch';

  return (
    <section
      data-testid="venue-map-card"
      data-location-status={status}
      aria-label={`Kenttä ja pysäköinti: ${venue.name}`}
      className={className || 'overflow-hidden rounded-2xl border border-border-subtle bg-surface/60'}
    >
      {coords && mapUrl ? (
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="venue-map-link"
          aria-label={`${approximate ? 'Arvioitu sijainti' : 'Sijainti'} kartalla: ${venueSearchQuery(venue)}. Avaa kartta.`}
          className="block focus-visible:ring-2 focus-visible:ring-pitch"
        >
          <StaticVenueMap lat={coords.lat} lng={coords.lng} approximate={approximate} height={mapHeight} />
        </a>
      ) : null}

      <div className="flex flex-col gap-2 p-2.5">
        <p
          data-testid="venue-location-label"
          className={`text-xs font-semibold leading-snug ${approximate ? 'text-whistle' : status === 'search' ? 'text-text-secondary' : 'text-text-primary'}`}
        >
          {venueLocationLabel(venue)}
        </p>

        <div className="flex flex-wrap gap-2">
          {status === 'search' && mapUrl && (
            <a href={mapUrl} target="_blank" rel="noopener noreferrer" data-testid="venue-map-search" className={btn}>
              <Search className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Hae kartalta</span>
            </a>
          )}
          {dirUrl && (
            <a
              href={dirUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="venue-directions"
              aria-label={`Reittiohjeet: ${venueSearchQuery(venue)}`}
              className={btn}
            >
              <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Reitti</span>
            </a>
          )}
          {parkkisUrl ? (
            <a
              href={parkkisUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="parkkis-link"
              aria-label={`Pysäköinti: avaa Parkkis ${approximate ? 'arvioidussa sijainnissa' : 'kohteessa'} ${venue.name}`}
              className={btn}
            >
              <span aria-hidden="true">🅿️</span>
              <span>Pysäköinti</span>
              <span className="text-[10px] font-semibold text-text-muted">Parkkis</span>
            </a>
          ) : null}
        </div>

        {parkkisUrl && nearby && (
          <p data-testid="parkkis-nearby" className={`text-[11px] leading-snug ${nearby.isStale ? 'text-whistle' : 'text-text-muted'}`}>
            {parkkisNearbyText(nearby, approximate)}
          </p>
        )}
        {status === 'search' && (
          <p className="text-[11px] leading-snug text-text-muted">
            Pysäköinti: Parkkis tarvitsee kentän tarkan sijainnin, eikä sitä löytynyt tulospalvelusta, LIPAS-palvelusta eikä kartalta.
          </p>
        )}
      </div>
    </section>
  );
};

/** Compact row icons for list views: map (or map search) and Parkkis. */
export const VenueQuickLinks: React.FC<{ venue: VenueInfo | undefined }> = ({ venue }) => {
  const status = venueLocationStatus(venue);
  const mapUrl = venueMapUrl(venue);
  const parkkisUrl = parkkisVenueUrl(venue);
  if (!venue || status === 'none' || !mapUrl) return null;
  const cls =
    'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border-subtle bg-surface-elevated text-sm hover:border-pitch focus-visible:ring-2 focus-visible:ring-pitch';
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5" data-testid="venue-quick-links">
      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        data-testid="venue-quick-map"
        title={venueLocationLabel(venue)}
        aria-label={
          status === 'search'
            ? `Hae kartalta: ${venueSearchQuery(venue)}`
            : `${status === 'approximate' ? 'Arvioitu sijainti' : 'Sijainti'} kartalla: ${venue.name}`
        }
        className={cls}
      >
        <span aria-hidden="true">{status === 'search' ? '🔍' : '🗺️'}</span>
      </a>
      {parkkisUrl && (
        <a
          href={parkkisUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          data-testid="venue-quick-parkkis"
          aria-label={`Pysäköinti Parkkiksessa: ${venue.name}${status === 'approximate' ? ' (sijainti arvioitu)' : ''}`}
          className={cls}
        >
          <span aria-hidden="true">🅿️</span>
        </a>
      )}
    </span>
  );
};
