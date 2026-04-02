// engine/dialogue.js
// Responsibility: NPC dialogue box rendering and state advancement.
// WORKER — renders and manages dialogue state, fires callback on completion.

const DIALOGUE_BOX_H = 120;
const DIALOGUE_BOX_Y = LOGICAL_HEIGHT - DIALOGUE_BOX_H - 8;
const TYPE_SPEED_MS  = 30; // ms per character

let _dlg = null; // active dialogue session

/**
 * Start a dialogue session.
 * @param {object} npc  - NPC definition (name, color, dialogue)
 * @param {Array}  lines - array of strings or choice objects
 * @param {function} onDone - called when all lines are exhausted
 */
function startDialogue(npc, lines, onDone) {
  _dlg = {
    npc,
    lines: lines.filter(l => l !== undefined && l !== null && l !== ''),
    lineIdx: 0,
    charIdx: 0,
    lastCharTime: 0,
    waitingAdvance: false,
    waitingChoice: false,
    choiceSelected: -1,
    onDone
  };
  _advanceLine();
}

function _advanceLine() {
  if (!_dlg) return;
  const line = _dlg.lines[_dlg.lineIdx];
  if (typeof line === 'object' && line.choices) {
    _dlg.waitingChoice  = true;
    _dlg.waitingAdvance = false;
    _dlg.charIdx        = line.text.length; // show full text immediately
  } else {
    _dlg.waitingChoice  = false;
    _dlg.waitingAdvance = false;
    _dlg.charIdx        = 0;
  }
  _dlg.lastCharTime = performance.now();
}

function isDialogueActive() { return _dlg !== null; }

/**
 * Call once per frame — advances typewriter and detects E-key press.
 * @param {number} now - performance.now()
 */
function updateDialogue(now) {
  if (!_dlg) return;
  const line = _dlg.lines[_dlg.lineIdx];
  const text  = typeof line === 'string' ? line : (line ? line.text : '');

  if (!_dlg.waitingAdvance && !_dlg.waitingChoice) {
    const elapsed = now - _dlg.lastCharTime;
    const newChars = Math.floor(elapsed / TYPE_SPEED_MS);
    _dlg.charIdx = Math.min(_dlg.charIdx + newChars, text.length);
    if (newChars > 0) _dlg.lastCharTime = now;
    if (_dlg.charIdx >= text.length) _dlg.waitingAdvance = true;
  }
}

/** Player pressed E — advance or finish dialogue */
function advanceDialogue() {
  if (!_dlg) return;
  if (_dlg.waitingChoice) return; // use selectChoice() instead

  const line = _dlg.lines[_dlg.lineIdx];
  const text  = typeof line === 'string' ? line : (line ? line.text : '');

  // If still typing, skip to end of line first
  if (!_dlg.waitingAdvance) {
    _dlg.charIdx        = text.length;
    _dlg.waitingAdvance = true;
    return;
  }

  _dlg.lineIdx++;
  if (_dlg.lineIdx >= _dlg.lines.length) {
    const cb = _dlg.onDone;
    _dlg = null;
    if (cb) cb();
    return;
  }
  _advanceLine();
}

/** Player pressed 1 or 2 for a dialogue choice */
function selectChoice(idx) {
  if (!_dlg || !_dlg.waitingChoice) return;
  _dlg.choiceSelected = idx;
  _dlg.waitingChoice  = false;
  _dlg.lineIdx++;
  if (_dlg.lineIdx >= _dlg.lines.length) {
    const cb = _dlg.onDone;
    _dlg = null;
    if (cb) cb(idx);
    return;
  }
  _advanceLine();
}

function dismissDialogue() {
  _dlg = null;
}

/**
 * Render the dialogue box to the canvas (called in render pass).
 * @param {CanvasRenderingContext2D} ctx
 */
function renderDialogue(ctx) {
  if (!_dlg) return;
  const line = _dlg.lines[_dlg.lineIdx];
  if (!line) return;

  const text = typeof line === 'string' ? line : line.text;
  const shown = text.substring(0, _dlg.charIdx);

  // Background box
  ctx.fillStyle = 'rgba(10, 10, 20, 0.88)';
  ctx.strokeStyle = _dlg.npc.color;
  ctx.lineWidth = 2;
  _roundRect(ctx, 8, DIALOGUE_BOX_Y, LOGICAL_WIDTH - 16, DIALOGUE_BOX_H, 8);
  ctx.fill(); ctx.stroke();

  // NPC name
  ctx.fillStyle = _dlg.npc.color;
  ctx.font = 'bold 13px monospace';
  ctx.fillText(_dlg.npc.name, 20, DIALOGUE_BOX_Y + 20);

  // Dialogue text (word-wrapped)
  ctx.fillStyle = '#f0f0f0';
  ctx.font = '13px monospace';
  _wrapText(ctx, shown, 20, DIALOGUE_BOX_Y + 40, LOGICAL_WIDTH - 40, 18);

  // Choice buttons
  if (_dlg.waitingChoice && typeof line === 'object' && line.choices) {
    ctx.font = 'bold 13px monospace';
    line.choices.forEach((choice, i) => {
      ctx.fillStyle = i === 0 ? '#2ecc71' : '#3498db';
      ctx.fillText(`[${i+1}] ${choice}`, 20 + i * 200, DIALOGUE_BOX_Y + 98);
    });
  } else if (_dlg.waitingAdvance) {
    // Blinking advance indicator
    if (Math.floor(performance.now() / 400) % 2 === 0) {
      ctx.fillStyle = '#aaa';
      ctx.font = '11px monospace';
      ctx.fillText('▼ Press E', LOGICAL_WIDTH - 90, DIALOGUE_BOX_Y + DIALOGUE_BOX_H - 10);
    }
  }
}

function _wrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (const word of words) {
    const testLine = line ? line + ' ' + word : word;
    if (ctx.measureText(testLine).width > maxW && line !== '') {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineH;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
}

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x+w, y, x+w, y+r, r);
  ctx.lineTo(x+w, y+h-r);
  ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x+r, y+h);
  ctx.arcTo(x, y+h, x, y+h-r, r);
  ctx.lineTo(x, y+r);
  ctx.arcTo(x, y, x+r, y, r);
  ctx.closePath();
}
