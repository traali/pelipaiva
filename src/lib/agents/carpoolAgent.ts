import type { MatchdayEvent, PlayerProfile } from '../../types/matchday';
import { calculateDepartureCountdown } from '../ai/deterministicReasoner';
import type { CarpoolLeg, FamilyConflict } from './types';
import { formatFiTime } from './time';

function childOf(event: MatchdayEvent, profiles: PlayerProfile[]): PlayerProfile | undefined {
  return profiles.find((p) => p.id === event.profileId);
}

export function carpoolAgent(
  events: MatchdayEvent[],
  profiles: PlayerProfile[],
  conflicts: FamilyConflict[]
): CarpoolLeg[] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.warmupTime).getTime() - new Date(b.warmupTime).getTime()
  );
  const conflictedIds = new Set(conflicts.filter((c) => c.severity !== 'info').flatMap((c) => [c.eventAId, c.eventBId]));
  const legs: CarpoolLeg[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const ev = sorted[i]!;
    const profile = childOf(ev, profiles);
    const childName = profile?.playerName || 'Lapsi';
    const { departureTime } = calculateDepartureCountdown(ev);
    const next = sorted[i + 1];
    const sameVenueNext =
      next &&
      (next.venue.name === ev.venue.name || next.venue.normalizedName === ev.venue.normalizedName);
    const shareWith = sameVenueNext ? childOf(next, profiles)?.playerName : undefined;
    const isConflicted = conflictedIds.has(ev.id);

    let driverSlot: CarpoolLeg['driverSlot'] = 'kuski-1';
    if (sameVenueNext) driverSlot = 'yhteiskyyti';
    else if (isConflicted && i > 0) driverSlot = 'kuski-2';
    else if (i > 0 && !isConflicted) driverSlot = 'kuski-1';

    const kickoff = formatFiTime(ev.startTime);
    legs.push({
      time: formatFiTime(ev.warmupTime),
      leaveBy: departureTime,
      childName,
      profileId: ev.profileId,
      eventId: ev.id,
      venueName: ev.venue.name,
      action: ev.isTraining
        ? `Treenit alkavat ${kickoff}`
        : `Alkulämpö, peli ${kickoff}`,
      driverSlot,
      canShareRideWith: shareWith
    });
  }

  return legs;
}
