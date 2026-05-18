// assets/js/chatbot/tools.js
// PNEC Helper Bot v3 — Phase 2 intelligence layer.
//
// What this module does:
//   1. parseToolCalls(text) — pulls JSON tool blocks out of an LLM
//      response. The system prompt teaches the model to emit lines
//      like {"tool":"navigate_to","args":{"slug":"events"},"reason":"..."}
//      We extract them, leave a clean user-facing reply, and turn each
//      tool call into a structured object the controller renders as
//      an inline action card.
//
//   2. parseCitations(text) — finds [FAQ#42] and [News: KPBS] markers
//      in the assistant text and turns them into citation pills.
//
//   3. executeFromCard(bot, cardEl, action) — handles user clicks on
//      tool-call confirm/cancel buttons. Each tool has a dispatcher
//      that runs client-side (navigate, search news, get risk, find
//      event, submit to staff) and writes the result back into the
//      card.
//
// All tools fail gracefully — if a backend endpoint isn't there, the
// card just shows a friendly "I couldn't reach the server" line.

import {
  searchNews, getRiskNow, submitToStaff, fetchAllFaq, getLiveConditions,
  findNeighborhoodByQuery, getPowayNeighborhoods
} from './api.js';
import { renderMarkdown, _escape } from './render.js';
import { updateMessage, getCachedUser, getActiveConversation } from './store.js';

const TOOL_DEFS = {
  navigate_to: {
    title: 'Navigate to a page',
    confirmLabel: 'Open page',
    body: (args) => `Take you to **${slugLabel(args.slug)}** in this tab.`,
  },
  search_news: {
    title: 'Search recent news',
    confirmLabel: 'Search',
    body: (args) => `Run a live news search for **${args.query}**.`,
  },
  get_risk_now: {
    title: "Today's Poway risk",
    confirmLabel: 'Show risk',
    body: () => `Pull the current PNEC risk indicators (wildfire, wind, heat).`,
  },
  submit_to_staff: {
    title: 'Send a question to PNEC staff',
    confirmLabel: 'Send',
    body: (args) => `Forward your question to a PNEC volunteer:\n\n> ${(args.question || '').slice(0, 220)}`,
  },
  find_event: {
    title: 'Find a community event',
    confirmLabel: 'Find events',
    body: (args) => `Look for ${args.type || 'community'} events ${args.when ? 'in ' + args.when : 'coming up'}.`,
  },
  get_live_conditions: {
    title: 'Live Poway conditions',
    confirmLabel: 'Get live data',
    body: () => `Pull right-now Poway weather, AQI, fire-weather index, and active NWS alerts.`,
  },
  find_neighborhood: {
    title: 'Find a Poway neighborhood',
    confirmLabel: 'Look up',
    body: (args) => `Look up the Poway neighborhood for **${args.query || 'your address'}** with evac route + how to reach the NEC.`,
  },
};

// ─── Page registry (single source of truth) ──────────────────────
// Canonical slug → { href, label }. href accounts for custom Jekyll
// permalinks (donate → /donation-form/, role-quiz → /role-quiz/);
// everything else is a real /pages/<file>.html that exists in the repo.
const PAGES = {
  'home':                            { href: '/',                                          label: 'the home page' },
  'about':                           { href: '/pages/about.html',                          label: 'the About page' },
  'programs-and-services':           { href: '/pages/programs-and-services.html',           label: 'Programs & Services' },
  'preparedness-resources':          { href: '/pages/preparedness-resources.html',          label: 'Preparedness Resources' },
  'community-events-and-activities': { href: '/pages/community-events-and-activities.html',  label: 'Community Events' },
  'find-your-neighborhood':          { href: '/pages/find-your-neighborhood.html',          label: 'Find Your Neighborhood' },
  'contact':                         { href: '/pages/contact.html',                         label: 'the Contact page' },
  'volunteer':                       { href: '/pages/volunteer.html',                       label: 'the Volunteer page' },
  'donate':                          { href: '/donation-form/',                             label: 'the Donate page' },
  'checklist':                       { href: '/pages/checklist.html',                       label: 'the Preparedness Checklist' },
  'kit':                             { href: '/pages/kit.html',                             label: 'the 72-Hour Kit page' },
  'gallery':                         { href: '/pages/gallery.html',                         label: 'the Photo Gallery' },
  'blog':                            { href: '/pages/blog.html',                            label: 'the Blog' },
  'poway-statistics-and-information':{ href: '/pages/poway-statistics-and-information.html', label: 'Poway Statistics & Information' },
  'role-quiz':                       { href: '/role-quiz/',                                 label: 'the Role Quiz' },
  'profile':                         { href: '/pages/profile.html',                         label: 'your Profile' },
  'dashboard':                       { href: '/pages/dashboard.html',                       label: 'your Dashboard' },
  'register':                        { href: '/pages/register.html',                        label: 'the sign-in page' },
  'privacy':                         { href: '/pages/privacy.html',                         label: 'the Privacy page' },
  'admin':                           { href: '/pages/admin.html',                           label: 'the Admin Hub' },
};

// Raw label / synonym (normalized) → canonical slug. Covers the
// human-readable nav labels the LLM tends to emit verbatim
// ("programs and services" → "programs-and-services") plus common
// synonyms, so navigate_to can never build a 404 URL.
const SLUG_ALIASES = {
  '':                          'home',
  'index':                     'home',
  'homepage':                  'home',
  'main':                      'home',
  'programs':                  'programs-and-services',
  'services':                  'programs-and-services',
  'programs-services':         'programs-and-services',
  'programs-and-service':      'programs-and-services',
  'preparedness':              'preparedness-resources',
  'preparedness-and-help':     'preparedness-resources',
  'preparedness-help':         'preparedness-resources',
  'resources':                 'preparedness-resources',
  'help':                      'preparedness-resources',
  'events':                    'community-events-and-activities',
  'community-events':          'community-events-and-activities',
  'community-events-and-activity': 'community-events-and-activities',
  'calendar':                  'community-events-and-activities',
  'neighborhood':              'find-your-neighborhood',
  'neighborhoods':             'find-your-neighborhood',
  'find-neighborhood':         'find-your-neighborhood',
  'find-your-neighborhoods':   'find-your-neighborhood',
  'map':                       'find-your-neighborhood',
  'coordinator':               'find-your-neighborhood',
  'sign-in':                   'register',
  'signin':                    'register',
  'login':                     'register',
  'log-in':                    'register',
  'sign-up':                   'register',
  'signup':                    'register',
  'sign-in-page':              'register',
  'stats':                     'poway-statistics-and-information',
  'statistics':                'poway-statistics-and-information',
  'poway-statistics':          'poway-statistics-and-information',
  'data':                      'poway-statistics-and-information',
  'donation':                  'donate',
  'donation-form':             'donate',
  'give':                      'donate',
  'quiz':                      'role-quiz',
  'role':                      'role-quiz',
  'feedback':                  'contact',
  'contact-us':                'contact',
  'support':                   'contact',
  'photos':                    'gallery',
  'photo-gallery':             'gallery',
  '72-hour-kit':               'kit',
  'go-bag':                    'kit',
  'checklists':                'checklist',
};

// Normalize whatever the LLM emitted into a bare slug token:
// lowercase, drop a leading /pages/ or /, drop query/hash, drop a
// trailing .html, turn "&"→"and" and spaces/underscores/plus → "-".
function normalizeSlugToken(raw) {
  return String(raw == null ? '' : raw)
    .toLowerCase()
    .trim()
    .replace(/[?#].*$/, '')
    .replace(/^\/+/, '')
    .replace(/^pages\//, '')
    .replace(/\.html?$/, '')
    .replace(/\/+$/, '')
    .replace(/&/g, ' and ')
    .replace(/[\s_+]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// Resolve any input to a canonical slug in PAGES, or null if unknown.
function resolveSlug(raw) {
  const t = normalizeSlugToken(raw);
  if (Object.prototype.hasOwnProperty.call(PAGES, t)) return t;
  const aliased = SLUG_ALIASES[t];
  if (aliased && Object.prototype.hasOwnProperty.call(PAGES, aliased)) return aliased;
  return null;
}

export function slugLabel(slug) {
  const canon = resolveSlug(slug);
  if (canon) return PAGES[canon].label;
  const t = normalizeSlugToken(slug);
  if (!t) return 'that page';
  // unknown but readable: "the foo bar page"
  return `the ${t.replace(/-/g, ' ')} page`;
}

export function slugToHref(slug) {
  const canon = resolveSlug(slug);
  if (canon) return PAGES[canon].href;
  // Unknown slug: never fabricate a /pages/<spaces>.html 404 — send
  // the user somewhere real.
  return '/';
}

// ─── Parsing ──────────────────────────────────────────────────────

// Regex for JSON tool block (single-line). The LLM is instructed to
// emit one block per line, e.g.
//   {"tool":"navigate_to","args":{"slug":"events"},"reason":"User wants to see events"}
// We accept the block on its own line OR inside a fenced ```json block.
const TOOL_LINE_RE = /^\s*(\{[^\n]*"tool"\s*:\s*"[a-z_]+"[^\n]*\})\s*$/m;
const TOOL_FENCE_RE = /```(?:json)?\s*(\{[\s\S]*?"tool"\s*:[\s\S]*?\})\s*```/g;

let _idCounter = 0;
function nextId() { return 'tc-' + Date.now().toString(36) + '-' + (_idCounter++); }

export function parseToolCalls(text) {
  if (!text || typeof text !== 'string') return { cleanText: text, toolCalls: null };
  const found = [];
  let clean = text;

  // Fenced blocks first
  clean = clean.replace(TOOL_FENCE_RE, (whole, body) => {
    const tc = tryParseTC(body);
    if (tc) { found.push(tc); return ''; }
    return whole;
  });

  // Single-line blocks
  while (true) {
    const m = TOOL_LINE_RE.exec(clean);
    if (!m) break;
    const tc = tryParseTC(m[1]);
    if (tc) {
      found.push(tc);
      clean = clean.slice(0, m.index) + clean.slice(m.index + m[0].length);
    } else {
      // Couldn't parse — strip the offending line and continue
      clean = clean.slice(0, m.index) + clean.slice(m.index + m[0].length);
    }
  }

  // Tidy whitespace
  clean = clean.replace(/\n{3,}/g, '\n\n').trim();

  if (!found.length) return { cleanText: clean, toolCalls: null };
  return { cleanText: clean, toolCalls: found };
}

function tryParseTC(s) {
  try {
    const obj = JSON.parse(s);
    if (!obj || typeof obj.tool !== 'string') return null;
    const def = TOOL_DEFS[obj.tool];
    if (!def) return null;
    const args = obj.args || {};
    return {
      id: nextId(),
      tool: obj.tool,
      args,
      title: def.title,
      body: typeof def.body === 'function' ? def.body(args) : (def.body || obj.reason || ''),
      confirmLabel: def.confirmLabel || 'Confirm',
      status: 'pending',
      result: null,
    };
  } catch (_e) { return null; }
}

// ─── Citations ────────────────────────────────────────────────────

const FAQ_CITE_RE = /\[FAQ#(\d+)\]/gi;
const NEWS_CITE_RE = /\[News:\s*([^\]]+)\]/gi;

export function parseCitations(text) {
  if (!text || typeof text !== 'string') return null;
  const cites = [];
  const seen = new Set();

  let m;
  FAQ_CITE_RE.lastIndex = 0;
  while ((m = FAQ_CITE_RE.exec(text)) !== null) {
    const id = m[1];
    const key = 'faq:' + id;
    if (seen.has(key)) continue;
    seen.add(key);
    cites.push({ kind: 'faq', label: `FAQ #${id}`, faqId: id, url: `/pages/preparedness-resources.html?faq=${id}` });
  }
  NEWS_CITE_RE.lastIndex = 0;
  while ((m = NEWS_CITE_RE.exec(text)) !== null) {
    const src = m[1].trim();
    const key = 'news:' + src.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cites.push({ kind: 'news', label: src, url: `https://www.google.com/search?q=${encodeURIComponent(src + ' Poway')}` });
  }
  return cites.length ? cites : null;
}

// ─── Execution from action-card buttons ───────────────────────────

export async function executeFromCard(bot, cardEl, action) {
  const tcId = cardEl?.dataset.toolCallId;
  if (!tcId) return;

  // Find the message that owns this card so we can update it
  const msgEl = cardEl.closest('[data-msg-id]');
  if (!msgEl) return;
  const msgId = msgEl.dataset.msgId;
  const convo = getActiveConversation();
  if (!convo) return;
  const msg = convo.messages.find(m => m.id === msgId);
  if (!msg || !Array.isArray(msg.toolCalls)) return;
  const tc = msg.toolCalls.find(t => t.id === tcId);
  if (!tc) return;

  if (action === 'cancel') {
    tc.status = 'cancelled';
    tc.result = { text: '_Cancelled._' };
    persistAndRerender(bot, msg);
    return;
  }

  if (action === 'confirm') {
    tc.status = 'running';
    tc.result = { text: '_Working…_' };
    persistAndRerender(bot, msg);

    try {
      const res = await dispatchTool(tc, bot);
      tc.status = 'done';
      tc.result = res;
    } catch (e) {
      tc.status = 'done';
      tc.result = { text: `_Couldn't complete that — ${(e && e.message) || 'unknown error'}._` };
    }
    persistAndRerender(bot, msg);
  }
}

function persistAndRerender(bot, msg) {
  updateMessage(bot.activeConversationId, msg.id, { toolCalls: msg.toolCalls });
  // Re-render the message in place
  const userInitials = bot._userInitials();
  // dynamic import to avoid circular reference
  import('./render.js').then(({ buildMessageEl }) => {
    const node = bot.dom.transcript.querySelector(`[data-msg-id="${msg.id}"]`);
    if (node) node.replaceWith(buildMessageEl(msg, { userInitials }));
  });
}

// ─── Tool dispatchers ─────────────────────────────────────────────

async function dispatchTool(tc, bot) {
  switch (tc.tool) {
    case 'navigate_to':         return await tool_navigateTo(tc.args, bot);
    case 'search_news':         return await tool_searchNews(tc.args);
    case 'get_risk_now':        return await tool_getRisk();
    case 'submit_to_staff':     return await tool_submitToStaff(tc.args, bot);
    case 'find_event':          return await tool_findEvent(tc.args);
    case 'get_live_conditions': return await tool_getLiveConditions();
    case 'find_neighborhood':   return await tool_findNeighborhood(tc.args);
    default:
      return { text: `_Unknown tool: ${tc.tool}_` };
  }
}

async function tool_findNeighborhood(args) {
  const q = (args && args.query || '').trim();
  if (!q) return { text: `_I need a neighborhood name, street, or number to look up._` };
  const matches = await findNeighborhoodByQuery(q);
  if (!matches.length) {
    return {
      html: `
        <div class="pnec-bot-data-card">
          <span class="pnec-bot-data-card-eyebrow">No match</span>
          <h5 class="pnec-bot-data-card-title">"${_escape(q)}" didn't match a Poway neighborhood</h5>
          <p class="pnec-bot-data-card-body">Try a street name (Espola, Garden, Twin Peaks), the neighborhood name (Old Coach, Highlands Ranch), or a number 1–60.</p>
          <a href="/pages/find-your-neighborhood.html" target="_blank">Browse all 60 neighborhoods →</a>
        </div>`
    };
  }
  const top = matches[0];
  const wuiBadge = top.wui ? ` <span style="background:#c0392b;color:#fff;padding:1px 7px;border-radius:4px;font-size:0.7rem;font-weight:700;letter-spacing:0.04em;">WUI</span>` : '';
  const fhszBadge = top.fhsz ? ` <span style="background:${top.fhsz === 'Very High' ? '#c0392b' : top.fhsz === 'High' ? '#e07a3f' : '#d4a04c'};color:#fff;padding:1px 7px;border-radius:4px;font-size:0.7rem;font-weight:700;letter-spacing:0.04em;">${_escape(top.fhsz)} FHSZ</span>` : '';

  const fs = top.nearest_fire_station;
  const hp = top.nearest_hospital;
  const cc = top.nearest_cooling_center;
  const qc = top.quick_contacts || {};

  const altsHtml = matches.length > 1
    ? `<p class="pnec-bot-data-card-body" style="margin-top:8px;font-size:0.84em;color:#5a6470;">Other matches: ${matches.slice(1, 5).map(m => `<a href="/pages/find-your-neighborhood.html#n${m.number}">#${m.number} ${_escape(m.name)}</a>`).join(', ')}</p>`
    : '';

  return {
    html: `
      <div class="pnec-bot-data-card">
        <span class="pnec-bot-data-card-eyebrow">Neighborhood #${_escape(String(top.number))} · Zone ${_escape(top.zone || '?')}${wuiBadge}${fhszBadge}</span>
        <h5 class="pnec-bot-data-card-title">${_escape(top.name)}</h5>

        ${top.evac_guidance ? `<p class="pnec-bot-data-card-body" style="margin-top:8px;"><strong>🧭 Evac:</strong> ${_escape(top.evac_guidance)}</p>` : ''}
        ${top.fhsz_advice ? `<p class="pnec-bot-data-card-body" style="margin-top:6px;font-size:0.86em;"><strong>🔥 ${_escape(top.fhsz)} fire-hazard:</strong> ${_escape(top.fhsz_advice)}</p>` : ''}

        ${fs ? `<p class="pnec-bot-data-card-body" style="margin-top:6px;font-size:0.86em;"><strong>🚒 Fire station:</strong> ${_escape(fs.name)} — ${_escape(fs.address)}. Non-emergency <a href="tel:${(fs.phone_non_emergency || '').replace(/[^\\d]/g,'')}">${_escape(fs.phone_non_emergency || '')}</a>; emergency <a href="tel:911">911</a>.</p>` : ''}
        ${hp ? `<p class="pnec-bot-data-card-body" style="margin-top:6px;font-size:0.86em;"><strong>🏥 ER:</strong> ${_escape(hp.name)} — ${_escape(hp.address)}, <a href="tel:${(hp.phone || '').replace(/[^\\d]/g,'')}">${_escape(hp.phone || '')}</a>.</p>` : ''}
        ${cc ? `<p class="pnec-bot-data-card-body" style="margin-top:6px;font-size:0.86em;"><strong>❄️ Cooling center:</strong> ${_escape(cc.name)} — ${_escape(cc.address)}, <a href="tel:${(cc.phone || '').replace(/[^\\d]/g,'')}">${_escape(cc.phone || '')}</a>.</p>` : ''}

        <p class="pnec-bot-data-card-body" style="margin-top:8px;"><strong>📞 NEC + ham operator:</strong> PNEC sends coordinator contact by email (privacy). Email <a href="mailto:powaynec@gmail.com?subject=NEC%20contact%20request%20%E2%80%94%20neighborhood%20${top.number}">powaynec@gmail.com</a> — subject pre-filled with neighborhood <strong>#${top.number}</strong>. Reply within 1–2 days.</p>

        ${qc.pnec_homebound ? `<p class="pnec-bot-data-card-body" style="margin-top:6px;font-size:0.86em;"><strong>Homebound helpline:</strong> <a href="tel:${qc.pnec_homebound.replace(/[^\\d]/g,'')}">${_escape(qc.pnec_homebound)}</a> · <strong>SD Sheriff non-emergency:</strong> <a href="tel:${(qc.sheriff_non_emergency || '').replace(/[^\\d]/g,'')}">${_escape(qc.sheriff_non_emergency || '')}</a></p>` : ''}

        ${altsHtml}
        <a href="/pages/find-your-neighborhood.html#n${top.number}" target="_blank" style="margin-top:10px;display:inline-block;font-weight:700;">Open on the interactive map →</a>
      </div>`
  };
}

async function tool_getLiveConditions() {
  const live = await getLiveConditions();
  if (!live || !live.ok) return { text: `_Live conditions service is offline right now. Try again in a minute._` };
  const w = live.weather || {};
  const a = live.air_quality || {};
  const f = live.fire_weather || {};
  const aqiCat = a.us_aqi == null ? 'unknown' :
    a.us_aqi <= 50 ? 'Good' : a.us_aqi <= 100 ? 'Moderate' :
    a.us_aqi <= 150 ? 'Unhealthy for Sensitive Groups' :
    a.us_aqi <= 200 ? 'Unhealthy' : a.us_aqi <= 300 ? 'Very Unhealthy' : 'Hazardous';
  const alerts = Array.isArray(live.alerts) ? live.alerts : [];
  const alertHtml = alerts.length
    ? `<ul style="margin:8px 0 0; padding-left:18px;">${alerts.slice(0, 3).map(al =>
        `<li><strong>${_escape(al.event || 'Alert')}</strong>${al.severity ? ` — ${_escape(al.severity)}` : ''}${al.headline ? `<br><span style="font-size:0.86em;">${_escape(al.headline.slice(0, 140))}</span>` : ''}</li>`
       ).join('')}</ul>`
    : `<p class="pnec-bot-data-card-body" style="margin-top:6px;">No active NWS alerts for San Diego County.</p>`;
  return {
    html: `
      <div class="pnec-bot-data-card">
        <span class="pnec-bot-data-card-eyebrow">Live Poway conditions</span>
        <h5 class="pnec-bot-data-card-title">${_escape(f.label || 'Conditions')} • Fire-weather ${f.score ?? '?'}/10</h5>
        <p class="pnec-bot-data-card-body">
          <strong>${_escape(String(w.temp_f ?? '?'))}°F</strong> &middot;
          ${_escape(String(w.humidity ?? '?'))}% RH &middot;
          ${_escape(String(w.wind_mph ?? '?'))} mph wind<br>
          <strong>AQI ${_escape(String(a.us_aqi ?? '?'))}</strong> (${_escape(aqiCat)})
        </p>
        ${alertHtml}
        ${live.recommendation ? `<p class="pnec-bot-data-card-body" style="margin-top:8px; font-style:italic;">${_escape(live.recommendation)}</p>` : ''}
      </div>`
  };
}

async function tool_navigateTo(args, _bot) {
  const raw   = args.slug || '';
  const canon = resolveSlug(raw);
  const href  = canon ? PAGES[canon].href : '/';
  setTimeout(() => { window.location.assign(href); }, 280);
  if (canon) return { text: `Heading to **${PAGES[canon].label}**…` };
  return {
    text: `I couldn't find a page for "${_escape(String(raw).trim())}", so I'm taking you to the home page — use the top menu to find what you need.`
  };
}

async function tool_searchNews(args) {
  const q = (args.query || 'Poway emergency').trim();
  const items = await searchNews(q);
  if (!items.length) return { text: `_No live news matched "${_escape(q)}". Try a broader query._` };
  const html = items.slice(0, 4).map(a => {
    const title = (a.title || a.headline || '').trim();
    const desc  = (a.description || a.summary || a.snippet || '').trim();
    const src   = a.source || a.publisher || a.site || 'news';
    const url   = a.url || a.link || '#';
    return `
      <div class="pnec-bot-data-card">
        <span class="pnec-bot-data-card-eyebrow">${_escape(src)}</span>
        <h5 class="pnec-bot-data-card-title">${_escape(title)}</h5>
        <p class="pnec-bot-data-card-body">${_escape(desc.slice(0, 200))}</p>
        <a href="${url}" target="_blank" rel="noopener noreferrer">Read more →</a>
      </div>`;
  }).join('');
  return { html };
}

async function tool_getRisk() {
  const risk = await getRiskNow();
  if (!risk) return { text: `_Risk data isn't loading right now. Try the Preparedness page directly._` };
  const lvl   = risk.level || risk.risk_level || risk.label || 'Unknown';
  const desc  = risk.description || risk.summary || '';
  const items = Array.isArray(risk.factors) ? risk.factors :
                Array.isArray(risk.indicators) ? risk.indicators : [];
  const factorsHtml = items.length
    ? `<ul style="margin:6px 0 0; padding-left:18px;">${items.slice(0, 5).map(f => `<li>${_escape(f.label || f.name || f)}: <strong>${_escape(f.value || f.level || '')}</strong></li>`).join('')}</ul>`
    : '';
  return {
    html: `
      <div class="pnec-bot-data-card">
        <span class="pnec-bot-data-card-eyebrow">Current Poway risk</span>
        <h5 class="pnec-bot-data-card-title">${_escape(lvl)}</h5>
        ${desc ? `<p class="pnec-bot-data-card-body">${_escape(desc)}</p>` : ''}
        ${factorsHtml}
        <a href="/pages/preparedness-resources.html#local-risk" target="_blank">Full risk page →</a>
      </div>`
  };
}

async function tool_submitToStaff(args, _bot) {
  const u = getCachedUser() || {};
  const name = u.display_name || 'Helper Bot user';
  const email = u.email || '';
  const question = (args.question || '').trim();
  if (!email) return { text: `I'd love to send this to staff, but you'll need to **sign in** first so they can reply.` };
  if (!question) return { text: `_No question text provided._` };
  try {
    await submitToStaff({ name, email, question, context: 'Helper Bot v3' });
    return { text: `✅ Sent to a PNEC volunteer. Expect a reply within 1–2 days at **${email}**.` };
  } catch (e) {
    return { text: `_Couldn't send — ${(e && e.message) || 'try again later'}._ You can also use the contact form at /pages/contact.html.` };
  }
}

async function tool_findEvent(args) {
  // Phase 4 hooks a real /api/events endpoint; for now redirect.
  const when = (args.when || '').trim();
  return {
    html: `
      <div class="pnec-bot-data-card">
        <span class="pnec-bot-data-card-eyebrow">Community events</span>
        <h5 class="pnec-bot-data-card-title">${when ? _escape(when) + ' — see calendar' : 'Upcoming events calendar'}</h5>
        <p class="pnec-bot-data-card-body">PNEC publishes drills, fairs, and trainings on the Community Events page.</p>
        <a href="/pages/community-events-and-activities.html" target="_blank">Open calendar →</a>
      </div>`
  };
}

// ─── Intent classifier (lightweight, client-side) ─────────────────
//
// The LLM does the heavy lifting via tool-calling, but we add a tiny
// classifier so the controller can short-circuit obvious cases like
// "open the events page" without round-tripping to Gemini at all.
// Phase 1 keyword approach kept simple — good enough as a hint.

const INTENT_PATTERNS = [
  { intent: 'navigate', re: /\b(open|take me to|go to|show me|navigate to)\s+(the\s+)?([a-z\- ]+)\b/i, slugFrom: 3 },
  { intent: 'emergency', re: /\b(911|emergency|help.*now|trapped|smoke.*house|evacuat(e|ing) (right )?now|fire (in|near) my)\b/i },
  { intent: 'risk',      re: /\b(today.?s? risk|current risk|red.flag|fire weather|wildfire warning)\b/i },
  { intent: 'thanks',    re: /^(thanks|thank you|cool|ok|got it|nice|great)\.?$/i },
];

export function classifyIntent(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  for (const p of INTENT_PATTERNS) {
    const m = p.re.exec(t);
    if (m) {
      const out = { intent: p.intent };
      if (p.slugFrom != null) out.slug = (m[p.slugFrom] || '').trim().toLowerCase().replace(/\s+/g, '-');
      return out;
    }
  }
  return null;
}

// ─── TF-IDF reranker (Phase 2 retrieval upgrade) ─────────────────
//
// We don't have a vector DB in front of us; we *do* have a small enough
// FAQ corpus that client-side TF-IDF is meaningfully better than the
// current substring match. This export is consumed by prompt.js when
// available.

let _idfCache = null;

function tokens(s) {
  return String(s || '').toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/).filter(t => t.length >= 3);
}

async function ensureIdf() {
  if (_idfCache) return _idfCache;
  const items = await fetchAllFaq();
  const docs = items.map(it => `${it.question || it.title || ''} ${it.answer || it.body || ''}`);
  const N = docs.length || 1;
  const df = new Map();
  docs.forEach(d => {
    const seen = new Set(tokens(d));
    seen.forEach(t => df.set(t, (df.get(t) || 0) + 1));
  });
  const idf = new Map();
  df.forEach((freq, term) => idf.set(term, Math.log(1 + N / (1 + freq))));
  _idfCache = { items, idf, docs };
  return _idfCache;
}

export async function tfidfRerank(query, k = 6) {
  const { items, idf, docs } = await ensureIdf();
  const qTokens = tokens(query);
  if (!qTokens.length) return [];
  const scored = items.map((it, i) => {
    const dt = tokens(docs[i]);
    let score = 0;
    qTokens.forEach(q => {
      if (dt.includes(q)) score += (idf.get(q) || 1);
    });
    return { item: it, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
  return scored.map(x => x.item);
}
