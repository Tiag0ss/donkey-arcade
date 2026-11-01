import { createShellGame } from '../../shared/gameShell.js';
import { drawDonkey, PALETTE } from '../../shared/donkey.js';
import { drawText, formatTime } from '../../shared/ui.js';
import * as audio from '../../shared/audio.js';

const DEF = { id: 'minecart', title: 'MINE CART BURRO' };

const PX_PER_M = 10;
const BASE_SPEED = 230;
const SPEED_STEP = 1.1;
const SPEED_EVERY_S = 10;
const SPEED_TIER_CAP = 8; // ~2.14x max
const RAIL_GAP = 0.2;
const SWITCH_RATE = 9;
const GRAVITY = 1500;
const JUMP_VY = -520;
const JUMP_BUFFER = 0.12;
const PLAYER_X = 150;
const MIN_REACTION_S = 1.0;
const HIT_HALF_W = 28;

function seededRand(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return (s >>> 0) / 4294967296;
  };
}

export function createGame(canvas, api) {
  const { input, particles, drawDonkey: drawDk } = api;

  let time = 0;
  let dist = 0; // world units, meters = dist / PX_PER_M
  let speed = BASE_SPEED;
  let speedMul = 1;
  let lastSpeedTier = 0;

  let rail = 0; // 0 = continuous blend, lerps toward targetRail
  let targetRail = 0;
  let jumpVy = 0;
  let jumpY = 0;
  let onGround = true;
  let jumpBufferT = 0;

  let obstacles = [];
  let nextSpawnX = 500;
  let seedCounter = 1;

  let coins = 0;
  let gems = 0;
  let crashed = false;
  let finished = false;
  let runPhase = 0;
  let shake = 0;

  let wheelSpin = 0;
  let sparkTimer = 0;
  let lanternTimer = 0;
  let bestStreakM = 0;

  function railY(h, r) {
    return h * (0.5 + (r - 0.5) * RAIL_GAP * 2);
  }

  function currentRailY(h) {
    return railY(h, rail);
  }

  function meters() {
    return dist / PX_PER_M;
  }

  function scoreNow() {
    return Math.floor(meters()) + coins * 25 + gems * 100;
  }

  function reset() {
    time = 0;
    dist = 0;
    speed = BASE_SPEED;
    speedMul = 1;
    lastSpeedTier = 0;
    rail = 0;
    targetRail = 0;
    jumpVy = 0;
    jumpY = 0;
    onGround = true;
    jumpBufferT = 0;
    obstacles = [];
    nextSpawnX = 520;
    seedCounter = 1;
    coins = 0;
    gems = 0;
    crashed = false;
    finished = false;
    runPhase = 0;
    shake = 0;
    wheelSpin = 0;
    sparkTimer = 0;
    lanternTimer = 0;
    bestStreakM = 0;
  }

  function isHazard(o) {
    return o.type === 'rock' || o.type === 'beam' || o.type === 'gap';
  }

  /** Never put lethal hazards on both rails at the same stretch. */
  function escapeBlocked(x, hazardRail, radius = 180) {
    const other = 1 - hazardRail;
    return obstacles.some(
      (o) => isHazard(o) && o.rail === other && Math.abs(o.x - x) < radius
    );
  }

  function spawnPattern(x) {
    const rnd = seededRand(seedCounter++);
    const roll = rnd();
    if (roll < 0.38) {
      const r = rnd() < 0.5 ? 0 : 1;
      if (escapeBlocked(x, r)) return;
      const kinds = ['rock', 'beam', 'gap'];
      const kind = kinds[Math.floor(rnd() * kinds.length)];
      obstacles.push({ type: kind, x, rail: r, w: kind === 'gap' ? 90 : 44 });
    } else if (roll < 0.72) {
      const r = rnd() < 0.5 ? 0 : 1;
      const n = 3 + Math.floor(rnd() * 3);
      for (let i = 0; i < n; i++) {
        obstacles.push({ type: 'coin', x: x + i * 34, rail: r, w: 20 });
      }
    } else if (roll < 0.88) {
      const r = rnd() < 0.5 ? 0 : 1;
      obstacles.push({ type: 'gem', x, rail: r, w: 24 });
    }
  }

  function ensureObstacles() {
    const lookahead = dist + api.canvas.width + 900;
    while (nextSpawnX < lookahead) {
      spawnPattern(nextSpawnX);
      const minGap = Math.max(200, speed * MIN_REACTION_S);
      nextSpawnX += minGap + Math.random() * 140;
    }
    obstacles = obstacles.filter((o) => o.x > dist - 400);
  }

  function endGame(endFn, title = 'CRASHED!') {
    if (finished) return;
    finished = true;
    const m = Math.floor(meters());
    const score = scoreNow();
    endFn({
      title,
      score,
      time,
      stats: [`Distance ${m}m`, `Coins ${coins} · Gems ${gems}`, `Time ${formatTime(time)}`],
      extra: { distance: m, coins, gems, survived: time },
    });
  }

  function tryJump() {
    jumpBufferT = JUMP_BUFFER;
  }

  const controller = {
    reset() {
      reset();
    },
    updatePlay(dt, endFn) {
      if (finished) return true;
      if (crashed) return false;

      time += dt;
      runPhase += dt * 11;

      // speed: ×1.1 every 10s (capped)
      const tier = Math.min(SPEED_TIER_CAP, Math.floor(time / SPEED_EVERY_S));
      speedMul = Math.pow(SPEED_STEP, tier);
      speed = BASE_SPEED * speedMul;
      if (tier > lastSpeedTier) {
        lastSpeedTier = tier;
        audio.pickup();
      }
      wheelSpin += dt * (4 + tier * 2);
      if (shake > 0) shake = Math.max(0, shake - dt * 4);

      const h = api.canvas.height;

      if (input.pressed('w') || input.pressed('ArrowUp')) targetRail = 0;
      if (input.pressed('s') || input.pressed('ArrowDown')) targetRail = 1;
      if (input.pressed('Space')) tryJump();
      if (jumpBufferT > 0) jumpBufferT -= dt;

      if (onGround && jumpBufferT > 0) {
        jumpVy = JUMP_VY;
        onGround = false;
        jumpBufferT = 0;
        audio.jump();
        particles.burst(PLAYER_X, currentRailY(h) - 6, PALETTE.dust, 6, 70);
      }

      // rail lerp (visual only — collisions use targetRail / committed choice)
      if (Math.abs(rail - targetRail) > 0.001) {
        const dir = Math.sign(targetRail - rail);
        rail += dir * SWITCH_RATE * dt;
        if ((dir > 0 && rail > targetRail) || (dir < 0 && rail < targetRail)) rail = targetRail;
      }

      dist += speed * dt;

      // gravity / jump arc
      if (!onGround) {
        jumpVy += GRAVITY * dt;
        jumpY += jumpVy * dt;
        if (jumpY >= 0) {
          jumpY = 0;
          jumpVy = 0;
          onGround = true;
        }
      }

      ensureObstacles();

      // dust/spark trail from wheels
      sparkTimer -= dt;
      if (sparkTimer <= 0) {
        sparkTimer = 0.07;
        particles.burst(PLAYER_X - 20, currentRailY(h) + 16, '#6a5a48', 1, 30);
      }

      const inAir = jumpY < -18;
      // Physical rail from cart Y — NOT targetRail (that killed you on the destination
      // rail while the cart was still visually on the other one).
      const cartY = currentRailY(h);
      const railHitSlop = Math.max(18, api.canvas.height * 0.035);

      function physicallyOnRail(oRail) {
        return Math.abs(cartY - railY(h, oRail)) <= railHitSlop;
      }

      function overlapsX(o, halfW = HIT_HALF_W) {
        const left = o.x - dist + PLAYER_X;
        const right = left + (o.w || 36);
        const pL = PLAYER_X - halfW;
        const pR = PLAYER_X + halfW;
        return left < pR && right > pL;
      }

      for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        if (o.x - dist + PLAYER_X < -160) continue;
        if (!physicallyOnRail(o.rail)) continue;
        if (!overlapsX(o)) continue;

        if (o.type === 'coin' && !o.taken) {
          o.taken = true;
          coins++;
          audio.pickup();
          particles.burst(PLAYER_X, railY(h, o.rail) - 30, '#ffe080', 7, 90);
        } else if (o.type === 'gem' && !o.taken) {
          o.taken = true;
          gems++;
          audio.perfect();
          particles.burst(PLAYER_X, railY(h, o.rail) - 30, '#80e0ff', 9, 110);
        } else if (o.type === 'rock' && !inAir) {
          crashed = true;
          shake = 1;
          audio.die();
          particles.burst(PLAYER_X, railY(h, o.rail) - 10, '#888', 14, 150);
          endGame(endFn, 'ROCK SMASH!');
          return false;
        } else if (o.type === 'beam') {
          crashed = true;
          shake = 1;
          audio.die();
          particles.burst(PLAYER_X, railY(h, o.rail) - 40, '#8a7060', 14, 150);
          endGame(endFn, 'LOW BEAM!');
          return false;
        } else if (o.type === 'gap' && !inAir) {
          crashed = true;
          shake = 1;
          audio.die();
          particles.burst(PLAYER_X, railY(h, o.rail) + 10, '#2a2420', 10, 120);
          endGame(endFn, 'FELL IN!');
          return false;
        }
      }
      bestStreakM = Math.max(bestStreakM, meters());

      return false;
    },

    drawPlay(ctx, w, h) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const sx = !crashed && shake > 0 ? (Math.random() - 0.5) * 10 * shake : 0;
      const sy = !crashed && shake > 0 ? (Math.random() - 0.5) * 10 * shake : 0;
      ctx.save();
      ctx.translate(sx, sy);

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#15120e');
      grad.addColorStop(0.55, '#231f19');
      grad.addColorStop(1, '#312a21');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // cave wall silhouettes (parallax)
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (let i = 0; i < 10; i++) {
        const bx = (((i * 140 - dist * 0.25) % 140) + 140) % 140;
        const bw = 60;
        ctx.beginPath();
        ctx.moveTo(bx - bw, 0);
        ctx.lineTo(bx, h * 0.22 + Math.sin(i * 1.7) * 18);
        ctx.lineTo(bx + bw, 0);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(bx - bw, h);
        ctx.lineTo(bx, h * 0.78 - Math.sin(i * 2.3) * 16);
        ctx.lineTo(bx + bw, h);
        ctx.closePath();
        ctx.fill();
      }

      // support beams scrolling
      ctx.fillStyle = 'rgba(80,65,48,0.4)';
      for (let i = 0; i < 12; i++) {
        const bx = (((i * 170 - dist * 0.9) % 170) + 170) % 170 - 20;
        ctx.fillRect(bx, h * 0.14, 10, h * 0.72);
      }

      // lanterns
      lanternTimer += 0.016;
      for (let i = 0; i < 6; i++) {
        const lx = (((i * 260 - dist) % 260) + 260) % 260 - 20;
        const flick = 0.75 + Math.sin(lanternTimer * 6 + i) * 0.12;
        const grd = ctx.createRadialGradient(lx, h * 0.5, 2, lx, h * 0.5, 90);
        grd.addColorStop(0, `rgba(255,200,110,${0.16 * flick})`);
        grd.addColorStop(1, 'rgba(255,200,110,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(lx - 90, 0, 180, h);
      }

      const y0 = railY(h, 0);
      const y1 = railY(h, 1);
      for (const ry of [y0, y1]) {
        ctx.fillStyle = '#211c16';
        ctx.fillRect(0, ry - 2, w, 26);
        ctx.strokeStyle = '#7a6a52';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, ry + 4);
        ctx.lineTo(w, ry + 4);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, ry + 16);
        ctx.lineTo(w, ry + 16);
        ctx.stroke();
        // ties
        ctx.fillStyle = '#4a3c2c';
        const tieOff = (dist * 1) % 36;
        for (let x = -tieOff; x < w; x += 36) {
          ctx.fillRect(x, ry + 2, 22, 18);
        }
      }

      for (const o of obstacles) {
        const ox = o.x - dist + PLAYER_X;
        if (ox < -80 || ox > w + 100) continue;
        const ry = railY(h, o.rail ?? 0);
        if (o.type === 'coin' && !o.taken) {
          const spin = Math.abs(Math.cos(runPhase * 0.6 + o.x * 0.05));
          ctx.fillStyle = '#e8c040';
          ctx.beginPath();
          ctx.ellipse(ox, ry - 30, 9 * Math.max(0.25, spin), 9, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#8a6a20';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else if (o.type === 'gem' && !o.taken) {
          const glow = 0.6 + Math.sin(runPhase * 2 + o.x) * 0.3;
          ctx.fillStyle = `rgba(100,220,255,${glow})`;
          ctx.beginPath();
          ctx.moveTo(ox, ry - 44);
          ctx.lineTo(ox + 13, ry - 30);
          ctx.lineTo(ox, ry - 16);
          ctx.lineTo(ox - 13, ry - 30);
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = '#d0f6ff';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (o.type === 'rock') {
          ctx.fillStyle = '#6c6a62';
          ctx.beginPath();
          ctx.moveTo(ox - 20, ry + 4);
          ctx.lineTo(ox - 10, ry - 30);
          ctx.lineTo(ox + 12, ry - 34);
          ctx.lineTo(ox + 20, ry - 4);
          ctx.lineTo(ox + 6, ry + 4);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#88867c';
          ctx.fillRect(ox - 10, ry - 26, 8, 8);
        } else if (o.type === 'beam') {
          ctx.fillStyle = '#5a4030';
          ctx.fillRect(ox - 44, ry - 58, 88, 14);
          ctx.fillStyle = PALETTE.danger;
          for (let i = -40; i < 40; i += 16) {
            ctx.fillRect(ox + i, ry - 56, 8, 10);
          }
          ctx.fillStyle = '#8a7060';
          ctx.fillRect(ox - 46, ry - 60, 6, 62);
          ctx.fillRect(ox + 40, ry - 60, 6, 62);
        } else if (o.type === 'gap') {
          ctx.fillStyle = '#0a0806';
          ctx.fillRect(ox, ry + 6, o.w, 32);
          ctx.fillStyle = '#4a3c2c';
          ctx.fillRect(ox - 4, ry + 4, 6, 36);
          ctx.fillRect(ox + o.w - 2, ry + 4, 6, 36);
        }
      }

      // cart + donkey
      const py = currentRailY(h) + jumpY - 6;
      const cartTilt = (targetRail - rail) * 0.3;
      ctx.save();
      ctx.translate(PLAYER_X, py);
      ctx.rotate(cartTilt);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 36, 42, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a2f22';
      ctx.beginPath();
      ctx.moveTo(-42, 8);
      ctx.lineTo(-36, 32);
      ctx.lineTo(36, 32);
      ctx.lineTo(42, 8);
      ctx.lineTo(30, -2);
      ctx.lineTo(-30, -2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#6a5038';
      ctx.fillRect(-40, 4, 80, 8);
      // wheels
      for (const wx of [-26, 26]) {
        ctx.save();
        ctx.translate(wx, 32);
        ctx.rotate(wheelSpin);
        ctx.fillStyle = '#1c1812';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(10, 0);
        ctx.moveTo(0, -10);
        ctx.lineTo(0, 10);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();

      drawDk(ctx, {
        x: PLAYER_X - 18,
        y: py - 44,
        scale: 0.88,
        facing: 1,
        pose: !onGround ? 'jump' : 'cart',
        runPhase,
        hurt: crashed,
      });

      ctx.restore(); // shake

      // HUD
      drawText(ctx, `${Math.floor(meters())}m`, 14, 12, { font: 'bold 20px Courier New, monospace', color: PALETTE.text });
      drawText(ctx, `x${speedMul.toFixed(2)}  (+10s)`, 14, 36, {
        color: lastSpeedTier > 0 ? PALETTE.accent : '#8a9878',
        font: '12px Courier New, monospace',
      });
      drawText(ctx, `◎ ${coins}   ◆ ${gems}`, w - 14, 12, { align: 'right', color: PALETTE.accent, font: 'bold 16px Courier New, monospace' });
      drawText(ctx, formatTime(time), w - 14, 36, { align: 'right', color: '#8a9878' });

      api.particles.draw(ctx);
    },

    getMedalChecks(result) {
      const m = [];
      const meters_ = result.extra?.distance ?? Math.floor(meters());
      const survived = result.extra?.survived ?? time;
      if (meters_ >= 1000) m.push('cart_1k');
      if (survived >= 60) m.push('cart_no_crash_60s');
      if (gems >= 10) m.push('cart_gems_10');
      return m;
    },
  };

  return createShellGame(DEF, api, controller);
}
