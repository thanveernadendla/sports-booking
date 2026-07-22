const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { remote } = require('webdriverio');
const config = require('../config');
const { writeExcelReport } = require('../lib/report');

const results = [];
let driver;

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

async function screenshot(name) {
  fs.mkdirSync(config.screenshotsDir, { recursive: true });
  const file = path.join(config.screenshotsDir, `${stamp()}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`);
  const base64 = await driver.takeScreenshot();
  fs.writeFileSync(file, base64, 'base64');
  return file;
}

async function record(module, name, fn) {
  const item = { module, name, startedAt: new Date().toISOString() };
  try {
    const details = await fn();
    item.status = 'PASS';
    item.details = details || 'Completed successfully';
  } catch (error) {
    item.status = 'FAIL';
    item.details = error.stack || error.message;
    try {
      item.screenshot = await screenshot(name);
    } catch {
      item.screenshot = 'Screenshot failed';
    }
  } finally {
    item.endedAt = new Date().toISOString();
    results.push(item);
    console.log(`${item.status} ${module} - ${name}`);
  }
}

async function connect() {
  if (!fs.existsSync(config.appPath)) {
    throw new Error(`APK not found: ${config.appPath}. Build the Android app first.`);
  }

  const url = new URL(config.appiumServerUrl);
  driver = await remote({
    protocol: url.protocol.replace(':', ''),
    hostname: url.hostname,
    port: Number(url.port || 4723),
    path: url.pathname === '/' ? '/' : url.pathname,
    capabilities: {
      platformName: config.platformName,
      'appium:automationName': config.automationName,
      'appium:deviceName': config.deviceName,
      'appium:app': config.appPath,
      'appium:appPackage': config.appPackage,
      'appium:appActivity': config.appActivity,
      'appium:autoGrantPermissions': true,
      'appium:newCommandTimeout': 180,
      'appium:autoWebview': false
    }
  });
}

async function switchToWebView() {
  for (let i = 0; i < 30; i += 1) {
    const contexts = await driver.getContexts();
    const webview = contexts.find(context => String(context).includes('WEBVIEW'));
    if (webview) {
      await driver.switchContext(webview);
      return `Switched to ${webview}`;
    }
    await driver.pause(1000);
  }
  throw new Error('No WEBVIEW context found. Ensure the Capacitor Android app is built and launched.');
}

async function $(selector) {
  const element = await driver.$(selector);
  await element.waitForDisplayed({ timeout: 15000 });
  return element;
}

async function click(selector) {
  const element = await $(selector);
  await element.click();
}

async function type(selector, value) {
  const element = await $(selector);
  await element.setValue(value);
}

async function adminLogin() {
  await driver.url('http://localhost/admin-login.html');
  await type('[data-testid="admin-username"]', config.admin.username);
  await type('[data-testid="admin-password"]', config.admin.password);
  await click('[data-testid="admin-submit"]');
  await driver.waitUntil(async () => (await driver.getUrl()).includes('admin-dashboard.html'), {
    timeout: 15000,
    timeoutMsg: 'Admin dashboard did not open'
  });
}

async function customerRegister() {
  const phone = `95${Math.floor(10000000 + Math.random() * 89999999)}`;
  await driver.url('http://localhost/auth.html');
  await click('[data-testid="toggle-register"]');
  await type('[data-testid="customer-name"]', 'Appium Customer');
  await type('[data-testid="customer-phone"]', phone);
  await type('[data-testid="customer-password"]', 'pass123');
  await click('[data-testid="customer-submit"]');
  await driver.waitUntil(async () => (await driver.getUrl()).includes('dashboard.html'), {
    timeout: 15000,
    timeoutMsg: 'Customer dashboard did not open after registration'
  });
  return phone;
}

async function run() {
  await connect();

  try {
    await record('Launch', 'Android app launches', async () => {
      assert.ok(await driver.getPageSource(), 'Expected app source');
      return `Launched package ${config.appPackage}`;
    });

    await record('Hybrid Context', 'Switch to Capacitor WebView', switchToWebView);

    await record('Admin', 'Admin logs in on Android app', async () => {
      await adminLogin();
      const title = await $('h1');
      assert.strictEqual(await title.getText(), 'Dashboard');
      return 'Admin dashboard loaded in mobile WebView';
    });

    await record('Admin Dashboard', 'Admin sees game cards and price controls', async () => {
      assert.ok((await driver.$$('.game-card')).length >= 4, 'Expected game cards');
      assert.ok((await driver.$$('.price-input')).length >= 5, 'Expected venue price inputs');
      return 'Game images and price controls are available';
    });

    await record('Customer', 'Customer registers and enters booking app immediately', async () => {
      const phone = await customerRegister();
      return `Customer ${phone} registered without approval wait`;
    });

    await record('Booking', 'Customer sends booking request on Android app', async () => {
      await type('[data-testid="booking-team"]', 'Appium XI');
      await click('[data-testid="booking-submit"]');
      const row = await $('#bookings-container .booking-row');
      assert.ok((await row.getText()).includes('Pending'), 'Expected pending booking row');
      return 'Booking request appears in customer app';
    });

    await record('Tournament', 'Customer sends tournament venue request on Android app', async () => {
      await type('[data-testid="tournament-name"]', 'Appium Cup');
      await type('[data-testid="tournament-date"]', '2026-06-30');
      await type('[data-testid="tournament-notes"]', 'Mobile automation request');
      await click('[data-testid="tournament-request-submit"]');
      return 'Tournament venue request submitted';
    });
  } finally {
    if (driver) await driver.deleteSession();
  }

  const passed = results.filter(item => item.status === 'PASS').length;
  const failed = results.length - passed;
  const outputPath = path.join(config.reportsDir, `sportzone-appium-report-${stamp()}.xlsx`);
  await writeExcelReport({
    results,
    summary: {
      appiumServerUrl: config.appiumServerUrl,
      appPath: config.appPath,
      deviceName: config.deviceName,
      total: results.length,
      passed,
      failed,
      passRate: results.length ? Math.round((passed / results.length) * 100) : 0
    },
    outputPath
  });

  console.log(`Excel report: ${outputPath}`);
  if (failed > 0) process.exitCode = 1;
}

run().catch(async error => {
  console.error(error);
  if (driver) await driver.deleteSession().catch(() => {});

  const outputPath = path.join(config.reportsDir, `sportzone-appium-report-${stamp()}.xlsx`);
  results.push({
    module: 'Setup',
    name: 'Appium setup/connectivity',
    status: 'FAIL',
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    details: error.stack || error.message
  });
  await writeExcelReport({
    results,
    summary: {
      appiumServerUrl: config.appiumServerUrl,
      appPath: config.appPath,
      deviceName: config.deviceName,
      total: results.length,
      passed: 0,
      failed: results.length,
      passRate: 0
    },
    outputPath
  });
  console.log(`Excel report: ${outputPath}`);
  process.exit(1);
});
