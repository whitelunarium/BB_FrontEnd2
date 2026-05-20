// assets/js/pages/risk-widget.js
// Responsibility: Risk widget orchestrator — fetches risk data and delegates
//                 rendering to risk-ui.js. Used on the homepage.

document.addEventListener('DOMContentLoaded', initRiskWidget);

const RISK_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

let riskRefreshTimer = null;
let riskFetchInFlight = false;

/**
 * Purpose: Initialize the risk widget — fetch data and keep it fresh.
 * @returns {void}
 * Algorithm:
 * 1. Show loading state in all three cards
 * 2. Fetch risk assessment from API
 * 3. Render cards with returned data
 * 4. Refresh periodically while the page is visible
 * 5. On error: show user-friendly error in cards
 */
function initRiskWidget() {
  if (!document.getElementById('fire-risk-card')) return;

  showRiskCardsLoading();
  refreshRiskWidget({ showErrors: true });
  startRiskRefreshTimer();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopRiskRefreshTimer();
      return;
    }

    refreshRiskWidget({ showErrors: false });
    startRiskRefreshTimer();
  });
}

function refreshRiskWidget({ showErrors = false } = {}) {
  if (riskFetchInFlight) return;

  riskFetchInFlight = true;

  fetchRiskAssessment()
    .then(data => renderRiskCards(data))
    .catch(error => {
      if (!showErrors) return;
      const message = error.type === ERROR_TYPES.NETWORK_ERROR
        ? 'Unable to load risk data. Check your connection.'
        : 'Risk data temporarily unavailable.';
      showRiskCardsError(message);
    })
    .finally(() => {
      riskFetchInFlight = false;
    });
}

function startRiskRefreshTimer() {
  if (riskRefreshTimer) return;
  riskRefreshTimer = window.setInterval(() => {
    refreshRiskWidget({ showErrors: false });
  }, RISK_REFRESH_INTERVAL_MS);
}

function stopRiskRefreshTimer() {
  if (!riskRefreshTimer) return;
  window.clearInterval(riskRefreshTimer);
  riskRefreshTimer = null;
}
