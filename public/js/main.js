window.API_BASE_URL = '';

document.addEventListener('DOMContentLoaded', () => {
  updateAuthState();
});

function getCurrentUser() {
  const raw = localStorage.getItem('sportzone_user');
  return raw ? JSON.parse(raw) : null;
}

function updateAuthState() {
  const token = localStorage.getItem('sportzone_token');
  const user = getCurrentUser();
  const userDisplay = document.getElementById('user-display');
  const authBtn = document.getElementById('auth-btn');
  const addBookingBtn = document.getElementById('add-booking-btn');

  if (!token || !user) {
    if (userDisplay) userDisplay.textContent = '';
    if (authBtn) {
      authBtn.textContent = 'Mobile login';
      authBtn.href = 'auth.html';
      authBtn.onclick = null;
    }
    if (addBookingBtn) addBookingBtn.classList.add('hidden');
    return;
  }

  if (userDisplay) userDisplay.textContent = `${user.name} | ${user.phone || user.username || ''}`;
  if (authBtn) {
    authBtn.textContent = 'Sign out';
    authBtn.removeAttribute('href');
    authBtn.onclick = (event) => {
      event.preventDefault();
      logout();
    };
  }
  if (addBookingBtn) addBookingBtn.classList.remove('hidden');
}

function logout() {
  localStorage.removeItem('sportzone_token');
  localStorage.removeItem('sportzone_user');
  window.location.href = 'index.html';
}

function formatTimeRange(time) {
  const hour = parseInt(String(time).split(':')[0], 10);
  if (Number.isNaN(hour)) return time;
  return `${String(hour).padStart(2, '0')}:00 - ${String(hour + 1).padStart(2, '0')}:00`;
}

function formatINR(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function esc(str) {
  return String(str ?? '').replace(/[&<>'"]/g, token => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[token]));
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}
