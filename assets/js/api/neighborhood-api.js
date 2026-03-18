// assets/js/api/neighborhood-api.js
// Responsibility: Neighborhood fetch workers — all HTTP calls for neighborhood map feature.
// These are WORKERS: they fetch and return data, no DOM manipulation.

/**
 * Purpose: Fetch all neighborhoods with coordinator data.
 * @returns {Promise<Array>} Array of neighborhood objects with polygon coords
 * Algorithm:
 * 1. GET /api/neighborhoods
 * 2. Validate response
 * 3. Return neighborhoods array
 */
function fetchAllNeighborhoods() {
  return fetch(`${API_BASE}/api/neighborhoods`, { credentials: 'include' })
    .then(validateResponse)
    .then(response => response.json())
    .then(data => data.neighborhoods || []);
}

/**
 * Purpose: Look up which neighborhood contains a given address or neighborhood number.
 * @param {string} query - Address string or neighborhood number
 * @returns {Promise<Object|null>} Neighborhood object or null if not found
 * Algorithm:
 * 1. GET /api/neighborhoods/lookup?address={query}
 * 2. If 404: return null
 * 3. Validate other errors
 * 4. Return neighborhood data
 */
function lookupNeighborhoodByAddress(query) {
  return fetch(`${API_BASE}/api/neighborhoods/lookup?address=${encodeURIComponent(query)}`, { credentials: 'include' })
    .then(response => {
      if (response.status === 404) return null;
      return validateResponse(response).then(r => r.json());
    });
}

/**
 * Purpose: Fetch a single neighborhood by its ID.
 * @param {number} id - Neighborhood database ID
 * @returns {Promise<Object>} Full neighborhood detail object
 * Algorithm:
 * 1. GET /api/neighborhoods/{id}
 * 2. Validate response
 * 3. Return neighborhood object
 */
function fetchNeighborhoodById(id) {
  return fetch(`${API_BASE}/api/neighborhoods/${id}`, { credentials: 'include' })
    .then(validateResponse)
    .then(response => response.json());
}
