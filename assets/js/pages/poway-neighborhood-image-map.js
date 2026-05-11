/* assets/js/pages/poway-neighborhood-image-map.js
 * Interactive PNEC Neighborhood Map (v1, May 2026)
 *
 * Controller for the interactive overlay declared in
 * _includes/poway-neighborhood-map.html. Responsibilities:
 *   1. Fetch /assets/data/poway-neighborhoods.json
 *   2. Inject one focusable <circle> hotspot per neighborhood into the
 *      SVG overlay, at its normalized x,y position.
 *   3. Wire hover/click/keyboard handlers so:
 *        - hover (desktop) → tooltip with the neighborhood name
 *        - hover           → side panel preview (no lock)
 *        - click           → side panel locks to that neighborhood,
 *                            #hash updated, focus moves to panel
 *        - Esc             → clears the lock, returns to empty state
 *        - Tab/Shift-Tab   → walk the hotspots in numeric order
 *   4. Address/street/name search:
 *        - matches against name + key_streets array
 *        - on match, scrolls hotspot into view + pulses it for 4s
 *
 * Browser support:
 *   - Modern evergreen + iOS Safari 14+, Android Chrome 90+. No IE.
 *   - SVG, fetch, optional chaining, ResizeObserver.
 *
 * Performance:
 *   - One JSON fetch per page load (no streaming).
 *   - 60 SVG circles is trivial. No virtual list needed.
 *   - Tooltip + panel updates via direct DOM mutation, no framework.
 */

(function () {
  'use strict';

  const cfg = window.PNEC_NMAP_CONFIG || {};
  const DATA_URL = cfg.dataUrl || '/assets/data/poway-neighborhoods.json';

  /** State */
  let _data = null;            // full neighborhoods JSON
  let _activeId = null;        // locked neighborhood id (click), null if none
  let _hoverId = null;         // currently-hovered id, null if none
  let _hotspotEls = new Map(); // id → <circle>

  // ─── Boot ─────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', boot);

  function boot() {
    const root = document.getElementById('pnec-nmap');
    if (!root) return;  // include not on this page
    fetchData()
      .then((data) => {
        _data = data;
        renderHotspots();
        wireSearch();
        wireKeyboardEsc();
        wireHashJump();
        hideLoader();
      })
      .catch((err) => {
        // Failure mode: leave the static image visible, log + show notice.
        console.warn('[PNEC nmap] data load failed:', err);
        const stage = document.getElementById('pnec-nmap-stage');
        const loader = stage && stage.querySelector('.pnec-nmap-loader');
        if (loader) {
          loader.classList.remove('is-hidden');
          loader.innerHTML = '<div style="text-align:center;padding:14px;font-size:0.92rem;color:#5a6470;max-width:300px">' +
            "Couldn't load interactive overlay — the static map below is still accurate. " +
            'Email <a href="mailto:powaynec@gmail.com">powaynec@gmail.com</a> with your address to find your coordinator.' +
            '</div>';
        }
      });
  }

  function fetchData() {
    return fetch(DATA_URL, { credentials: 'same-origin' })
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      });
  }

  function hideLoader() {
    const loader = document.querySelector('.pnec-nmap-loader');
    if (loader) loader.classList.add('is-hidden');
  }

  // ─── Hotspot rendering ────────────────────────────────────────
  // v3.12: each neighborhood now has a `polygon` array of normalized
  // (x, y) points tracing its actual shape on the PNG. We render a
  // <polygon> per neighborhood and the whole region lights up on hover.
  // Falls back to a circle for any entry missing the polygon (e.g.
  // before the data is migrated).
  function renderHotspots() {
    const svg = document.getElementById('pnec-nmap-svg');
    if (!svg || !_data || !_data.neighborhoods) return;

    const W = (_data._meta && _data._meta.map_dimensions && _data._meta.map_dimensions.width) || 1376;
    const H = (_data._meta && _data._meta.map_dimensions && _data._meta.map_dimensions.height) || 1844;

    // Sort by number so Tab order matches the legend order.
    const sorted = _data.neighborhoods.slice().sort((a, b) => (a.number || 0) - (b.number || 0));

    sorted.forEach((n) => {
      // Build the SVG element — polygon if we have shape data, circle as fallback
      let el;
      if (Array.isArray(n.polygon) && n.polygon.length >= 3) {
        const points = n.polygon
          .map(([px, py]) => `${Math.round(px * W)},${Math.round(py * H)}`)
          .join(' ');
        el = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        el.setAttribute('points', points);
      } else {
        el = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        el.setAttribute('cx', Math.round(n.x * W));
        el.setAttribute('cy', Math.round(n.y * H));
        el.setAttribute('r', 36);
      }
      el.setAttribute('class', 'pnec-nmap-hotspot');
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('data-id', n.id);
      el.setAttribute('aria-label',
        `Neighborhood ${n.number}, ${n.name}, zone ${n.zone || 'unknown'}` +
        (n.wui ? ' — wildland-urban-interface area' : ''));

      // Mouse: hover preview, click lock.
      el.addEventListener('mouseenter', (ev) => {
        _hoverId = n.id;
        // Bring the hovered polygon to the top so its outline isn't
        // cut off by adjacent polygons. SVG uses painter's algorithm
        // — last sibling wins.
        if (el.parentNode) el.parentNode.appendChild(el);
        showTooltip(ev, n);
        if (_activeId == null) renderDetail(n);
      });
      el.addEventListener('mousemove', (ev) => positionTooltip(ev));
      el.addEventListener('mouseleave', () => {
        _hoverId = null;
        hideTooltip();
        if (_activeId == null) renderEmpty();
      });
      el.addEventListener('click', () => selectNeighborhood(n.id, { lockPanel: true, scroll: false }));

      // Keyboard: Enter or Space activates.
      el.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          selectNeighborhood(n.id, { lockPanel: true, scroll: false });
        }
      });
      el.addEventListener('focus', () => {
        if (_activeId == null) renderDetail(n);
      });

      svg.appendChild(el);
      _hotspotEls.set(n.id, el);
    });
  }

  // ─── Selection state ──────────────────────────────────────────
  function selectNeighborhood(id, opts) {
    opts = opts || {};
    const n = _data.neighborhoods.find((x) => x.id === id);
    if (!n) return;

    _activeId = id;

    // Update hotspot highlight
    _hotspotEls.forEach((el) => el.classList.remove('is-active'));
    const el = _hotspotEls.get(id);
    if (el) el.classList.add('is-active');

    renderDetail(n);

    // Sync URL hash so users can deep-link / share.
    if (history.replaceState) {
      history.replaceState(null, '', `#n${n.number}`);
    }

    // Optional smooth scroll into view (used by hash jump).
    if (opts.scroll) {
      const stage = document.getElementById('pnec-nmap-stage');
      if (stage) {
        const rect = stage.getBoundingClientRect();
        if (rect.top < 0 || rect.top > window.innerHeight - 200) {
          stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  }

  function clearSelection() {
    _activeId = null;
    _hotspotEls.forEach((el) => el.classList.remove('is-active'));
    renderEmpty();
    if (history.replaceState) history.replaceState(null, '', location.pathname + location.search);
  }

  // ─── Side panel rendering ─────────────────────────────────────
  function renderEmpty() {
    document.getElementById('pnec-nmap-panel-empty').hidden = false;
    document.getElementById('pnec-nmap-panel-detail').hidden = true;
  }

  function renderDetail(n) {
    const empty = document.getElementById('pnec-nmap-panel-empty');
    const detail = document.getElementById('pnec-nmap-panel-detail');
    if (!empty || !detail) return;

    empty.hidden = true;
    detail.hidden = false;

    const protocol = (_data && _data.global_protocol) || {};
    const zoneColor = n.color || zoneColorFallback(n.zone);
    const zoneLabels = {
      A: 'Zone A — Wildland-Urban Interface (highest fire risk)',
      B: 'Zone B — Adjacent fuel',
      C: 'Zone C — Neighborhood interior',
      D: 'Zone D — Deep urban / commercial',
    };
    const fhszColors = {
      'Very High': '#c0392b',
      'High':      '#e07a3f',
      'Moderate':  '#d4a04c',
    };
    const fhszColor = fhszColors[n.fhsz] || '#7a6a4a';
    const subjectFilled = (protocol.request_subject || '').replace('{{number}}', String(n.number));

    // v3.13: build the contact-protocol mailto with body pre-filled
    const cp = n.contact_protocol || {};
    const mailtoUrl = `mailto:${encodeURIComponent(cp.address || 'powaynec@gmail.com')}` +
                     `?subject=${encodeURIComponent(cp.subject || subjectFilled || 'NEC contact request')}` +
                     `&body=${encodeURIComponent(cp.body || '')}`;

    detail.innerHTML = `
      <button type="button" class="panel-close" aria-label="Close detail panel">×</button>
      <div class="num-pill" style="--zone-color:${zoneColor}">
        <span class="num-circle">${escapeHtml(String(n.number))}</span>
        Neighborhood
      </div>
      <h3>${escapeHtml(n.name)}</h3>
      <div class="zone-line">
        <span class="zone-badge" style="--zone-color:${zoneColor}">${escapeHtml(n.zone || '?')}</span>
        <span>${escapeHtml(zoneLabels[n.zone] || 'Zone unknown')}</span>
        ${n.wui ? '<span class="wui-flag" title="Wildland-urban interface">WUI</span>' : ''}
      </div>

      ${n.fhsz ? `
        <div class="pnec-nmap-section">
          <h4>🔥 CAL FIRE hazard zone</h4>
          <p>
            <span class="fhsz-badge" style="--fhsz-color:${fhszColor}">${escapeHtml(n.fhsz)} FHSZ</span>
          </p>
          ${n.fhsz_advice ? `<p style="margin-top:6px;">${escapeHtml(n.fhsz_advice)}</p>` : ''}
        </div>` : ''}

      ${(n.key_streets && n.key_streets.length) ? `
        <div class="pnec-nmap-section">
          <h4>📍 Key streets</h4>
          <ul class="street-list">${n.key_streets.map((s) =>
            `<li class="street-pill">${escapeHtml(s)}</li>`
          ).join('')}</ul>
        </div>` : ''}

      ${n.evac_guidance ? `
        <div class="pnec-nmap-section">
          <h4>🧭 Evacuation guidance</h4>
          <p>${escapeHtml(n.evac_guidance)}</p>
        </div>` : ''}

      ${n.notes ? `
        <div class="pnec-nmap-section">
          <h4>📌 Local notes</h4>
          <p>${escapeHtml(n.notes)}</p>
        </div>` : ''}

      ${n.nearest_fire_station ? `
        <div class="pnec-nmap-section">
          <h4>🚒 Closest fire station</h4>
          <p>
            <strong>${escapeHtml(n.nearest_fire_station.name)}</strong> — ${escapeHtml(n.nearest_fire_station.cover)}<br>
            <span style="color:#5a6470;">${escapeHtml(n.nearest_fire_station.address)}</span><br>
            Non-emergency: <a href="tel:${escapeAttr((n.nearest_fire_station.phone_non_emergency || '').replace(/[^\\d]/g,''))}">${escapeHtml(n.nearest_fire_station.phone_non_emergency || '')}</a>
            &middot; <strong>Emergency: <a href="tel:911">911</a></strong>
          </p>
        </div>` : ''}

      ${n.nearest_hospital ? `
        <div class="pnec-nmap-section">
          <h4>🏥 Closest ER</h4>
          <p>
            <strong>${escapeHtml(n.nearest_hospital.name)}</strong><br>
            <span style="color:#5a6470;">${escapeHtml(n.nearest_hospital.address)}</span><br>
            ${escapeHtml(n.nearest_hospital.er || '')} ·
            <a href="tel:${escapeAttr((n.nearest_hospital.phone || '').replace(/[^\\d]/g,''))}">${escapeHtml(n.nearest_hospital.phone || '')}</a>
          </p>
        </div>` : ''}

      ${n.nearest_cooling_center ? `
        <div class="pnec-nmap-section">
          <h4>❄️ Closest cooling center</h4>
          <p>
            <strong>${escapeHtml(n.nearest_cooling_center.name)}</strong><br>
            <span style="color:#5a6470;">${escapeHtml(n.nearest_cooling_center.address)}</span><br>
            <a href="tel:${escapeAttr((n.nearest_cooling_center.phone || '').replace(/[^\\d]/g,''))}">${escapeHtml(n.nearest_cooling_center.phone || '')}</a>
            ${n.nearest_cooling_center.note ? ` · <span style="color:#5a6470;">${escapeHtml(n.nearest_cooling_center.note)}</span>` : ''}
          </p>
        </div>` : ''}

      <div class="pnec-nmap-section pnec-nmap-section--accent">
        <h4>📞 Get your NEC + ham operator contact</h4>
        <p>For privacy, PNEC publishes coordinator info by <strong>email request only</strong>. Your neighborhood number <strong>#${escapeHtml(String(n.number))}</strong> is already in the email subject so volunteers can route you fast (1–2 day reply).</p>
        <a class="pnec-nmap-cta" href="${mailtoUrl}">
          Email PNEC for my coordinator →
        </a>
      </div>

      ${n.block_party ? `
        <div class="pnec-nmap-section">
          <h4>🎉 Disaster Ready Block Party</h4>
          <p>${escapeHtml(n.block_party.pitch || '')}</p>
        </div>` : ''}

      ${n.quick_contacts ? `
        <div class="pnec-nmap-section">
          <h4>🚨 Emergency quick contacts</h4>
          <ul class="quick-contact-list">
            <li><strong>Emergency</strong> <a href="tel:911">911</a></li>
            <li><strong>Sheriff non-emergency</strong> <a href="tel:${(n.quick_contacts.sheriff_non_emergency || '').replace(/[^\\d]/g,'')}">${escapeHtml(n.quick_contacts.sheriff_non_emergency)}</a></li>
            <li><strong>PNEC homebound helpline</strong> <a href="tel:${(n.quick_contacts.pnec_homebound || '').replace(/[^\\d]/g,'')}">${escapeHtml(n.quick_contacts.pnec_homebound)}</a></li>
            <li><strong>211 San Diego</strong> <a href="tel:211">211</a> (or <a href="tel:8583001211">858-300-1211</a>)</li>
            <li><strong>Alert San Diego (register)</strong> <a href="${escapeAttr(n.quick_contacts.alert_san_diego)}" target="_blank" rel="noopener">readysandiego.org</a></li>
            <li><strong>SDG&amp;E PSPS status</strong> <a href="${escapeAttr(n.quick_contacts.sdge_psps)}" target="_blank" rel="noopener">sdge.com/psps</a></li>
          </ul>
        </div>` : ''}
    `;

    const closeBtn = detail.querySelector('.panel-close');
    if (closeBtn) closeBtn.addEventListener('click', clearSelection);
  }

  function zoneColorFallback(zone) {
    return { A: '#c0392b', B: '#e67e22', C: '#f1c40f', D: '#27ae60' }[zone] || '#1e8449';
  }

  // ─── Tooltip ──────────────────────────────────────────────────
  let _tooltipEl = null;
  function getTooltip() {
    if (_tooltipEl) return _tooltipEl;
    _tooltipEl = document.createElement('div');
    _tooltipEl.className = 'pnec-nmap-tooltip';
    _tooltipEl.setAttribute('aria-hidden', 'true');
    const stage = document.getElementById('pnec-nmap-stage');
    if (stage) stage.appendChild(_tooltipEl);
    return _tooltipEl;
  }
  function showTooltip(ev, n) {
    const t = getTooltip();
    t.innerHTML = `<strong>#${escapeHtml(String(n.number))}</strong> · ${escapeHtml(n.name)}`;
    t.classList.add('is-visible');
    positionTooltip(ev);
  }
  function hideTooltip() {
    const t = getTooltip();
    t.classList.remove('is-visible');
  }
  function positionTooltip(ev) {
    const t = getTooltip();
    const stage = document.getElementById('pnec-nmap-stage');
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    t.style.left = `${x}px`;
    t.style.top = `${y}px`;
  }

  // ─── Search ───────────────────────────────────────────────────
  function wireSearch() {
    const form = document.querySelector('.pnec-nmap-search');
    const input = document.getElementById('pnec-nmap-q');
    if (!form || !input) return;
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      runSearch(input.value || '');
    });
    // Live highlight as user types (debounced).
    let t;
    input.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => previewSearch(input.value || ''), 250);
    });
  }

  function previewSearch(q) {
    // Remove old preview pulses.
    _hotspotEls.forEach((el) => el.classList.remove('is-search-match'));
    if (!q || q.length < 2) return;
    const matches = findMatches(q);
    matches.slice(0, 5).forEach((m) => {
      const el = _hotspotEls.get(m.id);
      if (el) el.classList.add('is-search-match');
    });
  }

  function runSearch(q) {
    if (!q.trim()) return;
    const matches = findMatches(q);
    if (!matches.length) {
      showSearchEmptyState(q);
      return;
    }
    const top = matches[0];
    selectNeighborhood(top.id, { lockPanel: true, scroll: true });
    // Pulse all matches briefly to show alternates.
    _hotspotEls.forEach((el) => el.classList.remove('is-search-match'));
    matches.slice(0, 5).forEach((m) => {
      const el = _hotspotEls.get(m.id);
      if (el) el.classList.add('is-search-match');
    });
    setTimeout(() => {
      _hotspotEls.forEach((el) => el.classList.remove('is-search-match'));
    }, 4000);
  }

  function findMatches(q) {
    const norm = String(q).trim().toLowerCase();
    if (!norm) return [];
    return _data.neighborhoods
      .map((n) => ({ neighborhood: n, score: matchScore(n, norm) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.neighborhood);
  }

  function matchScore(n, q) {
    let s = 0;
    const name = (n.name || '').toLowerCase();
    if (name === q) s += 100;
    if (name.startsWith(q)) s += 40;
    if (name.includes(q)) s += 20;
    // Number match (e.g. "23" → neighborhood #23)
    const num = parseInt(q, 10);
    if (!Number.isNaN(num) && n.number === num) s += 80;
    // Street keyword match
    (n.key_streets || []).forEach((street) => {
      const lower = street.toLowerCase();
      if (lower === q) s += 60;
      if (lower.startsWith(q)) s += 25;
      if (lower.includes(q)) s += 12;
    });
    // Loose token match (any 4+ char word)
    if (q.length >= 4) {
      q.split(/\s+/).forEach((tok) => {
        if (tok.length >= 4 && name.includes(tok)) s += 6;
      });
    }
    return s;
  }

  function showSearchEmptyState(q) {
    const detail = document.getElementById('pnec-nmap-panel-detail');
    const empty = document.getElementById('pnec-nmap-panel-empty');
    if (!detail || !empty) return;
    empty.hidden = true;
    detail.hidden = false;
    detail.innerHTML = `
      <button type="button" class="panel-close" aria-label="Close detail panel">×</button>
      <h3 style="margin-top:0">No match for "${escapeHtml(q)}"</h3>
      <p style="color:#5a6470;margin:6px 0 16px">Try a street name (e.g. "Espola", "Garden", "Twin Peaks"), a neighborhood name, or a number 1–60.</p>
      <a class="pnec-nmap-cta" href="mailto:powaynec@gmail.com?subject=${encodeURIComponent('Help finding my neighborhood')}&body=${encodeURIComponent('I searched for: ' + q)}">
        Email PNEC for help
      </a>
    `;
    const closeBtn = detail.querySelector('.panel-close');
    if (closeBtn) closeBtn.addEventListener('click', clearSelection);
  }

  // ─── Esc to close ────────────────────────────────────────────
  function wireKeyboardEsc() {
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && _activeId != null) {
        clearSelection();
      }
    });
  }

  // ─── Hash jump (deep-link support) ────────────────────────────
  function wireHashJump() {
    const m = /^#n(\d+)$/.exec(location.hash || '');
    if (!m) return;
    const num = parseInt(m[1], 10);
    const n = _data.neighborhoods.find((x) => x.number === num);
    if (n) {
      // Wait one frame so the SVG is laid out before scrolling.
      requestAnimationFrame(() => selectNeighborhood(n.id, { lockPanel: true, scroll: true }));
    }
  }

  // ─── HTML escape helpers ──────────────────────────────────────
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // Expose a tiny API for the chatbot tool dispatcher.
  window.PNEC_NMAP = {
    selectByNumber: (num) => {
      const n = _data && _data.neighborhoods.find((x) => x.number === num);
      if (n) selectNeighborhood(n.id, { lockPanel: true, scroll: true });
    },
    selectByQuery: runSearch,
    getData: () => _data,
  };
})();
