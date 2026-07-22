const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

module.exports = {
  appiumServerUrl: process.env.APPIUM_SERVER_URL || 'http://127.0.0.1:4723',
  projectRoot,
  reportsDir: path.join(__dirname, 'reports'),
  screenshotsDir: path.join(__dirname, 'reports', 'screenshots'),
  appPath: process.env.SPORTZONE_APK || path.join(projectRoot, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
  platformName: 'Android',
  automationName: 'UiAutomator2',
  deviceName: process.env.ANDROID_DEVICE_NAME || 'Android Device',
  appPackage: process.env.SPORTZONE_APP_PACKAGE || 'com.sportzone.app',
  appActivity: process.env.SPORTZONE_APP_ACTIVITY || 'com.sportzone.app.MainActivity',
  admin: {
    username: process.env.SPORTZONE_ADMIN_USER || 'admin',
    password: process.env.SPORTZONE_ADMIN_PASSWORD || 'admin123'
  }
};
