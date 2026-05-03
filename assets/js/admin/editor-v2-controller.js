// assets/js/admin/editor-v2-controller.js
// Responsibility: Live theme editor v2 orchestrator.
//
// Manages:
//   - State: current page slug, registry of section types, current template,
//            selected section, dirty flag.
//   - Sidebar tree: list of sections with select/duplicate/hide/delete and
//            drag-to-reorder (HTML5 drag API, no library).
//   - Settings panel: dynamically built from the selected section's schema.
//   - Iframe preview: postMessage events to hot-swap sections, inspector toggle.
//   - Save / Publish: PATCH and POST to backend.
//
// Depends on editor-v2-api.js. Consumes/emits postMessage with hydrate.js v2
// inside the iframe.

(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────────────
  const state = {
    pageSlug:     'home',
    registry:     [],          // [{type, label, settings:[...], ...}]
    template:     { sections: {}, order: [] },
    selectedSid:  null,
    selectedBid:  null,
    inspectorOn:  false,
    iframeReady:  false,
    queue:        [],
    dragSrc:      null,
    // v2.1 additions
    sidebarTab:   'sections',  // 'sections' | 'theme'
    viewport:     'desktop',   // 'desktop' | 'tablet' | 'mobile'
    themeSchema:  null,
    themeTokens:  null,
    undoStack:    [],
    redoStack:    [],
    // v2.2 additions
    existingItems: [],         // [{kind, key|sid, label, preview, selector}]
    siteConfig:    null,       // cached /api/site-config full state
    selectedExisting: null,    // {kind, key} when an existing item is selected
    overrides:     {},         // page-overrides cached map
  };

  function _apiBase() {
    if (window.PNEC_CMS_API_BASE) return window.PNEC_CMS_API_BASE;
    const host = window.location.hostname;
    return (host === 'localhost' || host === '127.0.0.1')
      ? 'http://127.0.0.1:8425'
      : 'https://beasts.opencodingsociety.com';
  }

  // ── DOM refs (resolved on init) ──────────────────────────────────────────
  let elPageSel, elSidebarTree, elSettingsPanel, elAddSectionBtn;
  let elSavePub, elPreviewBtn, elInspectorBtn, elShareBtn;
  let elIframe, elIframeUrl, elBanner, elToast, elPicker, elPickerList, elPickerClose;
  let elTabSections, elTabTheme, elTabHistory, elPanelSections, elPanelTheme, elPanelHistory;
  let elViewportBtns, elIframeFrame;
  let elUndoBtn, elRedoBtn;
  let elPickerSearch, elAiPrompt, elAiGo;

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    elPageSel        = document.getElementById('v2-page-select');
    elSidebarTree    = document.getElementById('v2-tree');
    elSettingsPanel  = document.getElementById('v2-settings');
    elAddSectionBtn  = document.getElementById('v2-add-section');
    elSavePub        = document.getElementById('v2-publish');
    elPreviewBtn     = document.getElementById('v2-view-preview');
    elInspectorBtn   = document.getElementById('v2-inspector-toggle');
    elShareBtn       = document.getElementById('v2-share');
    elIframe         = document.getElementById('v2-iframe');
    elIframeUrl      = document.getElementById('v2-iframe-url');
    elBanner         = document.getElementById('v2-banner');
    elToast          = document.getElementById('v2-toast');
    elPicker         = document.getElementById('v2-picker');
    elPickerList     = document.getElementById('v2-picker-list');
    elPickerClose    = document.getElementById('v2-picker-close');

    if (!elSidebarTree) return;

    elTabSections   = document.getElementById('v2-tab-sections');
    elTabTheme      = document.getElementById('v2-tab-theme');
    elTabHistory    = document.getElementById('v2-tab-history');
    elPanelSections = document.getElementById('v2-panel-sections');
    elPanelTheme    = document.getElementById('v2-panel-theme');
    elPanelHistory  = document.getElementById('v2-panel-history');
    elViewportBtns  = document.querySelectorAll('.v2-viewport-btn');
    elIframeFrame   = document.getElementById('v2-iframe-frame');
    elUndoBtn       = document.getElementById('v2-undo');
    elRedoBtn       = document.getElementById('v2-redo');
    elPickerSearch  = document.getElementById('v2-picker-search');
    elAiPrompt      = document.getElementById('v2-ai-prompt');
    elAiGo          = document.getElementById('v2-ai-go');

    elPageSel.addEventListener('change', () => switchPage(elPageSel.value));
    elAddSectionBtn.addEventListener('click', openPicker);
    elPickerClose.addEventListener('click', closePicker);
    elSavePub.addEventListener('click', publish);
    elPreviewBtn.addEventListener('click', () => window.open(state.pageSlug === 'home' ? '/' : `/pages/${state.pageSlug}.html`, '_blank'));
    elInspectorBtn.addEventListener('click', toggleInspector);
    elShareBtn.addEventListener('click', shareDraft);
    elIframe.addEventListener('load', flushQueue);
    if (elTabSections) elTabSections.addEventListener('click', () => switchSidebarTab('sections'));
    if (elTabTheme)    elTabTheme.addEventListener('click',    () => switchSidebarTab('theme'));
    if (elTabHistory)  elTabHistory.addEventListener('click',  () => switchSidebarTab('history'));
    if (elViewportBtns) elViewportBtns.forEach(btn =>
      btn.addEventListener('click', () => setViewport(btn.dataset.viewport)));
    if (elUndoBtn) elUndoBtn.addEventListener('click', undo);
    if (elRedoBtn) elRedoBtn.addEventListener('click', redo);
    if (elPickerSearch) elPickerSearch.addEventListener('input', filterPicker);
    if (elAiGo) elAiGo.addEventListener('click', generateSectionFromAi);

    window.addEventListener('message', onIframeMessage);
    document.addEventListener('keydown', onKey);

    // Iframe-unresponsive watchdog
    setTimeout(() => {
      if (!state.iframeReady) showBanner('Preview not responding — saves still apply.');
    }, 5000);

    try {
      const reg = await window.v2FetchSectionsRegistry();
      state.registry = reg.sections || [];
    } catch (e) {
      toast('Could not load sections registry.', 'error');
      state.registry = [];
    }

    // Auto-discover pages instead of relying on hardcoded option list
    try {
      const res = await fetch(_apiBase() + '/api/cms/pages', { credentials: 'include' });
      if (res.ok) {
        const body = await res.json();
        const pages = body.pages || [];
        const known = new Set(Array.from(elPageSel.options).map(o => o.value));
        pages.forEach(p => {
          if (known.has(p.page_slug)) return;
          const opt = document.createElement('option');
          opt.value = p.page_slug;
          opt.textContent = p.page_slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          elPageSel.appendChild(opt);
        });
      }
    } catch (_e) { /* ignore */ }

    await loadPage(state.pageSlug);
  }

  // ── Page loading ──────────────────────────────────────────────────────────
  async function switchPage(slug) {
    state.pageSlug = slug;
    state.selectedSid = null;
    state.selectedBid = null;
    await loadPage(slug);
  }

  async function loadPage(slug) {
    try {
      const page = await window.v2FetchPage(slug, 'draft');
      state.template = page.template || { sections: {}, order: [] };
    } catch (e) {
      toast('Could not load page.', 'error');
      state.template = { sections: {}, order: [] };
    }
    pointIframe(slug);
    renderTree();
    renderSettings();
  }

  function pointIframe(slug) {
    const path = slug === 'home' ? '/' : `/pages/${slug}.html`;
    const url  = path + (path.indexOf('?') === -1 ? '?preview=1' : '&preview=1');
    elIframe.src = url;
    elIframeUrl.textContent = url;
    state.iframeReady = false;
    state.queue = [];
  }

  // ── Sidebar tree ──────────────────────────────────────────────────────────
  function renderTree() {
    elSidebarTree.innerHTML = '';

    // ── Group A: Existing content (v1 site-config + page-overrides) ──
    const existing = (state.existingItems || []).filter(i => i.kind === 'site_config' || i.kind === 'override');
    if (existing.length) {
      const groupHead = document.createElement('div');
      groupHead.className = 'v2-tree-group-head';
      groupHead.textContent = 'Existing content';
      elSidebarTree.appendChild(groupHead);
      existing.forEach(item => {
        const row = document.createElement('div');
        row.className = 'v2-tree-row v2-tree-existing'
          + (state.selectedExisting && state.selectedExisting.key === item.key && state.selectedExisting.kind === item.kind ? ' is-selected' : '');
        const icon = item.kind === 'site_config' ? '🌐' : '✏️';
        row.innerHTML = `
          <span class="v2-tree-handle" style="visibility:hidden;">⋮⋮</span>
          <span class="v2-tree-label">${icon} ${escapeHtml(item.label)}</span>
        `;
        const peek = document.createElement('span');
        peek.className = 'v2-tree-peek';
        peek.textContent = item.preview || '';
        row.appendChild(peek);
        row.addEventListener('click', () => selectExisting(item));
        elSidebarTree.appendChild(row);
      });
    }

    // ── Group B: v2 Sections ──
    const groupHead2 = document.createElement('div');
    groupHead2.className = 'v2-tree-group-head';
    groupHead2.textContent = 'Sections';
    elSidebarTree.appendChild(groupHead2);

    if (!state.template.order.length) {
      const empty = document.createElement('div');
      empty.className = 'v2-empty';
      empty.textContent = 'No sections yet. Click "+ Add section" to start.';
      elSidebarTree.appendChild(empty);
      return;
    }
    state.template.order.forEach((sid, idx) => {
      const section = state.template.sections[sid];
      if (!section) return;
      const meta = state.registry.find(t => t.type === section.type);
      const row = document.createElement('div');
      row.className = 'v2-tree-row' + (sid === state.selectedSid ? ' is-selected' : '');
      row.draggable = true;
      row.dataset.sid = sid;

      row.innerHTML = `
        <span class="v2-tree-handle" title="Drag to reorder">⋮⋮</span>
        <span class="v2-tree-label">${escapeHtml(meta ? meta.label : section.type)}</span>
        <span class="v2-tree-actions">
          <button class="v2-icon-btn" data-act="visibility" title="${section.visible === false ? 'Show' : 'Hide'}">${section.visible === false ? '🙈' : '👁'}</button>
          <button class="v2-icon-btn" data-act="duplicate" title="Duplicate">⧉</button>
          <button class="v2-icon-btn" data-act="delete"    title="Delete">🗑</button>
        </span>
      `;
      row.addEventListener('click', (e) => {
        if (e.target.closest('.v2-icon-btn')) return;
        selectSection(sid);
      });
      row.querySelectorAll('.v2-icon-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          handleSectionAction(sid, btn.dataset.act);
        });
      });

      // Drag-to-reorder
      row.addEventListener('dragstart', (e) => {
        state.dragSrc = sid;
        row.classList.add('is-dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', sid); } catch (_e) {}
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('is-dragging');
        state.dragSrc = null;
        elSidebarTree.querySelectorAll('.is-drag-over').forEach(el => el.classList.remove('is-drag-over'));
      });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        row.classList.add('is-drag-over');
      });
      row.addEventListener('dragleave', () => row.classList.remove('is-drag-over'));
      row.addEventListener('drop', async (e) => {
        e.preventDefault();
        row.classList.remove('is-drag-over');
        const srcSid = state.dragSrc;
        const dstSid = sid;
        if (!srcSid || srcSid === dstSid) return;
        const order = state.template.order.slice();
        const fromIdx = order.indexOf(srcSid);
        const toIdx   = order.indexOf(dstSid);
        if (fromIdx < 0 || toIdx < 0) return;
        order.splice(fromIdx, 1);
        order.splice(toIdx, 0, srcSid);
        await applyPatch({ op: 'reorder', order });
        // Hot-swap iframe
        postToIframe({ type: 'cms:section:reorder', page: state.pageSlug, order });
      });

      elSidebarTree.appendChild(row);
    });
  }

  function selectSection(sid) {
    state.selectedSid = sid;
    state.selectedBid = null;
    state.selectedExisting = null;
    renderTree();
    renderSettings();
    postToIframe({ type: 'cms:section:select', sectionId: sid });
  }

  function selectExisting(item) {
    state.selectedExisting = { kind: item.kind, key: item.key, label: item.label, selector: item.selector };
    state.selectedSid = null;
    state.selectedBid = null;
    renderTree();
    renderExistingPanel();
    // Tell the iframe to scroll & flash that element
    postToIframe({ type: 'cms:scroll-to', selector: item.selector });
  }

  function renderExistingPanel() {
    elSettingsPanel.innerHTML = '';
    const item = state.selectedExisting;
    if (!item) return;
    const head = document.createElement('div');
    head.className = 'v2-settings-head';
    head.innerHTML = `<h3>${escapeHtml(item.label)}</h3>` +
      `<p>${item.kind === 'site_config' ? 'Site-wide setting' : 'Page-level override'} · key: <code>${escapeHtml(item.key)}</code></p>`;
    elSettingsPanel.appendChild(head);

    const wrap = document.createElement('div');
    wrap.className = 'v2-field';
    const label = document.createElement('label');
    label.className = 'v2-field-label';
    label.textContent = 'Value';
    wrap.appendChild(label);

    const initial = item.kind === 'site_config'
      ? (state.siteConfig && state.siteConfig[item.key]) || ''
      : (state.overrides && state.overrides[item.key]) || '';

    // Determine field shape: image vs text vs richtext
    const looksLikeImage = /image|logo|banner|favicon|photo/i.test(item.key);
    const looksLikeRichtext = /(_para\d?|_blurb|_history|_mission|_html|_body)/i.test(item.key)
                              || (typeof initial === 'string' && initial.indexOf('<') >= 0);
    const looksLikeUrl   = /(_url|donate)/i.test(item.key);

    let input;
    if (looksLikeImage) {
      const preview = document.createElement('div');
      preview.className = 'v2-image-preview';
      if (initial) {
        const img = document.createElement('img');
        img.src = initial;
        img.className = 'v2-image-thumb';
        preview.innerHTML = '';
        preview.appendChild(img);
      } else {
        preview.textContent = '(no image)';
      }
      wrap.appendChild(preview);
      const fileIn = document.createElement('input');
      fileIn.type = 'file';
      fileIn.accept = 'image/*';
      fileIn.className = 'v2-input';
      fileIn.addEventListener('change', async () => {
        const f = fileIn.files && fileIn.files[0]; if (!f) return;
        try {
          const { url } = await window.v2UploadImage(f);
          await applyExistingChange(item, url);
          preview.innerHTML = '';
          const img = document.createElement('img');
          img.src = url; img.className = 'v2-image-thumb';
          preview.appendChild(img);
        } catch (e) { toast('Upload failed.', 'error'); }
      });
      wrap.appendChild(fileIn);
      elSettingsPanel.appendChild(wrap);
      return;
    }
    if (looksLikeRichtext) {
      input = document.createElement('textarea');
      input.className = 'v2-input v2-textarea';
      input.rows = 6;
      input.value = initial;
    } else {
      input = document.createElement('input');
      input.type = looksLikeUrl ? 'url' : 'text';
      input.className = 'v2-input';
      input.value = initial;
    }
    input.addEventListener('input', debounce(async () => {
      await applyExistingChange(item, input.value);
    }, 250));
    wrap.appendChild(input);
    elSettingsPanel.appendChild(wrap);
  }

  async function applyExistingChange(item, value) {
    if (item.kind === 'site_config') {
      // Patch site-config (v1 endpoint)
      try {
        const res = await fetch(_apiBase() + '/api/site-config/' + encodeURIComponent(item.key), {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json',
                     'Authorization': 'Bearer ' + (localStorage.getItem('pnec_token') || '') },
          body: JSON.stringify({ value }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        state.siteConfig[item.key] = value;
        // Live-update the iframe via the v1 cms-update message
        postToIframe({ type: 'cms-update', kind: 'config', key: item.key, value });
      } catch (e) { toast('Save failed.', 'error'); }
    } else if (item.kind === 'override') {
      try {
        const res = await fetch(_apiBase() + '/api/overrides/' + encodeURIComponent(state.pageSlug), {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json',
                     'Authorization': 'Bearer ' + (localStorage.getItem('pnec_token') || '') },
          body: JSON.stringify({ element_id: item.key, content: value }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        state.overrides[item.key] = value;
        postToIframe({ type: 'cms-update', kind: 'override', key: item.key, value });
      } catch (e) { toast('Save failed.', 'error'); }
    }
  }

  async function handleSectionAction(sid, action) {
    if (action === 'visibility') {
      const cur = state.template.sections[sid] && state.template.sections[sid].visible !== false;
      await applyPatch({ op: 'visibility', sid, visible: !cur });
      postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: sid });
    } else if (action === 'duplicate') {
      const res = await applyPatch({ op: 'duplicate', sid });
      // The new sid is in res.affected_sids
      const newSid = (res && res.affected_sids || []).find(x => x !== sid);
      if (newSid) postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: newSid });
    } else if (action === 'delete') {
      if (!confirm('Delete this section?')) return;
      await applyPatch({ op: 'remove', sid });
      postToIframe({ type: 'cms:section:remove', sectionId: sid });
      if (state.selectedSid === sid) {
        state.selectedSid = null;
        renderSettings();
      }
    }
  }

  // ── Settings panel ────────────────────────────────────────────────────────
  function renderSettings() {
    elSettingsPanel.innerHTML = '';
    if (!state.selectedSid) {
      const empty = document.createElement('div');
      empty.className = 'v2-settings-empty';
      empty.textContent = 'Select a section to edit its settings.';
      elSettingsPanel.appendChild(empty);
      return;
    }
    const section = state.template.sections[state.selectedSid];
    if (!section) return;
    const meta = state.registry.find(t => t.type === section.type);
    if (!meta) {
      elSettingsPanel.innerHTML = `<div class="v2-settings-empty">Unknown section type: ${escapeHtml(section.type)}</div>`;
      return;
    }

    const head = document.createElement('div');
    head.className = 'v2-settings-head';
    head.innerHTML = `<h3>${escapeHtml(meta.label)}</h3>` +
                     (meta.description ? `<p>${escapeHtml(meta.description)}</p>` : '');
    elSettingsPanel.appendChild(head);

    // Device visibility — applies to ALL section types
    elSettingsPanel.appendChild(buildDeviceVisibilityRow(section));

    (meta.settings || []).forEach(field => {
      // Conditional rendering
      if (!shouldShowField(section, field)) return;
      elSettingsPanel.appendChild(buildField(section, field));
    });

    // Block list (only if the section type defines block schemas)
    if (Array.isArray(meta.blocks) && meta.blocks.length) {
      elSettingsPanel.appendChild(buildBlocksList(section, meta));
    }
  }

  function buildBlocksList(section, meta) {
    const wrap = document.createElement('div');
    wrap.className = 'v2-blocks';
    const header = document.createElement('div');
    header.className = 'v2-blocks-header';
    header.innerHTML = `<span>Items</span>`;
    wrap.appendChild(header);

    const order = section.block_order || [];
    const blocks = section.blocks || {};
    if (!order.length) {
      const empty = document.createElement('div');
      empty.className = 'v2-empty';
      empty.style.fontSize = '.8rem';
      empty.textContent = 'No items yet — click "+ Add item" below.';
      wrap.appendChild(empty);
    }
    order.forEach((bid, idx) => {
      const block = blocks[bid];
      if (!block) return;
      const blockMeta = (meta.blocks || []).find(b => b.type === block.type) || meta.blocks[0];
      wrap.appendChild(buildBlockEditor(section, block, bid, blockMeta));
    });

    // Add block — pick first block type if multiple
    const addBtn = document.createElement('button');
    addBtn.className = 'v2-btn v2-btn-ghost';
    addBtn.style.width = '100%';
    addBtn.style.marginTop = '8px';
    addBtn.textContent = `+ Add ${meta.blocks[0].label || 'item'}`;
    addBtn.addEventListener('click', async () => {
      const blockType = meta.blocks[0].type;
      const defaults = {};
      (meta.blocks[0].settings || []).forEach(f => {
        if ('default' in f) defaults[f.id] = f.default;
      });
      await applyPatch({ op: 'add_block', sid: state.selectedSid, block_type: blockType, settings: defaults });
      postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: state.selectedSid });
    });
    wrap.appendChild(addBtn);
    return wrap;
  }

  function buildBlockEditor(section, block, bid, blockMeta) {
    const wrap = document.createElement('details');
    wrap.className = 'v2-block';
    wrap.open = (state.selectedBid === bid);
    const summary = document.createElement('summary');
    const summaryLabel = (block.settings && (block.settings.question || block.settings.heading)) || (blockMeta.label || block.type);
    summary.innerHTML = `
      <span class="v2-block-summary-label">${escapeHtml(String(summaryLabel).slice(0, 40))}</span>
      <span class="v2-block-actions">
        <button class="v2-icon-btn" data-block-act="up"     title="Move up">▲</button>
        <button class="v2-icon-btn" data-block-act="down"   title="Move down">▼</button>
        <button class="v2-icon-btn" data-block-act="delete" title="Delete">🗑</button>
      </span>
    `;
    wrap.appendChild(summary);

    summary.querySelectorAll('.v2-icon-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        const act = btn.dataset.blockAct;
        await handleBlockAction(section, bid, act);
      });
    });

    const body = document.createElement('div');
    body.className = 'v2-block-body';
    (blockMeta.settings || []).forEach(field => {
      body.appendChild(buildBlockField(section, block, bid, field));
    });
    wrap.appendChild(body);
    return wrap;
  }

  function buildBlockField(section, block, bid, field) {
    const wrap = document.createElement('div');
    wrap.className = 'v2-field';
    const label = document.createElement('label');
    label.className = 'v2-field-label';
    label.textContent = field.label || field.id;
    wrap.appendChild(label);

    const initial = (block.settings && field.id in block.settings)
                    ? block.settings[field.id]
                    : (field.default != null ? field.default : '');
    let input;
    if (field.type === 'richtext') {
      input = document.createElement('textarea');
      input.className = 'v2-input v2-textarea';
      input.rows = 3;
      input.value = initial || '';
    } else if (field.type === 'select') {
      input = document.createElement('select');
      input.className = 'v2-input';
      (field.options || []).forEach(opt => {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        if (opt === initial) o.selected = true;
        input.appendChild(o);
      });
    } else {
      input = document.createElement('input');
      input.type = (field.type === 'url' ? 'url' : 'text');
      input.className = 'v2-input';
      input.value = initial || '';
    }
    input.addEventListener('input', debounce(async () => {
      await applyPatch({
        op: 'set_block', sid: state.selectedSid, bid, key: field.id, value: input.value,
      });
      postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: state.selectedSid });
    }, 250));
    wrap.appendChild(input);
    return wrap;
  }

  async function handleBlockAction(section, bid, action) {
    const order = section.block_order || [];
    if (action === 'delete') {
      if (!confirm('Delete this item?')) return;
      await applyPatch({ op: 'remove_block', sid: state.selectedSid, bid });
      postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: state.selectedSid });
    } else if (action === 'up' || action === 'down') {
      const idx = order.indexOf(bid);
      if (idx < 0) return;
      const swap = action === 'up' ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= order.length) return;
      const newOrder = order.slice();
      [newOrder[idx], newOrder[swap]] = [newOrder[swap], newOrder[idx]];
      await applyPatch({ op: 'reorder_blocks', sid: state.selectedSid, block_order: newOrder });
      postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: state.selectedSid });
    }
  }

  function buildDeviceVisibilityRow(section) {
    const wrap = document.createElement('div');
    wrap.className = 'v2-field';
    const label = document.createElement('label');
    label.className = 'v2-field-label';
    label.textContent = 'Show on';
    wrap.appendChild(label);

    const row = document.createElement('div');
    row.className = 'v2-device-vis';
    const current = Array.isArray(section.device_visibility) && section.device_visibility.length
                  ? section.device_visibility
                  : ['desktop', 'tablet', 'mobile'];
    ['desktop', 'tablet', 'mobile'].forEach(d => {
      const lbl = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = current.includes(d);
      cb.addEventListener('change', async () => {
        const newDevices = ['desktop', 'tablet', 'mobile'].filter(x => {
          if (x === d) return cb.checked;
          return current.includes(x);
        });
        await applyPatch({ op: 'device_visibility', sid: state.selectedSid, devices: newDevices });
        postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: state.selectedSid });
      });
      lbl.appendChild(cb);
      lbl.appendChild(document.createTextNode(' ' + d));
      row.appendChild(lbl);
    });
    wrap.appendChild(row);
    return wrap;
  }

  function shouldShowField(section, field) {
    const cond = field.condition;
    if (!cond) return true;
    const target = (section.settings && section.settings[cond.field]);
    const op = cond.op || '==';
    if (op === '==') return target === cond.value;
    if (op === '!=') return target !== cond.value;
    if (op === 'in') return Array.isArray(cond.value) && cond.value.includes(target);
    if (op === 'truthy') return !!target;
    if (op === 'falsy')  return !target;
    return true;
  }

  function buildField(section, field) {
    const wrap = document.createElement('div');
    wrap.className = 'v2-field';
    const label = document.createElement('label');
    label.className = 'v2-field-label';
    label.textContent = field.label || field.id;
    wrap.appendChild(label);

    const initial = (section.settings && field.id in section.settings)
                    ? section.settings[field.id]
                    : (field.default != null ? field.default : '');

    if (field.type === 'image') {
      wrap.appendChild(buildImageField(section, field, initial));
      return wrap;
    }

    let input;
    if (field.type === 'richtext') {
      input = document.createElement('textarea');
      input.className = 'v2-input v2-textarea';
      input.rows = 5;
      input.value = initial || '';
    } else if (field.type === 'select') {
      input = document.createElement('select');
      input.className = 'v2-input';
      (field.options || []).forEach(opt => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        if (opt === initial) o.selected = true;
        input.appendChild(o);
      });
    } else if (field.type === 'color') {
      input = document.createElement('input');
      input.type = 'color';
      input.className = 'v2-input v2-color';
      input.value = initial || '#1e3a8a';
    } else if (field.type === 'url') {
      input = document.createElement('input');
      input.type = 'url';
      input.className = 'v2-input';
      input.value = initial || '';
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.className = 'v2-input';
      input.value = initial || '';
    }
    input.addEventListener('input', debounce(async () => {
      await applyPatch({ op: 'set', sid: state.selectedSid, key: field.id, value: input.value });
      postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: state.selectedSid });
    }, 250));
    wrap.appendChild(input);
    return wrap;
  }

  function buildImageField(section, field, initial) {
    const wrap = document.createElement('div');
    const preview = document.createElement('div');
    preview.className = 'v2-image-preview';
    if (initial) {
      const img = document.createElement('img');
      img.src = initial; img.alt = ''; img.className = 'v2-image-thumb';
      preview.appendChild(img);
    } else {
      preview.textContent = '(no image)';
    }
    wrap.appendChild(preview);

    async function setUrl(url) {
      preview.innerHTML = '';
      const img = document.createElement('img');
      img.src = url; img.alt = ''; img.className = 'v2-image-thumb';
      preview.appendChild(img);
      await applyPatch({ op: 'set', sid: state.selectedSid, key: field.id, value: url });
      postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: state.selectedSid });
    }

    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:6px; margin-top:6px;';
    const libBtn = document.createElement('button');
    libBtn.className = 'v2-btn v2-btn-ghost';
    libBtn.style.flex = '1';
    libBtn.textContent = '📁 Library';
    libBtn.addEventListener('click', () => openAssetLibrary(setUrl));
    row.appendChild(libBtn);
    const upBtn = document.createElement('button');
    upBtn.className = 'v2-btn';
    upBtn.style.flex = '1';
    upBtn.textContent = '⬆ Upload';
    const fileIn = document.createElement('input');
    fileIn.type = 'file'; fileIn.accept = 'image/*'; fileIn.style.display = 'none';
    upBtn.addEventListener('click', () => fileIn.click());
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files && fileIn.files[0]; if (!f) return;
      try { const { url } = await window.v2UploadImage(f); await setUrl(url); }
      catch (e) { toast('Image upload failed.', 'error'); }
    });
    row.appendChild(upBtn);
    wrap.appendChild(row);
    wrap.appendChild(fileIn);
    return wrap;
  }

  // ── Asset library modal ─────────────────────────────────────────────────
  let _assetCallback = null;
  function openAssetLibrary(onPick) {
    _assetCallback = onPick;
    const modal = document.getElementById('v2-asset-modal');
    if (!modal) return;
    modal.classList.add('is-open');
    const list = document.getElementById('v2-asset-list');
    list.innerHTML = '<p style="color:var(--v2-muted);text-align:center;padding:24px;">Loading…</p>';
    fetch(_apiBase() + '/api/media?page=1', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        list.innerHTML = '';
        const posts = (data && data.posts) || [];
        const images = posts.filter(p => (p.media_type === 'image') && p.media_url);
        if (!images.length) {
          list.innerHTML = '<p style="color:var(--v2-muted);text-align:center;padding:24px;">No images uploaded yet.</p>';
          return;
        }
        images.forEach(p => {
          const tile = document.createElement('div');
          tile.className = 'v2-asset-tile';
          tile.innerHTML = `<img src="${escapeHtml(p.media_url)}" alt="" />
                            <div class="v2-asset-tile-label">${escapeHtml(p.title || 'untitled')}</div>`;
          tile.addEventListener('click', () => {
            if (_assetCallback) _assetCallback(p.media_url);
            closeAssetLibrary();
          });
          list.appendChild(tile);
        });
      })
      .catch(() => {
        list.innerHTML = '<p style="color:var(--v2-red);padding:12px;">Failed to load library.</p>';
      });
  }
  function closeAssetLibrary() {
    const modal = document.getElementById('v2-asset-modal');
    if (modal) modal.classList.remove('is-open');
    _assetCallback = null;
  }
  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'v2-asset-close') closeAssetLibrary();
    if (e.target && e.target.id === 'v2-asset-modal') closeAssetLibrary();
  });

  // ── Patch helper (single source of truth for backend writes) ─────────────
  async function applyPatch(patch, opts) {
    opts = opts || {};
    // Snapshot for undo (skip when undo/redo is itself the caller)
    const snapshot = !opts.skipUndo ? JSON.stringify(state.template) : null;
    try {
      const res = await window.v2PatchDraft(state.pageSlug, [patch]);
      state.template = res.template;
      renderTree();
      // If the selected section was affected, re-render its settings panel from new state
      if (state.selectedSid && state.template.sections[state.selectedSid]) {
        // Don't re-render full panel for `set` / `set_block` ops (would lose focus).
        if (patch.op !== 'set' && patch.op !== 'set_block') renderSettings();
      }
      if (snapshot) {
        recordUndo(patch.op, snapshot, JSON.stringify(state.template));
      }
      return res;
    } catch (e) {
      toast('Save failed: ' + (e.message || 'unknown error'), 'error');
      throw e;
    }
  }

  // ── Section picker (Add section) ──────────────────────────────────────────
  function openPicker() {
    elPickerList.innerHTML = '';
    state.registry.forEach(meta => {
      // Default card per type
      const card = document.createElement('div');
      card.className = 'v2-picker-card';
      card.innerHTML = `
        <h4>${escapeHtml(meta.label)}</h4>
        <p>${escapeHtml(meta.description || '')}</p>
      `;
      card.addEventListener('click', async () => {
        closePicker();
        const res = await applyPatch({ op: 'add', type: meta.type });
        const newSid = (res && res.affected_sids || [])[0];
        if (newSid) {
          state.selectedSid = newSid;
          renderSettings();
          renderTree();
          postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: newSid });
        }
      });
      elPickerList.appendChild(card);

      // Per-preset cards
      (meta.presets || []).forEach(preset => {
        const pcard = document.createElement('div');
        pcard.className = 'v2-picker-card v2-picker-preset';
        pcard.innerHTML = `
          <h4>${escapeHtml(preset.name)}</h4>
          <p>${escapeHtml(meta.label)} preset · ${(preset.blocks || []).length} item(s)</p>
        `;
        pcard.addEventListener('click', async () => {
          closePicker();
          // Single round-trip: add op now accepts inline blocks
          const res = await applyPatch({
            op: 'add', type: meta.type,
            settings: preset.settings || {},
            blocks: preset.blocks || [],
          });
          const newSid = (res && res.affected_sids || [])[0];
          if (newSid) {
            state.selectedSid = newSid;
            renderTree();
            renderSettings();
            postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: newSid });
          }
        });
        elPickerList.appendChild(pcard);
      });
    });
    elPicker.classList.add('is-open');
  }
  function closePicker() {
    elPicker.classList.remove('is-open');
  }

  // ── Iframe communication ──────────────────────────────────────────────────
  function postToIframe(msg) {
    if (!state.iframeReady) {
      state.queue.push(msg);
      return;
    }
    try {
      elIframe.contentWindow.postMessage(msg, window.location.origin);
    } catch (_e) { /* ignore */ }
  }
  function flushQueue() {
    state.iframeReady = true;
    hideBanner();
    while (state.queue.length) {
      const m = state.queue.shift();
      try { elIframe.contentWindow.postMessage(m, window.location.origin); } catch (_e) {}
    }
    // After iframe loads, ask it for an inventory of editable items
    setTimeout(() => requestScan(), 600);
  }

  function requestScan() {
    postToIframe({ type: 'cms:scan' });
  }

  function onIframeMessage(event) {
    if (event.origin !== window.location.origin) return;
    const d = event.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'cms:scan:result') {
      // Iframe sent us its editable inventory
      const items = Array.isArray(d.items) ? d.items : [];
      state.existingItems = items;
      // Pre-load site-config + overrides so we can render the labels with values
      Promise.all([
        fetch(_apiBase() + '/api/site-config').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(_apiBase() + '/api/overrides/' + encodeURIComponent(state.pageSlug)).then(r => r.ok ? r.json() : null).catch(() => null),
      ]).then(([cfg, ovr]) => {
        state.siteConfig = (cfg && cfg.config) || {};
        state.siteConfigMeta = (cfg && cfg.meta) || {};
        state.overrides = (ovr && ovr.overrides) || {};
        renderTree();
      });
      return;
    }
    if (d.type === 'cms:inspector:click') {
      // Inspector clicked something in the iframe — select it
      if (d.sectionId) selectSection(d.sectionId);
    } else if (d.type === 'cms:inline:edit') {
      // Stega-tagged element double-clicked in iframe → select section,
      // wait for settings panel render, then scroll & focus the field.
      if (d.sectionId) {
        selectSection(d.sectionId);
        setTimeout(() => focusFieldInPanel(d.field), 50);
      }
    }
  }

  function focusFieldInPanel(fieldId) {
    if (!elSettingsPanel || !fieldId) return;
    const wraps = elSettingsPanel.querySelectorAll('.v2-field');
    for (const wrap of wraps) {
      const label = wrap.querySelector('.v2-field-label');
      if (!label) continue;
      // The field id isn't stored in the DOM, but the label maps to the
      // schema field's `label` and most are unique per section. Match the
      // first input/textarea inside whose surrounding label matches the
      // selected section's setting whose key === fieldId. We do this by
      // looking up the section's schema and finding the matching label.
      const section = state.template.sections[state.selectedSid];
      if (!section) return;
      const meta = state.registry.find(t => t.type === section.type);
      if (!meta) return;
      const field = (meta.settings || []).find(f => f.id === fieldId);
      if (!field) return;
      if (label.textContent.trim() === (field.label || field.id)) {
        wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = wrap.querySelector('input, textarea, select');
        if (input) input.focus();
        wrap.style.outline = '2px solid var(--v2-accent)';
        setTimeout(() => { wrap.style.outline = ''; }, 800);
        return;
      }
    }
  }

  // ── Inspector toggle ──────────────────────────────────────────────────────
  function toggleInspector() {
    state.inspectorOn = !state.inspectorOn;
    elInspectorBtn.classList.toggle('is-on', state.inspectorOn);
    postToIframe({ type: state.inspectorOn ? 'cms:inspector:activate' : 'cms:inspector:deactivate' });
  }

  // ── Publish + share ───────────────────────────────────────────────────────
  async function publish() {
    if (!confirm('Publish current draft to live site?')) return;
    try {
      await window.v2Publish(state.pageSlug);
      toast('Published.', 'ok');
    } catch (e) {
      toast('Publish failed: ' + (e.message || 'error'), 'error');
    }
  }
  async function shareDraft() {
    try {
      const tok = await window.v2IssuePreviewToken(state.pageSlug, 7);
      const path = state.pageSlug === 'home' ? '/' : `/pages/${state.pageSlug}.html`;
      const url  = `${window.location.origin}${path}?preview=1&token=${encodeURIComponent(tok.token)}`;
      try { await navigator.clipboard.writeText(url); } catch (_e) {}
      toast('Preview link copied to clipboard (valid 7 days).', 'ok');
    } catch (e) {
      toast('Could not issue preview token.', 'error');
    }
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  function toast(msg, kind) {
    elToast.textContent = msg;
    elToast.className = 'v2-toast ' + (kind || '');
    elToast.style.opacity = '1';
    setTimeout(() => { elToast.style.opacity = '0'; }, 3500);
  }
  function showBanner(msg) {
    elBanner.textContent = msg;
    elBanner.style.display = 'block';
  }
  function hideBanner() {
    elBanner.style.display = 'none';
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
  function debounce(fn, ms) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // ── Sidebar tabs ────────────────────────────────────────────────────────
  function switchSidebarTab(name) {
    state.sidebarTab = name;
    if (elTabSections) elTabSections.classList.toggle('is-active', name === 'sections');
    if (elTabTheme)    elTabTheme.classList.toggle('is-active',    name === 'theme');
    if (elTabHistory)  elTabHistory.classList.toggle('is-active',  name === 'history');
    if (elPanelSections) elPanelSections.style.display = name === 'sections' ? 'flex'  : 'none';
    if (elPanelTheme)    elPanelTheme.style.display    = name === 'theme'    ? 'block' : 'none';
    if (elPanelHistory)  elPanelHistory.style.display  = name === 'history'  ? 'block' : 'none';
    if (name === 'theme'   && !state.themeSchema) loadTheme();
    if (name === 'history') loadHistory();
  }

  async function loadHistory() {
    if (!elPanelHistory) return;
    elPanelHistory.innerHTML = '<p style="color:var(--v2-muted);">Loading…</p>';
    try {
      const res = await fetch(_apiBase() + '/api/cms/audit?page=' + encodeURIComponent(state.pageSlug) + '&limit=80', {
        credentials: 'include',
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('pnec_token') || '') },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const body = await res.json();
      renderHistory(body.events || []);
    } catch (e) {
      elPanelHistory.innerHTML = '<p style="color:var(--v2-red);">Could not load history.</p>';
    }
  }

  function renderHistory(events) {
    elPanelHistory.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'v2-settings-head';
    head.innerHTML = `<h3>History</h3><p>Recent edits to this page, theme, and overrides.</p>`;
    elPanelHistory.appendChild(head);
    if (!events.length) {
      const p = document.createElement('p');
      p.style.cssText = 'color:var(--v2-muted); padding:8px 0;';
      p.textContent = 'No history yet.';
      elPanelHistory.appendChild(p);
      return;
    }
    events.forEach(e => {
      const row = document.createElement('div');
      row.className = 'v2-history-row';
      const when = e.updated_at ? new Date(e.updated_at) : null;
      const ago  = when ? _timeAgo(when) : '?';
      const iconMap = { page_template: '📄', page_publish: '🚀', theme: '🎨', override: '✏️' };
      row.innerHTML = `
        <div class="v2-history-row-icon">${iconMap[e.kind] || '·'}</div>
        <div class="v2-history-row-body">
          <div class="v2-history-detail">${escapeHtml(e.detail || '')}</div>
          <div class="v2-history-meta">${escapeHtml(e.updated_by_name || '?')} · ${escapeHtml(ago)}</div>
        </div>
      `;
      elPanelHistory.appendChild(row);
    });
  }

  function _timeAgo(d) {
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60)    return s + 's ago';
    if (s < 3600)  return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }

  async function loadTheme() {
    try {
      const [schema, current] = await Promise.all([
        window.v2FetchThemeSchema(),
        window.v2FetchTheme('draft'),
      ]);
      state.themeSchema = schema.groups || {};
      state.themeTokens = current.tokens || {};
    } catch (e) {
      toast('Could not load theme.', 'error');
      state.themeSchema = {};
      state.themeTokens = {};
    }
    renderThemePanel();
  }

  function renderThemePanel() {
    if (!elPanelTheme) return;
    elPanelTheme.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'v2-settings-head';
    head.innerHTML = `<h3>Theme settings</h3><p>Brand-wide colors, typography, layout. Affects every page.</p>`;
    elPanelTheme.appendChild(head);

    Object.keys(state.themeSchema || {}).forEach(group => {
      const groupHead = document.createElement('div');
      groupHead.className = 'v2-token-group-head';
      groupHead.textContent = group.replace(/_/g, ' ');
      elPanelTheme.appendChild(groupHead);
      (state.themeSchema[group] || []).forEach(token => {
        elPanelTheme.appendChild(buildTokenField(token));
      });
    });

    const pubBtn = document.createElement('button');
    pubBtn.className = 'v2-btn';
    pubBtn.style.width = '100%';
    pubBtn.style.marginTop = '14px';
    pubBtn.textContent = 'Publish theme';
    pubBtn.addEventListener('click', async () => {
      if (!confirm('Publish theme tokens to the live site?')) return;
      try {
        await window.v2PublishTheme();
        toast('Theme published.', 'ok');
      } catch (e) { toast('Publish failed.', 'error'); }
    });
    elPanelTheme.appendChild(pubBtn);
  }

  function buildTokenField(token) {
    const wrap = document.createElement('div');
    wrap.className = 'v2-field';
    const label = document.createElement('label');
    label.className = 'v2-field-label';
    label.textContent = token.label;
    wrap.appendChild(label);

    const initial = (state.themeTokens && state.themeTokens[token.key] != null)
                    ? state.themeTokens[token.key] : token.default || '';
    let input;
    if (token.type === 'color') {
      input = document.createElement('input');
      input.type = 'color';
      input.className = 'v2-input v2-color';
      input.value = initial && /^#[0-9a-fA-F]{6}$/.test(initial) ? initial : '#000000';
    } else if (token.type === 'select') {
      input = document.createElement('select');
      input.className = 'v2-input';
      (token.options || []).forEach(opt => {
        const o = document.createElement('option'); o.value = opt; o.textContent = opt;
        if (opt === initial) o.selected = true;
        input.appendChild(o);
      });
    } else if (token.type === 'image') {
      const fileWrap = document.createElement('div');
      const preview = document.createElement('div');
      preview.className = 'v2-image-preview';
      preview.textContent = initial || '(no image)';
      fileWrap.appendChild(preview);
      const file = document.createElement('input');
      file.type = 'file'; file.accept = 'image/*'; file.className = 'v2-input';
      file.addEventListener('change', async () => {
        const f = file.files && file.files[0]; if (!f) return;
        try {
          const { url } = await window.v2UploadImage(f);
          preview.textContent = url;
          await applyThemeTokenChange(token.key, url);
        } catch (e) { toast('Upload failed.', 'error'); }
      });
      fileWrap.appendChild(file);
      wrap.appendChild(fileWrap);
      return wrap;
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.className = 'v2-input';
      input.value = initial || '';
    }
    input.addEventListener('input', debounce(async () => {
      await applyThemeTokenChange(token.key, input.value);
    }, 300));
    wrap.appendChild(input);
    return wrap;
  }

  async function applyThemeTokenChange(key, value) {
    state.themeTokens[key] = value;
    try {
      await window.v2PatchThemeDraft({ [key]: value });
      // Update iframe live: post a CSS variable update message
      postToIframe({ type: 'cms:theme:update', key, value });
    } catch (e) { toast('Theme save failed.', 'error'); }
  }

  // ── Viewport toggle ─────────────────────────────────────────────────────
  function setViewport(name) {
    state.viewport = name;
    if (elViewportBtns) elViewportBtns.forEach(b => b.classList.toggle('is-active', b.dataset.viewport === name));
    if (!elIframeFrame) return;
    elIframeFrame.classList.remove('v2-vp-desktop', 'v2-vp-tablet', 'v2-vp-mobile');
    elIframeFrame.classList.add('v2-vp-' + name);
  }

  // ── Undo / redo ─────────────────────────────────────────────────────────
  function recordUndo(label, beforeJson, afterJson) {
    state.undoStack.push({ label, beforeJson, afterJson });
    if (state.undoStack.length > 50) state.undoStack.shift();
    state.redoStack = [];
    refreshUndoButtons();
  }
  function refreshUndoButtons() {
    if (elUndoBtn) elUndoBtn.disabled = state.undoStack.length === 0;
    if (elRedoBtn) elRedoBtn.disabled = state.redoStack.length === 0;
  }
  async function undo() {
    const item = state.undoStack.pop();
    if (!item) return;
    state.redoStack.push(item);
    try {
      await applyPatch({ op: 'replace_template', template: JSON.parse(item.beforeJson) }, { skipUndo: true });
      pointIframe(state.pageSlug);
      toast('Undid: ' + item.label, 'ok');
    } catch (e) { toast('Undo failed.', 'error'); }
    refreshUndoButtons();
  }
  async function redo() {
    const item = state.redoStack.pop();
    if (!item) return;
    state.undoStack.push(item);
    try {
      await applyPatch({ op: 'replace_template', template: JSON.parse(item.afterJson) }, { skipUndo: true });
      pointIframe(state.pageSlug);
      toast('Redid: ' + item.label, 'ok');
    } catch (e) { toast('Redo failed.', 'error'); }
    refreshUndoButtons();
  }
  function onKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  }

  // ── Picker search filter ────────────────────────────────────────────────
  function filterPicker() {
    const q = (elPickerSearch.value || '').toLowerCase().trim();
    elPickerList.querySelectorAll('.v2-picker-card').forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = !q || text.includes(q) ? '' : 'none';
    });
  }

  // ── AI section generation ──────────────────────────────────────────────
  async function generateSectionFromAi() {
    const prompt = (elAiPrompt && elAiPrompt.value || '').trim();
    if (!prompt) { toast('Type a prompt first.', 'error'); return; }
    elAiGo.disabled = true;
    elAiGo.textContent = 'Thinking…';
    try {
      const ctx = { existing_section_types: state.template.order.map(sid => (state.template.sections[sid] || {}).type) };
      const section = await window.v2GenerateSection(prompt, state.pageSlug, ctx);
      // Single round-trip with inline blocks
      const res = await applyPatch({
        op: 'add',
        type: section.type,
        settings: section.settings || {},
        blocks: Array.isArray(section.blocks) ? section.blocks : [],
      });
      const newSid = (res && res.affected_sids || [])[0];
      if (newSid) {
        state.selectedSid = newSid;
        renderSettings();
        renderTree();
        postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: newSid });
      }
      closePicker();
      toast('AI added a ' + section.type + ' section.', 'ok');
      elAiPrompt.value = '';
    } catch (e) {
      toast('AI request failed: ' + (e.message || 'unknown'), 'error');
    }
    elAiGo.disabled = false;
    elAiGo.textContent = '✨ Generate with AI';
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
