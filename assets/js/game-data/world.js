// game-data/world.js
// Responsibility: Define the tile map and tile type constants.
// WORKER — pure data, no rendering or state mutation.

// PPR LIST: WORLD_MAP manages complexity
// 2D array of tile IDs representing the entire game world (40 cols x 30 rows = 1200 tiles).
// Without this: would need individual variables for each of 1200 tiles.
// With this: single nested array drives all rendering, collision, and
//            disaster transformation logic.

const TILE_SIZE = 32;
const MAP_COLS  = 40;
const MAP_ROWS  = 30;

const TILES = {
  GRASS:     0,
  ROAD:      1,
  WALL:      2,
  FLOOR:     3,
  DOOR:      4,
  TREE:      5,
  WATER:     6,
  FIRE:      7,
  RUBBLE:    8,
  PATH:      9,
  SAFE_ZONE: 10,
  CRACK:     11
};

// Tiles the player CAN walk on (FIRE/WATER are walkable but deal damage)
const WALKABLE = new Set([
  TILES.GRASS, TILES.ROAD, TILES.FLOOR, TILES.DOOR,
  TILES.RUBBLE, TILES.PATH, TILES.SAFE_ZONE, TILES.CRACK,
  TILES.FIRE, TILES.WATER
]);

// Tile colors for the renderer
const TILE_COLORS = {
  [TILES.GRASS]:     '#4a7c59',
  [TILES.ROAD]:      '#6b6b6b',
  [TILES.WALL]:      '#8b7355',
  [TILES.FLOOR]:     '#c4a882',
  [TILES.DOOR]:      '#a0522d',
  [TILES.TREE]:      '#2d5a27',
  [TILES.WATER]:     '#2471a3',
  [TILES.FIRE]:      '#e74c3c',
  [TILES.RUBBLE]:    '#95a5a6',
  [TILES.PATH]:      '#b8860b',
  [TILES.SAFE_ZONE]: '#27ae60',
  [TILES.CRACK]:     '#7f8c8d'
};

// Build the world map programmatically to avoid a 1200-element literal array
function buildWorldMap() {
  // Start with all grass
  const map = [];
  for (let r = 0; r < MAP_ROWS; r++) {
    map.push(new Array(MAP_COLS).fill(TILES.GRASS));
  }

  // Helper: fill rectangle of tiles
  function fillRect(r0, c0, r1, c1, tile) {
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        map[r][c] = tile;
  }

  // E-W roads
  fillRect(8, 0, 9, MAP_COLS-1, TILES.ROAD);
  fillRect(18, 0, 19, MAP_COLS-1, TILES.ROAD);

  // N-S roads (Oak St col 12-13, East Rd col 27-28)
  fillRect(0, 12, MAP_ROWS-1, 13, TILES.ROAD);
  fillRect(0, 27, MAP_ROWS-1, 28, TILES.ROAD);

  // Player house: cols 1-9, rows 1-6 — door on south wall (row 6)
  _buildingRect(map, 1, 1, 6, 9, 6, 5);

  // PNEC Community Center: cols 30-39, rows 1-6 — door on south wall (row 6)
  _buildingRect(map, 1, 30, 6, 39, 6, 34);

  // Grocery Store: cols 1-9, rows 11-16 — door on south wall (row 16)
  _buildingRect(map, 11, 1, 16, 9, 16, 5);

  // Fire Station: cols 30-39, rows 11-16 — door on south wall (row 16)
  _buildingRect(map, 11, 30, 16, 39, 16, 34);

  // Neighbor house: cols 16-23, rows 20-25 — door on south wall (row 25)
  _buildingRect(map, 20, 16, 25, 23, 25, 19);

  // Town square (safe zone): cols 15-25, rows 10-12
  fillRect(10, 15, 12, 25, TILES.SAFE_ZONE);

  // Creek/water: rows 26-29
  fillRect(26, 0, 29, MAP_COLS-1, TILES.WATER);

  // Scatter trees for aesthetics
  const treeSpots = [
    [2,11],[3,14],[4,25],[5,26],[6,29],[2,38],
    [10,0],[10,14],[13,14],[17,14],[20,14],
    [7,3],[7,20],[7,35],[12,20],[12,26]
  ];
  for (const [r,c] of treeSpots) {
    if (map[r][c] === TILES.GRASS) map[r][c] = TILES.TREE;
  }

  // Path from player house to road
  map[7][5] = TILES.PATH;

  return map;
}

// Build a building: perimeter = WALL, interior = FLOOR, one door tile
function _buildingRect(map, r0, c0, r1, c1, doorRow, doorCol) {
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (r === r0 || r === r1 || c === c0 || c === c1) {
        map[r][c] = TILES.WALL;
      } else {
        map[r][c] = TILES.FLOOR;
      }
    }
  }
  map[doorRow][doorCol] = TILES.DOOR;
}

// The live world map (mutated by disaster events)
let WORLD_MAP = buildWorldMap();

// Reset world to original state
function resetWorldMap() {
  WORLD_MAP = buildWorldMap();
}

// Tile query helpers
function getTile(row, col) {
  if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return TILES.WALL;
  return WORLD_MAP[row][col];
}

function setTile(row, col, tile) {
  if (row < 0 || row >= MAP_ROWS || col < 0 || col >= MAP_COLS) return;
  WORLD_MAP[row][col] = tile;
}

function isTileWalkable(row, col) {
  return WALKABLE.has(getTile(row, col));
}

// Pixel → tile conversion
function pixelToTile(px, py) {
  return { col: Math.floor(px / TILE_SIZE), row: Math.floor(py / TILE_SIZE) };
}
