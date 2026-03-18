// assets/js/pages/game.js
// Responsibility: Preparedness Game orchestrator — manages game state (lives, score,
//                 level, currentScenario) and coordinates game-ui.js and game-api.js.

// ─── Game scenarios ───────────────────────────────────────────────────────────
// PPR LIST FEATURE: gameScenarios array manages complexity.
// Without this list: would need 15+ separate variables and repeated conditional checks.
// With this list: single array drives all rendering, scoring, and state progression.
const GAME_SCENARIOS = [
  {
    id: 1,
    category: 'Wildfire',
    emoji: '🔥',
    text: 'You receive a MANDATORY EVACUATION order for your zone. You have 15 minutes. What do you do FIRST?',
    options: [
      { text: 'Grab your pre-packed go-bag and leave immediately', correct: true,  points: 100 },
      { text: 'Pack all your valuables into the car', correct: false, points: 0 },
      { text: 'Call neighbors to see if they\'re leaving', correct: false, points: 0 },
      { text: 'Watch the fire on the news to decide', correct: false, points: 0 },
    ],
    explanation: 'When a mandatory evacuation is issued, leave immediately. Your go-bag should already be packed. Every minute counts during a wildfire.'
  },
  {
    id: 2,
    category: 'Wildfire',
    emoji: '🚗',
    text: 'You\'re evacuating and there are TWO routes out of your neighborhood. One is shorter but has smoke. What do you do?',
    options: [
      { text: 'Take the longer, clear route — fire can move faster than expected', correct: true,  points: 100 },
      { text: 'Drive through the smoke — it\'s just a short stretch', correct: false, points: 0 },
      { text: 'Wait at home until the smoke clears', correct: false, points: 0 },
      { text: 'Abandon your car and walk out', correct: false, points: 0 },
    ],
    explanation: 'Never drive into smoke — fire can overtake a vehicle in seconds. Always take the clear route, even if longer.'
  },
  {
    id: 3,
    category: 'Earthquake',
    emoji: '🌍',
    text: 'An earthquake begins while you\'re inside. The shaking is intense. What do you do?',
    options: [
      { text: 'Drop to your knees, take Cover under sturdy furniture, Hold On', correct: true,  points: 100 },
      { text: 'Run outside as fast as possible', correct: false, points: 0 },
      { text: 'Stand in a doorway', correct: false, points: 0 },
      { text: 'Duck under your bed', correct: false, points: 0 },
    ],
    explanation: '"Drop, Cover, Hold On" is the proven technique. Modern doorways offer no special protection. Running outside risks injury from falling debris.'
  },
  {
    id: 4,
    category: 'Earthquake',
    emoji: '🔧',
    text: 'After a large earthquake, you smell gas in your home. What do you do?',
    options: [
      { text: 'Leave immediately, don\'t use light switches, shut off gas at the meter from outside', correct: true,  points: 100 },
      { text: 'Open all windows and turn on fans', correct: false, points: 0 },
      { text: 'Call 911 from inside the house', correct: false, points: 0 },
      { text: 'Light a candle to see the gas meter better', correct: false, points: 0 },
    ],
    explanation: 'Any spark — even a light switch — can ignite gas. Leave first, then shut off the gas at the outside meter. Do NOT re-enter until cleared by a professional.'
  },
  {
    id: 5,
    category: 'Flood',
    emoji: '🌊',
    text: 'Heavy rain has flooded your street with 6 inches of fast-moving water. You need to get somewhere urgent. What do you do?',
    options: [
      { text: 'Stay put — 6 inches of moving water can knock a person down, 12 inches can sweep away a car', correct: true,  points: 100 },
      { text: 'Wade through carefully', correct: false, points: 0 },
      { text: 'Drive your SUV — it\'s high clearance', correct: false, points: 0 },
      { text: 'Swim across', correct: false, points: 0 },
    ],
    explanation: 'Turn Around, Don\'t Drown. Just 6 inches of moving water can knock an adult off their feet. 12 inches will carry away most vehicles. No destination is worth your life.'
  },
  {
    id: 6,
    category: 'Flood',
    emoji: '🏠',
    text: 'A flood watch is issued for your area. Your home is on flat ground near a drainage channel. What\'s your best action?',
    options: [
      { text: 'Review your evacuation zone, prepare go-bag, monitor alerts', correct: true,  points: 100 },
      { text: 'Sandbag the front door only', correct: false, points: 0 },
      { text: 'Wait to see if the watch becomes a warning', correct: false, points: 0 },
      { text: 'Move valuables to the attic', correct: false, points: 0 },
    ],
    explanation: 'A flood watch means conditions are favorable for flooding. Know your zone now — don\'t wait for a warning to start preparing.'
  },
  {
    id: 7,
    category: 'Extreme Heat',
    emoji: '🌡️',
    text: 'It\'s 108°F and a neighbor (elderly, lives alone) hasn\'t been seen for 2 days. What do you do?',
    options: [
      { text: 'Check on them immediately — heat stroke can be fatal within hours', correct: true,  points: 100 },
      { text: 'Leave a note on their door', correct: false, points: 0 },
      { text: 'They\'re probably fine — it\'s not that hot', correct: false, points: 0 },
      { text: 'Post on Nextdoor asking if anyone has seen them', correct: false, points: 0 },
    ],
    explanation: 'Elderly residents are extremely vulnerable to heat. Don\'t wait — check immediately. Call 911 if you cannot get a response or they appear unwell.'
  },
  {
    id: 8,
    category: 'Extreme Heat',
    emoji: '🆘',
    text: 'Someone collapses in a parking lot on a hot day. They\'re breathing but confused and skin is hot and dry. What is this?',
    options: [
      { text: 'Heat stroke — a life-threatening emergency. Call 911 and cool them immediately', correct: true,  points: 100 },
      { text: 'Heat exhaustion — give them water and rest', correct: false, points: 0 },
      { text: 'Dehydration — they need sports drinks', correct: false, points: 0 },
      { text: 'Low blood sugar — give them food', correct: false, points: 0 },
    ],
    explanation: 'Hot, dry skin + confusion = HEAT STROKE. This is life-threatening. Call 911 immediately. Cool the person with water, ice, or a shaded area while waiting for help.'
  },
  {
    id: 9,
    category: '72-Hour Kit',
    emoji: '🎒',
    text: 'You\'re building your family\'s go-bag. How much water should you pack per person per day?',
    options: [
      { text: '1 gallon per person per day for at least 3 days', correct: true,  points: 100 },
      { text: 'One 16oz bottle per person', correct: false, points: 0 },
      { text: '2 liters per person — enough for one day', correct: false, points: 0 },
      { text: 'Just pack water purification tablets', correct: false, points: 0 },
    ],
    explanation: 'FEMA recommends 1 gallon per person per day — more in heat or for active individuals. For a family of 4, that\'s 12 gallons for 3 days. Heavy but essential.'
  },
  {
    id: 10,
    category: '72-Hour Kit',
    emoji: '📄',
    text: 'Which documents should you keep in your emergency kit?',
    options: [
      { text: 'ID, insurance cards, bank info, medical records, and copies of deeds/leases', correct: true,  points: 100 },
      { text: 'Just your driver\'s license', correct: false, points: 0 },
      { text: 'Just your Social Security card', correct: false, points: 0 },
      { text: 'You don\'t need documents — they\'re all digital now', correct: false, points: 0 },
    ],
    explanation: 'Keep copies of all vital documents in a waterproof bag: ID, insurance, financial info, medical records, medication list, and property documents. Cloud backup is also wise.'
  },
  {
    id: 11,
    category: 'Neighborhood Preparedness',
    emoji: '🏘️',
    text: 'Your block hasn\'t done any emergency preparedness. What\'s the single most valuable first step?',
    options: [
      { text: 'Meet your neighbors and learn about each other\'s skills, needs, and vulnerabilities', correct: true,  points: 100 },
      { text: 'Purchase a generator', correct: false, points: 0 },
      { text: 'Build a shared food storage bunker', correct: false, points: 0 },
      { text: 'Set up a neighborhood watch program', correct: false, points: 0 },
    ],
    explanation: 'Research consistently shows neighbor connections are the strongest predictor of community disaster resilience. Know who has medical training, who has special needs, who has tools.'
  },
  {
    id: 12,
    category: 'Ham Radio',
    emoji: '📻',
    text: 'During a major disaster, most communication systems fail. What typically stays operational longest?',
    options: [
      { text: 'Ham radio — operators can communicate without infrastructure', correct: true,  points: 100 },
      { text: 'Cell phones — towers have backup power', correct: false, points: 0 },
      { text: 'Internet — it\'s designed to survive disasters', correct: false, points: 0 },
      { text: 'Landlines — they use physical copper wire', correct: false, points: 0 },
    ],
    explanation: 'Ham radio operators can communicate directly without cell towers or internet. During major disasters, ham radio is often the only working communication. PNEC\'s PACT program trains local operators for exactly this purpose.'
  },
  {
    id: 13,
    category: 'Wildfire',
    emoji: '🏡',
    text: 'Before wildfire season, what\'s the single most effective thing to do around your home?',
    options: [
      { text: 'Create and maintain 100 feet of "defensible space" by clearing dry vegetation', correct: true,  points: 100 },
      { text: 'Install metal window screens', correct: false, points: 0 },
      { text: 'Keep garden hoses ready', correct: false, points: 0 },
      { text: 'Buy a portable fire extinguisher', correct: false, points: 0 },
    ],
    explanation: 'Defensible space gives firefighters a safe area to work and slows fire from reaching your structure. The first 30 feet is critical — remove all dead plants, grass, and leaves.'
  },
  {
    id: 14,
    category: 'Earthquake',
    emoji: '🛒',
    text: 'You\'re in a grocery store when a major earthquake hits. Shelves are falling. What do you do?',
    options: [
      { text: 'Drop, get away from shelving, cover your head, hold on until shaking stops', correct: true,  points: 100 },
      { text: 'Run for the exit immediately', correct: false, points: 0 },
      { text: 'Get under the shopping cart', correct: false, points: 0 },
      { text: 'Brace in a checkout aisle', correct: false, points: 0 },
    ],
    explanation: 'Falling shelves and debris are the main danger. Move away from shelves and tall displays, drop to protect yourself, and don\'t run — you\'re more likely to be injured falling or from flying objects.'
  },
  {
    id: 15,
    category: 'CERT Training',
    emoji: '🦺',
    text: 'You\'ve completed CERT training and a disaster strikes your neighborhood. Rescue workers are 4 hours away. Your role is to:',
    options: [
      { text: 'Do the greatest good for the greatest number — triage and assist those with survivable injuries', correct: true,  points: 100 },
      { text: 'Attempt to rescue the most severely injured first regardless of resources', correct: false, points: 0 },
      { text: 'Wait for professional responders before doing anything', correct: false, points: 0 },
      { text: 'Only provide emotional support — medical help is beyond your training', correct: false, points: 0 },
    ],
    explanation: 'CERT training emphasizes "the greatest good for the greatest number" — triaging and helping those with survivable injuries first. CERT volunteers can safely perform light search and rescue, first aid, and triage in the critical hours before professional help arrives.'
  },
];

const BADGES = [
  { minScore: 0,    maxScore: 499,  name: 'Beginner Prepared',            emoji: '🟡' },
  { minScore: 500,  maxScore: 999,  name: 'Neighborhood Ready',           emoji: '🟠' },
  { minScore: 1000, maxScore: 1500, name: 'Community Resilience Champion', emoji: '🔴' },
];

// ─── Game state ───────────────────────────────────────────────────────────────
let gameState = {
  lives:           3,
  score:           0,
  level:           1,
  currentIndex:    0,
  currentScenario: null,
  answered:        false,
  scenarios:       [],
};

document.addEventListener('DOMContentLoaded', initGame);

/**
 * Purpose: Initialize the preparedness game — shuffle scenarios and render first.
 * @returns {void}
 * Algorithm:
 * 1. Shuffle scenarios
 * 2. Reset game state
 * 3. Render the first scenario
 * 4. Bind option click handler
 * 5. Load and display leaderboard
 */
function initGame() {
  if (!document.getElementById('game-scenario-container')) return;
  gameState.scenarios = shuffleArray([...GAME_SCENARIOS]);
  resetGameState();
  renderCurrentScenario();
  bindOptionButtons();
  loadLeaderboard();
}

/**
 * Purpose: Reset game state to initial values for a fresh game.
 * @returns {void}
 */
function resetGameState() {
  gameState.lives        = 3;
  gameState.score        = 0;
  gameState.level        = 1;
  gameState.currentIndex = 0;
  gameState.answered     = false;
  updateGameHud();
}

// ─── Scenario rendering ───────────────────────────────────────────────────────

/**
 * Purpose: Render the current scenario card and option buttons.
 * @returns {void}
 * Algorithm:
 * 1. Get current scenario from scenarios array
 * 2. Update scenario text and emoji
 * 3. Clear and repopulate options
 * 4. Clear previous explanation
 */
function renderCurrentScenario() {
  const scenario = gameState.scenarios[gameState.currentIndex];
  if (!scenario) { showEndScreen(); return; }

  gameState.currentScenario = scenario;
  gameState.answered        = false;

  const scenarioBadge    = document.getElementById('scenario-badge');
  const scenarioEmoji    = document.getElementById('scenario-emoji');
  const scenarioText     = document.getElementById('scenario-text');
  const optionsContainer = document.getElementById('game-options-container');
  const explanation      = document.getElementById('game-explanation');

  if (scenarioBadge)  scenarioBadge.textContent  = `${scenario.category} — Question ${gameState.currentIndex + 1} of ${gameState.scenarios.length}`;
  if (scenarioEmoji)  scenarioEmoji.textContent  = scenario.emoji;
  if (scenarioText)   scenarioText.textContent   = scenario.text;
  if (explanation)  { explanation.textContent = ''; explanation.classList.remove('visible'); }

  if (optionsContainer) {
    optionsContainer.innerHTML = scenario.options.map((option, index) => `
      <button class="game-option-btn"
              data-option-index="${index}"
              data-correct="${option.correct}"
              data-points="${option.points}">
        ${escapeHtml(option.text)}
      </button>`
    ).join('');
  }
}

// ─── Option selection ─────────────────────────────────────────────────────────

/**
 * Purpose: Bind click events on game option buttons.
 * @returns {void}
 */
function bindOptionButtons() {
  const container = document.getElementById('game-options-container');
  if (!container) return;
  container.addEventListener('click', event => {
    const btn = event.target.closest('.game-option-btn');
    if (!btn || gameState.answered) return;
    handleOptionSelected(btn);
  });
}

/**
 * Purpose: Process a selected option — score, lives, explanation, next question.
 * @param {HTMLElement} btnEl - The clicked option button
 * @returns {void}
 * Algorithm:
 * 1. Mark game as answered (prevents double-click)
 * 2. Check if answer is correct
 * 3. Award points or deduct a life
 * 4. Apply visual feedback to correct/wrong buttons
 * 5. Show explanation
 * 6. Advance to next question after delay
 */
function handleOptionSelected(btnEl) {
  gameState.answered = true;

  const isCorrect = btnEl.dataset.correct === 'true';
  const points    = parseInt(btnEl.dataset.points, 10) || 0;
  const scenario  = gameState.currentScenario;

  if (isCorrect) {
    gameState.score += points;
  } else {
    gameState.lives -= 1;
  }

  updateGameHud();
  markOptionButtons(btnEl, isCorrect);
  showExplanation(scenario.explanation, isCorrect);

  if (gameState.lives <= 0) {
    setTimeout(showEndScreen, 2000);
  } else {
    setTimeout(advanceToNextScenario, 2500);
  }
}

/**
 * Purpose: Apply correct/wrong CSS classes to all option buttons after selection.
 * @param {HTMLElement} selectedBtn - The button the user clicked
 * @param {boolean} wasCorrect - Whether the selected answer was correct
 * @returns {void}
 * Algorithm:
 * 1. Mark selected button as 'wrong' if incorrect
 * 2. Find and mark the correct button
 * 3. Disable all buttons
 */
function markOptionButtons(selectedBtn, wasCorrect) {
  const container = document.getElementById('game-options-container');
  if (!container) return;

  container.querySelectorAll('.game-option-btn').forEach(btn => {
    btn.classList.add('disabled');
    if (btn.dataset.correct === 'true') btn.classList.add('correct');
  });

  if (!wasCorrect) selectedBtn.classList.add('wrong');
}

/**
 * Purpose: Show the explanation text after an option is selected.
 * @param {string} text - Explanation text
 * @param {boolean} correct - Whether the answer was correct (affects prefix text)
 * @returns {void}
 */
function showExplanation(text, correct) {
  const el = document.getElementById('game-explanation');
  if (!el) return;
  const prefix = correct ? '<strong>✅ Correct!</strong> ' : '<strong>❌ Not quite.</strong> ';
  el.innerHTML = `${prefix}${escapeHtml(text)}`;
  el.classList.add('visible');
}

/**
 * Purpose: Move to the next scenario in the sequence.
 * @returns {void}
 */
function advanceToNextScenario() {
  gameState.currentIndex += 1;
  gameState.level = Math.floor(gameState.currentIndex / 5) + 1;

  if (gameState.currentIndex >= gameState.scenarios.length) {
    showEndScreen();
  } else {
    renderCurrentScenario();
  }
}

// ─── HUD updates ──────────────────────────────────────────────────────────────

/**
 * Purpose: Update the game HUD (score, lives display).
 * @returns {void}
 * Algorithm:
 * 1. Update score display
 * 2. Update lives display with heart emojis
 */
function updateGameHud() {
  const scoreEl = document.getElementById('game-score-display');
  const livesEl = document.getElementById('game-lives-display');
  if (scoreEl) scoreEl.textContent = gameState.score.toLocaleString();
  if (livesEl) livesEl.textContent = '❤️'.repeat(Math.max(0, gameState.lives));
}

// ─── End screen ───────────────────────────────────────────────────────────────

/**
 * Purpose: Show the game end screen with final score and earned badge.
 * @returns {void}
 * Algorithm:
 * 1. Find the badge based on final score
 * 2. Show end screen with badge, score, and leaderboard submit form
 * 3. Auto-submit score if user is logged in
 */
function showEndScreen() {
  const badge = resolveBadge(gameState.score);

  const container = document.getElementById('game-scenario-container');
  if (!container) return;

  container.innerHTML = `
    <div class="game-end-screen">
      <div class="game-badge" aria-hidden="true">${badge.emoji}</div>
      <h2>You earned:<br><span style="color:#c0392b">${escapeHtml(badge.name)}</span></h2>
      <div class="game-final-score">${gameState.score.toLocaleString()} pts</div>
      <p>${lives === 0 ? 'You ran out of lives, but every scenario teaches you something. Try again!' : 'Excellent work! You completed all scenarios.'}</p>

      <form id="leaderboard-submit-form" style="margin-bottom:24px">
        <input type="text" id="leaderboard-name" class="form-input"
               placeholder="Your name for the leaderboard" maxlength="50"
               style="max-width:300px;margin:0 auto 12px;display:block">
        <button type="submit" class="btn btn-primary" id="leaderboard-submit-btn">
          Submit to Leaderboard
        </button>
      </form>

      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-secondary" onclick="location.reload()">Play Again</button>
        <a href="/pages/kit.html" class="btn btn-outline">Check Your Kit</a>
      </div>
    </div>`;

  prefillLeaderboardName();
  bindLeaderboardSubmit();
  loadLeaderboard();
}

/**
 * Purpose: Pre-fill the leaderboard name field with the logged-in user's name.
 * @returns {void}
 */
function prefillLeaderboardName() {
  try {
    const user = JSON.parse(sessionStorage.getItem('pnec_user') || 'null');
    const input = document.getElementById('leaderboard-name');
    if (user && input) input.value = user.display_name;
  } catch { /* Ignore */ }
}

/**
 * Purpose: Bind the leaderboard submission form.
 * @returns {void}
 */
function bindLeaderboardSubmit() {
  const form = document.getElementById('leaderboard-submit-form');
  if (!form) return;
  form.addEventListener('submit', handleLeaderboardSubmit);
}

/**
 * Purpose: Submit the final score to the leaderboard API.
 * @param {Event} event - Form submit event
 * @returns {void}
 */
function handleLeaderboardSubmit(event) {
  event.preventDefault();
  const nameInput = document.getElementById('leaderboard-name');
  const submitBtn = document.getElementById('leaderboard-submit-btn');
  const name = nameInput ? nameInput.value.trim() : 'Anonymous';

  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving…'; }

  const badge = resolveBadge(gameState.score);
  submitLeaderboardScore({ display_name: name, score: gameState.score, badge: badge.name })
    .then(() => {
      if (submitBtn) submitBtn.textContent = '✅ Saved!';
      loadLeaderboard();
    })
    .catch(() => {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Try Again'; }
    });
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

/**
 * Purpose: Load and display the top 10 leaderboard scores.
 * @returns {void}
 * Algorithm:
 * 1. Find the leaderboard container
 * 2. Fetch top 10 scores
 * 3. Render ranked list
 */
function loadLeaderboard() {
  const container = document.getElementById('leaderboard-list');
  if (!container) return;
  container.innerHTML = '<div class="loading-overlay"><span class="spinner"></span></div>';

  fetchLeaderboardTop10()
    .then(scores => renderLeaderboard(scores))
    .catch(() => { container.innerHTML = '<p style="color:#9e9e9e;font-size:13px;text-align:center">Leaderboard unavailable</p>'; });
}

/**
 * Purpose: Render the leaderboard scores into the leaderboard container.
 * @param {Array} scores - Array of { display_name, score, badge }
 * @returns {void}
 * Algorithm:
 * 1. If empty: show empty state
 * 2. Otherwise: render ranked rows with medals for top 3
 */
function renderLeaderboard(scores) {
  const container = document.getElementById('leaderboard-list');
  if (!container) return;

  if (!scores.length) {
    container.innerHTML = '<p style="color:#9e9e9e;font-size:13px;text-align:center">No scores yet — be the first!</p>';
    return;
  }

  const medals = ['🥇', '🥈', '🥉'];
  container.innerHTML = scores.map((entry, index) => `
    <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid #e8e6e1">
      <span style="font-size:1.1rem;min-width:28px">${medals[index] || `${index + 1}.`}</span>
      <span style="flex:1;font-weight:600;font-size:14px">${escapeHtml(entry.display_name)}</span>
      <span style="font-size:14px;color:#c0392b;font-weight:700">${entry.score.toLocaleString()}</span>
    </div>`
  ).join('');
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Purpose: Determine the badge earned for a given score.
 * @param {number} score - Final game score
 * @returns {Object} { name, emoji } badge object
 * Algorithm:
 * 1. Iterate BADGES in reverse order (highest first)
 * 2. Return first badge where score >= minScore
 * 3. Default to first badge
 */
function resolveBadge(score) {
  for (let i = BADGES.length - 1; i >= 0; i--) {
    if (score >= BADGES[i].minScore) return BADGES[i];
  }
  return BADGES[0];
}

/**
 * Purpose: Return a new array with elements in random order.
 * @param {Array} array - Input array
 * @returns {Array} New shuffled array
 * Algorithm:
 * 1. Copy the input array
 * 2. Fisher-Yates shuffle: iterate from end, swap each element with a random earlier element
 * 3. Return shuffled copy
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
