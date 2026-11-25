// 《代號：極限追逐》(Tag & Chaos) — Pixel Art Renderer, Among-Us Local Vision & Minimap
import { TILE, TILE_SIZE, MAP_COLS, MAP_ROWS, WORLD_W, WORLD_H } from './constants.js';

const THEMES = {
  office: { floorA: '#334155', floorB: '#2b3648', wall: '#0f172a', wallTop: '#475569', wallTrim: '#64748b', desk: '#92400e' },
  ice:    { floorA: '#0c4a6e', floorB: '#075985', wall: '#082f49', wallTop: '#0284c7', wallTrim: '#38bdf8', desk: '#475569' },
  factory:{ floorA: '#27272a', floorB: '#1f1f23', wall: '#09090b', wallTop: '#3f3f46', wallTrim: '#71717a', desk: '#78350f' },
};

// 12x14 Pixel Sprite template for Among-Us-style pixel capsule character
// . = transparent, O = black outline, B = body color, D = body dark shade, V = visor, H = highlight
const PIXEL_CHAR_IDLE = [
  '....OOOO....',
  '...OBBBBO...',
  '..OBBBBBBO..',
  '..OBOVVVVVO.',
  '..OBOVHHVVO.',
  '.OOBOVVVVVO.',
  '.OBBOOOOOO..',
  '.OBBBBBBBBO.',
  '.OBBDDDDDBO.',
  '.OOBDDDDDBO.',
  '..OBDDDDDBO.',
  '..OBBO.OBBO.',
  '..OBBO.OBBO.',
  '..OOO...OOO.',
];

const PIXEL_CHAR_WALK = [
  '....OOOO....',
  '...OBBBBO...',
  '..OBBBBBBO..',
  '..OBOVVVVVO.',
  '..OBOVHHVVO.',
  '.OOBOVVVVVO.',
  '.OBBOOOOOO..',
  '.OBBBBBBBBO.',
  '.OBBDDDDDBO.',
  '.OOBDDDDDBO.',
  '..OBDDDDDBO.',
  '.OBBO...OBBO',
  '.OOO.....OOO',
  '............',
];

export function drawPixelCharacterSprite(ctx, cx, cy, pxScale, color, colorDark, facingLeft, walking, isChaser, walkCycle = 0) {
  const frame = walking && Math.sin(walkCycle) > 0 ? PIXEL_CHAR_WALK : PIXEL_CHAR_IDLE;
  const w = frame[0].length * pxScale;
  const h = frame.length * pxScale;

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(cx), Math.round(cy));
  if (facingLeft) ctx.scale(-1, 1);

  const ox = -Math.floor(w / 2);
  const oy = -Math.floor(h / 2);

  for (let row = 0; row < frame.length; row++) {
    const line = frame[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === '.') continue;
      if (ch === 'O') ctx.fillStyle = '#090d16';
      else if (ch === 'B') ctx.fillStyle = color;
      else if (ch === 'D') ctx.fillStyle = colorDark;
      else if (ch === 'V') ctx.fillStyle = isChaser ? '#fca5a5' : '#7dd3fc';
      else if (ch === 'H') ctx.fillStyle = '#ffffff';
      ctx.fillRect(ox + col * pxScale, oy + row * pxScale, pxScale, pxScale);
    }
  }

  // Pixel horns for Chaser
  if (isChaser) {
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(ox + 3 * pxScale, oy - 2 * pxScale, 2 * pxScale, 2 * pxScale);
    ctx.fillRect(ox + 7 * pxScale, oy - 2 * pxScale, 2 * pxScale, 2 * pxScale);
    ctx.fillStyle = '#090d16';
    ctx.fillRect(ox + 3 * pxScale, oy - 3 * pxScale, 2 * pxScale, 1 * pxScale);
    ctx.fillRect(ox + 7 * pxScale, oy - 3 * pxScale, 2 * pxScale, 1 * pxScale);
  }
  ctx.restore();
}

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camX = WORLD_W / 2;
    this.camY = WORLD_H / 2;
    this.zoom = 1.45;
    this.time = 0;
  }

  resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.viewW = w;
    this.viewH = h;
    // Tight local camera zoom so player only sees immediate surroundings (never whole map)
    this.zoom = Math.max(1.25, Math.min(1.8, Math.min(w / 580, h / 440)));
  }

  screenToWorld(sx, sy) {
    const wx = (sx - this.viewW / 2) / this.zoom + this.camX;
    const wy = (sy - this.viewH / 2) / this.zoom + this.camY;
    return { x: wx, y: wy };
  }

  render(engine, dt, specSkillMode = null) {
    this.time += dt;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    const local = engine.players.find((p) => p.id === engine.localId) || engine.players[0];

    // Spectators zoom out wider to aim chaos drops; active players stay tightly zoomed on local neighborhood
    const baseZoom = Math.max(1.25, Math.min(1.8, Math.min(this.viewW / 580, this.viewH / 440)));
    const targetZoom = local && local.caught ? Math.max(0.55, Math.min(0.88, Math.min(this.viewW / 1200, this.viewH / 880))) : baseZoom;
    this.zoom += (targetZoom - this.zoom) * Math.min(1, dt * 6);

    let targetX = WORLD_W / 2;
    let targetY = WORLD_H / 2;
    if (local) {
      if (!local.caught && !local.caged) {
        targetX = local.x;
        targetY = local.y;
      } else {
        const alive = engine.players.find((p) => !p.caught && !p.caged);
        if (alive) { targetX = alive.x; targetY = alive.y; }
      }
    }
    this.camX += (targetX - this.camX) * Math.min(1, dt * 10);
    this.camY += (targetY - this.camY) * Math.min(1, dt * 10);

    // Clamp camera softly to map edges
    const halfW = this.viewW / (2 * this.zoom);
    const halfH = this.viewH / (2 * this.zoom);
    if (WORLD_W > halfW * 2) {
      this.camX = Math.max(halfW, Math.min(WORLD_W - halfW, this.camX));
    }
    if (WORLD_H > halfH * 2) {
      this.camY = Math.max(halfH, Math.min(WORLD_H - halfH, this.camY));
    }

    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    ctx.save();
    ctx.translate(Math.round(this.viewW / 2), Math.round(this.viewH / 2));
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-Math.round(this.camX), -Math.round(this.camY));

    this.drawMap(engine, local);
    this.drawFootprints(engine);
    this.drawModeObjects(engine);
    this.drawTraps(engine, local);
    this.drawItemBoxes(engine);
    this.drawDecoys(engine);
    this.drawPlayers(engine, local);
    this.drawProjectiles(engine);
    this.drawSmokes(engine);
    this.drawParticles(engine);
    this.drawPoisonRing(engine);
    this.drawFloatingTexts(engine);

    // Strict Among-Us-style local line-of-sight darkness when alive
    if (local && !local.caught) {
      this.drawAmongUsVision(engine, local);
      if (local.radarTimer > 0) {
        this.drawRadarArrows(engine, local);
      }
    }

    if (local && local.caught && specSkillMode) {
      this.drawSpectatorHint();
    }

    ctx.restore();

    if (local && !local.caught) {
      this.drawScreenOverlays(engine, local);
    }
  }

  drawMap(engine, local) {
    const ctx = this.ctx;
    const pal = THEMES[engine.map.theme] || THEMES.office;
    const t = this.time;

    // Cull tiles outside camera viewport for fast 60fps on 44x32 map
    const halfW = this.viewW / (2 * this.zoom) + TILE_SIZE * 2;
    const halfH = this.viewH / (2 * this.zoom) + TILE_SIZE * 2;
    const minX = Math.max(0, Math.floor((this.camX - halfW) / TILE_SIZE));
    const maxX = Math.min(MAP_COLS - 1, Math.ceil((this.camX + halfW) / TILE_SIZE));
    const minY = Math.max(0, Math.floor((this.camY - halfH) / TILE_SIZE));
    const maxY = Math.min(MAP_ROWS - 1, Math.ceil((this.camY + halfH) / TILE_SIZE));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const tile = engine.grid[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        // Pixel tiled floor
        ctx.fillStyle = (x + y) % 2 === 0 ? pal.floorA : pal.floorB;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = 'rgba(0,0,0,0.16)';
        ctx.fillRect(px, py + TILE_SIZE - 3, TILE_SIZE, 3);
        ctx.fillRect(px + TILE_SIZE - 3, py, 3, TILE_SIZE);

        if (tile === TILE.ICE) {
          ctx.fillStyle = (x + y) % 2 === 0 ? '#7dd3fc' : '#38bdf8';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#e0f2fe';
          ctx.fillRect(px + 6, py + 9, 12, 3);
          ctx.fillRect(px + 27, py + 30, 12, 3);
        } else if (tile === TILE.WATER) {
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(px + 6, py + 9, 36, 30);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(px + 9, py + 12, 30, 24);
          const off = Math.floor(t * 3) % 2 === 0 ? 0 : 3;
          ctx.fillStyle = '#bae6fd';
          ctx.fillRect(px + 12 + off, py + 18, 12, 3);
          ctx.fillRect(px + 22 - off, py + 28, 12, 3);
        } else if (tile >= TILE.BOOST_R && tile <= TILE.BOOST_D) {
          ctx.fillStyle = '#451a03';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = '#78350f';
          ctx.fillRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6);
          const step = Math.floor(t * 10) % 3;
          ctx.fillStyle = '#facc15';
          for (let i = 0; i < 3; i++) {
            const p = (i * 12 + step * 4) % 36 + 6;
            if (tile === TILE.BOOST_R) ctx.fillRect(px + p, py + 12, 6, 24);
            else if (tile === TILE.BOOST_L) ctx.fillRect(px + TILE_SIZE - p - 6, py + 12, 6, 24);
            else if (tile === TILE.BOOST_D) ctx.fillRect(px + 12, py + p, 24, 6);
            else ctx.fillRect(px + 12, py + TILE_SIZE - p - 6, 24, 6);
          }
        } else if (tile === TILE.TELEPORT_A || tile === TILE.TELEPORT_B) {
          const c1 = tile === TILE.TELEPORT_A ? '#9333ea' : '#db2777';
          const c2 = tile === TILE.TELEPORT_A ? '#d8b4fe' : '#f9a8d4';
          ctx.fillStyle = '#090d16';
          ctx.fillRect(px + 6, py + 6, 36, 36);
          ctx.fillStyle = c1;
          ctx.fillRect(px + 9, py + 9, 30, 30);
          ctx.fillStyle = Math.floor(t * 4) % 2 === 0 ? c2 : '#090d16';
          ctx.fillRect(px + 15, py + 15, 18, 18);
        } else if (tile === TILE.SWITCH) {
          const active = engine.gateClosedTimer > 0;
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(px + 6, py + 6, 36, 36);
          ctx.fillStyle = active ? '#22c55e' : '#ef4444';
          ctx.fillRect(px + 12, py + 12, 24, 24);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(px + 15, py + 15, 6, 6);
        } else if (tile === TILE.GATE) {
          if (engine.gateClosedTimer > 0) {
            ctx.fillStyle = '#991b1b';
            ctx.fillRect(px, py + 6, TILE_SIZE, TILE_SIZE - 12);
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(px + 3, py + 9, TILE_SIZE - 6, TILE_SIZE - 18);
            ctx.fillStyle = '#facc15';
            ctx.fillRect(px + 6, py + 21, TILE_SIZE - 12, 6);
          } else {
            ctx.fillStyle = '#475569';
            ctx.fillRect(px, py, 6, TILE_SIZE);
            ctx.fillRect(px + TILE_SIZE - 6, py, 6, TILE_SIZE);
          }
        } else if (tile === TILE.WALL) {
          ctx.fillStyle = pal.wall;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = pal.wallTop;
          ctx.fillRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 12);
          ctx.fillStyle = pal.wallTrim;
          ctx.fillRect(px + 3, py + 3, TILE_SIZE - 6, 6);
          // Pixel brick seams
          ctx.fillStyle = pal.wall;
          ctx.fillRect(px + 21, py + 9, 3, 15);
          ctx.fillRect(px + 3, py + 21, TILE_SIZE - 6, 3);
        } else if (tile === TILE.LOW_BOX) {
          ctx.fillStyle = '#090d16';
          ctx.fillRect(px + 6, py + 6, 36, 36);
          ctx.fillStyle = pal.desk;
          ctx.fillRect(px + 9, py + 9, 30, 30);
          ctx.fillStyle = '#d97706';
          ctx.fillRect(px + 9, py + 9, 30, 6);
        } else if (tile === TILE.CRATE) {
          this.drawPixelCrate(px + 6, py + 6, 36);
        } else if (tile === TILE.BUSH) {
          const localInSame = local && Math.floor(local.x / TILE_SIZE) === x && Math.floor(local.y / TILE_SIZE) === y;
          ctx.save();
          ctx.globalAlpha = localInSame ? 0.5 : 0.96;
          ctx.fillStyle = '#14532d';
          ctx.fillRect(px + 3, py + 6, 42, 36);
          ctx.fillStyle = '#16a34a';
          ctx.fillRect(px + 6, py + 9, 36, 27);
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(px + 12, py + 12, 9, 6);
          ctx.fillRect(px + 27, py + 18, 9, 6);
          ctx.restore();
        }
      }
    }
  }

  drawPixelCrate(x, y, size) {
    const ctx = this.ctx;
    ctx.fillStyle = '#090d16';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#b45309';
    ctx.fillRect(x + 3, y + 3, size - 6, size - 6);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(x + 6, y + 6, size - 12, size - 12);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x + 9, y + 15, size - 18, 6);
    ctx.fillRect(x + 15, y + 9, 6, size - 18);
  }

  drawFootprints(engine) {
    const ctx = this.ctx;
    for (const f of engine.footprints) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.75, f.life / 3);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(Math.round(f.x - 5), Math.round(f.y - 3), 4, 4);
      ctx.fillRect(Math.round(f.x + 2), Math.round(f.y + 2), 4, 4);
      ctx.restore();
    }
  }

  drawModeObjects(engine) {
    const ctx = this.ctx;
    if (engine.mode === 'rescue' && engine.prisonPos) {
      const { x, y } = engine.prisonPos;
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.fillRect(x - 30, y - 30, 60, 60);
      ctx.fillStyle = '#94a3b8';
      for (let bx = -24; bx <= 24; bx += 12) {
        ctx.fillRect(x + bx - 2, y - 30, 4, 60);
      }
      ctx.fillRect(x - 30, y - 30, 60, 4);
      ctx.fillRect(x - 30, y + 26, 60, 4);
    }

    if (engine.mode === 'escape') {
      if (engine.escapeGatePos) {
        const { x, y } = engine.escapeGatePos;
        ctx.fillStyle = '#090d16';
        ctx.fillRect(x - 27, y - 24, 54, 48);
        ctx.fillStyle = engine.escapeGateOpen ? '#22c55e' : '#475569';
        ctx.fillRect(x - 24, y - 21, 48, 42);
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(engine.escapeGateOpen ? 'EXIT!' : `${engine.keysCollected}/3`, x, y + 4);
      }
      for (const k of engine.keys) {
        const bob = Math.floor(Math.sin(this.time * 5 + k.x) * 3);
        const kx = Math.round(k.x);
        const ky = Math.round(k.y + bob);
        // Pixel Golden Key
        ctx.fillStyle = '#090d16';
        ctx.fillRect(kx - 11, ky - 6, 10, 10);
        ctx.fillRect(kx - 1, ky - 3, 13, 5);
        ctx.fillRect(kx + 6, ky + 1, 5, 5);
        ctx.fillStyle = '#facc15';
        ctx.fillRect(kx - 9, ky - 4, 6, 6);
        ctx.fillRect(kx - 3, ky - 1, 13, 2);
        ctx.fillRect(kx + 8, ky + 1, 2, 3);
        ctx.fillStyle = '#090d16';
        ctx.fillRect(kx - 7, ky - 2, 2, 2);
      }
    }
  }

  drawTraps(engine, local) {
    const ctx = this.ctx;
    for (const tr of engine.traps) {
      ctx.save();
      if (tr.type === 'slime') {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.65)';
        ctx.fillRect(tr.x - tr.radius * 0.8, tr.y - tr.radius * 0.8, tr.radius * 1.6, tr.radius * 1.6);
        ctx.fillStyle = '#15803d';
        ctx.fillRect(tr.x - tr.radius * 0.5, tr.y - tr.radius * 0.5, tr.radius, tr.radius);
      } else {
        if (tr.type === 'freeze_mine' && local && tr.ownerId !== local.id && !local.caught) {
          ctx.globalAlpha = 0.42;
        }
        const tx = Math.round(tr.x);
        const ty = Math.round(tr.y);
        if (tr.type === 'banana') {
          ctx.fillStyle = '#090d16';
          ctx.fillRect(tx - 9, ty - 6, 18, 12);
          ctx.fillStyle = '#facc15';
          ctx.fillRect(tx - 6, ty - 3, 12, 6);
          ctx.fillRect(tx - 9, ty, 6, 3);
          ctx.fillRect(tx + 3, ty, 6, 3);
          ctx.fillStyle = '#78350f';
          ctx.fillRect(tx - 3, ty - 6, 4, 3);
        } else if (tr.type === 'freeze_mine') {
          ctx.fillStyle = '#090d16';
          ctx.fillRect(tx - 10, ty - 10, 20, 20);
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(tx - 8, ty - 8, 16, 16);
          ctx.fillStyle = '#e0f2fe';
          ctx.fillRect(tx - 2, ty - 7, 4, 14);
          ctx.fillRect(tx - 7, ty - 2, 14, 4);
        } else if (tr.type === 'bear_trap') {
          ctx.fillStyle = '#090d16';
          ctx.fillRect(tx - 12, ty - 9, 24, 18);
          ctx.fillStyle = '#64748b';
          ctx.fillRect(tx - 9, ty - 6, 18, 12);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(tx - 7, ty - 6, 3, 4);
          ctx.fillRect(tx + 4, ty - 6, 3, 4);
          ctx.fillRect(tx - 7, ty + 2, 3, 4);
          ctx.fillRect(tx + 4, ty + 2, 3, 4);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(tx - 2, ty - 2, 4, 4);
        } else {
          // Bounce mine with blinking pixel LED
          ctx.fillStyle = '#090d16';
          ctx.fillRect(tx - 11, ty - 11, 22, 22);
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(tx - 8, ty - 8, 16, 16);
          ctx.fillStyle = Math.floor(this.time * 8) % 2 === 0 ? '#fef08a' : '#ef4444';
          ctx.fillRect(tx - 3, ty - 3, 6, 6);
        }
      }
      ctx.restore();
    }
  }

  drawItemBoxes(engine) {
    const ctx = this.ctx;
    for (const b of engine.itemBoxes) {
      const bob = Math.floor(Math.sin(this.time * 4 + (b.bobPhase || 0)) * 3);
      const bx = Math.round(b.x - 15);
      const by = Math.round(b.y - 15 + bob);
      ctx.fillStyle = '#090d16';
      ctx.fillRect(bx, by, 30, 30);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(bx + 3, by + 3, 24, 24);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(bx + 3, by + 3, 24, 3);
      ctx.fillStyle = '#090d16';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', b.x, b.y + 1 + bob);
    }
  }

  drawDecoys(engine) {
    for (const d of engine.decoys) {
      drawPixelCharacterSprite(this.ctx, d.x, d.y, 3, d.color, d.colorDark, false, true, d.role === 'chaser', this.time * 10);
    }
  }

  drawPlayers(engine, local) {
    const sorted = [...engine.players].sort((a, b) => a.y - b.y);
    for (const p of sorted) {
      if (p.caught || p.escaped) continue;
      const isSelf = local && p.id === local.id;

      if (!isSelf && local && !local.caught && local.radarTimer <= 0) {
        if (engine.isInBush(p)) {
          const sameBush = Math.floor(p.x / TILE_SIZE) === Math.floor(local.x / TILE_SIZE) &&
                           Math.floor(p.y / TILE_SIZE) === Math.floor(local.y / TILE_SIZE);
          if (!sameBush) continue;
        }
        if (p.cloakTimer > 0) continue;
      }

      if (p.disguiseTimer > 0) {
        this.ctx.save();
        if (isSelf) this.ctx.globalAlpha = 0.78;
        this.drawPixelCrate(Math.round(p.x - 18), Math.round(p.y - 18), 36);
        this.ctx.restore();
        continue;
      }

      this.drawPlayerEntity(p, isSelf);
    }
  }

  drawPlayerEntity(p, isSelf) {
    const ctx = this.ctx;
    ctx.save();
    if (p.cloakTimer > 0) ctx.globalAlpha = isSelf ? 0.45 : 0.14;

    // Pixel trail
    if (p.trailPoints && p.trailPoints.length > 0) {
      for (let i = 0; i < p.trailPoints.length; i++) {
        const tp = p.trailPoints[i];
        ctx.fillStyle = p.color;
        ctx.globalAlpha = ((i + 1) / p.trailPoints.length) * 0.35;
        ctx.fillRect(Math.round(tp.x - 6), Math.round(tp.y - 6), 12, 12);
      }
      ctx.globalAlpha = p.cloakTimer > 0 ? (isSelf ? 0.45 : 0.14) : 1;
    }

    const jumpY = p.pogoTimer > 0 ? -Math.floor(Math.abs(Math.sin(this.time * 12)) * 12) : 0;

    // Pixel shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.fillRect(Math.round(p.x - 12), Math.round(p.y + 15), 24, 6);

    const walking = Math.hypot(p.vx || 0, p.vy || 0) > 10;
    const facingLeft = (p.dirX || 0) < -0.15;
    drawPixelCharacterSprite(ctx, p.x, p.y + jumpY, 3, p.color, p.colorDark, facingLeft, walking, p.role === 'chaser', p.walkCycle || 0);

    // Shield pixel outline
    if (p.shieldActive) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.strokeRect(Math.round(p.x - 22), Math.round(p.y - 24 + jumpY), 44, 48);
    }
    if (p.freezeTimer > 0) {
      ctx.fillStyle = 'rgba(125, 211, 252, 0.55)';
      ctx.fillRect(Math.round(p.x - 20), Math.round(p.y - 22), 40, 44);
    }

    // Pixel Name Tag
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#020617';
    ctx.fillText(p.name, Math.round(p.x + 1), Math.round(p.y + 32));
    ctx.fillStyle = p.role === 'chaser' ? '#fca5a5' : '#f8fafc';
    ctx.fillText(p.name, Math.round(p.x), Math.round(p.y + 31));

    if (p.emote) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(p.x - 14), Math.round(p.y - 46), 28, 22);
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.round(p.x - 14), Math.round(p.y - 46), 28, 22);
      ctx.font = '14px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.emote, Math.round(p.x), Math.round(p.y - 35));
    }
    ctx.restore();
  }

  drawProjectiles(engine) {
    const ctx = this.ctx;
    for (const pr of engine.projectiles) {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(Math.round(pr.x - 8), Math.round(pr.y - 8), 16, 16);
      ctx.fillStyle = pr.type === 'slime_jar' ? '#22c55e' : pr.type === 'flashbang' ? '#ffffff' : '#c084fc';
      ctx.fillRect(Math.round(pr.x - 5), Math.round(pr.y - 5), 10, 10);
    }
  }

  drawSmokes(engine) {
    const ctx = this.ctx;
    for (const s of engine.smokes) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.92)';
      const r = Math.round(s.radius * 0.85);
      ctx.fillRect(Math.round(s.x - r), Math.round(s.y - r), r * 2, r * 2);
      ctx.fillStyle = 'rgba(203, 213, 225, 0.85)';
      ctx.fillRect(Math.round(s.x - r * 0.6), Math.round(s.y - r * 0.6), r * 1.2, r * 1.2);
    }
  }

  drawParticles(engine) {
    const ctx = this.ctx;
    for (const pt of engine.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      const sz = Math.max(3, Math.round(pt.size));
      ctx.fillRect(Math.round(pt.x - sz / 2), Math.round(pt.y - sz / 2), sz, sz);
      ctx.restore();
    }
  }

  drawPoisonRing(engine) {
    if (!engine.enablePoison || engine.timeLeft > 30) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WORLD_W, WORLD_H);
    ctx.arc(WORLD_W / 2, WORLD_H / 2, Math.max(10, engine.poisonRadius), 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(220, 38, 38, 0.35)';
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
  }

  drawFloatingTexts(engine) {
    const ctx = this.ctx;
    for (const ft of engine.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#020617';
      ctx.fillText(ft.text, Math.round(ft.x + 1), Math.round(ft.y + 1));
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, Math.round(ft.x), Math.round(ft.y));
      ctx.restore();
    }
  }

  // Among-Us style strict line-of-sight pitch-black darkness
  drawAmongUsVision(engine, local) {
    const ctx = this.ctx;
    const isBlackout = engine.activeEvent?.id === 'blackout';
    const maxDist = isBlackout ? 115 : (local.role === 'chaser' ? 235 : 220);
    const rays = 140;
    const poly = [];

    for (let i = 0; i < rays; i++) {
      const ang = (i / rays) * Math.PI * 2;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      let dist = maxDist;
      for (let d = 16; d <= maxDist; d += 8) {
        const tx = Math.floor((local.x + dx * d) / TILE_SIZE);
        const ty = Math.floor((local.y + dy * d) / TILE_SIZE);
        if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS ||
            engine.grid[ty][tx] === TILE.WALL ||
            (engine.grid[ty][tx] === TILE.GATE && engine.gateClosedTimer > 0)) {
          dist = d;
          break;
        }
      }
      poly.push({ x: local.x + dx * dist, y: local.y + dy * dist });
    }

    // Pitch black outside line-of-sight
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WORLD_W, WORLD_H);
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = poly.length - 1; i >= 0; i--) {
      ctx.lineTo(poly[i].x, poly[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.985)';
    ctx.fill('evenodd');

    // Soft pixel-like falloff ring inside vision
    const grad = ctx.createRadialGradient(local.x, local.y, maxDist * 0.42, local.x, local.y, maxDist);
    grad.addColorStop(0, 'rgba(2, 6, 23, 0)');
    grad.addColorStop(1, 'rgba(2, 6, 23, 0.96)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(local.x, local.y, maxDist, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawRadarArrows(engine, local) {
    const ctx = this.ctx;
    for (const o of engine.players) {
      if (!engine.areOpponents(local, o) || o.caught || o.escaped) continue;
      const dx = o.x - local.x;
      const dy = o.y - local.y;
      const d = Math.hypot(dx, dy);
      if (d < 40) continue;
      const ang = Math.atan2(dy, dx);
      const ax = Math.round(local.x + Math.cos(ang) * 52);
      const ay = Math.round(local.y + Math.sin(ang) * 52);
      ctx.fillStyle = o.role === 'chaser' ? '#ef4444' : '#38bdf8';
      ctx.fillRect(ax - 5, ay - 5, 10, 10);
    }
  }

  drawSpectatorHint() {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 4;
    ctx.strokeRect(TILE_SIZE, TILE_SIZE, WORLD_W - TILE_SIZE * 2, WORLD_H - TILE_SIZE * 2);
    ctx.restore();
  }

  drawScreenOverlays(engine, local) {
    const ctx = this.ctx;
    if (local.role === 'runner') {
      let minD = Infinity;
      for (const o of engine.players) {
        if (o.role === 'chaser' && !o.caught) {
          const d = Math.hypot(o.x - local.x, o.y - local.y);
          if (d < minD) minD = d;
        }
      }
      if (minD < 250) {
        const intensity = Math.max(0, 1 - minD / 250);
        const pulse = 0.5 + 0.5 * Math.sin(this.time * (8 + intensity * 12));
        const alpha = intensity * (0.25 + pulse * 0.25);
        ctx.fillStyle = `rgba(239, 68, 68, ${alpha.toFixed(2)})`;
        ctx.fillRect(0, 0, this.viewW, 12);
        ctx.fillRect(0, this.viewH - 12, this.viewW, 12);
        ctx.fillRect(0, 0, 12, this.viewH);
        ctx.fillRect(this.viewW - 12, 0, 12, this.viewH);
      }
    }

    if (local.blindTimer > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.95, local.blindTimer)})`;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }

    if (local.inkTimer > 0) {
      ctx.fillStyle = 'rgba(9, 13, 22, 0.92)';
      ctx.fillRect(this.viewW * 0.2, this.viewH * 0.2, this.viewW * 0.6, this.viewH * 0.6);
    }
  }

  // Top-right Among Us style Minimap showing whole layout + self + teammates
  renderMinimap(engine, miniCanvas) {
    if (!miniCanvas) return;
    const ctx = miniCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const cw = miniCanvas.width;
    const ch = miniCanvas.height;
    const sx = cw / MAP_COLS;
    const sy = ch / MAP_ROWS;

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, cw, ch);

    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        const t = engine.grid[y][x];
        if (t === TILE.WALL) ctx.fillStyle = '#475569';
        else if (t === TILE.BUSH) ctx.fillStyle = '#15803d';
        else if (t === TILE.ICE) ctx.fillStyle = '#0369a1';
        else if (t === TILE.TELEPORT_A || t === TILE.TELEPORT_B) ctx.fillStyle = '#a855f7';
        else if (t === TILE.GATE && engine.gateClosedTimer > 0) ctx.fillStyle = '#ef4444';
        else if (t === TILE.SWITCH) ctx.fillStyle = '#f87171';
        else ctx.fillStyle = '#1e293b';
        ctx.fillRect(Math.floor(x * sx), Math.floor(y * sy), Math.ceil(sx), Math.ceil(sy));
      }
    }

    // Mode landmarks on minimap
    if (engine.mode === 'rescue' && engine.prisonPos) {
      ctx.fillStyle = '#f97316';
      ctx.fillRect(Math.round((engine.prisonPos.x / WORLD_W) * cw - 4), Math.round((engine.prisonPos.y / WORLD_H) * ch - 4), 8, 8);
    }
    if (engine.mode === 'escape') {
      if (engine.escapeGatePos) {
        ctx.fillStyle = engine.escapeGateOpen ? '#22c55e' : '#94a3b8';
        ctx.fillRect(Math.round((engine.escapeGatePos.x / WORLD_W) * cw - 4), Math.round((engine.escapeGatePos.y / WORLD_H) * ch - 4), 8, 8);
      }
      ctx.fillStyle = '#facc15';
      for (const k of engine.keys) {
        ctx.fillRect(Math.round((k.x / WORLD_W) * cw - 2), Math.round((k.y / WORLD_H) * ch - 2), 4, 4);
      }
    }

    const local = engine.players.find((p) => p.id === engine.localId);
    for (const p of engine.players) {
      if (p.caught || p.escaped) continue;
      const isSelf = local && p.id === local.id;
      const isTeammate = local && p.role === local.role;
      const radarSee = local && local.radarTimer > 0;
      const isSpectator = local && local.caught;

      // Show self, teammates, or all if spectating/radar
      if (!isSelf && !isTeammate && !radarSee && !isSpectator) continue;

      const mx = Math.round((p.x / WORLD_W) * cw);
      const my = Math.round((p.y / WORLD_H) * ch);
      if (isSelf) {
        const blink = Math.floor(this.time * 6) % 2 === 0;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(mx - 4, my - 4, 8, 8);
        ctx.fillStyle = blink ? '#facc15' : p.color;
        ctx.fillRect(mx - 3, my - 3, 6, 6);
      } else {
        ctx.fillStyle = '#090d16';
        ctx.fillRect(mx - 3, my - 3, 6, 6);
        ctx.fillStyle = isTeammate ? p.color : '#ef4444';
        ctx.fillRect(mx - 2, my - 2, 4, 4);
      }
    }
  }
}
