# PNEC Frontend — Poway Neighborhood Emergency Corps

Made by Ethan Patel, Aneesh Deevi, Samarth Vaka

**[powaynec.com](https://powaynec.com)** — Public website for the Poway Neighborhood Emergency Corps (PNEC), a community emergency preparedness organization serving Poway, CA since 1995.

PNEC trains residents, coordinates volunteers, and connects neighborhoods so that communities can respond effectively to disasters and emergencies. This site is the organization's primary digital hub: residents can access preparedness resources, check neighborhood maps, browse events, and connect with local coordinators. Staff and coordinators have additional tools for managing content and responding to community questions.

Built as a Jekyll / GitHub Pages static site backed by a Flask API.

---

## What the Site Does

**For residents:**
- Browse emergency preparedness resources and checklists
- Build and track a personalized 72-hour emergency kit
- View an interactive neighborhood map
- Browse and RSVP to community events and CERT/PACT programs
- Ask preparedness questions via the FAQ chatbot
- Play a preparedness trivia game
- View community photos and media

**For coordinators and staff:**
- Organize members by volunteers and residents
- Live edits to website
- Role-gated access based on trust level (`resident` → `coordinator` → `staff` → `admin`)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Static site | Jekyll / GitHub Pages |
| Styles | SCSS (compiled by Jekyll) |
| JavaScript | Vanilla JS (ES modules, no framework) |
| Maps | Leaflet.js |
| Backend API | Flask (runs separately at `http://127.0.0.1:8425`) |

---

## Local Setup

**Prerequisites:** Ruby 3+, Bundler

```bash
cd Beasts_FrontEnd
bundle install
make clean
make dev
```

Site available at `http://localhost:4000`. The Flask backend must be running separately for API-dependent features (auth, chatbot, events, etc.). The API base URL is configured in `assets/js/utils/errors.js`.

---

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
    api/                   # Worker files — fetch only, no DOM
      auth-api.js          # login, register, logout, me, fetchNeighborhoodsForSelect
      faq-api.js           # FAQ categories, items, search, helpful, question submit/claim/answer
      events-api.js        # fetchEvents, fetchEventsForMonth, createEvent, fetchMediaPosts, uploadMediaPost
      risk-api.js          # fetchRiskAssessment
      neighborhood-api.js  # fetchNeighborhoods, fetchNeighborhoodDetail
      game-api.js          # fetchGameQuestions, submitGameScore
    ui/                    # Worker files — DOM manipulation only, no fetch
      auth-ui.js           # renderAccessDenied, updateNavbarAuth
      chatbot-ui.js        # Chatbot widget rendering
      kit-ui.js            # Kit checklist rendering
      map-ui.js            # Leaflet map rendering
      risk-ui.js           # Risk card rendering
    pages/                 # Orchestrator files — coordinate workers
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

---

## Design System

Colors are defined in `_sass/_variables.scss`:

| Token | Hex | Usage |
|---|---|---|
| `$color-navy` | `#0a1628` | Primary brand, hero, navbar |
| `$color-red` | `#c0392b` | Accent, CTA, danger |
| `$color-amber` | `#e67e22` | Warning, moderate risk |
| `$color-green` | `#27ae60` | Success, low risk |
| `$color-warm-white` | `#f8f5f0` | Page background |

Breakpoints: 375px (mobile), 768px (tablet), 1200px (desktop max-width).

---

## JavaScript Architecture

The JS layer follows a strict **Orchestrator / Worker** pattern with Single Responsibility Principle throughout.

Every function does exactly one thing and is documented with its purpose, parameters, return value, and algorithm steps.

**Workers** are specialized and never cross concerns:
- `api/` workers — fetch data from the Flask API, return Promises, touch no DOM
- `ui/` workers — render DOM from data, make no network calls

**Orchestrators** (`pages/`) coordinate the full page lifecycle: fetch data via API workers → render via UI workers → bind event listeners.

**Role-based access** is enforced on restricted pages by calling `fetchCurrentUser()` on load. If the user's role is insufficient, `renderAccessDenied()` is rendered instead of the page content. Role hierarchy: `resident` → `coordinator` → `staff` → `admin`.

---

## Images

See `assets/images/README.md` for the full list of placeholder images that need real PNEC photos.