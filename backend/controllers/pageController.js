const path = require('path');

const PAGES_DIR = path.join(__dirname, '..', '..', 'frontend', 'pages');

function renderIndex(req, res) {
  res.sendFile(path.join(PAGES_DIR, 'index.html'));
}

function renderAuth(req, res) {
  res.sendFile(path.join(PAGES_DIR, 'auth.html'));
}

function renderDashboard(req, res) {
  res.sendFile(path.join(PAGES_DIR, 'dashboard.html'));
}

function renderAdminLogin(req, res) {
  res.sendFile(path.join(PAGES_DIR, 'admin-login.html'));
}

function renderAdminDashboard(req, res) {
  res.sendFile(path.join(PAGES_DIR, 'admin-dashboard.html'));
}

function renderCompare(req, res) {
  res.sendFile(path.join(PAGES_DIR, 'compare.html'));
}

module.exports = {
  renderIndex,
  renderAuth,
  renderDashboard,
  renderAdminLogin,
  renderAdminDashboard,
  renderCompare
};
