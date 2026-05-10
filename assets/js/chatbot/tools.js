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
  searchNews, getRiskNow, submitToStaff, fetchAllFaq, getLiveConditions
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
};

function slugLabel(slug) {
  if (!slug) return 'that page';
  const map = {
    'home':                            'the home page',
    'about':                           'the About page',
    'programs-and-services':           'Programs & Services',
    'preparedness-resources':          'Preparedness Resources',
    'community-events-and-activities': 'Community Events',
    'find-your-neighborhood':          'Find Your Neighborhood',
    'contact':                         'the Contact page',
    'volunteer':                       'the Volunteer page',
    'profile':                         'your Profile',
    'admin':                           'the Admin Dashboard',
    'register':                        'the sign-in page',
    'events':                          'Community Events',
  };
  return map[slug] || `the ${slug.replace(/-/g, ' ')} page`;
}

function slugToHref(slug) {
  const map = {
    home: '/',
    events: '/pages/community-events-and-activities.html',
  };
  if (map[slug]) return map[slug];
  if (slug === 'profile' || slug === 'admin' || slug === 'register' || slug === 'contact'
   || slug === 'about' || slug === 'volunteer' || slug === 'find-your-neighborhood'
   || slug === 'preparedness-resources' || slug === 'programs-and-services'
   || slug === 'community-events-and-activities') {
    return `/pages/${slug}.html`;
  }
  return `/pages/${slug}.html`;
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
    default:
      return { text: `_Unknown tool: ${tc.tool}_` };
  }
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
  const slug = (args.slug || '').toLowerCase().trim();
  const href = slugToHref(slug);
  setTimeout(() => { window.location.assign(href); }, 280);
  return { text: `Heading to **${slugLabel(slug)}**…` };
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
