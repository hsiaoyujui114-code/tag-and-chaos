// 《代號：極限追逐》(Tag & Chaos) — Main Controller, UI, Input & Loop
import {
  COLORS, HATS, TRAILS, PERKS, MODES, ITEMS, ITEM_BY_ID, EMOTES,
  TILE, TILE_SIZE, TILE_META, MAP_COLS, MAP_ROWS,
} from './constants.js';
import { BUILTIN_MAPS, cloneMap, createBlankCustomMap, exportMapJSON, importMapJSON } from './maps.js';
import { GameEngine } from './engine.js';
import { GameRenderer } from './renderer.js';
import { P2PManager } from './net.js';
import { audio } from './audio.js';

// App State
const profile = {
  id: 'p-' + Math.random().toString(36).slice(2, 8),
  name: '極限玩家',
  color: COLORS[1].hex,
  colorDark: COLORS[1].dark,
  hat: 'crown',
  trail: 'rainbow',
  perk: 'parkour',
  ready: true,
};

let customMap = null;
let lobbyMode = 'single'; // 'single' | 'host' | 'client'
let lobbyPeers = new Map(); // id -> profile
let engine = null;
let renderer = null;
let p2p = new P2PManager();
let rafId = null;
let lastTs = 0;
let netSnapAccum = 0;
let netInputAccum = 0;
let specSkillMode = 'banana';
let forceTouchUI = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Input state
const keysDown = new Set();
const joyVec = { dx: 0, dy: 0 };
const pendingEvents = { dash: false, useItem: false, swapSlot: false, emote: null };

// DOM helpers
const $ = (id) => document.getElementById(id);
const screens = ['home', 'lobby', 'editor', 'game', 'podium'];

function showScreen(name) {
  for (const s of screens) {
    $(`screen-${s}`).classList.toggle('hidden', s !== name);
  }
}

// ============================================================
// 1. HOME & CUSTOMIZATION UI
// ============================================================
function initHomeUI() {
  // Swatches
  const swWrap = $('color-swatches');
  COLORS.forEach((c) => {
    const btn = document.createElement('button');
    btn.className = 'swatch' + (profile.color === c.hex ? ' active' : '');
    btn.style.background = c.hex;
    btn.title = c.name;
    btn.onclick = () => {
      profile.color = c.hex;
      profile.colorDark = c.dark;
      swWrap.querySelectorAll('.swatch').forEach((x) => x.classList.remove('active'));
      btn.classList.add('active');
      drawAvatarPreview();
    };
    swWrap.appendChild(btn);
  });

  // Hats
  const hatWrap = $('hat-pills');
  HATS.forEach((h) => {
    const btn = document.createElement('button');
    btn.className = 'pill' + (profile.hat === h.id ? ' active' : '');
    btn.textContent = `${h.icon} ${h.name}`;
    btn.onclick = () => {
      profile.hat = h.id;
      hatWrap.querySelectorAll('.pill').forEach((x) => x.classList.remove('active'));
      btn.classList.add('active');
      drawAvatarPreview();
    };
    hatWrap.appendChild(btn);
  });

  // Trails
  const trWrap = $('trail-pills');
  TRAILS.forEach((tr) => {
    const btn = document.createElement('button');
    btn.className = 'pill' + (profile.trail === tr.id ? ' active' : '');
    btn.textContent = `${tr.icon} ${tr.name}`;
    btn.onclick = () => {
      profile.trail = tr.id;
      trWrap.querySelectorAll('.pill').forEach((x) => x.classList.remove('active'));
      btn.classList.add('active');
    };
    trWrap.appendChild(btn);
  });

  // Perks
  const pkWrap = $('perk-pills');
  const updatePerkDesc = () => {
    const p = PERKS.find((x) => x.id === profile.perk);
    $('perk-desc').textContent = `${p.icon} ${p.name}：${p.desc}`;
  };
  PERKS.forEach((pk) => {
    const btn = document.createElement('button');
    btn.className = 'pill' + (profile.perk === pk.id ? ' active' : '');
    btn.textContent = `${pk.icon} ${pk.name}`;
    btn.onclick = () => {
      profile.perk = pk.id;
      pkWrap.querySelectorAll('.pill').forEach((x) => x.classList.remove('active'));
      btn.classList.add('active');
      updatePerkDesc();
    };
    pkWrap.appendChild(btn);
  });
  updatePerkDesc();

  $('inp-name').oninput = (e) => {
    profile.name = e.target.value.trim() || '極限玩家';
  };

  drawAvatarPreview();

  // Populate Lobby Selectors
  const selMode = $('sel-mode');
  MODES.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `${m.icon} ${m.name}`;
    selMode.appendChild(opt);
  });
  selMode.onchange = () => {
    const m = MODES.find((x) => x.id === selMode.value);
    $('mode-desc').textContent = m ? `${m.icon} ${m.desc}` : '';
    syncLobbyToClients();
  };
  selMode.onchange();

  refreshMapSelect();

  ['sel-map', 'sel-duration', 'sel-ai-count', 'sel-ai-diff', 'sel-myrole',
   'chk-fog', 'chk-events', 'chk-poison', 'chk-rubber'].forEach((id) => {
    $(id).onchange = () => {
      renderLobbyPlayers();
      syncLobbyToClients();
    };
  });

  // Home Buttons
  $('btn-single').onclick = () => {
    lobbyMode = 'single';
    p2p.destroy();
    lobbyPeers.clear();
    lobbyPeers.set(profile.id, { ...profile });
    openLobbyUI();
  };

  $('btn-host').onclick = () => {
    lobbyMode = 'host';
    lobbyPeers.clear();
    openLobbyUI();
    p2p.createRoom((code, peerId) => {
      profile.id = peerId;
      lobbyPeers.set(profile.id, { ...profile });
      $('room-badge').classList.remove('hidden');
      $('room-code-txt').textContent = code;
      renderLobbyPlayers();
    });
  };

  $('btn-join').onclick = () => {
    const code = $('inp-room').value.trim().toUpperCase();
    if (!code) return alert('請輸入房號（例如 TAG-4829）');
    joinRoomByCode(code);
  };

  $('btn-editor').onclick = () => {
    initEditor();
    showScreen('editor');
  };

  $('btn-codex').onclick = openCodexModal;
  $('btn-modal-close').onclick = () => $('modal-backdrop').classList.add('hidden');
}

function joinRoomByCode(code) {
  lobbyMode = 'client';
  lobbyPeers.clear();
  openLobbyUI();
  p2p.joinRoom(code, { ...profile }, (myId) => {
    profile.id = myId;
  });
}

function refreshMapSelect() {
  const sel = $('sel-map');
  const prev = sel.value;
  sel.innerHTML = '';
  BUILTIN_MAPS.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name;
    sel.appendChild(opt);
  });
  if (customMap) {
    const opt = document.createElement('option');
    opt.value = 'custom';
    opt.textContent = `🛠 ${customMap.name}`;
    sel.appendChild(opt);
    sel.value = 'custom';
  } else if (prev && [...sel.options].some((o) => o.value === prev)) {
    sel.value = prev;
  }
}

function drawAvatarPreview() {
  const c = $('avatar-preview');
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  const cx = 38;
  const cy = 44;
  const r = 20;

  ctx.fillStyle = profile.colorDark;
  ctx.strokeStyle = '#111827';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(cx - 12, cy + 10, 9, 10, 4);
  ctx.roundRect(cx + 3, cy + 10, 9, 10, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = profile.color;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.roundRect(cx - 17, cy - 20, 34, 34, 15);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#e0f2fe';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(cx - 9, cy - 10, 20, 11, 6);
  ctx.fill();
  ctx.stroke();

  if (profile.hat !== 'none') {
    const map = { crown: '👑', cat: '🐱', shades: '🕶️', pirate: '🏴‍☠️', headband: '🎀' };
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(map[profile.hat] || '', cx, profile.hat === 'shades' ? cy + 2 : cy - 22);
  }
}

// ============================================================
// 2. LOBBY & P2P SYNC
// ============================================================
function openLobbyUI() {
  showScreen('lobby');
  const isClient = lobbyMode === 'client';
  $('lobby-title').textContent = lobbyMode === 'single' ? '🤖 單人對戰設定' : lobbyMode === 'host' ? '🌐 多人房間（房主）' : '🌐 多人房間（已加入）';
  $('room-badge').classList.toggle('hidden', lobbyMode === 'single');
  if (lobbyMode === 'client') {
    $('room-code-txt').textContent = p2p.roomCode;
  }
  $('btn-start-match').classList.toggle('hidden', isClient);
  $('wait-host-msg').classList.toggle('hidden', !isClient);

  const hostControls = ['sel-mode', 'sel-map', 'sel-duration', 'sel-ai-count', 'sel-ai-diff',
    'chk-fog', 'chk-events', 'chk-poison', 'chk-rubber'];
  hostControls.forEach((id) => { $(id).disabled = isClient; });

  renderLobbyPlayers();
}

function getLobbySettings() {
  const mapId = $('sel-map').value;
  const mapObj = mapId === 'custom' && customMap
    ? cloneMap(customMap)
    : cloneMap(BUILTIN_MAPS.find((m) => m.id === mapId) || BUILTIN_MAPS[0]);

  return {
    mode: $('sel-mode').value,
    mapId,
    map: mapObj,
    duration: Number($('sel-duration').value) || 90,
    aiCount: Number($('sel-ai-count').value),
    aiDiff: $('sel-ai-diff').value,
    myRole: $('sel-myrole').value,
    enableFog: $('chk-fog').checked,
    enableEvents: $('chk-events').checked,
    enablePoison: $('chk-poison').checked,
    enableRubberband: $('chk-rubber').checked,
  };
}

function buildParticipants(settings) {
  const humans = Array.from(lobbyPeers.values()).map((p, idx) => ({ ...p, isAI: false, idx }));
  const totalBots = settings.aiCount;
  const list = [...humans];
  const botNames = ['呆萌機器人', '閃電俠AI', '草叢老六', '搗蛋鬼AI', '跑酷狂AI', '爆笑香蕉', '迷宮大師'];

  for (let i = 0; i < totalBots; i++) {
    const c = COLORS[(i + 2) % COLORS.length];
    const h = HATS[(i + 1) % HATS.length].id;
    const pk = PERKS[i % PERKS.length].id;
    list.push({
      id: `ai-${i + 1}`,
      name: botNames[i % botNames.length],
      isAI: true,
      aiDiff: settings.aiDiff,
      color: c.hex,
      colorDark: c.dark,
      hat: h,
      trail: 'none',
      perk: pk,
    });
  }

  // Assign Chaser & Runners
  const chaserCount = list.length >= 6 ? 2 : 1;
  let assignedChasers = 0;

  // Respect local player's chosen role if single or host
  const localIdx = list.findIndex((p) => p.id === profile.id);
  if (localIdx >= 0 && settings.myRole === 'chaser') {
    list[localIdx].role = 'chaser';
    assignedChasers++;
  } else if (localIdx >= 0 && settings.myRole === 'runner') {
    list[localIdx].role = 'runner';
  }

  const unassigned = list.filter((p) => !p.role);
  // Prefer AI or random others to fill remaining chasers
  for (const p of unassigned) {
    if (assignedChasers < chaserCount && (p.isAI || settings.myRole === 'auto')) {
      p.role = 'chaser';
      assignedChasers++;
    } else {
      p.role = 'runner';
    }
  }
  if (assignedChasers === 0 && list.length > 0) {
    list[list.length - 1].role = 'chaser';
  }

  return list;
}

function renderLobbyPlayers() {
  const wrap = $('lobby-players');
  wrap.innerHTML = '';
  const settings = getLobbySettings();
  const humans = Array.from(lobbyPeers.values());
  humans.forEach((p) => {
    const pk = PERKS.find((x) => x.id === p.perk) || PERKS[0];
    const row = document.createElement('div');
    row.className = 'player-row';
    row.innerHTML = `
      <div class="player-chip">
        <span class="color-dot" style="background:${p.color}"></span>
        <span>${p.name}${p.id === profile.id ? ' (你)' : ''}</span>
      </div>
      <span style="font-size:0.82rem; color:#cbd5e1">${pk.icon} ${pk.name}</span>
    `;
    wrap.appendChild(row);
  });

  if (settings.aiCount > 0) {
    const aiRow = document.createElement('div');
    aiRow.className = 'player-row';
    aiRow.innerHTML = `
      <div class="player-chip"><span>🤖 電腦 AI 機器人 × ${settings.aiCount}</span></div>
      <span style="font-size:0.82rem; color:#fde047">難度：${settings.aiDiff}</span>
    `;
    wrap.appendChild(aiRow);
  }
}

function syncLobbyToClients() {
  if (lobbyMode !== 'host') return;
  const s = getLobbySettings();
  p2p.broadcast({
    type: 'lobby',
    state: {
      peers: Array.from(lobbyPeers.values()),
      settings: {
        mode: s.mode,
        mapId: s.mapId,
        duration: s.duration,
        aiCount: s.aiCount,
        aiDiff: s.aiDiff,
        enableFog: s.enableFog,
        enableEvents: s.enableEvents,
        enablePoison: s.enablePoison,
        enableRubberband: s.enableRubberband,
      },
    },
  });
}

// Wire P2P callbacks
p2p.onStatus = (msg) => { $('net-status').textContent = msg; };
p2p.onError = (err) => {
  $('net-status').textContent = err;
  alert(err);
};

p2p.onLobbyUpdate = (ev) => {
  if (lobbyMode === 'host') {
    if (ev.type === 'hello' || ev.type === 'profile') {
      lobbyPeers.set(ev.peerId, { ...ev.profile, id: ev.peerId });
      renderLobbyPlayers();
      syncLobbyToClients();
    } else if (ev.type === 'leave') {
      lobbyPeers.delete(ev.peerId);
      renderLobbyPlayers();
      syncLobbyToClients();
    }
  } else if (lobbyMode === 'client' && ev.type === 'sync') {
    lobbyPeers.clear();
    for (const pr of ev.state.peers) lobbyPeers.set(pr.id, pr);
    const st = ev.state.settings;
    $('sel-mode').value = st.mode;
    $('sel-duration').value = String(st.duration);
    $('sel-ai-count').value = String(st.aiCount);
    $('sel-ai-diff').value = st.aiDiff;
    $('chk-fog').checked = st.enableFog;
    $('chk-events').checked = st.enableEvents;
    $('chk-poison').checked = st.enablePoison;
    $('chk-rubber').checked = st.enableRubberband;
    renderLobbyPlayers();
  }
};

p2p.onStartMatch = (config) => {
  startGameSession(config, false);
};

p2p.onSnapshot = (snap) => {
  if (engine && !engine.isHost) {
    engine.applySnapshot(snap);
  }
};

p2p.onClientInput = (peerId, input) => {
  if (engine && engine.isHost) {
    engine.setPlayerInput(peerId, input);
  }
};

p2p.onSpectatorSkill = (peerId, skill, x, y) => {
  if (engine && engine.isHost) {
    engine.useSpectatorSkill(peerId, skill, x, y);
  }
};

$('btn-lobby-back').onclick = () => {
  p2p.destroy();
  showScreen('home');
};

$('btn-copy-link').onclick = async () => {
  const url = `${location.origin}${location.pathname}?room=${p2p.roomCode}`;
  try {
    await navigator.clipboard.writeText(url);
    $('btn-copy-link').textContent = '✅ 已複製邀請連結!';
    setTimeout(() => { $('btn-copy-link').textContent = '📋 複製邀請連結'; }, 2000);
  } catch {
    prompt('請複製以下邀請連結給朋友：', url);
  }
};

$('btn-start-match').onclick = () => {
  const settings = getLobbySettings();
  const participants = buildParticipants(settings);
  const config = { ...settings, participants };
  if (lobbyMode === 'host') {
    p2p.broadcast({ type: 'start', config });
  }
  startGameSession(config, true);
};

// ============================================================
// 3. MAP EDITOR
// ============================================================
let editorMap = createBlankCustomMap();
let selectedTile = TILE.WALL;
let editorDrawing = false;

function initEditor() {
  const pal = $('ed-palette');
  if (pal.children.length === 0) {
    TILE_META.forEach((tm) => {
      const btn = document.createElement('button');
      btn.className = 'tile-btn' + (tm.id === selectedTile ? ' active' : '');
      btn.innerHTML = `<span>${tm.icon}</span><span>${tm.name}</span>`;
      btn.onclick = () => {
        selectedTile = tm.id;
        pal.querySelectorAll('.tile-btn').forEach((x) => x.classList.remove('active'));
        btn.classList.add('active');
      };
      pal.appendChild(btn);
    });
  }
  drawEditorCanvas();
}

function drawEditorCanvas() {
  const c = $('editor-canvas');
  const ctx = c.getContext('2d');
  const cw = c.width / MAP_COLS; // 32
  const ch = c.height / MAP_ROWS; // 32

  for (let y = 0; y < MAP_ROWS; y++) {
    for (let x = 0; x < MAP_COLS; x++) {
      const tid = editorMap.grid[y][x];
      const meta = TILE_META.find((m) => m.id === tid) || TILE_META[0];
      ctx.fillStyle = meta.color;
      ctx.fillRect(x * cw, y * ch, cw, ch);
      ctx.strokeStyle = 'rgba(15,23,42,0.22)';
      ctx.strokeRect(x * cw, y * ch, cw, ch);
      if (tid !== TILE.FLOOR) {
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(meta.icon, (x + 0.5) * cw, (y + 0.5) * ch);
      }
    }
  }
}

function paintEditorCell(clientX, clientY, erase = false) {
  const c = $('editor-canvas');
  const rect = c.getBoundingClientRect();
  const tx = Math.floor(((clientX - rect.left) / rect.width) * MAP_COLS);
  const ty = Math.floor(((clientY - rect.top) / rect.height) * MAP_ROWS);
  if (tx <= 0 || ty <= 0 || tx >= MAP_COLS - 1 || ty >= MAP_ROWS - 1) return; // keep outer border walls
  editorMap.grid[ty][tx] = erase ? TILE.FLOOR : selectedTile;
  drawEditorCanvas();
}

$('editor-canvas').addEventListener('pointerdown', (e) => {
  editorDrawing = true;
  paintEditorCell(e.clientX, e.clientY, e.button === 2);
});
window.addEventListener('pointerup', () => { editorDrawing = false; });
$('editor-canvas').addEventListener('pointermove', (e) => {
  if (editorDrawing) paintEditorCell(e.clientX, e.clientY, e.buttons === 2);
});
$('editor-canvas').addEventListener('contextmenu', (e) => e.preventDefault());

$('btn-ed-back').onclick = () => showScreen('home');
$('btn-ed-clear').onclick = () => {
  editorMap = createBlankCustomMap();
  drawEditorCanvas();
};
$('btn-ed-export').onclick = () => {
  editorMap.name = $('ed-name').value.trim() || '自訂地圖';
  editorMap.theme = $('ed-theme').value;
  editorMap.periodicGates = $('ed-gates').checked;
  const code = exportMapJSON(editorMap);
  $('modal-title').textContent = '📤 匯出地圖代碼 (複製貼給朋友即可開局)';
  $('modal-body').innerHTML = `
    <textarea rows="7" readonly onclick="this.select()">${code}</textarea>
    <p style="color:#94a3b8; font-size:0.85rem;">提示：點一下上方文字框即可全選複製！</p>
  `;
  $('modal-backdrop').classList.remove('hidden');
};
$('btn-ed-import').onclick = () => {
  $('modal-title').textContent = '📥 貼上地圖 JSON 代碼匯入';
  $('modal-body').innerHTML = `
    <textarea id="inp-import-json" rows="6" placeholder="在此貼上朋友分享的地圖代碼..."></textarea>
    <button id="btn-confirm-import" class="btn btn-green" style="margin-top:10px">確認匯入</button>
  `;
  $('modal-backdrop').classList.remove('hidden');
  $('btn-confirm-import').onclick = () => {
    try {
      editorMap = importMapJSON($('inp-import-json').value);
      $('ed-name').value = editorMap.name;
      $('ed-theme').value = editorMap.theme;
      $('ed-gates').checked = !!editorMap.periodicGates;
      drawEditorCanvas();
      $('modal-backdrop').classList.add('hidden');
    } catch (err) {
      alert('匯入失敗：' + err.message);
    }
  };
};
$('btn-ed-apply').onclick = () => {
  editorMap.name = $('ed-name').value.trim() || '自訂地圖';
  editorMap.theme = $('ed-theme').value;
  editorMap.periodicGates = $('ed-gates').checked;
  customMap = cloneMap(editorMap);
  refreshMapSelect();
  lobbyMode = 'single';
  lobbyPeers.clear();
  lobbyPeers.set(profile.id, { ...profile });
  openLobbyUI();
};

// ============================================================
// 4. CODEX MODAL (22 Items + 5 Perks + 5 Modes)
// ============================================================
function openCodexModal() {
  $('modal-title').textContent = '🎁 全 22 種隨機道具 & 遊戲圖鑑';
  const itemsHtml = ITEMS.map((it) => `
    <div class="codex-item">
      <div style="font-weight:800; font-size:0.95rem; color:#fde047">${it.icon} ${it.name}</div>
      <div style="color:#cbd5e1; margin-top:3px">${it.desc}</div>
    </div>
  `).join('');
  $('modal-body').innerHTML = `
    <p style="margin-top:0; color:#94a3b8;">共 ${ITEMS.length} 種道具、${PERKS.length} 種職業天賦、${MODES.length} 種遊玩模式！</p>
    <div class="codex-grid">${itemsHtml}</div>
  `;
  $('modal-backdrop').classList.remove('hidden');
}

// ============================================================
// 5. GAME SESSION, LOOP, CONTROLS & HUD
// ============================================================
function startGameSession(config, isHost) {
  if (rafId) cancelAnimationFrame(rafId);
  audio.ensureCtx();
  engine = new GameEngine({
    ...config,
    localId: profile.id,
    isHost,
  });

  const canvas = $('game-canvas');
  renderer = new GameRenderer(canvas);
  const handleResize = () => renderer.resize(window.innerWidth, window.innerHeight);
  handleResize();
  window.onresize = handleResize;

  $('mobile-controls').classList.toggle('hidden', !forceTouchUI);
  showScreen('game');

  lastTs = performance.now();
  rafId = requestAnimationFrame(gameLoop);
}

function gameLoop(ts) {
  const dt = Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;

  // Gather local input
  const inp = collectLocalInput();
  if (engine.isHost) {
    engine.setPlayerInput(profile.id, inp);
    engine.step(dt);

    if (lobbyMode === 'host') {
      netSnapAccum += dt;
      if (netSnapAccum >= 0.04) { // 25Hz snapshot broadcast
        netSnapAccum = 0;
        p2p.broadcast({ type: 'snap', snap: engine.exportSnapshot() });
      }
    }
  } else {
    engine.interpolateClients(dt);
    netInputAccum += dt;
    if (netInputAccum >= 0.04) {
      netInputAccum = 0;
      p2p.sendToHost({ type: 'input', input: inp });
    }
  }

  renderer.render(engine, dt, specSkillMode);
  updateGameHUD(dt);

  if (engine.finished) {
    showPodium();
    return;
  }
  rafId = requestAnimationFrame(gameLoop);
}

function collectLocalInput() {
  let dx = joyVec.dx;
  let dy = joyVec.dy;
  if (keysDown.has('KeyW') || keysDown.has('ArrowUp')) dy -= 1;
  if (keysDown.has('KeyS') || keysDown.has('ArrowDown')) dy += 1;
  if (keysDown.has('KeyA') || keysDown.has('ArrowLeft')) dx -= 1;
  if (keysDown.has('KeyD') || keysDown.has('ArrowRight')) dx += 1;

  const out = {
    dx, dy,
    dash: pendingEvents.dash,
    useItem: pendingEvents.useItem,
    swapSlot: pendingEvents.swapSlot,
    emote: pendingEvents.emote,
  };
  pendingEvents.dash = false;
  pendingEvents.useItem = false;
  pendingEvents.swapSlot = false;
  pendingEvents.emote = null;
  return out;
}

let hbTimer = 0;
function updateGameHUD(dt) {
  const local = engine.players.find((p) => p.id === engine.localId);
  const secs = Math.ceil(engine.timeLeft);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  $('hud-timer').textContent = `${mm}:${ss}`;
  $('hud-timer').classList.toggle('fever', engine.feverActive || engine.timeLeft <= 20);

  const runnersAlive = engine.players.filter((p) => p.role === 'runner' && !p.caught && !p.caged && !p.escaped).length;
  const runnersTotal = engine.players.filter((p) => p.role === 'runner').length;
  $('hud-alive-txt').textContent = `逃跑者 ${runnersAlive}/${runnersTotal}`;

  if (engine.mode === 'escape') {
    $('hud-mode-extra').textContent = `｜🔑 ${engine.keysCollected}/3`;
  } else if (engine.mode === 'rescue') {
    const caged = engine.players.filter((p) => p.caged).length;
    $('hud-mode-extra').textContent = caged > 0 ? `｜⛓️ ${caged}人待救` : '';
  } else {
    $('hud-mode-extra').textContent = '';
  }

  // Banner
  if (engine.bannerTimer > 0 && engine.bannerMsg) {
    $('hud-banner').textContent = engine.bannerMsg;
    $('hud-banner').classList.remove('hidden');
  } else {
    $('hud-banner').classList.add('hidden');
  }

  if (!local) return;

  $('hud-role-badge').textContent = local.caught ? '👻 觀戰搞事中'
    : local.caged ? '⛓️ 牢籠待援'
    : local.role === 'chaser' ? '👹 追逐者' : '🏃 逃跑者';

  // Heartbeat audio when chaser gets close to local runner
  if (local.role === 'runner' && !local.caught && !local.caged) {
    let minD = Infinity;
    for (const o of engine.players) {
      if (o.role === 'chaser' && !o.caught) {
        const d = Math.hypot(o.x - local.x, o.y - local.y);
        if (d < minD) minD = d;
      }
    }
    if (minD < 250) {
      const intensity = 1 - minD / 250;
      hbTimer -= dt;
      if (hbTimer <= 0) {
        audio.playHeartbeat(intensity);
        hbTimer = Math.max(0.32, 0.9 - intensity * 0.55);
      }
    }
  }

  // Item slots
  const s0 = local.items[0] ? ITEM_BY_ID[local.items[0]] : null;
  $('slot-0-icon').textContent = s0 ? s0.icon : '➖';
  $('slot-0-name').textContent = s0 ? s0.name : '空道具欄';
  $('slot-0').classList.toggle('active', local.activeSlot === 0);

  const showSlot1 = local.maxItems > 1;
  $('slot-1').classList.toggle('hidden', !showSlot1);
  if (showSlot1) {
    const s1 = local.items[1] ? ITEM_BY_ID[local.items[1]] : null;
    $('slot-1-icon').textContent = s1 ? s1.icon : '➖';
    $('slot-1-name').textContent = s1 ? s1.name : '空道具欄 2';
    $('slot-1').classList.toggle('active', local.activeSlot === 1);
  }

  // Dash cooldown
  $('hud-dash-cd').textContent = local.dashCooldown > 0 ? `${local.dashCooldown.toFixed(1)}s` : '就緒!';
  $('hud-dash-cd').style.color = local.dashCooldown > 0 ? '#f87171' : '#4ade80';

  // Spectator bar
  $('spec-bar').classList.toggle('hidden', !local.caught);
  if (local.caught) {
    $('spec-cd-txt').textContent = local.specCooldown > 0 ? `冷卻 ${local.specCooldown.toFixed(1)}s` : '就緒! 點地圖空投';
  }
}

function showPodium() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  showScreen('podium');

  $('podium-title').textContent = engine.winner === 'chaser' ? '👹 追逐者陣營獲勝！' : '🏃 逃跑者陣營獲勝！';
  $('podium-sub').textContent = engine.winnerText;

  $('podium-awards').innerHTML = engine.awards.map((a) => `
    <div class="award-card">
      <div style="font-size:1.1rem; font-weight:900; color:#facc15">${a.title}</div>
      <div style="font-size:1.05rem; font-weight:800; margin:4px 0">${a.player}</div>
      <div style="font-size:0.82rem; color:#94a3b8">${a.detail}</div>
    </div>
  `).join('');

  $('podium-stats').innerHTML = engine.players.map((p) => {
    const pk = PERKS.find((x) => x.id === p.perk) || PERKS[0];
    return `
      <tr>
        <td><b>${p.name}</b>${p.isAI ? ' 🤖' : ''}</td>
        <td>${p.role === 'chaser' ? '👹 鬼' : p.escaped ? '🔑 逃脫' : p.caught ? '👻 被抓' : '🏃 存活'}</td>
        <td>${pk.icon} ${pk.name}</td>
        <td>${p.stats.catches}</td>
        <td>${p.stats.caughtCount}</td>
        <td>${p.stats.itemsUsed}</td>
        <td>${p.stats.trapsStepped}</td>
      </tr>
    `;
  }).join('');
}

// ============================================================
// 6. KEYBOARD, MOUSE, TOUCH & HUD BUTTON EVENTS
// ============================================================
window.addEventListener('keydown', (e) => {
  if ($('screen-game').classList.contains('hidden')) return;
  keysDown.add(e.code);
  if (e.code === 'Space') {
    e.preventDefault();
    pendingEvents.useItem = true;
  } else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    e.preventDefault();
    pendingEvents.dash = true;
  } else if (e.code === 'KeyQ') {
    pendingEvents.swapSlot = true;
  } else if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
    const idx = Number(e.code.replace('Digit', '')) - 1;
    if (EMOTES[idx]) pendingEvents.emote = EMOTES[idx].emoji;
  }
});

window.addEventListener('keyup', (e) => {
  keysDown.delete(e.code);
});

$('game-canvas').addEventListener('pointerdown', (e) => {
  if (!engine || $('screen-game').classList.contains('hidden')) return;
  const local = engine.players.find((p) => p.id === engine.localId);
  if (local && local.caught && renderer) {
    const pt = renderer.screenToWorld(e.clientX, e.clientY);
    if (engine.isHost) {
      engine.useSpectatorSkill(profile.id, specSkillMode, pt.x, pt.y);
    } else {
      p2p.sendToHost({ type: 'spec', skill: specSkillMode, x: pt.x, y: pt.y });
    }
  } else if (e.button === 0) {
    pendingEvents.useItem = true;
  }
});

$('slot-0').onclick = () => {
  const local = engine?.players.find((p) => p.id === engine.localId);
  if (local && local.activeSlot !== 0) pendingEvents.swapSlot = true;
  else pendingEvents.useItem = true;
};
$('slot-1').onclick = () => {
  const local = engine?.players.find((p) => p.id === engine.localId);
  if (local && local.activeSlot !== 1) pendingEvents.swapSlot = true;
  else pendingEvents.useItem = true;
};
$('btn-hud-dash').onclick = () => { pendingEvents.dash = true; };
document.querySelectorAll('.emote-btn').forEach((btn) => {
  btn.onclick = () => { pendingEvents.emote = btn.dataset.emote; };
});
$('btn-spec-banana').onclick = () => { specSkillMode = 'banana'; };
$('btn-spec-smoke').onclick = () => { specSkillMode = 'smoke'; };

$('btn-toggle-touch').onclick = () => {
  forceTouchUI = !forceTouchUI;
  $('mobile-controls').classList.toggle('hidden', !forceTouchUI);
};
$('btn-mute').onclick = () => {
  audio.setMuted(!audio.muted);
  $('btn-mute').textContent = audio.muted ? '🔇' : '🔊';
};
$('btn-quit-game').onclick = () => {
  if (rafId) cancelAnimationFrame(rafId);
  showScreen('lobby');
};

$('btn-rematch').onclick = () => {
  if (lobbyMode === 'client') {
    showScreen('lobby');
  } else {
    $('btn-start-match').click();
  }
};
$('btn-podium-home').onclick = () => {
  p2p.destroy();
  showScreen('home');
};

// Mobile Virtual Joystick
(() => {
  const zone = $('joystick-zone');
  const knob = $('joystick-knob');
  let activeId = null;

  const updateJoy = (cx, cy) => {
    const rect = zone.getBoundingClientRect();
    const ox = cx - (rect.left + rect.width / 2);
    const oy = cy - (rect.top + rect.height / 2);
    const maxR = rect.width / 2 - 16;
    const dist = Math.hypot(ox, oy);
    const clampD = Math.min(dist, maxR);
    const ang = Math.atan2(oy, ox);
    const kx = Math.cos(ang) * clampD;
    const ky = Math.sin(ang) * clampD;
    knob.style.transform = `translate(${kx}px, ${ky}px)`;
    if (dist > 8) {
      joyVec.dx = Math.cos(ang) * (clampD / maxR);
      joyVec.dy = Math.sin(ang) * (clampD / maxR);
    } else {
      joyVec.dx = 0;
      joyVec.dy = 0;
    }
  };

  zone.addEventListener('pointerdown', (e) => {
    activeId = e.pointerId;
    zone.setPointerCapture(e.pointerId);
    updateJoy(e.clientX, e.clientY);
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId === activeId) updateJoy(e.clientX, e.clientY);
  });
  const resetJoy = (e) => {
    if (e.pointerId === activeId) {
      activeId = null;
      joyVec.dx = 0;
      joyVec.dy = 0;
      knob.style.transform = 'translate(0, 0)';
    }
  };
  zone.addEventListener('pointerup', resetJoy);
  zone.addEventListener('pointercancel', resetJoy);

  $('mob-dash').onclick = (e) => { e.stopPropagation(); pendingEvents.dash = true; };
  $('mob-item').onclick = (e) => { e.stopPropagation(); pendingEvents.useItem = true; };
})();

// ============================================================
// 7. BOOTSTRAP & AUTO-JOIN URL ?room=TAG-XXXX
// ============================================================
initHomeUI();
const params = new URLSearchParams(location.search);
const urlRoom = params.get('room');
if (urlRoom) {
  $('inp-room').value = urlRoom.toUpperCase();
}
