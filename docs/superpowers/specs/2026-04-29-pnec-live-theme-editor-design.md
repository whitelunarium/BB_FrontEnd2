# PNEC Live Theme Editor — Design Spec

**Date:** 2026-04-29
**Status:** Brainstormed and approved (sections 1–7); awaiting user review of this written spec before implementation planning.
**Scope:** v1 — Homepage, About, Programs (3 pages); content + theme editing; postMessage live preview; no draft/publish workflow; no block builder.

---

## 1. Background

### The organization
Poway Neighborhood Emergency Corps (PNEC) is a 501(c)(3) volunteer-run emergency-preparedness nonprofit serving Poway, CA. They currently publish on WordPress at powaynec.com. The volunteer staff updates a small set of pages frequently — the alert banner during fire season, event listings, the homepage hero, blog posts after community meetings — and rarely touches the rest of the site.

### Existing system
The Beasts_FrontEnd / Beasts_Flask project is a redesign of the PNEC site:

- **Frontend:** Jekyll static site (GitHub Pages), JS three-layer pattern (`api/` → orchestrator → DOM) in `assets/js/`, SCSS tokens. Three layout modes are in use:
  - **Homepage** (`index.html`) is Jekyll-processed with `layout: pnec-base` and `use_poway_source_clone: true`. The body content comes from `_includes/poway-live-body.html` (~1200 lines of WordPress/Elementor markup).
  - **About** (`pages/about.html`) and **Programs and Services** (`pages/programs-and-services.html`) are *raw HTML files* with no Jekyll front matter — they are full WordPress exports served as static HTML and must be edited in place.
  - Other public pages (`community-events-and-activities`, `contact`, etc.) use Jekyll layouts normally — out of scope for v1.
- **Backend:** Flask + SQLAlchemy at `https://beasts.opencodingsociety.com` (prod) / `localhost:8425` (dev). JWT bearer-token auth with four roles (resident, coordinator, staff, admin). Admin endpoints gated by `@requires_role('admin')`.
- **Existing admin dashboard:** `pages/admin.html` (1100 lines, 8 tabs: Overview, Alerts, Events, Users, FAQ, Media, Blog, Site Settings). The most recent commit added a blog CMS.

### What is already built but unused
The Flask backend has shipped the following endpoints that the frontend has never wired up:

- `GET /api/sections/<page_slug>`, full CRUD on page sections (8 block types: text_block, image_text, hero, cta_banner, gallery, alert_box, two_column, spacer). `app/routes/page_sections.py`, `app/models/page_section.py`.
- `GET /api/overrides/<page_slug>`, full CRUD on per-element content overrides keyed by `(page_slug, element_id)`. `app/routes/page_overrides.py`, `app/models/page_override.py`.
- `GET /api/site-config` with 25+ default keyed entries grouped by `contact`, `social`, `page_home`, `page_about`, `page_programs`, `footer`, `org`, `images`. `app/routes/site_config.py`, `app/models/site_config.py`.
- `POST /api/site-config/upload-image` for CMS image uploads.

The site-config schema in particular already contains every content field this v1 needs to make editable.

---

## 2. Goal and non-goals

### Goal
Build a Shopify-style "live theme editor" admin feature: a split-screen page where an admin can edit homepage, About-page, and Programs-page content (and a small set of theme settings), see the changes apply instantly to a live iframe of the public site, and save them to the existing Flask backend.

### v1 success criteria
1. An admin can change the homepage headline and see it live in the iframe within 250ms of typing, then save it and reload the public site to confirm persistence.
2. An admin can replace the homepage hero image and see the new image immediately.
3. An admin can switch between Homepage / About / Programs in one selector and edit each page's content.
4. An admin can adjust two theme colors and a logo image via a Theme tab, applied across all pages via CSS custom properties.
5. A public visitor seeing the page during a Flask outage still sees a usable page (Liquid fallback).
6. A non-admin user navigating to `/pages/admin-editor.html` is redirected to login.

### Non-goals (deferred)
- Block builder / drag-to-reorder section UX (the `page_sections` plumbing stays available for v2).
- Draft / publish / preview-token workflow (v1 saves directly to live).
- Inline click-on-page editing (we use field panel + iframe, not contenteditable on the public site).
- Full SEO meta-tag editor (the SEO tab shows "Coming soon").
- Multi-editor concurrency / locking.
- Coverage of pages beyond Homepage / About / Programs.

---

## 3. Architecture

```
┌──────────────────────────────────┐         ┌─────────────────────────────────┐
│  ADMIN: pages/admin-editor.html  │         │  PUBLIC: any tagged Jekyll page │
│  ┌─────────────┬──────────────┐  │         │  ┌──────────────────────────┐   │
│  │ Field panel │ <iframe>     │◄─┼─postMsg─┤  │ data-cms-config="..."    │   │
│  │             │  src=page    │  │ values  │  │ data-cms-override="..."  │   │
│  │  on input → │              │  │         │  └──────────────────────────┘   │
│  └──────┬──────┴──────────────┘  │         │       ▲                          │
│         │  on save               │         │       │ on load                  │
└─────────┼────────────────────────┘         └───────┼──────────────────────────┘
          │                                          │
          ▼                                          ▼
   ┌──────────────────────────────────────────────────────────┐
   │  FLASK                                                   │
   │  GET  /api/site-config            (existing, public)     │
   │  PATCH/api/site-config/<key>      (existing, admin)      │
   │  PATCH/api/site-config/bulk       (existing, admin)      │
   │  POST /api/site-config/upload-image (existing, admin)    │
   │  GET  /api/overrides/<slug>       (existing, public)     │
   │  POST /api/overrides/<slug>/bulk  (existing, admin)      │
   │  GET  /api/cms/manifest/<slug>    (NEW, public)          │
   └──────────────────────────────────────────────────────────┘
```

### Three runtime states for any public page

1. **Normal load.** Page loads, `assets/js/cms/hydrate.js` fetches `/api/site-config` and `/api/overrides/<slug>`, swaps text into `[data-cms-config]` and `[data-cms-override]` elements. Original Liquid content stays as fallback for elements without API values.
2. **Preview load** (`?preview=1`). Same as 1, plus `hydrate.js` subscribes to `window.message` events. The parent editor posts `{type:'cms-update', kind, key, value}` and the script re-applies that single field instantly without a network call.
3. **Edit mode** in `admin-editor.html`. Editor fetches the manifest for the current page, renders the field list, loads the iframe with `?preview=1`. Typing posts updates; clicking Save commits via the existing PATCH-bulk endpoints.

### Data flow on save
1. Admin types in a field. Editor pushes value into `pendingChanges[key] = value`. Debounced 200ms postMessage update to iframe.
2. Admin clicks **Save**. Editor splits `pendingChanges` by `kind` (`config` vs `override`), fires:
   - `PATCH /api/site-config/bulk` with `{updates: {key: value, ...}}`
   - `POST /api/overrides/<slug>/bulk` with `{overrides: {element_id: content, ...}}`
3. On 200, clear `pendingChanges`, toast success, reload iframe without `?preview=1` to verify persisted state.
4. On error, toast failure, retain `pendingChanges` so admin can retry without re-typing.

---

## 4. Backend changes (Flask)

### 4.1 New endpoint: `/api/cms/manifest/<page_slug>`

A new blueprint at `app/routes/cms_manifest.py` (~140 lines). Returns the **editable field schema** for a page. The manifest is defined as a Python dict (constant data), not stored in the DB.

**Route (read-only, public access — no auth):**
```python
@cms_manifest_bp.route('/cms/manifest/<string:page_slug>', methods=['GET'])
def get_manifest(page_slug):
    manifest = MANIFESTS.get(page_slug)
    if not manifest:
        return error_response('NOT_FOUND', 404)
    return jsonify(manifest), 200
```

**Manifest shape:**
```json
{
  "page_slug": "home",
  "page_title": "Homepage",
  "preview_path": "/",
  "sections": [
    {
      "label": "Hero",
      "fields": [
        {"key": "hero_headline",         "kind": "site_config", "type": "text",     "label": "Headline"},
        {"key": "hero_subline",          "kind": "site_config", "type": "text",     "label": "Sub-headline"},
        {"key": "homepage_banner_image", "kind": "site_config", "type": "image",    "label": "Hero image"}
      ]
    },
    {
      "label": "About blurb",
      "fields": [
        {"key": "about_blurb", "kind": "site_config", "type": "richtext", "label": "About paragraph"}
      ]
    }
  ]
}
```

`kind` is `site_config` or `override`. `type` is `text | richtext | image | color`. `preview_path` is the path the editor sets as the iframe `src` (with `?preview=1` appended). For the three v1 pages: home → `/`, about → `/pages/about.html`, programs → `/pages/programs-and-services.html`. The full manifests for home/about/programs are listed in §5.

The blueprint is registered in `app/__init__.py` next to the other blueprints.

### 4.2 New seed entries in `DEFAULT_CONFIG` (site_config.py)

Add three new entries to `DEFAULT_CONFIG`:
```python
{'key': 'theme_primary_color', 'label': 'Theme — Primary Color', 'description': 'Primary accent color used across the site', 'group': 'theme', 'value': '#1e3a8a'},
{'key': 'theme_accent_color',  'label': 'Theme — Accent Color',  'description': 'Secondary accent color',                    'group': 'theme', 'value': '#f59e0b'},
{'key': 'theme_logo_image',    'label': 'Theme — Logo Image',    'description': 'Site logo image URL',                       'group': 'theme', 'value': ''},
```

Seeding is additive (existing values are not overwritten), so this is safe to ship.

### 4.3 What is NOT changing in backend
- Models — no schema changes; no migrations.
- Auth, decorators, role enforcement — unchanged.
- All existing admin CRUD for blog, events, announcements — unchanged. Admin.html keeps its existing tabs.
- `page_sections` endpoints — remain present but unused by v1.

**Total backend lift:** 1 new blueprint file (~140 lines), 3 new seed entries, registration in `__init__.py`. Zero migrations.

---

## 5. Editable field schema (full manifests)

### Homepage (`page_slug: "home"`)

| Section | Field label | Backing key | Type | Source |
|---|---|---|---|---|
| Hero | Headline | `hero_headline` | text | site_config |
| Hero | Sub-headline | `hero_subline` | text | site_config |
| Hero | Hero image | `homepage_banner_image` | image | site_config |
| About | About blurb | `about_blurb` | richtext | site_config |
| Footer | Footer tagline | `footer_tagline` | text | site_config |
| Footer | Footer copyright | `footer_copyright` | text | site_config |

### About (`page_slug: "about"`)

| Section | Field label | Backing key | Type | Source |
|---|---|---|---|---|
| Header | About banner image | `about_banner_image` | image | site_config |
| Who We Are | Paragraph 1 | `about_who_para1` | richtext | site_config |
| Who We Are | Paragraph 2 | `about_who_para2` | richtext | site_config |
| History | History section | `about_history` | richtext | site_config |
| Mission | Mission statement | `about_mission` | richtext | site_config |

### Programs (`page_slug: "programs"`)

| Section | Field label | Backing key | Type | Source |
|---|---|---|---|---|
| Header | Programs banner image | `programs_banner_image` | image | site_config |
| PNEC | PNEC programs paragraph | `programs_pnec_para` | richtext | site_config |
| Fire Safe Council | FSC paragraph | `programs_fsc_para` | richtext | site_config |
| PACT | PACT paragraph | `programs_pact_para` | richtext | site_config |
| Large Animals | Large animal paragraph | `programs_large_animal_para` | richtext | site_config |

### Theme (applied site-wide; reachable from any page in the editor)

| Field label | Backing key | Type | Notes |
|---|---|---|---|
| Primary color | `theme_primary_color` | color | exposed as CSS custom property `--theme-primary` |
| Accent color | `theme_accent_color` | color | exposed as CSS custom property `--theme-accent` |
| Logo image | `theme_logo_image` | image | rendered in nav include |
| Org name | `org_name` | text | site_config |
| Org acronym | `org_short_name` | text | site_config |
| Donate URL | `donate_url` | text | site_config |

All editable v1 fields are site_config–backed. The `kind: "override"` path remains in the manifest contract for v2 use; **no override-backed fields ship in v1.**

---

## 6. Frontend hydration layer

### 6.1 `assets/js/cms/cms-api.js` (~60 lines)

Pure fetch layer, no DOM. Three functions:
- `cmsFetchSiteConfig()` → GET `/api/site-config` → `{config, entries, meta}`.
- `cmsFetchOverrides(slug)` → GET `/api/overrides/<slug>` → `{overrides}`.
- `cmsFetchManifest(slug)` → GET `/api/cms/manifest/<slug>` → manifest object.

Anonymous reads, no auth header.

### 6.2 `assets/js/cms/hydrate.js` (~120 lines)

Auto-runs on `DOMContentLoaded`. Pseudocode:

```javascript
async function hydrate() {
  const slug = document.body.dataset.cmsPage;
  if (!slug) return;
  let config = {}, overrides = {};
  try {
    const [c, o] = await Promise.all([
      cmsFetchSiteConfig(),
      cmsFetchOverrides(slug)
    ]);
    config    = c.config    || {};
    overrides = o.overrides || {};
  } catch (e) {
    console.warn('[cms] hydrate fetch failed; using fallback content', e);
    // intentional: fall through with empty objects, leave Liquid content visible
  }

  applyAll(config, overrides);
  document.body.classList.add('cms-hydrated');

  if (new URLSearchParams(location.search).get('preview') === '1') {
    enablePreviewMode();
  }
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

function applyValue(el, value) {
  if (el.tagName === 'IMG')                     el.src = value;
  else if (el.dataset.cmsHtml === 'true')       el.innerHTML = value;
  else                                          el.textContent = value;
}

function applyThemeVars(config) {
  const root = document.documentElement;
  if (config.theme_primary_color) root.style.setProperty('--theme-primary', config.theme_primary_color);
  if (config.theme_accent_color)  root.style.setProperty('--theme-accent',  config.theme_accent_color);
}

function enablePreviewMode() {
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return; // origin guard
    const msg = event.data;
    if (msg?.type !== 'cms-update') return;
    if (msg.kind === 'config') {
      document.querySelectorAll(`[data-cms-config="${msg.key}"]`).forEach(el => applyValue(el, msg.value));
      if (msg.key.startsWith('theme_')) applyThemeVars({ [msg.key]: msg.value });
    } else if (msg.kind === 'override') {
      document.querySelectorAll(`[data-cms-override="${msg.key}"]`).forEach(el => applyValue(el, msg.value));
    }
  });
}

document.addEventListener('DOMContentLoaded', hydrate);
```

### 6.3 Flash-of-original-content prevention

A small style + safety timer must be present on every tagged page. Because of the three layout modes, the placement differs:

```html
<style>
  body[data-cms-page]:not(.cms-hydrated) [data-cms-config],
  body[data-cms-page]:not(.cms-hydrated) [data-cms-override] {
    visibility: hidden;
  }
</style>
<script>
  setTimeout(() => document.body.classList.add('cms-hydrated'), 800);
</script>
```

If hydrate succeeds first, the class is set immediately; if it fails or stalls, the safety timer at 800ms reveals the original content. The page never stays invisible.

### 6.4 Page tagging and script injection (per layout mode)

The script tag and tagging happen in different files for each of the three target pages:

**Homepage (`index.html` + `_includes/poway-live-body.html`).**
- Add `data-cms-page="home"` to the `<body>` of `_layouts/pnec-base.html` when `page.use_poway_source_clone` is set, *or* via a wrapping `<div data-cms-page="home">` inside `_includes/poway-live-body.html`. Wrapping div is preferred to avoid touching the shared layout.
- Add `data-cms-config="<key>"` attributes to specific elements within `_includes/poway-live-body.html` (e.g., the headline `<h1>`, sub-headline `<p>`, hero `<img>`, about-blurb paragraph). The cloned WP markup is deeply nested Elementor; we add attributes to the innermost text-bearing element only.
- Add `<script src="{{ '/assets/js/cms/cms-api.js' | relative_url }}"></script>` and `<script src="{{ '/assets/js/cms/hydrate.js' | relative_url }}"></script>` to `_layouts/pnec-base.html` near the existing core scripts (line ~127).
- Inline the flash-prevention `<style>` and safety-timer `<script>` in `_layouts/pnec-base.html` `<head>`.

**About (`pages/about.html`) and Programs (`pages/programs-and-services.html`).** These are raw HTML files — edit them directly:
- Add `data-cms-page="about"` (or `"programs"`) to the outermost wrapping element (or to `<body>` if reachable).
- Add `data-cms-config="<key>"` to the innermost text-bearing elements (~5 per page).
- Insert the flash-prevention `<style>` immediately after `</title>` in the `<head>`.
- Insert `<script src="/assets/js/cms/cms-api.js"></script>` and `<script src="/assets/js/cms/hydrate.js"></script>` immediately before `</body>`. Use absolute paths (these files don't go through Liquid `relative_url`).

Rich-text fields opt into `innerHTML` swap with `data-cms-html="true"`.

### 6.5 Files touched in frontend
- **New:** `assets/js/cms/cms-api.js`, `assets/js/cms/hydrate.js`.
- **Edit:** `_layouts/pnec-base.html` — add hydrate script tags + flash-prevention CSS in `<head>`.
- **Edit:** `_includes/poway-live-body.html` — add `data-cms-page="home"` wrapper and `data-cms-config="..."` attributes on ~6 elements (homepage hero, about blurb, footer tagline/copyright).
- **Edit:** `pages/about.html` — direct edits: head style, body wrapper or `data-cms-page="about"`, `data-cms-config="..."` attributes on ~5 elements, script tags before `</body>`.
- **Edit:** `pages/programs-and-services.html` — same pattern as about.html with `data-cms-page="programs"` and ~5 element tags.

---

## 7. Editor UI (`pages/admin-editor.html`)

A new top-level admin page (~600 lines HTML+CSS+JS, matching the style of `admin.html`).

### Layout
- **Top bar:** title, page selector (Home / About / Programs), tab switcher (Content / Theme / SEO), Discard, Save.
- **Left panel (340px):** field panel, generated from the manifest. Sections are headers; fields are widgets typed by `manifest.fields[].type`.
- **Right panel (fills remaining):** iframe of the selected public page with `?preview=1`. Iframe toolbar shows refresh, URL, LIVE indicator.

### Field widgets by type
- `text` → `<input type="text">`.
- `richtext` → `<textarea rows="6">`. v1 stores raw HTML; the rendering side opts into `innerHTML` via `data-cms-html="true"`. (Upgrade to a contenteditable widget is out of scope.)
- `image` → button "Choose image…" → opens a file picker → POSTs to `/api/site-config/upload-image` → on success, updates the field's value to the returned URL and shows a thumbnail.
- `color` → `<input type="color">` plus a hex text input.

### Behavior
1. **On load.** Read `pnec_token` and `pnec_user` from localStorage. If `user.role !== 'admin'`, redirect to `/login`. Fetch `/api/cms/manifest/home` (default page) and `/api/site-config` for initial values. Render the field panel. Load the iframe with `src="/?preview=1"`.
2. **On input** (debounced 200ms):
   1. Update `pendingChanges[key] = value` (key includes `kind` to know which API to PATCH later).
   2. PostMessage `{type:'cms-update', kind, key, value}` to iframe (with origin = `window.location.origin`).
   3. Mark Save button enabled.
3. **On Save:**
   1. Group `pendingChanges` by `kind`.
   2. `kind === 'config'` → `PATCH /api/site-config/bulk` with `{updates: {key: value, ...}}`.
   3. `kind === 'override'` → `POST /api/overrides/<slug>/bulk` with `{overrides: {element_id: content, ...}}`.
   4. `Promise.all`. On all-OK: clear `pendingChanges`, toast success, reload iframe without `?preview=1` to verify persistence.
   5. On any failure: toast error, keep `pendingChanges`.
4. **On Discard:** clear `pendingChanges`, reload iframe with `?preview=1` (which re-fetches saved values).
5. **On page selector change:** if `pendingChanges` non-empty, confirm-discard prompt. Otherwise fetch new manifest, reset state, reload iframe.

### Tabs
- **Content** — fields from `manifest.sections`.
- **Theme** — the six theme fields from §5.
- **SEO** — placeholder "Coming soon" for v1.

### New JS files
- `assets/js/admin/editor-api.js` (~50 lines) — `editorFetchManifest(slug)`, `editorBulkUpdateConfig(updates)`, `editorBulkUpdateOverrides(slug, overrides)`. Bearer-token auth via the existing `_admAuthHeaders()` pattern from `admin-api.js`.
- `assets/js/admin/editor-controller.js` (~250 lines) — orchestrator; renders fields, handles input/save/discard, owns the postMessage protocol.

### Link from existing admin.html
Add a single "Open Live Editor →" link in admin.html's header pointing to `pages/admin-editor.html`. No restructuring of the existing dashboard.

---

## 8. Auth, errors, fallback

### Auth gating
- Editor page reads `pnec_token` + `pnec_user` from localStorage; redirects non-admin to `/login` (same pattern as `admin.html`).
- Editor PATCH calls send `Authorization: Bearer <token>`. Backend already enforces `@requires_role('admin')` on `/api/site-config/*` and `/api/overrides/*`.
- Public hydrate.js sends no auth and uses public GET endpoints.
- postMessage origin guard: `hydrate.js` rejects events whose `event.origin` doesn't match `window.location.origin`. Editor likewise verifies the iframe's posted origin.

### Error handling
- **Public hydrate fetch failure.** Catch, log to console, leave Liquid fallback content visible. **No banner shown to public visitors.** A wildfire-alert reader should never see "API unavailable" on the homepage.
- **Editor manifest fetch failure.** Toast: "Could not load fields. Refresh to retry." Save disabled.
- **Save failure.** Toast with error message. `pendingChanges` retained so admin can retry without re-typing.
- **Image upload failure.** Toast. Field value unchanged.
- **postMessage delivery failure.** Iframe-load handler replays queued updates. If preview unresponsive after 5s, editor shows a yellow "Preview not responding — Save will still apply changes" banner.

### Public-page fallback discipline
Every `data-cms-config` and `data-cms-override` element ships with the original Liquid-rendered content inside it. Hydrate **replaces only when API returns a value.** If Flask is down, original content is the source of truth.

### Concurrency
Out of scope for v1. Last-writer-wins; the existing `updated_by` and `updated_at` audit columns provide retroactive blame. Two simultaneous editors won't see each other's changes until refresh.

---

## 9. Testing

### Backend (pytest, real DB — same convention as the rest of the suite)
File: `tests/test_cms_manifest.py`. Cases:
1. `GET /api/cms/manifest/home` returns the expected sections and field keys.
2. `GET /api/cms/manifest/about` returns about-page fields.
3. `GET /api/cms/manifest/programs` returns programs-page fields.
4. `GET /api/cms/manifest/<unknown>` returns 404.
5. **Manifest-keys-exist-in-seed test:** every `field.key` where `kind == 'site_config'` exists as a key in `DEFAULT_CONFIG`. (Catches drift between manifest and seed.)

### Frontend pure-function unit tests
Tiny harness, no Jest. File: `assets/js/cms/hydrate.test.mjs`. Run with `node assets/js/cms/hydrate.test.mjs`. Covers:
1. `applyValue(el, value)` dispatches correctly for `<img>`, `data-cms-html=true`, and default text.
2. The postMessage parser ignores wrong-origin and wrong-type messages.

### Manual verification checklist (must all pass before feature is "done")
1. Public homepage renders with API-served `hero_headline`.
2. Public homepage renders fallback Liquid value when Flask is stopped.
3. `/pages/admin-editor.html` redirects non-admin to login.
4. Page selector switches between Home / About / Programs.
5. Typing in a field updates the iframe within ~250ms.
6. Discard restores iframe to saved value.
7. Save persists; reloading the public page shows the saved value.
8. Image upload picks a file, uploads, replaces the URL, iframe shows the new image.
9. Theme color change applies the CSS custom property in the iframe.
10. Editor's iframe-unresponsive banner appears after 5s when preview is broken.

### Test execution sequence
1. `cd /Users/samarthvaka/Beasts_Flask && pytest tests/test_cms_manifest.py`
2. `curl http://localhost:8425/api/cms/manifest/home` returns 200 with manifest.
3. `node assets/js/cms/hydrate.test.mjs` passes.
4. Manual checklist 1–10 against `bundle exec jekyll serve` + Flask running locally.

### What we don't test in v1
- Multi-editor concurrency.
- Cross-browser visual regression (manual Chrome verification only).
- E2E / Playwright (no existing infra; not justified for ~3 admin users).

---

## 10. Files and lift summary

### New files
| Path | Purpose | Approx lines |
|---|---|---|
| `Beasts_Flask/app/routes/cms_manifest.py` | New blueprint, `MANIFESTS` dict, GET route | ~140 |
| `Beasts_Flask/tests/test_cms_manifest.py` | pytest for the manifest endpoint | ~80 |
| `Beasts_FrontEnd/assets/js/cms/cms-api.js` | Public-read API layer | ~60 |
| `Beasts_FrontEnd/assets/js/cms/hydrate.js` | Public-page hydration | ~120 |
| `Beasts_FrontEnd/assets/js/cms/hydrate.test.mjs` | Pure-function unit tests | ~30 |
| `Beasts_FrontEnd/assets/js/admin/editor-api.js` | Editor API layer | ~50 |
| `Beasts_FrontEnd/assets/js/admin/editor-controller.js` | Editor orchestrator | ~250 |
| `Beasts_FrontEnd/pages/admin-editor.html` | The editor page | ~600 |

### Edited files
| Path | Change |
|---|---|
| `Beasts_Flask/app/__init__.py` | Register `cms_manifest_bp`. |
| `Beasts_Flask/app/routes/site_config.py` | Add 3 theme keys (`theme_primary_color`, `theme_accent_color`, `theme_logo_image`) to `DEFAULT_CONFIG`. |
| `Beasts_FrontEnd/_layouts/pnec-base.html` | Add hydrate script tags + flash-prevention CSS in `<head>`. |
| `Beasts_FrontEnd/_includes/poway-live-body.html` | Add `data-cms-page="home"` wrapping div + `data-cms-config="..."` on ~6 homepage elements. |
| `Beasts_FrontEnd/pages/about.html` | Direct edits to raw HTML: head style, `data-cms-page="about"`, ~5 `data-cms-config` attributes, script tags before `</body>`. |
| `Beasts_FrontEnd/pages/programs-and-services.html` | Same pattern as about.html with `data-cms-page="programs"` and ~5 element tags. |
| `Beasts_FrontEnd/pages/admin.html` | Add "Open Live Editor →" link. |

### Total v1 lift
- ~1330 lines new code (mostly editor UI: 600 HTML + 250 JS).
- ~10 small edits to existing files.
- 0 database migrations.
- 0 changes to auth, blog, events, announcements, or any other existing feature.

---

## 11. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Manifest drifts from `DEFAULT_CONFIG` (admin sees field that 404s on save) | Medium | Test 5 in §9 enforces invariant. |
| Flash of original Liquid content before hydrate runs | Medium | Inlined CSS hides tagged elements until `cms-hydrated`; safety timer at 800ms. |
| Public visitor sees error during Flask outage | Low | Liquid fallback. Hydrate fails silently. |
| Admin types into broken iframe and loses changes | Low | `pendingChanges` retained on save failure; iframe-unresponsive banner. |
| `innerHTML` injection via richtext field | Medium | Only fields with explicit `data-cms-html="true"` use innerHTML; admin role required to write; no untrusted input source. |
| Cross-origin postMessage abuse | Low | Origin guard on both sides. |
| Two admins overwrite each other's edits | Low | v1 accepts last-writer-wins; audit columns retain history; v2 can add locks. |

---

## 12. Future work (deferred from v1)

- Block builder UX for `page_sections`.
- Per-element overrides UX (clicking text on the public page in edit mode → modal). Backend already supports this.
- Draft / publish workflow with preview tokens.
- SEO meta-tag editor (the SEO tab is reserved).
- Coverage of additional pages (Events, Contact, Resources, Neighborhoods).
- Multi-editor locking and presence indicators.
- Rich-text WYSIWYG editor for `richtext` fields.
- Undo/redo within an editing session.
