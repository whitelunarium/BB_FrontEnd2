// assets/js/api/game-api.js
// Responsibility: Game API workers — leaderboard fetch/post calls.
// These are WORKERS: they fetch and return data, no DOM manipulation.

/**
 * Purpose: Fetch the top 10 leaderboard scores.
 * @returns {Promise<Array>} Array of { display_name, score, badge, created_at }
 * Algorithm:
 * 1. GET /api/leaderboard/top10
 * 2. Validate response
 * 3. Return scores array
 */
function fetchLeaderboardTop10() {
  return fetch(`${API_BASE}/api/leaderboard/top10`, { credentials: 'include' })
    .then(validateResponse)
    .then(response => response.json())
    .then(data => data.scores || []);
}

/**
 * Purpose: Submit a completed game score to the leaderboard.
 * @param {Object} scoreData - { display_name, score, badge }
 * @returns {Promise<Object>} Saved score confirmation
 * Algorithm:
 * 1. POST score payload to /api/leaderboard
 * 2. Validate response
 * 3. Return saved record
 */
function submitLeaderboardScore(scoreData) {
  return fetch(`${API_BASE}/api/leaderboard`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scoreData),
  })
    .then(validateResponse)
    .then(response => response.json());
}
