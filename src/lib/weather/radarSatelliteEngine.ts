import { Coordinates } from '../../types/matchday';

export type RadarSatelliteLayer =
  | 'fmi_rain_radar'
  | 'eumetsat_fog'
  | 'eumetsat_natural'
  | 'fmi_lightning';

export interface WeatherImageryLayerInfo {
  id: RadarSatelliteLayer;
  title: string;
  provider: 'FMI (Ilmatieteen laitos)' | 'EUMETSAT (Euroopan sääsatelliittijärjestö)';
  refreshIntervalMinutes: number;
  description: string;
  legendText: string;
}

export const WEATHER_IMAGERY_LAYERS: Record<RadarSatelliteLayer, WeatherImageryLayerInfo> = {
  fmi_rain_radar: {
    id: 'fmi_rain_radar',
    title: '🌧️ FMI Sadetutka (5 min)',
    provider: 'FMI (Ilmatieteen laitos)',
    refreshIntervalMinutes: 5,
    description: 'Reaaliaikainen tutkakuva Suomen 11 säätutka-asemalta. Erottaa tihkusateen, rankkasateen ja raekuurot.',
    legendText: '0.1 mm/h (vihreä) ➔ >20 mm/h (punainen/violetti rankkasade)'
  },
  eumetsat_fog: {
    id: 'eumetsat_fog',
    title: '🛰️ EUMETSAT Sumu & Matala pilvi',
    provider: 'EUMETSAT (Euroopan sääsatelliittijärjestö)',
    refreshIntervalMinutes: 15,
    description: 'Meteosat-geostationäärisatelliitin RGB-yhdistelmä. Tunnistaa aamusumun, matalan sumupilven ja kenttänäkyvyyden.',
    legendText: 'Keltainen/Oranssi = Sumu/Matala pilvi • Sininen/Syaani = Korkeat pilvet'
  },
  eumetsat_natural: {
    id: 'eumetsat_natural',
    title: '☁️ EUMETSAT Luonnollinen väri',
    provider: 'EUMETSAT (Euroopan sääsatelliittijärjestö)',
    refreshIntervalMinutes: 15,
    description: 'Luonnollisen värin satelliittikuva. Erottaa maanpinnan, merijään, pilvimassat ja kehittyvät ukkossolut.',
    legendText: 'Turkoosi = Jää/Lumi • Valkoinen/Syaani = Pilvet • Vihreä/Ruskea = Maasto'
  },
  fmi_lightning: {
    id: 'fmi_lightning',
    title: '⚡ FMI Salamatutka',
    provider: 'FMI (Ilmatieteen laitos)',
    refreshIntervalMinutes: 5,
    description: 'Pohjoismainen NORDLIS-salamapaikannusverkko. Näyttää maasalamoiden iskut ja purkausiän.',
    legendText: 'Punainen = <5 min • Oranssi = <15 min • Keltainen = <30 min'
  }
};

export type RadarBbox = {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
};

/** Tight field view — 50 km hid Pyrkkä inside all of Helsinki. */
export const RADAR_VIEW_KM = 18;
export const RADAR_MAP_WIDTH = 768;
export const RADAR_MAP_HEIGHT = 576;

export function isValidRadarCoords(coords: Coordinates | null | undefined): coords is Coordinates {
  if (!coords) return false;
  const { lat, lng } = coords;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  return lat >= 59.5 && lat <= 70.2 && lng >= 19.0 && lng <= 31.6;
}

export function calculateRadarBbox(coords: Coordinates, radiusKm: number = RADAR_VIEW_KM): RadarBbox {
  const deltaLat = radiusKm / 111.32;
  const cosLat = Math.cos((coords.lat * Math.PI) / 180);
  const deltaLng = radiusKm / (111.32 * Math.max(0.2, cosLat));
  return {
    minLng: Math.round((coords.lng - deltaLng) * 10000) / 10000,
    minLat: Math.round((coords.lat - deltaLat) * 10000) / 10000,
    maxLng: Math.round((coords.lng + deltaLng) * 10000) / 10000,
    maxLat: Math.round((coords.lat + deltaLat) * 10000) / 10000,
  };
}

export function bboxToWmsString(bbox: RadarBbox): string {
  return `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`;
}

/** OSM coastline using the SAME bbox as FMI radar so the pin sits on the field. */
export function buildBasemapUrl(bbox: RadarBbox, width = RADAR_MAP_WIDTH, height = RADAR_MAP_HEIGHT): string {
  const b = bboxToWmsString(bbox);
  return `https://ows.terrestris.de/osm/service?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=OSM-WMS&STYLES=&SRS=EPSG:4326&BBOX=${b}&WIDTH=${width}&HEIGHT=${height}&FORMAT=image/png`;
}

/**
 * Generates an optimized WMS / Tile URL for FMI Open Data and EUMETSAT Open Viewers
 */
export function buildImageryUrl(
  layer: RadarSatelliteLayer,
  coords: Coordinates,
  timestamp: Date = new Date()
): string {
  const bbox = calculateRadarBbox(coords);
  const bboxStr = bboxToWmsString(bbox);

  const roundedTime = new Date(timestamp);
  const mins = roundedTime.getUTCMinutes();
  roundedTime.setUTCMinutes(Math.floor(mins / 5) * 5, 0, 0);

  const isoTime = roundedTime.toISOString();
  const size = `WIDTH=${RADAR_MAP_WIDTH}&HEIGHT=${RADAR_MAP_HEIGHT}`;

  switch (layer) {
    case 'fmi_rain_radar':
      return `https://openwms.fmi.fi/geoserver/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=Radar:suomi_dbz_eureffin&STYLES=&CRS=CRS:84&BBOX=${bboxStr}&${size}&FORMAT=image/png&TRANSPARENT=TRUE&TIME=${encodeURIComponent(isoTime)}`;

    case 'eumetsat_fog':
      return `https://eumetview.eumetsat.int/geoserv/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=msg_fes:rgb_fog&STYLES=&CRS=CRS:84&BBOX=${bboxStr}&${size}&FORMAT=image/jpeg&TIME=${encodeURIComponent(isoTime)}`;

    case 'eumetsat_natural':
      return `https://eumetview.eumetsat.int/geoserv/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=msg_fes:rgb_natural&STYLES=&CRS=CRS:84&BBOX=${bboxStr}&${size}&FORMAT=image/jpeg&TIME=${encodeURIComponent(isoTime)}`;

    case 'fmi_lightning':
      return `https://openwms.fmi.fi/geoserver/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=Observation:lightning&STYLES=&CRS=CRS:84&BBOX=${bboxStr}&${size}&FORMAT=image/png&TRANSPARENT=TRUE&TIME=${encodeURIComponent(isoTime)}`;
  }
}

/**
 * Returns past 6 time loop frames (e.g. -25m, -20m, -15m, -10m, -5m, Now)
 */
export function getImageryLoopTimestamps(): { label: string; date: Date }[] {
  const now = new Date();
  const frames = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 5 * 60 * 1000);
    const mins = Math.floor(d.getUTCMinutes() / 5) * 5;
    d.setUTCMinutes(mins, 0, 0);
    frames.push({
      label: i === 0 ? 'Nyt' : `-${i * 5} min`,
      date: d
    });
  }
  return frames;
}
