// assets/js/cms/cms-api.js
// Responsibility: CMS read API — fetches site-config, page overrides, and manifest.
// Pure fetch functions; no DOM, no auth header (these endpoints are public).

(function () {
  'use strict';

  function _apiBase() {
    if (window.PNEC_CMS_API_BASE) return window.PNEC_CMS_API_BASE;
    const host = window.location.hostname;
    return (host === 'localhost' || host === '127.0.0.1')
      ? 'http://127.0.0.1:8425'
      : 'https://beasts.opencodingsociety.com';
  }

  function _get(path) {
    return fetch(_apiBase() + path, { method: 'GET', mode: 'cors', credentials: 'omit' })
      .then(r => {
        if (!r.ok) throw new Error('cms api ' + r.status + ' ' + path);
        return r.json();
      });
  }

  function cmsFetchSiteConfig() {
    return _get('/api/site-config');
  }

  function cmsFetchOverrides(slug) {
    return _get('/api/overrides/' + encodeURIComponent(slug));
  }

  // v3 Phase 4: cmsFetchManifest removed — its only consumer was the v1
  // editor (pages/admin-editor.html), which has been retired. The Flask
  // /api/cms/manifest/<slug> route was unregistered in the same cleanup.

  window.cmsFetchSiteConfig = cmsFetchSiteConfig;
  window.cmsFetchOverrides  = cmsFetchOverrides;
})();
