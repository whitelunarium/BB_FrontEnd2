// engine/collision.js
// Responsibility: Collision detection against tiles and entities.
// WORKER — returns results only, never modifies state.

const PLAYER_BOX = 20; // bounding box size (square, centered on player)
const HALF_BOX   = PLAYER_BOX / 2;

/**
 * Check whether a proposed player position (px, py) is valid.
 * Tests the 4 corners of the player bounding box against the tile map.
 * @returns {boolean} true if position is clear
 */
function canMoveTo(px, py) {
  const corners = [
    { x: px - HALF_BOX, y: py - HALF_BOX },
    { x: px + HALF_BOX, y: py - HALF_BOX },
    { x: px - HALF_BOX, y: py + HALF_BOX },
    { x: px + HALF_BOX, y: py + HALF_BOX }
  ];
  for (const c of corners) {
    const col = Math.floor(c.x / TILE_SIZE);
    const row = Math.floor(c.y / TILE_SIZE);
    if (!isTileWalkable(row, col)) return false;
  }
  return true;
}

/**
 * Resolve horizontal movement: try full move, then axis-separate.
 * @returns {{ x: number, y: number }} final position
 */
function resolveMovement(oldX, oldY, newX, newY) {
  if (canMoveTo(newX, newY)) return { x: newX, y: newY };

  // Try horizontal-only
  if (canMoveTo(newX, oldY)) return { x: newX, y: oldY };

  // Try vertical-only
  if (canMoveTo(oldX, newY)) return { x: oldX, y: newY };

  return { x: oldX, y: oldY };
}

/**
 * Check if player overlaps an item (circle-point style, 18px radius).
 * @returns {boolean}
 */
function playerOverlapsItem(px, py, item) {
  const dx = px - item.x;
  const dy = py - item.y;
  return (dx*dx + dy*dy) < 18*18;
}

/**
 * Check if player is within interaction range of an NPC (32px).
 * @returns {boolean}
 */
function playerNearNPC(px, py, npc) {
  const dx = px - npc.x;
  const dy = py - npc.y;
  return (dx*dx + dy*dy) < 32*32;
}

/**
 * Check if player is within interaction range of a tile position (e.g. gas valve).
 * @param {number} px player x, py player y
 * @param {number} col tile col, row tile row
 * @returns {boolean}
 */
function playerNearTile(px, py, col, row) {
  const tileX = col * TILE_SIZE + TILE_SIZE / 2;
  const tileY = row * TILE_SIZE + TILE_SIZE / 2;
  const dx = px - tileX;
  const dy = py - tileY;
  return (dx*dx + dy*dy) < 40*40;
}

/**
 * Check if player has reached a goal tile area (within 24px).
 * @returns {boolean}
 */
function playerAtGoal(px, py, goalTile) {
  const gx = goalTile.col * TILE_SIZE + TILE_SIZE / 2;
  const gy = goalTile.row * TILE_SIZE + TILE_SIZE / 2;
  const dx = px - gx;
  const dy = py - gy;
  return (dx*dx + dy*dy) < 40*40;
}
