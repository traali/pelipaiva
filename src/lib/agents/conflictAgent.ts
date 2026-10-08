import type { HomeLocation, MatchdayEvent, PlayerProfile } from '../../types/matchday';
import { effectiveTransitPlan } from '../geo/transitEngine';
import type { FamilyConflict } from './types';
import { eventDayKey, isFinishedGame, overlapMinutes } from './time';

/**
 * Back-to-back games at different venues are flagged when the next game's meeting
 * time is less than this many minutes after the previous game ends. Pelipäivä does
 * not know the drive between venues, so it only states the venues and the gap.
 */
export const TIGHT_GAP_MINUTES = 30;

function childName(event: MatchdayEvent, profiles: PlayerProfile[]): string {
  return profiles.find((p) => p.id === event.profileId)?.playerName || 'Lapsi';
}

function formatShortWeekdayDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const label = d.toLocaleDateString('fi-FI', {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
      timeZone: 'Europe/Helsinki'
    });
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return '';
  }
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '';
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  } catch {
    return '';
  }
}

function eventTitle(e: MatchdayEvent): string {
  if (e.homeTeam && e.awayTeam) return `${e.homeTeam} vs ${e.awayTeam}`;
  if (e.title) return e.title;
  return e.venue?.name || 'Tapahtuma';
}

export function conflictAgent(
  events: MatchdayEvent[],
  profiles: PlayerProfile[],
  homeLocation?: HomeLocation,
  /** When given, games already finished at this moment are left out: a clash that is over needs no plan. */
  now?: Date
): FamilyConflict[] {
  const upcoming = [...events]
    .filter((e) => e && !e.isHidden && e.attendanceStatus !== 'out')
    .filter((e) => !now || !isFinishedGame(e, now))
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const conflicts: FamilyConflict[] = [];

  for (let i = 0; i < upcoming.length; i++) {
    const a = upcoming[i]!;
    for (let j = i + 1; j < upcoming.length; j++) {
      const b = upcoming[j]!;
      if (a.id === b.id) continue;

      // Only check conflicts between events occurring on the same local calendar day
      const dateA = eventDayKey(a.startTime);
      const dateB = eventDayKey(b.startTime);
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
      const nameA = childName(a, profiles);
      const nameB = childName(b, profiles);
      const isSameChild = nameA.toLowerCase() === nameB.toLowerCase();
      const dateLabel = formatShortWeekdayDate(a.startTime);
      const titleA = eventTitle(a);
      const titleB = eventTitle(b);
      const timeA = formatTime(a.startTime);
      const timeB = formatTime(b.startTime);

      // Check active transit mode for both events from home
      const transitA = effectiveTransitPlan(a, homeLocation);
      const transitB = effectiveTransitPlan(b, homeLocation);
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
            gapMinutes: 0,
            isResolvedByActiveTransit: true,
            date: dateA,
            formattedDate: dateLabel,
            eventATitle: titleA,
            eventBTitle: titleB,
            eventATime: timeA,
            eventBTime: timeB,
            eventASport: a.sport,
            eventBSport: b.sport,
            message: `🟢 Päällekkäisyys ratkaistu (${dateLabel}): ${activeChild} kulkee kentälle ${activeVenue} ${transitWord} (${activePlan.distanceKm < 1 ? Math.round(activePlan.distanceKm * 1000) + ' m' : activePlan.distanceKm + ' km'}), auto vapaana pelaajalle ${carChild}.`,
            suggestedFix: `${activeChild} menee ${transitWord} lähikentälle (${activePlan.travelMinutes} min). Ei tarvita toista kuskia.`
          });
          continue;
        }

        const severity = isSameChild || overlap > 40 ? 'critical' : 'warn';
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
          gapMinutes: 0,
          date: dateA,
          formattedDate: dateLabel,
          eventATitle: titleA,
          eventBTitle: titleB,
          eventATime: timeA,
          eventBTime: timeB,
          eventASport: a.sport,
          eventBSport: b.sport,
          message: isSameChild
            ? `Päällekkäisyys (${dateLabel}): ${nameA} on merkitty kahteen peliin samaan aikaan: ${titleA} (klo ${timeA} @ ${a.venue.name}) ja ${titleB} (klo ${timeB} @ ${b.venue.name}) — päällekkäin ${overlap} min.`
            : `Päällekkäisyys (${dateLabel}): ${nameA} (${titleA}, klo ${timeA} @ ${a.venue.name}) ja ${nameB} (${titleB}, klo ${timeB} @ ${b.venue.name}) päällekkäin ${overlap} min.`,
          suggestedFix: isSameChild
            ? `Ilmoita valmentajalle valinta kumpaan peliin ${nameA} osallistuu.`
            : severity === 'critical'
              ? 'Kaksi kuskia. Sovi kummankin lapsen kyyti etukäteen; älä yritä ehtiä molempiin.'
              : 'Yksi vanhempi per kenttä. Toinen hakee, toinen vie — vaihto ei ehdi.'
        });
        continue;
      }

      if (sameVenue) continue;

      // Back-to-back at different venues: only facts from the schedule (end time,
      // next meeting time, venue names). No drive estimate between venues.
      const gapToMeet = Math.round((new Date(b.warmupTime).getTime() - new Date(a.endTime).getTime()) / 60000);
      if (gapToMeet >= 0 && gapToMeet < TIGHT_GAP_MINUTES) {
        const endA = formatTime(a.endTime);
        const meetB = formatTime(b.warmupTime);
        const gapText = `väli ${gapToMeet} min (${titleA} päättyy klo ${endA} @ ${a.venue.name}, ${titleB} kokoontuminen klo ${meetB} @ ${b.venue.name})`;

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
            gapMinutes: gapToMeet,
            isResolvedByActiveTransit: true,
            date: dateA,
            formattedDate: dateLabel,
            eventATitle: titleA,
            eventBTitle: titleB,
            eventATime: timeA,
            eventBTime: timeB,
            eventASport: a.sport,
            eventBSport: b.sport,
            message: `🟢 Peräkkäiset pelit ratkaistu (${dateLabel}): ${activeChild} kulkee ${transitWord} omatoimisesti, auto vapaana pelaajalle ${carChild}.`,
            suggestedFix: `${activeChild} kulkee ${transitWord} omatoimisesti.`
          });
          continue;
        }

        conflicts.push({
          id: `c-${a.id}-${b.id}-tight`,
          severity: isSameChild ? 'critical' : 'warn',
          childA: nameA,
          childB: nameB,
          eventAId: a.id,
          eventBId: b.id,
          venueA: a.venue.name,
          venueB: b.venue.name,
          overlapMinutes: 0,
          gapMinutes: gapToMeet,
          date: dateA,
          formattedDate: dateLabel,
          eventATitle: titleA,
          eventBTitle: titleB,
          eventATime: timeA,
          eventBTime: timeB,
          eventASport: a.sport,
          eventBSport: b.sport,
          message: isSameChild
            ? `Peräkkäiset pelit eri kentillä (${dateLabel}): ${nameA}, ${gapText}.`
            : `Peräkkäiset pelit eri kentillä (${dateLabel}): ${nameA} ja ${nameB}, ${gapText}.`,
          suggestedFix: isSameChild
            ? `Kysy valmentajalta, ehtiikö ${nameA} toiseen peliin ajoissa.`
            : `Sovi etukäteen, kuka vie kenetkin: väliä on vain ${gapToMeet} min.`
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
