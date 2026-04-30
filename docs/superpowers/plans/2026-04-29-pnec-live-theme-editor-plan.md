# PNEC Live Theme Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Shopify-style live theme editor for PNEC's Homepage / About / Programs pages — admin sees split-screen field panel + iframe preview, types and watches changes update live, clicks Save to persist via existing Flask endpoints.

**Architecture:** Add ONE new Flask endpoint (`/api/cms/manifest/<slug>`) plus three new theme-config seeds. Build TWO new public-page JS modules (`cms-api.js`, `hydrate.js`) that read existing `/api/site-config` + `/api/overrides/<slug>` and swap text into elements tagged with `data-cms-config` / `data-cms-override`. Build a new admin page (`pages/admin-editor.html`) with a field panel that posts changes to an iframe preview via `postMessage`, and saves through the existing PATCH-bulk endpoints. Tag the homepage (in `_includes/poway-live-body.html`) and the two raw-HTML pages (`pages/about.html`, `pages/programs-and-services.html`) with `data-cms-*` attributes so hydrate.js can swap their content. No database migrations.

**Tech Stack:** Flask + SQLAlchemy (Beasts_Flask repo at `/Users/samarthvaka/Beasts_Flask/`), Jekyll + vanilla JS three-layer pattern (Beasts_FrontEnd worktree at `/Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40/`), pytest (Flask), Node assert (frontend unit test), manual checklist (E2E).

**Spec reference:** `docs/superpowers/specs/2026-04-29-pnec-live-theme-editor-design.md` (in the frontend worktree).

**Repo layout note:** This plan touches TWO separate git repos:
- **FE_ROOT** = `/Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40/` (worktree branch `claude/strange-johnson-175d40`).
- **BE_ROOT** = `/Users/samarthvaka/Beasts_Flask/` (separate repo, currently has uncommitted dev work — only stage/commit files this plan adds or modifies; do NOT `git add -A` in BE_ROOT).

When a step says "from FE_ROOT" or "from BE_ROOT" use that as `cwd`. When showing `git` commands, run them from the relevant repo's root.

---

## File map

| # | Repo | Path | Action | Responsibility |
|---|---|---|---|---|
| 1 | BE | `app/routes/cms_manifest.py` | create | Defines per-page editable field schema; one GET route. |
| 2 | BE | `tests/__init__.py` | create | Marks tests/ as a package. |
| 3 | BE | `tests/conftest.py` | create | Pytest fixtures: app, client, in-memory DB, admin login. |
| 4 | BE | `tests/test_cms_manifest.py` | create | Endpoint tests + manifest-keys-exist-in-seed invariant. |
| 5 | BE | `pytest.ini` | create | Configures pytest paths and Flask app discovery. |
| 6 | BE | `requirements.txt` | modify | Add `pytest`. |
| 7 | BE | `app/__init__.py` | modify | Register `cms_manifest_bp`. |
| 8 | BE | `app/routes/site_config.py` | modify | Add 3 theme keys to `DEFAULT_CONFIG`. |
| 9 | FE | `assets/js/cms/cms-api.js` | create | Pure-fetch read layer for site-config / overrides / manifest. |
| 10 | FE | `assets/js/cms/hydrate.js` | create | Hydrates public pages; subscribes to postMessage in preview mode. |
| 11 | FE | `assets/js/cms/hydrate.test.mjs` | create | Node-only unit test for `applyValue` + postMessage parser. |
| 12 | FE | `_layouts/pnec-base.html` | modify | Add hydrate script tags + flash-prevention CSS in `<head>`. |
| 13 | FE | `_includes/poway-live-body.html` | modify | Add `data-cms-page="home"` wrapper + `data-cms-config` attrs on ~6 elements. |
| 14 | FE | `pages/about.html` | modify | Direct edits to raw HTML: head style, body wrapper, ~5 attrs, end-of-body scripts. |
| 15 | FE | `pages/programs-and-services.html` | modify | Same pattern with `data-cms-page="programs"`. |
| 16 | FE | `assets/js/admin/editor-api.js` | create | Pure-fetch admin layer (manifest fetch + bulk PATCH). |
| 17 | FE | `assets/js/admin/editor-controller.js` | create | Editor orchestrator: render fields, postMessage, save, discard. |
| 18 | FE | `pages/admin-editor.html` | create | Editor page shell: auth gate, top bar, field panel, iframe. |
| 19 | FE | `pages/admin.html` | modify | Add "Open Live Editor →" link. |

---

## Task 1: Set up pytest infrastructure in Beasts_Flask

**Files:**
- Create: `BE_ROOT/tests/__init__.py`
- Create: `BE_ROOT/tests/conftest.py`
- Create: `BE_ROOT/pytest.ini`
- Modify: `BE_ROOT/requirements.txt`

- [ ] **Step 1: Add pytest to requirements**

Append one line to `BE_ROOT/requirements.txt`:

```
pytest==8.3.3
```

- [ ] **Step 2: Install it in the active venv**

Run from BE_ROOT:
```bash
./venv/bin/pip install pytest==8.3.3
```
Expected: `Successfully installed pytest-8.3.3` (plus its deps).

- [ ] **Step 3: Create the empty package marker**

Create `BE_ROOT/tests/__init__.py` with an empty body:
```python
# Tests package marker.
```

- [ ] **Step 4: Create pytest.ini**

Create `BE_ROOT/pytest.ini`:
```ini
[pytest]
testpaths = tests
python_files = test_*.py
addopts = -ra
```

- [ ] **Step 5: Create conftest.py with fixtures**

Create `BE_ROOT/tests/conftest.py`:
```python
# tests/conftest.py
# Pytest fixtures for Beasts_Flask: app + client + in-memory DB + admin login helper.

import pytest
from werkzeug.security import generate_password_hash

from app import create_app, db as _db
from app.models.user import User


@pytest.fixture
def app():
    """Create a Flask app with an in-memory SQLite DB. Tables are created/dropped per test."""
    app = create_app()
    app.config.update(
        TESTING=True,
        SQLALCHEMY_DATABASE_URI='sqlite:///:memory:',
        WTF_CSRF_ENABLED=False,
        SECRET_KEY='test-secret',
    )
    with app.app_context():
        _db.create_all()
        # Seed an admin user for protected-route tests.
        admin = User(
            uid='test-admin',
            email='admin@test.local',
            display_name='Test Admin',
            password=generate_password_hash('test-pw'),
            role='admin',
        )
        _db.session.add(admin)
        _db.session.commit()
        yield app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture
def client(app):
    """Flask test client (anonymous by default)."""
    return app.test_client()


@pytest.fixture
def admin_client(app, client):
    """Test client logged in as the seeded admin."""
    with client.session_transaction() as sess:
        sess['_user_id'] = '1'  # the admin we seeded above
        sess['_fresh'] = True
    return client
```

Note: the `User` constructor takes whatever fields the existing model expects. If the seeded admin breaks because the User model has additional required columns (e.g., `created_at`), inspect `app/models/user.py` and add them to the seed. **Do not invent fields** — use exactly what's in the model.

- [ ] **Step 6: Verify pytest discovers the suite**

Run from BE_ROOT:
```bash
./venv/bin/pytest --collect-only
```
Expected: `collected 0 items` (no tests yet, but no errors).

- [ ] **Step 7: Commit**

```bash
git -C /Users/samarthvaka/Beasts_Flask add tests/__init__.py tests/conftest.py pytest.ini requirements.txt
git -C /Users/samarthvaka/Beasts_Flask commit -m "test: add pytest infrastructure with app/db/admin fixtures"
```

---

## Task 2: Add theme-config seed entries (TDD)

**Files:**
- Modify: `BE_ROOT/app/routes/site_config.py:60-63` (extend `DEFAULT_CONFIG`)
- Create: `BE_ROOT/tests/test_theme_config_seed.py`

- [ ] **Step 1: Write the failing test**

Create `BE_ROOT/tests/test_theme_config_seed.py`:
```python
# tests/test_theme_config_seed.py
# Verifies the three theme keys are present in DEFAULT_CONFIG and seed correctly.

from app.routes.site_config import DEFAULT_CONFIG, seed_site_config
from app.models.site_config import SiteConfig


def _key_set():
    return {cfg['key'] for cfg in DEFAULT_CONFIG}


def test_theme_keys_present_in_default_config():
    keys = _key_set()
    assert 'theme_primary_color' in keys
    assert 'theme_accent_color'  in keys
    assert 'theme_logo_image'    in keys


def test_theme_keys_have_theme_group():
    by_key = {cfg['key']: cfg for cfg in DEFAULT_CONFIG}
    for k in ('theme_primary_color', 'theme_accent_color', 'theme_logo_image'):
        assert by_key[k]['group'] == 'theme', f"{k} missing group=theme"


def test_seed_inserts_theme_keys(app):
    with app.app_context():
        seed_site_config()
        keys = {row.key for row in SiteConfig.query.all()}
        assert 'theme_primary_color' in keys
        assert 'theme_accent_color'  in keys
        assert 'theme_logo_image'    in keys
```

- [ ] **Step 2: Run test to verify it fails**

Run from BE_ROOT:
```bash
./venv/bin/pytest tests/test_theme_config_seed.py -v
```
Expected: 3 FAILED — `'theme_primary_color' in keys` is False.

- [ ] **Step 3: Add the three theme entries to DEFAULT_CONFIG**

Open `BE_ROOT/app/routes/site_config.py`. Find the `DEFAULT_CONFIG` list (it ends with the `images` group around line 60-63). Add a new group block between the `images` block and the closing `]`:

```python
    # ── Theme (NEW) ──────────────────────────────────────────────────────────────
    {'key': 'theme_primary_color', 'label': 'Theme — Primary Color', 'description': 'Primary accent color used across the site', 'group': 'theme', 'value': '#1e3a8a'},
    {'key': 'theme_accent_color',  'label': 'Theme — Accent Color',  'description': 'Secondary accent color',                    'group': 'theme', 'value': '#f59e0b'},
    {'key': 'theme_logo_image',    'label': 'Theme — Logo Image',    'description': 'Site logo image URL',                       'group': 'theme', 'value': ''},
]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
./venv/bin/pytest tests/test_theme_config_seed.py -v
```
Expected: 3 PASSED.

- [ ] **Step 5: Commit**

```bash
git -C /Users/samarthvaka/Beasts_Flask add app/routes/site_config.py tests/test_theme_config_seed.py
git -C /Users/samarthvaka/Beasts_Flask commit -m "feat(site_config): seed theme primary/accent/logo keys"
```

---

## Task 3: Add CMS manifest endpoint (TDD)

**Files:**
- Create: `BE_ROOT/app/routes/cms_manifest.py`
- Create: `BE_ROOT/tests/test_cms_manifest.py`
- Modify: `BE_ROOT/app/__init__.py:431-457` (blueprint imports + registration)

- [ ] **Step 1: Write the failing test**

Create `BE_ROOT/tests/test_cms_manifest.py`:
```python
# tests/test_cms_manifest.py
# Endpoint tests + invariant test: every site_config-backed manifest field
# must exist as a key in DEFAULT_CONFIG (catches drift between manifest and seed).

import pytest
from app.routes.site_config import DEFAULT_CONFIG


def _config_keys():
    return {cfg['key'] for cfg in DEFAULT_CONFIG}


def test_manifest_home_returns_200(client):
    res = client.get('/api/cms/manifest/home')
    assert res.status_code == 200
    body = res.get_json()
    assert body['page_slug']    == 'home'
    assert body['page_title']   == 'Homepage'
    assert body['preview_path'] == '/'
    assert isinstance(body['sections'], list) and len(body['sections']) >= 1


def test_manifest_about_returns_200(client):
    res = client.get('/api/cms/manifest/about')
    assert res.status_code == 200
    assert res.get_json()['page_slug'] == 'about'


def test_manifest_programs_returns_200(client):
    res = client.get('/api/cms/manifest/programs')
    assert res.status_code == 200
    assert res.get_json()['page_slug'] == 'programs'


def test_manifest_unknown_returns_404(client):
    res = client.get('/api/cms/manifest/does-not-exist')
    assert res.status_code == 404


@pytest.mark.parametrize('slug', ['home', 'about', 'programs'])
def test_every_site_config_field_key_exists_in_seed(client, slug):
    """Drift guard: every manifest field with kind='site_config' must reference a key in DEFAULT_CONFIG."""
    res = client.get(f'/api/cms/manifest/{slug}')
    assert res.status_code == 200
    body = res.get_json()
    cfg_keys = _config_keys()
    for section in body['sections']:
        for field in section['fields']:
            if field['kind'] == 'site_config':
                assert field['key'] in cfg_keys, \
                    f"manifest {slug} references missing site_config key {field['key']!r}"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
./venv/bin/pytest tests/test_cms_manifest.py -v
```
Expected: all FAIL — endpoint not registered yet (404 from Flask's own 404 handler is fine; assertion fires regardless).

- [ ] **Step 3: Create the manifest blueprint**

Create `BE_ROOT/app/routes/cms_manifest.py`:
```python
# app/routes/cms_manifest.py
# Responsibility: Per-page editable-field schema for the live theme editor.
# Read-only, public access. The manifest is a constant — not stored in the DB.

from flask import Blueprint, jsonify

from app.utils.errors import error_response

cms_manifest_bp = Blueprint('cms_manifest', __name__)


# ─── Manifests ────────────────────────────────────────────────────────────────
# Each manifest declares the editable fields for one page.
# `kind` is 'site_config' (PATCH /api/site-config/<key>) or 'override'
# (POST /api/overrides/<slug>). `type` drives the editor widget.
# `preview_path` is the iframe src (with `?preview=1` appended by the editor).

MANIFESTS = {
    'home': {
        'page_slug':    'home',
        'page_title':   'Homepage',
        'preview_path': '/',
        'sections': [
            {
                'label': 'Hero',
                'fields': [
                    {'key': 'hero_headline',         'kind': 'site_config', 'type': 'text',  'label': 'Headline'},
                    {'key': 'hero_subline',          'kind': 'site_config', 'type': 'text',  'label': 'Sub-headline'},
                    {'key': 'homepage_banner_image', 'kind': 'site_config', 'type': 'image', 'label': 'Hero image'},
                ],
            },
            {
                'label': 'About blurb',
                'fields': [
                    {'key': 'about_blurb', 'kind': 'site_config', 'type': 'richtext', 'label': 'About paragraph'},
                ],
            },
            {
                'label': 'Footer',
                'fields': [
                    {'key': 'footer_tagline',   'kind': 'site_config', 'type': 'text', 'label': 'Footer tagline'},
                    {'key': 'footer_copyright', 'kind': 'site_config', 'type': 'text', 'label': 'Footer copyright'},
                ],
            },
        ],
    },
    'about': {
        'page_slug':    'about',
        'page_title':   'About',
        'preview_path': '/pages/about.html',
        'sections': [
            {
                'label': 'Header',
                'fields': [
                    {'key': 'about_banner_image', 'kind': 'site_config', 'type': 'image', 'label': 'About banner image'},
                ],
            },
            {
                'label': 'Who We Are',
                'fields': [
                    {'key': 'about_who_para1', 'kind': 'site_config', 'type': 'richtext', 'label': 'Paragraph 1'},
                    {'key': 'about_who_para2', 'kind': 'site_config', 'type': 'richtext', 'label': 'Paragraph 2'},
                ],
            },
            {
                'label': 'History',
                'fields': [
                    {'key': 'about_history', 'kind': 'site_config', 'type': 'richtext', 'label': 'History section'},
                ],
            },
            {
                'label': 'Mission',
                'fields': [
                    {'key': 'about_mission', 'kind': 'site_config', 'type': 'richtext', 'label': 'Mission statement'},
                ],
            },
        ],
    },
    'programs': {
        'page_slug':    'programs',
        'page_title':   'Programs and Services',
        'preview_path': '/pages/programs-and-services.html',
        'sections': [
            {
                'label': 'Header',
                'fields': [
                    {'key': 'programs_banner_image', 'kind': 'site_config', 'type': 'image', 'label': 'Programs banner image'},
                ],
            },
            {
                'label': 'PNEC',
                'fields': [
                    {'key': 'programs_pnec_para', 'kind': 'site_config', 'type': 'richtext', 'label': 'PNEC programs paragraph'},
                ],
            },
            {
                'label': 'Fire Safe Council',
                'fields': [
                    {'key': 'programs_fsc_para', 'kind': 'site_config', 'type': 'richtext', 'label': 'FSC paragraph'},
                ],
            },
            {
                'label': 'PACT',
                'fields': [
                    {'key': 'programs_pact_para', 'kind': 'site_config', 'type': 'richtext', 'label': 'PACT paragraph'},
                ],
            },
            {
                'label': 'Large Animals',
                'fields': [
                    {'key': 'programs_large_animal_para', 'kind': 'site_config', 'type': 'richtext', 'label': 'Large animal paragraph'},
                ],
            },
        ],
    },
}


@cms_manifest_bp.route('/cms/manifest/<string:page_slug>', methods=['GET'])
def get_manifest(page_slug):
    """Return the editable-field manifest for a page. Public — no auth."""
    manifest = MANIFESTS.get(page_slug)
    if not manifest:
        return error_response('NOT_FOUND', 404)
    return jsonify(manifest), 200
```

- [ ] **Step 4: Register the blueprint**

Open `BE_ROOT/app/__init__.py`. Find the import block at line 417-436 inside `_register_blueprints`. Add an import after the existing `page_overrides` import:

```python
    from app.routes.page_overrides import page_overrides_bp
    from app.routes.cms_manifest import cms_manifest_bp   # NEW
    from app.routes.chat import chat_bp
```

Then find the `app.register_blueprint(...)` calls (lines ~438-457). Add a registration after `page_overrides_bp`:

```python
    app.register_blueprint(page_overrides_bp, url_prefix='/api')
    app.register_blueprint(cms_manifest_bp,   url_prefix='/api')   # NEW
    app.register_blueprint(chat_bp,           url_prefix='/api')
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
./venv/bin/pytest tests/test_cms_manifest.py -v
```
Expected: 6 PASSED (3 page tests, 1 unknown-404, 3 parametrized drift checks → 6 total).

- [ ] **Step 6: Sanity-check via curl**

In one shell, start the server:
```bash
cd /Users/samarthvaka/Beasts_Flask && ./venv/bin/python run.py
```
In another shell:
```bash
curl -sS http://localhost:8425/api/cms/manifest/home | python -m json.tool | head -20
```
Expected: JSON with `"page_slug": "home"`, `"page_title": "Homepage"`. Stop the server with Ctrl-C.

- [ ] **Step 7: Commit**

```bash
git -C /Users/samarthvaka/Beasts_Flask add app/routes/cms_manifest.py app/__init__.py tests/test_cms_manifest.py
git -C /Users/samarthvaka/Beasts_Flask commit -m "feat(cms): add /api/cms/manifest/<slug> endpoint with home/about/programs schemas"
```

---

## Task 4: Frontend cms-api.js read layer

**Files:**
- Create: `FE_ROOT/assets/js/cms/cms-api.js`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40/assets/js/cms
```

Create `FE_ROOT/assets/js/cms/cms-api.js`:
```javascript
// assets/js/cms/cms-api.js
// Responsibility: CMS read API — fetches site-config, page overrides, and manifest.
// Pure fetch functions; no DOM, no auth header (these endpoints are public).
// Depends on: window.PNEC_CMS_API_BASE (set by the page or hydrate.js bootstrap).

(function () {
  'use strict';

  function _apiBase() {
    if (window.PNEC_CMS_API_BASE) return window.PNEC_CMS_API_BASE;
    const host = window.location.hostname;
    return (host === 'localhost' || host === '127.0.0.1')
      ? 'http://127.0.0.1:8425'
      : 'https://beasts.opencodingsociety.com';
  }

  function _get(path) {
    return fetch(_apiBase() + path, { method: 'GET', mode: 'cors', credentials: 'omit' })
      .then(r => {
        if (!r.ok) throw new Error('cms api ' + r.status + ' ' + path);
        return r.json();
      });
  }

  function cmsFetchSiteConfig() {
    // returns { config: {key:value}, entries: [...], meta: {...} }
    return _get('/api/site-config');
  }

  function cmsFetchOverrides(slug) {
    // returns { overrides: {element_id: content}, entries: [...] }
    return _get('/api/overrides/' + encodeURIComponent(slug));
  }

  function cmsFetchManifest(slug) {
    // returns { page_slug, page_title, preview_path, sections: [...] }
    return _get('/api/cms/manifest/' + encodeURIComponent(slug));
  }

  // Expose on window so non-module scripts can use them.
  window.cmsFetchSiteConfig = cmsFetchSiteConfig;
  window.cmsFetchOverrides  = cmsFetchOverrides;
  window.cmsFetchManifest   = cmsFetchManifest;
})();
```

- [ ] **Step 2: Verify file syntax with Node**

```bash
node --check /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40/assets/js/cms/cms-api.js
```
Expected: no output (file is valid).

- [ ] **Step 3: Commit**

```bash
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 add assets/js/cms/cms-api.js
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 commit -m "feat(cms): add cms-api.js read layer (site-config, overrides, manifest)"
```

---

## Task 5: Frontend hydrate.js with unit test (TDD)

**Files:**
- Create: `FE_ROOT/assets/js/cms/hydrate.test.mjs`
- Create: `FE_ROOT/assets/js/cms/hydrate.js`

- [ ] **Step 1: Write the failing test**

Create `FE_ROOT/assets/js/cms/hydrate.test.mjs`:
```javascript
// assets/js/cms/hydrate.test.mjs
// Pure-function tests for hydrate.js — runs under Node with no browser.
// We re-export the testable functions on globalThis when running under Node.

import assert from 'node:assert/strict';

// Stub a minimal `window` and `document` so hydrate.js can load.
globalThis.window = globalThis;
globalThis.location = { search: '', origin: 'http://localhost:4000', hostname: 'localhost' };
globalThis.document = {
  documentElement: { style: { setProperty: () => {} } },
  body: { classList: { add: () => {} }, dataset: {} },
  querySelectorAll: () => [],
  addEventListener: () => {},
};

// Load hydrate.js (it attaches functions to globalThis when window.PNEC_CMS_TEST is true).
globalThis.PNEC_CMS_TEST = true;
await import('./hydrate.js');

const { applyValue, parsePreviewMessage } = globalThis.__pnecCmsTestExports;

// ── applyValue dispatch ──
{
  const img = { tagName: 'IMG', src: 'old.jpg', dataset: {} };
  applyValue(img, 'new.jpg');
  assert.equal(img.src, 'new.jpg', 'IMG → src');
}
{
  const div = { tagName: 'DIV', dataset: { cmsHtml: 'true' }, innerHTML: 'old', textContent: 'old' };
  applyValue(div, '<b>new</b>');
  assert.equal(div.innerHTML, '<b>new</b>', 'data-cms-html=true → innerHTML');
}
{
  const span = { tagName: 'SPAN', dataset: {}, innerHTML: 'old', textContent: 'old' };
  applyValue(span, 'new');
  assert.equal(span.textContent, 'new', 'default → textContent');
  assert.equal(span.innerHTML, 'old', 'default does NOT set innerHTML');
}

// ── parsePreviewMessage origin + type guards ──
const goodOrigin = 'http://localhost:4000';
assert.deepEqual(
  parsePreviewMessage({ origin: goodOrigin, data: { type: 'cms-update', kind: 'config', key: 'k', value: 'v' } }, goodOrigin),
  { kind: 'config', key: 'k', value: 'v' },
  'good origin + good type → parsed'
);
assert.equal(
  parsePreviewMessage({ origin: 'http://evil.example', data: { type: 'cms-update', kind: 'config', key: 'k', value: 'v' } }, goodOrigin),
  null,
  'bad origin → null'
);
assert.equal(
  parsePreviewMessage({ origin: goodOrigin, data: { type: 'something-else' } }, goodOrigin),
  null,
  'wrong type → null'
);
assert.equal(
  parsePreviewMessage({ origin: goodOrigin, data: null }, goodOrigin),
  null,
  'null data → null'
);

console.log('hydrate.test.mjs: all assertions passed');
```

- [ ] **Step 2: Run the test (expected to fail — hydrate.js doesn't exist yet)**

```bash
cd /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40
node assets/js/cms/hydrate.test.mjs
```
Expected: ERR_MODULE_NOT_FOUND for `./hydrate.js`.

- [ ] **Step 3: Create hydrate.js**

Create `FE_ROOT/assets/js/cms/hydrate.js`:
```javascript
// assets/js/cms/hydrate.js
// Responsibility: Hydrate public Jekyll pages with CMS-backed content
// (site-config + page overrides). In ?preview=1 mode, subscribe to
// postMessage updates from the editor and apply them live.
//
// Loads as a classic <script> tag. Depends on cms-api.js being loaded first.

(function () {
  'use strict';

  // ── Pure: dispatch a value into an element by tag/attribute. ──
  function applyValue(el, value) {
    if (!el) return;
    if (el.tagName === 'IMG') {
      el.src = value;
      return;
    }
    if (el.dataset && el.dataset.cmsHtml === 'true') {
      el.innerHTML = value;
      return;
    }
    el.textContent = value;
  }

  // ── Pure: parse a postMessage event. Returns null if invalid. ──
  function parsePreviewMessage(event, expectedOrigin) {
    if (!event || event.origin !== expectedOrigin) return null;
    const d = event.data;
    if (!d || typeof d !== 'object') return null;
    if (d.type !== 'cms-update') return null;
    if (d.kind !== 'config' && d.kind !== 'override') return null;
    if (typeof d.key !== 'string') return null;
    return { kind: d.kind, key: d.key, value: d.value };
  }

  // ── Apply theme CSS custom properties from a config object. ──
  function applyThemeVars(config) {
    const root = document.documentElement;
    if (config.theme_primary_color) root.style.setProperty('--theme-primary', config.theme_primary_color);
    if (config.theme_accent_color)  root.style.setProperty('--theme-accent',  config.theme_accent_color);
  }

  // ── Apply all values from a fetched config + overrides to the DOM. ──
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

  // ── Enable preview mode: listen for cms-update messages from the parent. ──
  function enablePreviewMode() {
    const expectedOrigin = window.location.origin;
    window.addEventListener('message', (event) => {
      const msg = parsePreviewMessage(event, expectedOrigin);
      if (!msg) return;
      if (msg.kind === 'config') {
        document.querySelectorAll('[data-cms-config="' + msg.key + '"]').forEach(el => applyValue(el, msg.value));
        if (msg.key.indexOf('theme_') === 0) applyThemeVars({ [msg.key]: msg.value });
      } else if (msg.kind === 'override') {
        document.querySelectorAll('[data-cms-override="' + msg.key + '"]').forEach(el => applyValue(el, msg.value));
      }
    });
  }

  // ── Bootstrap: read body's data-cms-page, fetch + apply, mark hydrated. ──
  async function hydrate() {
    const slug = document.body && document.body.dataset && document.body.dataset.cmsPage;
    if (!slug) {
      document.body && document.body.classList.add('cms-hydrated');
      return;
    }
    let config = {}, overrides = {};
    try {
      const [c, o] = await Promise.all([
        window.cmsFetchSiteConfig(),
        window.cmsFetchOverrides(slug),
      ]);
      config    = (c && c.config)    || {};
      overrides = (o && o.overrides) || {};
    } catch (e) {
      console.warn('[cms] hydrate fetch failed; using fallback content', e);
    }
    applyAll(config, overrides);
    document.body.classList.add('cms-hydrated');
    if (new URLSearchParams(window.location.search).get('preview') === '1') {
      enablePreviewMode();
    }
  }

  // ── Test export hook: only when running under Node. ──
  if (typeof window !== 'undefined' && window.PNEC_CMS_TEST) {
    globalThis.__pnecCmsTestExports = { applyValue, parsePreviewMessage, applyThemeVars };
    return;
  }

  // ── Browser bootstrap. ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrate);
  } else {
    hydrate();
  }
})();
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40
node assets/js/cms/hydrate.test.mjs
```
Expected: `hydrate.test.mjs: all assertions passed`.

- [ ] **Step 5: Commit**

```bash
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 add assets/js/cms/hydrate.js assets/js/cms/hydrate.test.mjs
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 commit -m "feat(cms): add hydrate.js with applyValue + postMessage parser tests"
```

---

## Task 6: Wire hydrate scripts and flash-prevention CSS into pnec-base.html

**Files:**
- Modify: `FE_ROOT/_layouts/pnec-base.html` (head + script section)

- [ ] **Step 1: Add flash-prevention CSS in `<head>`**

Open `FE_ROOT/_layouts/pnec-base.html`. Find the `</head>` tag (around line 47). Insert immediately before `</head>`:

```html
  <!-- CMS hydrate flash-prevention -->
  <style>
    body[data-cms-page]:not(.cms-hydrated) [data-cms-config],
    body[data-cms-page]:not(.cms-hydrated) [data-cms-override] {
      visibility: hidden;
    }
  </style>
  <script>
    setTimeout(function () { document.body && document.body.classList.add('cms-hydrated'); }, 800);
  </script>
```

- [ ] **Step 2: Add cms-api.js + hydrate.js script tags**

Find the existing core scripts block. There are TWO blocks because of the `use_poway_source_clone` branching:

- Block A: lines ~71-80 (clone branch)
- Block B: lines ~119-128 (non-clone branch)

In Block A, AFTER the line `<script src="{{ '/assets/js/pages/navbar.js' | relative_url }}"></script>` (line 80), add:

```html
  <script src="{{ '/assets/js/cms/cms-api.js' | relative_url }}"></script>
  <script src="{{ '/assets/js/cms/hydrate.js' | relative_url }}"></script>
```

In Block B, AFTER the line `<script src="{{ '/assets/js/pages/navbar.js' | relative_url }}"></script>` (line 128), add the SAME two lines:

```html
  <script src="{{ '/assets/js/cms/cms-api.js' | relative_url }}"></script>
  <script src="{{ '/assets/js/cms/hydrate.js' | relative_url }}"></script>
```

- [ ] **Step 3: Verify Jekyll still builds**

From FE_ROOT:
```bash
bundle exec jekyll build 2>&1 | tail -20
```
Expected: `done in N seconds`. No errors.

- [ ] **Step 4: Commit**

```bash
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 add _layouts/pnec-base.html
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 commit -m "feat(layout): wire cms-api + hydrate scripts and flash-prevention CSS into pnec-base"
```

---

## Task 7: Tag the homepage in poway-live-body.html

**Files:**
- Modify: `FE_ROOT/_includes/poway-live-body.html`

The homepage body content lives in this large include (~1200 lines of WP/Elementor markup). We need to add a `data-cms-page="home"` wrapper and `data-cms-config` attributes to ~6 elements.

- [ ] **Step 1: Find the homepage hero `<h1>` and tag it**

Search for the homepage hero text. Run from FE_ROOT:
```bash
grep -n "Neighbors Helping Neighbors\|<h1\|hero-headline\|elementor-heading-title" _includes/poway-live-body.html | head -20
```

Identify the innermost element containing the existing hero text "Neighbors Helping Neighbors" (or whatever Liquid the WP clone renders for the homepage hero — likely an `<h1>` or `<h2>` inside an Elementor heading widget). Add `data-cms-config="hero_headline"` to that element. Example pattern:

```html
<h1 class="elementor-heading-title elementor-size-default" data-cms-config="hero_headline">Neighbors Helping Neighbors</h1>
```

- [ ] **Step 2: Tag the sub-headline**

Find the element holding the secondary tagline (e.g. "Poway Neighborhood Emergency Corps — prepared together." or similar). Add `data-cms-config="hero_subline"`.

- [ ] **Step 3: Tag the hero image**

Find the homepage hero `<img>` (search for `class="elementor-image"` near the top of the file or for filenames in `images/` referenced in the hero section). Add `data-cms-config="homepage_banner_image"`. The hydrate.js dispatcher sets `el.src` for `<img>` automatically.

- [ ] **Step 4: Tag the about blurb (richtext)**

Find the homepage's "About" paragraph block (the section that mentions PNEC being a community-based organization). Add to the innermost paragraph element:
```html
<p data-cms-config="about_blurb" data-cms-html="true">…existing content…</p>
```

`data-cms-html="true"` is required because the seed value contains `<p>` markup.

- [ ] **Step 5: Tag the footer tagline + copyright**

Search for footer text like `"Neighbors Helping Neighbors — Stay Prepared."` or `"All rights reserved"`. Add:
- `data-cms-config="footer_tagline"` to the tagline element.
- `data-cms-config="footer_copyright"` to the copyright element.

If the footer is in a separate include (`_includes/footer.html` or `poway-auth-footer.html`), tag it there instead and document the location in the commit message.

- [ ] **Step 6: Wrap the body content with `data-cms-page="home"`**

The simplest approach: add the attribute directly to `<body>` in `_layouts/pnec-base.html` for the clone branch only. Open `_layouts/pnec-base.html`, find line 48 (`<body{% if page.body_class …`), and change it to:

```html
<body{% if page.use_poway_source_clone %} data-cms-page="home"{% endif %}{% if page.body_class or page.use_poway_live_styles %} class="…"{% endif %}…>
```

Only the homepage uses `use_poway_source_clone: true`, so this attribute applies only there. (Other clone-mode pages would need their own `data-cms-page` strategy; out of scope for v1.)

- [ ] **Step 7: Smoke-test the homepage with Jekyll + Flask running**

Terminal A (Flask):
```bash
cd /Users/samarthvaka/Beasts_Flask && ./venv/bin/python run.py
```
Terminal B (Jekyll):
```bash
cd /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40
bundle exec jekyll serve
```
Open `http://localhost:4000/` in a browser. Confirm:
1. Page renders normally (no flash, no error in DevTools console).
2. DevTools → Network → there are GET requests to `/api/site-config` and `/api/overrides/home`.
3. The hero `<h1>` and other tagged elements have the seed values (default text — same as Liquid since DB has seed values).
4. `document.body.classList` includes `cms-hydrated`.

Stop both servers.

- [ ] **Step 8: Commit**

```bash
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 add _includes/poway-live-body.html _layouts/pnec-base.html
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 commit -m "feat(home): tag homepage hero/about/footer with data-cms-config attrs"
```

If footer tagging happened in a different include, also `git add` that file and mention it in the commit message.

---

## Task 8: Tag pages/about.html (raw HTML)

**Files:**
- Modify: `FE_ROOT/pages/about.html`

This file is a raw HTML clone with no Jekyll layout. Edit in place.

- [ ] **Step 1: Add flash-prevention style in the `<head>`**

Open `FE_ROOT/pages/about.html`. Find the `</title>` tag near the top. Insert immediately after it:

```html
<style>
  body[data-cms-page]:not(.cms-hydrated) [data-cms-config],
  body[data-cms-page]:not(.cms-hydrated) [data-cms-override] {
    visibility: hidden;
  }
</style>
<script>
  setTimeout(function () { document.body && document.body.classList.add('cms-hydrated'); }, 800);
</script>
```

- [ ] **Step 2: Add `data-cms-page="about"` to the `<body>`**

Search for the `<body>` tag (use grep — there should only be one):
```bash
grep -n "<body" /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40/pages/about.html | head -3
```
Add `data-cms-page="about"` to the existing `<body class="…">` attributes:
```html
<body data-cms-page="about" class="…existing classes…">
```

- [ ] **Step 3: Tag the banner image, paragraphs, mission, history**

Identify the elements that map to:
- `about_banner_image` → the `<img>` at the top of the page.
- `about_who_para1` → first paragraph under the "Who We Are" / "Who Are We?" heading.
- `about_who_para2` → second paragraph in the same section.
- `about_history` → the History section paragraph(s) — wrap a single container in `data-cms-config="about_history" data-cms-html="true"`.
- `about_mission` → mission statement paragraph.

Use grep to locate likely candidates:
```bash
grep -n "Who Are We\|History\|Mission\|501(c)" /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40/pages/about.html | head -10
```

For richtext fields, add `data-cms-html="true"` since seed values contain `<p>` markup. Tag the innermost element that contains *only* the editable paragraph — not a wrapper that also contains other unrelated content.

- [ ] **Step 4: Add scripts immediately before `</body>`**

Find the closing `</body>` tag. Insert immediately before it:

```html
<script src="/assets/js/cms/cms-api.js"></script>
<script src="/assets/js/cms/hydrate.js"></script>
```

Use absolute paths — this raw HTML doesn't go through Liquid `relative_url`.

- [ ] **Step 5: Smoke-test**

Start Flask + Jekyll (same as Task 7 step 7). Visit `http://localhost:4000/pages/about.html`.

Confirm:
1. Page renders without a flash; no console errors.
2. Network shows GET `/api/site-config` and `/api/overrides/about`.
3. Tagged elements display the seed values.
4. `document.body.classList` includes `cms-hydrated`.

Stop both servers.

- [ ] **Step 6: Commit**

```bash
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 add pages/about.html
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 commit -m "feat(about): tag about page elements + load hydrate scripts"
```

---

## Task 9: Tag pages/programs-and-services.html (raw HTML)

**Files:**
- Modify: `FE_ROOT/pages/programs-and-services.html`

Same pattern as Task 8 with `data-cms-page="programs"`.

- [ ] **Step 1: Insert flash-prevention style after `</title>`**

Use the same snippet as Task 8 step 1.

- [ ] **Step 2: Add `data-cms-page="programs"` to `<body>`**

```html
<body data-cms-page="programs" class="…existing classes…">
```

- [ ] **Step 3: Tag the five fields**

Map manifest keys to elements:
- `programs_banner_image` → top banner `<img>`.
- `programs_pnec_para` → main PNEC programs description paragraph.
- `programs_fsc_para` → Fire Safe Council section paragraph.
- `programs_pact_para` → PACT Collaboration section paragraph.
- `programs_large_animal_para` → Large Animal Emergency Planning section paragraph.

All paragraph fields need `data-cms-html="true"` since seeds contain `<p>` markup.

Locate candidates:
```bash
grep -n "Fire Safe Council\|PACT\|Large Animal\|PNEC regularly" /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40/pages/programs-and-services.html | head -10
```

- [ ] **Step 4: Insert scripts before `</body>`**

```html
<script src="/assets/js/cms/cms-api.js"></script>
<script src="/assets/js/cms/hydrate.js"></script>
```

- [ ] **Step 5: Smoke-test at `http://localhost:4000/pages/programs-and-services.html`**

Same checks as Task 8 step 5 but with `/api/overrides/programs` in the network panel.

- [ ] **Step 6: Commit**

```bash
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 add pages/programs-and-services.html
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 commit -m "feat(programs): tag programs page elements + load hydrate scripts"
```

---

## Task 10: Editor API layer (editor-api.js)

**Files:**
- Create: `FE_ROOT/assets/js/admin/editor-api.js`

- [ ] **Step 1: Create the file**

```bash
mkdir -p /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40/assets/js/admin
```

Create `FE_ROOT/assets/js/admin/editor-api.js`:
```javascript
// assets/js/admin/editor-api.js
// Responsibility: Editor admin API layer — manifest fetch + bulk updates.
// Bearer-token auth via the same pattern as admin-api.js (pnec_token in localStorage).

(function () {
  'use strict';

  function _apiBase() {
    if (window.PNEC_CMS_API_BASE) return window.PNEC_CMS_API_BASE;
    const host = window.location.hostname;
    return (host === 'localhost' || host === '127.0.0.1')
      ? 'http://127.0.0.1:8425'
      : 'https://beasts.opencodingsociety.com';
  }

  function _authHeaders() {
    const token = localStorage.getItem('pnec_token');
    const h = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = 'Bearer ' + token;
    return h;
  }

  function _request(path, opts) {
    const o = Object.assign({ credentials: 'include' }, opts || {});
    o.headers = Object.assign(_authHeaders(), opts && opts.headers || {});
    return fetch(_apiBase() + path, o).then(r => {
      if (!r.ok) {
        const err = new Error('editor api ' + r.status + ' ' + path);
        err.status = r.status;
        throw err;
      }
      return r.json();
    });
  }

  function editorFetchManifest(slug) {
    return _request('/api/cms/manifest/' + encodeURIComponent(slug));
  }

  function editorFetchSiteConfig() {
    return _request('/api/site-config');
  }

  function editorFetchOverrides(slug) {
    return _request('/api/overrides/' + encodeURIComponent(slug));
  }

  function editorBulkUpdateConfig(updates) {
    // updates: { key: value, ... }
    return _request('/api/site-config/bulk', {
      method: 'PATCH',
      body: JSON.stringify({ updates }),
    });
  }

  function editorBulkUpdateOverrides(slug, overrides) {
    // overrides: { element_id: content, ... }
    return _request('/api/overrides/' + encodeURIComponent(slug) + '/bulk', {
      method: 'POST',
      body: JSON.stringify({ overrides }),
    });
  }

  function editorUploadImage(file) {
    const fd = new FormData();
    fd.append('file', file);
    const token = localStorage.getItem('pnec_token');
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(_apiBase() + '/api/site-config/upload-image', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: fd,
    }).then(r => {
      if (!r.ok) throw new Error('upload ' + r.status);
      return r.json();   // { url: "..." }
    });
  }

  // Expose
  window.editorFetchManifest        = editorFetchManifest;
  window.editorFetchSiteConfig      = editorFetchSiteConfig;
  window.editorFetchOverrides       = editorFetchOverrides;
  window.editorBulkUpdateConfig     = editorBulkUpdateConfig;
  window.editorBulkUpdateOverrides  = editorBulkUpdateOverrides;
  window.editorUploadImage          = editorUploadImage;
})();
```

- [ ] **Step 2: Verify file syntax**

```bash
node --check /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40/assets/js/admin/editor-api.js
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 add assets/js/admin/editor-api.js
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 commit -m "feat(editor): add editor-api.js (manifest, bulk PATCH, image upload)"
```

---

## Task 11: Editor controller (editor-controller.js)

**Files:**
- Create: `FE_ROOT/assets/js/admin/editor-controller.js`

- [ ] **Step 1: Create the file**

Create `FE_ROOT/assets/js/admin/editor-controller.js`:
```javascript
// assets/js/admin/editor-controller.js
// Responsibility: Live theme editor orchestrator.
// - Loads the manifest for the selected page.
// - Renders editable fields from the manifest (text/richtext/image/color).
// - Tracks pendingChanges; postMessages to iframe on input.
// - On Save: bulk-PATCH config / overrides, reload iframe to verify.
// - On Discard: clear pendingChanges, reload iframe with ?preview=1.
//
// Depends on editor-api.js loaded first.

(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────────────
  const state = {
    slug:           null,    // current page_slug
    manifest:       null,    // current manifest object
    initialConfig:  {},      // baseline values from /api/site-config
    initialOverrides: {},    // baseline values from /api/overrides/<slug>
    pendingChanges: {},      // { key: { kind, value } }
    iframeReady:    false,
    queue:          [],      // postMessage queue while iframe loads
  };

  // ── DOM refs (resolved on init) ───────────────────────────────────────────
  let elPageSelect, elTabContent, elTabTheme, elTabSEO, elTabBtns;
  let elFieldsRoot, elIframe, elIframeUrl, elSaveBtn, elDiscardBtn;
  let elToast, elPreviewBanner;

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  function init() {
    elPageSelect    = document.getElementById('ed-page-select');
    elFieldsRoot    = document.getElementById('ed-fields');
    elIframe        = document.getElementById('ed-iframe');
    elIframeUrl     = document.getElementById('ed-iframe-url');
    elSaveBtn       = document.getElementById('ed-save');
    elDiscardBtn    = document.getElementById('ed-discard');
    elToast         = document.getElementById('ed-toast');
    elPreviewBanner = document.getElementById('ed-preview-banner');
    elTabBtns       = document.querySelectorAll('.ed-tab-btn');
    elTabContent    = document.getElementById('ed-tab-content');
    elTabTheme      = document.getElementById('ed-tab-theme');
    elTabSEO        = document.getElementById('ed-tab-seo');

    elPageSelect.addEventListener('change', () => loadPage(elPageSelect.value));
    elSaveBtn.addEventListener('click', save);
    elDiscardBtn.addEventListener('click', discard);
    elTabBtns.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    elIframe.addEventListener('load', flushQueue);

    // Watchdog: if iframe doesn't acknowledge messages by 5s, show banner.
    setTimeout(() => {
      if (!state.iframeReady) elPreviewBanner.style.display = 'block';
    }, 5000);

    loadPage('home');
  }

  // ── Load a page: fetch manifest + values, render fields, point iframe. ──
  async function loadPage(slug) {
    if (Object.keys(state.pendingChanges).length > 0) {
      if (!confirm('Discard unsaved changes?')) {
        elPageSelect.value = state.slug;
        return;
      }
    }
    state.slug = slug;
    state.pendingChanges = {};
    updateSaveBtn();
    elPreviewBanner.style.display = 'none';
    state.iframeReady = false;
    state.queue = [];

    try {
      const [manifest, configResp, overridesResp] = await Promise.all([
        window.editorFetchManifest(slug),
        window.editorFetchSiteConfig(),
        window.editorFetchOverrides(slug),
      ]);
      state.manifest          = manifest;
      state.initialConfig     = (configResp && configResp.config)    || {};
      state.initialOverrides  = (overridesResp && overridesResp.overrides) || {};
    } catch (e) {
      toast('Could not load fields. Refresh to retry.', 'error');
      return;
    }

    renderContentTab();
    renderThemeTab();
    pointIframe(state.manifest.preview_path);
  }

  // ── Iframe helpers ────────────────────────────────────────────────────────
  function pointIframe(path) {
    const url = path + (path.indexOf('?') === -1 ? '?preview=1' : '&preview=1');
    elIframe.src   = url;
    elIframeUrl.textContent = url;
  }

  function postToIframe(kind, key, value) {
    const msg = { type: 'cms-update', kind, key, value };
    if (!state.iframeReady) {
      state.queue.push(msg);
      return;
    }
    try {
      elIframe.contentWindow.postMessage(msg, window.location.origin);
      state.iframeReady = true;     // first successful post means it's reachable
    } catch (e) {
      // ignore — watchdog handles unresponsive iframe
    }
  }

  function flushQueue() {
    state.iframeReady = true;
    while (state.queue.length) {
      const msg = state.queue.shift();
      try { elIframe.contentWindow.postMessage(msg, window.location.origin); } catch (_e) {}
    }
  }

  // ── Field rendering ──────────────────────────────────────────────────────
  function renderContentTab() {
    elFieldsRoot.innerHTML = '';
    state.manifest.sections.forEach(section => {
      const head = document.createElement('div');
      head.className = 'ed-section-label';
      head.textContent = section.label;
      elFieldsRoot.appendChild(head);
      section.fields.forEach(field => elFieldsRoot.appendChild(renderField(field)));
    });
  }

  function renderThemeTab() {
    const themeFields = [
      { key: 'theme_primary_color', kind: 'site_config', type: 'color', label: 'Primary color' },
      { key: 'theme_accent_color',  kind: 'site_config', type: 'color', label: 'Accent color' },
      { key: 'theme_logo_image',    kind: 'site_config', type: 'image', label: 'Logo image' },
      { key: 'org_name',            kind: 'site_config', type: 'text',  label: 'Org name' },
      { key: 'org_short_name',      kind: 'site_config', type: 'text',  label: 'Org acronym' },
      { key: 'donate_url',          kind: 'site_config', type: 'text',  label: 'Donate URL' },
    ];
    elTabTheme.innerHTML = '';
    themeFields.forEach(f => elTabTheme.appendChild(renderField(f)));
  }

  function renderField(field) {
    const wrap = document.createElement('div');
    wrap.className = 'ed-field';
    const labelEl = document.createElement('label');
    labelEl.className = 'ed-field-label';
    labelEl.textContent = field.label;
    wrap.appendChild(labelEl);

    const initial = field.kind === 'site_config'
      ? (state.initialConfig[field.key] || '')
      : (state.initialOverrides[field.key] || '');

    let input;
    if (field.type === 'text') {
      input = document.createElement('input');
      input.type = 'text';
      input.className = 'ed-input';
      input.value = initial;
    } else if (field.type === 'richtext') {
      input = document.createElement('textarea');
      input.className = 'ed-input ed-textarea';
      input.rows = 6;
      input.value = initial;
    } else if (field.type === 'color') {
      input = document.createElement('input');
      input.type = 'color';
      input.className = 'ed-input ed-color';
      input.value = initial || '#1e3a8a';
    } else if (field.type === 'image') {
      return renderImageField(wrap, field, initial);
    } else {
      input = document.createElement('input');
      input.type = 'text';
      input.value = initial;
    }
    input.addEventListener('input', debounce(() => {
      onFieldChange(field, input.value);
    }, 200));
    wrap.appendChild(input);
    return wrap;
  }

  function renderImageField(wrap, field, initialUrl) {
    const preview = document.createElement('div');
    preview.className = 'ed-img-preview';
    preview.textContent = initialUrl ? initialUrl : '(no image)';
    wrap.appendChild(preview);

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.className = 'ed-input';
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      try {
        const { url } = await window.editorUploadImage(file);
        preview.textContent = url;
        onFieldChange(field, url);
      } catch (e) {
        toast('Image upload failed.', 'error');
      }
    });
    wrap.appendChild(fileInput);
    return wrap;
  }

  // ── Change tracking ──────────────────────────────────────────────────────
  function onFieldChange(field, value) {
    const kindKey = field.kind === 'site_config' ? 'config' : 'override';
    state.pendingChanges[field.key] = { kind: kindKey, value };
    postToIframe(kindKey, field.key, value);
    updateSaveBtn();
  }

  function updateSaveBtn() {
    elSaveBtn.disabled = Object.keys(state.pendingChanges).length === 0;
  }

  // ── Save / Discard ───────────────────────────────────────────────────────
  async function save() {
    const configUpdates    = {};
    const overrideUpdates  = {};
    Object.entries(state.pendingChanges).forEach(([key, { kind, value }]) => {
      if (kind === 'config') configUpdates[key] = value;
      else                   overrideUpdates[key] = value;
    });
    try {
      const promises = [];
      if (Object.keys(configUpdates).length)
        promises.push(window.editorBulkUpdateConfig(configUpdates));
      if (Object.keys(overrideUpdates).length)
        promises.push(window.editorBulkUpdateOverrides(state.slug, overrideUpdates));
      await Promise.all(promises);
      Object.assign(state.initialConfig, configUpdates);
      Object.assign(state.initialOverrides, overrideUpdates);
      state.pendingChanges = {};
      updateSaveBtn();
      toast('Saved.', 'ok');
      pointIframe(state.manifest.preview_path);   // reload to confirm persisted state
    } catch (e) {
      toast('Save failed: ' + (e.message || 'unknown error'), 'error');
    }
  }

  function discard() {
    state.pendingChanges = {};
    updateSaveBtn();
    pointIframe(state.manifest.preview_path);
  }

  // ── UI helpers ───────────────────────────────────────────────────────────
  function switchTab(name) {
    elTabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    elTabContent.style.display = name === 'content' ? 'block' : 'none';
    elTabTheme.style.display   = name === 'theme'   ? 'block' : 'none';
    elTabSEO.style.display     = name === 'seo'     ? 'block' : 'none';
  }

  function toast(msg, kind) {
    elToast.textContent = msg;
    elToast.className = 'ed-toast ' + (kind || '');
    elToast.style.opacity = '1';
    setTimeout(() => { elToast.style.opacity = '0'; }, 3500);
  }

  function debounce(fn, ms) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // Init when DOM is ready.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

- [ ] **Step 2: Verify syntax**

```bash
node --check /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40/assets/js/admin/editor-controller.js
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 add assets/js/admin/editor-controller.js
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 commit -m "feat(editor): add editor-controller.js orchestrator (fields, postMessage, save, discard)"
```

---

## Task 12: Build admin-editor.html shell with auth gate

**Files:**
- Create: `FE_ROOT/pages/admin-editor.html`

- [ ] **Step 1: Create the page**

Create `FE_ROOT/pages/admin-editor.html`:
```html
---
layout: pnec-base
title: "Live Editor"
use_poway_live_styles: false
---

<style>
:root {
  --ed-bg:        #0a1628;
  --ed-surface:   #0f1e36;
  --ed-surface2:  #152540;
  --ed-border:    rgba(255,255,255,0.10);
  --ed-text:      #e8f0fb;
  --ed-muted:     #8ba3c7;
  --ed-accent:    #3b82f6;
  --ed-green:     #10b981;
  --ed-amber:     #f59e0b;
  --ed-red:       #ef4444;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--ed-bg); color: var(--ed-text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

#ed-gate { display: none; min-height: 100vh; place-items: center; padding: 24px; }
#ed-gate.visible { display: grid; }
#ed-gate-card { width: min(420px,100%); background: var(--ed-surface); border: 1px solid var(--ed-border); border-radius: 16px; padding: 32px; }

#ed-shell { display: none; height: 100vh; flex-direction: column; }
#ed-shell.visible { display: flex; }

.ed-topbar { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: var(--ed-surface); border-bottom: 1px solid var(--ed-border); }
.ed-topbar .ed-title { font-weight: 700; font-size: .95rem; }
.ed-topbar select { background: var(--ed-bg); color: var(--ed-text); border: 1px solid var(--ed-border); padding: 6px 8px; border-radius: 6px; }
.ed-tabs { display: flex; gap: 4px; margin-left: 16px; }
.ed-tab-btn { background: transparent; color: var(--ed-muted); border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: .85rem; }
.ed-tab-btn.active { background: var(--ed-accent); color: white; }
.ed-spacer { flex: 1; }
.ed-btn { background: var(--ed-accent); color: white; border: none; padding: 7px 14px; border-radius: 6px; font-size: .85rem; cursor: pointer; }
.ed-btn[disabled] { opacity: 0.4; cursor: not-allowed; }
.ed-btn-ghost { background: transparent; color: var(--ed-muted); border: 1px solid var(--ed-border); }

.ed-body { display: grid; grid-template-columns: 340px 1fr; flex: 1; min-height: 0; }
.ed-panel { background: var(--ed-surface); border-right: 1px solid var(--ed-border); overflow-y: auto; padding: 14px; }
.ed-section-label { font-size: .7rem; text-transform: uppercase; letter-spacing: .05em; color: var(--ed-muted); margin: 14px 0 6px; }
.ed-field { background: var(--ed-bg); border: 1px solid var(--ed-border); border-radius: 6px; padding: 10px; margin-bottom: 10px; }
.ed-field-label { display: block; font-size: .75rem; color: var(--ed-muted); margin-bottom: 6px; }
.ed-input { width: 100%; background: var(--ed-surface2); color: var(--ed-text); border: 1px solid var(--ed-border); padding: 8px; border-radius: 4px; font: inherit; }
.ed-textarea { resize: vertical; min-height: 90px; font-family: inherit; }
.ed-color { padding: 0; height: 32px; }
.ed-img-preview { font-size: .8rem; color: var(--ed-muted); padding: 4px 0; word-break: break-all; }

.ed-preview { display: flex; flex-direction: column; min-height: 0; }
.ed-preview-toolbar { padding: 8px 14px; background: #334155; color: var(--ed-text); display: flex; align-items: center; gap: 10px; font-size: .8rem; border-bottom: 1px solid var(--ed-border); }
#ed-iframe { flex: 1; width: 100%; border: 0; background: white; }
#ed-iframe-url { flex: 1; color: var(--ed-muted); font-family: ui-monospace, monospace; font-size: .75rem; }
.ed-live-badge { background: var(--ed-green); color: white; padding: 2px 8px; border-radius: 10px; font-size: .7rem; }

#ed-preview-banner { display: none; background: var(--ed-amber); color: #1f2937; padding: 8px 14px; font-size: .85rem; }
#ed-toast { position: fixed; bottom: 20px; right: 20px; background: var(--ed-surface); border: 1px solid var(--ed-border); padding: 10px 14px; border-radius: 6px; opacity: 0; transition: opacity 200ms; z-index: 100; }
#ed-toast.error { border-color: var(--ed-red); color: #fecaca; }
#ed-toast.ok { border-color: var(--ed-green); color: #bbf7d0; }
</style>

<!-- Auth gate -->
<div id="ed-gate">
  <div id="ed-gate-card">
    <h2 style="margin:0 0 8px;">🔒 Admin Only</h2>
    <p style="color:var(--ed-muted);margin:0 0 16px;">You need to be signed in with an admin account to access the live editor.</p>
    <a href="{{ '/pages/register.html#login' | relative_url }}" class="ed-btn" style="text-decoration:none;display:inline-block;">Go to Login</a>
  </div>
</div>

<!-- Editor shell -->
<div id="ed-shell">
  <div class="ed-topbar">
    <span class="ed-title">PNEC Live Editor</span>
    <select id="ed-page-select" aria-label="Page">
      <option value="home">Homepage</option>
      <option value="about">About</option>
      <option value="programs">Programs and Services</option>
    </select>
    <div class="ed-tabs">
      <button class="ed-tab-btn active" data-tab="content">Content</button>
      <button class="ed-tab-btn"        data-tab="theme">Theme</button>
      <button class="ed-tab-btn"        data-tab="seo">SEO</button>
    </div>
    <div class="ed-spacer"></div>
    <button id="ed-discard" class="ed-btn ed-btn-ghost">Discard</button>
    <button id="ed-save" class="ed-btn" disabled>Save</button>
  </div>

  <div id="ed-preview-banner">⚠ Preview not responding — Save will still apply changes.</div>

  <div class="ed-body">
    <aside class="ed-panel">
      <div id="ed-tab-content"><div id="ed-fields"></div></div>
      <div id="ed-tab-theme" style="display:none;"></div>
      <div id="ed-tab-seo" style="display:none;color:var(--ed-muted);font-size:.85rem;padding:14px;">SEO editing — coming soon.</div>
    </aside>
    <section class="ed-preview">
      <div class="ed-preview-toolbar">
        <span style="cursor:pointer;" onclick="document.getElementById('ed-iframe').contentWindow.location.reload()">↻</span>
        <span id="ed-iframe-url"></span>
        <span class="ed-live-badge">LIVE</span>
      </div>
      <iframe id="ed-iframe" title="Page preview"></iframe>
    </section>
  </div>
</div>

<div id="ed-toast"></div>

<script>
// Auth gate (matches admin.html pattern).
(function () {
  const u = JSON.parse(localStorage.getItem('pnec_user') || 'null');
  if (!u || u.role !== 'admin') {
    document.getElementById('ed-gate').classList.add('visible');
    return;
  }
  document.getElementById('ed-shell').classList.add('visible');
})();
</script>

<script src="{{ '/assets/js/admin/editor-api.js' | relative_url }}"></script>
<script src="{{ '/assets/js/admin/editor-controller.js' | relative_url }}"></script>
```

- [ ] **Step 2: Build Jekyll**

```bash
cd /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40
bundle exec jekyll build 2>&1 | tail -10
```
Expected: `done in N seconds`. No errors.

- [ ] **Step 3: Smoke-test**

Start Flask + Jekyll. In browser, sign in as admin (use the existing login flow at `/pages/register.html#login` with the admin credentials seeded in the dev DB). Then visit `http://localhost:4000/pages/admin-editor.html`.

Verify:
1. As admin: editor loads with Homepage selected, fields populated from current site_config values, iframe loads `/?preview=1`.
2. Switching the page selector to About / Programs reloads the field panel and iframe.
3. Typing in a text field updates the iframe content within ~250ms.
4. Tabs switch between Content / Theme / SEO.
5. As non-admin (clear localStorage `pnec_user`): gate appears, editor doesn't load.
6. Save button is disabled until a field is edited; enabled afterward.

- [ ] **Step 4: Commit**

```bash
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 add pages/admin-editor.html
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 commit -m "feat(editor): add admin-editor.html with auth gate, field panel, iframe preview"
```

---

## Task 13: Link the editor from the existing admin dashboard

**Files:**
- Modify: `FE_ROOT/pages/admin.html` (around line 248 — Quick Actions panel)

- [ ] **Step 1: Add a button to the Quick Actions panel**

Open `FE_ROOT/pages/admin.html`. Find the Quick Actions block (line 248-258 in the current file). Add a new link button after the "View Site" link:

```html
            <a href="{{ '/pages/admin-editor.html' | relative_url }}" class="btn btn-primary" style="text-decoration:none;">✏️ Open Live Editor</a>
```

So the resulting block looks like:
```html
          <div class="adm-panel-body" style="display:flex;flex-wrap:wrap;gap:10px;">
            <button class="btn btn-primary" onclick="admSwitchTab('events');document.getElementById('adm-new-event-btn').click()">➕ New Event</button>
            …existing buttons…
            <a href="{{ '/' | relative_url }}" target="_blank" class="btn btn-ghost" style="text-decoration:none;">🌐 View Site</a>
            <a href="{{ '/pages/admin-editor.html' | relative_url }}" class="btn btn-primary" style="text-decoration:none;">✏️ Open Live Editor</a>
          </div>
```

- [ ] **Step 2: Build and smoke-test**

```bash
cd /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40
bundle exec jekyll build 2>&1 | tail -5
```

In browser as admin, visit `http://localhost:4000/pages/admin.html`. The Overview tab should show the new "✏️ Open Live Editor" button. Clicking it loads the editor.

- [ ] **Step 3: Commit**

```bash
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 add pages/admin.html
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 commit -m "feat(admin): link to live editor from admin dashboard quick actions"
```

---

## Task 14: End-to-end manual verification checklist

**Files:** none — this task validates the full feature.

Run Flask (`./venv/bin/python run.py` from BE_ROOT) and Jekyll (`bundle exec jekyll serve` from FE_ROOT) in two terminals throughout. Use the admin account seeded by Task 1's conftest pattern (or your local dev admin) to sign in.

Each item must pass before the feature is done. If any fail, fix in a follow-up commit and re-run from that step.

- [ ] **Check 1: Homepage hydrates from API.** Visit `http://localhost:4000/`. DevTools → Network shows GET `/api/site-config` and `/api/overrides/home` (both 200). The hero `<h1>` text matches the `hero_headline` value in the DB. `document.body.classList` includes `cms-hydrated`.

- [ ] **Check 2: Homepage falls back gracefully when Flask is down.** Stop the Flask server. Hard-reload the homepage. Page renders with the original Liquid content (whatever the seed `<h1>` says). DevTools console shows a warning starting with `[cms] hydrate fetch failed`. **No** banner is shown to the user. Restart Flask.

- [ ] **Check 3: Editor redirects non-admin to login.** Open DevTools → Application → Local Storage. Delete `pnec_user`. Visit `http://localhost:4000/pages/admin-editor.html`. Gate appears with "Go to Login" button. Restore `pnec_user` (or sign in again).

- [ ] **Check 4: Page selector switches pages.** As admin, on the editor: change page selector from Homepage → About. Iframe URL updates to `/pages/about.html?preview=1`. Field panel re-renders with about-page sections (Header, Who We Are, History, Mission). Switch to Programs — iframe and fields update again.

- [ ] **Check 5: Live preview within ~250ms.** With Homepage selected, type into the Headline field. Within ~250ms (after the 200ms debounce), the iframe's hero `<h1>` updates without reloading. DevTools → Network shows NO request firing for each keystroke (only postMessage activity).

- [ ] **Check 6: Discard restores saved state.** After typing changes (without saving), click Discard. Field values revert; iframe reloads with `?preview=1` and shows the saved (pre-edit) values.

- [ ] **Check 7: Save persists.** Type a small change in Headline, click Save. Toast shows "Saved." DevTools → Network shows a PATCH to `/api/site-config/bulk` with 200 response. Open the homepage in a new tab (`http://localhost:4000/`); the new headline is visible. Hard-reload — still visible.

- [ ] **Check 8: Image upload replaces the URL.** In Theme tab, click the Logo Image picker, select a JPG/PNG. Network panel shows POST to `/api/site-config/upload-image`, 200 with `{url: "..."}`. The image preview text updates with the URL. Save. Reload the homepage; if the navbar references `theme_logo_image` via `data-cms-config`, the new logo is visible.

- [ ] **Check 9: Theme color custom property.** In Theme tab, change Primary Color via the color picker. The iframe's `:root` style includes `--theme-primary: <new-hex>`. (Confirm via DevTools on the iframe's `<html>` element style.)

- [ ] **Check 10: Iframe-unresponsive banner.** In the editor, use DevTools to navigate the iframe to a 404 page (`/this-does-not-exist`). Wait 5 seconds. The yellow banner "Preview not responding — Save will still apply changes" appears.

- [ ] **Check 11: Drift guard test still passes.** From BE_ROOT:
```bash
./venv/bin/pytest -v
```
All tests green: `test_theme_config_seed.py` (3) + `test_cms_manifest.py` (6) = 9 PASSED.

- [ ] **Check 12: Frontend hydrate unit test still passes.** From FE_ROOT:
```bash
node assets/js/cms/hydrate.test.mjs
```
Expected: `hydrate.test.mjs: all assertions passed`.

- [ ] **Step final: Document the verification in a commit.**

If everything passes, no code changes — but mark the verification done with a commit on FE_ROOT:
```bash
git -C /Users/samarthvaka/Beasts_FrontEnd/.claude/worktrees/strange-johnson-175d40 commit --allow-empty -m "test: live theme editor v1 manual verification checklist passed"
```

---

## Self-review notes

**Spec coverage:**
- §1 Background — addressed in plan header (repo-layout note + tech stack).
- §2 Goal & success criteria — all six v1 success criteria mapped to checks 1, 7, 4, 9, 2, 3 in Task 14.
- §3 Architecture — implemented across Tasks 4–6 (hydrate), 11 (controller), 12 (shell).
- §4 Backend — Tasks 2 (seeds), 3 (manifest endpoint).
- §5 Field schema — Task 3 (manifest constants) + Task 11 (theme tab fields).
- §6 Hydration layer — Tasks 4, 5, 6, 7, 8, 9.
- §7 Editor UI — Tasks 10, 11, 12, 13.
- §8 Auth + errors + fallback — Task 12 (auth gate); error handling embedded in controller (Task 11) and editor-api (Task 10); fallback covered by Check 2.
- §9 Testing — Tasks 1, 3 (pytest), Task 5 (hydrate test), Task 14 (manual checklist).
- §10 Files — File map at top of this plan matches §10 of spec exactly.
- §11 Risks — drift mitigation = Task 3's invariant test; flash mitigation = Task 6's safety timer; fallback = Check 2; postMessage origin = Task 5's parser test.
- §12 Future work — explicitly out of scope (block builder, draft/publish, override-backed v1 fields, SEO editor, additional pages).

**Type consistency check:** `applyValue`, `parsePreviewMessage`, `editorBulkUpdateConfig`, `editorBulkUpdateOverrides`, `editorUploadImage`, `cmsFetchSiteConfig`, `cmsFetchOverrides`, `cmsFetchManifest`, `pendingChanges`, `state.iframeReady`, `MANIFESTS` — names used consistently across all task code blocks.

**Placeholder scan:** No "TBD" / "TODO" / "implement later" / "add appropriate error handling" — all error handling is concrete in the code blocks.
