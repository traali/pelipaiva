import { db, PelipaivaDB, CustomVenuePin, CustomAliasRecord } from '../storage/db';
import { PlayerProfile, ArrivalRules } from '../../types/matchday';

export interface FamilyBackupData {
  version: 2;
  exportedAt: string;
  profiles: PlayerProfile[];
  arrivalRules?: ArrivalRules[];
  customAliases?: CustomAliasRecord[];
  venuePins?: CustomVenuePin[];
}

/**
 * Serializes all configured profiles, arrival rules, custom aliases, and venue pins
 * into a JSON string suitable for backup or export.
 */
export async function exportFamilyBackup(databaseInstance: PelipaivaDB = db): Promise<FamilyBackupData> {
  const profiles = await databaseInstance.profiles.toArray();
  const arrivalRules = await databaseInstance.arrivalRules.toArray();
  const customAliases = await databaseInstance.customAliases.toArray();
  const venuePins = await databaseInstance.venuePins.toArray();

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    profiles,
    arrivalRules,
    customAliases,
    venuePins
  };
}

/**
 * Restores family configuration data into Dexie storage.
 * Safely merges and deduplicates profiles, rules, aliases, and pins.
 */
export async function importFamilyBackup(
  backup: FamilyBackupData,
  databaseInstance: PelipaivaDB = db
): Promise<{
  profilesCount: number;
  rulesCount: number;
  aliasesCount: number;
  pinsCount: number;
}> {
  if (!backup || !backup.profiles || !Array.isArray(backup.profiles)) {
    throw new Error('Virheellinen varmuuskopiotiedosto');
  }

  // Restore profiles
  for (const profile of backup.profiles) {
    if (profile && profile.id) {
      await databaseInstance.profiles.put(profile);
    }
  }

  // Restore arrival rules
  if (backup.arrivalRules && Array.isArray(backup.arrivalRules)) {
    for (const rule of backup.arrivalRules) {
      if (rule && rule.profileId) {
        await databaseInstance.arrivalRules.put(rule);
      }
    }
  }

  // Restore custom aliases
  if (backup.customAliases && Array.isArray(backup.customAliases)) {
    for (const alias of backup.customAliases) {
      if (alias && alias.pattern) {
        await databaseInstance.customAliases.put({
          pattern: alias.pattern,
          canonicalClub: alias.canonicalClub,
          createdAt: alias.createdAt || new Date().toISOString()
        });
      }
    }
  }

  // Restore venue pins
  if (backup.venuePins && Array.isArray(backup.venuePins)) {
    for (const pin of backup.venuePins) {
      if (pin && pin.normalizedQuery) {
        await databaseInstance.venuePins.put(pin);
      }
    }
  }

  return {
    profilesCount: backup.profiles.length,
    rulesCount: backup.arrivalRules?.length || 0,
    aliasesCount: backup.customAliases?.length || 0,
    pinsCount: backup.venuePins?.length || 0
  };
}

/**
 * Encodes essential profiles into a lightweight base64 share payload for QR codes / share links.
 */
export function generateSharePayload(profiles: PlayerProfile[]): string {
  const minimal = profiles.map((p) => ({
    id: p.id,
    playerName: p.playerName,
    teamName: p.teamName,
    sport: p.sport,
    calendarUrl: p.calendarUrl,
    colorHex: p.colorHex || '#10b981'
  }));

  const jsonStr = JSON.stringify(minimal);
  // Base64 encoding safe for URLs
  if (typeof btoa !== 'undefined') {
    return encodeURIComponent(btoa(unescape(encodeURIComponent(jsonStr))));
  }
  return encodeURIComponent(Buffer.from(jsonStr).toString('base64'));
}

/**
 * Decodes a share payload back into PlayerProfiles.
 */
export function unpackSharePayload(payload: string): PlayerProfile[] {
  try {
    const decodedUrl = decodeURIComponent(payload);
    let jsonStr: string;
    if (typeof atob !== 'undefined') {
      jsonStr = decodeURIComponent(escape(atob(decodedUrl)));
    } else {
      jsonStr = Buffer.from(decodedUrl, 'base64').toString('utf-8');
    }
    const rawList = JSON.parse(jsonStr);
    if (!Array.isArray(rawList)) return [];

    return rawList.map((item) => ({
      id: item.id || `profile-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      playerName: item.playerName || 'Pelaaja',
      teamName: item.teamName || 'Joukkue',
      sport: item.sport || 'football',
      primaryColor: 'vihreä',
      calendarUrl: item.calendarUrl || '',
      colorHex: item.colorHex || '#10b981'
    }));
  } catch (e) {
    console.error('Failed to unpack share payload:', e);
    return [];
  }
}
