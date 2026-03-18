// assets/js/ui/kit-ui.js
// Responsibility: Kit checklist DOM workers — renders categories/items, updates progress bar.
// These are WORKERS: they update the DOM, no storage or fetch calls.

/**
 * Purpose: Render all kit categories and their checklist items.
 * @param {Array} categories - Array of { id, name, icon, items[] } category objects
 * @param {Object} state - Map of item ID → boolean (checked state)
 * @returns {void}
 * Algorithm:
 * 1. Find the categories grid container
 * 2. For each category: build a card with header and item list
 * 3. Apply checked state from state map
 */
function renderKitCategories(categories, state) {
  const grid = document.getElementById('kit-categories-grid');
  if (!grid) return;

  grid.innerHTML = categories.map(category => `
    <div class="kit-category-card" data-category-id="${category.id}">
      <div class="kit-category-header">
        <span class="kit-cat-icon" aria-hidden="true">${escapeHtml(category.icon)}</span>
        <h3>${escapeHtml(category.name)}</h3>
        <span class="kit-cat-count" id="cat-count-${category.id}">
          ${countCheckedItems(category.items, state)}/${category.items.length}
        </span>
      </div>
      <div class="kit-item-list" id="kit-list-${category.id}">
        ${category.items.map(item => buildKitItemHtml(item, state[item.id] || false)).join('')}
      </div>
    </div>`
  ).join('');
}

/**
 * Purpose: Build the HTML for a single kit checklist item.
 * @param {Object} item - { id, name, why }
 * @param {boolean} isChecked - Whether this item is currently checked
 * @returns {string} HTML string for the item row
 * Algorithm:
 * 1. Determine checked CSS class
 * 2. Build checkbox, name, expandable "why" section
 * 3. Return complete item HTML
 */
function buildKitItemHtml(item, isChecked) {
  const checkedClass = isChecked ? 'checked' : '';
  return `
    <div class="kit-item ${checkedClass}" data-item-id="${item.id}" role="checkbox" aria-checked="${isChecked}" tabindex="0">
      <div class="kit-checkbox" aria-hidden="true"></div>
      <div class="kit-item-content">
        <span class="kit-item-name">${escapeHtml(item.name)}</span>
        <p class="kit-item-why">${escapeHtml(item.why || '')}</p>
      </div>
      <button class="kit-item-expand" aria-label="Why include this item" title="Why this matters">ℹ</button>
    </div>`;
}

/**
 * Purpose: Update the visual checked state of a single item after toggle.
 * @param {string} itemId - Item ID to update
 * @param {boolean} isChecked - New checked state
 * @returns {void}
 * Algorithm:
 * 1. Find the item element by data-item-id
 * 2. Add or remove 'checked' CSS class
 * 3. Update ARIA attribute
 */
function updateKitItemDisplay(itemId, isChecked) {
  const itemEl = document.querySelector(`.kit-item[data-item-id="${itemId}"]`);
  if (!itemEl) return;
  itemEl.classList.toggle('checked', isChecked);
  itemEl.setAttribute('aria-checked', isChecked.toString());
}

/**
 * Purpose: Update the progress bar and percentage display.
 * @param {number} total - Total number of items
 * @param {number} checked - Number of checked items
 * @returns {void}
 * Algorithm:
 * 1. Calculate percentage (0 if total is 0)
 * 2. Update the progress bar fill width
 * 3. Update the percentage text
 */
function updateKitProgressBar(total, checked) {
  const pct       = total > 0 ? Math.round((checked / total) * 100) : 0;
  const fillEl    = document.getElementById('kit-progress-fill');
  const pctEl     = document.getElementById('kit-progress-pct');

  if (fillEl) fillEl.style.width = `${pct}%`;
  if (pctEl)  pctEl.textContent  = `${pct}%`;
}

/**
 * Purpose: Update the item count display for a single category.
 * @param {string} categoryId - Category ID
 * @param {Array} items - Array of items in this category
 * @param {Object} state - Current state map
 * @returns {void}
 */
function updateCategoryCount(categoryId, items, state) {
  const countEl = document.getElementById(`cat-count-${categoryId}`);
  if (countEl) countEl.textContent = `${countCheckedItems(items, state)}/${items.length}`;
}

/**
 * Purpose: Toggle the "why this matters" explanation for an item.
 * @param {HTMLElement} itemEl - The kit item container element
 * @returns {void}
 */
function toggleItemExpand(itemEl) {
  const contentEl = itemEl.querySelector('.kit-item-content');
  if (contentEl) contentEl.classList.toggle('expanded');
}

// ─── Private helpers ──────────────────────────────────────────────────────────

/**
 * Purpose: Count how many items in a category are checked.
 * @param {Array} items - Category items
 * @param {Object} state - State map
 * @returns {number} Count of checked items
 */
function countCheckedItems(items, state) {
  return items.filter(item => state[item.id]).length;
}
