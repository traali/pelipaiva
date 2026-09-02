import type { HomeLocation, MatchdayEvent, PlayerProfile } from '../../types/matchday';
import { resolveTransitPlan } from '../geo/transitEngine';
import type { FamilyConflict } from './types';
import { estimateDriveMinutes, overlapMinutes } from './time';

function childName(event: MatchdayEvent, profiles: PlayerProfile[]): string {
  return profiles.find((p) => p.id === event.profileId)?.playerName || 'Lapsi';
}

function plusMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

export function conflictAgent(
  events: MatchdayEvent[],
  profiles: PlayerProfile[],
  homeLocation?: HomeLocation
): FamilyConflict[] {
  const upcoming = [...events]
    .filter((e) => e && !e.isHidden && e.attendanceStatus !== 'out')
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const conflicts: FamilyConflict[] = [];

  for (let i = 0; i < upcoming.length; i++) {
    const a = upcoming[i]!;
    for (let j = i + 1; j < upcoming.length; j++) {
      const b = upcoming[j]!;
      if (a.id === b.id) continue;

      // Only check conflicts between events occurring on the same local calendar day
      const dateA = a.startTime.slice(0, 10);
      const dateB = b.startTime.slice(0, 10);
      if (dateA !== dateB) continue;

      // Skip reconciled duplicates: if both events represent the same real-world
      // match from different calendar sources (e.g. MyClub + Torneopal), they share
      // an officialFixtureId or one is a bare fixture of the other. Never conflict.
      if (
        (a.officialFixtureId && b.officialFixtureId && a.officialFixtureId === b.officialFixtureId) ||
        (a.officialFixtureId && b.id === `fixture-${a.profileId}-${a.officialFixtureId}`) ||
        (b.officialFixtureId && a.id === `fixture-${b.profileId}-${b.officialFixtureId}`)
      ) {
        continue;
      }

      const sameVenue = a.venue.normalizedName === b.venue.normalizedName || a.venue.name === b.venue.name;
      const drive = estimateDriveMinutes(
        a.venue?.coordinates?.lat,
        a.venue?.coordinates?.lng,
        b.venue?.coordinates?.lat,
        b.venue?.coordinates?.lng
      );
      const nameA = childName(a, profiles);
      const nameB = childName(b, profiles);
      const isSameChild = nameA.toLowerCase() === nameB.toLowerCase();

      // Check active transit mode for both events from home
      const transitA = a.transit || resolveTransitPlan(homeLocation, a.venue.coordinates, a.weather);
      const transitB = b.transit || resolveTransitPlan(homeLocation, b.venue.coordinates, b.weather);
      const aIsActive = transitA.isSelfTransit;
      const bIsActive = transitB.isSelfTransit;

      // Presence window is warmup → final whistle, not just kickoff → end.
      const overlap = overlapMinutes(a.warmupTime, a.endTime, b.warmupTime, b.endTime);

      if (overlap > 0) {
        if (sameVenue && !isSameChild) continue;

        if (!isSameChild && (aIsActive || bIsActive)) {
          // If BOTH kids travel independently (e.g. L walks to LYK, S bikes to Otaniemi),
          // there is ZERO driving/logistics clash. No driver needed for either kid.
          if (aIsActive && bIsActive) {
            continue;
          }

          const activeChild = aIsActive ? nameA : nameB;
          const activeVenue = aIsActive ? a.venue.name : b.venue.name;
          const activePlan = aIsActive ? transitA : transitB;
          const carChild = aIsActive ? nameB : nameA;
          const transitWord = activePlan.mode === 'walk' ? 'kävellen' : 'pyörällä';

          conflicts.push({
            id: `c-${a.id}-${b.id}`,
            severity: 'info',
            childA: nameA,
            childB: nameB,
            eventAId: a.id,
            eventBId: b.id,
            venueA: a.venue.name,
            venueB: b.venue.name,
            overlapMinutes: overlap,
            travelMinutesEstimate: sameVenue ? 0 : drive,
            isResolvedByActiveTransit: true,
            message: `🟢 Päällekkäisyys ratkaistu: ${activeChild} kulkee kentälle ${activeVenue} ${transitWord} (${activePlan.distanceKm < 1 ? Math.round(activePlan.distanceKm * 1000) + ' m' : activePlan.distanceKm + ' km'}), auto vapaana pelaajalle ${carChild}.`,
            suggestedFix: `${activeChild} menee ${transitWord} lähikentälle (${activePlan.travelMinutes} min). Ei tarvita toista kuskia.`
          });
          continue;
        }

        const severity = isSameChild || (drive > 0 && drive > 25) || overlap > 40 ? 'critical' : 'warn';
        const driveLabel = drive > 0 ? ` — siirtymä ~${drive} min` : '';
        conflicts.push({
          id: `c-${a.id}-${b.id}`,
          severity,
          childA: nameA,
          childB: nameB,
          eventAId: a.id,
          eventBId: b.id,
          venueA: a.venue.name,
          venueB: b.venue.name,
          overlapMinutes: overlap,
          travelMinutesEstimate: sameVenue ? 0 : drive,
          message: isSameChild
            ? `Päällekkäisyys: ${nameA} on merkitty kahteen peliin samaan aikaan (${a.venue.name} & ${b.venue.name}) päällekkäin ${overlap} min.`
            : `Päällekkäisyys: ${nameA} (${a.venue.name}) ja ${nameB} (${b.venue.name}) päällekkäin ${overlap} min${driveLabel}.`,
          suggestedFix: isSameChild
            ? `Ilmoita valmentajalle valinta kumpaan peliin ${nameA} osallistuu.`
            : severity === 'critical'
              ? 'Kaksi kuskia. Sovi kummankin lapsen kyyti etukäteen; älä yritä ehtiä molempiin.'
              : 'Yksi vanhempi per kenttä. Toinen hakee, toinen vie — vaihto ei ehdi.'
        });
        continue;
      }

      if (sameVenue) continue;

      // Expand A's window by drive + 10 min parkki so a warmup that starts
      // during the other match, or a gap shorter than the drive, both flag.
      const travelOverlap = overlapMinutes(
        a.warmupTime,
        plusMinutes(a.endTime, drive + 10),
        b.warmupTime,
        b.endTime
      );
      if (travelOverlap > 0) {
        const gapWarmup = (new Date(b.warmupTime).getTime() - new Date(a.endTime).getTime()) / 60000;
        const gapKickoff = (new Date(b.startTime).getTime() - new Date(a.endTime).getTime()) / 60000;
        const isDriveImpossible = gapKickoff < drive;

        if (!isSameChild && (aIsActive || bIsActive)) {
          if (aIsActive && bIsActive) {
            continue;
          }

          const activeChild = aIsActive ? nameA : nameB;
          const activePlan = aIsActive ? transitA : transitB;
          const carChild = aIsActive ? nameB : nameA;
          const transitWord = activePlan.mode === 'walk' ? 'kävellen' : 'pyörällä';

          conflicts.push({
            id: `c-${a.id}-${b.id}-tight`,
            severity: 'info',
            childA: nameA,
            childB: nameB,
            eventAId: a.id,
            eventBId: b.id,
            venueA: a.venue.name,
            venueB: b.venue.name,
            overlapMinutes: 0,
            travelMinutesEstimate: drive,
            isResolvedByActiveTransit: true,
            message: `🟢 Siirtymä ratkaistu: ${activeChild} kulkee ${transitWord} omatoimisesti, auto vapaana pelaajalle ${carChild}.`,
            suggestedFix: `${activeChild} siirtyy ${transitWord} omatoimisesti.`
          });
          continue;
        }

        const tightDriveLabel = drive > 0 ? ` (ajo ~${drive} min)` : '';
        conflicts.push({
          id: `c-${a.id}-${b.id}-tight`,
          severity: isDriveImpossible || isSameChild ? 'critical' : 'warn',
          childA: nameA,
          childB: nameB,
          eventAId: a.id,
          eventBId: b.id,
          venueA: a.venue.name,
          venueB: b.venue.name,
          overlapMinutes: 0,
          travelMinutesEstimate: drive,
          message: isSameChild
            ? `${nameA}: siirtymäaika (${Math.max(0, Math.round(gapKickoff))} min) ei riitä siirtymään ${a.venue.name} ➔ ${b.venue.name}${tightDriveLabel}.`
            : isDriveImpossible
              ? `Ajoaika ei riitä: ${nameA} (${a.venue.name}) ja ${nameB} (${b.venue.name}) — siirtymäaikaa ${Math.round(gapKickoff)} min${tightDriveLabel}.`
              : `${nameA} lopettaa ${a.venue.name}, ${nameB} alkulämpö ${b.venue.name} — väli ${Math.max(0, Math.round(gapWarmup))} min${tightDriveLabel}.`,
          suggestedFix: isSameChild
            ? `Aikataulu on liian tiukka samalle pelaajalle. Varoita valmentajaa myöhästymisestä.`
            : isDriveImpossible
              ? 'Kaksi kuskia tarvitaan. Yksi auto ei ehdi siirtymää pelien välillä.'
              : 'Lähde suoraan kentältä. Pakkaa kakkosen kassi autoon valmiiksi.'
        });
      }
    }
  }

  // Deduplicate identical conflict messages between the same siblings/venues
  const uniqueList: FamilyConflict[] = [];
  const seenKeys = new Set<string>();
  for (const c of conflicts) {
    const key = `${c.eventAId}-${c.message}-${c.suggestedFix}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueList.push(c);
    }
  }

  return uniqueList;
}
