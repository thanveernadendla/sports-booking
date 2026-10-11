const fs = require('fs');
const path = require('path');
const { connectDB } = require('../config/db');
const { SEED_DB_FILE, DEFAULT_DB } = require('../config/constants');
const { normalizeDB } = require('../config/database');

async function migrate() {
  console.log('--- STARTING MONGODB ATLAS DATA MIGRATION ---');

  const db = await connectDB();
  if (!db) {
    console.error('Migration aborted: Unable to establish MongoDB Atlas connection.');
    process.exit(1);
  }

  let rawData = DEFAULT_DB;
  if (fs.existsSync(SEED_DB_FILE)) {
    try {
      rawData = JSON.parse(fs.readFileSync(SEED_DB_FILE, 'utf8'));
      console.log(`Loaded seed database file from: ${SEED_DB_FILE}`);
    } catch (e) {
      console.warn(`Error reading seed db file: ${e.message}, using default fallback.`);
    }
  }

  const dbState = normalizeDB(rawData);

  const stats = {
    users: { read: dbState.users.length, imported: 0, skipped: 0, failed: 0 },
    venues: { read: dbState.venues.length, imported: 0, skipped: 0, failed: 0 },
    bookings: { read: dbState.bookings.length, imported: 0, skipped: 0, failed: 0 },
    tournaments: { read: dbState.tournaments.length, imported: 0, skipped: 0, failed: 0 },
    tournamentVenueRequests: { read: dbState.tournamentVenueRequests.length, imported: 0, skipped: 0, failed: 0 }
  };

  // 1. App State sync
  try {
    await db.collection('app_state').updateOne({ _id: 'sportzone' }, { $set: { ...dbState, updatedAt: new Date() } }, { upsert: true });
  } catch (e) {
    console.error('Failed to sync app_state:', e.message);
  }

  // 2. Individual Collections
  for (const item of dbState.users) {
    try {
      const res = await db.collection('users').updateOne({ id: item.id }, { $set: item }, { upsert: true });
      if (res.upsertedCount > 0 || res.modifiedCount > 0) stats.users.imported++; else stats.users.skipped++;
    } catch (e) { stats.users.failed++; }
  }

  for (const item of dbState.venues) {
    try {
      const res = await db.collection('venues').updateOne({ id: item.id }, { $set: item }, { upsert: true });
      if (res.upsertedCount > 0 || res.modifiedCount > 0) stats.venues.imported++; else stats.venues.skipped++;
    } catch (e) { stats.venues.failed++; }
  }

  for (const item of dbState.bookings) {
    try {
      const res = await db.collection('bookings').updateOne({ id: item.id }, { $set: item }, { upsert: true });
      if (res.upsertedCount > 0 || res.modifiedCount > 0) stats.bookings.imported++; else stats.bookings.skipped++;
    } catch (e) { stats.bookings.failed++; }
  }

  for (const item of dbState.tournaments) {
    try {
      const res = await db.collection('tournaments').updateOne({ id: item.id }, { $set: item }, { upsert: true });
      if (res.upsertedCount > 0 || res.modifiedCount > 0) stats.tournaments.imported++; else stats.tournaments.skipped++;
    } catch (e) { stats.tournaments.failed++; }
  }

  for (const item of dbState.tournamentVenueRequests) {
    try {
      const res = await db.collection('tournamentVenueRequests').updateOne({ id: item.id }, { $set: item }, { upsert: true });
      if (res.upsertedCount > 0 || res.modifiedCount > 0) stats.tournamentVenueRequests.imported++; else stats.tournamentVenueRequests.skipped++;
    } catch (e) { stats.tournamentVenueRequests.failed++; }
  }

  console.log('\n=========================================');
  console.log('   MONGODB ATLAS MIGRATION REPORT       ');
  console.log('=========================================');
  console.table(stats);
  console.log('Migration process completed successfully.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration Fatal Error:', err);
  process.exit(1);
});
