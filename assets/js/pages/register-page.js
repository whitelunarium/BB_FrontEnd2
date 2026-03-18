// assets/js/pages/register-page.js
// Responsibility: Register page orchestrator — loads neighborhood dropdown,
//                 validates form, submits registration, redirects on success.

document.addEventListener('DOMContentLoaded', initRegisterPage);

/**
 * Purpose: Initialize the register page — load neighborhoods, bind submit.
 * @returns {void}
 * Algorithm:
 * 1. Load neighborhoods into dropdown
 * 2. Bind form submit event
 */
function initRegisterPage() {
  loadNeighborhoodDropdown();
  const form = document.getElementById('register-form');
  if (form) form.addEventListener('submit', handleRegisterSubmit);
}

/**
 * Purpose: Populate the neighborhood select dropdown with API data.
 * @returns {void}
 * Algorithm:
 * 1. Fetch neighborhoods from API
 * 2. Build <option> elements
 * 3. Replace loading option with real options
 * 4. On error: show a fallback option
 */
function loadNeighborhoodDropdown() {
  const select = document.getElementById('register-neighborhood-select');
  if (!select) return;

  fetchNeighborhoodsForSelect()
    .then(neighborhoods => populateNeighborhoodSelect(select, neighborhoods))
    .catch(() => {
      select.innerHTML = '<option value="">Neighborhood (unavailable)</option>';
    });
}

/**
 * Purpose: Render neighborhood <option> elements into the select element.
 * @param {HTMLSelectElement} selectEl - The select to populate
 * @param {Array} neighborhoods        - Array of { id, name, number } objects
 * @returns {void}
 */
function populateNeighborhoodSelect(selectEl, neighborhoods) {
  const options = ['<option value="">Select your neighborhood (optional)</option>']
    .concat(neighborhoods.map(n =>
      `<option value="${n.id}">#${n.number} — ${escapeHtml(n.name)}</option>`
    ));
  selectEl.innerHTML = options.join('');
}

/**
 * Purpose: ORCHESTRATOR — handle registration form submission.
 * @param {Event} event - Form submit event
 * @returns {void}
 * Algorithm:
 * 1. Prevent default
 * 2. Extract and validate form values
 * 3. Disable button during request
 * 4. Call registerUser() worker
 * 5. On success: store user, redirect home
 * 6. On error: show error, re-enable button
 */
function handleRegisterSubmit(event) {
  event.preventDefault();
  hideRegisterError();

  const displayName        = document.getElementById('register-name').value.trim();
  const email              = document.getElementById('register-email').value.trim();
  const password           = document.getElementById('register-password').value;
  const confirmPassword    = document.getElementById('register-confirm-password').value;
  const neighborhoodSelect = document.getElementById('register-neighborhood-select');
  const neighborhood_id    = neighborhoodSelect && neighborhoodSelect.value ? parseInt(neighborhoodSelect.value) : null;
  const submitBtn          = document.querySelector('#register-form button[type="submit"]');

  const validationError = validateRegisterInputs(displayName, email, password, confirmPassword);
  if (validationError) {
    showRegisterError(validationError);
    return;
  }

  disableRegisterButton(submitBtn, 'Creating account…');

  registerUser({ display_name: displayName, email, password, neighborhood_id })
    .then(data => handleRegisterSuccess(data.user))
    .catch(error => handleRegisterError(error, submitBtn));
}

/**
 * Purpose: Validate registration form inputs client-side.
 * @param {string} name     - Display name
 * @param {string} email    - Email address
 * @param {string} pass     - Password
 * @param {string} confirm  - Confirm password
 * @returns {string|null} Error message string, or null if valid
 * Algorithm:
 * 1. Check all required fields are present
 * 2. Check password length minimum
 * 3. Check password matches confirmation
 * 4. Return null if all checks pass
 */
function validateRegisterInputs(name, email, pass, confirm) {
  if (!name || !email || !pass || !confirm) return 'All fields except neighborhood are required.';
  if (pass.length < 8) return 'Password must be at least 8 characters.';
  if (pass !== confirm) return 'Passwords do not match.';
  return null;
}

/**
 * Purpose: Handle successful registration — cache user and redirect.
 * @param {Object} user - User object from API
 * @returns {void}
 */
function handleRegisterSuccess(user) {
  sessionStorage.setItem('pnec_user', JSON.stringify(user));
  window.location.href = '/';
}

/**
 * Purpose: Handle registration failure — show error and restore button.
 * @param {Error}       error     - The error thrown by registerUser()
 * @param {HTMLElement} submitBtn - Button to restore
 * @returns {void}
 */
function handleRegisterError(error, submitBtn) {
  const message = error.type === ERROR_TYPES.INVALID_DATA
    ? 'An account with that email already exists.'
    : getErrorMessage(error.type);
  showRegisterError(message);
  enableRegisterButton(submitBtn, 'Create Account');
}

// ─── Local DOM helpers ────────────────────────────────────────────────────────

function showRegisterError(message) {
  const el = document.getElementById('register-error');
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
}

function hideRegisterError() {
  const el = document.getElementById('register-error');
  if (el) el.style.display = 'none';
}

function disableRegisterButton(btn, label) {
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = label;
}

function enableRegisterButton(btn, label) {
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = label;
}
