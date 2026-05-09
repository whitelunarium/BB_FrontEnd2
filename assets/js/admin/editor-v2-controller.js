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
    // v2.20 additions
    multiSelected: new Set(),  // sids selected in addition to selectedSid (for bulk ops)
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
  let elTabSections, elTabTheme, elTabSeo, elTabHistory;
  let elPanelSections, elPanelTheme, elPanelSeo, elPanelHistory;
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
    elTabSeo        = document.getElementById('v2-tab-seo');
    elTabHistory    = document.getElementById('v2-tab-history');
    elPanelSections = document.getElementById('v2-panel-sections');
    elPanelTheme    = document.getElementById('v2-panel-theme');
    elPanelSeo      = document.getElementById('v2-panel-seo');
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
    if (elTabSeo)      elTabSeo.addEventListener('click',      () => switchSidebarTab('seo'));
    if (elTabHistory)  elTabHistory.addEventListener('click',  () => switchSidebarTab('history'));
    const treeSearch = document.getElementById('v2-tree-search');
    if (treeSearch) treeSearch.addEventListener('input', filterTree);
    const helpBtn = document.getElementById('v2-help');
    const helpClose = document.getElementById('v2-help-close');
    if (helpBtn)   helpBtn.addEventListener('click', openHelp);
    if (helpClose) helpClose.addEventListener('click', closeHelp);

    // Cross-page find (Cmd-K spotlight)
    const findBtn   = document.getElementById('v2-find');
    const findClose = document.getElementById('v2-find-close');
    const findInput = document.getElementById('v2-find-input');
    const findModal = document.getElementById('v2-find-modal');
    if (findBtn)   findBtn.addEventListener('click', openFindModal);
    if (findClose) findClose.addEventListener('click', closeFindModal);
    if (findInput) findInput.addEventListener('input', debounce(runFind, 180));
    if (findInput) findInput.addEventListener('keydown', onFindKey);
    if (findModal) findModal.addEventListener('click', (ev) => {
      if (ev.target === findModal) closeFindModal();
    });

    const exportBtn = document.getElementById('v2-export');
    const importBtn = document.getElementById('v2-import');
    const importFile = document.getElementById('v2-import-file');
    if (exportBtn) exportBtn.addEventListener('click', exportPage);
    if (importBtn && importFile) {
      importBtn.addEventListener('click', () => importFile.click());
      importFile.addEventListener('change', importPage);
    }
    const dupBtn = document.getElementById('v2-duplicate-page');
    if (dupBtn) dupBtn.addEventListener('click', duplicatePage);
    const createBtn = document.getElementById('v2-create-page');
    if (createBtn) createBtn.addEventListener('click', createBlankPage);
    document.addEventListener('click', (e) => {
      if (e.target && e.target.id === 'v2-help-overlay') closeHelp();
    });
    if (elViewportBtns) elViewportBtns.forEach(btn =>
      btn.addEventListener('click', () => setViewport(btn.dataset.viewport)));
    if (elUndoBtn) elUndoBtn.addEventListener('click', undo);
    if (elRedoBtn) elRedoBtn.addEventListener('click', redo);
    if (elPickerSearch) elPickerSearch.addEventListener('input', filterPicker);
    if (elAiGo) elAiGo.addEventListener('click', generateSectionFromAi);
    const aiGoPage = document.getElementById('v2-ai-go-page');
    if (aiGoPage) aiGoPage.addEventListener('click', generatePageFromAi);

    window.addEventListener('message', onIframeMessage);
    document.addEventListener('keydown', onKey);
    // Browser back/forward should switch pages too — updates from pushState.
    window.addEventListener('popstate', () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const want = (params.get('page') || 'home').trim();
        if (want && want !== state.pageSlug) {
          // Sync select + state without re-pushing into history (popstate
          // already updated the URL).
          if (elPageSel) elPageSel.value = want;
          state.pageSlug = want;
          state.selectedSid = null;
          state.selectedBid = null;
          loadPage(want);
        }
      } catch (_e) {}
    });

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
          // Pretty-print: _header → 🧭 Header (group), _footer → 🦶 Footer (group)
          if (p.page_slug === '_header')      opt.textContent = '🧭 Header (section group)';
          else if (p.page_slug === '_footer') opt.textContent = '🦶 Footer (section group)';
          else opt.textContent = p.page_slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          elPageSel.appendChild(opt);
        });
      }
    } catch (_e) { /* ignore */ }

    // Honor ?page=<slug> query param from "Edit this page" deep links so
    // the editor opens the page the admin was just looking at.
    try {
      const params = new URLSearchParams(window.location.search);
      const want = (params.get('page') || '').trim();
      if (want) {
        // Add the option to the selector if not already present (e.g., a
        // page that was created after the registry was last loaded).
        const known = new Set(Array.from(elPageSel.options).map(o => o.value));
        if (!known.has(want)) {
          const opt = document.createElement('option');
          opt.value = want;
          opt.textContent = want.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          elPageSel.appendChild(opt);
        }
        elPageSel.value = want;
        state.pageSlug  = want;
      }
    } catch (_e) { /* ignore */ }

    await loadPage(state.pageSlug);
  }

  // ── Page loading ──────────────────────────────────────────────────────────
  async function switchPage(slug) {
    state.pageSlug = slug;
    state.selectedSid = null;
    state.selectedBid = null;
    // Reflect the active page in the URL so refresh/share-tab restores it.
    // pushState (not replace) so the back button cycles through edited pages.
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('page', slug);
      window.history.pushState({ page: slug }, '', u.toString());
    } catch (_e) { /* ignore in non-browser test env */ }
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
    let path;
    if (slug === 'home')      path = '/';
    else if (slug === '_header' || slug === '_footer') {
      // Preview header/footer on a Jekyll-managed page that has the host divs
      path = '/pages/admin.html';
    }
    else path = `/pages/${slug}.html`;
    const url  = path + (path.indexOf('?') === -1 ? '?preview=1' : '&preview=1');
    elIframe.src = url;
    elIframeUrl.textContent = url;
    state.iframeReady = false;
    state.queue = [];
    // Show loading spinner — cleared when flushQueue() fires on iframe load.
    if (elIframeFrame) elIframeFrame.classList.add('is-loading');
  }

  // ── Sidebar tree ──────────────────────────────────────────────────────────
  function renderTree() {
    elSidebarTree.innerHTML = '';
    // Refresh status-bar stats whenever the tree changes
    updateStatusStats();

    // ── Group A: Existing content (v1 site-config + page-overrides) ──
    const existing = (state.existingItems || []).filter(i => i.kind === 'site_config' || i.kind === 'override');
    if (existing.length) {
      // Sort: site_config grouped + alphabetical, then overrides alphabetical.
      // This makes navbar/footer keys (nav_*, brand_*, footer_*) cluster together
      // and feel intentional rather than scattered.
      existing.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'site_config' ? -1 : 1;
        return (a.label || a.key).localeCompare(b.label || b.key);
      });
      const groupHead = document.createElement('div');
      groupHead.className = 'v2-tree-group-head';
      groupHead.textContent = 'Existing content';
      elSidebarTree.appendChild(groupHead);
      existing.forEach(item => {
        const row = document.createElement('div');
        row.className = 'v2-tree-row v2-tree-existing'
          + (state.selectedExisting && state.selectedExisting.key === item.key && state.selectedExisting.kind === item.kind ? ' is-selected' : '');
        // v3: stamp a stable key on the row so the cross-page search
        // jumper can land on it directly (`data-existing-key`).
        const existingKey = item.kind === 'site_config'
          ? 'site_config:' + item.key
          : 'override:' + (state.pageSlug || '') + ':' + item.key;
        row.setAttribute('data-existing-key', existingKey);
        // Prefer the backend's friendly label from siteConfigMeta when available;
        // fall back to the auto-generated _humanLabel(key) from hydrate.js.
        let label = item.label;
        if (item.kind === 'site_config' && state.siteConfigMeta && state.siteConfigMeta[item.key]) {
          label = state.siteConfigMeta[item.key].label || label;
        }
        const icon = item.kind === 'site_config' ? '🌐' : '✏️';
        row.innerHTML = `
          <span class="v2-tree-handle" style="visibility:hidden;">⋮⋮</span>
          <span class="v2-tree-label">${icon} ${escapeHtml(label)}</span>
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
      empty.className = 'v2-empty v2-empty-onboarding';
      empty.innerHTML = `
        <div style="font-size:1.6rem;text-align:center;padding:14px 0;">✨</div>
        <div style="text-align:center;font-weight:600;color:var(--v2-text);">No sections on this page yet.</div>
        <div style="text-align:center;color:var(--v2-muted);font-size:.85rem;margin:6px 0 14px;">Click <kbd>A</kbd> or the button below to add your first section. Try a preset like <em>Volunteer Signup</em> or <em>Wildfire Red Flag</em>.</div>
      `;
      elSidebarTree.appendChild(empty);
      return;
    }
    const issuesBySid = (state.lintIssues || []).reduce((acc, i) => {
      (acc[i.sectionId] = acc[i.sectionId] || []).push(i);
      return acc;
    }, {});

    state.template.order.forEach((sid, idx) => {
      const section = state.template.sections[sid];
      if (!section) return;
      const meta = state.registry.find(t => t.type === section.type);
      const sidIssues = issuesBySid[sid] || [];
      const displayLabel = section.name || (meta ? meta.label : section.type);
      const row = document.createElement('div');
      row.className = 'v2-tree-row'
        + (sid === state.selectedSid ? ' is-selected' : '')
        + (state.multiSelected.has(sid) ? ' is-multi-selected' : '');
      row.draggable = true;
      row.dataset.sid = sid;
      row.tabIndex = 0;
      row.setAttribute('role', 'treeitem');
      row.setAttribute('aria-selected', sid === state.selectedSid ? 'true' : 'false');
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectSection(sid); }
        else if (e.key === 'F2') { e.preventDefault(); handleSectionAction(sid, 'rename'); }
        else if (e.key === 'Delete' || e.key === 'Backspace') {
          if (e.shiftKey) { e.preventDefault(); handleSectionAction(sid, 'delete'); }
        }
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const rows = Array.from(elSidebarTree.querySelectorAll('.v2-tree-row[data-sid]'));
          const idx = rows.indexOf(row);
          const next = e.key === 'ArrowDown' ? rows[idx + 1] : rows[idx - 1];
          if (next) next.focus();
        }
        else if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
          e.preventDefault();
          copySectionToClipboard(sid);
        }
        else if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
          e.preventDefault();
          pasteSectionFromClipboard();
        }
      });

      const warnBadge = sidIssues.length
        ? `<span class="v2-tree-warn" title="${escapeHtml(sidIssues.map(i => i.message).join('\n'))}">⚠ ${sidIssues.length}</span>`
        : '';
      const typeIcon = (window.V2_ICONS ? window.V2_ICONS.svg(section.type, { size: 14 }) : '');
      const ic = (key) => (window.V2_ICONS ? window.V2_ICONS.svg('action.' + key, { size: 14 }) : '');
      row.innerHTML = `
        <span class="v2-tree-handle" title="Drag to reorder">${(window.V2_ICONS ? window.V2_ICONS.svg('action.drag', { size: 12 }) : '⋮⋮')}</span>
        <span class="v2-tree-type-icon" aria-hidden="true">${typeIcon}</span>
        <span class="v2-tree-label" title="${escapeHtml(meta ? meta.label : section.type)}">${escapeHtml(displayLabel)}${section.name ? ' <span class=\"v2-tree-type-pill\">' + escapeHtml(meta ? meta.label : section.type) + '</span>' : ''}</span>
        ${warnBadge}
        <span class="v2-tree-actions">
          <button class="v2-icon-btn" data-act="rename"     title="Rename">${ic('rename')}</button>
          <button class="v2-icon-btn" data-act="visibility" title="${section.visible === false ? 'Show' : 'Hide'}">${section.visible === false ? ic('visibility_hide') : ic('visibility_show')}</button>
          <button class="v2-icon-btn" data-act="duplicate"  title="Duplicate">${ic('duplicate')}</button>
          <button class="v2-icon-btn" data-act="delete"     title="Delete">${ic('delete')}</button>
        </span>
      `;
      row.addEventListener('click', (e) => {
        if (e.target.closest('.v2-icon-btn')) return;
        if (e.shiftKey && state.selectedSid) {
          // Shift+click → range-select from current primary to here
          extendSelectionTo(sid);
          e.preventDefault();
          return;
        }
        if (e.metaKey || e.ctrlKey) {
          // Cmd/Ctrl+click → toggle this sid in the multi-selected set
          toggleMultiSelect(sid);
          e.preventDefault();
          return;
        }
        // Plain click → clear multi-selection and pick a single primary
        if (state.multiSelected.size) {
          state.multiSelected.clear();
          renderBulkBar();
        }
        selectSection(sid);
      });
      row.addEventListener('mouseenter', () => postToIframe({ type: 'cms:section:hover', sectionId: sid }));
      row.addEventListener('mouseleave', () => postToIframe({ type: 'cms:section:hover', sectionId: null }));
      row.addEventListener('contextmenu', (e) => { e.preventDefault(); openContextMenu(e, sid); });
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
    renderBulkBar();
    postToIframe({ type: 'cms:section:select', sectionId: sid });
  }

  // ── Multi-select (Shift / Cmd-click on tree rows) ────────────────────────
  function toggleMultiSelect(sid) {
    // Cmd/Ctrl-click toggles this sid in the auxiliary set, leaving the
    // primary selection (state.selectedSid) intact.
    if (state.multiSelected.has(sid)) state.multiSelected.delete(sid);
    else                              state.multiSelected.add(sid);
    renderTree();
    renderBulkBar();
  }
  function extendSelectionTo(sid) {
    // Shift-click range-selects all sids between state.selectedSid and sid
    // in the rendered order. The primary doesn't change; the in-between sids
    // get added to multiSelected.
    if (!state.selectedSid || sid === state.selectedSid) return;
    const order = state.template.order;
    const a = order.indexOf(state.selectedSid);
    const b = order.indexOf(sid);
    if (a < 0 || b < 0) return;
    const [lo, hi] = a < b ? [a, b] : [b, a];
    state.multiSelected.clear();
    for (let i = lo; i <= hi; i++) {
      if (order[i] !== state.selectedSid) state.multiSelected.add(order[i]);
    }
    renderTree();
    renderBulkBar();
  }
  function clearMultiSelect() {
    if (!state.multiSelected.size) return;
    state.multiSelected.clear();
    renderTree();
    renderBulkBar();
  }
  // All sids the user wants to act on: primary + multi-selected
  function getActiveSids() {
    const sids = new Set(state.multiSelected);
    if (state.selectedSid) sids.add(state.selectedSid);
    return Array.from(sids);
  }
  function renderBulkBar() {
    let bar = document.getElementById('v2-bulk-bar');
    const count = state.multiSelected.size + (state.selectedSid && state.multiSelected.size ? 1 : 0);
    if (state.multiSelected.size === 0) {
      if (bar) bar.remove();
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'v2-bulk-bar';
      bar.className = 'v2-bulk-bar';
      const container = elSidebarTree && elSidebarTree.parentElement;
      if (container) container.appendChild(bar);
      else document.body.appendChild(bar);
    }
    bar.innerHTML = `
      <span class="v2-bulk-count">${count} selected</span>
      <button class="v2-btn v2-btn-ghost"  data-bulk="visibility-hide" title="Hide all">🙈 Hide</button>
      <button class="v2-btn v2-btn-ghost"  data-bulk="visibility-show" title="Show all">👁 Show</button>
      <button class="v2-btn v2-btn-ghost"  data-bulk="duplicate"        title="Duplicate all">⧉ Duplicate</button>
      <button class="v2-btn v2-btn-ghost v2-bulk-danger" data-bulk="delete" title="Delete all">🗑 Delete</button>
      <button class="v2-btn v2-btn-ghost"  data-bulk="clear"            title="Clear selection">✕</button>
    `;
    bar.querySelectorAll('button[data-bulk]').forEach(btn => {
      btn.addEventListener('click', () => bulkAction(btn.dataset.bulk));
    });
  }
  async function bulkAction(action) {
    const sids = getActiveSids();
    if (!sids.length) return;
    if (action === 'clear') { clearMultiSelect(); return; }
    if (action === 'delete') {
      // Build a single batch of `remove` patches — backend processes them
      // atomically so undo can roll all of them back as one.
      const patches = sids.map(sid => ({ op: 'remove', sid }));
      await applyPatchBatch(patches);
      sids.forEach(sid => postToIframe({ type: 'cms:section:remove', sectionId: sid }));
      // If primary was deleted, clear it
      if (state.selectedSid && sids.includes(state.selectedSid)) state.selectedSid = null;
      clearMultiSelect();
      renderSettings();
      toast('Deleted ' + sids.length + ' section' + (sids.length === 1 ? '' : 's') + '.', 'ok', {
        action: { label: 'Undo', fn: () => undo() },
        duration: 8000,
      });
      return;
    }
    if (action === 'duplicate') {
      const patches = sids.map(sid => ({ op: 'duplicate', sid }));
      const res = await applyPatchBatch(patches);
      const newSids = (res && res.affected_sids || []).filter(x => !sids.includes(x));
      newSids.forEach(sid => postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: sid }));
      clearMultiSelect();
      return;
    }
    if (action === 'visibility-hide' || action === 'visibility-show') {
      const visible = action === 'visibility-show';
      const patches = sids.map(sid => ({ op: 'visibility', sid, visible }));
      await applyPatchBatch(patches);
      sids.forEach(sid => postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: sid }));
      clearMultiSelect();
      return;
    }
  }
  // Tiny convenience: send N patches in one PATCH (server processes them in order
  // and gives us the union of affected sids).
  async function applyPatchBatch(patches) {
    if (!patches || !patches.length) return null;
    const beforeJson = JSON.stringify(state.template);
    setStatus('saving');
    try {
      const res = await window.v2PatchDraft(state.pageSlug, patches);
      state.template = res.template;
      setStatus('saved', 'last edit ' + new Date().toLocaleTimeString());
      recordUndo('bulk:' + patches.length, beforeJson, JSON.stringify(state.template));
      renderTree();
      setTimeout(requestScan, 400);
      return res;
    } catch (e) {
      setStatus('error', e.message || '');
      toast('Bulk action failed: ' + (e.message || ''), 'error');
      return null;
    }
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
    // BUG FIX (v2.37): capture the page slug at panel-render time, not at
    // save-fire time. Otherwise typing fast + switching pages quickly would
    // save the typed value to the NEW page's overrides instead of the old.
    const slugAtRender = state.pageSlug;
    input.addEventListener('input', debounce(async () => {
      await applyExistingChange(item, input.value, { slug: slugAtRender });
    }, 250));
    wrap.appendChild(input);
    elSettingsPanel.appendChild(wrap);

    // Reset to default — only meaningful for overrides (per-page text);
    // site-config keys have a global default that shipped with the build,
    // so resetting them just deletes the override row and the original
    // HTML default reappears on next page load.
    const resetBtn = document.createElement('button');
    resetBtn.className = 'v2-btn v2-btn-ghost';
    resetBtn.style.cssText = 'margin-top:8px; font-size:.78rem;';
    resetBtn.textContent = '↻ Reset to default';
    resetBtn.title = 'Remove this override and use the original page text';
    resetBtn.addEventListener('click', async () => {
      if (!confirm('Reset "' + (item.label || item.key) + '" back to the original?')) return;
      await resetExistingChange(item);
      // Clear the input + reflect cleared state in the iframe
      input.value = '';
      // Trigger a soft reload of the iframe so the original text shows
      try { elIframe.contentWindow.location.reload(); } catch (_e) {}
    });
    elSettingsPanel.appendChild(resetBtn);
  }

  async function resetExistingChange(item) {
    try {
      let url;
      if (item.kind === 'override') {
        url = _apiBase() + '/api/overrides/' + encodeURIComponent(state.pageSlug)
              + '/' + encodeURIComponent(item.key);
      } else if (item.kind === 'site_config') {
        url = _apiBase() + '/api/site-config/' + encodeURIComponent(item.key);
      } else { return; }
      const res = await fetch(url, {
        method: 'DELETE', credentials: 'include',
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('pnec_token') || '') },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      // Forget the value in local state too so the sidebar peek text refreshes
      if (item.kind === 'override' && state.overrides) delete state.overrides[item.key];
      if (item.kind === 'site_config' && state.siteConfig) delete state.siteConfig[item.key];
      toast('Reset to default ✓', 'ok', {
        action: { label: 'Undo', fn: () => { /* the user just deleted; undo would re-set what they had — we don't track that yet */ } },
      });
    } catch (e) {
      toast('Reset failed: ' + (e.message || ''), 'error');
    }
  }

  async function applyExistingChange(item, value, opts) {
    opts = opts || {};
    // For overrides, prefer the slug captured at the call site (typing-time);
    // falls back to current state.pageSlug for back-compat with old callers.
    const slug = opts.slug || state.pageSlug;
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
      } catch (e) { toast(_humanizeError('Save failed', e), 'error'); }
    } else if (item.kind === 'override') {
      try {
        const res = await fetch(_apiBase() + '/api/overrides/' + encodeURIComponent(slug), {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json',
                     'Authorization': 'Bearer ' + (localStorage.getItem('pnec_token') || '') },
          body: JSON.stringify({ element_id: item.key, content: value }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        // Only update local state cache when we're STILL on the same page —
        // otherwise we'd be polluting the new page's cached overrides.
        if (slug === state.pageSlug && state.overrides) state.overrides[item.key] = value;
        // Don't post cms-update if the iframe has navigated to a different
        // page in the meantime (the new page wouldn't have this element).
        if (slug === state.pageSlug) {
          postToIframe({ type: 'cms-update', kind: 'override', key: item.key, value });
        }
      } catch (e) { toast(_humanizeError('Save failed', e), 'error'); }
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
    } else if (action === 'rename') {
      // Give the section a friendly display name (independent of its type).
      const section = state.template.sections[sid];
      if (!section) return;
      const meta = state.registry.find(t => t.type === section.type);
      const fallback = meta ? meta.label : section.type;
      const current  = section.name || '';
      const next     = window.prompt(
        'Rename this section\n\nLeave blank to reset to the default ("' + fallback + '").',
        current,
      );
      if (next === null) return; // user cancelled
      await applyPatch({ op: 'rename', sid, name: next });
      // Tree row content changed — settings panel header is unaffected
    } else if (action === 'delete') {
      // Capture a label for the toast before we lose the section
      const sec = state.template.sections[sid];
      const meta = state.registry.find(t => t.type === sec.type);
      const label = sec.name || (meta ? meta.label : sec.type);
      // No more confirm() — Gmail-style instant action with undo toast.
      await applyPatch({ op: 'remove', sid });
      postToIframe({ type: 'cms:section:remove', sectionId: sid });
      if (state.selectedSid === sid) {
        state.selectedSid = null;
        renderSettings();
      }
      toast('Deleted "' + label + '".', 'ok', {
        action: { label: 'Undo', fn: () => undo() },
        duration: 8000,
      });
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

    // Layout overrides (spacing + background) — collapsible
    elSettingsPanel.appendChild(buildLayoutSection(section));

    // Lint issues for the selected section
    const issues = (state.lintIssues || []).filter(i => i.sectionId === state.selectedSid);
    if (issues.length) {
      const wrap = document.createElement('div');
      wrap.className = 'v2-lint';
      wrap.innerHTML = `<div class="v2-lint-head">⚠ ${issues.length} issue${issues.length > 1 ? 's' : ''}</div>` +
        '<ul>' + issues.map(i => `<li>${escapeHtml(i.message)}</li>`).join('') + '</ul>';
      elSettingsPanel.appendChild(wrap);
    }
  }

  function buildBlocksList(section, meta) {
    const wrap = document.createElement('div');
    wrap.className = 'v2-blocks';
    const header = document.createElement('div');
    header.className = 'v2-blocks-header';
    header.innerHTML = `
      <span>Items</span>
      <span class="v2-blocks-header-actions">
        <button class="v2-icon-btn" data-blk-act="copy-all"  title="Copy every item — paste into any matching section on any page">📋 All</button>
        <button class="v2-icon-btn" data-blk-act="paste-all" title="Paste blocks from clipboard">📥</button>
      </span>
    `;
    header.querySelector('[data-blk-act="copy-all"]').addEventListener('click', () => copyAllBlocksToClipboard(section));
    header.querySelector('[data-blk-act="paste-all"]').addEventListener('click', () => pasteBlockFromClipboard(section, meta));
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

    // Add block + paste row
    const addRow = document.createElement('div');
    addRow.style.cssText = 'display:flex; gap:6px; margin-top:8px;';
    const addBtn = document.createElement('button');
    addBtn.className = 'v2-btn v2-btn-ghost';
    addBtn.style.flex = '1';
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
    addRow.appendChild(addBtn);
    const pasteBtn = document.createElement('button');
    pasteBtn.className = 'v2-btn v2-btn-ghost';
    pasteBtn.title = 'Paste block from clipboard';
    pasteBtn.textContent = '📥';
    pasteBtn.addEventListener('click', () => pasteBlockFromClipboard(section, meta));
    addRow.appendChild(pasteBtn);
    wrap.appendChild(addRow);
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
    // Right-click on the summary copies/pastes blocks
    summary.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openBlockContextMenu(e, section, bid, blockMeta);
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

  function buildLayoutSection(section) {
    const wrap = document.createElement('details');
    wrap.className = 'v2-layout-section';
    const layout = section.layout || {};
    const summary = document.createElement('summary');
    summary.innerHTML = '<span class="v2-layout-summary-icon">📐</span> Layout & spacing';
    wrap.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'v2-layout-body';

    const fields = [
      { key: 'padding_top',      label: 'Padding top',     placeholder: 'e.g. 64px' },
      { key: 'padding_bottom',   label: 'Padding bottom',  placeholder: 'e.g. 64px' },
      { key: 'background_color', label: 'Background color (hex or scheme var)', placeholder: '#fff or var(--cms-scheme-2-bg)' },
      { key: 'text_color',       label: 'Text color',      placeholder: '#1e293b' },
      { key: 'background_image', label: 'Background image URL', placeholder: 'https://…' },
      { key: 'max_width',        label: 'Max content width', placeholder: 'e.g. 720px or 100%' },
    ];
    fields.forEach(f => {
      const row = document.createElement('div');
      row.className = 'v2-field';
      const lbl = document.createElement('label');
      lbl.className = 'v2-field-label';
      lbl.textContent = f.label;
      row.appendChild(lbl);
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'v2-input';
      input.value = layout[f.key] || '';
      input.placeholder = f.placeholder;
      input.addEventListener('input', debounce(async () => {
        await applyPatch({ op: 'layout', sid: state.selectedSid, updates: { [f.key]: input.value } });
        postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: state.selectedSid });
      }, 300));
      row.appendChild(input);
      body.appendChild(row);
    });

    // Color scheme buttons — quick presets that fill BG + text together
    const schemeRow = document.createElement('div');
    schemeRow.className = 'v2-field';
    const schemeLbl = document.createElement('label');
    schemeLbl.className = 'v2-field-label';
    schemeLbl.textContent = 'Color scheme (apply preset)';
    schemeRow.appendChild(schemeLbl);
    const schemeBtns = document.createElement('div');
    schemeBtns.className = 'v2-scheme-row';
    [1, 2, 3, 4].forEach(n => {
      const btn = document.createElement('button');
      btn.className = 'v2-scheme-btn';
      btn.style.background = `var(--cms-scheme-${n}-bg, #fff)`;
      btn.style.color      = `var(--cms-scheme-${n}-text, #000)`;
      btn.textContent = `${n}`;
      btn.title = `Apply scheme ${n}`;
      btn.addEventListener('click', async () => {
        const updates = {
          background_color: `var(--cms-scheme-${n}-bg)`,
          text_color:       `var(--cms-scheme-${n}-text)`,
        };
        await applyPatch({ op: 'layout', sid: state.selectedSid, updates });
        postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: state.selectedSid });
        renderSettings();
      });
      schemeBtns.appendChild(btn);
    });
    schemeRow.appendChild(schemeBtns);
    body.appendChild(schemeRow);

    // Entrance animation — applied as a CSS class on the rendered section
    const animRow = document.createElement('div');
    animRow.className = 'v2-field';
    const animLbl = document.createElement('label');
    animLbl.className = 'v2-field-label';
    animLbl.textContent = 'Entrance animation (plays on first scroll-into-view)';
    animRow.appendChild(animLbl);
    const animSel = document.createElement('select');
    animSel.className = 'v2-input';
    [
      { v: '',          t: 'None' },
      { v: 'fade-in',   t: 'Fade in' },
      { v: 'fade-up',   t: 'Fade up' },
      { v: 'fade-down', t: 'Fade down' },
      { v: 'slide-left',  t: 'Slide in from left' },
      { v: 'slide-right', t: 'Slide in from right' },
      { v: 'zoom-in',   t: 'Zoom in' },
    ].forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.v; o.textContent = opt.t;
      if ((layout.animation || '') === opt.v) o.selected = true;
      animSel.appendChild(o);
    });
    animSel.addEventListener('change', async () => {
      await applyPatch({ op: 'layout', sid: state.selectedSid, updates: { animation: animSel.value } });
      postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: state.selectedSid });
    });
    animRow.appendChild(animSel);
    body.appendChild(animRow);

    // Reset button
    const reset = document.createElement('button');
    reset.className = 'v2-btn v2-btn-ghost';
    reset.style.width = '100%';
    reset.style.marginTop = '6px';
    reset.textContent = 'Reset layout';
    reset.addEventListener('click', async () => {
      const updates = {};
      ['padding_top','padding_bottom','background_color','background_image','text_color','max_width','animation']
        .forEach(k => { updates[k] = ''; });
      await applyPatch({ op: 'layout', sid: state.selectedSid, updates });
      postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: state.selectedSid });
      renderSettings();
    });
    body.appendChild(reset);

    wrap.appendChild(body);
    return wrap;
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
    let richtextCounter = null;
    if (field.type === 'richtext') {
      input = document.createElement('textarea');
      input.className = 'v2-input v2-textarea';
      input.rows = 5;
      input.value = initial || '';
      input.spellcheck = true;
      richtextCounter = document.createElement('div');
      richtextCounter.className = 'v2-richtext-counter';
      const upd = () => {
        const txt = (input.value || '').replace(/<[^>]*>/g, ' ').trim();
        const words = txt ? txt.split(/\s+/).length : 0;
        const minutes = Math.max(1, Math.round(words / 230));
        richtextCounter.textContent = `${words} words · ~${minutes} min read · ${input.value.length} chars`;
      };
      upd();
      input.addEventListener('input', upd);
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
    if (richtextCounter) wrap.appendChild(richtextCounter);

    // Reset-to-default button (only when current value differs from default)
    if ('default' in field && initial !== field.default) {
      const reset = document.createElement('button');
      reset.className = 'v2-btn v2-btn-ghost';
      reset.style.cssText = 'margin-top:4px; font-size:.7rem; padding:3px 8px;';
      reset.textContent = '↻ Reset to default';
      reset.title = 'Reset this field to ' + JSON.stringify(field.default);
      reset.addEventListener('click', async () => {
        if (input.tagName === 'SELECT') input.value = field.default;
        else input.value = field.default || '';
        await applyPatch({ op: 'set', sid: state.selectedSid, key: field.id, value: field.default });
        postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: state.selectedSid });
        renderSettings();
      });
      wrap.appendChild(reset);
    }

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
    // AI alt button — only shown when there's already an image and the field id suggests alt
    if (initial && /image/i.test(field.id)) {
      const altBtn = document.createElement('button');
      altBtn.className = 'v2-btn v2-btn-ghost';
      altBtn.title = 'Generate alt text with AI for the matching alt field';
      altBtn.style.flex = '0 0 auto';
      altBtn.textContent = '✨ alt';
      altBtn.addEventListener('click', async () => {
        altBtn.disabled = true; altBtn.textContent = '✨…';
        try {
          const res = await fetch(_apiBase() + '/api/cms/ai/alt-text', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json',
                       'Authorization': 'Bearer ' + (localStorage.getItem('pnec_token') || '') },
            body: JSON.stringify({ image_url: initial,
                                   context: 'Section type: ' + (section.type || '') }),
          });
          if (!res.ok) throw new Error('AI ' + res.status);
          const body = await res.json();
          // Find an alt-like sibling field on the same section and write into it
          const altKey = (state.registry.find(t => t.type === section.type) || {}).settings || [];
          const altField = altKey.find(f => /alt/i.test(f.id));
          if (altField) {
            await applyPatch({ op: 'set', sid: state.selectedSid, key: altField.id, value: body.alt });
            postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: state.selectedSid });
            renderSettings();
            toast('AI alt: "' + body.alt + '"', 'ok');
          } else {
            toast('No alt field on this section.', 'error');
          }
        } catch (e) { toast('AI alt failed.', 'error'); }
        altBtn.disabled = false; altBtn.textContent = '✨ alt';
      });
      row.appendChild(altBtn);
    }
    fileIn.addEventListener('change', async () => {
      const f = fileIn.files && fileIn.files[0]; if (!f) return;
      try { const { url } = await window.v2UploadImage(f); await setUrl(url); }
      catch (e) { toast('Image upload failed.', 'error'); }
    });
    row.appendChild(upBtn);
    // AI placeholder image: prompt → Pollinations URL via Groq-polished prompt
    const aiBtn = document.createElement('button');
    aiBtn.className = 'v2-btn v2-btn-ghost';
    aiBtn.title = 'Generate a placeholder image from a prompt (AI)';
    aiBtn.style.flex = '0 0 auto';
    aiBtn.innerHTML = '✨ AI image';
    aiBtn.addEventListener('click', () => openAiImageModal(field, section, setUrl));
    row.appendChild(aiBtn);
    wrap.appendChild(row);
    wrap.appendChild(fileIn);
    return wrap;
  }

  // ── AI placeholder-image modal ───────────────────────────────────────────
  function openAiImageModal(field, section, onPick) {
    closeAiImageModal();
    const overlay = document.createElement('div');
    overlay.id = 'v2-ai-image-modal';
    overlay.className = 'v2-ai-image-modal is-open';
    overlay.innerHTML = `
      <div class="v2-ai-image-shell">
        <div class="v2-ai-image-header">
          <h3>✨ Generate a placeholder image</h3>
          <button class="v2-btn v2-btn-ghost" data-action="close">✕</button>
        </div>
        <p class="v2-ai-image-help">
          Describe what you want to see (e.g. "neighbors stocking an emergency kit"
          or "wildfire smoke over Poway hills at sunset"). We'll polish the prompt
          and generate an image. Use it as a placeholder while you wait for a real photo.
        </p>
        <textarea id="v2-ai-image-prompt" class="v2-input v2-textarea" rows="3"
                  placeholder="Describe the image…"></textarea>
        <div class="v2-ai-image-row">
          <label class="v2-field-label" style="margin:0;">Width
            <input id="v2-ai-image-w" type="number" class="v2-input" value="1200" min="64" max="2400" />
          </label>
          <label class="v2-field-label" style="margin:0;">Height
            <input id="v2-ai-image-h" type="number" class="v2-input" value="800" min="64" max="2400" />
          </label>
          <button id="v2-ai-image-go" class="v2-btn">Generate</button>
        </div>
        <div id="v2-ai-image-preview" class="v2-ai-image-preview"></div>
        <div id="v2-ai-image-actions" style="display:none;">
          <button class="v2-btn" data-action="use">✓ Use this image</button>
          <button class="v2-btn v2-btn-ghost" data-action="regen">↻ Regenerate</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closeAiImageModal(); });
    overlay.querySelector('[data-action="close"]').addEventListener('click', closeAiImageModal);

    const prompt  = overlay.querySelector('#v2-ai-image-prompt');
    const wIn     = overlay.querySelector('#v2-ai-image-w');
    const hIn     = overlay.querySelector('#v2-ai-image-h');
    const goBtn   = overlay.querySelector('#v2-ai-image-go');
    const preview = overlay.querySelector('#v2-ai-image-preview');
    const actions = overlay.querySelector('#v2-ai-image-actions');
    let lastResult = null; // { url, alt, polished_prompt }

    setTimeout(() => prompt && prompt.focus(), 30);

    async function generate() {
      const p = (prompt.value || '').trim();
      if (!p) { toast('Type a description first.', 'error'); return; }
      goBtn.disabled = true; goBtn.textContent = 'Polishing prompt…';
      preview.innerHTML = '<div class="v2-ai-image-loading">✨ Generating with AI…</div>';
      actions.style.display = 'none';
      try {
        const res = await fetch(_apiBase() + '/api/cms/ai/placeholder-image', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json',
                     'Authorization': 'Bearer ' + (localStorage.getItem('pnec_token') || '') },
          body: JSON.stringify({
            prompt: p,
            width: parseInt(wIn.value, 10) || 1200,
            height: parseInt(hIn.value, 10) || 800,
          }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        lastResult = await res.json();
        preview.innerHTML = `
          <img src="${escapeHtml(lastResult.url)}" alt="${escapeHtml(lastResult.alt || '')}"
               class="v2-ai-image-result" />
          <p class="v2-ai-image-meta">Polished prompt: <em>${escapeHtml(lastResult.polished_prompt || '')}</em></p>
          <p class="v2-ai-image-meta">Suggested alt: <em>${escapeHtml(lastResult.alt || '')}</em></p>
        `;
        actions.style.display = 'flex';
      } catch (e) {
        preview.innerHTML = `<div class="v2-ai-image-error">⚠ Generation failed: ${escapeHtml(e.message || 'unknown')}</div>`;
      }
      goBtn.disabled = false; goBtn.textContent = 'Generate';
    }

    goBtn.addEventListener('click', generate);
    prompt.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); generate(); }
    });
    actions.addEventListener('click', async (e) => {
      const action = e.target.dataset.action;
      if (action === 'regen') return generate();
      if (action === 'use' && lastResult) {
        await onPick(lastResult.url);
        // Try to set the matching alt field too if one exists
        const altKey = (state.registry.find(t => t.type === section.type) || {}).settings || [];
        const altField = altKey.find(f => /alt/i.test(f.id));
        if (altField && lastResult.alt) {
          await applyPatch({ op: 'set', sid: state.selectedSid, key: altField.id, value: lastResult.alt });
          postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: state.selectedSid });
          renderSettings();
        }
        toast('Image set ✓', 'ok');
        closeAiImageModal();
      }
    });
  }
  function closeAiImageModal() {
    const m = document.getElementById('v2-ai-image-modal');
    if (m) m.remove();
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

  // ── Status bar ────────────────────────────────────────────────────────────
  function setStatus(state_, detail) {
    const s = document.getElementById('v2-status-state');
    const d = document.getElementById('v2-status-detail');
    if (!s) return;
    s.classList.remove('is-saving', 'is-saved', 'is-error');
    if (state_ === 'saving') { s.textContent = 'Saving…'; s.classList.add('is-saving'); }
    else if (state_ === 'saved') { s.textContent = '✓ Saved'; s.classList.add('is-saved'); }
    else if (state_ === 'error') { s.textContent = '⚠ Error'; s.classList.add('is-error'); }
    else { s.textContent = state_ || 'Ready'; }
    if (d) d.textContent = detail || '';
  }

  function updateStatusStats() {
    const el = document.getElementById('v2-status-stats');
    if (!el || !state.template) return;
    const order = state.template.order || [];
    const sections = state.template.sections || {};
    const total    = order.length;
    let visible = 0, hidden = 0, blocks = 0, animated = 0;
    order.forEach(sid => {
      const sec = sections[sid];
      if (!sec) return;
      if (sec.visible === false) hidden++; else visible++;
      blocks += (sec.block_order || []).length;
      if (sec.layout && sec.layout.animation) animated++;
    });
    const overLimit = total >= 25;
    const auto      = state.autoTagged || 0;
    const v1Items   = (state.existingItems || []).filter(i => i.kind === 'site_config' || i.kind === 'override').length;
    el.innerHTML = `
      <span class="v2-status-stat-pill${overLimit ? ' is-warn' : ''}" title="Sections on this page (soft limit 25)">
        ${total}/25 sections
      </span>
      ${total ? `<span class="v2-status-stat-pill" title="${visible} visible, ${hidden} hidden">👁 ${visible} · 🙈 ${hidden}</span>` : ''}
      ${blocks ? `<span class="v2-status-stat-pill" title="Total blocks across all sections">${blocks} block${blocks === 1 ? '' : 's'}</span>` : ''}
      ${animated ? `<span class="v2-status-stat-pill" title="Sections with entrance animations">✨ ${animated} animated</span>` : ''}
      ${v1Items ? `<span class="v2-status-stat-pill" title="Manually-tagged inline-editable elements">🏷 ${v1Items} tagged</span>` : ''}
      ${auto ? `<span class="v2-status-stat-pill" title="Auto-detected hover-editable text/image elements">✨ ${auto} hoverable</span>` : ''}
    `;
  }

  // ── Patch helper (single source of truth for backend writes) ─────────────
  async function applyPatch(patch, opts) {
    opts = opts || {};
    setStatus('saving');
    // Snapshot for undo (skip when undo/redo is itself the caller)
    const snapshot = !opts.skipUndo ? JSON.stringify(state.template) : null;
    try {
      const res = await window.v2PatchDraft(state.pageSlug, [patch]);
      state.template = res.template;
      setStatus('saved', 'last edit ' + new Date().toLocaleTimeString());
      renderTree();
      // If the selected section was affected, re-render its settings panel from new state
      if (state.selectedSid && state.template.sections[state.selectedSid]) {
        // Don't re-render full panel for `set` / `set_block` ops (would lose focus).
        if (patch.op !== 'set' && patch.op !== 'set_block') renderSettings();
      }
      if (snapshot) {
        recordUndo(patch.op, snapshot, JSON.stringify(state.template));
      }
      // Re-scan after a short delay (iframe needs a tick to re-render)
      setTimeout(requestScan, 400);
      return res;
    } catch (e) {
      setStatus('error', e.message || '');
      toast(_humanizeError('Save failed', e), 'error');
      throw e;
    }
  }

  // Turn raw "HTTP 401" / "TypeError: Failed to fetch" / etc. into something
  // an admin can act on. Used by every catch block that would otherwise
  // surface a programmer-grade error.
  function _humanizeError(prefix, err) {
    const m = (err && err.message) || String(err || '');
    if (/\b401\b|UNAUTHORIZED/i.test(m)) {
      return prefix + ': your session expired. Please refresh the page and sign in again.';
    }
    if (/\b403\b|FORBIDDEN/i.test(m)) {
      return prefix + ': you don\'t have permission for this action.';
    }
    if (/\b413\b|too large/i.test(m)) {
      return prefix + ': content too large. Try splitting into smaller pieces.';
    }
    if (/Failed to fetch|NetworkError|net::|networkerror/i.test(m)) {
      return prefix + ': can\'t reach the server. Check your internet connection.';
    }
    if (/\b5\d\d\b/.test(m)) {
      return prefix + ': server error (' + m + '). Try again in a moment.';
    }
    return prefix + ': ' + (m || 'unknown error');
  }

  // ── Block-level clipboard ────────────────────────────────────────────────
  // Internal payload shape (always an array internally even for single blocks
  // so paste logic is uniform):
  //   { __cms_block_clipboard: true, blocks: [{type, settings}, ...] }
  // We also write a tiny mirror to localStorage so a "paste history" survives
  // across pages even if the user copies something else outside the editor.
  const _BLOCK_HISTORY_KEY = 'pnec_v2_block_clip_history';
  function _readBlockHistory() {
    try { return JSON.parse(localStorage.getItem(_BLOCK_HISTORY_KEY) || '[]'); }
    catch (_e) { return []; }
  }
  function _pushBlockHistory(payload) {
    const list = _readBlockHistory();
    list.unshift({ at: Date.now(), payload });
    while (list.length > 5) list.pop();
    try { localStorage.setItem(_BLOCK_HISTORY_KEY, JSON.stringify(list)); } catch (_e) {}
  }

  async function copyBlockToClipboard(section, bid, _blockMeta) {
    const block = (section.blocks || {})[bid];
    if (!block) return;
    const payload = {
      __cms_block_clipboard: true,
      blocks: [{ type: block.type, settings: block.settings || {} }],
    };
    // Always push to local history first — this works even when the
    // Clipboard API is unavailable (Safari, http://, embedded iframes).
    _pushBlockHistory(payload);
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
      toast('Block copied — paste into any matching section.', 'ok');
    } catch (_e) {
      toast('Block saved to local history (system clipboard unavailable). Paste works within this browser.', 'ok');
    }
  }

  async function copyAllBlocksToClipboard(section) {
    const order  = section.block_order || [];
    const blocks = section.blocks || {};
    if (!order.length) { toast('Nothing to copy — section has no items.', 'error'); return; }
    const payload = {
      __cms_block_clipboard: true,
      blocks: order
        .map(bid => blocks[bid])
        .filter(Boolean)
        .map(b => ({ type: b.type, settings: b.settings || {} })),
    };
    _pushBlockHistory(payload);
    const n = payload.blocks.length;
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
      toast(`${n} block${n === 1 ? '' : 's'} copied — paste into any matching section.`, 'ok');
    } catch (_e) {
      toast(`${n} block${n === 1 ? '' : 's'} saved to local history (system clipboard unavailable).`, 'ok');
    }
  }

  async function pasteBlockFromClipboard(section, meta) {
    let txt = null;
    // Try the system clipboard first
    try { txt = await navigator.clipboard.readText(); }
    catch (_e) { /* will fall back to local history */ }
    let payload = null;
    if (txt) {
      try { payload = JSON.parse(txt); } catch (_e) { /* not JSON, ignore */ }
    }
    // Fall back to localStorage history (most recent block payload)
    if (!payload || !payload.__cms_block_clipboard) {
      const history = _readBlockHistory();
      const recent  = history.find(h => h.payload && h.payload.__cms_block_clipboard);
      if (recent) payload = recent.payload;
    }
    if (!payload || !payload.__cms_block_clipboard) {
      toast('Nothing to paste — copy a block first.', 'error');
      return;
    }
    // Backwards-compat: old single-block payloads had {type, settings} at the top
    let items = Array.isArray(payload.blocks) && payload.blocks.length ? payload.blocks : null;
    if (!items && payload.type) items = [{ type: payload.type, settings: payload.settings || {} }];
    if (!items || !items.length) { toast('Clipboard has no blocks.', 'error'); return; }

    // Filter to types this section's schema actually accepts
    const allowedTypes = new Set((meta.blocks || []).map(b => b.type));
    const compat   = items.filter(b => allowedTypes.has(b.type));
    const dropped  = items.length - compat.length;
    if (!compat.length) {
      toast(`This section doesn't accept any of those block types.`, 'error');
      return;
    }
    // Send all compatible blocks as one batch PATCH so paste is atomic
    const patches = compat.map(b => ({
      op: 'add_block', sid: state.selectedSid,
      block_type: b.type, settings: b.settings || {},
    }));
    await applyPatchBatch(patches);
    postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: state.selectedSid });
    if (dropped) {
      toast(`Pasted ${compat.length} block(s); dropped ${dropped} incompatible.`, 'ok');
    } else {
      toast(`Pasted ${compat.length} block${compat.length === 1 ? '' : 's'}.`, 'ok');
    }
  }

  function openBlockContextMenu(event, section, bid, blockMeta) {
    closeContextMenu();
    const menu = document.createElement('div');
    menu.id = 'v2-ctx-menu';
    menu.className = 'v2-ctx-menu';
    menu.style.left = event.clientX + 'px';
    menu.style.top  = event.clientY + 'px';
    const meta = state.registry.find(t => t.type === section.type);
    const items = [
      { icon: '📋', label: 'Copy block',      action: () => copyBlockToClipboard(section, bid, blockMeta) },
      { icon: '📥', label: 'Paste block',     action: () => pasteBlockFromClipboard(section, meta) },
      { icon: '⬆',  label: 'Move up',         action: () => handleBlockAction(section, bid, 'up') },
      { icon: '⬇',  label: 'Move down',       action: () => handleBlockAction(section, bid, 'down') },
      { divider: true },
      { icon: '🗑',  label: 'Delete block',    danger: true, action: () => handleBlockAction(section, bid, 'delete') },
    ];
    items.forEach(it => {
      if (it.divider) {
        const d = document.createElement('div'); d.className = 'v2-ctx-divider'; menu.appendChild(d); return;
      }
      const btn = document.createElement('button');
      btn.className = 'v2-ctx-item' + (it.danger ? ' is-danger' : '');
      btn.innerHTML = `<span class="v2-ctx-icon">${it.icon}</span><span>${it.label}</span>`;
      btn.addEventListener('click', () => { closeContextMenu(); it.action(); });
      menu.appendChild(btn);
    });
    document.body.appendChild(menu);
    setTimeout(() => {
      document.addEventListener('click', closeContextMenu, { once: true });
      document.addEventListener('contextmenu', closeContextMenu, { once: true });
    }, 0);
  }

  // ── Right-click context menu on tree rows ────────────────────────────────
  function openContextMenu(event, sid) {
    closeContextMenu();
    const section = state.template.sections[sid];
    if (!section) return;
    const menu = document.createElement('div');
    menu.id = 'v2-ctx-menu';
    menu.className = 'v2-ctx-menu';
    menu.style.left = event.clientX + 'px';
    menu.style.top  = event.clientY + 'px';
    const items = [
      { icon: '✏️',  label: 'Edit',           action: () => selectSection(sid) },
      { icon: '🏷',  label: 'Rename',         action: () => handleSectionAction(sid, 'rename') },
      { icon: '⧉',  label: 'Duplicate',      action: () => handleSectionAction(sid, 'duplicate') },
      { icon: '📋',  label: 'Copy section',   action: () => copySectionToClipboard(sid) },
      { icon: section.visible === false ? '👁' : '🙈', label: section.visible === false ? 'Show' : 'Hide', action: () => handleSectionAction(sid, 'visibility') },
      { icon: '⬆',  label: 'Move up',        action: () => moveSection(sid, -1) },
      { icon: '⬇',  label: 'Move down',      action: () => moveSection(sid, 1) },
      { divider: true },
      { icon: '🗑',  label: 'Delete',         danger: true, action: () => handleSectionAction(sid, 'delete') },
    ];
    items.forEach(it => {
      if (it.divider) {
        const d = document.createElement('div');
        d.className = 'v2-ctx-divider';
        menu.appendChild(d);
        return;
      }
      const btn = document.createElement('button');
      btn.className = 'v2-ctx-item' + (it.danger ? ' is-danger' : '');
      btn.innerHTML = `<span class="v2-ctx-icon">${it.icon}</span><span>${it.label}</span>`;
      btn.addEventListener('click', () => { closeContextMenu(); it.action(); });
      menu.appendChild(btn);
    });
    document.body.appendChild(menu);
    setTimeout(() => {
      document.addEventListener('click', closeContextMenu, { once: true });
      document.addEventListener('contextmenu', closeContextMenu, { once: true });
    }, 0);
  }
  function closeContextMenu() {
    const m = document.getElementById('v2-ctx-menu');
    if (m) m.remove();
  }
  async function moveSection(sid, dir) {
    const order = state.template.order.slice();
    const idx = order.indexOf(sid);
    if (idx < 0) return;
    const swap = idx + dir;
    if (swap < 0 || swap >= order.length) return;
    [order[idx], order[swap]] = [order[swap], order[idx]];
    await applyPatch({ op: 'reorder', order });
    postToIframe({ type: 'cms:section:reorder', page: state.pageSlug, order });
  }

  // ── Section clipboard (copy/paste between pages) ────────────────────────
  async function copySectionToClipboard(sid) {
    const section = state.template.sections[sid];
    if (!section) return;
    // BUG FIX (v2.37): use block_order so copy/paste preserves the order the
    // admin sees in the editor. Previously Object.keys gave arbitrary order
    // — pasting a FAQ with 5 ordered Q&As would scramble them.
    const blockMap   = section.blocks || {};
    const blockOrder = (section.block_order || []).filter(bid => blockMap[bid]);
    // Fallback for sections that somehow have blocks but no order array
    const orderedIds = blockOrder.length ? blockOrder : Object.keys(blockMap);
    const payload = {
      __cms_section_clipboard: true,
      type:     section.type,
      settings: section.settings || {},
      // Preserve any custom layout/visibility/animation/name too
      layout:               section.layout || {},
      device_visibility:    section.device_visibility || null,
      visible:              section.visible !== false,
      name:                 section.name || null,
      blocks: orderedIds.map(bid => ({
        type:     blockMap[bid].type,
        settings: blockMap[bid].settings || {},
      })),
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
      toast('Section copied — paste with ⌘V on a tree row.', 'ok');
    } catch (_e) {
      toast('Clipboard write failed.', 'error');
    }
  }
  async function pasteSectionFromClipboard() {
    let txt;
    try { txt = await navigator.clipboard.readText(); }
    catch (_e) { toast('Clipboard read failed.', 'error'); return; }
    if (!txt) return;
    let payload;
    try { payload = JSON.parse(txt); } catch (_e) { toast('Clipboard not a section.', 'error'); return; }
    if (!payload || !payload.__cms_section_clipboard) {
      toast('Clipboard not a section.', 'error');
      return;
    }
    if (!state.registry.find(t => t.type === payload.type)) {
      toast('Section type "' + payload.type + '" not in registry.', 'error');
      return;
    }
    const res = await applyPatch({
      op: 'add',
      type: payload.type,
      settings: payload.settings || {},
      blocks: payload.blocks || [],
    });
    const newSid = (res && res.affected_sids || [])[0];
    if (newSid) {
      // Carry over layout / device_visibility / visibility / name overrides
      // from the source clipboard payload via follow-up patches.
      const followups = [];
      if (payload.layout && Object.keys(payload.layout).length) {
        followups.push({ op: 'layout', sid: newSid, updates: payload.layout });
      }
      if (Array.isArray(payload.device_visibility) && payload.device_visibility.length) {
        followups.push({ op: 'device_visibility', sid: newSid, devices: payload.device_visibility });
      }
      if (payload.visible === false) {
        followups.push({ op: 'visibility', sid: newSid, visible: false });
      }
      if (payload.name) {
        followups.push({ op: 'rename', sid: newSid, name: payload.name });
      }
      if (followups.length) {
        await applyPatchBatch(followups);
      }
      state.selectedSid = newSid;
      renderTree();
      renderSettings();
      postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: newSid });
      toast('Pasted as new section.', 'ok');
    }
  }

  // ── Create blank page ────────────────────────────────────────────────────
  async function createBlankPage() {
    const target = prompt('New page slug (lowercase, hyphens):');
    if (!target) return;
    const slug = target.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!slug) { toast('Invalid slug.', 'error'); return; }
    try {
      const res = await fetch(_apiBase() + '/api/cms/page/' + encodeURIComponent(slug) + '/create', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json',
                   'Authorization': 'Bearer ' + (localStorage.getItem('pnec_token') || '') },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast('Create failed: ' + (err.detail || res.status), 'error');
        return;
      }
      const opt = document.createElement('option');
      opt.value = slug;
      opt.textContent = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      elPageSel.appendChild(opt);
      elPageSel.value = slug;
      await switchPage(slug);
      toast('Created blank page "' + slug + '".', 'ok');
    } catch (e) { toast('Create failed.', 'error'); }
  }

  // ── Duplicate page ───────────────────────────────────────────────────────
  async function duplicatePage() {
    const target = prompt('New page slug (e.g. "neighborhood-resources"):');
    if (!target) return;
    const cleaned = target.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    if (!cleaned) { toast('Invalid slug.', 'error'); return; }
    try {
      const res = await fetch(_apiBase() + '/api/cms/page/' + encodeURIComponent(state.pageSlug) + '/duplicate', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json',
                   'Authorization': 'Bearer ' + (localStorage.getItem('pnec_token') || '') },
        body: JSON.stringify({ target_slug: cleaned }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast('Duplicate failed: ' + (err.detail || res.status), 'error');
        return;
      }
      // Add the new page to the selector
      const opt = document.createElement('option');
      opt.value = cleaned; opt.textContent = cleaned.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      elPageSel.appendChild(opt);
      elPageSel.value = cleaned;
      await switchPage(cleaned);
      toast('Duplicated to "' + cleaned + '".', 'ok');
    } catch (e) { toast('Duplicate failed.', 'error'); }
  }

  // ── Section picker (Add section) ──────────────────────────────────────────
  const CATEGORY_META = {
    headers:  { label: 'Headers',  icon: '🏔' },
    content:  { label: 'Content',  icon: '📝' },
    media:    { label: 'Media',    icon: '🎬' },
    layout:   { label: 'Layout',   icon: '📐' },
    other:    { label: 'Other',    icon: '✨' },
  };
  function openPicker() {
    elPickerList.innerHTML = '';
    // Category tabs
    const cats = Array.from(new Set(state.registry.map(s => s.category || 'other')));
    cats.sort();
    if (cats.length > 1) {
      const tabs = document.createElement('div');
      tabs.className = 'v2-picker-cats';
      tabs.innerHTML = `<button class="v2-picker-cat is-active" data-cat="all">All</button>`;
      cats.forEach(c => {
        const m = CATEGORY_META[c] || { label: c, icon: '·' };
        tabs.innerHTML += `<button class="v2-picker-cat" data-cat="${escapeHtml(c)}">${m.icon} ${escapeHtml(m.label)}</button>`;
      });
      tabs.addEventListener('click', (e) => {
        const btn = e.target.closest('.v2-picker-cat');
        if (!btn) return;
        tabs.querySelectorAll('.v2-picker-cat').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        const cat = btn.dataset.cat;
        elPickerList.querySelectorAll('.v2-picker-card').forEach(card => {
          card.style.display = (cat === 'all' || card.dataset.cat === cat) ? '' : 'none';
        });
      });
      elPickerList.appendChild(tabs);
    }
    state.registry.forEach(meta => {
      // Default card per type
      const card = document.createElement('div');
      card.className = 'v2-picker-card';
      card.dataset.cat = meta.category || 'other';
      const catMeta = CATEGORY_META[meta.category] || { icon: '·' };
      const typeIcon = (window.V2_ICONS && window.V2_ICONS.has(meta.type))
        ? window.V2_ICONS.svg(meta.type, { size: 22 })
        : catMeta.icon;
      card.innerHTML = `
        <div class="v2-picker-card-icon">${typeIcon}</div>
        <h4>${escapeHtml(meta.label)}</h4>
        <p>${escapeHtml(meta.description || '')}</p>
      `;
      // Hover preview: schematic wireframe popover after a 240ms hover
      attachPickerPreview(card, meta);
      card.addEventListener('click', async () => {
        closePicker();
        const patch = { op: 'add', type: meta.type };
        if (typeof state.pendingInsertIndex === 'number') {
          patch.index = state.pendingInsertIndex;
          state.pendingInsertIndex = null;
        }
        const res = await applyPatch(patch);
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
        pcard.dataset.cat = meta.category || 'other';
        pcard.innerHTML = `
          <div class="v2-picker-card-icon">⭐</div>
          <h4>${escapeHtml(preset.name)}</h4>
          <p>${escapeHtml(meta.label)} preset · ${(preset.blocks || []).length} item(s)</p>
        `;
        pcard.addEventListener('click', async () => {
          closePicker();
          // Single round-trip: add op now accepts inline blocks
          const patch = {
            op: 'add', type: meta.type,
            settings: preset.settings || {},
            blocks: preset.blocks || [],
          };
          if (typeof state.pendingInsertIndex === 'number') {
            patch.index = state.pendingInsertIndex;
            state.pendingInsertIndex = null;
          }
          const res = await applyPatch(patch);
          const newSid = (res && res.affected_sids || [])[0];
          if (newSid) {
            state.selectedSid = newSid;
            renderTree();
            renderSettings();
            postToIframe({ type: 'cms:section:rerender', page: state.pageSlug, sectionId: newSid });
          }
        });
        attachPickerPreview(pcard, meta, preset);
        elPickerList.appendChild(pcard);
      });
    });
    elPicker.classList.add('is-open');
  }
  function closePicker() {
    elPicker.classList.remove('is-open');
    closePickerPreview();
  }

  // ── Picker hover preview ───────────────────────────────────────────────────
  // Single popover element reused across all cards.
  let _pickerPreviewEl = null;
  let _pickerPreviewTimer = null;
  function attachPickerPreview(card, meta, preset) {
    card.addEventListener('mouseenter', () => {
      clearTimeout(_pickerPreviewTimer);
      _pickerPreviewTimer = setTimeout(() => showPickerPreview(card, meta, preset), 240);
    });
    card.addEventListener('mouseleave', () => {
      clearTimeout(_pickerPreviewTimer);
      closePickerPreview();
    });
    // Close popover if the card is removed (e.g. category filter)
    card.addEventListener('focusout', closePickerPreview);
  }
  function showPickerPreview(card, meta, preset) {
    closePickerPreview();
    if (!window.V2_ICONS) return;
    const wireframe = window.V2_ICONS.hasWireframe(meta.type)
      ? window.V2_ICONS.wireframe(meta.type)
      : '';
    const icon = window.V2_ICONS.svg(meta.type, { size: 24 });
    // Defensively escape — schemas are committed to source today but a future
    // user-extensible registry would make this a real XSS surface.
    const fields = (meta.settings || []).slice(0, 6)
      .map(f => '· ' + escapeHtml(f.label || f.id || ''))
      .join('<br>');
    const blockCount = (meta.blocks || []).length;
    const presetCount = (meta.presets || []).length;
    const presetNote = preset
      ? ('<p class="v2-picker-preview-meta">⭐ ' + escapeHtml(preset.name) + ' — ' +
         (preset.blocks || []).length + ' item' + ((preset.blocks || []).length === 1 ? '' : 's') + ' pre-filled</p>')
      : '';
    const blockNote = blockCount ? `<p class="v2-picker-preview-meta">${blockCount} repeatable block type${blockCount === 1 ? '' : 's'}</p>` : '';
    const presetNoteFromMeta = (!preset && presetCount)
      ? `<p class="v2-picker-preview-meta">${presetCount} ready-to-use preset${presetCount === 1 ? '' : 's'} below ↓</p>`
      : '';
    _pickerPreviewEl = document.createElement('div');
    _pickerPreviewEl.id = 'v2-picker-preview';
    _pickerPreviewEl.className = 'v2-picker-preview';
    _pickerPreviewEl.innerHTML = `
      <div class="v2-picker-preview-head">
        <span class="v2-picker-preview-icon">${icon}</span>
        <span><strong>${escapeHtml(meta.label)}</strong></span>
      </div>
      ${wireframe ? '<div class="v2-picker-preview-wf">' + wireframe + '</div>' : ''}
      <p class="v2-picker-preview-desc">${escapeHtml(meta.description || '')}</p>
      ${fields ? `<div class="v2-picker-preview-fields"><b>Fields</b><br>${fields}</div>` : ''}
      ${blockNote}
      ${presetNote}
      ${presetNoteFromMeta}
    `;
    document.body.appendChild(_pickerPreviewEl);
    // Position to the right of the card if there's room, else to the left
    const rect = card.getBoundingClientRect();
    const popW = 320;
    const popH = _pickerPreviewEl.offsetHeight || 220;
    let left = rect.right + 12;
    if (left + popW > window.innerWidth - 8) left = Math.max(8, rect.left - popW - 12);
    let top = rect.top + (rect.height / 2) - (popH / 2);
    top = Math.max(8, Math.min(top, window.innerHeight - popH - 8));
    _pickerPreviewEl.style.left = left + 'px';
    _pickerPreviewEl.style.top  = top + 'px';
  }
  function closePickerPreview() {
    if (_pickerPreviewEl) {
      _pickerPreviewEl.remove();
      _pickerPreviewEl = null;
    }
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
    // Hide loading spinner now that the iframe is ready
    if (elIframeFrame) elIframeFrame.classList.remove('is-loading');
    while (state.queue.length) {
      const m = state.queue.shift();
      try { elIframe.contentWindow.postMessage(m, window.location.origin); } catch (_e) {}
    }
    // v3 fix: respect the user's inspector preference instead of force-
    // re-activating on every iframe ready. Was a long-standing UX bug —
    // clicking the 🔍 toggle off lasted only until the next iframe reload
    // because flushQueue would unconditionally set inspectorOn=true.
    // Default to ON for first-ever visits, but if the user has explicitly
    // turned it off, keep it off across reloads.
    const inspectorPref = (() => {
      try { return localStorage.getItem('v2_inspector_pref'); }
      catch (_e) { return null; }
    })();
    const wantInspectorOn = inspectorPref === null ? true : inspectorPref === '1';
    if (wantInspectorOn) {
      state.inspectorOn = true;
      elInspectorBtn.classList.add('is-on');
      postToIframe({ type: 'cms:inspector:activate' });
    } else {
      state.inspectorOn = false;
      elInspectorBtn.classList.remove('is-on');
      postToIframe({ type: 'cms:inspector:deactivate' });
    }
    // After iframe loads, ask it for an inventory of editable items
    setTimeout(() => requestScan(), 600);
  }

  // Dedupe rapid scan requests — a burst of edits used to fire N scans;
  // now they coalesce into one ~120ms after the last edit settles.
  let _scanCoalesceTimer = null;
  function requestScan() {
    if (_scanCoalesceTimer) clearTimeout(_scanCoalesceTimer);
    _scanCoalesceTimer = setTimeout(() => {
      _scanCoalesceTimer = null;
      postToIframe({ type: 'cms:scan' });
    }, 120);
  }

  function onIframeMessage(event) {
    if (event.origin !== window.location.origin) return;
    const d = event.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === 'cms:scan:result') {
      // Iframe sent us its editable inventory + lint issues
      const items = Array.isArray(d.items) ? d.items : [];
      state.existingItems = items;
      state.lintIssues = Array.isArray(d.issues) ? d.issues : [];
      state.autoTagged = typeof d.autoTagged === 'number' ? d.autoTagged : 0;
      // Pre-load site-config + overrides so we can render the labels with values
      Promise.all([
        fetch(_apiBase() + '/api/site-config').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(_apiBase() + '/api/overrides/' + encodeURIComponent(state.pageSlug)).then(r => r.ok ? r.json() : null).catch(() => null),
      ]).then(([cfg, ovr]) => {
        state.siteConfig = (cfg && cfg.config) || {};
        state.siteConfigMeta = (cfg && cfg.meta) || {};
        state.overrides = (ovr && ovr.overrides) || {};
        renderTree();
        updateEditableBanner();
      });
      return;
    }
    if (d.type === 'cms:inspector:click') {
      // Inspector clicked something in the iframe — select it
      if (d.sectionId) selectSection(d.sectionId);
    } else if (d.type === 'cms:inspector:hover') {
      // Iframe hover → highlight matching sidebar row
      elSidebarTree.querySelectorAll('.v2-tree-row.is-iframe-hover')
        .forEach(r => r.classList.remove('is-iframe-hover'));
      if (d.sectionId) {
        const row = elSidebarTree.querySelector('.v2-tree-row[data-sid="' + d.sectionId + '"]');
        if (row) row.classList.add('is-iframe-hover');
      }
    } else if (d.type === 'cms:iframe:context-menu') {
      // Right-click happened inside the iframe → open editor context menu
      // at iframe-relative coords translated to editor coords
      if (d.sectionId) {
        const ifrRect = elIframe.getBoundingClientRect();
        const fakeEvent = { clientX: ifrRect.left + (d.x || 0), clientY: ifrRect.top + (d.y || 0), preventDefault(){}, stopPropagation(){} };
        // Defer to the same context menu used by the tree
        openContextMenu(fakeEvent, d.sectionId);
      }
    } else if (d.type === 'cms:reorder-from-iframe') {
      // User dragged a section to a new position in the iframe canvas
      if (Array.isArray(d.order)) {
        applyPatch({ op: 'reorder', order: d.order })
          .then(() => postToIframe({ type: 'cms:section:reorder', page: state.pageSlug, order: d.order }));
      }
    } else if (d.type === 'cms:add-here') {
      // User clicked a "+ Add section here" button between sections.
      // Open the picker with the insertion index pre-set so the next add
      // lands at that position.
      state.pendingInsertIndex = typeof d.index === 'number' ? d.index : null;
      openPicker();
    } else if (d.type === 'cms:inline:edit') {
      // (Legacy) Stega-tagged element double-clicked → select section,
      // focus the matching field in the sidebar.
      if (d.sectionId) {
        selectSection(d.sectionId);
        setTimeout(() => focusFieldInPanel(d.field), 50);
      }
    } else if (d.type === 'cms:inline:save') {
      handleInlineSave(d);
    } else if (d.type === 'cms:image-pick-request') {
      // Iframe asked us to open the asset picker for one of its <img> elements.
      // When the user picks a URL, we save it as an override or site_config.
      const item = d.kind === 'site_config'
        ? { kind: 'site_config', key: d.key, label: d.key }
        : { kind: 'override',    key: d.key, label: d.key };
      openAssetLibrary(async (url) => {
        await applyExistingChange(item, url);
        if (d.kind === 'site_config' && state.siteConfig) state.siteConfig[d.key] = url;
        else if (state.overrides) state.overrides[d.key] = url;
        toast('Image swapped ✓', 'ok');
      });
    }
  }

  async function handleInlineSave(msg) {
    try {
      if (msg.kind === 'section' && msg.sectionId && msg.field) {
        await applyPatch({ op: 'set', sid: msg.sectionId, key: msg.field, value: msg.value });
        if (state.selectedSid === msg.sectionId) renderSettings();
      } else if (msg.kind === 'site_config' && msg.key) {
        const item = { kind: 'site_config', key: msg.key, label: msg.key };
        await applyExistingChange(item, msg.value);
        // Refresh existing items so sidebar peek text updates next scan
        if (state.siteConfig) state.siteConfig[msg.key] = msg.value;
      } else if (msg.kind === 'override' && msg.key) {
        const item = { kind: 'override', key: msg.key, label: msg.key };
        await applyExistingChange(item, msg.value);
        if (state.overrides) state.overrides[msg.key] = msg.value;
      } else { return; }
      toast('Inline edit saved.', 'ok');
    } catch (e) {
      toast('Inline save failed.', 'error');
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
    // v3: persist preference so flushQueue respects it on the next iframe
    // reload. Was the bug: user clicks off → iframe reloads → inspector
    // forced back on.
    try { localStorage.setItem('v2_inspector_pref', state.inspectorOn ? '1' : '0'); }
    catch (_e) { /* private browsing — best effort */ }
  }

  // ── Publish + share ───────────────────────────────────────────────────────
  async function publish() {
    // First show a "what's about to change" modal with the diff, then publish
    // only if the user confirms. The modal also lets the user back out.
    await openPublishDiffModal();
  }

  async function openPublishDiffModal() {
    closePublishDiffModal();
    const overlay = document.createElement('div');
    overlay.id = 'v2-publish-diff-modal';
    overlay.className = 'v2-publish-diff-modal is-open';
    overlay.innerHTML = `
      <div class="v2-publish-diff-shell">
        <div class="v2-publish-diff-header">
          <h3>🚀 Review changes before publishing</h3>
          <button class="v2-btn v2-btn-ghost" data-act="close">✕</button>
        </div>
        <div id="v2-publish-diff-body" class="v2-publish-diff-body">
          <p class="v2-publish-diff-loading">Computing diff…</p>
        </div>
        <div class="v2-publish-diff-footer">
          <button class="v2-btn v2-btn-ghost" data-act="close">Cancel</button>
          <button class="v2-btn"              data-act="confirm" id="v2-publish-diff-go" disabled>Publish anyway…</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (ev) => { if (ev.target === overlay) closePublishDiffModal(); });
    overlay.querySelectorAll('[data-act="close"]').forEach(b => b.addEventListener('click', closePublishDiffModal));
    overlay.querySelector('[data-act="confirm"]').addEventListener('click', async () => {
      try {
        await window.v2Publish(state.pageSlug);
        closePublishDiffModal();
        toast('Published ✓', 'ok');
      } catch (e) {
        toast('Publish failed: ' + (e.message || 'error'), 'error');
      }
    });

    // Fetch diff and render
    try {
      const res = await fetch(_apiBase() + '/api/cms/page/' + encodeURIComponent(state.pageSlug) + '/diff', {
        credentials: 'include',
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('pnec_token') || '') },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const diff = await res.json();
      renderPublishDiff(diff);
    } catch (e) {
      const body = overlay.querySelector('#v2-publish-diff-body');
      body.innerHTML = '<p class="v2-ai-image-error">⚠ Could not compute diff: ' + escapeHtml(e.message || 'unknown') + '</p>';
    }
  }
  function closePublishDiffModal() {
    const m = document.getElementById('v2-publish-diff-modal');
    if (m) m.remove();
  }
  function renderPublishDiff(diff) {
    const body = document.getElementById('v2-publish-diff-body');
    const goBtn = document.getElementById('v2-publish-diff-go');
    if (!body || !goBtn) return;

    const total = (diff.added.length + diff.removed.length + diff.modified.length);
    const noChanges = total === 0 && !diff.reordered && !diff.no_published;
    const formatLabel = (item) => {
      const meta = state.registry.find(t => t.type === item.type);
      const label = item.name || (meta ? meta.label : item.type);
      const pill  = item.name ? ' <span class="v2-find-row-pill">' + escapeHtml(meta ? meta.label : item.type) + '</span>' : '';
      return escapeHtml(label) + pill;
    };

    let html = '';
    if (diff.no_published) {
      html += '<div class="v2-publish-diff-banner v2-publish-diff-banner-info">📢 First publish — every section below is brand new.</div>';
    }
    if (noChanges) {
      html += '<div class="v2-publish-diff-banner v2-publish-diff-banner-ok">✓ Draft is identical to the live site. Nothing to publish.</div>';
    }
    html += '<div class="v2-publish-diff-summary">';
    html += '<span class="v2-status-stat-pill" style="background:rgba(34,211,165,0.10);border-color:rgba(34,211,165,0.30);color:#86efac;">+ ' + diff.added.length    + ' added</span>';
    html += '<span class="v2-status-stat-pill" style="background:rgba(248,113,113,0.10);border-color:rgba(248,113,113,0.30);color:#fecaca;">− ' + diff.removed.length  + ' removed</span>';
    html += '<span class="v2-status-stat-pill" style="background:rgba(251,191,36,0.10);border-color:rgba(251,191,36,0.30);color:var(--v2-amber);">~ ' + diff.modified.length + ' modified</span>';
    if (diff.reordered) html += '<span class="v2-status-stat-pill">↕ reordered</span>';
    html += '</div>';

    if (diff.added.length) {
      html += '<h4 class="v2-publish-diff-section">+ Added (' + diff.added.length + ')</h4><ul class="v2-publish-diff-list">';
      diff.added.forEach(item => {
        html += '<li class="v2-publish-diff-row v2-publish-diff-add">' + formatLabel(item) + '</li>';
      });
      html += '</ul>';
    }
    if (diff.removed.length) {
      html += '<h4 class="v2-publish-diff-section">− Removed (' + diff.removed.length + ')</h4><ul class="v2-publish-diff-list">';
      diff.removed.forEach(item => {
        html += '<li class="v2-publish-diff-row v2-publish-diff-rem">' + formatLabel(item) + '</li>';
      });
      html += '</ul>';
    }
    if (diff.modified.length) {
      html += '<h4 class="v2-publish-diff-section">~ Modified (' + diff.modified.length + ')</h4><ul class="v2-publish-diff-list">';
      diff.modified.forEach(item => {
        const fields = (item.fields || []).slice(0, 8).map(f => {
          const before = JSON.stringify(f.before);
          const after  = JSON.stringify(f.after);
          return '<li><code>' + escapeHtml(f.key) + '</code>: ' +
                 '<s style="color:#fecaca;">' + escapeHtml(before.slice(0, 80)) + '</s> → ' +
                 '<span style="color:#86efac;">' + escapeHtml(after.slice(0, 80)) + '</span></li>';
        }).join('');
        const more = (item.fields || []).length > 8
          ? '<li style="color:var(--v2-muted);">…and ' + ((item.fields || []).length - 8) + ' more</li>'
          : '';
        html += '<li class="v2-publish-diff-row v2-publish-diff-mod">'
          + formatLabel(item)
          + '<details><summary style="font-size:.7rem; color:var(--v2-muted); cursor:pointer; margin-top:4px;">See ' + (item.fields || []).length + ' field change' + ((item.fields || []).length === 1 ? '' : 's') + '</summary>'
          + '<ul class="v2-publish-diff-fields">' + fields + more + '</ul>'
          + '</details></li>';
      });
      html += '</ul>';
    }
    if (noChanges) {
      goBtn.disabled = true;
      goBtn.textContent = 'Nothing to publish';
    } else {
      goBtn.disabled = false;
      goBtn.textContent = '🚀 Publish ' + total + ' change' + (total === 1 ? '' : 's');
    }
    body.innerHTML = html;
  }
  async function shareDraft() {
    // Section groups (_header/_footer) don't have a real public URL to share.
    if (state.pageSlug === '_header' || state.pageSlug === '_footer') {
      toast('Section groups are not standalone pages — share an actual page instead.', 'error');
      return;
    }
    try {
      const tok = await window.v2IssuePreviewToken(state.pageSlug, 7);
      const path = state.pageSlug === 'home' ? '/' : `/pages/${state.pageSlug}.html`;
      const url  = `${window.location.origin}${path}?preview=1&token=${encodeURIComponent(tok.token)}`;
      let copied = false;
      try {
        await navigator.clipboard.writeText(url);
        copied = true;
      } catch (_e) { /* clipboard API unavailable or denied */ }
      if (copied) {
        toast('Preview link copied to clipboard (valid 7 days).', 'ok');
      } else {
        // Fallback: prompt the user with the URL so they can copy manually.
        // Common on http:// origins (Safari) where Clipboard API is blocked.
        window.prompt('Copy this preview URL (valid 7 days). Clipboard API unavailable on this origin:', url);
      }
    } catch (e) {
      toast('Could not issue preview token: ' + (e && e.message || ''), 'error');
    }
  }

  // ── UI helpers ────────────────────────────────────────────────────────────
  let _toastTimer = null;
  function toast(msg, kind, opts) {
    opts = opts || {};
    elToast.className = 'v2-toast ' + (kind || '');
    elToast.style.opacity = '1';
    if (_toastTimer) clearTimeout(_toastTimer);

    if (opts.action) {
      // Rich toast: message + button
      elToast.innerHTML = '';
      const span = document.createElement('span');
      span.textContent = msg;
      const btn = document.createElement('button');
      btn.className = 'v2-toast-action';
      btn.textContent = opts.action.label || 'Undo';
      btn.addEventListener('click', () => {
        try { opts.action.fn(); } catch (_e) {}
        elToast.style.opacity = '0';
      });
      elToast.appendChild(span);
      elToast.appendChild(btn);
      _toastTimer = setTimeout(() => { elToast.style.opacity = '0'; }, opts.duration || 6000);
    } else {
      elToast.textContent = msg;
      _toastTimer = setTimeout(() => { elToast.style.opacity = '0'; }, opts.duration || 3500);
    }
  }
  function showBanner(msg) {
    elBanner.textContent = msg;
    elBanner.style.display = 'block';
  }
  function hideBanner() {
    elBanner.style.display = 'none';
  }
  function updateEditableBanner() {
    // The page can have three kinds of editable content (any combination):
    //   - v2 sections (state.template.order)
    //   - manual v1 markers (data-cms-config / data-cms-override) — listed in
    //     state.existingItems with kind=='site_config' or 'override'
    //   - auto-tagged text elements (state.autoTagged from cms:scan:result)
    const sectionCount = (state.template && state.template.order) ? state.template.order.length : 0;
    const v1Items      = (state.existingItems || []).filter(i => i.kind === 'site_config' || i.kind === 'override');
    const autoCount    = state.autoTagged || 0;

    const parts = [];
    if (sectionCount) parts.push(sectionCount + ' v2 section' + (sectionCount === 1 ? '' : 's'));
    if (v1Items.length) parts.push(v1Items.length + ' tagged element' + (v1Items.length === 1 ? '' : 's'));
    if (autoCount) parts.push(autoCount + ' auto-detected text element' + (autoCount === 1 ? '' : 's'));

    if (!parts.length) {
      showBanner('⚠️ Nothing editable found on this page. Click "+ Add section" in the sidebar to add CMS content.');
      return;
    }
    if (autoCount && !sectionCount && !v1Items.length) {
      // Pure auto-tagged page (most legacy pages) — make the hint actionable
      showBanner('💡 ' + autoCount + ' text elements are hover-editable. ' +
        'Mouse over any heading or paragraph in the preview → it lights up blue → double-click to edit.');
      return;
    }
    // Mixed content — short summary, banner not strictly necessary
    showBanner('💡 Editable on this page: ' + parts.join(' · ') +
      '. Hover anything in the preview to edit it.');
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
    [['sections', elTabSections], ['theme', elTabTheme], ['seo', elTabSeo], ['history', elTabHistory]].forEach(([n, el]) => {
      if (!el) return;
      const active = (n === name);
      el.classList.toggle('is-active', active);
      el.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (elPanelSections) elPanelSections.style.display = name === 'sections' ? 'flex'  : 'none';
    if (elPanelTheme)    elPanelTheme.style.display    = name === 'theme'    ? 'block' : 'none';
    if (elPanelSeo)      elPanelSeo.style.display      = name === 'seo'      ? 'block' : 'none';
    if (elPanelHistory)  elPanelHistory.style.display  = name === 'history'  ? 'block' : 'none';
    if (name === 'theme'   && !state.themeSchema) loadTheme();
    if (name === 'seo')    loadSeo();
    if (name === 'history') loadHistory();
  }

  // ── SEO panel ────────────────────────────────────────────────────────────
  async function loadSeo() {
    if (!elPanelSeo) return;
    elPanelSeo.innerHTML = '<p style="color:var(--v2-muted);">Loading…</p>';
    let seo = {};
    try {
      const res = await fetch(_apiBase() + '/api/cms/page/' + encodeURIComponent(state.pageSlug) + '/seo');
      if (res.ok) seo = await res.json();
    } catch (_e) {}
    renderSeoPanel(seo);
  }

  function renderSeoPanel(seo) {
    elPanelSeo.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'v2-settings-head';
    head.innerHTML = `<h3>SEO &amp; sharing</h3><p>Search-engine and social-share metadata for <code>${escapeHtml(state.pageSlug)}</code>.</p>`;
    elPanelSeo.appendChild(head);

    const fields = [
      { key: 'title',          label: 'Title (≤60 chars)',                    type: 'text',     hint: 'Shown in browser tabs and search results.' },
      { key: 'description',    label: 'Meta description (≤160 chars)',         type: 'textarea', hint: 'The two-line summary in search results.' },
      { key: 'og_image_url',   label: 'Social share image',                    type: 'image',    hint: 'Shown when the page is shared on Facebook, Slack, etc.' },
      { key: 'og_title',       label: 'Social share title (Open Graph)',       type: 'text',     hint: 'Defaults to the page title if blank.' },
      { key: 'og_description', label: 'Social share description (Open Graph)', type: 'textarea', hint: 'Defaults to the meta description if blank.' },
      { key: 'twitter_card',   label: 'Twitter card type',                     type: 'select',   options: ['summary', 'summary_large_image'] },
      { key: 'canonical_url',  label: 'Canonical URL (optional)',              type: 'text',     hint: 'Set if this page is a copy of one at another URL.' },
      { key: 'robots',         label: 'Robots meta',                           type: 'text',     hint: 'Default: index, follow' },
    ];
    fields.forEach(f => elPanelSeo.appendChild(buildSeoField(seo, f)));
  }

  function buildSeoField(seo, f) {
    const wrap = document.createElement('div');
    wrap.className = 'v2-field';
    const label = document.createElement('label');
    label.className = 'v2-field-label';
    label.textContent = f.label;
    wrap.appendChild(label);
    let input;
    if (f.type === 'textarea') {
      input = document.createElement('textarea');
      input.className = 'v2-input v2-textarea';
      input.rows = 3;
      input.value = seo[f.key] || '';
    } else if (f.type === 'select') {
      input = document.createElement('select');
      input.className = 'v2-input';
      (f.options || []).forEach(o => {
        const op = document.createElement('option');
        op.value = o; op.textContent = o; if (o === seo[f.key]) op.selected = true;
        input.appendChild(op);
      });
    } else if (f.type === 'image') {
      input = document.createElement('input');
      input.type = 'text'; input.className = 'v2-input';
      input.value = seo[f.key] || '';
      input.placeholder = 'https://… or /uploads/…';
    } else {
      input = document.createElement('input');
      input.type = 'text'; input.className = 'v2-input';
      input.value = seo[f.key] || '';
    }
    // BUG FIX (v2.40): same race fix as overrides — capture slug at panel
    // render time, not at save fire time.
    const slugAtRender = state.pageSlug;
    input.addEventListener('input', debounce(async () => {
      try {
        const res = await fetch(_apiBase() + '/api/cms/page/' + encodeURIComponent(slugAtRender) + '/seo', {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json',
                     'Authorization': 'Bearer ' + (localStorage.getItem('pnec_token') || '') },
          body: JSON.stringify({ updates: { [f.key]: input.value } }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        setStatus('saved', 'SEO ' + f.key + ' saved');
      } catch (e) { toast(_humanizeError('SEO save failed', e), 'error'); }
    }, 300));
    wrap.appendChild(input);
    if (f.hint) {
      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:.7rem; color:var(--v2-muted); margin-top:4px;';
      hint.textContent = f.hint;
      wrap.appendChild(hint);
    }
    return wrap;
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
    head.innerHTML = `<h3>History</h3><p>Recent edits across pages, theme, and overrides. Click ↻ to revert any inline edit.</p>`;
    elPanelHistory.appendChild(head);
    if (!events.length) {
      const p = document.createElement('p');
      p.style.cssText = 'color:var(--v2-muted); padding:8px 0;';
      p.textContent = 'No history yet — your first edit will appear here.';
      elPanelHistory.appendChild(p);
      return;
    }
    events.forEach(e => {
      const row = document.createElement('div');
      row.className = 'v2-history-row';
      const when = e.updated_at ? new Date(e.updated_at) : null;
      const ago  = when ? _timeAgo(when) : '?';
      const iconMap = {
        page_template: '📄',
        page_publish:  '🚀',
        theme:         '🎨',
        override:      '✏️',
        site_config:   '🌐',
      };
      // Detail-level revert: only meaningful for `override` and `site_config`
      const canRevert = (e.kind === 'override'    && e.element_id && e.page_slug)
                     || (e.kind === 'site_config' && e.cfg_key);
      const revertBtn = canRevert ? '<button class="v2-icon-btn v2-history-revert" title="Reset this change to default">↻</button>' : '';
      row.innerHTML = `
        <div class="v2-history-row-icon">${iconMap[e.kind] || '·'}</div>
        <div class="v2-history-row-body">
          <div class="v2-history-detail">${escapeHtml(e.detail || '')}</div>
          <div class="v2-history-meta">${escapeHtml(e.updated_by_name || '?')} · ${escapeHtml(ago)}</div>
        </div>
        ${revertBtn}
      `;
      const btn = row.querySelector('.v2-history-revert');
      if (btn) {
        btn.addEventListener('click', async () => {
          const ok = confirm('Revert this change?\n\n' + (e.detail || ''));
          if (!ok) return;
          try {
            let url;
            if (e.kind === 'override') {
              url = _apiBase() + '/api/overrides/' + encodeURIComponent(e.page_slug)
                    + '/' + encodeURIComponent(e.element_id);
            } else if (e.kind === 'site_config') {
              url = _apiBase() + '/api/site-config/' + encodeURIComponent(e.cfg_key);
            }
            const res = await fetch(url, {
              method: 'DELETE', credentials: 'include',
              headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('pnec_token') || '') },
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            toast('Reverted ✓', 'ok');
            loadHistory();
            try { elIframe.contentWindow.location.reload(); } catch (_e) {}
          } catch (e2) { toast('Revert failed: ' + (e2.message || ''), 'error'); }
        });
      }
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
    head.className = 'v2-theme-hero';
    head.innerHTML = `
      <div class="v2-theme-hero-icon">🎨</div>
      <div>
        <h3 style="margin:0;">Theme settings</h3>
        <p style="margin:4px 0 0; color:var(--v2-muted); font-size:.8rem;">Brand-wide colors, typography, layout. Affects every page.</p>
      </div>
    `;
    elPanelTheme.appendChild(head);

    const groupOrder = ['brand', 'colors', 'typography', 'layout'];
    const groupIcons = { brand: '🏷', colors: '🎨', typography: 'A', layout: '📐' };

    const seenGroups = new Set();
    groupOrder.concat(Object.keys(state.themeSchema || {})).forEach(group => {
      if (seenGroups.has(group)) return;
      if (!state.themeSchema || !state.themeSchema[group]) return;
      seenGroups.add(group);

      const card = document.createElement('section');
      card.className = 'v2-theme-card';

      const groupHead = document.createElement('div');
      groupHead.className = 'v2-theme-group-head';
      groupHead.innerHTML = `<span class="v2-theme-group-icon">${groupIcons[group] || '·'}</span><span>${escapeHtml(group)}</span>`;
      card.appendChild(groupHead);

      (state.themeSchema[group] || []).forEach(token => {
        card.appendChild(buildTokenField(token));
      });
      elPanelTheme.appendChild(card);
    });

    const pubBtn = document.createElement('button');
    pubBtn.className = 'v2-btn v2-btn-publish-theme';
    pubBtn.innerHTML = '<span style="font-size:1rem;">🚀</span>&nbsp; Publish theme to live site';
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
    wrap.className = 'v2-token-field';
    // v3: stamp the token key so cross-page search jumper can land here
    wrap.setAttribute('data-token-key', token.key);
    const label = document.createElement('label');
    label.className = 'v2-token-label';
    label.textContent = token.label;
    wrap.appendChild(label);

    const initial = (state.themeTokens && state.themeTokens[token.key] != null)
                    ? state.themeTokens[token.key] : token.default || '';

    if (token.type === 'color') {
      // Swatch + hex input combo
      const row = document.createElement('div');
      row.className = 'v2-color-row';
      const swatch = document.createElement('input');
      swatch.type = 'color';
      swatch.className = 'v2-color-swatch';
      swatch.value = initial && /^#[0-9a-fA-F]{6}$/.test(initial) ? initial : '#000000';
      const hex = document.createElement('input');
      hex.type = 'text';
      hex.className = 'v2-hex-input';
      hex.value = initial || '';
      hex.placeholder = '#1e3a8a';
      hex.spellcheck = false;
      const sync = (val) => {
        if (/^#[0-9a-fA-F]{6}$/.test(val)) swatch.value = val;
      };
      swatch.addEventListener('input', debounce(async () => {
        hex.value = swatch.value;
        await applyThemeTokenChange(token.key, swatch.value);
      }, 200));
      hex.addEventListener('input', debounce(async () => {
        const v = hex.value.trim();
        if (!v.startsWith('#')) return;
        sync(v);
        await applyThemeTokenChange(token.key, v);
      }, 300));
      row.appendChild(swatch);
      row.appendChild(hex);
      wrap.appendChild(row);
      return wrap;
    }

    if (token.type === 'image') {
      const fileWrap = document.createElement('div');
      const preview = document.createElement('div');
      preview.className = 'v2-image-preview';
      if (initial) {
        const img = document.createElement('img');
        img.src = initial; img.className = 'v2-image-thumb';
        preview.appendChild(img);
      } else {
        preview.textContent = '(no image)';
      }
      fileWrap.appendChild(preview);
      const file = document.createElement('input');
      file.type = 'file'; file.accept = 'image/*'; file.className = 'v2-input';
      file.addEventListener('change', async () => {
        const f = file.files && file.files[0]; if (!f) return;
        try {
          const { url } = await window.v2UploadImage(f);
          preview.innerHTML = '';
          const img = document.createElement('img');
          img.src = url; img.className = 'v2-image-thumb';
          preview.appendChild(img);
          await applyThemeTokenChange(token.key, url);
        } catch (e) { toast('Upload failed.', 'error'); }
      });
      fileWrap.appendChild(file);
      wrap.appendChild(fileWrap);
      return wrap;
    }

    let input;
    if (token.type === 'select') {
      input = document.createElement('select');
      input.className = 'v2-input';
      (token.options || []).forEach(opt => {
        const o = document.createElement('option'); o.value = opt; o.textContent = opt;
        if (opt === initial) o.selected = true;
        input.appendChild(o);
      });
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
    // BUG FIX (v2.40): only commit to local state AFTER the save succeeds.
    // Previously we updated state.themeTokens optimistically — if the save
    // failed (network error, 401), the local state diverged from the backend
    // and a later save of a different token would overwrite the backend's
    // copy with the bad local cache.
    const prev = state.themeTokens[key];
    try {
      await window.v2PatchThemeDraft({ [key]: value });
      state.themeTokens[key] = value;
      // Update iframe live: post a CSS variable update message
      postToIframe({ type: 'cms:theme:update', key, value });
    } catch (e) {
      // Roll back: leave state.themeTokens[key] at prev value so the next
      // edit doesn't carry the failed value forward.
      state.themeTokens[key] = prev;
      toast(_humanizeError('Theme save failed', e), 'error');
    }
  }

  // ── Viewport toggle ─────────────────────────────────────────────────────
  function setViewport(name) {
    state.viewport = name;
    if (elViewportBtns) elViewportBtns.forEach(b => b.classList.toggle('is-active', b.dataset.viewport === name));
    if (!elIframeFrame) return;
    elIframeFrame.classList.remove('v2-vp-desktop', 'v2-vp-tablet', 'v2-vp-mobile', 'v2-vp-fullscreen');
    elIframeFrame.classList.add('v2-vp-' + name);
    // Fullscreen also collapses the sidebar by toggling a flag on the shell
    const shell = document.getElementById('v2-shell');
    if (shell) shell.classList.toggle('is-fullscreen', name === 'fullscreen');
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
    // Skip when the user is typing in an input
    const tag = (e.target && e.target.tagName) || '';
    const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable);

    // ⌘Z / ⌘⇧Z work even while typing in editor inputs (they're text fields, not document content)
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }

    // ⌘K opens cross-page section search (works even while typing — Spotlight pattern)
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      openFindModal();
      return;
    }

    // Esc inside the find modal closes it (handled even while focused inside the input)
    if (e.key === 'Escape') {
      const findModal = document.getElementById('v2-find-modal');
      if (findModal && findModal.classList.contains('is-open')) {
        e.preventDefault();
        closeFindModal();
        return;
      }
      // Esc also clears any multi-selection
      if (state.multiSelected.size) {
        e.preventDefault();
        clearMultiSelect();
        return;
      }
    }

    // ⌘A on a focused tree row → select all sections in current page
    if ((e.metaKey || e.ctrlKey) && (e.key === 'a' || e.key === 'A')) {
      const target = e.target;
      const insideTree = target && target.closest && target.closest('.v2-tree-row');
      if (insideTree) {
        e.preventDefault();
        state.multiSelected = new Set(state.template.order.filter(s => s !== state.selectedSid));
        renderTree();
        renderBulkBar();
        return;
      }
    }

    if (typing) return;

    if (e.key === 'a' || e.key === 'A') { e.preventDefault(); openPicker(); }
    else if (e.key === 'i' || e.key === 'I') { e.preventDefault(); toggleInspector(); }
    else if (e.key === '1') { e.preventDefault(); switchSidebarTab('sections'); }
    else if (e.key === '2') { e.preventDefault(); switchSidebarTab('theme'); }
    else if (e.key === '3') { e.preventDefault(); switchSidebarTab('seo'); }
    else if (e.key === '4') { e.preventDefault(); switchSidebarTab('history'); }
    else if (e.key === 'd' || e.key === 'D') { e.preventDefault(); setViewport('desktop'); }
    else if (e.key === 't' || e.key === 'T') { e.preventDefault(); setViewport('tablet'); }
    else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); setViewport('mobile'); }
    else if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      // F toggles in/out of fullscreen
      setViewport(state.viewport === 'fullscreen' ? 'desktop' : 'fullscreen');
    }
    else if (e.key === '/') {
      e.preventDefault();
      const search = document.getElementById('v2-tree-search');
      if (search) { switchSidebarTab('sections'); search.focus(); }
    }
    else if (e.key === '?') { e.preventDefault(); openHelp(); }
    else if (e.key === 'Escape') { closePicker(); closeAssetLibrary(); closeHelp(); }
  }

  // ── Export / Import ──────────────────────────────────────────────────────
  async function exportPage() {
    try {
      const res = await fetch(_apiBase() + '/api/cms/page/' + encodeURIComponent(state.pageSlug) + '/export', {
        credentials: 'include',
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('pnec_token') || '') },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pnec-' + state.pageSlug + '-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Exported.', 'ok');
    } catch (e) { toast('Export failed.', 'error'); }
  }

  async function importPage(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    e.target.value = '';
    if (!confirm('Replace this page\'s draft with the imported template? You can undo with ⌘Z.')) return;
    try {
      const text = await f.text();
      let parsed;
      try { parsed = JSON.parse(text); }
      catch (_e) { toast('Not valid JSON.', 'error'); return; }
      const beforeJson = JSON.stringify(state.template);
      const res = await fetch(_apiBase() + '/api/cms/page/' + encodeURIComponent(state.pageSlug) + '/import', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json',
                   'Authorization': 'Bearer ' + (localStorage.getItem('pnec_token') || '') },
        body: JSON.stringify({ template: parsed.draft || parsed.template || parsed }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const body = await res.json();
      state.template = body.template;
      recordUndo('import', beforeJson, JSON.stringify(state.template));
      renderTree();
      pointIframe(state.pageSlug);
      // Tell the admin if any sections got dropped during validation (v2.40
      // import endpoint now returns dropped_count when caps were enforced).
      const dropped = body.dropped_count || 0;
      if (dropped > 0) {
        toast('Imported. ' + dropped + ' section' + (dropped === 1 ? '' : 's') +
              ' dropped (over the 25-section cap or unknown section types).', 'ok');
      } else {
        toast('Imported.', 'ok');
      }
    } catch (e) { toast(_humanizeError('Import failed', e), 'error'); }
  }

  function openHelp() {
    const overlay = document.getElementById('v2-help-overlay');
    if (overlay) overlay.classList.add('is-open');
  }
  function closeHelp() {
    const overlay = document.getElementById('v2-help-overlay');
    if (overlay) overlay.classList.remove('is-open');
  }

  // ── Cross-page find (Cmd-K) ─────────────────────────────────────────────
  function openFindModal() {
    const modal = document.getElementById('v2-find-modal');
    const input = document.getElementById('v2-find-input');
    if (!modal) return;
    modal.classList.add('is-open');
    if (input) {
      // Pre-fill with the tree filter, if any, so context carries over
      const tree = document.getElementById('v2-tree-search');
      if (tree && tree.value) input.value = tree.value;
      setTimeout(() => { input.focus(); input.select(); }, 30);
      runFind(); // populate immediately on open
    }
  }
  function closeFindModal() {
    const modal = document.getElementById('v2-find-modal');
    if (modal) modal.classList.remove('is-open');
  }
  async function runFind() {
    const input   = document.getElementById('v2-find-input');
    const results = document.getElementById('v2-find-results');
    const counter = document.getElementById('v2-find-count');
    if (!input || !results) return;
    const q = (input.value || '').trim();
    results.innerHTML = '';
    if (counter) counter.textContent = q ? 'Searching…' : 'Type to search across every page in your site';
    try {
      const url = _apiBase() + '/api/cms/search?q=' + encodeURIComponent(q) + '&state=draft';
      const res = await fetch(url, {
        credentials: 'include',
        headers: { 'Authorization': 'Bearer ' + (localStorage.getItem('pnec_token') || '') },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const body = await res.json();
      const hits = body.hits || [];
      if (counter) {
        counter.textContent = hits.length
          ? hits.length + ' match' + (hits.length === 1 ? '' : 'es') + (q ? ' for "' + q + '"' : '')
          : (q ? 'Nothing matches "' + q + '"' : 'No sections defined yet — start by adding one.');
      }
      if (!hits.length) {
        const empty = document.createElement('div');
        empty.className = 'v2-find-empty';
        empty.textContent = q ? '🤷 No matches. Try a shorter query or a different page.'
                              : 'Start typing to find any section text on any page.';
        results.appendChild(empty);
        return;
      }
      hits.forEach((hit, idx) => {
        // v3: kind can now be 'section' | 'site_config' | 'override' | 'theme'
        // — older backends omit kind entirely; default to 'section' so this
        // works either way.
        const kind = hit.kind || 'section';
        let typeLabel, typeIcon, locLabel;
        if (kind === 'section') {
          const meta = state.registry.find(t => t.type === hit.type);
          typeLabel = meta ? meta.label : hit.type;
          typeIcon  = (window.V2_ICONS ? window.V2_ICONS.svg(hit.type, { size: 18 }) : '');
          locLabel  = '📄 ' + (hit.page_slug || '');
        } else if (kind === 'site_config') {
          typeLabel = 'Site config';
          typeIcon  = '🌐';
          locLabel  = '🌐 ' + (hit.cfg_key || '');
        } else if (kind === 'override') {
          typeLabel = 'Page override';
          typeIcon  = '✏️';
          locLabel  = '✏️ ' + (hit.page_slug || '') + ' → ' + (hit.element_id || '');
        } else if (kind === 'theme') {
          typeLabel = 'Theme token';
          typeIcon  = '🎨';
          locLabel  = '🎨 ' + (hit.cfg_key || '');
        } else {
          typeLabel = kind; typeIcon = '·'; locLabel = '';
        }
        const row = document.createElement('div');
        row.className = 'v2-find-row v2-find-row--' + kind + (idx === 0 ? ' is-active' : '');
        row.tabIndex = 0;
        row.dataset.kind = kind;
        if (hit.page_slug) row.dataset.pageSlug = hit.page_slug;
        if (hit.sid)        row.dataset.sid       = hit.sid;
        if (hit.cfg_key)    row.dataset.cfgKey    = hit.cfg_key;
        if (hit.element_id) row.dataset.elementId = hit.element_id;
        row.innerHTML = `
          <div class="v2-find-row-icon" aria-hidden="true">${typeIcon}</div>
          <div class="v2-find-row-body">
            <p class="v2-find-row-title">
              <span>${escapeHtml(hit.name || typeLabel)}</span>
              <span class="v2-find-row-pill">${escapeHtml(typeLabel)}</span>
            </p>
            <p class="v2-find-row-page">${escapeHtml(locLabel)}</p>
            <p class="v2-find-row-preview">${escapeHtml(hit.preview || '')}</p>
          </div>
        `;
        row.addEventListener('click', () => jumpToHit(hit));
        row.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); jumpToHit(hit); }
        });
        results.appendChild(row);
      });
    } catch (e) {
      if (counter) counter.textContent = 'Search failed: ' + (e.message || 'unknown');
    }
  }
  function onFindKey(e) {
    const results = document.getElementById('v2-find-results');
    if (!results) return;
    const rows = Array.from(results.querySelectorAll('.v2-find-row'));
    if (!rows.length) return;
    const activeIdx = rows.findIndex(r => r.classList.contains('is-active'));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      rows.forEach(r => r.classList.remove('is-active'));
      const next = rows[Math.min(activeIdx + 1, rows.length - 1)];
      next.classList.add('is-active');
      next.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      rows.forEach(r => r.classList.remove('is-active'));
      const prev = rows[Math.max(activeIdx - 1, 0)];
      prev.classList.add('is-active');
      prev.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const active = rows[activeIdx === -1 ? 0 : activeIdx];
      if (active) {
        const hit = { page_slug: active.dataset.pageSlug, sid: active.dataset.sid };
        jumpToHit(hit);
      }
    }
  }
  async function jumpToHit(hit) {
    closeFindModal();
    const kind = hit.kind || 'section';

    if (kind === 'theme') {
      // Theme tokens live in the Theme tab — switch the sidebar there and
      // try to focus the matching field.
      switchSidebarTab('theme');
      setTimeout(() => {
        const input = document.querySelector('[data-token-key="' + (hit.cfg_key || '') + '"]');
        if (input) {
          input.scrollIntoView({ block: 'center', behavior: 'smooth' });
          if (typeof input.focus === 'function') input.focus();
          input.classList.add('v2-flash');
          setTimeout(() => input.classList.remove('v2-flash'), 1400);
        }
      }, 80);
      return;
    }

    if (hit.page_slug && hit.page_slug !== state.pageSlug) {
      // Switch the page picker first so the URL reflects the new page
      if (elPageSel) {
        const known = Array.from(elPageSel.options).some(o => o.value === hit.page_slug);
        if (!known) {
          const opt = document.createElement('option');
          opt.value = hit.page_slug;
          opt.textContent = hit.page_slug;
          elPageSel.appendChild(opt);
        }
        elPageSel.value = hit.page_slug;
      }
      await switchPage(hit.page_slug);
    }

    if (kind === 'section' && hit.sid) {
      // Wait one tick for the tree to render after page switch
      setTimeout(() => selectSection(hit.sid), 50);
      return;
    }

    if (kind === 'site_config' || kind === 'override') {
      // Existing-content rows live in the Sections sidebar's "Existing
      // content" group. We open the sidebar, then look for the row and
      // simulate a click so the user sees the field highlighted.
      switchSidebarTab('sections');
      setTimeout(() => {
        const targetKey = kind === 'site_config'
          ? 'site_config:' + (hit.cfg_key || '')
          : 'override:' + (hit.page_slug || '') + ':' + (hit.element_id || '');
        const row = document.querySelector('[data-existing-key="' + CSS.escape(targetKey) + '"]');
        if (row) {
          row.scrollIntoView({ block: 'center', behavior: 'smooth' });
          row.click();
          row.classList.add('v2-flash');
          setTimeout(() => row.classList.remove('v2-flash'), 1400);
        }
      }, 100);
    }
  }

  // Tree filter
  function filterTree() {
    const search = document.getElementById('v2-tree-search');
    if (!search) return;
    const q = search.value.toLowerCase().trim();
    elSidebarTree.querySelectorAll('.v2-tree-row').forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = !q || text.includes(q) ? '' : 'none';
    });
    elSidebarTree.querySelectorAll('.v2-tree-group-head').forEach(head => {
      // Show group head if any visible row follows it before the next head
      let next = head.nextElementSibling;
      let anyVisible = false;
      while (next && !next.classList.contains('v2-tree-group-head')) {
        if (next.classList.contains('v2-tree-row') && next.style.display !== 'none') { anyVisible = true; break; }
        next = next.nextElementSibling;
      }
      head.style.display = !q || anyVisible ? '' : 'none';
    });
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

  // ── AI: full page generation (flagship) ──────────────────────────────────
  async function generatePageFromAi() {
    const prompt = (elAiPrompt && elAiPrompt.value || '').trim();
    if (!prompt) { toast('Type a prompt first.', 'error'); return; }
    if (state.template.order.length && !confirm(
      'This will REPLACE all sections on this page with AI-generated content. ' +
      'Your current draft is snapshotted so ⌘Z will undo. Continue?')) return;

    const aiBtn = document.getElementById('v2-ai-go-page');
    if (aiBtn) { aiBtn.disabled = true; aiBtn.textContent = 'Thinking…'; }
    try {
      const beforeJson = JSON.stringify(state.template);
      const result = await window.v2GeneratePage(prompt, state.pageSlug);
      const sections = (result && result.sections) || [];
      // Wipe existing draft, then add each section in order. We bundle this
      // into one replace_template patch so it's a single round-trip.
      const newTemplate = { sections: {}, order: [] };
      sections.forEach((s) => {
        const sid = 'ai' + Math.random().toString(36).slice(2, 10);
        const blocks = {};
        const block_order = [];
        (s.blocks || []).forEach(b => {
          const bid = 'b' + Math.random().toString(36).slice(2, 10);
          blocks[bid] = { type: b.type, settings: b.settings || {} };
          block_order.push(bid);
        });
        newTemplate.sections[sid] = {
          type: s.type,
          settings: s.settings || {},
          visible: true,
          blocks,
          block_order,
        };
        newTemplate.order.push(sid);
      });
      const res = await applyPatch({ op: 'replace_template', template: newTemplate }, { skipUndo: true });
      recordUndo('AI page', beforeJson, JSON.stringify(state.template));
      state.template = res.template;
      renderTree();
      pointIframe(state.pageSlug);
      closePicker();
      toast(`AI built a ${sections.length}-section page.`, 'ok');
      elAiPrompt.value = '';
    } catch (e) {
      toast('AI page-gen failed: ' + (e.message || ''), 'error');
    }
    if (aiBtn) { aiBtn.disabled = false; aiBtn.textContent = '🪄 Whole page'; }
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
