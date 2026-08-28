import { Coordinates, HomeLocation, TransitMode, TransitPlan, WeatherCondition } from '../../types/matchday';

/**
 * Calculates straight-line distance in kilometers using the Haversine formula.
 */
export function calculateHaversineDistanceKm(c1: Coordinates, c2: Coordinates): number {
  if (!c1 || !c2 || typeof c1.lat !== 'number' || typeof c2.lat !== 'number') {
    return 0;
  }
  const R = 6371; // Earth's radius in km
  const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
  const dLng = ((c2.lng - c1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1.lat * Math.PI) / 180) *
      Math.cos((c2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats distance nicely in Finnish (e.g. "800 m" or "3.4 km").
 */
export function formatTransitDistance(distanceKm: number): string {
  if (distanceKm < 1.0) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1).replace('.', ',')} km`;
}

/**
 * Resolves optimal transit plan from Home to Match Venue.
 */
export function resolveTransitPlan(
  home: HomeLocation | null | undefined,
  venueCoords: Coordinates | null | undefined,
  weather?: WeatherCondition,
  overrideMode?: TransitMode,
  defaultDrivingMinutes = 20
): TransitPlan {
  // If no home or venue coordinates available, fallback to car
  if (!home || !venueCoords || !home.coordinates) {
    return {
      mode: 'car',
      distanceKm: 0,
      travelMinutes: defaultDrivingMinutes,
      transitLabel: `🚗 Auto ~${defaultDrivingMinutes} min`,
      isSelfTransit: false
    };
  }

  const rawDistKm = calculateHaversineDistanceKm(home.coordinates, venueCoords);
  // Account for Finnish city street grid detours (approx 1.25x Manhattan/grid factor)
  const distanceKm = Math.max(0.1, Number((rawDistKm * 1.25).toFixed(2)));
  const distLabel = formatTransitDistance(distanceKm);

  const maxWalk = home.maxWalkingDistanceKm ?? 1.5;
  const maxBike = home.maxCyclingDistanceKm ?? 5.0;

  // Severe weather checks (heavy rain, thunderstorm, freezing blizzard)
  const isSevereWeather =
    weather &&
    (weather.precipitationMmh >= 2.5 ||
      (weather.temperatureC <= -5 && weather.turfCondition === 'snowy') ||
      weather.windGustMs >= 17);

  let selectedMode: 'walk' | 'bicycle' | 'car' | 'transit' = 'car';

  if (overrideMode && overrideMode !== 'auto') {
    selectedMode = overrideMode;
  } else if (distanceKm <= maxWalk && !isSevereWeather) {
    selectedMode = 'walk';
  } else if (distanceKm <= maxBike && !isSevereWeather) {
    selectedMode = 'bicycle';
  } else {
    selectedMode = 'car';
  }

  let travelMinutes = defaultDrivingMinutes;
  let transitLabel = '';
  let isSelfTransit = false;
  let weatherWarning: string | undefined;

  switch (selectedMode) {
    case 'walk': {
      // 4.8 km/h walking speed = 12.5 min/km
      travelMinutes = Math.max(3, Math.round(distanceKm * 12.5));
      transitLabel = `🚶 Kävely ${travelMinutes} min (${distLabel})`;
      isSelfTransit = true;
      if (weather && weather.precipitationMmh > 0.5) {
        weatherWarning = '🌧️ Kevyttä sadetta: sateenvarjo tai sadetakki mukaan';
      }
      break;
    }
    case 'bicycle': {
      // 15 km/h cycling speed = 4.0 min/km + 2 min lock/unlock
      travelMinutes = Math.max(3, Math.round(distanceKm * 4.0) + 2);
      transitLabel = `🚴 Pyöräily ${travelMinutes} min (${distLabel})`;
      isSelfTransit = true;
      if (weather && weather.precipitationMmh > 0.5) {
        weatherWarning = '🌧️ Sadetta luvassa: sadevarusteet pyöräilyyn';
      }
      break;
    }
    case 'transit': {
      // Public transit average = distance * 2.5 min + 7 min stop buffer
      travelMinutes = Math.max(8, Math.round(distanceKm * 2.5) + 7);
      transitLabel = `🚌 Bussi/Ratikka ${travelMinutes} min (${distLabel})`;
      isSelfTransit = true;
      break;
    }
    case 'car':
    default: {
      // City driving = distance * 1.6 min + 4 min traffic/lights
      travelMinutes = Math.max(5, Math.round(distanceKm * 1.6) + 4);
      transitLabel = `🚗 Auto ${travelMinutes} min (${distLabel})`;
      isSelfTransit = false;
      if (isSevereWeather && (distanceKm <= maxBike || distanceKm <= maxWalk)) {
        weatherWarning = '🌧️ Sadesää: auto suositeltava pyöräilyn sijaan';
      }
      break;
    }
  }

  return {
    mode: selectedMode,
    distanceKm,
    travelMinutes,
    transitLabel,
    isSelfTransit,
    weatherWarning
  };
}
