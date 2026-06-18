// Dashboard Interactive Script for SportZone

document.addEventListener('DOMContentLoaded', () => {
  const addBookingBtn = document.getElementById('add-booking-btn');
  const bookingModal = document.getElementById('booking-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const bookingForm = document.getElementById('booking-form');
  const bookingsContainer = document.getElementById('bookings-container');

  // Load dashboard data on mount
  loadDashboardData();

  // Modal Open/Close handlers
  if (addBookingBtn) {
    addBookingBtn.addEventListener('click', () => {
      bookingModal.classList.remove('hidden');
    });
  }

  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      bookingModal.classList.add('hidden');
    });
  }

  // Close modal when clicking background
  if (bookingModal) {
    bookingModal.addEventListener('click', (e) => {
      if (e.target === bookingModal) {
        bookingModal.classList.add('hidden');
      }
    });
  }

  setTodayDate();

  // Handle new booking submission
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const venue = document.getElementById('booking-venue').value;
      const time = document.getElementById('booking-time').value;
      const team = document.getElementById('booking-team').value;
      const token = localStorage.getItem('sportzone_token');

      if (!token) {
        alert('You must be signed in to book a slot.');
        window.location.href = '/auth';
        return;
      }

      try {
        const res = await fetch(window.API_BASE_URL + '/api/bookings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ venue, time, team })
        });

        if (res.ok) {
          bookingModal.classList.add('hidden');
          bookingForm.reset();
          loadDashboardData(); // Refresh UI
        } else {
          const errData = await res.json();
          alert(`Error: ${errData.error || 'Failed to submit booking.'}`);
        }
      } catch (error) {
        console.error('Error creating booking:', error);
        // Offline Fallback - simulate dynamic booking persistence
        simulateOfflineBooking({ venue, time, team });
        bookingModal.classList.add('hidden');
        bookingForm.reset();
      }
    });
  }
});

// Load statistics and list bookings
async function loadDashboardData() {
  setTodayDate();
  const statBookings = document.getElementById('stat-bookings');
  const statTournaments = document.getElementById('stat-tournaments');
  const statPlayers = document.getElementById('stat-players');
  const statRevenue = document.getElementById('stat-revenue');

  try {
    // 1. Fetch Stats
    const statsRes = await fetch(window.API_BASE_URL + '/api/dashboard/stats');
    if (statsRes.ok) {
      const stats = await statsRes.json();
      
      if (statBookings) statBookings.textContent = stats.bookingsToday;
      if (statTournaments) statTournaments.textContent = stats.activeTournaments;
      if (statPlayers) statPlayers.textContent = stats.activePlayers.toLocaleString();
      if (statRevenue) statRevenue.textContent = stats.revenueMonthly;
      
      updateUtilizationBars(stats.utilization);
    }

    // 2. Fetch Bookings
    const bookingsRes = await fetch(window.API_BASE_URL + '/api/bookings');
    if (bookingsRes.ok) {
      const bookings = await bookingsRes.json();
      renderBookingsList(bookings);
    }
  } catch (error) {
    console.warn('Backend server not responding. Falling back to offline local storage data.');
    loadOfflineDashboardData();
  }
}

// Render the list of bookings in HTML
function renderBookingsList(bookings) {
  const bookingsContainer = document.getElementById('bookings-container');
  if (!bookingsContainer) return;

  if (bookings.length === 0) {
    bookingsContainer.innerHTML = '<p class="text-sm text-muted-foreground py-4 text-center">No bookings found for today.</p>';
    return;
  }

  // Sort bookings by time chronologically
  bookings.sort((a, b) => a.time.localeCompare(b.time));

  bookingsContainer.innerHTML = bookings.map(booking => {
    const isConfirmed = booking.status === 'Confirmed';
    const badgeClass = isConfirmed 
      ? 'bg-success/20 text-success' 
      : 'bg-accent/20 text-accent';
      
    return `
      <div class="flex items-center justify-between py-3">
        <div class="flex items-center gap-4">
          <div class="font-display font-bold text-primary w-14 text-lg">${booking.time}</div>
          <div>
            <p class="font-semibold text-sm">${escapeHTML(booking.venue)}</p>
            <p class="text-xs text-muted-foreground">${escapeHTML(booking.team)}</p>
          </div>
        </div>
        <span class="text-xs font-bold px-3 py-1 rounded-full ${badgeClass}">${booking.status}</span>
      </div>
    `;
  }).join('');
}

// Update utilization progress bars
function updateUtilizationBars(utilization) {
  const categories = {
    'Football Turf': { percent: 'util-football-percent', bar: 'util-football-bar' },
    'Basketball': { percent: 'util-basketball-percent', bar: 'util-basketball-bar' },
    'Tennis': { percent: 'util-tennis-percent', bar: 'util-tennis-bar' },
    'Badminton': { percent: 'util-badminton-percent', bar: 'util-badminton-bar' },
    'Cricket': { percent: 'util-cricket-percent', bar: 'util-cricket-bar' }
  };

  for (const [key, elements] of Object.entries(categories)) {
    const percentEl = document.getElementById(elements.percent);
    const barEl = document.getElementById(elements.bar);
    const val = utilization[key] || 0;
    
    if (percentEl) percentEl.textContent = `${val}%`;
    if (barEl) barEl.style.width = `${val}%`;
  }
}

// Escape HTML helper
function setTodayDate() {
  const dateEl = document.getElementById('today-date');
  if (!dateEl) return;
  const today = new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  dateEl.textContent = `Today · ${today}`;
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

/* ==========================================================================
   Offline / Serverless Simulation logic
   Allows the app to work seamlessly even if the Node server is not active.
   ========================================================================== */

const OFFLINE_SEED_DATA = (() => {
  const today = new Date().toISOString().slice(0,10);
  return {
    bookings: [
      { id: 1, time: "10:00", venue: "Arena 7 Football", team: "Team Eagles", status: "Confirmed", date: today },
      { id: 2, time: "12:00", venue: "Skyline Basketball", team: "Marcus J.", status: "Confirmed", date: today },
      { id: 3, time: "14:00", venue: "Center Court Tennis", team: "Anna K.", status: "Pending", date: today },
      { id: 4, time: "16:00", venue: "SmashHouse Badminton", team: "Dev R.", status: "Confirmed", date: today },
      { id: 5, time: "18:00", venue: "Pulse Cricket Ground", team: "Royals XI", status: "Confirmed", date: today }
    ],
    utilization: {
      "Football Turf": 92,
      "Basketball": 78,
      "Tennis": 65,
      "Badminton": 85,
      "Cricket": 54
    }
  };
})();

function getLocalData() {
  const localData = localStorage.getItem('sportzone_offline_db');
  if (!localData) {
    localStorage.setItem('sportzone_offline_db', JSON.stringify(OFFLINE_SEED_DATA));
    return OFFLINE_SEED_DATA;
  }
  return JSON.parse(localData);
}

function loadOfflineDashboardData() {
  const data = getLocalData();
  
  const statBookings = document.getElementById('stat-bookings');
  const statTournaments = document.getElementById('stat-tournaments');
  const statPlayers = document.getElementById('stat-players');
  const statRevenue = document.getElementById('stat-revenue');

  if (statBookings) statBookings.textContent = data.bookings.length;
  if (statTournaments) statTournaments.textContent = '5';
  if (statPlayers) statPlayers.textContent = (1280 + data.bookings.length).toLocaleString();
  if (statRevenue) {
    const now = new Date();
    const bookingsThisMonthCount = data.bookings.filter(b => {
      if (!b.date) return false;
      const d = new Date(b.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
    statRevenue.textContent = `$${((bookingsThisMonthCount * 200) / 1000).toFixed(1)}k`;
  }

  updateUtilizationBars(data.utilization);
  renderBookingsList(data.bookings);
}

function simulateOfflineBooking({ venue, time, team }) {
  const data = getLocalData();
  
  // Prevent bookings at the same time slot for the same date (tournament conflict)
  const today = new Date().toISOString().slice(0,10);
  const existingBooking = data.bookings.find(b => 
    b.time === time && 
    b.date === today
  );

  if (existingBooking) {
    alert(`A tournament is already scheduled at ${time}. Please choose a different time.`);
    return;
  }
  
  const newBooking = {
    id: Date.now(),
    time,
    venue,
    team,
    status: 'Confirmed',
    date: today
  };

  data.bookings.push(newBooking);

  // Update offline utilization stats
  let category = '';
  if (venue.toLowerCase().includes('football')) category = 'Football Turf';
  else if (venue.toLowerCase().includes('basketball')) category = 'Basketball';
  else if (venue.toLowerCase().includes('tennis')) category = 'Tennis';
  else if (venue.toLowerCase().includes('badminton')) category = 'Badminton';
  else if (venue.toLowerCase().includes('cricket')) category = 'Cricket';

  if (category && data.utilization[category] !== undefined) {
    data.utilization[category] = Math.min(data.utilization[category] + 3, 100);
  }

  localStorage.setItem('sportzone_offline_db', JSON.stringify(data));
  loadOfflineDashboardData();
  alert('Booking successfully created! (Simulated Offline Mode)');
}
