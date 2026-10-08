import { Coordinates, HomeLocation, MatchdayEvent, TransitMode, TransitPlan, WeatherCondition } from '../../types/matchday';

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
  overrideMode?: TransitMode
): TransitPlan {
  // Defensive guard against invalid coordinates, Null Island (0,0), or coordinates outside Finland
  const isCoordValid = (c?: Coordinates | null) =>
    Boolean(
      c &&
      typeof c.lat === 'number' &&
      typeof c.lng === 'number' &&
      !isNaN(c.lat) &&
      !isNaN(c.lng) &&
      c.lat >= 59.0 &&
      c.lat <= 71.0 &&
      c.lng >= 19.0 &&
      c.lng <= 32.0
    );

  const isVenueMissing = !venueCoords || !isCoordValid(venueCoords);
  const isHomeMissing = !home || !home.coordinates || !isCoordValid(home.coordinates);

  // No guessing: without both ends there is no travel time.
  if (isVenueMissing || isHomeMissing) {
    return {
      mode: 'car',
      distanceKm: 0,
      travelMinutes: 0,
      transitLabel: isVenueMissing ? '📍 Sijainti tuntematon' : '🏠 Lisää kotiosoite',
      isSelfTransit: false,
      isUnknownLocation: isVenueMissing,
      needsHome: isHomeMissing
    };
  }

  const h = home as HomeLocation;
  const rawDistKm = calculateHaversineDistanceKm(h.coordinates, venueCoords as Coordinates);
  // Account for Finnish city street grid detours (approx 1.25x Manhattan/grid factor)
  const distanceKm = Math.max(0.1, Number((rawDistKm * 1.25).toFixed(2)));
  const distLabel = formatTransitDistance(distanceKm);

  const maxWalk = h.maxWalkingDistanceKm ?? 1.5;
  const maxBike = h.maxCyclingDistanceKm ?? 5.0;

  // Unfavorable cycling / walking weather:
  // Rain >= 1.0 mm/h, freezing icy conditions <= 0°C, high wind gusts >= 14 m/s (sea bridges), or soaked/snowy ground.
  const isBadCyclingWeather =
    weather &&
    (weather.precipitationMmh >= 1.0 ||
      weather.temperatureC <= 0 ||
      weather.windGustMs >= 14 ||
      weather.turfCondition === 'snowy' ||
      weather.turfCondition === 'slick');

  const isSevereWeather =
    weather &&
    (weather.precipitationMmh >= 2.5 ||
      (weather.temperatureC <= -5 && weather.turfCondition === 'snowy') ||
      weather.windGustMs >= 17);

  let selectedMode: 'walk' | 'bicycle' | 'car' | 'transit' = 'car';
  const preferred = h.defaultTransitMode || 'auto';

  if (overrideMode && overrideMode !== 'auto') {
    selectedMode = overrideMode;
  } else if (preferred === 'car') {
    selectedMode = 'car';
  } else if (preferred === 'transit') {
    selectedMode = 'transit';
  } else if (preferred === 'walk') {
    if (distanceKm <= maxWalk && !isSevereWeather) selectedMode = 'walk';
    else if (distanceKm <= maxBike && !isBadCyclingWeather) selectedMode = 'bicycle';
    else selectedMode = 'car';
  } else if (preferred === 'bicycle') {
    if (distanceKm <= maxBike && !isBadCyclingWeather) selectedMode = 'bicycle';
    else selectedMode = 'car';
  } else if (distanceKm <= maxWalk && !isSevereWeather) {
    selectedMode = 'walk';
  } else if (distanceKm <= maxBike && !isBadCyclingWeather) {
    selectedMode = 'bicycle';
  } else {
    selectedMode = 'car';
  }

  let travelMinutes = 0;
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
        weatherWarning = '🌧️ Sadetta: sateenvarjo tai sadetakki mukaan kävelyyn';
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
      } else if (weather && weather.temperatureC >= 15 && weather.precipitationMmh === 0) {
        weatherWarning = undefined;
      }
      break;
    }
    case 'transit': {
      // Public transit average = distance * 2.5 min + 7 min stop buffer
      travelMinutes = Math.max(8, Math.round(distanceKm * 2.5) + 7);
      transitLabel = `🚌 Bussi/Ratikka/Metro ${travelMinutes} min (${distLabel})`;
      isSelfTransit = true;
      break;
    }
    case 'car':
    default: {
      // City driving = distance * 1.6 min + 4 min traffic/lights
      travelMinutes = Math.max(5, Math.round(distanceKm * 1.6) + 4);
      transitLabel = `🚗 Auto ${travelMinutes} min (${distLabel})`;
      isSelfTransit = false;
      if (isBadCyclingWeather && distanceKm <= maxBike && distanceKm > maxWalk) {
        weatherWarning = '🌧️ Sadesää/tuuli: autokyyti tai metro suositeltava pyöräilyn sijaan';
      } else if (isSevereWeather && distanceKm <= maxWalk) {
        weatherWarning = '🌧️ Rankkasade: autokyyti suositeltava kävelyn sijaan';
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

/** True when a plan has a real, computed travel time (home and venue both known). */
export function hasRealTravelTime(plan: TransitPlan | null | undefined): boolean {
  return Boolean(plan && !plan.needsHome && !plan.isUnknownLocation);
}

/**
 * The trip plan for one event, always computed from the home that is saved now.
 * A plan stored on the event may come from an old default home or an older
 * address, so it is never shown. No home or no exact venue pin gives
 * needsHome / isUnknownLocation instead of a guessed drive.
 */
export function effectiveTransitPlan(
  event: Pick<MatchdayEvent, 'venue' | 'weather'>,
  home: HomeLocation | null | undefined
): TransitPlan {
  const isApprox = Boolean(event.venue?.isApproximateLocation);
  const venueCoords = isApprox ? undefined : event.venue?.coordinates;
  return resolveTransitPlan(home, venueCoords, event.weather);
}
