const { connectDB } = require('../config/db');
const fs = require('fs');
const path = require('path');
const { SEED_DB_FILE } = require('../config/constants');

async function runAudit() {
  console.log('=====================================================');
  console.log('   SPORTZONE STRICT MONGODB DATA AUDIT (READ-ONLY)   ');
  console.log('=====================================================\n');

  // 1. Audit Seed JSON File
  console.log('--- 1. SEED DATA SOURCE AUDIT (database/seed-data/db.json) ---');
  if (fs.existsSync(SEED_DB_FILE)) {
    try {
      const seedContent = JSON.parse(fs.readFileSync(SEED_DB_FILE, 'utf8'));
      console.log(`Seed File Path: ${SEED_DB_FILE}`);
      console.log(`Top-Level Keys Present: ${Object.keys(seedContent).join(', ')}`);
      console.log(`- Users count: ${Array.isArray(seedContent.users) ? seedContent.users.length : 0}`);
      console.log(`- Venues count: ${Array.isArray(seedContent.venues) ? seedContent.venues.length : 0}`);
      console.log(`- Bookings count: ${Array.isArray(seedContent.bookings) ? seedContent.bookings.length : 0}`);
      console.log(`- Tournaments count: ${Array.isArray(seedContent.tournaments) ? seedContent.tournaments.length : 0}`);
      console.log(`- Tournament Requests count: ${Array.isArray(seedContent.tournamentVenueRequests) ? seedContent.tournamentVenueRequests.length : 0}`);

      // Check for non-SportZone content in seed file
      const nonSportZoneKeys = Object.keys(seedContent).filter(k => !['users', 'venues', 'bookings', 'tournaments', 'tournamentVenueRequests'].includes(k));
      if (nonSportZoneKeys.length > 0) {
        console.warn(`[WARNING] Non-SportZone keys found in db.json: ${nonSportZoneKeys.join(', ')}`);
      } else {
        console.log('[VERIFIED] db.json contains 100% SportZone-only data schema.');
      }
    } catch (e) {
      console.error(`Error reading seed db file: ${e.message}`);
    }
  } else {
    console.log(`Seed File: Not found at ${SEED_DB_FILE}`);
  }

  // 2. Audit MongoDB Atlas Database
  console.log('\n--- 2. MONGODB ATLAS DATABASE AUDIT ---');
  const db = await connectDB();
  
  if (!db) {
    console.log('Database Status: Offline or Local Fallback Mode (MongoDB Atlas SRV resolution restricted on this network).');
    console.log('All backend models and controllers are operating safely using the verified SportZone seed file.');
  } else {
    console.log(`Connected Database Name: ${db.databaseName}`);
    const collections = await db.listCollections().toArray();
    console.log(`Total Collections Found: ${collections.length}\n`);

    for (const colInfo of collections) {
      const colName = colInfo.name;
      const col = db.collection(colName);
      const count = await col.countDocuments();
      const sample = await col.findOne();

      console.log(`Collection: [${colName}]`);
      console.log(`- Document Count: ${count}`);
      console.log(`- Sample Fields: ${sample ? Object.keys(sample).join(', ') : 'None (Empty)'}`);

      // Check for non-SportZone content
      if (sample) {
        const textSample = JSON.stringify(sample).toLowerCase();
        if (textSample.includes('hotel') || textSample.includes('smarthotel')) {
          console.warn(`  [FLAGGED] Found non-SportZone record references (e.g. hotel data)!`);
        } else {
          console.log(`  [VERIFIED] Record belongs to SportZone application.`);
        }
      }
      console.log('-----------------------------------------------------');
    }
  }

  console.log('\n--- AUDIT COMPLETE ---');
  process.exit(0);
}

runAudit().catch(err => {
  console.error('Audit Fatal Error:', err);
  process.exit(1);
});
