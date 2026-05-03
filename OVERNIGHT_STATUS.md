# PNEC Live Editor — Status (still building)

**Operating mode:** Continuous build per user's standing rule (saved in
`.claude/PROJECT_RULES.md`). Mac stays caffeinated, no permission gates,
push-as-we-ship.

**Caffeinate:** PID 85764 (kill with `kill 85764` if you want sleep back).

**Live URL (local):** http://localhost:4000/pages/admin-editor-v2.html

**Prod (after FE GitHub Pages rebuild):** https://powaynec.com/pages/admin-editor-v2.html — works only when the BE Flask at `beasts.opencodingsociety.com` has the latest code AND CORS is allowed for the public origin. Locally everything is fine.

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

## How to use the new stuff (≈10 things to try in 5 minutes)

1. **Whole-page AI** — open picker (`A`), type "a page about Block Parties with hero, three program cards, FAQ, and contact CTA", click 🪄 Whole page → admin gets ~5 valid sections instantly
2. **Section AI** — same picker, type "Volunteer signup CTA" + click ✨ Section
3. **Inspector double-click** — click 🔍 Inspector, double-click any text in the iframe → editor jumps straight to that field with a focus ring
4. **Inline + buttons** — between every section in preview mode, dashed "+ Add section here" buttons. Click one → picker opens, next add inserts at that index
5. **Theme tab (key 2)** — change `color_primary` → public site re-themes instantly via `:root` CSS vars
6. **SEO tab (key 3)** — set title/description/og_image → public site auto-injects meta tags on next visit (no rebuild needed)
7. **History tab (key 4)** — chronological list of every edit with "X by Y, 4m ago"
8. **Viewport toggle** — D/T/M keys switch desktop/tablet/mobile
9. **Section clipboard** — focus a tree row, ⌘C on home, switch to about, focus a row, ⌘V → that section is now on the about page
10. **Asset library** — any image field has 📁 Library + ⬆ Upload + ✨ alt buttons. Library lists previously-uploaded media.

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
| GET | `/api/cms/render` | single-section HTML (hot-swap) |
| POST | `/api/cms/page/<slug>/preview-token` | issue 7-day share token |
| GET | `/api/cms/page/<slug>/export` | download draft+published as JSON |
| POST | `/api/cms/page/<slug>/import` | replace draft from JSON body |
| POST | `/api/cms/page/<src>/duplicate` | copy draft to new slug |
| GET | `/api/cms/audit` | recent edits |
| GET | `/api/cms/theme/schema` | (public) editable token catalog |
| GET | `/api/cms/theme` | (public) current tokens |
| GET | `/api/cms/theme.css` | (public) tokens as CSS `:root` |
| PATCH | `/api/cms/theme/draft` | edit draft tokens |
| POST | `/api/cms/theme/publish` | copy draft → published |
| POST | `/api/cms/ai/section` | Groq generates ONE section from prompt |
| POST | `/api/cms/ai/page` | Groq generates a multi-section page from prompt |
| POST | `/api/cms/ai/alt-text` | Groq generates alt text from image URL |

## Section types (12)

`hero`, `text_block`, `image_with_text`, `faq` (+blocks), `cta_banner`,
`gallery` (+blocks), `card_list` (+blocks), `alert_box`, `quote`,
`two_column`, `video_embed`, `contact_cta`. Several have presets:
"Volunteer Signup", "Donation CTA", "Wildfire Red Flag",
"Event Announcement", "FAQ — 3 questions".

## Tests

- Backend pytest: 49/49 passing
- Frontend Node hydrate.test.mjs: 8/8 passing
