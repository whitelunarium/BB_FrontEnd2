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
  const loggedOutEl  = document.getElementById('navbar-auth-logged-out');
  const loggedInEl   = document.getElementById('navbar-auth-logged-in');
  const displayName  = document.getElementById('navbar-display-name');
  const roleBadge    = document.getElementById('navbar-role-badge');
  const avatarEl     = document.getElementById('user-avatar-initials');
  const menuName     = document.getElementById('user-menu-name');
  const menuEmail    = document.getElementById('user-menu-email');

  if (!loggedInEl) return;

  if (loggedOutEl) loggedOutEl.style.display = 'none';
  loggedInEl.style.display = 'block';

  if (displayName) displayName.textContent = user.display_name;
  if (menuName)    menuName.textContent = user.display_name;
  if (menuEmail)   menuEmail.textContent = user.email;
  if (avatarEl)    avatarEl.textContent = getInitials(user.display_name);

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
  const loggedOutEl = document.getElementById('navbar-auth-logged-out');
  const loggedInEl  = document.getElementById('navbar-auth-logged-in');
  const mobileLoggedOut = document.getElementById('mobile-auth-logged-out');
  const mobileLoggedIn  = document.getElementById('mobile-auth-logged-in');

  if (loggedOutEl) loggedOutEl.style.display = 'flex';
  if (loggedInEl)  loggedInEl.style.display = 'none';
  if (mobileLoggedOut) mobileLoggedOut.style.display = 'block';
  if (mobileLoggedIn)  mobileLoggedIn.style.display = 'none';
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
  containerEl.innerHTML = `
    <div class="empty-state" style="padding: 80px 24px;">
      <div class="empty-state-icon">🔒</div>
      <h3>Access Restricted</h3>
      <p>This page requires <strong>${requiredRole}</strong> access.<br>
         If you believe this is an error, please <a href="/pages/contact.html">contact PNEC staff</a>.</p>
      <a href="/" class="btn btn-secondary" style="margin-top:24px">Return to Home</a>
    </div>`;
}
