const Booking = require('../models/Booking');
const User = require('../models/User');
const Venue = require('../models/Venue');
const Tournament = require('../models/Tournament');
const { TODAY, TIME_SLOTS } = require('../config/constants');
const { formatINR } = require('../utils/helpers');

async function getConfig(req, res) {
  const venues = await Venue.find({ status: 'Approved' });
  res.json({ venues, timeSlots: TIME_SLOTS, currency: 'INR' });
}

async function getDashboardStats(req, res) {
  const todaysBookings = await Booking.find({ date: TODAY(), status: { $ne: 'Rejected' } });
  const approvedBookings = todaysBookings.filter(b => b.status === 'Approved');
  const revenue = approvedBookings.reduce((sum, b) => sum + Number(b.fee || 0), 0);

  const activeVenuesCount = await Venue.countDocuments({ status: 'Approved' });
  const activeTournamentsCount = await Tournament.countDocuments({ status: { $ne: 'Closed' } });
  const activePlayersCount = await User.countDocuments({ role: 'user', status: 'Approved' });
  const registeredAccountsCount = await User.countDocuments({ role: 'user' });

  res.json({
    bookingsToday: todaysBookings.length,
    pendingBookings: todaysBookings.filter(b => b.status === 'Pending').length,
    activeTournaments: activeTournamentsCount,
    activePlayers: activePlayersCount,
    revenueMonthly: formatINR(revenue),
    revenueValue: revenue,
    registeredAccounts: registeredAccountsCount,
    availableSlots: activeVenuesCount * TIME_SLOTS.length - todaysBookings.length
  });
}

module.exports = {
  getConfig,
  getDashboardStats
};

