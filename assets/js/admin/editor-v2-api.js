// assets/js/admin/editor-v2-api.js
// Responsibility: v2 editor API — fetch/patch the page template, render
// individual sections, publish, list section types, image upload.
// Bearer-token auth via the same pattern as admin-api.js.

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
        const err = new Error('editor-v2 ' + r.status + ' ' + path);
        err.status = r.status;
        throw err;
      }
      return r.json();
    });
  }

  function v2FetchSectionsRegistry() {
    return _request('/api/cms/sections-registry');
  }

  function v2FetchPage(slug, state) {
    state = state || 'draft';
    return _request(`/api/cms/page/${encodeURIComponent(slug)}?state=${encodeURIComponent(state)}`);
  }

  function v2PatchDraft(slug, patches) {
    return _request(`/api/cms/page/${encodeURIComponent(slug)}/draft`, {
      method: 'PATCH',
      body: JSON.stringify({ patches }),
    });
  }

  function v2RenderSection(slug, sid, state) {
    state = state || 'draft';
    return _request(`/api/cms/render?page=${encodeURIComponent(slug)}` +
                    `&section=${encodeURIComponent(sid)}&state=${encodeURIComponent(state)}`);
  }

  function v2Publish(slug) {
    return _request(`/api/cms/page/${encodeURIComponent(slug)}/publish`, { method: 'POST' });
  }

  function v2IssuePreviewToken(slug, ttlDays) {
    return _request(`/api/cms/page/${encodeURIComponent(slug)}/preview-token`, {
      method: 'POST',
      body: JSON.stringify({ ttl_days: ttlDays || 7 }),
    });
  }

  function v2FetchThemeSchema() {
    return _request('/api/cms/theme/schema');
  }
  function v2FetchTheme(state) {
    state = state || 'draft';
    return _request(`/api/cms/theme?state=${encodeURIComponent(state)}`);
  }
  function v2PatchThemeDraft(updates) {
    return _request('/api/cms/theme/draft', {
      method: 'PATCH',
      body: JSON.stringify({ updates }),
    });
  }
  function v2PublishTheme() {
    return _request('/api/cms/theme/publish', { method: 'POST' });
  }
  function v2GenerateSection(prompt, pageSlug, pageContext) {
    return _request('/api/cms/ai/section', {
      method: 'POST',
      body: JSON.stringify({ prompt, page_slug: pageSlug, page_context: pageContext || {} }),
    });
  }

  function v2UploadImage(file) {
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

  // Expose
  window.v2FetchSectionsRegistry = v2FetchSectionsRegistry;
  window.v2FetchPage             = v2FetchPage;
  window.v2PatchDraft            = v2PatchDraft;
  window.v2RenderSection         = v2RenderSection;
  window.v2Publish               = v2Publish;
  window.v2IssuePreviewToken     = v2IssuePreviewToken;
  window.v2UploadImage           = v2UploadImage;
  window.v2FetchThemeSchema      = v2FetchThemeSchema;
  window.v2FetchTheme            = v2FetchTheme;
  window.v2PatchThemeDraft       = v2PatchThemeDraft;
  window.v2PublishTheme          = v2PublishTheme;
  window.v2GenerateSection       = v2GenerateSection;
})();
