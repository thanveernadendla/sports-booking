const Booking = require('../models/Booking');
const Venue = require('../models/Venue');
const TournamentVenueRequest = require('../models/TournamentVenueRequest');
const { TODAY, TIME_SLOTS } = require('../config/constants');
const { isSlotBlocked, getNextId } = require('../utils/helpers');

const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/constants');

async function getBookings(req, res) {
  if (req.query.my === 'true') {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Login required' });
    try {
      const user = jwt.verify(token, JWT_SECRET);
      const userBookings = await Booking.find({ userId: user.id });
      return res.json(userBookings);
    } catch (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
  }
  const bookings = await Booking.find({ date: TODAY(), status: { $ne: 'Rejected' } });
  res.json(bookings);
}

async function getMyBookings(req, res) {
  const bookings = await Booking.find({ userId: req.user.id });
  res.json(bookings);
}

async function getSlots(req, res) {
  const venueName = req.query.venue;
  const date = req.query.date || TODAY();

  const venueQuery = { status: 'Approved' };
  if (venueName) venueQuery.name = venueName;
  const venues = await Venue.find(venueQuery);

  const bookings = await Booking.find({ date, status: { $in: ['Pending', 'Approved'] } });

  res.json({
    date,
    venues: venues.map(v => {
      const venueObj = v.toObject ? v.toObject() : v;
      return {
        ...venueObj,
        slots: TIME_SLOTS.map(time => ({
          time,
          available: !isSlotBlocked(bookings, venueObj.name, time, date)
        })).filter(slot => slot.available)
      };
    })
  });
}

const {
  emitBookingCreated,
  emitBookingDeleted,
  emitAppStateChanged
} = require('../utils/socketEvents');

async function createBooking(req, res) {
  const { time, venue, team } = req.body;
  const date = TODAY();

  const venueInfo = await Venue.findOne({ name: venue, status: 'Approved' });
  if (!time || !venue || !team || !venueInfo) {
    return res.status(400).json({ error: 'Approved venue, time, and team name are required' });
  }
  if (!TIME_SLOTS.includes(time)) return res.status(400).json({ error: 'Please choose a valid slot time' });

  const existingBookings = await Booking.find({ venue, date, status: { $in: ['Pending', 'Approved'] } });
  if (isSlotBlocked(existingBookings, venue, time, date)) {
    return res.status(409).json({ error: 'This slot is already requested or booked. Please choose another time.' });
  }

  const id = await getNextId(Booking);
  const booking = await Booking.create({
    id,
    time,
    venue,
    team,
    status: 'Pending',
    date,
    userId: req.user.id,
    customerName: req.customer.name,
    customerPhone: req.customer.phone,
    fee: Number(venueInfo.fee)
  });
  
  // Emit event ONLY after successful DB persistence
  emitBookingCreated(req.app.get('io'), booking);
  res.status(201).json(booking);
}

async function deleteBooking(req, res) {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Valid numeric booking ID required' });
  const booking = await Booking.findOne({ id });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (req.user.role !== 'admin' && booking.userId !== req.user.id) {
    return res.status(403).json({ error: 'You can remove only your own bookings' });
  }

  const userId = booking.userId;
  await Booking.deleteOne({ id });

  // Emit event ONLY after successful DB deletion
  emitBookingDeleted(req.app.get('io'), { id, userId });
  res.json({ success: true });
}

async function createTournamentVenueRequest(req, res) {
  const { tournamentName, venue, requestedDate, notes } = req.body;
  const venueInfo = await Venue.findOne({ name: venue, status: 'Approved' });
  if (!tournamentName || !venueInfo) {
    return res.status(400).json({ error: 'Tournament name and approved venue are required' });
  }

  const id = await getNextId(TournamentVenueRequest);
  const request = await TournamentVenueRequest.create({
    id,
    tournamentName,
    venue,
    requestedDate: requestedDate || TODAY(),
    notes: notes || '',
    status: 'Pending',
    userId: req.user.id,
    customerName: req.customer.name,
    customerPhone: req.customer.phone
  });
  notifySockets(req);
  res.status(201).json(request);
}

module.exports = {
  getBookings,
  getMyBookings,
  getSlots,
  createBooking,
  deleteBooking,
  createTournamentVenueRequest
};


