// assets/js/admin/editor-controller.js
// Responsibility: Live theme editor orchestrator.
// Loads manifest + values, renders fields, postMessages to iframe on input,
// PATCHes on save, reloads iframe on discard.

(function () {
  'use strict';

  const state = {
    slug:           null,
    manifest:       null,
    initialConfig:  {},
    initialOverrides: {},
    pendingChanges: {},
    iframeReady:    false,
    queue:          [],
  };

  let elPageSelect, elTabContent, elTabTheme, elTabSEO, elTabBtns;
  let elFieldsRoot, elIframe, elIframeUrl, elSaveBtn, elDiscardBtn;
  let elToast, elPreviewBanner;

  function init() {
    elPageSelect    = document.getElementById('ed-page-select');
    elFieldsRoot    = document.getElementById('ed-fields');
    elIframe        = document.getElementById('ed-iframe');
    elIframeUrl     = document.getElementById('ed-iframe-url');
    elSaveBtn       = document.getElementById('ed-save');
    elDiscardBtn    = document.getElementById('ed-discard');
    elToast         = document.getElementById('ed-toast');
    elPreviewBanner = document.getElementById('ed-preview-banner');
    elTabBtns       = document.querySelectorAll('.ed-tab-btn');
    elTabContent    = document.getElementById('ed-tab-content');
    elTabTheme      = document.getElementById('ed-tab-theme');
    elTabSEO        = document.getElementById('ed-tab-seo');

    if (!elPageSelect) return; // not on editor page

    elPageSelect.addEventListener('change', () => loadPage(elPageSelect.value));
    elSaveBtn.addEventListener('click', save);
    elDiscardBtn.addEventListener('click', discard);
    elTabBtns.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    elIframe.addEventListener('load', flushQueue);

    setTimeout(() => {
      if (!state.iframeReady) elPreviewBanner.style.display = 'block';
    }, 5000);

    loadPage('home');
  }

  async function loadPage(slug) {
    if (Object.keys(state.pendingChanges).length > 0) {
      if (!confirm('Discard unsaved changes?')) {
        elPageSelect.value = state.slug;
        return;
      }
    }
    state.slug = slug;
    state.pendingChanges = {};
    updateSaveBtn();
    elPreviewBanner.style.display = 'none';
    state.iframeReady = false;
    state.queue = [];

    try {
      const [manifest, configResp, overridesResp] = await Promise.all([
        window.editorFetchManifest(slug),
        window.editorFetchSiteConfig(),
        window.editorFetchOverrides(slug),
      ]);
      state.manifest          = manifest;
      state.initialConfig     = (configResp && configResp.config)    || {};
      state.initialOverrides  = (overridesResp && overridesResp.overrides) || {};
    } catch (e) {
      toast('Could not load fields. Refresh to retry.', 'error');
      return;
    }

    renderContentTab();
    renderThemeTab();
    pointIframe(state.manifest.preview_path);
  }

  function pointIframe(path) {
    const url = path + (path.indexOf('?') === -1 ? '?preview=1' : '&preview=1');
    elIframe.src   = url;
    elIframeUrl.textContent = url;
  }

  function postToIframe(kind, key, value) {
    const msg = { type: 'cms-update', kind, key, value };
    if (!state.iframeReady) {
      state.queue.push(msg);
      return;
    }
    try {
      elIframe.contentWindow.postMessage(msg, window.location.origin);
    } catch (e) {
      // ignore
    }
  }

  function flushQueue() {
    state.iframeReady = true;
    while (state.queue.length) {
      const msg = state.queue.shift();
      try { elIframe.contentWindow.postMessage(msg, window.location.origin); } catch (_e) {}
    }
  }

  function renderContentTab() {
    elFieldsRoot.innerHTML = '';
    state.manifest.sections.forEach(section => {
      const head = document.createElement('div');
      head.className = 'ed-section-label';
      head.textContent = section.label;
      elFieldsRoot.appendChild(head);
      section.fields.forEach(field => elFieldsRoot.appendChild(renderField(field)));
    });
  }

  function renderThemeTab() {
    const themeFields = [
      { key: 'theme_primary_color', kind: 'site_config', type: 'color', label: 'Primary color' },
      { key: 'theme_accent_color',  kind: 'site_config', type: 'color', label: 'Accent color' },
      { key: 'theme_logo_image',    kind: 'site_config', type: 'image', label: 'Logo image' },
      { key: 'org_name',            kind: 'site_config', type: 'text',  label: 'Org name' },
      { key: 'org_short_name',      kind: 'site_config', type: 'text',  label: 'Org acronym' },
      { key: 'donate_url',          kind: 'site_config', type: 'text',  label: 'Donate URL' },
    ];
    elTabTheme.innerHTML = '';
    themeFields.forEach(f => elTabTheme.appendChild(renderField(f)));
  }

  function renderField(field) {
    const wrap = document.createElement('div');
    wrap.className = 'ed-field';
    const labelEl = document.createElement('label');
    labelEl.className = 'ed-field-label';
    labelEl.textContent = field.label;
    wrap.appendChild(labelEl);

    const initial = field.kind === 'site_config'
      ? (state.initialConfig[field.key] || '')
      : (state.initialOverrides[field.key] || '');

    if (field.type === 'image') {
      return renderImageField(wrap, field, initial);
    }

    let input;
    if (field.type === 'text') {
      input = document.createElement('input');
      input.type = 'text';
      input.className = 'ed-input';
      input.value = initial;
    } else if (field.type === 'richtext') {
      input = document.createElement('textarea');
      input.className = 'ed-input ed-textarea';
      input.rows = 6;
      input.value = initial;
    } else if (field.type === 'color') {
      input = document.createElement('input');
      input.type = 'color';
      input.className = 'ed-input ed-color';
      input.value = initial || '#1e3a8a';
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.value = initial;
    }
    input.addEventListener('input', debounce(() => {
      onFieldChange(field, input.value);
    }, 200));
    wrap.appendChild(input);
    return wrap;
  }

  function renderImageField(wrap, field, initialUrl) {
    const preview = document.createElement('div');
    preview.className = 'ed-img-preview';
    preview.textContent = initialUrl ? initialUrl : '(no image)';
    wrap.appendChild(preview);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.className = 'ed-input';
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      try {
        const { url } = await window.editorUploadImage(file);
        preview.textContent = url;
        onFieldChange(field, url);
      } catch (e) {
        toast('Image upload failed.', 'error');
      }
    });
    wrap.appendChild(fileInput);
    return wrap;
  }

  function onFieldChange(field, value) {
    const kindKey = field.kind === 'site_config' ? 'config' : 'override';
    state.pendingChanges[field.key] = { kind: kindKey, value };
    postToIframe(kindKey, field.key, value);
    updateSaveBtn();
  }

  function updateSaveBtn() {
    elSaveBtn.disabled = Object.keys(state.pendingChanges).length === 0;
  }

  async function save() {
    const configUpdates    = {};
    const overrideUpdates  = {};
    Object.entries(state.pendingChanges).forEach(([key, { kind, value }]) => {
      if (kind === 'config') configUpdates[key] = value;
      else                   overrideUpdates[key] = value;
    });
    try {
      const promises = [];
      if (Object.keys(configUpdates).length)
        promises.push(window.editorBulkUpdateConfig(configUpdates));
      if (Object.keys(overrideUpdates).length)
        promises.push(window.editorBulkUpdateOverrides(state.slug, overrideUpdates));
      await Promise.all(promises);
      Object.assign(state.initialConfig, configUpdates);
      Object.assign(state.initialOverrides, overrideUpdates);
      state.pendingChanges = {};
      updateSaveBtn();
      toast('Saved.', 'ok');
      pointIframe(state.manifest.preview_path);
    } catch (e) {
      toast('Save failed: ' + (e.message || 'unknown error'), 'error');
    }
  }

  function discard() {
    state.pendingChanges = {};
    updateSaveBtn();
    pointIframe(state.manifest.preview_path);
  }

  function switchTab(name) {
    elTabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    elTabContent.style.display = name === 'content' ? 'block' : 'none';
    elTabTheme.style.display   = name === 'theme'   ? 'block' : 'none';
    elTabSEO.style.display     = name === 'seo'     ? 'block' : 'none';
  }

  function toast(msg, kind) {
    elToast.textContent = msg;
    elToast.className = 'ed-toast ' + (kind || '');
    elToast.style.opacity = '1';
    setTimeout(() => { elToast.style.opacity = '0'; }, 3500);
  }

  function debounce(fn, ms) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
