# PNEC Live Editor v2 — Design Spec

**Date:** 2026-05-02
**Status:** Concise spec for autonomous overnight implementation. v1 already shipped (`docs/superpowers/specs/2026-04-29-pnec-live-theme-editor-design.md`); this builds on that foundation.
**Scope:** Tier 1 from the post-v1 research synthesis — sections+blocks data model, schema registry, section rendering API, preview inspector, sidebar tree, draft/publish split.

---

## 1. Background

v1 ships a flat `data-cms-config` → site-config-key mapping. Adding an editable region means: tag an HTML element, add a field to the manifest, add a seed to `DEFAULT_CONFIG`. Three places to change for one new editable thing. No way to add/remove/reorder *sections* — only edit values into existing fixed slots.

v2 takes the leap to a **component-composed** model lifted from Shopify: a page is an ordered list of section instances, each with typed settings, optionally containing typed blocks. Adding a new section *type* means dropping two files; instantiating a section means an entry in JSON. Reordering is a list mutation.

---

## 2. Goals & non-goals

**v2 success criteria:**
1. An admin can add a "Text Block" section to the homepage from the editor, give it a heading + body, save, and reload the public page to see it appear in the right place.
2. The same admin can drag-reorder sections in the sidebar and the public page reflects the new order on save.
3. The same admin can hover any element in the iframe preview, see a blue outline, click it, and land on its settings.
4. Edits go to a draft state by default; only "Publish" makes them visible to the public.
5. The public site, when Flask is unreachable, still renders correctly (Liquid fallback content survives).
6. v1 keeps working — `pages/admin-editor.html` and `data-cms-config` hydration continue to function unchanged for fields that were already wired up.

**Non-goals (deferred):**
- Per-block device visibility / breakpoint preview tabs
- Theme tokens file / named color schemes
- AI section generation
- Stega-encoded strings for inline text editing
- Click-to-edit text directly in canvas (still field-panel-driven in v2)
- Section presets ("Volunteer Signup template," etc.)
- Conditional settings (show field X only if field Y true)
- Undo/redo stack
- Multi-user real-time editing

---

## 3. Architecture

### 3.1 The four-layer content model

```
┌─ THEME (Git, code) ──────────────────────────────────────────────┐
│  _includes/sections/<type>.html      Liquid include for one      │
│                                       section type's render      │
│  _includes/sections/<type>.schema.json  Editor field schema      │
│  assets/js/cms/sections-registry.js  Auto-loaded list of types   │
│                                       and their schemas          │
└──────────────────────────────────────────────────────────────────┘
                              ▲
                              │  (devs commit new section types)
                              │
┌─ DATA (Flask DB, per page) ──────────────────────────────────────┐
│  page_template:  { page_slug, state, template_json, updated_at } │
│   state = 'draft' | 'published' (one of each per page)           │
│   template_json shape:                                           │
│     {                                                            │
│       "sections": {                                              │
│         "<sid>": {                                               │
│           "type": "text_block",                                  │
│           "settings": { "heading": "...", "body": "..." },       │
│           "visible": true,                                       │
│           "blocks": {                                            │
│             "<bid>": { "type": "item", "settings": {...} }       │
│           },                                                     │
│           "block_order": ["<bid>", ...]                          │
│         }                                                        │
│       },                                                         │
│       "order": ["<sid>", "<sid>", ...]                           │
│     }                                                            │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Runtime states for any public page

The body has `data-cms-page="<slug>"` (already added in v1). v2 changes hydrate.js:

1. **Normal load.** Fetch `GET /api/cms/page/<slug>?state=published` → returns `{template_json, sections_html: {sid: html, ...}}`. Hydrate.js scans `[data-cms-section-host]` (a placeholder div on the page that says "render the v2 section list here") and injects the rendered HTML in `order`. Original Liquid content outside the host is the v1 fallback path; v2 sections live only inside the host. If fetch fails, the host stays empty and the original v1 page (with its `data-cms-config` text and the static carousel etc.) remains visible.

2. **Preview load** (`?preview=1`). Same as 1, but `state=draft` and hydrate.js subscribes to `cms:section:*` and `cms:block:*` CustomEvents emitted on `document`. Editor parent posts messages → hydrate dispatches the matching CustomEvent → re-renders just the affected section by calling the section rendering API.

3. **Edit mode** in admin-editor-v2.html. Editor fetches `GET /api/cms/page/<slug>?state=draft` for the template, plus `GET /api/cms/sections-registry` for available section types. Renders the sidebar tree from `template_json.order`. On any operation (add/move/edit/delete), PATCHes the draft template and re-renders the affected section via the rendering API.

### 3.3 Section Rendering API

`GET /api/cms/render?page=<slug>&section=<sid>&state=draft|published`

Response:
```json
{
  "section_id": "<sid>",
  "section_type": "text_block",
  "html": "<div id=\"cms-section-<sid>\" data-cms-section-id=\"<sid>\" data-cms-section-type=\"text_block\">...</div>"
}
```

Implementation: Flask reads the `template_json` from DB, looks up the section's `type` and `settings`, renders the `_includes/sections/<type>.html` Liquid template via the `liquid` Python package (or a small Jinja-equivalent). The rendered HTML always includes the wrapper div with stable id and data-attributes so the editor can target it precisely.

This avoids full iframe reload on save — editor swaps `outerHTML` of the matching `#cms-section-<sid>` element with the response.

### 3.4 Editor ↔ preview iframe protocol

Direct postMessage from editor parent to iframe child. Iframe re-dispatches as `document` CustomEvents (Shopify pattern). Event grammar copied from Shopify almost verbatim, namespaced `cms:` instead of `shopify:`:

| Event name | detail | When |
|---|---|---|
| `cms:section:load` | `{sectionId}` | Section was added or just re-rendered; section JS should re-init |
| `cms:section:unload` | `{sectionId}` | Section is about to be re-rendered or deleted; cleanup |
| `cms:section:select` | `{sectionId, load}` | User selected this section in the sidebar or via inspector |
| `cms:section:reorder` | `{sectionId, newIndex}` | Section moved |
| `cms:block:select` | `{blockId, sectionId, load}` | User selected a block |
| `cms:block:reorder` | `{blockId, sectionId, newIndex}` | Block moved within a section |
| `cms:inspector:activate` / `cms:inspector:deactivate` | — | Hover-inspect mode toggled |
| `cms:settings:patch` | `{sectionId, blockId?, key, value}` | Settings field edited (debounced) |

postMessage envelope from editor to iframe: `{ type: <event-name>, ... detail }`. Iframe origin-checks against `window.location.origin` and dispatches matching CustomEvent on `document`.

### 3.5 Draft / publish workflow

Each page has up to two rows in `page_template`: one `state='draft'`, one `state='published'`. Editor reads/writes draft; "Publish" copies `draft.template_json` → `published.template_json` (creates `published` row if missing). Public site loads `state=published` (default for normal page hits). Admins viewing iframe preview load `state=draft` via `?preview=1`. A token-protected URL `?preview=1&token=<random>` lets admins share preview links with non-admins for review (token TTL: 7 days).

Audit columns: `updated_at`, `updated_by`, `published_at`, `published_by`.

---

## 4. Backend changes (Flask)

### 4.1 New model: `PageTemplate`

```python
# app/models/page_template.py

class PageTemplate(db.Model):
    __tablename__ = 'page_templates'
    __table_args__ = (db.UniqueConstraint('page_slug', 'state', name='uq_page_state'),)

    id            = db.Column(db.Integer, primary_key=True)
    page_slug     = db.Column(db.String(80), nullable=False, index=True)
    state         = db.Column(db.String(16), nullable=False)  # 'draft' | 'published'
    template_json = db.Column(db.Text,       nullable=False, default='{}')  # JSON string
    updated_at    = db.Column(db.DateTime,   nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by    = db.Column(db.Integer,    db.ForeignKey('users.id'), nullable=True)

    # to_dict, get_template, set_template helpers
```

### 4.2 New model: `PreviewToken`

```python
class PreviewToken(db.Model):
    __tablename__ = 'preview_tokens'
    id         = db.Column(db.Integer, primary_key=True)
    token      = db.Column(db.String(64), unique=True, nullable=False, index=True)
    page_slug  = db.Column(db.String(80), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_by = db.Column(db.Integer,  db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
```

### 4.3 New routes (`app/routes/cms_v2.py`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/cms/page/<slug>` | public (published) / token-or-admin (draft) | Returns `{template_json, sections_html: {sid: html}}` |
| `PATCH` | `/api/cms/page/<slug>/draft` | admin | Bulk update sections in draft. Body: `{ patches: [{sid, op: 'set'\|'add'\|'remove'\|'reorder', ...}] }` |
| `POST` | `/api/cms/page/<slug>/publish` | admin | Copy draft → published; record `published_at`, `published_by` |
| `GET` | `/api/cms/render?page=<slug>&section=<sid>&state=...` | public (published) / token-or-admin (draft) | Returns rendered HTML for one section |
| `GET` | `/api/cms/sections-registry` | public | Lists section types (id, label, schema, defaults). Loaded from filesystem at startup. |
| `POST` | `/api/cms/page/<slug>/preview-token` | admin | Generates 7-day preview token |
| `GET` | `/api/cms/page/<slug>/draft` | admin or token | Convenience: returns draft template_json directly |

### 4.4 Section type registry loader

`app/services/cms_registry.py` — at startup, scans `assets/js/cms/sections/` (path passed via env) for `<type>.schema.json` files. Builds an in-memory dict: `{type: {label, schema, defaults}}`. Also reads `<type>.html` (Liquid template content) and caches it for renders.

For the autonomous overnight run, sections live in **the frontend repo** (Jekyll worktree path). Flask reads them from a configured path. This keeps section types versioned with the frontend code.

### 4.5 Liquid rendering

Use `python-liquid` (`pip install python-liquid`). Render a section:

```python
from liquid import Template
t = Template(section_html_source)
rendered = t.render(section=section_dict, settings=section_dict['settings'], blocks=section_dict.get('blocks', {}))
```

Wrap result in:
```html
<div id="cms-section-<sid>" data-cms-section-id="<sid>" data-cms-section-type="<type>" data-cms-section-visible="true|false">{{rendered}}</div>
```

### 4.6 Files

**New:**
- `app/models/page_template.py`
- `app/models/preview_token.py`
- `app/routes/cms_v2.py` (~400 lines)
- `app/services/cms_registry.py` (~120 lines)
- `app/services/cms_renderer.py` (~80 lines)
- `tests/test_cms_v2.py` (~300 lines)
- `tests/test_cms_registry.py` (~80 lines)

**Modified:**
- `app/__init__.py` — register `cms_v2_bp`
- `requirements.txt` — add `python-liquid==1.13.0`
- `app/config.py` — add `CMS_SECTIONS_PATH` config

---

## 5. Frontend changes (Jekyll)

### 5.1 Section type files

Each section type is a triple of files at `assets/js/cms/sections/<type>/`:

- `<type>.html` — Liquid template (the Jekyll/Liquid source rendered by Flask)
- `<type>.schema.json` — editor schema
- `<type>.preview.svg` (optional) — small icon shown in the section picker

**Three starter section types ship in v2:**

1. **`hero`** — large headline + sub-headline + image + CTA.
   - settings: `headline` (text), `sub_headline` (text), `image_url` (image), `cta_label` (text), `cta_url` (url), `text_alignment` (select: left/center/right)

2. **`text_block`** — heading + rich-text body.
   - settings: `heading` (text), `body` (richtext), `text_alignment` (select)

3. **`image_with_text`** — image + heading + text + CTA, with image-position toggle.
   - settings: `image_url` (image), `heading` (text), `body` (richtext), `cta_label` (text), `cta_url` (url), `image_position` (select: left/right)

Each schema:
```json
{
  "type": "hero",
  "label": "Hero",
  "category": "headers",
  "icon": "hero.svg",
  "limit": null,
  "settings": [
    { "id": "headline",     "type": "text",     "label": "Headline",     "default": "Headline" },
    { "id": "sub_headline", "type": "text",     "label": "Sub-headline" },
    { "id": "image_url",    "type": "image",    "label": "Image" },
    { "id": "cta_label",    "type": "text",     "label": "CTA label",    "default": "Learn more" },
    { "id": "cta_url",      "type": "url",      "label": "CTA link" },
    { "id": "text_alignment", "type": "select", "label": "Text alignment", "options": ["left","center","right"], "default": "center" }
  ]
}
```

### 5.2 Section host in pages

A page's body gets a single `<div data-cms-section-host="home"></div>` in `_includes/poway-live-body.html` (homepage only for v2; about/programs in a later iteration). Hydrate.js fills this div with rendered sections from the API. The existing v1 hero/about-blurb/footer-copyright `data-cms-config` tags remain functional alongside.

### 5.3 hydrate.js v2 additions

Append to existing hydrate.js:

```javascript
async function hydrateSectionHosts() {
  const hosts = document.querySelectorAll('[data-cms-section-host]');
  for (const host of hosts) {
    const slug = host.dataset.cmsSectionHost;
    const state = new URLSearchParams(location.search).get('preview') === '1' ? 'draft' : 'published';
    try {
      const res = await fetch(_apiBase() + `/api/cms/page/${slug}?state=${state}`);
      if (!res.ok) continue;
      const { template_json, sections_html } = await res.json();
      const order = (template_json && template_json.order) || [];
      host.innerHTML = order.map(sid => sections_html[sid] || '').join('');
      // Dispatch load events
      order.forEach(sid => {
        document.dispatchEvent(new CustomEvent('cms:section:load', { detail: { sectionId: sid } }));
      });
    } catch (e) {
      console.warn('[cms-v2] section-host hydrate failed', e);
    }
  }
}

function enablePreviewSectionUpdates() {
  // listen for editor postMessages → re-render single section
  window.addEventListener('message', async (event) => {
    if (event.origin !== window.location.origin) return;
    const msg = event.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'cms:section:rerender') {
      const res = await fetch(_apiBase() + `/api/cms/render?page=${msg.page}&section=${msg.sectionId}&state=draft`);
      if (!res.ok) return;
      const { html } = await res.json();
      const old = document.getElementById('cms-section-' + msg.sectionId);
      if (old) {
        document.dispatchEvent(new CustomEvent('cms:section:unload', { detail: { sectionId: msg.sectionId } }));
        old.outerHTML = html;
        document.dispatchEvent(new CustomEvent('cms:section:load', { detail: { sectionId: msg.sectionId } }));
      }
    }
    // ... handle :select, :inspector:activate, etc.
  });
}
```

### 5.4 Editor v2 page

`pages/admin-editor-v2.html` — entirely new file. Layout:

```
┌─ Top bar ─────────────────────────────────────────────────────┐
│ PNEC Live Editor v2 │ [Page▼] │ Preview │ [Discard] [Save] │ Publish │
└───────────────────────────────────────────────────────────────┘
┌─ Sidebar (340px) ─────┐ ┌─ Iframe (rest) ────────────────────┐
│ Sections (drag list)  │ │ live preview, optional inspector   │
│   ▾ Hero               │ │ overlay                            │
│     [settings panel]   │ │                                    │
│   • Text block         │ │                                    │
│   • Image with text    │ │                                    │
│ [+ Add section]        │ │                                    │
│                        │ │                                    │
│ Theme settings link    │ │                                    │
└────────────────────────┘ └────────────────────────────────────┘
```

Selected section's settings panel slides in over the section list (single-column on narrow screens, side-by-side on wide). Add Section button opens a categorized picker modal.

### 5.5 Frontend files

**New:**
- `assets/js/cms/sections-registry.js` — fetches and caches `/api/cms/sections-registry`
- `assets/js/cms/sections/hero/hero.html`, `hero.schema.json`
- `assets/js/cms/sections/text_block/text_block.html`, `text_block.schema.json`
- `assets/js/cms/sections/image_with_text/image_with_text.html`, `image_with_text.schema.json`
- `assets/js/admin/editor-v2-api.js` (~80 lines)
- `assets/js/admin/editor-v2-tree.js` (~250 lines) — sidebar tree + drag-reorder via SortableJS or vanilla HTML5 drag
- `assets/js/admin/editor-v2-inspector.js` (~120 lines) — preview inspector overlay
- `assets/js/admin/editor-v2-controller.js` (~400 lines) — orchestrator
- `pages/admin-editor-v2.html` (~700 lines)

**Modified:**
- `assets/js/cms/hydrate.js` — add `hydrateSectionHosts` + section message handlers
- `_includes/poway-live-body.html` — add `<div data-cms-section-host="home">` somewhere reasonable (after the carousel, before the program tiles)
- `pages/admin.html` — add link to v2 editor next to v1 link

---

## 6. Auth, errors, fallback

- All write endpoints require `@requires_role('admin')` (existing decorator).
- Public reads of `state=published` require no auth.
- Reads of `state=draft` require admin auth OR a valid `PreviewToken` in `?token=...` query.
- Hydrate fetch failure: section host stays empty, console warning, no user-visible error.
- Save failure: editor toast, pending changes retained.
- Iframe-unresponsive watchdog: same 5s pattern as v1.
- Origin-check on postMessage on both sides.

---

## 7. Testing

**Backend (pytest):**
- Model: insert/read PageTemplate; uniqueness (page_slug, state)
- Routes: GET /api/cms/page/<slug> for missing → 404; for present → expected shape; for draft without auth → 401/403
- PATCH `add` op → section appears in template_json + order
- PATCH `reorder` op → order array changes
- PATCH `remove` op → section removed
- POST publish → published row created/updated; idempotent
- Render API → wrapper has correct `data-cms-section-id`, `data-cms-section-type`
- Registry: lists 3 starter sections; each has well-formed schema

**Frontend (Node assert):**
- Section host hydrate function: applies `order` correctly, handles missing sids
- postMessage parser: rejects bad origin, bad type
- Inspector path-resolution: maps DOM element to closest `[data-cms-section-id]`

**Manual check (after implementation):**
1. Visit homepage → existing carousel + new section host both render
2. Open `/pages/admin-editor-v2.html` as admin → sidebar tree populated
3. Click "+ Add section" → pick "Text block" → appears in sidebar + in iframe
4. Drag-reorder → iframe order updates within ~250ms (no full reload)
5. Edit a setting → section re-renders in iframe within ~250ms
6. Click Publish → reload public homepage → changes visible
7. v1 admin editor at `/pages/admin-editor.html` still works for site-config fields

---

## 8. Deferred / known holes

- v2 only ships for the homepage (`page_slug=home`). About / Programs in a follow-up.
- Inspector hover-outline supports section-level only; block-level inspector is in Tier 2.
- No undo/redo (saves are PATCHes; revert = manual edit).
- No conditional settings.
- No section presets beyond one preset per type (defined in schema).
- Block reorder UI is sidebar-only; no drag in iframe.
- No mobile/tablet preview viewport toggle.

---

## 9. Files & lift summary

- ~6 new Flask files (~1000 lines + tests)
- ~10 new frontend files (~1700 lines)
- ~3 modified files
- 1 small DB migration (or `db.create_all()` since we're SQLite-friendly)

Total: ~2700 lines new code, executable in a single overnight run if subagents stay focused.
