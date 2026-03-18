// assets/js/api/risk-api.js
// Responsibility: Risk fetch worker — fetches the live hazard assessment from the Flask API.
// This is a WORKER: it fetches and returns data, no DOM manipulation.

/**
 * Purpose: Fetch the current risk assessment for Poway CA from the backend.
 * @returns {Promise<Object>} { fire_score, flood_score, heat_score, conditions, updated_at }
 * Algorithm:
 * 1. GET /api/risk with credentials
 * 2. Validate HTTP response
 * 3. Return parsed risk data
 */
function fetchRiskAssessment() {
  return fetch(`${API_BASE}/api/risk`, { credentials: 'include' })
    .then(validateResponse)
    .then(response => response.json());
}
