// Run: node assets/js/chatbot/render.test.mjs
//
// Pure unit tests for the markdown renderer. We don't exercise the DOM
// builder (it requires a browser) — just renderMarkdown + escape.
//
// The renderer is hand-rolled (see render.js comment block on why) so
// these tests pin down the exact behaviors we expect: escaping, links,
// bold/em, fenced code, headings, lists, blockquotes.

import assert from 'node:assert/strict';

// renderMarkdown is the only export we need; the rest of render.js
// reaches for `document` so we'll skip that path.
const { renderMarkdown, _escape } = await import('./render.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; }
  catch (e) {
    failed++;
    console.error(`  ✖ ${name}\n    ${e.message}`);
  }
}

test('empty input returns empty string', () => {
  assert.equal(renderMarkdown(''), '');
  assert.equal(renderMarkdown('   '), '');
  assert.equal(renderMarkdown(null), '');
});

test('plain paragraph wraps in <p>', () => {
  assert.equal(renderMarkdown('Hello world.'), '<p>Hello world.</p>');
});

test('escapes HTML in body text', () => {
  const out = renderMarkdown('A <script>alert(1)</script> B');
  assert.ok(!out.includes('<script>'), 'should escape <script>');
  assert.ok(out.includes('&lt;script&gt;'), 'should encode entities');
});

test('escapes HTML in inline code', () => {
  const out = renderMarkdown('Try `<img src=x>` to break things');
  assert.ok(!out.includes('<img'), 'must not allow raw HTML inside code');
  assert.ok(out.includes('<code>&lt;img src=x&gt;</code>'));
});

test('bold + italic recognized', () => {
  const out = renderMarkdown('This is **bold** and *italic* text.');
  assert.ok(out.includes('<strong>bold</strong>'));
  assert.ok(out.includes('<em>italic</em>'));
});

test('underscore variants for bold + italic', () => {
  const out = renderMarkdown('__bold__ and _italic_ here.');
  assert.ok(out.includes('<strong>bold</strong>'));
  assert.ok(out.includes('<em>italic</em>'));
});

test('explicit markdown link only allows safe schemes', () => {
  const ok = renderMarkdown('See [the docs](https://example.com/x).');
  assert.ok(ok.includes('href="https://example.com/x"'));
  assert.ok(ok.includes('target="_blank"'));
  // javascript: scheme rejected — the bracket-paren syntax shouldn't
  // become an <a> tag at all (the original text remains escaped).
  const bad = renderMarkdown('Click [me](javascript:alert(1)).');
  assert.ok(!/<a [^>]*href="javascript:/i.test(bad),
    'must NOT produce <a href="javascript:..."> link');
});

test('autolinks bare http(s) URLs', () => {
  const out = renderMarkdown('Visit https://example.com today.');
  assert.ok(out.includes('href="https://example.com"'));
});

test('does not double-wrap an already-linked URL', () => {
  const out = renderMarkdown('See [example](https://example.com).');
  // Only ONE <a tag for that URL
  const matches = out.match(/<a /g) || [];
  assert.equal(matches.length, 1);
});

test('fenced code block escapes contents', () => {
  const out = renderMarkdown('```\n<div>raw</div>\n```');
  assert.ok(out.includes('<pre><code'));
  assert.ok(out.includes('&lt;div&gt;raw&lt;/div&gt;'));
});

test('fenced code captures language tag', () => {
  const out = renderMarkdown('```js\nconst x = 1;\n```');
  assert.ok(out.includes('data-lang="js"'));
});

test('unordered list', () => {
  const out = renderMarkdown('- item one\n- item two');
  assert.ok(out.includes('<ul>'));
  assert.ok(out.includes('<li>item one</li>'));
  assert.ok(out.includes('<li>item two</li>'));
});

test('ordered list', () => {
  const out = renderMarkdown('1. first\n2. second');
  assert.ok(out.includes('<ol>'));
  assert.ok(out.includes('<li>first</li>'));
  assert.ok(out.includes('<li>second</li>'));
});

test('blockquote renders', () => {
  const out = renderMarkdown('> wisdom from the void');
  assert.ok(out.includes('<blockquote>'));
  assert.ok(out.includes('wisdom from the void'));
});

test('heading levels h3..h5 (markdown # → h3)', () => {
  // Renderer maps #/##/### → h3/h4/h5 (intentional understated heads)
  assert.ok(renderMarkdown('# top').includes('<h3>top</h3>'));
  assert.ok(renderMarkdown('## sub').includes('<h4>sub</h4>'));
  assert.ok(renderMarkdown('### inner').includes('<h5>inner</h5>'));
});

test('multiple paragraphs separated by blank lines', () => {
  const out = renderMarkdown('First paragraph.\n\nSecond paragraph.');
  const ps = (out.match(/<p>/g) || []).length;
  assert.equal(ps, 2);
});

test('_escape helper covers all five entity chars', () => {
  assert.equal(_escape('<a&b>"c\'d</a>'), '&lt;a&amp;b&gt;&quot;c&#39;d&lt;/a&gt;');
});

console.log(`render.test.mjs: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
