# PNEC Live Editor — Status (still building)

**Operating mode:** Continuous build per user's standing rule (saved in
`.claude/PROJECT_RULES.md`). Mac stays caffeinated, no permission gates,
push-as-we-ship.

**Caffeinate:** PID 85764 (kill with `kill 85764` if you want sleep back).

**Live URL (local):** http://localhost:4000/pages/admin-editor-v2.html

**Prod (after FE GitHub Pages rebuild):** https://pnec.opencodingsociety.com/pages/admin-editor-v2.html — works only when the BE Flask at `beasts.opencodingsociety.com` has the latest code AND CORS is allowed for the public origin. Locally everything is fine.

(Note: `powaynec.com` is the legacy WordPress site the org still owns; this Jekyll/Flask rebuild lives at `pnec.opencodingsociety.com`. The rebuild clones some CSS from the WP install for visual parity but the editor and live site are at the OCS subdomain.)

---

## What's shipped since the original v2.0 ("Sections + drag-reorder + inspector")

| Wave | Headline feature | Pushed |
|---|---|---|
| v2.1 | Theme tab, viewport toggle, undo/redo, AI gen, device visibility, 8 more section types | yes |
| v2.2 | Discover existing v1 content + page overrides in sidebar | yes |
| v2.3 | Stega all 12 section types, asset library, audit log, pages list, inline-blocks add | yes |
| v2.4 | Accessibility (ARIA, focus rings), keyboard shortcuts, tree filter, help overlay | yes |
| v2.5 | Bidirectional hover sync between sidebar tree and iframe | yes |
| v2.6 | Export/import templates, reset-to-default, onboarding empty state | yes |
| v2.7 | Floating section-type labels in iframe, lint warnings (alt text, links, headings) | yes |
| v2.8 | Status bar, page duplicate, AI alt-text generator | yes |
| v2.9 | SEO sidebar tab + word count + spellcheck on richtext | yes |
| v2.10 | SEO meta auto-injected on public site, section clipboard ⌘C/⌘V, arrow-key tree nav | yes |
| v2.11 | 🪄 Whole-page AI generator | yes |
| v2.12 | Inline "+ Add section here" buttons between sections (Shopify-style) | yes |
| v2.13 | True Shopify-style inline edit + vibrant theme panel | yes |
| v2.14 | Inline edit on legacy v1 elements + comprehensive UI overhaul | yes |
| v2.15 | Right-click menu, categorized picker, layout panel + Shopify gap analysis | yes |
| v2.16 | + New page button (create blank page from scratch) | yes |
| v2.17 | Block-level clipboard + iframe drag-reorder | yes |
| v2.18 | _header / _footer hosts in pnec-base layout + page picker pretty-print | yes |
| v2.19 | Right-click on iframe, section rename op, ⌘K cross-page section search | yes |
| v2.20 | Multi-select tree (Shift/⌘click) + bulk Hide/Show/Duplicate/Delete | yes |
| v2.21 | Lucide-style SVG icons (13 section + 11 action) replace emoji | yes |
| v2.22 | ✨ AI image button — Groq-polished prompt → Pollinations.ai placeholder | yes |
| v2.23 | Bulk block copy + paste-all (one PATCH = atomic, one undo) | yes |
| v2.24 | Hover preview popover on picker cards w/ wireframe SVG | yes |
| v2.25 | Fullscreen viewport (F) + per-section entrance animations + status-bar stats | yes |
| v2.26 | Publish-time diff modal — review every change before clicking 🚀 | yes |
| v2.27 | Gmail-style undo toasts (no more confirm dialogs on delete) | yes |
| v2.28 | Floating "✏️ Edit this page" button on every public page (admin-only) + nav-bar editor link | yes |
| v2.29 | All real PNEC pages in picker + auto-on Inspector + Shopify-strength hover glow + accurate "what's editable here" banner | yes |
| v2.30 | **Universal inline-edit auto-tagger** — every text element on every page is now hover-editable, no per-page setup needed | yes |
| v2.31 | Images are hover-swappable (asset library opens) + navbar + footer labels editable globally | yes |
| v2.32 | First-load pulse animation on every editable element + richer status-bar stats | yes |
| v2.33 | "↻ Reset to default" button on every site_config / override field | yes |
| v2.34 | Friendly labels in sidebar from `siteConfigMeta` + sorted alphabetically; **bug fix:** site_config + page_overrides blueprints were never registered in app/__init__.py — fixing this made v1 inline-edit ACTUALLY work for the first time | yes |

## How to use the new stuff (≈12 things to try in 5 minutes)

1. **Whole-page AI** — open picker (`A`), type "a page about Block Parties with hero, three program cards, FAQ, and contact CTA", click 🪄 Whole page → admin gets ~5 valid sections instantly
2. **Section AI** — same picker, type "Volunteer signup CTA" + click ✨ Section
3. **AI placeholder image** — any image field → ✨ AI image → describe, generates a real photo via Groq-polished prompt + Pollinations.ai. One click sets URL + alt.
4. **Cross-page search** — `⌘K` → spotlight modal hits `/api/cms/search`. Arrow keys + Enter jump to any matching section on any page.
5. **Right-click anywhere** — on a tree row OR inside the iframe, right-click → quick actions menu (Edit / Rename / Duplicate / Copy / Hide / Move up/down / Delete).
6. **Bulk select** — ⇧+click range, ⌘+click toggle, ⌘A select-all → sticky bulk-action bar with Hide/Show/Duplicate/Delete (single atomic PATCH, one undo).
7. **Picker hover** — hover any picker card for 240ms → wireframe SVG of what that section looks like + field list + preset count.
8. **Fullscreen preview** — `F` → sidebar collapses, iframe takes the whole window. Press F again to exit.
9. **Section animations** — Layout & Spacing panel → "Entrance animation" dropdown. Sections fade/slide/zoom in as they enter the viewport (respects prefers-reduced-motion).
10. **Inspector double-click** — click 🔍 Inspector, double-click any text in the iframe → editor jumps straight to that field with a focus ring (also works on legacy v1 carousel headlines).
11. **Inline + buttons** — between every section in preview mode, dashed "+ Add section here" buttons. Click one → picker opens, next add inserts at that index.
12. **Publish diff** — click 🚀 Publish → modal shows "+5 added, −2 removed, ~1 modified" with per-field before/after; CTA disables itself when nothing changed.

## Known limits (from the existing rules doc)

- Stega is enabled on every section type but only 1-3 fields per section. Adding more is a one-line filter pipe per template.
- AI features need `GROQ_API_KEY` in `Beasts_Flask/.env` (already set per the user's existing chatbot config).
- Public-site SEO injection happens client-side. Search engines that don't run JS won't see the dynamic meta — for SEO-critical pages, run a static-rendering pass at deploy time. (Not needed for PNEC's audience.)

## API surface (admin-only unless noted)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/cms/sections-registry` | (public) list section types + schemas |
| GET | `/api/cms/pages` | (public) list pages with v2 templates |
| GET | `/api/cms/page/<slug>` | (public published / token+admin draft) full template + rendered HTML |
| GET | `/api/cms/page/<slug>/seo` | (public) SEO meta — used by public site |
| PATCH | `/api/cms/page/<slug>/seo` | edit SEO meta |
| GET | `/api/cms/page/<slug>/draft` | admin convenience |
| PATCH | `/api/cms/page/<slug>/draft` | apply patches: add/remove/duplicate/reorder/set/bulk_set/visibility/device_visibility/replace_template/add_block/remove_block/reorder_blocks/set_block |
| POST | `/api/cms/page/<slug>/publish` | copy draft → published |
| GET | `/api/cms/page/<slug>/diff` | structured diff between draft and published (v2.26) |
| GET | `/api/cms/page/<slug>/render` | single-section HTML (hot-swap) |
| POST | `/api/cms/page/<slug>/preview-token` | issue 7-day share token |
| GET | `/api/cms/page/<slug>/export` | download draft+published as JSON |
| POST | `/api/cms/page/<slug>/import` | replace draft from JSON body |
| POST | `/api/cms/page/<src>/duplicate` | copy draft to new slug |
| POST | `/api/cms/page/<slug>/create` | create blank page (v2.16) |
| GET | `/api/cms/search?q&type&state` | cross-page section search (v2.19) |
| GET | `/api/cms/audit` | recent edits |
| GET | `/api/cms/theme/schema` | (public) editable token catalog |
| GET | `/api/cms/theme` | (public) current tokens |
| GET | `/api/cms/theme.css` | (public) tokens as CSS `:root` |
| PATCH | `/api/cms/theme/draft` | edit draft tokens |
| POST | `/api/cms/theme/publish` | copy draft → published |
| POST | `/api/cms/ai/section` | Groq generates ONE section from prompt |
| POST | `/api/cms/ai/page` | Groq generates a multi-section page from prompt |
| POST | `/api/cms/ai/alt-text` | Groq generates alt text from image URL |
| POST | `/api/cms/ai/placeholder-image` | Groq-polished prompt + Pollinations URL (v2.22) |

Patch ops accepted by `/api/cms/page/<slug>/draft`: `add`, `remove`,
`duplicate`, `reorder`, `set`, `bulk_set`, `visibility`,
`device_visibility`, `replace_template`, `add_block`, `remove_block`,
`reorder_blocks`, `set_block`, `layout`, `rename` (v2.19).

## Section types (13)

`hero`, `text_block`, `image_with_text`, `faq` (+blocks), `cta_banner`,
`gallery` (+blocks), `card_list` (+blocks), `alert_box`, `quote`,
`two_column`, `video_embed`, `contact_cta`, `custom_html` (escape hatch).
Several have presets: "Volunteer Signup", "Donation CTA", "Wildfire Red
Flag", "Event Announcement", "FAQ — 3 questions". Plus two canonical
section groups: `_header` and `_footer` (rendered into hosts in
`pnec-base.html`).

Each section has Lucide-style SVG icons + 200x120 wireframe SVG previews
shipped in `editor-v2-icons.js` — used in tree rows, picker cards,
find-modal results, hover popovers.

## Shopify gap analysis status

The "core editor experience" matrix in `docs/superpowers/SHOPIFY_GAP_ANALYSIS.md`
is now ALL ✅. Only ⚠ left: multi-draft theme support (multiple drafts
per page so admins can A/B-test before publishing). Out-of-scope items
(multi-user real-time collab, 8-level nested blocks, Theme App Extensions,
industry presets) explicitly skipped.

## Tests

- Backend pytest: **61/61** passing (12 new since v2.18)
- Frontend Node hydrate.test.mjs: **all assertions pass**
- Hydrate self-tests cover: stega encode/decode roundtrips,
  applyValue, parsePreviewMessage, applyThemeVars, applySectionTemplate,
  parseV2Message origin guard, reorderSections, removeSection.
