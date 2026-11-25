// 《代號：極限追逐》(Tag & Chaos) — Large 44x32 Built-in Maps & Custom Map Codec
import { TILE, MAP_COLS, MAP_ROWS } from './constants.js';

function createEmptyGrid() {
  const g = Array.from({ length: MAP_ROWS }, () => Array(MAP_COLS).fill(TILE.FLOOR));
  for (let x = 0; x < MAP_COLS; x++) {
    g[0][x] = TILE.WALL;
    g[MAP_ROWS - 1][x] = TILE.WALL;
  }
  for (let y = 0; y < MAP_ROWS; y++) {
    g[y][0] = TILE.WALL;
    g[y][MAP_COLS - 1] = TILE.WALL;
  }
  return g;
}

function setRect(g, x1, y1, x2, y2, val) {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      if (y > 0 && y < MAP_ROWS - 1 && x > 0 && x < MAP_COLS - 1) {
        g[y][x] = val;
      }
    }
  }
}

function buildRoom(g, x1, y1, x2, y2, doors = []) {
  setRect(g, x1, y1, x2, y1, TILE.WALL);
  setRect(g, x1, y2, x2, y2, TILE.WALL);
  setRect(g, x1, y1, x1, y2, TILE.WALL);
  setRect(g, x2, y1, x2, y2, TILE.WALL);
  for (const [dx, dy, val = TILE.FLOOR] of doors) {
    if (dy > 0 && dy < MAP_ROWS - 1 && dx > 0 && dx < MAP_COLS - 1) {
      g[dy][dx] = val;
    }
  }
}

// 1. 🏢 辦公室／校園大迷宮 (44x32 Among-Us style interconnected rooms)
function buildOfficeMap() {
  const g = createEmptyGrid();

  // NW Classroom / Cafeteria
  buildRoom(g, 3, 3, 13, 10, [
    [7, 3], [8, 3], [13, 6], [13, 7], [6, 10], [7, 10], [3, 7, TILE.CRATE],
  ]);
  setRect(g, 6, 5, 10, 5, TILE.LOW_BOX);
  setRect(g, 6, 8, 10, 8, TILE.LOW_BOX);

  // NE Science Lab
  buildRoom(g, 30, 3, 40, 10, [
    [35, 3], [36, 3], [30, 6], [30, 7], [36, 10], [37, 10], [40, 7, TILE.CRATE],
  ]);
  setRect(g, 33, 5, 37, 5, TILE.LOW_BOX);
  setRect(g, 33, 8, 37, 8, TILE.LOW_BOX);

  // SW Storage / Library
  buildRoom(g, 3, 21, 13, 28, [
    [6, 21], [7, 21], [13, 24], [13, 25], [8, 28], [9, 28], [3, 24, TILE.CRATE],
  ]);
  setRect(g, 6, 23, 6, 26, TILE.LOW_BOX);
  setRect(g, 10, 23, 10, 26, TILE.LOW_BOX);

  // SE Gym / Auditorium
  buildRoom(g, 30, 21, 40, 28, [
    [35, 21], [36, 21], [30, 24], [30, 25], [35, 28], [36, 28], [40, 24, TILE.CRATE],
  ]);
  setRect(g, 34, 24, 36, 25, TILE.LOW_BOX);

  // North & South Corridor Pillars
  setRect(g, 18, 4, 25, 4, TILE.WALL);
  setRect(g, 18, 27, 25, 27, TILE.WALL);
  setRect(g, 16, 7, 17, 8, TILE.WALL);
  setRect(g, 26, 7, 27, 8, TILE.WALL);
  setRect(g, 16, 23, 17, 24, TILE.WALL);
  setRect(g, 26, 23, 27, 24, TILE.WALL);

  // Central Security Hub with Electric Gates & Switches
  buildRoom(g, 17, 12, 26, 19, [
    [21, 12, TILE.GATE], [22, 12, TILE.GATE],
    [21, 19, TILE.GATE], [22, 19, TILE.GATE],
    [17, 15], [17, 16], [26, 15], [26, 16],
  ]);
  g[10][19] = TILE.SWITCH;
  g[21][24] = TILE.SWITCH;

  // Side corridor crates & low cover
  g[15][6] = TILE.CRATE;
  g[16][6] = TILE.CRATE;
  g[15][37] = TILE.CRATE;
  g[16][37] = TILE.CRATE;
  setRect(g, 9, 14, 10, 17, TILE.LOW_BOX);
  setRect(g, 33, 14, 34, 17, TILE.LOW_BOX);

  // Hiding Bushes
  setRect(g, 2, 14, 4, 17, TILE.BUSH);
  setRect(g, 39, 14, 41, 17, TILE.BUSH);
  setRect(g, 20, 2, 23, 3, TILE.BUSH);
  setRect(g, 20, 28, 23, 29, TILE.BUSH);
  setRect(g, 4, 4, 5, 5, TILE.BUSH);
  setRect(g, 38, 26, 39, 27, TILE.BUSH);

  // Water puddles (leave wet footprints)
  setRect(g, 14, 15, 15, 16, TILE.WATER);
  setRect(g, 28, 15, 29, 16, TILE.WATER);
  setRect(g, 21, 7, 22, 8, TILE.WATER);
  setRect(g, 21, 23, 22, 24, TILE.WATER);

  // Paired Vent/Teleporters across diagonal wings
  g[4][4] = TILE.TELEPORT_A;
  g[27][39] = TILE.TELEPORT_B;
  g[27][4] = TILE.TELEPORT_A;
  g[4][39] = TILE.TELEPORT_B;

  // Boost hallways
  setRect(g, 17, 2, 19, 2, TILE.BOOST_R);
  setRect(g, 24, 29, 26, 29, TILE.BOOST_L);

  const itemPts = [
    [8, 6], [35, 6], [8, 25], [35, 25],
    [21, 15], [22, 16], [7, 15], [36, 16],
    [21, 5], [22, 26], [15, 10], [28, 21],
  ];
  for (const [x, y] of itemPts) g[y][x] = TILE.ITEM_SPAWN;

  // Chaser spawns at central hub
  g[15][21] = TILE.CHASER_SPAWN;
  g[16][22] = TILE.CHASER_SPAWN;

  // Runner spawns spread across far wings
  const runnerPts = [
    [2, 2], [41, 2], [2, 29], [41, 29],
    [11, 2], [32, 2], [11, 29], [32, 29],
  ];
  for (const [x, y] of runnerPts) g[y][x] = TILE.RUNNER_SPAWN;

  return {
    id: 'office',
    name: '🏢 辦公室／校園大迷宮',
    theme: 'office',
    desc: '多艙室大迷宮、電動閘門開關與隱藏草叢，宛如太空狼人殺般的驚險轉角遭遇！',
    periodicGates: false,
    grid: g,
  };
}

// 2. 🧊 極限滑冰場 (44x32)
function buildIceMap() {
  const g = createEmptyGrid();

  setRect(g, 4, 4, 39, 27, TILE.ICE);

  // Corner warm shelters & bushes
  setRect(g, 1, 1, 5, 5, TILE.FLOOR);
  setRect(g, 38, 1, 42, 5, TILE.FLOOR);
  setRect(g, 1, 26, 5, 30, TILE.FLOOR);
  setRect(g, 38, 26, 42, 30, TILE.FLOOR);

  setRect(g, 2, 2, 3, 3, TILE.BUSH);
  setRect(g, 40, 2, 41, 3, TILE.BUSH);
  setRect(g, 2, 28, 3, 29, TILE.BUSH);
  setRect(g, 40, 28, 41, 29, TILE.BUSH);

  // Ice maze blocks
  setRect(g, 10, 7, 13, 9, TILE.WALL);
  setRect(g, 30, 7, 33, 9, TILE.WALL);
  setRect(g, 10, 22, 13, 24, TILE.WALL);
  setRect(g, 30, 22, 33, 24, TILE.WALL);
  setRect(g, 7, 14, 8, 17, TILE.WALL);
  setRect(g, 35, 14, 36, 17, TILE.WALL);

  // Center island
  setRect(g, 19, 13, 24, 18, TILE.FLOOR);
  setRect(g, 21, 15, 22, 16, TILE.LOW_BOX);

  // Perimeter speed lanes
  setRect(g, 14, 2, 29, 2, TILE.BOOST_R);
  setRect(g, 14, 29, 29, 29, TILE.BOOST_L);
  setRect(g, 2, 10, 2, 21, TILE.BOOST_U);
  setRect(g, 41, 10, 41, 21, TILE.BOOST_D);

  // Water puddles & crates
  setRect(g, 21, 8, 22, 9, TILE.WATER);
  setRect(g, 21, 22, 22, 23, TILE.WATER);
  g[10][21] = TILE.CRATE;
  g[21][22] = TILE.CRATE;
  g[15][14] = TILE.CRATE;
  g[16][29] = TILE.CRATE;

  g[5][5] = TILE.TELEPORT_A;
  g[26][38] = TILE.TELEPORT_B;

  const itemPts = [
    [21, 5], [22, 26], [6, 15], [37, 16],
    [15, 10], [28, 10], [15, 21], [28, 21],
    [11, 15], [32, 16],
  ];
  for (const [x, y] of itemPts) g[y][x] = TILE.ITEM_SPAWN;

  g[15][19] = TILE.CHASER_SPAWN;
  g[16][24] = TILE.CHASER_SPAWN;
  const runnerPts = [
    [2, 5], [41, 5], [2, 26], [41, 26],
    [10, 2], [33, 2], [10, 29], [33, 29],
  ];
  for (const [x, y] of runnerPts) g[y][x] = TILE.RUNNER_SPAWN;

  return {
    id: 'ice',
    name: '🧊 極限滑冰場',
    theme: 'ice',
    desc: '超寬闊滑冰競技場！甩尾漂移加上四週極速通道，考驗控車與預判',
    periodicGates: false,
    grid: g,
  };
}

// 3. 🏭 輸送帶工廠 (44x32)
function buildFactoryMap() {
  const g = createEmptyGrid();

  // Outer conveyor belt loop
  setRect(g, 7, 5, 36, 5, TILE.BOOST_R);
  setRect(g, 7, 26, 36, 26, TILE.BOOST_L);
  setRect(g, 6, 6, 6, 25, TILE.BOOST_U);
  setRect(g, 37, 6, 37, 25, TILE.BOOST_D);

  // Four inner machine rooms with electric gates
  buildRoom(g, 10, 9, 18, 14, [[14, 9], [10, 11], [18, 11, TILE.GATE], [14, 14, TILE.GATE]]);
  buildRoom(g, 25, 9, 33, 14, [[29, 9], [33, 11], [25, 11, TILE.GATE], [29, 14, TILE.GATE]]);
  buildRoom(g, 10, 17, 18, 22, [[14, 22], [10, 20], [18, 20, TILE.GATE], [14, 17, TILE.GATE]]);
  buildRoom(g, 25, 17, 33, 22, [[29, 22], [33, 20], [25, 20, TILE.GATE], [29, 17, TILE.GATE]]);

  g[15][21] = TILE.SWITCH;
  g[16][22] = TILE.SWITCH;

  // Crates & low boxes
  g[15][9] = TILE.CRATE;
  g[16][9] = TILE.CRATE;
  g[15][34] = TILE.CRATE;
  g[16][34] = TILE.CRATE;
  setRect(g, 20, 11, 23, 11, TILE.LOW_BOX);
  setRect(g, 20, 20, 23, 20, TILE.LOW_BOX);

  // Coolant puddles & hiding spots
  setRect(g, 12, 11, 13, 12, TILE.WATER);
  setRect(g, 30, 19, 31, 20, TILE.WATER);
  setRect(g, 2, 2, 4, 3, TILE.BUSH);
  setRect(g, 39, 28, 41, 29, TILE.BUSH);
  setRect(g, 2, 28, 4, 29, TILE.BUSH);
  setRect(g, 39, 2, 41, 3, TILE.BUSH);

  g[28][3] = TILE.TELEPORT_A;
  g[3][40] = TILE.TELEPORT_B;

  const itemPts = [
    [14, 11], [29, 11], [14, 20], [29, 20],
    [21, 7], [22, 24], [4, 15], [39, 16],
    [21, 15], [22, 16],
  ];
  for (const [x, y] of itemPts) g[y][x] = TILE.ITEM_SPAWN;

  g[15][20] = TILE.CHASER_SPAWN;
  g[16][23] = TILE.CHASER_SPAWN;
  const runnerPts = [
    [2, 6], [41, 6], [2, 25], [41, 25],
    [14, 2], [29, 2], [14, 29], [29, 29],
  ];
  for (const [x, y] of runnerPts) g[y][x] = TILE.RUNNER_SPAWN;

  return {
    id: 'factory',
    name: '🏭 輸送帶工廠',
    theme: 'factory',
    desc: '大型迴圈輸送帶加上定時自動開關的電動鐵門，善用機房地形甩開追擊！',
    periodicGates: true,
    grid: g,
  };
}

export const BUILTIN_MAPS = [
  buildOfficeMap(),
  buildIceMap(),
  buildFactoryMap(),
];

export function cloneMap(mapObj) {
  return {
    ...mapObj,
    grid: mapObj.grid.map((row) => [...row]),
  };
}

export function createBlankCustomMap() {
  const g = createEmptyGrid();
  g[15][21] = TILE.CHASER_SPAWN;
  g[16][22] = TILE.CHASER_SPAWN;
  g[4][4] = TILE.RUNNER_SPAWN;
  g[4][39] = TILE.RUNNER_SPAWN;
  g[27][4] = TILE.RUNNER_SPAWN;
  g[27][39] = TILE.RUNNER_SPAWN;
  g[8][21] = TILE.ITEM_SPAWN;
  g[23][22] = TILE.ITEM_SPAWN;
  return {
    id: 'custom',
    name: '🛠 自訂地圖',
    theme: 'office',
    desc: '玩家自製地圖',
    periodicGates: false,
    grid: g,
  };
}

export function exportMapJSON(mapObj) {
  return JSON.stringify({
    v: 2,
    name: mapObj.name || '自訂地圖',
    theme: mapObj.theme || 'office',
    periodicGates: !!mapObj.periodicGates,
    grid: mapObj.grid,
  });
}

export function importMapJSON(raw) {
  const data = JSON.parse(raw.trim());
  if (!data || !Array.isArray(data.grid) || data.grid.length !== MAP_ROWS) {
    throw new Error(`地圖列數格式錯誤（需為 ${MAP_ROWS} 列）`);
  }
  for (const row of data.grid) {
    if (!Array.isArray(row) || row.length !== MAP_COLS) {
      throw new Error(`地圖行數格式錯誤（需為 ${MAP_COLS} 行）`);
    }
  }
  return {
    id: 'custom',
    name: String(data.name || '🛠 匯入地圖').slice(0, 28),
    theme: ['office', 'ice', 'factory'].includes(data.theme) ? data.theme : 'office',
    desc: '透過地圖代碼匯入的自製地圖',
    periodicGates: !!data.periodicGates,
    grid: data.grid.map((r) => r.map((c) => (Number.isInteger(c) && c >= 0 && c <= 17 ? c : 0))),
  };
}
