// assets/js/utils/kit-storage.js
// Responsibility: Kit localStorage workers — read and write checklist state to localStorage.
// These are WORKERS: they interact with localStorage only, no DOM manipulation.

const KIT_STORAGE_KEY = 'pnec_kit_state';

/**
 * Purpose: Load the saved kit state from localStorage.
 * @returns {Object} Map of item ID → boolean (checked state)
 * Algorithm:
 * 1. Read raw string from localStorage
 * 2. If nothing stored: return empty object
 * 3. Parse JSON
 * 4. Return the state map
 */
function loadKitState() {
  try {
    const raw = localStorage.getItem(KIT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Purpose: Save the current kit state to localStorage.
 * @param {Object} state - Map of item ID → boolean
 * @returns {void}
 * Algorithm:
 * 1. Serialize state to JSON
 * 2. Write to localStorage under KIT_STORAGE_KEY
 */
function saveKitState(state) {
  try {
    localStorage.setItem(KIT_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Storage unavailable — silently continue */
  }
}

/**
 * Purpose: Toggle a single item's checked state and persist.
 * @param {string} itemId - Item ID to toggle
 * @param {Object} currentState - Current state map
 * @returns {Object} Updated state map
 * Algorithm:
 * 1. Load current state
 * 2. Flip the boolean for itemId
 * 3. Save updated state
 * 4. Return the new state
 */
function toggleKitItem(itemId, currentState) {
  const updatedState = { ...currentState, [itemId]: !currentState[itemId] };
  saveKitState(updatedState);
  return updatedState;
}

/**
 * Purpose: Clear all kit state (reset checklist to empty).
 * @returns {void}
 */
function clearKitState() {
  localStorage.removeItem(KIT_STORAGE_KEY);
}

/**
 * Purpose: Encode kit state as a URL-safe base64 string for sharing.
 * @param {Object} state - Current state map
 * @returns {string} URL-safe encoded string
 * Algorithm:
 * 1. Serialize state to JSON
 * 2. Base64-encode the string
 * 3. Make URL-safe by replacing +/= chars
 */
function encodeKitStateForUrl(state) {
  try {
    return btoa(JSON.stringify(state)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  } catch {
    return '';
  }
}

/**
 * Purpose: Decode a shared kit state URL parameter back into a state object.
 * @param {string} encoded - URL-safe base64 string from URL param
 * @returns {Object|null} Decoded state map or null if invalid
 * Algorithm:
 * 1. Restore base64 padding and standard chars
 * 2. Decode from base64
 * 3. Parse JSON
 * 4. Return object or null on failure
 */
function decodeKitStateFromUrl(encoded) {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}
