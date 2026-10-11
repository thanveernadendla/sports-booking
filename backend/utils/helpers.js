const jwt = require('jsonwebtoken');
const { JWT_SECRET, TODAY } = require('../config/constants');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

function nextId(items) {
  return items.length ? Math.max(...items.map(item => Number(item.id) || 0)) + 1 : 1;
}

function formatINR(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
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

function isSlotBlocked(bookings, venue, time, date = TODAY()) {
  return bookings.some(booking =>
    booking.venue === venue &&
    booking.time === time &&
    booking.date === date &&
    ['Pending', 'Approved'].includes(booking.status)
  );
}

async function getNextId(Model) {
  const lastDoc = await Model.findOne({}, { id: 1 }, { sort: { id: -1 } });
  return lastDoc && typeof lastDoc.id === 'number' ? lastDoc.id + 1 : 1;
}

module.exports = {
  clone,
  normalizePhone,
  nextId,
  getNextId,
  formatINR,
  publicUser,
  signUser,
  activeVenues,
  getVenue,
  getVenueFee,
  isSlotBlocked
};

