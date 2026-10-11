const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  try { require('dotenv').config({ path: envPath }); } catch (e) {}
}
const uri = process.env.MONGODB_URI || '';

async function uploadSportZone() {
  console.log('Connecting to MongoDB Atlas with public DNS resolver...');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 12000 });
  try {
    await client.connect();
    console.log('SUCCESSFULLY CONNECTED TO MONGODB ATLAS!');
    const db = client.db('sportzone');
    
    const seedFile = path.join(__dirname, '..', '..', 'database', 'seed-data', 'db.json');
    const data = JSON.parse(fs.readFileSync(seedFile, 'utf8'));

    if (data.users && data.users.length) {
      await db.collection('users').deleteMany({});
      await db.collection('users').insertMany(data.users);
      console.log(`Uploaded ${data.users.length} users to Atlas.`);
    }

    if (data.venues && data.venues.length) {
      await db.collection('venues').deleteMany({});
      await db.collection('venues').insertMany(data.venues);
      console.log(`Uploaded ${data.venues.length} venues to Atlas.`);
    }

    if (data.bookings && data.bookings.length) {
      await db.collection('bookings').deleteMany({});
      await db.collection('bookings').insertMany(data.bookings);
      console.log(`Uploaded ${data.bookings.length} bookings to Atlas.`);
    }

    if (data.tournaments && data.tournaments.length) {
      await db.collection('tournaments').deleteMany({});
      await db.collection('tournaments').insertMany(data.tournaments);
      console.log(`Uploaded ${data.tournaments.length} tournaments to Atlas.`);
    }

    if (data.tournamentVenueRequests && data.tournamentVenueRequests.length) {
      await db.collection('tournamentVenueRequests').deleteMany({});
      await db.collection('tournamentVenueRequests').insertMany(data.tournamentVenueRequests);
      console.log(`Uploaded ${data.tournamentVenueRequests.length} tournament requests to Atlas.`);
    }

    await db.collection('app_state').updateOne(
      { _id: 'sportzone' },
      { $set: Object.assign({}, data, { updatedAt: new Date() }) },
      { upsert: true }
    );
    console.log('Uploaded app_state snapshot to Atlas.');

    console.log('\n--- SUCCESS! SPORTZONE DATABASE IS FULLY LIVE ON MONGODB ATLAS ---');
  } catch (err) {
    console.error('Atlas Connection Result:', err.message);
  } finally {
    await client.close();
  }
}

uploadSportZone();
