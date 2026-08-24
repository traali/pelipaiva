import distance from '@turf/distance';
import { Coordinates, LightningSafetyAlert } from '../../types/matchday';

export interface LightningStrike {
  lat: number;
  lng: number;
  timeIso: string;
  peakCurrentKa?: number;
}

export function compute30_30Rule(
  venueCoords: Coordinates,
  strikes: LightningStrike[],
  referenceTimeMs: number = Date.now()
): LightningSafetyAlert {
  const venuePoint: [number, number] = [venueCoords.lng, venueCoords.lat];

  let nearestStrikeKm: number | undefined;
  let strikesWithin30kmCount = 0;
  let mostRecentStrikeWithin10kmTimeMs: number | undefined;
  // Recency reference for the WATCH tier: newest strike within the 30 km scan.
  let mostRecentStrikeWithin30kmTimeMs: number | undefined;

  for (const strike of strikes) {
    const strikePoint: [number, number] = [strike.lng, strike.lat];
    const distKm = distance(venuePoint, strikePoint, { units: 'kilometers' });

    if (distKm <= 30) {
      strikesWithin30kmCount++;
      if (nearestStrikeKm === undefined || distKm < nearestStrikeKm) {
        nearestStrikeKm = distKm;
      }
      const strikeTimeMs30 = new Date(strike.timeIso).getTime();
      if (!mostRecentStrikeWithin30kmTimeMs || strikeTimeMs30 > mostRecentStrikeWithin30kmTimeMs) {
        mostRecentStrikeWithin30kmTimeMs = strikeTimeMs30;
      }
    }

    if (distKm <= 10) {
      const strikeTimeMs = new Date(strike.timeIso).getTime();
      if (!mostRecentStrikeWithin10kmTimeMs || strikeTimeMs > mostRecentStrikeWithin10kmTimeMs) {
        mostRecentStrikeWithin10kmTimeMs = strikeTimeMs;
      }
    }
  }

  // Evaluate 30/30 Rule
  if (mostRecentStrikeWithin10kmTimeMs) {
    const elapsedMinutes = (referenceTimeMs - mostRecentStrikeWithin10kmTimeMs) / 60000;
    // Clamp negatives: a future-dated strike (clock skew) previously produced a
    // negative elapsed that passed the < 30 test (M-13/V4).
    if (elapsedMinutes >= 0 && elapsedMinutes < 30) {
      const remainingMinutes = Math.ceil(30 - elapsedMinutes);
      return {
        status: 'danger',
        nearestStrikeKm: nearestStrikeKm ? Math.round(nearestStrikeKm * 10) / 10 : undefined,
        strikesWithin30kmCount,
        suspendMatchRecommended: true,
        resumeCountdownMinutes: remainingMinutes,
        downpourWarning: true,
        alertMessage: `⚠️ SALAMAVAARA: Salama havaittu alle 10 km päässä kentältä! Keskeytä ottelu ja siirry sisätiloihin (30/30 sääntö). Turvallinen paluu arviolta ${remainingMinutes} min kuluttua.`
      };
    }
  }

  // `!= null` (not truthiness): a strike at exactly 0 km was skipped before,
  // and the WATCH tier now honors a 30-minute recency on the newest ≤30 km
  // strike — stale fronts no longer trigger WATCH (M-13/V4/V5).
  if (
    nearestStrikeKm != null &&
    nearestStrikeKm <= 20 &&
    mostRecentStrikeWithin30kmTimeMs &&
    referenceTimeMs - mostRecentStrikeWithin30kmTimeMs <= 30 * 60 * 1000
  ) {
    return {
      status: 'watch',
      nearestStrikeKm: Math.round(nearestStrikeKm * 10) / 10,
      strikesWithin30kmCount,
      suspendMatchRecommended: false,
      downpourWarning: false,
      alertMessage: `⚡ UKKOSVAHTI: Ukkosrintama lähestyy (${Math.round(nearestStrikeKm * 10) / 10} km päässä). Seuraa taivasta ja valmistaudu mahdolliseen keskeytykseen.`
    };
  }

  return {
    status: 'clear',
    strikesWithin30kmCount,
    suspendMatchRecommended: false,
    downpourWarning: false
  };
}
