// 《代號：極限追逐》(Tag & Chaos) — Grid A* Pathfinding & AI Controller
import { TILE, TILE_SIZE, MAP_COLS, MAP_ROWS, ITEM_BY_ID } from './constants.js';

function isTileWalkable(engine, tx, ty, canJump = false) {
  if (tx < 0 || ty < 0 || tx >= MAP_COLS || ty >= MAP_ROWS) return false;
  const t = engine.grid[ty][tx];
  if (t === TILE.WALL) return false;
  if (t === TILE.GATE && engine.gateClosedTimer > 0) return false;
  if (!canJump && t === TILE.LOW_BOX) return false;
  if (!canJump && t === TILE.CRATE) return false;
  return true;
}

// Fast bounded A* on 28x20 grid
export function findNextDir(engine, sx, sy, gx, gy, canJump = false) {
  const startTx = Math.max(0, Math.min(MAP_COLS - 1, Math.floor(sx / TILE_SIZE)));
  const startTy = Math.max(0, Math.min(MAP_ROWS - 1, Math.floor(sy / TILE_SIZE)));
  const goalTx = Math.max(0, Math.min(MAP_COLS - 1, Math.floor(gx / TILE_SIZE)));
  const goalTy = Math.max(0, Math.min(MAP_ROWS - 1, Math.floor(gy / TILE_SIZE)));

  if (startTx === goalTx && startTy === goalTy) {
    const dx = gx - sx;
    const dy = gy - sy;
    const len = Math.hypot(dx, dy) || 1;
    return { dx: dx / len, dy: dy / len };
  }

  const total = MAP_COLS * MAP_ROWS;
  const gScore = new Float32Array(total).fill(1e9);
  const parent = new Int16Array(total).fill(-1);
  const closed = new Uint8Array(total);
  const startIdx = startTy * MAP_COLS + startTx;
  const goalIdx = goalTy * MAP_COLS + goalTx;
  gScore[startIdx] = 0;

  const open = [{ idx: startIdx, f: Math.abs(goalTx - startTx) + Math.abs(goalTy - startTy) }];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let bestIdx = startIdx;
  let bestDist = 1e9;
  let steps = 0;

  while (open.length > 0 && steps < 280) {
    steps++;
    let minPos = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i].f < open[minPos].f) minPos = i;
    }
    const cur = open.splice(minPos, 1)[0].idx;
    if (cur === goalIdx) {
      bestIdx = cur;
      break;
    }
    if (closed[cur]) continue;
    closed[cur] = 1;

    const cx = cur % MAP_COLS;
    const cy = Math.floor(cur / MAP_COLS);
    const h = Math.abs(goalTx - cx) + Math.abs(goalTy - cy);
    if (h < bestDist) {
      bestDist = h;
      bestIdx = cur;
    }

    for (const [ox, oy] of dirs) {
      const nx = cx + ox;
      const ny = cy + oy;
      if (!isTileWalkable(engine, nx, ny, canJump)) continue;
      const nIdx = ny * MAP_COLS + nx;
      if (closed[nIdx]) continue;
      // Slightly discourage stepping into known traps or poison
      let cost = 1;
      if (engine.grid[ny][nx] === TILE.WATER) cost += 0.2;
      const tentG = gScore[cur] + cost;
      if (tentG < gScore[nIdx]) {
        gScore[nIdx] = tentG;
        parent[nIdx] = cur;
        open.push({ idx: nIdx, f: tentG + Math.abs(goalTx - nx) + Math.abs(goalTy - ny) });
      }
    }
  }

  let stepIdx = bestIdx;
  while (parent[stepIdx] !== -1 && parent[stepIdx] !== startIdx) {
    stepIdx = parent[stepIdx];
  }

  if (stepIdx === startIdx) {
    const dx = gx - sx;
    const dy = gy - sy;
    const len = Math.hypot(dx, dy) || 1;
    return { dx: dx / len, dy: dy / len };
  }

  const targetX = (stepIdx % MAP_COLS + 0.5) * TILE_SIZE;
  const targetY = (Math.floor(stepIdx / MAP_COLS) + 0.5) * TILE_SIZE;
  const dx = targetX - sx;
  const dy = targetY - sy;
  const len = Math.hypot(dx, dy) || 1;
  return { dx: dx / len, dy: dy / len };
}

export function computeAIInput(engine, p, dt) {
  if (!p.aiState) {
    p.aiState = {
      thinkTimer: 0,
      patrolX: p.x,
      patrolY: p.y,
      cachedDir: { dx: 0, dy: 0 },
      reactionDelay: p.aiDiff === 'easy' ? 0.35 : p.aiDiff === 'normal' ? 0.16 : 0.06,
    };
  }
  const st = p.aiState;
  st.thinkTimer -= dt;

  const canJump = p.pogoTimer > 0;
  const isHell = p.aiDiff === 'hell';
  const isEasy = p.aiDiff === 'easy';

  let dash = false;
  let useItem = false;

  // Check if player should use held item
  const activeItem = p.items[p.activeSlot];
  if (activeItem) {
    const itemChance = isEasy ? 0.012 : isHell ? 0.14 : 0.045;
    if (Math.random() < itemChance * (dt * 60) * 0.15) {
      const meta = ITEM_BY_ID[activeItem];
      if (meta) {
        const enemies = engine.players.filter((o) => engine.areOpponents(p, o) && !o.caught && !o.caged && !o.escaped);
        let nearestDist = Infinity;
        for (const e of enemies) {
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < nearestDist) nearestDist = d;
        }
        if (activeItem === 'radar' || activeItem === 'chaos_bell' || activeItem === 'slowmo' || activeItem === 'cloak' || activeItem === 'shield') {
          useItem = true;
        } else if (activeItem === 'turbo' || activeItem === 'pogo' || activeItem === 'rocket') {
          if (nearestDist < 360) useItem = true;
        } else if (meta.cat === 'trap') {
          if (nearestDist < 260 || Math.random() < 0.25) useItem = true;
        } else if (nearestDist < 280) {
          useItem = true;
        }
      }
    }
  }

  if (st.thinkTimer <= 0) {
    st.thinkTimer = st.reactionDelay + Math.random() * 0.08;

    if (p.role === 'chaser') {
      // Chaser AI: find nearest visible/trackable runner (or rescue-mode active runner)
      let target = null;
      let bestScore = Infinity;

      for (const o of engine.players) {
        if (o.id === p.id || o.role !== 'runner' || o.caught || o.caged || o.escaped) continue;
        // Hidden in cloak unless radar active
        if (o.cloakTimer > 0 && p.radarTimer <= 0) continue;
        // Hidden in bush unless chaser is in bush or has radar
        if (engine.isInBush(o) && !engine.isInBush(p) && p.radarTimer <= 0) continue;

        const d = Math.hypot(o.x - p.x, o.y - p.y);
        // Hell AI predicts slight lead position
        if (d < bestScore) {
          bestScore = d;
          target = o;
        }
      }

      if (target) {
        let tx = target.x;
        let ty = target.y;
        if (isHell && bestScore < 260) {
          tx += target.vx * 0.22;
          ty += target.vy * 0.22;
        }
        st.cachedDir = findNextDir(engine, p.x, p.y, tx, ty, canJump);
        if (bestScore < 115 && p.dashCooldown <= 0 && !isEasy) {
          dash = true;
        }
      } else {
        // Patrol nearest item box or random walkable point
        let goal = null;
        if (engine.itemBoxes.length > 0 && Math.random() < 0.55) {
          goal = engine.itemBoxes[Math.floor(Math.random() * engine.itemBoxes.length)];
        }
        if (goal) {
          st.cachedDir = findNextDir(engine, p.x, p.y, goal.x, goal.y, canJump);
        } else {
          if (Math.hypot(st.patrolX - p.x, st.patrolY - p.y) < 48 || Math.random() < 0.2) {
            const pt = engine.getRandomWalkablePos();
            st.patrolX = pt.x;
            st.patrolY = pt.y;
          }
          st.cachedDir = findNextDir(engine, p.x, p.y, st.patrolX, st.patrolY, canJump);
        }
      }
    } else {
      // Runner AI
      let nearestChaser = null;
      let chaserDist = Infinity;
      for (const o of engine.players) {
        if (o.role !== 'chaser' || o.caught) continue;
        if (o.cloakTimer > 0 && p.radarTimer <= 0) continue;
        const d = Math.hypot(o.x - p.x, o.y - p.y);
        if (d < chaserDist) {
          chaserDist = d;
          nearestChaser = o;
        }
      }

      // Priority 1: Escape keys / open escape gate / rescue cage!
      let objective = null;
      if (engine.mode === 'escape') {
        if (engine.escapeGateOpen && engine.escapeGatePos) {
          objective = engine.escapeGatePos;
        } else if (engine.keys.length > 0) {
          let kd = Infinity;
          for (const k of engine.keys) {
            const d = Math.hypot(k.x - p.x, k.y - p.y);
            if (d < kd) { kd = d; objective = k; }
          }
        }
      } else if (engine.mode === 'rescue' && engine.prisonPos) {
        const hasCaged = engine.players.some((o) => o.caged);
        if (hasCaged && (!nearestChaser || chaserDist > 180)) {
          objective = engine.prisonPos;
        }
      }

      if (nearestChaser && chaserDist < 280) {
        // Run away from chaser toward safest direction (center bias if poison active)
        const awayX = p.x - nearestChaser.x;
        const awayY = p.y - nearestChaser.y;
        const len = Math.hypot(awayX, awayY) || 1;
        let goalX = p.x + (awayX / len) * 240;
        let goalY = p.y + (awayY / len) * 240;

        // If poison ring shrinking, pull toward center
        if (engine.poisonRadius < engine.maxWorldRadius * 0.85) {
          goalX = goalX * 0.65 + (engine.worldW / 2) * 0.35;
          goalY = goalY * 0.65 + (engine.worldH / 2) * 0.35;
        }

        // Clamp inside world
        goalX = Math.max(TILE_SIZE * 1.5, Math.min(engine.worldW - TILE_SIZE * 1.5, goalX));
        goalY = Math.max(TILE_SIZE * 1.5, Math.min(engine.worldH - TILE_SIZE * 1.5, goalY));

        st.cachedDir = findNextDir(engine, p.x, p.y, goalX, goalY, canJump);

        if (chaserDist < 125 && p.dashCooldown <= 0 && !isEasy) {
          dash = true;
        }
      } else if (objective) {
        st.cachedDir = findNextDir(engine, p.x, p.y, objective.x, objective.y, canJump);
      } else {
        // Seek nearest item box or patrol
        let nearestBox = null;
        let boxDist = Infinity;
        if (!isEasy && p.items.length < p.maxItems) {
          for (const b of engine.itemBoxes) {
            const d = Math.hypot(b.x - p.x, b.y - p.y);
            if (d < boxDist) { boxDist = d; nearestBox = b; }
          }
        }
        if (nearestBox && boxDist < 420) {
          st.cachedDir = findNextDir(engine, p.x, p.y, nearestBox.x, nearestBox.y, canJump);
        } else {
          if (Math.hypot(st.patrolX - p.x, st.patrolY - p.y) < 48 || Math.random() < 0.12) {
            const pt = engine.getRandomWalkablePos();
            st.patrolX = pt.x;
            st.patrolY = pt.y;
          }
          st.cachedDir = findNextDir(engine, p.x, p.y, st.patrolX, st.patrolY, canJump);
        }
      }
    }
  }

  return {
    dx: st.cachedDir.dx,
    dy: st.cachedDir.dy,
    dash,
    useItem,
    swapSlot: false,
    emote: null,
  };
}
