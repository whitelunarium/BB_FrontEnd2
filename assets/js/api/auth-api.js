// assets/js/api/auth-api.js
// Responsibility: Auth fetch workers — all HTTP calls for login, register, logout, me.
// These are WORKERS: they fetch and return data, no DOM manipulation.

/**
 * Purpose: Send login credentials to the API.
 * @param {string} email - User email address
 * @param {string} password - User password
 * @returns {Promise<Object>} API response with user data and role
 * Algorithm:
 * 1. Build request body with email + password
 * 2. POST to /api/auth/login with credentials
 * 3. Validate HTTP response
 * 4. Parse and return JSON
 */
function loginUser(email, password) {
  return fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
    .then(validateResponse)
    .then(response => response.json());
}

/**
 * Purpose: Register a new resident account.
 * @param {Object} userData - { display_name, email, password, neighborhood_id }
 * @returns {Promise<Object>} Created user data
 * Algorithm:
 * 1. POST registration payload to /api/auth/register
 * 2. Validate HTTP response
 * 3. Return parsed user object
 */
function registerUser(userData) {
  return fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userData),
  })
    .then(validateResponse)
    .then(response => response.json());
}

/**
 * Purpose: End the current session on the server.
 * @returns {Promise<void>}
 * Algorithm:
 * 1. POST to /api/auth/logout with credentials
 * 2. Validate response (or ignore server errors — session ends client-side too)
 */
function logoutUser() {
  return fetch(`${API_BASE}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  })
    .then(validateResponse);
}

/**
 * Purpose: Fetch the currently authenticated user's profile and role.
 * @returns {Promise<Object|null>} User object with role, or null if not authenticated
 * Algorithm:
 * 1. GET /api/auth/me with credentials
 * 2. If 401: return null (not logged in — not an error)
 * 3. Validate other error codes
 * 4. Return parsed user data
 */
function fetchCurrentUser() {
  return fetch(`${API_BASE}/api/auth/me`, {
    method: 'GET',
    credentials: 'include',
  })
    .then(response => {
      if (response.status === 401) return null;
      return validateResponse(response).then(r => r.json());
    });
}

/**
 * Purpose: Fetch all neighborhoods for the registration dropdown.
 * @returns {Promise<Array>} Array of { id, name } neighborhood objects
 * Algorithm:
 * 1. GET /api/neighborhoods
 * 2. Validate response
 * 3. Return array
 */
function fetchNeighborhoodsForSelect() {
  return fetch(`${API_BASE}/api/neighborhoods`, {
    method: 'GET',
    credentials: 'include',
  })
    .then(validateResponse)
    .then(response => response.json())
    .then(data => data.neighborhoods || []);
}
