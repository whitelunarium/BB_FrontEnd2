// api/escape-room-api.js
// Responsibility: All leaderboard API fetch calls.
// WORKER — fetch only, no game logic.

// Submit score to the new RPG game endpoint
function postEscapeRoomScore(playerName, score, badge, actsCompleted, timeRemaining) {
  return fetch(API_BASE + '/api/escape-room/score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player_name:    escapeHtml(playerName),
      score:          score,
      badge:          badge,
      acts_completed: actsCompleted,
      time_remaining: timeRemaining
    })
  })
  .then(validateResponse)
  .then(r => r.json())
  .catch(err => console.error('Score submit failed:', err));
}

function getEscapeRoomLeaderboard() {
  return fetch(API_BASE + '/api/escape-room/scores')
    .then(validateResponse)
    .then(r => r.json())
    .then(data => data.leaderboard || [])
    .catch(err => { console.error('Leaderboard fetch failed:', err); return []; });
}
