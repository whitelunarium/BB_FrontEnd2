// assets/js/pages/login-page.js
// Responsibility: Login page orchestrator — coordinates form submission, error display,
//                 and post-login redirect. Delegates all fetch and DOM work to workers.

document.addEventListener('DOMContentLoaded', initLoginPage);

/**
 * Purpose: Initialize the login page — bind form submission event.
 * @returns {void}
 * Algorithm:
 * 1. Locate the login form
 * 2. If logged in already: redirect home
 * 3. Bind submit event to handleLoginSubmit
 */
function initLoginPage() {
  const existingUser = _readSessionUser();
  if (existingUser) { window.location.href = '/'; return; }

  const form = document.getElementById('login-form');
  if (form) form.addEventListener('submit', handleLoginSubmit);
}

/**
 * Purpose: ORCHESTRATOR — handle login form submission.
 * @param {Event} event - Form submit event
 * @returns {void}
 * Algorithm:
 * 1. Prevent default form submission
 * 2. Extract and validate form values
 * 3. Disable submit button during request
 * 4. Call loginUser() worker
 * 5. On success: store user, redirect
 * 6. On error: show error message, re-enable button
 */
function handleLoginSubmit(event) {
  event.preventDefault();
  hideLoginError();

  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const remember = document.getElementById('login-remember').checked;
  const submitBtn = document.getElementById('login-submit-btn');

  if (!validateLoginInputs(email, password)) return;

  disableSubmitButton(submitBtn, 'Signing in…');

  loginUser(email, password, remember)
    .then(data => handleLoginSuccess(data.user))
    .catch(error => handleLoginError(error, submitBtn));
}

/**
 * Purpose: Validate that email and password fields are non-empty.
 * @param {string} email    - Email input value
 * @param {string} password - Password input value
 * @returns {boolean} True if both are present
 */
function validateLoginInputs(email, password) {
  if (!email || !password) {
    showLoginError('Please enter your email and password.');
    return false;
  }
  return true;
}

/**
 * Purpose: Handle a successful login — cache user and redirect.
 * @param {Object} user - User object returned from API
 * @returns {void}
 */
function handleLoginSuccess(user) {
  sessionStorage.setItem('pnec_user', JSON.stringify(user));
  const redirect = new URLSearchParams(window.location.search).get('next') || '/';
  window.location.href = redirect;
}

/**
 * Purpose: Handle a failed login — display error and restore button.
 * @param {Error}       error     - The error thrown by loginUser()
 * @param {HTMLElement} submitBtn - The submit button to re-enable
 * @returns {void}
 */
function handleLoginError(error, submitBtn) {
  const message = error.type === ERROR_TYPES.AUTH_REQUIRED
    ? 'Incorrect email or password. Please try again.'
    : getErrorMessage(error.type);
  showLoginError(message);
  enableSubmitButton(submitBtn, 'Sign In');
}

// ─── Local DOM helpers ────────────────────────────────────────────────────────

function showLoginError(message) {
  const el = document.getElementById('login-error');
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
}

function hideLoginError() {
  const el = document.getElementById('login-error');
  if (el) el.style.display = 'none';
}

function disableSubmitButton(btn, label) {
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = label;
}

function enableSubmitButton(btn, label) {
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = label;
}

function _readSessionUser() {
  try { return JSON.parse(sessionStorage.getItem('pnec_user')); }
  catch (_) { return null; }
}
