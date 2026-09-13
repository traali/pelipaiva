import type { MatchdayEvent, PlayerProfile } from '../../types/matchday';

const PLAYER_SELECTION_PREFIX = 'player:';

function safeDecodeURIComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizePlayerName(value?: string): string {
  return safeDecodeURIComponent(value || '').trim().toLocaleLowerCase();
}

export function groupedPlayerNameFromActiveProfileId(activeProfileId: string): string | undefined {
  if (!activeProfileId.startsWith(PLAYER_SELECTION_PREFIX)) return undefined;
  const playerName = safeDecodeURIComponent(activeProfileId.slice(PLAYER_SELECTION_PREFIX.length)).trim();
  return playerName || undefined;
}

export function activePlayerNameForSelection(
  activeProfileId: string,
  profiles: PlayerProfile[]
): string | undefined {
  return groupedPlayerNameFromActiveProfileId(activeProfileId)
    ?? profiles.find((profile) => profile.id === activeProfileId)?.playerName;
}

export function filterEventsByActiveProfileId(
  events: MatchdayEvent[],
  profiles: PlayerProfile[],
  activeProfileId: string
): MatchdayEvent[] {
  if (activeProfileId === 'all') return events;

  const groupedPlayerName = groupedPlayerNameFromActiveProfileId(activeProfileId);
  if (!groupedPlayerName) {
    return events.filter((event) => event.profileId === activeProfileId);
  }

  const matchingProfileIds = new Set(
    profiles
      .filter((profile) => normalizePlayerName(profile.playerName) === normalizePlayerName(groupedPlayerName))
      .map((profile) => profile.id)
  );

  return events.filter((event) => matchingProfileIds.has(event.profileId));
}
