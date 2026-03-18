// assets/js/pages/risk-widget.js
// Responsibility: Risk widget orchestrator — fetches risk data and delegates
//                 rendering to risk-ui.js. Used on the homepage.

document.addEventListener('DOMContentLoaded', initRiskWidget);

/**
 * Purpose: Initialize the risk widget — fetch data and render cards.
 * @returns {void}
 * Algorithm:
 * 1. Show loading state in all three cards
 * 2. Fetch risk assessment from API
 * 3. Render cards with returned data
 * 4. On error: show user-friendly error in cards
 */
function initRiskWidget() {
  if (!document.getElementById('fire-risk-card')) return;

  showRiskCardsLoading();

  fetchRiskAssessment()
    .then(data => renderRiskCards(data))
    .catch(error => {
      const message = error.type === ERROR_TYPES.NETWORK_ERROR
        ? 'Unable to load risk data. Check your connection.'
        : 'Risk data temporarily unavailable.';
      showRiskCardsError(message);
    });
}
