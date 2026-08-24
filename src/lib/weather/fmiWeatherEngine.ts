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
    const res = await fetch(targetUrl);
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
    let rainProb = 0;

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

    if (!Number.isFinite(temperature) || !Number.isFinite(windSpeed)) return null;

    const feelsLike = calculateFeelsLike(temperature, windSpeed, humidity);

    // Turf condition assessment
    let turfCondition: 'dry' | 'slick' | 'frozen' | 'snowy' = 'dry';
    if (temperature < -1) {
      turfCondition = 'frozen';
    } else if (rainMmh > 0.3 || rainProb > 45) {
      turfCondition = 'slick';
    }

    return {
      temperatureC: Math.round(temperature * 10) / 10,
      feelsLikeC: feelsLike,
      windSpeedMs: Math.round(windSpeed * 10) / 10,
      windGustMs: Math.round(windGust * 10) / 10,
      rainProbabilityPercent: rainProb,
      precipitationMmh: Math.round(rainMmh * 10) / 10,
      rainTimeline: [
        { time: startTimeIso, precipitationMmh: rainMmh },
        { time: endTimeIso, precipitationMmh: Math.round(rainMmh * 1.2 * 10) / 10 }
      ],
      turfCondition
    };
  } catch (error) {
    console.warn('[PELIPAIVA:WEATHER] FMI weather fetch failed, omitting weather:', error);
    return null;
  }
}
