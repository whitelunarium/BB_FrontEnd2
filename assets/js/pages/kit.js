// assets/js/pages/kit.js
// Responsibility: Kit checklist orchestrator — loads state, coordinates kit-ui.js
//                 rendering, handles user interactions and persistence.

// ─── Kit data ─────────────────────────────────────────────────────────────────
// PPR LIST FEATURE: KIT_CATEGORIES array manages complexity.
// Without this list: would need 50+ separate variables and repeated conditional checks.
// With this list: single array drives all rendering, progress calculation, and state persistence.
const KIT_CATEGORIES = [
  {
    id: 'water',
    name: 'Water',
    icon: '💧',
    items: [
      { id: 'water-1gal',       name: '1 gallon per person per day (3-day min)',  why: 'FEMA recommends 1 gallon/person/day. A family of 4 needs 12 gallons for 3 days.' },
      { id: 'water-purify',     name: 'Water purification tablets or filter',     why: 'Backup if stored water runs out. Tablets are compact and have a long shelf life.' },
      { id: 'water-container',  name: 'Extra water storage containers',           why: 'Collapsible containers let you gather water from community sources.' },
    ]
  },
  {
    id: 'food',
    name: 'Food',
    icon: '🥫',
    items: [
      { id: 'food-3day',        name: '3-day supply of non-perishable food',      why: 'Choose foods that require no refrigeration, cooking, or water. Rotate yearly.' },
      { id: 'food-manual-can',  name: 'Manual can opener',                        why: 'Electric can openers won\'t work in a power outage. Always include a manual one.' },
      { id: 'food-utensils',    name: 'Plates, cups, and utensils (disposable)',  why: 'Water for washing dishes may not be available. Disposable reduces this burden.' },
      { id: 'food-baby',        name: 'Baby food/formula if needed',              why: 'Critical for infants. Include enough for 72 hours minimum.' },
      { id: 'food-pets',        name: 'Pet food if applicable',                  why: 'Don\'t forget your pets\' needs in your calculations.' },
    ]
  },
  {
    id: 'first-aid',
    name: 'First Aid',
    icon: '🩺',
    items: [
      { id: 'aid-kit',          name: 'First aid kit (ANSI compliant)',           why: 'Include bandages, antiseptic, gauze, medical tape, and scissors.' },
      { id: 'aid-rx',           name: 'Prescription medications (7-day supply)', why: 'Ask your doctor for an emergency supply. Critical for ongoing conditions.' },
      { id: 'aid-otc',          name: 'OTC medications (pain, antacid, antihistamine)', why: 'Stress and unusual food can cause a range of symptoms.' },
      { id: 'aid-glasses',      name: 'Extra glasses or contacts',               why: 'Vision impairment in an emergency can be dangerous. Keep a backup pair.' },
    ]
  },
  {
    id: 'documents',
    name: 'Documents',
    icon: '📄',
    items: [
      { id: 'doc-id',           name: 'Photo ID (driver\'s license or passport)', why: 'Required to access emergency shelters and services.' },
      { id: 'doc-insurance',    name: 'Insurance cards (health, home, auto)',     why: 'You will need these to file claims after a disaster.' },
      { id: 'doc-bank',         name: 'Bank account info and some cash',          why: 'ATMs may be down. Keep small bills — vendors may not make change.' },
      { id: 'doc-medical',      name: 'Medical records and medication list',      why: 'List all medications, dosages, and medical conditions. Vital if treated by strangers.' },
      { id: 'doc-property',     name: 'Deed/lease and property photos',           why: 'Documents ownership for insurance claims and housing assistance.' },
      { id: 'doc-contacts',     name: 'Emergency contact list (paper)',           why: 'Phone battery will die. Write down key numbers.' },
    ]
  },
  {
    id: 'tools',
    name: 'Tools & Safety',
    icon: '🔦',
    items: [
      { id: 'tool-flashlight',  name: 'Battery or hand-crank flashlight',        why: 'Don\'t rely on phone flashlight — it drains your only communication device.' },
      { id: 'tool-batteries',   name: 'Extra batteries (multiple sizes)',         why: 'Check what sizes your devices need and pack spares.' },
      { id: 'tool-radio',       name: 'Battery or hand-crank NOAA weather radio', why: 'Receive emergency alerts when cell service and internet are down.' },
      { id: 'tool-whistle',     name: 'Whistle to signal for help',              why: 'Three blasts is the universal distress signal. Far louder than shouting.' },
      { id: 'tool-multitool',   name: 'Multi-tool or Swiss army knife',          why: 'Hundreds of uses: cutting rope, opening containers, minor repairs.' },
      { id: 'tool-gloves',      name: 'Heavy work gloves',                       why: 'Protect hands during debris clearing and evacuation through rubble.' },
      { id: 'tool-dust-mask',   name: 'N95 dust masks',                         why: 'Wildfire smoke and earthquake dust cause serious respiratory injury.' },
    ]
  },
  {
    id: 'communication',
    name: 'Communication',
    icon: '📡',
    items: [
      { id: 'comm-plan',        name: 'Family communication plan (written)',      why: 'Who calls whom? Where do you meet? What if schools are closed?' },
      { id: 'comm-charger',     name: 'Portable USB battery bank (charged)',      why: 'Charge your devices when power is out. Buy one with high capacity.' },
      { id: 'comm-charger-car', name: 'Car charger for phone',                   why: 'Your car becomes a communication base during extended outages.' },
      { id: 'comm-local-map',   name: 'Printed local map with evacuation routes', why: 'GPS fails. A paper map of Poway including Evacuation Zones is essential.' },
    ]
  },
  {
    id: 'special',
    name: 'Special Needs',
    icon: '♿',
    items: [
      { id: 'spec-infant',      name: 'Infant needs (diapers, formula, wipes)',  why: 'Pack a 3-day supply minimum. Stores may be closed or depleted.' },
      { id: 'spec-elderly',     name: 'Mobility aids, hearing aids, extra batteries', why: 'Pack backup batteries for any devices. Note special transport needs.' },
      { id: 'spec-pet-carrier', name: 'Pet carrier and copies of vet records',    why: 'Many shelters accept pets only with vaccination records.' },
      { id: 'spec-comfort',     name: 'Comfort items for children (small toys, book)', why: 'Reduces trauma for kids. Takes minimal space.' },
    ]
  },
];

let kitState = {};

document.addEventListener('DOMContentLoaded', initKitPage);

/**
 * Purpose: Initialize the kit checklist page — load state and render items.
 * @returns {void}
 * Algorithm:
 * 1. Load state from localStorage (or URL param if shared)
 * 2. Render all categories
 * 3. Update progress bar
 * 4. Bind click handlers
 * 5. Bind print and share buttons
 */
function initKitPage() {
  if (!document.getElementById('kit-categories-grid')) return;

  kitState = loadStateFromUrl() || loadKitState();
  renderKitCategories(KIT_CATEGORIES, kitState);
  updateProgress();
  bindItemClicks();
  bindKitActions();
}

/**
 * Purpose: Load kit state from URL parameter if present (shared kit).
 * @returns {Object|null} Decoded state or null if no URL param
 * Algorithm:
 * 1. Read 'kit' query param from URL
 * 2. If present: decode it
 * 3. Return decoded state or null
 */
function loadStateFromUrl() {
  const params  = new URLSearchParams(window.location.search);
  const encoded = params.get('kit');
  return encoded ? decodeKitStateFromUrl(encoded) : null;
}

/**
 * Purpose: Bind click events on kit item rows and expand buttons.
 * @returns {void}
 * Algorithm:
 * 1. Listen for clicks on the categories grid
 * 2. Route to toggleItem if click is on the item row
 * 3. Route to toggleExpand if click is on the info button
 */
function bindItemClicks() {
  const grid = document.getElementById('kit-categories-grid');
  if (!grid) return;

  grid.addEventListener('click', event => {
    const expandBtn = event.target.closest('.kit-item-expand');
    if (expandBtn) {
      const itemEl = expandBtn.closest('.kit-item');
      if (itemEl) toggleItemExpand(itemEl);
      return;
    }

    const itemEl = event.target.closest('.kit-item');
    if (itemEl) handleItemToggle(itemEl.dataset.itemId);
  });

  // Keyboard support
  grid.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      const itemEl = event.target.closest('.kit-item');
      if (itemEl) { event.preventDefault(); handleItemToggle(itemEl.dataset.itemId); }
    }
  });
}

/**
 * Purpose: Toggle a kit item checked state and update all displays.
 * @param {string} itemId - ID of item to toggle
 * @returns {void}
 * Algorithm:
 * 1. Toggle item in state and persist
 * 2. Update the item's visual display
 * 3. Recalculate and update progress bar
 */
function handleItemToggle(itemId) {
  kitState = toggleKitItem(itemId, kitState);
  updateKitItemDisplay(itemId, kitState[itemId] || false);
  updateProgress();
}

/**
 * Purpose: Recalculate total checked items and refresh progress bar.
 * @returns {void}
 * Algorithm:
 * 1. Flatten all items across all categories
 * 2. Count how many are checked in current state
 * 3. Update progress bar with total and checked count
 */
function updateProgress() {
  const allItems   = KIT_CATEGORIES.flatMap(cat => cat.items);
  const totalCount = allItems.length;
  const checkedCount = allItems.filter(item => kitState[item.id]).length;
  updateKitProgressBar(totalCount, checkedCount);
}

/**
 * Purpose: Bind the print and share kit action buttons.
 * @returns {void}
 */
function bindKitActions() {
  const printBtn = document.getElementById('kit-print-btn');
  const shareBtn = document.getElementById('kit-share-btn');
  const resetBtn = document.getElementById('kit-reset-btn');

  if (printBtn) printBtn.addEventListener('click', () => window.print());
  if (shareBtn) shareBtn.addEventListener('click', handleShareKit);
  if (resetBtn) resetBtn.addEventListener('click', handleResetKit);
}

/**
 * Purpose: Generate a shareable URL with encoded kit state and copy to clipboard.
 * @returns {void}
 * Algorithm:
 * 1. Encode current state as URL param
 * 2. Build full URL with param
 * 3. Copy to clipboard
 * 4. Show brief confirmation
 */
function handleShareKit() {
  const encoded = encodeKitStateForUrl(kitState);
  const url     = `${window.location.origin}${window.location.pathname}?kit=${encoded}`;
  navigator.clipboard.writeText(url)
    .then(() => alert('Link copied to clipboard! Share it with your household.'))
    .catch(() => prompt('Copy this link to share your kit:', url));
}

/**
 * Purpose: Reset the entire kit state to unchecked.
 * @returns {void}
 * Algorithm:
 * 1. Confirm with user
 * 2. Clear state from localStorage
 * 3. Re-render categories with empty state
 * 4. Reset progress bar
 */
function handleResetKit() {
  if (!confirm('Reset your entire kit checklist? This cannot be undone.')) return;
  clearKitState();
  kitState = {};
  renderKitCategories(KIT_CATEGORIES, kitState);
  bindItemClicks();
  updateProgress();
}
