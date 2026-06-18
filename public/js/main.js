// Shared Main Frontend Logic for SportZone

// Configurable API base URL for mobile packaging.
// If running in WebView (Capacitor/Cordova) or local file, direct requests to your server's host/port.
// For Android emulator, use 'http://10.0.2.2:3000'. For iOS simulator or web, use localhost/relative path.
window.API_BASE_URL = ''; // default, may be overridden by /config.json

// Load runtime config from /config.json (if present) so phones/other devices
// can point to the server by editing a single file instead of changing code.
window.__apiConfigLoaded = (async () => {
  try {
    const res = await fetch('/config.json');
    if (res.ok) {
      const cfg = await res.json();
      if (cfg.apiBaseUrl && typeof cfg.apiBaseUrl === 'string') {
        window.API_BASE_URL = cfg.apiBaseUrl.replace(/\/+$/,'');
      }
      return;
    }
  } catch (e) {
    // ignore fetch errors
  }

  // Fallback for local file / Capacitor packaging
  if (window.location.origin.includes('capacitor') || window.location.origin.startsWith('file:')) {
    window.API_BASE_URL = 'http://localhost:3000';
  }
})();

// Check and update auth state on load
document.addEventListener('DOMContentLoaded', async () => {
  await window.__apiConfigLoaded;
  updateAuthState();
  highlightActiveLink();
});

// Update auth state in headers
async function updateAuthState() {
  const token = localStorage.getItem('sportzone_token');
  const userDisplay = document.getElementById('user-display');
  const authBtn = document.getElementById('auth-btn');
  const addBookingBtn = document.getElementById('add-booking-btn');

  if (!token) {
    if (userDisplay) userDisplay.classList.add('hidden');
    if (authBtn) {
      authBtn.textContent = 'Sign in';
      authBtn.href = '/auth';
      authBtn.onclick = null;
    }
    if (addBookingBtn) addBookingBtn.classList.add('hidden');
    return;
  }

  try {
    const res = await fetch(window.API_BASE_URL + '/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      const user = data.user;
      
      if (userDisplay) {
        userDisplay.textContent = `HI, ${user.name.toUpperCase()}`;
        userDisplay.classList.remove('hidden');
      }
      
      if (authBtn) {
        authBtn.textContent = 'Sign out';
        authBtn.removeAttribute('href');
        authBtn.style.cursor = 'pointer';
        authBtn.onclick = (e) => {
          e.preventDefault();
          logout();
        };
      }

      if (addBookingBtn) {
        addBookingBtn.classList.remove('hidden');
      }
    } else {
      // Invalid/Expired token
      localStorage.removeItem('sportzone_token');
      localStorage.removeItem('sportzone_user');
      updateAuthState();
    }
  } catch (error) {
    console.error('Error fetching auth status:', error);
    // If server is offline, we can fall back to using locally stored user info if available
    const localUser = localStorage.getItem('sportzone_user');
    if (localUser) {
      const user = JSON.parse(localUser);
      if (userDisplay) {
        userDisplay.textContent = `HI, ${user.name.toUpperCase()} (Offline)`;
        userDisplay.classList.remove('hidden');
      }
      if (authBtn) {
        authBtn.textContent = 'Sign out';
        authBtn.onclick = (e) => {
          e.preventDefault();
          logout();
        };
      }
      if (addBookingBtn) {
        addBookingBtn.classList.remove('hidden');
      }
    }
  }
}

function logout() {
  localStorage.removeItem('sportzone_token');
  localStorage.removeItem('sportzone_user');
  window.location.href = '/';
}

// Highlight the current page in the header navigation
function highlightActiveLink() {
  const path = window.location.pathname;
  const navLinks = document.querySelectorAll('#nav-links a');
  
  navLinks.forEach(link => {
    const page = link.getAttribute('data-page');
    let isActive = false;
    
    if (path === '/' || path === '/index.html') {
      isActive = (page === 'home');
    } else if (path.includes('compare')) {
      isActive = (page === 'compare');
    } else if (path.includes('dashboard')) {
      isActive = (page === 'dashboard');
    }
    
    if (isActive) {
      link.className = 'px-4 py-2 rounded-md text-sm font-semibold text-primary bg-secondary';
    } else {
      link.className = 'px-4 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors';
    }
  });
}
