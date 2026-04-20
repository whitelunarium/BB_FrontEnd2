// assets/js/pages/navbar.js
// Responsibility: Navbar orchestrator — initializes auth state display, mobile menu,
//                 user menu dropdown on every page load.

(function initNavbar() {
  window.PNEC_SITE_BASE = window.location.pathname.startsWith('/Beasts_FrontEnd') ? '/Beasts_FrontEnd' : '';
  loadAuthState();
  bindHamburger();
  bindUserMenuToggle();
  bindLogoutButtons();
  markDuplicateNavHidden();
})();

// Marks Elementor mobile nav as aria-hidden when it is visually closed,
// preventing screen readers from announcing duplicate navigation links.
function markDuplicateNavHidden() {
  const dropdownNav = document.querySelector('.elementor-nav-menu--dropdown');
  if (dropdownNav && !dropdownNav.hasAttribute('aria-hidden')) {
    dropdownNav.setAttribute('aria-hidden', 'true');
  }
}

/**
 * Purpose: Load the current auth state and render the appropriate navbar.
 * @returns {void}
 * Algorithm:
 * 1. Fetch current user from API
 * 2. If user exists: render logged-in navbar
 * 3. If not: render logged-out navbar
 * 4. Cache user in localStorage for other pages to read
 */
function loadAuthState() {
  const cachedUser = readCachedNavbarUser();

  if (cachedUser) {
    renderNavbarLoggedIn(cachedUser);
    if (typeof renderPowayAuthHeader === 'function') renderPowayAuthHeader(cachedUser);
  }

  fetchCurrentUser()
    .then(user => {
      if (user) {
        localStorage.setItem('pnec_user', JSON.stringify(user));
        sessionStorage.removeItem('pnec_user');
        renderNavbarLoggedIn(user);
        if (typeof renderPowayAuthHeader === 'function') renderPowayAuthHeader(user);
      } else if (!cachedUser) {
        // Only show logged-out state if there's also no cached user.
        // If there IS a cached user but the server returned null (e.g. session
        // cookie expired), keep showing the logged-in navbar — explicit logout
        // is the only action that should clear the cache and flip to logged-out.
        renderNavbarLoggedOut();
        if (typeof renderPowayAuthHeader === 'function') renderPowayAuthHeader(null);
      }
    })
    .catch(() => {
      if (!cachedUser) {
        renderNavbarLoggedOut();
        if (typeof renderPowayAuthHeader === 'function') renderPowayAuthHeader(null);
      }
    });
}

function readCachedNavbarUser() {
  try {
    const cachedUser = localStorage.getItem('pnec_user') || sessionStorage.getItem('pnec_user');
    return cachedUser ? JSON.parse(cachedUser) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Purpose: Bind open/close events for the mobile hamburger menu.
 * @returns {void}
 * Algorithm:
 * 1. Find hamburger button, drawer, overlay, close button
 * 2. Bind click on hamburger to open drawer
 * 3. Bind click on overlay and close button to close drawer
 */
function bindHamburger() {
  const hamburgerBtn  = document.getElementById('hamburger-btn');
  const mobileNav     = document.getElementById('mobile-nav');
  const overlay       = document.getElementById('mobile-nav-overlay');
  const closeBtn      = document.getElementById('mobile-nav-close');

  if (!hamburgerBtn || !mobileNav) return;

  hamburgerBtn.addEventListener('click', () => openMobileNav(hamburgerBtn, mobileNav, overlay));
  if (closeBtn)  closeBtn.addEventListener('click',  () => closeMobileNav(hamburgerBtn, mobileNav, overlay));
  if (overlay)   overlay.addEventListener('click',   () => closeMobileNav(hamburgerBtn, mobileNav, overlay));
}

/**
 * Purpose: Open the mobile nav drawer and update ARIA state.
 * @param {HTMLElement} btnEl - Hamburger button
 * @param {HTMLElement} navEl - Mobile nav drawer
 * @param {HTMLElement} overlayEl - Overlay backdrop
 * @returns {void}
 */
function openMobileNav(btnEl, navEl, overlayEl) {
  btnEl.classList.add('open');
  navEl.classList.add('open');
  btnEl.setAttribute('aria-expanded', 'true');
  navEl.setAttribute('aria-hidden', 'false');
  if (overlayEl) overlayEl.classList.add('open');
  document.body.style.overflow = 'hidden';
}

/**
 * Purpose: Close the mobile nav drawer and restore ARIA state.
 * @param {HTMLElement} btnEl - Hamburger button
 * @param {HTMLElement} navEl - Mobile nav drawer
 * @param {HTMLElement} overlayEl - Overlay backdrop
 * @returns {void}
 */
function closeMobileNav(btnEl, navEl, overlayEl) {
  btnEl.classList.remove('open');
  navEl.classList.remove('open');
  btnEl.setAttribute('aria-expanded', 'false');
  navEl.setAttribute('aria-hidden', 'true');
  if (overlayEl) overlayEl.classList.remove('open');
  document.body.style.overflow = '';
}

/**
 * Purpose: Toggle the desktop user menu dropdown on trigger click.
 * @returns {void}
 * Algorithm:
 * 1. Bind click on user-menu-trigger to toggle dropdown open/closed
 * 2. Close dropdown when clicking outside
 */
function bindUserMenuToggle() {
  const trigger  = document.getElementById('user-menu-trigger');
  const dropdown = document.getElementById('user-menu-dropdown');
  if (!trigger || !dropdown) return;

  trigger.addEventListener('click', event => {
    event.stopPropagation();
    const isOpen = dropdown.classList.toggle('open');
    trigger.setAttribute('aria-expanded', isOpen.toString());
  });

  document.addEventListener('click', () => {
    dropdown.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');
  });
}

/**
 * Purpose: Bind logout button click events on both desktop and mobile navbars.
 * @returns {void}
 * Algorithm:
 * 1. Find both logout buttons
 * 2. On click: call logoutUser(), then clear cached user and redirect home
 */
function bindLogoutButtons() {
  ['navbar-logout-btn', 'mobile-logout-btn'].forEach(id => {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener('click', handleLogout);
  });
}

/**
 * Purpose: Log out the current user and redirect to the homepage.
 * @param {Event} event - Click event
 * @returns {void}
 */
function handleLogout(event) {
  event.preventDefault();
  logoutUser()
    .catch(() => {/* Ignore server errors — clear session regardless */})
    .finally(() => {
      localStorage.removeItem('pnec_user');
      sessionStorage.removeItem('pnec_user');
      window.location.href = `${window.PNEC_SITE_BASE}/`;
    });
}
