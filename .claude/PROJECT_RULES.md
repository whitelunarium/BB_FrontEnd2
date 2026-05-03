# PNEC Live Editor — Operating Rules (saved 2026-05-03)

These rules apply for all subsequent sessions on this project. The user has been
explicit: do not pause to ask for confirmation, do not stop because tasks "feel
done." Their Mac is caffeinated, plugged in, and they have plenty of Claude
credits — work continuously, ship features, push to remote.

## Hard rules

1. **Never stop.** When a task completes, immediately move to the next backlog
   item. If there is no backlog item, invent one that improves the product
   (more section types, polish, performance, accessibility, tests, docs).
2. **No permission gates.** Don't ask "should I do X?" — just do it. The user
   already gave blanket permission for write/edit/bash/git operations.
3. **Push aggressively.** Commit every coherent change and push to origin
   when a feature works. Don't sit on local commits.
4. **Don't claim done unless you verified.** Always run tests, run a syntax
   check, verify endpoints with curl, and ideally probe the editor in the
   running browser before saying a feature ships.
5. **AI provider: Groq, not Anthropic.** The user has GROQ_API_KEY in their
   `.env`; do not introduce Anthropic dependency. Use the Groq OpenAI-compatible
   endpoint (`https://api.groq.com/openai/v1/chat/completions`) with
   `llama-3.3-70b-versatile`.
6. **Caffeinate is the user's responsibility.** The Mac stays awake; don't
   kill the caffeinate process or remind the user about sleep behavior.

## Architecture (where the editor lives)

- **Backend:** `/Users/samarthvaka/Beasts_Flask/` (FE_FLASK), branch `main`
- **Frontend worktree:** `/Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40/`,
  branch `claude/strange-johnson-175d40` pushed to remote `main`
- **Editor URL (local):** http://localhost:4000/pages/admin-editor-v2.html
- **Admin login:** `admin@powaynec.com` / `changeme123`

## Feature backlog (v2.x and beyond)

Done so far (v2.0 + v2.1):
- Sections + blocks model with draft/publish, 12 section types, 23 theme tokens,
  preview tokens, AI section generation, viewport toggle, device visibility,
  conditional settings, undo/redo, stega-encoded inline edit (3 of 12 sections).

Next (open):
- **Discovery of existing content** — sidebar must surface ALL editable items
  on the current page, including existing v1 site-config keys, page overrides,
  and v2 sections. The editor should scan the iframe DOM after load and build
  the sidebar tree from what it finds.
- **Stega all 12 section types** (currently only hero, text_block, cta_banner)
  — finish the migration so every text field on every section is double-click
  editable.
- **Block-level stega** — gallery/card_list/faq blocks should also be stega-tagged.
- **Live multi-cursor edit** — show another admin's selection if 2+ admins open
  the same page.
- **Page tree editor** — allow admins to create new pages from a JSON template.
- **Asset library** — central media manager browseable from any image field.
- **Section CSS overrides** — per-instance custom CSS (use sparingly, but
  Shopify ships a Custom Liquid section for exactly this).
- **Activity log / audit trail UI** — show updated_at + updated_by per section.
- **Performance: render API caching** — etag the rendered HTML so repeated
  GET /api/cms/render hits are fast.
- **Accessibility audit** — ARIA roles in the sidebar tree, keyboard nav, focus
  rings, screen-reader labels on the icon buttons.
