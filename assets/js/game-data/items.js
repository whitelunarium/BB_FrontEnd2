// game-data/items.js
// Responsibility: Define all collectible item types and their world spawn positions.
// WORKER — pure data definitions only.

const ITEM_DEFS = {
  go_bag:        { id: 'go_bag',        name: 'Go-Bag',              color: '#c0392b', shape: 'bag',    description: 'Pre-packed emergency bag',        act: 1, required: true },
  water:         { id: 'water',         name: 'Water (3-day supply)', color: '#3498db', shape: 'bottle', description: '1 gallon per person per day',      act: 1, required: true },
  documents:     { id: 'documents',     name: 'Important Documents',  color: '#f39c12', shape: 'folder', description: 'ID, insurance, medical records',   act: 1, required: true },
  first_aid:     { id: 'first_aid',     name: 'First Aid Kit',        color: '#e74c3c', shape: 'cross',  description: 'Basic medical supplies',           act: 2, required: true },
  flashlight:    { id: 'flashlight',    name: 'Flashlight',           color: '#f1c40f', shape: 'beam',   description: 'Battery-powered, not candles',     act: 2, required: true },
  radio:         { id: 'radio',         name: 'Emergency Radio',      color: '#95a5a6', shape: 'radio',  description: 'Battery or hand-crank',            act: 2, required: true },
  sandbags:      { id: 'sandbags',      name: 'Sandbags',             color: '#d4a574', shape: 'sack',   description: 'Flood barrier material',           act: 3, required: true },
  waterproof_bag:{ id: 'waterproof_bag',name: 'Waterproof Bag',       color: '#2980b9', shape: 'bag',    description: 'Keep documents dry',               act: 3, required: true },
  life_vest:     { id: 'life_vest',     name: 'Life Vest',            color: '#e67e22', shape: 'vest',   description: 'Personal flotation device',        act: 3, required: true }
};

// Spawn positions per act (tile col, tile row)
const ITEM_SPAWNS = {
  1: [
    { id: 'go_bag',    col: 5, row: 4 },   // player's house interior
    { id: 'water',     col: 4, row: 13 },  // grocery store interior
    { id: 'documents', col: 6, row: 3 }    // player's house interior
  ],
  2: [
    { id: 'first_aid',  col: 3, row: 4 },  // bathroom in player's house
    { id: 'flashlight', col: 7, row: 4 },  // garage area
    { id: 'radio',      col: 35, row: 3 }  // PNEC Community Center interior
  ],
  3: [
    { id: 'sandbags',       col: 34, row: 14 }, // fire station interior
    { id: 'waterproof_bag', col: 5,  row: 13 }, // grocery store interior
    { id: 'life_vest',      col: 35, row: 4  }  // community center interior
  ]
};

// Build live item list for a given act
function buildActItems(act) {
  return ITEM_SPAWNS[act].map(spawn => ({
    ...ITEM_DEFS[spawn.id],
    x: spawn.col * TILE_SIZE + TILE_SIZE / 2,
    y: spawn.row * TILE_SIZE + TILE_SIZE / 2,
    collected: false,
    floatAnim: null   // { text, x, y, alpha, vy } when collecting
  }));
}
