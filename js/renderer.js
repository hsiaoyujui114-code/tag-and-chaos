// 《代號：極限追逐》(Tag & Chaos) — 2D Q-Style Capsule Canvas Renderer
import { TILE, TILE_SIZE, MAP_COLS, MAP_ROWS, WORLD_W, WORLD_H } from './constants.js';

const THEMES = {
  office: { floorA: '#f1f5f9', floorB: '#e2e8f0', wall: '#334155', wallTop: '#475569', desk: '#b45309' },
  ice:    { floorA: '#e0f2fe', floorB: '#bae6fd', wall: '#0369a1', wallTop: '#0284c7', desk: '#64748b' },
  factory:{ floorA: '#e5e7eb', floorB: '#d1d5db', wall: '#1f2937', wallTop: '#374151', desk: '#92400e' },
};

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.camX = WORLD_W / 2;
    this.camY = WORLD_H / 2;
    this.zoom = 1;
    this.time = 0;
  }

  resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = w;
    this.viewH = h;
    // Scale nicely so desktop sees generous view, mobile scales cleanly
    this.zoom = Math.max(0.68, Math.min(1.18, Math.min(w / 960, h / 660)));
  }

  screenToWorld(sx, sy) {
    const wx = (sx - this.viewW / 2) / this.zoom + this.camX;
    const wy = (sy - this.viewH / 2) / this.zoom + this.camY;
    return { x: wx, y: wy };
  }

  render(engine, dt, specSkillMode = null) {
    this.time += dt;
    const ctx = this.ctx;
    const local = engine.players.find((p) => p.id === engine.localId) || engine.players[0];

    // Smooth camera tracking
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
    this.camX += (targetX - this.camX) * Math.min(1, dt * 8);
    this.camY += (targetY - this.camY) * Math.min(1, dt * 8);

    // Clamp camera softly
    const halfW = this.viewW / (2 * this.zoom);
    const halfH = this.viewH / (2 * this.zoom);
    if (WORLD_W > halfW * 2) {
      this.camX = Math.max(halfW - 24, Math.min(WORLD_W - halfW + 24, this.camX));
    } else {
      this.camX = WORLD_W / 2;
    }
    if (WORLD_H > halfH * 2) {
      this.camY = Math.max(halfH - 24, Math.min(WORLD_H - halfH + 24, this.camY));
    } else {
      this.camY = WORLD_H / 2;
    }

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    ctx.save();
    ctx.translate(this.viewW / 2, this.viewH / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.camX, -this.camY);

    this.drawMap(engine, local);
    this.drawFootprints(engine);
    this.drawModeObjects(engine);
    this.drawTraps(engine, local);
    this.drawItemBoxes(engine);
    this.drawDecoys(engine);
    this.drawPlayers(engine, local);
    this.drawProjectiles(engine);
    this.drawSmokes(engine, local);
    this.drawParticles(engine);
    this.drawPoisonRing(engine);
    this.drawFloatingTexts(engine);

    // Fog of War / Blackout
    if (local && !local.caught) {
      if (engine.activeEvent?.id === 'blackout') {
        this.drawBlackout(local);
      } else if (engine.enableFog) {
        this.drawFogOfWar(engine, local);
      }
      if (local.radarTimer > 0) {
        this.drawRadarArrows(engine, local);
      }
    }

    if (local && local.caught && specSkillMode) {
      this.drawSpectatorHint(engine);
    }

    ctx.restore();

    // Screen-space overlays (Flashbang, Ink, Heartbeat, Wind lines)
    if (local && !local.caught) {
      this.drawScreenOverlays(engine, local);
    }
  }

  drawMap(engine, local) {
    const ctx = this.ctx;
    const pal = THEMES[engine.map.theme] || THEMES.office;
    const t = this.time;

    for (let y = 0; y < MAP_ROWS; y++) {
      for (let x = 0; x < MAP_COLS; x++) {
        const tile = engine.grid[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;

        // Checkerboard base floor
        ctx.fillStyle = (x + y) % 2 === 0 ? pal.floorA : pal.floorB;
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

        if (tile === TILE.ICE) {
          ctx.fillStyle = '#bae6fd';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.strokeStyle = 'rgba(255,255,255,0.65)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px + 8, py + 12);
          ctx.lineTo(px + 22, py + 8);
          ctx.moveTo(px + 26, py + 36);
          ctx.lineTo(px + 40, py + 30);
          ctx.stroke();
        } else if (tile === TILE.WATER) {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
          ctx.beginPath();
          ctx.ellipse(px + 24, py + 24, 20, 16, 0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(px + 24, py + 24, 8 + Math.sin(t * 4 + x) * 3, 0, Math.PI * 1.4);
          ctx.stroke();
        } else if (tile >= TILE.BOOST_R && tile <= TILE.BOOST_D) {
          ctx.fillStyle = '#fef3c7';
          ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
          ctx.save();
          ctx.translate(px + 24, py + 24);
          const ang = tile === TILE.BOOST_R ? 0 : tile === TILE.BOOST_L ? Math.PI : tile === TILE.BOOST_U ? -Math.PI / 2 : Math.PI / 2;
          ctx.rotate(ang);
          const shift = ((t * 40) % 16) - 8;
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 4;
          ctx.lineCap = 'round';
          for (let k = -1; k <= 1; k++) {
            const ox = k * 12 + shift * 0.4;
            ctx.beginPath();
            ctx.moveTo(ox - 5, -9);
            ctx.lineTo(ox + 5, 0);
            ctx.lineTo(ox - 5, 9);
            ctx.stroke();
          }
          ctx.restore();
        } else if (tile === TILE.TELEPORT_A || tile === TILE.TELEPORT_B) {
          const c = tile === TILE.TELEPORT_A ? '#a855f7' : '#ec4899';
          ctx.save();
          ctx.translate(px + 24, py + 24);
          ctx.rotate(t * 2.5);
          ctx.fillStyle = c;
          ctx.globalAlpha = 0.25;
          ctx.beginPath();
          ctx.arc(0, 0, 20, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = c;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, 15, 0, Math.PI * 1.4);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, 8, Math.PI, Math.PI * 2.4);
          ctx.stroke();
          ctx.restore();
        } else if (tile === TILE.SWITCH) {
          const active = engine.gateClosedTimer > 0;
          ctx.fillStyle = '#334155';
          ctx.fillRect(px + 8, py + 8, 32, 32);
          ctx.fillStyle = active ? '#22c55e' : '#ef4444';
          ctx.beginPath();
          ctx.arc(px + 24, py + 24, 11, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#111827';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        } else if (tile === TILE.GATE) {
          if (engine.gateClosedTimer > 0) {
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(px + 2, py + 4, TILE_SIZE - 4, TILE_SIZE - 8);
            ctx.strokeStyle = '#111827';
            ctx.lineWidth = 3;
            ctx.strokeRect(px + 2, py + 4, TILE_SIZE - 4, TILE_SIZE - 8);
            // Hazard stripes
            ctx.fillStyle = '#fde047';
            ctx.fillRect(px + 8, py + 20, TILE_SIZE - 16, 8);
          } else {
            ctx.strokeStyle = '#94a3b8';
            ctx.setLineDash([5, 5]);
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
            ctx.setLineDash([]);
          }
        } else if (tile === TILE.WALL) {
          ctx.fillStyle = pal.wall;
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
          ctx.fillStyle = pal.wallTop;
          ctx.fillRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 10);
          ctx.strokeStyle = '#0f172a';
          ctx.lineWidth = 2.5;
          ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
        } else if (tile === TILE.LOW_BOX) {
          ctx.fillStyle = pal.desk;
          ctx.beginPath();
          ctx.roundRect(px + 5, py + 7, TILE_SIZE - 10, TILE_SIZE - 14, 7);
          ctx.fill();
          ctx.strokeStyle = '#111827';
          ctx.lineWidth = 3;
          ctx.stroke();
        } else if (tile === TILE.CRATE) {
          this.drawCrate(px + 4, py + 4, TILE_SIZE - 8);
        } else if (tile === TILE.BUSH) {
          const localInSame = local && Math.floor(local.x / TILE_SIZE) === x && Math.floor(local.y / TILE_SIZE) === y;
          ctx.save();
          ctx.globalAlpha = localInSame ? 0.55 : 0.94;
          ctx.fillStyle = '#16a34a';
          ctx.beginPath();
          ctx.arc(px + 16, py + 26, 14, 0, Math.PI * 2);
          ctx.arc(px + 32, py + 26, 14, 0, Math.PI * 2);
          ctx.arc(px + 24, py + 17, 15, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#14532d';
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  drawCrate(x, y, size) {
    const ctx = this.ctx;
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.roundRect(x, y, size, size, 6);
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 6);
    ctx.lineTo(x + size - 6, y + size - 6);
    ctx.moveTo(x + size - 6, y + 6);
    ctx.lineTo(x + 6, y + size - 6);
    ctx.stroke();
  }

  drawFootprints(engine) {
    const ctx = this.ctx;
    for (const f of engine.footprints) {
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.ang);
      ctx.globalAlpha = Math.min(0.65, f.life / 3);
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.ellipse(0, -5, 5, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(3, 5, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  drawModeObjects(engine) {
    const ctx = this.ctx;
    if (engine.mode === 'rescue' && engine.prisonPos) {
      const { x, y } = engine.prisonPos;
      ctx.save();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.16)';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(x - 32, y - 32, 64, 64, 8);
      ctx.fill();
      ctx.stroke();
      // Prison bars
      ctx.beginPath();
      for (let bx = -20; bx <= 20; bx += 13) {
        ctx.moveTo(x + bx, y - 32);
        ctx.lineTo(x + bx, y + 32);
      }
      ctx.stroke();
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#111827';
      ctx.textAlign = 'center';
      ctx.fillText('牢籠(碰觸救人)', x, y - 38);
      ctx.restore();
    }

    if (engine.mode === 'escape') {
      if (engine.escapeGatePos) {
        const { x, y } = engine.escapeGatePos;
        ctx.save();
        ctx.fillStyle = engine.escapeGateOpen ? '#22c55e' : '#64748b';
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.roundRect(x - 28, y - 24, 56, 48, 10);
        ctx.fill();
        ctx.stroke();
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(engine.escapeGateOpen ? '🚪' : '🔒', x, y);
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#111827';
        ctx.fillText(engine.escapeGateOpen ? '逃生門開啟!' : `鑰匙 ${engine.keysCollected}/3`, x, y + 34);
        ctx.restore();
      }
      for (const k of engine.keys) {
        const bob = Math.sin(this.time * 5 + k.x) * 4;
        ctx.save();
        ctx.fillStyle = 'rgba(250, 204, 21, 0.3)';
        ctx.beginPath();
        ctx.arc(k.x, k.y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔑', k.x, k.y + bob);
        ctx.restore();
      }
    }
  }

  drawTraps(engine, local) {
    const ctx = this.ctx;
    for (const tr of engine.traps) {
      ctx.save();
      if (tr.type === 'slime') {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.55)';
        ctx.beginPath();
        ctx.arc(tr.x, tr.y, tr.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#15803d';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        if (tr.type === 'freeze_mine' && local && tr.ownerId !== local.id && !local.caught) {
          ctx.globalAlpha = 0.42;
        }
        const icon = tr.type === 'banana' ? '🍌' : tr.type === 'freeze_mine' ? '❄️' : tr.type === 'bear_trap' ? '🪤' : '💥';
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.arc(tr.x, tr.y, tr.radius * 0.85, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, tr.x, tr.y);
      }
      ctx.restore();
    }
  }

  drawItemBoxes(engine) {
    const ctx = this.ctx;
    for (const b of engine.itemBoxes) {
      const bob = Math.sin(this.time * 4 + (b.bobPhase || 0)) * 3.5;
      ctx.save();
      ctx.translate(b.x, b.y + bob);
      // Glow
      ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      // Box
      ctx.fillStyle = '#facc15';
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-14, -14, 28, 28, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', 0, 1);
      ctx.restore();
    }
  }

  drawDecoys(engine) {
    for (const d of engine.decoys) {
      this.drawCapsuleCharacter({
        x: d.x, y: d.y, radius: d.radius || 16,
        color: d.color, colorDark: d.colorDark, hat: d.hat,
        name: d.name, role: d.role,
        dirX: 1, dirY: 0, walkCycle: this.time * 8,
        trail: 'none', trailPoints: [],
      });
    }
  }

  drawPlayers(engine, local) {
    const sorted = [...engine.players].sort((a, b) => a.y - b.y);
    for (const p of sorted) {
      if (p.caught || p.escaped) continue;
      const isSelf = local && p.id === local.id;

      // Bush stealth: hide players in bush from opponents outside that bush (unless radar or spectator)
      if (!isSelf && local && !local.caught && local.radarTimer <= 0) {
        if (engine.isInBush(p)) {
          const sameBush = Math.floor(p.x / TILE_SIZE) === Math.floor(local.x / TILE_SIZE) &&
                           Math.floor(p.y / TILE_SIZE) === Math.floor(local.y / TILE_SIZE);
          if (!sameBush) continue;
        }
        if (p.cloakTimer > 0) continue;
      }

      // Disguise rendering
      if (p.disguiseTimer > 0) {
        this.ctx.save();
        if (isSelf) this.ctx.globalAlpha = 0.78;
        if (p.disguiseType === 'crate') {
          this.drawCrate(p.x - 19, p.y - 19, 38);
        } else {
          this.ctx.fillStyle = '#facc15';
          this.ctx.strokeStyle = '#111827';
          this.ctx.lineWidth = 3;
          this.ctx.beginPath();
          this.ctx.roundRect(p.x - 14, p.y - 14, 28, 28, 6);
          this.ctx.fill();
          this.ctx.stroke();
          this.ctx.fillStyle = '#111827';
          this.ctx.font = 'bold 18px sans-serif';
          this.ctx.textAlign = 'center';
          this.ctx.textBaseline = 'middle';
          this.ctx.fillText('?', p.x, p.y + 1);
        }
        this.ctx.restore();
        continue;
      }

      this.drawCapsuleCharacter(p, isSelf);
    }
  }

  drawCapsuleCharacter(p, isSelf = false) {
    const ctx = this.ctx;
    ctx.save();

    if (p.cloakTimer > 0) {
      ctx.globalAlpha = isSelf ? 0.42 : 0.15;
    }

    // Motion trail / afterimages
    if (p.trailPoints && p.trailPoints.length > 0) {
      for (let i = 0; i < p.trailPoints.length; i++) {
        const tp = p.trailPoints[i];
        const frac = (i + 1) / p.trailPoints.length;
        ctx.save();
        ctx.globalAlpha = frac * 0.35;
        if (p.trail === 'rainbow') {
          ctx.fillStyle = `hsl(${(i * 38 + this.time * 240) % 360}, 90%, 60%)`;
        } else if (p.trail === 'fire') {
          ctx.fillStyle = i % 2 === 0 ? '#f97316' : '#ef4444';
        } else if (p.trail === 'pixel') {
          ctx.fillStyle = p.color;
          ctx.fillRect(tp.x - 7, tp.y - 7, 14, 14);
          ctx.restore();
          continue;
        } else {
          ctx.fillStyle = p.speedBoostTimer > 0 ? '#fde047' : p.color;
        }
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, (p.radius || 16) * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    const r = p.radius || 16;
    const jumpY = p.pogoTimer > 0 ? -Math.abs(Math.sin(this.time * 12)) * 14 : 0;
    const spin = p.slipTimer > 0 ? this.time * 16 : 0;

    // Ground shadow
    ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + r * 0.78, r * 0.9, r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    // Chaser danger ring
    if (p.role === 'chaser') {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 6 + Math.sin(this.time * 8) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.translate(p.x, p.y + jumpY);
    if (spin) ctx.rotate(spin);

    // Animated bobbing feet
    const footOff = Math.sin(p.walkCycle || 0) * 5;
    ctx.fillStyle = p.colorDark || '#1e293b';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-r * 0.55, r * 0.45 + footOff * 0.5, 8, 8, 4);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.roundRect(r * 0.15, r * 0.45 - footOff * 0.5, 8, 8, 4);
    ctx.fill();
    ctx.stroke();

    // Q-style rounded capsule body with thick black border
    ctx.fillStyle = p.color;
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(-r * 0.85, -r * 0.95, r * 1.7, r * 1.65, r * 0.75);
    ctx.fill();
    ctx.stroke();

    // Eyes / Visor facing movement direction
    const ex = (p.dirX || 0) * 4.5;
    const ey = (p.dirY || 0) * 3.5;
    ctx.fillStyle = '#e0f2fe';
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(-r * 0.48 + ex, -r * 0.42 + ey, r * 0.96, r * 0.56, 7);
    ctx.fill();
    ctx.stroke();

    // Pupils
    ctx.fillStyle = p.role === 'chaser' ? '#dc2626' : '#0f172a';
    ctx.beginPath();
    ctx.arc(-3.5 + ex * 1.3, -r * 0.14 + ey * 1.3, 2.2, 0, Math.PI * 2);
    ctx.arc(4.5 + ex * 1.3, -r * 0.14 + ey * 1.3, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Hats / Accessories
    if (p.hat && p.hat !== 'none') {
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const hatIcon = p.hat === 'crown' ? '👑' : p.hat === 'cat' ? '🐱' : p.hat === 'shades' ? '🕶️' : p.hat === 'pirate' ? '🏴‍☠️' : '🎀';
      const hy = p.hat === 'shades' ? -r * 0.14 + ey : -r * 1.15;
      ctx.fillText(hatIcon, p.hat === 'shades' ? ex : 0, hy);
    }

    // Chaser horns badge
    if (p.role === 'chaser') {
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('😈', 0, -r * 1.5);
    }

    ctx.restore();

    // Status overlays (Bubble shield, Ice freeze, Confusion stars)
    if (p.shieldActive) {
      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y + jumpY, r + 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (p.freezeTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(125, 211, 252, 0.55)';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(p.x - r - 3, p.y - r - 3, (r + 3) * 2, (r + 3) * 2, 6);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (p.confuseTimer > 0) {
      ctx.font = '15px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('😵💫', p.x, p.y - r - 18);
    }

    // Name tag
    ctx.save();
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#111827';
    ctx.fillText(p.name, p.x + 1, p.y + r + 21);
    ctx.fillStyle = p.role === 'chaser' ? '#fca5a5' : '#ffffff';
    ctx.fillText(p.name, p.x, p.y + r + 20);
    ctx.restore();

    // Emote Bubble
    if (p.emote) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(p.x - 18, p.y - r - 48, 36, 30, 10);
      ctx.fill();
      ctx.stroke();
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.emote, p.x, p.y - r - 33);
      ctx.restore();
    }
  }

  drawProjectiles(engine) {
    const ctx = this.ctx;
    for (const pr of engine.projectiles) {
      ctx.save();
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const ic = pr.type === 'slime_jar' ? '🟢' : pr.type === 'flashbang' ? '📸' : '😵';
      ctx.fillText(ic, pr.x, pr.y);
      ctx.restore();
    }
  }

  drawSmokes(engine, local) {
    const ctx = this.ctx;
    for (const s of engine.smokes) {
      ctx.save();
      ctx.fillStyle = 'rgba(148, 163, 184, 0.92)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
      // Billowing inner puffs
      ctx.fillStyle = 'rgba(203, 213, 225, 0.8)';
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2 + this.time * 0.5;
        ctx.beginPath();
        ctx.arc(s.x + Math.cos(ang) * s.radius * 0.45, s.y + Math.sin(ang) * s.radius * 0.45, s.radius * 0.48, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawParticles(engine) {
    const ctx = this.ctx;
    for (const pt of engine.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
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
    ctx.fillStyle = 'rgba(220, 38, 38, 0.32)';
    ctx.fill();

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.setLineDash([12, 8]);
    ctx.beginPath();
    ctx.arc(WORLD_W / 2, WORLD_H / 2, Math.max(10, engine.poisonRadius), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawFloatingTexts(engine) {
    const ctx = this.ctx;
    for (const ft of engine.floatingTexts) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#0f172a';
      ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    }
  }

  drawBlackout(local) {
    const ctx = this.ctx;
    ctx.save();
    const grad = ctx.createRadialGradient(local.x, local.y, 70, local.x, local.y, 130);
    grad.addColorStop(0, 'rgba(2, 6, 23, 0)');
    grad.addColorStop(1, 'rgba(2, 6, 23, 0.94)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.restore();
  }

  // Raycasted Fog of War around walls
  drawFogOfWar(engine, local) {
    const ctx = this.ctx;
    const maxDist = 370;
    const rays = 96;
    const poly = [];

    for (let i = 0; i < rays; i++) {
      const ang = (i / rays) * Math.PI * 2;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      let dist = maxDist;
      for (let d = 24; d <= maxDist; d += 12) {
        const tx = Math.floor((local.x + dx * d) / TILE_SIZE);
        const ty = Math.floor((local.y + dy * d) / TILE_SIZE);
        if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS || engine.grid[ty][tx] === TILE.WALL) {
          dist = d;
          break;
        }
      }
      poly.push({ x: local.x + dx * dist, y: local.y + dy * dist });
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WORLD_W, WORLD_H);
    ctx.moveTo(poly[0].x, poly[0].y);
    for (let i = poly.length - 1; i >= 0; i--) {
      ctx.lineTo(poly[i].x, poly[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.58)';
    ctx.fill('evenodd');
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
      const ax = local.x + Math.cos(ang) * 58;
      const ay = local.y + Math.sin(ang) * 58;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang);
      ctx.fillStyle = o.role === 'chaser' ? '#ef4444' : '#38bdf8';
      ctx.strokeStyle = '#111827';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-7, -7);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-7, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  drawSpectatorHint(engine) {
    const ctx = this.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(TILE_SIZE, TILE_SIZE, WORLD_W - TILE_SIZE * 2, WORLD_H - TILE_SIZE * 2);
    ctx.restore();
  }

  drawScreenOverlays(engine, local) {
    const ctx = this.ctx;
    // Heartbeat red edge vignette when chaser is close to runner
    if (local.role === 'runner') {
      let minD = Infinity;
      for (const o of engine.players) {
        if (o.role === 'chaser' && !o.caught) {
          const d = Math.hypot(o.x - local.x, o.y - local.y);
          if (d < minD) minD = d;
        }
      }
      if (minD < 260) {
        const intensity = Math.max(0, 1 - minD / 260);
        const pulse = 0.5 + 0.5 * Math.sin(this.time * (8 + intensity * 12));
        const alpha = intensity * (0.25 + pulse * 0.25);
        const grad = ctx.createRadialGradient(
          this.viewW / 2, this.viewH / 2, Math.min(this.viewW, this.viewH) * 0.25,
          this.viewW / 2, this.viewH / 2, Math.max(this.viewW, this.viewH) * 0.65
        );
        grad.addColorStop(0, 'rgba(239,68,68,0)');
        grad.addColorStop(1, `rgba(239,68,68,${alpha.toFixed(2)})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.viewW, this.viewH);
      }
    }

    // Flashbang whiteout
    if (local.blindTimer > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.95, local.blindTimer)})`;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }

    // Ink splatter
    if (local.inkTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      const cx = this.viewW * 0.5;
      const cy = this.viewH * 0.5;
      for (let i = 0; i < 7; i++) {
        const ang = i * 0.9;
        const r = Math.min(this.viewW, this.viewH) * (0.14 + (i % 3) * 0.05);
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * 90, cy + Math.sin(ang) * 65, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}
