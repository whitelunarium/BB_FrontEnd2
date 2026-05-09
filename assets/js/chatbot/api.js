// assets/js/chatbot/api.js
// PNEC Helper Bot v3 — networking layer.
//
// Wraps the existing Flask Gemini proxy at `${apiBase}/api/gemini`.
// Tries a streaming endpoint first (`/api/gemini-stream`) — when that
// 404s (most deployments today) we fall back to the one-shot endpoint
// and let render.js do client-side typewriter streaming.
//
// FAQ + news + risk are still served by their existing endpoints
// through the helpers in /assets/js/api/*.js. We import those lazily
// only when needed so the chatbot stays fast on initial load.

const FETCH_TIMEOUT = 30_000;

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(v => { clearTimeout(t); resolve(v); },
                 e => { clearTimeout(t); reject(e); });
  });
}

function defaultApiBase() {
  const cfg = window.PNEC_CHATBOT_CONFIG || {};
  if (cfg.apiBase) return cfg.apiBase;
  const h = window.location.hostname;
  return (h === 'localhost' || h === '127.0.0.1')
    ? 'http://127.0.0.1:8425'
    : 'https://beasts.opencodingsociety.com';
}

function defaultEndpoint() {
  const cfg = window.PNEC_CHATBOT_CONFIG || {};
  return cfg.endpoint || `${defaultApiBase()}/api/gemini`;
}

function streamEndpoint() {
  const cfg = window.PNEC_CHATBOT_CONFIG || {};
  if (cfg.streamEndpoint) return cfg.streamEndpoint;
  // Convention: same host, /api/gemini-stream. Backend may not implement
  // it yet — that's fine, we'll silently fall back.
  const base = defaultEndpoint().replace(/\/api\/gemini\/?$/, '');
  return `${base}/api/gemini-stream`;
}

// ─── One-shot completion (today's Flask /api/gemini) ──────────────

export async function sendCompletion({ systemPrompt, userMessage, history = [], image }) {
  const endpoint = defaultEndpoint();
  // Phase 4: include image bytes in the payload when present. Backend
  // proxy may ignore the field; that's fine — the user message still
  // goes through with the text component.
  const payload = { prompt: systemPrompt, text: userMessage, history };
  if (image && image.dataUrl) {
    payload.image_base64 = image.dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
    payload.image_mime   = image.mime || 'image/jpeg';
  }
  const body = JSON.stringify(payload);

  const res = await withTimeout(fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  }), FETCH_TIMEOUT);

  let data = {};
  try { data = await res.json(); } catch (_e) { /* ignore */ }

  if (!res.ok) {
    const msg = data?.detail || data?.message || data?.error || `Helper Bot couldn't reach the assistant (HTTP ${res.status}).`;
    throw new Error(msg);
  }

  const text = (typeof data?.text === 'string' && data.text)
            || (typeof data?.response === 'string' && data.response)
            || '';
  if (!text) throw new Error('Helper Bot received an empty reply. Try rephrasing your question.');
  return { text, raw: data };
}

// ─── Streaming completion (best-effort SSE) ──────────────────────

export async function* sendCompletionStream({ systemPrompt, userMessage, history = [], signal }) {
  const url = streamEndpoint();
  const body = JSON.stringify({ prompt: systemPrompt, text: userMessage, history, stream: true });

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body, signal
    });
  } catch (e) {
    // Network error — caller should fall back to non-streaming.
    yield { kind: 'error', error: e };
    return;
  }

  if (!res.ok || !res.body) {
    yield { kind: 'unsupported', status: res.status };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse SSE — one event per blank-line-separated chunk.
      let idx;
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const event = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        const data = event
          .split(/\n/)
          .filter(l => l.startsWith('data:'))
          .map(l => l.slice(5).trim())
          .join('\n');
        if (!data || data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (typeof parsed?.text === 'string') yield { kind: 'token', text: parsed.text };
          else if (typeof parsed?.delta === 'string') yield { kind: 'token', text: parsed.delta };
          else if (typeof parsed === 'string') yield { kind: 'token', text: parsed };
          if (parsed?.done) yield { kind: 'done' };
        } catch (_e) {
          // Plain-text deltas (some servers do this)
          yield { kind: 'token', text: data };
        }
      }
    }
    yield { kind: 'done' };
  } finally {
    try { reader.releaseLock(); } catch (_e) {}
  }
}

// ─── Suggestion generation (uses one-shot completion) ─────────────

export async function generateSuggestions({ systemPrompt, lastUserMessage, lastAssistantMessage }) {
  // Cheap parallel call to get 3 followup chips.
  const userMessage = `Based on this last exchange, give exactly 3 short followup questions a Poway resident might want to ask next, one per line, no numbering or punctuation. Each under 9 words. Don't repeat the original question.

USER: ${lastUserMessage}
ASSISTANT: ${lastAssistantMessage}`;
  try {
    const { text } = await sendCompletion({
      systemPrompt: systemPrompt + '\n\nReturn ONLY the three lines, no preamble.',
      userMessage,
      history: []
    });
    return text.split(/\r?\n/).map(s => s.replace(/^[-*\d.\s)]+/, '').trim()).filter(Boolean).slice(0, 3);
  } catch (_e) {
    return [];
  }
}

// ─── FAQ helpers (lazy-loaded from existing api modules) ──────────

let faqApiPromise = null;
async function getFaqApi() {
  if (!faqApiPromise) {
    faqApiPromise = (async () => {
      // /assets/js/api/faq-api.js loads as a classic script (sets window.FAQ_API).
      // Wait briefly if we beat it, then fall back to direct fetch.
      for (let i = 0; i < 20; i++) {
        if (window.FAQ_API && typeof window.FAQ_API.fetchFaqItems === 'function') return window.FAQ_API;
        await new Promise(r => setTimeout(r, 50));
      }
      return null;
    })();
  }
  return faqApiPromise;
}

export async function fetchAllFaq() {
  const api = await getFaqApi();
  if (api && typeof api.fetchFaqItems === 'function') {
    try { return await api.fetchFaqItems(); } catch (_e) { /* fall through */ }
  }
  // Direct REST fallback
  try {
    const res = await fetch(`${defaultApiBase()}/api/faq/items`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data?.items || []);
  } catch (_e) { return []; }
}

export async function searchFaq(query) {
  const api = await getFaqApi();
  if (api && typeof api.searchFaqItems === 'function') {
    try { return await api.searchFaqItems(query); } catch (_e) { /* fall through */ }
  }
  try {
    const res = await fetch(`${defaultApiBase()}/api/faq/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data?.items || []);
  } catch (_e) { return []; }
}

// ─── News (incident lookup) ───────────────────────────────────────

export async function searchNews(query) {
  const cfg = window.PNEC_CHATBOT_CONFIG || {};
  const url = cfg.newsEndpoint || `${defaultApiBase()}/api/news/search`;
  try {
    const res = await fetch(`${url}?q=${encodeURIComponent(query)}&limit=5`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : (data?.items || data?.results || []);
  } catch (_e) { return []; }
}

// ─── Risk now (today's Poway risk widget data) ────────────────────

export async function getRiskNow() {
  // /assets/js/api/risk-api.js exposes window.PNEC_RISK_API.fetchTodayRisk on most pages.
  if (window.PNEC_RISK_API && typeof window.PNEC_RISK_API.fetchTodayRisk === 'function') {
    try { return await window.PNEC_RISK_API.fetchTodayRisk(); } catch (_e) { /* fall through */ }
  }
  try {
    const res = await fetch(`${defaultApiBase()}/api/risk/today`);
    if (!res.ok) return null;
    return await res.json();
  } catch (_e) { return null; }
}

// ─── Staff question submission (existing endpoint) ────────────────

export async function submitToStaff({ name, email, question, context }) {
  try {
    const res = await fetch(`${defaultApiBase()}/api/faq/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, question, context })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.detail || data?.message || `Submission failed (${res.status}).`);
    }
    return await res.json().catch(() => ({ ok: true }));
  } catch (e) {
    throw e;
  }
}
