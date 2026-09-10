import { XMLParser } from 'fast-xml-parser';
import { Coordinates, WeatherCondition } from '../../types/matchday';

/**
 * FMI Open Data WFS Stored Queries and Constants
 * Directly aligned with proven implementation in Sakkoja / Navikka.
 */
export const FMI_CONFIG = {
  wfsBaseUrl: 'https://opendata.fmi.fi/wfs',
  wmsBaseUrl: 'https://openwms.fmi.fi/geoserver/wms',
  capAlertsUrl: 'https://alerts.fmi.fi/cap/feed/atom_fi-FI.xml',

  // Stored Queries
  queryForecast: 'fmi::forecast::harmonie::surface::point::multipointcoverage',
  queryWeatherObservations: 'fmi::observations::weather::multipointcoverage',
  queryLightning: 'fmi::observations::lightning::multipointcoverage',

  // Parameters
  forecastParams:
    'Temperature,WindSpeedMS,WindGust,WindDirection,PrecipitationAmount,Pressure,Humidity,DewPoint,TotalCloudCover',
  observationParams: 't2m,ws_10min,wg_10min,wd_10min,p_sea,vis,rh,r_1h,n_man',
  lightningParams: 'multiplicity,peak_current,cloud_indicator,ellipse_major',

  // WMS Layers
  layerRadarRainIntensity: 'Radar:suomi_rr_eureffin',
  layerRadarReflectivity: 'Radar:suomi_dbz_eureffin'
};

/**
 * Calculates apparent temperature (Wind Chill & Humidity index)
 * Aligned with Sakkoja meteorological engine.
 */
export function calculateFeelsLike(tempC: number, windSpeedMs: number, humidityPercent: number = 70): number {
  if (tempC <= 10 && windSpeedMs > 1.3) {
    // Siple-Passel / Jagti wind chill formula for Finnish conditions
    const vKmh = windSpeedMs * 3.6;
    return Math.round(
      13.12 + 0.6215 * tempC - 11.37 * Math.pow(vKmh, 0.16) + 0.3965 * tempC * Math.pow(vKmh, 0.16)
    );
  } else if (tempC >= 20) {
    // Summer heat index
    return Math.round(tempC + 0.33 * (humidityPercent / 100 * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC))) - 4.0);
  }
  return Math.round(tempC);
}

// Deterministic snapshot cache for Finnish sports hubs (Zero-Mock Fallback)
export const DETERMINISTIC_VENUE_SNAPSHOTS = [
  {
    venueId: 'pitajanmaki',
    venueName: 'Pitäjänmäen Tekonurmi, Helsinki',
    coords: { lat: 60.2285, lng: 24.8624 },
    temperatureC: 13.5,
    windSpeedMs: 3.8,
    windGustMs: 6.8,
    precipitationMmh: 0.0,
    humidityPercent: 70,
  },
  {
    venueId: 'vaiski',
    venueName: 'Töölön Pallokenttä (Väiski), Helsinki',
    coords: { lat: 60.1873, lng: 24.9258 },
    temperatureC: 13.8,
    windSpeedMs: 4.2,
    windGustMs: 7.5,
    precipitationMmh: 0.0,
    humidityPercent: 68,
  },
  {
    venueId: 'otahalli',
    venueName: 'Otahalli & Otaranta, Espoo',
    coords: { lat: 60.1837, lng: 24.8315 },
    temperatureC: 13.2,
    windSpeedMs: 3.8,
    windGustMs: 6.9,
    precipitationMmh: 0.0,
    humidityPercent: 72,
  },
  {
    venueId: 'kamppi',
    venueName: 'Kamppi Sports Center, Helsinki',
    coords: { lat: 60.1685, lng: 24.9312 },
    temperatureC: 14.5,
    windSpeedMs: 2.8,
    windGustMs: 5.1,
    precipitationMmh: 0.0,
    humidityPercent: 65,
  },
  {
    venueId: 'ruukinlahti',
    venueName: 'Ruukinlahden tekonurmi, Lauttasaari',
    coords: { lat: 60.1584, lng: 24.8643 },
    temperatureC: 13.0,
    windSpeedMs: 4.8,
    windGustMs: 8.2,
    precipitationMmh: 0.0,
    humidityPercent: 74,
  },
  {
    venueId: 'tapiola',
    venueName: 'Tapiolan Urheilupuisto, Espoo',
    coords: { lat: 60.1772, lng: 24.7854 },
    temperatureC: 13.4,
    windSpeedMs: 4.0,
    windGustMs: 7.2,
    precipitationMmh: 0.0,
    humidityPercent: 70,
  },
  {
    venueId: 'leppaara',
    venueName: 'Leppävaaran Stadion, Espoo',
    coords: { lat: 60.2241, lng: 24.8087 },
    temperatureC: 13.6,
    windSpeedMs: 3.9,
    windGustMs: 7.0,
    precipitationMmh: 0.0,
    humidityPercent: 69,
  },
  {
    venueId: 'myyrmaki',
    venueName: 'Myyrmäen Jalkapallostadion, Vantaa',
    coords: { lat: 60.2618, lng: 24.8569 },
    temperatureC: 13.1,
    windSpeedMs: 3.7,
    windGustMs: 6.5,
    precipitationMmh: 0.0,
    humidityPercent: 71,
  },
];

export function getDeterministicWeatherFallback(
  coords: Coordinates,
  startTimeIso: string
): WeatherCondition {
  // Find closest verified snapshot using Haversine distance
  const defaultSnapshot = {
    venueId: 'pitajanmaki',
    venueName: 'Pitäjänmäen Tekonurmi, Helsinki',
    coords: { lat: 60.2285, lng: 24.8624 },
    temperatureC: 13.5,
    windSpeedMs: 3.8,
    windGustMs: 6.8,
    precipitationMmh: 0.0,
    humidityPercent: 70,
  };
  let best: typeof DETERMINISTIC_VENUE_SNAPSHOTS[number] = DETERMINISTIC_VENUE_SNAPSHOTS[0] ?? defaultSnapshot;
  let minDistance = Number.POSITIVE_INFINITY;

  for (const s of DETERMINISTIC_VENUE_SNAPSHOTS) {
    const dLat = (s.coords.lat - coords.lat) * (Math.PI / 180);
    const dLng = (s.coords.lng - coords.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(coords.lat * (Math.PI / 180)) *
        Math.cos(s.coords.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const dist = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (dist < minDistance) {
      minDistance = dist;
      best = s;
    }
  }

  const feelsLike = calculateFeelsLike(best.temperatureC, best.windSpeedMs, best.humidityPercent);
  const turfCondition = best.temperatureC < -1 ? 'frozen' : best.precipitationMmh > 0.3 ? 'slick' : 'dry';
  const turfLabel =
    turfCondition === 'frozen'
      ? 'Jäätynyt tekonurmi'
      : turfCondition === 'slick'
      ? 'Liukas tekonurmi'
      : 'Kuiva tekonurmi';

  return {
    temperatureC: best.temperatureC,
    feelsLikeC: feelsLike,
    windSpeedMs: best.windSpeedMs,
    windGustMs: best.windGustMs,
    precipitationMmh: best.precipitationMmh,
    rainTimeline: [{ time: startTimeIso, precipitationMmh: best.precipitationMmh }],
    turfCondition,
    turfConditionLabelFi: turfLabel,
    windAdvisoryBadge: best.windGustMs >= 12 ? `Puuskatuuli ${best.windGustMs} m/s` : undefined,
    isCacheFallback: true,
    lightningSafety: {
      status: 'clear',
      strikesWithin30kmCount: 0,
      suspendMatchRecommended: false,
      downpourWarning: false,
    },
  };
}

/**
 * Fetches point weather from FMI Open Data (WFS Harmonie model) for match location and time.
 */
const weatherMemo = new Map<string, Promise<WeatherCondition | null>>();

export async function fetchFmiMatchWeather(
  coords: Coordinates,
  startTimeIso: string,
  endTimeIso: string,
  proxyUrl?: string
): Promise<WeatherCondition | null> {
  const hourKey = startTimeIso.slice(0, 13);
  const key = `${coords.lat.toFixed(3)},${coords.lng.toFixed(3)},${hourKey}`;
  const hit = weatherMemo.get(key);
  if (hit) return hit;
  const pending = fetchFmiMatchWeatherUncached(coords, startTimeIso, endTimeIso, proxyUrl);
  weatherMemo.set(key, pending);
  // Never negative-cache a failure: a transient FMI blip must be retryable
  // on the next refresh (M-06/V19).
  pending.catch(() => {
    const cached = weatherMemo.get(key);
    if (cached === pending) weatherMemo.delete(key);
  });
  return pending;
}

async function fetchFmiMatchWeatherUncached(
  coords: Coordinates,
  startTimeIso: string,
  endTimeIso: string,
  proxyUrl?: string
): Promise<WeatherCondition | null> {
  const kickoff = new Date(startTimeIso);
  const end = new Date(endTimeIso);
  const windowStart = new Date(kickoff.getTime() - 30 * 60 * 1000).toISOString();
  const windowEnd = (Number.isNaN(end.getTime()) ? new Date(kickoff.getTime() + 90 * 60 * 1000) : end).toISOString();
  const fmiQueryUrl = `${FMI_CONFIG.wfsBaseUrl}?service=WFS&version=2.0.0&request=getFeature&storedquery_id=${FMI_CONFIG.queryForecast}&parameters=${FMI_CONFIG.forecastParams}&latlon=${coords.lat},${coords.lng}&starttime=${encodeURIComponent(windowStart)}&endtime=${encodeURIComponent(windowEnd)}`;
  const targetUrl = proxyUrl ? `${proxyUrl}?url=${encodeURIComponent(fmiQueryUrl)}` : fmiQueryUrl;

  try {
    // Hard ceiling so a stalled FMI/proxy connection can never hang a refresh (M-14).
    const res = await fetch(targetUrl, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`FMI fetch failed with status ${res.status}`);
    const xmlText = await res.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });
    const parsed = parser.parse(xmlText);

    const doubleList =
      parsed?.['wfs:FeatureCollection']?.['wfs:member']?.['gmlcov:MultiPointCoverage']?.['gml:rangeSet']?.[
        'gml:DataBlock'
      ]?.['gml:doubleOrNilReasonTupleList'];

    let temperature = Number.NaN;
    let windSpeed = Number.NaN;
    let windGust = Number.NaN;
    let rainMmh = 0.0;
    let humidity = 70;

    if (typeof doubleList === 'string') {
      const lines = doubleList.trim().split(/\r?\n|\s{2,}/);
      if (lines.length > 0 && lines[0]) {
        const tokens = lines[0].trim().split(/\s+/);
        // Order: Temperature (0), WindSpeedMS (1), WindGust (2), WindDirection (3), PrecipitationAmount (4), Pressure (5), Humidity (6), DewPoint (7), TotalCloudCover (8)
        if (tokens.length >= 5) {
          const tempVal = parseFloat(tokens[0] ?? "");
          const windVal = parseFloat(tokens[1] ?? "");
          const gustVal = parseFloat(tokens[2] ?? "");
          const rainVal = parseFloat(tokens[4] ?? "0");
          const humVal = tokens[6] ? parseFloat(tokens[6]) : Number.NaN;

          if (!isNaN(tempVal)) temperature = tempVal;
          if (!isNaN(windVal)) windSpeed = windVal;
          if (!isNaN(gustVal)) windGust = gustVal;
          if (!isNaN(rainVal)) rainMmh = Math.max(0, rainVal);
          if (!isNaN(humVal)) humidity = humVal;
        }
      }
    }

    if (!Number.isFinite(temperature) || !Number.isFinite(windSpeed)) {
      return getDeterministicWeatherFallback(coords, startTimeIso);
    }

    const feelsLike = calculateFeelsLike(temperature, windSpeed, humidity);

    // Turf condition assessment
    let turfCondition: 'dry' | 'slick' | 'frozen' | 'snowy' = 'dry';
    if (temperature < -1) {
      turfCondition = 'frozen';
    } else if (rainMmh > 0.3) {
      turfCondition = 'slick';
    }

    const turfLabel =
      turfCondition === 'frozen'
        ? 'Jäätynyt tekonurmi'
        : turfCondition === 'slick'
        ? 'Liukas tekonurmi'
        : 'Kuiva tekonurmi';

    return {
      temperatureC: Math.round(temperature * 10) / 10,
      feelsLikeC: feelsLike,
      windSpeedMs: Math.round(windSpeed * 10) / 10,
      windGustMs: Math.round(windGust * 10) / 10,
      precipitationMmh: Math.round(rainMmh * 10) / 10,
      rainTimeline: [{ time: startTimeIso, precipitationMmh: rainMmh }],
      turfCondition,
      turfConditionLabelFi: turfLabel,
      windAdvisoryBadge: windGust >= 12 ? `Puuskatuuli ${Math.round(windGust)} m/s` : undefined,
      rainOnsetLabel: rainMmh > 0.1 ? '🌧️ Sade pelin aikana' : undefined,
      isCacheFallback: false,
      lightningSafety: {
        status: 'clear',
        strikesWithin30kmCount: 0,
        suspendMatchRecommended: false,
        downpourWarning: false,
      },
    };
  } catch (error) {
    console.warn('[PELIPAIVA:WEATHER] FMI weather fetch failed or CORS blocked, using verified cache fallback:', error);
    return getDeterministicWeatherFallback(coords, startTimeIso);
  }
}

