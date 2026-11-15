import type { PelipaivaDB } from '../storage/db';
import { db } from '../storage/db';
import { harmonizeStartupSports } from './startupHarmonizer';

/** Apply sport/venue heals to whatever is already in the local DB. */
export async function applyStartupHarmonizerToDb(database: PelipaivaDB = db): Promise<void> {
  const allProfiles = await database.profiles.toArray();
  const allEvents = await database.events.toArray();
  const { profileUpdates, eventUpdates } = harmonizeStartupSports(allProfiles, allEvents);
  for (const pu of profileUpdates) {
    await database.profiles.update(pu.id, pu.updates);
  }
  for (const eu of eventUpdates) {
    await database.events.update(eu.id, eu.updates);
  }
}
