import type { MatchdayEvent, PlayerProfile } from '../../types/matchday';
import type { FamilyConflict } from './types';
import { estimateDriveMinutes, overlapMinutes } from './time';

function childName(event: MatchdayEvent, profiles: PlayerProfile[]): string {
  return profiles.find((p) => p.id === event.profileId)?.playerName || 'Lapsi';
}

function plusMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
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
      if (a.id === b.id) continue;

      const sameVenue = a.venue.normalizedName === b.venue.normalizedName || a.venue.name === b.venue.name;
      const drive = estimateDriveMinutes(
        a.venue.coordinates.lat,
        a.venue.coordinates.lng,
        b.venue.coordinates.lat,
        b.venue.coordinates.lng
      );
      const nameA = childName(a, profiles);
      const nameB = childName(b, profiles);
      const isSameChild = nameA.toLowerCase() === nameB.toLowerCase();

      // Presence window is warmup → final whistle, not just kickoff → end.
      const overlap = overlapMinutes(a.warmupTime, a.endTime, b.warmupTime, b.endTime);

      if (overlap > 0) {
        if (sameVenue && !isSameChild) continue;

        const severity = isSameChild || drive > 25 || overlap > 40 ? 'critical' : 'warn';
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
            : `Päällekkäisyys: ${nameA} (${a.venue.name}) ja ${nameB} (${b.venue.name}) päällekkäin ${overlap} min — siirtymä ~${drive} min.`,
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
            ? `${nameA}: siirtymäaika (${Math.max(0, Math.round(gapKickoff))} min) ei riitä siirtymään ${a.venue.name} ➔ ${b.venue.name} (ajo ~${drive} min).`
            : isDriveImpossible
              ? `Ajoaika ei riitä: ${nameA} (${a.venue.name}) ja ${nameB} (${b.venue.name}) — siirtymäaikaa ${Math.round(gapKickoff)} min, ajo ~${drive} min.`
              : `${nameA} lopettaa ${a.venue.name}, ${nameB} alkulämpö ${b.venue.name} — väli ${Math.max(0, Math.round(gapWarmup))} min, ajo ~${drive} min.`,
          suggestedFix: isSameChild
            ? `Aikataulu on liian tiukka samalle pelaajalle. Varoita valmentajaa myöhästymisestä.`
            : isDriveImpossible
              ? 'Kaksi kuskia tarvitaan. Yksi auto ei ehdi siirtymää pelien välillä.'
              : 'Lähde suoraan kentältä. Pakkaa kakkosen kassi autoon valmiiksi.'
        });
      }
    }
  }

  return conflicts;
}
