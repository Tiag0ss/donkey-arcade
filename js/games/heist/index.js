import { createShellGame } from '../../shared/gameShell.js';
import { PALETTE } from '../../shared/donkey.js';
import { drawText, drawHearts } from '../../shared/ui.js';
import * as audio from '../../shared/audio.js';

const DEF = { id: 'heist', title: 'HEE-HAW HEIST' };

const TILE = 32;
/** Playfield target size in pixels (tiles stay 32px). */
const PLAY_W = 800;
const PLAY_H = 600;
const MAP_W = Math.ceil(PLAY_W / TILE); // 25 → 800px
const MAP_H = Math.ceil(PLAY_H / TILE); // 19 → 608px (viewport shows 600)
const SNEAK_SPEED = 2.0;
const RUN_SPEED = 3.7;
/** Guard sight range in tiles — must match the drawn cone exactly. */
const BASE_VISION = 4.4;
const STRIKE_IFRAME = 1.5;
const DISTRACT_CD = 1.1;
const DISTRACT_RANGE = 8;
const DISTRACT_DURATION = 2.4;

function quotaForFloor(floor) {
  let q = 3;
  for (let i = 1; i <= floor; i++) q += i + 1;
  return q;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function key(x, y) {
  return x + ',' + y;
}

function reachableFrom(map, W, H, sx, sy) {
  const seen = new Set([key(sx, sy)]);
  const list = [[sx, sy]];
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (map[ny][nx] !== 0) continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      list.push([nx, ny]);
      q.push([nx, ny]);
    }
  }
  return { seen, list };
}

/** BFS tile path. Returns centers [{x,y}, ...] or null. */
function findPath(map, W, H, sx, sy, gx, gy) {
  const startX = Math.max(0, Math.min(W - 1, Math.floor(sx)));
  const startY = Math.max(0, Math.min(H - 1, Math.floor(sy)));
  const goalX = Math.max(0, Math.min(W - 1, Math.floor(gx)));
  const goalY = Math.max(0, Math.min(H - 1, Math.floor(gy)));
  if (map[startY][startX] !== 0 || map[goalY][goalX] !== 0) return null;
  if (startX === goalX && startY === goalY) return [{ x: goalX + 0.5, y: goalY + 0.5 }];

  const startK = key(startX, startY);
  const goalK = key(goalX, goalY);
  const came = new Map();
  const q = [[startX, startY]];
  came.set(startK, null);
  let found = false;
  while (q.length) {
    const [x, y] = q.shift();
    if (key(x, y) === goalK) {
      found = true;
      break;
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (map[ny][nx] !== 0) continue;
      const k = key(nx, ny);
      if (came.has(k)) continue;
      came.set(k, key(x, y));
      q.push([nx, ny]);
    }
  }
  if (!found) return null;
  const tiles = [];
  let cur = goalK;
  while (cur) {
    const [cx, cy] = cur.split(',').map(Number);
    tiles.push({ x: cx + 0.5, y: cy + 0.5 });
    cur = came.get(cur);
  }
  tiles.reverse();
  // Drop the tile we're already standing on
  if (tiles.length > 1) tiles.shift();
  return tiles;
}

function clearArea(map, cx, cy, r, W, H) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (x > 0 && y > 0 && x < W - 1 && y < H - 1) map[y][x] = 0;
    }
  }
}

function paintBorder(map, W, H) {
  for (let x = 0; x < W; x++) {
    map[0][x] = 1;
    map[H - 1][x] = 1;
  }
  for (let y = 0; y < H; y++) {
    map[y][0] = 1;
    map[y][W - 1] = 1;
  }
}

/** Interior walls with door gaps — creates corners to hide behind. */
function placeRoomWalls(map, W, H, rnd) {
  const wallTries = 7 + Math.floor(rnd() * 4);
  for (let i = 0; i < wallTries; i++) {
    const horizontal = rnd() < 0.5;
    if (horizontal) {
      const y = 2 + Math.floor(rnd() * (H - 4));
      const x0 = 2 + Math.floor(rnd() * Math.max(1, W - 10));
      const len = 5 + Math.floor(rnd() * 8);
      const door = 1 + Math.floor(rnd() * Math.max(1, len - 2));
      for (let t = 0; t < len; t++) {
        const x = x0 + t;
        if (x <= 0 || x >= W - 1) continue;
        if (t === door || t === door + 1) continue; // doorway
        map[y][x] = 1;
      }
    } else {
      const x = 2 + Math.floor(rnd() * (W - 4));
      const y0 = 2 + Math.floor(rnd() * Math.max(1, H - 10));
      const len = 4 + Math.floor(rnd() * 6);
      const door = 1 + Math.floor(rnd() * Math.max(1, len - 2));
      for (let t = 0; t < len; t++) {
        const y = y0 + t;
        if (y <= 0 || y >= H - 1) continue;
        if (t === door || t === door + 1) continue;
        map[y][x] = 1;
      }
    }
  }
}

/** Crate clusters for LOS cover (tile 2). */
function placeCrateClusters(map, W, H, rnd, count) {
  const shapes = [
    [[0, 0]],
    [[0, 0], [1, 0]],
    [[0, 0], [0, 1]],
    [[0, 0], [1, 0], [0, 1]], // L
    [[0, 0], [1, 0], [0, 1], [1, 1]], // 2x2
    [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [0, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]], // long L
  ];
  for (let n = 0; n < count; n++) {
    const shape = shapes[Math.floor(rnd() * shapes.length)];
    const bx = 2 + Math.floor(rnd() * (W - 6));
    const by = 2 + Math.floor(rnd() * (H - 6));
    for (const [dx, dy] of shape) {
      const x = bx + dx;
      const y = by + dy;
      if (x > 0 && y > 0 && x < W - 1 && y < H - 1 && map[y][x] === 0) {
        map[y][x] = 2;
      }
    }
  }
}

function buildFloor(floor) {
  const W = MAP_W;
  const H = MAP_H;
  const start = { x: 2, y: H - 3 };
  const extract = { x: W - 3, y: 2 };
  let map = null;
  let reach = null;

  for (let attempt = 0; attempt < 12; attempt++) {
    const rnd = mulberry32(floor * 7919 + attempt * 104729 + 13);
    map = Array.from({ length: H }, () => Array(W).fill(0));
    paintBorder(map, W, H);
    placeRoomWalls(map, W, H, rnd);
    // Plenty of hide spots — denser on higher floors, but always lots of cover
    const clusters = 22 + Math.floor(floor * 1.5) + Math.floor(rnd() * 6) - attempt;
    placeCrateClusters(map, W, H, rnd, Math.max(16, clusters));
    // Scatter a few extra single crates
    const scatter = 0.08 + Math.min(0.06, floor * 0.01);
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (map[y][x] === 0 && rnd() < scatter) map[y][x] = 2;
      }
    }
    clearArea(map, start.x, start.y, 2, W, H);
    clearArea(map, extract.x, extract.y, 2, W, H);
    // carve a loose corridor so start↔exit usually connects
    for (let x = start.x; x <= extract.x; x++) {
      if (map[start.y][x] === 2) map[start.y][x] = 0;
      if (Math.abs(x - start.x) % 4 === 0 && map[start.y - 1]?.[x] === 2) map[start.y - 1][x] = 0;
    }
    for (let y = extract.y; y <= start.y; y++) {
      if (map[y][extract.x] === 2) map[y][extract.x] = 0;
    }

    reach = reachableFrom(map, W, H, start.x, start.y);
    const freeCount = (W - 2) * (H - 2);
    if (reach.seen.has(key(extract.x, extract.y)) && reach.list.length > freeCount * 0.4) break;
    map = null;
  }
  if (!map) {
    map = Array.from({ length: H }, () => Array(W).fill(0));
    paintBorder(map, W, H);
    const rnd = mulberry32(floor * 99 + 3);
    placeCrateClusters(map, W, H, rnd, 20);
    clearArea(map, start.x, start.y, 2, W, H);
    clearArea(map, extract.x, extract.y, 2, W, H);
    reach = reachableFrom(map, W, H, start.x, start.y);
  }

  const rnd2 = mulberry32(floor * 54321 + 7);
  const pool = reach.list.filter(([x, y]) => {
    const d1 = Math.hypot(x - start.x, y - start.y);
    const d2 = Math.hypot(x - extract.x, y - extract.y);
    return d1 > 2.5 && d2 > 2;
  });
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd2() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const quota = quotaForFloor(floor);
  const normalCount = Math.min(pool.length, quota + 3);
  const carrots = [];
  for (let i = 0; i < normalCount; i++) {
    const [x, y] = pool[i];
    carrots.push({ x, y, golden: false, taken: false });
  }
  if (floor > 0 && pool.length > normalCount) {
    const [x, y] = pool[normalCount];
    carrots.push({ x, y, golden: true, taken: false });
  }

  const guardCount = Math.min(7, 2 + Math.floor(floor * 1.1));
  const guards = [];
  const guardPool = pool.slice(normalCount + 2);
  for (let i = 0; i < guardCount; i++) {
    const a = guardPool[(i * 3) % Math.max(1, guardPool.length)] || [start.x + 3, start.y - 2];
    // Build a 3–4 point patrol loop with reachable, spaced waypoints
    const waypoints = [a];
    for (let n = 0; n < 3; n++) {
      let best = null;
      let bestScore = -1;
      for (let s = 0; s < 14; s++) {
        const cand = guardPool[(i * 11 + n * 17 + s * 5) % Math.max(1, guardPool.length)] || a;
        if (waypoints.some((w) => w[0] === cand[0] && w[1] === cand[1])) continue;
        const last = waypoints[waypoints.length - 1];
        const d = Math.hypot(cand[0] - last[0], cand[1] - last[1]);
        if (d < 3 || d > 12) continue;
        if (!findPath(map, W, H, last[0], last[1], cand[0], cand[1])) continue;
        if (d > bestScore) {
          bestScore = d;
          best = cand;
        }
      }
      if (best) waypoints.push(best);
    }
    if (waypoints.length < 2) {
      // Fallback: any other free tile
      for (const cand of guardPool) {
        if (cand[0] === a[0] && cand[1] === a[1]) continue;
        if (findPath(map, W, H, a[0], a[1], cand[0], cand[1])) {
          waypoints.push(cand);
          break;
        }
      }
    }
    if (waypoints.length < 2) waypoints.push(a);

    guards.push({
      x: a[0] + 0.5,
      y: a[1] + 0.5,
      angle: rnd2() * Math.PI * 2,
      waypoints,
      wpI: 1 % waypoints.length,
      path: null,
      pathI: 0,
      repathT: 0,
      stuckT: 0,
      lastX: a[0] + 0.5,
      lastY: a[1] + 0.5,
      state: 'patrol',
      suspicion: 0,
      chaseT: 0,
      investigateT: 0,
      investigateTarget: null,
      speed: 1.7 + Math.min(0.9, floor * 0.08),
      vision: BASE_VISION + Math.min(1.5, floor * 0.12),
    });
  }

  return { W, H, map, carrots, guards, extract, start, quota };
}

function lineOfSight(map, W, H, ax, ay, bx, by) {
  const steps = Math.max(4, Math.ceil(Math.hypot(bx - ax, by - ay) * 3));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = Math.floor(ax + (bx - ax) * t);
    const y = Math.floor(ay + (by - ay) * t);
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const tile = map[y][x];
    if (tile === 1 || tile === 2) return false;
  }
  return true;
}

export function createGame(canvas, api) {
  const { input, particles, drawDonkey: drawDk } = api;

  let floor = 0;
  let level = null;
  let px = 1;
  let py = 1;
  let carrying = false;
  let delivered = 0;
  let strikes = 0;
  let iframeT = 0;
  let totalCarrots = 0;
  let distracts = 0;
  let heeCooldown = 0;
  let alarm = false;
  let alarmSirenT = 0;
  let ghostFloors = 0;
  let floorStruck = false;
  let stealthBonus = 0;
  let gameEnded = false;
  let finished = false;
  let runPhase = 0;
  let camX = 0;
  let camY = 0;
  let strikeFlashT = 0;
  let moveFacing = 1;

  function loadFloor() {
    level = buildFloor(floor);
    // Continuous position = center of the start tile
    px = level.start.x + 0.5;
    py = level.start.y + 0.5;
    carrying = false;
    delivered = 0;
    floorStruck = false;
  }

  function reset() {
    floor = 0;
    strikes = 0;
    iframeT = 0;
    totalCarrots = 0;
    distracts = 0;
    heeCooldown = 0;
    alarm = false;
    ghostFloors = 0;
    stealthBonus = 0;
    gameEnded = false;
    finished = false;
    runPhase = 0;
    strikeFlashT = 0;
    loadFloor();
  }

  function tileBlocked(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= level.W || ty >= level.H) return true;
    const t = level.map[ty][tx];
    return t === 1 || t === 2;
  }

  // Radii in tile units — tuned to sprite footprints (donkey ~22px, guard ~16px)
  const PLAYER_R = 0.32;
  const GUARD_R = 0.3;
  const CATCH_R = PLAYER_R + GUARD_R; // ~0.62 — must visually overlap
  const PICKUP_R = 0.55;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  /** Push a circle out of solid tiles (proper circle–AABB). */
  function resolveCircle(x, y, r) {
    let nx = x;
    let ny = y;
    const x0 = Math.floor(nx - r) - 1;
    const x1 = Math.floor(nx + r) + 1;
    const y0 = Math.floor(ny - r) - 1;
    const y1 = Math.floor(ny + r) + 1;
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!tileBlocked(tx, ty)) continue;
        const nearestX = clamp(nx, tx, tx + 1);
        const nearestY = clamp(ny, ty, ty + 1);
        let dx = nx - nearestX;
        let dy = ny - nearestY;
        let d2 = dx * dx + dy * dy;
        if (d2 >= r * r) continue;
        if (d2 < 1e-10) {
          // Center inside solid — eject to nearest edge
          const left = nx - tx;
          const right = tx + 1 - nx;
          const up = ny - ty;
          const down = ty + 1 - ny;
          const m = Math.min(left, right, up, down);
          if (m === left) nx = tx - r;
          else if (m === right) nx = tx + 1 + r;
          else if (m === up) ny = ty - r;
          else ny = ty + 1 + r;
        } else {
          const d = Math.sqrt(d2);
          const push = (r - d) / d;
          nx += dx * push;
          ny += dy * push;
        }
      }
    }
    return { x: nx, y: ny };
  }

  /** Move with axis slide + circle resolution against walls. */
  function moveEntity(ex, ey, mdx, mdy, r) {
    let pos = resolveCircle(ex + mdx, ey, r);
    pos = resolveCircle(pos.x, ey + mdy, r);
    return pos;
  }

  function nearTile(tx, ty, range = PICKUP_R) {
    return Math.hypot(px - (tx + 0.5), py - (ty + 0.5)) <= range;
  }

  function setGuardPath(g, tx, ty) {
    g.path = findPath(level.map, level.W, level.H, g.x, g.y, tx, ty);
    g.pathI = 0;
    g.repathT = 0.45;
  }

  /** Walk along current path; returns true if a step was attempted. */
  function followPath(g, speed, dt) {
    if (!g.path || g.pathI >= g.path.length) return false;
    const node = g.path[g.pathI];
    const tx = node.x - g.x;
    const ty = node.y - g.y;
    const d = Math.hypot(tx, ty);
    if (d < 0.2) {
      g.pathI++;
      return g.pathI < g.path.length;
    }
    const step = Math.min(speed * dt, d);
    const moved = moveEntity(g.x, g.y, (tx / d) * step, (ty / d) * step, GUARD_R);
    g.x = moved.x;
    g.y = moved.y;
    g.angle = Math.atan2(ty, tx);
    return true;
  }

  function updateStuck(g, dt) {
    const moved = Math.hypot(g.x - g.lastX, g.y - g.lastY);
    if (moved < 0.02) g.stuckT += dt;
    else g.stuckT = 0;
    g.lastX = g.x;
    g.lastY = g.y;
    if (g.stuckT > 0.7) {
      g.stuckT = 0;
      g.path = null;
      // Nudge toward a free neighbor so resolveCircle isn't wedged
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const nx = g.x + dx * 0.35;
        const ny = g.y + dy * 0.35;
        const resolved = resolveCircle(nx, ny, GUARD_R);
        if (Math.hypot(resolved.x - g.x, resolved.y - g.y) > 0.05) {
          g.x = resolved.x;
          g.y = resolved.y;
          break;
        }
      }
      return true;
    }
    return false;
  }

  function addStrike() {
    if (iframeT > 0) return;
    strikes++;
    floorStruck = true;
    iframeT = STRIKE_IFRAME;
    strikeFlashT = 0.5;
    audio.hurt();
    particles.burst(px * TILE, py * TILE, PALETTE.danger, 14, 140);
    if (strikes >= 3) {
      gameEnded = true;
      audio.die();
    }
  }

  const controller = {
    reset() {
      reset();
    },
    updatePlay(dt, endFn) {
      if (finished) return true;
      if (gameEnded) {
        finished = true;
        const score = totalCarrots * 200 + floor * 500 + stealthBonus + distracts * 10;
        endFn({
          title: 'CAUGHT!',
          score,
          time: 0,
          stats: [`Reached floor ${floor + 1}`, `Carrots ${totalCarrots}`, `Distractions ${distracts}`],
          extra: { floor, carrots: totalCarrots, distracts, ghostFloors },
        });
        return true;
      }

      runPhase += dt * 9;
      heeCooldown = Math.max(0, heeCooldown - dt);
      iframeT = Math.max(0, iframeT - dt);
      if (strikeFlashT > 0) strikeFlashT -= dt;

      const sneak = input.p1Sneak();
      const spd = sneak ? SNEAK_SPEED : RUN_SPEED;
      let dx = 0;
      let dy = 0;
      if (input.down('w') || input.down('ArrowUp')) dy -= 1;
      if (input.down('s') || input.down('ArrowDown')) dy += 1;
      if (input.down('a') || input.down('ArrowLeft')) dx -= 1;
      if (input.down('d') || input.down('ArrowRight')) dx += 1;
      if (dx || dy) {
        const len = Math.hypot(dx, dy) || 1;
        moveFacing = dx < 0 ? -1 : dx > 0 ? 1 : moveFacing;
        const step = spd * dt;
        const moved = moveEntity(px, py, (dx / len) * step, (dy / len) * step, PLAYER_R);
        px = moved.x;
        py = moved.y;
      }

      if (input.pressed('Space') && heeCooldown <= 0) {
        heeCooldown = DISTRACT_CD;
        distracts++;
        audio.heehaw();
        particles.burst(px * TILE, py * TILE, PALETTE.accent, 12, 110);
        let nearest = null;
        let nearestD = DISTRACT_RANGE;
        for (const g of level.guards) {
          if (g.state === 'chase') continue;
          const d = Math.hypot(g.x - px, g.y - py);
          if (d < nearestD) {
            nearestD = d;
            nearest = g;
          }
        }
        if (nearest) {
          nearest.state = 'investigate';
          nearest.investigateTarget = { x: px, y: py };
          nearest.investigateT = DISTRACT_DURATION;
          nearest.suspicion = Math.max(0, nearest.suspicion - 0.5);
          nearest.path = null;
          nearest.repathT = 0;
        }
      }

      for (const c of level.carrots) {
        if (c.taken) continue;
        if (!nearTile(c.x, c.y, PICKUP_R + 0.15)) continue;
        if (c.golden) {
          c.taken = true;
          if (strikes > 0) {
            strikes--;
            audio.medal();
          } else {
            totalCarrots += 1;
            stealthBonus += 100;
            audio.pickup();
          }
          particles.burst(px * TILE, py * TILE, '#ffe060', 10, 110);
        } else if (!carrying) {
          c.taken = true;
          carrying = true;
          audio.pickup();
          particles.burst(px * TILE, py * TILE, '#ff8a40', 6, 80);
        }
      }

      if (carrying && nearTile(level.extract.x, level.extract.y, PICKUP_R + 0.2)) {
        carrying = false;
        delivered++;
        totalCarrots++;
        audio.start();
        particles.burst(px * TILE, py * TILE, '#6aab5a', 10, 100);
        if (delivered >= level.quota) {
          if (!floorStruck) {
            ghostFloors++;
            stealthBonus += 200;
          }
          floor++;
          loadFloor();
        }
      }

      let chasers = 0;
      for (const g of level.guards) {
        g.repathT = Math.max(0, g.repathT - dt);
        const wasStuck = updateStuck(g, dt);

        if (g.state === 'investigate') {
          g.investigateT -= dt;
          const tx = g.investigateTarget.x;
          const ty = g.investigateTarget.y;
          const d = Math.hypot(tx - g.x, ty - g.y);
          if (d > 0.35) {
            if (!g.path || g.pathI >= (g.path?.length || 0) || g.repathT <= 0 || wasStuck) {
              setGuardPath(g, tx, ty);
            }
            followPath(g, g.speed * 0.95, dt);
          }
          if (g.investigateT <= 0 || d < 0.35) {
            g.state = 'patrol';
            g.suspicion = 0;
            g.path = null;
          }
          continue;
        }

        const dist = Math.hypot(px - g.x, py - g.y);
        const seeRange = g.vision;
        const fov = g.state === 'chase' ? 0.95 : 0.55;
        const angToP = Math.atan2(py - g.y, px - g.x);
        let da = angToP - g.angle;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        const sees =
          dist < seeRange &&
          Math.abs(da) < fov &&
          lineOfSight(level.map, level.W, level.H, g.x, g.y, px, py);

        if (sees) {
          g.suspicion = Math.min(1.4, g.suspicion + dt * (sneak ? 0.35 : 1.35));
          if (g.suspicion > 1) {
            if (g.state !== 'chase') {
              g.state = 'chase';
              g.path = null;
            }
          } else if (g.suspicion > 0.3) g.state = 'alert';
        } else {
          g.suspicion = Math.max(0, g.suspicion - dt * 0.55);
          if (g.suspicion <= 0 && g.state !== 'patrol') {
            g.state = 'patrol';
            g.path = null;
          }
        }

        if (g.state === 'chase') {
          chasers++;
          g.chaseT += dt;
          const sp = g.speed * (alarm ? 1.2 : 1.05);
          // Direct step if clear LOS and close; otherwise path around walls
          const clear = lineOfSight(level.map, level.W, level.H, g.x, g.y, px, py);
          if (clear && dist < 3.5) {
            const d = dist || 1;
            const moved = moveEntity(
              g.x,
              g.y,
              ((px - g.x) / d) * sp * dt,
              ((py - g.y) / d) * sp * dt,
              GUARD_R
            );
            g.x = moved.x;
            g.y = moved.y;
            g.angle = Math.atan2(py - g.y, px - g.x);
            g.path = null;
          } else {
            if (!g.path || g.pathI >= (g.path?.length || 0) || g.repathT <= 0 || wasStuck) {
              setGuardPath(g, px, py);
            }
            if (!followPath(g, sp, dt)) {
              // Path exhausted or failed — try a fresh one next tick
              g.path = null;
              g.angle = Math.atan2(py - g.y, px - g.x);
            }
          }
          if (dist < CATCH_R) addStrike();
        } else if (g.state === 'alert') {
          // Keep walking the patrol slowly while turning toward the player
          g.angle = angToP;
          const target = g.waypoints[g.wpI];
          if (!g.path || g.pathI >= (g.path?.length || 0) || wasStuck) {
            setGuardPath(g, target[0] + 0.5, target[1] + 0.5);
          }
          followPath(g, g.speed * 0.55, dt);
          if (Math.hypot(target[0] + 0.5 - g.x, target[1] + 0.5 - g.y) < 0.35) {
            g.wpI = (g.wpI + 1) % g.waypoints.length;
            g.path = null;
          }
        } else {
          // Patrol
          const target = g.waypoints[g.wpI];
          const td = Math.hypot(target[0] + 0.5 - g.x, target[1] + 0.5 - g.y);
          if (td < 0.35) {
            g.wpI = (g.wpI + 1) % g.waypoints.length;
            g.path = null;
          } else {
            if (!g.path || g.pathI >= (g.path?.length || 0) || wasStuck) {
              setGuardPath(g, target[0] + 0.5, target[1] + 0.5);
            }
            if (!followPath(g, 1.55 + g.speed * 0.15, dt)) {
              // Can't reach — skip to next waypoint
              g.wpI = (g.wpI + 1) % g.waypoints.length;
              g.path = null;
            }
          }
        }
      }

      const wasAlarm = alarm;
      alarm = chasers >= 2;
      if (alarm) {
        alarmSirenT -= dt;
        if (alarmSirenT <= 0) {
          alarmSirenT = 0.7;
          audio.alarm();
        }
      } else if (wasAlarm) {
        alarmSirenT = 0;
      }

      return false;
    },

    drawPlay(ctx, cw, ch) {
      // Fixed 800×600 play window (map is MAP_W×MAP_H tiles @ 32px)
      const viewW = Math.min(PLAY_W, level.W * TILE);
      const viewH = Math.min(PLAY_H, level.H * TILE);
      const offX = Math.floor((cw - viewW) / 2);
      const offY = Math.floor((ch - viewH) / 2);

      const maxCamX = Math.max(0, level.W * TILE - viewW);
      const maxCamY = Math.max(0, level.H * TILE - viewH);
      // px/py are already tile centers
      camX = Math.max(0, Math.min(maxCamX, px * TILE - viewW / 2));
      camY = Math.max(0, Math.min(maxCamY, py * TILE - viewH / 2));

      ctx.fillStyle = '#0a0c08';
      ctx.fillRect(0, 0, cw, ch);
      // frame around playfield
      ctx.fillStyle = '#1a2016';
      ctx.fillRect(offX - 6, offY - 6, viewW + 12, viewH + 12);
      ctx.strokeStyle = PALETTE.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(offX - 6, offY - 6, viewW + 12, viewH + 12);

      ctx.save();
      ctx.beginPath();
      ctx.rect(offX, offY, viewW, viewH);
      ctx.clip();
      ctx.translate(offX - camX, offY - camY);

      const tx0 = Math.floor(camX / TILE);
      const ty0 = Math.floor(camY / TILE);
      const tx1 = Math.ceil((camX + viewW) / TILE);
      const ty1 = Math.ceil((camY + viewH) / TILE);
      for (let y = Math.max(0, ty0); y < Math.min(level.H, ty1); y++) {
        for (let x = Math.max(0, tx0); x < Math.min(level.W, tx1); x++) {
          const t = level.map[y][x];
          const sx = x * TILE;
          const sy = y * TILE;
          if (t === 1) {
            ctx.fillStyle = '#39352c';
            ctx.fillRect(sx, sy, TILE, TILE);
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(sx, sy + TILE - 5, TILE, 5);
          } else if (t === 2) {
            ctx.fillStyle = (x + y) % 2 ? '#273025' : '#242c22';
            ctx.fillRect(sx, sy, TILE, TILE);
            ctx.fillStyle = '#6a5038';
            ctx.fillRect(sx + 3, sy + 3, TILE - 6, TILE - 6);
            ctx.strokeStyle = '#3c2c1c';
            ctx.lineWidth = 2;
            ctx.strokeRect(sx + 3, sy + 3, TILE - 6, TILE - 6);
          } else {
            ctx.fillStyle = (x + y) % 2 ? '#2a3326' : '#263022';
            ctx.fillRect(sx, sy, TILE, TILE);
          }
        }
      }

      const ex = level.extract;
      const pulse = 0.5 + Math.sin(runPhase * 1.5) * 0.15;
      ctx.fillStyle = `rgba(106,171,90,${0.5 + pulse * 0.4})`;
      ctx.fillRect(ex.x * TILE + 3, ex.y * TILE + 3, TILE - 6, TILE - 6);
      drawText(ctx, 'EXIT', ex.x * TILE + 4, ex.y * TILE + 11, { font: 'bold 9px Courier New, monospace', color: '#13200f' });

      for (const c of level.carrots) {
        if (c.taken) continue;
        const cx = c.x * TILE + TILE / 2;
        const cy = c.y * TILE + TILE / 2 + Math.sin(runPhase * 2 + c.x) * 2;
        ctx.fillStyle = c.golden ? '#ffe060' : '#ff7a30';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 10);
        ctx.lineTo(cx + 8, cy + 8);
        ctx.lineTo(cx - 8, cy + 8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#3a8040';
        ctx.fillRect(cx - 2, cy - 14, 4, 6);
        if (c.golden) {
          ctx.strokeStyle = 'rgba(255,230,120,0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 14 + Math.sin(runPhase * 3) * 2, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      for (const g of level.guards) {
        const gx = g.x * TILE;
        const gy = g.y * TILE;
        const coneColor =
          g.state === 'chase'
            ? 'rgba(210,70,55,0.4)'
            : g.state === 'alert'
            ? 'rgba(230,160,60,0.32)'
            : g.state === 'investigate'
            ? 'rgba(160,160,255,0.22)'
            : 'rgba(255,235,140,0.2)';
        // Pixel range = vision tiles * TILE (same as detection)
        const range = g.vision * TILE;
        const fov = g.state === 'chase' ? 0.95 : 0.55;
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(g.angle);
        ctx.fillStyle = coneColor;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, range, -fov, fov);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = g.state === 'chase' ? '#a03a30' : '#4a5aa0';
        ctx.fillRect(gx - 8, gy - 14, 16, 22);
        ctx.fillStyle = '#ffd0a0';
        ctx.beginPath();
        ctx.arc(gx, gy - 18, 8, 0, Math.PI * 2);
        ctx.fill();
        if (g.state === 'investigate') {
          drawText(ctx, '?', gx, gy - 34, { align: 'center', color: '#c0c0ff', font: 'bold 14px Courier New, monospace' });
        } else if (g.state === 'alert') {
          drawText(ctx, '!', gx, gy - 34, { align: 'center', color: '#ffcf60', font: 'bold 14px Courier New, monospace' });
        } else if (g.state === 'chase') {
          drawText(ctx, '!!', gx, gy - 34, { align: 'center', color: '#ff6050', font: 'bold 14px Courier New, monospace' });
        }
      }

      // Anchor sprite feet on collision center (local mid-x≈21, feet y≈56)
      // facing flips around origin, so offset X by facing so body stays centered
      const donkeyX = px * TILE;
      const donkeyY = py * TILE;
      const dkScale = 0.58;
      const dkOx = donkeyX - moveFacing * 21 * dkScale;
      const dkOy = donkeyY - 56 * dkScale;
      if (iframeT <= 0 || Math.floor(iframeT * 14) % 2 === 0) {
        drawDk(ctx, {
          x: dkOx,
          y: dkOy,
          scale: dkScale,
          facing: moveFacing,
          pose: input.p1Sneak() ? 'sneak' : 'run',
          runPhase,
        });
      }
      // Carrot at snout tip (local ~44,16)
      if (carrying) {
        const mx = dkOx + moveFacing * dkScale * 44;
        const my = dkOy + dkScale * 16;
        ctx.fillStyle = '#ff7a30';
        ctx.beginPath();
        ctx.moveTo(mx + moveFacing * 11, my);
        ctx.lineTo(mx - moveFacing * 3, my - 6);
        ctx.lineTo(mx - moveFacing * 3, my + 6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#3a8040';
        ctx.fillRect(mx - moveFacing * 5 - 2, my - 9, 5, 5);
      }

      ctx.restore();

      if (strikeFlashT > 0) {
        ctx.fillStyle = `rgba(200,50,40,${0.3 * (strikeFlashT / 0.5)})`;
        ctx.fillRect(0, 0, cw, ch);
      }
      if (alarm) {
        ctx.fillStyle = `rgba(200,40,30,${0.08 + Math.sin(runPhase * 8) * 0.04})`;
        ctx.fillRect(0, 0, cw, ch);
      }

      // HUD — above playfield when possible
      const hudY = Math.max(8, offY - 52);
      drawText(ctx, `FLOOR ${floor + 1}`, offX, hudY, {
        font: 'bold 17px Courier New, monospace',
        color: PALETTE.accent,
      });
      drawText(ctx, `Carrots ${delivered}/${level.quota}`, offX, hudY + 22, { color: PALETTE.text });
      drawHearts(ctx, offX + 160, hudY + 18, Math.max(0, 3 - strikes), 3);
      if (alarm) {
        drawText(ctx, 'ALARM!', cw / 2, hudY, {
          align: 'center',
          color: PALETTE.danger,
          font: 'bold 16px Courier New, monospace',
        });
      }
      const footY = Math.min(ch - 14, offY + viewH + 18);
      drawText(ctx, carrying ? 'CARRYING A CARROT' : 'Hands empty', offX, footY, {
        color: carrying ? '#ff9050' : '#6a7860',
        font: '11px Courier New, monospace',
      });
      drawText(ctx, heeCooldown > 0 ? `Hee-haw ${heeCooldown.toFixed(1)}s` : 'Hee-haw READY', offX + viewW, footY, {
        align: 'right',
        color: heeCooldown > 0 ? '#6a7860' : PALETTE.good,
        font: '11px Courier New, monospace',
      });

      // minimap
      const mmW = 120;
      const mmH = Math.max(70, Math.min(90, (mmW * level.H) / level.W));
      const mmX = offX + viewW - mmW;
      const mmY = Math.max(8, offY - mmH - 10);
      const sx = mmW / level.W;
      const sy = mmH / level.H;
      ctx.fillStyle = 'rgba(10,14,8,0.82)';
      ctx.fillRect(mmX - 4, mmY - 4, mmW + 8, mmH + 8);
      ctx.strokeStyle = PALETTE.panelBorder;
      ctx.strokeRect(mmX - 4, mmY - 4, mmW + 8, mmH + 8);
      for (let y = 0; y < level.H; y++) {
        for (let x = 0; x < level.W; x++) {
          const t = level.map[y][x];
          if (t === 1) {
            ctx.fillStyle = 'rgba(120,110,90,0.55)';
            ctx.fillRect(mmX + x * sx, mmY + y * sy, sx, sy);
          } else if (t === 2) {
            ctx.fillStyle = 'rgba(140,100,60,0.55)';
            ctx.fillRect(mmX + x * sx, mmY + y * sy, sx, sy);
          }
        }
      }
      ctx.fillStyle = '#6aab5a';
      ctx.fillRect(mmX + ex.x * sx - 1, mmY + ex.y * sy - 1, sx + 2, sy + 2);
      for (const c of level.carrots) {
        if (c.taken) continue;
        ctx.fillStyle = c.golden ? '#ffe060' : '#ff7a30';
        ctx.fillRect(mmX + c.x * sx, mmY + c.y * sy, Math.max(2, sx), Math.max(2, sy));
      }
      for (const g of level.guards) {
        ctx.fillStyle = g.state === 'chase' ? '#ff4030' : g.state === 'alert' ? '#ffcf60' : '#8aa0d0';
        ctx.fillRect(mmX + g.x * sx - 1, mmY + g.y * sy - 1, 3, 3);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(mmX + px * sx - 1.5, mmY + py * sy - 1.5, 3, 3);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.strokeRect(mmX + (camX / TILE) * sx, mmY + (camY / TILE) * sy, (viewW / TILE) * sx, (viewH / TILE) * sy);

      api.particles.draw(ctx);
    },

    getMedalChecks(result) {
      const m = [];
      const f = result.extra?.floor ?? floor;
      const g = result.extra?.ghostFloors ?? ghostFloors;
      const d = result.extra?.distracts ?? distracts;
      if (f >= 2) m.push('heist_floor_3');
      if (g >= 1) m.push('heist_ghost');
      if (d >= 10) m.push('heist_distract_10');
      return m;
    },
  };

  return createShellGame(DEF, api, controller);
}
