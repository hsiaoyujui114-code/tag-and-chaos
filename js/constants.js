// 《代號：極限追逐》(Tag & Chaos) — Core Constants & Game Data

export const TILE_SIZE = 48;
export const MAP_COLS = 28;
export const MAP_ROWS = 20;
export const WORLD_W = MAP_COLS * TILE_SIZE; // 1344
export const WORLD_H = MAP_ROWS * TILE_SIZE; // 960

export const TILE = {
  FLOOR: 0,
  WALL: 1,         // Solid full-height wall (blocks movement, dash, vision)
  LOW_BOX: 2,      // Low obstacle / desk (blocks walk, jumpable with Pogo, transparent to vision)
  BUSH: 3,         // Hiding bush (stealth inside, slight slow unless Nightwalker)
  ICE: 4,          // Low-friction ice
  WATER: 5,        // Water puddle (leaves wet footprints 3s)
  BOOST_R: 6,      // Conveyor / boost right
  BOOST_L: 7,      // Conveyor / boost left
  BOOST_U: 8,      // Conveyor / boost up
  BOOST_D: 9,      // Conveyor / boost down
  TELEPORT_A: 10,  // Teleporter pad A
  TELEPORT_B: 11,  // Teleporter pad B
  SWITCH: 12,      // Pressure switch (closes electric gates for 4s)
  GATE: 13,        // Electric gate (open by default, closes when switch triggered or periodic in factory)
  CRATE: 14,       // Destructible wooden crate (Shift dash breaks it, chance to drop item)
  ITEM_SPAWN: 15,  // Preferred item spawn point
  CHASER_SPAWN: 16,
  RUNNER_SPAWN: 17,
};

export const TILE_META = [
  { id: TILE.FLOOR, name: '地板', icon: '⬜', color: '#e2e8f0' },
  { id: TILE.WALL, name: '實心牆壁', icon: '🧱', color: '#334155' },
  { id: TILE.LOW_BOX, name: '矮桌障礙', icon: '🪑', color: '#94a3b8' },
  { id: TILE.BUSH, name: '隱藏草叢', icon: '🌿', color: '#22c55e' },
  { id: TILE.ICE, name: '滑冰地面', icon: '🧊', color: '#7dd3fc' },
  { id: TILE.WATER, name: '積水區', icon: '💧', color: '#38bdf8' },
  { id: TILE.BOOST_R, name: '加速帶→', icon: '➡️', color: '#f59e0b' },
  { id: TILE.BOOST_L, name: '加速帶←', icon: '⬅️', color: '#f59e0b' },
  { id: TILE.BOOST_U, name: '加速帶↑', icon: '⬆️', color: '#f59e0b' },
  { id: TILE.BOOST_D, name: '加速帶↓', icon: '⬇️', color: '#f59e0b' },
  { id: TILE.TELEPORT_A, name: '傳送陣 A', icon: '🌀', color: '#a855f7' },
  { id: TILE.TELEPORT_B, name: '傳送陣 B', icon: '🟣', color: '#c084fc' },
  { id: TILE.SWITCH, name: '閘門開關', icon: '🔴', color: '#ef4444' },
  { id: TILE.GATE, name: '電動閘門', icon: '🚪', color: '#64748b' },
  { id: TILE.CRATE, name: '可破木箱', icon: '📦', color: '#b45309' },
  { id: TILE.ITEM_SPAWN, name: '道具刷新點', icon: '🎁', color: '#eab308' },
  { id: TILE.CHASER_SPAWN, name: '追逐者起點', icon: '👹', color: '#dc2626' },
  { id: TILE.RUNNER_SPAWN, name: '逃跑者起點', icon: '🏃', color: '#2563eb' },
];

export const COLORS = [
  { id: 'red', name: '烈焰紅', hex: '#ef4444', dark: '#991b1b' },
  { id: 'blue', name: '電光藍', hex: '#3b82f6', dark: '#1e40af' },
  { id: 'green', name: '青檸綠', hex: '#22c55e', dark: '#166534' },
  { id: 'yellow', name: '香蕉黃', hex: '#facc15', dark: '#a16207' },
  { id: 'purple', name: '幻影紫', hex: '#a855f7', dark: '#6b21a8' },
  { id: 'orange', name: '活力橘', hex: '#f97316', dark: '#9a3412' },
  { id: 'cyan', name: '冰晶青', hex: '#06b6d4', dark: '#155e75' },
  { id: 'pink', name: '櫻花粉', hex: '#ec4899', dark: '#9d174d' },
];

export const HATS = [
  { id: 'none', name: '無頭飾', icon: '🚫' },
  { id: 'crown', name: '皇冠', icon: '👑' },
  { id: 'cat', name: '貓耳', icon: '🐱' },
  { id: 'shades', name: '墨鏡', icon: '🕶️' },
  { id: 'pirate', name: '海盜帽', icon: '🏴‍☠️' },
  { id: 'headband', name: '忍者頭帶', icon: '🎀' },
];

export const TRAILS = [
  { id: 'none', name: '簡約殘影', icon: '💨' },
  { id: 'rainbow', name: '彩虹拖尾', icon: '🌈' },
  { id: 'fire', name: '烈焰殘影', icon: '🔥' },
  { id: 'pixel', name: '像素點陣', icon: '👾' },
];

export const PERKS = [
  {
    id: 'hoarder',
    name: '道具狂',
    icon: '🎒',
    desc: '全場唯一可同時持有 2 個道具（按 Q 或點擊切換）',
  },
  {
    id: 'parkour',
    name: '跑酷專家',
    icon: '🏃',
    desc: 'Shift 翻滾衝刺／猛撲冷卻時間減少 35%',
  },
  {
    id: 'trapper',
    name: '陷阱大師',
    icon: '🪤',
    desc: '放置的香蕉皮、地雷面積 +30%，且免疫隊友陷阱',
  },
  {
    id: 'nightwalker',
    name: '夜行者',
    icon: '🌿',
    desc: '進草叢完全不減速，反而移動速度 +15%',
  },
  {
    id: 'megaphone',
    name: '大嗓門',
    icon: '📣',
    desc: '被抓或使用道具時，鄰近隊友獲得 1.5 秒加速',
  },
];

export const MODES = [
  { id: 'classic', name: '經典追逐', icon: '🏃', desc: '時間到未全滅即逃跑者勝；被抓轉觀戰搞事' },
  { id: 'infection', name: '感染模式', icon: '🦠', desc: '被抓的逃跑者變成追逐者！最後存活者獲勝' },
  { id: 'hot_potato', name: '燙手山芋', icon: '🔥', desc: '抓到人立即互換身分！倒數結束時當鬼的人輸' },
  { id: 'rescue', name: '救援牢籠', icon: '🤝', desc: '被抓關進中央牢籠，隊友碰觸牢籠可救出所有人' },
  { id: 'escape', name: '鑰匙逃脫', icon: '🔑', desc: '收集場上 3 把金鑰匙開啟逃生大門，衝進門獲勝' },
];

export const EMOTES = [
  { key: '1', emoji: '😂', label: '嘲諷' },
  { key: '2', emoji: '😱', label: '驚嚇' },
  { key: '3', emoji: '👍', label: '讚' },
  { key: '4', emoji: '😡', label: '生氣' },
];

// 22 Random Items across 5 categories
export const ITEMS = [
  // 5.1 Mobility
  { id: 'turbo', name: '渦輪加速鞋', icon: '⚡', cat: 'mobility', tier: 1, desc: '移速 +45% 持續 3.5 秒，附帶閃電殘影' },
  { id: 'blink', name: '閃現傳送門', icon: '🌀', cat: 'mobility', tier: 2, desc: '朝面向瞬間閃現一段距離（可穿薄牆）' },
  { id: 'rocket', name: '火箭噴射器', icon: '🚀', cat: 'mobility', tier: 2, desc: '極高速直線衝刺 1.2 秒，撞牆反彈一次' },
  { id: 'swap', name: '空間交換器', icon: '🔀', cat: 'mobility', tier: 3, desc: '隨機與另一名玩家互換位置（雙方 1 秒無敵）' },
  { id: 'pogo', name: '彈簧高蹺', icon: '🦘', cat: 'mobility', tier: 1, desc: '獲得跳躍能力 4 秒，直接跳過矮障礙與木箱' },

  // 5.2 Traps & Control
  { id: 'banana', name: '香蕉皮', icon: '🍌', cat: 'trap', tier: 1, desc: '丟在腳下，踩到者打滑旋轉 1.5 秒' },
  { id: 'freeze_mine', name: '冰凍地雷', icon: '❄️', cat: 'trap', tier: 2, desc: '半透明冰霜陷阱，踩到原地結冰定身 1.8 秒' },
  { id: 'slime', name: '黏液沼澤瓶', icon: '🟢', cat: 'trap', tier: 1, desc: '往前投擲形成黏液灘 5 秒，經過者移速減半' },
  { id: 'bear_trap', name: '捕獸夾', icon: '🪤', cat: 'trap', tier: 2, desc: '踩到夾住 2 秒並發出全場聽得到的喀嚓警報' },
  { id: 'bounce_mine', name: '彈飛地雷', icon: '💥', cat: 'trap', tier: 2, desc: '踩到會被強烈炸飛彈開一段距離！' },

  // 5.3 Vision & Disruption
  { id: 'smoke', name: '煙霧彈', icon: '💨', cat: 'vision', tier: 1, desc: '原地炸出大範圍濃煙 4.5 秒，遮蔽內外視野' },
  { id: 'flashbang', name: '閃光震撼彈', icon: '📸', cat: 'vision', tier: 2, desc: '0.8 秒後引爆，範圍內對手螢幕全白致盲 2 秒' },
  { id: 'confusion', name: '混亂毒藥', icon: '😵', cat: 'vision', tier: 2, desc: '發射毒霧使對手方向鍵上下左右顛倒 3.5 秒' },
  { id: 'ink', name: '墨水噴霧', icon: '🦑', cat: 'vision', tier: 1, desc: '讓最近對手螢幕被黑色墨水遮擋 3.5 秒' },
  { id: 'decoy', name: '假分身誘餌', icon: '🎭', cat: 'vision', tier: 1, desc: '放出沿道路亂跑的假分身 5 秒，碰觸即消散' },
  { id: 'disguise', name: '偽裝變身卡', icon: '📦', cat: 'vision', tier: 1, desc: '變身成木箱或道具箱外觀 5 秒，不動極難察覺' },

  // 5.4 Defense, Counter & Recon
  { id: 'shield', name: '泡泡護盾', icon: '🛡️', cat: 'defense', tier: 3, desc: '逃跑者抵擋抓捕並彈開鬼；追逐者免疫一次陷阱' },
  { id: 'cloak', name: '隱身斗篷', icon: '👻', cat: 'defense', tier: 3, desc: '進入隱身 3.5 秒（踩水或進草仍有波紋提示）' },
  { id: 'radar', name: '全圖雷達', icon: '📡', cat: 'defense', tier: 2, desc: '顯示所有對手方位箭頭與距離 5 秒（無視隱身）' },
  { id: 'magnet', name: '磁力吸盤', icon: '🧲', cat: 'defense', tier: 2, desc: '追逐者拉近前方逃跑者；逃跑者推開鬼或吸道具箱' },

  // 5.5 Chaos Events
  { id: 'slowmo', name: '時間減速器', icon: '⏳', cat: 'chaos', tier: 3, desc: '讓除自己以外的全場玩家進入慢動作 2.5 秒！' },
  { id: 'chaos_bell', name: '狂暴亂鬥鐘', icon: '🔔', cat: 'chaos', tier: 3, desc: '立即刷新 5 個道具箱，全場移速 +20% 持續 6 秒' },
];

export const ITEM_BY_ID = Object.fromEntries(ITEMS.map((it) => [it.id, it]));

export const SUDDEN_EVENTS = [
  { id: 'blackout', name: '全場大停電', icon: '🌑', desc: '所有人視野瞬間縮到剩腳邊一圈！' },
  { id: 'wind', name: '強風吹襲', icon: '💨', desc: '狂風大作！所有玩家持續被往同方向吹動！' },
  { id: 'double_speed', name: '2 倍速狂飆', icon: '⚡', desc: '全場移速與節奏變成 2 倍！考驗極限反應！' },
  { id: 'item_rain', name: '天降道具雨', icon: '📦', desc: '天上砸下 10 個神秘道具箱！快搶！' },
];

export const PLAYER_BASE = {
  CHASER_SPEED: 222,       // ~105.7%
  RUNNER_SPEED: 210,       // 100%
  CHASER_RADIUS: 18,
  RUNNER_RADIUS: 15.5,
  DASH_COOLDOWN: 5.0,
  CATCH_DISTANCE_PAD: 4,
  LUNGE_BONUS_RADIUS: 11,
  LUNGE_DURATION: 0.24,
  LUNGE_MISS_STAGGER: 0.5,
  DASH_DURATION: 0.22,
};
