// assets/js/cms/hydrate.js
// Responsibility: Hydrate public Jekyll pages with CMS-backed content
// (site-config + page overrides). In ?preview=1 mode, subscribe to
// postMessage updates from the editor and apply them live.
//
// Loads as a classic <script> tag. Depends on cms-api.js being loaded first.

(function () {
  'use strict';

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

  function enablePreviewMode() {
    const expectedOrigin = window.location.origin;
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
    const slug = document.body && document.body.dataset && document.body.dataset.cmsPage;
    if (!slug) {
      document.body && document.body.classList.add('cms-hydrated');
      return;
    }
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
    document.body.classList.add('cms-hydrated');
    if (new URLSearchParams(window.location.search).get('preview') === '1') {
      enablePreviewMode();
    }
  }

  if (typeof window !== 'undefined' && window.PNEC_CMS_TEST) {
    globalThis.__pnecCmsTestExports = { applyValue, parsePreviewMessage, applyThemeVars };
    return;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate);
  } else {
    hydrate();
  }
})();
