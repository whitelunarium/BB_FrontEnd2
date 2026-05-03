# PNEC Live Editor v2 — Overnight Run Status

**Started:** 2026-05-02 ~22:42
**Run mode:** Single autonomous turn
**Caffeinate PID:** 85764 (Mac stayed awake)
**Branch (FE):** `claude/strange-johnson-175d40` (worktree)
**Branch (BE):** `main`
**Push policy honored:** No pushes to remote during run.
**v1 policy honored:** v1 admin editor (`pages/admin-editor.html`) and `data-cms-config` hydration unchanged. v2 ships alongside.

---

## What got built

A **fully working v2 of the live editor** based on Shopify's section/block model. The page is now an ordered list of section instances stored as a JSON template; each section has typed settings; some sections (like FAQ) contain repeatable blocks with their own typed settings. Every change hot-swaps a single section in the iframe via the new render API — no more full reloads.

### Backend (Beasts_Flask, commit `325db83`)

- **`app/models/page_template.py`** — `PageTemplate` model: per page, per state (`draft` | `published`), one row each holding the JSON template.
- **`app/models/preview_token.py`** — 7-day tokens for sharing draft previews with non-admins.
- **`app/services/cms_registry.py`** — auto-discovers section types from `app/cms_sections/<type>/` at startup. Each type is a `<type>.html` (Liquid) + `<type>.schema.json`.
- **`app/services/cms_renderer.py`** — renders sections via `python-liquid`, wraps output in `<div id="cms-section-<sid>" data-cms-section-id data-cms-section-type data-cms-section-visible>`.
- **`app/routes/cms_v2.py`** — full v2 API:
  - `GET  /api/cms/sections-registry` → list available types + schemas
  - `GET  /api/cms/page/<slug>?state=published|draft&token=...` → template + rendered HTML map
  - `PATCH /api/cms/page/<slug>/draft` with patch ops `add`, `remove`, `duplicate`, `reorder`, `set`, `bulk_set`, `visibility`, `add_block`, `remove_block`, `reorder_blocks`, `set_block`
  - `POST /api/cms/page/<slug>/publish` → copy draft → published
  - `GET  /api/cms/render?page=…&section=…&state=…` → single-section HTML for hot-swap
  - `POST /api/cms/page/<slug>/preview-token` → admin issues a share link
- **Section types shipped: 4** (`hero`, `text_block`, `image_with_text`, `faq`). FAQ uses blocks (Q/A items).
- **27 new pytest tests** covering registry, page read, every patch op, publish idempotency, render API, preview tokens, and FAQ blocks end-to-end. **Total 37 tests, all green.**
- `requirements.txt` adds `python-liquid==1.13.0`.
- `app/config.py` adds `CMS_SECTIONS_PATH`.
- `app/__init__.py` registers `cms_v2_bp` and initializes the registry on startup.

### Frontend (Beasts_FrontEnd worktree, commit `712d84e`)

- **`pages/admin-editor-v2.html`** — full editor shell. Auth gate, top bar (page selector, Inspector toggle, Share link, View live, Publish), sidebar with section tree + settings panel, iframe preview, section picker modal, toast.
- **`assets/js/admin/editor-v2-api.js`** — pure-fetch API layer.
- **`assets/js/admin/editor-v2-controller.js`** — orchestrator with:
  - Sidebar tree with HTML5 drag-and-drop reorder
  - Schema-driven settings panel (text / richtext / image / select / color / url field types)
  - Block editor (add / reorder up-down / delete / inline edit) for sections like FAQ
  - Section picker modal with cards per type
  - `cms:section:rerender` / `cms:section:reorder` / `cms:section:remove` / `cms:section:select` / `cms:inspector:activate|deactivate` postMessages to iframe
  - Inspector mode: click any element in the iframe to select its section
  - Publish + share-preview-link (copies token URL to clipboard)
  - Iframe-unresponsive watchdog
- **`assets/js/cms/hydrate.js`** — extended with v2 path. Hydrates `[data-cms-section-host="<slug>"]` divs from `/api/cms/page/<slug>`. Listens for v2 postMessages and dispatches matching CustomEvents on `document` (Shopify's `shopify:section:load|unload|select|reorder|...` grammar, namespaced `cms:`). Reports inspector clicks back up to editor parent.
- **`assets/js/cms/hydrate.test.mjs`** — adds 3 v2 assertions; **all 7 frontend tests pass.**
- **`assets/css/cms-sections.css`** — shared styling for the rendered section types. Loaded via `_layouts/pnec-base.html`.
- **`_includes/poway-live-body.html`** — adds `<div data-cms-section-host="home">` between the carousel and the games banner. CMS sections render here.
- **`pages/admin.html`** — Quick Actions panel now has both "✏️ Open Live Editor (v1)" and "🚀 Live Editor v2 (Sections)" buttons.

### Not committed yet (in this turn)

The following are staged but not yet committed (will be in the final commit below):
- `OVERNIGHT_STATUS.md` (this file)
- `assets/css/cms-sections.css` (CSS)
- `_layouts/pnec-base.html` (link the new CSS)
- `pages/admin-editor-v2.html` (block-list CSS additions)
- `assets/js/admin/editor-v2-controller.js` (block UI rendering)
- `docs/superpowers/specs/2026-05-02-pnec-live-editor-v2-spec.md` (the v2 spec)

Backend uncommitted (will be in the final commit):
- `app/cms_sections/faq/` (FAQ section type)
- `tests/test_cms_v2.py` (FAQ block tests)

---

## Try it in the morning

1. Backend already supports v2. Run Flask:
   ```bash
   cd /Users/samarthvaka/Beasts_Flask && ./venv/bin/python run.py
   ```
2. Run Jekyll:
   ```bash
   cd /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 && bundle exec jekyll serve
   ```
3. Sign in as admin (`admin@powaynec.com` / `changeme123`) at `http://localhost:4000/pages/register.html#login`.
4. Open `http://localhost:4000/pages/admin-editor-v2.html`.
5. **Try the workflow:**
   - Click `+ Add section` → pick "FAQ" → see it appear in the iframe immediately.
   - Click the FAQ in the sidebar → settings panel shows heading + alignment + block list.
   - Click `+ Add Question` → expand the Q/A → type a question and answer → iframe hot-swaps within ~250ms.
   - Drag-reorder sections in the sidebar → iframe re-orders without reload.
   - Click `🔍 Inspector` → click any text/image in the iframe → that section's settings open.
   - Click `🔗 Share` → copies a 7-day preview-link URL to your clipboard.
   - Click `Publish` → reload `http://localhost:4000/` in a new tab → your sections render between the carousel and games banner.

## What's deferred (Tier 2/3 from research synthesis)

Not in this run — easy follow-ups:
- **Theme tokens** (`_data/theme.json`) — global colors / fonts / spacing, exposed in the editor
- **Breakpoint viewport toggle** (desktop / tablet / mobile)
- **AI section generation** — `POST /api/cms/ai/section` with Anthropic
- **Stega-encoded text** for true click-on-canvas inline editing
- **Conditional settings** (show field X only if Y)
- **Undo/redo** stack
- **About / Programs page** support (just add `data-cms-section-host="about"` and `data-cms-section-host="programs"` once those pages should support sections)
- **Section presets** — pre-built layouts ("Volunteer Signup", "Disaster Resources")
- **Mobile-only / desktop-only visibility** per section

## Known limitations / gotchas

- v1 (`data-cms-config` hydration) and v2 (sections) **co-exist on the homepage**. v1 still drives the hero text in the carousel (existing tags); v2 sections render in the new host below the carousel. They don't conflict.
- The first time you load `/pages/admin-editor-v2.html`, the homepage iframe will show no v2 sections (template is empty). Just click `+ Add section` to get started.
- Default block-level settings are computed from the schema's `default` keys. Section types can have multiple block types; v2 only auto-adds the **first** block type's defaults from the picker.
- `set_block` patches re-render the affected section after every keystroke (debounced 250ms) — fast on local, but slow if Flask is on a remote host.

## Health check

- Backend: 37 / 37 pytest passing (10 from v1 work, 27 new for v2 + 4 for FAQ).
- Frontend: 7 / 7 Node hydrate.test.mjs assertions passing.
- Full Flask app boots cleanly with `./venv/bin/python run.py`. Verified registry loads 4 types.
