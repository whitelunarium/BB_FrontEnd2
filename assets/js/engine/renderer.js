// engine/renderer.js
// Responsibility: All canvas drawing — tiles, sprites, items, effects.
// WORKER — draws only, never modifies game state.

// ─── WORLD ───────────────────────────────────────────────────────────────────

function renderWorld(ctx, camX, camY, frame) {
  const startCol = Math.max(0, Math.floor(camX / TILE_SIZE));
  const endCol   = Math.min(MAP_COLS - 1, Math.ceil((camX + LOGICAL_WIDTH) / TILE_SIZE));
  const startRow = Math.max(0, Math.floor(camY / TILE_SIZE));
  const endRow   = Math.min(MAP_ROWS - 1, Math.ceil((camY + LOGICAL_HEIGHT) / TILE_SIZE));

  for (let r = startRow; r <= endRow; r++) {
    for (let c = startCol; c <= endCol; c++) {
      const tile = getTile(r, c);
      const sx   = c * TILE_SIZE - camX;
      const sy   = r * TILE_SIZE - camY;
      _renderTile(ctx, tile, sx, sy, frame);
    }
  }
}

function _renderTile(ctx, tile, sx, sy, frame) {
  const T = TILES;
  ctx.fillStyle = TILE_COLORS[tile] || '#333';
  ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);

  if (tile === T.WALL) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(sx + TILE_SIZE - 4, sy, 4, TILE_SIZE);
    ctx.fillRect(sx, sy + TILE_SIZE - 4, TILE_SIZE, 4);
  } else if (tile === T.DOOR) {
    ctx.fillStyle = '#5d3a1a';
    ctx.fillRect(sx + 8, sy + 4, TILE_SIZE - 16, TILE_SIZE - 4);
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath(); ctx.arc(sx + TILE_SIZE - 10, sy + TILE_SIZE/2, 3, 0, Math.PI*2); ctx.fill();
  } else if (tile === T.TREE) {
    // trunk
    ctx.fillStyle = '#7b4f2e';
    ctx.fillRect(sx + 12, sy + 18, 8, 14);
    // canopy
    ctx.fillStyle = '#27ae60';
    ctx.beginPath(); ctx.arc(sx + 16, sy + 14, 12, 0, Math.PI*2); ctx.fill();
  } else if (tile === T.FIRE) {
    const flicker = Math.floor(frame / 8) % 2;
    ctx.fillStyle = flicker ? '#e74c3c' : '#e67e22';
    ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    _drawFlame(ctx, sx + 6,  sy + 6,  8, 14, frame);
    _drawFlame(ctx, sx + 18, sy + 10, 6, 12, frame + 5);
  } else if (tile === T.WATER) {
    const wave = Math.sin(frame * 0.05) * 3;
    ctx.fillStyle = '#1a6fa0';
    ctx.fillRect(sx, sy, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#3498db';
    ctx.fillRect(sx + 2, sy + 10 + wave, TILE_SIZE - 4, 4);
    ctx.fillRect(sx + 2, sy + 22 - wave, TILE_SIZE - 4, 4);
  } else if (tile === T.CRACK) {
    ctx.strokeStyle = '#555';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(sx + 4, sy + 4);
    ctx.lineTo(sx + 14, sy + 16);
    ctx.lineTo(sx + 10, sy + 28);
    ctx.stroke();
  } else if (tile === T.SAFE_ZONE) {
    ctx.strokeStyle = '#2ecc71';
    ctx.lineWidth   = 1;
    ctx.strokeRect(sx + 2, sy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
  } else if (tile === T.RUBBLE) {
    ctx.fillStyle = '#7f8c8d';
    for (let i = 0; i < 4; i++) {
      const rx = sx + (i * 7) % 20 + 2;
      const ry = sy + (i * 5) % 20 + 2;
      ctx.fillRect(rx, ry, 8, 6);
    }
  }
}

function _drawFlame(ctx, x, y, w, h, frame) {
  const t = frame * 0.2;
  ctx.fillStyle = 'rgba(255, 200, 50, 0.8)';
  ctx.beginPath();
  ctx.moveTo(x + w/2, y);
  ctx.quadraticCurveTo(x + w + Math.sin(t)*3, y + h*0.4, x + w*0.7, y + h*0.7);
  ctx.lineTo(x + w/2, y + h);
  ctx.lineTo(x + w*0.3, y + h*0.7);
  ctx.quadraticCurveTo(x - Math.sin(t)*3, y + h*0.4, x + w/2, y);
  ctx.fill();
}

// ─── ITEMS ───────────────────────────────────────────────────────────────────

function renderItems(ctx, items, camX, camY, frame) {
  for (const item of items) {
    if (item.collected) continue;
    const sx = item.x - camX;
    const sy = item.y - camY;
    const bob = Math.sin(frame * 0.08) * 3;
    _renderItemIcon(ctx, item, sx, sy + bob);
  }
}

function _renderItemIcon(ctx, item, sx, sy) {
  // Glow
  ctx.save();
  ctx.shadowColor = item.color;
  ctx.shadowBlur  = 8;
  ctx.fillStyle   = item.color;

  const s = item.shape;
  if (s === 'bag' || s === 'sack') {
    ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI*2); ctx.fill();
    ctx.fillRect(sx - 5, sy - 14, 10, 6);
  } else if (s === 'bottle') {
    ctx.fillRect(sx - 4, sy - 12, 8, 16);
    ctx.fillRect(sx - 2, sy - 16, 4, 5);
  } else if (s === 'folder') {
    ctx.fillRect(sx - 9, sy - 8, 18, 14);
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx - 6, sy - 5, 12, 2);
    ctx.fillRect(sx - 6, sy - 1, 12, 2);
  } else if (s === 'cross') {
    ctx.fillRect(sx - 3, sy - 10, 6, 20);
    ctx.fillRect(sx - 10, sy - 3, 20, 6);
  } else if (s === 'beam') {
    ctx.fillRect(sx - 4, sy - 10, 8, 14);
    ctx.fillStyle = '#fff8';
    ctx.beginPath(); ctx.arc(sx, sy - 12, 5, -0.8, Math.PI + 0.8); ctx.fill();
  } else if (s === 'radio') {
    ctx.fillRect(sx - 9, sy - 8, 18, 14);
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(sx, sy - 2, 4, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = item.color;
    ctx.fillRect(sx + 3, sy - 12, 2, 6);
  } else if (s === 'vest') {
    ctx.beginPath();
    ctx.moveTo(sx - 9, sy - 10);
    ctx.lineTo(sx - 9, sy + 8);
    ctx.lineTo(sx - 2, sy + 8);
    ctx.lineTo(sx, sy - 2);
    ctx.lineTo(sx + 2, sy + 8);
    ctx.lineTo(sx + 9, sy + 8);
    ctx.lineTo(sx + 9, sy - 10);
    ctx.lineTo(sx + 4, sy - 10);
    ctx.lineTo(sx, sy - 4);
    ctx.lineTo(sx - 4, sy - 10);
    ctx.closePath(); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

// ─── NPCS ────────────────────────────────────────────────────────────────────

function renderNPCs(ctx, npcs, camX, camY, frame) {
  for (const npc of npcs) {
    _renderNPCSprite(ctx, npc, npc.x - camX, npc.y - camY, frame);
  }
}

function _renderNPCSprite(ctx, npc, sx, sy, frame) {
  // Body
  ctx.fillStyle = npc.color;
  ctx.fillRect(sx - 7, sy - 10, 14, 16);

  // Head
  ctx.fillStyle = '#f5cba7';
  ctx.beginPath(); ctx.arc(sx, sy - 16, 8, 0, Math.PI*2); ctx.fill();

  // Name bubble indicator
  ctx.fillStyle = npc.color;
  ctx.beginPath(); ctx.arc(sx, sy - 28, 4, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font      = '9px monospace';
  ctx.fillText('E', sx - 3, sy - 25);
}

// ─── PLAYER ──────────────────────────────────────────────────────────────────

function renderPlayer(ctx, player, camX, camY, frame) {
  // Blink every 8 frames while invincible
  if (player.invincible > 0 && Math.floor(frame / 4) % 2 === 0) return;

  const sx = player.x - camX;
  const sy = player.y - camY;

  const moving = player.moving;
  const legOffset = moving ? Math.sin(frame * 0.25) * 4 : 0;

  // Left leg
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(sx - 6, sy + 6, 5, 10 + (moving ? -legOffset : 0));

  // Right leg
  ctx.fillRect(sx + 1, sy + 6, 5, 10 + (moving ?  legOffset : 0));

  // Body (red tint when just damaged)
  ctx.fillStyle = (player.damageFlash > 0.3) ? '#e74c3c' : '#3498db';
  ctx.fillRect(sx - 8, sy - 8, 16, 16);

  // Head
  ctx.fillStyle = '#f5cba7';
  ctx.beginPath(); ctx.arc(sx, sy - 14, 9, 0, Math.PI*2); ctx.fill();

  // Eyes
  ctx.fillStyle = '#2c3e50';
  _playerEye(ctx, player.dir, sx, sy - 14);
}

function _playerEye(ctx, dir, sx, sy) {
  let ex = 0, ey = 0;
  if (dir === 'right') { ex = 4; ey = 0; }
  else if (dir === 'left') { ex = -4; ey = 0; }
  else if (dir === 'up') { ex = 0; ey = -3; }
  else { ex = 0; ey = 3; }
  ctx.beginPath(); ctx.arc(sx + ex + 2, sy + ey, 2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(sx + ex - 2, sy + ey, 2, 0, Math.PI*2); ctx.fill();
}

// ─── DISASTER EFFECTS ────────────────────────────────────────────────────────

function renderSmokeParticles(ctx, disasterState, camX, camY) {
  if (!disasterState || !disasterState.activeTiles) return;
  ctx.save();
  for (let i = 0; i < Math.min(disasterState.activeTiles.length, 20); i++) {
    const t = disasterState.activeTiles[i];
    const bx = t.col * TILE_SIZE - camX + TILE_SIZE/2;
    const by = t.row * TILE_SIZE - camY;
    const alpha = 0.3 - (((disasterState.frame || 0) * 0.01) % 0.3);
    ctx.fillStyle = `rgba(80,80,80,${Math.max(0.05, alpha)})`;
    ctx.beginPath();
    ctx.arc(bx + Math.sin((disasterState.frame||0)*0.1 + i)*4, by - 4, 6, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.restore();
}

function renderRain(ctx, particles, frame) {
  ctx.save();
  ctx.strokeStyle = 'rgba(100,180,255,0.6)';
  ctx.lineWidth   = 1;
  for (const p of particles) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 2, p.y + 8);
    ctx.stroke();
    p.x += 0.5;
    p.y += p.speed;
    if (p.y > LOGICAL_HEIGHT) { p.y = -10; p.x = Math.random() * LOGICAL_WIDTH; }
    if (p.x > LOGICAL_WIDTH)  { p.x = 0; }
  }
  ctx.restore();
}

// ─── MINIMAP ─────────────────────────────────────────────────────────────────

function renderMinimap(ctx, player, goalTile) {
  const mmW = 80, mmH = 60;
  const mmX = LOGICAL_WIDTH - mmW - 6;
  const mmY = LOGICAL_HEIGHT - mmH - 6;
  const scaleX = mmW / (MAP_COLS * TILE_SIZE);
  const scaleY = mmH / (MAP_ROWS * TILE_SIZE);

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(mmX, mmY, mmW, mmH);

  // Draw abbreviated tile map
  for (let r = 0; r < MAP_ROWS; r += 2) {
    for (let c = 0; c < MAP_COLS; c += 2) {
      const tile = getTile(r, c);
      ctx.fillStyle = TILE_COLORS[tile] || '#333';
      ctx.fillRect(mmX + c * scaleX * TILE_SIZE, mmY + r * scaleY * TILE_SIZE, 2, 2);
    }
  }

  // Player dot
  ctx.fillStyle = '#f1c40f';
  ctx.beginPath();
  ctx.arc(mmX + player.x * scaleX, mmY + player.y * scaleY, 3, 0, Math.PI*2);
  ctx.fill();

  // Goal marker
  if (goalTile) {
    const gx = mmX + goalTile.col * TILE_SIZE * scaleX;
    const gy = mmY + goalTile.row * TILE_SIZE * scaleY;
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath(); ctx.arc(gx, gy, 3, 0, Math.PI*2); ctx.fill();
  }

  ctx.strokeStyle = '#555';
  ctx.lineWidth   = 1;
  ctx.strokeRect(mmX, mmY, mmW, mmH);
}

// ─── TOUCH JOYSTICK ──────────────────────────────────────────────────────────

function renderTouchControls(ctx) {
  if (!TOUCH.active) return;
  ctx.save();
  ctx.globalAlpha = 0.35;

  // Joystick base
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(TOUCH.baseX, TOUCH.baseY, JOYSTICK_RADIUS, 0, Math.PI*2);
  ctx.fill();

  // Nub
  ctx.fillStyle = '#3498db';
  const dx = TOUCH.nubX - TOUCH.baseX;
  const dy = TOUCH.nubY - TOUCH.baseY;
  const dist = Math.min(Math.sqrt(dx*dx+dy*dy), JOYSTICK_RADIUS);
  const angle = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.arc(
    TOUCH.baseX + Math.cos(angle) * dist,
    TOUCH.baseY + Math.sin(angle) * dist,
    20, 0, Math.PI*2
  );
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.restore();
}
