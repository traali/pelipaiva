import type { MatchdayEvent, PlayerProfile } from '../../types/matchday';
import type { FamilyConflict } from './types';
import { estimateDriveMinutes, overlapMinutes } from './time';

function childName(event: MatchdayEvent, profiles: PlayerProfile[]): string {
  return profiles.find((p) => p.id === event.profileId)?.playerName || 'Lapsi';
}

export function conflictAgent(events: MatchdayEvent[], profiles: PlayerProfile[]): FamilyConflict[] {
  const upcoming = [...events].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  const conflicts: FamilyConflict[] = [];

  for (let i = 0; i < upcoming.length; i++) {
    const a = upcoming[i]!;
    for (let j = i + 1; j < upcoming.length; j++) {
      const b = upcoming[j]!;
      if (a.profileId === b.profileId) continue;

      const overlap = overlapMinutes(a.startTime, a.endTime, b.startTime, b.endTime);
      const gapToB = (new Date(b.warmupTime).getTime() - new Date(a.endTime).getTime()) / 60000;
      const sameVenue = a.venue.normalizedName === b.venue.normalizedName || a.venue.name === b.venue.name;
      const drive = estimateDriveMinutes(
        a.venue.coordinates.lat,
        a.venue.coordinates.lng,
        b.venue.coordinates.lat,
        b.venue.coordinates.lng
      );
      const nameA = childName(a, profiles);
      const nameB = childName(b, profiles);

      if (overlap > 0 && !sameVenue) {
        const severity = drive > 25 || overlap > 40 ? 'critical' : 'warn';
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
          travelMinutesEstimate: drive,
          message: `${nameA} (${a.venue.name}) ja ${nameB} (${b.venue.name}) päällekkäin ${overlap} min — siirtymä ~${drive} min.`,
          suggestedFix:
            severity === 'critical'
              ? 'Kaksi kuskia. Sovi kummankin lapsen kyyti etukäteen; älä yritä ehtiä molempiin.'
              : 'Yksi vanhempi per kenttä. Toinen hakee, toinen vie — vaihto ei ehdi.'
        });
      } else if (!sameVenue && gapToB >= 0 && gapToB < drive + 10) {
        conflicts.push({
          id: `c-${a.id}-${b.id}-tight`,
          severity: 'warn',
          childA: nameA,
          childB: nameB,
          eventAId: a.id,
          eventBId: b.id,
          venueA: a.venue.name,
          venueB: b.venue.name,
          overlapMinutes: 0,
          travelMinutesEstimate: drive,
          message: `${nameA} lopettaa ${a.venue.name}, ${nameB} alkulämpö ${b.venue.name} — väli ${Math.round(gapToB)} min, ajo ~${drive} min.`,
          suggestedFix: 'Lähde suoraan kentältä. Pakkaa kakkosen kassi autoon valmiiksi.'
        });
      }
    }
  }

  return conflicts;
}
