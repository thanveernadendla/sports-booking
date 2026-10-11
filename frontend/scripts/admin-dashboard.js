let adminToken = '';
let adminData = null;
let adminSocket = null;

// Socket.io Real-Time Updates Listener for Admin Web Dashboard
try {
  const socketUrl = window.API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');
  if (typeof io !== 'undefined') {
    const token = localStorage.getItem('sportzone_admin_token');
    adminSocket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      auth: { token }
    });

    adminSocket.on('connect', () => {
      console.log('[Admin Dashboard Socket] Connected:', adminSocket.id);
      const curToken = localStorage.getItem('sportzone_admin_token');
      if (curToken) {
        adminSocket.emit('authenticate', { token: curToken });
      }
      if (adminToken && typeof loadAdminDashboard === 'function') {
        loadAdminDashboard();
      }
    });

    adminSocket.on('admin_booking_updated', async (payload) => {
      console.log('[Admin Dashboard Socket] Realtime admin booking update received:', payload);
      if (adminToken && typeof loadAdminDashboard === 'function') {
        await loadAdminDashboard();
      }
    });

    adminSocket.on('booking_updated', async () => {
      console.log('[Admin Dashboard Socket] Realtime booking update received. Refreshing...');
      if (adminToken && typeof loadAdminDashboard === 'function') {
        await loadAdminDashboard();
      }
    });

    adminSocket.on('app_state_changed', async () => {
      if (adminToken && typeof loadAdminDashboard === 'function') {
        await loadAdminDashboard();
      }
    });
  }
} catch (e) {
  console.log('[Socket Admin Init Warning]', e.message);
}

document.addEventListener('DOMContentLoaded', async () => {

  adminToken = localStorage.getItem('sportzone_admin_token');
  const admin = JSON.parse(localStorage.getItem('sportzone_admin_user') || 'null');
  const regularUser = JSON.parse(localStorage.getItem('sportzone_user') || 'null');

  if (regularUser && regularUser.role !== 'admin' && !adminToken) {
    alert('Access Denied: Administrator account required.');
    window.location.href = 'dashboard.html';
    return;
  }

  if (!adminToken || !admin || admin.role !== 'admin') {
    window.location.href = 'admin-login.html';
    return;
  }

  document.getElementById('admin-name').textContent = `${admin.name} | ${admin.username || admin.phone}`;
  document.getElementById('admin-logout').addEventListener('click', () => {
    localStorage.removeItem('sportzone_admin_token');
    localStorage.removeItem('sportzone_admin_user');
    window.location.href = 'admin-login.html';
  });

  document.getElementById('venue-form').addEventListener('submit', addVenue);
  document.getElementById('tournament-form').addEventListener('submit', addTournament);

  await loadAdminDashboard();
});

async function adminFetch(url, options = {}) {
  const response = await fetch(`${window.API_BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.error || 'Admin action failed');
  return data;
}

async function loadAdminDashboard() {
  try {
    adminData = await adminFetch('/api/admin/dashboard');
  } catch (error) {
    showToast(error.message);
    window.location.href = 'admin-login.html';
    return;
  }

  document.getElementById('admin-users').textContent = adminData.stats.users;
  document.getElementById('admin-pending-bookings').textContent = adminData.stats.pendingBookings;
  document.getElementById('admin-pending-requests').textContent = adminData.stats.pendingVenueRequests;
  document.getElementById('admin-revenue').textContent = adminData.stats.revenue;
  document.getElementById('admin-3d-booked').textContent = adminData.stats.bookingsToday;
  document.getElementById('admin-3d-open').textContent = adminData.stats.availableSlots;

  renderUsers();
  renderBookings();
  renderVenues();
  renderTournaments();
  renderTournamentVenueRequests();
}

function renderUsers() {
  const rows = document.getElementById('admin-user-rows');
  rows.innerHTML = adminData.users.length ? adminData.users.map(user => `
    <tr>
      <td>${esc(user.name)}</td>
      <td>${esc(user.phone)}</td>
      <td><span class="status-badge ${statusClass(user.status)}">${esc(user.status)}</span></td>
      <td>
        <div class="admin-actions">
          <button class="pro-button" onclick="setUserStatus(${user.id}, 'Approved')">Approve</button>
          <button class="pro-button-danger" onclick="setUserStatus(${user.id}, 'Rejected')">Reject</button>
          <button class="pro-button-secondary" onclick="setUserStatus(${user.id}, 'Blocked')">Block</button>
        </div>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="4">No customers registered yet.</td></tr>';
}

function renderBookings() {
  const rows = document.getElementById('admin-booking-rows');
  rows.innerHTML = adminData.bookings.length ? adminData.bookings.map(booking => `
    <tr>
      <td>${esc(formatTimeRange(booking.time))}</td>
      <td>${esc(booking.venue)}</td>
      <td>${esc(booking.team)}</td>
      <td>${esc(booking.customerName || 'Customer')}<br><span class="muted">${esc(booking.customerPhone || '')}</span></td>
      <td>${formatINR(booking.fee)}</td>
      <td><span class="status-badge ${statusClass(booking.status)}">${esc(booking.status)}</span></td>
      <td>
        <div class="admin-actions">
          <button class="pro-button" onclick="setBookingStatus(${booking.id}, 'Approved')">Approve</button>
          <button class="pro-button-danger" onclick="setBookingStatus(${booking.id}, 'Rejected')">Reject</button>
        </div>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="7">No booking requests yet.</td></tr>';
}

function renderVenues() {
  document.getElementById('admin-venues').innerHTML = adminData.venues.map(venue => `
    <div class="venue-row" style="padding:14px;margin-top:10px">
      <div style="display:flex;justify-content:space-between;gap:12px">
        <strong>${esc(venue.name)}</strong>
        <span>${venue.booked} requested</span>
      </div>
      <p class="muted">${venue.available} slots open | ${formatINR(venue.fee)}</p>
    </div>
  `).join('');

  document.getElementById('admin-venue-list').innerHTML = adminData.venues.map(venue => `
    <div class="manage-row">
      <div>
        <strong>${esc(venue.name)}</strong>
        <p class="muted">${esc(venue.category)} | ${formatINR(venue.fee)} | ${esc(venue.status)}</p>
      </div>
      <div class="admin-actions">
        <button class="pro-button-secondary" onclick="changeVenuePrice(${venue.id}, -100)">- ₹100</button>
        <input class="price-input" id="venue-price-${venue.id}" type="number" min="1" value="${Number(venue.fee)}" aria-label="Price for ${esc(venue.name)}" />
        <button class="pro-button-secondary" onclick="saveVenuePrice(${venue.id})">Save price</button>
        <button class="pro-button-secondary" onclick="changeVenuePrice(${venue.id}, 100)">+ ₹100</button>
        <button class="pro-button" onclick="setVenueStatus(${venue.id}, 'Approved')">Approve</button>
        <button class="pro-button-danger" onclick="setVenueStatus(${venue.id}, 'Rejected')">Reject</button>
        <button class="pro-button-secondary" onclick="setVenueStatus(${venue.id}, 'Inactive')">Inactive</button>
      </div>
    </div>
  `).join('');

  const select = document.getElementById('admin-tournament-venue');
  select.innerHTML = '<option value="">No venue selected</option>' + adminData.venues
    .filter(venue => venue.status === 'Approved')
    .map(venue => `<option value="${esc(venue.name)}">${esc(venue.name)}</option>`)
    .join('');
}

function renderTournaments() {
  document.getElementById('admin-tournament-list').innerHTML = adminData.tournaments.length ? adminData.tournaments.map(tournament => `
    <div class="manage-row">
      <div>
        <strong>${esc(tournament.name)}</strong>
        <p class="muted">${esc(tournament.sport)} | ${esc(tournament.venue || 'Venue not assigned')} | ${esc(tournament.status)}</p>
      </div>
      <div class="admin-actions">
        <button class="pro-button" onclick="setTournamentStatus(${tournament.id}, 'Open')">Open</button>
        <button class="pro-button-secondary" onclick="setTournamentStatus(${tournament.id}, 'Closed')">Close</button>
      </div>
    </div>
  `).join('') : '<p class="muted">No tournaments created yet.</p>';
}

function renderTournamentVenueRequests() {
  const rows = document.getElementById('admin-request-rows');
  rows.innerHTML = adminData.tournamentVenueRequests.length ? adminData.tournamentVenueRequests.map(request => `
    <tr>
      <td>${esc(request.tournamentName)}</td>
      <td>${esc(request.venue)}</td>
      <td>${esc(request.requestedDate)}</td>
      <td>${esc(request.customerName || 'Customer')}<br><span class="muted">${esc(request.customerPhone || '')}</span></td>
      <td><span class="status-badge ${statusClass(request.status)}">${esc(request.status)}</span></td>
      <td>
        <div class="admin-actions">
          <button class="pro-button" onclick="setTournamentVenueRequestStatus(${request.id}, 'Approved')">Approve</button>
          <button class="pro-button-danger" onclick="setTournamentVenueRequestStatus(${request.id}, 'Rejected')">Reject</button>
        </div>
      </td>
    </tr>
  `).join('') : '<tr><td colspan="6">No tournament venue requests yet.</td></tr>';
}

async function setUserStatus(id, status) {
  await updateStatus(`/api/admin/users/${id}/status`, status, 'Customer status updated');
}

async function setBookingStatus(id, status) {
  await updateStatus(`/api/admin/bookings/${id}/status`, status, 'Booking status updated');
}

async function setVenueStatus(id, status) {
  await adminFetch(`/api/admin/venues/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
  showToast('Venue status updated');
  await loadAdminDashboard();
}

async function changeVenuePrice(id, delta) {
  const venue = adminData.venues.find(item => item.id === id);
  if (!venue) return;
  const nextFee = Math.max(1, Number(venue.fee) + delta);
  await saveVenuePatch(id, { fee: nextFee }, 'Venue price updated');
}

async function saveVenuePrice(id) {
  const input = document.getElementById(`venue-price-${id}`);
  const fee = Math.max(1, Number(input.value || 0));
  await saveVenuePatch(id, { fee }, 'Venue price saved');
}

async function saveVenuePatch(id, body, message) {
  try {
    await adminFetch(`/api/admin/venues/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
    showToast(message);
    await loadAdminDashboard();
  } catch (error) {
    showToast(error.message);
  }
}

async function setTournamentStatus(id, status) {
  await adminFetch(`/api/admin/tournaments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  });
  showToast('Tournament status updated');
  await loadAdminDashboard();
}

async function setTournamentVenueRequestStatus(id, status) {
  await updateStatus(`/api/admin/tournament-venue-requests/${id}/status`, status, 'Tournament venue request updated');
}

async function updateStatus(url, status, message) {
  try {
    await adminFetch(url, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
    showToast(message);
    await loadAdminDashboard();
  } catch (error) {
    showToast(error.message);
  }
}

async function addVenue(event) {
  event.preventDefault();
  try {
    await adminFetch('/api/admin/venues', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('venue-name').value.trim(),
        category: document.getElementById('venue-category').value.trim(),
        fee: document.getElementById('venue-fee').value
      })
    });
    event.target.reset();
    showToast('Venue added');
    await loadAdminDashboard();
  } catch (error) {
    showToast(error.message);
  }
}

async function addTournament(event) {
  event.preventDefault();
  try {
    await adminFetch('/api/admin/tournaments', {
      method: 'POST',
      body: JSON.stringify({
        name: document.getElementById('admin-tournament-name').value.trim(),
        sport: document.getElementById('admin-tournament-sport').value.trim(),
        startDate: document.getElementById('admin-tournament-date').value,
        venue: document.getElementById('admin-tournament-venue').value
      })
    });
    event.target.reset();
    showToast('Tournament added');
    await loadAdminDashboard();
  } catch (error) {
    showToast(error.message);
  }
}

function statusClass(status) {
  return `status-${String(status || '').toLowerCase()}`;
}
