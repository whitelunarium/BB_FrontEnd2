// pages/escape-room.js
// Responsibility: Game state machine, main loop, scene orchestration.
// ORCHESTRATOR — calls all workers, owns all mutable state.

// ─── CONSTANTS ───────────────────────────────────────────────────────────────

const PLAYER_SPEED = 120; // pixels per second
const CAMERA_LERP  = 0.12;
const ACT_COUNT    = 3;

// ─── STATE ───────────────────────────────────────────────────────────────────

const gameState = {
  phase: 'menu',      // menu | prepare | transition | survive | recover | paused
                      // gameover | victory | typing
  act:   1,
  score: 0,
  actScores: { 1: 0, 2: 0, 3: 0 },
  lives: 3,
  timeRemaining: 60,
  timeCap: 60,
  actItems: [],
  actNPCs:  [],
  objective: '',
  gameOverReason: '',
  playerName: '',
  paused: false,
  prevPhase: ''
};

const player = {
  x: 5 * TILE_SIZE + TILE_SIZE / 2,
  y: 7 * TILE_SIZE + TILE_SIZE / 2,
  dir: 'down',
  moving: false,
  invincible: 0,   // seconds remaining of invincibility after damage
  damageFlash: 0   // red flash timer (seconds)
};

const camera = {
  x: 0, y: 0
};

let disasterState    = null;
let frame            = 0;
let showLeaderboard  = false;
let leaderboardData  = [];
let leaderboardLoading = false;
let lastTimestamp  = null;
let transitionAlpha = 0;
let transitionTimer = 0;
let flashAlpha      = 0;
let showMessage     = false;
let victoryParticles = [];
let gasValveInteracted = false;
let margaretRescued    = false;
let neighborHelped     = false;
let tutorialTimer      = 8;   // seconds to show tutorial overlay at act start
let raf;
let ctx, canvas;

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', function() {
  const setup = setupCanvas('game-canvas');
  ctx    = setup.ctx;
  canvas = setup.canvas;
  setupInput();

  canvas.addEventListener('click', _handleClick);
  window.addEventListener('keypress', _handleKeypress);

  _showMenu();
});

// ─── MENU ────────────────────────────────────────────────────────────────────

function _showMenu() {
  gameState.phase = 'menu';
  cancelAnimationFrame(raf);
  _drawMenu();
  canvas.onclick = function(e) {
    const lx = e.offsetX / CANVAS_SCALE;
    const ly = e.offsetY / CANVAS_SCALE;
    if (_menuPlayHit(lx, ly)) _startGame();
    // Back button: top-left 16,16 → 106,46
    if (lx >= 16 && lx <= 106 && ly >= 16 && ly <= 46) {
      window.location.href = '/';
    }
  };
}

function _drawMenu() {
  clearCanvas(ctx);
  ctx.fillStyle = '#1a252f';
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  ctx.fillStyle = '#f1c40f';
  ctx.font      = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('POWAY PREPARED', LOGICAL_WIDTH/2, 70);

  ctx.fillStyle = '#e74c3c';
  ctx.font      = '13px monospace';
  ctx.fillText('Wildfire  •  Earthquake  •  Flood', LOGICAL_WIDTH/2, 96);

  // How to Play box
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(60, 112, LOGICAL_WIDTH - 120, 230);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(60, 112, LOGICAL_WIDTH - 120, 230);

  ctx.fillStyle = '#f1c40f';
  ctx.font      = 'bold 13px monospace';
  ctx.fillText('HOW TO PLAY', LOGICAL_WIDTH/2, 134);

  const lines = [
    ['WASD / Arrow Keys', 'Move your character'],
    ['E key', 'Enter buildings through doors / talk to NPCs'],
    ['Yellow arrow', 'Points you toward the next item or goal'],
    ['Collect items', 'Walk into glowing icons on the ground'],
    ['Talk to NPCs', 'Purple "E" bubble means someone is nearby'],
    ['Reach the goal', 'Green tiles = safe zone. Get there to win!'],
    ['Avoid fire/water', 'They drain your lives — use your 3 hearts!'],
  ];
  ctx.textAlign = 'left';
  lines.forEach(([key, val], i) => {
    const y = 157 + i * 24;
    ctx.fillStyle = '#2ecc71';
    ctx.font      = 'bold 12px monospace';
    ctx.fillText(key, 80, y);
    ctx.fillStyle = '#bbb';
    ctx.font      = '12px monospace';
    ctx.fillText('— ' + val, 260, y);
  });

  ctx.textAlign = 'center';
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(280, 358, 240, 46);
  ctx.fillStyle = '#fff';
  ctx.font      = 'bold 16px monospace';
  ctx.fillText('PLAY GAME', LOGICAL_WIDTH/2, 387);

  // Back button — top-left corner
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.fillRect(16, 16, 90, 30);
  ctx.strokeRect(16, 16, 90, 30);
  ctx.fillStyle = '#aaa';
  ctx.font      = '13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('← Back', 28, 36);
}

// click area for updated button position
function _menuPlayHit(lx, ly) {
  return lx > 280 && lx < 520 && ly > 358 && ly < 404;
}

// ─── GAME START / ACT START ──────────────────────────────────────────────────

function _startGame() {
  Object.assign(gameState, {
    act: 1, score: 0, lives: 3,
    actScores: { 1: 0, 2: 0, 3: 0 }, playerName: '', submitted: false
  });
  _startAct(1);
}

function _startAct(act) {
  resetWorldMap();
  resetInventory();

  gasValveInteracted = false;
  margaretRescued    = false;
  neighborHelped     = false;

  gameState.act          = act;
  gameState.phase        = 'prepare';
  gameState.timeRemaining = 60;
  gameState.timeCap       = 60;
  gameState.actItems      = buildActItems(act);
  gameState.actNPCs       = buildActNPCs(act);
  gameState.objective     = DISASTER_DEFS[act].objectivePrepare;
  disasterState           = null;
  flashAlpha              = 0;
  showMessage             = false;
  transitionTimer         = 0;

  // Reset player to start position
  player.x         = 5 * TILE_SIZE + TILE_SIZE / 2;
  player.y         = 7 * TILE_SIZE + TILE_SIZE / 2;
  player.dir       = 'down';
  player.invincible = 0;
  player.damageFlash = 0;
  tutorialTimer     = 8;

  camera.x = 0; camera.y = 0;

  lastTimestamp = null;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(runGameLoop);
}

// ─── MAIN GAME LOOP ──────────────────────────────────────────────────────────

// PPR PROCEDURE: runGameLoop(timestamp)
// Parameter: timestamp — DOMHighResTimeStamp from requestAnimationFrame
// Sequencing: calculate delta → process input → update all entities →
//             check collisions → check disaster triggers → render world →
//             render HUD → schedule next frame
// Selection: if gameState.phase === 'survive' apply disaster logic,
//            if player overlaps item collect it,
//            if lives === 0 trigger game over
// Iteration: loops through actNPCs array to update each NPC,
//            loops through actItems array to check collection,
//            loops through DISASTER_TILES to render effects
// Returns: calls requestAnimationFrame(runGameLoop) to continue loop
function runGameLoop(timestamp) {
  raf = requestAnimationFrame(runGameLoop);

  const delta = lastTimestamp ? Math.min((timestamp - lastTimestamp) / 1000, 0.1) : 0;
  lastTimestamp = timestamp;
  frame++;

  const ph = gameState.phase;
  if (ph === 'menu' || ph === 'gameover' || ph === 'victory' || ph === 'typing') {
    _renderFrame(delta, timestamp);
    clearFrameInput();
    return;
  }

  if (isPausePressed()) {
    if (ph === 'paused') {
      gameState.phase = gameState.prevPhase;
    } else if (ph !== 'transition' && ph !== 'recover') {
      gameState.prevPhase = ph;
      gameState.phase = 'paused';
    }
  }

  if (ph !== 'paused' && ph !== 'transition') {
    _updateTimer(delta);
    _processMovement(delta);
    _checkItemCollection();
    _checkNPCInteraction();
    _checkDangerTile();            // runs every phase — catches water/fire always
    if (ph === 'survive') _updateDisaster(timestamp);
    _updateCamera();
  }

  // Tick timers always (even when paused UI still renders flash)
  if (player.invincible  > 0) player.invincible  -= delta;
  if (player.damageFlash > 0) player.damageFlash -= delta;
  if (tutorialTimer      > 0) tutorialTimer      -= delta;

  if (disasterState) disasterState.frame = frame;
  updateFloatTexts();
  _renderFrame(delta, timestamp);
  clearFrameInput();
}

// ─── UPDATE: TIMER ───────────────────────────────────────────────────────────

function _updateTimer(delta) {
  const ph = gameState.phase;
  if (ph !== 'prepare' && ph !== 'survive') return;

  gameState.timeRemaining -= delta;

  if (gameState.timeRemaining <= 0) {
    if (ph === 'prepare') {
      _triggerDisaster();
    } else {
      _triggerGameOver('You ran out of time!');
    }
  }
}

// ─── UPDATE: MOVEMENT ────────────────────────────────────────────────────────

function _processMovement(delta) {
  if (isDialogueActive()) { player.moving = false; return; }
  if (showMessage)         { player.moving = false; return; }

  let dx = 0, dy = 0;
  if (INPUT.left)  { dx = -1; player.dir = 'left'; }
  if (INPUT.right) { dx =  1; player.dir = 'right'; }
  if (INPUT.up)    { dy = -1; player.dir = 'up'; }
  if (INPUT.down)  { dy =  1; player.dir = 'down'; }

  const moving = dx !== 0 || dy !== 0;
  player.moving = moving;
  if (!moving) return;

  // Normalize diagonal movement
  if (dx !== 0 && dy !== 0) {
    dx *= 0.707; dy *= 0.707;
  }

  // Crack tiles slow movement by 50%
  const curTile = getTile(Math.floor(player.y / TILE_SIZE), Math.floor(player.x / TILE_SIZE));
  const speed = curTile === TILES.CRACK ? PLAYER_SPEED * 0.5 : PLAYER_SPEED;

  const newX = player.x + dx * speed * delta;
  const newY = player.y + dy * speed * delta;
  const resolved = resolveMovement(player.x, player.y, newX, newY);
  player.x = resolved.x;
  player.y = resolved.y;

  // World bounds clamp
  player.x = Math.max(TILE_SIZE, Math.min(player.x, (MAP_COLS - 1) * TILE_SIZE));
  player.y = Math.max(TILE_SIZE, Math.min(player.y, (MAP_ROWS - 1) * TILE_SIZE));
}

// ─── UPDATE: CAMERA ──────────────────────────────────────────────────────────

function _updateCamera() {
  const targetX = player.x - LOGICAL_WIDTH  / 2;
  const targetY = player.y - LOGICAL_HEIGHT / 2;
  camera.x += (targetX - camera.x) * CAMERA_LERP;
  camera.y += (targetY - camera.y) * CAMERA_LERP;
  camera.x = Math.max(0, Math.min(camera.x, MAP_COLS * TILE_SIZE - LOGICAL_WIDTH));
  camera.y = Math.max(0, Math.min(camera.y, MAP_ROWS * TILE_SIZE - LOGICAL_HEIGHT));
}

// ─── UPDATE: ITEMS ───────────────────────────────────────────────────────────

function _checkItemCollection() {
  for (const item of gameState.actItems) {
    if (item.collected) continue;
    if (playerOverlapsItem(player.x, player.y, item)) {
      item.collected = true;
      collectItem(item);
      gameState.score += 50;
      gameState.actScores[gameState.act] += 50;
    }
  }
}

// ─── UPDATE: NPCs ────────────────────────────────────────────────────────────

function _checkNPCInteraction() {
  if (!isInteracting()) return;
  for (const npc of gameState.actNPCs) {
    if (!playerNearNPC(player.x, player.y, npc)) continue;
    const dlgSet = npc.dialogue[gameState.act];
    if (!dlgSet) continue;
    const lines = dlgSet[npc.dialoguePhase] || [];
    if (lines.length === 0) continue;
    startDialogue(npc, lines, function(choiceIdx) {
      if (npc.id === 'terri' && gameState.act === 3 && choiceIdx === 0) {
        // Player accepted life vest
        const lifeVestItem = gameState.actItems.find(i => i.id === 'life_vest');
        if (lifeVestItem && !lifeVestItem.collected) {
          lifeVestItem.x = player.x;
          lifeVestItem.y = player.y - 20;
        }
      }
    });
    break;
  }

  // Gas valve interaction (act 2 survive phase)
  const def = DISASTER_DEFS[gameState.act];
  if (gameState.act === 2 && gameState.phase === 'survive' && def.gasValve) {
    if (playerNearTile(player.x, player.y, def.gasValve.col, def.gasValve.row)) {
      if (!gasValveInteracted) {
        gasValveInteracted = true;
        gameState.score += 100;
        gameState.actScores[2] += 100;
      }
    }
  }

  // Margaret rescue (survive phase, any act)
  if (gameState.phase === 'survive') {
    const margaret = gameState.actNPCs.find(n => n.id === 'margaret');
    if (margaret && playerNearNPC(player.x, player.y, margaret) && !margaretRescued) {
      const dlg = margaret.dialogue[gameState.act];
      if (dlg && dlg.disaster && dlg.disaster.length) {
        startDialogue(margaret, dlg.disaster, function(choiceIdx) {
          if (choiceIdx === 0 || choiceIdx === undefined) {
            margaretRescued = true;
            gameState.score += 75;
            gameState.actScores[gameState.act] += 75;
            margaret.x = player.x + 20;
            margaret.y = player.y;
          }
        });
        margaret.dialoguePhase = 'post';
      }
    }
  }
}

// ─── DISASTER: TRIGGER ───────────────────────────────────────────────────────

function _triggerDisaster() {
  gameState.phase  = 'transition';
  flashAlpha       = 0.85;
  showMessage      = true;
  transitionTimer  = 3000;
  disasterState    = createDisasterState(gameState.act);

  // Apply initial disaster map changes
  const def = DISASTER_DEFS[gameState.act];
  if (gameState.act === 1) {
    for (const t of disasterState.activeTiles) {
      setTile(t.row, t.col, TILES.FIRE);
    }
  } else if (gameState.act === 2) {
    for (const t of def.crackTiles) setTile(t.row, t.col, TILES.CRACK);
    disasterState.shakeIntensity = def.shake.intensity;
    disasterState.shakeTimer     = performance.now() + def.shake.duration;
  } else if (gameState.act === 3) {
    for (const t of disasterState.activeTiles) {
      setTile(t.row, t.col, TILES.WATER);
    }
  }

  // Update NPC dialogue phases
  for (const npc of gameState.actNPCs) npc.dialoguePhase = 'disaster';

  setTimeout(function() {
    gameState.phase         = 'survive';
    gameState.timeRemaining = 90;
    gameState.timeCap       = 90;
    gameState.objective     = def.objectiveSurvive;
    showMessage             = false;
    flashAlpha              = 0;
  }, transitionTimer);
}

// ─── DISASTER: UPDATE ────────────────────────────────────────────────────────

// Standalone danger check — runs every active frame so water hurts in ALL phases
function _checkDangerTile() {
  if (player.invincible > 0) return;
  if (!isOnDangerTile(player.x, player.y)) return;
  gameState.lives--;
  player.damageFlash = 0.6;
  player.invincible  = 2.0;
  const safe = _findNearestSafeTile(player.x, player.y);
  player.x = safe.x;
  player.y = safe.y;
  if (gameState.lives <= 0) {
    const name = DISASTER_DEFS[gameState.act] ? DISASTER_DEFS[gameState.act].name.toLowerCase() : 'hazard';
    _triggerGameOver('You were caught in the ' + name + '!');
  }
}

function _updateDisaster(timestamp) {
  const def = DISASTER_DEFS[gameState.act];
  spreadDisaster(disasterState, gameState.act, timestamp);

  // Earthquake aftershock
  if (gameState.act === 2 && !disasterState.aftershockFired) {
    const timeInSurvive = 90 - gameState.timeRemaining;
    if (timeInSurvive >= 45) {
      disasterState.aftershockFired = true;
      disasterState.shakeIntensity  = 4;
      disasterState.shakeTimer      = performance.now() + 1500;
    }
  }

  // Check goal reached
  if (playerAtGoal(player.x, player.y, def.goalTile)) {
    _completeAct();
  }
}

// ─── ACT COMPLETE / GAME OVER / VICTORY ──────────────────────────────────────

// Find the nearest walkable non-danger tile (BFS, max 20 steps)
function _findNearestSafeTile(px, py) {
  const startCol = Math.floor(px / TILE_SIZE);
  const startRow = Math.floor(py / TILE_SIZE);
  const visited  = new Set();
  const queue    = [{ col: startCol, row: startRow }];
  const dirs     = [[0,-1],[0,1],[-1,0],[1,0]];
  for (let i = 0; i < 200 && queue.length; i++) {
    const { col, row } = queue.shift();
    const key = row + ',' + col;
    if (visited.has(key)) continue;
    visited.add(key);
    const tile = getTile(row, col);
    if (WALKABLE.has(tile) && tile !== TILES.FIRE && tile !== TILES.WATER) {
      return { x: col * TILE_SIZE + TILE_SIZE/2, y: row * TILE_SIZE + TILE_SIZE/2 };
    }
    for (const [dc, dr] of dirs) {
      const nc = col + dc, nr = row + dr;
      if (nr >= 0 && nr < MAP_ROWS && nc >= 0 && nc < MAP_COLS)
        queue.push({ col: nc, row: nr });
    }
  }
  // Fallback to map top-left safe area
  return { x: 5 * TILE_SIZE + TILE_SIZE/2, y: 7 * TILE_SIZE + TILE_SIZE/2 };
}

function _completeAct() {
  gameState.phase = 'recover';
  const timeBonus = Math.floor(gameState.timeRemaining) * 2;
  gameState.score += 100 + timeBonus;
  gameState.actScores[gameState.act] += 100 + timeBonus;

  for (const npc of gameState.actNPCs) npc.dialoguePhase = 'post';

  setTimeout(function() {
    if (gameState.act < ACT_COUNT) {
      _startAct(gameState.act + 1);
    } else {
      _triggerVictory();
    }
  }, 3000);
}

function _triggerGameOver(reason) {
  gameState.phase         = 'gameover';
  gameState.gameOverReason = reason;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(runGameLoop);
}

function _triggerVictory() {
  gameState.phase = 'victory';
  victoryParticles = _spawnVictoryParticles();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(runGameLoop);
}

function _spawnVictoryParticles() {
  const colors = ['#e74c3c','#f1c40f','#2ecc71','#3498db','#9b59b6','#e67e22'];
  const p = [];
  for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 4;
    p.push({
      x: LOGICAL_WIDTH/2, y: LOGICAL_HEIGHT/2,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1
    });
  }
  return p;
}

// ─── INPUT: CLICKS & KEYPRESSES ──────────────────────────────────────────────

// SKIP_BTN: small demo button, bottom-left corner
const SKIP_BTN = { x: 8, y: LOGICAL_HEIGHT - 30, w: 90, h: 22 };

function _handleClick(e) {
  const lx = e.offsetX / CANVAS_SCALE;
  const ly = e.offsetY / CANVAS_SCALE;
  const ph = gameState.phase;

  // Skip round button (active during prepare / survive / transition)
  if (lx >= SKIP_BTN.x && lx <= SKIP_BTN.x + SKIP_BTN.w &&
      ly >= SKIP_BTN.y && ly <= SKIP_BTN.y + SKIP_BTN.h) {
    if (ph === 'prepare' || ph === 'survive' || ph === 'transition') {
      _skipRound();
      return;
    }
  }

  if (ph === 'paused') {
    const action = checkMenuClick(lx, ly, 'paused');
    if (action === 'resume')  { gameState.phase = gameState.prevPhase; }
    if (action === 'restart') { _startAct(gameState.act); }
    if (action === 'quit')    { _showMenu(); }
  } else if (ph === 'gameover') {
    const action = checkMenuClick(lx, ly, 'gameover');
    if (action === 'restart') _startAct(gameState.act);
  } else if (ph === 'victory') {
    if (showLeaderboard) {
      if (leaderboardCloseHit(lx, ly)) showLeaderboard = false;
      return;
    }
    const action = checkMenuClick(lx, ly, 'victory');
    if (action === 'submit')      _submitScore();
    if (action === 'playagain')   _startGame();
    if (action === 'leaderboard') _openLeaderboard();
  }
}

function _skipRound() {
  // Cancel any pending timeouts by jumping straight to act complete / victory
  showMessage = false;
  flashAlpha  = 0;
  if (gameState.act < ACT_COUNT) {
    _startAct(gameState.act + 1);
  } else {
    _triggerVictory();
  }
}

function _handleKeypress(e) {
  if (gameState.phase === 'victory') {
    if (e.key === 'Enter') { _submitScore(); return; }
    if (e.key === 'Backspace') { gameState.playerName = gameState.playerName.slice(0,-1); return; }
    if (gameState.playerName.length < 20 && e.key.length === 1) {
      gameState.playerName += e.key;
    }
    return;
  }
  if (isDialogueActive()) {
    if (e.key === '1') selectChoice(0);
    if (e.key === '2') selectChoice(1);
  }
}

// ─── API ─────────────────────────────────────────────────────────────────────

function _submitScore() {
  if (gameState.submitted) return; // don't double-submit
  gameState.submitted = true;
  const badge = _getBadgeId(gameState.score);
  postEscapeRoomScore(
    gameState.playerName || 'Anonymous',
    gameState.score,
    badge,
    ACT_COUNT,
    Math.floor(gameState.timeRemaining)
  );
}

function _openLeaderboard() {
  showLeaderboard    = true;
  leaderboardLoading = true;
  leaderboardData    = [];
  getEscapeRoomLeaderboard().then(function(data) {
    leaderboardData    = data;
    leaderboardLoading = false;
  });
}

function _getBadgeId(score) {
  if (score >= 800) return 'pnec_champion';
  if (score >= 600) return 'community_resilient';
  if (score >= 400) return 'neighborhood_ready';
  return 'getting_prepared';
}

// ─── RENDER FRAME ────────────────────────────────────────────────────────────

function _renderFrame(delta, timestamp) {
  clearCanvas(ctx);
  const ph = gameState.phase;

  if (ph === 'menu') { _drawMenu(); return; }
  if (ph === 'gameover') { renderGameOver(ctx, gameState); return; }
  if (ph === 'victory')  {
    renderVictory(ctx, gameState, frame, victoryParticles);
    if (showLeaderboard) renderLeaderboard(ctx, leaderboardData, leaderboardLoading);
    return;
  }

  // Apply earthquake shake
  ctx.save();
  if (disasterState && disasterState.shakeIntensity > 0) {
    const now = performance.now();
    if (now < disasterState.shakeTimer) {
      const intensity = disasterState.shakeIntensity * ((disasterState.shakeTimer - now) / 3000);
      ctx.translate(Math.sin(now * 0.05) * intensity, Math.cos(now * 0.04) * intensity);
    } else {
      disasterState.shakeIntensity = 0;
    }
  }

  // World render
  renderWorld(ctx, camera.x, camera.y, frame);

  // Items
  renderItems(ctx, gameState.actItems, camera.x, camera.y, frame);

  // NPCs
  renderNPCs(ctx, gameState.actNPCs, camera.x, camera.y, frame);

  // Player
  renderPlayer(ctx, player, camera.x, camera.y, frame);

  // Float texts
  renderFloatTexts(ctx, camera.x, camera.y);

  // Disaster effects
  if (disasterState && (ph === 'survive' || ph === 'transition')) {
    if (gameState.act === 1) renderSmokeParticles(ctx, disasterState, camera.x, camera.y);
    if (gameState.act === 3) renderRain(ctx, disasterState.rainParticles, frame);
  }

  ctx.restore();

  // Dialogue (world-space, not shaken)
  if (isDialogueActive()) {
    updateDialogue(performance.now());
    renderDialogue(ctx);
    if (isInteracting()) advanceDialogue();
  }

  // HUD
  renderHUD(ctx, gameState, frame);

  // Direction arrow toward nearest objective
  if (ph === 'prepare' || ph === 'survive') {
    _renderDirectionArrow(ctx);
  }

  // Demo skip button
  if (ph === 'prepare' || ph === 'survive' || ph === 'transition') {
    _renderSkipButton(ctx);
  }

  // Door proximity hint
  _renderDoorHint(ctx);

  // Minimap
  const goalTile = ph === 'survive' ? DISASTER_DEFS[gameState.act].goalTile : null;
  renderMinimap(ctx, player, goalTile);

  // Touch controls
  renderTouchControls(ctx);

  // Damage flash (red screen edge)
  if (player.damageFlash > 0) {
    const alpha = player.damageFlash * 0.7;
    ctx.fillStyle = `rgba(220,30,30,${alpha.toFixed(2)})`;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  }

  // Player invincibility blink (skip every other 8 frames)
  // (handled by renderPlayer already receives player.invincible — see renderer)

  // Flash overlay (disaster transition)
  if (flashAlpha > 0) {
    renderDisasterFlash(ctx, DISASTER_DEFS[gameState.act].flashColor, flashAlpha);
    flashAlpha -= delta * 0.8;
  }

  // Disaster message
  if (showMessage) {
    renderDisasterMessage(ctx, DISASTER_DEFS[gameState.act].message);
  }

  // Tutorial overlay (first 8 seconds of prepare phase)
  if (ph === 'prepare' && tutorialTimer > 0) {
    _renderTutorial(ctx);
  }

  // Recovery message
  if (ph === 'recover') {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, LOGICAL_HEIGHT/2 - 36, LOGICAL_WIDTH, 72);
    ctx.fillStyle = '#2ecc71';
    ctx.font      = 'bold 22px monospace';
    ctx.textAlign = 'center';
    const label = gameState.act < ACT_COUNT ? 'Act ' + gameState.act + ' Complete!' : 'All Acts Complete!';
    ctx.fillText(label, LOGICAL_WIDTH/2, LOGICAL_HEIGHT/2 + 6);
    ctx.textAlign = 'left';
  }

  // Pause overlay
  if (ph === 'paused') {
    renderPauseMenu(ctx, gameState.objective);
  }
}

// ─── DIRECTION ARROW ─────────────────────────────────────────────────────────

function _renderDirectionArrow(ctx) {
  const target = _getArrowTarget();
  if (!target) return;

  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const dist = Math.sqrt(dx*dx + dy*dy);
  if (dist < 60) return; // already close enough

  const angle = Math.atan2(dy, dx);
  const cx = LOGICAL_WIDTH / 2;
  const cy = LOGICAL_HEIGHT / 2;
  const r  = 60 + Math.sin(frame * 0.12) * 5; // pulse

  const ax = cx + Math.cos(angle) * r;
  const ay = cy + Math.sin(angle) * r;

  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  ctx.fillStyle = '#f1c40f';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.lineTo(-8, -8);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Distance label
  const tiles = Math.round(dist / TILE_SIZE);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(ax - 20, ay + 14, 40, 14);
  ctx.fillStyle = '#f1c40f';
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(tiles + ' tiles', ax, ay + 24);
  ctx.textAlign = 'left';
}

function _getArrowTarget() {
  const ph = gameState.phase;
  if (ph === 'survive') {
    const def = DISASTER_DEFS[gameState.act];
    return { x: def.goalTile.col * TILE_SIZE + TILE_SIZE/2,
             y: def.goalTile.row * TILE_SIZE + TILE_SIZE/2 };
  }
  // prepare: nearest uncollected required item
  let best = null, bestDist = Infinity;
  for (const item of gameState.actItems) {
    if (item.collected || !item.required) continue;
    const dx = item.x - player.x, dy = item.y - player.y;
    const d  = dx*dx + dy*dy;
    if (d < bestDist) { bestDist = d; best = item; }
  }
  return best;
}

// ─── DOOR HINT ───────────────────────────────────────────────────────────────

function _renderDoorHint(ctx) {
  // Check if player is 1-2 tiles from any door tile
  const pc = Math.floor(player.x / TILE_SIZE);
  const pr = Math.floor(player.y / TILE_SIZE);
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      if (getTile(pr + dr, pc + dc) === TILES.DOOR) {
        const sx = LOGICAL_WIDTH/2;
        const sy = 58;
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fillRect(sx - 90, sy - 14, 180, 20);
        ctx.fillStyle = '#2ecc71';
        ctx.font      = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Walk into the door to enter', sx, sy);
        ctx.textAlign = 'left';
        return;
      }
    }
  }
}

// ─── TUTORIAL OVERLAY ────────────────────────────────────────────────────────

function _renderTutorial(ctx) {
  const alpha = Math.min(1, tutorialTimer / 2);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle   = 'rgba(0,0,20,0.82)';
  ctx.fillRect(20, LOGICAL_HEIGHT - 120, LOGICAL_WIDTH - 40, 108);
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth   = 1;
  ctx.strokeRect(20, LOGICAL_HEIGHT - 120, LOGICAL_WIDTH - 40, 108);

  ctx.fillStyle = '#f1c40f';
  ctx.font      = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('HOW TO PLAY:', 34, LOGICAL_HEIGHT - 100);

  ctx.fillStyle = '#fff';
  ctx.font      = '12px monospace';
  const hints = [
    'WASD / Arrow Keys = Move    |    E = Enter buildings & talk to NPCs',
    'Yellow arrow = points to next item you need to collect',
    'Collect all glowing items before the timer runs out!',
    'Then survive the disaster and reach the green safe zone.'
  ];
  hints.forEach((h, i) => ctx.fillText(h, 34, LOGICAL_HEIGHT - 80 + i * 17));
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ─── SKIP BUTTON (demo only) ─────────────────────────────────────────────────

function _renderSkipButton(ctx) {
  const { x, y, w, h } = SKIP_BTN;
  ctx.fillStyle   = 'rgba(180,30,200,0.85)';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth   = 1;
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle   = '#fff';
  ctx.font        = 'bold 11px monospace';
  ctx.textAlign   = 'left';
  ctx.fillText('SKIP ROUND >', x + 6, y + 15);
  ctx.fillStyle   = 'rgba(255,255,255,0.45)';
  ctx.font        = '9px monospace';
  ctx.fillText('(demo)', x + 18, y + h + 10);
}
