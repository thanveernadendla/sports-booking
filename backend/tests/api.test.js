const http = require('http');
const assert = require('assert');

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed = data;
        try { parsed = JSON.parse(data); } catch (e) {}
        resolve({ statusCode: res.statusCode, headers: res.headers, data: parsed, raw: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'object' ? JSON.stringify(body) : body);
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING SPORTZONE BACKEND API TESTS ---');
  let failures = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`[PASS] ${name}`);
    } catch (err) {
      failures++;
      console.error(`[FAIL] ${name}: ${err.message}`);
    }
  }

  const host = 'localhost';
  const port = process.env.PORT || 5000;

  // 1. Config endpoint
  await test('GET /api/config returns venues & slots', async () => {
    const res = await request({ host, port, path: '/api/config', method: 'GET' });
    assert.strictEqual(res.statusCode, 200);
    assert(Array.isArray(res.data.venues));
    assert(Array.isArray(res.data.timeSlots));
    assert.strictEqual(res.data.currency, 'INR');
  });

  // 2. Admin Login
  let adminToken = '';
  await test('POST /api/admin/login authenticates admin', async () => {
    const res = await request(
      { host, port, path: '/api/admin/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { username: 'admin', password: 'admin123' }
    );
    assert.strictEqual(res.statusCode, 200);
    assert(res.data.token);
    adminToken = res.data.token;
  });

  // 3. User Registration
  const testPhone = '98' + Math.floor(10000000 + Math.random() * 90000000);
  let userToken = '';
  await test('POST /api/auth/register registers new user', async () => {
    const res = await request(
      { host, port, path: '/api/auth/register', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { name: 'Test User', phone: testPhone, password: 'password123' }
    );
    assert.strictEqual(res.statusCode, 201);
    assert(res.data.token);
    userToken = res.data.token;
  });

  // 4. User Login
  await test('POST /api/auth/login authenticates user', async () => {
    const res = await request(
      { host, port, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } },
      { phone: testPhone, password: 'password123' }
    );
    assert.strictEqual(res.statusCode, 200);
    assert(res.data.token);
  });

  // 5. Auth /me
  await test('GET /api/auth/me verifies JWT', async () => {
    const res = await request({
      host, port, path: '/api/auth/me', method: 'GET',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.data.user.phone, testPhone);
  });

  // 6. Slots endpoint
  await test('GET /api/slots returns slot availability', async () => {
    const res = await request({ host, port, path: '/api/slots', method: 'GET' });
    assert.strictEqual(res.statusCode, 200);
    assert(res.data.date);
    assert(Array.isArray(res.data.venues));
  });

  // 7. Admin Dashboard
  await test('GET /api/admin/dashboard returns admin overview', async () => {
    const res = await request({
      host, port, path: '/api/admin/dashboard', method: 'GET',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.statusCode, 200);
    assert(res.data.stats);
    assert(Array.isArray(res.data.users));
  });

  // 8. Public Dashboard Stats
  await test('GET /api/dashboard/stats returns stats', async () => {
    const res = await request({ host, port, path: '/api/dashboard/stats', method: 'GET' });
    assert.strictEqual(res.statusCode, 200);
    assert(typeof res.data.registeredAccounts === 'number');
  });

  // 9. Page Routes verification
  const pages = ['/', '/index.html', '/auth', '/auth.html', '/dashboard', '/dashboard.html', '/admin', '/admin-login.html', '/admin-dashboard', '/admin-dashboard.html', '/compare', '/compare.html'];
  for (const page of pages) {
    await test(`GET ${page} returns 200 OK`, async () => {
      const res = await request({ host, port, path: page, method: 'GET' });
      assert.strictEqual(res.statusCode, 200);
    });
  }

  console.log(`\n--- TEST SUMMARY: ${failures === 0 ? 'ALL TESTS PASSED' : failures + ' TESTS FAILED'} ---`);
  if (failures > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal error during tests:', err);
  process.exit(1);
});
