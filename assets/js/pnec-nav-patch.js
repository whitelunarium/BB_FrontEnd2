/**
 * pnec-nav-patch.js  (v3.20, May 2026)
 *
 * Rewrites the WP-cloned Elementor nav on legacy marketing pages
 * (about.html, programs-and-services.html, etc.) to reflect the items
 * the admin manages in /pages/admin-nav.html.
 *
 * Why this exists
 *   Those marketing pages are raw HTML cloned from the original WP
 *   site — no Jekyll layout, no `{% include %}` directives. So when the
 *   admin nav data file (`_data/pnec_nav.yml`) changes, those pages
 *   would still show the old static nav. This script fetches the
 *   Jekyll-emitted JSON view of the nav and patches every
 *   `<ul class="elementor-nav-menu">` it finds, preserving the home
 *   icon and the auth-gated profile / login items.
 *
 * Behavior
 *   - Runs on DOMContentLoaded so the swap happens before paint stable.
 *   - Fetches /assets/data/pnec-nav.json relative to the page (so the
 *     same script works under any baseurl).
 *   - If the fetch fails (offline, 404), the static fallback nav stays
 *     in place — failure is invisible.
 *   - Idempotent: running it twice doesn't add duplicate items.
 *   - Marks the current page with .elementor-item-active using each
 *     item's `match` value (comma-separated path substrings), matching
 *     the Liquid side's rules.
 */
(function () {
  'use strict';

  // ─── Resolve the JSON URL using a same-origin absolute path ──────
  // Going through location.origin lets the script work whether the
  // marketing page lives at /pages/about.html or /something-else/.
  function navJsonUrl() {
    try {
      return new URL('/assets/data/pnec-nav.json', location.origin).toString();
    } catch (_) {
      return '/assets/data/pnec-nav.json';
    }
  }

  // ─── Build one <li> for an item, matching Elementor's class shape ─
  function buildItem(item, opts) {
    var tabindex = opts && opts.tabindex ? ' tabindex="-1"' : '';
    var isActive = computeActive(item, location.pathname);
    var activeCls = isActive ? ' elementor-item-active' : '';
    var li = document.createElement('li');
    if (item.external) {
      li.className = 'menu-item menu-item-type-custom';
      li.innerHTML = '<a href="' + escAttr(item.url) + '" target="_blank" rel="noopener" class="elementor-item' + activeCls + '"' + tabindex + '>' + escHtml(item.title) + '</a>';
    } else {
      li.className = 'menu-item menu-item-type-post_type menu-item-object-page';
      var href = absUrl(item.url);
      li.innerHTML = '<a href="' + escAttr(href) + '" class="elementor-item' + activeCls + '"' + tabindex + '>' + escHtml(item.title) + '</a>';
    }
    li.setAttribute('data-pnec-nav-managed', '1');
    return li;
  }

  function absUrl(u) {
    if (!u) return '#';
    if (/^https?:\/\//.test(u)) return u;
    if (u[0] === '/') return u;           // already site-rooted
    return '/' + u.replace(/^\.?\/+/, ''); // normalize relative→rooted
  }

  function computeActive(item, currentPath) {
    var keys = [];
    if (item.match && typeof item.match === 'string' && item.match !== '') {
      keys = item.match.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    } else if (item.url) {
      keys = [item.url.replace(/^https?:\/\/[^/]+/, '')];
    }
    return keys.some(function (k) { return k && currentPath.indexOf(k) !== -1; });
  }

  function escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  // ─── Patch one <ul> ──────────────────────────────────────────────
  // Strategy:
  //   1. Remove every <li> EXCEPT the home icon and the auth-gated
  //      profile / logout / login items (those are special-cased by
  //      ID elsewhere on the page).
  //   2. Insert the new admin-managed items after the home icon, or
  //      at the start if there isn't one.
  //   3. Determine tabindex by looking at any existing managed link
  //      (mobile dropdowns use tabindex="-1"; desktop top-nav doesn't).
  function patchOneList(ul, items) {
    if (!ul || !items || !items.length) return;
    if (ul.getAttribute('data-pnec-nav-applied') === '1') {
      // Already patched once in this page lifetime — clear our items so
      // the second run produces the same result (idempotent).
      Array.prototype.forEach.call(
        ul.querySelectorAll('li[data-pnec-nav-managed="1"]'),
        function (n) { n.parentNode.removeChild(n); }
      );
    }

    // Detect tabindex preference from an existing managed link (mobile)
    var sample = ul.querySelector('a.elementor-item');
    var useTabindexMinus1 = !!(sample && sample.getAttribute('tabindex') === '-1');

    // v3.24: this patcher no longer stamps poway-auth-* IDs onto static
    // markup. We render our OWN auth chip in renderAuthChip() and hide
    // anything pre-existing via a stylesheet rule (see ensureHideStyle).
    // Stamping caused a "double Login" bug because auth-ui.js writes
    // `loginItem.style.display = 'list-item'` which silently overrode
    // our inline !important and un-hid the static <li>.

    function looksLikeAuthLi(li) {
      if (!li) return false;
      if (li.id && /^poway-auth-(display|login|register|logout)-item/.test(li.id)) return true;
      if (li.classList && (li.classList.contains('menu-item-login') ||
                            li.classList.contains('poway-auth-display'))) return true;
      var a = li.querySelector && li.querySelector('a[href]');
      if (a) {
        var href = (a.getAttribute('href') || '').toLowerCase();
        if (href.indexOf('register.html') !== -1 || href.indexOf('#login') !== -1) return true;
        if (a.id === 'poway-auth-display-link' || a.id === 'poway-auth-display-link-mobile') return true;
      }
      return false;
    }

    var home = ul.querySelector('li.pnec-nav-home') || ul.querySelector('li.menu-item-home');

    // v3.24: REMOVE all non-home <li>s outright. Including auth ones.
    // Our chip (renderAuthChip) is the single source of truth for the
    // Login / Profile entry — no more keeping a hidden static <li>
    // around that auth-ui.js can re-show via style.display writes.
    //
    // Auth-ui.js's renderPowayAuthHeader does an early-return when
    // none of poway-auth-display-item/login-item/register-item exist,
    // so deleting them is safe — the function just no-ops, and our
    // chip handles the visible role.
    Array.prototype.slice.call(ul.children).forEach(function (li) {
      if (li === home) return;
      ul.removeChild(li);
    });

    // Insert the data-driven managed items after home.
    var frag = document.createDocumentFragment();
    items.forEach(function (it) {
      frag.appendChild(buildItem(it, { tabindex: useTabindexMinus1 }));
    });
    var refNode = home ? home.nextSibling : ul.firstChild;
    if (refNode) {
      ul.insertBefore(frag, refNode);
    } else {
      ul.appendChild(frag);
    }

    ul.setAttribute('data-pnec-nav-applied', '1');
  }

  function patchAll(items) {
    // v3.26: scope to ULs inside a <header> element so the FOOTER's
    // Quick Links UL (also class="elementor-nav-menu") is left alone.
    // Earlier versions used the bare `ul.elementor-nav-menu` selector
    // and ended up stripping the footer Quick Links items and
    // replacing them with the top-nav items — looked empty on mobile
    // because the cream-styled forest-green items rendered into the
    // dark-styled footer column. Selector list also keeps the
    // pnec-header-nav fallback for the data-driven pnec-base header.
    var lists = document.querySelectorAll(
      'header ul.elementor-nav-menu, .pnec-header-nav ul'
    );
    Array.prototype.forEach.call(lists, function (ul) { patchOneList(ul, items); });
    // v3.23: always render our own auth chip (Login / Profile) as the
    // FINAL nav item. Sidesteps the race between auth-ui's first call
    // and the patcher's DOM mutation that caused the Login button to
    // disappear on marketing pages after our refactor.
    renderAuthChip();
  }

  // ──────────────────────────────────────────────────────────────────
  // v3.23: read the cached PNEC user and append a Login OR Profile <li>
  // to every nav UL. This is independent of auth-ui.js's flow — we
  // build the <li> ourselves and tag it with `data-pnec-auth-chip="1"`
  // so we can replace it cleanly on every re-render.
  // ──────────────────────────────────────────────────────────────────
  function readCachedUser() {
    try {
      var raw = localStorage.getItem('pnec_user') || sessionStorage.getItem('pnec_user');
      return raw ? JSON.parse(raw) : null;
    } catch (_e) { return null; }
  }

  // Injects a one-time stylesheet rule that hides static auth items
  // marked with .pnec-auth-original. We use a stylesheet rule with
  // !important so it overrides any later inline `style.display = X`
  // writes from auth-ui.js (those use empty priority, which loses to
  // a stylesheet !important).
  function ensureHideStyle() {
    if (document.getElementById('pnec-nav-patch-style')) return;
    var s = document.createElement('style');
    s.id = 'pnec-nav-patch-style';
    s.textContent = 'li.pnec-auth-original{display:none !important}';
    (document.head || document.documentElement).appendChild(s);
  }

  function renderAuthChip() {
    ensureHideStyle();
    var user = readCachedUser();
    // v3.26: same header-scoped selector as patchAll — keeps the auth
    // chip out of the footer's Quick Links UL.
    var lists = document.querySelectorAll(
      'header ul.elementor-nav-menu, .pnec-header-nav ul'
    );
    Array.prototype.forEach.call(lists, function (ul) {
      // Detect mobile dropdown (tabindex=-1 on links) for tabindex behavior
      var sample = ul.querySelector('a.elementor-item');
      var useTabindexMinus1 = !!(sample && sample.getAttribute('tabindex') === '-1');

      // Remove any previously-rendered chip so re-renders are clean
      Array.prototype.forEach.call(
        ul.querySelectorAll('li[data-pnec-auth-chip="1"]'),
        function (n) { n.parentNode.removeChild(n); }
      );

      // v3.24: any leftover static auth <li>s (rare, but a defense
      // against pages that don't run patchOneList — e.g. if the data
      // fetch failed) get REMOVED outright. No more "hide and pray
      // auth-ui doesn't un-hide it" dance.
      Array.prototype.slice.call(ul.children).forEach(function (li) {
        if (li.getAttribute && li.getAttribute('data-pnec-auth-chip') === '1') return;
        var isAuth = false;
        if (li.id && /^poway-auth-(display|login|register|logout)-item/.test(li.id)) isAuth = true;
        if (li.classList && (li.classList.contains('menu-item-login') ||
                              li.classList.contains('poway-auth-display'))) isAuth = true;
        if (!isAuth) {
          var a = li.querySelector && li.querySelector('a[href]');
          if (a) {
            var href = (a.getAttribute('href') || '').toLowerCase();
            if (href.indexOf('register.html') !== -1 || href.indexOf('#login') !== -1) isAuth = true;
          }
        }
        if (isAuth) ul.removeChild(li);
      });

      // Build our chip. For a signed-in user it's "First Name" linking
      // to /pages/profile.html. For a signed-out user it's "Login"
      // linking to /pages/register.html#login.
      var li = document.createElement('li');
      li.setAttribute('data-pnec-auth-chip', '1');
      li.className = 'menu-item menu-item-type-post_type menu-item-object-page';

      var a = document.createElement('a');
      a.className = 'elementor-item';
      if (useTabindexMinus1) a.setAttribute('tabindex', '-1');

      if (user) {
        var name = (user.display_name || user.first_name || user.name || user.username || user.email || 'My profile').trim();
        // First name only to keep the nav compact
        var first = String(name).split(/[\s@]/)[0] || 'Profile';
        a.href = absUrl('/pages/profile.html');
        a.textContent = first;
        a.setAttribute('aria-label', 'My profile — ' + name);
      } else {
        a.href = absUrl('/pages/register.html#login');
        a.textContent = 'Login';
      }
      li.appendChild(a);
      ul.appendChild(li);
    });
  }

  // Listen for sign-in / sign-out events fired by auth-ui so the chip
  // updates without a page reload.
  window.addEventListener('pnec:auth-ready', renderAuthChip);
  window.addEventListener('pnec:auth-changed', renderAuthChip);
  // storage event for cross-tab sync (sign in/out in another tab)
  window.addEventListener('storage', function (e) {
    if (e.key === 'pnec_user') renderAuthChip();
  });

  function run() {
    fetch(navJsonUrl(), { credentials: 'omit', cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        if (j && Array.isArray(j.items) && j.items.length) patchAll(j.items);
      })
      .catch(function () {
        // Silent failure — the static fallback nav stays in place.
        // Don't log; marketing pages already have noisy WP consoles.
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
