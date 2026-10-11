document.addEventListener('DOMContentLoaded', () => {
  const authForm = document.getElementById('auth-form');
  const toggleContainer = document.getElementById('toggle-container');
  const nameField = document.getElementById('name-field');
  const formTitle = document.getElementById('form-title');
  const formCopy = document.getElementById('form-copy');
  const submitBtn = document.getElementById('submit-btn');
  const errorMsg = document.getElementById('error-msg');

  let registerMode = false;

  const pwdInput = document.getElementById('auth-password');
  const togglePwdBtn = document.getElementById('toggle-pwd-visibility');
  if (togglePwdBtn && pwdInput) {
    togglePwdBtn.addEventListener('click', () => {
      const isPwd = pwdInput.type === 'password';
      pwdInput.type = isPwd ? 'text' : 'password';
      togglePwdBtn.textContent = isPwd ? '🙈' : '👁';
    });
  }

  toggleContainer.addEventListener('click', (event) => {
    if (event.target.id !== 'toggle-auth-btn') return;
    registerMode = !registerMode;
    errorMsg.style.color = '#dc2626';
    errorMsg.textContent = '';
    nameField.style.display = registerMode ? 'grid' : 'none';
    formTitle.textContent = registerMode ? 'Create mobile account' : 'Login';
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
      const endpoint = registerMode ? '/api/auth/register' : '/api/auth/login';
      const hostsToTry = [
        window.API_BASE_URL,
        'http://10.223.147.236:5000',
        'http://localhost:5000'
      ].filter(Boolean);

      let response, text, result, lastErr;
      for (const baseUrl of hostsToTry) {
        try {
          const url = `${baseUrl.replace(/\/$/, '')}${endpoint}`;
          response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registerMode ? { phone, password, name } : { phone, password })
          });
          text = await response.text();
          try {
            result = JSON.parse(text);
          } catch (e) {
            throw new Error(`Server returned non-JSON response (${response.status})`);
          }
          if (response.ok) {
            window.API_BASE_URL = baseUrl;
            break;
          } else {
            throw new Error(result.error || result.message || 'Authentication failed');
          }
        } catch (e) {
          lastErr = e;
          if (e.message && !e.message.includes('fetch') && !e.message.includes('Network') && !e.message.includes('non-JSON')) {
            throw e;
          }
        }
      }

      if (!result || !response || !response.ok) {
        throw lastErr || new Error('Unable to connect to SportZone backend server.');
      }

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
