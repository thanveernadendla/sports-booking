const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticateToken, requireActiveCustomer } = require('../middleware/authMiddleware');
const {
  getBookings,
  getMyBookings,
  getSlots,
  createBooking,
  deleteBooking,
  createTournamentVenueRequest
} = require('../controllers/bookingController');

router.get('/bookings', asyncHandler(getBookings));
router.get('/bookings/my', authenticateToken, asyncHandler(getMyBookings));
router.get('/slots', asyncHandler(getSlots));
router.post('/bookings', authenticateToken, asyncHandler(requireActiveCustomer), asyncHandler(createBooking));
router.delete('/bookings/:id', authenticateToken, asyncHandler(deleteBooking));
router.post('/tournament-venue-requests', authenticateToken, asyncHandler(requireActiveCustomer), asyncHandler(createTournamentVenueRequest));

module.exports = router;
