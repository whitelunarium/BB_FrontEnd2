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
      el.src = value;
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
    // Re-init hook for any embedded section JS
    order.forEach(sid => {
      document.dispatchEvent(new CustomEvent('cms:section:load', { detail: { sectionId: sid } }));
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
    document.addEventListener('dblclick', (event) => {
      // Only in inspector mode
      if (!document.body.classList.contains('cms-inspector')) return;
      const el = event.target.closest('[data-cms-stega-sid][data-cms-stega-field]');
      if (!el) return;
      event.preventDefault();
      try {
        window.parent.postMessage({
          type: 'cms:inline:edit',
          sectionId: el.getAttribute('data-cms-stega-sid'),
          field:     el.getAttribute('data-cms-stega-field'),
        }, expectedOrigin);
      } catch (_e) { /* ignore */ }
    }, true);
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
      if (old) {
        document.dispatchEvent(new CustomEvent('cms:section:unload', { detail: { sectionId: sid } }));
        old.outerHTML = body.html;
        document.dispatchEvent(new CustomEvent('cms:section:load',   { detail: { sectionId: sid } }));
      } else {
        // Section was just added — append into the matching host
        const host = document.querySelector('[data-cms-section-host]');
        if (host) {
          host.insertAdjacentHTML('beforeend', body.html);
          document.dispatchEvent(new CustomEvent('cms:section:load', { detail: { sectionId: sid } }));
        }
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
      [data-cms-section-id] { position: relative; }
      [data-cms-section-id].is-cms-selected { outline: 2px solid #3b82f6; outline-offset: -2px; }
      [data-cms-section-id].is-cms-hover { outline: 2px solid #f59e0b; outline-offset: -2px; }
      body.cms-inspector [data-cms-section-id]:hover { outline: 2px dashed #60a5fa; outline-offset: -2px; cursor: pointer; }
      [data-cms-block-id].is-cms-selected { outline: 2px dotted #3b82f6; outline-offset: -2px; }
      /* Floating section-type label that shows in inspector mode */
      body.cms-inspector [data-cms-section-id]::before {
        content: attr(data-cms-section-type);
        position: absolute; top: -10px; left: 8px;
        background: #1e3a8a; color: white;
        font: 11px/1 ui-sans-serif, system-ui, sans-serif; padding: 3px 8px;
        border-radius: 4px; opacity: 0; transition: opacity 120ms;
        pointer-events: none; z-index: 9999;
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
          try {
            window.parent.postMessage({ type: 'cms:scan:result', items, issues }, expectedOrigin);
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
    document.addEventListener('click', (event) => {
      if (!document.body.classList.contains('cms-inspector')) return;
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
    // v1: site-config + overrides (text/image swap on data-cms-config).
    const slug = document.body && document.body.dataset && document.body.dataset.cmsPage;
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
    }

    // v2: section hosts
    await hydrateSectionHosts();

    document.body.classList.add('cms-hydrated');

    if (new URLSearchParams(window.location.search).get('preview') === '1') {
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
