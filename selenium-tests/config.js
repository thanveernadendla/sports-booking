const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

module.exports = {
  baseUrl: process.env.SPORTZONE_BASE_URL || 'http://localhost:3000',
  projectRoot,
  dbPath: path.join(projectRoot, 'data', 'db.json'),
  reportsDir: path.join(__dirname, 'reports'),
  screenshotsDir: path.join(__dirname, 'reports', 'screenshots'),
  headless: process.env.SHOW_BROWSER !== 'true',
  admin: {
    username: process.env.SPORTZONE_ADMIN_USER || 'admin',
    password: process.env.SPORTZONE_ADMIN_PASSWORD || 'admin123'
  }
};
