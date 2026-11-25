// 《代號：極限追逐》(Tag & Chaos) — Authoritative Game Simulation Engine
import {
  TILE, TILE_SIZE, MAP_COLS, MAP_ROWS, WORLD_W, WORLD_H,
  ITEMS, ITEM_BY_ID, SUDDEN_EVENTS, PLAYER_BASE, EMOTES,
} from './constants.js';
import { cloneMap } from './maps.js';
import { computeAIInput } from './ai.js';
import { audio } from './audio.js';

export class GameEngine {
  constructor(config) {
    this.worldW = WORLD_W;
    this.worldH = WORLD_H;
    this.map = cloneMap(config.map);
    this.grid = this.map.grid;
    this.mode = config.mode || 'classic';
    this.duration = config.duration || 90;
    this.timeLeft = this.duration;
    this.elapsed = 0;

    this.enableFog = config.enableFog !== false;
    this.enableEvents = config.enableEvents !== false;
    this.enablePoison = config.enablePoison !== false;
    this.enableRubberband = config.enableRubberband !== false;

    this.finished = false;
    this.winner = null; // 'chaser' | 'runner' | 'draw'
    this.winnerText = '';
    this.awards = [];

    // Dynamic world objects
    this.players = [];
    this.itemBoxes = [];
    this.traps = [];
    this.projectiles = [];
    this.smokes = [];
    this.decoys = [];
    this.footprints = [];
    this.particles = [];
    this.floatingTexts = [];
    this.keys = [];
    this.keysCollected = 0;
    this.escapeGateOpen = false;
    this.escapeGatePos = null;
    this.prisonPos = null;

    // Gates & switches
    this.gateClosedTimer = 0;
    this.periodicGateCycle = 0;

    // Timers & Global Events
    this.itemSpawnTimer = 2.0;
    this.eventCooldown = 22.0;
    this.activeEvent = null; // { id, name, icon, desc, timer, windX, windY }
    this.slowmoTimer = 0;
    this.slowmoImmuneId = null;
    this.chaosSpeedTimer = 0;
    this.feverActive = false;

    this.maxWorldRadius = Math.hypot(WORLD_W / 2, WORLD_H / 2);
    this.poisonRadius = this.maxWorldRadius;

    this.localId = config.localId || 'p1';
    this.isHost = config.isHost !== false;
    this.countdownTimer = 3.4; // 3 -> 2 -> 1 -> GO!
    this._lastCdTick = 4;
    this.bannerMsg = '';
    this.bannerTimer = 0;
    this.nextEntityId = 1;

    this.initWorldPoints();
    this.spawnPlayers(config.participants || []);
    this.initModeObjects();
    // Spawn initial 6 item boxes across the large map
    for (let i = 0; i < 6; i++) this.spawnRandomItemBox();
  }

  uid() {
    return this.nextEntityId++;
  }

  initWorldPoints() {
    this.chaserSpawns = [];
    this.runnerSpawns = [];
    this.itemSpawns = [];
    this.teleportsA = [];
    this.teleportsB = [];
    this.walkableTiles = [];

    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        const t = this.grid[y][x];
        const cx = (x + 0.5) * TILE_SIZE;
        const cy = (y + 0.5) * TILE_SIZE;
        if (t === TILE.CHASER_SPAWN) this.chaserSpawns.push({ x: cx, y: cy });
        else if (t === TILE.RUNNER_SPAWN) this.runnerSpawns.push({ x: cx, y: cy });
        else if (t === TILE.ITEM_SPAWN) this.itemSpawns.push({ x: cx, y: cy });
        else if (t === TILE.TELEPORT_A) this.teleportsA.push({ x: cx, y: cy });
        else if (t === TILE.TELEPORT_B) this.teleportsB.push({ x: cx, y: cy });

        if (![TILE.WALL, TILE.LOW_BOX, TILE.CRATE, TILE.GATE].includes(t)) {
          this.walkableTiles.push({ x: cx, y: cy, tx: x, ty: y });
        }
      }
    }

    if (this.chaserSpawns.length === 0) {
      this.chaserSpawns.push(this.findNearestWalkable(WORLD_W / 2, WORLD_H / 2));
    }
    if (this.runnerSpawns.length === 0) {
      this.runnerSpawns.push(
        this.findNearestWalkable(TILE_SIZE * 2.5, TILE_SIZE * 2.5),
        this.findNearestWalkable(WORLD_W - TILE_SIZE * 2.5, TILE_SIZE * 2.5),
        this.findNearestWalkable(TILE_SIZE * 2.5, WORLD_H - TILE_SIZE * 2.5),
        this.findNearestWalkable(WORLD_W - TILE_SIZE * 2.5, WORLD_H - TILE_SIZE * 2.5)
      );
    }
  }

  findNearestWalkable(wx, wy) {
    let best = { x: WORLD_W / 2, y: WORLD_H / 2 };
    let bestD = Infinity;
    for (const pt of this.walkableTiles) {
      const d = Math.hypot(pt.x - wx, pt.y - wy);
      if (d < bestD) {
        bestD = d;
        best = { x: pt.x, y: pt.y };
      }
    }
    return best;
  }

  getRandomWalkablePos() {
    if (this.walkableTiles.length === 0) return { x: WORLD_W / 2, y: WORLD_H / 2 };
    return this.walkableTiles[Math.floor(Math.random() * this.walkableTiles.length)];
  }

  spawnPlayers(participants) {
    let ci = 0;
    let ri = 0;
    for (const part of participants) {
      const isChaser = part.role === 'chaser';
      const spawn = isChaser
        ? this.chaserSpawns[ci++ % this.chaserSpawns.length]
        : this.runnerSpawns[ri++ % this.runnerSpawns.length];
      const maxItems = part.perk === 'hoarder' ? 2 : 1;

      this.players.push({
        id: part.id,
        name: part.name || '玩家',
        isAI: !!part.isAI,
        aiDiff: part.aiDiff || 'normal',
        role: isChaser ? 'chaser' : 'runner',
        color: part.color || '#3b82f6',
        colorDark: part.colorDark || '#1e40af',
        hat: part.hat || 'none',
        trail: part.trail || 'none',
        perk: part.perk || 'parkour',

        x: spawn.x,
        y: spawn.y,
        vx: 0,
        vy: 0,
        dirX: isChaser ? 0 : 1,
        dirY: isChaser ? 1 : 0,
        radius: isChaser ? PLAYER_BASE.CHASER_RADIUS : PLAYER_BASE.RUNNER_RADIUS,

        // States
        caught: false,
        caged: false,
        escaped: false,
        invulnTimer: 0,
        dashCooldown: 0,
        dashMaxCooldown: part.perk === 'parkour' ? PLAYER_BASE.DASH_COOLDOWN * 0.65 : PLAYER_BASE.DASH_COOLDOWN,
        dashTimer: 0,
        lungeTimer: 0,
        lungeDidHit: false,
        staggerTimer: 0,

        // Items & Buffs/Debuffs
        items: [],
        activeSlot: 0,
        maxItems,
        speedBoostTimer: 0,
        megaphoneBoostTimer: 0,
        rocketTimer: 0,
        rocketDirX: 1,
        rocketDirY: 0,
        rocketBounces: 0,
        pogoTimer: 0,
        slipTimer: 0,
        freezeTimer: 0,
        trapTimer: 0,
        knockVx: 0,
        knockVy: 0,
        knockTimer: 0,
        blindTimer: 0,
        confuseTimer: 0,
        inkTimer: 0,
        disguiseTimer: 0,
        disguiseType: 'crate',
        shieldActive: false,
        cloakTimer: 0,
        radarTimer: 0,
        teleportCooldown: 0,
        footprintTimer: 0,
        poisonOutsideTimer: 0,

        // Spectator
        specCooldown: 0,
        emote: null,
        emoteTimer: 0,
        walkCycle: 0,
        trailPoints: [],

        // Stats for Podium Awards
        stats: {
          catches: 0,
          caughtCount: 0,
          itemsUsed: 0,
          trapsStepped: 0,
          rescues: 0,
          escapes: 0,
          distanceMoved: 0,
          closeCalls: 0,
        },
        input: { dx: 0, dy: 0, dash: false, useItem: false, swapSlot: false, emote: null },
      });
    }
  }

  initModeObjects() {
    if (this.mode === 'rescue') {
      this.prisonPos = this.findNearestWalkable(WORLD_W / 2, WORLD_H / 2);
    } else if (this.mode === 'escape') {
      this.escapeGatePos = this.findNearestWalkable(WORLD_W / 2, TILE_SIZE * 1.5);
      // Spawn 3 keys far apart
      const used = [];
      for (let i = 0; i < 3; i++) {
        let bestPt = this.getRandomWalkablePos();
        for (let tries = 0; tries < 20; tries++) {
          const cand = this.getRandomWalkablePos();
          const tooClose = used.some((u) => Math.hypot(u.x - cand.x, u.y - cand.y) < 260);
          if (!tooClose) { bestPt = cand; break; }
        }
        used.push(bestPt);
        this.keys.push({ id: this.uid(), x: bestPt.x, y: bestPt.y });
      }
    }
  }

  areOpponents(a, b) {
    if (!a || !b || a.id === b.id) return false;
    return a.role !== b.role;
  }

  isInBush(p) {
    const tx = Math.floor(p.x / TILE_SIZE);
    const ty = Math.floor(p.y / TILE_SIZE);
    if (ty < 0 || ty >= MAP_ROWS || tx < 0 || tx >= MAP_COLS) return false;
    return this.grid[ty][tx] === TILE.BUSH;
  }

  getTileAt(wx, wy) {
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    if (ty < 0 || ty >= MAP_ROWS || tx < 0 || tx >= MAP_COLS) return TILE.WALL;
    return this.grid[ty][tx];
  }

  isTileBlocking(tx, ty, canJump = false) {
    if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) return true;
    const t = this.grid[ty][tx];
    if (t === TILE.WALL) return true;
    if (t === TILE.GATE && this.gateClosedTimer > 0) return true;
    if (!canJump && t === TILE.LOW_BOX) return true;
    if (!canJump && t === TILE.CRATE) return true;
    return false;
  }

  setPlayerInput(id, input) {
    const p = this.players.find((x) => x.id === id);
    if (!p) return;
    p.input = { ...p.input, ...input };
  }

  triggerBanner(msg, dur = 3.0) {
    this.bannerMsg = msg;
    this.bannerTimer = dur;
  }

  addFloatText(x, y, text, color = '#fff') {
    this.floatingTexts.push({ id: this.uid(), x, y, text, color, life: 1.2, maxLife: 1.2 });
  }

  addParticles(x, y, color, count = 10, speed = 130, life = 0.45) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = (0.3 + Math.random() * 0.7) * speed;
      this.particles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        color,
        size: 3 + Math.random() * 4,
        life,
        maxLife: life,
      });
    }
  }

  spawnRandomItemBox(forcedPos = null) {
    if (this.itemBoxes.length >= 22) return;
    let pos = forcedPos;
    if (!pos) {
      const candidates = this.itemSpawns.length > 0 ? this.itemSpawns : this.walkableTiles;
      for (let tries = 0; tries < 15; tries++) {
        const c = candidates[Math.floor(Math.random() * candidates.length)];
        const occupied = this.itemBoxes.some((b) => Math.hypot(b.x - c.x, b.y - c.y) < 30);
        if (!occupied) { pos = c; break; }
      }
    }
    if (!pos) pos = this.getRandomWalkablePos();
    this.itemBoxes.push({ id: this.uid(), x: pos.x, y: pos.y, bobPhase: Math.random() * Math.PI * 2 });
  }

  rollRandomItem(picker) {
    // Rubberband mechanic: last 20s or trailing side gets higher chance of tier 2-3 items
    const isTrailing = this.enableRubberband && (
      this.feverActive ||
      (picker.role === 'chaser' && this.timeLeft < 40 && this.players.filter((o) => o.role === 'runner' && !o.caught).length >= 2) ||
      (picker.role === 'runner' && this.players.filter((o) => o.role === 'runner' && !o.caught).length <= 2)
    );
    const pool = [];
    for (const it of ITEMS) {
      let weight = it.tier === 1 ? 5 : it.tier === 2 ? 3 : 2;
      if (isTrailing && it.tier >= 2) weight += 3;
      for (let i = 0; i < weight; i++) pool.push(it.id);
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  step(dt) {
    if (this.finished) return;
    const clampedDt = Math.min(dt, 0.05);

    if (this.countdownTimer > 0) {
      this.countdownTimer = Math.max(0, this.countdownTimer - clampedDt);
      for (const p of this.players) {
        if (p.input.emote) {
          p.emote = p.input.emote;
          p.emoteTimer = 2.2;
        }
        if (p.emoteTimer > 0) {
          p.emoteTimer = Math.max(0, p.emoteTimer - clampedDt);
          if (p.emoteTimer === 0) p.emote = null;
        }
        p.input.dash = false;
        p.input.useItem = false;
        p.input.swapSlot = false;
        p.input.emote = null;
      }
      const ceilVal = Math.ceil(this.countdownTimer - 0.35);
      if (this.isHost && ceilVal !== this._lastCdTick && ceilVal >= 0) {
        this._lastCdTick = ceilVal;
        audio.playCountdown(ceilVal === 0);
      }
      return;
    }

    this.elapsed += clampedDt;
    this.timeLeft = Math.max(0, this.timeLeft - clampedDt);

    if (this.bannerTimer > 0) this.bannerTimer = Math.max(0, this.bannerTimer - clampedDt);
    if (this.slowmoTimer > 0) this.slowmoTimer = Math.max(0, this.slowmoTimer - clampedDt);
    if (this.chaosSpeedTimer > 0) this.chaosSpeedTimer = Math.max(0, this.chaosSpeedTimer - clampedDt);

    // Fever time (last 20s)
    if (!this.feverActive && this.timeLeft <= 20 && this.duration >= 30) {
      this.feverActive = true;
      this.triggerBanner('⏱ 最後 20 秒！狂暴時刻 FEVER TIME！', 3.2);
      if (this.isHost) audio.playEvent();
    }

    // Periodic gates in Factory map
    if (this.map.periodicGates) {
      this.periodicGateCycle += clampedDt;
      if (this.periodicGateCycle >= 11) {
        this.periodicGateCycle = 0;
        if (this.gateClosedTimer <= 0) {
          this.gateClosedTimer = 3.5;
          if (this.isHost) audio.playGate();
        }
      }
    }
    if (this.gateClosedTimer > 0) {
      this.gateClosedTimer = Math.max(0, this.gateClosedTimer - clampedDt);
    }

    // Item box spawning (7-9s normal, faster during Fever)
    this.itemSpawnTimer -= clampedDt * (this.feverActive ? 2.0 : 1.0);
    if (this.itemSpawnTimer <= 0) {
      this.spawnRandomItemBox();
      this.itemSpawnTimer = 7 + Math.random() * 2;
    }

    // Sudden events (every ~25s)
    if (this.enableEvents) {
      if (this.activeEvent) {
        this.activeEvent.timer -= clampedDt;
        if (this.activeEvent.timer <= 0) {
          this.activeEvent = null;
        }
      } else {
        this.eventCooldown -= clampedDt;
        if (this.eventCooldown <= 0 && this.timeLeft > 8) {
          this.triggerSuddenEvent();
          this.eventCooldown = 25;
        }
      }
    }

    // Last 30s Poison Zone shrinking
    if (this.enablePoison && this.timeLeft <= 30) {
      const progress = 1 - this.timeLeft / 30;
      const minRadius = TILE_SIZE * 3.5;
      this.poisonRadius = this.maxWorldRadius - (this.maxWorldRadius - minRadius) * progress;
    }

    // Update players
    for (const p of this.players) {
      this.updatePlayer(p, clampedDt);
    }

    // Update Decoys
    this.updateDecoys(clampedDt);

    // Update Projectiles
    this.updateProjectiles(clampedDt);

    // Update Traps
    this.updateTraps(clampedDt);

    // Update Smokes, Footprints, Particles, Texts
    this.smokes = this.smokes.filter((s) => { s.timer -= clampedDt; return s.timer > 0; });
    this.footprints = this.footprints.filter((f) => { f.life -= clampedDt; return f.life > 0; });
    this.floatingTexts = this.floatingTexts.filter((ft) => {
      ft.life -= clampedDt;
      ft.y -= 28 * clampedDt;
      return ft.life > 0;
    });
    this.particles = this.particles.filter((pt) => {
      pt.life -= clampedDt;
      pt.x += pt.vx * clampedDt;
      pt.y += pt.vy * clampedDt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
      return pt.life > 0;
    });

    // Check catches & mode objectives
    this.resolvePlayerInteractions(clampedDt);
    this.checkWinConditions();
  }

  triggerSuddenEvent() {
    const ev = SUDDEN_EVENTS[Math.floor(Math.random() * SUDDEN_EVENTS.length)];
    const dur = 8 + Math.random() * 2;
    let windX = 0;
    let windY = 0;
    if (ev.id === 'wind') {
      const ang = Math.random() * Math.PI * 2;
      windX = Math.cos(ang) * 95;
      windY = Math.sin(ang) * 95;
    }
    this.activeEvent = { ...ev, timer: dur, windX, windY };
    this.triggerBanner(`${ev.icon} 突發事件：${ev.name} — ${ev.desc}`, 3.5);
    if (this.isHost) audio.playEvent();

    if (ev.id === 'item_rain') {
      for (let i = 0; i < 10; i++) {
        this.spawnRandomItemBox(this.getRandomWalkablePos());
      }
      this.activeEvent.timer = 4.0;
    }
  }

  updatePlayer(p, dt) {
    if (p.emoteTimer > 0) {
      p.emoteTimer = Math.max(0, p.emoteTimer - dt);
      if (p.emoteTimer === 0) p.emote = null;
    }
    if (p.specCooldown > 0) p.specCooldown = Math.max(0, p.specCooldown - dt);

    // Handle emote input even when caught/spectating
    if (p.input.emote) {
      p.emote = p.input.emote;
      p.emoteTimer = 2.2;
      p.input.emote = null;
      if (p.id === this.localId) audio.playEmote();
    }

    if (p.caught || p.caged || p.escaped) return;

    // AI compute
    if (p.isAI) {
      const aiIn = computeAIInput(this, p, dt);
      p.input.dx = aiIn.dx;
      p.input.dy = aiIn.dy;
      if (aiIn.dash) p.input.dash = true;
      if (aiIn.useItem) p.input.useItem = true;
    }

    // Tick timers
    const timers = [
      'invulnTimer', 'dashCooldown', 'dashTimer', 'lungeTimer', 'staggerTimer',
      'speedBoostTimer', 'megaphoneBoostTimer', 'rocketTimer', 'pogoTimer',
      'slipTimer', 'freezeTimer', 'trapTimer', 'knockTimer', 'blindTimer',
      'confuseTimer', 'inkTimer', 'disguiseTimer', 'cloakTimer', 'radarTimer',
      'teleportCooldown', 'footprintTimer',
    ];
    for (const k of timers) {
      if (p[k] > 0) p[k] = Math.max(0, p[k] - dt);
    }

    // Lunge miss stagger check
    if (p.lungeTimer === 0 && p._wasLunging) {
      p._wasLunging = false;
      if (!p.lungeDidHit) {
        p.staggerTimer = PLAYER_BASE.LUNGE_MISS_STAGGER;
        this.addFloatText(p.x, p.y - 24, '撲空硬直!', '#f87171');
      }
    }
    if (p.lungeTimer > 0) p._wasLunging = true;

    // Swap item slot (Q)
    if (p.input.swapSlot) {
      p.input.swapSlot = false;
      if (p.items.length > 1) {
        p.activeSlot = (p.activeSlot + 1) % p.items.length;
      }
    }

    // Use item (Space / Click)
    if (p.input.useItem) {
      p.input.useItem = false;
      this.activateHeldItem(p);
    }

    // Dash / Lunge (Shift)
    if (p.input.dash) {
      p.input.dash = false;
      if (p.dashCooldown <= 0 && p.freezeTimer <= 0 && p.trapTimer <= 0 && p.staggerTimer <= 0) {
        p.dashCooldown = p.dashMaxCooldown;
        if (p.role === 'runner') {
          p.dashTimer = PLAYER_BASE.DASH_DURATION;
          this.addParticles(p.x, p.y, '#93c5fd', 8, 120, 0.35);
          if (p.id === this.localId) audio.playDash();
        } else {
          p.lungeTimer = PLAYER_BASE.LUNGE_DURATION;
          p.lungeDidHit = false;
          this.addParticles(p.x, p.y, '#fca5a5', 8, 120, 0.35);
          if (p.id === this.localId) audio.playLunge();
        }
      }
    }

    // Movement calculation
    const frozen = p.freezeTimer > 0 || p.trapTimer > 0;
    let inX = p.input.dx || 0;
    let inY = p.input.dy || 0;
    const inLen = Math.hypot(inX, inY);
    if (inLen > 1) { inX /= inLen; inY /= inLen; }

    if (p.confuseTimer > 0) {
      inX = -inX;
      inY = -inY;
    }

    if (inLen > 0.05 && !frozen && p.slipTimer <= 0 && p.rocketTimer <= 0) {
      p.dirX = inX / (inLen > 1 ? 1 : inLen);
      p.dirY = inY / (inLen > 1 ? 1 : inLen);
      const dLen = Math.hypot(p.dirX, p.dirY) || 1;
      p.dirX /= dLen;
      p.dirY /= dLen;
    }

    let speed = p.role === 'chaser' ? PLAYER_BASE.CHASER_SPEED : PLAYER_BASE.RUNNER_SPEED;
    if (p.role === 'chaser' && this.feverActive) speed *= 1.1;
    if (p.speedBoostTimer > 0) speed *= 1.45;
    if (p.megaphoneBoostTimer > 0) speed *= 1.25;
    if (p.staggerTimer > 0) speed *= 0.4;
    if (p.dashTimer > 0) speed *= 2.15;
    if (p.lungeTimer > 0) speed *= 1.65;
    if (this.chaosSpeedTimer > 0) speed *= 1.2;
    if (this.activeEvent?.id === 'double_speed') speed *= 2.0;
    if (this.slowmoTimer > 0 && this.slowmoImmuneId !== p.id) speed *= 0.45;

    const tile = this.getTileAt(p.x, p.y);
    if (tile === TILE.BUSH) {
      speed *= p.perk === 'nightwalker' ? 1.15 : 0.85;
    }

    // Slime puddle slow
    const inSlime = this.traps.some((tr) => tr.type === 'slime' && Math.hypot(tr.x - p.x, tr.y - p.y) < tr.radius);
    if (inSlime) speed *= 0.5;

    // Poison outside slow & alert
    const distCenter = Math.hypot(p.x - this.worldW / 2, p.y - this.worldH / 2);
    if (this.enablePoison && this.timeLeft <= 30 && distCenter > this.poisonRadius) {
      speed *= 0.65;
      p.poisonOutsideTimer += dt;
      if (p.poisonOutsideTimer > 2.2) {
        p.poisonOutsideTimer = 0;
        p.radarTimer = Math.max(p.radarTimer, 0);
        // Push gently toward center
        const cx = (this.worldW / 2 - p.x) / (distCenter || 1);
        const cy = (this.worldH / 2 - p.y) / (distCenter || 1);
        p.knockVx = cx * 260;
        p.knockVy = cy * 260;
        p.knockTimer = 0.28;
        this.addFloatText(p.x, p.y - 26, '☠️ 毒圈灼傷!', '#ef4444');
      }
    } else {
      p.poisonOutsideTimer = 0;
    }

    let targetVx = inX * speed;
    let targetVy = inY * speed;

    if (frozen) {
      targetVx = 0;
      targetVy = 0;
    } else if (p.rocketTimer > 0) {
      targetVx = p.rocketDirX * speed * 2.35;
      targetVy = p.rocketDirY * speed * 2.35;
    } else if (p.slipTimer > 0) {
      // Spin and slide uncontrollably
      const spinAng = p.slipTimer * 14;
      targetVx = Math.cos(spinAng) * speed * 1.15;
      targetVy = Math.sin(spinAng) * speed * 1.15;
    }

    if (p.knockTimer > 0) {
      targetVx += p.knockVx;
      targetVy += p.knockVy;
    }

    // Conveyor / Boost strip push
    const boostSpeed = 165;
    if (tile === TILE.BOOST_R) targetVx += boostSpeed;
    else if (tile === TILE.BOOST_L) targetVx -= boostSpeed;
    else if (tile === TILE.BOOST_U) targetVy -= boostSpeed;
    else if (tile === TILE.BOOST_D) targetVy += boostSpeed;

    // Sudden Event: Strong Wind
    if (this.activeEvent?.id === 'wind') {
      targetVx += this.activeEvent.windX;
      targetVy += this.activeEvent.windY;
    }

    // Ice inertia vs crisp floor grip
    if (tile === TILE.ICE && p.rocketTimer <= 0 && p.knockTimer <= 0) {
      const blend = Math.min(1, dt * 3.6);
      p.vx += (targetVx - p.vx) * blend;
      p.vy += (targetVy - p.vy) * blend;
    } else {
      p.vx = targetVx;
      p.vy = targetVy;
    }

    // Move & resolve wall collision
    const prevX = p.x;
    const prevY = p.y;
    this.moveEntityWithCollision(p, p.vx * dt, p.vy * dt);
    const moved = Math.hypot(p.x - prevX, p.y - prevY);
    p.stats.distanceMoved += moved;
    if (moved > 0.3) p.walkCycle += moved * 0.14;

    // Trail history
    if (p.cloakTimer <= 0 && p.disguiseTimer <= 0) {
      if (moved > 0.8 || p.dashTimer > 0 || p.speedBoostTimer > 0 || p.rocketTimer > 0) {
        p.trailPoints.push({ x: p.x, y: p.y, life: 0.3 });
        if (p.trailPoints.length > 14) p.trailPoints.shift();
      }
    }
    p.trailPoints = p.trailPoints.filter((tp) => { tp.life -= dt; return tp.life > 0; });

    // Water puddles -> wet footprints for 3s
    const newTile = this.getTileAt(p.x, p.y);
    if (newTile === TILE.WATER) {
      p.footprintTimer = 3.0;
    }
    if (p.footprintTimer > 0 && moved > 1.2) {
      p._fpAccum = (p._fpAccum || 0) + moved;
      if (p._fpAccum >= 22) {
        p._fpAccum = 0;
        this.footprints.push({ x: p.x, y: p.y, ang: Math.atan2(p.dirY, p.dirX), life: 3.0 });
      }
    }

    // Switch trigger -> close electric gates 4s
    if (newTile === TILE.SWITCH && this.gateClosedTimer <= 0) {
      this.gateClosedTimer = 4.0;
      this.triggerBanner('🚪 電動閘門啟動！通道封鎖 4 秒！', 2.2);
      audio.playGate();
    }

    // Teleporter pads
    if ((newTile === TILE.TELEPORT_A || newTile === TILE.TELEPORT_B) && p.teleportCooldown <= 0) {
      const destList = newTile === TILE.TELEPORT_A ? this.teleportsB : this.teleportsA;
      if (destList.length > 0) {
        const dest = destList[Math.floor(Math.random() * destList.length)];
        this.addParticles(p.x, p.y, '#c084fc', 12, 150, 0.4);
        p.x = dest.x;
        p.y = dest.y;
        p.teleportCooldown = 5.0;
        this.addParticles(p.x, p.y, '#c084fc', 12, 150, 0.4);
        if (p.id === this.localId) audio.playTeleport();
      }
    }

    // Pick up Item Boxes
    for (let i = this.itemBoxes.length - 1; i >= 0; i--) {
      const b = this.itemBoxes[i];
      if (Math.hypot(b.x - p.x, b.y - p.y) < p.radius + 18) {
        if (p.items.length < p.maxItems) {
          const itemId = this.rollRandomItem(p);
          p.items.push(itemId);
          this.itemBoxes.splice(i, 1);
          const meta = ITEM_BY_ID[itemId];
          this.addFloatText(p.x, p.y - 24, `${meta.icon} ${meta.name}`, '#fde047');
          this.addParticles(b.x, b.y, '#fde047', 10, 110, 0.35);
          if (p.id === this.localId) audio.playPickup();
        }
      }
    }

    // Escape Mode: Pick up Golden Keys & Enter Escape Gate
    if (this.mode === 'escape' && p.role === 'runner') {
      for (let i = this.keys.length - 1; i >= 0; i--) {
        const k = this.keys[i];
        if (Math.hypot(k.x - p.x, k.y - p.y) < p.radius + 18) {
          this.keys.splice(i, 1);
          this.keysCollected++;
          audio.playKey();
          this.addParticles(k.x, k.y, '#facc15', 16, 160, 0.5);
          if (this.keysCollected >= 3) {
            this.escapeGateOpen = true;
            this.triggerBanner('🔑 3 把鑰匙全數集齊！逃生大門已開啟！快衝！', 4.0);
          } else {
            this.triggerBanner(`🔑 已找到鑰匙 (${this.keysCollected}/3)！`, 2.5);
          }
        }
      }
      if (this.escapeGateOpen && this.escapeGatePos) {
        if (Math.hypot(p.x - this.escapeGatePos.x, p.y - this.escapeGatePos.y) < p.radius + 26) {
          p.escaped = true;
          p.stats.escapes++;
          this.addFloatText(p.x, p.y - 24, '🎉 成功逃脫!', '#4ade80');
          audio.playWin();
        }
      }
    }

    // Rescue Mode: Touch center Prison Cage to free caged teammates
    if (this.mode === 'rescue' && p.role === 'runner' && this.prisonPos) {
      if (Math.hypot(p.x - this.prisonPos.x, p.y - this.prisonPos.y) < p.radius + 32) {
        const cagedOnes = this.players.filter((o) => o.caged);
        if (cagedOnes.length > 0) {
          for (const ally of cagedOnes) {
            ally.caged = false;
            ally.invulnTimer = 2.0;
            this.addParticles(ally.x, ally.y, '#4ade80', 12, 140, 0.45);
          }
          p.stats.rescues += cagedOnes.length;
          this.triggerBanner(`🤝 ${p.name} 劫獄成功！救出 ${cagedOnes.length} 名隊友！`, 3.0);
          audio.playKey();
        }
      }
    }
  }

  moveEntityWithCollision(p, dx, dy) {
    const canJump = p.pogoTimer > 0;
    const isDashing = p.dashTimer > 0 || p.lungeTimer > 0 || p.rocketTimer > 0;

    // X axis
    let nx = p.x + dx;
    if (this.collidesAt(nx, p.y, p.radius, canJump, isDashing, p)) {
      if (p.rocketTimer > 0 && p.rocketBounces > 0) {
        p.rocketDirX = -p.rocketDirX;
        p.rocketBounces--;
      }
    } else {
      p.x = nx;
    }

    // Y axis
    let ny = p.y + dy;
    if (this.collidesAt(p.x, ny, p.radius, canJump, isDashing, p)) {
      if (p.rocketTimer > 0 && p.rocketBounces > 0) {
        p.rocketDirY = -p.rocketDirY;
        p.rocketBounces--;
      }
    } else {
      p.y = ny;
    }
  }

  collidesAt(wx, wy, r, canJump, isDashing, actor) {
    const minTx = Math.floor((wx - r) / TILE_SIZE);
    const maxTx = Math.floor((wx + r) / TILE_SIZE);
    const minTy = Math.floor((wy - r) / TILE_SIZE);
    const maxTy = Math.floor((wy + r) / TILE_SIZE);

    for (let ty = minTy; ty <= maxTy; ty++) {
      for (let tx = minTx; tx <= maxTx; tx++) {
        if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) return true;
        const t = this.grid[ty][tx];
        if (t === TILE.CRATE && isDashing && !canJump && actor) {
          // Smash crate!
          this.grid[ty][tx] = TILE.FLOOR;
          const cx = (tx + 0.5) * TILE_SIZE;
          const cy = (ty + 0.5) * TILE_SIZE;
          this.addParticles(cx, cy, '#d97706', 14, 150, 0.45);
          audio.playCrateBreak();
          if (Math.random() < 0.45) {
            this.spawnRandomItemBox({ x: cx, y: cy });
          }
          continue;
        }
        if (this.isTileBlocking(tx, ty, canJump)) {
          // Circle vs AABB check
          const rx = tx * TILE_SIZE;
          const ry = ty * TILE_SIZE;
          const nearX = Math.max(rx, Math.min(wx, rx + TILE_SIZE));
          const nearY = Math.max(ry, Math.min(wy, ry + TILE_SIZE));
          if (Math.hypot(wx - nearX, wy - nearY) < r) {
            return true;
          }
        }
      }
    }
    return false;
  }

  activateHeldItem(p) {
    if (p.items.length === 0) return;
    if (p.activeSlot >= p.items.length) p.activeSlot = 0;
    const itemId = p.items.splice(p.activeSlot, 1)[0];
    if (p.activeSlot >= p.items.length) p.activeSlot = 0;

    p.stats.itemsUsed++;
    const meta = ITEM_BY_ID[itemId];
    this.addFloatText(p.x, p.y - 28, `${meta.icon} ${meta.name}!`, '#38bdf8');

    // Perk: 📣 大嗓門 (Megaphone) — buff nearby teammates 1.5s
    if (p.perk === 'megaphone') {
      this.applyMegaphoneBuff(p);
    }

    const trapMul = p.perk === 'trapper' ? 1.3 : 1.0;

    switch (itemId) {
      case 'turbo':
        p.speedBoostTimer = 3.5;
        audio.playDash();
        break;

      case 'blink': {
        // Blink forward up to 3.2 tiles, skipping thin walls
        let bx = p.x;
        let by = p.y;
        const maxDist = TILE_SIZE * 3.2;
        for (let d = maxDist; d >= TILE_SIZE * 0.6; d -= 14) {
          const tx = p.x + p.dirX * d;
          const ty = p.y + p.dirY * d;
          if (!this.collidesAt(tx, ty, p.radius + 2, false, false, null)) {
            bx = tx;
            by = ty;
            break;
          }
        }
        this.addParticles(p.x, p.y, '#a855f7', 12, 130, 0.35);
        p.x = bx;
        p.y = by;
        this.addParticles(p.x, p.y, '#a855f7', 14, 150, 0.4);
        audio.playTeleport();
        break;
      }

      case 'rocket':
        p.rocketTimer = 1.2;
        p.rocketDirX = p.dirX;
        p.rocketDirY = p.dirY;
        p.rocketBounces = 1;
        audio.playDash();
        break;

      case 'swap': {
        const others = this.players.filter((o) => o.id !== p.id && !o.caught && !o.caged && !o.escaped);
        if (others.length > 0) {
          const target = others[Math.floor(Math.random() * others.length)];
          const ox = p.x;
          const oy = p.y;
          p.x = target.x;
          p.y = target.y;
          target.x = ox;
          target.y = oy;
          p.invulnTimer = Math.max(p.invulnTimer, 1.0);
          target.invulnTimer = Math.max(target.invulnTimer, 1.0);
          this.addParticles(p.x, p.y, '#f472b6', 14, 150, 0.45);
          this.addParticles(target.x, target.y, '#f472b6', 14, 150, 0.45);
          this.addFloatText(target.x, target.y - 24, '🔀 空間交換!', '#f472b6');
          audio.playTeleport();
        }
        break;
      }

      case 'pogo':
        p.pogoTimer = 4.0;
        audio.playBounce();
        break;

      case 'banana':
        this.traps.push({
          id: this.uid(), type: 'banana', x: p.x, y: p.y,
          ownerId: p.id, ownerRole: p.role, ownerPerk: p.perk,
          radius: 18 * trapMul, life: 25,
        });
        break;

      case 'freeze_mine':
        this.traps.push({
          id: this.uid(), type: 'freeze_mine', x: p.x, y: p.y,
          ownerId: p.id, ownerRole: p.role, ownerPerk: p.perk,
          radius: 21 * trapMul, life: 25,
        });
        break;

      case 'slime':
        this.projectiles.push({
          id: this.uid(), type: 'slime_jar', x: p.x, y: p.y,
          vx: p.dirX * 380, vy: p.dirY * 380,
          ownerId: p.id, ownerRole: p.role, ownerPerk: p.perk,
          life: 0.4, trapMul,
        });
        break;

      case 'bear_trap':
        this.traps.push({
          id: this.uid(), type: 'bear_trap', x: p.x, y: p.y,
          ownerId: p.id, ownerRole: p.role, ownerPerk: p.perk,
          radius: 19 * trapMul, life: 30,
        });
        break;

      case 'bounce_mine':
        this.traps.push({
          id: this.uid(), type: 'bounce_mine', x: p.x, y: p.y,
          ownerId: p.id, ownerRole: p.role, ownerPerk: p.perk,
          radius: 22 * trapMul, life: 25,
        });
        break;

      case 'smoke':
        this.smokes.push({ id: this.uid(), x: p.x, y: p.y, radius: 135, timer: 4.5 });
        audio.playSmoke();
        break;

      case 'flashbang':
        this.projectiles.push({
          id: this.uid(), type: 'flashbang', x: p.x, y: p.y,
          vx: p.dirX * 220, vy: p.dirY * 220,
          ownerId: p.id, ownerRole: p.role,
          life: 0.8,
        });
        break;

      case 'confusion':
        this.projectiles.push({
          id: this.uid(), type: 'confusion_orb', x: p.x, y: p.y,
          vx: p.dirX * 420, vy: p.dirY * 420,
          ownerId: p.id, ownerRole: p.role,
          life: 1.1,
        });
        break;

      case 'ink': {
        let nearest = null;
        let best = Infinity;
        for (const o of this.players) {
          if (!this.areOpponents(p, o) || o.caught || o.caged || o.escaped) continue;
          const d = Math.hypot(o.x - p.x, o.y - p.y);
          if (d < best) { best = d; nearest = o; }
        }
        if (nearest) {
          nearest.inkTimer = 3.5;
          this.addFloatText(nearest.x, nearest.y - 24, '🦑 墨水遮眼!', '#1e293b');
          this.addParticles(nearest.x, nearest.y, '#0f172a', 14, 120, 0.4);
          audio.playSmoke();
        }
        break;
      }

      case 'decoy':
        this.decoys.push({
          id: this.uid(), x: p.x, y: p.y,
          vx: p.dirX * 200, vy: p.dirY * 200,
          color: p.color, colorDark: p.colorDark, hat: p.hat, name: p.name,
          role: p.role, ownerId: p.id, radius: p.radius, life: 5.0,
        });
        break;

      case 'disguise':
        p.disguiseTimer = 5.0;
        p.disguiseType = Math.random() < 0.5 ? 'crate' : 'box';
        break;

      case 'shield':
        p.shieldActive = true;
        audio.playShield();
        break;

      case 'cloak':
        p.cloakTimer = 3.5;
        this.addParticles(p.x, p.y, '#cbd5e1', 10, 90, 0.35);
        break;

      case 'radar':
        p.radarTimer = 5.0;
        audio.playEvent();
        break;

      case 'magnet':
        if (p.role === 'chaser') {
          for (const o of this.players) {
            if (!this.areOpponents(p, o) || o.caught || o.caged || o.escaped) continue;
            const dx = o.x - p.x;
            const dy = o.y - p.y;
            const d = Math.hypot(dx, dy);
            if (d > 10 && d < 320) {
              o.knockVx = -(dx / d) * 340;
              o.knockVy = -(dy / d) * 340;
              o.knockTimer = 0.32;
            }
          }
        } else {
          // Runner pushes chasers away + pulls nearest item box
          for (const o of this.players) {
            if (!this.areOpponents(p, o) || o.caught) continue;
            const dx = o.x - p.x;
            const dy = o.y - p.y;
            const d = Math.hypot(dx, dy);
            if (d > 10 && d < 260) {
              o.knockVx = (dx / d) * 360;
              o.knockVy = (dy / d) * 360;
              o.knockTimer = 0.32;
            }
          }
          let nearestBox = null;
          let bd = 380;
          for (const b of this.itemBoxes) {
            const d = Math.hypot(b.x - p.x, b.y - p.y);
            if (d < bd) { bd = d; nearestBox = b; }
          }
          if (nearestBox) {
            nearestBox.x = p.x;
            nearestBox.y = p.y;
          }
        }
        audio.playTeleport();
        break;

      case 'slowmo':
        this.slowmoTimer = 2.5;
        this.slowmoImmuneId = p.id;
        this.triggerBanner(`⏳ ${p.name} 啟動時間減速器！全場慢動作 2.5 秒！`, 2.5);
        audio.playEvent();
        break;

      case 'chaos_bell':
        for (let i = 0; i < 5; i++) this.spawnRandomItemBox(this.getRandomWalkablePos());
        this.chaosSpeedTimer = 6.0;
        this.triggerBanner('🔔 狂暴亂鬥鐘！刷新 5 個道具箱＋全場移速 +20%！', 3.0);
        audio.playEvent();
        break;
    }
  }

  applyMegaphoneBuff(source) {
    for (const o of this.players) {
      if (o.id !== source.id && o.role === source.role && !o.caught && !o.caged) {
        if (Math.hypot(o.x - source.x, o.y - source.y) < 280) {
          o.megaphoneBoostTimer = 1.5;
          this.addFloatText(o.x, o.y - 22, '📣 隊友加速!', '#60a5fa');
        }
      }
    }
  }

  updateDecoys(dt) {
    for (let i = this.decoys.length - 1; i >= 0; i--) {
      const d = this.decoys[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.addParticles(d.x, d.y, '#cbd5e1', 8, 90, 0.3);
        this.decoys.splice(i, 1);
        continue;
      }
      if (this.collidesAt(d.x + d.vx * dt, d.y, d.radius, false, false, null)) d.vx = -d.vx;
      else d.x += d.vx * dt;
      if (this.collidesAt(d.x, d.y + d.vy * dt, d.radius, false, false, null)) d.vy = -d.vy;
      else d.y += d.vy * dt;

      // Pop if touched by opponent
      const hit = this.players.some((p) => p.id !== d.ownerId && !p.caught && Math.hypot(p.x - d.x, p.y - d.y) < p.radius + d.radius);
      if (hit) {
        this.addFloatText(d.x, d.y - 22, '🎭 假的啦!', '#f472b6');
        this.addParticles(d.x, d.y, '#f472b6', 14, 150, 0.4);
        this.decoys.splice(i, 1);
      }
    }
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;

      const nx = pr.x + pr.vx * dt;
      const ny = pr.y + pr.vy * dt;
      if (this.collidesAt(nx, ny, 8, false, false, null)) {
        pr.vx = 0;
        pr.vy = 0;
        if (pr.type === 'slime_jar' || pr.type === 'confusion_orb') pr.life = 0;
      } else {
        pr.x = nx;
        pr.y = ny;
      }

      // Direct hit check for confusion orb
      if (pr.type === 'confusion_orb') {
        for (const o of this.players) {
          if (o.id !== pr.ownerId && o.role !== pr.ownerRole && !o.caught && !o.caged) {
            if (Math.hypot(o.x - pr.x, o.y - pr.y) < o.radius + 14) {
              if (o.role === 'chaser' && o.shieldActive) {
                o.shieldActive = false;
                this.addFloatText(o.x, o.y - 24, '🛡️ 護盾抵銷!', '#60a5fa');
                audio.playShield();
              } else {
                o.confuseTimer = 3.5;
                this.addFloatText(o.x, o.y - 24, '😵 方向顛倒!', '#c084fc');
              }
              pr.life = 0;
              break;
            }
          }
        }
      }

      if (pr.life <= 0) {
        if (pr.type === 'slime_jar') {
          this.traps.push({
            id: this.uid(), type: 'slime', x: pr.x, y: pr.y,
            ownerId: pr.ownerId, ownerRole: pr.ownerRole,
            radius: 56 * (pr.trapMul || 1), life: 5.0,
          });
        } else if (pr.type === 'flashbang') {
          audio.playFlashbang();
          this.addParticles(pr.x, pr.y, '#ffffff', 24, 220, 0.5);
          for (const o of this.players) {
            if (o.id !== pr.ownerId && !o.caught && !o.caged && Math.hypot(o.x - pr.x, o.y - pr.y) < 240) {
              if (o.role === 'chaser' && o.shieldActive) {
                o.shieldActive = false;
                this.addFloatText(o.x, o.y - 24, '🛡️ 護盾抵銷!', '#60a5fa');
              } else {
                o.blindTimer = 2.0;
              }
            }
          }
        }
        this.projectiles.splice(i, 1);
      }
    }
  }

  updateTraps(dt) {
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const tr = this.traps[i];
      tr.life -= dt;
      if (tr.life <= 0) {
        this.traps.splice(i, 1);
        continue;
      }
      if (tr.type === 'slime') continue; // Continuous slow handled in updatePlayer

      for (const p of this.players) {
        if (p.caught || p.caged || p.escaped || p.pogoTimer > 0) continue;
        if (p.id === tr.ownerId) continue;
        if (tr.ownerPerk === 'trapper' && p.role === tr.ownerRole) continue;

        if (Math.hypot(p.x - tr.x, p.y - tr.y) < p.radius + tr.radius) {
          p.stats.trapsStepped++;
          if (p.role === 'chaser' && p.shieldActive) {
            p.shieldActive = false;
            this.addFloatText(p.x, p.y - 24, '🛡️ 免疫陷阱!', '#60a5fa');
            audio.playShield();
            this.traps.splice(i, 1);
            break;
          }

          if (tr.type === 'banana') {
            p.slipTimer = 1.5;
            this.addFloatText(p.x, p.y - 24, '🍌 滑倒啦!', '#facc15');
            audio.playSlip();
          } else if (tr.type === 'freeze_mine') {
            p.freezeTimer = 1.8;
            this.addFloatText(p.x, p.y - 24, '❄️ 結冰定身!', '#7dd3fc');
            audio.playFreeze();
          } else if (tr.type === 'bear_trap') {
            p.trapTimer = 2.0;
            this.addFloatText(p.x, p.y - 24, '🪤 喀嚓夾住!', '#ef4444');
            this.triggerBanner(`🪤 喀嚓！${p.name} 踩中了捕獸夾！`, 2.0);
            audio.playSnap();
          } else if (tr.type === 'bounce_mine') {
            const dx = p.x - tr.x;
            const dy = p.y - tr.y;
            const d = Math.hypot(dx, dy) || 1;
            p.knockVx = (dx / d) * 520;
            p.knockVy = (dy / d) * 520;
            p.knockTimer = 0.42;
            this.addFloatText(p.x, p.y - 24, '💥 彈飛!', '#fb923c');
            this.addParticles(tr.x, tr.y, '#fb923c', 16, 180, 0.45);
            audio.playBounce();
          }

          this.traps.splice(i, 1);
          break;
        }
      }
    }
  }

  resolvePlayerInteractions(dt) {
    const chasers = this.players.filter((p) => p.role === 'chaser' && !p.caught);
    const runners = this.players.filter((p) => p.role === 'runner' && !p.caught && !p.caged && !p.escaped);

    for (const c of chasers) {
      if (c.freezeTimer > 0 || c.trapTimer > 0 || c.invulnTimer > 0) continue;
      for (const r of runners) {
        if (r.invulnTimer > 0 || r.dashTimer > 0) {
          // Track close calls for podium award!
          if (Math.hypot(c.x - r.x, c.y - r.y) < 55) r.stats.closeCalls += dt;
          continue;
        }
        const catchDist = c.radius + r.radius + PLAYER_BASE.CATCH_DISTANCE_PAD + (c.lungeTimer > 0 ? PLAYER_BASE.LUNGE_BONUS_RADIUS : 0);
        const dist = Math.hypot(c.x - r.x, c.y - r.y);
        if (dist <= catchDist) {
          c.lungeDidHit = true;

          // Runner Bubble Shield blocks catch!
          if (r.shieldActive) {
            r.shieldActive = false;
            r.speedBoostTimer = Math.max(r.speedBoostTimer, 1.5);
            r.invulnTimer = 0.8;
            const dx = c.x - r.x;
            const dy = c.y - r.y;
            const d = Math.hypot(dx, dy) || 1;
            c.knockVx = (dx / d) * 500;
            c.knockVy = (dy / d) * 500;
            c.knockTimer = 0.4;
            this.addFloatText(r.x, r.y - 26, '🛡️ 護盾反彈!', '#60a5fa');
            this.addParticles(r.x, r.y, '#60a5fa', 16, 170, 0.45);
            audio.playShield();
            continue;
          }

          // Megaphone perk when caught
          if (r.perk === 'megaphone') this.applyMegaphoneBuff(r);

          c.stats.catches++;
          r.stats.caughtCount++;
          audio.playCatch();
          this.addParticles(r.x, r.y, '#ef4444', 18, 180, 0.5);

          if (this.mode === 'classic' || this.mode === 'escape') {
            r.caught = true;
            this.triggerBanner(`👹 ${c.name} 抓到了 ${r.name}！`, 2.2);
          } else if (this.mode === 'infection') {
            r.role = 'chaser';
            r.radius = PLAYER_BASE.CHASER_RADIUS;
            r.invulnTimer = 1.5;
            this.triggerBanner(`🦠 ${r.name} 受到感染，變成追逐者啦！`, 2.5);
          } else if (this.mode === 'hot_potato') {
            c.role = 'runner';
            c.radius = PLAYER_BASE.RUNNER_RADIUS;
            c.invulnTimer = 2.0;
            r.role = 'chaser';
            r.radius = PLAYER_BASE.CHASER_RADIUS;
            r.invulnTimer = 2.0;
            this.triggerBanner(`🔥 身分互換！現在 ${r.name} 是鬼！`, 2.5);
          } else if (this.mode === 'rescue') {
            r.caged = true;
            r.x = this.prisonPos.x;
            r.y = this.prisonPos.y;
            this.triggerBanner(`🤝 ${r.name} 被關進中央牢籠！快去救人！`, 2.5);
          }
        } else if (dist < 75) {
          r.stats.closeCalls += dt;
        }
      }
    }
  }

  // Spectator Chaos Skill (15s cooldown): Airdrop Banana or Smoke at target map coords
  useSpectatorSkill(playerId, skillType, wx, wy) {
    const p = this.players.find((x) => x.id === playerId);
    if (!p || !p.caught || p.specCooldown > 0) return false;
    const tx = Math.max(TILE_SIZE, Math.min(WORLD_W - TILE_SIZE, wx));
    const ty = Math.max(TILE_SIZE, Math.min(WORLD_H - TILE_SIZE, wy));
    p.specCooldown = 15.0;

    if (skillType === 'smoke') {
      this.smokes.push({ id: this.uid(), x: tx, y: ty, radius: 135, timer: 4.5 });
      this.addFloatText(tx, ty - 20, `👀 ${p.name} 空投煙霧彈!`, '#cbd5e1');
      audio.playSmoke();
    } else {
      this.traps.push({
        id: this.uid(), type: 'banana', x: tx, y: ty,
        ownerId: p.id, ownerRole: 'spectator', ownerPerk: 'none',
        radius: 22, life: 25,
      });
      this.addFloatText(tx, ty - 20, `👀 ${p.name} 空投香蕉皮!`, '#fde047');
      audio.playPickup();
    }
    return true;
  }

  checkWinConditions() {
    if (this.finished) return;

    const activeRunners = this.players.filter((p) => p.role === 'runner' && !p.caught && !p.caged && !p.escaped);
    const escapedRunners = this.players.filter((p) => p.escaped);

    if (this.mode === 'classic') {
      if (activeRunners.length === 0) {
        this.endMatch('chaser', '👹 追逐者全數抓捕成功！');
      } else if (this.timeLeft <= 0) {
        this.endMatch('runner', `🏃 逃跑者撐到最後（${activeRunners.length} 人存活）！`);
      }
    } else if (this.mode === 'infection') {
      if (activeRunners.length === 0) {
        this.endMatch('chaser', '🦠 全員感染！感染陣營大獲全勝！');
      } else if (this.timeLeft <= 0) {
        this.endMatch('runner', `🏆 倖存者奇蹟存活（${activeRunners.map((r) => r.name).join('、')}）！`);
      }
    } else if (this.mode === 'hot_potato') {
      if (this.timeLeft <= 0) {
        const chasers = this.players.filter((p) => p.role === 'chaser').map((p) => p.name);
        this.endMatch('runner', `🔥 時間到！當鬼的「${chasers.join('、')}」輸掉啦！`);
      }
    } else if (this.mode === 'rescue') {
      if (activeRunners.length === 0) {
        this.endMatch('chaser', '⛓️ 所有逃跑者都被關進牢籠了！');
      } else if (this.timeLeft <= 0) {
        this.endMatch('runner', '🤝 逃跑者成功守住自由！');
      }
    } else if (this.mode === 'escape') {
      if (this.escapeGateOpen && escapedRunners.length > 0 && activeRunners.length === 0) {
        this.endMatch('runner', `🔑 ${escapedRunners.map((r) => r.name).join('、')} 成功集齊鑰匙逃出生天！`);
      } else if (activeRunners.length === 0 && escapedRunners.length === 0) {
        this.endMatch('chaser', '👹 追逐者攔截了所有逃跑者！');
      } else if (this.timeLeft <= 0) {
        if (escapedRunners.length > 0) {
          this.endMatch('runner', `🔑 ${escapedRunners.map((r) => r.name).join('、')} 成功逃脫獲勝！`);
        } else {
          this.endMatch('chaser', '⏱ 時間歸零！未能集齊鑰匙逃脫，追逐者獲勝！');
        }
      }
    }
  }

  endMatch(winner, text) {
    this.finished = true;
    this.winner = winner;
    this.winnerText = text;
    this.awards = this.computePodiumAwards();

    const local = this.players.find((p) => p.id === this.localId);
    if (local) {
      const won = (winner === 'chaser' && local.role === 'chaser') || (winner === 'runner' && (local.role === 'runner' || local.escaped));
      if (won) audio.playWin();
      else audio.playLose();
    }
  }

  computePodiumAwards() {
    if (this.players.length === 0) return [];
    const pickMax = (fn) => [...this.players].sort((a, b) => fn(b) - fn(a))[0];

    const awards = [];
    const mvpCatcher = pickMax((p) => p.stats.catches);
    if (mvpCatcher.stats.catches > 0) {
      awards.push({ title: '👹 獵殺機器', player: mvpCatcher.name, detail: `共抓捕 ${mvpCatcher.stats.catches} 次` });
    }
    const jukeKing = pickMax((p) => p.stats.closeCalls);
    awards.push({ title: '⚡ 極限走位王', player: jukeKing.name, detail: `驚險擦身糾纏 ${jukeKing.stats.closeCalls.toFixed(1)} 秒` });

    const trapVictim = pickMax((p) => p.stats.trapsStepped);
    if (trapVictim.stats.trapsStepped > 0) {
      awards.push({ title: '🍌 踩雷大師', player: trapVictim.name, detail: `踩中 ${trapVictim.stats.trapsStepped} 次陷阱` });
    }
    const itemThief = pickMax((p) => p.stats.itemsUsed);
    if (itemThief.stats.itemsUsed > 0) {
      awards.push({ title: '🎁 道具小偷', player: itemThief.name, detail: `狂用 ${itemThief.stats.itemsUsed} 個道具` });
    }
    const unlucky = pickMax((p) => p.stats.caughtCount + p.stats.trapsStepped);
    if (unlucky && awards.every((a) => a.player !== unlucky.name || awards.length < 3)) {
      awards.push({ title: '💀 全場最衰', player: unlucky.name, detail: `被抓 ${unlucky.stats.caughtCount} 次＋踩雷 ${unlucky.stats.trapsStepped} 次` });
    }
    return awards.slice(0, 4);
  }

  // Compact state snapshot for Host -> Client P2P sync (25Hz)
  exportSnapshot() {
    return {
      cd: Number(this.countdownTimer.toFixed(2)),
      t: Number(this.timeLeft.toFixed(2)),
      el: Number(this.elapsed.toFixed(2)),
      fin: this.finished,
      win: this.winner,
      wtxt: this.winnerText,
      aw: this.awards,
      gate: Number(this.gateClosedTimer.toFixed(2)),
      pr: Math.round(this.poisonRadius),
      fv: this.feverActive,
      sm: this.slowmoTimer > 0 ? this.slowmoImmuneId : null,
      cs: this.chaosSpeedTimer > 0,
      ev: this.activeEvent ? { id: this.activeEvent.id, name: this.activeEvent.name, icon: this.activeEvent.icon, desc: this.activeEvent.desc, timer: Number(this.activeEvent.timer.toFixed(1)) } : null,
      bn: this.bannerTimer > 0 ? this.bannerMsg : '',
      kc: this.keysCollected,
      ego: this.escapeGateOpen,
      keys: this.keys.map((k) => ({ id: k.id, x: Math.round(k.x), y: Math.round(k.y) })),
      boxes: this.itemBoxes.map((b) => ({ id: b.id, x: Math.round(b.x), y: Math.round(b.y) })),
      traps: this.traps.map((tr) => ({ id: tr.id, type: tr.type, x: Math.round(tr.x), y: Math.round(tr.y), r: Math.round(tr.radius), oid: tr.ownerId })),
      projs: this.projectiles.map((pr) => ({ id: pr.id, type: pr.type, x: Math.round(pr.x), y: Math.round(pr.y) })),
      smokes: this.smokes.map((s) => ({ id: s.id, x: Math.round(s.x), y: Math.round(s.y), r: s.radius })),
      decoys: this.decoys.map((d) => ({ id: d.id, x: Math.round(d.x), y: Math.round(d.y), c: d.color, cd: d.colorDark, h: d.hat, n: d.name, role: d.role })),
      fps: this.footprints.slice(-40).map((f) => ({ x: Math.round(f.x), y: Math.round(f.y), a: Number(f.ang.toFixed(2)) })),
      // Sync broken crates
      cratesGone: this._getBrokenCrates(),
      pl: this.players.map((p) => ({
        id: p.id,
        role: p.role,
        x: Number(p.x.toFixed(1)),
        y: Number(p.y.toFixed(1)),
        dx: Number(p.dirX.toFixed(2)),
        dy: Number(p.dirY.toFixed(2)),
        wc: Number(p.walkCycle.toFixed(2)),
        ca: p.caught,
        cg: p.caged,
        es: p.escaped,
        dc: Number(p.dashCooldown.toFixed(1)),
        sc: Number(p.specCooldown.toFixed(1)),
        it: p.items,
        as: p.activeSlot,
        em: p.emote,
        sh: p.shieldActive,
        cl: p.cloakTimer > 0,
        dg: p.disguiseTimer > 0 ? p.disguiseType : null,
        fr: p.freezeTimer > 0 || p.trapTimer > 0,
        sl: p.slipTimer > 0,
        cf: p.confuseTimer > 0,
        bl: p.blindTimer > 0,
        ik: p.inkTimer > 0,
        rd: p.radarTimer > 0,
        pg: p.pogoTimer > 0,
        sp: p.speedBoostTimer > 0 || p.megaphoneBoostTimer > 0 || p.dashTimer > 0 || p.rocketTimer > 0,
      })),
    };
  }

  _getBrokenCrates() {
    if (!this._initialCrates) {
      this._initialCrates = [];
      for (let y = 0; y < MAP_ROWS; y++) {
        for (let x = 0; x < MAP_COLS; x++) {
          if (this.grid[y][x] === TILE.CRATE) this._initialCrates.push([x, y]);
        }
      }
    }
    const gone = [];
    for (const [x, y] of this._initialCrates) {
      if (this.grid[y][x] !== TILE.CRATE) gone.push(y * MAP_COLS + x);
    }
    return gone;
  }

  applySnapshot(snap) {
    if (typeof snap.cd === 'number') this.countdownTimer = snap.cd;
    this.timeLeft = snap.t;
    this.elapsed = snap.el;
    this.finished = snap.fin;
    this.winner = snap.win;
    this.winnerText = snap.wtxt;
    this.awards = snap.aw || [];
    this.gateClosedTimer = snap.gate;
    this.poisonRadius = snap.pr;
    this.feverActive = snap.fv;
    this.slowmoImmuneId = snap.sm;
    this.slowmoTimer = snap.sm ? 1 : 0;
    this.chaosSpeedTimer = snap.cs ? 1 : 0;
    this.activeEvent = snap.ev;
    this.bannerMsg = snap.bn;
    this.bannerTimer = snap.bn ? 1 : 0;
    this.keysCollected = snap.kc;
    this.escapeGateOpen = snap.ego;
    this.keys = snap.keys || [];
    this.itemBoxes = (snap.boxes || []).map((b) => ({ ...b, bobPhase: 0 }));
    this.traps = (snap.traps || []).map((t) => ({ id: t.id, type: t.type, x: t.x, y: t.y, radius: t.r, ownerId: t.oid }));
    this.projectiles = snap.projs || [];
    this.smokes = (snap.smokes || []).map((s) => ({ id: s.id, x: s.x, y: s.y, radius: s.r }));
    this.decoys = (snap.decoys || []).map((d) => ({
      id: d.id, x: d.x, y: d.y, color: d.c, colorDark: d.cd, hat: d.h, name: d.n, role: d.role,
    }));
    this.footprints = (snap.fps || []).map((f) => ({ x: f.x, y: f.y, ang: f.a, life: 1.5 }));

    for (const idx of snap.cratesGone || []) {
      const cy = Math.floor(idx / MAP_COLS);
      const cx = idx % MAP_COLS;
      if (this.grid[cy]) this.grid[cy][cx] = TILE.FLOOR;
    }

    for (const sp of snap.pl || []) {
      const p = this.players.find((x) => x.id === sp.id);
      if (!p) continue;
      p.targetX = sp.x;
      p.targetY = sp.y;
      p.role = sp.role;
      p.radius = sp.role === 'chaser' ? PLAYER_BASE.CHASER_RADIUS : PLAYER_BASE.RUNNER_RADIUS;
      p.dirX = sp.dx;
      p.dirY = sp.dy;
      p.walkCycle = sp.wc;
      p.caught = sp.ca;
      p.caged = sp.cg;
      p.escaped = sp.es;
      p.dashCooldown = sp.dc;
      p.specCooldown = sp.sc;
      p.items = sp.it;
      p.activeSlot = sp.as;
      p.emote = sp.em;
      p.shieldActive = sp.sh;
      p.cloakTimer = sp.cl ? 1 : 0;
      p.disguiseTimer = sp.dg ? 1 : 0;
      p.disguiseType = sp.dg || 'crate';
      p.freezeTimer = sp.fr ? 1 : 0;
      p.slipTimer = sp.sl ? 1 : 0;
      p.confuseTimer = sp.cf ? 1 : 0;
      p.blindTimer = sp.bl ? 1 : 0;
      p.inkTimer = sp.ik ? 1 : 0;
      p.radarTimer = sp.rd ? 1 : 0;
      p.pogoTimer = sp.pg ? 1 : 0;
      p.speedBoostTimer = sp.sp ? 1 : 0;
    }
  }

  interpolateClients(dt) {
    const alpha = Math.min(1, dt * 18);
    for (const p of this.players) {
      if (typeof p.targetX === 'number') {
        if (Math.hypot(p.targetX - p.x, p.targetY - p.y) > 220) {
          p.x = p.targetX;
          p.y = p.targetY;
        } else {
          p.x += (p.targetX - p.x) * alpha;
          p.y += (p.targetY - p.y) * alpha;
        }
      }
    }
  }
}
