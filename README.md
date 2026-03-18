# PNEC Frontend — Poway Neighborhood Emergency Corps

Jekyll / GitHub Pages static site for [powaynec.com](https://powaynec.com). Serves as the public-facing website for PNEC, the community emergency preparedness organization serving Poway, CA since 1995.

## Setup

**Prerequisites:** Ruby 3+, Bundler

```bash
cd BB_FrontEnd2
bundle install
bundle exec jekyll serve --port 4000
```

Site available at `http://localhost:4000`. API calls hit the Flask backend at `http://localhost:8587` (set in `assets/js/utils/errors.js`).

## Directory Structure

```
_includes/
  nav/navbar.html          # PNEC navbar (desktop + mobile drawer)
  footer.html              # PNEC footer
  chatbot/                 # FAQ chatbot widget HTML
_layouts/
  pnec-base.html           # Base layout — all PNEC pages use this
_sass/
  _variables.scss          # Design tokens (colors, spacing, type)
  _layout.scss             # Global body, container, section utilities
  _components.scss         # Buttons, cards, badges, modals, alerts, forms
  _nav.scss                # Navbar + mobile drawer styles
  _footer.scss             # Footer styles
  _homepage.scss           # Homepage-specific sections (hero, risk widget, etc.)
  _pages.scss              # Page-specific styles (auth, kit, map, gallery, game, dashboard)
  main.scss                # Root SCSS — imports all partials
assets/
  css/main.scss            # Jekyll entry point — triggers SASS compile
  js/
    utils/errors.js        # API_BASE, escapeHtml, validateResponse (loaded on all pages)
    api/                   # WORKER files — fetch only, no DOM
      auth-api.js          # login, register, logout, me, fetchNeighborhoodsForSelect
      faq-api.js           # FAQ categories, items, search, helpful, question submit/claim/answer
      events-api.js        # fetchEvents, fetchEventsForMonth, createEvent, fetchMediaPosts, uploadMediaPost
      risk-api.js          # fetchRiskAssessment
      neighborhood-api.js  # fetchNeighborhoods, fetchNeighborhoodDetail
      game-api.js          # fetchGameQuestions, submitGameScore
    ui/                    # WORKER files — DOM manipulation only, no fetch
      auth-ui.js           # renderAccessDenied, updateNavbarAuth
      chatbot-ui.js        # chatbot widget rendering
      kit-ui.js            # kit checklist rendering
      map-ui.js            # Leaflet map rendering
      risk-ui.js           # risk card rendering
    pages/                 # ORCHESTRATOR files — coordinate workers
      navbar.js            # Navbar state (auth, mobile menu, dropdowns)
      chatbot.js           # FAQ chatbot orchestrator
      risk-widget.js       # Homepage risk widget orchestrator
      login-page.js        # Login form orchestrator
      register-page.js     # Registration form orchestrator
      neighborhood-map.js  # Neighborhood map orchestrator
      kit.js               # 72-hour kit orchestrator
      game.js              # Preparedness game orchestrator
      gallery-page.js      # Gallery page orchestrator
      events-page.js       # Events/calendar orchestrator
      dashboard-page.js    # Staff dashboard orchestrator
pages/
  login.html               # Sign in
  register.html            # Create account
  kit.html                 # 72-Hour Kit Checklist (localStorage persistence)
  neighborhood-map.html    # Leaflet interactive map
  events.html              # Calendar + list view
  gallery.html             # Photo/video masonry grid
  game.html                # Preparedness trivia game
  dashboard.html           # Staff dashboard (claim/answer questions)
  upload.html              # Media upload (coordinator+)
  manage-events.html       # Event creation (coordinator+)
  profile.html             # User profile
  contact.html             # Contact form
  volunteer.html           # Volunteer information
  donate.html              # Donation page
  programs.html            # CERT/PACT/coordinator programs
  resources.html           # Preparedness resources
  statistics.html          # Community statistics
  community.html           # Community hub
  connect.html             # Connect hub
  prepare.html             # Prepare hub
```

## Design System

Colors defined in `_sass/_variables.scss`:

| Token | Hex | Usage |
|---|---|---|
| `$color-navy` | `#0a1628` | Primary brand, hero, navbar |
| `$color-red` | `#c0392b` | Accent, CTA, danger |
| `$color-amber` | `#e67e22` | Warning, moderate risk |
| `$color-green` | `#27ae60` | Success, low risk |
| `$color-warm-white` | `#f8f5f0` | Page background |

Breakpoints: 375px (mobile), 768px (tablet), 1200px (desktop max-width).

## Architecture Patterns

**SRP (Single Responsibility Principle):** Every JS function does exactly one thing. Functions are documented with Purpose, @param, @returns, and Algorithm steps.

**Orchestrator / Worker separation:**
- `pages/` — orchestrators coordinate the page lifecycle (fetch → render → bind)
- `api/` — workers fetch data, return Promises, no DOM
- `ui/` — workers render DOM from data, no fetch

**Role-based gating:** Pages with restricted access call `fetchCurrentUser()` on load and render `renderAccessDenied()` if the user's role is insufficient. Roles: `resident` → `coordinator` → `staff` → `admin`.

## Image Placeholders

See `assets/images/README.md` for the full list of images that need real PNEC photos.
