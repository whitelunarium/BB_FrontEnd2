// assets/js/admin/edit-this-page.js
// Renders a floating "✏ Edit this page" button on every public page —
// visible only to signed-in admins. Click → opens the live editor v2
// pre-loaded with the current page's slug.
//
// Loaded from _layouts/pnec-base.html alongside hydrate.js.
//
// Detection rules:
//   • Skips itself on the editor page (would be recursive).
//   • Skips on /pages/register.html (login page) where editing is meaningless.
//   • Reads the page slug from <body data-cms-page="..."> first; falls back
//     to deriving from window.location.pathname.
//
// Auth: reads `localStorage.pnec_user` (cached by auth-api.js). If the cache
// is missing or the role is not 'admin', the button never renders. We do NOT
// hit the network here — this is a pure client-side affordance.

(function () {
  'use strict';

  // Bail early on the editor itself
  const path = (window.location.pathname || '').toLowerCase();
  if (path.indexOf('/admin-editor') !== -1) return;
  if (path.indexOf('/pages/register') !== -1) return;
  // Don't run on admin.html either — already has prominent buttons
  if (path.endsWith('/pages/admin.html') || path.endsWith('/admin.html')) return;
  // Don't run inside the editor's iframe (?preview=1) — would render a
  // redundant button that loops the iframe back to the editor when clicked.
  // Same for any window already framed inside another (the editor uses an
  // iframe, so window !== window.top).
  try {
    if (new URLSearchParams(window.location.search).get('preview') === '1') return;
    if (window.top !== window.self) return;
  } catch (_e) { /* cross-origin frames throw; safe to continue */ }

  function isAdmin() {
    try {
      const raw = localStorage.getItem('pnec_user') || sessionStorage.getItem('pnec_user');
      if (!raw) return false;
      const user = JSON.parse(raw);
      return user && user.role === 'admin';
    } catch (_e) { return false; }
  }

  function deriveSlug() {
    // Preferred: explicit attribute on <body data-cms-page="...">
    const body = document.body;
    if (body && body.dataset && body.dataset.cmsPage) return body.dataset.cmsPage;
    // Fallback: derive from URL path
    if (path === '/' || path.endsWith('/index.html') || path.endsWith('/index')) return 'home';
    // /pages/foo.html → "foo", "/pages/find-your-neighborhood.html" → "find-your-neighborhood"
    const m = path.match(/\/pages\/([^/.]+)/);
    if (m) return m[1];
    return null;
  }

  function buildButton(slug) {
    const btn = document.createElement('a');
    btn.id = 'pnec-edit-this-page';
    btn.href = '/pages/admin-editor.html?page=' + encodeURIComponent(slug || 'home');
    // v2.41: open the editor in a new tab so the public site stays put.
    // Avoids the duplicated-navbar look the user pointed out and lets admins
    // keep both windows side-by-side.
    btn.target = '_blank';
    btn.rel    = 'noopener';
    btn.title = 'Open this page in the live theme editor (opens in a new tab — admin-only)';
    btn.setAttribute('aria-label', 'Edit this page in a new tab');
    btn.innerHTML =
      '<span class="pnec-edit-icon" aria-hidden="true" style="font-size:1.25em;line-height:1">✏️</span>' +
      '<span class="pnec-edit-label">Edit this page</span>' +
      '<span class="pnec-edit-shortcut" aria-hidden="true" style="font-size:0.72em;opacity:0.78;padding:2px 6px;border:1px solid rgba(255,253,246,0.45);border-radius:5px;margin-left:2px;letter-spacing:0.05em">E</span>' +
      '<span class="pnec-edit-newtab" aria-hidden="true" style="font-size:1.05em">↗</span>';
    // v3.20: moved to bottom-LEFT so it never overlaps the chatbot FAB,
    // and sized up so an admin can spot it instantly. Adds a small "E"
    // pill to surface the keyboard shortcut.
    btn.style.cssText = [
      'position:fixed',
      'left:20px',
      'bottom:24px',
      'z-index:9998',
      'display:inline-flex',
      'align-items:center',
      'gap:10px',
      'padding:14px 22px',
      'min-height:52px',
      'background:linear-gradient(135deg, #145a32 0%, #1e8449 100%)',
      'color:#fffdf6',
      'font:800 1.02rem "DM Sans", ui-sans-serif, system-ui, -apple-system, sans-serif',
      'letter-spacing:.01em',
      'text-decoration:none',
      'border-radius:14px',
      'box-shadow:0 10px 28px rgba(20,90,50,0.42), 0 0 0 1px rgba(255,253,246,0.18) inset, 0 0 0 4px rgba(20,90,50,0.10)',
      'cursor:pointer',
      'transition:transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease',
      'opacity:1',
      'animation:pnec-edit-attention 2.4s ease-out 1.6s 1',
    ].join(';');

    // One-time attention pulse keyframes — injected once.
    if (!document.getElementById('pnec-edit-anim-style')) {
      const style = document.createElement('style');
      style.id = 'pnec-edit-anim-style';
      style.textContent = '@keyframes pnec-edit-attention {' +
        '  0%   { transform: scale(1);    box-shadow: 0 10px 28px rgba(20,90,50,0.42), 0 0 0 1px rgba(255,253,246,0.18) inset, 0 0 0 4px rgba(20,90,50,0.10); }' +
        '  35%  { transform: scale(1.06); box-shadow: 0 14px 38px rgba(20,90,50,0.55), 0 0 0 1px rgba(255,253,246,0.30) inset, 0 0 0 10px rgba(20,90,50,0.20); }' +
        '  100% { transform: scale(1);    box-shadow: 0 10px 28px rgba(20,90,50,0.42), 0 0 0 1px rgba(255,253,246,0.18) inset, 0 0 0 4px rgba(20,90,50,0.10); }' +
        '}' +
        '@media (prefers-reduced-motion: reduce) {' +
        '  #pnec-edit-this-page { animation: none !important; }' +
        '}';
      document.head.appendChild(style);
    }

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'translateY(-2px) scale(1.03)';
      btn.style.boxShadow = '0 14px 36px rgba(20,90,50,0.55), 0 0 0 1px rgba(255,253,246,0.24) inset, 0 0 0 6px rgba(20,90,50,0.14)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translateY(0) scale(1)';
      btn.style.boxShadow = '0 10px 28px rgba(20,90,50,0.42), 0 0 0 1px rgba(255,253,246,0.18) inset, 0 0 0 4px rgba(20,90,50,0.10)';
    });
    return btn;
  }

  function maybeRender() {
    if (!isAdmin()) return;
    if (document.getElementById('pnec-edit-this-page')) return; // idempotent
    const slug = deriveSlug();
    if (slug == null) return; // unknown page, no editor target
    const btn = buildButton(slug);
    document.body.appendChild(btn);

    // Add a `?` keyboard hint: pressing E (when not focused in input) opens too
    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.target && e.target.isContentEditable) return;
      if (e.key === 'e' || e.key === 'E') {
        // Only fire if no modifier (so ⌘E still works as default browser shortcut)
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          // Match the click behavior — open the editor in a new tab.
          window.open(btn.href, '_blank', 'noopener');
        }
      }
    });
  }

  // The pnec_user cache may be set by auth-ui.js after this script runs, so retry.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(maybeRender, 50));
  } else {
    setTimeout(maybeRender, 50);
  }
  // Re-check 1.5s later in case auth-ui populated the cache after a network call
  setTimeout(maybeRender, 1500);

  // Also expose an explicit "auth-ready" hook so auth-ui.js can trigger us
  window.addEventListener('pnec:auth-ready', maybeRender);
})();
