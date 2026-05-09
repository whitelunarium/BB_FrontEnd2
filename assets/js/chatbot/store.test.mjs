// Run: node assets/js/chatbot/store.test.mjs
//
// Pure unit tests for the chatbot persistence layer. No browser
// dependencies beyond a tiny localStorage shim — node 20+ ships
// crypto.randomUUID natively.

import assert from 'node:assert/strict';

// ── Minimal localStorage shim ─────────────────────────────────────
class MemStorage {
  constructor() { this._d = new Map(); }
  getItem(k)        { return this._d.has(k) ? this._d.get(k) : null; }
  setItem(k, v)     { this._d.set(k, String(v)); }
  removeItem(k)     { this._d.delete(k); }
  clear()           { this._d.clear(); }
  get length()      { return this._d.size; }
  key(i)            { return Array.from(this._d.keys())[i] || null; }
}
globalThis.localStorage    = new MemStorage();
globalThis.sessionStorage  = new MemStorage();
// store.js reads window.crypto.randomUUID; node's crypto already exists as
// a getter so we can't reassign on globalThis. Define a plain `window`
// object that exposes what the module touches.
globalThis.window = {
  crypto: globalThis.crypto,
  localStorage: globalThis.localStorage,
  sessionStorage: globalThis.sessionStorage,
};

const store = await import('./store.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    localStorage.clear();
    sessionStorage.clear();
    fn();
    passed++;
  } catch (e) {
    failed++;
    console.error(`  ✖ ${name}`);
    console.error(`    ${e.message}`);
  }
}

// ── Tests ─────────────────────────────────────────────────────────

test('createConversation creates with timestamps + active id', () => {
  const c = store.createConversation('Test convo');
  assert.equal(c.title, 'Test convo');
  assert.ok(c.id);
  assert.ok(c.createdAt > 0);
  assert.equal(c.updatedAt, c.createdAt);
  assert.deepEqual(c.messages, []);
  assert.equal(store.getActiveConversation()?.id, c.id);
});

test('appendMessage updates conversation and derives title from first user msg', () => {
  const c = store.createConversation();   // default title
  store.appendMessage(c.id, { role: 'user', content: 'How do I find my block coordinator?' });
  const fresh = store.getActiveConversation();
  assert.equal(fresh.messages.length, 1);
  assert.equal(fresh.messages[0].content, 'How do I find my block coordinator?');
  assert.equal(fresh.title, 'How do I find my block coordinator?');
});

test('appendMessage assigns id + timestamp when missing', () => {
  const c = store.createConversation();
  const msg = store.appendMessage(c.id, { role: 'assistant', content: 'Hi.' });
  assert.ok(msg.id);
  assert.ok(msg.timestamp > 0);
  assert.equal(msg.role, 'assistant');
});

test('appendMessage preserves explicit id + timestamp', () => {
  const c = store.createConversation();
  const ts = 1700000000000;
  const msg = store.appendMessage(c.id, { id: 'fixed-id', role: 'user', content: 'x', timestamp: ts });
  assert.equal(msg.id, 'fixed-id');
  assert.equal(msg.timestamp, ts);
});

test('updateMessage merges patch fields', () => {
  const c = store.createConversation();
  const msg = store.appendMessage(c.id, { role: 'assistant', content: 'A' });
  store.updateMessage(c.id, msg.id, { feedback: 'up', content: 'A (edited)' });
  const m = store.getActiveConversation().messages[0];
  assert.equal(m.feedback, 'up');
  assert.equal(m.content, 'A (edited)');
});

test('deleteMessage removes by id', () => {
  const c = store.createConversation();
  const m1 = store.appendMessage(c.id, { role: 'user', content: 'one' });
  const m2 = store.appendMessage(c.id, { role: 'assistant', content: 'two' });
  store.deleteMessage(c.id, m1.id);
  const fresh = store.getActiveConversation();
  assert.equal(fresh.messages.length, 1);
  assert.equal(fresh.messages[0].id, m2.id);
});

test('listConversations returns newest-updated first', () => {
  const a = store.createConversation('first');
  // simulate later update on second
  const b = store.createConversation('second');
  store.appendMessage(b.id, { role: 'user', content: 'newer' });
  const list = store.listConversations();
  assert.equal(list[0].id, b.id, 'newest-updated should sort first');
});

test('searchConversations matches title + message content', () => {
  const a = store.createConversation('Wildfire prep');
  const b = store.createConversation('Other');
  store.appendMessage(b.id, { role: 'user', content: 'about wildfire smoke' });
  const titleHits = store.searchConversations('wildfire prep');
  const bodyHits  = store.searchConversations('smoke');
  assert.equal(titleHits.length, 1);
  assert.equal(titleHits[0].id, a.id);
  assert.equal(bodyHits.length,  1);
  assert.equal(bodyHits[0].id, b.id);
});

test('deleteConversation removes the convo and resets active when needed', () => {
  const a = store.createConversation('a');
  const b = store.createConversation('b');
  store.deleteConversation(b.id);
  assert.equal(store.listConversations().length, 1);
  assert.equal(store.getActiveConversation()?.id, a.id);
});

test('clearAllConversations empties storage', () => {
  store.createConversation('x');
  store.createConversation('y');
  store.clearAllConversations();
  assert.equal(store.listConversations().length, 0);
  assert.equal(store.getActiveConversation(), null);
});

test('prefs round-trip with defaults', () => {
  const p1 = store.getPrefs();
  assert.equal(p1.lang, 'en');
  assert.equal(p1.voiceReplies, false);
  store.setPref('lang', 'es');
  const p2 = store.getPrefs();
  assert.equal(p2.lang, 'es');
  assert.equal(p2.voiceReplies, false, 'unrelated prefs unchanged');
});

test('user-scoped storage keys: anon ↔ logged-in are isolated', () => {
  // anon convo
  store.createConversation('anon-only');
  // simulate login
  localStorage.setItem('pnec_user', JSON.stringify({ id: 42, email: 'a@b' }));
  // logged-in user starts with empty list
  assert.equal(store.listConversations().length, 0);
  store.createConversation('logged-in-only');
  assert.equal(store.listConversations().length, 1);
  // back to anon
  localStorage.removeItem('pnec_user');
  assert.equal(store.listConversations().length, 1);
  assert.equal(store.listConversations()[0].title, 'anon-only');
});

// ── Report ────────────────────────────────────────────────────────
console.log(`store.test.mjs: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
