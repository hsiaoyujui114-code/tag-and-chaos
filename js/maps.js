// 《代號：極限追逐》(Tag & Chaos) — Built-in Maps & Custom Map Codec
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

// 1. 🏢 辦公室 / 校園迷宮 (Office / Campus Maze)
function buildOfficeMap() {
  const g = createEmptyGrid();

  // Classroom / office walls with multiple doorways so chasing never dead-ends unfairly
  setRect(g, 4, 3, 7, 3, TILE.WALL);
  setRect(g, 4, 3, 4, 6, TILE.WALL);
  setRect(g, 6, 6, 8, 6, TILE.WALL);

  setRect(g, 20, 3, 23, 3, TILE.WALL);
  setRect(g, 23, 3, 23, 6, TILE.WALL);
  setRect(g, 19, 6, 21, 6, TILE.WALL);

  setRect(g, 4, 13, 4, 16, TILE.WALL);
  setRect(g, 4, 16, 7, 16, TILE.WALL);
  setRect(g, 6, 13, 8, 13, TILE.WALL);

  setRect(g, 23, 13, 23, 16, TILE.WALL);
  setRect(g, 20, 16, 23, 16, TILE.WALL);
  setRect(g, 19, 13, 21, 13, TILE.WALL);

  // Center loop pillars + electric gate shortcut
  setRect(g, 11, 7, 12, 7, TILE.WALL);
  setRect(g, 15, 7, 16, 7, TILE.WALL);
  setRect(g, 11, 12, 12, 12, TILE.WALL);
  setRect(g, 15, 12, 16, 12, TILE.WALL);

  // Electric gates & switches
  g[7][13] = TILE.GATE;
  g[7][14] = TILE.GATE;
  g[12][13] = TILE.GATE;
  g[12][14] = TILE.GATE;
  g[6][10] = TILE.SWITCH;
  g[13][17] = TILE.SWITCH;

  // Low desks (jumpable with Pogo)
  setRect(g, 9, 4, 10, 4, TILE.LOW_BOX);
  setRect(g, 17, 4, 18, 4, TILE.LOW_BOX);
  setRect(g, 9, 15, 10, 15, TILE.LOW_BOX);
  setRect(g, 17, 15, 18, 15, TILE.LOW_BOX);
  setRect(g, 3, 9, 3, 10, TILE.LOW_BOX);
  setRect(g, 24, 9, 24, 10, TILE.LOW_BOX);

  // Hiding Bushes
  setRect(g, 2, 2, 3, 2, TILE.BUSH);
  setRect(g, 24, 2, 25, 2, TILE.BUSH);
  setRect(g, 2, 17, 3, 17, TILE.BUSH);
  setRect(g, 24, 17, 25, 17, TILE.BUSH);
  setRect(g, 13, 3, 14, 4, TILE.BUSH);
  setRect(g, 13, 15, 14, 16, TILE.BUSH);

  // Water puddles
  setRect(g, 7, 9, 8, 10, TILE.WATER);
  setRect(g, 19, 9, 20, 10, TILE.WATER);

  // Destructible Crates on shortcuts
  g[5][4] = TILE.CRATE;
  g[14][4] = TILE.CRATE;
  g[5][23] = TILE.CRATE;
  g[14][23] = TILE.CRATE;
  g[9][10] = TILE.CRATE;
  g[10][17] = TILE.CRATE;

  // Diagonal teleporters
  g[2][13] = TILE.TELEPORT_A;
  g[17][14] = TILE.TELEPORT_B;

  // Boost strips
  g[2][9] = TILE.BOOST_R;
  g[2][10] = TILE.BOOST_R;
  g[17][17] = TILE.BOOST_L;
  g[17][18] = TILE.BOOST_L;

  // Item spawns
  const itemPts = [
    [6, 4], [21, 4], [6, 15], [21, 15],
    [13, 9], [14, 10], [5, 10], [22, 9],
    [13, 2], [14, 17],
  ];
  for (const [x, y] of itemPts) g[y][x] = TILE.ITEM_SPAWN;

  // Spawns
  g[9][13] = TILE.CHASER_SPAWN;
  g[10][14] = TILE.CHASER_SPAWN;
  const runnerPts = [
    [2, 5], [25, 5], [2, 14], [25, 14],
    [10, 2], [17, 2], [10, 17], [17, 17],
  ];
  for (const [x, y] of runnerPts) g[y][x] = TILE.RUNNER_SPAWN;

  return {
    id: 'office',
    name: '🏢 辦公室／校園迷宮',
    theme: 'office',
    desc: '隔間、矮桌、閘門開關與隱藏草叢交織，考驗繞柱與心理戰',
    periodicGates: false,
    grid: g,
  };
}

// 2. 🧊 滑冰場 (Ice Rink)
function buildIceMap() {
  const g = createEmptyGrid();

  // Giant central ice arena
  setRect(g, 3, 3, 24, 16, TILE.ICE);

  // Corner safe dry pads & bushes
  setRect(g, 1, 1, 3, 3, TILE.FLOOR);
  setRect(g, 24, 1, 26, 3, TILE.FLOOR);
  setRect(g, 1, 16, 3, 18, TILE.FLOOR);
  setRect(g, 24, 16, 26, 18, TILE.FLOOR);

  setRect(g, 2, 2, 2, 3, TILE.BUSH);
  setRect(g, 25, 2, 25, 3, TILE.BUSH);
  setRect(g, 2, 16, 2, 17, TILE.BUSH);
  setRect(g, 25, 16, 25, 17, TILE.BUSH);

  // Pillars & bounce obstacles
  setRect(g, 7, 5, 8, 6, TILE.WALL);
  setRect(g, 19, 5, 20, 6, TILE.WALL);
  setRect(g, 7, 13, 8, 14, TILE.WALL);
  setRect(g, 19, 13, 20, 14, TILE.WALL);

  // Center island
  setRect(g, 12, 8, 15, 11, TILE.FLOOR);
  setRect(g, 13, 9, 14, 10, TILE.LOW_BOX);

  // Boost lanes around perimeter
  setRect(g, 10, 2, 17, 2, TILE.BOOST_R);
  setRect(g, 10, 17, 17, 17, TILE.BOOST_L);
  setRect(g, 2, 7, 2, 12, TILE.BOOST_U);
  setRect(g, 25, 7, 25, 12, TILE.BOOST_D);

  // Water puddles near center
  g[7][13] = TILE.WATER;
  g[12][14] = TILE.WATER;

  // Crates
  g[5][13] = TILE.CRATE;
  g[14][14] = TILE.CRATE;
  g[9][5] = TILE.CRATE;
  g[10][22] = TILE.CRATE;

  // Teleporters
  g[4][4] = TILE.TELEPORT_A;
  g[15][23] = TILE.TELEPORT_B;

  const itemPts = [
    [13, 4], [14, 15], [5, 9], [22, 10],
    [10, 7], [17, 12], [10, 12], [17, 7],
  ];
  for (const [x, y] of itemPts) g[y][x] = TILE.ITEM_SPAWN;

  g[9][12] = TILE.CHASER_SPAWN;
  g[10][15] = TILE.CHASER_SPAWN;
  const runnerPts = [
    [2, 5], [25, 5], [2, 14], [25, 14],
    [6, 2], [21, 2], [6, 17], [21, 17],
  ];
  for (const [x, y] of runnerPts) g[y][x] = TILE.RUNNER_SPAWN;

  return {
    id: 'ice',
    name: '🧊 極限滑冰場',
    theme: 'ice',
    desc: '大片低摩擦冰面讓你甩尾漂移！搭配外圍加速帶玩出極限彎道超車',
    periodicGates: false,
    grid: g,
  };
}

// 3. 🏭 輸送帶工廠 (Conveyor Factory)
function buildFactoryMap() {
  const g = createEmptyGrid();

  // Assembly line conveyor belts
  setRect(g, 5, 4, 22, 4, TILE.BOOST_R);
  setRect(g, 5, 15, 22, 15, TILE.BOOST_L);
  setRect(g, 4, 5, 4, 14, TILE.BOOST_U);
  setRect(g, 23, 5, 23, 14, TILE.BOOST_D);

  // Inner machine walls & periodic electric gates
  setRect(g, 8, 7, 11, 7, TILE.WALL);
  setRect(g, 16, 7, 19, 7, TILE.WALL);
  setRect(g, 8, 12, 11, 12, TILE.WALL);
  setRect(g, 16, 12, 19, 12, TILE.WALL);

  g[8][8] = TILE.WALL;
  g[11][8] = TILE.WALL;
  g[8][19] = TILE.WALL;
  g[11][19] = TILE.WALL;

  // Gates & switches
  g[9][8] = TILE.GATE;
  g[10][8] = TILE.GATE;
  g[9][19] = TILE.GATE;
  g[10][19] = TILE.GATE;
  g[7][13] = TILE.GATE;
  g[7][14] = TILE.GATE;
  g[12][13] = TILE.GATE;
  g[12][14] = TILE.GATE;

  g[6][13] = TILE.SWITCH;
  g[13][14] = TILE.SWITCH;

  // Crates & low boxes
  g[9][6] = TILE.CRATE;
  g[10][6] = TILE.CRATE;
  g[9][21] = TILE.CRATE;
  g[10][21] = TILE.CRATE;
  setRect(g, 12, 9, 12, 10, TILE.LOW_BOX);
  setRect(g, 15, 9, 15, 10, TILE.LOW_BOX);

  // Oil / coolant puddles & hiding spots
  setRect(g, 6, 6, 6, 7, TILE.WATER);
  setRect(g, 21, 12, 21, 13, TILE.WATER);
  setRect(g, 2, 2, 3, 2, TILE.BUSH);
  setRect(g, 24, 17, 25, 17, TILE.BUSH);

  // Teleporters (diagonal corners)
  g[17][2] = TILE.TELEPORT_A;
  g[2][25] = TILE.TELEPORT_B;

  const itemPts = [
    [13, 9], [14, 10], [6, 14], [21, 5],
    [13, 2], [14, 17], [2, 9], [25, 10],
  ];
  for (const [x, y] of itemPts) g[y][x] = TILE.ITEM_SPAWN;

  g[9][13] = TILE.CHASER_SPAWN;
  g[10][14] = TILE.CHASER_SPAWN;
  const runnerPts = [
    [2, 4], [25, 4], [2, 15], [25, 15],
    [10, 2], [17, 2], [10, 17], [17, 17],
  ];
  for (const [x, y] of runnerPts) g[y][x] = TILE.RUNNER_SPAWN;

  return {
    id: 'factory',
    name: '🏭 輸送帶工廠',
    theme: 'factory',
    desc: '四向輸送帶加上自動開關的電動鐵門，善用地形機關甩開或封鎖對手！',
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
  g[9][13] = TILE.CHASER_SPAWN;
  g[10][14] = TILE.CHASER_SPAWN;
  g[3][3] = TILE.RUNNER_SPAWN;
  g[3][24] = TILE.RUNNER_SPAWN;
  g[16][3] = TILE.RUNNER_SPAWN;
  g[16][24] = TILE.RUNNER_SPAWN;
  g[5][13] = TILE.ITEM_SPAWN;
  g[14][14] = TILE.ITEM_SPAWN;
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
    v: 1,
    name: mapObj.name || '自訂地圖',
    theme: mapObj.theme || 'office',
    periodicGates: !!mapObj.periodicGates,
    grid: mapObj.grid,
  });
}

export function importMapJSON(raw) {
  const data = JSON.parse(raw.trim());
  if (!data || !Array.isArray(data.grid) || data.grid.length !== MAP_ROWS) {
    throw new Error('地圖列數格式錯誤（需為 20 列）');
  }
  for (const row of data.grid) {
    if (!Array.isArray(row) || row.length !== MAP_COLS) {
      throw new Error('地圖行數格式錯誤（需為 28 行）');
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
