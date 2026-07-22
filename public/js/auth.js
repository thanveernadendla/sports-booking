document.addEventListener('DOMContentLoaded', () => {
  const authForm = document.getElementById('auth-form');
  const toggleContainer = document.getElementById('toggle-container');
  const nameField = document.getElementById('name-field');
  const formTitle = document.getElementById('form-title');
  const formCopy = document.getElementById('form-copy');
  const submitBtn = document.getElementById('submit-btn');
  const errorMsg = document.getElementById('error-msg');

  let registerMode = false;

  toggleContainer.addEventListener('click', (event) => {
    if (event.target.id !== 'toggle-auth-btn') return;
    registerMode = !registerMode;
    errorMsg.style.color = '#dc2626';
    errorMsg.textContent = '';
    nameField.style.display = registerMode ? 'grid' : 'none';
    formTitle.textContent = registerMode ? 'Create mobile account' : 'Mobile login';
    formCopy.textContent = registerMode
      ? 'Register with your mobile number and start booking immediately.'
      : 'Login or create a mobile account to book live SportZone slots.';
    submitBtn.textContent = registerMode ? 'Create account' : 'Login';
    toggleContainer.innerHTML = registerMode
      ? 'Already registered? <button id="toggle-auth-btn" type="button">Login</button>'
      : 'New player? <button id="toggle-auth-btn" type="button">Create account</button>';
  });

  authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorMsg.style.color = '#dc2626';
    errorMsg.textContent = '';

    const phone = document.getElementById('auth-phone').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    const name = document.getElementById('auth-name').value.trim();

    if (!phone || !password || (registerMode && !name)) {
      errorMsg.textContent = 'Please fill in the required fields.';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = registerMode ? 'Creating...' : 'Logging in...';

    try {
      const response = await fetch(registerMode ? '/api/auth/register' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerMode ? { phone, password, name } : { phone, password })
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Login failed');

      localStorage.setItem('sportzone_token', result.token);
      localStorage.setItem('sportzone_user', JSON.stringify(result.user));
      window.location.href = 'dashboard.html';
    } catch (error) {
      errorMsg.textContent = error.message;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = registerMode ? 'Create account' : 'Login';
    }
  });
});
