import { createShellGame } from '../../shared/gameShell.js';
import { PALETTE } from '../../shared/donkey.js';
import { drawText, formatTime } from '../../shared/ui.js';
import * as audio from '../../shared/audio.js';

const DEF = { id: 'stack', title: 'STABLE STACK' };
const CELL = 28;

/** Classic tetriminos */
const PIECES = {
  I: {
    color: '#6ec8d0',
    cells: [
      [[0, 1], [1, 1], [2, 1], [3, 1]],
      [[2, 0], [2, 1], [2, 2], [2, 3]],
      [[0, 2], [1, 2], [2, 2], [3, 2]],
      [[1, 0], [1, 1], [1, 2], [1, 3]],
    ],
  },
  O: {
    color: '#e0c040',
    cells: [
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [2, 1]],
    ],
  },
  T: {
    color: '#b070c8',
    cells: [
      [[1, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [1, 2]],
      [[1, 0], [0, 1], [1, 1], [1, 2]],
    ],
  },
  S: {
    color: '#6ab05a',
    cells: [
      [[1, 0], [2, 0], [0, 1], [1, 1]],
      [[1, 0], [1, 1], [2, 1], [2, 2]],
      [[1, 1], [2, 1], [0, 2], [1, 2]],
      [[0, 0], [0, 1], [1, 1], [1, 2]],
    ],
  },
  Z: {
    color: '#d05050',
    cells: [
      [[0, 0], [1, 0], [1, 1], [2, 1]],
      [[2, 0], [1, 1], [2, 1], [1, 2]],
      [[0, 1], [1, 1], [1, 2], [2, 2]],
      [[1, 0], [0, 1], [1, 1], [0, 2]],
    ],
  },
  J: {
    color: '#5070d0',
    cells: [
      [[0, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [2, 0], [1, 1], [1, 2]],
      [[0, 1], [1, 1], [2, 1], [2, 2]],
      [[1, 0], [1, 1], [0, 2], [1, 2]],
    ],
  },
  L: {
    color: '#e09040',
    cells: [
      [[2, 0], [0, 1], [1, 1], [2, 1]],
      [[1, 0], [1, 1], [1, 2], [2, 2]],
      [[0, 1], [1, 1], [2, 1], [0, 2]],
      [[0, 0], [1, 0], [1, 1], [1, 2]],
    ],
  },
};

const BAG_ORDER = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const COLS = 10;
const ROWS = 20;
const DAS_DELAY = 0.17;
const DAS_REPEAT = 0.05;
const LOCK_DELAY = 0.45;
const LINE_SCORES = [0, 100, 300, 500, 800];
const BASE_GRAVITY = 0.8;
const SPEED_EVERY_S = 10;
const SPEED_STEP = 1.1;
const SPEED_TIER_CAP = 12;
const MAX_WOBBLE = 1;
const COLLAPSE_DURATION = 1.35;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createGame(canvas, api) {
  const { input, particles } = api;

  let board = [];
  let bag = [];
  let nextQueue = [];
  let hold = null;
  let holdUsed = false;

  let type = 'T';
  let rot = 0;
  let px = 3;
  let py = 0;

  let fallTimer = 0;
  let lockTimer = 0;
  let locking = false;

  let level = 1;
  let lines = 0;
  let score = 0;
  let combo = -1;
  let elapsed = 0;
  let lastSpeedTier = 0;

  let wobble = 0;
  let tiltAngle = 0;
  let tiltVel = 0;
  let collapseAnim = null;

  let finished = false;
  let topOut = false;
  let collapsed = false;
  let clearFlash = null;
  let flashText = '';
  let flashT = 0;
  let flashColor = PALETTE.accent;

  let moveDir = 0;
  let moveTimer = 0;
  let originX = 0;
  let originY = 40;

  function emptyBoard() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function refillBag() {
    bag.push(...shuffle(BAG_ORDER));
  }

  function takeFromBag() {
    if (bag.length < 7) refillBag();
    return bag.shift();
  }

  function ensureNext(n = 3) {
    while (nextQueue.length < n) nextQueue.push(takeFromBag());
  }

  function cellsOf(t, r, x, y) {
    return PIECES[t].cells[r % 4].map(([cx, cy]) => [x + cx, y + cy]);
  }

  function filled(x, y) {
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y < 0) return false;
    return board[y][x] != null;
  }

  function fits(t, r, x, y) {
    return cellsOf(t, r, x, y).every(([cx, cy]) => !filled(cx, cy));
  }

  function speedTier() {
    return Math.min(SPEED_TIER_CAP, Math.floor(elapsed / SPEED_EVERY_S));
  }

  function speedMul() {
    return Math.pow(SPEED_STEP, speedTier());
  }

  function gravityInterval() {
    const fromTime = BASE_GRAVITY / speedMul();
    const fromLevel = Math.pow(0.92, Math.max(0, level - 1));
    return Math.max(0.05, fromTime * fromLevel);
  }

  /** Center of mass in column space (0..COLS). */
  function centerOfMass() {
    let sx = 0;
    let n = 0;
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (board[y][x] != null) {
          sx += x + 0.5;
          n++;
        }
      }
    }
    return n ? sx / n : COLS / 2;
  }

  function spawn() {
    ensureNext(3);
    type = nextQueue.shift();
    ensureNext(3);
    rot = 0;
    px = type === 'O' ? 4 : 3;
    py = 0;
    holdUsed = false;
    locking = false;
    lockTimer = 0;
    fallTimer = 0;
    if (!fits(type, rot, px, py)) {
      topOut = true;
      audio.die();
    }
  }

  function ghostY() {
    let y = py;
    while (fits(type, rot, px, y + 1)) y++;
    return y;
  }

  function tryMove(dx, dy) {
    if (fits(type, rot, px + dx, py + dy)) {
      px += dx;
      py += dy;
      if (dy === 0) audio.uiClick();
      locking = false;
      lockTimer = 0;
      return true;
    }
    return false;
  }

  function tryRotate(dir) {
    const next = (rot + dir + 4) % 4;
    for (const k of [0, -1, 1, -2, 2]) {
      if (fits(type, next, px + k, py)) {
        rot = next;
        px += k;
        locking = false;
        lockTimer = 0;
        audio.uiClick();
        return true;
      }
      if (fits(type, next, px + k, py - 1)) {
        rot = next;
        px += k;
        py -= 1;
        locking = false;
        lockTimer = 0;
        audio.uiClick();
        return true;
      }
    }
    return false;
  }

  function hardDrop() {
    const gy = ghostY();
    score += (gy - py) * 2;
    py = gy;
    lockPiece();
  }

  function softStep() {
    if (tryMove(0, 1)) {
      score += 1;
      return true;
    }
    return false;
  }

  function clearLines() {
    const full = [];
    for (let y = 0; y < ROWS; y++) {
      if (board[y].every((c) => c != null)) full.push(y);
    }
    if (!full.length) {
      combo = -1;
      return 0;
    }

    clearFlash = { rows: full.slice(), t: 0.2 };
    // remove from bottom so indices stay valid if we splice high→low
    for (let i = full.length - 1; i >= 0; i--) {
      board.splice(full[i], 1);
      board.unshift(Array(COLS).fill(null));
    }

    const n = full.length;
    lines += n;
    combo = combo < 0 ? 0 : combo + 1;
    score += LINE_SCORES[n] * level + (combo > 0 ? 50 * combo * level : 0);
    level = Math.floor(lines / 10) + 1;

    // Clearing lines rebalances the stack
    wobble = Math.max(0, wobble - 0.22 * n);
    tiltVel *= 0.35;

    flashText = n === 1 ? 'SINGLE' : n === 2 ? 'DOUBLE' : n === 3 ? 'TRIPLE' : 'TETRIS!';
    flashColor = n === 4 ? '#ffe080' : PALETTE.good;
    flashT = 0.9;
    audio.perfect();
    particles.burst(
      originX + (COLS * CELL) / 2,
      originY + full[0] * CELL,
      n === 4 ? '#ffe080' : '#a8e080',
      10 + n * 6,
      140
    );
    return n;
  }

  function applyBalanceFromLock(lockedCells) {
    let sx = 0;
    for (const [x] of lockedCells) sx += x + 0.5;
    const pieceCom = sx / lockedCells.length;
    const boardMid = COLS / 2;
    const pieceOff = Math.abs(pieceCom - boardMid) / boardMid; // 0..1

    const com = centerOfMass();
    const stackOff = Math.abs(com - boardMid) / boardMid;

    // Side-biased placements tip the stack; centered play is safer
    const add = 0.04 + pieceOff * 0.16 + stackOff * 0.1;
    wobble = Math.min(MAX_WOBBLE, wobble + add);
    tiltVel += (pieceCom - boardMid) * 0.018 * (0.5 + pieceOff);

    if (pieceOff < 0.15) {
      // nicely centered — small recovery
      wobble = Math.max(0, wobble - 0.05);
      if (flashT <= 0) {
        flashText = 'STABLE';
        flashColor = PALETTE.good;
        flashT = 0.55;
      }
    } else if (pieceOff > 0.45) {
      flashText = 'WOBBLY!';
      flashColor = PALETTE.danger;
      flashT = 0.7;
      audio.hurt();
    }
  }

  function startCollapse() {
    if (collapseAnim) return;
    collapsed = true;
    audio.explode();
    const pieces = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!board[y][x]) continue;
        pieces.push({
          x: originX + x * CELL,
          y: originY + y * CELL,
          vx: (Math.random() - 0.5) * 280 + tiltAngle * 120,
          vy: -100 - Math.random() * 160,
          rot: 0,
          vr: (Math.random() - 0.5) * 12,
          color: board[y][x],
        });
      }
    }
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    particles.burst(originX + (COLS * CELL) / 2, originY + ROWS * CELL * 0.5, '#8a7040', 24, 150);
    collapseAnim = { timer: COLLAPSE_DURATION, pieces };
  }

  function lockPiece() {
    const locked = cellsOf(type, rot, px, py);
    const color = PIECES[type].color;
    for (const [x, y] of locked) {
      if (y < 0) {
        topOut = true;
        audio.die();
        return;
      }
      board[y][x] = color;
    }
    audio.hit();
    applyBalanceFromLock(locked);
    clearLines();

    if (wobble >= MAX_WOBBLE) {
      startCollapse();
      return;
    }
    if (!topOut) spawn();
  }

  function doHold() {
    if (holdUsed) return;
    holdUsed = true;
    audio.uiClick();
    if (hold == null) {
      hold = type;
      spawn();
      holdUsed = true;
      return;
    }
    const swap = hold;
    hold = type;
    type = swap;
    rot = 0;
    px = type === 'O' ? 4 : 3;
    py = 0;
    locking = false;
    lockTimer = 0;
    if (!fits(type, rot, px, py)) {
      topOut = true;
      audio.die();
    }
  }

  function reset() {
    emptyBoard();
    bag = [];
    nextQueue = [];
    hold = null;
    holdUsed = false;
    refillBag();
    ensureNext(5);
    level = 1;
    lines = 0;
    score = 0;
    combo = -1;
    elapsed = 0;
    lastSpeedTier = 0;
    wobble = 0;
    tiltAngle = 0;
    tiltVel = 0;
    collapseAnim = null;
    finished = false;
    topOut = false;
    collapsed = false;
    clearFlash = null;
    flashText = '';
    flashT = 0;
    moveDir = 0;
    moveTimer = 0;
    spawn();
  }

  function endNow(endFn, title) {
    if (finished) return;
    finished = true;
    endFn({
      title,
      score,
      time: elapsed,
      stats: [`Lines ${lines}`, `Speed x${speedMul().toFixed(2)}`, `Time ${formatTime(elapsed)}`],
      extra: { lines, level, collapsed },
    });
  }

  function drawBlock(ctx, x, y, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(x + 3, y + 3, CELL - 8, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(x + 3, y + CELL - 7, CELL - 8, 4);
    ctx.globalAlpha = 1;
  }

  function drawMini(ctx, t, x, y, size = 14) {
    if (!t) return;
    ctx.fillStyle = PIECES[t].color;
    for (const [cx, cy] of PIECES[t].cells[0]) {
      ctx.fillRect(x + cx * size, y + cy * size, size - 2, size - 2);
    }
  }

  const controller = {
    reset() {
      reset();
    },
    updatePlay(dt, endFn) {
      if (finished) return true;

      if (collapseAnim) {
        collapseAnim.timer -= dt;
        for (const p of collapseAnim.pieces) {
          p.vy += 900 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.rot += p.vr * dt;
        }
        if (collapseAnim.timer <= 0) {
          endNow(endFn, 'STACK COLLAPSED');
          return true;
        }
        return false;
      }

      if (topOut) {
        endNow(endFn, 'TOP OUT');
        return true;
      }

      elapsed += dt;
      const tier = speedTier();
      if (tier > lastSpeedTier) {
        lastSpeedTier = tier;
        audio.pickup();
        flashText = `SPEED x${speedMul().toFixed(2)}`;
        flashColor = PALETTE.accent;
        flashT = 1;
      }
      if (flashT > 0) flashT -= dt;
      if (clearFlash) {
        clearFlash.t -= dt;
        if (clearFlash.t <= 0) clearFlash = null;
      }

      // Slow natural recovery if you stay alive without dumping on the edge
      wobble = Math.max(0, wobble - dt * 0.025);

      const com = centerOfMass();
      const targetTilt = ((com - COLS / 2) / COLS) * wobble * 1.6;
      tiltVel += (targetTilt - tiltAngle) * 36 * dt;
      tiltVel *= 1 - Math.min(1, 5.5 * dt);
      tiltAngle += tiltVel * dt;

      if (input.pressed('q') || input.pressed('z') || input.pressed('Control')) tryRotate(-1);
      if (input.pressed('e') || input.pressed('x') || input.pressed('ArrowUp') || input.pressed('w')) {
        tryRotate(1);
      }
      if (input.pressed('c') || input.pressed('Shift')) doHold();
      if (input.pressed('ArrowDown') || input.pressed('s')) {
        if (!softStep()) locking = true;
      }
      if (input.pressed('Space')) {
        hardDrop();
        if (topOut) {
          endNow(endFn, 'TOP OUT');
          return true;
        }
        if (collapseAnim) return false;
      }

      const left = input.down('ArrowLeft') || input.down('a');
      const right = input.down('ArrowRight') || input.down('d');
      const dir = left && !right ? -1 : right && !left ? 1 : 0;
      if (dir !== moveDir) {
        moveDir = dir;
        moveTimer = 0;
        if (dir) tryMove(dir, 0);
      } else if (dir) {
        moveTimer += dt;
        if (moveTimer >= DAS_DELAY) {
          moveTimer = DAS_DELAY - DAS_REPEAT;
          tryMove(dir, 0);
        }
      }

      const soft = input.down('ArrowDown') || input.down('s');
      const interval = soft ? 0.04 : gravityInterval();
      fallTimer += dt;
      if (fallTimer >= interval) {
        fallTimer = 0;
        if (!tryMove(0, 1)) locking = true;
        else if (soft) score += 1;
      }

      if (locking || !fits(type, rot, px, py + 1)) {
        locking = true;
        lockTimer += dt;
        if (lockTimer >= LOCK_DELAY) {
          lockPiece();
          if (topOut) {
            endNow(endFn, 'TOP OUT');
            return true;
          }
        }
      } else {
        lockTimer = 0;
        locking = false;
      }

      return false;
    },

    drawPlay(ctx, w, h) {
      const boardW = COLS * CELL;
      const boardH = ROWS * CELL;
      originX = Math.floor((w - boardW) / 2);
      originY = Math.max(40, Math.floor((h - boardH) / 2) - 28);

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#1a2218');
      bg.addColorStop(1, '#121610');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // tipping well
      ctx.save();
      ctx.translate(originX + boardW / 2, originY + boardH);
      ctx.rotate(collapseAnim ? tiltAngle * 0.3 : tiltAngle);
      ctx.translate(-(originX + boardW / 2), -(originY + boardH));

      ctx.fillStyle = '#2a3224';
      ctx.fillRect(originX - 8, originY - 8, boardW + 16, boardH + 16);
      ctx.fillStyle = '#0c100c';
      ctx.fillRect(originX, originY, boardW, boardH);

      ctx.strokeStyle = 'rgba(80,90,70,0.25)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= COLS; x++) {
        ctx.beginPath();
        ctx.moveTo(originX + x * CELL, originY);
        ctx.lineTo(originX + x * CELL, originY + boardH);
        ctx.stroke();
      }
      for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath();
        ctx.moveTo(originX, originY + y * CELL);
        ctx.lineTo(originX + boardW, originY + y * CELL);
        ctx.stroke();
      }

      // center balance guide
      ctx.strokeStyle = 'rgba(201,162,39,0.2)';
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(originX + boardW / 2, originY);
      ctx.lineTo(originX + boardW / 2, originY + boardH);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let y = 0; y < ROWS; y++) {
        const flashing = clearFlash && clearFlash.rows.includes(y);
        for (let x = 0; x < COLS; x++) {
          const c = board[y][x];
          if (!c) continue;
          drawBlock(
            ctx,
            originX + x * CELL,
            originY + y * CELL,
            flashing ? '#fff8d0' : c,
            flashing ? 0.85 + Math.sin(elapsed * 40) * 0.15 : 1
          );
        }
      }

      if (!collapseAnim && !topOut && !finished) {
        const gy = ghostY();
        for (const [x, y] of cellsOf(type, rot, px, gy)) {
          if (y < 0) continue;
          ctx.strokeStyle = 'rgba(200,210,180,0.45)';
          ctx.lineWidth = 2;
          ctx.strokeRect(originX + x * CELL + 3, originY + y * CELL + 3, CELL - 6, CELL - 6);
        }
        for (const [x, y] of cellsOf(type, rot, px, py)) {
          if (y < 0) continue;
          drawBlock(ctx, originX + x * CELL, originY + y * CELL, PIECES[type].color);
        }
      }

      ctx.restore();

      if (collapseAnim) {
        for (const p of collapseAnim.pieces) {
          ctx.save();
          ctx.translate(p.x + CELL / 2, p.y + CELL / 2);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-CELL / 2 + 1, -CELL / 2 + 1, CELL - 2, CELL - 2);
          ctx.restore();
        }
        drawText(ctx, 'THE STACK TUMBLES!', w / 2, h * 0.12, {
          align: 'center',
          font: 'bold 22px Courier New, monospace',
          color: PALETTE.danger,
        });
      }

      // HOLD / NEXT
      const sideL = originX - 110;
      if (sideL > 8) {
        drawText(ctx, 'HOLD', sideL, originY, {
          color: PALETTE.accent,
          font: 'bold 12px Courier New, monospace',
        });
        ctx.fillStyle = '#1a2018';
        ctx.fillRect(sideL, originY + 18, 84, 70);
        if (hold) drawMini(ctx, hold, sideL + 12, originY + 30, 14);
      }
      const sideR = originX + boardW + 18;
      if (sideR + 90 < w) {
        drawText(ctx, 'NEXT', sideR, originY, {
          color: PALETTE.accent,
          font: 'bold 12px Courier New, monospace',
        });
        nextQueue.slice(0, 3).forEach((t, i) => {
          ctx.fillStyle = '#1a2018';
          ctx.fillRect(sideR, originY + 18 + i * 72, 84, 66);
          drawMini(ctx, t, sideR + 12, originY + 30 + i * 72, 14);
        });
      }

      // donkey + stability under well
      const shake = wobble > 0.65 ? (Math.random() - 0.5) * wobble * 5 : 0;
      const donkeyY = originY + boardH + 6;
      api.drawDonkey(ctx, {
        x: originX + boardW / 2 - 22 + shake + tiltAngle * 40,
        y: donkeyY,
        scale: 0.95,
        pose: 'stackHold',
        runPhase: elapsed * 2,
        hurt: wobble > 0.85,
      });

      const barY = Math.min(h - 40, donkeyY + 58);
      drawText(ctx, 'STABILITY', originX, barY, {
        font: '11px Courier New, monospace',
        color: '#8a9878',
      });
      ctx.fillStyle = '#3a3228';
      ctx.fillRect(originX, barY + 14, boardW, 12);
      const stab = 1 - Math.min(1, wobble);
      ctx.fillStyle = wobble > 0.7 ? PALETTE.danger : wobble > 0.4 ? '#d0a040' : PALETTE.good;
      ctx.fillRect(originX, barY + 14, boardW * stab, 12);

      drawText(ctx, `SCORE ${score}`, 14, 12, { font: 'bold 16px Courier New, monospace' });
      drawText(ctx, `LINES ${lines}`, 14, 34, { color: '#8a9878' });
      drawText(ctx, `x${speedMul().toFixed(2)}`, w - 14, 12, {
        align: 'right',
        font: 'bold 16px Courier New, monospace',
        color: lastSpeedTier > 0 ? PALETTE.accent : PALETTE.text,
      });
      drawText(ctx, formatTime(elapsed), w - 14, 34, { align: 'right', color: '#8a9878' });

      if (flashT > 0) {
        ctx.globalAlpha = Math.min(1, flashT * 2);
        drawText(ctx, flashText, w / 2, originY - 10, {
          align: 'center',
          font: 'bold 20px Courier New, monospace',
          color: flashColor,
        });
        ctx.globalAlpha = 1;
      }

      api.particles.draw(ctx);
    },

    getMedalChecks(result) {
      const m = [];
      const L = result.extra?.lines ?? lines;
      if (L >= 10) m.push('stack_20');
      if (L >= 20) m.push('stack_perfect_5');
      if ((result.extra?.level ?? level) >= 5 || L >= 40) m.push('stack_roof');
      return m;
    },
  };

  return createShellGame(DEF, api, controller);
}
