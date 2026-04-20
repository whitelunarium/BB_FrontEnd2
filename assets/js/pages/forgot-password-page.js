document.addEventListener('DOMContentLoaded', initForgotPage);

const SITE_BASE = window.location.pathname.startsWith('/Beasts_FrontEnd') ? '/Beasts_FrontEnd' : '';

function initForgotPage() {
  const form = document.getElementById('forgot-form');
  if (form) form.addEventListener('submit', handleForgotSubmit);
}

async function handleForgotSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('forgot-email').value.trim();
  const errorBox = document.getElementById('forgot-error');
  const successBox = document.getElementById('forgot-success');
  const btn = document.getElementById('forgot-submit-btn');

  errorBox.textContent = '';
  successBox.style.display = 'none';

  if (!email) {
    errorBox.textContent = 'Please enter your email address.';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Sending…';

  try {
    const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      successBox.textContent = 'If that email is registered, a reset link has been sent. Check your inbox.';
      successBox.style.display = 'block';
      document.getElementById('forgot-form').style.display = 'none';
    } else {
      errorBox.textContent = data.message || 'Something went wrong. Please try again.';
    }
  } catch {
    errorBox.textContent = 'Unable to connect. Please check your connection and try again.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Reset Link';
  }
}
