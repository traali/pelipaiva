import {
  ArrivalRules,
  Coordinates,
  FootwearRecommendation,
  MatchdayBriefing,
  MatchdayEvent,
  PitchSurface
} from '../../types/matchday';

export function determineFootwear(
  surface: PitchSurface,
  tempC: number,
  precipMmh: number,
  isIndoor: boolean
): { footwear: FootwearRecommendation; reason: string } {
  if (isIndoor) {
    return {
      footwear: 'INDOOR_NON_MARKING',
      reason: 'Sisähalli: Vaaleapohjaiset tai Non-Marking sisäpelikengät.'
    };
  }

  if (surface === 'sand_artificial_turf') {
    if (tempC <= 3) {
      return {
        footwear: 'TF_TURF_SHOES',
        reason: 'Hiekkatekonurmi on kylmällä kova kuin betoni. Käytä ehdottomasti Turf-kenkiä (TF) rasitusvammojen ja liukastumisen estämiseksi.'
      };
    }
    return {
      footwear: 'TF_TURF_SHOES',
      reason: 'Hiekkatekonurmi: Turf-kengät (tiheä nappulapohja) tarjoavat parhaan pidon ja suojan.'
    };
  }

  if (surface === 'natural_grass') {
    if (precipMmh > 1.0) {
      return {
        footwear: 'SG_SOFT_GROUND',
        reason: 'Märkä luonnonnurmi: Pehmeän alustan nappikset (SG) tai pitkät FG-nappulat.'
      };
    }
    return {
      footwear: 'FG_FIRM_GROUND',
      reason: 'Luonnonnurmi: Normaali nurmikenkä (FG).'
    };
  }

  // Modern 3G/4G Artificial Turf
  if (tempC < 0) {
    return {
      footwear: 'TF_TURF_SHOES',
      reason: 'Jäätynyt tekonurmi: Suosi Turf-kenkiä (TF) tai lyhyitä AG-nappuloita.'
    };
  }
  return {
    footwear: 'AG_ARTIFICIAL_GRASS',
    reason: 'Tekonurmi: AG-nappikset (pyöreät ontot nappulat säästävät polvia ja nilkkoja).'
  };
}

/**
 * Calculates dynamic departure time and countdown based on user-configured arrival rules.
 */
export function calculateDepartureCountdown(
  event: MatchdayEvent,
  arrivalRules?: ArrivalRules,
  _userCoordinates?: Coordinates
): { departureTime: string; countdownMinutes: number; leaveHomeDate: Date } {
  const isTraining = event.isTraining || event.eventType === 'training';
  const isTournament = event.eventType === 'tournament';
  const isHome = event.isHomeMatch;

  // Resolve warmup offset
  let warmupOffset = isTraining ? 15 : (isHome ? 45 : 60);
  if (arrivalRules) {
    if (isTraining) {
      warmupOffset = arrivalRules.warmupOffsetsMinutes?.training ?? arrivalRules.warmupOffsetTrainingMinutes ?? 15;
    } else if (isTournament) {
      warmupOffset = arrivalRules.warmupOffsetsMinutes?.tournament ?? arrivalRules.warmupOffsetTournamentMinutes ?? 30;
    } else if (isHome) {
      warmupOffset = arrivalRules.warmupOffsetsMinutes?.homeMatch ?? arrivalRules.warmupOffsetHomeMinutes ?? 45;
    } else {
      warmupOffset = arrivalRules.warmupOffsetsMinutes?.awayMatch ?? arrivalRules.warmupOffsetAwayMinutes ?? 60;
    }
  }

  const drivingEstimateMins = arrivalRules?.defaultDrivingEstimateMinutes ?? 20;
  const departureBufferMins = arrivalRules?.departureBufferMinutes ?? arrivalRules?.defaultDepartureBufferMinutes ?? 10;
  const walkingMins = event.parking?.walkingTimeMinutes ?? 3;
  const dutyBufferMins = event.volunteerDuty ? (arrivalRules?.volunteerDutyArrivalBufferMinutes ?? 15) : 0;

  // Kickoff time
  const kickoffDate = new Date(event.startTime);
  const totalOffsetMins = warmupOffset + drivingEstimateMins + departureBufferMins + walkingMins + dutyBufferMins;
  const leaveHomeDate = new Date(kickoffDate.getTime() - totalOffsetMins * 60 * 1000);

  const departureTime = leaveHomeDate.toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Helsinki'
  });

  const countdownMinutes = Math.max(0, Math.round((leaveHomeDate.getTime() - Date.now()) / 60000));

  return {
    departureTime,
    countdownMinutes,
    leaveHomeDate
  };
}

export function generateMatchdayBriefing(
  event: MatchdayEvent,
  allDayEvents: MatchdayEvent[] = [],
  arrivalRules?: ArrivalRules
): MatchdayBriefing {
  const { weather, venue, volunteerDuty } = event;
  const isOutdoor = !venue.isIndoor;
  const temp = weather?.temperatureC ?? 15;
  const rain = weather?.precipitationMmh ?? 0;

  // 1. Conflict Detection across family profiles
  let conflictWarning: string | undefined;
  const eventStart = new Date(event.startTime).getTime();
  const eventEnd = new Date(event.endTime).getTime();

  const overlapping = allDayEvents.filter((other) => {
    if (other.id === event.id) return false;
    const otherStart = new Date(other.startTime).getTime();
    const otherEnd = new Date(other.endTime).getTime();
    return eventStart < otherEnd && eventEnd > otherStart;
  });

  if (overlapping.length > 0 && overlapping[0]) {
    conflictWarning = `⚠️ AIKATAULURUUHKI: Peli menee päällekkäin tapahtuman "${overlapping[0].title}" kanssa!`;
  }

  // 2. Footwear & Gear Advice
  const { footwear, reason: footwearReason } = determineFootwear(
    venue.surface,
    temp,
    rain,
    venue.isIndoor
  );

  let clothingAdvice = '';
  let spectatorGear = 'Normaali säänmukainen vaatetus.';

  if (isOutdoor) {
    if (temp < 6) {
      clothingAdvice = 'Pelaajalle tekninen aluskerrasto, pipo ja ohuet pelihanskat.';
      spectatorGear = 'Kylmä katsomossa! Toppatakki, istuinalusta, lämpimät kengät ja termospullo.';
    } else if (temp < 13) {
      clothingAdvice = 'Pitkähihainen aluspaita tai lämmittelytakki suositeltava.';
    } else {
      clothingAdvice = 'Normaali lyhythihainen peliasu + vaihtopaita.';
    }

    if (rain > 0.5) {
      spectatorGear += ' 🌧️ Muista sateenvarjo ja vedenpitävät kengät.';
    }
  } else {
    clothingAdvice = 'Normaali sisäpelivarustus + juomapullo ja suojalasit (säbä).';
    spectatorGear = 'Sisähallissa tarkenee kevyemmällä vaatetuksella.';
  }

  if (volunteerDuty) {
    spectatorGear += ` 📌 Sinulla on ${volunteerDuty}!`;
  }

  // 3. Departure Timing using dynamic rules
  const { departureTime, countdownMinutes } = calculateDepartureCountdown(event, arrivalRules);

  // 4. WhatsApp Template
  const postMatchWhatsApp = `🔥 Pelipäivän tulos: ${event.homeTeam} - ${event.awayTeam} päättyi [SYÖTÄ TULOS]! Hieno matsi kentällä ${venue.name}. Seuraava peli: [PVM].`;

  return {
    scoutSummary: `⚽ ${event.title} @ ${venue.name} (${venue.surface.replace(/_/g, ' ')}).`,
    gearAndPackingAdvice: {
      clothing: clothingAdvice,
      footwear,
      footwearReason,
      kitRecommendation: event.isHomeMatch
        ? 'Kotipeliasu (ykköspaita)'
        : 'Vieraspeliasu + varapaita kassiin',
      spectatorGear
    },
    recommendedDepartureTime: departureTime,
    departureCountdownMinutes: countdownMinutes,
    conflictWarning,
    postMatchWhatsAppTemplate: postMatchWhatsApp
  };
}
