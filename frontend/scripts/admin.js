document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('admin-login-form');
  const error = document.getElementById('admin-error');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    error.textContent = '';

    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value.trim();

    try {
      const apiBaseUrl = (window.API_BASE_URL || localStorage.getItem('sportzone_api_base_url') || '').replace(/\/$/, '');
      const response = await fetch(`${apiBaseUrl}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Admin login failed');

      localStorage.setItem('sportzone_admin_token', result.token);
      localStorage.setItem('sportzone_admin_user', JSON.stringify(result.user));
      window.location.href = 'admin-dashboard.html';
    } catch (err) {
      error.textContent = err.message;
    }
  });
});
