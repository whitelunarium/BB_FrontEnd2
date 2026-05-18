// Run: node assets/js/chatbot/tools.test.mjs
//
// Pure-function tests for the chatbot intelligence layer:
//   parseToolCalls — extracts JSON tool blocks the LLM emits
//   parseCitations — pulls [FAQ#42] and [News: src] markers
//   classifyIntent — lightweight regex intent classifier
//
// We don't exercise executeFromCard or tfidfRerank here — those depend
// on the controller / fetched FAQ corpus.

import assert from 'node:assert/strict';

// tools.js imports api.js which imports stuff that touches `window`/`fetch`.
// Provide a minimal shim so the import doesn't blow up in node.
globalThis.window = globalThis.window || {};
globalThis.fetch  = globalThis.fetch  || (() => Promise.reject(new Error('no fetch in tests')));
globalThis.document = globalThis.document || { querySelector: () => null };

const tools = await import('./tools.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) {
    failed++;
    console.error(`  ✖ ${name}\n    ${e.message}`);
  }
}

// ── parseToolCalls ────────────────────────────────────────────────

test('parseToolCalls returns null when no blocks present', () => {
  const r = tools.parseToolCalls('Just regular text. No tools here.');
  assert.equal(r.toolCalls, null);
  assert.equal(r.cleanText, 'Just regular text. No tools here.');
});

test('parseToolCalls extracts a single-line JSON block', () => {
  const text = 'Heading there.\n{"tool":"navigate_to","args":{"slug":"events"},"reason":"User asked"}\nAfter.';
  const r = tools.parseToolCalls(text);
  assert.ok(Array.isArray(r.toolCalls));
  assert.equal(r.toolCalls.length, 1);
  assert.equal(r.toolCalls[0].tool, 'navigate_to');
  assert.equal(r.toolCalls[0].args.slug, 'events');
  assert.ok(!r.cleanText.includes('"tool":"navigate_to"'),
    'tool block should be stripped from clean text');
  assert.ok(r.cleanText.includes('Heading there'));
  assert.ok(r.cleanText.includes('After'));
});

test('parseToolCalls extracts a fenced ```json``` block', () => {
  const text = 'Sure!\n```json\n{"tool":"search_news","args":{"query":"Springhurst"},"reason":"news lookup"}\n```\nDone.';
  const r = tools.parseToolCalls(text);
  assert.equal(r.toolCalls?.length, 1);
  assert.equal(r.toolCalls[0].tool, 'search_news');
  assert.equal(r.toolCalls[0].args.query, 'Springhurst');
  assert.ok(!r.cleanText.includes('```'));
});

test('parseToolCalls assigns a tc-* id and a confirm label from the registry', () => {
  const r = tools.parseToolCalls('{"tool":"navigate_to","args":{"slug":"about"}}');
  const tc = r.toolCalls[0];
  assert.match(tc.id, /^tc-/);
  assert.equal(tc.confirmLabel, 'Open page');
  assert.equal(tc.status, 'pending');
});

test('parseToolCalls drops blocks with unknown tools', () => {
  const r = tools.parseToolCalls('{"tool":"format_my_database","args":{}}');
  assert.equal(r.toolCalls, null, 'unknown tools must not get rendered');
});

test('parseToolCalls handles two blocks on separate lines', () => {
  const text = '{"tool":"navigate_to","args":{"slug":"events"}}\n\n{"tool":"get_risk_now","args":{}}';
  const r = tools.parseToolCalls(text);
  assert.equal(r.toolCalls?.length, 2);
  assert.equal(r.toolCalls[0].tool, 'navigate_to');
  assert.equal(r.toolCalls[1].tool, 'get_risk_now');
});

test('parseToolCalls leaves clean text trimmed when blocks were the whole message', () => {
  const r = tools.parseToolCalls('{"tool":"navigate_to","args":{"slug":"events"}}');
  assert.equal(r.cleanText, '');
});

// ── parseCitations ────────────────────────────────────────────────

test('parseCitations returns null when no markers', () => {
  assert.equal(tools.parseCitations('Plain answer with no markers.'), null);
});

test('parseCitations extracts a single FAQ citation', () => {
  const c = tools.parseCitations('Per the FAQ [FAQ#42], coordinators meet quarterly.');
  assert.equal(c.length, 1);
  assert.equal(c[0].kind, 'faq');
  assert.equal(c[0].faqId, '42');
  assert.equal(c[0].label, 'FAQ #42');
});

test('parseCitations dedupes repeated FAQ ids', () => {
  const c = tools.parseCitations('See [FAQ#7] for kits. Also [FAQ#7] mentions water.');
  assert.equal(c.length, 1);
});

test('parseCitations extracts News citations and dedupes by source', () => {
  const c = tools.parseCitations('KPBS reported [News: KPBS]. Times of San Diego echoed [News: Times of San Diego]. KPBS again [News: kpbs].');
  // 'KPBS' and 'kpbs' should dedupe (case-insensitive); two unique sources
  assert.equal(c.length, 2);
  assert.equal(c[0].kind, 'news');
  assert.ok(c.some(x => x.label === 'KPBS'));
  assert.ok(c.some(x => x.label === 'Times of San Diego'));
});

test('parseCitations mixes FAQ + News in one response', () => {
  const c = tools.parseCitations('See [FAQ#3] and [News: KPBS] for context.');
  assert.equal(c.length, 2);
  assert.equal(c[0].kind, 'faq');
  assert.equal(c[1].kind, 'news');
});

// ── classifyIntent ────────────────────────────────────────────────

test('classifyIntent: emergency keywords', () => {
  // The intent classifier is a fast first-pass; the deeper emergency
  // detector in emergency.js handles the long-tail patterns (fire on
  // my property, etc.). Tests cover the patterns this classifier owns.
  assert.equal(tools.classifyIntent('911 there is a fire')?.intent, 'emergency');
  assert.equal(tools.classifyIntent('I am evacuating now')?.intent, 'emergency');
  assert.equal(tools.classifyIntent('Smoke in my house')?.intent, 'emergency');
  assert.equal(tools.classifyIntent('Fire near my house')?.intent, 'emergency');
});

test('classifyIntent: navigation', () => {
  const r = tools.classifyIntent('open the events page');
  assert.equal(r.intent, 'navigate');
  assert.ok(r.slug.includes('events'));
});

test('classifyIntent: thanks', () => {
  assert.equal(tools.classifyIntent('thanks')?.intent, 'thanks');
  assert.equal(tools.classifyIntent('Thank you')?.intent, 'thanks');
  assert.equal(tools.classifyIntent('got it')?.intent, 'thanks');
});

test('classifyIntent: nothing matches → null', () => {
  assert.equal(tools.classifyIntent('What is the population of Poway?'), null);
  assert.equal(tools.classifyIntent(''), null);
  assert.equal(tools.classifyIntent('   '), null);
});

// ── slugToHref / slugLabel — navigate_to URL resolution ───────────
// Regression guard for the "navigate takes you to a 404" bug: the LLM
// emits human labels with spaces ("programs and services") or even the
// full "pages/… .html" path; these must resolve to a real URL, never a
// fabricated /pages/<spaces>.html that 404s.

test('slugToHref: canonical hyphenated slug', () => {
  assert.equal(tools.slugToHref('programs-and-services'), '/pages/programs-and-services.html');
  assert.equal(tools.slugToHref('contact'), '/pages/contact.html');
  assert.equal(tools.slugToHref('home'), '/');
});

test('slugToHref: spaced label normalizes (the actual bug)', () => {
  assert.equal(tools.slugToHref('programs and services'), '/pages/programs-and-services.html');
  assert.equal(tools.slugToHref('Programs and Services'), '/pages/programs-and-services.html');
  assert.equal(tools.slugToHref('Programs & Services'), '/pages/programs-and-services.html');
  assert.equal(tools.slugToHref('pages/programs and services.html'), '/pages/programs-and-services.html');
  assert.equal(tools.slugToHref('/pages/programs-and-services.html'), '/pages/programs-and-services.html');
});

test('slugToHref: aliases resolve to canonical pages', () => {
  assert.equal(tools.slugToHref('events'), '/pages/community-events-and-activities.html');
  assert.equal(tools.slugToHref('preparedness'), '/pages/preparedness-resources.html');
  assert.equal(tools.slugToHref('login'), '/pages/register.html');
  assert.equal(tools.slugToHref('neighborhood'), '/pages/find-your-neighborhood.html');
});

test('slugToHref: custom Jekyll permalinks (old code 404d these)', () => {
  assert.equal(tools.slugToHref('donate'), '/donation-form/');
  assert.equal(tools.slugToHref('role-quiz'), '/role-quiz/');
});

test('slugToHref: unknown slug falls back to home, never a 404 path', () => {
  const r = tools.slugToHref('some totally made up page name');
  assert.equal(r, '/');
  assert.ok(!/\s/.test(tools.slugToHref('a b c')), 'never emits a URL with spaces');
});

test('slugLabel: reads cleanly for known + normalized slugs', () => {
  assert.equal(tools.slugLabel('programs and services'), 'Programs & Services');
  assert.equal(tools.slugLabel('contact'), 'the Contact page');
  // empty slug now safely resolves to home (better default than a 404)
  assert.equal(tools.slugLabel(''), 'the home page');
  assert.equal(tools.slugToHref(''), '/');
});

console.log(`tools.test.mjs: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
