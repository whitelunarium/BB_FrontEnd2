# Shopify Live Theme Editor vs PNEC Live Editor v2 — Gap Analysis

Drawn from the original research (`docs/superpowers/specs/2026-04-29-pnec-live-theme-editor-design.md` synthesis). Goal: identify everything Shopify ships that we don't, decide what's worth building, and queue the rest as backlog.

Legend: ✅ shipped · ⚠ partial · ❌ missing · ⛔ out of scope (single-tenant nonprofit).

---

## Layout / shell

| Shopify | Us | Status |
|---|---|---|
| Three-zone shell: top bar, sidebar, canvas | Same | ✅ |
| Page selector in top bar | Same, auto-discovers pages from `/api/cms/pages` | ✅ |
| Save / Publish / undo / redo / view-live in top bar | Same — Publish, Share, View Live, Export, Import, Duplicate, Undo, Redo, Inspector, Help | ✅ |
| Collapsed/expanded sidebar (single vs double layout) | Single sidebar; tabs (Sections / Theme / SEO / History) | ⚠ — no double-sidebar mode |
| Iframe preview with desktop/mobile/tablet/fullscreen | Desktop / Tablet / Mobile (no fullscreen) | ⚠ — fullscreen would be 1 line of CSS |

## Sections + blocks model

| Shopify | Us | Status |
|---|---|---|
| Sections with typed settings + repeatable blocks | Same — `add`, `remove`, `duplicate`, `reorder`, `set`, `bulk_set`, `add_block`, etc. | ✅ |
| Add via "Add section" + categorized block picker | ✅ Categorized picker w/ tabs | ✅ |
| Hover preview / block thumbnail in picker | Text-only cards | ❌ |
| Predictive search in picker | Yes (text filter) | ✅ |
| Drag-reorder in sidebar AND in iframe canvas | ✅ Both shipped | ✅ |
| Visibility toggle (eye icon) | Yes | ✅ |
| Duplicate / rename / delete via right-click | ✅ Right-click on tree + iframe sections, ✏ icon, F2, ctx menu | ✅ |
| Block copy/paste across sections | ✅ Block clipboard shipped | ✅ |
| 25 sections / 1250 blocks per template caps with feedback | ✅ 25-section soft limit w/ toast | ✅ |
| Cross-page section search (Cmd-K spotlight) | ✅ `/api/cms/search` + `🔎 Find` button (⌘K) | ✅ |
| Up to 8 levels of nested blocks (Horizon) | Single level of blocks | ⛔ — overkill for nonprofit |
| Section-group support (header/footer-as-sections) | ✅ `_header` / `_footer` canonical slugs | ✅ |
| `enabled_on / disabled_on` template restrictions in schema | Schema has `category`, no template restrictions | ❌ |

## Inline editing in preview

| Shopify | Us | Status |
|---|---|---|
| Hover any element in iframe → outline; click → opens settings | Yes — Inspector mode + bidirectional hover sync | ✅ |
| One-click in-canvas text editing | **Double-click** (any tagged element) → contenteditable in place | ✅ |
| Mobile/Shopify-app long-press | Not implemented | ⛔ |
| "+" buttons between sections | ✅ shipped in v2.12 | ✅ |

## Settings vs theme

| Shopify | Us | Status |
|---|---|---|
| Two top-level tabs: Sections + Theme + App embeds | Sections / Theme / SEO / History | ✅ |
| **Color schemes** as named tokens (Accent 1, Accent 2…) that sections reference | Theme has flat tokens (color_primary etc.); **no named schemes** | ❌ — meaningful gap |
| Typography panel | Yes (font_heading, font_body, sizes) | ✅ |
| Layout / spacing tokens | Yes | ✅ |
| Conditional settings (show field X if Y) | Yes (schema `condition`) | ✅ |
| Reset-to-default per setting | Yes | ✅ |
| **Per-section background color / image override** | **Not exposed** | ❌ |
| **Per-section padding (top/bottom)** | **Not exposed** | ❌ |
| Animation settings per section | Not exposed | ❌ — low priority |

## Pages & templates

| Shopify | Us | Status |
|---|---|---|
| Switch between Home / Product / Collection / Cart / 404 / etc. | Same — Home / About / Programs (auto-populated from API) | ✅ |
| **Create / duplicate templates from inside editor** | Duplicate page button (creates new slug); **no fresh-create button** | ⚠ |
| Templates stored as JSON | Yes (PageTemplate model) | ✅ |
| `theme_presets` (10 industry presets in Horizon) that swap the entire site | Section-level presets only | ❌ — out of scope |

## Drafts / publish workflow

| Shopify | Us | Status |
|---|---|---|
| Theme library — unlimited draft themes per shop | **One draft per page**, one published | ⚠ — meaningful gap (multi-draft would let admins A/B-test) |
| Publish a single draft theme; previously-live moves to drafts | Per-page publish overwrites published | ⚠ |
| Tokenized share-preview link for non-admins | Yes (7-day token) | ✅ |
| Cannot share published preview (only drafts) | Same | ✅ |
| Multi-user collab | None | ⛔ — overkill for ~3 admins |

## Apps / extensibility

| Shopify | Us | Status |
|---|---|---|
| Theme App Extensions — third-party app blocks via TOML | None | ⛔ |
| App embeds (chat, pixels) toggle | None | ⛔ |
| Custom Liquid escape hatch section | None | ❌ — would let admins drop raw HTML for one-off needs |

## Recent / experimental (Summer '25)

| Shopify | Us | Status |
|---|---|---|
| Sidekick AI block generation | ✅ Section + Whole-page AI gen via Groq | ✅ |
| AI-generated images for placeholders | None | ❌ — could add via Groq vision or DALL-E |
| Magic block: prompt → working block code | We generate from prompt → registered components only | ⚠ — cleaner constraint than Shopify, no arbitrary code |
| Categorized block library + hover-preview | ✅ Categorized picker w/ tabs | ✅ |
| Right-click context menu shortcut | ✅ Tree rows + iframe sections | ✅ |
| Section custom display name (rename) | ✅ Rename op + F2 + ctx-menu | ✅ |
| Cross-page section search | ✅ ⌘K spotlight on `/api/cms/search` | ✅ |

## What's deeply missing (the things to build next)

Ranked by leverage:

1. **Color schemes** — named tokens (Primary, Accent 1, Accent 2, Background) that sections reference instead of raw hex. Lets a one-click rebrand flow through every section. ✅ shipped
2. **Per-section spacing + background** — `_spacing_top`, `_spacing_bottom`, `_background_color`, `_background_image` on every section. ✅ shipped
3. **Right-click context menu** on tree rows + on iframe sections in inspector mode. ✅ shipped
4. **Categorized picker** — group section types by `category` (headers / content / media / layout) with tabs at the top of the picker, plus icons. ✅ shipped
5. **Section groups** — make the header + footer editable as section lists (not static Liquid). ✅ shipped (`_header` / `_footer` slugs)
6. **Section limits** — soft enforcement at 25 sections with a friendly toast. ✅ shipped
7. **Custom HTML section** — escape hatch for one-off cases. ✅ shipped
8. **Section rename + cross-page section search** ✅ shipped (v2.19) — ✏ on tree row, F2 shortcut, 🔎 Find button (⌘K) hits `/api/cms/search` and jumps to any section on any page.
9. **Block-level copy/paste** — ✅ shipped
10. **Drag-to-reorder in iframe** — ✅ shipped
11. **Templates: create new page from blank** — ✅ shipped
12. **Multi-select tree rows + bulk delete/duplicate/move** — still missing
13. **Better section-type icons** (Lucide-like SVGs) — still missing
14. **AI-generated placeholder images** — still missing
15. **Block-level cross-page copy/paste between Q&A items, gallery items, etc.** — still missing

## What's deliberately not building

- Multi-user real-time collaboration (3 admins).
- 8-level nested blocks (overkill).
- Multiple draft themes (single-tenant single-brand).
- Theme App Extensions / third-party apps.
- Customer accounts editor (no e-commerce).
- Liquid template authoring inside the editor (developers commit those).
- Industry-preset full-site swap (one brand).
