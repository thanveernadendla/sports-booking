const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { authenticateToken } = require('../middleware/authMiddleware');
const { register, login, getMe } = require('../controllers/authController');

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.get('/me', authenticateToken, getMe);

module.exports = router;
