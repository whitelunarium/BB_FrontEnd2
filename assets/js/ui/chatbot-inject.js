// assets/js/ui/chatbot-inject.js
// Helper Bot v3 bootstrap for full-HTML pages.
//
// Most pages render through `_layouts/pnec-base.html`, which includes
// the chatbot widget markup AND loads the v3 ES module from
// /assets/js/chatbot/index.js. But the static cloned-WordPress pages
// (about.html, contact.html, programs-and-services.html, etc.) are
// raw HTML — they don't go through the Jekyll layout, so neither the
// widget markup NOR the v3 module is on the page.
//
// This file fixes that. It:
//   1. Sets window.PNEC_CHATBOT_CONFIG if the page hasn't already
//   2. Fetches the v3 widget markup from /assets/chatbot/widget.html
//   3. Injects it into <body>
//   4. Dynamic-imports /assets/js/chatbot/index.js as a module
//
// Idempotent: if v3 is already booted (#pnec-bot-fab present), exits.
// Defensive: if the fetch or import fails, fails quietly — no console
// spam.

(function () {
  'use strict';
  if (typeof document === 'undefined') return;

  // Already booted (Jekyll layout already included the widget + module)
  if (document.getElementById('pnec-bot-fab')) return;

  // 1. Default chatbot config when the page didn't set one.
  if (!window.PNEC_CHATBOT_CONFIG) {
    var host = window.location.hostname;
    var apiBase = (host === 'localhost' || host === '127.0.0.1')
      ? 'http://127.0.0.1:8425'
      : 'https://beasts.opencodingsociety.com';
    window.PNEC_CHATBOT_CONFIG = {
      apiBase: apiBase,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      endpoint: apiBase + '/api/gemini',
      newsEndpoint: apiBase + '/api/news/search',
      llmModuleUrl: '/assets/js/api/llm-chat.js'
    };
  }

  function bootWhenReady() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  }

  function boot() {
    // 2. Fetch the widget markup
    fetch('/assets/chatbot/widget.html', { credentials: 'omit' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (html) {
        if (!html || document.getElementById('pnec-bot-fab')) return;
        // 3. Inject into body
        var holder = document.createElement('div');
        holder.innerHTML = html;
        // Append children one by one so any <script> doesn't try to run
        // as part of innerHTML evaluation (we don't expect any, but
        // belt and suspenders).
        while (holder.firstChild) document.body.appendChild(holder.firstChild);

        // 4. Dynamic-import the v3 module. We add a stable suffix to
        // avoid an aggressive HTTP cache from a stale prior version.
        // Revert to original — index.js handles auto-open via window 'load'
        return import(/* webpackIgnore: true */ '/assets/js/chatbot/index.js')
          .then(function () {
            // Auto-open the panel after the module has booted.
            document.dispatchEvent(new CustomEvent('pnec-bot:auto-open'));
          });
      })
      .catch(function (err) {
        // Fail quiet — chatbot is enhancement, not critical-path
        try { console.warn('[chatbot-inject] bootstrap failed:', err && err.message); }
        catch (_e) { /* private mode etc. */ }
      });
  }

  bootWhenReady();
})();
