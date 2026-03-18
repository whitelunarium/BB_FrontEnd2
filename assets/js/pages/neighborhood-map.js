// assets/js/pages/neighborhood-map.js
// Responsibility: Neighborhood map orchestrator — coordinates neighborhood API
//                 workers with Leaflet map UI workers.

document.addEventListener('DOMContentLoaded', initNeighborhoodMap);

/**
 * Purpose: Initialize the neighborhood map page.
 * @returns {void}
 * Algorithm:
 * 1. Initialize Leaflet map
 * 2. Render empty state in sidebar
 * 3. Fetch all neighborhoods
 * 4. Render polygons on map
 * 5. Bind search input
 */
function initNeighborhoodMap() {
  if (!document.getElementById('pnec-map')) return;

  const map = initLeafletMap('pnec-map');
  renderCoordinatorEmptyState();
  bindMapSearch();

  fetchAllNeighborhoods()
    .then(neighborhoods => {
      renderNeighborhoodPolygons(neighborhoods, onNeighborhoodSelected);
    })
    .catch(error => {
      const container = document.getElementById('coordinator-info-panel');
      if (container) container.innerHTML = `<p style="color:#c0392b;padding:16px">${getErrorMessage(error.type)}</p>`;
    });
}

/**
 * Purpose: Handle a neighborhood polygon click — highlight and show coordinator info.
 * @param {Object} neighborhood - Clicked neighborhood object
 * @returns {void}
 * Algorithm:
 * 1. Highlight the selected polygon
 * 2. Fetch full neighborhood detail
 * 3. Render coordinator info in sidebar
 */
function onNeighborhoodSelected(neighborhood) {
  highlightNeighborhood(neighborhood.id);

  fetchNeighborhoodById(neighborhood.id)
    .then(data => renderCoordinatorInfo(data))
    .catch(() => renderCoordinatorInfo(neighborhood));
}

/**
 * Purpose: Bind the address search bar to neighborhood lookup.
 * @returns {void}
 * Algorithm:
 * 1. Find the search input and button
 * 2. On button click or Enter: run the lookup
 * 3. On result: highlight matching neighborhood and show coordinator info
 */
function bindMapSearch() {
  const searchInput  = document.getElementById('map-search-input');
  const searchButton = document.getElementById('map-search-btn');
  if (!searchInput) return;

  const runSearch = () => {
    const query = searchInput.value.trim();
    if (!query) return;
    executeMapSearch(query);
  };

  if (searchButton) searchButton.addEventListener('click', runSearch);
  searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') runSearch();
  });
}

/**
 * Purpose: Execute a map search and update the view with results.
 * @param {string} query - Address or neighborhood number
 * @returns {void}
 * Algorithm:
 * 1. Lookup neighborhood by address via API
 * 2. If found: highlight on map and show coordinator info
 * 3. If not found: show a not-found message in the sidebar
 */
function executeMapSearch(query) {
  const panel = document.getElementById('coordinator-info-panel');
  if (panel) panel.innerHTML = '<div class="loading-overlay"><span class="spinner"></span> Searching…</div>';

  lookupNeighborhoodByAddress(query)
    .then(neighborhood => {
      if (!neighborhood) {
        if (panel) panel.innerHTML = `
          <div class="empty-state" style="padding:40px 16px">
            <div class="empty-state-icon">🔍</div>
            <h3>Not Found</h3>
            <p>No neighborhood matched "<strong>${escapeHtml(query)}</strong>". Try a street address or neighborhood number.</p>
          </div>`;
        return;
      }
      highlightNeighborhood(neighborhood.id);
      renderCoordinatorInfo(neighborhood);
    })
    .catch(error => {
      if (panel) panel.innerHTML = `<p style="color:#c0392b;padding:16px">${getErrorMessage(error.type)}</p>`;
    });
}
