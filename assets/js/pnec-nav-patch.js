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

    // Items we MUST preserve. Two cases:
    //   (1) pnec-base layout — explicit IDs poway-auth-* already exist;
    //       auth-ui.js toggles visibility based on session state.
    //   (2) WP-clone layout — uses class="menu-item-login" with no ID
    //       and a static Login link. auth-ui.js can't find it. v3.20:
    //       we now stamp the missing IDs onto those WP-clone items so
    //       auth-ui can manage them on marketing pages too.
    var keepIds = {
      'poway-auth-display-item': true,
      'poway-auth-display-item-mobile': true,
      'poway-auth-logout-item': true,
      'poway-auth-logout-item-mobile': true,
      'poway-auth-login-item': true,
      'poway-auth-login-item-mobile': true,
    };

    function isAuthLi(li) {
      if (!li) return false;
      if (li.id && keepIds[li.id]) return true;
      // WP-clone Login entry — has class "menu-item-login" but no ID
      if (li.classList && li.classList.contains('menu-item-login')) return true;
      // Catch any anchor pointing to register/login as a last-resort
      // backstop. (Doesn't fire for ordinary nav links because they
      // never href to register.html.)
      var a = li.querySelector && li.querySelector('a[href]');
      if (a) {
        var href = (a.getAttribute('href') || '').toLowerCase();
        if (href.indexOf('register.html') !== -1 || href.indexOf('#login') !== -1) return true;
        if (a.id === 'poway-auth-display-link' || a.id === 'poway-auth-display-link-mobile') return true;
      }
      return false;
    }

    // v3.20: stamp the auth-ui-expected IDs onto WP-clone Login/Profile
    // items so the session-aware swap works on marketing pages too. We
    // only do this if the ID isn't already set — leaves pnec-base pages
    // alone. The "-mobile" variant goes onto the mobile dropdown <ul>
    // (detected by tabindex="-1" sample) so auth-ui can target it.
    function bridgeAuthIds(li) {
      if (!li || li.id) return;                // pnec-base already has an ID
      if (!li.classList || !li.classList.contains('menu-item-login')) return;
      li.id = useTabindexMinus1 ? 'poway-auth-login-item-mobile' : 'poway-auth-login-item';
    }

    var home = ul.querySelector('li.pnec-nav-home') || ul.querySelector('li.menu-item-home');

    // First pass: identify items to keep (home + auth) and stamp IDs
    // onto WP-clone auth items so auth-ui can find them later.
    var preservedAuth = [];
    Array.prototype.forEach.call(ul.children, function (li) {
      if (isAuthLi(li)) {
        bridgeAuthIds(li);
        preservedAuth.push(li);
      }
    });

    // Second pass: remove everything that ISN'T home/auth/already-managed.
    Array.prototype.slice.call(ul.children).forEach(function (li) {
      if (li === home) return;
      if (isAuthLi(li)) return;
      ul.removeChild(li);
    });

    // Build the new sequence and insert.
    var frag = document.createDocumentFragment();
    items.forEach(function (it) {
      frag.appendChild(buildItem(it, { tabindex: useTabindexMinus1 }));
    });

    // Insert before the first auth item so order is:
    //   Home → managed items → auth (profile / login / logout)
    var firstAuth = preservedAuth[0] || null;
    var refNode = home ? home.nextSibling : ul.firstChild;
    if (firstAuth) {
      ul.insertBefore(frag, firstAuth);
    } else if (refNode) {
      ul.insertBefore(frag, refNode);
    } else {
      ul.appendChild(frag);
    }

    // v3.20: ask auth-ui to refresh its hooks now that we've stamped
    // new IDs onto the WP-clone Login button. The event is no-op when
    // auth-ui hasn't loaded yet — it picks up the IDs on its normal
    // init pass.
    if (preservedAuth.length) {
      try {
        window.dispatchEvent(new CustomEvent('pnec:nav-patched'));
      } catch (_e) { /* IE fallback not needed in 2026 */ }
    }

    ul.setAttribute('data-pnec-nav-applied', '1');
  }

  function patchAll(items) {
    // Match Elementor's class and the explicit pnec-header-nav class so
    // we cover every nav variant the WP clone emits AND the data-driven
    // header on pnec-base pages.
    var lists = document.querySelectorAll(
      'ul.elementor-nav-menu, .pnec-header-nav ul'
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

  function renderAuthChip() {
    var user = readCachedUser();
    var lists = document.querySelectorAll(
      'ul.elementor-nav-menu, .pnec-header-nav ul'
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

      // Hide any static auth-related <li>s that came from the original
      // page markup. They'd otherwise appear alongside our chip and
      // confuse the user. We pick them up via the same heuristics that
      // isAuthLi uses (class menu-item-login, id="poway-auth-...",
      // anchor to register.html / #login). We mark them with our hide
      // attribute instead of removing — so a future page-level script
      // can still find them if it needs to.
      Array.prototype.forEach.call(ul.children, function (li) {
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
        if (isAuth) {
          // !important so auth-ui's later display='list-item' can't
          // un-hide it (we want our own chip to be the only one).
          li.style.setProperty('display', 'none', 'important');
          li.setAttribute('data-pnec-auth-hidden', '1');
        }
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
