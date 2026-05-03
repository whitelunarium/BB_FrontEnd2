// assets/js/cms/hydrate.test.mjs
// Pure-function tests for hydrate.js — runs under Node with no browser.

import assert from 'node:assert/strict';

globalThis.window = globalThis;
globalThis.location = { search: '', origin: 'http://localhost:4000', hostname: 'localhost' };
globalThis.document = {
  documentElement: { style: { setProperty: () => {} } },
  body: { classList: { add: () => {} }, dataset: {} },
  querySelectorAll: () => [],
  addEventListener: () => {},
  readyState: 'complete',
};

globalThis.PNEC_CMS_TEST = true;
await import('./hydrate.js');

const { applyValue, parsePreviewMessage } = globalThis.__pnecCmsTestExports;

const { applySectionTemplate, parseV2Message } = globalThis.__pnecCmsTestExports;

// applyValue dispatch
{
  const img = { tagName: 'IMG', src: 'old.jpg', dataset: {} };
  applyValue(img, 'new.jpg');
  assert.equal(img.src, 'new.jpg', 'IMG → src');
}
{
  const div = { tagName: 'DIV', dataset: { cmsHtml: 'true' }, innerHTML: 'old', textContent: 'old' };
  applyValue(div, '<b>new</b>');
  assert.equal(div.innerHTML, '<b>new</b>', 'data-cms-html=true → innerHTML');
}
{
  const span = { tagName: 'SPAN', dataset: {}, innerHTML: 'old', textContent: 'old' };
  applyValue(span, 'new');
  assert.equal(span.textContent, 'new', 'default → textContent');
  assert.equal(span.innerHTML, 'old', 'default does NOT set innerHTML');
}

// parsePreviewMessage origin + type guards
const goodOrigin = 'http://localhost:4000';
assert.deepEqual(
  parsePreviewMessage({ origin: goodOrigin, data: { type: 'cms-update', kind: 'config', key: 'k', value: 'v' } }, goodOrigin),
  { kind: 'config', key: 'k', value: 'v' },
  'good origin + good type → parsed'
);
assert.equal(
  parsePreviewMessage({ origin: 'http://evil.example', data: { type: 'cms-update', kind: 'config', key: 'k', value: 'v' } }, goodOrigin),
  null,
  'bad origin → null'
);
assert.equal(
  parsePreviewMessage({ origin: goodOrigin, data: { type: 'something-else' } }, goodOrigin),
  null,
  'wrong type → null'
);
assert.equal(
  parsePreviewMessage({ origin: goodOrigin, data: null }, goodOrigin),
  null,
  'null data → null'
);

// v2: applySectionTemplate fills host innerHTML in `order`
{
  const html = [];
  const host = {
    set innerHTML(v) { this._html = v; html.push(v); },
    get innerHTML() { return this._html || ''; },
  };
  // Stub document.dispatchEvent so the load events don't break under Node
  const oldDoc = globalThis.document;
  globalThis.document = Object.assign(oldDoc || {}, {
    dispatchEvent: () => true,
  });
  applySectionTemplate(host, { order: ['a', 'b'] }, { a: '<div id="a">A</div>', b: '<div id="b">B</div>' });
  assert.equal(host.innerHTML, '<div id="a">A</div><div id="b">B</div>', 'sections joined in order');
  globalThis.document = oldDoc;
}

// v2: parseV2Message accepts cms:* types only
{
  const okOrigin = 'http://localhost:4000';
  assert.deepEqual(
    parseV2Message({ origin: okOrigin, data: { type: 'cms:section:rerender', page: 'home', sectionId: 'x' } }, okOrigin),
    { type: 'cms:section:rerender', page: 'home', sectionId: 'x' },
    'cms:* message parsed'
  );
  assert.equal(parseV2Message({ origin: 'http://evil', data: { type: 'cms:section:rerender' } }, okOrigin), null,
    'bad origin → null');
  assert.equal(parseV2Message({ origin: okOrigin, data: { type: 'unrelated' } }, okOrigin), null,
    'non-cms type → null');
  assert.equal(parseV2Message({ origin: okOrigin, data: null }, okOrigin), null,
    'null data → null');
}

// v2.1: stega encode/decode round trip (constants must match Python)
{
  const ZWSP = '​', ZWNJ = '‌';
  const SENTINEL = ZWNJ + ZWSP + ZWNJ + ZWSP;
  function encode(payload, text) {
    const json = JSON.stringify(payload);
    const bytes = new TextEncoder().encode(json);
    let bits = '';
    for (const b of bytes) bits += b.toString(2).padStart(8, '0');
    let enc = '';
    for (const c of bits) enc += c === '0' ? ZWSP : ZWNJ;
    return SENTINEL + enc + text;
  }
  // The decoder lives inside hydrate.js but isn't exported. We re-derive it
  // here for a sanity test of the encoding format.
  function decode(text) {
    if (!text.startsWith(SENTINEL)) return null;
    let rest = text.slice(SENTINEL.length);
    const bytes = [];
    let i = 0;
    while (i + 8 <= rest.length) {
      const chunk = rest.slice(i, i + 8);
      if (!/^[​‌]+$/.test(chunk)) break;
      let byte = 0;
      for (let j = 0; j < 8; j++) {
        byte = (byte << 1) | (chunk.charCodeAt(j) === 0x200C ? 1 : 0);
      }
      bytes.push(byte);
      i += 8;
    }
    const str = new TextDecoder('utf-8').decode(new Uint8Array(bytes));
    return JSON.parse(str);
  }
  const enc = encode({ sid: 'abc', field: 'headline' }, 'Hello world');
  assert.equal(enc.endsWith('Hello world'), true, 'stega: visible text preserved');
  assert.equal(enc.startsWith(SENTINEL), true, 'stega: sentinel prefix');
  assert.deepEqual(decode(enc), { sid: 'abc', field: 'headline' }, 'stega: round-trip');
  assert.equal(decode('plain text'), null, 'stega: plain text returns null');
}

console.log('hydrate.test.mjs: all assertions passed');
