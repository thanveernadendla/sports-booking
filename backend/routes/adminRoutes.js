const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');
const { adminLogin } = require('../controllers/authController');
const {
  getDashboard,
  updateUserStatus,
  createVenue,
  updateVenue,
  createTournament,
  updateTournament,
  updateBookingStatus,
  updateTournamentRequestStatus
} = require('../controllers/adminController');

router.post('/login', asyncHandler(adminLogin));
router.get('/dashboard', authenticateToken, requireAdmin, asyncHandler(getDashboard));
router.patch('/users/:id/status', authenticateToken, requireAdmin, asyncHandler(updateUserStatus));
router.put('/users/:id/status', authenticateToken, requireAdmin, asyncHandler(updateUserStatus));
router.post('/venues', authenticateToken, requireAdmin, asyncHandler(createVenue));
router.patch('/venues/:id', authenticateToken, requireAdmin, asyncHandler(updateVenue));
router.put('/venues/:id', authenticateToken, requireAdmin, asyncHandler(updateVenue));
router.post('/tournaments', authenticateToken, requireAdmin, asyncHandler(createTournament));
router.patch('/tournaments/:id', authenticateToken, requireAdmin, asyncHandler(updateTournament));
router.put('/tournaments/:id', authenticateToken, requireAdmin, asyncHandler(updateTournament));
router.patch('/bookings/:id/status', authenticateToken, requireAdmin, asyncHandler(updateBookingStatus));
router.put('/bookings/:id/status', authenticateToken, requireAdmin, asyncHandler(updateBookingStatus));
router.patch('/tournament-venue-requests/:id/status', authenticateToken, requireAdmin, asyncHandler(updateTournamentRequestStatus));
router.put('/tournament-venue-requests/:id/status', authenticateToken, requireAdmin, asyncHandler(updateTournamentRequestStatus));


module.exports = router;
