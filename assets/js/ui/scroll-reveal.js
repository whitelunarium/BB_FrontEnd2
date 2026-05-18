// assets/js/ui/scroll-reveal.js
// v2.41 — adds .is-in to any .pnec-reveal element when it enters the viewport.
// Pairs with the CSS in _sass/_polish.scss. Self-contained, no dependencies.
//
// Why opt-in via class instead of auto-applying to every section:
// - Keeps pages that don't want movement (forms, dashboards) unaffected.
// - Authors mark only the elements where the reveal is meaningful.
//
// As a friendly default, this script ALSO auto-applies the class to
// hero/feature-card style containers on the homepage and the cloned-WP
// section blocks, so the site feels alive immediately without per-page edits.

(function () {
  'use strict';
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  // Respect reduced-motion: just unhide everything immediately.
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Lightweight default selectors — extend by adding `pnec-reveal` in HTML.
  const AUTO_REVEAL_SELECTOR = [
    'section.elementor-section.elementor-top-section',
    '.feature-card',
    '.event-card',
    '.tile',
    '.profile-info-section',
    '.adm-panel',
  ].join(',');

  function applyAutoReveal() {
    document.querySelectorAll(AUTO_REVEAL_SELECTOR).forEach(el => {
      // Skip elements that are inside the chatbot/editor/navbar — they shouldn't fade in.
      if (el.closest('.chatbot-panel, #v2-shell, .pnec-navbar, footer, [data-cms-no-reveal]')) return;
      el.classList.add('pnec-reveal');
    });
  }

  function arm() {
    if (reduce) {
      // Mark everything visible immediately (CSS also does this via media query)
      document.querySelectorAll('.pnec-reveal').forEach(el => el.classList.add('is-in'));
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      document.querySelectorAll('.pnec-reveal').forEach(el => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.04 });

    document.querySelectorAll('.pnec-reveal:not(.is-in)').forEach(el => {
      // Already-visible elements (above the fold) — show immediately
      const r = el.getBoundingClientRect();
      if (r.top < (window.innerHeight || 800) - 60) {
        el.classList.add('is-in');
      } else {
        io.observe(el);
      }
    });
  }

  // v3.40: ultimate failsafe — on a fragile cloned site (flaky external
  // deps, occasional JS hiccups) a .pnec-reveal element must NEVER stay
  // invisible. If anything throws, or if any element is still hidden a
  // few seconds after load, force it visible. The on-scroll effect still
  // plays for above-the-fold + early-scroll content; this only guarantees
  // nothing is ever permanently blank.
  function revealAll() {
    try {
      document.querySelectorAll('.pnec-reveal:not(.is-in)')
        .forEach(function (el) { el.classList.add('is-in'); });
    } catch (e) { /* no-op */ }
  }

  function boot() {
    try {
      applyAutoReveal();
      arm();
    } catch (e) {
      revealAll();
      return;
    }
    setTimeout(revealAll, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  // Last-resort net: also reveal everything once the page fully loads
  // (covers a boot() that never ran for any reason).
  window.addEventListener('load', function () { setTimeout(revealAll, 3500); });
})();
