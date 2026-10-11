const path = require('path');
const fs = require('fs');

// Load environment variables from backend/.env if present
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  try {
    require('dotenv').config({ path: envPath });
  } catch (e) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...vals] = trimmed.split('=');
        process.env[key.trim()] = vals.join('=').trim();
      }
    }
  }
}

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'sportzone_super_secret_key_12345';
const IS_VERCEL = Boolean(process.env.VERCEL);
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB = process.env.MONGODB_DB || 'sportzone';
const SEED_DB_FILE = path.join(__dirname, '..', '..', 'database', 'seed-data', 'db.json');
const DB_FILE = IS_VERCEL ? path.join('/tmp', 'sportzone-db.json') : SEED_DB_FILE;

const TODAY = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
};

const TIME_SLOTS = ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];

const DEFAULT_DB = {
  users: [
    { id: 100, username: 'admin', phone: '9000000000', password: 'admin123', name: 'SportZone Admin', role: 'admin', status: 'Approved' }
  ],
  venues: [
    { id: 1, name: 'Arena 7 Football', category: 'Football Turf', fee: 1200, status: 'Approved' },
    { id: 2, name: 'Skyline Basketball', category: 'Basketball', fee: 900, status: 'Approved' },
    { id: 3, name: 'Center Court Tennis', category: 'Tennis', fee: 700, status: 'Approved' },
    { id: 4, name: 'SmashHouse Badminton', category: 'Badminton', fee: 500, status: 'Approved' },
    { id: 5, name: 'Pulse Cricket Ground', category: 'Cricket', fee: 1500, status: 'Approved' }
  ],
  bookings: [],
  tournaments: [],
  tournamentVenueRequests: []
};

module.exports = {
  PORT,
  JWT_SECRET,
  IS_VERCEL,
  MONGODB_URI,
  MONGODB_DB,
  SEED_DB_FILE,
  DB_FILE,
  TODAY,
  TIME_SLOTS,
  DEFAULT_DB
};
