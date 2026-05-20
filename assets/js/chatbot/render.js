// assets/js/chatbot/render.js
// PNEC Helper Bot v3 — markdown rendering, message DOM, streaming.
//
// Why a from-scratch markdown renderer?
//   • External deps would add a load step + cost on every page
//   • Our LLM output is constrained — we only need: paragraphs,
//     bold/em/code, links, lists, blockquotes, fenced code
//   • Security: we escape HTML at the source so a model that emits
//     `<script>` can't execute anything
//
// The streaming renderer is dumb-but-effective: append tokens to the
// raw text, re-render the whole bubble each tick. This is fast enough
// for messages under a few KB and avoids the complexity of incremental
// markdown parsing.

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, ch => ESCAPE_MAP[ch]);
}

// Inline replacements (bold/em/code/link)
function renderInline(text) {
  let out = escapeHtml(text);
  // Code spans first so emphasis inside code doesn't trigger.
  out = out.replace(/`([^`\n]+)`/g, (_m, c) => `<code>${c}</code>`);
  // Markdown links [label](url) — restrict to http(s), tel:, mailto:, /
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|tel:[^\s)]+|mailto:[^\s)]+|\/[^\s)]*)\)/g,
    (_m, label, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  // Bold **text** (greedy enough for one token) — also __text__
  out = out.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
  // Italic *text* and _text_ (avoid hitting **bolds** by requiring word boundary)
  out = out.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
  // Auto-link bare URLs that weren't already wrapped
  out = out.replace(/(^|[^"=>])(https?:\/\/[^\s<]+)/g,
    (_m, pre, url) => `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
  return out;
}

// Block parser — line-by-line state machine. Handles paragraphs,
// fenced code, headings (###), unordered (-), ordered (1.), and
// blockquotes (>).
export function renderMarkdown(input) {
  const text = String(input || '');
  if (!text.trim()) return '';

  const lines = text.split(/\r?\n/);
  const out = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code ```
    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, '').trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) {
        buf.push(lines[i]); i++;
      }
      i++; // consume closing ```
      const code = escapeHtml(buf.join('\n'));
      out.push(`<pre><code data-lang="${escapeHtml(lang)}">${code}</code></pre>`);
      continue;
    }

    // Heading (### only — keep it understated)
    const hMatch = /^(#{1,3})\s+(.*)$/.exec(line);
    if (hMatch) {
      const level = Math.min(3, hMatch[1].length) + 2; // h3..h5
      out.push(`<h${level}>${renderInline(hMatch[2])}</h${level}>`);
      i++; continue;
    }

    // Blockquote
    if (/^>\s/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s/, '')); i++;
      }
      out.push(`<blockquote>${renderInline(buf.join(' '))}</blockquote>`);
      continue;
    }

    // Unordered list
    if (/^[\-*+]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[\-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[\-*+]\s+/, '')); i++;
      }
      out.push('<ul>' + items.map(it => `<li>${renderInline(it)}</li>`).join('') + '</ul>');
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, '')); i++;
      }
      out.push('<ol>' + items.map(it => `<li>${renderInline(it)}</li>`).join('') + '</ol>');
      continue;
    }

    // Blank line — paragraph break (handled by paragraph collection)
    if (!line.trim()) { i++; continue; }

    // Paragraph: gather contiguous non-empty, non-block lines
    const buf = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,3}\s|>\s|[\-*+]\s|\d+\.\s)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    out.push(`<p>${renderInline(buf.join(' '))}</p>`);
  }

  return out.join('');
}

// ─── Message DOM building ─────────────────────────────────────────

function svg(html) {
  // Trusted small inline SVG snippets — coming from this module only.
  const span = document.createElement('span');
  span.innerHTML = html;
  return span.firstChild;
}

function avatarFor(role, opts = {}) {
  const div = document.createElement('div');
  div.className = 'pnec-bot-msg-avatar';
  if (role === 'assistant') {
    div.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-12V5l-8-3-8 3v5c0 8 8 12 8 12z"/></svg>';
  } else {
    div.textContent = (opts.initials || 'You').slice(0, 2).toUpperCase();
  }
  return div;
}

function relTime(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return Math.floor(diff / 60_000) + 'm ago';
  if (diff < 86_400_000) return Math.floor(diff / 3_600_000) + 'h ago';
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function buildMessageEl(msg, ctx = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'pnec-bot-msg ' + (msg.role === 'user' ? 'is-user' : 'is-bot');
  wrap.dataset.msgId = msg.id;

  wrap.appendChild(avatarFor(msg.role, { initials: ctx.userInitials }));

  const body = document.createElement('div');
  body.className = 'pnec-bot-msg-body';

  // Image attachments first
  if (Array.isArray(msg.attachments)) {
    msg.attachments.forEach(att => {
      if (att.kind === 'image' && att.dataUrl) {
        const img = document.createElement('img');
        img.className = 'pnec-bot-msg-image';
        img.src = att.dataUrl;
        img.alt = att.alt || 'attached image';
        body.appendChild(img);
      }
    });
  }

  const bubble = document.createElement('div');
  bubble.className = 'pnec-bot-msg-bubble';
  bubble.innerHTML = renderMarkdown(msg.content || '');
  body.appendChild(bubble);

  // Citations
  if (Array.isArray(msg.citations) && msg.citations.length) {
    const cites = document.createElement('div');
    cites.className = 'pnec-bot-citations';
    msg.citations.forEach((c, idx) => {
      let el;
      if (c.kind === 'faq' && c.faqId != null) {
        // FAQ cites expand the Q+A inline under the message — there's
        // no FAQ section on preparedness-resources to deep-link to,
        // so the URL would 404 the affordance. Render as a button.
        el = document.createElement('button');
        el.type = 'button';
        el.className = 'pnec-bot-citation pnec-bot-citation--faq';
        el.setAttribute('aria-expanded', 'false');
        el.title = 'Show this FAQ';
        el.innerHTML = `<span class="pnec-bot-citation-num">${idx + 1}</span><span>${escapeHtml(c.label || 'source')}</span>`;
        el.addEventListener('click', () => toggleFaqDetail(el, c.faqId, cites));
      } else {
        el = document.createElement('a');
        el.className = 'pnec-bot-citation';
        el.href = c.url || '#';
        if (c.url) { el.target = '_blank'; el.rel = 'noopener noreferrer'; }
        el.innerHTML = `<span class="pnec-bot-citation-num">${idx + 1}</span><span>${escapeHtml(c.label || c.url || 'source')}</span>`;
      }
      cites.appendChild(el);
    });
    body.appendChild(cites);
  }

  // Tool-call inline cards
  if (Array.isArray(msg.toolCalls) && msg.toolCalls.length) {
    msg.toolCalls.forEach(tc => {
      body.appendChild(buildToolCallCard(tc, ctx));
    });
  }

  // Meta row (timestamp + actions)
  const meta = document.createElement('div');
  meta.className = 'pnec-bot-msg-meta';
  meta.appendChild(document.createTextNode(relTime(msg.timestamp)));

  if (msg.role === 'assistant') {
    const actions = document.createElement('span');
    actions.className = 'pnec-bot-msg-actions';
    actions.innerHTML = `
      <button class="pnec-bot-msg-action-btn ${msg.feedback === 'up' ? 'is-up' : ''}" data-msg-action="up" aria-label="Helpful"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-6 0v4H4l1 11h14l1-11h-4z"/></svg></button>
      <button class="pnec-bot-msg-action-btn ${msg.feedback === 'down' ? 'is-down' : ''}" data-msg-action="down" aria-label="Not helpful"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 6 0v-4h4l-1-11H5l-1 11h6z"/></svg></button>
      <button class="pnec-bot-msg-action-btn" data-msg-action="copy" aria-label="Copy"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
      <button class="pnec-bot-msg-action-btn" data-msg-action="speak" aria-label="Read aloud"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg></button>
    `;
    meta.appendChild(actions);
  } else {
    const actions = document.createElement('span');
    actions.className = 'pnec-bot-msg-actions';
    actions.innerHTML = `
      <button class="pnec-bot-msg-action-btn" data-msg-action="edit" aria-label="Edit"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
    `;
    meta.appendChild(actions);
  }

  body.appendChild(meta);
  wrap.appendChild(body);
  return wrap;
}

function buildToolCallCard(tc, _ctx) {
  const card = document.createElement('div');
  card.className = 'pnec-bot-action-card' + (tc.status === 'done' || tc.status === 'cancelled' ? ' is-done' : '');
  card.dataset.toolCallId = tc.id || '';

  const head = document.createElement('div');
  head.className = 'pnec-bot-action-card-head';
  head.innerHTML = `
    <span class="pnec-bot-action-card-icon">${TOOL_ICONS[tc.tool] || TOOL_ICONS.default}</span>
    <h4 class="pnec-bot-action-card-title">${escapeHtml(tc.title || tc.tool || 'Action')}</h4>
  `;
  card.appendChild(head);

  if (tc.body) {
    const body = document.createElement('div');
    body.className = 'pnec-bot-action-card-body';
    body.innerHTML = renderMarkdown(tc.body);
    card.appendChild(body);
  }

  if (tc.status !== 'done' && tc.status !== 'cancelled') {
    const actions = document.createElement('div');
    actions.className = 'pnec-bot-action-card-actions';
    actions.innerHTML = `
      <button class="pnec-bot-action-card-btn pnec-bot-action-card-btn-secondary" data-tool-action="cancel">Cancel</button>
      <button class="pnec-bot-action-card-btn pnec-bot-action-card-btn-primary" data-tool-action="confirm">${escapeHtml(tc.confirmLabel || 'Confirm')}</button>
    `;
    card.appendChild(actions);
  } else if (tc.result && tc.result.html) {
    const result = document.createElement('div');
    result.className = 'pnec-bot-action-card-body';
    result.innerHTML = tc.result.html;
    card.appendChild(result);
  } else if (tc.result && tc.result.text) {
    const result = document.createElement('div');
    result.className = 'pnec-bot-action-card-body';
    result.innerHTML = renderMarkdown(tc.result.text);
    card.appendChild(result);
  }

  return card;
}

const TOOL_ICONS = {
  default:        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  navigate_to:    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
  search_news:    '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  get_risk_now:   '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
  submit_to_staff:'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
  find_event:     '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
};

// Build a "thinking" placeholder bubble — used while the assistant
// response is still on the wire.
export function buildLoadingMsgEl() {
  const wrap = document.createElement('div');
  wrap.className = 'pnec-bot-msg is-bot is-loading';
  wrap.innerHTML = `
    <div class="pnec-bot-msg-avatar">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-12V5l-8-3-8 3v5c0 8 8 12 8 12z"/></svg>
    </div>
    <div class="pnec-bot-msg-body">
      <div class="pnec-bot-msg-bubble">
        <span class="pnec-bot-loading-dot"></span>
        <span class="pnec-bot-loading-dot"></span>
        <span class="pnec-bot-loading-dot"></span>
      </div>
    </div>
  `;
  return wrap;
}

// ─── Streaming "typewriter" — updates a bubble's HTML as text grows ─

export function streamIntoBubble(bubbleEl, fullText, opts = {}) {
  // Visual streaming: render the markdown of the *partial* string so
  // the user sees it grow naturally. Even when the API returns the
  // text in one chunk we can simulate token-by-token with a setInterval.
  const speed = opts.speed || 14;          // characters per tick
  const tick  = opts.tickMs || 20;         // ms between ticks
  let cursor = 0;
  return new Promise(resolve => {
    if (!fullText) { resolve(); return; }
    const id = setInterval(() => {
      cursor = Math.min(cursor + speed, fullText.length);
      bubbleEl.innerHTML = renderMarkdown(fullText.slice(0, cursor));
      if (opts.onTick) opts.onTick(cursor);
      if (cursor >= fullText.length) {
        clearInterval(id);
        resolve();
      }
    }, tick);
    if (opts.cancelToken) opts.cancelToken.cancel = () => { clearInterval(id); resolve(); };
  });
}

// ─── Public escape helper for callers building strings safely ────

export const _escape = escapeHtml;

// ─── Inline FAQ expand (for [FAQ#N] citation chips) ───────────────
// FAQ citation chips no longer link to a dead URL — they toggle an
// inline Q+A card under the message. Data is fetched once via the
// existing fetchAllFaq() and cached by id for instant subsequent
// expands.

const _faqCache = new Map();
let _faqAllPromise = null;
async function ensureFaqCache() {
  if (_faqAllPromise) return _faqAllPromise;
  _faqAllPromise = (async () => {
    try {
      const mod = await import('./api.js');
      const items = (mod && typeof mod.fetchAllFaq === 'function') ? await mod.fetchAllFaq() : [];
      (items || []).forEach(it => {
        if (it && it.id != null) _faqCache.set(String(it.id), it);
      });
    } catch (_e) { /* leave cache empty; fallthrough handles missing */ }
  })();
  return _faqAllPromise;
}

async function toggleFaqDetail(btn, faqId, citesContainer) {
  const id = String(faqId);
  // Look for an existing inline card right after the citations row.
  let card = citesContainer.nextElementSibling;
  if (!card || !card.classList || !card.classList.contains('pnec-bot-faq-card')) card = null;
  // Same FAQ → close the card.
  if (card && card.dataset.faqId === id) {
    card.remove();
    btn.setAttribute('aria-expanded', 'false');
    return;
  }
  // Different FAQ → swap.
  if (card) card.remove();
  [...citesContainer.querySelectorAll('.pnec-bot-citation--faq')]
    .forEach(b => b.setAttribute('aria-expanded', 'false'));
  btn.setAttribute('aria-expanded', 'true');

  card = document.createElement('div');
  card.className = 'pnec-bot-faq-card';
  card.dataset.faqId = id;
  card.innerHTML =
    `<div class="pnec-bot-faq-card-head">FAQ #${escapeHtml(id)}</div>` +
    `<div class="pnec-bot-faq-card-body"><div class="pnec-bot-faq-card-loading">Loading…</div></div>`;
  citesContainer.parentNode.insertBefore(card, citesContainer.nextSibling);

  await ensureFaqCache();
  const item = _faqCache.get(id);
  const bodyEl = card.querySelector('.pnec-bot-faq-card-body');
  if (item && (item.question || item.answer)) {
    const q = escapeHtml(item.question || '');
    const a = escapeHtml(item.answer || '');
    bodyEl.innerHTML =
      `<div class="pnec-bot-faq-card-q"><strong>Q:</strong> ${q}</div>` +
      `<div class="pnec-bot-faq-card-a"><strong>A:</strong> ${a}</div>`;
  } else {
    bodyEl.innerHTML =
      `<div class="pnec-bot-faq-card-missing">Couldn't load FAQ #${escapeHtml(id)} right now. ` +
      `The answer above is based on it — ask a follow-up to dig deeper.</div>`;
  }
}
