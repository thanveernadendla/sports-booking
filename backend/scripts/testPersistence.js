const http = require('http');
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const User = require('../models/User');
const Venue = require('../models/Venue');
const Booking = require('../models/Booking');
const Tournament = require('../models/Tournament');
const TournamentVenueRequest = require('../models/TournamentVenueRequest');

const BASE_URL = 'http://localhost:5000';

function makeRequest(method, endpoint, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runPersistenceTests() {
  console.log('=== STARTING MONGODB ATLAS PERSISTENCE VERIFICATION ===\n');
  let testCount = 0;
  let passCount = 0;

  function assertTest(name, condition, details = '') {
    testCount++;
    if (condition) {
      passCount++;
      console.log(`[PASS] Test ${testCount}: ${name}`);
    } else {
      console.error(`[FAIL] Test ${testCount}: ${name} - ${details}`);
    }
  }

  try {
    // Connect Mongoose to MongoDB Atlas for direct database queries verification
    try { require('dns').setServers(['8.8.8.8', '1.1.1.1']); } catch(e){}
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[Direct DB Verification Connected to MongoDB Atlas]\n');

    // 1. User Registration & Persistence
    const testPhone = '999' + Math.floor(1000000 + Math.random() * 9000000);
    const regRes = await makeRequest('POST', '/api/auth/register', {
      name: 'Persistence Tester',
      phone: testPhone,
      password: 'password123'
    });
    assertTest('User Registration API', regRes.status === 201 && regRes.data.token, JSON.stringify(regRes.data));

    const dbUser = await User.findOne({ phone: testPhone });
    assertTest('User Direct MongoDB Persistence', dbUser !== null && dbUser.name === 'Persistence Tester', 'User not found in DB');

    // 2. User Login
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      phone: testPhone,
      password: 'password123'
    });
    assertTest('User Login API', loginRes.status === 200 && loginRes.data.token);
    const userToken = loginRes.data.token;

    // 3. Admin Login
    const adminLoginRes = await makeRequest('POST', '/api/admin/login', {
      username: 'admin',
      password: 'admin123'
    });
    assertTest('Admin Login API', adminLoginRes.status === 200 && adminLoginRes.data.token, JSON.stringify(adminLoginRes.data));

    const adminToken = adminLoginRes.data.token;

    // 4. Create Venue (Admin)
    const testVenueName = 'Atlas Arena ' + Date.now();
    const createVenueRes = await makeRequest('POST', '/api/admin/venues', {
      name: testVenueName,
      category: 'Badminton',
      fee: 650
    }, adminToken);
    assertTest('Create Venue API', createVenueRes.status === 201 && createVenueRes.data.id, JSON.stringify(createVenueRes.data));

    const dbVenue = await Venue.findOne({ name: testVenueName });
    assertTest('Venue Direct MongoDB Persistence', dbVenue !== null && dbVenue.fee === 650, 'Venue not found in DB');

    // 5. Update Venue (Admin)
    const updateVenueRes = await makeRequest('PUT', `/api/admin/venues/${createVenueRes.data.id}`, {
      fee: 750
    }, adminToken);
    assertTest('Update Venue API', updateVenueRes.status === 200 && updateVenueRes.data.fee === 750);

    const dbUpdatedVenue = await Venue.findOne({ id: createVenueRes.data.id });
    assertTest('Updated Venue Direct MongoDB Persistence', dbUpdatedVenue.fee === 750);

    // 6. Get Available Slots (Public/User)
    const slotsRes = await makeRequest('GET', `/api/slots?venue=${encodeURIComponent(testVenueName)}`);
    assertTest('Get Available Slots API', slotsRes.status === 200 && slotsRes.data.venues.length > 0);

    // 7. Create Booking (User)
    const createBookingRes = await makeRequest('POST', '/api/bookings', {
      time: '14:00',
      venue: testVenueName,
      team: 'Atlas Strikers'
    }, userToken);
    assertTest('Create Booking API', createBookingRes.status === 201 && createBookingRes.data.id, JSON.stringify(createBookingRes.data));

    const dbBooking = await Booking.findOne({ id: createBookingRes.data.id });
    assertTest('Booking Direct MongoDB Persistence', dbBooking !== null && dbBooking.team === 'Atlas Strikers', 'Booking not found in DB');

    // 8. Delete Booking (User)
    const deleteBookingRes = await makeRequest('DELETE', `/api/bookings/${createBookingRes.data.id}`, null, userToken);
    assertTest('Delete Booking API', deleteBookingRes.status === 200 && deleteBookingRes.data.success);

    const dbDeletedBooking = await Booking.findOne({ id: createBookingRes.data.id });
    assertTest('Deleted Booking MongoDB Verification', dbDeletedBooking === null, 'Booking still exists in DB');

    // 9. Create Tournament (Admin)
    const testTournamentName = 'Atlas Cup ' + Date.now();
    const createTourneyRes = await makeRequest('POST', '/api/admin/tournaments', {
      name: testTournamentName,
      sport: 'Football',
      venue: testVenueName
    }, adminToken);
    assertTest('Create Tournament API', createTourneyRes.status === 201 && createTourneyRes.data.id);

    const dbTourney = await Tournament.findOne({ id: createTourneyRes.data.id });
    assertTest('Tournament Direct MongoDB Persistence', dbTourney !== null && dbTourney.name === testTournamentName);

    // 10. Create Tournament Venue Request (User)
    const createReqRes = await makeRequest('POST', '/api/tournament-venue-requests', {
      tournamentName: testTournamentName,
      venue: testVenueName,
      notes: 'Requesting central court for finals'
    }, userToken);
    assertTest('Create Tournament Request API', createReqRes.status === 201 && createReqRes.data.id);

    const dbReq = await TournamentVenueRequest.findOne({ id: createReqRes.data.id });
    assertTest('Tournament Request Direct MongoDB Persistence', dbReq !== null && dbReq.notes.includes('finals'));

    // 11. Cleanup Test Records
    await User.deleteOne({ _id: dbUser._id });
    await Venue.deleteOne({ _id: dbVenue._id });
    await Tournament.deleteOne({ _id: dbTourney._id });
    await TournamentVenueRequest.deleteOne({ _id: dbReq._id });
    console.log('\n[Cleaned up test records from MongoDB Atlas]');

    console.log(`\n=== VERIFICATION COMPLETE: ${passCount}/${testCount} PASSED ===`);
    process.exit(0);

  } catch (error) {
    console.error('Test execution error:', error);
    process.exit(1);
  }
}

runPersistenceTests();
