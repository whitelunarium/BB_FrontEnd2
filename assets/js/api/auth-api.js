// assets/js/api/auth-api.js
// Responsibility: Auth fetch workers — backend auth plus local user cache in page layer.
// These are WORKERS: they fetch and return data, no DOM manipulation.

/**
 * Purpose: Send login credentials to the API.
 * @param {string} email     - User email address
 * @param {string} password  - User password
 * @param {boolean} remember - Whether to persist the server session cookie
 * @returns {Promise<Object>} API response with user data and role
 */
function loginUser(email, password, remember = false) {
  return fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, remember }),
  })
    .then(validateResponse)
    .then(response => response.json());
}

/**
 * Purpose: Register a new resident account in the backend database.
 * @param {Object} userData - { display_name, email, password, neighborhood_id }
 * @returns {Promise<Object>} Created user data
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
 */
function fetchCurrentUser() {
  return fetch(`${API_BASE}/api/auth/me`, {
    method: 'GET',
    credentials: 'include',
  })
    .then(response => {
      if (response.status === 401) return null;
      return validateResponse(response)
        .then(r => r.json())
        .then(data => data.user || null);
    });
}

/**
 * Purpose: Fetch all neighborhoods for the registration dropdown.
 * @returns {Promise<Array>} Array of { id, name } neighborhood objects
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
