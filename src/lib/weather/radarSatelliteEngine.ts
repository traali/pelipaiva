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

/**
 * Generates an optimized WMS / Tile URL for FMI Open Data and EUMETSAT Open Viewers
 */
export function buildImageryUrl(
  layer: RadarSatelliteLayer,
  coords: Coordinates,
  timestamp: Date = new Date()
): string {
  const delta = 0.45; // Approximately 50-70 km viewport radius around pitch
  const minLat = coords.lat - delta;
  const maxLat = coords.lat + delta;
  const minLng = coords.lng - (delta * 1.8);
  const maxLng = coords.lng + (delta * 1.8);

  const roundedTime = new Date(timestamp);
  // Round to nearest 5 minutes
  const mins = roundedTime.getMinutes();
  roundedTime.setMinutes(Math.floor(mins / 5) * 5, 0, 0);

  const isoTime = roundedTime.toISOString();

  switch (layer) {
    case 'fmi_rain_radar':
      return `https://openwms.fmi.fi/geoserver/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=Radar:suomi_rr_euref&STYLES=&CRS=CRS:84&BBOX=${minLng},${minLat},${maxLng},${maxLat}&WIDTH=768&HEIGHT=512&FORMAT=image/png&TRANSPARENT=TRUE&TIME=${isoTime}`;

    case 'eumetsat_fog':
      return `https://eumetview.eumetsat.int/geoserv/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=msg_fes:rgb_fog&STYLES=&CRS=CRS:84&BBOX=${minLng},${minLat},${maxLng},${maxLat}&WIDTH=768&HEIGHT=512&FORMAT=image/jpeg&TIME=${isoTime}`;

    case 'eumetsat_natural':
      return `https://eumetview.eumetsat.int/geoserv/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=msg_fes:rgb_natural&STYLES=&CRS=CRS:84&BBOX=${minLng},${minLat},${maxLng},${maxLat}&WIDTH=768&HEIGHT=512&FORMAT=image/jpeg&TIME=${isoTime}`;

    case 'fmi_lightning':
      return `https://openwms.fmi.fi/geoserver/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=Observation:lightning&STYLES=&CRS=CRS:84&BBOX=${minLng},${minLat},${maxLng},${maxLat}&WIDTH=768&HEIGHT=512&FORMAT=image/png&TRANSPARENT=TRUE&TIME=${isoTime}`;
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
    const mins = Math.floor(d.getMinutes() / 5) * 5;
    d.setMinutes(mins, 0, 0);
    frames.push({
      label: i === 0 ? 'Nyt' : `-${i * 5} min`,
      date: d
    });
  }
  return frames;
}
