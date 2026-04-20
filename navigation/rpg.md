---
layout: pnec-base
title: "Emergency Preparedness RPG"
permalink: /rpg/latest
use_poway_live_styles: true
---

<style>
/* ── Embedded mode (iframe / ?embed=1) ────────────────────────────────────── */
.embedded .site-header,
.embedded .post-header,
.embedded .site-footer,
.embedded .page-description { display: none !important; }
.embedded body { margin: 0 !important; }
.embedded .page-content .wrapper { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
.embedded .page-content, .embedded .post-content, .embedded main, .embedded .page { margin: 0 !important; padding: 0 !important; }
html.embedded, html.embedded body { overflow: hidden !important; }
.embedded #rpg-sidebar,
.embedded #rpg-show-rules { display: none !important; }
.embedded #rpg-layout { height: 100vh !important; }
.embedded #gameContainer { height: 100vh !important; position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; }

/* ── Layout wrapper ───────────────────────────────────────────────────────── */
html, body { height: 100%; }

#rpg-layout {
    display: flex;
    align-items: stretch;
    height: 75vh;
    min-height: 480px;
    overflow: hidden;
    font-family: system-ui, -apple-system, sans-serif;
}

#rpg-layout.rpg-fullscreen {
    position: fixed !important;
    inset: 0 !important;
    height: 100dvh !important;
    z-index: 99999 !important;
    background: #000 !important;
}

/* ── Sidebar ──────────────────────────────────────────────────────────────── */
#rpg-sidebar {
    width: 300px;
    min-width: 300px;
    background: #0d1b2e;
    border-right: 1px solid #1e3a5f;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    transition: width 0.38s cubic-bezier(0.4,0,0.2,1),
                min-width 0.38s cubic-bezier(0.4,0,0.2,1),
                opacity 0.28s ease;
    scrollbar-width: thin;
    scrollbar-color: #1e3a5f transparent;
}
#rpg-sidebar::-webkit-scrollbar { width: 4px; }
#rpg-sidebar::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 4px; }

.rpg-fullscreen #rpg-sidebar {
    width: 0 !important;
    min-width: 0 !important;
    opacity: 0;
    pointer-events: none;
}

/* ── Sidebar inner content ────────────────────────────────────────────────── */
#rpg-sidebar-inner {
    padding: 18px 16px 24px;
    width: 300px; /* fixed so content doesn't reflow during collapse */
    min-width: 300px;
    box-sizing: border-box;
}

.rpg-logo {
    font-size: 32px;
    text-align: center;
    margin-bottom: 6px;
}
.rpg-title {
    color: #f1f5f9;
    font-size: 15px;
    font-weight: 800;
    text-align: center;
    margin: 0 0 4px;
    line-height: 1.3;
}
.rpg-tagline {
    color: #64748b;
    font-size: 11px;
    text-align: center;
    margin: 0 0 16px;
    line-height: 1.5;
}

.rpg-section-label {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.2px;
    color: #475569;
    text-transform: uppercase;
    margin: 14px 0 6px;
}

/* Controls */
.rpg-controls {
    background: rgba(255,255,255,0.04);
    border: 1px solid #1e3a5f;
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.rpg-ctrl-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #94a3b8;
}
.rpg-key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #1e293b;
    border: 1px solid #334155;
    border-bottom: 2px solid #475569;
    border-radius: 4px;
    padding: 2px 6px;
    font-size: 10px;
    font-weight: 700;
    color: #e2e8f0;
    min-width: 22px;
    text-align: center;
    font-family: monospace;
}
.rpg-key-group { display: flex; gap: 3px; }

/* Mission steps */
.rpg-missions {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.rpg-mission {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 7px;
    font-size: 12px;
    border: 1px solid transparent;
    transition: background 0.2s, border-color 0.2s;
}
.rpg-mission.locked {
    background: rgba(255,255,255,0.02);
    border-color: #1e293b;
    color: #475569;
}
.rpg-mission.active {
    background: rgba(59,130,246,0.1);
    border-color: #3b82f6;
    color: #93c5fd;
}
.rpg-mission.done {
    background: rgba(34,197,94,0.08);
    border-color: #166534;
    color: #86efac;
}
.rpg-mission-icon { font-size: 18px; flex-shrink: 0; }
.rpg-mission-info { flex: 1; }
.rpg-mission-name { font-weight: 700; font-size: 12px; }
.rpg-mission-type { font-size: 10px; opacity: 0.7; margin-top: 1px; }
.rpg-mission-check { font-size: 13px; color: #22c55e; flex-shrink: 0; }

/* Kit items */
.rpg-kit {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 5px;
}
.rpg-kit-item {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 7px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    border: 1px solid #1e293b;
    color: #64748b;
    background: rgba(255,255,255,0.02);
    transition: all 0.3s;
}
.rpg-kit-item.collected {
    color: #e2e8f0;
    border-color: currentColor;
    background: rgba(255,255,255,0.06);
}

/* Tips */
.rpg-tips {
    background: rgba(234,179,8,0.07);
    border: 1px solid rgba(234,179,8,0.2);
    border-radius: 8px;
    padding: 10px 12px;
}
.rpg-tip {
    font-size: 11px;
    color: #fde68a;
    line-height: 1.55;
    display: flex;
    gap: 6px;
    margin-bottom: 4px;
}
.rpg-tip:last-child { margin-bottom: 0; }

/* When #rpg-layout itself is the native fullscreen element */
#rpg-layout:fullscreen,
#rpg-layout:-webkit-full-screen {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100dvh !important;
    z-index: 99999 !important;
    background: #000 !important;
}

/* Ensure KitHUD and overlays inside fullscreen layout are visible */
#rpg-layout:fullscreen .kit-hud-root,
#rpg-layout:-webkit-full-screen .kit-hud-root {
    position: fixed;
    z-index: 9000;
}

/* Fullscreen button */
#rpg-fullscreen-btn {
    margin: 16px 16px 0;
    padding: 10px 0;
    background: #3b82f6;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    transition: background 0.2s, transform 0.1s;
    flex-shrink: 0;
}
#rpg-fullscreen-btn:hover { background: #2563eb; }
#rpg-fullscreen-btn:active { transform: scale(0.98); }

/* Show-rules pill (visible only in fullscreen) */
#rpg-show-rules {
    display: none;
    position: fixed;
    top: 12px;
    left: 12px;
    z-index: 9999;
    background: rgba(13,27,46,0.88);
    border: 1px solid #1e3a5f;
    color: #93c5fd;
    font-size: 12px;
    font-weight: 700;
    padding: 6px 12px;
    border-radius: 20px;
    cursor: pointer;
    backdrop-filter: blur(6px);
    transition: background 0.2s;
    font-family: system-ui, sans-serif;
}
#rpg-show-rules:hover { background: rgba(30,58,95,0.95); }
.rpg-fullscreen #rpg-show-rules { display: flex; align-items: center; gap: 5px; }

/* Native fullscreen — hide Jekyll/Elementor chrome */
html:fullscreen .jupiterx-header,
html:-webkit-full-screen .jupiterx-header,
html:fullscreen .jupiterx-site > div:not(main):not(#jupiterx-main),
html:-webkit-full-screen .jupiterx-site > div:not(main):not(#jupiterx-main),
html:fullscreen .jupiterx-a11y,
html:-webkit-full-screen .jupiterx-a11y,
html:fullscreen #poway-alert-banner,
html:-webkit-full-screen #poway-alert-banner,
html:fullscreen .site-header,
html:-webkit-full-screen .site-header,
html:fullscreen .site-footer,
html:-webkit-full-screen .site-footer,
html:fullscreen .page-header,
html:-webkit-full-screen .page-header { display: none !important; }

html:fullscreen body,
html:-webkit-full-screen body { overflow: hidden !important; background: #000 !important; }

html:fullscreen #jupiterx-main,
html:-webkit-full-screen #jupiterx-main { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }

html:fullscreen .page-content,
html:-webkit-full-screen .page-content,
html:fullscreen .page-content .wrapper,
html:-webkit-full-screen .page-content .wrapper { padding: 0 !important; margin: 0 !important; max-width: 100% !important; }

/* ── Game container ───────────────────────────────────────────────────────── */
#gameContainer {
    flex: 1;
    height: 100%;
    margin: 0;
    position: relative;
    min-width: 0;
}
#gameCanvas { width: 100%; height: 100%; display: block; }
#gameContainer, #gameCanvas { background: #000; }

/* ── Objective bar ────────────────────────────────────────────────────────── */
#rpg-objective {
    position: absolute;
    bottom: 10px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    pointer-events: none;
    z-index: 100;
}
#rpg-objective-pill {
    background: rgba(0,0,0,0.78);
    border: 1px solid #334155;
    border-radius: 20px;
    padding: 6px 18px;
    font-size: 12px;
    color: #94a3b8;
    font-family: system-ui, sans-serif;
    backdrop-filter: blur(4px);
    transition: opacity 0.3s;
}
.embedded #rpg-objective { display: none !important; }

#engine-blocker {
    position: absolute;
    inset: 0;
    background: #000;
    z-index: 10;
    display: none;
}

/* Hide leaderboard inside Game Builder iframe */
.embedded .leaderboard-widget { display: none !important; visibility: hidden !important; }

.custom-alert {
    display: none;
    position: fixed;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000;
}
.custom-alert button {
    background-color: transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    position: absolute;
}
</style>

<script>
// Enable embed mode when inside an iframe or with ?embed=1
(function() {
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('embed') === '1' || window.self !== window.top) {
            document.documentElement.classList.add('embedded');
        }
    } catch (e) {}
})();

function closeCustomAlert() {
    try {
        const el = document.getElementById('custom-alert');
        if (el) el.style.display = 'none';
    } catch (_) {}
}
</script>

<!-- ── Rules sidebar + game layout ──────────────────────────────────────── -->
<div id="rpg-layout">

  <!-- LEFT: Rules panel -->
  <aside id="rpg-sidebar" aria-label="Game rules and instructions">
    <button id="rpg-fullscreen-btn" onclick="rpgEnterFullscreen()" title="Hide rules and play fullscreen">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
      Play Fullscreen
    </button>

    <div id="rpg-sidebar-inner">

      <div class="rpg-logo">🏠</div>
      <h2 class="rpg-title">Poway Emergency<br>Preparedness RPG</h2>
      <p class="rpg-tagline">Help your community survive wildfires, floods,<br>heat waves &amp; earthquakes.</p>

      <div class="rpg-section-label">Controls</div>
      <div class="rpg-controls">
        <div class="rpg-ctrl-row">
          <div class="rpg-key-group">
            <span class="rpg-key">W</span>
          </div>
          <div class="rpg-key-group">
            <span class="rpg-key">A</span><span class="rpg-key">S</span><span class="rpg-key">D</span>
          </div>
          <span>Move your character</span>
        </div>
        <div class="rpg-ctrl-row">
          <span class="rpg-key">E</span>
          <span>Talk to an NPC / start mission</span>
        </div>
        <div class="rpg-ctrl-row">
          <span class="rpg-key">Esc</span>
          <span>Pause / exit mini-game</span>
        </div>
      </div>

      <div class="rpg-section-label">Your Missions</div>
      <div class="rpg-missions" id="rpg-mission-list">
        <div class="rpg-mission active" data-quest="">
          <span class="rpg-mission-icon">🌲</span>
          <div class="rpg-mission-info">
            <div class="rpg-mission-name">Park Ranger</div>
            <div class="rpg-mission-type">Introduction — always available</div>
          </div>
        </div>
        <div class="rpg-mission locked" data-quest="fire">
          <span class="rpg-mission-icon">🔥</span>
          <div class="rpg-mission-info">
            <div class="rpg-mission-name">Fire Chief</div>
            <div class="rpg-mission-type">Pack the Go-Bag · click items</div>
          </div>
        </div>
        <div class="rpg-mission locked" data-quest="flood">
          <span class="rpg-mission-icon">🌊</span>
          <div class="rpg-mission-info">
            <div class="rpg-mission-name">Flood Warden</div>
            <div class="rpg-mission-type">Safety Quiz · 5 questions</div>
          </div>
        </div>
        <div class="rpg-mission locked" data-quest="heat">
          <span class="rpg-mission-icon">💧</span>
          <div class="rpg-mission-info">
            <div class="rpg-mission-name">Heat Advisor</div>
            <div class="rpg-mission-type">Hydration Hero · click drops</div>
          </div>
        </div>
        <div class="rpg-mission locked" data-quest="earthquake">
          <span class="rpg-mission-icon">⚠️</span>
          <div class="rpg-mission-info">
            <div class="rpg-mission-name">PNEC Volunteer</div>
            <div class="rpg-mission-type">Drop · Cover · Hold On keys</div>
          </div>
        </div>
      </div>

      <div class="rpg-section-label">Emergency Kit</div>
      <div class="rpg-kit">
        <div class="rpg-kit-item" id="kit-fire"       style="color:#ef4444">🎒 Go-Bag</div>
        <div class="rpg-kit-item" id="kit-flood"      style="color:#3b82f6">🌊 Sandbags</div>
        <div class="rpg-kit-item" id="kit-heat"       style="color:#06b6d4">💧 Water Jug</div>
        <div class="rpg-kit-item" id="kit-earthquake" style="color:#f59e0b">⚠️ Safety Kit</div>
      </div>

      <div class="rpg-section-label">Tips</div>
      <div class="rpg-tips">
        <div class="rpg-tip"><span>•</span><span>Walk up to an NPC and press <strong>E</strong> to interact.</span></div>
        <div class="rpg-tip"><span>•</span><span>Complete missions <strong>in order</strong> — each one unlocks the next.</span></div>
        <div class="rpg-tip"><span>•</span><span>After a mission, you can ask the NPC <strong>any question</strong> via AI chat.</span></div>
        <div class="rpg-tip"><span>•</span><span>Choose your <strong>difficulty</strong> at the start screen — Easy / Normal / Hard.</span></div>
      </div>

    </div><!-- /sidebar-inner -->
  </aside>

  <!-- "Show Rules" pill — appears when fullscreen is active -->
  <button id="rpg-show-rules" onclick="rpgExitFullscreen()" title="Show rules panel">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>
    Rules
  </button>

  <!-- RIGHT: Game -->
  <div id="gameContainer">
      <canvas id='gameCanvas'></canvas>
      <div id="engine-blocker" aria-hidden="true"></div>
      <!-- Current objective hint -->
      <div id="rpg-objective">
        <div id="rpg-objective-pill">🌲 Walk to the <strong>Park Ranger</strong> in the center of the map and press <strong>E</strong></div>
      </div>
  </div>

</div><!-- /rpg-layout -->

<div id="custom-alert" class="custom-alert">
    <button onclick="closeCustomAlert()" id="custom-alert-message"></button>
</div>

<script>
// ── Fullscreen toggle (native browser fullscreen) ─────────────────────────
// We fullscreen document.documentElement so body-fixed overlays (KitHUD, mini-game canvases)
// remain visible. Jekyll chrome is hidden via the html:fullscreen CSS rules above.
function rpgEnterFullscreen() {
    const layout = document.getElementById('rpg-layout');
    if (!layout) return;
    layout.classList.add('rpg-fullscreen');
    // Fullscreen the layout element itself so browser hides all other page chrome
    const req = layout.requestFullscreen || layout.webkitRequestFullscreen || layout.mozRequestFullScreen;
    if (req) req.call(layout).catch(() => {});
    setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 100);
}

function rpgExitFullscreen() {
    const layout = document.getElementById('rpg-layout');
    if (!layout) return;
    layout.classList.remove('rpg-fullscreen');
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
    if (exit && (document.fullscreenElement || document.webkitFullscreenElement)) {
        exit.call(document).catch(() => {});
    }
    setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 100);
}

// Sync when user exits native fullscreen via Esc or browser UI
function _onFsChange() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const layout = document.getElementById('rpg-layout');
        if (layout) layout.classList.remove('rpg-fullscreen');
        setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 400);
    }
}
document.addEventListener('fullscreenchange', _onFsChange);
document.addEventListener('webkitfullscreenchange', _onFsChange);

// ── Sidebar quest state sync ──────────────────────────────────────────────
(function syncSidebar() {
    const STORAGE_KEY = 'pnec_rpg_v2';
    function getState() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } }

    const OBJECTIVES = [
        { prereq: null,        id: 'ranger',     icon: '🌲', name: 'Park Ranger',   hint: 'center of the map' },
        { prereq: 'ranger',    id: 'fire',        icon: '🔥', name: 'Fire Chief',    hint: 'upper right area' },
        { prereq: 'fire',      id: 'flood',       icon: '🌊', name: 'Flood Warden',  hint: 'right side' },
        { prereq: 'flood',     id: 'heat',        icon: '💧', name: 'Heat Advisor',  hint: 'bottom right' },
        { prereq: 'heat',      id: 'earthquake',  icon: '⚠️', name: 'PNEC Volunteer','hint': 'bottom center' },
    ];

    function refreshObjective(s) {
        const pill = document.getElementById('rpg-objective-pill');
        if (!pill) return;
        if (!s.difficulty) { pill.innerHTML = '← Choose a difficulty to start'; return; }
        for (const obj of OBJECTIVES) {
            if (!s[obj.id]) {
                pill.innerHTML = `${obj.icon} Walk to the <strong>${obj.name}</strong> (${obj.hint}) and press <strong>E</strong>`;
                return;
            }
        }
        pill.innerHTML = '🏆 All missions complete! You built your Emergency Kit!';
    }

    function refresh() {
        const s = getState();
        const quests = ['fire','flood','heat','earthquake'];

        quests.forEach((id, i) => {
            const row = document.querySelector(`.rpg-mission[data-quest="${id}"]`);
            const kit = document.getElementById(`kit-${id}`);
            if (!row) return;

            const done = !!s[id];
            // Prerequisite: first quest needs ranger, others need previous
            const prereq = i === 0 ? true : !!s[quests[i-1]];

            row.className = 'rpg-mission ' + (done ? 'done' : prereq ? 'active' : 'locked');

            // Add/remove checkmark
            const existing = row.querySelector('.rpg-mission-check');
            if (done && !existing) {
                const check = document.createElement('span');
                check.className = 'rpg-mission-check';
                check.textContent = '✓';
                row.appendChild(check);
            } else if (!done && existing) {
                existing.remove();
            }

            if (kit) {
                if (done) kit.classList.add('collected');
                else      kit.classList.remove('collected');
            }
        });

        refreshObjective(s);
    }

    // Run on load and on storage change (so HUD + sidebar stay in sync)
    refresh();
    window.addEventListener('storage', refresh);
    // Poll lightly in case localStorage changes within the same tab (game sets it)
    setInterval(refresh, 1500);
})();
</script>

<script type="module">
    const path = "{{site.baseurl}}";
    const origin = window.location.origin;

    // Dynamically resolve a working base prefix for assets (handles empty or mismatched baseurl)
    let basePrefix = null;
    async function ensureBasePrefix() {
        if (basePrefix) return basePrefix;
        const candidates = [];
        const siteBase = path || '';
        if (siteBase) candidates.push(`${origin}${siteBase}`);
        candidates.push(`${origin}`);
        // Derive first path segment (e.g., '/gamebuilder') if siteBase is empty
        try {
            const seg = '/' + (window.location.pathname.split('/').filter(Boolean)[0] || '');
            if (seg && seg !== '/') candidates.push(`${origin}${seg}`);
        } catch (_) {}
        // Deduplicate
        const uniq = [...new Set(candidates)];
        let lastErr = null;
        for (const cand of uniq) {
            try {
                const testUrl = `${cand}/assets/js/GameEnginev1.5/Game.js?v=${Date.now()}`;
                const res = await fetch(testUrl, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
                if (res && res.ok) {
                    const ctype = (res.headers.get('content-type') || '').toLowerCase();
                    if (ctype.includes('javascript') || ctype.includes('ecmascript') || ctype.includes('module')) {
                        basePrefix = cand; return basePrefix;
                    }
                    const text = await res.text();
                    if (text.trim().startsWith('<')) {
                        lastErr = new Error(`Probe returned HTML @ ${testUrl}`);
                    } else {
                        basePrefix = cand; return basePrefix;
                    }
                } else {
                    lastErr = new Error(`Probe failed: ${res?.status} @ ${testUrl}`);
                }
            } catch (e) {
                lastErr = e;
            }
        }
        basePrefix = `${origin}${siteBase}`;
        console.warn('[RPG] Falling back to basePrefix:', basePrefix, 'Last probe error:', lastErr);
        return basePrefix;
    }

    // Proactively unregister any service workers to avoid stale/cached HTML
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const r of regs) { try { await r.unregister(); } catch (_) {} }
        } catch (_) {}
    }

    // Lazy-load engine (Prefer GameEngine, fallback to Adventure)
    let EngineModule = null;
    let engineType = null;
    async function loadEngine() {
        if (EngineModule) return EngineModule;
        try {
            const prefix = await ensureBasePrefix();
            const advUrl = `${prefix}/assets/js/GameEnginev1.5/Game.js?v=${Date.now()}`;
            try {
                const r = await fetch(advUrl, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
                const ct = (r.headers.get('content-type') || '').toLowerCase();
                const body = r.ok ? await r.text() : '';
                if (!r.ok || body.trim().startsWith('<') || !(ct.includes('javascript') || ct.includes('ecmascript') || ct.includes('module') || ct === '')) {
                    throw new Error(`Adventure engine not served as JS (status ${r.status || 'unknown'})`);
                }
            } catch (prefetchErr) {
                throw prefetchErr;
            }
            const advMod = await import(advUrl);
            EngineModule = advMod?.default ?? advMod;
            engineType = 'adventure';
            return EngineModule;
        } catch (eAdv) {
            console.warn('Adventure engine load failed, trying GameEngine:', eAdv);
            try {
                const prefix = await ensureBasePrefix();
                const betterUrl = `${prefix}/assets/js/mansionGame/MansionLogic/Game.js?v=${Date.now()}`;
                try {
                    const r = await fetch(betterUrl, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
                    const ct = (r.headers.get('content-type') || '').toLowerCase();
                    const body = r.ok ? await r.text() : '';
                    if (!r.ok || body.trim().startsWith('<') || !(ct.includes('javascript') || ct.includes('ecmascript') || ct.includes('module') || ct === '')) {
                        throw new Error(`Better engine not served as JS (status ${r.status || 'unknown'})`);
                    }
                } catch (prefetchErr2) {
                    throw prefetchErr2;
                }
                const betterMod = await import(betterUrl);
                EngineModule = betterMod?.default ?? betterMod;
                engineType = 'better';
                return EngineModule;
            } catch (eBetter) {
                console.error('Both engine loads failed:', { adventureError: eAdv, betterError: eBetter });
                throw eBetter;
            }
        }
    }

    // Explicit loader for Adventure engine for runtime fallback from Better
    async function loadAdventureEngine() {
        try {
            const prefix = await ensureBasePrefix();
            const url = `${prefix}/assets/js/GameEnginev1.5/Game.js?v=${Date.now()}`;
            try {
                const r = await fetch(url, { method: 'GET', credentials: 'same-origin', cache: 'no-store' });
                const ct = (r.headers.get('content-type') || '').toLowerCase();
                const body = r.ok ? await r.text() : '';
                if (!r.ok || body.trim().startsWith('<') || !(ct.includes('javascript') || ct.includes('ecmascript') || ct.includes('module') || ct === '')) {
                    throw new Error(`Adventure fallback not served as JS (status ${r.status || 'unknown'})`);
                }
            } catch (prefetchErr) {
                throw prefetchErr;
            }
            const mod = await import(url);
            EngineModule = mod?.default ?? mod;
            engineType = 'adventure';
            return EngineModule;
        } catch (e) {
            console.error('Failed to load Adventure engine fallback:', e);
            throw e;
        }
    }

    // Respect autostart query parameter (default: true)
    const params = new URLSearchParams(window.location.search);
    const autostartParam = (params.get('autostart') || '').toLowerCase();
    const autoStart = !(autostartParam === '0' || autostartParam === 'false' || autostartParam === 'no');

    // Blockers: prevent all input when engine inactive
    let engineActive = !!autoStart;
    const blockerEl = document.getElementById('engine-blocker');
    const blockEvents = [
        'keydown','keyup','keypress',
        'mousedown','mouseup','mousemove','contextmenu',
        'wheel','touchstart','touchmove','touchend','pointerdown','pointermove','pointerup'
    ];
    const handlers = new Map();

    function enableBlockers() {
        if (blockerEl) blockerEl.style.display = 'block';
        blockEvents.forEach(type => {
            if (!handlers.has(type)) {
                const h = (e) => { e.preventDefault(); e.stopPropagation(); };
                document.addEventListener(type, h, { capture: true, passive: false });
                handlers.set(type, h);
            }
        });
    }

    function disableBlockers() {
        if (blockerEl) blockerEl.style.display = 'none';
        handlers.forEach((h, type) => {
            document.removeEventListener(type, h, { capture: true });
        });
        handlers.clear();
    }

    // Try to import RPG GameControl dynamically (may not exist in this repo)
    async function tryStartDefault() {
        try {
            const mod = await import(`${origin}${path || ''}/assets/js/rpg/latest/GameControl.js?v=${Date.now()}`);
            const GameControl = mod?.default ?? mod?.GameControl ?? null;
            if (GameControl && typeof GameControl.start === 'function') {
                GameControl.start(path);
                return true;
            }
        } catch (e) {
            console.warn('RPG GameControl not found; running without default start.', e);
        }
        return false;
    }

    if (!engineActive) {
        enableBlockers();
    } else {
        tryStartDefault().then((started) => {
            if (started) {
                disableBlockers();
            } else {
                enableBlockers();
            }
        });
    }

    // Track live Adventure engine instance (from code runner)
    let liveAdventure = null;

    // Expose simple control handling for parent pages via postMessage
    let isPaused = false;
    window.addEventListener('message', (event) => {
        const data = event?.data;
        if (!data || data.type !== 'rpg:control') return;
        const action = data.action;
        try {
            switch (action) {
                case 'start':
                    if (document.documentElement.classList.contains('embedded')) {
                        engineActive = false;
                        enableBlockers();
                        isPaused = false;
                    } else {
                        tryStartDefault().then((started) => {
                            engineActive = !!started;
                            if (started) disableBlockers(); else enableBlockers();
                            isPaused = false;
                        });
                    }
                    break;
                case 'pause':
                    if (liveAdventure && liveAdventure.gameControl && typeof liveAdventure.gameControl.pause === 'function') {
                        liveAdventure.gameControl.pause();
                        isPaused = true;
                    }
                    break;
                case 'resume':
                    if (liveAdventure && liveAdventure.gameControl && typeof liveAdventure.gameControl.resume === 'function') {
                        liveAdventure.gameControl.resume();
                        isPaused = false;
                    }
                    break;
                case 'stop':
                    location.reload();
                    engineActive = false;
                    enableBlockers();
                    break;
                case 'reset':
                    location.reload();
                    break;
            }
        } catch (err) {
            console.error('Runner control error:', err);
        }
    });

    // Live code runner: accept code string, dynamic-import, and start engine
    window.addEventListener('message', async (event) => {
        const data = event?.data;
        if (!data || data.type !== 'rpg:run-code') return;
        let code = String(data.code || '');
        if (!code.trim()) return;
        try {
            enableBlockers();
            engineActive = false;

            const origin = window.location.origin;
            await ensureBasePrefix();
            const basePrefixLocal = basePrefix;
            const fromAbsRe = /(from\s*["'])(\/[^"']+)(["'])/g;
            const dynImpAbsRe = /(import\(\s*["'])(\/[^"']+)(["']\s*\))/g;
            const fromRelRe = /(from\s*["'])(?!https?:)(\.?\.?[^"']+)(["'])/g;
            const dynImpRelRe = /(import\(\s*["'])(?!https?:)(\.?\.?[^"']+)(["']\s*\))/g;
            code = code
                .replace(fromAbsRe, (m, p1, p2, p3) => `${p1}${basePrefixLocal}${p2}${p3}`)
                .replace(dynImpAbsRe, (m, p1, p2, p3) => `${p1}${basePrefixLocal}${p2}${p3}`)
                .replace(fromRelRe, (m, p1, p2, p3) => `${p1}${basePrefixLocal}/${p2}${p3}`)
                .replace(dynImpRelRe, (m, p1, p2, p3) => `${p1}${basePrefixLocal}/${p2}${p3}`);

            const Engine = await loadEngine();

            const blob = new Blob([code], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            let mod = null;
            try {
                mod = await import(url);
            } finally {
                URL.revokeObjectURL(url);
            }

            const env = {
                path,
                gameContainer: document.getElementById('gameContainer'),
                gameCanvas: document.getElementById('gameCanvas'),
                pythonURI: '',
                javaURI: '',
                fetchOptions: {}
            };

            let levelClasses = Array.isArray(mod.gameLevelClasses)
                ? mod.gameLevelClasses
                : Array.isArray(mod?.default?.gameLevelClasses)
                ? mod.default.gameLevelClasses
                : [];
            if (!levelClasses.length) {
                const candidates = [];
                if (typeof mod?.default === 'function') candidates.push(mod.default);
                if (typeof mod.CustomLevel === 'function') candidates.push(mod.CustomLevel);
                try {
                    Object.keys(mod || {}).forEach(k => {
                        if (k !== 'default' && /Level$/i.test(k) && typeof mod[k] === 'function') {
                            candidates.push(mod[k]);
                        }
                    });
                } catch (_) {}
                if (candidates.length) levelClasses = [candidates[0]];
            }

            try {
                console.debug('[Runner] Module export diagnostics', {
                    hasNamedGameLevelClasses: Array.isArray(mod?.gameLevelClasses),
                    hasDefaultGameLevelClasses: Array.isArray(mod?.default?.gameLevelClasses),
                    detectedLevelCount: levelClasses.length,
                    hasDefaultFunction: typeof mod?.default === 'function',
                    hasCustomLevel: typeof mod?.CustomLevel === 'function',
                    engineType
                });
            } catch (_) {}

            let started = false;
            let lastStartError = null;
            if (levelClasses.length > 0 && Engine && typeof Engine.main === 'function') {
                try {
                    const containerWidth = env.gameContainer?.clientWidth || window.innerWidth;
                    const containerHeight = Math.min(580, window.innerHeight);
                    try {
                        liveAdventure = Engine.main({
                        path: env.path,
                        gameContainer: env.gameContainer,
                        gameCanvas: env.gameCanvas,
                        pythonURI: env.pythonURI,
                        javaURI: env.javaURI,
                        fetchOptions: env.fetchOptions,
                        innerWidth: containerWidth,
                        innerHeight: containerHeight,
                        gameLevelClasses: levelClasses
                        });
                    } catch (startErr) {
                        lastStartError = startErr;
                        throw startErr;
                    }
                    started = true;
                } catch (e) {
                    console.error('Game start failed:', e);
                    lastStartError = e;
                }
            }

            if (started) {
                engineActive = true;
                disableBlockers();
            } else {
                const noLevels = !levelClasses || levelClasses.length === 0;
                const msg = noLevels
                    ? 'No levels detected. Export array `gameLevelClasses` or a default/named level class (e.g., `CustomLevel`).'
                    : `Engine start failed. ${lastStartError?.message ? 'Reason: ' + lastStartError.message : 'Check import paths and ensure assets exist under base.'} Base: ${basePrefix || (origin + (path || ''))}`;
                try {
                    const el = document.getElementById('custom-alert');
                    const msgBtn = document.getElementById('custom-alert-message');
                    if (el && msgBtn) {
                        msgBtn.textContent = msg;
                        el.style.display = 'block';
                        enableBlockers();
                    }
                } catch (_) {}
                return;
            }
        } catch (err) {
            console.error('Live code run error:', err);
            try {
                const el = document.getElementById('custom-alert');
                const msgBtn = document.getElementById('custom-alert-message');
                if (el && msgBtn) {
                    msgBtn.textContent = `Error: ${err.message || err}`;
                    el.style.display = 'block';
                    enableBlockers();
                }
            } catch (_) {}
        }
    });
</script>
