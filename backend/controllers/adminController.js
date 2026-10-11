const User = require('../models/User');
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const Tournament = require('../models/Tournament');
const TournamentVenueRequest = require('../models/TournamentVenueRequest');
const { TODAY, TIME_SLOTS } = require('../config/constants');
const { formatINR, publicUser, getNextId } = require('../utils/helpers');

async function getDashboard(req, res) {
  const todaysBookings = await Booking.find({ date: TODAY(), status: { $ne: 'Rejected' } });
  const approvedBookings = todaysBookings.filter(b => b.status === 'Approved');
  const revenue = approvedBookings.reduce((sum, b) => sum + Number(b.fee || 0), 0);

  const users = await User.find({ role: 'user' });
  const venues = await Venue.find();
  const tournaments = await Tournament.find();
  const tournamentVenueRequests = await TournamentVenueRequest.find();
  const pendingUsersCount = await User.countDocuments({ role: 'user', status: 'Pending' });
  const pendingBookingsCount = await Booking.countDocuments({ status: 'Pending' });
  const pendingVenueRequestsCount = await TournamentVenueRequest.countDocuments({ status: 'Pending' });

  const activeVenuesList = venues.filter(v => v.status === 'Approved');

  res.json({
    stats: {
      bookingsToday: todaysBookings.length,
      pendingUsers: pendingUsersCount,
      pendingBookings: pendingBookingsCount,
      pendingVenueRequests: pendingVenueRequestsCount,
      revenue: formatINR(revenue),
      users: users.length,
      venues: venues.length,
      tournaments: tournaments.length,
      availableSlots: activeVenuesList.length * TIME_SLOTS.length - todaysBookings.length
    },
    users: users.map(publicUser),
    venues: venues.map(v => {
      const vObj = v.toObject ? v.toObject() : v;
      return {
        ...vObj,
        booked: todaysBookings.filter(b => b.venue === v.name).length,
        available: TIME_SLOTS.length - todaysBookings.filter(b => b.venue === v.name).length
      };
    }),
    bookings: await Booking.find(),
    tournaments,
    tournamentVenueRequests
  });
}

const {
  emitBookingStatusChanged,
  emitAppStateChanged
} = require('../utils/socketEvents');

function notifySockets(req) {
  const io = req.app.get('io');
  if (io) {
    emitAppStateChanged(io);
  }
}

async function updateUserStatus(req, res) {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Valid numeric user ID required' });
  const user = await User.findOne({ id, role: 'user' });
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!['Approved', 'Rejected', 'Pending', 'Blocked'].includes(req.body.status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  user.status = req.body.status;
  await user.save();
  notifySockets(req);
  res.json(publicUser(user));
}

async function createVenue(req, res) {
  const { name, category, fee } = req.body;
  if (!name || !category || !fee) return res.status(400).json({ error: 'Venue name, category, and fee are required' });
  const id = await getNextId(Venue);
  const venue = await Venue.create({ id, name, category, fee: Number(fee), status: 'Approved' });
  notifySockets(req);
  res.status(201).json(venue);
}

async function updateVenue(req, res) {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Valid numeric venue ID required' });
  const venue = await Venue.findOne({ id });
  if (!venue) return res.status(404).json({ error: 'Venue not found' });
  ['name', 'category', 'status'].forEach(key => {
    if (req.body[key]) venue[key] = req.body[key];
  });
  if (req.body.fee !== undefined) venue.fee = Number(req.body.fee);
  await venue.save();
  notifySockets(req);
  res.json(venue);
}

async function createTournament(req, res) {
  const { name, sport, startDate, venue } = req.body;
  if (!name || !sport) return res.status(400).json({ error: 'Tournament name and sport are required' });
  const id = await getNextId(Tournament);
  const tournament = await Tournament.create({ id, name, sport, startDate: startDate || TODAY(), venue: venue || '', status: 'Open' });
  notifySockets(req);
  res.status(201).json(tournament);
}

async function updateTournament(req, res) {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Valid numeric tournament ID required' });
  const tournament = await Tournament.findOne({ id });
  if (!tournament) return res.status(404).json({ error: 'Tournament not found' });
  ['name', 'sport', 'startDate', 'venue', 'status'].forEach(key => {
    if (req.body[key]) tournament[key] = req.body[key];
  });
  await tournament.save();
  notifySockets(req);
  res.json(tournament);
}

async function updateBookingStatus(req, res) {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Valid numeric booking ID required' });
  const booking = await Booking.findOne({ id });
  if (!booking) return res.status(404).json({ error: 'Booking not found' });
  if (!['Approved', 'Rejected', 'Pending'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
  booking.status = req.body.status;
  await booking.save();
  // Emit event ONLY after successful DB update
  emitBookingStatusChanged(req.app.get('io'), booking);
  res.json(booking);
}

async function updateTournamentRequestStatus(req, res) {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Valid numeric request ID required' });
  const request = await TournamentVenueRequest.findOne({ id });
  if (!request) return res.status(404).json({ error: 'Tournament venue request not found' });
  if (!['Approved', 'Rejected', 'Pending'].includes(req.body.status)) return res.status(400).json({ error: 'Invalid status' });
  request.status = req.body.status;
  await request.save();
  notifySockets(req);
  res.json(request);
}

module.exports = {
  getDashboard,
  updateUserStatus,
  createVenue,
  updateVenue,
  createTournament,
  updateTournament,
  updateBookingStatus,
  updateTournamentRequestStatus
};


