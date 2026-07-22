const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sportzone_super_secret_key_12345';
const IS_VERCEL = Boolean(process.env.VERCEL);
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB = process.env.MONGODB_DB || 'sportzone';
const SEED_DB_FILE = path.join(__dirname, 'data', 'db.json');
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
let mongoClientPromise;

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

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

function nextId(items) {
  return items.length ? Math.max(...items.map(item => Number(item.id) || 0)) + 1 : 1;
}

async function getMongoCollection() {
  if (!MONGODB_URI) return null;
  if (!mongoClientPromise) {
    mongoClientPromise = new MongoClient(MONGODB_URI).connect();
  }
  const client = await mongoClientPromise;
  return client.db(MONGODB_DB).collection('app_state');
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

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function publicUser(user) {
  return {
    id: user.id,
    phone: user.phone,
    username: user.username,
    name: user.name,
    role: user.role,
    status: user.status
  };
}

function signUser(user) {
  return jwt.sign(publicUser(user), JWT_SECRET, { expiresIn: '24h' });
}

function activeVenues(db) {
  return db.venues.filter(venue => venue.status === 'Approved');
}

function getVenue(db, venueName) {
  return db.venues.find(venue => venue.name === venueName);
}

function getVenueFee(db, venueName) {
  const venue = getVenue(db, venueName);
  return venue ? Number(venue.fee) : 0;
}

function formatINR(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Login required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired login' });
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

async function requireActiveCustomer(req, res, next) {
  const db = await readDB();
  const user = db.users.find(item => item.id === req.user.id && item.role === 'user');
  if (!user) return res.status(403).json({ error: 'Customer account required' });
  if (['Rejected', 'Blocked'].includes(user.status)) return res.status(403).json({ error: 'Your account is not active. Please contact admin.' });
  req.customer = user;
  next();
}

function isSlotBlocked(bookings, venue, time, date = TODAY()) {
  return bookings.some(booking =>
    booking.venue === venue &&
    booking.time === time &&
    booking.date === date &&
    ['Pending', 'Approved'].includes(booking.status)
  );
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/auth', (req, res) => res.sendFile(path.join(__dirname, 'public', 'auth.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-login.html')));
app.get('/admin-dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html')));
app.get('/compare', (req, res) => res.sendFile(path.join(__dirname, 'public', 'compare.html')));

app.get('/api/config', asyncHandler(async (req, res) => {
  const db = await readDB();
  res.json({ venues: activeVenues(db), timeSlots: TIME_SLOTS, currency: 'INR' });
}));

app.post('/api/auth/register', asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const { password, name } = req.body;
  if (!phone || phone.length !== 10 || !password || !name) {
    return res.status(400).json({ error: 'Name, 10 digit mobile number, and password are required' });
  }

  const db = await readDB();
  if (db.users.some(user => user.phone === phone && user.role === 'user')) {
    return res.status(400).json({ error: 'An account already exists with this mobile number' });
  }

  const user = { id: nextId(db.users), phone, password, name, role: 'user', status: 'Approved' };
  db.users.push(user);
  await writeDB(db);
  res.status(201).json({ token: signUser(user), message: 'Registration complete. You can book slots now.', user: publicUser(user) });
}));

app.post('/api/auth/login', asyncHandler(async (req, res) => {
  const phone = normalizePhone(req.body.phone);
  const { password } = req.body;
  if (!phone || !password) return res.status(400).json({ error: 'Mobile number and password are required' });

  const db = await readDB();
  const user = db.users.find(item => item.role === 'user' && item.phone === phone && item.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid mobile number or password' });
  if (['Rejected', 'Blocked'].includes(user.status)) return res.status(403).json({ error: `Your account is ${user.status}. Please contact admin.` });

  res.json({ token: signUser(user), user: publicUser(user) });
}));

app.post('/api/admin/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const db = await readDB();
  const admin = db.users.find(user =>
    user.role === 'admin' &&
    (user.username === username || user.phone === normalizePhone(username)) &&
    user.password === password
  );
  if (!admin) return res.status(401).json({ error: 'Invalid admin login' });
  res.json({ token: signUser(admin), user: publicUser(admin) });
}));

app.get('/api/auth/me', authenticateToken, (req, res) => res.json({ user: req.user }));

app.get('/api/bookings', asyncHandler(async (req, res) => {
  const db = await readDB();
  res.json(db.bookings.filter(booking => booking.date === TODAY() && booking.status !== 'Rejected'));
}));

app.get('/api/slots', asyncHandler(async (req, res) => {
  const db = await readDB();
  const venueName = req.query.venue;
  const date = req.query.date || TODAY();
  const venues = venueName ? activeVenues(db).filter(venue => venue.name === venueName) : activeVenues(db);
  res.json({
    date,
    venues: venues.map(venue => ({
      ...venue,
      slots: TIME_SLOTS.map(time => ({ time, available: !isSlotBlocked(db.bookings, venue.name, time, date) }))
        .filter(slot => slot.available)
    }))
  });
}));

app.post('/api/bookings', authenticateToken, asyncHandler(requireActiveCustomer), asyncHandler(async (req, res) => {
  const { time, venue, team } = req.body;
  const db = await readDB();
  const venueInfo = getVenue(db, venue);
  const date = TODAY();

  if (!time || !venue || !team || !venueInfo || venueInfo.status !== 'Approved') {
    return res.status(400).json({ error: 'Approved venue, time, and team name are required' });
  }
  if (!TIME_SLOTS.includes(time)) return res.status(400).json({ error: 'Please choose a valid slot time' });
  if (isSlotBlocked(db.bookings, venue, time, date)) {
    return res.status(409).json({ error: 'This slot is already requested or booked. Please choose another time.' });
  }

  const booking = {
    id: nextId(db.bookings),
    time,
    venue,
    team,
    status: 'Pending',
    date,
    userId: req.user.id,
    customerName: req.customer.name,
    customerPhone: req.customer.phone,
    fee: Number(venueInfo.fee)
  };
  db.bookings.push(booking);
  await writeDB(db);
  res.status(201).json(booking);
}));

app.post('/api/tournament-venue-requests', authenticateToken, asyncHandler(requireActiveCustomer), asyncHandler(async (req, res) => {
  const { tournamentName, venue, requestedDate, notes } = req.body;
  const db = await readDB();
  const venueInfo = getVenue(db, venue);
  if (!tournamentName || !venueInfo || venueInfo.status !== 'Approved') {
    return res.status(400).json({ error: 'Tournament name and approved venue are required' });
  }

  const request = {
    id: nextId(db.tournamentVenueRequests),
    tournamentName,
    venue,
    requestedDate: requestedDate || TODAY(),
    notes: notes || '',
    status: 'Pending',
    userId: req.user.id,
    customerName: req.customer.name,
    customerPhone: req.customer.phone
  };
  db.tournamentVenueRequests.push(request);
  await writeDB(db);
  res.status(201).json(request);
}));

app.delete('/api/bookings/:id', authenticateToken, asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const db = await readDB();
  const booking = db.bookings.find(item => item.id === id);
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (req.user.role !== 'admin' && booking.userId !== req.user.id) return res.status(403).json({ error: 'You can remove only your own bookings' });

  db.bookings = db.bookings.filter(item => item.id !== id);
  await writeDB(db);
  res.json({ success: true });
}));

app.get('/api/dashboard/stats', asyncHandler(async (req, res) => {
  const db = await readDB();
  const todaysBookings = db.bookings.filter(booking => booking.date === TODAY() && booking.status !== 'Rejected');
  const approvedBookings = todaysBookings.filter(booking => booking.status === 'Approved');
  const revenue = approvedBookings.reduce((sum, booking) => sum + Number(booking.fee || getVenueFee(db, booking.venue)), 0);
  res.json({
    bookingsToday: todaysBookings.length,
    pendingBookings: todaysBookings.filter(booking => booking.status === 'Pending').length,
    activeTournaments: db.tournaments.filter(item => item.status !== 'Closed').length,
    activePlayers: db.users.filter(user => user.role === 'user' && user.status === 'Approved').length,
    revenueMonthly: formatINR(revenue),
    revenueValue: revenue,
    registeredAccounts: db.users.filter(user => user.role === 'user').length,
    availableSlots: activeVenues(db).length * TIME_SLOTS.length - todaysBookings.length
  });
}));

app.get('/api/admin/dashboard', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const db = await readDB();
  const todaysBookings = db.bookings.filter(booking => booking.date === TODAY() && booking.status !== 'Rejected');
  const approvedBookings = todaysBookings.filter(booking => booking.status === 'Approved');
  const revenue = approvedBookings.reduce((sum, booking) => sum + Number(booking.fee || getVenueFee(db, booking.venue)), 0);
  res.json({
    stats: {
      bookingsToday: todaysBookings.length,
      pendingUsers: db.users.filter(user => user.role === 'user' && user.status === 'Pending').length,
      pendingBookings: db.bookings.filter(booking => booking.status === 'Pending').length,
      pendingVenueRequests: db.tournamentVenueRequests.filter(request => request.status === 'Pending').length,
      revenue: formatINR(revenue),
      users: db.users.filter(user => user.role === 'user').length,
      venues: db.venues.length,
      tournaments: db.tournaments.length,
      availableSlots: activeVenues(db).length * TIME_SLOTS.length - todaysBookings.length
    },
    users: db.users.filter(user => user.role === 'user').map(publicUser),
    venues: db.venues.map(venue => ({
      ...venue,
      booked: todaysBookings.filter(booking => booking.venue === venue.name).length,
      available: TIME_SLOTS.length - todaysBookings.filter(booking => booking.venue === venue.name).length
    })),
    bookings: db.bookings,
    tournaments: db.tournaments,
    tournamentVenueRequests: db.tournamentVenueRequests
  });
}));

app.patch('/api/admin/users/:id/status', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const db = await readDB();
  const user = db.users.find(item => item.id === Number(req.params.id) && item.role === 'user');
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!['Approved', 'Rejected', 'Pending', 'Blocked'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
  user.status = req.body.status;
  await writeDB(db);
  res.json(user);
}));

app.post('/api/admin/venues', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { name, category, fee } = req.body;
  if (!name || !category || !fee) return res.status(400).json({ error: 'Venue name, category, and fee are required' });
  const db = await readDB();
  const venue = { id: nextId(db.venues), name, category, fee: Number(fee), status: 'Approved' };
  db.venues.push(venue);
  await writeDB(db);
  res.status(201).json(venue);
}));

app.patch('/api/admin/venues/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const db = await readDB();
  const venue = db.venues.find(item => item.id === Number(req.params.id));
  if (!venue) return res.status(404).json({ error: 'Venue not found' });
  ['name', 'category', 'status'].forEach(key => {
    if (req.body[key]) venue[key] = req.body[key];
  });
  if (req.body.fee !== undefined) venue.fee = Number(req.body.fee);
  await writeDB(db);
  res.json(venue);
}));

app.post('/api/admin/tournaments', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const { name, sport, startDate, venue } = req.body;
  if (!name || !sport) return res.status(400).json({ error: 'Tournament name and sport are required' });
  const db = await readDB();
  const tournament = { id: nextId(db.tournaments), name, sport, startDate: startDate || TODAY(), venue: venue || '', status: 'Open' };
  db.tournaments.push(tournament);
  await writeDB(db);
  res.status(201).json(tournament);
}));

app.patch('/api/admin/tournaments/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const db = await readDB();
  const tournament = db.tournaments.find(item => item.id === Number(req.params.id));
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
  ['name', 'sport', 'startDate', 'venue', 'status'].forEach(key => {
    if (req.body[key]) tournament[key] = req.body[key];
  });
  await writeDB(db);
  res.json(tournament);
}));

app.patch('/api/admin/bookings/:id/status', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const db = await readDB();
  const booking = db.bookings.find(item => item.id === Number(req.params.id));
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (!['Approved', 'Rejected', 'Pending'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
  booking.status = req.body.status;
  await writeDB(db);
  res.json(booking);
}));

app.patch('/api/admin/tournament-venue-requests/:id/status', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
  const db = await readDB();
  const request = db.tournamentVenueRequests.find(item => item.id === Number(req.params.id));
  if (!request) return res.status(404).json({ error: 'Tournament venue request not found' });
  if (!['Approved', 'Rejected', 'Pending'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
  request.status = req.body.status;
  await writeDB(db);
  res.json(request);
}));

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: 'Server error. Please try again.' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SportZone Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
