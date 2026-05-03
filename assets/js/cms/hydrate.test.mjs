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

console.log('hydrate.test.mjs: all assertions passed');
