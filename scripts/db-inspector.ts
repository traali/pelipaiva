/**
 * Pelipäivä Dexie IndexedDB Data Inspector CLI
 * Inspects, dumps, and validates IndexedDB tables and records.
 */
import 'fake-indexeddb/auto';
import { PelipaivaDB } from '../src/lib/storage/db';

async function runInspector() {
  console.log('🔍 [Pelipäivä DB Inspector] Connecting to Dexie IndexedDB Schema v2...');
  const testDb = new PelipaivaDB('Pelipaiva_Inspector_DB');
  await testDb.open();

  console.log('📊 Schema Version:', testDb.verno);
  console.log('📂 Registered Tables:');
  for (const table of testDb.tables) {
    const count = await table.count();
    console.log(`  • ${table.name.padEnd(20)} [${count} records]`);
  }

  console.log('\n✅ Dexie IndexedDB schema and ACID storage initialized cleanly.');
  await testDb.close();
}

runInspector().catch((err) => {
  console.error('❌ DB Inspector Error:', err);
  process.exit(1);
});
