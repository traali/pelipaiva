import Dexie, { type Table } from 'dexie';
import { MatchdayEvent, PlayerProfile } from '../../types/matchday';

export interface CustomVenuePin {
  normalizedQuery: string;
  venueName: string;
  lat: number;
  lng: number;
  isIndoor: boolean;
  surface?: string;
  savedAt: string;
}

export interface SyncStateRecord {
  key: string;
  syncKey: string;
  lastSyncedAt: string;
  activeProfileId?: string;
}

export class PelipaivaDB extends Dexie {
  profiles!: Table<PlayerProfile, string>;
  events!: Table<MatchdayEvent, string>;
  venuePins!: Table<CustomVenuePin, string>;
  syncState!: Table<SyncStateRecord, string>;

  constructor() {
    super('PelipaivaDB');
    this.version(1).stores({
      profiles: 'id, teamName, sport',
      events: 'id, profileId, sport, startTime, [profileId+startTime]',
      venuePins: 'normalizedQuery, venueName',
      syncState: 'key, syncKey'
    });
  }
}

export const db = new PelipaivaDB();

export async function ensureStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log(`[PELIPAIVA:STORAGE] Persistent storage granted: ${isPersisted}`);
      return isPersisted;
    } catch (e) {
      console.warn('[PELIPAIVA:STORAGE] Error requesting storage persistence', e);
      return false;
    }
  }
  return false;
}
