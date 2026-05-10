// assets/js/chatbot/store.js
// PNEC Helper Bot v3 — state + persistence layer.
//
// Conversations live in localStorage under one key per user (so you
// can switch logins on the same device and not see each other's
// history). The store is intentionally thin: a list of conversations,
// each with messages. No backend sync in Phase 1 (we add that in
// Phase 2 alongside the streaming endpoint).
//
// Schema (versioned so we can migrate later):
//   pnec_bot_v1 = {
//     version: 1,
//     activeId: "<conversation_id>",
//     conversations: [{
//       id, title, createdAt, updatedAt,
//       messages: [{
//         id, role: "user"|"assistant"|"system",
//         content, timestamp,
//         citations?: [{label, url, faqId?}],
//         toolCalls?: [{tool, args, status, result}],
//         attachments?: [{kind, dataUrl, alt}],
//         feedback?: "up"|"down"|null,
//       }]
//     }]
//   }

const KEY_PREFIX = 'pnec_bot_v1';
const MAX_CONVERSATIONS = 50;
const MAX_MESSAGES_PER_CONVO = 200;

function userScopedKey() {
  // Tie storage to the logged-in user when we can — otherwise fall
  // back to a shared "anon" bucket. Reads pnec_user the same way
  // navbar.js writes it.
  let userId = 'anon';
  try {
    const raw = localStorage.getItem('pnec_user') || sessionStorage.getItem('pnec_user');
    if (raw) {
      const u = JSON.parse(raw);
      if (u && (u.id || u.email)) userId = String(u.id || u.email).toLowerCase();
    }
  } catch (_e) { /* ignore */ }
  return `${KEY_PREFIX}:${userId}`;
}

function safeParse(raw) {
  try { return JSON.parse(raw); } catch (_e) { return null; }
}

function emptyState() {
  return { version: 1, activeId: null, conversations: [] };
}

function readState() {
  try {
    const raw = localStorage.getItem(userScopedKey());
    if (!raw) return emptyState();
    const parsed = safeParse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.conversations)) {
      return emptyState();
    }
    return parsed;
  } catch (_e) {
    return emptyState();
  }
}

function writeState(state) {
  try {
    localStorage.setItem(userScopedKey(), JSON.stringify(state));
  } catch (_e) {
    // Quota exceeded — drop oldest conversations and retry once.
    try {
      state.conversations = state.conversations.slice(-10);
      localStorage.setItem(userScopedKey(), JSON.stringify(state));
    } catch (__e) { /* give up silently */ }
  }
}

function uuid() {
  if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'c-' + Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
}

// ─── Public API ───────────────────────────────────────────────────

export function listConversations() {
  return readState().conversations.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getActiveConversation() {
  const state = readState();
  if (!state.activeId) return null;
  return state.conversations.find(c => c.id === state.activeId) || null;
}

export function setActiveConversation(id) {
  const state = readState();
  if (!state.conversations.some(c => c.id === id)) return null;
  state.activeId = id;
  writeState(state);
  return state.conversations.find(c => c.id === id);
}

export function createConversation(initialTitle) {
  const state = readState();
  const now = Date.now();
  const convo = {
    id: uuid(),
    title: initialTitle || 'New conversation',
    createdAt: now,
    updatedAt: now,
    messages: []
  };
  state.conversations.unshift(convo);
  state.activeId = convo.id;
  if (state.conversations.length > MAX_CONVERSATIONS) {
    state.conversations = state.conversations.slice(0, MAX_CONVERSATIONS);
  }
  writeState(state);
  return convo;
}

export function deleteConversation(id) {
  const state = readState();
  state.conversations = state.conversations.filter(c => c.id !== id);
  if (state.activeId === id) state.activeId = state.conversations[0]?.id || null;
  writeState(state);
}

export function clearAllConversations() {
  writeState(emptyState());
}

export function appendMessage(conversationId, message) {
  const state = readState();
  const convo = state.conversations.find(c => c.id === conversationId);
  if (!convo) return null;

  const msg = {
    id: message.id || uuid(),
    role: message.role,
    content: message.content || '',
    timestamp: message.timestamp || Date.now(),
    citations: message.citations || null,
    toolCalls: message.toolCalls || null,
    attachments: message.attachments || null,
    feedback: message.feedback || null
  };
  convo.messages.push(msg);
  if (convo.messages.length > MAX_MESSAGES_PER_CONVO) {
    convo.messages = convo.messages.slice(-MAX_MESSAGES_PER_CONVO);
  }
  convo.updatedAt = msg.timestamp;
  // Auto-derive title from the first user message if still default
  if ((convo.title === 'New conversation' || !convo.title) && msg.role === 'user') {
    convo.title = (msg.content || '').slice(0, 60).replace(/\s+/g, ' ').trim() || 'New conversation';
  }
  writeState(state);
  return msg;
}

export function updateMessage(conversationId, messageId, patch) {
  const state = readState();
  const convo = state.conversations.find(c => c.id === conversationId);
  if (!convo) return null;
  const msg = convo.messages.find(m => m.id === messageId);
  if (!msg) return null;
  Object.assign(msg, patch);
  convo.updatedAt = Date.now();
  writeState(state);
  return msg;
}

export function deleteMessage(conversationId, messageId) {
  const state = readState();
  const convo = state.conversations.find(c => c.id === conversationId);
  if (!convo) return;
  convo.messages = convo.messages.filter(m => m.id !== messageId);
  convo.updatedAt = Date.now();
  writeState(state);
}

export function searchConversations(query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return listConversations();
  return listConversations().filter(c => {
    if ((c.title || '').toLowerCase().includes(q)) return true;
    return c.messages.some(m => (m.content || '').toLowerCase().includes(q));
  });
}

// ─── Preferences (separate scope, not per-conversation) ───────────

const PREFS_KEY = 'pnec_bot_prefs_v1';
const DEFAULT_PREFS = {
  // ─── Language + UX ─────────────────────────────────────────
  lang: 'en',                   // 'en' | 'es' | 'tl'
  voiceReplies: false,
  panelMode: 'docked',          // 'docked' | 'expanded' | 'modal'
  railOpen: false,
  autoOpenedAt: 0,              // last auto-open epoch (anti-pester)
  dismissedAt: 0,               // last manual close epoch

  // ─── v3.11: real-AI settings ───────────────────────────────
  // Appearance
  theme: 'auto',                // 'auto' | 'light' | 'dark'
  textSize: 'comfortable',      // 'compact' | 'comfortable' | 'large'
  accent: 'forest',             // 'forest' | 'sky' | 'sunset' | 'lavender'

  // Conversation behaviour
  style: 'default',             // 'default' | 'concise' | 'detailed'
  suggestionsEnabled: true,     // show follow-up chip suggestions?
  customInstructions: '',       // free-text injected into system prompt

  // Memory + persistence
  rememberConversation: true,   // persist across page reloads?

  // Accessibility
  reducedMotion: false,
  highContrast: false,
  alwaysOnLabels: false,        // keep chip labels visible (no hover-reveal)
};

export function getPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    return { ...DEFAULT_PREFS, ...(safeParse(raw) || {}) };
  } catch (_e) { return { ...DEFAULT_PREFS }; }
}

export function setPref(key, value) {
  const prefs = getPrefs();
  prefs[key] = value;
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (_e) {}
  return prefs;
}

// ─── Returning user → cached profile (read-only here) ─────────────

export function getCachedUser() {
  try {
    const raw = localStorage.getItem('pnec_user') || sessionStorage.getItem('pnec_user');
    if (!raw) return null;
    return safeParse(raw);
  } catch (_e) { return null; }
}
