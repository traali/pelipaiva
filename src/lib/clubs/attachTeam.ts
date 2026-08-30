import type { PlayerProfile } from '../../types/matchday';

/** Stable id for a team/cup URL so the same child is not duplicated. */
export function teamSourceKey(url: string): string {
  const raw = url.trim();
  if (!raw) return '';
  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const u = new URL(normalized);
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    const teamPath = u.pathname.match(/\/team\/(\d+)/i);
    const joukkue = u.searchParams.get('joukkue') || u.searchParams.get('team_id');
    const season =
      u.searchParams.get('season') ||
      u.searchParams.get('turnaus') ||
      u.searchParams.get('competition_id') ||
      '';
    const seasonTag = season ? `:${season.toLowerCase()}` : '';
    if (teamPath?.[1]) return `${host}:${teamPath[1]}${seasonTag}`;
    if (joukkue) return `${host}:${joukkue}${seasonTag}`;
    return `${host}${u.pathname}${u.search}`.toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

export function findExistingTeamProfile(
  profiles: PlayerProfile[],
  playerName: string,
  url: string,
  sport?: string
): PlayerProfile | undefined {
  const name = playerName.trim().toLowerCase();
  const key = teamSourceKey(url);
  if (!name) return undefined;

  // 1. Direct match on calendarUrl, associationUrl, or teamId
  const directMatch = profiles.find((p) => {
    if ((p.playerName || '').trim().toLowerCase() !== name) return false;
    if (key && p.calendarUrl && teamSourceKey(p.calendarUrl) === key) return true;
    if (key && p.associationUrl && teamSourceKey(p.associationUrl) === key) return true;
    const parts = key.split(':');
    const idFromKey = parts[1];
    const seasonFromKey = parts[2];
    if (seasonFromKey) return false;
    return Boolean(p.teamId && idFromKey && p.teamId === idFromKey);
  });
  if (directMatch) return directMatch;

  // 2. If attaching an ICS club calendar to a player who already has an association team for that sport
  const isIcsUrl = /\.ics|webcal:|myclub\.fi|nimenhuuto\.com|jopox\.fi/i.test(url);
  if (isIcsUrl) {
    const candidate = profiles.find((p) => {
      if ((p.playerName || '').trim().toLowerCase() !== name) return false;
      if (sport && sport !== 'football' && p.sport !== sport) return false;
      return Boolean(p.associationUrl && !p.calendarUrl);
    });
    if (candidate) return candidate;
  }

  return undefined;
}

/** Converts child first name to lowercase alphanumeric slug. */
export function slugPlayerName(name: string): string {
  return (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9åäö]/gi, '')
    .substring(0, 24) || 'pelaaja';
}

/** Generates deterministic profile ID: p:{slug(playerName)}:{teamSourceKey(url)} */
export function generateStableProfileId(playerName: string, url: string): string {
  const s = slugPlayerName(playerName);
  const k = teamSourceKey(url);
  return `p:${s}:${k}`;
}

