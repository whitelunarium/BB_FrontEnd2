// assets/js/admin/editor-v2-icons.js
// Inline SVG icon set for the v2 live theme editor.
// Style is "Lucide-flavored": 24x24 viewBox, currentColor stroke, 2px stroke,
// rounded line-caps. Self-contained (no CDN), so the editor works offline.
//
// Exports a single global `window.V2_ICONS`:
//   V2_ICONS.svg('hero')         → "<svg …>…</svg>"  for the hero section type
//   V2_ICONS.svg('action.delete') → ditto for the delete action chip
//   V2_ICONS.has('faq')          → true / false
//
// If a key is missing, returns a generic block icon so callers can render
// optimistically without if-checks.

(function () {
  'use strict';

  // ── Section-type icons (one per cms_sections/<type>/) ──────────────────────
  const SECTION_ICONS = {
    // Hero — large rectangle with a horizontal "headline" bar
    hero: `
      <rect x="3" y="4"  width="18" height="16" rx="2"/>
      <line x1="7"  y1="10" x2="17" y2="10"/>
      <line x1="7"  y1="14" x2="13" y2="14"/>`,
    // Text block — three stacked lines
    text_block: `
      <line x1="4" y1="6"  x2="20" y2="6"/>
      <line x1="4" y1="12" x2="20" y2="12"/>
      <line x1="4" y1="18" x2="14" y2="18"/>`,
    // Image with text — image on the left, lines on the right
    image_with_text: `
      <rect x="3"  y="5" width="9"  height="14" rx="1"/>
      <circle cx="6.5" cy="9" r="1.2"/>
      <polyline points="3,16 7,12 12,17"/>
      <line x1="14" y1="8"  x2="21" y2="8"/>
      <line x1="14" y1="12" x2="21" y2="12"/>
      <line x1="14" y1="16" x2="19" y2="16"/>`,
    // FAQ — chat bubble with question mark
    faq: `
      <path d="M21 15a4 4 0 0 1-4 4H8l-5 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>
      <line x1="12" y1="13" x2="12" y2="13.01"/>
      <path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-3 2-3 4"/>`,
    // CTA banner — arrow inside a banner
    cta_banner: `
      <rect x="3" y="6" width="18" height="12" rx="2"/>
      <line x1="8"  y1="12" x2="16" y2="12"/>
      <polyline points="13,9 16,12 13,15"/>`,
    // Gallery — 2x2 grid of thumbnails
    gallery: `
      <rect x="3"  y="3"  width="7" height="7" rx="1"/>
      <rect x="14" y="3"  width="7" height="7" rx="1"/>
      <rect x="3"  y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>`,
    // Card list — a row of three rectangles
    card_list: `
      <rect x="3"  y="6" width="5" height="12" rx="1"/>
      <rect x="9.5" y="6" width="5" height="12" rx="1"/>
      <rect x="16" y="6" width="5" height="12" rx="1"/>`,
    // Alert box — triangle with !
    alert_box: `
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9"  x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12" y2="17.01"/>`,
    // Quote — left double quote glyph
    quote: `
      <path d="M3 21c3 0 7-1 7-8V5H3v8h4c0 4-2 6-4 6z"/>
      <path d="M14 21c3 0 7-1 7-8V5h-7v8h4c0 4-2 6-4 6z"/>`,
    // Two column — vertical split
    two_column: `
      <rect x="3" y="4" width="8"  height="16" rx="1"/>
      <rect x="13" y="4" width="8" height="16" rx="1"/>`,
    // Video embed — play triangle in a frame
    video_embed: `
      <rect x="2" y="4"  width="20" height="16" rx="2"/>
      <polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"/>`,
    // Contact CTA — envelope
    contact_cta: `
      <rect x="3" y="5" width="18" height="14" rx="2"/>
      <polyline points="3,7 12,14 21,7"/>`,
    // Custom HTML — angle brackets
    custom_html: `
      <polyline points="8,7 3,12 8,17"/>
      <polyline points="16,7 21,12 16,17"/>
      <line x1="14" y1="5" x2="10" y2="19"/>`,
  };

  // ── Action-chip icons (used in tree row, ctx menu, bulk bar, etc.) ─────────
  const ACTION_ICONS = {
    rename: `
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z"/>`,
    visibility_show: `
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/>
      <circle cx="12" cy="12" r="3"/>`,
    visibility_hide: `
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/>
      <line x1="1" y1="1" x2="23" y2="23"/>`,
    duplicate: `
      <rect x="9"  y="9"  width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`,
    delete: `
      <polyline points="3,6 5,6 21,6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/>
      <path d="M14 11v6"/>
      <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>`,
    drag: `
      <circle cx="9"  cy="6" r="1"/>
      <circle cx="9"  cy="12" r="1"/>
      <circle cx="9"  cy="18" r="1"/>
      <circle cx="15" cy="6" r="1"/>
      <circle cx="15" cy="12" r="1"/>
      <circle cx="15" cy="18" r="1"/>`,
    move_up:    `<polyline points="18,15 12,9 6,15"/>`,
    move_down:  `<polyline points="6,9 12,15 18,9"/>`,
    copy:       `
      <rect x="9"  y="9"  width="13" height="13" rx="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>`,
    paste: `
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1"/>`,
    edit: `
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>`,
  };

  const GENERIC = `
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <line x1="3" y1="9"  x2="21" y2="9"/>`;

  function svg(key, opts) {
    opts = opts || {};
    const size = opts.size || 16;
    let inner = null;
    if (key && key.indexOf('action.') === 0) {
      inner = ACTION_ICONS[key.slice('action.'.length)];
    } else {
      inner = SECTION_ICONS[key];
    }
    if (!inner) inner = GENERIC;
    return (
      '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '"' +
      ' fill="none" stroke="currentColor" stroke-width="2"' +
      ' stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      inner +
      '</svg>'
    );
  }

  function has(key) {
    if (key && key.indexOf('action.') === 0) return !!ACTION_ICONS[key.slice('action.'.length)];
    return !!SECTION_ICONS[key];
  }

  // ── Wireframe previews — schematic SVG of what each section type renders ──
  // Used in the picker hover popover. ViewBox is 200x120 so it sits cleanly
  // in a card-sized preview tile. Stroke-only, currentColor for theming.
  const WIREFRAMES = {
    hero: `
      <rect x="3" y="3" width="194" height="114" rx="6" fill="rgba(91,140,255,0.06)"/>
      <rect x="40" y="40" width="120" height="14" rx="2" fill="rgba(91,140,255,0.45)"/>
      <rect x="55" y="62" width="90"  height="8"  rx="2" fill="rgba(255,255,255,0.20)"/>
      <rect x="78" y="80" width="44"  height="14" rx="7" fill="rgba(168,85,247,0.65)"/>`,
    text_block: `
      <rect x="3" y="3" width="194" height="114" rx="6" fill="rgba(91,140,255,0.04)"/>
      <rect x="20" y="22" width="160" height="10" rx="2" fill="rgba(255,255,255,0.30)"/>
      <rect x="20" y="40" width="160" height="6"  rx="2" fill="rgba(255,255,255,0.16)"/>
      <rect x="20" y="52" width="160" height="6"  rx="2" fill="rgba(255,255,255,0.16)"/>
      <rect x="20" y="64" width="120" height="6"  rx="2" fill="rgba(255,255,255,0.16)"/>
      <rect x="20" y="80" width="160" height="6"  rx="2" fill="rgba(255,255,255,0.16)"/>
      <rect x="20" y="92" width="100" height="6"  rx="2" fill="rgba(255,255,255,0.16)"/>`,
    image_with_text: `
      <rect x="3" y="3" width="194" height="114" rx="6" fill="rgba(91,140,255,0.04)"/>
      <rect x="14" y="14" width="78" height="92" rx="4" fill="rgba(91,140,255,0.30)"/>
      <circle cx="36" cy="38" r="6" fill="rgba(255,255,255,0.50)"/>
      <polyline points="14,98 30,80 50,90 70,72 92,90 92,106 14,106" fill="rgba(255,255,255,0.18)"/>
      <rect x="104" y="22" width="80" height="10" rx="2" fill="rgba(255,255,255,0.40)"/>
      <rect x="104" y="40" width="80" height="6"  rx="2" fill="rgba(255,255,255,0.18)"/>
      <rect x="104" y="52" width="80" height="6"  rx="2" fill="rgba(255,255,255,0.18)"/>
      <rect x="104" y="64" width="56" height="6"  rx="2" fill="rgba(255,255,255,0.18)"/>
      <rect x="104" y="84" width="40" height="12" rx="6" fill="rgba(168,85,247,0.55)"/>`,
    faq: `
      <rect x="3" y="3" width="194" height="114" rx="6" fill="rgba(91,140,255,0.04)"/>
      <rect x="14" y="14" width="172" height="22" rx="4" fill="rgba(91,140,255,0.18)"/>
      <text x="22" y="30" font-size="10" fill="rgba(255,255,255,0.6)">Q · How do I sign up?</text>
      <rect x="14" y="44" width="172" height="22" rx="4" fill="rgba(91,140,255,0.10)"/>
      <text x="22" y="60" font-size="10" fill="rgba(255,255,255,0.4)">Q · When are events?</text>
      <rect x="14" y="74" width="172" height="22" rx="4" fill="rgba(91,140,255,0.10)"/>
      <text x="22" y="90" font-size="10" fill="rgba(255,255,255,0.4)">Q · Who is this for?</text>`,
    cta_banner: `
      <rect x="3" y="3" width="194" height="114" rx="6" fill="rgba(168,85,247,0.18)"/>
      <rect x="30" y="36" width="140" height="12" rx="2" fill="rgba(255,255,255,0.45)"/>
      <rect x="50" y="56" width="100" height="6"  rx="2" fill="rgba(255,255,255,0.25)"/>
      <rect x="74" y="78" width="52"  height="14" rx="7" fill="rgba(255,255,255,0.85)"/>`,
    gallery: `
      <rect x="3" y="3" width="194" height="114" rx="6" fill="rgba(91,140,255,0.04)"/>
      <rect x="14" y="14" width="56" height="44" rx="3" fill="rgba(91,140,255,0.30)"/>
      <rect x="76" y="14" width="56" height="44" rx="3" fill="rgba(91,140,255,0.30)"/>
      <rect x="138" y="14" width="48" height="44" rx="3" fill="rgba(91,140,255,0.30)"/>
      <rect x="14" y="64" width="56" height="44" rx="3" fill="rgba(91,140,255,0.30)"/>
      <rect x="76" y="64" width="56" height="44" rx="3" fill="rgba(91,140,255,0.30)"/>
      <rect x="138" y="64" width="48" height="44" rx="3" fill="rgba(91,140,255,0.30)"/>`,
    card_list: `
      <rect x="3" y="3" width="194" height="114" rx="6" fill="rgba(91,140,255,0.04)"/>
      <rect x="14" y="20" width="54" height="80" rx="4" fill="rgba(91,140,255,0.16)"/>
      <rect x="20" y="28" width="42" height="22" rx="2" fill="rgba(91,140,255,0.32)"/>
      <rect x="20" y="56" width="42" height="6"  rx="1" fill="rgba(255,255,255,0.30)"/>
      <rect x="73" y="20" width="54" height="80" rx="4" fill="rgba(91,140,255,0.16)"/>
      <rect x="79" y="28" width="42" height="22" rx="2" fill="rgba(91,140,255,0.32)"/>
      <rect x="79" y="56" width="42" height="6"  rx="1" fill="rgba(255,255,255,0.30)"/>
      <rect x="132" y="20" width="54" height="80" rx="4" fill="rgba(91,140,255,0.16)"/>
      <rect x="138" y="28" width="42" height="22" rx="2" fill="rgba(91,140,255,0.32)"/>
      <rect x="138" y="56" width="42" height="6"  rx="1" fill="rgba(255,255,255,0.30)"/>`,
    alert_box: `
      <rect x="3" y="3" width="194" height="114" rx="6" fill="rgba(251,191,36,0.10)"/>
      <rect x="20" y="40" width="160" height="40" rx="6" fill="rgba(251,191,36,0.22)" stroke="rgba(251,191,36,0.65)" stroke-width="1.5"/>
      <circle cx="38" cy="60" r="8" fill="rgba(251,191,36,0.85)"/>
      <text x="35" y="64" font-size="12" font-weight="bold" fill="#1e3a8a">!</text>
      <rect x="56" y="50" width="110" height="6"  rx="2" fill="rgba(255,255,255,0.5)"/>
      <rect x="56" y="62" width="80"  height="5"  rx="2" fill="rgba(255,255,255,0.3)"/>`,
    quote: `
      <rect x="3" y="3" width="194" height="114" rx="6" fill="rgba(91,140,255,0.04)"/>
      <text x="20" y="56" font-size="48" fill="rgba(168,85,247,0.45)">“</text>
      <rect x="50" y="34" width="130" height="6" rx="2" fill="rgba(255,255,255,0.40)"/>
      <rect x="50" y="46" width="130" height="6" rx="2" fill="rgba(255,255,255,0.40)"/>
      <rect x="50" y="58" width="100" height="6" rx="2" fill="rgba(255,255,255,0.40)"/>
      <rect x="50" y="80" width="50"  height="5" rx="2" fill="rgba(168,85,247,0.55)"/>`,
    two_column: `
      <rect x="3" y="3" width="194" height="114" rx="6" fill="rgba(91,140,255,0.04)"/>
      <rect x="14" y="14" width="84" height="92" rx="4" fill="rgba(91,140,255,0.20)"/>
      <rect x="22" y="22" width="68" height="6" rx="1" fill="rgba(255,255,255,0.4)"/>
      <rect x="22" y="34" width="60" height="4" rx="1" fill="rgba(255,255,255,0.25)"/>
      <rect x="22" y="42" width="60" height="4" rx="1" fill="rgba(255,255,255,0.25)"/>
      <rect x="102" y="14" width="84" height="92" rx="4" fill="rgba(168,85,247,0.20)"/>
      <rect x="110" y="22" width="68" height="6" rx="1" fill="rgba(255,255,255,0.4)"/>
      <rect x="110" y="34" width="60" height="4" rx="1" fill="rgba(255,255,255,0.25)"/>
      <rect x="110" y="42" width="60" height="4" rx="1" fill="rgba(255,255,255,0.25)"/>`,
    video_embed: `
      <rect x="3" y="3" width="194" height="114" rx="6" fill="rgba(91,140,255,0.04)"/>
      <rect x="20" y="14" width="160" height="92" rx="4" fill="#0b1220"/>
      <polygon points="86,46 116,60 86,74" fill="rgba(255,255,255,0.85)"/>
      <rect x="40" y="98" width="120" height="2" fill="rgba(255,255,255,0.45)"/>`,
    contact_cta: `
      <rect x="3" y="3" width="194" height="114" rx="6" fill="rgba(91,140,255,0.10)"/>
      <rect x="20" y="20" width="160" height="80" rx="6" fill="rgba(91,140,255,0.30)"/>
      <rect x="34" y="34" width="80" height="8" rx="2" fill="rgba(255,255,255,0.5)"/>
      <rect x="34" y="50" width="60" height="6" rx="2" fill="rgba(255,255,255,0.35)"/>
      <rect x="34" y="74" width="50" height="14" rx="7" fill="rgba(168,85,247,0.65)"/>`,
    custom_html: `
      <rect x="3" y="3" width="194" height="114" rx="6" fill="rgba(91,140,255,0.04)"/>
      <text x="20" y="34" font-size="11" font-family="ui-monospace,monospace" fill="rgba(91,140,255,0.7)">&lt;div class="custom"&gt;</text>
      <text x="32" y="52" font-size="11" font-family="ui-monospace,monospace" fill="rgba(255,255,255,0.55)">&lt;h2&gt;Hello&lt;/h2&gt;</text>
      <text x="32" y="70" font-size="11" font-family="ui-monospace,monospace" fill="rgba(255,255,255,0.55)">&lt;p&gt;World&lt;/p&gt;</text>
      <text x="20" y="92" font-size="11" font-family="ui-monospace,monospace" fill="rgba(91,140,255,0.7)">&lt;/div&gt;</text>`,
  };
  function wireframe(key) {
    const inner = WIREFRAMES[key];
    if (!inner) return '';
    return (
      '<svg viewBox="0 0 200 120" width="100%" height="100%"' +
      ' xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + inner + '</svg>'
    );
  }
  function hasWireframe(key) { return !!WIREFRAMES[key]; }

  window.V2_ICONS = { svg, has, wireframe, hasWireframe };
})();
