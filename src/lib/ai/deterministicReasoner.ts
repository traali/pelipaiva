import {
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

export function generateMatchdayBriefing(
  event: MatchdayEvent,
  allDayEvents: MatchdayEvent[] = []
): MatchdayBriefing {
  const { weather, parking, venue, warmupTime, volunteerDuty } = event;
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

  // 3. Departure Timing
  const warmupDate = new Date(warmupTime);
  const walkingMins = parking?.walkingTimeMinutes || 3;
  const bufferMins = 10;
  const drivingEstimateMins = 20;
  const leaveHomeDate = new Date(
    warmupDate.getTime() - (walkingMins + bufferMins + drivingEstimateMins) * 60000
  );
  const departureStr = leaveHomeDate.toLocaleTimeString('fi-FI', {
    hour: '2-digit',
    minute: '2-digit'
  });

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
    recommendedDepartureTime: departureStr,
    departureCountdownMinutes: Math.max(
      0,
      Math.round((leaveHomeDate.getTime() - Date.now()) / 60000)
    ),
    conflictWarning,
    postMatchWhatsAppTemplate: postMatchWhatsApp
  };
}
