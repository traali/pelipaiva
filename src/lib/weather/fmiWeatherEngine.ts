import { XMLParser } from 'fast-xml-parser';
import { Coordinates, WeatherCondition } from '../../types/matchday';

export async function fetchFmiMatchWeather(
  coords: Coordinates,
  startTimeIso: string,
  endTimeIso: string,
  proxyUrl?: string
): Promise<WeatherCondition> {
  const fmiQueryUrl = `https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature&storedquery_id=fmi::forecast::harmonie::surface::point::multipointcoverage&latlon=${coords.lat},${coords.lng}`;
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

    // Parse doubleOrNilReasonTupleList if present
    const doubleList =
      parsed?.['wfs:FeatureCollection']?.['wfs:member']?.['gmlcov:MultiPointCoverage']?.['gml:rangeSet']?.[
        'gml:DataBlock'
      ]?.['gml:doubleOrNilReasonTupleList'];

    let temperature = 14.0;
    let windSpeed = 5.0;
    let rainMmh = 0.0;
    let rainProb = 15;

    if (typeof doubleList === 'string') {
      const lines = doubleList.trim().split(/\r?\n|\s{2,}/);
      if (lines.length > 0 && lines[0]) {
        const tokens = lines[0].trim().split(/\s+/);
        // Standard FMI Harmonie surface fields: GeopHeight, Temperature, WindSpeedMS, WindDirection, Humidity, Precipitation1h, etc.
        if (tokens.length >= 6) {
          const tempVal = parseFloat(tokens[1] ?? '14.0');
          const windVal = parseFloat(tokens[2] ?? '5.0');
          const rainVal = parseFloat(tokens[5] ?? '0.0');
          if (!isNaN(tempVal)) temperature = tempVal;
          if (!isNaN(windVal)) windSpeed = windVal;
          if (!isNaN(rainVal)) rainMmh = rainVal;
        }
      }
    }

    // Wind chill calculation formula
    const feelsLike = Math.round(
      13.12 +
        0.6215 * temperature -
        11.37 * Math.pow(windSpeed * 3.6, 0.16) +
        0.3965 * temperature * Math.pow(windSpeed * 3.6, 0.16)
    );

    let turfCondition: 'dry' | 'slick' | 'frozen' | 'snowy' = 'dry';
    if (temperature < -1) {
      turfCondition = 'frozen';
    } else if (rainMmh > 0.4 || rainProb > 45) {
      turfCondition = 'slick';
    }

    return {
      temperatureC: Math.round(temperature * 10) / 10,
      feelsLikeC: feelsLike,
      windSpeedMs: Math.round(windSpeed * 10) / 10,
      windGustMs: Math.round(windSpeed * 1.4 * 10) / 10,
      rainProbabilityPercent: rainProb,
      precipitationMmh: Math.round(rainMmh * 10) / 10,
      rainTimeline: [
        { time: startTimeIso, precipitationMmh: rainMmh },
        { time: endTimeIso, precipitationMmh: Math.round(rainMmh * 1.2 * 10) / 10 }
      ],
      turfCondition
    };
  } catch (error) {
    console.warn('[PELIPAIVA:WEATHER] FMI weather fetch notice, using default estimate:', error);
    return {
      temperatureC: 15.0,
      feelsLikeC: 15.0,
      windSpeedMs: 4.0,
      windGustMs: 6.0,
      rainProbabilityPercent: 20,
      precipitationMmh: 0.0,
      rainTimeline: [
        { time: startTimeIso, precipitationMmh: 0.0 },
        { time: endTimeIso, precipitationMmh: 0.0 }
      ],
      turfCondition: 'dry'
    };
  }
}
