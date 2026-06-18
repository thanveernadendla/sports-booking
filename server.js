const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'sportzone_super_secret_key_12345';
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const ONLINE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const onlineUsers = new Map();

const venuePrices = {
  'Arena 7 Football': 120,
  'Skyline Basketball': 100,
  'Center Court Tennis': 90,
  'SmashHouse Badminton': 80,
  'Pulse Cricket Ground': 150,
  'Test Arena': 130
};

function getVenuePrice(venue) {
  return venuePrices[venue] || 0;
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper functions for DB access
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return { users: [], bookings: [], utilization: {} };
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database file:', error);
    return { users: [], bookings: [], utilization: {} };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing database file:', error);
  }
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    onlineUsers.set(user.id, Date.now());
    next();
  });
}

// Clean UI Routing (URLs without .html extension)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/compare', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'compare.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/auth', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'auth.html'));
});

app.get('/venues', (req, res) => {
  res.redirect('/#venues-section');
});

app.get('/tournaments', (req, res) => {
  res.redirect('/#tournaments-section');
});

// API Routes

// Register
app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  const db = readDB();
  const existingUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists with this email' });
  }

  const newUser = {
    id: db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1,
    email: email.toLowerCase(),
    password, // Plain text simple authentication for demo purposes
    name
  };

  db.users.push(newUser);
  writeDB(db);

  const token = jwt.sign({ id: newUser.id, email: newUser.email, name: newUser.name }, JWT_SECRET, { expiresIn: '24h' });
  res.status(201).json({ token, user: { id: newUser.id, email: newUser.email, name: newUser.name } });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const db = readDB();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

// Current User Details
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Get user bookings
app.get('/api/bookings', authenticateToken, (req, res) => {
  const db = readDB();
  const userBookings = db.bookings.filter(b => b.userId === req.user.id);
  res.json(userBookings);
});

// Create new Booking (Protected)
app.post('/api/bookings', authenticateToken, (req, res) => {
  const { time, venue, team } = req.body;
  if (!time || !venue || !team) {
    return res.status(400).json({ error: 'Time, venue, and team/name are required' });
  }

  const db = readDB();
  const bookingDate = new Date().toISOString().slice(0, 10);

  // Prevent tournaments from being booked at the same time on the same day
  const existingBooking = db.bookings.find(b => 
    b.time === time && 
    b.date === bookingDate
  );

  if (existingBooking) {
    return res.status(409).json({ error: `A tournament is already scheduled at ${time}. Please choose a different time.` });
  }

  const price = getVenuePrice(venue);
  const newBooking = {
    id: db.bookings.length > 0 ? Math.max(...db.bookings.map(b => b.id)) + 1 : 1,
    userId: req.user.id,
    time,
    venue,
    team,
    price,
    status: 'Confirmed',
    date: bookingDate // Anchored to the app's current date for demonstration
  };

  db.bookings.push(newBooking);

  // Dynamically update utilization for the booked venue type
  let category = '';
  if (venue.toLowerCase().includes('football')) category = 'Football Turf';
  else if (venue.toLowerCase().includes('basketball')) category = 'Basketball';
  else if (venue.toLowerCase().includes('tennis')) category = 'Tennis';
  else if (venue.toLowerCase().includes('badminton')) category = 'Badminton';
  else if (venue.toLowerCase().includes('cricket')) category = 'Cricket';

  if (category && db.utilization[category] !== undefined) {
    // Increase utilization slightly with each booking, maxing at 100%
    db.utilization[category] = Math.min(db.utilization[category] + 3, 100);
  }

  writeDB(db);
  res.status(201).json(newBooking);
});

// Get Dashboard Statistics
app.get('/api/dashboard/stats', authenticateToken, (req, res) => {
  const db = readDB();
  const userBookings = db.bookings.filter(b => b.userId === req.user.id);
  const todayDate = new Date().toISOString().slice(0, 10);
  const bookingsCount = userBookings.filter(b => b.date === todayDate).length;
  const now = Date.now();
  const activeUsers = Array.from(onlineUsers.values()).filter(timestamp => now - timestamp <= ONLINE_TIMEOUT_MS).length;
  const activeTournaments = 5;

  // Compute monthly revenue as (bookings in current month) * 200
  const today = new Date();
  const bookingsThisMonth = db.bookings.filter(b => {
    if (!b.date) return false;
    const d = new Date(b.date);
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth();
  }).length;
  const revenue = bookingsThisMonth * 200;

  // Dynamic stats
  res.json({
    bookingsToday: bookingsCount,
    activeTournaments,
    activePlayers: activeUsers,
    revenueMonthly: `$${(revenue / 1000).toFixed(1)}k`,
    utilization: db.utilization
  });
});

app.listen(PORT, () => {
  console.log(`SportZone Server is running on http://localhost:${PORT}`);
});
