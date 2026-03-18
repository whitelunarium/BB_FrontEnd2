// assets/js/ui/map-ui.js
// Responsibility: Leaflet map DOM workers — renders neighborhood polygons,
//                 updates the coordinator info sidebar.
// These are WORKERS: they manipulate the DOM and Leaflet map, no fetch calls.

let leafletMap = null;
let neighborhoodLayers = {};  // Map of id → Leaflet layer

// ─── Zone colors by evacuation zone ──────────────────────────────────────────
const ZONE_COLORS = {
  A: '#c0392b',
  B: '#e67e22',
  C: '#f39c12',
  D: '#27ae60',
  E: '#3498db',
};
const DEFAULT_ZONE_COLOR = '#8e44ad';

/**
 * Purpose: Initialize the Leaflet map centered on Poway, CA.
 * @param {string} mapContainerId - ID of the DOM element to mount the map in
 * @returns {Object} The Leaflet map instance
 * Algorithm:
 * 1. Create a Leaflet map centered on Poway (lat 32.9628, lon -117.0359)
 * 2. Add OpenStreetMap tile layer (no API key required)
 * 3. Store reference and return map
 */
function initLeafletMap(mapContainerId) {
  leafletMap = L.map(mapContainerId, {
    center: [32.9628, -117.0359],
    zoom: 13,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(leafletMap);

  return leafletMap;
}

/**
 * Purpose: Render all neighborhood polygons on the Leaflet map.
 * @param {Array} neighborhoods - Array of neighborhood objects with polygon_coords_json
 * @param {Function} onSelectCallback - Called with the neighborhood when a polygon is clicked
 * @returns {void}
 * Algorithm:
 * 1. For each neighborhood with polygon coords: parse coords
 * 2. Create a Leaflet polygon with zone-based color
 * 3. Bind click handler to select the neighborhood
 * 4. Add popup with neighborhood name
 * 5. Store layer reference in neighborhoodLayers
 */
function renderNeighborhoodPolygons(neighborhoods, onSelectCallback) {
  if (!leafletMap) return;

  neighborhoods.forEach(neighborhood => {
    if (!neighborhood.polygon_coords_json) return;

    let coords;
    try {
      coords = typeof neighborhood.polygon_coords_json === 'string'
        ? JSON.parse(neighborhood.polygon_coords_json)
        : neighborhood.polygon_coords_json;
    } catch {
      return;
    }

    const color = ZONE_COLORS[neighborhood.zone] || DEFAULT_ZONE_COLOR;

    const polygon = L.polygon(coords, {
      color:       color,
      weight:      2,
      opacity:     0.8,
      fillColor:   color,
      fillOpacity: 0.2,
    });

    polygon.bindPopup(`<strong>${neighborhood.name}</strong><br>Zone ${neighborhood.zone || '—'}`);

    polygon.on('click', () => onSelectCallback(neighborhood));
    polygon.on('mouseover', () => polygon.setStyle({ fillOpacity: 0.4 }));
    polygon.on('mouseout',  () => polygon.setStyle({ fillOpacity: 0.2 }));

    polygon.addTo(leafletMap);
    neighborhoodLayers[neighborhood.id] = polygon;
  });
}

/**
 * Purpose: Highlight a single neighborhood polygon and pan the map to it.
 * @param {number} neighborhoodId - ID of the neighborhood to highlight
 * @returns {void}
 * Algorithm:
 * 1. Reset all polygon styles to default
 * 2. Find the target polygon by ID
 * 3. Set highlighted style on target
 * 4. Pan map to polygon bounds
 */
function highlightNeighborhood(neighborhoodId) {
  resetAllPolygonStyles();

  const layer = neighborhoodLayers[neighborhoodId];
  if (!layer || !leafletMap) return;

  layer.setStyle({ weight: 3, fillOpacity: 0.5 });
  leafletMap.fitBounds(layer.getBounds(), { padding: [40, 40] });
}

/**
 * Purpose: Reset all neighborhood polygon styles to default.
 * @returns {void}
 * Algorithm:
 * 1. Iterate all stored polygon layers
 * 2. Reset weight and fillOpacity on each
 */
function resetAllPolygonStyles() {
  Object.values(neighborhoodLayers).forEach(layer => {
    layer.setStyle({ weight: 2, fillOpacity: 0.2 });
  });
}

/**
 * Purpose: Render neighborhood coordinator info in the sidebar.
 * @param {Object} neighborhood - Full neighborhood object from API
 * @returns {void}
 * Algorithm:
 * 1. Find the coordinator info container
 * 2. Build detail rows for name, coordinator, ham radio, zone
 * 3. Insert HTML into container
 */
function renderCoordinatorInfo(neighborhood) {
  const container = document.getElementById('coordinator-info-panel');
  if (!container) return;

  const coord      = neighborhood.coordinator_name  || 'Coordinator not assigned';
  const coordEmail = neighborhood.coordinator_email || null;
  const hamOp      = neighborhood.ham_radio_operator || 'Not assigned';
  const zone       = neighborhood.zone || 'Unknown';

  container.innerHTML = `
    <h3>${escapeHtml(neighborhood.name)}</h3>
    <p style="font-size:13px;color:#5a5a5a;margin-bottom:16px">
      Neighborhood #${neighborhood.number || neighborhood.id}
    </p>

    <div class="coordinator-detail">
      <span class="detail-label">Zone</span>
      <span class="detail-value">
        <span style="background:${ZONE_COLORS[zone]||DEFAULT_ZONE_COLOR};color:white;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:700">${escapeHtml(zone)}</span>
      </span>
    </div>
    <div class="coordinator-detail">
      <span class="detail-label">Coordinator</span>
      <span class="detail-value">
        ${coordEmail
          ? `<a href="mailto:${escapeHtml(coordEmail)}">${escapeHtml(coord)}</a>`
          : escapeHtml(coord)}
      </span>
    </div>
    <div class="coordinator-detail">
      <span class="detail-label">Ham Radio Op</span>
      <span class="detail-value">${escapeHtml(hamOp)}</span>
    </div>

    <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e8e6e1;font-size:12px;color:#9e9e9e">
      Data is placeholder — contact <a href="mailto:info@powaynec.com">PNEC</a> for verified coordinator info.
    </div>`;
}

/**
 * Purpose: Show the "no neighborhood selected" empty state in the sidebar.
 * @returns {void}
 */
function renderCoordinatorEmptyState() {
  const container = document.getElementById('coordinator-info-panel');
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state" style="padding:40px 16px">
      <div class="empty-state-icon">📍</div>
      <h3>Select a Neighborhood</h3>
      <p>Click any zone on the map or search by address to see coordinator information.</p>
    </div>`;
}
