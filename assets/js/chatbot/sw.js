/* PNEC Helper Bot v3 — service worker (Phase 3 offline cache).
 *
 * Strategy:
 *   • Pre-cache the chatbot's JS, CSS, and the FAQ index on install.
 *   • Network-first for API calls (so live FAQ + news always fresh
 *     when online), with cache fallback when offline.
 *   • Stale-while-revalidate for the static assets so subsequent
 *     loads are instant.
 *
 * This SW is registered by index.js if registerServiceWorker option
 * fires. We keep it CONSERVATIVE — only chatbot assets are cached;
 * the rest of the site is left to its existing CDN/browser cache.
 */

// Bumping VERSION invalidates the cache on the next SW activation so
// returning users pick up new module code instead of serving stale.
const VERSION = 'pnec-bot-v3-8';
const STATIC_CACHE = `${VERSION}-static`;
const API_CACHE    = `${VERSION}-api`;

const STATIC_ASSETS = [
  '/assets/js/chatbot/index.js',
  '/assets/js/chatbot/store.js',
  '/assets/js/chatbot/render.js',
  '/assets/js/chatbot/api.js',
  '/assets/js/chatbot/prompt.js',
  '/assets/js/chatbot/suggestions.js',
  '/assets/js/chatbot/tools.js',
  '/assets/js/chatbot/voice.js',
  '/assets/js/chatbot/emergency.js',
  '/assets/js/chatbot/i18n.js',
  '/assets/js/chatbot/image.js',
  '/assets/js/chatbot/export.js',
  '/assets/css/chatbot.css',
  // v3.2: also cache the widget markup that chatbot-inject.js fetches
  // on standalone pages, so the bot still appears during outages.
  '/assets/chatbot/widget.html',
];

const API_PATTERNS = [
  /\/api\/faq\/items\b/,
  /\/api\/faq\/categories\b/,
  /\/api\/risk\/today\b/,
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(STATIC_ASSETS).catch(() => null))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Static — stale-while-revalidate
  if (STATIC_ASSETS.some(p => url.pathname === p)) {
    e.respondWith(swrCache(req, STATIC_CACHE));
    return;
  }
  // FAQ / risk — network-first with cache fallback
  if (API_PATTERNS.some(re => re.test(url.pathname))) {
    e.respondWith(networkFirst(req, API_CACHE));
    return;
  }
  // Everything else: pass through
});

async function swrCache(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchAndPut = fetch(req).then(res => {
    if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(() => null);
  return cached || fetchAndPut || new Response('', { status: 504 });
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch (_e) {
    const cached = await cache.match(req);
    return cached || new Response(JSON.stringify({ offline: true, items: [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }
}
