// assets/js/ui/auth-ui.js
// Responsibility: Auth DOM workers — all navbar/UI updates reflecting login state.
// These are WORKERS: they update the DOM, no fetch calls.

// ─── Role configuration ───────────────────────────────────────────────────────
const ROLE_CONFIG = {
  coordinator: { label: 'Coordinator', cssClass: 'badge-coordinator' },
  staff:       { label: 'Staff',       cssClass: 'badge-staff' },
  admin:       { label: 'Admin',       cssClass: 'badge-admin' },
  resident:    { label: '',            cssClass: 'badge-resident' },
};

/**
 * Purpose: Update the navbar to reflect a logged-in user.
 * @param {Object} user - { display_name, email, role }
 * @returns {void}
 * Algorithm:
 * 1. Hide the logged-out auth links
 * 2. Show the user menu
 * 3. Set display name, initials avatar, and role badge
 * 4. Show role-gated menu items based on user.role
 */
function renderNavbarLoggedIn(user) {
  const loginItem    = document.getElementById('navbar-login-item');
  const registerItem = document.getElementById('navbar-register-item');
  const loggedInEl   = document.getElementById('navbar-auth-logged-in');
  const displayName  = document.getElementById('navbar-display-name');
  const displayLocation = document.getElementById('navbar-display-location');
  const roleBadge    = document.getElementById('navbar-role-badge');
  const avatarEl     = document.getElementById('user-avatar-initials');
  const menuName     = document.getElementById('user-menu-name');
  const menuEmail    = document.getElementById('user-menu-email');
  const mobileSummary = document.getElementById('mobile-auth-user-summary');
  const displayNameLabel = getUserDisplayName(user);
  const locationLabel = getUserLocationLabel(user);

  if (!loggedInEl) return;

  if (loginItem)    loginItem.style.display = 'none';
  if (registerItem) registerItem.style.display = 'none';
  loggedInEl.style.display = 'block';

  if (displayName) displayName.textContent = displayNameLabel;
  if (displayLocation) {
    displayLocation.textContent = locationLabel ? ` · ${locationLabel}` : '';
    displayLocation.style.display = locationLabel ? 'inline' : 'none';
  }
  if (menuName)    menuName.textContent = displayNameLabel;
  if (menuEmail)   menuEmail.textContent = user.email;
  if (avatarEl)    avatarEl.textContent = getInitials(displayNameLabel);
  if (mobileSummary) mobileSummary.textContent = locationLabel ? `${displayNameLabel} · ${locationLabel}` : displayNameLabel;

  renderRoleBadge(roleBadge, user.role);
  showRoleGatedNavItems(user.role);

  // Mirror to mobile nav
  const mobileLoggedOut = document.getElementById('mobile-auth-logged-out');
  const mobileLoggedIn  = document.getElementById('mobile-auth-logged-in');
  if (mobileLoggedOut) mobileLoggedOut.style.display = 'none';
  if (mobileLoggedIn)  mobileLoggedIn.style.display = 'block';
}

/**
 * Purpose: Update the navbar to reflect a logged-out state.
 * @returns {void}
 * Algorithm:
 * 1. Show the logged-out auth links
 * 2. Hide the user menu
 * 3. Reset mobile nav auth section
 */
function renderNavbarLoggedOut() {
  const loginItem = document.getElementById('navbar-login-item');
  const registerItem = document.getElementById('navbar-register-item');
  const loggedInEl  = document.getElementById('navbar-auth-logged-in');
  const displayLocation = document.getElementById('navbar-display-location');
  const mobileLoggedOut = document.getElementById('mobile-auth-logged-out');
  const mobileLoggedIn  = document.getElementById('mobile-auth-logged-in');
  const mobileSummary = document.getElementById('mobile-auth-user-summary');

  if (loginItem) loginItem.style.display = 'list-item';
  if (registerItem) registerItem.style.display = 'list-item';
  if (loggedInEl)  loggedInEl.style.display = 'none';
  if (displayLocation) displayLocation.style.display = 'none';
  if (mobileLoggedOut) mobileLoggedOut.style.display = 'block';
  if (mobileLoggedIn)  mobileLoggedIn.style.display = 'none';
  if (mobileSummary) mobileSummary.textContent = '';
}

/**
 * Purpose: Render a role badge element with correct label and style.
 * @param {HTMLElement} badgeEl - Element to render badge into
 * @param {string} role - User's role string
 * @returns {void}
 * Algorithm:
 * 1. Look up role in ROLE_CONFIG
 * 2. If resident or unknown: clear the badge
 * 3. Otherwise: set text and CSS class
 */
function renderRoleBadge(badgeEl, role) {
  if (!badgeEl) return;
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.resident;
  if (!config.label) { badgeEl.textContent = ''; return; }
  badgeEl.textContent = config.label;
  badgeEl.className = `badge ${config.cssClass}`;
}

/**
 * Purpose: Show nav items that require coordinator-or-above access.
 * @param {string} role - User's role string
 * @returns {void}
 * Algorithm:
 * 1. Determine which access tiers this role meets
 * 2. Show/hide coordinator+ nav items
 * 3. Show/hide staff+ nav items
 */
function showRoleGatedNavItems(role) {
  const isCoordinatorPlus = ['coordinator', 'staff', 'admin'].includes(role);
  const isStaffPlus       = ['staff', 'admin'].includes(role);

  toggleNavItem('nav-media-link',     isCoordinatorPlus);
  toggleNavItem('nav-events-link',    isCoordinatorPlus);
  toggleNavItem('nav-dashboard-link', isStaffPlus);
  toggleNavItem('mobile-dashboard-link', isStaffPlus);
}

/**
 * Purpose: Show or hide a single navbar list item by ID.
 * @param {string} id - Element ID
 * @param {boolean} visible - Whether to show it
 * @returns {void}
 */
function toggleNavItem(id, visible) {
  const el = document.getElementById(id);
  if (el) el.style.display = visible ? 'block' : 'none';
}

/**
 * Purpose: Extract up to 2 initials from a display name.
 * @param {string} name - Full display name
 * @returns {string} 1-2 uppercase initial characters
 * Algorithm:
 * 1. Split name into words
 * 2. Take first letter of first and last word
 * 3. Return uppercase initials
 */
function getInitials(name) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Purpose: Show a permission-denied message for unauthorized page access.
 * @param {HTMLElement} containerEl - Element to render message into
 * @param {string} requiredRole - Minimum role needed
 * @returns {void}
 */
function renderAccessDenied(containerEl, requiredRole) {
  if (!containerEl) return;
  const siteBase = window.PNEC_SITE_BASE || '';
  containerEl.innerHTML = `
    <div class="empty-state" style="padding: 80px 24px;">
      <div class="empty-state-icon">🔒</div>
      <h3>Access Restricted</h3>
      <p>This page requires <strong>${requiredRole}</strong> access.<br>
         If you believe this is an error, please <a href="${siteBase}/pages/contact.html">contact PNEC staff</a>.</p>
      <a href="${siteBase}/" class="btn btn-secondary" style="margin-top:24px">Return to Home</a>
    </div>`;
}

/**
 * Purpose: Update the Poway auth-page header when a user is signed in.
 * @param {Object|null} user - User object from session or API
 * @returns {void}
 */
function renderPowayAuthHeader(user) {
  const displayItem = document.getElementById('poway-auth-display-item');
  const displayName = document.getElementById('poway-auth-display-name');
  const displayLocation = document.getElementById('poway-auth-display-location');
  const loginItem = document.getElementById('poway-auth-login-item');
  const registerItem = document.getElementById('poway-auth-register-item');
  const displayItemMobile = document.getElementById('poway-auth-display-item-mobile');
  const displayNameMobile = document.getElementById('poway-auth-display-name-mobile');
  const displayLocationMobile = document.getElementById('poway-auth-display-location-mobile');
  const loginItemMobile = document.getElementById('poway-auth-login-item-mobile');
  const registerItemMobile = document.getElementById('poway-auth-register-item-mobile');
  const displayNameLabel = getUserDisplayName(user);
  const locationLabel = getUserLocationLabel(user);

  if (!displayItem && !loginItem && !registerItem) return;

  if (displayNameLabel) {
    if (displayItem) displayItem.style.display = 'list-item';
    if (displayName) displayName.textContent = displayNameLabel;
    if (displayLocation) {
      displayLocation.textContent = locationLabel ? ` · ${locationLabel}` : '';
      displayLocation.style.display = locationLabel ? 'inline' : 'none';
    }
    if (loginItem) loginItem.style.display = 'none';
    if (registerItem) registerItem.style.display = 'none';

    if (displayItemMobile) displayItemMobile.style.display = 'list-item';
    if (displayNameMobile) displayNameMobile.textContent = displayNameLabel;
    if (displayLocationMobile) {
      displayLocationMobile.textContent = locationLabel ? ` · ${locationLabel}` : '';
      displayLocationMobile.style.display = locationLabel ? 'inline' : 'none';
    }
    if (loginItemMobile) loginItemMobile.style.display = 'none';
    if (registerItemMobile) registerItemMobile.style.display = 'none';

    // Update homepage personalization bar with resolved location
    const personalBar = document.getElementById('pnec-personal-bar');
    const personalName = document.getElementById('pnec-personal-name');
    const personalNeighborhood = document.getElementById('pnec-personal-neighborhood');
    if (personalBar) {
      personalBar.style.display = 'flex';
      if (personalName) personalName.textContent = displayNameLabel.split(' ')[0];
      if (personalNeighborhood) {
        personalNeighborhood.textContent = locationLabel ? '\uD83D\uDCCD ' + locationLabel : '';
        personalNeighborhood.style.display = locationLabel ? 'inline' : 'none';
      }
    }

    return;
  }

  if (displayItem) displayItem.style.display = 'none';
  if (displayLocation) displayLocation.style.display = 'none';
  if (loginItem) loginItem.style.display = 'list-item';
  if (registerItem) registerItem.style.display = 'list-item';
  if (displayItemMobile) displayItemMobile.style.display = 'none';
  if (displayLocationMobile) displayLocationMobile.style.display = 'none';
  if (loginItemMobile) loginItemMobile.style.display = 'list-item';
  if (registerItemMobile) registerItemMobile.style.display = 'list-item';
}

function getUserDisplayName(user) {
  if (!user || typeof user !== 'object') return '';
  if (typeof user.display_name === 'string' && user.display_name.trim()) return user.display_name.trim();
  if (typeof user.name === 'string' && user.name.trim()) return user.name.trim();
  if (typeof user.username === 'string' && user.username.trim()) return user.username.trim();
  if (typeof user.email === 'string' && user.email.trim()) return user.email.trim();
  return '';
}

function getUserLocationLabel(user) {
  if (!user || typeof user !== 'object') return '';
  if (typeof user.neighborhood_name === 'string' && user.neighborhood_name.trim()) return user.neighborhood_name.trim();
  if (user.neighborhood && typeof user.neighborhood.name === 'string' && user.neighborhood.name.trim()) return user.neighborhood.name.trim();
  if (typeof user.location === 'string' && user.location.trim()) return user.location.trim();
  if (typeof user.city === 'string' && user.city.trim()) return user.city.trim();
  return '';
}

function readCachedAuthUser() {
  try {
    const cachedUser = localStorage.getItem('pnec_user') || sessionStorage.getItem('pnec_user');
    return cachedUser ? JSON.parse(cachedUser) : null;
  } catch (_) {
    return null;
  }
}

function initPowayAuthHeader() {
  const cachedUser = readCachedAuthUser();
  if (cachedUser) {
    renderPowayAuthHeader(cachedUser);
    return;
  }

  if (typeof fetchCurrentUser === 'function') {
    fetchCurrentUser()
      .then(user => renderPowayAuthHeader(user))
      .catch(() => renderPowayAuthHeader(null));
  } else {
    renderPowayAuthHeader(null);
  }
}

document.addEventListener('DOMContentLoaded', initPowayAuthHeader);
