const assert = require('assert');

const API_BASE = 'http://localhost:5000';

async function run() {
  console.log('=== STARTING SEPARATION & AUTHORIZATION VERIFICATION ===\n');

  // 1. Create/Login User A
  const userAPhone = '9870000001';
  const userBPhone = '9870000002';
  const password = 'password123';

  console.log('[Test 1] User A Registration / Login...');
  let resA = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'User Alpha', phone: userAPhone, password })
  });
  let dataA = await resA.json();
  if (!resA.ok) {
    resA = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: userAPhone, password })
    });
    dataA = await resA.json();
  }
  assert(dataA.token, 'User A should receive token');
  assert.strictEqual(dataA.user.role, 'user', 'User A role must be user');
  console.log('  -> User A authenticated: ID', dataA.user.id, dataA.user.name);

  // 2. Create/Login User B
  console.log('[Test 2] User B Registration / Login...');
  let resB = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'User Beta', phone: userBPhone, password })
  });
  let dataB = await resB.json();
  if (!resB.ok) {
    resB = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: userBPhone, password })
    });
    dataB = await resB.json();
  }
  assert(dataB.token, 'User B should receive token');
  assert.strictEqual(dataB.user.role, 'user', 'User B role must be user');
  console.log('  -> User B authenticated: ID', dataB.user.id, dataB.user.name);

  // 3. Login Admin
  console.log('[Test 3] Admin Login...');
  const resAdmin = await fetch(`${API_BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const dataAdmin = await resAdmin.json();
  assert(dataAdmin.token, 'Admin should receive token');
  assert.strictEqual(dataAdmin.user.role, 'admin', 'Admin role must be admin');
  console.log('  -> Admin authenticated: ID', dataAdmin.user.id, dataAdmin.user.name);

  // 4. Create a Booking under User A on an available slot
  console.log('[Test 4] Querying available slots and User A creating booking...');
  const slotsRes = await fetch(`${API_BASE}/api/slots`);
  const slotsData = await slotsRes.json();
  const venueWithSlot = slotsData.venues.find(v => v.slots && v.slots.length > 0);
  assert(venueWithSlot, 'At least one venue must have available slots');
  const targetVenue = venueWithSlot.name;
  const targetSlot = venueWithSlot.slots[0].time;

  const bookResA = await fetch(`${API_BASE}/api/bookings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${dataA.token}`
    },
    body: JSON.stringify({
      venue: targetVenue,
      time: targetSlot,
      team: 'Alpha Warriors'
    })
  });
  const bookingA = await bookResA.json();
  assert(bookingA.id, 'Booking must be created with numeric ID: ' + JSON.stringify(bookingA));
  console.log('  -> User A booking created:', bookingA.id, targetVenue, targetSlot);

  // 5. Verify User A sees ONLY User A bookings via /api/bookings/my
  console.log('[Test 5] Checking User A My Bookings endpoint...');
  const myBookingsResA = await fetch(`${API_BASE}/api/bookings/my`, {
    headers: { Authorization: `Bearer ${dataA.token}` }
  });
  const myBookingsA = await myBookingsResA.json();
  assert(Array.isArray(myBookingsA), 'Must return array');
  assert(myBookingsA.every(b => b.userId === dataA.user.id), 'User A must see only their own bookings');
  console.log('  -> User A sees', myBookingsA.length, 'bookings, all belonging to User A.');

  // 6. Verify User B sees ONLY User B bookings via /api/bookings/my
  console.log('[Test 6] Checking User B My Bookings endpoint...');
  const myBookingsResB = await fetch(`${API_BASE}/api/bookings/my`, {
    headers: { Authorization: `Bearer ${dataB.token}` }
  });
  const myBookingsB = await myBookingsResB.json();
  assert(Array.isArray(myBookingsB), 'Must return array');
  assert(myBookingsB.every(b => b.userId === dataB.user.id), 'User B must see only their own bookings');
  assert(!myBookingsB.some(b => b.userId === dataA.user.id), 'User B MUST NOT see User A bookings');
  console.log('  -> User B sees', myBookingsB.length, 'bookings, none belonging to User A.');

  // 7. Verify Admin sees platform-wide bookings via /api/admin/dashboard
  console.log('[Test 7] Checking Admin Platform-Wide Bookings...');
  const adminDashRes = await fetch(`${API_BASE}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${dataAdmin.token}` }
  });
  const adminDash = await adminDashRes.json();
  assert(adminDash.bookings && Array.isArray(adminDash.bookings), 'Admin must receive platform bookings');
  console.log('  -> Admin sees', adminDash.bookings.length, 'platform-wide bookings.');

  // 8. Security Test: Regular User A calls Admin Dashboard -> Must be 403 Forbidden
  console.log('[Test 8] Security: Regular User A attempts to access Admin Dashboard...');
  const unauthRes = await fetch(`${API_BASE}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${dataA.token}` }
  });
  assert.strictEqual(unauthRes.status, 403, 'Regular user must receive 403 Forbidden on admin endpoint');
  console.log('  -> Correctly rejected with 403 Forbidden.');

  // 9. Security Test: User B attempts to delete User A booking -> Must be 403 Forbidden
  if (bookingA && bookingA.id) {
    console.log('[Test 9] Security: User B attempts to delete User A booking #' + bookingA.id + '...');
    const delUnauthRes = await fetch(`${API_BASE}/api/bookings/${bookingA.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${dataB.token}` }
    });
    assert.strictEqual(delUnauthRes.status, 403, 'User B must be forbidden from deleting User A booking');
    console.log('  -> Correctly rejected with 403 Forbidden.');
  }

  // 10. Admin Action: Admin updates booking status
  if (bookingA && bookingA.id) {
    console.log('[Test 10] Admin approves booking #' + bookingA.id + '...');
    const approveRes = await fetch(`${API_BASE}/api/admin/bookings/${bookingA.id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${dataAdmin.token}`
      },
      body: JSON.stringify({ status: 'Approved' })
    });
    const approvedData = await approveRes.json();
    assert.strictEqual(approvedData.status, 'Approved', 'Booking status must be Approved');
    console.log('  -> Booking #' + bookingA.id + ' successfully approved by admin.');

    // Cleanup: User A cancels own booking
    console.log('[Test 11] User A deletes own booking #' + bookingA.id + '...');
    const delAuthRes = await fetch(`${API_BASE}/api/bookings/${bookingA.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${dataA.token}` }
    });
    assert(delAuthRes.ok, 'User A should be permitted to delete own booking');
    console.log('  -> Booking successfully deleted by owner.');
  }

  console.log('\n=== ALL 11 SEPARATION & AUTHORIZATION TESTS PASSED! ===');
}

run().catch(err => {
  console.error('\n❌ Test Failure:', err);
  process.exit(1);
});
