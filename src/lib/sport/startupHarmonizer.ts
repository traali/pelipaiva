import type { MatchdayEvent, PitchSurface, PlayerProfile } from '../../types/matchday';
import { detectSportFromText } from '../ai/eventCandidateRanker';

export interface HarmonizationResult {
  profileUpdates: Array<{ id: string; updates: Partial<PlayerProfile> }>;
  eventUpdates: Array<{ id: string; updates: Partial<MatchdayEvent> }>;
}

/**
 * Pure, non-destructive startup harmonizer for multi-sport profiles and events.
 * Reconciles profile sports and fixes corrupted event sports without clobbering
 * legitimate multi-sport schedules.
 */
export function harmonizeStartupSports(
  profiles: PlayerProfile[],
  events: MatchdayEvent[]
): HarmonizationResult {
  const profileUpdates: Array<{ id: string; updates: Partial<PlayerProfile> }> = [];
  const eventUpdates: Array<{ id: string; updates: Partial<MatchdayEvent> }> = [];

  // Effective in-memory profiles map for event reconciliation
  const effectiveProfiles = new Map<string, PlayerProfile>();

  // 1. Reconcile Profiles
  for (const p of profiles) {
    const pUpdates: Partial<PlayerProfile> = {};
    const metaText = `${p.teamName || ''} ${p.associationUrl || ''} ${p.calendarUrl || ''}`.trim();
    const detectedSport = detectSportFromText(metaText);

    // If profile has no sport set, heal it from detected sport
    if (!p.sport && detectedSport) {
      pUpdates.sport = detectedSport;
    } else if (p.sport === 'football' && detectedSport && detectedSport !== 'football') {
      // If profile was defaulted to football, but teamName or associationUrl clearly belongs to another sport
      const isActuallyFootball = /ppj|pallo-pojat|hjk|futis|jalkapallo|palloliitto/i.test(p.teamName || '');
      if (!isActuallyFootball) {
        pUpdates.sport = detectedSport;
      }
    }

    // Clean up corrupted calendarUrl (e.g. association URL mistakenly placed in calendar field)
    if (p.calendarUrl) {
      const rawCal = p.calendarUrl.trim();
      if (!rawCal.startsWith('http://') && !rawCal.startsWith('https://') && !rawCal.startsWith('webcal://')) {
        pUpdates.calendarUrl = undefined;
      } else if (
        rawCal.includes('tulospalvelu.') ||
        rawCal.includes('basket.fi') ||
        rawCal.includes('torneopal.fi')
      ) {
        if (!p.associationUrl) {
          pUpdates.associationUrl = rawCal;
        }
        pUpdates.calendarUrl = undefined;
      }
    }

    if (Object.keys(pUpdates).length > 0) {
      profileUpdates.push({ id: p.id, updates: pUpdates });
      effectiveProfiles.set(p.id, { ...p, ...pUpdates });
    } else {
      effectiveProfiles.set(p.id, p);
    }
  }

  // 2. Reconcile Events
  for (const ev of events) {
    const updates: Partial<MatchdayEvent> = {};
    let needsUpdate = false;

    const profile = effectiveProfiles.get(ev.profileId);
    const textSport = detectSportFromText(`${ev.title} ${ev.notes || ''}`);

    // Reconcile Sport:
    // Rule A: Title or notes unambiguously indicate a sport different from ev.sport
    if (textSport && textSport !== ev.sport) {
      // Re-heal if ev.sport was defaulted/corrupted to football or is undefined.
      // Generic conditioning words ("fysiikkatreenit") must not strip a real
      // football event of its sport — only fill 'training' when sport is missing.
      if (!ev.sport || (ev.sport === 'football' && textSport !== 'training')) {
        updates.sport = textSport;
        needsUpdate = true;
      }
    } else if (!ev.sport && profile?.sport) {
      // Rule B: Missing sport, assign from profile
      updates.sport = profile.sport;
      needsUpdate = true;
    } else if (
      ev.sport === 'football' &&
      profile?.sport &&
      profile.sport !== 'football'
    ) {
      // Rule C: Event is attached to a non-football profile (e.g. ice hockey or basketball team),
      // but ev.sport was clobbered to football by legacy App.tsx loop.
      // Re-heal to profile.sport unless event text specifically contains football terms.
      const hasExplicitFootballText = /ppj|pallo-pojat|hjk|futis|jalkapallo|palloliitto/i.test(
        `${ev.title} ${ev.notes || ''}`
      );
      if (!hasExplicitFootballText) {
        updates.sport = profile.sport;
        needsUpdate = true;
      }
    }

    // Reconcile Venues & Surfaces:
    const venueName = `${ev.venue?.name || ''} ${ev.venue?.normalizedName || ''}`;

    // Venue 1: Pyrkkä / Lauttasaaren urheilupuisto coordinates
    const isPyrkka = /pyrkkä|lauttasaaren urheilupuisto|lahnalahdentie/i.test(venueName);
    if (
      isPyrkka &&
      ev.venue &&
      (Math.abs((ev.venue.coordinates?.lat || 0) - 60.16357) > 0.001 ||
        Math.abs((ev.venue.coordinates?.lng || 0) - 24.86750) > 0.001)
    ) {
      updates.venue = {
        ...ev.venue,
        name: 'Lauttasaaren urheilupuisto "Pyrkkä"',
        normalizedName: 'lauttasaaren urheilupuisto pyrkkä',
        coordinates: { lat: 60.16357, lng: 24.86750 },
        isIndoor: false,
        surface: 'artificial_turf_3g',
        hasFloodlights: true
      };
      needsUpdate = true;
    }

    // Venue 2: School gymnasiums (e.g. LYK, lukio, yhteiskoulu)
    const isLyk = /yhteiskoulu|lyk/i.test(ev.venue?.name || '');
    const isSchoolGym = /lukio|yhteiskoulu|lyk|myk|phyk|syk|tyk/i.test(ev.venue?.name || '');
    if (isSchoolGym && ev.venue && (!ev.venue.isIndoor || ev.venue.surface === 'artificial_turf_3g')) {
      const currentVenue = updates.venue || ev.venue;
      const baseName = currentVenue.name || '';
      updates.venue = {
        ...currentVenue,
        name: baseName.includes('LYK') ? baseName : isLyk ? `${baseName} (LYK)` : baseName,
        isIndoor: true,
        surface: 'indoor_parquet'
      };
      needsUpdate = true;
    }

    // Venue 3: Ice rinks and halls
    const isIceVenue = /jäähalli|jääurheilukeskus|harjoitusjäähalli|kaukalo|tekojää/i.test(venueName);
    if (isIceVenue && ev.venue && (ev.venue.surface !== 'ice' || (!ev.venue.isIndoor && !/tekojää/i.test(venueName)))) {
      const currentVenue = updates.venue || ev.venue;
      const isIndoorIce = !/ulkotejo|tekojää/i.test(currentVenue.name || '');
      updates.venue = {
        ...currentVenue,
        isIndoor: isIndoorIce,
        surface: 'ice' as PitchSurface
      };
      needsUpdate = true;
    }

    if (needsUpdate) {
      eventUpdates.push({ id: ev.id, updates });
    }
  }

  return { profileUpdates, eventUpdates };
}
