try { require('dns').setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const {
  MONGODB_URI,
  MONGODB_DB,
  SEED_DB_FILE,
  DB_FILE,
  DEFAULT_DB,
  TODAY
} = require('./constants');
const { clone, normalizePhone } = require('../utils/helpers');

let mongoClientPromise;

async function getMongoCollection() {
  if (!MONGODB_URI) return null;
  try {
    if (!mongoClientPromise) {
      mongoClientPromise = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 }).connect();
    }
    const client = await mongoClientPromise;
    return client.db(MONGODB_DB).collection('app_state');
  } catch (err) {
    console.error('[MongoDB Atlas Warning]', err.message);
    mongoClientPromise = null;
    return null;
  }
}

function normalizeDB(raw) {
  const users = Array.isArray(raw.users) ? raw.users.map((user, index) => ({
    id: Number(user.id) || index + 1,
    phone: normalizePhone(user.phone || user.mobile || user.email),
    username: user.username,
    password: user.password || '',
    name: user.name || 'SportZone User',
    role: user.role === 'admin' ? 'admin' : 'user',
    status: user.role === 'admin' ? 'Approved' : (user.status || 'Approved')
  })) : [];

  if (!users.some(user => user.role === 'admin')) {
    users.push(clone(DEFAULT_DB.users[0]));
  }

  const legacyVenues = [
    { id: 1, name: 'Arena 7 Football', category: 'Football Turf', fee: 1200, status: 'Approved' },
    { id: 2, name: 'Skyline Basketball', category: 'Basketball', fee: 900, status: 'Approved' },
    { id: 3, name: 'Center Court Tennis', category: 'Tennis', fee: 700, status: 'Approved' },
    { id: 4, name: 'SmashHouse Badminton', category: 'Badminton', fee: 500, status: 'Approved' },
    { id: 5, name: 'Pulse Cricket Ground', category: 'Cricket', fee: 1500, status: 'Approved' }
  ];

  return {
    users,
    venues: Array.isArray(raw.venues) ? raw.venues : legacyVenues,
    bookings: Array.isArray(raw.bookings) ? raw.bookings.map(booking => ({
      ...booking,
      status: booking.status || 'Pending',
      date: booking.date || TODAY()
    })) : [],
    tournaments: Array.isArray(raw.tournaments) ? raw.tournaments : [],
    tournamentVenueRequests: Array.isArray(raw.tournamentVenueRequests) ? raw.tournamentVenueRequests : []
  };
}

function readFileDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const seed = fs.existsSync(SEED_DB_FILE) ? JSON.parse(fs.readFileSync(SEED_DB_FILE, 'utf8')) : DEFAULT_DB;
      writeFileDB(seed);
      return clone(seed);
    }

    const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return normalizeDB(raw);
  } catch (error) {
    console.error('Error reading database file:', error);
    return clone(DEFAULT_DB);
  }
}

async function readDB() {
  const collection = await getMongoCollection();
  if (!collection) return readFileDB();

  const existing = await collection.findOne({ _id: 'sportzone' });
  if (existing) return normalizeDB(existing);

  const seed = fs.existsSync(SEED_DB_FILE) ? JSON.parse(fs.readFileSync(SEED_DB_FILE, 'utf8')) : DEFAULT_DB;
  await collection.updateOne({ _id: 'sportzone' }, { $set: normalizeDB(seed) }, { upsert: true });
  return normalizeDB(seed);
}

function writeFileDB(data) {
  fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function writeDB(data) {
  const normalized = normalizeDB(data);
  const collection = await getMongoCollection();
  if (!collection) {
    writeFileDB(normalized);
    return;
  }
  await collection.updateOne(
    { _id: 'sportzone' },
    { $set: { ...normalized, updatedAt: new Date() } },
    { upsert: true }
  );
}

module.exports = {
  getMongoCollection,
  normalizeDB,
  readFileDB,
  readDB,
  writeFileDB,
  writeDB
};
