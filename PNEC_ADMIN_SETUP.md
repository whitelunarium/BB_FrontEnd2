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

Used by the editor's "✨ Prompt engineer with AI" button. Groq acts
as a meta-prompt-engineer: it reads the current page + your change
request, and emits a tailored prompt you paste into Claude /
Gemini / ChatGPT to get the modified HTML back. Without
`GROQ_API_KEY`, the AI panel shows "Groq · disabled" and the rest
of the editor still works.

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

**Important security note:** as of the v3 security pass, the Flask
boot logic REFUSES to seed an `admin@powaynec.com` user when:
- `ADMIN_PASSWORD` is unset or empty
- It's shorter than 12 chars
- It matches a known-bad sentinel (`changeme123`, `password`, `admin`, etc.)

If you see a `_seed_admin_if_missing: refusing to seed` warning in
the Flask logs, the env var isn't being read correctly. Check it's
spelled right, restart, and verify with:
```bash
docker compose exec web sh -c 'echo "len=${#ADMIN_PASSWORD}"'
```
Expected: `len=24` (or whatever your length is). If it says `len=0`,
the env var isn't reaching the container.

### 4. PayPal Donate button (one-time, on the Frontend repo)

The Donate page (`pages/donate.html`) ships with placeholder
`hosted_button_id=PNEC` — PayPal will reject this. Swap it for the
real button:

1. Sign in to the PNEC PayPal Business account (powaynec@gmail.com
   or whoever owns it).
2. PayPal → Tools → All Tools → Donate Button → Create or copy
   your existing button ID (alphanumeric like `JL5KFZD2NRWAW`).
3. In the Live Theme Editor, open **Footer links → Donate**
4. Find every `hosted_button_id=PNEC` (there are ~6 — one per
   amount-quick-pick + one main button)
5. Replace each with your real ID
6. Click Publish
7. Test: click each `$25 / $50 / $100 / $250` quick-pick + the
   main "Donate any amount" button on the live site → PayPal page
   should load with PNEC's org name + the right preset amount.

### 5. VAPID push notification keys (optional)

If PNEC wants to send push notifications for emergencies
(red-flag fire days, evacuation orders), generate VAPID keys:

```bash
cd Beasts_Flask
python scripts/generate_vapid_keys.py
# prints VAPID_PUBLIC_KEY=... and VAPID_PRIVATE_KEY=...
```

Set on the Flask host:
```bash
export VAPID_PUBLIC_KEY=…
export VAPID_PRIVATE_KEY=…
export VAPID_EMAIL=info@powaynec.com
```

Restart. Without these, the `/api/push/subscribe` endpoint still
runs (and authenticates), but actual `POST` to web-push won't fire.

### 6. Hero image filenames (Frontend, optional)

The home hero rotates 4-5 images from `/assets/images/Poway_*.{jpg,jpeg,webp}`.
If you want to swap them with newer photos:

1. Pick 1920×500 source images (same aspect ratio so layout stays).
2. Convert to WebP at quality 80 (drops file size ~70%):
   - https://squoosh.app (drag in, set WebP, q=80, download), OR
   - `cwebp -q 80 in.jpg -o out.webp` (command-line tool)
3. Upload to GitHub via the editor (or commit directly).
4. Update the filenames in `_includes/poway-live-body.html`.

**Special case**: `assets/images/Poway_Lake.jpg` is ~838KB JPEG —
the biggest single image on the site. Converting it to WebP drops
it to ~100KB, saves ~750KB per page load.

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

### Editing a page with AI (Prompt-engineer flow)

Click **✨ Prompt engineer with AI** in the top bar.

**Step 1 — generate the prompt**

- **Page to edit**: defaults to the page you have open. Autocompletes
  from every known PNEC page.
- **Describe the change**: plain English ("Add a section under the
  hero introducing the May 23 Safety Fair, neighborly tone, two
  paragraphs, include a Learn More button linking to /events.html").
- **Target AI**: pick Claude (Anthropic), Gemini (Google), or
  ChatGPT (OpenAI). Each gets a tailored prompt format:
  - **Claude** → XML tags (`<current_html>`, `<change_request>`,
    `<constraints>`, `<output_format>`) and `<thinking>` blocks
  - **Gemini** → concise markdown with ```html fenced blocks
  - **ChatGPT** → explicit ROLE statement + numbered TASK steps

Click **⚡ Engineer prompt**. Groq returns the engineered prompt in
1-3 seconds (with a live "thinking" animation showing each stage).

**Step 2 — paste back the AI's response**

- Click **📋→ Copy & open Claude** (or Gemini / ChatGPT). The prompt
  is copied to your clipboard and the target AI opens in a new tab.
- Paste, wait for the AI's response (modified HTML).
- Copy the AI's response, return to the editor.
- The **Step 2 panel** is already auto-expanded. Paste into the
  textarea — a "✓ Looks like a complete HTML document" badge appears.
- Click **👁 Preview** to see the result rendered in a sandboxed
  iframe (no scripts execute, safe to inspect untrusted output).
- Click **↪ Apply to editor**. The editor source is replaced with
  the AI's HTML, the modal closes, and you can publish as normal.

**Tips**

- **Try the same description with [Claude] [Gemini] [ChatGPT]** pills
  in the result panel let you A/B compare across all three targets
  without re-typing.
- **Show the page summary Groq used** (expandable) reveals exactly
  what Groq saw when writing the prompt — useful for sanity-checking
  that the right page anchors are present.
- **Cancel** stops Groq mid-generation if you change your mind.
- **Rate limit**: Groq's free tier is 12,000 tokens/minute (each
  generation uses ~5,500). If you hit it, the Generate button shows
  a 60-second cooldown countdown — wait, then re-engineer.

PNEC's brand voice + the real-data guardrails (real phone numbers,
real upcoming event dates, no invented stats) are baked into the
engineered prompt's constraint list, so output from all three target
AIs stays trustworthy.

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

---

## Deploys (technical)

### Frontend (`Beasts_FrontEnd`)
Every push to `main` triggers GitHub Pages to rebuild automatically.
Look at the **Actions** tab of the repo to see deploy status. Typical
turnaround: **5 min from push → live**.

When the Live Theme Editor publishes a change, that's the same as a
manual push — it goes through this exact pipeline.

### Backend (`Beasts_Flask`)
**No automatic deploy** as of this writing. Pushing to `main` does
NOT auto-rebuild the Flask container. After a backend change:

#### Easy mode: use the redeploy script
```bash
cd ~/Beasts_Flask
PNEC_ADMIN_KEY=<your-admin-key> ./scripts/redeploy.sh
```
That script pulls latest main, rebuilds the image, restarts the
container, and hits `/api/admin/publish/health` to confirm the new
code is live. Reports green pills for GitHub + Groq if their env
vars are set.

#### Manual mode (if you want fine control):
1. Build the new image:
   ```bash
   cd ~/Beasts_Flask
   docker compose build
   ```
2. Restart the running container:
   ```bash
   docker compose up -d
   ```
3. Verify with the editor's health bar — Auth/GitHub/Groq pills
   should all be green, and the workflow status shows the latest
   commit SHA.

Common gotcha: after adding new admin endpoints (like
`/api/admin/publish/diff`), if you don't rebuild the container, the
editor's diff button gives 404. Same for any new model — Flask
needs to restart for `db.create_all()` to pick up new tables.

### Verifying a backend deploy is current
Run the E2E test script in `scripts/test-admin-editor.sh`:
```bash
PNEC_API=https://beasts.opencodingsociety.com \
PNEC_ADMIN_KEY=… \
./scripts/test-admin-editor.sh
```
It hits every admin endpoint and reports pass/fail per check.
