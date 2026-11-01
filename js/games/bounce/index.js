import { createShellGame } from '../../shared/gameShell.js';
import { drawDonkey, PALETTE } from '../../shared/donkey.js';
import { drawText, formatTime } from '../../shared/ui.js';
import * as audio from '../../shared/audio.js';

const DEF = {
  id: 'bounce',
  title: 'BURRO BOUNCE',
};

const PX_PER_M = 12;
const GRAV = 820;
const BOUNCE_V = 560;
const SPRING_V = 780;
const BREAK_V = 500;
const MOVE_ACCEL = 2200;
const AIR_ACCEL = 2600;
const MAX_VX = 380;
const GROUND_FRICTION = 0.78;
const AIR_FRICTION = 0.992;
const JET_V = 780;
const JET_DUR = 0.55;
const JET_THRUST = 1100;
const JET_H_BOOST = 160;
const FAKE_MIN_HEIGHT = 90;
const HAZARD_MIN_HEIGHT = 40;
const HIT_IFRAME = 0.85;
const CAM_LERP = 8;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function heightM(startY, lowestY) {
  return Math.max(0, (startY - lowestY) / PX_PER_M);
}

export function createGame(canvas, api) {
  const { input, particles } = api;

  let elapsed = 0;
  let player = { x: 0, y: 0, vx: 0, vy: 0 };
  let facing = 1;
  let cameraY = 0;
  let startY = 0;
  let lowestY = 0;
  let platforms = [];
  let hazards = [];
  let pickups = [];
  let floaters = [];
  let nextPlatY = 0;
  let platId = 0;
  let lastPlayerX = 0;

  let jetCharge = 1;
  let jetActive = 0;
  let jetsUsed = 0;
  let pickupScore = 0;
  let maxHeightM = 0;
  let runPhase = 0;
  let shake = 0;
  let hitI = 0;
  let dustT = 0;
  let wind = 0;
  let windT = 5;
  let onPlatformFeel = 0;

  function spawnFloater(x, y, text, color) {
    floaters.push({ x, y, text, color, life: 0.7, max: 0.7, vy: -46 });
  }

  function reset() {
    const w = api.canvas.width;
    const h = api.canvas.height;
    elapsed = 0;
    player = { x: w / 2, y: h * 0.62, vx: 0, vy: -BOUNCE_V * 0.85 };
    facing = 1;
    lastPlayerX = player.x;
    cameraY = player.y - h * 0.55;
    startY = player.y;
    lowestY = player.y;
    platforms = [];
    hazards = [];
    pickups = [];
    floaters = [];
    platId = 0;
    nextPlatY = h * 0.82;
    jetCharge = 1;
    jetActive = 0;
    jetsUsed = 0;
    pickupScore = 0;
    maxHeightM = 0;
    runPhase = 0;
    shake = 0;
    hitI = 0;
    dustT = 0;
    wind = 0;
    windT = 6;
    onPlatformFeel = 0;

    // starter pad under the donkey
    platforms.push({
      id: ++platId,
      x: w / 2 - 70,
      y: h * 0.86,
      w: 140,
      type: 'normal',
      state: 'solid',
      breakT: 0,
      moveT: 0,
    });
    for (let i = 0; i < 18; i++) spawnPlatform(true);
  }

  function spawnPlatform(starter = false) {
    const w = api.canvas.width;
    const curHeight = heightM(startY, nextPlatY);
    const difficulty = clamp(curHeight / 220, 0, 1);

    // tighter gaps early; never so wide a normal bounce can't reach
    const gapMin = lerp(42, 58, difficulty);
    const gapMax = lerp(62, 88, difficulty);
    const gap = gapMin + Math.random() * (gapMax - gapMin);
    nextPlatY -= gap;

    const pwMin = lerp(88, 56, difficulty);
    const pwMax = lerp(130, 92, difficulty);
    const pw = pwMin + Math.random() * (pwMax - pwMin);

    const roll = Math.random();
    let type = 'normal';
    if (!starter) {
      if (roll < 0.12 + difficulty * 0.06) type = 'moving';
      else if (roll < 0.2 + difficulty * 0.1) type = 'break';
      else if (roll < 0.32) type = 'spring';
      else if (roll < 0.38 && maxHeightM >= FAKE_MIN_HEIGHT) type = 'fake';
    } else if (roll < 0.18) {
      type = 'spring';
    }

    // bias X toward recent player path so you can actually climb
    const biasX = lastPlayerX || w / 2;
    const spread = lerp(w * 0.22, w * 0.42, difficulty);
    let px = biasX - pw / 2 + (Math.random() - 0.5) * spread * 2;
    px = clamp(px, 24, w - pw - 24);

    platforms.push({
      id: ++platId,
      x: px,
      y: nextPlatY,
      w: pw,
      type,
      state: 'solid',
      breakT: 0,
      moveT: Math.random() * 20,
      moveAmp: 40 + Math.random() * 50,
    });

    if (!starter && Math.random() < 0.14) {
      pickups.push({
        x: clamp(px + pw * 0.5, 30, w - 30),
        y: nextPlatY - 28,
        kind: Math.random() < 0.65 ? 'horseshoe' : 'star',
        taken: false,
        bob: Math.random() * 10,
      });
    }
    if (!starter && Math.random() < 0.06 + difficulty * 0.05 && curHeight > HAZARD_MIN_HEIGHT) {
      const kind = Math.random() < 0.6 ? 'bird' : 'lightning';
      hazards.push({
        kind,
        x: Math.random() * w,
        y: nextPlatY - 40 - Math.random() * 60,
        vx: kind === 'bird' ? (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 70) : 0,
        warn: kind === 'lightning' ? 0.7 : 0,
        active: kind === 'bird',
        done: false,
        bob: Math.random() * 10,
      });
    }
  }

  function ensurePlatforms() {
    const h = api.canvas.height;
    while (nextPlatY > cameraY - 160) spawnPlatform(false);
    platforms = platforms.filter((p) => p.y < cameraY + h + 220 && p.state !== 'gone');
    hazards = hazards.filter((hz) => hz.y < cameraY + h + 240 && !hz.done);
    pickups = pickups.filter((p) => !p.taken && p.y < cameraY + h + 140);
  }

  function scoreNow() {
    return Math.floor(maxHeightM * 10) + pickupScore;
  }

  function landOn(p, bounceV, refillJet) {
    player.y = p.y - 24;
    player.vy = -bounceV;
    onPlatformFeel = 0.08;
    lastPlayerX = player.x;
    if (refillJet) jetCharge = 1;
    audio.jump();
  }

  const controller = {
    reset,
    updatePlay(dt, endFn) {
      elapsed += dt;
      runPhase += dt * 10;
      shake = Math.max(0, shake - dt * 2.8);
      if (hitI > 0) hitI -= dt;
      if (onPlatformFeel > 0) onPlatformFeel -= dt;
      const w = api.canvas.width;
      const h = api.canvas.height;

      // wind only after some height, and milder
      windT -= dt;
      if (windT <= 0) {
        windT = 5 + Math.random() * 5;
        wind = maxHeightM > 35 ? (Math.random() - 0.5) * 70 : 0;
      }

      const moving = input.p1Left() || input.p1Right();
      const accel = player.vy < -40 || player.vy > 40 ? AIR_ACCEL : MOVE_ACCEL;
      if (input.p1Left()) {
        player.vx -= accel * dt;
        facing = -1;
      } else if (input.p1Right()) {
        player.vx += accel * dt;
        facing = 1;
      } else {
        player.vx *= player.vy < -20 || player.vy > 40 ? AIR_FRICTION : GROUND_FRICTION;
      }
      player.vx += wind * dt * 0.15;
      player.vx = clamp(player.vx, -MAX_VX, MAX_VX);

      // Jet: strong rescue boost — usable anytime you have charge
      if (input.pressed('Space') && jetCharge > 0 && jetActive <= 0) {
        jetCharge = 0;
        jetActive = JET_DUR;
        jetsUsed++;
        player.vy = Math.min(player.vy, 0) - JET_V;
        player.vx += facing * JET_H_BOOST;
        player.vx = clamp(player.vx, -MAX_VX, MAX_VX);
        audio.jump();
        particles.burst(player.x, player.y + 22, '#8ad0ff', 16, 180);
        spawnFloater(player.x, player.y - 30, 'JET!', '#8ad0ff');
      }
      if (jetActive > 0) {
        jetActive -= dt;
        // cancel most gravity while thrusting
        player.vy -= (JET_THRUST + GRAV * 0.35) * dt;
        if (moving) player.vx += facing * 320 * dt;
      }

      player.x += player.vx * dt;
      if (player.x < -18) player.x = w + 18;
      if (player.x > w + 18) player.x = -18;

      for (const p of platforms) {
        if (p.type === 'moving' && p.state === 'solid') {
          p.moveT += dt;
          p.x += Math.sin(p.moveT * 1.6) * (p.moveAmp || 55) * dt;
          p.x = clamp(p.x, 20, w - p.w - 20);
        }
        if (p.state === 'breaking') {
          p.breakT -= dt;
          if (p.breakT <= 0) p.state = 'gone';
        }
      }

      for (const hz of hazards) {
        if (hz.done) continue;
        hz.bob = (hz.bob || 0) + dt * 5;
        if (hz.kind === 'bird') {
          hz.x += hz.vx * dt;
          if (hz.x < -20 || hz.x > w + 20) hz.vx *= -1;
        } else if (hz.kind === 'lightning') {
          if (hz.warn > 0) hz.warn -= dt;
          else hz.active = true;
        }

        if (hitI <= 0 && jetActive <= 0) {
          let hit = false;
          if (hz.kind === 'bird') {
            const dx = player.x - hz.x;
            const dy = player.y - hz.y;
            hit = dx * dx + dy * dy < 28 * 28;
          } else if (hz.active) {
            hit = Math.abs(player.x - hz.x) < 24 && Math.abs(player.y - hz.y) < 50;
          }
          if (hit) {
            hz.done = true;
            hitI = HIT_IFRAME;
            shake = Math.max(shake, 0.4);
            player.vy = Math.max(player.vy, 280);
            audio.hurt();
            particles.burst(player.x, player.y, '#ffe080', 12, 160);
            spawnFloater(player.x, player.y - 30, 'OUCH!', '#ff8060');
          }
        }
      }

      // Sub-step vertical motion so fast falls never tunnel through platforms
      const FOOT = 24;
      const steps = player.vy > 500 ? 4 : player.vy > 280 ? 3 : 2;
      const sdt = dt / steps;
      let landed = false;
      for (let s = 0; s < steps && !landed; s++) {
        const prevFeet = player.y + FOOT;
        player.vy += GRAV * sdt;
        player.vy = Math.min(player.vy, 760);
        player.y += player.vy * sdt;
        const feet = player.y + FOOT;

        // only land while descending; ignore while jetting upward
        if (player.vy <= 40) continue;
        if (jetActive > 0.12 && player.vy < 120) continue;

        // prefer highest platform crossed this substep
        let best = null;
        for (const p of platforms) {
          if (p.state !== 'solid') continue;
          const inX = player.x >= p.x - 12 && player.x <= p.x + p.w + 12;
          if (!inX) continue;
          const top = p.y;
          // swept crossing: feet went from above/at top to below/at top
          const thickness = Math.max(22, Math.abs(player.vy) * sdt + 14);
          if (feet >= top && prevFeet <= top + thickness) {
            if (!best || p.y < best.y) best = p;
          }
        }
        if (!best) continue;

        landed = true;
        if (best.type === 'fake') {
          best.state = 'breaking';
          best.breakT = 0.28;
          audio.hit();
        } else if (best.type === 'break') {
          best.state = 'breaking';
          best.breakT = 0.32;
          landOn(best, BREAK_V, true);
          particles.burst(best.x + best.w / 2, best.y, '#a08050', 8, 110);
        } else if (best.type === 'spring') {
          landOn(best, SPRING_V, true);
          particles.burst(best.x + best.w / 2, best.y, PALETTE.good, 14, 180);
          spawnFloater(best.x + best.w / 2, best.y - 20, 'BOING!', PALETTE.good);
        } else {
          landOn(best, BOUNCE_V, true);
          particles.burst(best.x + best.w / 2, best.y + 4, 'rgba(255,255,255,0.45)', 4, 70);
        }
      }

      for (const pk of pickups) {
        if (pk.taken) continue;
        pk.bob += dt * 4;
        if (Math.hypot(player.x - pk.x, player.y - pk.y) < 30) {
          pk.taken = true;
          if (pk.kind === 'horseshoe') {
            jetCharge = 1;
            audio.pickup();
            spawnFloater(pk.x, pk.y, 'JET+', '#8ad0ff');
          } else {
            pickupScore += 50;
            audio.pickup();
            spawnFloater(pk.x, pk.y, '+50', '#ffe080');
          }
          particles.burst(pk.x, pk.y, '#ffe080', 8, 120);
        }
      }

      // smooth camera that only climbs
      const desiredCam = player.y - h * 0.52;
      if (desiredCam < cameraY) {
        cameraY = lerp(cameraY, desiredCam, 1 - Math.exp(-CAM_LERP * dt));
      }
      lowestY = Math.min(lowestY, player.y);
      maxHeightM = heightM(startY, lowestY);

      ensurePlatforms();

      dustT -= dt;
      if ((jetActive > 0 || player.vy < -200) && dustT <= 0) {
        dustT = 0.06;
        particles.burst(player.x, player.y + 18, jetActive > 0 ? '#8ad0ff' : 'rgba(255,255,255,0.25)', 2, 45);
      }

      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.life -= dt;
        f.y += f.vy * dt;
        if (f.life <= 0) floaters.splice(i, 1);
      }

      // generous death margin so a near-miss still feels fair
      if (player.y - cameraY > h + 70) {
        audio.die();
        particles.burst(player.x, cameraY + h, '#8a7360', 16, 160);
        return endFn({
          score: scoreNow(),
          time: elapsed,
          stats: [
            `Height ${Math.floor(maxHeightM)}m`,
            `Jets used ${jetsUsed}`,
            `Pickups +${pickupScore}`,
          ],
          extra: { height: maxHeightM, jetsUsed },
        });
      }
      return null;
    },

    drawPlay(ctx, w, h) {
      ctx.save();
      if (shake > 0) {
        const m = shake * 10;
        ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
      }

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#192a1e');
      grad.addColorStop(0.55, PALETTE.skyTop);
      grad.addColorStop(1, PALETTE.skyBot);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.translate(0, -cameraY * 0.28);
      ctx.fillStyle = 'rgba(100,120,90,0.18)';
      for (let i = 0; i < 6; i++) {
        const hy = (i * 260) % (h + 400) - 200;
        ctx.beginPath();
        ctx.ellipse(w * ((i * 0.37) % 1), hy, 140, 60, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.save();
      ctx.translate(0, -cameraY);

      for (let sy = Math.floor(cameraY / 90) * 90; sy < cameraY + h + 90; sy += 90) {
        ctx.fillStyle = 'rgba(255,255,255,0.045)';
        ctx.fillRect(0, sy, w, 1);
      }

      for (const p of platforms) {
        if (p.state === 'gone') continue;
        const shakeOff = p.state === 'breaking' ? (Math.random() - 0.5) * 4 : 0;
        const alpha = p.type === 'fake' ? (p.state === 'breaking' ? Math.max(0, p.breakT / 0.3) : 0.55) : 1;
        ctx.globalAlpha = alpha;
        let color = PALETTE.groundTop;
        if (p.type === 'spring') color = '#6aab5a';
        else if (p.type === 'break') color = '#a08050';
        else if (p.type === 'moving') color = '#7a9a86';
        else if (p.type === 'fake') color = '#8a9878';
        ctx.fillStyle = color;
        const py = p.y + (p.state === 'breaking' && p.type === 'break' ? (1 - p.breakT / 0.32) * 18 : 0);
        ctx.fillRect(p.x + shakeOff, py, p.w, 12);
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(p.x + shakeOff, py + 9, p.w, 4);
        if (p.type === 'spring') {
          ctx.fillStyle = '#3f6a37';
          ctx.fillRect(p.x + p.w / 2 - 7, p.y - 8, 14, 9);
        }
        ctx.globalAlpha = 1;
      }

      for (const pk of pickups) {
        if (pk.taken) continue;
        const by = pk.y + Math.sin(pk.bob) * 3;
        if (pk.kind === 'horseshoe') {
          ctx.strokeStyle = PALETTE.accent;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(pk.x, by, 11, 0.25, Math.PI * 1.75);
          ctx.stroke();
        } else {
          ctx.fillStyle = '#ffe080';
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
            const a2 = a + Math.PI / 5;
            ctx.lineTo(pk.x + Math.cos(a) * 10, by + Math.sin(a) * 10);
            ctx.lineTo(pk.x + Math.cos(a2) * 4, by + Math.sin(a2) * 4);
          }
          ctx.closePath();
          ctx.fill();
        }
      }

      for (const hz of hazards) {
        if (hz.done) continue;
        if (hz.kind === 'bird') {
          const bob = Math.sin(hz.bob) * 4;
          ctx.fillStyle = '#3a3228';
          ctx.save();
          ctx.translate(hz.x, hz.y + bob);
          ctx.scale(hz.vx < 0 ? -1 : 1, 1);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(-16, 6);
          ctx.lineTo(-2, 2);
          ctx.lineTo(14, 7);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (!hz.active) {
          const pulse = 0.25 + 0.25 * Math.sin(elapsed * 14);
          ctx.fillStyle = `rgba(255,230,90,${pulse})`;
          ctx.fillRect(hz.x - 3, hz.y - 130, 6, 130);
          ctx.fillStyle = '#ffe060';
          ctx.beginPath();
          ctx.arc(hz.x, hz.y - 130, 7, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = '#fff6c0';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(hz.x, hz.y - 110);
          ctx.lineTo(hz.x - 12, hz.y - 40);
          ctx.lineTo(hz.x + 6, hz.y - 38);
          ctx.lineTo(hz.x - 10, hz.y + 10);
          ctx.stroke();
        }
      }

      const bobTilt = clamp(player.vx / MAX_VX, -1, 1) * 0.14;
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(bobTilt);
      ctx.translate(-player.x, -player.y);
      drawDonkey(ctx, {
        x: player.x - 21,
        y: player.y - 28 + (onPlatformFeel > 0 ? 2 : 0),
        scale: 1.0,
        facing,
        pose: jetActive > 0 || player.vy < -60 ? 'jump' : 'idle',
        hurt: hitI > 0,
        runPhase,
      });
      ctx.restore();

      if (jetActive > 0) {
        ctx.fillStyle = 'rgba(100,190,255,0.6)';
        ctx.beginPath();
        ctx.moveTo(player.x - 8, player.y + 20);
        ctx.lineTo(player.x + 8, player.y + 20);
        ctx.lineTo(player.x, player.y + 24 + 20 + jetActive * 34);
        ctx.closePath();
        ctx.fill();
      }

      particles.draw(ctx);

      for (const f of floaters) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, f.life / f.max);
        drawText(ctx, f.text, f.x, f.y, {
          align: 'center',
          font: 'bold 15px Courier New, monospace',
          color: f.color,
        });
        ctx.restore();
      }

      ctx.restore();
      ctx.restore();

      const hm = Math.floor(maxHeightM);
      drawText(ctx, `${hm}m`, w / 2, 14, {
        align: 'center',
        font: 'bold 22px Courier New, monospace',
        color: PALETTE.accent,
      });
      drawText(ctx, `SCORE ${scoreNow()}`, 16, 14, { font: '14px Courier New, monospace' });
      drawText(ctx, formatTime(elapsed), w - 16, 14, { align: 'right', color: '#8a9878' });
      drawText(ctx, jetCharge ? 'JET READY (Space)' : 'JET EMPTY — land to refill', 16, 34, {
        color: jetCharge ? PALETTE.good : '#8a9878',
        font: '13px Courier New, monospace',
      });
      if (Math.abs(wind) > 18) {
        drawText(ctx, wind > 0 ? 'WIND →' : '← WIND', w - 16, 34, {
          align: 'right',
          color: '#8a9878',
        });
      }
    },

    getMedalChecks(result) {
      const ids = [];
      const hm = result.extra?.height ?? maxHeightM;
      const ju = result.extra?.jetsUsed ?? jetsUsed;
      if (hm >= 100) ids.push('bounce_100m');
      if (hm >= 250) ids.push('bounce_250m');
      if (ju >= 10) ids.push('bounce_jet_10');
      return ids;
    },
  };

  return createShellGame(DEF, api, controller);
}
