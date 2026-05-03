// assets/js/admin/editor-api.js
// Responsibility: Editor admin API layer — manifest fetch + bulk updates.
// Bearer-token auth via the same pattern as admin-api.js (pnec_token in localStorage).

(function () {
  'use strict';

  function _apiBase() {
    if (window.PNEC_CMS_API_BASE) return window.PNEC_CMS_API_BASE;
    const host = window.location.hostname;
    return (host === 'localhost' || host === '127.0.0.1')
      ? 'http://127.0.0.1:8425'
      : 'https://beasts.opencodingsociety.com';
  }

  function _authHeaders() {
    const token = localStorage.getItem('pnec_token');
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }

  function _request(path, opts) {
    const o = Object.assign({ credentials: 'include' }, opts || {});
    o.headers = Object.assign(_authHeaders(), opts && opts.headers || {});
    return fetch(_apiBase() + path, o).then(r => {
      if (!r.ok) {
        const err = new Error('editor api ' + r.status + ' ' + path);
        err.status = r.status;
        throw err;
      }
      return r.json();
    });
  }

  function editorFetchManifest(slug) {
    return _request('/api/cms/manifest/' + encodeURIComponent(slug));
  }

  function editorFetchSiteConfig() {
    return _request('/api/site-config');
  }

  function editorFetchOverrides(slug) {
    return _request('/api/overrides/' + encodeURIComponent(slug));
  }

  function editorBulkUpdateConfig(updates) {
    return _request('/api/site-config/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ updates }),
    });
  }

  function editorBulkUpdateOverrides(slug, overrides) {
    return _request('/api/overrides/' + encodeURIComponent(slug) + '/bulk', {
      method: 'POST',
      body: JSON.stringify({ overrides }),
    });
  }

  function editorUploadImage(file) {
    const fd = new FormData();
    fd.append('file', file);
    const token = localStorage.getItem('pnec_token');
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(_apiBase() + '/api/site-config/upload-image', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: fd,
    }).then(r => {
      if (!r.ok) throw new Error('upload ' + r.status);
      return r.json();
    });
  }

  window.editorFetchManifest        = editorFetchManifest;
  window.editorFetchSiteConfig      = editorFetchSiteConfig;
  window.editorFetchOverrides       = editorFetchOverrides;
  window.editorBulkUpdateConfig     = editorBulkUpdateConfig;
  window.editorBulkUpdateOverrides  = editorBulkUpdateOverrides;
  window.editorUploadImage          = editorUploadImage;
})();
