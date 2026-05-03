# PNEC Live Editor v2 — Final Status (full backlog shipped)

**v2.0 shipped:** 2026-05-02 night (commits 712d84e7b + 687b90899 FE, 325db83 + 267e8f9 BE)
**v2.1 shipped:** 2026-05-03 — full Tier 2/3 backlog except stega-encoded inline text

**Caffeinate:** PID 85764 still running until you `kill 85764`.

---

## Everything that ships now

### Backend (Beasts_Flask)
- **PageTemplate** model — per-page draft/published JSON template of sections + blocks
- **PreviewToken** model — 7-day share-preview tokens
- **ThemeSettings** model — site-wide tokens (23 of them: colors, typography, layout, brand)
- **CmsRegistry** — auto-discovers section types from `app/cms_sections/<type>/`
- **CmsRenderer** — python-liquid renders sections, wraps in `<div id="cms-section-…" class="cms-section …">` with `cms-hide-{desktop,tablet,mobile}` device classes
- **`/api/cms/sections-registry`** — list available types + schemas
- **`/api/cms/page/<slug>?state=…&token=…`** — read template + rendered HTML
- **`/api/cms/page/<slug>/draft` PATCH** — patch ops:
  `add` · `remove` · `duplicate` · `reorder` · `set` · `bulk_set` ·
  `visibility` · `device_visibility` · `replace_template` (undo/redo) ·
  `add_block` · `remove_block` · `reorder_blocks` · `set_block`
- **`/api/cms/page/<slug>/publish`** · **`/api/cms/render`** · **`/api/cms/page/<slug>/preview-token`**
- **`/api/cms/theme/schema`** · **`/api/cms/theme`** · **`/api/cms/theme.css`** · **`/api/cms/theme/draft` PATCH** · **`/api/cms/theme/publish`**
- **`/api/cms/ai/section`** — Anthropic-powered section generator. Validates response against registry. Requires `ANTHROPIC_API_KEY`.
- **12 section types** (each is `<type>.html` Liquid template + `<type>.schema.json`):
  `hero`, `text_block`, `image_with_text`, `faq` (+blocks), `cta_banner`, `gallery` (+blocks),
  `card_list` (+blocks), `alert_box`, `quote`, `two_column`, `video_embed` (auto-extracts YouTube/Vimeo IDs),
  `contact_cta`
- **Presets** in schemas: "Volunteer Signup", "Donation CTA", "Wildfire Red Flag", "Event Announcement", "FAQ — 3 questions"
- **Tests:** 45 / 45 passing.

### Frontend (Beasts_FrontEnd)
- **`pages/admin-editor-v2.html`** + **`assets/js/admin/editor-v2-{api,controller}.js`**
- **Sidebar tabs** — Sections | Theme
- **Section tree** — drag-reorder, select, hide (eye), duplicate, delete, rename via right-click menu
- **Settings panel** — schema-driven; supports `text` / `richtext` / `image` (upload) / `select` / `color` / `url` field types
- **Conditional fields** — schema fields with `condition: {field, op, value}` show/hide based on other field values
- **Block editor** — for sections with blocks (FAQ, gallery, card_list); add / reorder up-down / delete / inline edit
- **Theme tab** — 23 theme tokens grouped into colors/typography/layout/brand. Live updates iframe via `cms:theme:update` postMessage that swaps CSS custom properties on `:root`. Publish theme button copies draft → published.
- **Viewport toggle** — Desktop (full) / Tablet (768px) / Mobile (375px) — iframe wraps in a phone-frame look
- **Device visibility per section** — checkboxes (Desktop / Tablet / Mobile) on every section's settings panel
- **Undo / Redo** — client snapshots template before each change, sends `replace_template` op on undo. ⌘Z / ⌘⇧Z keyboard shortcuts. Up to 50 entries.
- **AI section generation** — text prompt + button in the picker modal. Calls `/api/cms/ai/section` (Claude Haiku by default), validates schema, instantiates the section.
- **Section picker** — search box, default cards per type, separate cards per preset
- **Preview Inspector** — click any element in the iframe → that section is selected
- **Share preview** — admin generates a 7-day tokenized URL, auto-copied to clipboard
- **Iframe-unresponsive watchdog** — 5-second banner
- **`assets/js/cms/hydrate.js`** — handles `cms:section:*`, `cms:block:*`, `cms:inspector:*`, **`cms:theme:update`** postMessages; reports inspector clicks back to parent
- **`assets/css/cms-sections.css`** — shared section styling + `cms-hide-{desktop,tablet,mobile}` media queries
- **`_layouts/pnec-base.html`** — loads `/api/cms/theme.css` so the public site uses theme tokens
- **Section hosts on Home + About + Programs** — `<div data-cms-section-host="home|about|programs">` placed in each page

### Frontend tests
- 7/7 Node assertions in `hydrate.test.mjs` passing.

---

## Try it in the morning

```bash
# Terminal 1 — Flask
cd /Users/samarthvaka/Beasts_Flask && ./venv/bin/python run.py

# Terminal 2 — Jekyll
cd /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 && bundle exec jekyll serve

# Browser
http://localhost:4000/pages/register.html#login   (admin@powaynec.com / changeme123)
http://localhost:4000/pages/admin-editor-v2.html
```

What to try:
1. Add a section (the picker has 12 types + named presets like "Wildfire Red Flag")
2. Try the **AI prompt** at the top of the picker — type "FAQ section about Block Parties" → click "Generate with AI" (requires `ANTHROPIC_API_KEY`).
3. Switch to the **Theme tab**, change `color_primary` to red — iframe sections turn red instantly.
4. Toggle the **viewport** between desktop / tablet / mobile.
5. Uncheck "mobile" on a section's "Show on" row — iframe hides it on the mobile viewport.
6. Press **⌘Z** to undo your last change.
7. Switch the **page selector** to About or Programs — the editor works on those pages too.
8. Click **🔗 Share** → preview URL with a 7-day token is copied to your clipboard.

## What's NOT shipped (the only remaining backlog item)

- **Stega-encoded inline text editing** (Sanity-style click-on-canvas to edit text) — genuinely complex (zero-width Unicode encoding, MutationObserver overlays, server-side Liquid filter). Deferred to a separate run. Not blocking — admins still edit via the field panel and see live previews.

## Health check

- Backend: 45 / 45 pytest passing.
- Frontend: 7 / 7 Node assertions passing.
- Backend boots cleanly with registry loading 12 types.

## Files added/modified in v2.1 wave

**Backend (BE_ROOT = /Users/samarthvaka/Beasts_Flask):**
- new: `app/models/theme_settings.py`
- new: `app/routes/cms_theme.py`
- new: `app/routes/cms_ai.py`
- new: `app/cms_sections/{cta_banner,gallery,card_list,alert_box,quote,two_column,video_embed,contact_cta}/`
- new: `tests/test_cms_theme.py`
- modified: `app/__init__.py` (register cms_theme_bp + cms_ai_bp)
- modified: `app/services/cms_renderer.py` (device_visibility CSS classes)
- modified: `app/routes/cms_v2.py` (device_visibility op + replace_template op)
- modified: `requirements.txt` (anthropic, python-liquid)

**Frontend (FE_ROOT = /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40):**
- modified: `pages/admin-editor-v2.html` (sidebar tabs, viewport toggle, undo/redo, AI prompt, picker search, theme panel)
- modified: `assets/js/admin/editor-v2-api.js` (5 new endpoints)
- modified: `assets/js/admin/editor-v2-controller.js` (theme tab, viewport, undo/redo, conditional fields, device visibility, AI gen, presets)
- modified: `assets/js/cms/hydrate.js` (cms:theme:update handler)
- modified: `assets/css/cms-sections.css` (device-visibility media queries)
- modified: `_layouts/pnec-base.html` (loads /api/cms/theme.css)
- modified: `pages/about.html`, `pages/programs-and-services.html` (section hosts)
