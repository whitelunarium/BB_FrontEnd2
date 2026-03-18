// assets/js/ui/risk-ui.js
// Responsibility: Risk DOM workers — render risk cards, apply severity colors, pulse animation.
// These are WORKERS: they update the DOM, no fetch calls.

// ─── Risk level thresholds ────────────────────────────────────────────────────
const RISK_LEVELS = [
  { min: 0, max: 3,  label: 'Low',      cssClass: 'risk-low' },
  { min: 4, max: 6,  label: 'Moderate', cssClass: 'risk-moderate' },
  { min: 7, max: 8,  label: 'High',     cssClass: 'risk-high' },
  { min: 9, max: 10, label: 'Critical', cssClass: 'risk-critical' },
];

/**
 * Purpose: Render all three risk cards (fire, flood, heat) from API data.
 * @param {Object} riskData - { fire_score, flood_score, heat_score, conditions, updated_at }
 * @returns {void}
 * Algorithm:
 * 1. Render fire risk card
 * 2. Render flood risk card
 * 3. Render heat risk card
 * 4. Update the "last updated" timestamp
 */
function renderRiskCards(riskData) {
  renderRiskCard('fire-risk-card', {
    icon:  '🔥',
    type:  'FIRE RISK',
    score: riskData.fire_score,
    conditions: buildFireConditions(riskData.conditions),
  });

  renderRiskCard('flood-risk-card', {
    icon:  '🌊',
    type:  'FLOOD RISK',
    score: riskData.flood_score,
    conditions: buildFloodConditions(riskData.conditions),
  });

  renderRiskCard('heat-risk-card', {
    icon:  '🌡️',
    type:  'EXTREME HEAT',
    score: riskData.heat_score,
    conditions: buildHeatConditions(riskData.conditions),
  });

  updateRiskTimestamp(riskData.updated_at);
}

/**
 * Purpose: Render a single risk card with score, label, and conditions.
 * @param {string} cardId - DOM element ID for the card container
 * @param {Object} cardData - { icon, type, score, conditions }
 * @returns {void}
 * Algorithm:
 * 1. Find the card element by ID
 * 2. Determine risk level from score
 * 3. Apply correct CSS class and pulse animation for high/critical
 * 4. Inject inner HTML with score and conditions
 */
function renderRiskCard(cardId, cardData) {
  const cardEl = document.getElementById(cardId);
  if (!cardEl) return;

  const level = classifyRiskLevel(cardData.score);

  // Reset all risk classes and animations
  cardEl.className = `risk-card ${level.cssClass}`;
  if (level.label === 'High' || level.label === 'Critical') {
    cardEl.classList.add(level.label === 'Critical' ? 'pulse-red' : 'pulse-amber');
  }

  cardEl.innerHTML = buildRiskCardHtml(cardData, level);
}

/**
 * Purpose: Build the inner HTML for a risk card.
 * @param {Object} cardData - { icon, type, score, conditions }
 * @param {Object} level - { label, cssClass }
 * @returns {string} HTML string for the card contents
 * Algorithm:
 * 1. Build header with icon and type label
 * 2. Build score row with numeric score and level label badge
 * 3. Build conditions section
 */
function buildRiskCardHtml(cardData, level) {
  const conditionsHtml = cardData.conditions
    .map(c => `
      <div class="condition-row">
        <span class="condition-label">${escapeHtml(c.label)}</span>
        <span class="condition-value">${escapeHtml(c.value)}</span>
      </div>`)
    .join('');

  return `
    <div class="risk-card-header">
      <span class="risk-icon" aria-hidden="true">${cardData.icon}</span>
      <span class="risk-type">${cardData.type}</span>
    </div>
    <div class="risk-score-row">
      <span class="risk-score">${cardData.score}</span>
      <span class="risk-max">/10</span>
      <span class="risk-label" style="background:${getRiskLabelBg(level.label)};color:${getRiskLabelColor(level.label)}">
        ${level.label}
      </span>
    </div>
    <div class="risk-conditions">${conditionsHtml}</div>`;
}

/**
 * Purpose: Classify a score 0-10 into a risk level object.
 * @param {number} score - Numeric risk score (0–10)
 * @returns {Object} { min, max, label, cssClass }
 * Algorithm:
 * 1. Iterate RISK_LEVELS thresholds
 * 2. Return the first level where score falls within min-max
 * 3. Default to the highest level if score exceeds all ranges
 */
function classifyRiskLevel(score) {
  return RISK_LEVELS.find(level => score >= level.min && score <= level.max) || RISK_LEVELS[RISK_LEVELS.length - 1];
}

/**
 * Purpose: Update the "last updated" timestamp element.
 * @param {string} updatedAt - ISO timestamp string
 * @returns {void}
 */
function updateRiskTimestamp(updatedAt) {
  const el = document.getElementById('risk-updated-time');
  if (!el) return;
  const date = new Date(updatedAt);
  const minutesAgo = Math.round((Date.now() - date.getTime()) / 60000);
  el.textContent = minutesAgo < 2 ? 'Just updated' : `Updated ${minutesAgo} minutes ago`;
}

/**
 * Purpose: Show a loading skeleton in all risk card slots.
 * @returns {void}
 */
function showRiskCardsLoading() {
  ['fire-risk-card', 'flood-risk-card', 'heat-risk-card'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<div class="loading-overlay"><span class="spinner"></span></div>';
  });
}

/**
 * Purpose: Show an error state in the risk widget.
 * @param {string} message - Error message to display
 * @returns {void}
 */
function showRiskCardsError(message) {
  ['fire-risk-card', 'flood-risk-card', 'heat-risk-card'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<p style="font-size:13px;color:#c0392b;text-align:center;padding:16px">${message}</p>`;
  });
}

// ─── Condition builders ───────────────────────────────────────────────────────

/**
 * Purpose: Build condition rows for the fire risk card.
 * @param {Object} conditions - Raw conditions from API
 * @returns {Array} Array of { label, value } display pairs
 */
function buildFireConditions(conditions) {
  if (!conditions) return [];
  return [
    { label: 'Temperature', value: conditions.temperature_f ? `${conditions.temperature_f}°F` : '—' },
    { label: 'Humidity',    value: conditions.humidity ? `${conditions.humidity}%` : '—' },
    { label: 'Wind Speed',  value: conditions.wind_mph ? `${conditions.wind_mph} mph` : '—' },
  ];
}

/**
 * Purpose: Build condition rows for the flood risk card.
 * @param {Object} conditions - Raw conditions from API
 * @returns {Array} Array of { label, value } display pairs
 */
function buildFloodConditions(conditions) {
  if (!conditions) return [];
  return [
    { label: 'Rain (1hr)',   value: conditions.precip_1hr_in ? `${conditions.precip_1hr_in}"` : '—' },
    { label: 'Rain (48hr)', value: conditions.precip_48hr_in ? `${conditions.precip_48hr_in}"` : '—' },
    { label: 'Temperature', value: conditions.temperature_f ? `${conditions.temperature_f}°F` : '—' },
  ];
}

/**
 * Purpose: Build condition rows for the heat risk card.
 * @param {Object} conditions - Raw conditions from API
 * @returns {Array} Array of { label, value } display pairs
 */
function buildHeatConditions(conditions) {
  if (!conditions) return [];
  return [
    { label: 'Temperature', value: conditions.temperature_f ? `${conditions.temperature_f}°F` : '—' },
    { label: 'Heat Index',  value: conditions.heat_index_f ? `${conditions.heat_index_f}°F` : '—' },
    { label: 'Humidity',    value: conditions.humidity ? `${conditions.humidity}%` : '—' },
  ];
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function getRiskLabelBg(label) {
  const map = { Low: '#d1fae5', Moderate: '#fef3c7', High: '#ffedd5', Critical: '#fee2e2' };
  return map[label] || '#f5f5f5';
}

function getRiskLabelColor(label) {
  const map = { Low: '#065f46', Moderate: '#92400e', High: '#9a3412', Critical: '#991b1b' };
  return map[label] || '#333';
}
