let config = { venues: [], timeSlots: [] };

let socket = null;
try {
  const socketUrl = window.API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000');
  if (typeof io !== 'undefined') {
    socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      auth: { token: localStorage.getItem('sportzone_token') }
    });

    socket.on('connect', () => {
      console.log('[Web Dashboard Socket] Connected:', socket.id);
      const token = localStorage.getItem('sportzone_token');
      if (token) {
        socket.emit('authenticate', { token });
      }
      loadDashboardData();
      loadAvailableSlots();
    });

    socket.on('my_booking_updated', async (payload) => {
      console.log('[Web Dashboard Socket] My booking updated:', payload);
      await loadDashboardData();
      await loadAvailableSlots();
    });

    socket.on('booking_updated', async (payload) => {
      console.log('[Web Dashboard Socket] Booking event received. Refreshing...', payload);
      await loadDashboardData();
      await loadAvailableSlots();
    });

    socket.on('app_state_changed', async () => {
      await loadDashboardData();
      await loadAvailableSlots();
    });
  }
} catch (e) {
  console.log('[Socket Web Init Warning]', e.message);
}

document.addEventListener('DOMContentLoaded', async () => {

  const todayEl = document.getElementById('today-date');
  const bookingForm = document.getElementById('booking-form');
  const venueSelect = document.getElementById('booking-venue');
  const tournamentRequestForm = document.getElementById('tournament-request-form');

  if (todayEl) todayEl.textContent = new Date().toLocaleDateString('en-IN');

  await loadConfig();
  await loadDashboardData();
  await loadAvailableSlots();

  venueSelect.addEventListener('change', loadAvailableSlots);

  bookingForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = localStorage.getItem('sportzone_token');
    if (!token) {
      window.location.href = 'auth.html';
      return;
    }

    const button = bookingForm.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Booking...';

    try {
      const response = await fetch(`${window.API_BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          venue: document.getElementById('booking-venue').value,
          time: document.getElementById('booking-time').value,
          team: document.getElementById('booking-team').value
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Booking failed');

      bookingForm.reset();
      await loadDashboardData();
      await loadAvailableSlots();
      showToast('Booking request sent to admin');
    } catch (error) {
      showToast(error.message);
      await loadAvailableSlots();
    } finally {
      button.disabled = false;
      button.textContent = 'Request booking';
    }
  });

  tournamentRequestForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = localStorage.getItem('sportzone_token');
    if (!token) {
      window.location.href = 'auth.html';
      return;
    }

    const response = await fetch(`${window.API_BASE_URL}/api/tournament-venue-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        tournamentName: document.getElementById('tournament-name').value,
        venue: document.getElementById('tournament-venue').value,
        requestedDate: document.getElementById('tournament-date').value,
        notes: document.getElementById('tournament-notes').value
      })
    });
    const result = await response.json();
    if (!response.ok) {
      showToast(result.error || 'Request failed');
      return;
    }
    tournamentRequestForm.reset();
    showToast('Tournament venue request sent to admin');
  });
});

async function loadConfig() {
  const response = await fetch(`${window.API_BASE_URL}/api/config`);
  config = await response.json();
  const venueSelect = document.getElementById('booking-venue');
  venueSelect.innerHTML = config.venues.map(venue =>
    `<option value="${esc(venue.name)}">${esc(venue.name)} - ${formatINR(venue.fee)}</option>`
  ).join('');
  document.getElementById('tournament-venue').innerHTML = config.venues.map(venue =>
    `<option value="${esc(venue.name)}">${esc(venue.name)}</option>`
  ).join('');
}

async function loadDashboardData() {
  const [statsResponse, bookingsResponse] = await Promise.all([
    fetch(`${window.API_BASE_URL}/api/dashboard/stats`),
    fetch(`${window.API_BASE_URL}/api/bookings`)
  ]);
  const stats = await statsResponse.json();
  const bookings = await bookingsResponse.json();

  document.getElementById('stat-bookings').textContent = stats.bookingsToday;
  document.getElementById('stat-slots').textContent = stats.availableSlots;
  document.getElementById('stat-players').textContent = stats.activePlayers;
  document.getElementById('stat-revenue').textContent = stats.revenueMonthly;
  document.getElementById('online-players-count').textContent = `${localStorage.getItem('sportzone_token') ? 1 : 0} online | ${stats.registeredAccounts} registered`;

  renderBookings(bookings);
  renderUtilization({
    'Open Slots': stats.availableSlots,
    'Pending Requests': stats.pendingBookings || 0,
    'Approved Players': stats.activePlayers || 0
  });
}

async function loadAvailableSlots() {
  const venue = document.getElementById('booking-venue').value;
  const response = await fetch(`${window.API_BASE_URL}/api/slots?venue=${encodeURIComponent(venue)}`);
  const data = await response.json();
  const selectedVenue = data.venues[0];
  const timeSelect = document.getElementById('booking-time');
  const slotBoard = document.getElementById('available-slot-board');

  if (!selectedVenue || selectedVenue.slots.length === 0) {
    timeSelect.innerHTML = '<option value="">No slots available</option>';
    slotBoard.innerHTML = '<div class="slot-pill">Fully booked</div>';
    return;
  }

  timeSelect.innerHTML = selectedVenue.slots.map(slot =>
    `<option value="${slot.time}">${formatTimeRange(slot.time)}</option>`
  ).join('');
  slotBoard.innerHTML = selectedVenue.slots.map(slot =>
    `<div class="slot-pill">${formatTimeRange(slot.time)}</div>`
  ).join('');
}

function renderBookings(bookings) {
  const container = document.getElementById('bookings-container');
  if (!bookings.length) {
    container.innerHTML = '<p class="muted">No bookings for today.</p>';
    return;
  }

  container.innerHTML = bookings.map(booking => `
    <div class="booking-row">
      <div class="booking-time">${esc(booking.time)}</div>
      <div>
        <p><strong>${esc(booking.venue)}</strong></p>
        <p class="muted">${esc(booking.team)} | ${formatINR(booking.fee)} | ${esc(booking.status)}</p>
      </div>
      <button class="pro-button-danger" onclick="deleteBooking(${booking.id})">Remove</button>
    </div>
  `).join('');
}

function renderUtilization(utilization) {
  const container = document.getElementById('utilization-container');
  container.innerHTML = Object.entries(utilization).map(([name, value]) => `
    <div class="venue-row" style="padding:14px;margin-top:10px">
      <div style="display:flex;justify-content:space-between;gap:12px">
        <strong>${esc(name)}</strong>
        <span>${value}%</span>
      </div>
      <div style="height:9px;background:#e2e8f0;border-radius:999px;margin-top:10px;overflow:hidden">
        <div style="height:100%;width:${value}%;background:linear-gradient(90deg,#0f766e,#f59e0b)"></div>
      </div>
    </div>
  `).join('');
}

async function deleteBooking(id) {
  const token = localStorage.getItem('sportzone_token');
  if (!token) {
    window.location.href = 'auth.html';
    return;
  }

  const response = await fetch(`${window.API_BASE_URL}/api/bookings/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  const result = await response.json();
  if (!response.ok) {
    showToast(result.error || 'Unable to remove booking');
    return;
  }

  await loadDashboardData();
  await loadAvailableSlots();
  showToast('Booking removed');
}
