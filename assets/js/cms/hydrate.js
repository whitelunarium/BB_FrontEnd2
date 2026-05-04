// assets/js/cms/hydrate.js
// Responsibility: Hydrate public Jekyll pages with CMS-backed content.
//
// v1 path: site-config + page overrides → swap text/image/HTML into elements
//          tagged with data-cms-config / data-cms-override.
// v2 path: page template (sections + blocks) → render rendered HTML strings
//          into elements tagged with data-cms-section-host.
//
// In ?preview=1 mode, both paths subscribe to postMessage updates from the
// editor parent and apply them live. v2 also dispatches CustomEvents on
// document mirroring Shopify's grammar (`cms:section:load|unload|select|reorder`,
// `cms:block:select|reorder`, `cms:inspector:activate|deactivate`) so section
// scripts can re-init / cleanup cleanly.
//
// Loads as a classic <script> tag. Depends on cms-api.js being loaded first.

(function () {
  'use strict';

  // ── v1: applyValue dispatch ──────────────────────────────────────────────

  function applyValue(el, value) {
    if (!el) return;
    if (el.tagName === 'IMG') {
      // BUG FIX: many cloned WP images have a srcset attribute. Setting only
      // `src` would be silently overridden by the browser preferring srcset,
      // so the swapped image wouldn't visibly appear. Clear srcset + sizes
      // when an admin overrides the URL so the new src is what's rendered.
      // (Guards for plain object stubs in node tests where DOM API is absent.)
      if (typeof el.removeAttribute === 'function') {
        el.removeAttribute('srcset');
        el.removeAttribute('sizes');
      }
      el.src = value;
      if (typeof el.hasAttribute === 'function') {
        // Some lazy-load wrappers store the "real" URL on data-src/data-lazy-src
        // and swap it into src on intersection. Mirror our value into those so
        // the lazy-load doesn't restore the original after we set src.
        if (el.hasAttribute('data-src'))      el.setAttribute('data-src', value);
        if (el.hasAttribute('data-lazy-src')) el.setAttribute('data-lazy-src', value);
      }
      // Same idea for <picture> ancestors with inner <source srcset>.
      const picture = (el.parentElement && el.parentElement.tagName === 'PICTURE')
        ? el.parentElement : null;
      if (picture && typeof picture.querySelectorAll === 'function') {
        picture.querySelectorAll('source').forEach(s => {
          if (typeof s.removeAttribute === 'function') s.removeAttribute('srcset');
        });
      }
      return;
    }
    if (el.dataset && el.dataset.cmsHtml === 'true') {
      el.innerHTML = value;
      return;
    }
    el.textContent = value;
  }

  // ── v1: parse postMessage from editor ────────────────────────────────────

  function parsePreviewMessage(event, expectedOrigin) {
    if (!event || event.origin !== expectedOrigin) return null;
    const d = event.data;
    if (!d || typeof d !== 'object') return null;
    if (d.type !== 'cms-update') return null;
    if (d.kind !== 'config' && d.kind !== 'override') return null;
    if (typeof d.key !== 'string') return null;
    return { kind: d.kind, key: d.key, value: d.value };
  }

  function applyThemeVars(config) {
    const root = document.documentElement;
    if (config.theme_primary_color) root.style.setProperty('--theme-primary', config.theme_primary_color);
    if (config.theme_accent_color)  root.style.setProperty('--theme-accent',  config.theme_accent_color);
  }

  function applyAll(config, overrides) {
    document.querySelectorAll('[data-cms-config]').forEach(el => {
      const v = config[el.dataset.cmsConfig];
      if (v != null) applyValue(el, v);
    });
    document.querySelectorAll('[data-cms-override]').forEach(el => {
      const v = overrides[el.dataset.cmsOverride];
      if (v != null) applyValue(el, v);
    });
    applyThemeVars(config);
  }

  // ── Universal auto-tagger ────────────────────────────────────────────────
  // Makes EVERY meaningful text element on the page editable, even if no
  // data-cms-config/data-cms-override marker was authored.
  //
  // Strategy: walk the DOM, find text-bearing elements (h1-h6, p, blockquote,
  // li, button, a, span when leaf), generate a stable element_id from their
  // path, tag them with `data-cms-override="auto__<id>"`, mark `.cms-editable`
  // for hover styling, and apply any previously-saved override value.
  //
  // Stable id generation:
  //   - tag name + index of element among same-tag siblings, walked up the
  //     ancestor chain. e.g. "main>div:0>h2:0".
  //   - SHA-ish hash of that path so it's URL-safe and short.
  //
  // Idempotent — running twice is a no-op. Handles dynamic re-renders by
  // re-walking on each call.
  const AUTO_TAG_PREFIX = 'auto__';
  const AUTO_TAG_SELECTOR = 'h1, h2, h3, h4, h5, h6, p, blockquote, li, button';
  // Don't auto-tag things inside these containers — they're either app
  // chrome (nav, footer, search, modals) or interactive widgets that
  // shouldn't be turned into editable text.
  const AUTO_TAG_EXCLUDE_ANCESTORS = [
    'nav', 'footer', 'form',
    '[data-cms-section-host]',          // CMS v2 hosts handle their own editing
    '[data-cms-section-id]',            // already inside a v2 section
    '[data-cms-no-edit]',               // explicit opt-out
    '#mobile-nav', '#mobile-nav-overlay',
    // Chatbot widget — the trigger button + the slide-out panel
    '.chatbot-trigger', '.chatbot-panel', '.chatbot-backdrop',
    '#chatbot-trigger-btn', '#chatbot-panel',
    '.pnec-chatbot-fab', '.chatbot-toggle', '[data-pnec-chatbot]',
    // Editor itself (defensive — editor isn't on a public page but just in case)
    '#v2-shell', '#v2-gate',
    // The floating "Edit this page" admin button (added by edit-this-page.js
    // after hydrate runs — this skip protects against any subsequent
    // autoTagAll re-runs from picking up its own UI).
    '#pnec-edit-this-page',
    // Risk widget / other floating UI
    '.risk-widget', '#risk-widget',
  ];

  function _stableElementHash(str) {
    // Tiny non-cryptographic hash → 8 hex chars. Good enough for unique
    // element identity within a single page.
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  function _elementPath(el) {
    // Walk up the ancestor chain, building "tag:index" segments. Stops at
    // <body>. Index = position-among-siblings-of-same-tag (0-based).
    const segments = [];
    let cur = el;
    while (cur && cur !== document.body && cur.parentElement) {
      const tag = cur.tagName.toLowerCase();
      const siblings = Array.from(cur.parentElement.children).filter(c => c.tagName === cur.tagName);
      const idx = siblings.indexOf(cur);
      segments.unshift(tag + ':' + idx);
      cur = cur.parentElement;
    }
    return segments.join('>');
  }

  function _shouldAutoTag(el) {
    if (!el || !el.tagName) return false;
    // Already tagged
    if (el.hasAttribute('data-cms-config'))   return false;
    if (el.hasAttribute('data-cms-override')) return false;
    // Inside an excluded ancestor
    for (const sel of AUTO_TAG_EXCLUDE_ANCESTORS) {
      if (el.closest(sel)) return false;
    }
    // Empty or whitespace-only
    const text = (el.textContent || '').trim();
    if (!text) return false;
    // Skip elements that contain block-level children (we want to tag the leaf)
    const hasBlockChildren = Array.from(el.children).some(c =>
      ['DIV','SECTION','ARTICLE','P','UL','OL','LI','H1','H2','H3','H4','H5','H6','BLOCKQUOTE','HEADER','FOOTER','NAV','MAIN','ASIDE','TABLE'].includes(c.tagName)
    );
    if (hasBlockChildren) return false;
    // Skip elements that contain interactive widgets we DEFINITELY don't want
    // to flatten (forms, embedded video). Links and basic formatting (a, strong,
    // em, b, i) are preserved by startInlineEdit's "html mode" path so we can
    // safely tag a <p> that contains them.
    const hasUnsafeInline = Array.from(el.children).some(c =>
      ['INPUT','SELECT','TEXTAREA','LABEL','SVG','VIDEO','AUDIO','IFRAME'].includes(c.tagName)
    );
    if (hasUnsafeInline) return false;
    // Skip absurdly long text (likely a wrapper, not a leaf)
    if (text.length > 800) return false;
    // Skip elements whose visible text is a single number (counters, dates)
    if (/^[\s\d.,:%$\-+]+$/.test(text) && text.length < 12) return false;
    return true;
  }

  function autoTagAll(slug, overrides) {
    if (!slug) return [];
    const tagged = [];
    document.querySelectorAll(AUTO_TAG_SELECTOR).forEach(el => {
      if (!_shouldAutoTag(el)) return;
      const path = _elementPath(el);
      const hash = _stableElementHash(slug + '|' + path + '|' + el.tagName);
      const key  = AUTO_TAG_PREFIX + el.tagName.toLowerCase() + '_' + hash;
      el.setAttribute('data-cms-override', key);
      el.classList.add('cms-editable');
      // Apply saved value if we have one for this generated key
      if (overrides && Object.prototype.hasOwnProperty.call(overrides, key)) {
        const value = overrides[key];
        // BUG FIX (v2.36): if the saved value looks like HTML (contains tags),
        // mark the element as HTML-rendered so applyValue uses innerHTML
        // instead of escaping it. Without this, an admin's saved <a href> text
        // would render as literal "<a href=...>" on every public visit until
        // the admin re-edits and we set data-cms-html via startInlineEdit.
        if (typeof value === 'string' && /<[a-z][\s\S]*>/i.test(value)) {
          el.setAttribute('data-cms-html', 'true');
        }
        applyValue(el, value);
      }
      tagged.push({ key, el });
    });
    autoTagAllImages(slug, overrides, tagged);
    return tagged;
  }

  // ── Image auto-tagger ────────────────────────────────────────────────────
  // Same idea as autoTagAll but for <img>: any image not already tagged and
  // not inside an excluded ancestor becomes hover-swappable. Click on the
  // image in admin preview opens the asset library; the picked URL is saved
  // through the same /api/overrides pipeline (applyValue knows to swap .src).
  function autoTagAllImages(slug, overrides, tagged) {
    if (!slug) return;
    document.querySelectorAll('img').forEach(img => {
      if (img.hasAttribute('data-cms-config'))   return;
      if (img.hasAttribute('data-cms-override')) return;
      // Same excluded ancestors as text auto-tag
      for (const sel of AUTO_TAG_EXCLUDE_ANCESTORS) {
        if (img.closest(sel)) return;
      }
      // Skip tiny images (icons, sprites, tracking pixels)
      const rect = img.getBoundingClientRect();
      if (rect.width < 32 || rect.height < 32) return;
      // Skip data: URIs (likely inline svg/icons embedded in CSS)
      const src = img.getAttribute('src') || '';
      if (src.startsWith('data:')) return;
      const path = _elementPath(img);
      const hash = _stableElementHash(slug + '|' + path + '|IMG');
      const key  = AUTO_TAG_PREFIX + 'img_' + hash;
      img.setAttribute('data-cms-override', key);
      img.classList.add('cms-editable');
      img.classList.add('cms-editable-image');
      if (overrides && Object.prototype.hasOwnProperty.call(overrides, key)) {
        applyValue(img, overrides[key]);
      }
      if (tagged) tagged.push({ key, el: img });
    });
  }

  // ── v2: shared API base ──────────────────────────────────────────────────

  function _apiBase() {
    if (window.PNEC_CMS_API_BASE) return window.PNEC_CMS_API_BASE;
    const host = window.location.hostname;
    return (host === 'localhost' || host === '127.0.0.1')
      ? 'http://127.0.0.1:8425'
      : 'https://beasts.opencodingsociety.com';
  }

  function _previewState() {
    return new URLSearchParams(window.location.search).get('preview') === '1'
      ? 'draft' : 'published';
  }

  function _previewToken() {
    return new URLSearchParams(window.location.search).get('token') || '';
  }

  // ── v2: hydrate section hosts ────────────────────────────────────────────

  async function hydrateSectionHosts() {
    const hosts = document.querySelectorAll('[data-cms-section-host]');
    for (const host of hosts) {
      const slug  = host.dataset.cmsSectionHost;
      if (!slug) continue;
      const state = _previewState();
      const token = _previewToken();
      const url = `${_apiBase()}/api/cms/page/${encodeURIComponent(slug)}?state=${state}` +
                  (token ? `&token=${encodeURIComponent(token)}` : '');
      try {
        const res = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'include' });
        if (!res.ok) continue;
        const body = await res.json();
        applySectionTemplate(host, body.template, body.sections_html || {});
      } catch (e) {
        console.warn('[cms-v2] section host hydrate failed', e);
      }
    }
  }

  function applySectionTemplate(host, template, sectionsHtml) {
    if (!host || !template) return;
    const order = (template.order || []).filter(sid => sectionsHtml[sid]);
    host.innerHTML = order.map(sid => sectionsHtml[sid] || '').join('');
    // Stega scan after every render so inline-edit is wired up
    scanStegaInside(host);
    // Insert "+" buttons between sections (preview mode only)
    if (new URLSearchParams(window.location.search).get('preview') === '1') {
      insertAddButtonsBetween(host, order);
    }
    // Wire entrance animations on any new .cms-anim section
    armEntranceAnimations(host);
    // Re-init hook for any embedded section JS
    order.forEach(sid => {
      document.dispatchEvent(new CustomEvent('cms:section:load', { detail: { sectionId: sid } }));
    });
  }

  // ── Entrance animations ───────────────────────────────────────────────────
  // Sections rendered with an `_animation` layout setting get a class like
  // `.cms-anim-fade-up`. CSS hides them; once they enter the viewport, we add
  // `.cms-anim-in` to play them in. Idempotent — safe to call after every
  // section re-render. Single shared observer for the whole page.
  let _entranceObserver = null;
  function armEntranceAnimations(rootEl) {
    const root = rootEl || (typeof document !== 'undefined' ? document : null);
    // Guard for non-browser environments (Node tests pass stub objects).
    if (!root || typeof root.querySelectorAll !== 'function') return;
    if (typeof IntersectionObserver === 'undefined') {
      // Fallback: just unhide everything
      root.querySelectorAll('.cms-anim').forEach(el => el.classList.add('cms-anim-in'));
      return;
    }
    if (!_entranceObserver) {
      _entranceObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('cms-anim-in');
            _entranceObserver.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    }
    const previewMode = (typeof window !== 'undefined' && window.location)
      ? new URLSearchParams(window.location.search).get('preview') === '1'
      : false;
    root.querySelectorAll('.cms-anim:not(.cms-anim-in)').forEach((el) => {
      if (previewMode) {
        // In admin preview, never delay — editors see the final state.
        el.classList.add('cms-anim-in');
        return;
      }
      _entranceObserver.observe(el);
    });
  }

  function insertAddButtonsBetween(host, order) {
    // Remove old buttons
    host.querySelectorAll('.cms-add-here').forEach(b => b.remove());
    const expectedOrigin = window.location.origin;
    const make = (index) => {
      const btn = document.createElement('button');
      btn.className = 'cms-add-here';
      btn.type = 'button';
      btn.dataset.cmsInsertIndex = String(index);
      btn.innerHTML = '<span>+ Add section here</span>';
      btn.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        try {
          window.parent.postMessage({ type: 'cms:add-here', index: index }, expectedOrigin);
        } catch (_e) {}
      });
      // Also act as a drop zone for drag-reorder
      btn.addEventListener('dragover', (e) => {
        if (host._cmsDraggingSid) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          btn.classList.add('cms-add-here-drop');
        }
      });
      btn.addEventListener('dragleave', () => btn.classList.remove('cms-add-here-drop'));
      btn.addEventListener('drop', (e) => {
        e.preventDefault();
        btn.classList.remove('cms-add-here-drop');
        const sid = host._cmsDraggingSid;
        if (!sid) return;
        const newIndex = Number(btn.dataset.cmsInsertIndex);
        const cur = order.slice();
        const fromIdx = cur.indexOf(sid);
        if (fromIdx < 0) return;
        cur.splice(fromIdx, 1);
        const insertAt = newIndex > fromIdx ? newIndex - 1 : newIndex;
        cur.splice(insertAt, 0, sid);
        try {
          window.parent.postMessage({
            type: 'cms:reorder-from-iframe',
            order: cur,
          }, expectedOrigin);
        } catch (_e) {}
      });
      return btn;
    };
    // Insert before each section
    order.forEach((sid, idx) => {
      const sectionEl = host.querySelector('#cms-section-' + sid);
      if (!sectionEl) return;
      sectionEl.parentNode.insertBefore(make(idx), sectionEl);
    });
    // Plus one at the very end
    host.appendChild(make(order.length));
    // Wire each section as draggable
    order.forEach(sid => {
      const sectionEl = host.querySelector('#cms-section-' + sid);
      if (!sectionEl) return;
      sectionEl.draggable = true;
      sectionEl.addEventListener('dragstart', (e) => {
        host._cmsDraggingSid = sid;
        host.classList.add('cms-dragging');
        try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', sid); } catch (_e) {}
      });
      sectionEl.addEventListener('dragend', () => {
        host._cmsDraggingSid = null;
        host.classList.remove('cms-dragging');
      });
    });
  }

  // ── v2: discover all editable items on this page ───────────────────────
  function scanLinter() {
    // Returns a list of {sectionId, severity, message} for accessibility / link
    // / content issues found in the editable section markup.
    const issues = [];
    document.querySelectorAll('[data-cms-section-id]').forEach(section => {
      const sid = section.dataset.cmsSectionId;
      // Images without alt
      section.querySelectorAll('img').forEach(img => {
        if (!img.getAttribute('alt')) {
          issues.push({ sectionId: sid, severity: 'warn', message: 'Image missing alt text' });
        }
        if (!img.src || img.src.endsWith('#') || img.src === window.location.href) {
          issues.push({ sectionId: sid, severity: 'warn', message: 'Image has empty source' });
        }
      });
      // Empty links / placeholder URLs
      section.querySelectorAll('a').forEach(a => {
        const href = a.getAttribute('href');
        const text = (a.textContent || '').trim();
        if (!href || href === '#' || href === '') {
          issues.push({ sectionId: sid, severity: 'warn', message: `Link "${text || '(empty)'}" has placeholder URL` });
        }
        if (!text) {
          issues.push({ sectionId: sid, severity: 'warn', message: 'Link has no visible text' });
        }
      });
      // Empty headings
      section.querySelectorAll('h1, h2, h3').forEach(h => {
        if (!(h.textContent || '').trim()) {
          issues.push({ sectionId: sid, severity: 'info', message: 'Heading is empty' });
        }
      });
    });
    return issues;
  }

  function scanEditable() {
    const items = [];
    // 1. v1: data-cms-config — site-config keys driving fixed elements
    document.querySelectorAll('[data-cms-config]').forEach(el => {
      const key = el.dataset.cmsConfig;
      if (!key) return;
      items.push({
        kind:    'site_config',
        key,
        label:   _humanLabel(key),
        preview: _previewText(el, key),
        selector: 'BODY [data-cms-config="' + key + '"]',
      });
    });
    // 2. v1: data-cms-override — page-overrides (per-page text)
    document.querySelectorAll('[data-cms-override]').forEach(el => {
      const key = el.dataset.cmsOverride;
      if (!key) return;
      // Auto-tagged elements (from autoTagAll) are hover-editable directly in
      // the iframe — listing every <p> on the page would drown the sidebar.
      if (key.indexOf(AUTO_TAG_PREFIX) === 0) return;
      items.push({
        kind:    'override',
        key,
        label:   _humanLabel(key),
        preview: _previewText(el, key),
        selector: 'BODY [data-cms-override="' + key + '"]',
      });
    });
    // 3. v2: data-cms-section-id — registered sections
    document.querySelectorAll('[data-cms-section-id]').forEach(el => {
      items.push({
        kind:     'section',
        sid:      el.dataset.cmsSectionId,
        type:     el.dataset.cmsSectionType,
        visible:  el.dataset.cmsSectionVisible !== 'false',
        preview:  _previewText(el).slice(0, 60),
        selector: '#cms-section-' + el.dataset.cmsSectionId,
      });
    });
    return items;
  }

  function countAutoTagged() {
    // Auto-tagged elements have data-cms-override starting with AUTO_TAG_PREFIX.
    let n = 0;
    document.querySelectorAll('[data-cms-override]').forEach(el => {
      const k = el.dataset.cmsOverride || '';
      if (k.indexOf(AUTO_TAG_PREFIX) === 0) n++;
    });
    return n;
  }

  function _humanLabel(key) {
    return String(key)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function _previewText(el, fallback) {
    if (!el) return fallback || '';
    if (el.tagName === 'IMG') return '[image: ' + (el.alt || el.src || '') + ']';
    const t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return t.slice(0, 80) || fallback || '';
  }

  // ── v2: stega-encoded inline-edit detection ─────────────────────────────
  // Mirrors app/services/cms_stega.py — zero-width chars after a 4-char
  // sentinel encode a JSON payload {sid, field}. We walk text nodes in
  // preview mode, decode any payload at the start, and tag the parent
  // element with data-cms-stega-sid + data-cms-stega-field for click-to-edit.

  const STEGA_ZWSP = '​';
  const STEGA_ZWNJ = '‌';
  const STEGA_SENTINEL = STEGA_ZWNJ + STEGA_ZWSP + STEGA_ZWNJ + STEGA_ZWSP;

  function decodeStega(text) {
    if (!text || text.indexOf(STEGA_SENTINEL) !== 0) return null;
    let rest = text.slice(STEGA_SENTINEL.length);
    const bytes = [];
    let i = 0;
    while (i + 8 <= rest.length) {
      const chunk = rest.slice(i, i + 8);
      if (!/^[​‌]+$/.test(chunk)) break;
      let byte = 0;
      for (let j = 0; j < 8; j++) {
        byte = (byte << 1) | (chunk.charCodeAt(j) === 0x200C ? 1 : 0);
      }
      bytes.push(byte);
      i += 8;
    }
    if (!bytes.length) return null;
    let str;
    try { str = new TextDecoder('utf-8').decode(new Uint8Array(bytes)); }
    catch (_e) { return null; }
    let payload;
    try { payload = JSON.parse(str); }
    catch (_e) { return null; }
    return { payload, remaining: rest.slice(i) };
  }

  function scanStegaInside(root) {
    if (!root || typeof document === 'undefined' || typeof NodeFilter === 'undefined' ||
        typeof document.createTreeWalker !== 'function') return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const updates = [];
    let node;
    while ((node = walker.nextNode())) {
      const decoded = decodeStega(node.nodeValue);
      if (!decoded) continue;
      const parent = node.parentElement;
      if (!parent) continue;
      // Strip the encoded prefix and tag the parent
      updates.push({ node, parent, payload: decoded.payload, remaining: decoded.remaining });
    }
    updates.forEach(({ node, parent, payload, remaining }) => {
      node.nodeValue = remaining;
      parent.setAttribute('data-cms-stega-sid', String(payload.sid || ''));
      parent.setAttribute('data-cms-stega-field', String(payload.field || ''));
      parent.classList.add('cms-editable');
    });
  }

  function enableInlineEditClicks(expectedOrigin) {
    // Double-click any editable element → make it directly editable in place.
    // We support these flavors:
    //   v2 stega:        [data-cms-stega-sid][data-cms-stega-field]
    //   v1 site-config:  [data-cms-config]
    //   v1 page-override:[data-cms-override]
    //   image swap:      [data-cms-override] on an <img> → ask editor for asset picker
    document.addEventListener('dblclick', (event) => {
      const stegaEl = event.target.closest('[data-cms-stega-sid][data-cms-stega-field]');
      const cfgEl   = !stegaEl && event.target.closest('[data-cms-config]');
      const ovrEl   = !stegaEl && !cfgEl && event.target.closest('[data-cms-override]');
      const el = stegaEl || cfgEl || ovrEl;
      if (!el) return;
      if (el.tagName === 'A' && !document.body.classList.contains('cms-inspector')) return;
      event.preventDefault();
      event.stopPropagation();
      // Image elements need a different flow — open the editor's asset picker
      if (el.tagName === 'IMG') {
        const key = el.getAttribute('data-cms-override') || el.getAttribute('data-cms-config');
        const kind = el.hasAttribute('data-cms-config') ? 'site_config' : 'override';
        try {
          window.parent.postMessage({
            type: 'cms:image-pick-request',
            kind,
            key,
            currentSrc: el.getAttribute('src') || '',
          }, expectedOrigin);
        } catch (_e) {}
        // Brief visual ack
        el.classList.add('cms-editing');
        setTimeout(() => el.classList.remove('cms-editing'), 800);
        return;
      }
      let kind, key1, key2;
      if (stegaEl) {
        kind = 'section';
        key1 = el.getAttribute('data-cms-stega-sid');
        key2 = el.getAttribute('data-cms-stega-field');
      } else if (cfgEl) {
        kind = 'site_config';
        key1 = el.getAttribute('data-cms-config');
      } else {
        kind = 'override';
        key1 = el.getAttribute('data-cms-override');
      }
      startInlineEdit(el, expectedOrigin, kind, key1, key2);
    }, true);
  }

  // Mark v1-editable elements with .cms-editable so the same hover styling
  // applies. Called from hydrate() after applyAll runs.
  function tagV1Editables() {
    document.querySelectorAll('[data-cms-config]').forEach(el => el.classList.add('cms-editable'));
    document.querySelectorAll('[data-cms-override]').forEach(el => el.classList.add('cms-editable'));
  }

  function startInlineEdit(el, expectedOrigin, kind, key1, key2) {
    if (el._cmsEditing) return;
    el._cmsEditing = true;
    // BUG FIX (v2.36): if the element contains inline children we want to
    // preserve (links, bold, italic), use innerHTML mode instead of plaintext.
    // Auto-tag now allows wrappers with inline children, so without this
    // the user would lose their <a href="…"> on every edit.
    const hasInlineChildren = el.children && el.children.length > 0;
    const htmlMode = hasInlineChildren;
    const originalHtml = el.innerHTML;
    const originalText = el.textContent || '';
    el.classList.add('cms-editing');
    if (htmlMode) {
      // Full contentEditable so links/strong/em are preserved during edit
      el.setAttribute('contenteditable', 'true');
    } else {
      el.setAttribute('contenteditable', 'plaintext-only');
      // Some browsers don't support plaintext-only, fall through to true
      if (el.contentEditable !== 'plaintext-only') el.setAttribute('contenteditable', 'true');
    }
    el.spellcheck = true;
    // Focus + select-all
    el.focus();
    try {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection();
      sel.removeAllRanges(); sel.addRange(range);
    } catch (_e) { /* selection may fail in some embeds */ }

    function commit(save) {
      if (!el._cmsEditing) return;
      el._cmsEditing = false;
      el.classList.remove('cms-editing');
      el.removeAttribute('contenteditable');
      el.removeEventListener('blur',     onBlur, true);
      el.removeEventListener('keydown',  onKey,  true);
      // In htmlMode, save the whole innerHTML so links/strong/em survive.
      // The applyValue path on the public site mirrors this — when an override
      // value contains '<' it's treated as HTML by re-applying as innerHTML
      // (we set data-cms-html on the element to make that explicit).
      const newRaw = htmlMode ? el.innerHTML : (el.textContent || '');
      const original = htmlMode ? originalHtml : originalText;
      const newClean = newRaw.trim();
      if (save && newClean !== original.trim()) {
        if (htmlMode) {
          // Make sure subsequent applyValue() runs save HTML, not text.
          el.setAttribute('data-cms-html', 'true');
        }
        try {
          const msg = { type: 'cms:inline:save', kind, value: newClean, htmlMode };
          if (kind === 'section')      { msg.sectionId = key1; msg.field = key2; }
          else if (kind === 'site_config') { msg.key = key1; }
          else if (kind === 'override')    { msg.key = key1; }
          window.parent.postMessage(msg, expectedOrigin);
        } catch (_e) {}
      } else if (!save) {
        if (htmlMode) el.innerHTML = originalHtml;
        else          el.textContent = originalText;
      }
    }
    function onBlur() { commit(true); }
    function onKey(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(true); }
      else if (e.key === 'Escape')          { e.preventDefault(); commit(false); }
    }
    el.addEventListener('blur',    onBlur, true);
    el.addEventListener('keydown', onKey,  true);
  }

  // ── v2: postMessage handlers (preview mode only) ────────────────────────

  function parseV2Message(event, expectedOrigin) {
    if (!event || event.origin !== expectedOrigin) return null;
    const d = event.data;
    if (!d || typeof d !== 'object' || typeof d.type !== 'string') return null;
    if (!d.type.startsWith('cms:')) return null;
    return d;
  }

  async function rerenderSection(slug, sid) {
    const state = _previewState();
    const token = _previewToken();
    const url = `${_apiBase()}/api/cms/render?page=${encodeURIComponent(slug)}` +
                `&section=${encodeURIComponent(sid)}&state=${state}` +
                (token ? `&token=${encodeURIComponent(token)}` : '');
    try {
      const res = await fetch(url, { method: 'GET', mode: 'cors', credentials: 'include' });
      if (!res.ok) return;
      const body = await res.json();
      const old = document.getElementById('cms-section-' + sid);
      let freshEl = null;
      if (old) {
        document.dispatchEvent(new CustomEvent('cms:section:unload', { detail: { sectionId: sid } }));
        old.outerHTML = body.html;
        freshEl = document.getElementById('cms-section-' + sid);
        document.dispatchEvent(new CustomEvent('cms:section:load',   { detail: { sectionId: sid } }));
      } else {
        // Section was just added — append into the matching host
        const host = document.querySelector('[data-cms-section-host]');
        if (host) {
          host.insertAdjacentHTML('beforeend', body.html);
          freshEl = document.getElementById('cms-section-' + sid);
          document.dispatchEvent(new CustomEvent('cms:section:load', { detail: { sectionId: sid } }));
        }
      }
      // BUG FIX (v2.38): re-applying outerHTML throws away the inline-edit
      // tagging done by scanStegaInside / autoTagAll, and the new element
      // isn't observed by the entrance-animation IntersectionObserver. Re-
      // run all three on just the fresh subtree so inline-edit still works
      // on the new HTML.
      if (freshEl) {
        scanStegaInside(freshEl);
        armEntranceAnimations(freshEl);
        // Auto-tag is per-page (uses path-based hashes), so we need the slug.
        // Inside a v2 section, autoTagAll's exclude list (data-cms-section-id)
        // already skips it — so we don't need to re-run autoTagAll inside the
        // section. The section's stega tagging covers its own editable fields.
      }
    } catch (e) {
      console.warn('[cms-v2] rerender failed', e);
    }
  }

  function reorderSections(slug, newOrder) {
    const host = document.querySelector('[data-cms-section-host]');
    if (!host) return;
    // Detach existing section nodes by sid, re-append in newOrder.
    const byId = {};
    host.querySelectorAll('[data-cms-section-id]').forEach(el => {
      byId[el.dataset.cmsSectionId] = el;
    });
    const frag = document.createDocumentFragment();
    newOrder.forEach(sid => {
      const el = byId[sid];
      if (el) frag.appendChild(el);
    });
    host.innerHTML = '';
    host.appendChild(frag);
    newOrder.forEach((sid, idx) => {
      document.dispatchEvent(new CustomEvent('cms:section:reorder', {
        detail: { sectionId: sid, newIndex: idx }
      }));
    });
  }

  function removeSection(sid) {
    const el = document.getElementById('cms-section-' + sid);
    if (el) {
      document.dispatchEvent(new CustomEvent('cms:section:unload', { detail: { sectionId: sid } }));
      el.remove();
    }
  }

  function highlightSection(sid) {
    document.querySelectorAll('[data-cms-section-id].is-cms-selected')
      .forEach(el => el.classList.remove('is-cms-selected'));
    const el = document.getElementById('cms-section-' + sid);
    if (el) el.classList.add('is-cms-selected');
  }

  function enableV2PreviewMode() {
    const expectedOrigin = window.location.origin;

    // Inject preview-mode style: outline selected sections, hover hints when inspector is active.
    const style = document.createElement('style');
    style.id = 'cms-preview-style';
    style.textContent = `
      /* First-load pulse — when the editor opens a page, flash every
         editable element briefly so admins see what's editable. */
      @keyframes cms-first-pulse {
        0%   { box-shadow: 0 0 0 0 rgba(91,140,255,0.55), 0 0 0 0 rgba(168,85,247,0.30); }
        50%  { box-shadow: 0 0 0 4px rgba(91,140,255,0.35), 0 0 0 12px rgba(168,85,247,0.15); }
        100% { box-shadow: 0 0 0 0 rgba(91,140,255,0), 0 0 0 0 rgba(168,85,247,0); }
      }
      body.cms-preview .cms-editable.cms-first-pulse {
        animation: cms-first-pulse 1.6s ease-out 1;
      }
      [data-cms-section-id] { position: relative; }
      [data-cms-section-id].is-cms-selected {
        outline: 2px solid #3b82f6; outline-offset: -2px;
        box-shadow: 0 0 0 6px rgba(59,130,246,0.18);
      }
      [data-cms-section-id].is-cms-hover {
        outline: 2px solid #f59e0b; outline-offset: -2px;
        box-shadow: 0 0 0 6px rgba(245,158,11,0.20);
      }
      /* Stronger Shopify-style hover (solid blue with glow) when inspector is on. */
      body.cms-inspector [data-cms-section-id]:hover {
        outline: 2px solid #3b82f6; outline-offset: -2px;
        box-shadow: 0 0 0 8px rgba(59,130,246,0.25);
        cursor: pointer;
      }
      [data-cms-block-id].is-cms-selected { outline: 2px dotted #3b82f6; outline-offset: -2px; }

      /* Inline-edit visual feedback (always on in preview mode) */
      .cms-editable { transition: background 100ms, outline-color 100ms, box-shadow 100ms; position: relative; }
      body.cms-preview .cms-editable { cursor: text; }
      body.cms-preview .cms-editable:hover {
        background: rgba(59,130,246,0.12);
        outline: 2px solid #3b82f6;
        outline-offset: 3px;
        box-shadow: 0 0 0 6px rgba(59,130,246,0.18);
        border-radius: 3px;
      }
      body.cms-preview .cms-editable:hover::after {
        content: '✎ double-click to edit';
        position: absolute;
        top: -28px; left: 0;
        background: linear-gradient(135deg, #5b8cff 0%, #a855f7 50%, #ec4899 100%);
        color: white;
        font: 600 11px/1 ui-sans-serif, system-ui, sans-serif;
        padding: 5px 9px; border-radius: 5px;
        white-space: nowrap; pointer-events: none; z-index: 9999;
        box-shadow: 0 4px 12px rgba(91,140,255,0.45);
      }
      /* Images need a distinct affordance — they open the asset picker, not contentEditable. */
      body.cms-preview .cms-editable-image { cursor: zoom-in; }
      body.cms-preview .cms-editable-image:hover {
        outline: 3px solid #ec4899; outline-offset: 2px;
        box-shadow: 0 0 0 8px rgba(236,72,153,0.20);
      }
      body.cms-preview img.cms-editable-image:hover::after,
      body.cms-preview .cms-editable-image:hover::after {
        content: '🖼 double-click to swap image';
        background: linear-gradient(135deg, #ec4899 0%, #a855f7 100%);
      }
      .cms-editable.cms-editing {
        outline: 2px solid #f59e0b !important;
        outline-offset: 2px;
        background: rgba(245,158,11,0.15) !important;
        box-shadow: 0 0 0 4px rgba(245,158,11,0.25);
        cursor: text;
      }

      /* Floating section-type label that shows in inspector mode */
      body.cms-inspector [data-cms-section-id]::before {
        content: attr(data-cms-section-type);
        position: absolute; top: -12px; left: 8px;
        background: linear-gradient(135deg, #5b8cff 0%, #a855f7 100%);
        color: white;
        font: 600 11px/1 ui-sans-serif, system-ui, sans-serif; padding: 4px 10px;
        border-radius: 5px; opacity: 0; transition: opacity 120ms;
        pointer-events: none; z-index: 9999;
        box-shadow: 0 4px 10px rgba(91,140,255,0.45);
        text-transform: uppercase; letter-spacing: .04em;
      }
      body.cms-inspector [data-cms-section-id]:hover::before,
      body.cms-inspector [data-cms-section-id].is-cms-selected::before,
      body.cms-inspector [data-cms-section-id].is-cms-hover::before {
        opacity: 1;
      }
    `;
    document.head.appendChild(style);

    window.addEventListener('message', async (event) => {
      const msg = parseV2Message(event, expectedOrigin);
      if (!msg) return;

      switch (msg.type) {
        case 'cms:scan': {
          // Editor asked for an inventory of all editable elements on this page.
          const items = scanEditable();
          const issues = scanLinter();
          const autoTagged = countAutoTagged();
          try {
            window.parent.postMessage({
              type: 'cms:scan:result', items, issues, autoTagged,
            }, expectedOrigin);
          } catch (_e) {}
          break;
        }
        case 'cms:scroll-to': {
          const sel = msg.selector;
          if (sel) {
            const el = document.querySelector(sel);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('cms-flash');
              setTimeout(() => el.classList.remove('cms-flash'), 1500);
            }
          }
          break;
        }
        case 'cms:theme:update':
          if (typeof msg.key === 'string') {
            const cssVar = '--cms-' + msg.key.replace(/_/g, '-');
            document.documentElement.style.setProperty(cssVar, String(msg.value || ''));
          }
          break;
        case 'cms:section:rerender':
          await rerenderSection(msg.page, msg.sectionId);
          break;
        case 'cms:section:reorder':
          if (Array.isArray(msg.order)) reorderSections(msg.page, msg.order);
          break;
        case 'cms:section:remove':
          removeSection(msg.sectionId);
          break;
        case 'cms:section:select':
          highlightSection(msg.sectionId);
          document.dispatchEvent(new CustomEvent('cms:section:select', {
            detail: { sectionId: msg.sectionId, load: !!msg.load }
          }));
          break;
        case 'cms:section:hover':
          // Editor hovered a row in the sidebar tree — outline the iframe section
          document.querySelectorAll('[data-cms-section-id].is-cms-hover')
            .forEach(el => el.classList.remove('is-cms-hover'));
          if (msg.sectionId) {
            const el = document.getElementById('cms-section-' + msg.sectionId);
            if (el) el.classList.add('is-cms-hover');
          }
          break;
        case 'cms:inspector:activate':
          document.body.classList.add('cms-inspector');
          document.dispatchEvent(new CustomEvent('cms:inspector:activate'));
          break;
        case 'cms:inspector:deactivate':
          document.body.classList.remove('cms-inspector');
          document.dispatchEvent(new CustomEvent('cms:inspector:deactivate'));
          break;
        default:
          break;
      }
    });

    // Inspector mode: clicks on sections in the iframe report the sid up to the editor parent.
    // Also: in inspector mode, clicking ANY editable link (nav_label_*, footer link
    // labels, auto-tagged anchors) should NOT navigate — admin is here to edit
    // text, not browse. They can still navigate by clicking the page picker.
    document.addEventListener('click', (event) => {
      if (!document.body.classList.contains('cms-inspector')) return;

      // Suppress link navigation on tagged/editable links so a single click
      // doesn't yank the iframe away from the page the admin is editing.
      const linkEl = event.target.closest('a');
      const editableTaggedLink = linkEl && (
        linkEl.hasAttribute('data-cms-config') ||
        linkEl.hasAttribute('data-cms-override') ||
        linkEl.hasAttribute('data-cms-stega-sid')
      );
      if (editableTaggedLink) {
        event.preventDefault();
        event.stopPropagation();
        // Don't return early — we still want to bubble up to selectSection
        // if this link is inside a v2 section. But navigation is now blocked.
      }

      const sectionEl = event.target.closest('[data-cms-section-id]');
      if (!sectionEl) return;
      event.preventDefault();
      event.stopPropagation();
      const blockEl = event.target.closest('[data-cms-block-id]');
      try {
        window.parent.postMessage({
          type:      'cms:inspector:click',
          sectionId: sectionEl.dataset.cmsSectionId,
          blockId:   blockEl ? blockEl.dataset.cmsBlockId : null,
        }, expectedOrigin);
      } catch (_e) { /* ignore */ }
    }, true);

    // Right-click any section in the iframe (preview mode) → tell editor to open ctx menu
    document.addEventListener('contextmenu', (event) => {
      const sectionEl = event.target.closest('[data-cms-section-id]');
      if (!sectionEl) return;
      event.preventDefault();
      const rect = sectionEl.getBoundingClientRect();
      const iframeRect = window.frameElement ? window.frameElement.getBoundingClientRect() : { left: 0, top: 0 };
      try {
        window.parent.postMessage({
          type:      'cms:iframe:context-menu',
          sectionId: sectionEl.dataset.cmsSectionId,
          // Pass screen coordinates so the parent can position the menu
          x: event.clientX + iframeRect.left,
          y: event.clientY + iframeRect.top,
        }, expectedOrigin);
      } catch (_e) {}
    }, true);

    // Inline-edit double-click: stega-tagged elements
    enableInlineEditClicks(expectedOrigin);

    // Hover sync: when inspector mode is on, hovering a section in the iframe
    // tells the editor parent to highlight the matching row in the sidebar tree.
    document.addEventListener('mouseover', (event) => {
      if (!document.body.classList.contains('cms-inspector')) return;
      const el = event.target.closest('[data-cms-section-id]');
      if (!el) return;
      try {
        window.parent.postMessage({
          type: 'cms:inspector:hover',
          sectionId: el.dataset.cmsSectionId,
        }, expectedOrigin);
      } catch (_e) { /* ignore */ }
    }, true);
    document.addEventListener('mouseleave', () => {
      if (!document.body.classList.contains('cms-inspector')) return;
      try {
        window.parent.postMessage({ type: 'cms:inspector:hover', sectionId: null }, expectedOrigin);
      } catch (_e) {}
    }, true);
  }

  // ── v1+v2 boot: hydrate v1 (data-cms-config), then v2 (section hosts) ───

  function enablePreviewMode() {
    const expectedOrigin = window.location.origin;
    // v1 message handler (legacy `cms-update` envelope)
    window.addEventListener('message', (event) => {
      const msg = parsePreviewMessage(event, expectedOrigin);
      if (!msg) return;
      if (msg.kind === 'config') {
        document.querySelectorAll('[data-cms-config="' + msg.key + '"]').forEach(el => applyValue(el, msg.value));
        if (msg.key.indexOf('theme_') === 0) applyThemeVars({ [msg.key]: msg.value });
      } else if (msg.kind === 'override') {
        document.querySelectorAll('[data-cms-override="' + msg.key + '"]').forEach(el => applyValue(el, msg.value));
      }
    });
  }

  async function hydrate() {
    // Determine the page slug for overrides:
    //   1. <body data-cms-page="..."> if set
    //   2. otherwise derive from URL (/ → home, /pages/X.html → X)
    const explicit = document.body && document.body.dataset && document.body.dataset.cmsPage;
    let slug = explicit;
    if (!slug) {
      const path = (window.location.pathname || '').toLowerCase();
      if (path === '/' || path.endsWith('/index.html')) slug = 'home';
      else {
        const m = path.match(/\/pages\/([^/.]+)/);
        if (m) slug = m[1];
      }
      // Tag the body so other code (e.g. inline-edit save) can find the slug
      if (slug && document.body) document.body.dataset.cmsPage = slug;
    }

    // v1: site-config + overrides (text/image swap on data-cms-config + auto-tagged).
    if (slug) {
      let config = {}, overrides = {};
      try {
        const [c, o] = await Promise.all([
          window.cmsFetchSiteConfig(),
          window.cmsFetchOverrides(slug),
        ]);
        config    = (c && c.config)    || {};
        overrides = (o && o.overrides) || {};
      } catch (e) {
        console.warn('[cms] hydrate fetch failed; using fallback content', e);
      }
      applyAll(config, overrides);
      // Auto-tag every text element we can find. Saved override values (the
      // ones whose keys start with `auto__`) are applied here too.
      autoTagAll(slug, overrides);
    }

    // v2: section hosts
    await hydrateSectionHosts();

    // Arm any entrance animations on already-rendered sections (covers SSR
    // pages and pages whose section hosts arrived before this script ran).
    armEntranceAnimations(document);

    document.body.classList.add('cms-hydrated');

    if (new URLSearchParams(window.location.search).get('preview') === '1') {
      document.body.classList.add('cms-preview');
      tagV1Editables();
      // Brief first-load pulse so the admin can see, at a glance, every
      // element that's hover-editable. Only pulses elements currently in
      // the viewport — pulsing 500+ off-screen elements at once would be
      // wasted work and would trigger a thundering-herd of layout recalcs
      // when they all finish their stagger at the cap.
      setTimeout(() => {
        const all = Array.from(document.querySelectorAll('.cms-editable'));
        const vh = window.innerHeight || 800;
        const inView = all.filter(el => {
          const r = el.getBoundingClientRect();
          return r.top < vh + 100 && r.bottom > -20 && r.width > 0 && r.height > 0;
        });
        // Hard-cap to keep stagger window readable
        const toPulse = inView.slice(0, 60);
        toPulse.forEach((el, i) => {
          setTimeout(() => {
            el.classList.add('cms-first-pulse');
            setTimeout(() => el.classList.remove('cms-first-pulse'), 1700);
          }, i * 22);
        });
      }, 400);
      enablePreviewMode();
      enableV2PreviewMode();
    }
  }

  // ── Test export hook ──────────────────────────────────────────────────────

  if (typeof window !== 'undefined' && window.PNEC_CMS_TEST) {
    globalThis.__pnecCmsTestExports = {
      applyValue, parsePreviewMessage, applyThemeVars,
      applySectionTemplate, parseV2Message, reorderSections, removeSection,
    };
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate);
  } else {
    hydrate();
  }
})();
