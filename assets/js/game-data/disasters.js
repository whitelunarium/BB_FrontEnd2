// game-data/disasters.js
// Responsibility: Define disaster event triggers and map-mutation rules.
// WORKER — pure data and stateless helper functions only.

const DISASTER_DEFS = {
  1: {
    name: 'WILDFIRE',
    icon: '🔥',
    prepareTime: 60,
    surviveTime:  90,
    flashColor: 'rgba(230, 126, 34, 0.85)',
    message: 'EVACUATION ORDER — Zone B — Leave NOW',
    objectivePrepare: 'Collect Go-Bag, Water, and Documents before the fire hits!',
    objectiveSurvive: 'Reach the Town Square evacuation point via Oak Street!',

    // Fire starts at east side col 36-39, rows 0-9, spreads west
    initTiles: function() {
      const tiles = [];
      for (let r = 0; r <= 9; r++)
        for (let c = 36; c <= 39; c++)
          tiles.push({ row: r, col: c });
      return tiles;
    },

    // Spread: each fire tile can spread one tile west every 3s
    spreadInterval: 3000,
    spreadDir: { dr: 0, dc: -1 },

    // Destination tile the player must reach to complete the act
    goalTile: { row: 11, col: 20 }, // Town Square
    goalType: TILES ? TILES.SAFE_ZONE : 10,
    goalLabel: 'Town Square',

    // Which tiles in the fire zone turn to FIRE on disaster
    affectedTileTypes: [0, 5] // GRASS, TREE
  },

  2: {
    name: 'EARTHQUAKE',
    icon: '🏚',
    prepareTime: 60,
    surviveTime:  90,
    flashColor: 'rgba(127, 140, 141, 0.80)',
    message: 'EARTHQUAKE — Magnitude 6.4 — Drop Cover Hold On',
    objectivePrepare: 'Collect First Aid Kit, Flashlight, and Emergency Radio!',
    objectiveSurvive: 'Reach the PNEC Community Center and shut off the gas!',

    shake: { duration: 3000, intensity: 8 },
    aftershockTime: 45000, // 45s into survive phase

    // Crack tiles: some road tiles become cracked (slow movement)
    crackTiles: [
      {row: 8, col: 5}, {row: 8, col: 6}, {row: 9, col: 10},
      {row: 18, col: 20}, {row: 18, col: 21}, {row: 19, col: 3}
    ],

    // Gas valve location — player must interact here
    gasValve: { col: 1, row: 5 },

    goalTile: { row: 3, col: 35 }, // Community Center interior
    goalType: TILES ? TILES.FLOOR : 3,
    goalLabel: 'PNEC Community Center',
    spreadInterval: 99999,
    spreadDir: { dr: 0, dc: 0 },
    initTiles: function() { return []; },
    affectedTileTypes: []
  },

  3: {
    name: 'FLOOD',
    icon: '🌊',
    prepareTime: 60,
    surviveTime:  90,
    flashColor: 'rgba(41, 128, 185, 0.80)',
    message: 'FLASH FLOOD WARNING — Move to High Ground',
    objectivePrepare: 'Collect Sandbags, Waterproof Bag, and Life Vest!',
    objectiveSurvive: 'Reach the Fire Station on the hill before the water rises!',

    // Water starts at rows 26-29, rises 1 row north every 4s
    initTiles: function() {
      const tiles = [];
      for (let r = 26; r <= 29; r++)
        for (let c = 0; c < MAP_COLS; c++)
          tiles.push({ row: r, col: c });
      return tiles;
    },
    spreadInterval: 4000,
    spreadDir: { dr: -1, dc: 0 }, // spread north

    rain: { particles: 100 },

    goalTile: { row: 14, col: 34 }, // Fire Station interior
    goalType: TILES ? TILES.FLOOR : 3,
    goalLabel: 'Fire Station (High Ground)',
    affectedTileTypes: [0, 9] // GRASS, PATH
  }
};

// Disaster runtime state (mutated each frame, reset each act)
function createDisasterState(act) {
  const def = DISASTER_DEFS[act];
  return {
    act,
    activeTiles: def.initTiles(),
    lastSpreadTime: 0,
    shakeTimer: 0,
    shakeIntensity: 0,
    aftershockFired: false,
    gasShutOff: false,
    waterFrontRow: 26,     // for flood — current northernmost water row
    rainParticles: _initRain(def.rain ? def.rain.particles : 0),
    frame: 0
  };
}

function _initRain(count) {
  const particles = [];
  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * LOGICAL_WIDTH,
      y: Math.random() * LOGICAL_HEIGHT,
      speed: 3 + Math.random() * 2
    });
  }
  return particles;
}

// Spread disaster tiles (fire west, flood north)
function spreadDisaster(disasterState, act, now) {
  const def = DISASTER_DEFS[act];
  if (now - disasterState.lastSpreadTime < def.spreadInterval) return;
  disasterState.lastSpreadTime = now;

  const newTiles = [];
  for (const t of disasterState.activeTiles) {
    const nr = t.row + def.spreadDir.dr;
    const nc = t.col + def.spreadDir.dc;
    if (nr < 0 || nr >= MAP_ROWS || nc < 0 || nc >= MAP_COLS) continue;
    const existing = getTile(nr, nc);
    if (def.affectedTileTypes.includes(existing)) {
      const tileType = (act === 1) ? TILES.FIRE : TILES.WATER;
      setTile(nr, nc, tileType);
      newTiles.push({ row: nr, col: nc });
    }
  }
  disasterState.activeTiles.push(...newTiles);

  if (act === 3) disasterState.waterFrontRow = Math.max(0, disasterState.waterFrontRow - 1);
}

// Check if player is on a dangerous tile (fire or water during survive phase)
function isOnDangerTile(px, py) {
  const tile = getTile(Math.floor(py / TILE_SIZE), Math.floor(px / TILE_SIZE));
  return tile === TILES.FIRE || tile === TILES.WATER;
}
