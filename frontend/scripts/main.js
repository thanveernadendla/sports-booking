const getApiBaseUrl = () => {
  const saved = localStorage.getItem('sportzone_api_base_url');
  if (saved) return saved.replace(/\/$/, '');
  if (typeof window !== 'undefined' && window.location) {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1' && !window.location.protocol.startsWith('file')) {
      return `${window.location.protocol}//${window.location.host}`;
    }
  }
  return 'http://10.223.147.236:5000';
};
window.API_BASE_URL = getApiBaseUrl();

document.addEventListener('DOMContentLoaded', () => {
  updateAuthState();
});

function getCurrentUser() {
  const adminRaw = localStorage.getItem('sportzone_admin_user');
  if (adminRaw) {
    try {
      const parsed = JSON.parse(adminRaw);
      if (parsed) return parsed;
    } catch (e) {}
  }
  const raw = localStorage.getItem('sportzone_user');
  return raw ? JSON.parse(raw) : null;
}

function getAuthToken() {
  return localStorage.getItem('sportzone_admin_token') || localStorage.getItem('sportzone_token');
}

function updateAuthState() {
  const token = getAuthToken();
  const user = getCurrentUser();
  const userDisplay = document.getElementById('user-display');
  const authBtn = document.getElementById('auth-btn');
  const addBookingBtn = document.getElementById('add-booking-btn');

  // Identify the generic Admin navigation option in the top navigation bar
  const navLinks = document.querySelectorAll('nav a, header a');
  let adminNavLink = null;
  navLinks.forEach(a => {
    const text = (a.textContent || '').trim().toLowerCase();
    const href = (a.getAttribute('href') || '').toLowerCase();
    if (href.includes('admin-login.html') || (text === 'admin' && !href.includes('admin-dashboard.html'))) {
      adminNavLink = a;
    }
  });

  if (!token || !user) {
    // Before login: Preserve the existing public website navigation behavior
    if (adminNavLink) {
      adminNavLink.style.display = '';
      adminNavLink.textContent = 'Admin';
      adminNavLink.href = 'admin-login.html';
    }
    if (userDisplay) userDisplay.textContent = '';
    if (authBtn) {
      authBtn.textContent = 'Login';
      authBtn.href = 'auth.html';
      authBtn.onclick = null;
    }
    if (addBookingBtn) addBookingBtn.classList.add('hidden');
    return;
  }

  // After authentication:
  if (user.role === 'admin') {
    // Administrator: remove the generic "Admin" link and provide role-specific Admin Dashboard navigation
    if (adminNavLink) {
      adminNavLink.style.display = '';
      adminNavLink.textContent = 'Admin Dashboard';
      adminNavLink.href = 'admin-dashboard.html';
    }
    if (userDisplay) userDisplay.textContent = `Admin: ${user.name}`;
  } else {
    // Regular customer: completely remove generic Admin navigation option
    if (adminNavLink) {
      adminNavLink.style.display = 'none';
    }
    if (userDisplay) userDisplay.textContent = `${user.name} | ${user.phone || ''}`;
  }

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
  localStorage.removeItem('sportzone_admin_token');
  localStorage.removeItem('sportzone_admin_user');
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
