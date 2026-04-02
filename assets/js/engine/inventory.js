// engine/inventory.js
// Responsibility: Item collection state and float-text animations.
// WORKER — manages item state only, no rendering (HUD renders the bar).

const MAX_SLOTS = 5;

let _collected   = [];   // array of item ids in order collected
let _floatTexts  = [];   // { text, x, y, alpha, vy } active float-text animations

function resetInventory() {
  _collected  = [];
  _floatTexts = [];
}

function hasItem(id) {
  return _collected.includes(id);
}

function collectItem(item) {
  if (_collected.includes(item.id)) return;
  _collected.push(item.id);
  _floatTexts.push({
    text:  '+' + item.name,
    x:     item.x,
    y:     item.y - 10,
    alpha: 1,
    vy:    -1.2
  });
}

function getCollectedItems() { return _collected.slice(); }

function countRequiredCollected(actItems) {
  return actItems.filter(i => i.required && _collected.includes(i.id)).length;
}

function countRequiredTotal(actItems) {
  return actItems.filter(i => i.required).length;
}

/** Update float-text animations — call each frame */
function updateFloatTexts() {
  for (let i = _floatTexts.length - 1; i >= 0; i--) {
    const ft = _floatTexts[i];
    ft.y     += ft.vy;
    ft.alpha -= 0.018;
    if (ft.alpha <= 0) _floatTexts.splice(i, 1);
  }
}

/** Render float-text animations (called from renderer, not HUD) */
function renderFloatTexts(ctx, camX, camY) {
  ctx.save();
  for (const ft of _floatTexts) {
    ctx.globalAlpha = Math.max(0, ft.alpha);
    ctx.fillStyle   = '#f1c40f';
    ctx.font        = 'bold 13px monospace';
    ctx.fillText(ft.text, ft.x - camX, ft.y - camY);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

/** Return collected item array for HUD hotbar rendering */
function getInventorySlots(actItemDefs) {
  return actItemDefs.map(def => ({
    def,
    collected: _collected.includes(def.id)
  }));
}
