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
    // Re-init hook for any embedded section JS
    order.forEach(sid => {
      document.dispatchEvent(new CustomEvent('cms:section:load', { detail: { sectionId: sid } }));
    });
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
      body.cms-inspector [data-cms-section-id]:hover { outline: 2px dashed #60a5fa; outline-offset: -2px; cursor: pointer; }
      [data-cms-block-id].is-cms-selected { outline: 2px dotted #3b82f6; outline-offset: -2px; }
    `;
    document.head.appendChild(style);

    window.addEventListener('message', async (event) => {
      const msg = parseV2Message(event, expectedOrigin);
      if (!msg) return;

      switch (msg.type) {
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
