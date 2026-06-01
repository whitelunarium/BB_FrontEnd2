# PNEC — Poway Neighborhood Emergency Corps · Frontend

Public-facing website for the **Poway Neighborhood Emergency Corps (PNEC)**, an all-volunteer 501(c)(3) community emergency preparedness organization in Poway, CA (established 2011).

PNEC trains residents, coordinates volunteers, and connects neighborhoods so that communities can respond effectively to disasters and emergencies. This site is the organization's primary digital hub: residents can access preparedness resources, check neighborhood maps, browse events, and connect with local coordinators. Staff and coordinators have additional tools for managing content and responding to community questions.

Built with Jekyll and hosted on GitHub Pages, backed by a Flask API.

Live site: **[Link]([https://powaynec.com](https://pnec.opencodingsociety.com))**

Made by Ethan Patel, Aneesh Deevi, Samarth Vaka.

**NOT AN ACTIVE FORK**
---

## Tech Stack

| Layer | Technology |
|---|---|
| Site generator | Jekyll / GitHub Pages |
| Templating | Liquid + HTML |
| Styling | SCSS (compiled by Jekyll) |
| JavaScript | Vanilla ES6+ (ES modules, no framework) |
| Maps | Leaflet.js |
| Backend API | Flask |

---

## What We Built

**For residents:**
- View a Risk Watch that will inform the users about current weather conditions
- A login system
- View an interactive neighborhood map powered by Leaflet.js
- Ask preparedness questions via the AI FAQ chatbot

**For coordinators and staff:**
- Organize members by volunteers and residents
- Make live edits to website content

---

## Project Structure

```
Beasts_FrontEnd/
│
├── _layouts/
│   └── pnec-base.html           # Base layout — all PNEC pages use this
│
├── _includes/
│   ├── nav/navbar.html          # PNEC navbar (desktop + mobile drawer)
│   ├── footer.html              # PNEC footer
│   └── chatbot/                 # FAQ chatbot widget HTML
│
├── _sass/
│   ├── _variables.scss          # Design tokens (colors, spacing, type)
│   ├── _layout.scss             # Global body, container, section utilities
│   ├── _components.scss         # Buttons, cards, badges, modals, alerts, forms
│   ├── _nav.scss                # Navbar + mobile drawer styles
│   ├── _footer.scss             # Footer styles
│   ├── _homepage.scss           # Homepage-specific sections (hero, risk widget, etc.)
│   ├── _pages.scss              # Page-specific styles (auth, kit, map, gallery, game, dashboard)
│   └── main.scss                # Root SCSS — imports all partials
│
├── assets/
│   └── js/
│       ├── utils/errors.js      # API_BASE, escapeHtml, validateResponse (loaded on all pages)
│       ├── api/                 # Worker files — fetch only, no DOM
│       │   ├── auth-api.js      # login, register, logout, me, fetchNeighborhoodsForSelect
│       │   ├── faq-api.js       # FAQ categories, items, search, helpful, question submit/claim/answer
│       │   ├── events-api.js    # fetchEvents, fetchEventsForMonth, createEvent, fetchMediaPosts, uploadMediaPost
│       │   ├── risk-api.js      # fetchRiskAssessment
│       │   ├── neighborhood-api.js  # fetchNeighborhoods, fetchNeighborhoodDetail
│       │   └── game-api.js      # fetchGameQuestions, submitGameScore
│       ├── ui/                  # Worker files — DOM manipulation only, no fetch
│       │   ├── auth-ui.js       # renderAccessDenied, updateNavbarAuth
│       │   ├── chatbot-ui.js    # Chatbot widget rendering
│       │   ├── kit-ui.js        # Kit checklist rendering
│       │   ├── map-ui.js        # Leaflet map rendering
│       │   └── risk-ui.js       # Risk card rendering
│       └── pages/               # Orchestrator files — coordinate workers
│           ├── navbar.js        # Navbar state (auth, mobile menu, dropdowns)
│           ├── chatbot.js       # FAQ chatbot orchestrator
│           ├── risk-widget.js   # Homepage risk widget orchestrator
│           ├── login-page.js    # Login form orchestrator
│           ├── register-page.js # Registration form orchestrator
│           ├── neighborhood-map.js  # Neighborhood map orchestrator
│           ├── kit.js           # 72-hour kit orchestrator
│           ├── game.js          # Preparedness game orchestrator
│           ├── gallery-page.js  # Gallery page orchestrator
│           ├── events-page.js   # Events/calendar orchestrator
│           └── dashboard-page.js    # Staff dashboard orchestrator
│
└── pages/
    ├── login.html               # Sign in
    ├── register.html            # Create account
    ├── kit.html                 # 72-Hour Kit Checklist (localStorage persistence)
    ├── neighborhood-map.html    # Leaflet interactive map
    ├── events.html              # Calendar + list view
    ├── gallery.html             # Photo/video masonry grid
    ├── game.html                # Preparedness trivia game
    ├── dashboard.html           # Staff dashboard (claim/answer questions)
    ├── upload.html              # Media upload (coordinator+)
    ├── manage-events.html       # Event creation (coordinator+)
    ├── profile.html             # User profile
    ├── contact.html             # Contact form
    ├── volunteer.html           # Volunteer information
    ├── donate.html              # Donation page
    ├── programs.html            # CERT/PACT/coordinator programs
    ├── resources.html           # Preparedness resources
    ├── statistics.html          # Community statistics
    ├── community.html           # Community hub
    ├── connect.html             # Connect hub
    └── prepare.html             # Prepare hub
```

---

## Local Development

**Prerequisites:** Ruby 3+, Bundler

```bash
cd Beasts_FrontEnd
bundle install
make clean
make dev
```

Site is available at `http://localhost:4000`. The Flask backend must be running separately for API-dependent features (auth, chatbot, events, etc.). The API base URL is configured in `assets/js/utils/errors.js`.

---

## Pages & Routes

| Route | Page | Notes |
|---|---|---|
| `/` | Home | Hero, risk widget, preparedness overview |
| `/login` | Sign In | JWT auth |
| `/register` | Create Account | Role assigned on signup |
| `/kit` | 72-Hour Kit Checklist | localStorage persistence |
| `/neighborhood-map` | Interactive Map | Leaflet.js |
| `/events` | Events Calendar | Calendar + list view |
| `/dashboard` | Staff Dashboard | Claim/answer FAQ questions (staff+) |
| `/profile` | User Profile | — |
| `/contact` | Contact Form | — |
| `/volunteer` | Volunteer Info | — |
| `/donate` | Donation Page | — |
| `/resources` | Preparedness Resources | — |

---

## Layouts

### pnec-base.html — Master Layout

The primary layout for all PNEC pages. Contains:

- Navbar with desktop and mobile drawer (`_includes/nav/navbar.html`)
- Full SCSS design system with custom tokens (`$color-navy`, `$color-red`, etc.)
- FAQ chatbot widget (`_includes/chatbot/`)
- Footer (`_includes/footer.html`)

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

**Breakpoints:** 375px (mobile) · 768px (tablet) · 1200px (desktop max-width)

---

## JavaScript Architecture

The JS layer follows a strict **Orchestrator / Worker** pattern with Single Responsibility Principle throughout. Every function does exactly one thing and is documented with its purpose, parameters, return value, and algorithm steps.

**Workers** are specialized and never cross concerns:
- `api/` workers — fetch data from the Flask API, return Promises, touch no DOM
- `ui/` workers — render DOM from data, make no network calls

**Orchestrators** (`pages/`) coordinate the full page lifecycle: fetch data via API workers → render via UI workers → bind event listeners.

---

## Role-Based Access

Role-based access is enforced on restricted pages by calling `fetchCurrentUser()` on load. If the user's role is insufficient, `renderAccessDenied()` is rendered instead of the page content.

Role hierarchy: `resident` → `coordinator` → `staff` → `admin`

---

## Backend API Configuration

The frontend talks to the Flask backend at `http://127.0.0.1:8425` in development. The base URL is set in `assets/js/utils/errors.js` — update this if running the backend at a different address or deploying to production.
