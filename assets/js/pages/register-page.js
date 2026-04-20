// assets/js/pages/register-page.js
// Responsibility: Register page orchestrator — loads neighborhood dropdown,
//                 validates form, submits registration, redirects on success.

document.addEventListener('DOMContentLoaded', initRegisterPage);

const SITE_BASE = window.location.pathname.startsWith('/Beasts_FrontEnd') ? '/Beasts_FrontEnd' : '';
const neighborhoodState = {
  neighborhoods: [],
};

/**
 * Purpose: Initialize the register page — load neighborhoods, bind submit.
 * @returns {void}
 * Algorithm:
 * 1. Load neighborhoods into dropdown
 * 2. Bind form submit event
 */
function initRegisterPage() {
  loadNeighborhoodDropdown();
  bindFindNeighborhoodButton();
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
    .then(neighborhoods => {
      neighborhoodState.neighborhoods = Array.isArray(neighborhoods) ? neighborhoods : [];
      populateNeighborhoodSelect(select, neighborhoodState.neighborhoods);
    })
    .catch(() => {
      select.innerHTML = '<option value="">Neighborhood (unavailable)</option>';
      updateNeighborhoodHelp('We could not load neighborhoods right now. You can still register and set it later.', true);
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
 * Purpose: Bind the geolocation-assisted neighborhood finder button.
 * @returns {void}
 */
function bindFindNeighborhoodButton() {
  const button = document.getElementById('register-find-neighborhood');
  if (!button) return;
  button.addEventListener('click', handleFindNeighborhoodClick);
}

function handleFindNeighborhoodClick() {
  if (!navigator.geolocation) {
    updateNeighborhoodHelp('Your browser does not support geolocation. Please choose your neighborhood manually.', true);
    return;
  }

  const button = document.getElementById('register-find-neighborhood');
  setFindNeighborhoodLoading(button, true);
  updateNeighborhoodHelp('Requesting your location…');

  navigator.geolocation.getCurrentPosition(
    position => resolveNeighborhoodFromLocation(position, button),
    error => handleNeighborhoodLocationError(error, button),
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 }
  );
}

function resolveNeighborhoodFromLocation(position, button) {
  const { latitude, longitude } = position.coords;
  const neighborhoods = neighborhoodState.neighborhoods || [];

  const polygonMatch = findNeighborhoodByPolygon(latitude, longitude, neighborhoods);
  if (polygonMatch) {
    applyDetectedNeighborhood(polygonMatch, 'Matched from your current location.');
    setFindNeighborhoodLoading(button, false);
    return;
  }

  reverseGeocodeCoordinates(latitude, longitude)
    .then(addressData => {
      const heuristicMatch = findNeighborhoodByAddressParts(addressData, neighborhoods);
      if (heuristicMatch) {
        applyDetectedNeighborhood(
          heuristicMatch,
          'Matched from your nearby street/location. Please confirm it looks correct.'
        );
        return;
      }

      updateNeighborhoodHelp(
        'We found your location, but exact neighborhood boundaries are not configured yet. Please choose your neighborhood manually from the list.',
        true
      );
    })
    .catch(() => {
      updateNeighborhoodHelp(
        'We found your location, but could not translate it into a neighborhood automatically. Please choose from the list.',
        true
      );
    })
    .finally(() => setFindNeighborhoodLoading(button, false));
}

function handleNeighborhoodLocationError(error, button) {
  setFindNeighborhoodLoading(button, false);

  if (error && error.code === error.PERMISSION_DENIED) {
    updateNeighborhoodHelp('Location access was denied. Please choose your neighborhood manually.', true);
    return;
  }
  if (error && error.code === error.TIMEOUT) {
    updateNeighborhoodHelp('Location lookup timed out. Please try again or choose your neighborhood manually.', true);
    return;
  }

  updateNeighborhoodHelp('We could not determine your location. Please choose your neighborhood manually.', true);
}

function setFindNeighborhoodLoading(button, isLoading) {
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? 'Locating…' : 'Find your neighborhood';
}

function applyDetectedNeighborhood(neighborhood, message) {
  const select = document.getElementById('register-neighborhood-select');
  if (select && neighborhood && neighborhood.id) {
    select.value = String(neighborhood.id);
  }
  updateNeighborhoodHelp(
    `${message} Selected #${neighborhood.number || neighborhood.id} ${neighborhood.name}.`
  );
}

function updateNeighborhoodHelp(message, isError = false) {
  const help = document.getElementById('register-neighborhood-help');
  if (!help) return;
  help.textContent = message;
  help.style.color = isError ? '#8d2f25' : '#445469';
}

function findNeighborhoodByPolygon(latitude, longitude, neighborhoods) {
  return neighborhoods.find(neighborhood => {
    const points = parseNeighborhoodPolygon(neighborhood);
    return points.length >= 3 && isPointInPolygon([latitude, longitude], points);
  }) || null;
}

function parseNeighborhoodPolygon(neighborhood) {
  if (!neighborhood || !neighborhood.polygon_coords_json) return [];
  try {
    const parsed = typeof neighborhood.polygon_coords_json === 'string'
      ? JSON.parse(neighborhood.polygon_coords_json)
      : neighborhood.polygon_coords_json;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isPointInPolygon(point, polygon) {
  const [lat, lon] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i][0];
    const xi = polygon[i][1];
    const yj = polygon[j][0];
    const xj = polygon[j][1];

    const intersects = ((yi > lat) !== (yj > lat))
      && (lon < ((xj - xi) * (lat - yi)) / ((yj - yi) || Number.EPSILON) + xi);

    if (intersects) inside = !inside;
  }

  return inside;
}

function reverseGeocodeCoordinates(latitude, longitude) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`;
  return fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  })
    .then(response => {
      if (!response.ok) throw new Error('Reverse geocode failed');
      return response.json();
    });
}

function findNeighborhoodByAddressParts(addressData, neighborhoods) {
  const address = addressData && addressData.address ? addressData.address : {};
  const searchText = [
    address.road,
    address.neighbourhood,
    address.suburb,
    address.quarter,
    address.city_district,
    address.hamlet,
    address.village,
    address.town,
    addressData && addressData.display_name,
  ].filter(Boolean).join(' ').toLowerCase();

  if (!searchText) return null;

  const aliasMatchers = [
    { pattern: /\bold poway\b/, name: 'Old Poway Village' },
    { pattern: /\bpoway road\b/, name: 'Poway Road Corridor' },
    { pattern: /\btwin peaks\b/, name: 'Twin Peaks Area' },
    { pattern: /\bcommunity road\b/, name: 'Community Road' },
    { pattern: /\bgarden road\b/, name: 'Garden Road' },
    { pattern: /\bespola\b/, name: searchText.includes('south') ? 'Espola Road South' : 'Espola Road North' },
    { pattern: /\bhilleary\b/, name: 'Hilleary Park Area' },
    { pattern: /\bmidland\b/, name: 'Midland Road' },
    { pattern: /\bscripps poway\b/, name: searchText.includes('east') ? 'Scripps Poway Parkway East' : 'Scripps Poway Parkway West' },
    { pattern: /\bstowe\b/, name: 'Stowe Drive Area' },
    { pattern: /\bmartincoit\b/, name: 'Martincoit Road' },
    { pattern: /\bkirkham\b/, name: 'Kirkham Road' },
    { pattern: /\bpoway valley\b/, name: 'Poway Valley Road' },
    { pattern: /\bcrestridge\b/, name: 'Crestridge Road' },
    { pattern: /\blake poway\b/, name: 'Lake Poway Recreation Area' },
    { pattern: /\bblue sky\b/, name: searchText.includes('south') ? 'Blue Sky Reserve South' : 'Blue Sky Reserve North' },
    { pattern: /\bindustrial\b/, name: searchText.includes('south') ? 'South Poway Industrial' : 'Poway Industrial Area' },
    { pattern: /\boak knoll\b/, name: 'Oak Knoll Area' },
    { pattern: /\bpoway park\b/, name: 'Poway Park Area' },
    { pattern: /\bwelton\b/, name: 'Welton Drive Area' },
  ];

  for (const matcher of aliasMatchers) {
    if (!matcher.pattern.test(searchText)) continue;
    const exact = neighborhoods.find(neighborhood => neighborhood.name === matcher.name);
    if (exact) return exact;
  }

  return neighborhoods.find(neighborhood => {
    const normalizedName = String(neighborhood.name || '').toLowerCase();
    const simplified = normalizedName.replace(/\b(area|road|north|south|west|east|village)\b/g, '').trim();
    return normalizedName && (searchText.includes(normalizedName) || (simplified && searchText.includes(simplified)));
  }) || null;
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
  cacheRegisteredAccount(user);
  localStorage.setItem('pnec_user', JSON.stringify(user));
  localStorage.setItem('pnec_new_user', '1');
  sessionStorage.removeItem('pnec_user');
  window.location.href = `${SITE_BASE}/pages/onboarding.html`;
}

/**
 * Purpose: Handle registration failure — show error and restore button.
 * @param {Error}       error     - The error thrown by registerUser()
 * @param {HTMLElement} submitBtn - Button to restore
 * @returns {void}
 */
function handleRegisterError(error, submitBtn) {
  const message = error.type === ERROR_TYPES.INVALID_DATA || error.status === 409
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

function cacheRegisteredAccount(user) {
  if (!user || !user.email) return;

  try {
    const existingAccounts = JSON.parse(localStorage.getItem('pnec_accounts') || '[]');
    const accounts = Array.isArray(existingAccounts) ? existingAccounts : [];
    const nextAccounts = accounts.filter(account => account && account.email !== user.email);
    nextAccounts.push(user);
    localStorage.setItem('pnec_accounts', JSON.stringify(nextAccounts));
  } catch (_) {
    localStorage.setItem('pnec_accounts', JSON.stringify([user]));
  }
}
