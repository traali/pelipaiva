import { XMLParser } from 'fast-xml-parser';
import { Coordinates, WeatherCondition } from '../../types/matchday';
import { compute30_30Rule, type LightningStrike } from './lightningSafety';

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
export function calculateFeelsLike(tempC: number, windSpeedMs: number, humidityPercent?: number): number {
  if (tempC <= 10 && windSpeedMs > 1.3) {
    // Siple-Passel / Jagti wind chill formula for Finnish conditions
    const vKmh = windSpeedMs * 3.6;
    return Math.round(
      13.12 + 0.6215 * tempC - 11.37 * Math.pow(vKmh, 0.16) + 0.3965 * tempC * Math.pow(vKmh, 0.16)
    );
  }
  // Heat index needs a measured humidity. Do not assume 70%.
  if (tempC >= 20 && humidityPercent != null && Number.isFinite(humidityPercent)) {
    return Math.round(tempC + 0.33 * (humidityPercent / 100 * 6.105 * Math.exp((17.27 * tempC) / (237.7 + tempC))) - 4.0);
  }
  return Math.round(tempC);
}

/** FMI lightning MultiPointCoverage positions: lat lon unixTime (repeat). */
export function parseLightningWfs(xml: string): LightningStrike[] {
  if (!xml || xml.includes('numberReturned="0"')) return [];
  const block = xml.match(/<gmlcov:positions>([\s\S]*?)<\/gmlcov:positions>/i)?.[1]
    || xml.match(/<gml:posList>([\s\S]*?)<\/gml:posList>/i)?.[1];
  if (!block) return [];
  const nums = block.trim().split(/\s+/).map(Number).filter((n) => Number.isFinite(n));
  const strikes: LightningStrike[] = [];
  for (let i = 0; i + 2 < nums.length; i += 3) {
    const lat = nums[i]!;
    const lng = nums[i + 1]!;
    const t = nums[i + 2]!;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const ms = t > 1e12 ? t : t > 1e9 ? t * 1000 : Date.now();
    strikes.push({ lat, lng, timeIso: new Date(ms).toISOString() });
  }
  return strikes;
}

function unknownLightning(): NonNullable<WeatherCondition['lightningSafety']> {
  return {
    status: 'unknown',
    strikesWithin30kmCount: 0,
    suspendMatchRecommended: false,
    downpourWarning: false,
    alertMessage: 'Salamatilaa ei saatu. Älä oleta, että sää on turvallinen.',
  };
}

async function fetchLightningSafety(coords: Coordinates, startTimeIso: string): Promise<WeatherCondition['lightningSafety']> {
  try {
    const ref = new Date(startTimeIso).getTime();
    const now = Date.now();
    const live = Number.isFinite(ref) && Math.abs(now - ref) < 6 * 3600_000;
    const endMs = live ? now : (Number.isFinite(ref) ? ref + 60 * 60_000 : now);
    const startMs = endMs - 30 * 60_000;
    const dLat = 30 / 111.32;
    const dLng = 30 / (111.32 * Math.max(0.2, Math.cos((coords.lat * Math.PI) / 180)));
    const bbox = [
      (coords.lng - dLng).toFixed(3),
      (coords.lat - dLat).toFixed(3),
      (coords.lng + dLng).toFixed(3),
      (coords.lat + dLat).toFixed(3)
    ].join(',');
    const url =
      `${FMI_CONFIG.wfsBaseUrl}?service=WFS&version=2.0.0&request=GetFeature` +
      `&storedquery_id=${encodeURIComponent(FMI_CONFIG.queryLightning)}` +
      `&starttime=${encodeURIComponent(new Date(startMs).toISOString())}` +
      `&endtime=${encodeURIComponent(new Date(endMs).toISOString())}` +
      `&bbox=${bbox}`;
    const res = await fetch(url);
    if (!res.ok) return unknownLightning();
    const xml = await res.text();
    const strikes = parseLightningWfs(xml);
    return compute30_30Rule(coords, strikes, live ? now : endMs);
  } catch {
    return unknownLightning();
  }
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
    let rainMmh = Number.NaN;
    let humidity = Number.NaN;

    if (typeof doubleList === 'string') {
      const lines = doubleList.trim().split(/\r?\n|\s{2,}/);
      if (lines.length > 0 && lines[0]) {
        const tokens = lines[0].trim().split(/\s+/);
        // Order: Temperature (0), WindSpeedMS (1), WindGust (2), WindDirection (3), PrecipitationAmount (4), Pressure (5), Humidity (6), DewPoint (7), TotalCloudCover (8)
        if (tokens.length >= 5) {
          const tempVal = parseFloat(tokens[0] ?? "");
          const windVal = parseFloat(tokens[1] ?? "");
          const gustVal = parseFloat(tokens[2] ?? "");
          const rainVal = parseFloat(tokens[4] ?? "");
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
      return null;
    }

    const feelsLike = calculateFeelsLike(
      temperature,
      windSpeed,
      Number.isFinite(humidity) ? humidity : undefined
    );
    const gustKnown = Number.isFinite(windGust);
    const gust = gustKnown ? windGust : windSpeed;
    const rainKnown = Number.isFinite(rainMmh);

    // Turf condition assessment. Unknown rain is not "dry".
    let turfCondition: 'dry' | 'slick' | 'frozen' | 'snowy' = 'dry';
    if (temperature < -1) {
      turfCondition = 'frozen';
    } else if (rainKnown && rainMmh > 0.3) {
      turfCondition = 'slick';
    }

    const turfLabel = !rainKnown
      ? 'Sade ei tiedossa'
      : turfCondition === 'frozen'
        ? 'Jäätynyt tekonurmi'
        : turfCondition === 'slick'
          ? 'Liukas tekonurmi'
          : 'Kuiva tekonurmi';

    return {
      temperatureC: Math.round(temperature * 10) / 10,
      feelsLikeC: feelsLike,
      windSpeedMs: Math.round(windSpeed * 10) / 10,
      windGustMs: Math.round(gust * 10) / 10,
      precipitationMmh: rainKnown ? Math.round(rainMmh * 10) / 10 : Number.NaN,
      rainTimeline: rainKnown ? [{ time: startTimeIso, precipitationMmh: rainMmh }] : [],
      turfCondition,
      turfConditionLabelFi: turfLabel,
      windAdvisoryBadge: gustKnown && windGust >= 12 ? `Puuskatuuli ${Math.round(windGust)} m/s` : undefined,
      rainOnsetLabel: rainKnown && rainMmh > 0.1 ? '🌧️ Sade pelin aikana' : undefined,
      isCacheFallback: false,
      lightningSafety: await fetchLightningSafety(coords, startTimeIso)
    };
  } catch (error) {
    console.warn('[PELIPAIVA:WEATHER] FMI weather fetch failed:', error);
    return null;
  }
}

