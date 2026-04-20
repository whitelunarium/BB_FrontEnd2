// GameLevelPoway.js — PNEC Emergency Preparedness RPG
// 4 missions: Fire → Flood → Heat → Earthquake. Build your Emergency Kit to win!

import GamEnvBackground from '../../GameEnginev1.1/essentials/GameEnvBackground.js';
import Player from '../../GameEnginev1.1/essentials/Player.js';
import Npc from '../../GameEnginev1.1/essentials/Npc.js';

const GEMINI_API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://127.0.0.1:8425'
  : 'https://beasts.opencodingsociety.com';

// ── Quest State (persisted in localStorage) ──────────────────────────────────
const QuestState = {
  KEY: 'pnec_rpg_v2',
  get()  { try { return JSON.parse(localStorage.getItem(this.KEY) || '{}'); } catch { return {}; } },
  save(d){ try { localStorage.setItem(this.KEY, JSON.stringify(d)); } catch {} },
  isComplete(id) { return !!this.get()[id]; },
  complete(id, item) {
    const s = this.get(); s[id] = { item, at: Date.now() }; this.save(s);
    KitHUD.refresh();
  },
  getDifficulty() { return this.get().difficulty || null; },
  setDifficulty(d) { const s = this.get(); s.difficulty = d; this.save(s); },
  allComplete() { return ['fire','flood','heat','earthquake'].every(id => !!this.get()[id]); },
  reset() { localStorage.removeItem(this.KEY); },
};

// ── Difficulty presets ────────────────────────────────────────────────────────
const DIFF = {
  easy:   { time: 60, lives: 3, speed: 0.75, label: 'Easy',   emoji: '😊', color: '#22c55e' },
  normal: { time: 45, lives: 2, speed: 1.00, label: 'Normal', emoji: '😐', color: '#f59e0b' },
  hard:   { time: 30, lives: 1, speed: 1.40, label: 'Hard',   emoji: '😤', color: '#ef4444' },
};
function getDiff() { return DIFF[QuestState.getDifficulty()] || DIFF.normal; }

// ── Kit HUD ───────────────────────────────────────────────────────────────────
const KIT_SLOTS = [
  { id: 'fire',       label: 'Go-Bag',     icon: '🎒', color: '#ef4444' },
  { id: 'flood',      label: 'Sandbags',   icon: '🌊', color: '#3b82f6' },
  { id: 'heat',       label: 'Water Jug',  icon: '💧', color: '#06b6d4' },
  { id: 'earthquake', label: 'Safety Kit', icon: '⚠️', color: '#f59e0b' },
];

const KitHUD = {
  el: null,
  mount() {
    if (this.el) return;
    this.el = document.createElement('div');
    this.el.className = 'kit-hud-root';
    Object.assign(this.el.style, {
      position:'fixed', top:'12px', right:'12px', zIndex:'9000',
      display:'flex', flexDirection:'column', gap:'5px',
      fontFamily:'system-ui,sans-serif', pointerEvents:'none',
    });
    // Mount inside #rpg-layout so it stays visible when that element is fullscreened
    const container = document.getElementById('rpg-layout') || document.body;
    container.appendChild(this.el);
    this.refresh();
  },
  refresh() {
    if (!this.el) return;
    const s = QuestState.get();
    this.el.innerHTML = '';

    const title = Object.assign(document.createElement('div'), { textContent: '🩹 Emergency Kit' });
    Object.assign(title.style, {
      background:'rgba(0,0,0,0.75)', color:'#fff', fontSize:'11px', fontWeight:'700',
      padding:'4px 10px', borderRadius:'6px', textAlign:'center', letterSpacing:'0.5px',
    });
    this.el.appendChild(title);

    KIT_SLOTS.forEach(({ id, label, icon, color }) => {
      const done = !!s[id];
      const row = document.createElement('div');
      Object.assign(row.style, {
        display:'flex', alignItems:'center', gap:'6px',
        background: done ? `${color}22` : 'rgba(0,0,0,0.55)',
        border:`1px solid ${done ? color : '#444'}`,
        borderRadius:'6px', padding:'4px 8px',
        opacity: done ? '1' : '0.42', transition:'all 0.3s',
      });
      row.innerHTML = `<span style="font-size:15px">${icon}</span><span style="color:${done?'#fff':'#888'};font-size:11px;font-weight:600">${label}</span>${done?'<span style="margin-left:auto;color:#22c55e;font-size:12px">✓</span>':''}`;
      this.el.appendChild(row);
    });

    const count = KIT_SLOTS.filter(({id}) => !!s[id]).length;
    const prog = Object.assign(document.createElement('div'), { textContent: `${count}/4 collected` });
    Object.assign(prog.style, {
      background:'rgba(0,0,0,0.6)', borderRadius:'6px', padding:'3px 8px',
      fontSize:'10px', color:'#aaa', textAlign:'center',
    });
    this.el.appendChild(prog);
  },
  unmount() { this.el?.parentNode?.removeChild(this.el); this.el = null; },
};

// ── Difficulty Selector ───────────────────────────────────────────────────────
function showDifficultySelector(onSelect) {
  const ov = document.createElement('div');
  Object.assign(ov.style, {
    position:'fixed', inset:'0', background:'rgba(0,0,0,0.93)',
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    zIndex:'99999', fontFamily:'system-ui,sans-serif', gap:'20px', textAlign:'center',
    padding:'20px',
  });
  ov.innerHTML = `
    <div style="max-width:560px">
      <div style="font-size:52px;margin-bottom:10px">🏠</div>
      <h1 style="color:#fff;font-size:26px;margin:0 0 8px;font-weight:800">Poway Emergency Preparedness RPG</h1>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 14px;line-height:1.6">
        Help your community survive wildfires, floods, heat waves, and earthquakes.
      </p>
      <div style="background:rgba(59,130,246,0.1);border:1px solid #3b82f6;border-radius:10px;padding:12px 18px;text-align:left;font-size:13px;color:#93c5fd;line-height:1.9;margin-bottom:6px">
        <strong style="color:#60a5fa;display:block;margin-bottom:4px">How to play:</strong>
        <span style="opacity:0.9">① Use <strong>W A S D</strong> to walk around Poway</span><br>
        <span style="opacity:0.9">② Walk close to an NPC and press <strong>E</strong> to talk</span><br>
        <span style="opacity:0.9">③ Start with the <strong>🌲 Park Ranger</strong> — he's in the center of the map</span><br>
        <span style="opacity:0.9">④ Complete 4 missions to build your Emergency Kit and win!</span>
      </div>
    </div>
    <div>
      <p style="color:#64748b;font-size:12px;margin:0 0 10px">Choose difficulty:</p>
      <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center">
        ${Object.entries(DIFF).map(([key,d]) => `
          <button data-diff="${key}" style="
            background:rgba(255,255,255,0.04);border:2px solid ${d.color};border-radius:12px;
            padding:22px 28px;cursor:pointer;color:#fff;min-width:140px;text-align:center;
            transition:background 0.2s;
          ">
            <div style="font-size:34px;margin-bottom:8px">${d.emoji}</div>
            <div style="font-size:18px;font-weight:700;color:${d.color}">${d.label}</div>
            <div style="font-size:12px;color:#94a3b8;margin-top:4px">${d.time}s · ${d.lives} ${d.lives===1?'life':'lives'}</div>
          </button>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(ov);
  ov.querySelectorAll('button[data-diff]').forEach(btn => {
    btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(255,255,255,0.1)');
    btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(255,255,255,0.04)');
    btn.addEventListener('click', () => {
      QuestState.setDifficulty(btn.dataset.diff);
      ov.remove();
      onSelect();
      // Brief "start here" toast
      const toast = document.createElement('div');
      Object.assign(toast.style, {
        position:'fixed', bottom:'72px', left:'50%', transform:'translateX(-50%)',
        background:'rgba(13,27,46,0.96)', border:'1px solid #3b82f6', borderRadius:'14px',
        padding:'12px 24px', color:'#93c5fd', fontSize:'14px', fontWeight:'700',
        zIndex:'99998', fontFamily:'system-ui,sans-serif', textAlign:'center',
        transition:'opacity 0.5s', pointerEvents:'none', whiteSpace:'nowrap',
        boxShadow:'0 4px 24px rgba(59,130,246,0.25)',
      });
      toast.innerHTML = '🌲 Walk to the <strong>Park Ranger</strong> in the center of the map and press <strong>E</strong>';
      document.body.appendChild(toast);
      setTimeout(() => { toast.style.opacity='0'; setTimeout(() => toast.remove(), 500); }, 4000);
    });
  });
}

// ── Win Screen ────────────────────────────────────────────────────────────────
function showWinScreen() {
  // Don't show twice
  if (document.getElementById('pnec-win-screen')) return;
  const ov = document.createElement('div');
  ov.id = 'pnec-win-screen';
  Object.assign(ov.style, {
    position:'fixed', inset:'0',
    background:'linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#0f172a 100%)',
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    zIndex:'99999', fontFamily:'system-ui,sans-serif', gap:'14px', textAlign:'center',
    padding:'20px',
  });
  ov.innerHTML = `
    <style>@keyframes pnec-bounce{from{transform:translateY(0)}to{transform:translateY(-14px)}}</style>
    <div style="font-size:64px;animation:pnec-bounce 0.9s ease-in-out infinite alternate">🏆</div>
    <h1 style="color:#fbbf24;font-size:30px;margin:0;font-weight:900;text-shadow:0 0 24px #fbbf2466">
      Poway Prepared!
    </h1>
    <p style="color:#94a3b8;font-size:15px;max-width:420px;margin:0;line-height:1.6">
      You completed all 4 emergency preparedness missions and built your full Emergency Kit.
      Your neighborhood is safer because of you!
    </p>
    <div style="display:flex;gap:14px;font-size:38px;margin:6px 0">🎒🌊💧⚠️</div>
    <p style="color:#475569;font-size:13px">Share your achievement with PNEC at powaynec.com</p>
    <button id="pnec-play-again" style="
      padding:12px 32px;background:#fbbf24;color:#0f172a;border:none;border-radius:8px;
      font-size:15px;font-weight:700;cursor:pointer;margin-top:6px;
    ">Play Again</button>
  `;
  document.body.appendChild(ov);
  document.getElementById('pnec-play-again').onclick = () => { QuestState.reset(); location.reload(); };
}

// ── Mini-game utilities ───────────────────────────────────────────────────────
function mkCanvas() {
  const c = document.createElement('canvas');
  c.width = window.innerWidth; c.height = window.innerHeight;
  Object.assign(c.style, { position:'fixed', top:'0', left:'0', zIndex:'20000', background:'#000' });
  document.body.appendChild(c);
  return c;
}

function showResult(win, message, onContinue) {
  const ov = document.createElement('div');
  Object.assign(ov.style, {
    position:'fixed', inset:'0',
    background: win ? 'rgba(0,40,0,0.93)' : 'rgba(40,0,0,0.93)',
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    zIndex:'20001', fontFamily:'system-ui,sans-serif', gap:'12px', textAlign:'center',
    padding:'20px',
  });
  ov.innerHTML = `
    <div style="font-size:60px">${win ? '🎉' : '💀'}</div>
    <h2 style="color:${win?'#22c55e':'#ef4444'};font-size:26px;margin:0">${win ? 'Mission Complete!' : 'Mission Failed'}</h2>
    <p style="color:#cbd5e1;font-size:14px;max-width:380px;margin:0;line-height:1.6">${message}</p>
    <button style="
      margin-top:6px;padding:12px 30px;background:${win?'#22c55e':'#ef4444'};color:#fff;
      border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;
    ">${win ? 'Collect Kit Item →' : 'Try Again'}</button>
  `;
  document.body.appendChild(ov);
  ov.querySelector('button').onclick = () => { ov.remove(); onContinue(win); };
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', cy = y;
  for (const w of words) {
    const test = line + w + ' ';
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trim(), x, cy); line = w + ' '; cy += lh;
    } else line = test;
  }
  ctx.fillText(line.trim(), x, cy);
}

// ── FIRE MINI-GAME: Pack the Go-Bag ──────────────────────────────────────────
function runFireMiniGame(onComplete) {
  const d = getDiff();
  const canvas = mkCanvas();
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const ALL_ITEMS = [
    { label:'Water Bottle', icon:'💧', essential:true },
    { label:'Medications',  icon:'💊', essential:true },
    { label:'Documents',    icon:'📄', essential:true },
    { label:'Phone Charger',icon:'🔌', essential:true },
    { label:'Flashlight',   icon:'🔦', essential:true },
    { label:'First Aid Kit',icon:'🩹', essential:true },
    { label:'TV Remote',    icon:'📺', essential:false },
    { label:'Video Games',  icon:'🎮', essential:false },
    { label:'Jewelry Box',  icon:'💍', essential:false },
    { label:'Candle',       icon:'🕯️',essential:false },
    { label:'Potted Plant', icon:'🌱', essential:false },
    { label:'Trophy',       icon:'🏆', essential:false },
  ];

  const CARD_W = 115, CARD_H = 92, COLS = 4, GAP = 18;
  const startX = (W - COLS * (CARD_W + GAP)) / 2;
  const startY = 145;

  const items = [...ALL_ITEMS].sort(() => Math.random() - 0.5).slice(0, 10);
  const cards = items.map((item, i) => ({
    ...item,
    x: startX + (i % COLS) * (CARD_W + GAP),
    y: startY + Math.floor(i / COLS) * (CARD_H + GAP),
    w: CARD_W, h: CARD_H,
    clicked: false, flash: null, flashT: 0,
  }));

  const NEEDED = 5;
  let timeLeft = d.time, score = 0, lives = d.lives, done = false;

  const timer = setInterval(() => {
    if (done) return;
    if (--timeLeft <= 0) finish(false);
  }, 1000);

  function finish(win) {
    if (done) return; done = true;
    clearInterval(timer); cancelAnimationFrame(raf); canvas.remove();
    const got = cards.filter(c => c.essential && c.clicked).length;
    showResult(win,
      win ? `You packed ${got} essential items — your family can survive 72 hours!`
          : `Only ${got}/${NEEDED} essential items packed. Remember: water, meds, documents, charger, flashlight!`,
      onComplete
    );
  }

  canvas.addEventListener('click', e => {
    if (done) return;
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    for (const c of cards) {
      if (c.clicked) continue;
      if (mx >= c.x && mx <= c.x + c.w && my >= c.y && my <= c.y + c.h) {
        c.clicked = true;
        if (c.essential) { c.flash = 'good'; c.flashT = 40; if (++score >= NEEDED) finish(true); }
        else             { c.flash = 'bad';  c.flashT = 40; lives--; timeLeft = Math.max(0, timeLeft-5); if (lives <= 0) finish(false); }
        break;
      }
    }
  });

  let raf;
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // BG
    ctx.fillStyle = '#160800';
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'rgba(180,40,0,0.18)'); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

    // Header
    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 22px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('🔥 PACK YOUR GO-BAG — Fire Evacuation!', W/2, 42);
    ctx.fillStyle = '#94a3b8'; ctx.font = '13px system-ui';
    ctx.fillText(`Click the ${NEEDED} ESSENTIAL items before time runs out. Wrong clicks cost time!`, W/2, 66);

    // HUD left
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'left';
    ctx.fillText(`⏱ ${timeLeft}s`, 20, 42);
    ctx.fillText(`❤️ ${lives}`, 20, 66);
    ctx.textAlign = 'right';
    ctx.fillText(`✅ ${score}/${NEEDED}`, W-20, 42);

    // Cards
    for (const c of cards) {
      if (c.flashT > 0) c.flashT--;
      ctx.save();
      if (c.clicked) ctx.globalAlpha = c.flash === 'good' && c.flashT > 0 ? 1 : c.clicked ? 0.25 : 1;

      let bg = '#1e293b';
      if (c.flashT > 0) bg = c.flash === 'good' ? '#16a34a' : '#dc2626';
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.roundRect(c.x, c.y, c.w, c.h, 10); ctx.fill();
      ctx.strokeStyle = c.clicked ? (c.essential ? '#22c55e' : '#ef4444') : '#334155';
      ctx.lineWidth = 2; ctx.stroke();

      ctx.font = '32px serif'; ctx.textAlign = 'center';
      ctx.fillText(c.icon, c.x + c.w/2, c.y + 48);
      ctx.fillStyle = '#e2e8f0'; ctx.font = '11px system-ui';
      ctx.fillText(c.label, c.x + c.w/2, c.y + 74);

      if (c.clicked) {
        ctx.fillStyle = c.essential ? '#22c55e' : '#ef4444';
        ctx.font = 'bold 18px system-ui';
        ctx.fillText(c.essential ? '✓' : '✗', c.x + c.w - 14, c.y + 20);
      }
      ctx.restore();
    }

    if (!done) raf = requestAnimationFrame(draw);
  }
  raf = requestAnimationFrame(draw);
}

// ── FLOOD MINI-GAME: Rapid-fire Quiz ─────────────────────────────────────────
function runFloodMiniGame(onComplete) {
  const d = getDiff();
  const canvas = mkCanvas();
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const QS = [
    { q:'How many inches of moving water can knock an adult off their feet?',
      a:['2 inches','6 inches','12 inches','18 inches'], correct:1,
      fact:'6 inches of fast-moving water can knock you off your feet — "Turn Around, Don\'t Drown!"' },
    { q:'What should you do when you see a flooded road?',
      a:['Drive slowly','Turn around — find another route','Wait for it to drain','Check depth first'], correct:1,
      fact:'12 inches of water can sweep away most cars. Never drive through floodwater.' },
    { q:'Which website shows your property\'s official flood zone?',
      a:['Google Maps','FEMA Flood Map (msc.fema.gov)','Weather.com','City of Poway site'], correct:1,
      fact:'msc.fema.gov shows every property\'s specific flood zone designation.' },
    { q:'After a flood, what is the FIRST safety concern before re-entering your home?',
      a:['Check for mold','Call insurance','Get official clearance (gas, structure, electricity)','Take photos'], correct:2,
      fact:'Wait for official clearance — gas leaks, live wires, and structural damage are invisible killers.' },
    { q:'How quickly can Poway Creek rise during heavy rain?',
      a:['1 foot per hour','Slowly over days','10 feet in under an hour','2 feet per hour'], correct:2,
      fact:'Poway Creek can rise 10 feet in under an hour during heavy rain — act immediately!' },
  ];

  let qi = 0, correct = 0, qTime = Math.round(d.time * 0.55), done = false;
  let selected = null, showFact = false, factFrames = 0;

  const timer = setInterval(() => {
    if (done || showFact) return;
    if (--qTime <= 0) { selected = -1; doFact(); }
  }, 1000);

  function doFact() { showFact = true; factFrames = 80; }
  function nextQ() {
    qi++;
    if (qi >= QS.length) { clearInterval(timer); finish(correct >= 3); return; }
    qTime = Math.round(d.time * 0.55); selected = null; showFact = false;
  }
  function finish(win) {
    if (done) return; done = true;
    clearInterval(timer); cancelAnimationFrame(raf); canvas.remove();
    showResult(win,
      win ? `${correct}/${QS.length} correct! You know how to stay safe in a flood.`
          : `${correct}/${QS.length} correct. Review these tips — they could save your life!`,
      onComplete
    );
  }

  const BTN_W = Math.min(370, W*0.38), BTN_H = 52;
  const btns = [
    { x: W/2 - BTN_W - 14, y: H/2 - 8 },
    { x: W/2 + 14,          y: H/2 - 8 },
    { x: W/2 - BTN_W - 14, y: H/2 + BTN_H + 8 },
    { x: W/2 + 14,          y: H/2 + BTN_H + 8 },
  ];

  canvas.addEventListener('click', e => {
    if (done) return;
    if (showFact) { nextQ(); return; }
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    btns.forEach((b, i) => {
      if (mx >= b.x && mx <= b.x + BTN_W && my >= b.y && my <= b.y + BTN_H) {
        selected = i;
        if (i === QS[qi].correct) correct++;
        doFact();
      }
    });
  });

  let raf;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0a1628'; ctx.fillRect(0,0,W,H);
    for (let i=0;i<3;i++){ctx.fillStyle=`rgba(59,130,246,${0.04+i*0.02})`;ctx.fillRect(0,H-60+i*20,W,20);}

    const q = QS[qi];
    ctx.fillStyle='#3b82f6'; ctx.font='bold 20px system-ui'; ctx.textAlign='center';
    ctx.fillText(`🌊 FLOOD SAFETY QUIZ — Question ${qi+1}/${QS.length}`, W/2, 44);

    // Timer bar
    const bw=W*0.5, bx=W*0.25, maxT=Math.round(d.time*0.55);
    ctx.fillStyle='#1e3a5f'; ctx.fillRect(bx,58,bw,9);
    ctx.fillStyle=qTime>maxT*0.4?'#3b82f6':'#ef4444';
    ctx.fillRect(bx,58,bw*(qTime/maxT),9);

    ctx.fillStyle='#94a3b8'; ctx.font='14px system-ui'; ctx.textAlign='right';
    ctx.fillText(`✅ ${correct} correct`, W-20, 44);

    if (showFact) {
      if (factFrames > 0) factFrames--; else { nextQ(); return; }
      const isCorrect = selected === q.correct;
      ctx.fillStyle = isCorrect ? 'rgba(22,163,74,0.18)' : 'rgba(220,38,38,0.18)';
      ctx.fillRect(0,0,W,H);
      ctx.fillStyle = isCorrect ? '#22c55e' : '#ef4444';
      ctx.font='bold 28px system-ui'; ctx.textAlign='center';
      ctx.fillText(isCorrect ? '✓ Correct!' : '✗ Incorrect', W/2, H/2 - 40);
      ctx.fillStyle='#f1f5f9'; ctx.font='16px system-ui';
      wrapText(ctx, q.fact, W/2, H/2+10, W*0.65, 24);
      ctx.fillStyle='#475569'; ctx.font='13px system-ui';
      ctx.fillText('Click anywhere to continue…', W/2, H/2+70);
      if (!done) raf = requestAnimationFrame(draw);
      return;
    }

    // Question
    ctx.fillStyle='#f1f5f9'; ctx.font='bold 17px system-ui'; ctx.textAlign='center';
    wrapText(ctx, q.q, W/2, H/2 - 88, W*0.68, 26);

    // Answer buttons
    const labels=['A','B','C','D'];
    btns.forEach((b, i) => {
      ctx.fillStyle='#1e3a5f';
      ctx.beginPath(); ctx.roundRect(b.x, b.y, BTN_W, BTN_H, 8); ctx.fill();
      ctx.strokeStyle='#3b82f6'; ctx.lineWidth=1.5; ctx.stroke();
      ctx.fillStyle='#e2e8f0'; ctx.font='13px system-ui'; ctx.textAlign='center';
      ctx.fillText(`${labels[i]}: ${q.a[i]}`, b.x+BTN_W/2, b.y+BTN_H/2+5);
    });

    if (!done) raf = requestAnimationFrame(draw);
  }
  raf = requestAnimationFrame(draw);
}

// ── HEAT MINI-GAME: Hydration Hero ───────────────────────────────────────────
function runHeatMiniGame(onComplete) {
  const d = getDiff();
  const canvas = mkCanvas();
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  let hydration = 70, timeLeft = d.time, score = 0, done = false, tick = 0;
  const drops = [], suns = [];
  const DRAIN = 0.12 * d.speed;

  const timer = setInterval(() => {
    if (done) return;
    if (--timeLeft <= 0) { clearInterval(timer); finish(hydration > 25); }
  }, 1000);

  function finish(win) {
    if (done) return; done = true;
    clearInterval(timer); cancelAnimationFrame(raf); canvas.remove();
    showResult(win,
      win ? 'You kept your neighbor hydrated through the heat wave! Drink water every 15-20 minutes.'
          : 'Dehydration set in. During extreme heat, drink before you feel thirsty — and help neighbors!',
      onComplete
    );
  }

  canvas.addEventListener('click', e => {
    if (done) return;
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    for (const drop of drops) {
      if (!drop.done && Math.hypot(mx-drop.x, my-drop.y) < drop.r+10) {
        drop.done = true; drop.flashT = 22; score++;
        hydration = Math.min(100, hydration + 13); return;
      }
    }
    for (const sun of suns) {
      if (!sun.done && Math.hypot(mx-sun.x, my-sun.y) < sun.r+10) {
        sun.done = true; sun.flashT = 22;
        hydration = Math.max(0, hydration - 18);
        if (hydration <= 0) finish(false); return;
      }
    }
  });

  let raf;
  function draw() {
    tick++;
    // Spawn
    if (tick % Math.round(38/d.speed) === 0)
      drops.push({ x:80+Math.random()*(W-160), y:-30, vy:(1.6+Math.random()*1.5)*d.speed, r:22, done:false, flashT:0 });
    if (tick % Math.round(58/d.speed) === 0)
      suns.push({ x:80+Math.random()*(W-160), y:-30, vy:(1.3+Math.random()*1.2)*d.speed, r:24, done:false, flashT:0 });

    hydration = Math.max(0, hydration - DRAIN);
    if (hydration <= 0 && !done) finish(false);

    ctx.clearRect(0,0,W,H);
    const sky = ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#fde68a'); sky.addColorStop(0.5,'#fbbf24'); sky.addColorStop(1,'#f97316');
    ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);

    // Drops
    drops.forEach(dr => {
      if (!dr.done) dr.y += dr.vy;
      if (dr.flashT > 0) dr.flashT--;
      if (dr.y > H+50) return;
      ctx.save(); ctx.globalAlpha = dr.done ? Math.max(0,dr.flashT/22) : 1;
      ctx.fillStyle = dr.flashT>0 ? '#22c55e' : '#60a5fa';
      ctx.beginPath(); ctx.arc(dr.x,dr.y,dr.r,0,Math.PI*2); ctx.fill();
      ctx.font='22px serif'; ctx.textAlign='center'; ctx.fillText('💧',dr.x,dr.y+8);
      ctx.restore();
    });

    // Suns
    suns.forEach(su => {
      if (!su.done) su.y += su.vy;
      if (su.flashT > 0) su.flashT--;
      if (su.y > H+50) return;
      ctx.save(); ctx.globalAlpha = su.done ? Math.max(0,su.flashT/22) : 1;
      ctx.fillStyle = su.flashT>0 ? '#ef4444' : '#fbbf24';
      ctx.beginPath(); ctx.arc(su.x,su.y,su.r,0,Math.PI*2); ctx.fill();
      ctx.font='24px serif'; ctx.textAlign='center'; ctx.fillText('☀️',su.x,su.y+8);
      ctx.restore();
    });

    // Hydration bar
    const bx=W/2-150, by=H-78, bw=300, bh=22;
    ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.roundRect(bx-2,by-2,bw+4,bh+4,8); ctx.fill();
    ctx.fillStyle = hydration>50?'#22c55e':hydration>25?'#f59e0b':'#ef4444';
    ctx.fillRect(bx, by, bw*(hydration/100), bh);
    ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.strokeRect(bx,by,bw,bh);
    ctx.fillStyle='#fff'; ctx.font='bold 12px system-ui'; ctx.textAlign='center';
    ctx.fillText(`💧 Hydration: ${Math.round(hydration)}%`, W/2, H-52);

    // HUD top
    ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,W,50);
    ctx.fillStyle='#fbbf24'; ctx.font='bold 17px system-ui'; ctx.textAlign='center';
    ctx.fillText('☀️ HYDRATION HERO — Click 💧 drops, avoid ☀️ suns!', W/2, 32);
    ctx.fillStyle='#fff'; ctx.font='14px system-ui';
    ctx.textAlign='left'; ctx.fillText(`⏱ ${timeLeft}s`, 18, 32);
    ctx.textAlign='right'; ctx.fillText(`💧 ${score}`, W-18, 32);

    if (!done) raf = requestAnimationFrame(draw);
  }
  raf = requestAnimationFrame(draw);
}

// ── EARTHQUAKE MINI-GAME: Drop Cover Hold ────────────────────────────────────
function runEarthquakeMiniGame(onComplete) {
  const d = getDiff();
  const canvas = mkCanvas();
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  const PHASES = [
    { key:'Space', label:'DROP!',    icon:'⬇️', desc:'Get on hands and knees',           color:'#f59e0b' },
    { key:'KeyC',  label:'COVER!',   icon:'🛡️', desc:'Cover your head and neck',         color:'#3b82f6' },
    { key:'KeyH',  label:'HOLD ON!', icon:'✊', desc:'Hold until shaking stops',         color:'#8b5cf6' },
  ];

  const TOTAL = d.lives===1 ? 5 : d.lives===2 ? 6 : 8;
  const Q_MS  = Math.round((d.time / TOTAL) * 1000);
  let round=0, correct=0, wrong=0, done=false;
  let current = PHASES[Math.floor(Math.random()*PHASES.length)];
  let feedback=null, promptStart=Date.now(), tick=0;

  function nextRound() {
    round++;
    if (round >= TOTAL) { finish(correct >= Math.ceil(TOTAL*0.6)); return; }
    current = PHASES[Math.floor(Math.random()*PHASES.length)];
    promptStart = Date.now(); feedback = null;
  }
  function finish(win) {
    if (done) return; done = true;
    document.removeEventListener('keydown', onKey);
    cancelAnimationFrame(raf); canvas.remove();
    showResult(win,
      win ? `${correct}/${TOTAL} correct! Drop, Cover, Hold On — you've got it.`
          : `${correct}/${TOTAL} correct. Practice Drop → Cover → Hold On; it only takes seconds to save your life!`,
      onComplete
    );
  }
  const onKey = e => {
    if (done || feedback) return;
    if (e.code === current.key) { correct++; feedback = { msg:`✓ ${current.label}`, color:'#22c55e', t:36 }; }
    else                        { wrong++;   feedback = { msg:`✗ Wrong — should be ${current.label}`, color:'#ef4444', t:36 }; }
    setTimeout(nextRound, 550);
  };
  document.addEventListener('keydown', onKey);

  let raf;
  function draw() {
    tick++;
    const shk = 7*Math.sin(tick*0.35);
    const sx = shk*(Math.random()-0.5), sy = shk*(Math.random()-0.5);

    ctx.save(); ctx.translate(sx,sy);
    ctx.clearRect(-20,-20,W+40,H+40);
    ctx.fillStyle='#120a24'; ctx.fillRect(-20,-20,W+40,H+40);

    // Crack lines
    ctx.strokeStyle='rgba(139,92,246,0.15)'; ctx.lineWidth=1.5;
    for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(Math.random()*W,0);ctx.lineTo(Math.random()*W,H);ctx.stroke();}

    ctx.fillStyle='#8b5cf6'; ctx.font='bold 21px system-ui'; ctx.textAlign='center';
    ctx.fillText('🌍 EARTHQUAKE — Drop, Cover, Hold On!', W/2, 44);
    ctx.fillStyle='#64748b'; ctx.font='13px system-ui';
    ctx.fillText(`Round ${round+1}/${TOTAL} — press the key shown below!`, W/2, 68);

    ctx.fillStyle='#22c55e'; ctx.font='14px system-ui'; ctx.textAlign='left';
    ctx.fillText(`✅ ${correct}  ❌ ${wrong}`, 18, 44);

    // Progress bar
    const elapsed=Date.now()-promptStart, pct=Math.max(0,1-elapsed/Q_MS);
    ctx.fillStyle='#1e1e3e'; ctx.fillRect(W*0.2,78,W*0.6,8);
    ctx.fillStyle=pct>0.5?'#8b5cf6':pct>0.25?'#f59e0b':'#ef4444';
    ctx.fillRect(W*0.2,78,W*0.6*pct,8);
    if (pct<=0 && !feedback && !done) { wrong++; nextRound(); }

    // Prompt card
    ctx.fillStyle='rgba(139,92,246,0.12)';
    ctx.beginPath(); ctx.roundRect(W/2-190,H/2-115,380,200,16); ctx.fill();
    ctx.strokeStyle=current.color; ctx.lineWidth=2; ctx.stroke();
    ctx.font='62px serif'; ctx.textAlign='center'; ctx.fillText(current.icon, W/2, H/2-18);
    ctx.fillStyle=current.color; ctx.font='bold 34px system-ui'; ctx.fillText(current.label, W/2, H/2+30);
    ctx.fillStyle='#94a3b8'; ctx.font='13px system-ui'; ctx.fillText(current.desc, W/2, H/2+58);

    // Key hint
    ctx.fillStyle='#1e293b'; ctx.beginPath(); ctx.roundRect(W/2-55,H/2+72,110,34,8); ctx.fill();
    ctx.strokeStyle='#475569'; ctx.lineWidth=1; ctx.stroke();
    ctx.fillStyle='#94a3b8'; ctx.font='bold 12px system-ui'; ctx.textAlign='center';
    const kl = current.key==='Space'?'SPACE':current.key.replace('Key','');
    ctx.fillText(`Press ${kl}`, W/2, H/2+95);

    // Feedback
    if (feedback) {
      if (feedback.t>0) feedback.t--;
      ctx.fillStyle=feedback.color; ctx.font='bold 26px system-ui'; ctx.textAlign='center';
      ctx.fillText(feedback.msg, W/2, H-90);
    }

    // Legend
    ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(0,H-44,W,44);
    PHASES.forEach((p,i) => {
      const x=W/2+(i-1)*230;
      ctx.fillStyle=p.color; ctx.font='bold 11px system-ui'; ctx.textAlign='center';
      ctx.fillText(`${p.icon} ${p.label} = ${p.key==='Space'?'SPACE':p.key.replace('Key','')}`, x, H-16);
    });

    ctx.restore();
    if (!done) raf = requestAnimationFrame(draw);
  }
  raf = requestAnimationFrame(draw);
}

// ── AI Chat injector ──────────────────────────────────────────────────────────
function injectAiChat(parent, systemPrompt) {
  const hist = [];
  const chat = document.createElement('div');
  Object.assign(chat.style, { display:'flex', flexDirection:'column', gap:'8px', marginTop:'4px' });

  const resp = document.createElement('div');
  Object.assign(resp.style, {
    minHeight:'34px', padding:'9px 12px', background:'rgba(74,134,232,0.12)',
    borderLeft:'3px solid #4a86e8', borderRadius:'6px', color:'#00ffff',
    fontSize:'11px', lineHeight:'1.7', display:'none', whiteSpace:'pre-wrap',
  });
  chat.appendChild(resp);

  const row = document.createElement('div');
  Object.assign(row.style, { display:'flex', gap:'8px' });
  const inp = document.createElement('input');
  inp.type='text'; inp.placeholder='Ask me anything…';
  Object.assign(inp.style, {
    flex:'1', padding:'8px 12px', background:'#0d1f35', border:'1px solid #4a86e8',
    borderRadius:'6px', color:'#fff', fontSize:'12px', outline:'none',
  });
  const btn = document.createElement('button');
  btn.textContent='Ask';
  Object.assign(btn.style, {
    padding:'8px 14px', background:'#4a86e8', color:'#fff', border:'none',
    borderRadius:'6px', cursor:'pointer', fontSize:'12px', fontWeight:'700',
  });
  async function send() {
    const q=inp.value.trim(); if(!q)return;
    inp.value=''; inp.disabled=true; btn.disabled=true; btn.textContent='…';
    hist.push({role:'user',content:q});
    resp.textContent='⏳ Thinking…'; resp.style.display='block';
    try {
      const r=await fetch(`${GEMINI_API_BASE}/api/gemini`,{
        method:'POST',credentials:'include',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({prompt:systemPrompt,text:q,history:hist.slice(-6)}),
      });
      const data=await r.json();
      const answer=data?.text||"I'm not sure right now.";
      hist.push({role:'assistant',content:answer});
      let i=0; resp.textContent='';
      function type(){if(i<answer.length){resp.textContent+=answer[i++];setTimeout(type,18);}}
      type();
    } catch { resp.textContent="Can't reach my knowledge base right now."; }
    finally { inp.disabled=false; btn.disabled=false; btn.textContent='Ask'; inp.focus(); }
  }
  btn.onclick=send;
  inp.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();send();}});
  row.appendChild(inp); row.appendChild(btn);
  chat.appendChild(row);
  parent.appendChild(chat);
  setTimeout(()=>inp.focus(),50);
}

// ── Quest interact factory ────────────────────────────────────────────────────
function makeQuestInteract(questId, systemPrompt, greeting, missionBrief, runMiniGame, kitItem) {
  return function() {
    if (!this.dialogueSystem) return;
    if (this.dialogueSystem.isDialogueOpen()) { this.dialogueSystem.closeDialogue(); return; }

    const complete = QuestState.isComplete(questId);
    const dlg = complete
      ? `✅ Mission Complete! You earned ${kitItem.icon} ${kitItem.label}. Ask me anything!`
      : greeting;

    this.dialogueSystem.showDialogue(dlg, this.spriteData?.id, this.spriteData?.src);

    requestAnimationFrame(() => {
      const box = document.getElementById('custom-dialogue-box-' + (this.dialogueSystem.safeId || this.dialogueSystem.id));
      if (!box || box.querySelector('.pnec-injected')) return;

      const wrap = document.createElement('div');
      wrap.className = 'pnec-injected';
      Object.assign(wrap.style, { marginTop:'10px', display:'flex', flexDirection:'column', gap:'8px' });

      if (!complete) {
        // Mission brief card
        const brief = document.createElement('div');
        Object.assign(brief.style, {
          background:'rgba(234,179,8,0.1)', border:'1px solid #ca8a04',
          borderRadius:'6px', padding:'10px 12px', color:'#fde68a',
          fontSize:'12px', lineHeight:'1.6',
        });
        brief.innerHTML = `<strong>📋 Mission:</strong> ${missionBrief}`;
        wrap.appendChild(brief);

        const startBtn = document.createElement('button');
        startBtn.textContent = '⚡ Start Mission';
        Object.assign(startBtn.style, {
          padding:'10px', background:'#ca8a04', color:'#fff', border:'none',
          borderRadius:'6px', cursor:'pointer', fontWeight:'700', fontSize:'13px',
        });
        startBtn.onclick = () => {
          this.dialogueSystem.closeDialogue();
          runMiniGame(win => {
            if (win) {
              QuestState.complete(questId, kitItem);
              if (QuestState.allComplete()) setTimeout(showWinScreen, 700);
            }
          });
        };
        wrap.appendChild(startBtn);
      }

      injectAiChat(wrap, systemPrompt);
      const closeBtn = box.querySelector('button');
      if (closeBtn) box.insertBefore(wrap, closeBtn); else box.appendChild(wrap);
    });
  };
}

// ── GameLevelPoway ────────────────────────────────────────────────────────────
class GameLevelPoway {
  constructor(gameEnv) {
    const path = gameEnv.path;

    // Show difficulty selector on first visit
    if (!QuestState.getDifficulty()) {
      showDifficultySelector(() => {
        KitHUD.mount();
        if (QuestState.allComplete()) showWinScreen();
      });
    } else {
      KitHUD.mount();
      if (QuestState.allComplete()) setTimeout(showWinScreen, 800);
    }

    // ── Background ──────────────────────────────────────────────────────────
    const image_data_poway = {
      name: 'poway-neighborhood',
      greeting: "Welcome to Poway! Talk to the 4 hazard experts to build your Emergency Kit.",
      src: path + "/assets/images/Poway_Image.webp",
      pixels: { height: 580, width: 1038 },
    };

    // ── Player ──────────────────────────────────────────────────────────────
    const sprite_data_player = {
      id: 'Resident',
      greeting: "I'm a Poway resident learning to be prepared.",
      src: path + "/images/gamify/chillguy.png",
      SCALE_FACTOR: 5, STEP_FACTOR: 1000, ANIMATION_RATE: 50,
      INIT_POSITION: { x: 0.1, y: 0.8 },
      pixels: { height: 384, width: 512 },
      orientation: { rows: 3, columns: 4 },
      down:      { row: 0, start: 0, columns: 3 },
      downRight: { row: 1, start: 0, columns: 3, rotate:  Math.PI/16 },
      downLeft:  { row: 2, start: 0, columns: 3, rotate: -Math.PI/16 },
      left:      { row: 2, start: 0, columns: 3 },
      right:     { row: 1, start: 0, columns: 3 },
      up:        { row: 3, start: 0, columns: 3 },
      upLeft:    { row: 2, start: 0, columns: 3, rotate:  Math.PI/16 },
      upRight:   { row: 1, start: 0, columns: 3, rotate: -Math.PI/16 },
      hitbox: { widthPercentage: 0.45, heightPercentage: 0.2 },
      keypress: { up: 87, left: 65, down: 83, right: 68 },
    };

    // ── Locked NPC helper ───────────────────────────────────────────────────
    function locked(prereqId, prereqName) {
      return function() {
        if (!this.dialogueSystem) return;
        if (this.dialogueSystem.isDialogueOpen()) { this.dialogueSystem.closeDialogue(); return; }
        if (QuestState.isComplete(prereqId)) return; // unlocked — shouldn't reach here
        this.dialogueSystem.showDialogue(
          `🔒 Complete the ${prereqName}'s mission first to unlock me!`,
          this.spriteData?.id, this.spriteData?.src
        );
      };
    }

    // ── NPC 1: Park Ranger (always open — intro) ────────────────────────────
    const sprite_data_ranger = {
      id: 'Park Ranger', src: path + "/images/gamify/npc1.png",
      SCALE_FACTOR: 8, ANIMATION_RATE: 50,
      pixels: { height: 678, width: 342 }, INIT_POSITION: { x: 0.25, y: 0.6 },
      orientation: { rows: 1, columns: 1 }, down: { row: 0, start: 0, columns: 1 },
      hitbox: { widthPercentage: 0.15, heightPercentage: 0.25 },
      dialogues: ["Welcome! Find the 4 hazard experts to build your Emergency Kit!"],
      interact: makeQuestInteract(
        'ranger',
        `You are a friendly Park Ranger in Poway, CA, part of PNEC (Poway Neighborhood Emergency Corps). Answer questions about Poway emergency preparedness, local hazards (wildfire, flood, earthquake, heat), and PNEC programs. Keep answers concise (2-4 sentences). Stay in character.`,
        "Welcome to Poway! I'm the Park Ranger. Talk to the Fire Chief, Flood Warden, Heat Advisor, and PNEC Volunteer to build your Emergency Kit. Start with the 🔥 Fire Chief northeast of here! 🌲",
        "Introduce yourself to the emergency experts around Poway. Each one has a mission that fills your Emergency Kit!",
        (cb) => cb(true), // no mini-game for ranger — auto-complete
        { label: 'Intro Badge', icon: '🌲' }
      ),
    };

    // ── NPC 2: Fire Chief ───────────────────────────────────────────────────
    const _fireInteract = makeQuestInteract(
      'fire',
      `You are the Poway Fire Chief, expert in wildfire safety for Poway, CA. You know: 2007 Witch Creek Fire (7,247 acres, 90 Poway homes), defensible space (100ft clearance), evacuation bags (water, meds, documents, charger, 3 days food), evacuation zones A/B/C, SD Emergency Alerts at sdeoc.com, Cal Fire hazard zones. Keep answers concise (2-4 sentences).`,
      "I'm the Poway Fire Chief. Fire is our biggest threat — especially during Santa Ana wind season. Complete my mission, then ask me anything! 🔥",
      "Pack Your Go-Bag! Click the 5 essential emergency items before time runs out. Watch out — wrong items cost you time and lives!",
      runFireMiniGame,
      { label: 'Go-Bag', icon: '🎒' }
    );
    const sprite_data_firechief = {
      id: 'Fire Chief', src: path + "/images/gamify/npc2.png",
      SCALE_FACTOR: 8, ANIMATION_RATE: 50,
      pixels: { height: 254, width: 261 }, INIT_POSITION: { x: 0.55, y: 0.35 },
      orientation: { rows: 1, columns: 1 }, down: { row: 0, start: 0, columns: 1 },
      hitbox: { widthPercentage: 0.15, heightPercentage: 0.25 },
      dialogues: ["Are you ready to evacuate when fire strikes?"],
      interact: _fireInteract,
    };

    // ── NPC 3: Flood Warden (unlocks after fire) ────────────────────────────
    const _floodInteract = makeQuestInteract(
      'flood',
      `You are the Poway Flood Warden. You advise on flash flood warnings (>1 inch/hour or 2 inches in 48 hours), "Turn Around Don't Drown" (6 inches of water knocks adults down), sandbags, FEMA Flood Map at msc.fema.gov, Poway Creek (can rise 10 feet in under an hour), post-flood safety (gas, sewage, live wires). Keep answers concise (2-4 sentences).`,
      "I'm the Flood Warden. Winter storms in Poway can cause flash flooding faster than you think. Complete my quiz first! 🌊",
      "Flood Safety Quiz! Answer 5 questions correctly (need 3/5 to pass). You have limited time per question — think fast and trust your knowledge!",
      runFloodMiniGame,
      { label: 'Sandbags', icon: '🌊' }
    );
    const sprite_data_floodwarden = {
      id: 'Flood Warden', src: path + "/images/gamify/npc3.png",
      SCALE_FACTOR: 8, ANIMATION_RATE: 50,
      pixels: { height: 378, width: 149 }, INIT_POSITION: { x: 0.75, y: 0.6 },
      orientation: { rows: 1, columns: 1 }, down: { row: 0, start: 0, columns: 1 },
      hitbox: { widthPercentage: 0.15, heightPercentage: 0.25 },
      dialogues: ["Do you know Turn Around, Don't Drown?"],
      interact: function() {
        if (!QuestState.isComplete('fire')) { locked('fire','Fire Chief').call(this); return; }
        _floodInteract.call(this);
      },
    };

    // ── NPC 4: Heat Advisor (unlocks after flood) ───────────────────────────
    const _heatInteract = makeQuestInteract(
      'heat',
      `You are the Poway Heat Advisor. You advise on heat thresholds (>100°F or heat index >103°F), hydration (drink every 15-20 min), vulnerable populations (elderly, children, pets), Poway cooling centers at poway.org (open when heat index >95°F), avoiding exertion 10am-4pm, heat stroke signs (confusion, hot/dry skin, call 911), cars reaching 160°F on hot days. Keep answers concise (2-4 sentences).`,
      "I'm the Heat Advisor. Extreme heat kills more Americans than any other weather event. Complete my mission first! 🌡️",
      "Hydration Hero! Click the 💧 water drops to keep your neighbor's hydration above 25% for the whole timer. Clicking ☀️ suns drains hydration — avoid them!",
      runHeatMiniGame,
      { label: 'Water Jug', icon: '💧' }
    );
    const sprite_data_heatadvisor = {
      id: 'Heat Advisor', src: path + "/images/gamify/npc4.png",
      SCALE_FACTOR: 8, ANIMATION_RATE: 50,
      pixels: { height: 222, width: 147 }, INIT_POSITION: { x: 0.4, y: 0.7 },
      orientation: { rows: 1, columns: 1 }, down: { row: 0, start: 0, columns: 1 },
      hitbox: { widthPercentage: 0.15, heightPercentage: 0.25 },
      dialogues: ["Extreme heat is a silent killer — are you prepared?"],
      interact: function() {
        if (!QuestState.isComplete('flood')) { locked('flood','Flood Warden').call(this); return; }
        _heatInteract.call(this);
      },
    };

    // ── NPC 5: PNEC Volunteer — Earthquake mission (unlocks after heat) ─────
    const _eqInteract = makeQuestInteract(
      'earthquake',
      `You are a PNEC Community Hub Volunteer. PNEC was founded in 1995, has 500+ trained volunteers across 60+ Poway neighborhoods. You advise on: CERT (Community Emergency Response Team) free training, PACT ham radio team, PNEC's 3 pillars (Preparedness/Response/Recovery), role quiz at /role-quiz/, earthquake safety (Drop/Cover/Hold On, 72-hour kit, gas shutoff, structural assessment), and how to find your neighborhood coordinator. Keep answers concise (2-4 sentences).`,
      "Welcome to the PNEC Community Hub! You're almost done — one final mission: prove you know earthquake survival. Complete it to finish your Emergency Kit! 🤝",
      "Drop, Cover, Hold On! When each phase flashes on screen, press the matching key. React fast — multiple rounds, need 60% correct to pass!",
      runEarthquakeMiniGame,
      { label: 'Safety Kit', icon: '⚠️' }
    );
    const sprite_data_community = {
      id: 'PNEC Volunteer', src: path + "/images/gamify/npc5.png",
      SCALE_FACTOR: 8, ANIMATION_RATE: 50,
      pixels: { height: 632, width: 395 }, INIT_POSITION: { x: 0.85, y: 0.2 },
      orientation: { rows: 1, columns: 1 }, down: { row: 0, start: 0, columns: 1 },
      hitbox: { widthPercentage: 0.15, heightPercentage: 0.25 },
      dialogues: ["Final mission — prove you know earthquake survival!"],
      interact: function() {
        if (!QuestState.isComplete('heat')) { locked('heat','Heat Advisor').call(this); return; }
        _eqInteract.call(this);
      },
    };

    this.classes = [
      { class: GamEnvBackground, data: image_data_poway },
      { class: Player,           data: sprite_data_player },
      { class: Npc,              data: sprite_data_ranger },
      { class: Npc,              data: sprite_data_firechief },
      { class: Npc,              data: sprite_data_floodwarden },
      { class: Npc,              data: sprite_data_heatadvisor },
      { class: Npc,              data: sprite_data_community },
    ];
  }

  destroy() {
    KitHUD.unmount();
  }
}

export default GameLevelPoway;
