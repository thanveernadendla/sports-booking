const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const config = require('../config');
const { writeExcelReport } = require('../lib/report');

const results = [];
let driver;
let dbBackup;
let bookingId;
let tournamentRequestId;
let testPhone;
let customerToken;

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

async function waitForApp() {
  for (let i = 0; i < 30; i += 1) {
    try {
      const response = await fetch(`${config.baseUrl}/api/config`);
      if (response.ok) return;
    } catch {
      // Retry until local app is ready.
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`SportZone app is not reachable at ${config.baseUrl}`);
}

function backupDb() {
  dbBackup = fs.readFileSync(config.dbPath, 'utf8');
}

function restoreDb() {
  if (dbBackup) fs.writeFileSync(config.dbPath, dbBackup, 'utf8');
}

async function css(selector, timeout = 10000) {
  const element = await driver.wait(until.elementLocated(By.css(selector)), timeout);
  await driver.wait(until.elementIsVisible(element), timeout);
  return element;
}

async function clickCss(selector) {
  const element = await css(selector);
  await driver.wait(until.elementIsEnabled(element), 10000);
  await element.click();
}

async function typeCss(selector, value) {
  const element = await css(selector);
  await element.clear();
  await element.sendKeys(value);
}

async function readVenueOnePrice() {
  try {
    return Number(await (await css('#venue-price-1')).getAttribute('value'));
  } catch {
    return NaN;
  }
}

async function adminLogin() {
  await driver.get(`${config.baseUrl}/admin-login.html`);
  await typeCss('[data-testid="admin-username"]', config.admin.username);
  await typeCss('[data-testid="admin-password"]', config.admin.password);
  await clickCss('[data-testid="admin-submit"]');
  await driver.wait(until.urlContains('admin-dashboard.html'), 10000);
}

async function customerRegister() {
  const suffix = Math.floor(10000000 + Math.random() * 89999999);
  testPhone = `96${suffix}`;
  await driver.get(`${config.baseUrl}/auth.html`);
  await clickCss('[data-testid="toggle-register"]');
  await typeCss('[data-testid="customer-name"]', 'Selenium Customer');
  await typeCss('[data-testid="customer-phone"]', testPhone);
  await typeCss('[data-testid="customer-password"]', 'pass123');
  await clickCss('[data-testid="customer-submit"]');
  await driver.wait(until.urlContains('dashboard.html'), 10000);
  customerToken = await driver.executeScript('return localStorage.getItem("sportzone_token")');
  return `Registered and logged in customer ${testPhone}`;
}

async function apiAdminLogin() {
  const response = await fetch(`${config.baseUrl}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config.admin)
  });
  const data = await response.json();
  assert.strictEqual(response.ok, true, data.error);
  return data.token;
}

async function apiRequest(url, options = {}) {
  const response = await fetch(`${config.baseUrl}${url}`, options);
  const data = await response.json();
  return { response, data };
}

async function patchAdmin(url, body) {
  const token = await apiAdminLogin();
  const response = await fetch(`${config.baseUrl}${url}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  assert.strictEqual(response.ok, true, data.error);
  return data;
}

async function run() {
  await waitForApp();
  backupDb();

  const options = new chrome.Options();
  if (config.headless && config.browser === 'chrome') options.addArguments('--headless=new');
  if (config.browser === 'chrome') options.addArguments('--window-size=1440,1000');

  const builder = new Builder().forBrowser(config.browser);
  if (config.browser === 'chrome') builder.setChromeOptions(options);
  driver = await builder.build();

  try {
    await record('Admin', 'Admin logs in with username and password', async () => {
      await adminLogin();
      const title = await css('h1');
      assert.strictEqual((await title.getText()).toLowerCase(), 'dashboard');
      return 'Admin dashboard opened';
    });

    await record('Security', 'Admin dashboard API rejects unauthenticated requests', async () => {
      const { response } = await apiRequest('/api/admin/dashboard');
      assert.strictEqual(response.status, 401);
      return 'Unauthenticated admin request returned HTTP 401';
    }, 'Security');

    await record('API', 'Admin login rejects an incorrect password', async () => {
      const { response } = await apiRequest('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: config.admin.username, password: 'incorrect-password' })
      });
      assert.strictEqual(response.status, 401);
      return 'Invalid credentials returned HTTP 401';
    }, 'API');

    await record('Admin Dashboard', 'Dashboard shows metrics, game images, and price controls', async () => {
      assert.ok((await driver.findElements(By.css('.game-card'))).length >= 4, 'Expected game image cards');
      assert.ok((await driver.findElements(By.css('.price-input'))).length >= 5, 'Expected price inputs for venues');
      assert.ok(await (await css('#admin-users')).getText() !== '', 'Expected customer metric');
      return 'Dashboard cards and controls are visible';
    }, 'UI/UX');

    await record('Venue Management', 'Admin increases and decreases a venue price', async () => {
      const priceInput = await css('#venue-price-1');
      const original = Number(await priceInput.getAttribute('value'));
      await driver.findElement(By.xpath("(//div[@id='admin-venue-list']//div[contains(@class,'manage-row')])[1]//button[contains(., '+')]")).click();
      await driver.wait(async () => await readVenueOnePrice() === original + 100, 10000);
      await driver.findElement(By.xpath("(//div[@id='admin-venue-list']//div[contains(@class,'manage-row')])[1]//button[contains(., '-')]")).click();
      await driver.wait(async () => await readVenueOnePrice() === original, 10000);
      return `Venue 1 price changed from ${original} to ${original + 100} and back`;
    }, 'Functional');

    await record('Customer', 'New customer registers and logs in immediately', customerRegister);

    await record('Security', 'Customer cannot open the admin dashboard API', async () => {
      const { response } = await apiRequest('/api/admin/dashboard', {
        headers: { Authorization: `Bearer ${customerToken}` }
      });
      assert.strictEqual(response.status, 403);
      return 'Customer role was denied admin access with HTTP 403';
    }, 'Security');

    await record('API', 'Registration validates the required 10-digit phone number', async () => {
      const { response } = await apiRequest('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Invalid Test', phone: '123', password: 'pass123' })
      });
      assert.strictEqual(response.status, 400);
      return 'Invalid phone number returned HTTP 400';
    }, 'API');

    await record('Booking', 'Customer submits a booking request', async () => {
      await typeCss('[data-testid="booking-team"]', 'Selenium XI');
      await clickCss('[data-testid="booking-submit"]');
      await driver.wait(async () => {
        const text = await driver.findElement(By.css('#bookings-container')).getText();
        return text.includes('Selenium XI') && text.includes('Pending');
      }, 10000);

      const token = await apiAdminLogin();
      const dashboard = await fetch(`${config.baseUrl}/api/admin/dashboard`, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());
      const booking = dashboard.bookings.find(item => item.team === 'Selenium XI');
      assert.ok(booking, 'Expected booking in admin API');
      bookingId = booking.id;
      return `Booking request ${bookingId} created`;
    });

    await record('Database', 'Booking request persists with customer and venue data', async () => {
      const token = await apiAdminLogin();
      const dashboard = await fetch(`${config.baseUrl}/api/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(response => response.json());
      const booking = dashboard.bookings.find(item => item.id === bookingId);
      assert.ok(booking, 'Booking missing from persistent dashboard data');
      assert.strictEqual(booking.customerPhone, testPhone);
      assert.ok(Number(booking.fee) > 0);
      return `Persisted booking ${booking.id} includes customer and fee data`;
    }, 'Database');

    await record('Booking Approval', 'Admin approves customer booking', async () => {
      const updated = await patchAdmin(`/api/admin/bookings/${bookingId}/status`, { status: 'Approved' });
      assert.strictEqual(updated.status, 'Approved');
      return `Booking ${bookingId} approved`;
    });

    await record('Tournament', 'Customer submits tournament venue request', async () => {
      await driver.get(`${config.baseUrl}/dashboard.html`);
      await driver.wait(until.elementLocated(By.css('[data-testid="tournament-request-form"]')), 10000);
      await typeCss('[data-testid="tournament-name"]', 'Selenium Premier Cup');
      await typeCss('[data-testid="tournament-date"]', '2026-06-30');
      await typeCss('[data-testid="tournament-notes"]', 'Automated end-to-end tournament request');
      await clickCss('[data-testid="tournament-request-submit"]');

      const token = await apiAdminLogin();
      const dashboard = await fetch(`${config.baseUrl}/api/admin/dashboard`, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());
      const request = dashboard.tournamentVenueRequests.find(item => item.tournamentName === 'Selenium Premier Cup');
      assert.ok(request, 'Expected tournament venue request');
      tournamentRequestId = request.id;
      return `Tournament venue request ${tournamentRequestId} created`;
    });

    await record('Tournament Approval', 'Admin approves tournament venue request', async () => {
      const updated = await patchAdmin(`/api/admin/tournament-venue-requests/${tournamentRequestId}/status`, { status: 'Approved' });
      assert.strictEqual(updated.status, 'Approved');
      return `Tournament venue request ${tournamentRequestId} approved`;
    });

    await record('Accessibility', 'Customer page has a language and labeled form controls', async () => {
      await driver.get(`${config.baseUrl}/dashboard.html`);
      const audit = await driver.executeScript(() => ({
        language: document.documentElement.lang,
        unlabeled: [...document.querySelectorAll('#booking-form input, #booking-form select, #tournament-request-form input, #tournament-request-form select')]
          .filter(control => !control.labels || control.labels.length === 0)
          .map(control => control.id || control.tagName)
      }));
      assert.ok(audit.language, 'Document language is missing');
      assert.deepStrictEqual(audit.unlabeled, [], `Unlabeled controls: ${audit.unlabeled.join(', ')}`);
      return 'Booking and tournament controls have associated labels';
    }, 'Accessibility');

    await record('Mobile-Specific', 'Customer dashboard fits a narrow viewport', async () => {
      await driver.manage().window().setRect({ width: 390, height: 844 });
      const layout = await driver.executeScript(() => ({
        width: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        viewport: document.querySelector('meta[name="viewport"]')?.content || ''
      }));
      assert.ok(layout.viewport.includes('width=device-width'), 'Responsive viewport metadata is missing');
      assert.ok(layout.scrollWidth <= layout.width + 1, `Horizontal overflow at 390px: ${layout.scrollWidth}px`);
      return `390px viewport; document width ${layout.scrollWidth}px`;
    }, 'Mobile-Specific');

    await record('Performance', 'Customer dashboard load event completes within 10 seconds', async () => {
      const loadMs = await driver.executeScript(() => {
        const navigation = performance.getEntriesByType('navigation')[0];
        return navigation ? navigation.loadEventEnd - navigation.startTime : 0;
      });
      assert.ok(loadMs > 0 && loadMs < 10000, `Unexpected page load time: ${loadMs}ms`);
      return `Dashboard load event completed in ${Math.round(loadMs)}ms`;
    }, 'Performance');

    await record('Compatibility', 'Selected browser reports its active browser version', async () => {
      const capabilities = await driver.getCapabilities();
      const browserName = capabilities.get('browserName');
      const browserVersion = capabilities.get('browserVersion');
      assert.strictEqual(String(browserName).toLowerCase(), config.browser.toLowerCase());
      assert.ok(browserVersion, 'Browser version was not reported');
      return `${browserName} ${browserVersion}`;
    }, 'Compatibility');
  } finally {
    if (driver) await driver.quit();
    restoreDb();
  }

  const passed = results.filter(item => item.status === 'PASS').length;
  const failed = results.length - passed;
  const outputPath = path.join(config.reportsDir, `sportzone-selenium-report-${stamp()}.xlsx`);
  await writeExcelReport({
    results,
    summary: {
      baseUrl: config.baseUrl,
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
  if (driver) await driver.quit().catch(() => {});
  restoreDb();
  process.exit(1);
});
