// assets/js/api/events-api.js
// Responsibility: Events fetch workers — all HTTP calls for events and media features.
// These are WORKERS: they fetch and return data, no DOM manipulation.

/**
 * Purpose: Fetch all events sorted by date.
 * @returns {Promise<Array>} Array of event objects
 * Algorithm:
 * 1. GET /api/events
 * 2. Validate response
 * 3. Return events array
 */
function fetchEvents() {
  return fetch(`${API_BASE}/api/events`, { credentials: 'include' })
    .then(validateResponse)
    .then(response => response.json())
    .then(data => data.events || []);
}

/**
 * Purpose: Fetch events for a specific month/year for the calendar view.
 * @param {number} month - Month number (1-12)
 * @param {number} year - 4-digit year
 * @returns {Promise<Array>} Array of event objects for the given month
 * Algorithm:
 * 1. GET /api/events/calendar?month={month}&year={year}
 * 2. Validate response
 * 3. Return events array
 */
function fetchEventsForMonth(month, year) {
  return fetch(`${API_BASE}/api/events/calendar?month=${month}&year=${year}`, { credentials: 'include' })
    .then(validateResponse)
    .then(response => response.json())
    .then(data => data.events || []);
}

/**
 * Purpose: Create a new event (coordinator+ only).
 * @param {Object} eventData - { title, description, date, location, image_url }
 * @returns {Promise<Object>} Created event object
 * Algorithm:
 * 1. POST event data to /api/events
 * 2. Validate response
 * 3. Return created event
 */
function createEvent(eventData) {
  return fetch(`${API_BASE}/api/events`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(eventData),
  })
    .then(validateResponse)
    .then(response => response.json());
}

/**
 * Purpose: Fetch paginated media posts for the gallery.
 * @param {number} page - Page number (1-based)
 * @returns {Promise<Object>} { items, total, page, pages }
 * Algorithm:
 * 1. GET /api/media?page={page}
 * 2. Validate response
 * 3. Return paginated response
 */
function fetchMediaPosts(page) {
  const pageNum = page || 1;
  return fetch(`${API_BASE}/api/media?page=${pageNum}`, { credentials: 'include' })
    .then(validateResponse)
    .then(response => response.json());
}

/**
 * Purpose: Upload a new media post (coordinator+ only).
 * @param {FormData} formData - Multipart form data with file, title, caption
 * @returns {Promise<Object>} Created media post object
 * Algorithm:
 * 1. POST FormData to /api/media (no Content-Type header — browser sets multipart boundary)
 * 2. Validate response
 * 3. Return created post
 */
function uploadMediaPost(formData) {
  return fetch(`${API_BASE}/api/media`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
    .then(validateResponse)
    .then(response => response.json());
}
