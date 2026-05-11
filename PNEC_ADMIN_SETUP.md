# PNEC Admin — Setup Guide

This is the operations cheat-sheet for the people running powaynec
(the board, the webmaster, future volunteers).

If you can edit a Google Doc, you can run this site. There is no code
to write. There is no compiler. Everything is point-and-click in the
browser — once the one-time setup below is done.

---

## What's actually shipping

- **Public site**: `pnec.opencodingsociety.com` (Jekyll static — served by GitHub Pages)
- **API server**: `beasts.opencodingsociety.com` (Flask in a Docker container)
- **Source repos**:
  - `whitelunarium/Beasts_FrontEnd` — every page, image, CSS, JS
  - `whitelunarium/Beasts_Flask`    — every API route, model, service

When you click "Publish" in the Live Theme Editor, that's all you're
doing: pushing a commit to the FrontEnd repo's `main` branch. GitHub
Pages then auto-rebuilds and the change is live in ~5 min.

---

## One-time server setup (only needed once, per host)

These two env vars MUST be set on the Flask host. Without them, the
editor can't load files (no `GITHUB_TOKEN`) or generate AI sections
(no `GROQ_API_KEY`).

### 1. `GITHUB_TOKEN`

Used by the Live Theme Editor to commit your edits to the public
repo.

1. Sign in to GitHub as the PNEC org admin (or as the repo owner).
2. Go to **Settings → Developer settings → Personal access tokens →
   Fine-grained tokens → Generate new token**.
3. Token name: `PNEC Live Theme Editor`
4. Expiration: 1 year (set a calendar reminder to rotate).
5. Repository access: **Only select repositories** → pick
   `Beasts_FrontEnd` (you can add `Beasts_Flask` too if you want
   admins to edit the API from the editor someday).
6. Permissions → Repository permissions:
   - **Contents: Read and write**  ← required
   - Metadata: Read-only (auto-included)
7. Click **Generate token**, copy the value (starts with `github_pat_…`).
8. On the Flask host, set the env var:
   ```bash
   export GITHUB_TOKEN=github_pat_…
   ```
   For Docker Compose, add to `.env`:
   ```
   GITHUB_TOKEN=github_pat_…
   ```
9. Restart the Flask container so it picks up the env:
   ```bash
   docker compose down && docker compose up -d --build
   ```

### 2. `GROQ_API_KEY` (optional but recommended)

Used by the editor's "Generate with AI" button. Without it, the AI
panel shows "Groq · disabled" and the rest of the editor still works.

1. Sign up at https://console.groq.com (free tier is plenty).
2. Create an API key, copy it (starts with `gsk_…`).
3. On the Flask host:
   ```bash
   export GROQ_API_KEY=gsk_…
   ```
4. Restart the container.

### 3. `ADMIN_PASSWORD`

The shared admin key for the editor + the admin dashboards
(security, volunteer). Pick something long (24+ chars) and share it
with the board via a password manager.

```bash
export ADMIN_PASSWORD='<long random string>'
```

(NEVER commit this to source. NEVER share via email or Slack.)

---

## Day-to-day: editing the site

### Open the editor

Go to `https://pnec.opencodingsociety.com/pages/admin-editor.html`.

Enter the admin password. (The key stays in your browser's session
storage only — never in the URL.)

You'll see:

- **Top bar**: 3 status pills (Auth / GitHub / Groq AI). All three
  green = you're good. Any red = the message tells you what's missing.
- **Left sidebar**: every editable file in the site, grouped
  (Main navigation / Footer links / Resource pages / Admin / Shared
  layout / Site config). Each entry has a colored dot that turns
  green when the file is reachable, red if not. The self-test runs
  automatically on boot and you can re-run it with the "↻ Self-test"
  button.
- **Center**: the editor with three tabs:
  - **Source** — raw HTML/CSS/JSON. Edit anything, char counter at
    the bottom, draft auto-saves to your browser every 400ms.
  - **Diff**   — server-side unified diff between your edits and
    what's currently on GitHub. Shows + / - line counts and
    color-coded changes.
  - **History** — recent commits for the current file with
    clickable SHAs and a "Restore" button per commit (creates a
    forward revert commit; never rewrites history).
- **Right**: live preview iframe pointing at the actual public URL.
  Refreshes after each publish.

### Editing a page

1. Click a page in the left sidebar.
2. Wait for it to load (you'll see "Loading from GitHub…" pill turn
   green when ready).
3. Edit the HTML in the Source tab. The pill at top-right turns
   amber when you have unsaved changes.
4. (Optional) Click the **Diff** tab → "Compute diff" to see
   exactly what will change.
5. Click **Publish to GitHub →** (or press Cmd/Ctrl-S).
6. The publish dialog computes the diff again, shows a summary,
   lets you edit the commit message.
7. Click **Publish**.
8. Toast appears with a clickable short-SHA linking to the GitHub
   commit page. GitHub Pages auto-rebuilds in ~5 min and your
   change is live on `pnec.opencodingsociety.com`.

### Reverting a change

1. Pick the page in the sidebar.
2. Click the **History** tab.
3. Click **Restore** on any older commit.
4. Confirm the dialog. A new "Rollback" commit lands on `main` with
   the file's content from that older commit.
5. Pages rebuilds. Live in ~5 min.

### "Edit this page" floating button

When you visit any public page WHILE signed in as admin, a small
forest-green pill appears bottom-right: **✏️ Edit this page ↗**.

Click it → opens the editor in a new tab, pre-selected to that page.
Or press the `E` key (when not focused in a form input) for the
same effect.

### Generating a section with AI

Click **✨ Generate with AI** in the top bar.

- **Section kind**: hero / card_list / image+text / cta / faq / text
- **Tone**: neighborly / urgent / formal
- **Describe the section**: plain English

Click **Generate**. Groq returns brand-aware HTML in 1-2 seconds.

- **Insert at cursor** — drops it right into the editor where your
  cursor was.
- **Copy** — clipboard.
- **Regenerate** — same prompt, different output.

PNEC's brand voice + the real-data guardrails (real phone numbers,
real upcoming event dates, no invented stats) are built into the
backend prompt, so generated content stays trustworthy.

---

## Dashboards (admin-only)

| URL                                          | What it does                                              |
| -------------------------------------------- | --------------------------------------------------------- |
| `/pages/admin.html`                          | Admin hub — landing page for all the dashboards           |
| `/pages/admin-editor.html`                   | Live Theme Editor (this guide)                            |
| `/pages/admin-volunteer.html`                | Volunteer interest dashboard — real-time, status workflow |
| `/pages/admin-security.html`                 | Security event log + lockouts                             |
| `/pages/admin-chatbot-analytics.html`        | Chatbot analytics                                         |

All four use the same admin-key auth as the editor.

---

## Troubleshooting

### "GitHub · not connected" on the health bar

The Flask server doesn't have a valid `GITHUB_TOKEN`. Fix:
1. Make sure the env var is set on the host (`echo $GITHUB_TOKEN`).
2. The token has Contents:read+write on `Beasts_FrontEnd`.
3. The token hasn't expired (check https://github.com/settings/tokens).
4. Restart the Flask container after setting.

### "Groq · disabled"

`GROQ_API_KEY` is not set. AI generation is off; everything else works.
Get a free key at https://console.groq.com and set the env var.

### Publish dialog says "Could not compute diff"

The diff endpoint failed. Click "Publish anyway…" if you're sure.
If it keeps happening, the GitHub token may not have read access to
the path you're editing — re-check token scope.

### "Page not found" on the live preview

The page list might point at a permalink that doesn't match the file
location. Open an issue in `Beasts_FrontEnd` with the path you saw,
and we'll fix the list.

### Self-test red dots

Any red dot in the sidebar = that file couldn't be loaded from
GitHub. Common causes:

- Token doesn't have access to that path (rare, all paths are public)
- The file was renamed/deleted in the repo but not yet in the list
- The Flask server can't reach api.github.com (rare; check network)

### Pages didn't update after publish

GitHub Pages can take up to 10 minutes to rebuild. Check the
deploy status:
- Repo: `whitelunarium/Beasts_FrontEnd`
- Tab: **Actions**
- Look for **pages build and deployment** — clicking a recent run
  shows the build log.

---

## Where to ask for help

- Tech questions: ping the webmaster
- Account/board questions: powaynec@gmail.com
- Emergency on the production site: revert via the editor's History
  tab — pick the last known-good commit, click Restore.
