const express = require('express');
const router = express.Router();
const {
  renderIndex,
  renderAuth,
  renderDashboard,
  renderAdminLogin,
  renderAdminDashboard,
  renderCompare
} = require('../controllers/pageController');

router.get(['/', '/index.html'], renderIndex);
router.get(['/auth', '/auth.html'], renderAuth);
router.get(['/dashboard', '/dashboard.html'], renderDashboard);
router.get(['/admin', '/admin.html', '/admin-login', '/admin-login.html'], renderAdminLogin);
router.get(['/admin-dashboard', '/admin-dashboard.html'], renderAdminDashboard);
router.get(['/compare', '/compare.html'], renderCompare);

module.exports = router;
