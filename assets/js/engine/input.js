// engine/input.js
// Responsibility: Track raw input state — keyboard and touch.
// WORKER — reads input only, no game logic or state mutation.

const INPUT = {
  up: false, down: false, left: false, right: false,
  interact: false, pause: false,
  interactJustPressed: false, pauseJustPressed: false
};

// Touch joystick state
const TOUCH = {
  active: false,
  baseX: 0, baseY: 0,
  nubX: 0, nubY: 0,
  dx: 0, dy: 0,
  interactTouched: false
};

const JOYSTICK_RADIUS = 50;

function setupInput() {
  document.addEventListener('keydown', _onKeyDown);
  document.addEventListener('keyup',   _onKeyUp);
  document.addEventListener('touchstart', _onTouchStart, { passive: false });
  document.addEventListener('touchmove',  _onTouchMove,  { passive: false });
  document.addEventListener('touchend',   _onTouchEnd,   { passive: false });
}

function _onKeyDown(e) {
  if (e.repeat) return;
  switch (e.key) {
    case 'w': case 'W': case 'ArrowUp':    INPUT.up    = true; break;
    case 's': case 'S': case 'ArrowDown':  INPUT.down  = true; break;
    case 'a': case 'A': case 'ArrowLeft':  INPUT.left  = true; break;
    case 'd': case 'D': case 'ArrowRight': INPUT.right = true; break;
    case 'e': case 'E':
      if (!INPUT.interact) INPUT.interactJustPressed = true;
      INPUT.interact = true; break;
    case 'Escape':
      INPUT.pauseJustPressed = true;
      INPUT.pause = true; break;
  }
}

function _onKeyUp(e) {
  switch (e.key) {
    case 'w': case 'W': case 'ArrowUp':    INPUT.up      = false; break;
    case 's': case 'S': case 'ArrowDown':  INPUT.down    = false; break;
    case 'a': case 'A': case 'ArrowLeft':  INPUT.left    = false; break;
    case 'd': case 'D': case 'ArrowRight': INPUT.right   = false; break;
    case 'e': case 'E': INPUT.interact = false; break;
    case 'Escape':      INPUT.pause    = false; break;
  }
}

function _onTouchStart(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const screenX = t.clientX / CANVAS_SCALE;
    if (screenX < LOGICAL_WIDTH / 2) {
      TOUCH.active = true;
      TOUCH.baseX = t.clientX / CANVAS_SCALE;
      TOUCH.baseY = t.clientY / CANVAS_SCALE;
      TOUCH.nubX  = TOUCH.baseX;
      TOUCH.nubY  = TOUCH.baseY;
    } else {
      TOUCH.interactTouched = true;
      INPUT.interactJustPressed = true;
      INPUT.interact = true;
    }
  }
}

function _onTouchMove(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const sx = t.clientX / CANVAS_SCALE;
    if (sx < LOGICAL_WIDTH / 2 && TOUCH.active) {
      TOUCH.nubX = t.clientX / CANVAS_SCALE;
      TOUCH.nubY = t.clientY / CANVAS_SCALE;
      const dx = TOUCH.nubX - TOUCH.baseX;
      const dy = TOUCH.nubY - TOUCH.baseY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const clamped = Math.min(dist, JOYSTICK_RADIUS);
      const angle = Math.atan2(dy, dx);
      TOUCH.dx = Math.cos(angle) * clamped / JOYSTICK_RADIUS;
      TOUCH.dy = Math.sin(angle) * clamped / JOYSTICK_RADIUS;
      INPUT.up    = TOUCH.dy < -0.3;
      INPUT.down  = TOUCH.dy >  0.3;
      INPUT.left  = TOUCH.dx < -0.3;
      INPUT.right = TOUCH.dx >  0.3;
    }
  }
}

function _onTouchEnd(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const sx = t.clientX / CANVAS_SCALE;
    if (sx < LOGICAL_WIDTH / 2) {
      TOUCH.active = false;
      TOUCH.dx = 0; TOUCH.dy = 0;
      INPUT.up = INPUT.down = INPUT.left = INPUT.right = false;
    } else {
      TOUCH.interactTouched = false;
      INPUT.interact = false;
    }
  }
}

// Call once per frame AFTER reading, to clear edge-triggered flags
function clearFrameInput() {
  INPUT.interactJustPressed = false;
  INPUT.pauseJustPressed    = false;
}

function isMoving(dir) {
  if (dir === 'up')    return INPUT.up;
  if (dir === 'down')  return INPUT.down;
  if (dir === 'left')  return INPUT.left;
  if (dir === 'right') return INPUT.right;
  return false;
}
function isInteracting()       { return INPUT.interactJustPressed; }
function isPausePressed()      { return INPUT.pauseJustPressed; }
