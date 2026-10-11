const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { remote } = require('webdriverio');
const config = require('../config');
const { writeExcelReport } = require('../lib/report');

const results = [];
let driver;
let customerSession;
let bookingId;
let tournamentRequestId;

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

async function record(module, name, fn, category = 'End-to-End') {
  const item = { module, category, name, startedAt: new Date().toISOString() };
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
  throw new Error('No Native context found. Ensure the React Native Android app is built and launched.');
}

async function routeApiToHost() {
  const baseUrl = config.mobileApiBaseUrl.replace(/\/$/, '');
  await driver.execute((apiBaseUrl) => {
    localStorage.setItem('sportzone_api_base_url', apiBaseUrl);
    window.API_BASE_URL = apiBaseUrl;
  }, baseUrl);
  return `WebView API calls routed to ${baseUrl}`;
}

async function openAppPage(page) {
  await driver.url(`http://localhost${page}`);
  await routeApiToHost();
}

async function apiRequest(route, options = {}) {
  const response = await fetch(`${config.mobileApiBaseUrl}${route}`, options);
  const data = await response.json();
  return { response, data };
}

async function adminApiLogin() {
  const { response, data } = await apiRequest('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config.admin)
  });
  assert.strictEqual(response.status, 200, data.error);
  return data.token;
}

async function adminDashboard(token) {
  const { response, data } = await apiRequest('/api/admin/dashboard', {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.strictEqual(response.status, 200, data.error);
  return data;
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
  await openAppPage('/admin-login.html');
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
  await openAppPage('/auth.html');
  await click('[data-testid="toggle-register"]');
  await type('[data-testid="customer-name"]', 'Appium Customer');
  await type('[data-testid="customer-phone"]', phone);
  await type('[data-testid="customer-password"]', 'pass123');
  await click('[data-testid="customer-submit"]');
  await driver.waitUntil(async () => (await driver.getUrl()).includes('dashboard.html'), {
    timeout: 15000,
    timeoutMsg: 'Customer dashboard did not open after registration'
  });
  return {
    phone,
    token: await driver.execute(() => localStorage.getItem('sportzone_token'))
  };
}

async function run() {
  await connect();

  try {
    await record('Launch', 'Android app launches', async () => {
      assert.ok(await driver.getPageSource(), 'Expected app source');
      return `Launched package ${config.appPackage}`;
    });

    await record('Native Context', 'Switch to React Native Context', switchToWebView);
    await record('Mobile Backend', 'Route bundled app API calls to configured host', routeApiToHost);

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
    }, 'UI/UX');

    await record('Customer', 'Customer registers and enters booking app immediately', async () => {
      customerSession = await customerRegister();
      assert.ok(customerSession.token, 'Expected customer session token');
      return `Customer ${customerSession.phone} registered without approval wait`;
    });

    await record('Security', 'Admin dashboard rejects requests without a token', async () => {
      const { response } = await apiRequest('/api/admin/dashboard');
      assert.strictEqual(response.status, 401);
      return 'Unauthenticated admin request returned HTTP 401';
    }, 'Security');

    await record('Security', 'Customer token cannot access admin dashboard', async () => {
      const { response } = await apiRequest('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${customerSession.token}` }
      });
      assert.strictEqual(response.status, 403);
      return 'Customer role was denied admin access with HTTP 403';
    }, 'Security');

    await record('API', 'Registration endpoint rejects incomplete data', async () => {
      const { response } = await apiRequest('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: '123' })
      });
      assert.strictEqual(response.status, 400);
      return 'Invalid registration payload returned HTTP 400';
    }, 'API');

    await record('Booking', 'Customer sends booking request on Android app', async () => {
      await type('[data-testid="booking-team"]', 'Appium XI');
      await click('[data-testid="booking-submit"]');
      const row = await $('#bookings-container .booking-row');
      assert.ok((await row.getText()).includes('Pending'), 'Expected pending booking row');
      const token = await adminApiLogin();
      const dashboard = await adminDashboard(token);
      const booking = dashboard.bookings.find(item => item.team === 'Appium XI');
      assert.ok(booking, 'Booking was not persisted to the backend');
      bookingId = booking.id;
      return `Booking ${bookingId} is visible in the customer UI and persisted in the database`;
    });

    await record('Database', 'Booking remains persisted after reloading the admin data', async () => {
      const dashboard = await adminDashboard(await adminApiLogin());
      const booking = dashboard.bookings.find(item => item.id === bookingId);
      assert.ok(booking && booking.status === 'Pending', 'Expected persisted pending booking');
      return `Booking ${bookingId} persisted with status ${booking.status}`;
    }, 'Database');

    await record('Booking Approval', 'Admin approves the Android customer booking', async () => {
      await adminLogin();
      const approve = await driver.$(`//tbody[@id="admin-booking-rows"]//tr[.//td[contains(., "Appium XI")]]//button[contains(., "Approve")]`);
      await approve.waitForDisplayed({ timeout: 15000 });
      await approve.click();
      await driver.waitUntil(async () => {
        const dashboard = await adminDashboard(await adminApiLogin());
        return dashboard.bookings.find(item => item.id === bookingId)?.status === 'Approved';
      }, { timeout: 15000, timeoutMsg: 'Booking was not approved' });
      return `Admin UI approved booking ${bookingId}`;
    }, 'Functional');

    await record('Tournament', 'Customer sends tournament venue request on Android app', async () => {
      await openAppPage('/dashboard.html');
      await type('[data-testid="tournament-name"]', 'Appium Cup');
      await type('[data-testid="tournament-date"]', '2026-06-30');
      await type('[data-testid="tournament-notes"]', 'Mobile automation request');
      await click('[data-testid="tournament-request-submit"]');
      const dashboard = await adminDashboard(await adminApiLogin());
      const request = dashboard.tournamentVenueRequests.find(item => item.tournamentName === 'Appium Cup');
      assert.ok(request, 'Tournament request was not persisted');
      tournamentRequestId = request.id;
      return `Tournament request ${tournamentRequestId} was submitted and persisted`;
    });

    await record('Tournament Approval', 'Admin approves the Android tournament request', async () => {
      await adminLogin();
      const approve = await driver.$(`//tbody[@id="admin-request-rows"]//tr[.//td[contains(., "Appium Cup")]]//button[contains(., "Approve")]`);
      await approve.waitForDisplayed({ timeout: 15000 });
      await approve.click();
      await driver.waitUntil(async () => {
        const dashboard = await adminDashboard(await adminApiLogin());
        return dashboard.tournamentVenueRequests.find(item => item.id === tournamentRequestId)?.status === 'Approved';
      }, { timeout: 15000, timeoutMsg: 'Tournament request was not approved' });
      return `Admin UI approved tournament request ${tournamentRequestId}`;
    }, 'Functional');

    await record('Accessibility', 'Customer forms expose labels and the document language', async () => {
      await openAppPage('/dashboard.html');
      const accessibility = await driver.execute(() => ({
        language: document.documentElement.lang,
        unlabeled: [...document.querySelectorAll('#booking-form input, #booking-form select, #tournament-request-form input, #tournament-request-form select')]
          .filter(control => !control.labels || control.labels.length === 0)
          .map(control => control.id || control.tagName)
      }));
      assert.ok(accessibility.language, 'Document language is missing');
      assert.deepStrictEqual(accessibility.unlabeled, [], `Unlabeled controls: ${accessibility.unlabeled.join(', ')}`);
      return 'Dashboard forms have associated labels and a declared document language';
    }, 'Accessibility');

    await record('Mobile UI', 'Dashboard fits the Android viewport without horizontal overflow', async () => {
      const viewport = await driver.execute(() => ({
        width: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        viewportMeta: document.querySelector('meta[name="viewport"]')?.content || ''
      }));
      assert.ok(viewport.viewportMeta.includes('width=device-width'), 'Responsive viewport metadata is missing');
      assert.ok(viewport.documentWidth <= viewport.width + 1, `Horizontal overflow: ${viewport.documentWidth}px > ${viewport.width}px`);
      return `Viewport ${viewport.width}px; document width ${viewport.documentWidth}px`;
    }, 'Mobile-Specific');

    await record('Performance', 'Dashboard document load completes within 10 seconds', async () => {
      const loadMs = await driver.execute(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        return navigation ? navigation.loadEventEnd - navigation.startTime : 0;
      });
      assert.ok(loadMs > 0 && loadMs < 10000, `Unexpected dashboard load time: ${loadMs}ms`);
      return `Dashboard load event completed in ${Math.round(loadMs)}ms`;
    }, 'Performance');
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
