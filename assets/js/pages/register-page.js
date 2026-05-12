// assets/js/pages/register-page.js
// Responsibility: Register page orchestrator — loads neighborhood dropdown,
//                 validates form, submits registration, redirects on success.

document.addEventListener('DOMContentLoaded', initAccountPage);

const SITE_BASE = window.location.pathname.startsWith('/Beasts_FrontEnd') ? '/Beasts_FrontEnd' : '';
const neighborhoodState = {
  neighborhoods: [],
  loadPromise: null,
};

/**
 * Purpose: Initialize the combined account page.
 * @returns {void}
 */
function initAccountPage() {
  initLoginPage();
  initRegisterPage();
}

function initLoginPage() {
  const existingUser = _readSessionUser();
  if (existingUser) { window.location.href = `${SITE_BASE}/pages/profile.html`; return; }

  const form = document.getElementById('login-form');
  if (form) form.addEventListener('submit', handleLoginSubmit);
}

function initRegisterPage() {
  loadNeighborhoodDropdown();
  bindFindNeighborhoodButton();
  bindAddressFallbackSearch();
  const form = document.getElementById('register-form');
  if (form) form.addEventListener('submit', handleRegisterSubmit);
}

function handleLoginSubmit(event) {
  event.preventDefault();
  hideLoginError();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const remember = document.getElementById('login-remember').checked;
  const submitBtn = document.getElementById('login-submit-btn');

  if (!validateLoginInputs(email, password)) return;

  disableAuthButton(submitBtn, 'Signing in...');

  loginUser(email, password, remember)
    .then(data => handleLoginSuccess(data.user))
    .catch(error => handleLoginError(error, submitBtn));
}

function validateLoginInputs(email, password) {
  if (!email || !password) {
    showLoginError('Please enter your email and password.');
    return false;
  }
  return true;
}

function handleLoginSuccess(user) {
  localStorage.setItem('pnec_user', JSON.stringify(user));
  sessionStorage.removeItem('pnec_user');
  const redirect = new URLSearchParams(window.location.search).get('next') || `${SITE_BASE}/pages/profile.html`;
  window.location.href = redirect;
}

function handleLoginError(error, submitBtn) {
  const message = error.type === ERROR_TYPES.AUTH_REQUIRED
    ? 'Incorrect email or password. Please try again.'
    : getErrorMessage(error.type);
  showLoginError(message);
  enableAuthButton(submitBtn, 'Sign In');
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

  neighborhoodState.loadPromise = fetchNeighborhoodsForSelect()
    .then(neighborhoods => {
      neighborhoodState.neighborhoods = Array.isArray(neighborhoods) ? neighborhoods : [];
      populateNeighborhoodSelect(select, neighborhoodState.neighborhoods);
      return neighborhoodState.neighborhoods;
    })
    .catch(() => {
      select.innerHTML = '<option value="">Neighborhood (unavailable)</option>';
      updateNeighborhoodHelp('We could not load neighborhoods right now. You can still register and set it later.', true);
      return [];
    });

  return neighborhoodState.loadPromise;
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

// v3.20: Poway city bounding box. Used to decide if the user's GPS coord
// is plausibly inside Poway. City limits run ~32.91N–33.03N, -117.10W–
// -116.95W. We pad it slightly so a user a block outside the city limit
// (still functionally PNEC territory) doesn't trigger the "you're not in
// Poway" message. Anything OUTSIDE these bounds gets the fun out-of-area
// note instead of pretending we couldn't determine the neighborhood.
const POWAY_BOUNDS = { minLat: 32.90, maxLat: 33.04, minLng: -117.12, maxLng: -116.94 };

function isInsidePoway(lat, lng) {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    isFinite(lat) && isFinite(lng) &&
    lat >= POWAY_BOUNDS.minLat && lat <= POWAY_BOUNDS.maxLat &&
    lng >= POWAY_BOUNDS.minLng && lng <= POWAY_BOUNDS.maxLng
  );
}

// v3.20: rough distance-to-Poway in miles (great-circle, plenty good for
// "are they nearby or way off?" messaging). Center of Poway = 32.9628,
// -117.0359.
function roughMilesFromPoway(lat, lng) {
  const POWAY_CENTER = { lat: 32.9628, lng: -117.0359 };
  const toRad = d => d * Math.PI / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat - POWAY_CENTER.lat);
  const dLng = toRad(lng - POWAY_CENTER.lng);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(POWAY_CENTER.lat)) * Math.cos(toRad(lat)) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// v3.20: friendly out-of-area message tuned to how far away the user is.
// Only ever shown when we're CONFIDENT the GPS coord is outside Poway's
// bounding box — never shown on a low-accuracy or failed lookup, to avoid
// telling a Poway resident they're not in Poway by mistake.
function outsidePowayMessage(miles) {
  const m = Math.round(miles);
  if (miles < 25) {
    return `Looks like you're ~${m} miles from Poway — close, but PNEC only covers Poway, CA. If you live in Poway and you're just out of town right now, pick your neighborhood from the dropdown.`;
  }
  if (miles < 200) {
    return `Looks like you're ~${m} miles from Poway. PNEC is a Poway-only org, so the neighborhood map won't help you here — but stay safe out there, and bookmark us if you ever move to Poway! 🌵`;
  }
  if (miles < 1500) {
    return `You're ~${m} miles from Poway — a different state, but the same planet. PNEC only covers Poway, CA. If you'd like emergency-prep resources for your area, search '<your county> CERT' or visit ready.gov. 🗺️`;
  }
  return `Greetings from ~${m} miles away! 🌎 You're definitely not in Poway. PNEC only covers Poway, California. If you'd like emergency-prep resources for your country, your national disaster agency is the right starting point.`;
}

function handleFindNeighborhoodClick() {
  const button = document.getElementById('register-find-neighborhood');
  setFindNeighborhoodLoading(button, true);
  updateNeighborhoodHelp('Finding your location…');
  // Always show the address fallback so the user can type at any
  // point during the lookup if they're impatient.
  showAddressFallback();

  ensureNeighborhoodsLoaded()
    .then(() => geolocateUser(button))
    .catch(() => {
      setFindNeighborhoodLoading(button, false);
      updateNeighborhoodHelp('Neighborhood data is not available right now. Pick from the list or type an address below.', true);
    });
}

// v3.22: IP-FIRST geolocation. Earlier 3-stage approach (GPS → GPS → IP)
// was failing in the wild because:
//   - High-accuracy GPS times out on desktops (no GPS chip)
//   - Coarse GPS hangs forever behind VPNs / corporate WiFi / privacy
//     browsers — Google Location Services unreachable, no error fires
//   - The IP fallback I had used ipwho.is + ipapi.co, both of which
//     reject cross-origin requests on the free plan. So fallback ALSO
//     failed.
// Net: the user waited 23+ seconds and got "type an address below."
//
// New approach:
//   Phase 1 (parallel, ~500ms):
//     - Hit two CORS-friendly IP geolocation services (geojs.io,
//       ipinfo.io). First to respond wins. ~25 km accuracy is plenty
//       for "are you in Poway or 200 miles away?"
//   Phase 2 (optional, only if IP says we're near Poway, 5s max):
//     - Try browser GPS for neighborhood-level precision.
//   Hard ceiling: 6 seconds total.
//
// The user always sees progress text and can pick from the dropdown
// at any time — the lookup never blocks the form.

function geolocateUser(button) {
  let resolved = false;

  // Hard overall ceiling — never spin longer than this
  const overallTimer = setTimeout(() => {
    if (resolved) return;
    resolved = true;
    setFindNeighborhoodLoading(button, false);
    updateNeighborhoodHelp(
      "Couldn't pin your location automatically. Type an address below (street name is enough) or pick your neighborhood from the dropdown.",
      true
    );
    focusAddressSearch();
  }, 6000);

  // Phase 1: IP geolocation (fast, doesn't need permission)
  tryIpGeolocation()
    .then(ipFix => {
      if (resolved) return;
      const miles = roughMilesFromPoway(ipFix.lat, ipFix.lng);
      // If user is definitely far away (>50 mi), surface the fun
      // out-of-area message immediately. No point asking for GPS.
      if (miles > 50) {
        resolved = true;
        clearTimeout(overallTimer);
        setFindNeighborhoodLoading(button, false);
        updateNeighborhoodHelp(outsidePowayMessage(miles), true);
        focusAddressSearch();
        return;
      }
      // User is in/near SD County. Try GPS for neighborhood-level
      // precision, but don't block on it — fall back to IP fix if GPS
      // doesn't respond within 3s.
      updateNeighborhoodHelp("Got your general area (near Poway). Trying for a precise GPS fix…");
      tryGpsFix(3500)
        .then(gpsFix => {
          if (resolved) return;
          resolved = true;
          clearTimeout(overallTimer);
          resolveNeighborhoodFromLocation({
            coords: { latitude: gpsFix.lat, longitude: gpsFix.lng, accuracy: gpsFix.accuracy },
            _source: 'gps',
            _approximate: false,
          }, button);
        })
        .catch(() => {
          if (resolved) return;
          resolved = true;
          clearTimeout(overallTimer);
          // GPS didn't respond — use the IP fix.
          resolveNeighborhoodFromLocation({
            coords: { latitude: ipFix.lat, longitude: ipFix.lng, accuracy: ipFix.accuracyMeters || 25000 },
            _source: ipFix.source,
            _approximate: true,
          }, button);
        });
    })
    .catch(() => {
      // IP lookup failed entirely. Try GPS as a long-shot.
      if (resolved) return;
      updateNeighborhoodHelp("IP location failed — trying browser GPS as a backup (up to 4s)…");
      tryGpsFix(4000)
        .then(gpsFix => {
          if (resolved) return;
          resolved = true;
          clearTimeout(overallTimer);
          resolveNeighborhoodFromLocation({
            coords: { latitude: gpsFix.lat, longitude: gpsFix.lng, accuracy: gpsFix.accuracy },
            _source: 'gps',
            _approximate: false,
          }, button);
        })
        .catch(() => {
          if (resolved) return;
          resolved = true;
          clearTimeout(overallTimer);
          setFindNeighborhoodLoading(button, false);
          updateNeighborhoodHelp(
            "Couldn't pin your location (network blocked both IP and GPS lookups). Type an address below or pick from the dropdown.",
            true
          );
          focusAddressSearch();
        });
    });
}

// IP geolocation via two CORS-friendly providers. Returns the FIRST
// successful response. ~500ms typical.
function tryIpGeolocation() {
  const providers = [
    {
      url: 'https://get.geojs.io/v1/ip/geo.json',
      parse: j => {
        const lat = parseFloat(j && j.latitude);
        const lng = parseFloat(j && j.longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng, accuracyMeters: 25000, city: j.city, source: 'geojs.io' };
      },
    },
    {
      url: 'https://ipinfo.io/json',
      parse: j => {
        if (!j || !j.loc) return null;
        const [lat, lng] = String(j.loc).split(',').map(parseFloat);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng, accuracyMeters: 25000, city: j.city, source: 'ipinfo.io' };
      },
    },
  ];
  const attempts = providers.map(p =>
    fetch(p.url, { credentials: 'omit', cache: 'no-cache' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(j => {
        const out = p.parse(j);
        if (!out) throw new Error('no coords');
        return out;
      })
  );
  return Promise.race([
    Promise.any(attempts),
    new Promise((_, rej) => setTimeout(() => rej(new Error('ip-timeout')), 4000)),
  ]);
}

// Browser GPS with a SHORT timeout. We don't waste 15s waiting for GPS
// that often never returns — if it doesn't fire in `ms` it's rejected.
function tryGpsFix(ms) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('no-geolocation')); return; }
    let done = false;
    const timer = setTimeout(() => {
      if (done) return; done = true;
      reject(new Error('gps-timeout'));
    }, ms);
    navigator.geolocation.getCurrentPosition(
      pos => {
        if (done) return; done = true; clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      },
      err => {
        if (done) return; done = true; clearTimeout(timer);
        reject(err);
      },
      // Use enableHighAccuracy:false for speed — the network/WiFi fix
      // is usually sub-second and accurate enough.
      { enableHighAccuracy: false, timeout: ms, maximumAge: 60000 }
    );
  });
}

function ensureNeighborhoodsLoaded() {
  if (neighborhoodState.neighborhoods.length) {
    return Promise.resolve(neighborhoodState.neighborhoods);
  }
  return neighborhoodState.loadPromise || loadNeighborhoodDropdown() || Promise.resolve([]);
}

function resolveNeighborhoodFromLocation(position, button) {
  const { latitude, longitude, accuracy } = position.coords;
  const neighborhoods = neighborhoodState.neighborhoods || [];
  // v3.21: IP-fallback synthesizes a position with _approximate=true.
  // We use that flag (not just accuracy) to gate the "you're not in
  // Poway" message: IP geolocation can place a Poway resident in
  // "San Diego" (~15 mi off), so we ONLY surface the out-of-area
  // message for IP coords if they're > 50 miles away (clearly out
  // of the region).
  const isApproximate = !!position._approximate;
  const accuracyMeters = Number.isFinite(accuracy) ? accuracy : null;

  // For real GPS: confident when accuracy ≤ 25 km.
  // For IP-based: never trust the bounding-box check; only trust the
  // distance threshold below.
  const gpsAccurateEnough = !isApproximate && (accuracyMeters === null || accuracyMeters <= 25000);

  if (gpsAccurateEnough && !isInsidePoway(latitude, longitude)) {
    // Genuine real-GPS coord outside Poway — show the friendly note.
    const miles = roughMilesFromPoway(latitude, longitude);
    updateNeighborhoodHelp(outsidePowayMessage(miles), true);
    showAddressFallback();
    setFindNeighborhoodLoading(button, false);
    return;
  }

  if (isApproximate) {
    const miles = roughMilesFromPoway(latitude, longitude);
    if (miles > 50) {
      // Definitely not in Poway based on IP — show the out-of-area
      // message. Anyone in or around SD County is < 50 mi away.
      updateNeighborhoodHelp(outsidePowayMessage(miles), true);
      showAddressFallback();
      setFindNeighborhoodLoading(button, false);
      return;
    }
    // IP says they're in/near SD County. Show a friendly note that
    // we used a coarse fix; don't try to auto-select a neighborhood.
    updateNeighborhoodHelp(
      "Couldn't get a precise GPS fix, so we used your IP location (which puts you near Poway). The neighborhood map needs a precise address — pick yours from the dropdown, or type your street below.",
      false
    );
    showAddressFallback();
    setFindNeighborhoodLoading(button, false);
    return;
  }

  lookupNeighborhoodFromCoordinates(latitude, longitude)
    .then(neighborhood => {
      if (neighborhood) {
        applyDetectedNeighborhood(neighborhood, 'Matched from your current location.');
        return;
      }

      const polygonMatch = findNeighborhoodByPolygon(latitude, longitude, neighborhoods);
      if (polygonMatch) {
        applyDetectedNeighborhood(polygonMatch, 'Matched from your current location.');
        return;
      }

      // We're inside (or near) Poway but couldn't pin a specific
      // neighborhood. Don't make this feel like a failure — many
      // residents straddle two areas anyway.
      updateNeighborhoodHelp(
        "We got your location and you're in (or near) Poway, but we couldn't auto-pin a specific neighborhood. Pick yours from the dropdown — most folks know their street.",
        false
      );
      showAddressFallback();
    })
    .catch(() => {
      updateNeighborhoodHelp(
        'We found your location, but could not search neighborhoods right now. Type an address below or choose from the list.',
        true
      );
      showAddressFallback();
    })
    .finally(() => setFindNeighborhoodLoading(button, false));
}

function handleNeighborhoodLocationError(error, button) {
  setFindNeighborhoodLoading(button, false);
  showAddressFallback();

  if (error && error.code === error.PERMISSION_DENIED) {
    updateNeighborhoodHelp(
      "Location access was blocked by your browser. Click the location/lock icon in your address bar to allow it, or just type an address below.",
      true
    );
    focusAddressSearch();
    return;
  }
  if (error && error.code === error.POSITION_UNAVAILABLE) {
    updateNeighborhoodHelp(
      "Your device couldn't get a location fix (no GPS / WiFi positioning available). Type an address below instead — it works the same way.",
      true
    );
    focusAddressSearch();
    return;
  }
  if (error && error.code === error.TIMEOUT) {
    updateNeighborhoodHelp(
      "Both the fast and the slow location lookups timed out — likely a weak GPS / WiFi signal. Type an address below (street name is enough) or pick your neighborhood from the dropdown.",
      true
    );
    focusAddressSearch();
    return;
  }

  updateNeighborhoodHelp(
    "We couldn't determine your location. Type an address below — or pick your neighborhood from the dropdown.",
    true
  );
  focusAddressSearch();
}

function setFindNeighborhoodLoading(button, isLoading) {
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? 'Locating…' : 'Find your neighborhood';
}

function applyDetectedNeighborhood(neighborhood, message) {
  const select = document.getElementById('register-neighborhood-select');
  if (select && neighborhood && neighborhood.id) {
    if (!select.querySelector(`option[value="${String(neighborhood.id)}"]`)) {
      const option = document.createElement('option');
      option.value = String(neighborhood.id);
      option.textContent = `#${neighborhood.number || neighborhood.id} - ${neighborhood.name}`;
      select.appendChild(option);
    }
    select.value = String(neighborhood.id);
  }
  updateNeighborhoodHelp(
    `${message} Selected #${neighborhood.number || neighborhood.id} ${neighborhood.name}.`
  );
}

function bindAddressFallbackSearch() {
  const input = document.getElementById('register-address-query');
  const button = document.getElementById('register-address-search');
  if (!input || !button) return;

  const runSearch = () => lookupNeighborhoodFromAddressInput();
  button.addEventListener('click', runSearch);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      runSearch();
    }
  });
}

function showAddressFallback(message) {
  const fallback = document.getElementById('register-address-fallback');
  if (fallback) fallback.hidden = false;
  updateNeighborhoodHelp(message || 'Type an address below and press Search, or choose from the list.', true);
}

function focusAddressSearch() {
  const input = document.getElementById('register-address-query');
  if (input) input.focus();
}

function lookupNeighborhoodFromAddressInput() {
  const input = document.getElementById('register-address-query');
  const button = document.getElementById('register-address-search');
  const query = input ? input.value.trim() : '';

  if (!query) {
    updateNeighborhoodHelp('Enter a street address or neighborhood number first.', true);
    if (input) input.focus();
    return;
  }

  setAddressSearchLoading(button, true);
  updateNeighborhoodHelp('Searching for your neighborhood...');

  lookupNeighborhoodForRegister(query)
    .then(neighborhood => {
      if (!neighborhood) {
        updateNeighborhoodHelp('No neighborhood matched that search. Search currently supports neighborhood numbers or neighborhood names. For a street address, choose from the list until address boundaries are configured.', true);
        return;
      }
      applyDetectedNeighborhood(neighborhood, 'Matched from your search.');
    })
    .catch(() => {
      updateNeighborhoodHelp('We could not search neighborhoods right now. Please choose from the list.', true);
    })
    .finally(() => setAddressSearchLoading(button, false));
}

function setAddressSearchLoading(button, isLoading) {
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = isLoading ? 'Searching...' : 'Search';
}

function lookupNeighborhoodForRegister(query) {
  const localMatch = findNeighborhoodByNumberOrName(query, neighborhoodState.neighborhoods || []);
  if (localMatch) return Promise.resolve(localMatch);

  return fetch(`${API_BASE}/api/neighborhoods/lookup?address=${encodeURIComponent(query)}`, {
    credentials: 'include',
  })
    .then(response => {
      if (response.status === 404) return null;
      return validateResponse(response).then(r => r.json());
    })
    .then(data => {
      if (!data) return null;
      if (data.id) return data;
      if (data.neighborhood) return data.neighborhood;
      if (Array.isArray(data.results) && data.results.length) return data.results[0];
      return null;
    });
}

function lookupNeighborhoodFromCoordinates(latitude, longitude) {
  const query = `lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`;
  return fetch(`${API_BASE}/api/neighborhoods/lookup?${query}`, {
    credentials: 'include',
  })
    .then(response => {
      if (response.status === 404) return null;
      return validateResponse(response).then(r => r.json());
    })
    .then(data => {
      if (!data) return null;
      if (data.neighborhood) return data.neighborhood;
      if (Array.isArray(data.results) && data.results.length) return data.results[0];
      return null;
    });
}

function findNeighborhoodByNumberOrName(query, neighborhoods) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return null;

  const numericQuery = normalizedQuery.match(/^#?\s*(\d{1,2})$/);
  if (numericQuery) {
    const number = parseInt(numericQuery[1], 10);
    return neighborhoods.find(neighborhood => Number(neighborhood.number) === number || Number(neighborhood.id) === number) || null;
  }

  return neighborhoods.find(neighborhood => {
    const name = String(neighborhood.name || '').toLowerCase();
    return name === normalizedQuery || name.includes(normalizedQuery);
  }) || null;
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
  localStorage.removeItem('pnec_new_user');
  sessionStorage.removeItem('pnec_user');
  const redirect = new URLSearchParams(window.location.search).get('next') || `${SITE_BASE}/pages/profile.html`;
  window.location.href = redirect;
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

function hideRegisterError() {
  const el = document.getElementById('register-error');
  if (el) el.style.display = 'none';
}

function disableRegisterButton(btn, label) {
  disableAuthButton(btn, label);
}

function enableRegisterButton(btn, label) {
  enableAuthButton(btn, label);
}

function disableAuthButton(btn, label) {
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = label;
}

function enableAuthButton(btn, label) {
  if (!btn) return;
  btn.disabled = false;
  btn.textContent = label;
}

function _readSessionUser() {
  try {
    const cachedUser = localStorage.getItem('pnec_user') || sessionStorage.getItem('pnec_user');
    return cachedUser ? JSON.parse(cachedUser) : null;
  } catch (_) {
    return null;
  }
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
