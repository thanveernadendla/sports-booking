const io = require('socket.io-client');
const http = require('http');

const API_BASE = 'http://localhost:5000';

function postJson(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(path, API_BASE);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    }, res => {
      let respBody = '';
      res.on('data', chunk => respBody += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(respBody) });
        } catch (e) {
          resolve({ status: res.statusCode, data: respBody });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function deleteReq(path, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const req = http.request(url, {
      method: 'DELETE',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    }, res => {
      let respBody = '';
      res.on('data', chunk => respBody += chunk);
      res.on('end', () => resolve({ status: res.statusCode }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function runLatencyTest() {
  console.log('=== REAL-TIME LATENCY & SYNCHRONIZATION BENCHMARK (20 ROUNDS) ===\n');

  // Authenticate user & admin using standard credentials
  const userPhone = '9870000001';
  const password = 'password123';

  let resUser = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: userPhone, password })
  });
  let userData = await resUser.json();
  if (!resUser.ok) {
    resUser = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Benchmark User', phone: userPhone, password })
    });
    userData = await resUser.json();
  }
  const userToken = userData.token;

  const resAdmin = await fetch(`${API_BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const adminData = await resAdmin.json();
  const adminToken = adminData.token;

  // Client 1: Simulating Web Dashboard
  const webClient = io(API_BASE, { auth: { token: userToken }, transports: ['websocket'] });
  // Client 2: Simulating Mobile App
  const mobileClient = io(API_BASE, { auth: { token: adminToken }, transports: ['websocket'] });

  await new Promise(r => {
    let connected = 0;
    const check = () => { if (++connected === 2) r(); };
    webClient.on('connect', check);
    mobileClient.on('connect', check);
  });

  console.log('Both simulated clients connected to live Socket.IO server.\n');

  const measurements = [];

  for (let i = 1; i <= 20; i++) {
    // Dynamically fetch available slots
    const slotsRes = await fetch(`${API_BASE}/api/slots`);
    const slotsData = await slotsRes.json();
    const availableVenue = slotsData.venues.find(v => v.slots && v.slots.length > 0);
    if (!availableVenue) {
      throw new Error('No available slots found for round ' + i);
    }
    const venue = availableVenue.name;
    const time = availableVenue.slots[0].time;

    const startTime = Date.now();
    let eventReceived = false;
    let receiveTime = 0;

    let listenerRef;
    const promiseEvent = new Promise((resolve) => {
      listenerRef = (payload) => {
        eventReceived = true;
        receiveTime = Date.now();
        mobileClient.off('admin_booking_updated', listenerRef);
        resolve();
      };
      mobileClient.on('admin_booking_updated', listenerRef);
    });

    const bookingRes = await postJson('/api/bookings', {
      venue,
      time,
      team: `Latency Team ${i}`
    }, userToken);

    if (bookingRes.status !== 201) {
      mobileClient.off('admin_booking_updated', listenerRef);
      console.error(`Round ${i} POST failed (${bookingRes.status}):`, bookingRes.data);
      throw new Error(`Round ${i} booking failed: ${JSON.stringify(bookingRes.data)}`);
    }

    if (!eventReceived) {
      await Promise.race([
        promiseEvent,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Event timeout in round ${i}`)), 3000))
      ]);
    }

    const latencyMs = receiveTime - startTime;
    measurements.push(latencyMs);

    // Clean up created booking
    if (bookingRes.data && bookingRes.data.id) {
      await deleteReq(`/api/bookings/${bookingRes.data.id}`, userToken);
    }

    console.log(`Round ${i.toString().padStart(2, ' ')}: [${venue} @ ${time}] Propagation Time = ${latencyMs} ms ${latencyMs < 1000 ? '✅ (< 1.0s)' : '⚠️'}`);
    await new Promise(r => setTimeout(r, 250));
  }

  webClient.disconnect();
  mobileClient.disconnect();

  const total = measurements.reduce((a, b) => a + b, 0);
  const avg = Math.round(total / measurements.length);
  const max = Math.max(...measurements);
  const min = Math.min(...measurements);
  const passedUnder1s = measurements.filter(m => m < 1000).length;

  console.log('\n--- LATENCY BENCHMARK SUMMARY ---');
  console.log(`Total Rounds: ${measurements.length}`);
  console.log(`Minimum Latency: ${min} ms`);
  console.log(`Average Latency: ${avg} ms`);
  console.log(`Maximum Latency: ${max} ms`);
  console.log(`Completed within 1.0s: ${passedUnder1s}/${measurements.length} (${(passedUnder1s/measurements.length * 100).toFixed(1)}%)`);

  process.exit(0);
}

runLatencyTest().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
