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
    btn.href = '/pages/admin-editor-v2.html?page=' + encodeURIComponent(slug || 'home');
    // v2.41: open the editor in a new tab so the public site stays put.
    // Avoids the duplicated-navbar look the user pointed out and lets admins
    // keep both windows side-by-side.
    btn.target = '_blank';
    btn.rel    = 'noopener';
    btn.title = 'Open this page in the live theme editor (opens in a new tab — admin-only)';
    btn.setAttribute('aria-label', 'Edit this page in a new tab');
    btn.innerHTML = '<span class="pnec-edit-icon">✏️</span><span class="pnec-edit-label">Edit this page</span><span class="pnec-edit-newtab" aria-hidden="true">↗</span>';
    btn.style.cssText = [
      'position:fixed',
      'right:20px',
      'bottom:20px',
      // Sit above the chatbot widget which lives at bottom:24px (typical 56px button)
      // Using right offset keeps both visible side-by-side on most viewports.
      'z-index:9998',
      'display:inline-flex',
      'align-items:center',
      'gap:8px',
      'padding:11px 18px',
      'background:linear-gradient(135deg, #5b8cff 0%, #a855f7 50%, #ec4899 100%)',
      'color:#fff',
      'font:600 0.88rem ui-sans-serif, system-ui, -apple-system, sans-serif',
      'letter-spacing:.01em',
      'text-decoration:none',
      'border-radius:999px',
      'box-shadow:0 8px 24px rgba(91,140,255,0.35), 0 0 0 1px rgba(255,255,255,0.10) inset',
      'cursor:pointer',
      'transition:transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease',
      'opacity:0.92',
      'backdrop-filter:blur(4px)',
    ].join(';');
    btn.addEventListener('mouseenter', () => {
      btn.style.transform   = 'translateY(-2px) scale(1.02)';
      btn.style.opacity     = '1';
      btn.style.boxShadow   = '0 12px 32px rgba(91,140,255,0.50), 0 0 0 1px rgba(255,255,255,0.16) inset';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform   = 'translateY(0) scale(1)';
      btn.style.opacity     = '0.92';
      btn.style.boxShadow   = '0 8px 24px rgba(91,140,255,0.35), 0 0 0 1px rgba(255,255,255,0.10) inset';
    });

    // Position above the chatbot if it exists. The actual class is
    // `.chatbot-trigger` (kept the older names as fallback for safety in
    // case the include changes). Computed from the actual chatbot's bottom
    // offset + height so the gap is correct on all screen sizes.
    setTimeout(() => {
      const chatbot = document.querySelector(
        '.chatbot-trigger, .pnec-chatbot-fab, .chatbot-toggle, [data-pnec-chatbot], #chatbot-trigger-btn'
      );
      if (chatbot) {
        const r = chatbot.getBoundingClientRect();
        // Use the chatbot's height + 16px gap, fallback to 88px if rect is empty
        const chatbotHeight = r.height || 56;
        btn.style.bottom = (chatbotHeight + 28) + 'px';
      }
    }, 600);
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
