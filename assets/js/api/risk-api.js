// assets/js/api/risk-api.js
// Responsibility: Risk fetch worker — fetches the live hazard assessment from the Flask API.
// This is a WORKER: it fetches and returns data, no DOM manipulation.

/**
 * Purpose: Fetch the current risk assessment for Poway CA from the backend.
 * @param {number|null} neighborhoodId - Optional neighborhood ID for tuned scoring
 * @returns {Promise<Object>} { fire_score, flood_score, heat_score, conditions, updated_at }
 * Algorithm:
 * 1. GET /api/risk with credentials
 * 2. Validate HTTP response
 * 3. Return parsed risk data
 */
function fetchRiskAssessment(neighborhoodId = null) {
  const query = neighborhoodId ? `?neighborhood_id=${encodeURIComponent(neighborhoodId)}` : '';
  return fetch(`${API_BASE}/api/risk${query}`, { credentials: 'include' })
    .then(validateResponse)
    .then(response => response.json());
}
