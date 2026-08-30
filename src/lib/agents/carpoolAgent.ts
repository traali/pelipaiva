import type { HomeLocation, MatchdayEvent, PlayerProfile } from '../../types/matchday';
import { calculateDepartureCountdown } from '../ai/deterministicReasoner';
import type { CarpoolLeg, FamilyConflict } from './types';
import { formatFiTime, helsinkiDateISO } from './time';

/** Same-venue rides share only if the next warmup starts within this gap after this whistle. */
const SHARE_WINDOW_MIN = 90;

function childOf(event: MatchdayEvent, profiles: PlayerProfile[]): PlayerProfile | undefined {
  return profiles.find((p) => p.id === event.profileId);
}

function canShareWithNext(ev: MatchdayEvent, next: MatchdayEvent | undefined): boolean {
  if (!next) return false;
  if (next.profileId === ev.profileId) return false;
  const sameVenue =
    next.venue.name === ev.venue.name || next.venue.normalizedName === ev.venue.normalizedName;
  if (!sameVenue) return false;
  if (helsinkiDateISO(new Date(ev.startTime)) !== helsinkiDateISO(new Date(next.startTime))) return false;
  const gapMin = (new Date(next.warmupTime).getTime() - new Date(ev.endTime).getTime()) / 60000;
  return gapMin < SHARE_WINDOW_MIN;
}

export function carpoolAgent(
  events: MatchdayEvent[],
  profiles: PlayerProfile[],
  conflicts: FamilyConflict[],
  homeLocation?: HomeLocation
): CarpoolLeg[] {
  const sorted = [...events]
    .filter((e) => e && !e.isHidden && e.attendanceStatus !== 'out')
    .sort((a, b) => new Date(a.warmupTime).getTime() - new Date(b.warmupTime).getTime());
  const conflictedIds = new Set(
    conflicts.filter((c) => c.severity !== 'info').flatMap((c) => [c.eventAId, c.eventBId])
  );
  const legs: CarpoolLeg[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i]!;
    const profile = childOf(ev, profiles);
    const childName = profile?.playerName || 'Lapsi';
    const { departureTime, transitPlan } = calculateDepartureCountdown(
      ev,
      profile?.arrivalRules,
      homeLocation
    );
    const next = sorted[i + 1];
    const sameVenueNext = canShareWithNext(ev, next);
    const shareWith = sameVenueNext ? childOf(next!, profiles)?.playerName : undefined;
    const isConflicted = conflictedIds.has(ev.id);

    let driverSlot: CarpoolLeg['driverSlot'] = 'kuski-1';

    if (transitPlan.isSelfTransit) {
      driverSlot = 'oma-kyyti';
    } else if (sameVenueNext) {
      driverSlot = 'yhteiskyyti';
    } else if (isConflicted && i > 0) {
      driverSlot = 'kuski-2';
    }

    const kickoff = formatFiTime(ev.startTime);
    let actionDesc = ev.isTraining ? `Treenit alkavat ${kickoff}` : `Alkulämpö, peli ${kickoff}`;

    if (transitPlan.mode === 'walk') {
      actionDesc = `🚶 Kävellen (${transitPlan.distanceKm < 1 ? Math.round(transitPlan.distanceKm * 1000) + ' m' : transitPlan.distanceKm + ' km'}, ${transitPlan.travelMinutes} min) · ${actionDesc}`;
    } else if (transitPlan.mode === 'bicycle') {
      actionDesc = `🚴 Pyörällä (${transitPlan.distanceKm} km, ${transitPlan.travelMinutes} min) · ${actionDesc}`;
    } else if (transitPlan.mode === 'transit') {
      actionDesc = `🚌 Julkisilla (${transitPlan.travelMinutes} min) · ${actionDesc}`;
    }

    legs.push({
      time: formatFiTime(ev.warmupTime),
      leaveBy: departureTime,
      childName,
      profileId: ev.profileId,
      eventId: ev.id,
      venueName: ev.venue.name,
      action: actionDesc,
      driverSlot,
      canShareRideWith: shareWith,
      transit: transitPlan
    });
  }

  return legs;
}
