const express = require('express');
const router = express.Router();
const asyncHandler = require('../utils/asyncHandler');
const { getConfig, getDashboardStats } = require('../controllers/statsController');

router.get('/config', asyncHandler(getConfig));
router.get('/dashboard/stats', asyncHandler(getDashboardStats));

module.exports = router;
