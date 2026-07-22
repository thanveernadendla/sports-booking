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
  if (config.headless) options.addArguments('--headless=new');
  options.addArguments('--window-size=1440,1000');

  driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

  try {
    await record('Admin', 'Admin logs in with username and password', async () => {
      await adminLogin();
      const title = await css('h1');
      assert.strictEqual((await title.getText()).toLowerCase(), 'dashboard');
      return 'Admin dashboard opened';
    });

    await record('Admin Dashboard', 'Dashboard shows metrics, game images, and price controls', async () => {
      assert.ok((await driver.findElements(By.css('.game-card'))).length >= 4, 'Expected game image cards');
      assert.ok((await driver.findElements(By.css('.price-input'))).length >= 5, 'Expected price inputs for venues');
      assert.ok(await (await css('#admin-users')).getText() !== '', 'Expected customer metric');
      return 'Dashboard cards and controls are visible';
    });

    await record('Venue Management', 'Admin increases and decreases a venue price', async () => {
      const priceInput = await css('#venue-price-1');
      const original = Number(await priceInput.getAttribute('value'));
      await driver.findElement(By.xpath("(//div[@id='admin-venue-list']//div[contains(@class,'manage-row')])[1]//button[contains(., '+')]")).click();
      await driver.wait(async () => await readVenueOnePrice() === original + 100, 10000);
      await driver.findElement(By.xpath("(//div[@id='admin-venue-list']//div[contains(@class,'manage-row')])[1]//button[contains(., '-')]")).click();
      await driver.wait(async () => await readVenueOnePrice() === original, 10000);
      return `Venue 1 price changed from ${original} to ${original + 100} and back`;
    });

    await record('Customer', 'New customer registers and logs in immediately', customerRegister);

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
