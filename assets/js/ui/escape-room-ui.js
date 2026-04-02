// ui/escape-room-ui.js
// Responsibility: HUD rendering — timer, score, hearts, inventory, act label.
// WORKER — draws only, never modifies game state.

const SLOT_SIZE = 36;
const SLOT_GAP  = 4;
const HOTBAR_Y  = LOGICAL_HEIGHT - SLOT_SIZE - 6;
const HOTBAR_X  = LOGICAL_WIDTH / 2 - (MAX_SLOTS * (SLOT_SIZE + SLOT_GAP)) / 2;

/**
 * Main HUD render — called last each frame so it draws on top of world.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} gameState  { act, phase, score, lives, timeRemaining, actItems }
 * @param {number} frame
 */
function renderHUD(ctx, gameState, frame) {
  _renderActLabel(ctx, gameState);
  _renderTimer(ctx, gameState, frame);
  _renderScore(ctx, gameState);
  _renderHearts(ctx, gameState);
  _renderHotbar(ctx, gameState);
  _renderObjective(ctx, gameState);
}

function _renderActLabel(ctx, gs) {
  const def = DISASTER_DEFS[gs.act];
  const label = `ACT ${gs.act}: ${def.name} ${def.icon}`;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(6, 6, 180, 22);
  ctx.fillStyle = '#fff';
  ctx.font      = 'bold 13px monospace';
  ctx.fillText(label, 10, 22);
}

function _renderTimer(ctx, gs, frame) {
  const t = Math.max(0, Math.ceil(gs.timeRemaining));
  const pct = gs.timeCap > 0 ? t / gs.timeCap : 0;
  const barW = 160;
  const barX = LOGICAL_WIDTH / 2 - barW / 2;
  const barY = 6;

  // Background bar
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(barX - 2, barY - 2, barW + 4, 22);

  // Fill
  const fillColor = t < 15 ? (Math.floor(frame / 8) % 2 === 0 ? '#e74c3c' : '#ff8080')
                  : t < 30 ? '#e67e22'
                  : '#2ecc71';
  ctx.fillStyle = fillColor;
  ctx.fillRect(barX, barY, barW * pct, 18);

  // Timer text
  ctx.fillStyle = '#fff';
  ctx.font      = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(t + 's', LOGICAL_WIDTH / 2, barY + 14);
  ctx.textAlign = 'left';
}

function _renderScore(ctx, gs) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(LOGICAL_WIDTH - 106, 6, 100, 22);
  ctx.fillStyle = '#f1c40f';
  ctx.font      = 'bold 13px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('Score: ' + gs.score, LOGICAL_WIDTH - 8, 22);
  ctx.textAlign = 'left';
}

function _renderHearts(ctx, gs) {
  ctx.font = '16px serif';
  for (let i = 0; i < 3; i++) {
    ctx.globalAlpha = i < gs.lives ? 1 : 0.2;
    ctx.fillText('❤', 10 + i * 22, 46);
  }
  ctx.globalAlpha = 1;
}

function _renderHotbar(ctx, gs) {
  if (!gs.actItems) return;
  const slots = getInventorySlots(gs.actItems);

  for (let i = 0; i < slots.length && i < MAX_SLOTS; i++) {
    const slot = slots[i];
    const sx   = HOTBAR_X + i * (SLOT_SIZE + SLOT_GAP);

    // Slot background
    ctx.fillStyle = slot.collected ? 'rgba(39,174,96,0.8)' : 'rgba(0,0,0,0.6)';
    ctx.strokeStyle = slot.collected ? '#2ecc71' : '#555';
    ctx.lineWidth   = 2;
    ctx.fillRect(sx, HOTBAR_Y, SLOT_SIZE, SLOT_SIZE);
    ctx.strokeRect(sx, HOTBAR_Y, SLOT_SIZE, SLOT_SIZE);

    if (slot.collected) {
      // Draw icon in slot
      _renderSlotIcon(ctx, slot.def, sx + SLOT_SIZE/2, HOTBAR_Y + SLOT_SIZE/2);
    } else {
      // Show required indicator
      if (slot.def.required) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.font      = '10px monospace';
        ctx.fillText('?', sx + 14, HOTBAR_Y + 22);
      }
    }
  }
}

function _renderSlotIcon(ctx, def, cx, cy) {
  ctx.save();
  ctx.fillStyle = def.color;
  const s = def.shape;
  if (s === 'cross') {
    ctx.fillRect(cx - 2, cy - 8, 4, 16);
    ctx.fillRect(cx - 8, cy - 2, 16, 4);
  } else if (s === 'bottle') {
    ctx.fillRect(cx - 3, cy - 8, 6, 12);
    ctx.fillRect(cx - 1, cy - 11, 2, 4);
  } else if (s === 'beam') {
    ctx.fillRect(cx - 3, cy - 8, 6, 10);
    ctx.fillStyle = '#fff9';
    ctx.beginPath(); ctx.arc(cx, cy - 10, 4, -0.8, Math.PI + 0.8); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function _renderObjective(ctx, gs) {
  if (!gs.objective) return;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(6, LOGICAL_HEIGHT - 26, LOGICAL_WIDTH * 0.55, 20);
  ctx.fillStyle = '#f1c40f';
  ctx.font      = '11px monospace';
  ctx.fillText('▶ ' + gs.objective, 10, LOGICAL_HEIGHT - 12);
}

// ─── PAUSE OVERLAY ───────────────────────────────────────────────────────────

function renderPauseMenu(ctx, objective) {
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  ctx.fillStyle = '#fff';
  ctx.font      = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', LOGICAL_WIDTH/2, 200);

  ctx.font      = '14px monospace';
  ctx.fillStyle = '#aaa';
  if (objective) ctx.fillText('Objective: ' + objective, LOGICAL_WIDTH/2, 240);

  _menuButton(ctx, LOGICAL_WIDTH/2, 290, 160, 36, 'Resume [Esc]', '#2ecc71');
  _menuButton(ctx, LOGICAL_WIDTH/2, 340, 160, 36, 'Restart Act',  '#e67e22');
  _menuButton(ctx, LOGICAL_WIDTH/2, 390, 160, 36, 'Quit to Menu', '#e74c3c');

  ctx.textAlign = 'left';
}

// ─── GAME OVER ───────────────────────────────────────────────────────────────

function renderGameOver(ctx, gs) {
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  ctx.fillStyle = '#e74c3c';
  ctx.font      = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.fillText("You didn't make it...", LOGICAL_WIDTH/2, 180);

  ctx.fillStyle = '#fff';
  ctx.font      = '15px monospace';
  ctx.fillText('Reached Act ' + gs.act, LOGICAL_WIDTH/2, 220);
  ctx.fillText('Score: ' + gs.score, LOGICAL_WIDTH/2, 245);

  if (gs.gameOverReason) {
    ctx.fillStyle = '#e67e22';
    ctx.fillText(gs.gameOverReason, LOGICAL_WIDTH/2, 275);
  }

  _menuButton(ctx, LOGICAL_WIDTH/2, 320, 160, 36, 'Try Again', '#e74c3c');
  ctx.textAlign = 'left';
}

// ─── VICTORY ─────────────────────────────────────────────────────────────────

function renderVictory(ctx, gs, frame, particles) {
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  // Celebration particles
  if (particles) _renderVictoryParticles(ctx, particles, frame);

  ctx.fillStyle = '#f1c40f';
  ctx.font      = 'bold 34px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('POWAY PREPARED!', LOGICAL_WIDTH/2, 120);

  ctx.fillStyle = '#fff';
  ctx.font      = '15px monospace';
  ctx.fillText('Final Score: ' + gs.score, LOGICAL_WIDTH/2, 160);
  ctx.fillText('Badge: ' + _getBadge(gs.score), LOGICAL_WIDTH/2, 185);

  ctx.font = '13px monospace';
  ctx.fillStyle = '#aaa';
  ctx.fillText('Act 1 (Wildfire): +' + (gs.actScores[1]||0), LOGICAL_WIDTH/2, 215);
  ctx.fillText('Act 2 (Earthquake): +' + (gs.actScores[2]||0), LOGICAL_WIDTH/2, 233);
  ctx.fillText('Act 3 (Flood): +' + (gs.actScores[3]||0), LOGICAL_WIDTH/2, 251);

  if (gs.submitted) {
    ctx.fillStyle = '#2ecc71';
    ctx.font      = 'bold 18px monospace';
    ctx.fillText('Score Submitted!', LOGICAL_WIDTH/2, 295);
    ctx.fillStyle = '#aaa';
    ctx.font      = '13px monospace';
    ctx.fillText('Thanks, ' + (gs.playerName || 'Anonymous') + '!', LOGICAL_WIDTH/2, 318);
    _menuButton(ctx, LOGICAL_WIDTH/2 - 94, 355, 150, 36, 'Play Again',       '#3498db');
    _menuButton(ctx, LOGICAL_WIDTH/2 + 94, 355, 150, 36, 'Leaderboard',      '#e67e22');
  } else {
    ctx.fillStyle = '#fff';
    ctx.font      = '13px monospace';
    ctx.fillText('Your Name: ' + (gs.playerName || '_'), LOGICAL_WIDTH/2, 285);
    ctx.strokeStyle = '#555';
    ctx.lineWidth   = 1;
    ctx.strokeRect(LOGICAL_WIDTH/2 - 120, 293, 240, 20);
    _menuButton(ctx, LOGICAL_WIDTH/2, 338, 220, 38, 'Click Here to Submit Score', '#2ecc71');
    ctx.fillStyle = '#888';
    ctx.font      = '11px monospace';
    ctx.fillText('(or press Enter)', LOGICAL_WIDTH/2, 372);
    _menuButton(ctx, LOGICAL_WIDTH/2, 400, 160, 32, 'View Leaderboard', '#e67e22');
  }
  ctx.textAlign = 'left';
}

function _renderVictoryParticles(ctx, particles, frame) {
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
    ctx.fill();
    p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.alpha -= 0.012;
  }
  ctx.globalAlpha = 1;
}

function _getBadge(score) {
  if (score >= 800) return 'PNEC Champion 🏆';
  if (score >= 600) return 'Community Resilient';
  if (score >= 400) return 'Neighborhood Ready';
  return 'Getting Prepared';
}

// ─── DISASTER FLASH ──────────────────────────────────────────────────────────

function renderDisasterFlash(ctx, color, alpha) {
  ctx.fillStyle = color.replace('0.85', alpha.toFixed(2));
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
}

function renderDisasterMessage(ctx, message) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, LOGICAL_HEIGHT/2 - 36, LOGICAL_WIDTH, 72);
  ctx.fillStyle = '#e74c3c';
  ctx.font      = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(message, LOGICAL_WIDTH/2, LOGICAL_HEIGHT/2 - 4);
  ctx.fillStyle = '#fff';
  ctx.font      = '13px monospace';
  ctx.fillText('Press E to continue', LOGICAL_WIDTH/2, LOGICAL_HEIGHT/2 + 20);
  ctx.textAlign = 'left';
}

// ─── BUTTON HELPER ───────────────────────────────────────────────────────────

function _menuButton(ctx, cx, cy, w, h, label, color) {
  const x = cx - w/2;
  const y = cy - h/2;
  ctx.fillStyle   = color;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#fff';
  ctx.font      = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + 5);
}

// Returns {action} for menu click testing — checks logical coords
function checkMenuClick(mx, my, phase) {
  const cx = LOGICAL_WIDTH / 2;
  if (phase === 'paused') {
    if (_inBtn(mx, my, cx, 290, 160, 36)) return 'resume';
    if (_inBtn(mx, my, cx, 340, 160, 36)) return 'restart';
    if (_inBtn(mx, my, cx, 390, 160, 36)) return 'quit';
  } else if (phase === 'gameover') {
    if (_inBtn(mx, my, cx, 320, 160, 36)) return 'restart';
  } else if (phase === 'victory') {
    if (_inBtn(mx, my, cx,        338, 220, 38)) return 'submit';
    if (_inBtn(mx, my, cx,        400, 160, 32)) return 'leaderboard';
    if (_inBtn(mx, my, cx - 94,   355, 150, 36)) return 'playagain';
    if (_inBtn(mx, my, cx + 94,   355, 150, 36)) return 'leaderboard';
  }
  return null;
}

function _inBtn(mx, my, cx, cy, w, h) {
  return mx >= cx - w/2 && mx <= cx + w/2 && my >= cy - h/2 && my <= cy + h/2;
}

// ─── LEADERBOARD POPUP ───────────────────────────────────────────────────────

const LB_CLOSE_BTN = { x: LOGICAL_WIDTH - 110, y: 30, w: 90, h: 28 };

function renderLeaderboard(ctx, entries, loading) {
  // Dark overlay
  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  // Panel
  ctx.fillStyle = '#0d1b2a';
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth   = 2;
  ctx.fillRect(60, 20, LOGICAL_WIDTH - 120, LOGICAL_HEIGHT - 40);
  ctx.strokeRect(60, 20, LOGICAL_WIDTH - 120, LOGICAL_HEIGHT - 40);

  // Title
  ctx.fillStyle   = '#f1c40f';
  ctx.font        = 'bold 20px monospace';
  ctx.textAlign   = 'center';
  ctx.fillText('LEADERBOARD', LOGICAL_WIDTH/2, 56);

  ctx.fillStyle   = '#aaa';
  ctx.font        = '11px monospace';
  ctx.fillText('Poway Prepared — Top Scores', LOGICAL_WIDTH/2, 74);

  if (loading) {
    ctx.fillStyle = '#fff';
    ctx.font      = '14px monospace';
    ctx.fillText('Loading...', LOGICAL_WIDTH/2, 200);
  } else if (!entries || entries.length === 0) {
    ctx.fillStyle = '#aaa';
    ctx.font      = '13px monospace';
    ctx.fillText('No scores yet — be the first!', LOGICAL_WIDTH/2, 200);
  } else {
    _renderLeaderboardRows(ctx, entries);
  }

  // Close button
  ctx.fillStyle   = '#e74c3c';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1;
  ctx.fillRect(LB_CLOSE_BTN.x, LB_CLOSE_BTN.y, LB_CLOSE_BTN.w, LB_CLOSE_BTN.h);
  ctx.strokeRect(LB_CLOSE_BTN.x, LB_CLOSE_BTN.y, LB_CLOSE_BTN.w, LB_CLOSE_BTN.h);
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 12px monospace';
  ctx.textAlign   = 'center';
  ctx.fillText('✕ Close', LB_CLOSE_BTN.x + LB_CLOSE_BTN.w/2, LB_CLOSE_BTN.y + 19);
  ctx.textAlign   = 'left';
}

function _renderLeaderboardRows(ctx, entries) {
  const rowH = 38;
  const startY = 100;
  const cols = { rank: 82, name: 120, score: 390, badge: 490, acts: 670 };

  // Header
  ctx.fillStyle = '#f1c40f';
  ctx.font      = 'bold 11px monospace';
  ctx.fillText('#',      cols.rank,  startY);
  ctx.fillText('Name',   cols.name,  startY);
  ctx.fillText('Score',  cols.score, startY);
  ctx.fillText('Badge',  cols.badge, startY);
  ctx.fillText('Acts',   cols.acts,  startY);

  ctx.strokeStyle = '#333';
  ctx.lineWidth   = 1;
  ctx.beginPath(); ctx.moveTo(74, startY + 6); ctx.lineTo(LOGICAL_WIDTH - 74, startY + 6); ctx.stroke();

  entries.slice(0, 10).forEach(function(e, i) {
    const y    = startY + 18 + i * rowH;
    const isMe = (i === 0);

    ctx.fillStyle = isMe ? 'rgba(241,196,15,0.12)' : (i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent');
    ctx.fillRect(66, y - 14, LOGICAL_WIDTH - 132, rowH - 4);

    const rankColor = i === 0 ? '#f1c40f' : i === 1 ? '#aaa' : i === 2 ? '#cd7f32' : '#fff';
    ctx.fillStyle = rankColor;
    ctx.font      = 'bold 13px monospace';
    ctx.fillText('#' + (i + 1), cols.rank, y);

    ctx.fillStyle = '#fff';
    ctx.font      = '13px monospace';
    const name = (e.player_name || e.display_name || 'Anonymous').substring(0, 16);
    ctx.fillText(name, cols.name, y);

    ctx.fillStyle = '#2ecc71';
    ctx.font      = 'bold 13px monospace';
    ctx.fillText(e.score, cols.score, y);

    ctx.fillStyle = '#aaa';
    ctx.font      = '11px monospace';
    const badge = (e.badge || '').replace(/_/g, ' ');
    ctx.fillText(badge.substring(0, 18), cols.badge, y);

    ctx.fillStyle = '#3498db';
    ctx.font      = '13px monospace';
    ctx.fillText((e.acts_completed || 0) + '/3', cols.acts, y);
  });
}

function leaderboardCloseHit(mx, my) {
  return mx >= LB_CLOSE_BTN.x && mx <= LB_CLOSE_BTN.x + LB_CLOSE_BTN.w &&
         my >= LB_CLOSE_BTN.y && my <= LB_CLOSE_BTN.y + LB_CLOSE_BTN.h;
}
