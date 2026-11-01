import { createShellGame } from '../../shared/gameShell.js';
import { drawDonkey, PALETTE } from '../../shared/donkey.js';
import { drawText, drawHearts, formatTime } from '../../shared/ui.js';
import * as audio from '../../shared/audio.js';

const DEF = {
  id: 'kickfield',
  title: 'KICKFIELD',
};

/**
 * Rhythm kick game.
 * Pick lane with W/S (or arrows), then Space to kick on that lane only.
 * All targets share the same speed; arrivals are spaced one-at-a-time.
 * Speed rises x1.25 every 30s (capped).
 */

const HEIGHTS = 3;
const PERFECT_WINDOW = 0.08;
const GOOD_WINDOW = 0.18;
const FEVER_COMBO = 8;
const FEVER_DUR = 4.5;
const MULT_CAP_COMBO = 12;
const MAX_MISSES = 3;
const COACH_DUR = 6;

const BASE_SPEED = 170; // px/s leftward
const SPEED_CAP = 420;
const SPEED_STEP = 1.25;
const SPEED_EVERY = 30; // seconds
const MIN_ARRIVAL_GAP = 0.95; // seconds between kick-line arrivals
const SPAWN_LEAD = 0.15; // schedule next a bit after last spawn decision

const ROW_FRAC = [0.76, 0.55, 0.34];
const ROW_POSE = ['crouch', 'idle', 'jump'];
const ROW_LABEL = ['LOW', 'MID', 'HIGH'];

const TARGET_DEF = {
  balloon: { pts: 100, r: 18, color: '#e06080' },
  bucket: { pts: 200, r: 20, color: '#6a8aa8' },
  soldier: { pts: 350, r: 19, color: '#4f5f3e' },
  golden: { pts: 500, r: 17, color: '#ffc840' },
};

function rowY(h, row) {
  return h * ROW_FRAC[row];
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function comboMult(combo) {
  const c = clamp(combo, 0, MULT_CAP_COMBO);
  return 1 + (c / MULT_CAP_COMBO) * 2;
}

export function createGame(canvas, api) {
  const { input, particles } = api;

  let elapsed = 0;
  let row = 1;
  let targets = [];
  let spawnT = 0.6;

  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let misses = 0;
  let fever = 0;
  let feverCount = 0;

  let kickAnim = 0;
  let runPhase = 0;
  let kickLine = 0;
  let donkeyX = 0;
  let shake = 0;

  let bigFlash = null;
  let floaters = [];
  let hitReady = false;

  let speedTier = 0;
  let banner = null;
  let nextArrivalAt = 0; // absolute time of next target at kick line

  function scrollSpeed() {
    return Math.min(SPEED_CAP, BASE_SPEED * Math.pow(SPEED_STEP, speedTier));
  }

  function reset() {
    const w = api.canvas.width;
    elapsed = 0;
    row = 1;
    targets = [];
    spawnT = 0.8;
    score = 0;
    combo = 0;
    maxCombo = 0;
    misses = 0;
    fever = 0;
    feverCount = 0;
    kickAnim = 0;
    runPhase = 0;
    donkeyX = w * 0.18;
    kickLine = donkeyX + 78;
    shake = 0;
    bigFlash = null;
    floaters = [];
    hitReady = false;
    speedTier = 0;
    banner = null;
    nextArrivalAt = 0; // first spawn will use full off-screen travel time
  }

  function pickTargetKind() {
    const r = Math.random();
    if (r < 0.04 || (fever > 0 && r < 0.16)) return 'golden';
    if (r < 0.42) return 'balloon';
    if (r < 0.72) return 'bucket';
    return 'soldier';
  }

  function pickRow() {
    if (elapsed < 8) return 1;
    if (elapsed < 16) return Math.random() < 0.5 ? 1 : Math.floor(Math.random() * HEIGHTS);
    return Math.floor(Math.random() * HEIGHTS);
  }

  /** Seconds until target reaches kick line (negative = past). */
  function timingError(t) {
    return (t.x - kickLine) / -t.vx;
  }

  function latestLiveArrival() {
    let latest = elapsed;
    for (const t of targets) {
      if (t.hit || t.missed) continue;
      latest = Math.max(latest, elapsed + timingError(t));
    }
    return latest;
  }

  function spawnTarget() {
    const w = api.canvas.width;
    const h = api.canvas.height;
    const speed = scrollSpeed();
    const kind = pickTargetKind();
    const r = pickRow();

    // Always enter from off-screen right ("from the back")
    const spawnX = w + 56;
    const minEta = (spawnX - kickLine) / speed;

    // Never overlap arrivals — schedule after the latest live/planned arrival
    const planned = Math.max(nextArrivalAt, latestLiveArrival() + MIN_ARRIVAL_GAP);
    const eta = Math.max(minEta, planned - elapsed);
    const arrivalAt = elapsed + eta;
    nextArrivalAt = arrivalAt + MIN_ARRIVAL_GAP;

    targets.push({
      kind,
      row: r,
      x: kickLine + speed * eta, // >= spawnX
      y: rowY(h, r),
      vx: -speed,
      hit: false,
      missed: false,
    });
  }

  function resyncSpeeds(newSpeed) {
    // Keep each target's time-to-line so gaps stay valid after a speed tier up
    for (const t of targets) {
      if (t.hit || t.missed) continue;
      const eta = Math.max(0.05, timingError(t));
      t.vx = -newSpeed;
      t.x = kickLine + newSpeed * eta;
    }
    nextArrivalAt = latestLiveArrival() + MIN_ARRIVAL_GAP;
  }

  function spawnFloater(x, y, text, color) {
    floaters.push({ x, y, text, color, life: 0.65, max: 0.65, vy: -52 });
  }

  function setFlash(text, color) {
    bigFlash = { text, color, life: 0.5, max: 0.5 };
  }

  function findBestTarget() {
    let best = null;
    let bestErr = Infinity;
    const window = fever > 0 ? GOOD_WINDOW * 1.2 : GOOD_WINDOW;
    for (const t of targets) {
      if (t.hit || t.missed) continue;
      if (t.row !== row) continue;
      const err = Math.abs(timingError(t));
      if (err <= window && err < bestErr) {
        bestErr = err;
        best = t;
      }
    }
    return best ? { target: best, err: bestErr } : null;
  }

  function doKick() {
    const hit = findBestTarget();
    if (!hit) {
      kickAnim = 0.1;
      return;
    }

    const { target: best, err: bestErr } = hit;
    kickAnim = 0.28;
    audio.kick();
    best.hit = true;

    const perfect = bestErr <= PERFECT_WINDOW || fever > 0;
    setFlash(perfect ? 'PERFECT!' : 'GOOD', perfect ? '#ffe080' : PALETTE.good);
    if (perfect) audio.perfect();
    else audio.pickup();

    combo += 1;
    maxCombo = Math.max(maxCombo, combo);
    if (combo >= FEVER_COMBO && fever <= 0) {
      fever = FEVER_DUR;
      feverCount++;
      audio.start();
      setFlash('FEVER!', '#ff9040');
    }

    const mult = comboMult(combo) * (fever > 0 ? 1.5 : 1);
    let pts = Math.floor(TARGET_DEF[best.kind].pts * mult);
    if (perfect) pts = Math.floor(pts * 1.25);
    score += pts;
    spawnFloater(best.x, best.y - 12, `+${pts}`, perfect ? '#ffe080' : PALETTE.text);

    if (best.kind === 'golden') {
      misses = Math.max(0, misses - 1);
      shake = Math.max(shake, 0.25);
      spawnFloater(best.x, best.y - 34, 'LIFE +1', '#ffc840');
      particles.burst(best.x, best.y, '#ffc840', 16, 170);
    } else {
      particles.burst(best.x, best.y, TARGET_DEF[best.kind].color, 12, 130);
    }
  }

  const controller = {
    reset,
    updatePlay(dt, endFn) {
      elapsed += dt;
      runPhase += dt * 9;
      const w = api.canvas.width;
      const h = api.canvas.height;
      donkeyX = w * 0.18;
      kickLine = donkeyX + 78;
      shake = Math.max(0, shake - dt * 2.6);

      if (banner) {
        banner.life -= dt;
        if (banner.life <= 0) banner = null;
      }

      const tier = Math.floor(elapsed / SPEED_EVERY);
      if (tier > speedTier) {
        speedTier = tier;
        banner = { text: 'SPEED UP!', life: 1.15 };
        audio.pickup();
        resyncSpeeds(scrollSpeed());
      }

      if (kickAnim > 0) kickAnim -= dt;

      if (input.pressed('w') || input.pressed('ArrowUp')) {
        if (row < HEIGHTS - 1) {
          row++;
          audio.uiClick();
        }
      }
      if (input.pressed('s') || input.pressed('ArrowDown')) {
        if (row > 0) {
          row--;
          audio.uiClick();
        }
      }
      if (input.pressed('Space')) doKick();

      if (fever > 0) fever -= dt;

      // Spawn on a steady beat: one arrival slot at a time
      spawnT -= dt;
      if (spawnT <= 0) {
        spawnTarget();
        // next attempt soon; actual spacing enforced by nextArrivalAt
        spawnT = MIN_ARRIVAL_GAP * 0.55 + SPAWN_LEAD;
      }

      hitReady = !!findBestTarget();

      const speed = scrollSpeed();
      for (const t of targets) {
        // lock all to current tier speed (no relative overtake)
        if (!t.hit && !t.missed && Math.abs(-t.vx - speed) > 0.5) {
          const eta = Math.max(0.02, timingError(t));
          t.vx = -speed;
          t.x = kickLine + speed * eta;
        }
        t.x += t.vx * dt;
        t.y = rowY(h, t.row);
        if (!t.hit && !t.missed && t.x < kickLine - 30) {
          t.missed = true;
          misses++;
          combo = 0;
          audio.hit();
          setFlash('MISSED!', '#c05040');
          shake = Math.max(shake, 0.22);
        }
      }
      targets = targets.filter((t) => t.x > -90 && !(t.hit && t.x < kickLine - 50));

      if (bigFlash) {
        bigFlash.life -= dt;
        if (bigFlash.life <= 0) bigFlash = null;
      }
      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.life -= dt;
        f.y += f.vy * dt;
        if (f.life <= 0) floaters.splice(i, 1);
      }

      if (misses >= MAX_MISSES) {
        audio.die();
        return endFn({
          score,
          time: elapsed,
          stats: [`Max combo ${maxCombo}`, `Fever x${feverCount}`, `Score ${score}`],
          extra: { maxCombo, feverCount, score },
        });
      }
      return null;
    },

    drawPlay(ctx, w, h) {
      ctx.save();
      if (shake > 0) {
        const m = shake * 7;
        ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
      }

      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, '#3d4a32');
      grad.addColorStop(0.5, PALETTE.skyBot);
      grad.addColorStop(1, '#5c6a48');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.fillRect(0, h * 0.86, w, h * 0.14);

      for (let r = 0; r < HEIGHTS; r++) {
        const ly = rowY(h, r);
        const active = r === row;
        ctx.strokeStyle = active ? 'rgba(201,162,39,0.7)' : 'rgba(201,162,39,0.18)';
        ctx.lineWidth = active ? 3 : 1;
        ctx.beginPath();
        ctx.moveTo(w * 0.12, ly);
        ctx.lineTo(w, ly);
        ctx.stroke();
        drawText(ctx, ROW_LABEL[r], w - 12, ly - 8, {
          align: 'right',
          color: active ? PALETTE.accent : 'rgba(200,212,184,0.35)',
          font: active ? 'bold 11px Courier New, monospace' : '10px Courier New, monospace',
        });
      }

      const zoneW = 40;
      ctx.fillStyle = hitReady ? 'rgba(130,220,120,0.25)' : 'rgba(255,240,180,0.08)';
      ctx.fillRect(kickLine - zoneW / 2, h * 0.22, zoneW, h * 0.62);

      ctx.strokeStyle = hitReady ? '#8fd86a' : 'rgba(255,240,180,0.75)';
      ctx.lineWidth = hitReady ? 4 : 2;
      ctx.beginPath();
      ctx.moveTo(kickLine, h * 0.22);
      ctx.lineTo(kickLine, h * 0.84);
      ctx.stroke();

      drawText(ctx, hitReady ? 'SPACE!' : 'KICK HERE', kickLine, h * 0.18, {
        align: 'center',
        color: hitReady ? '#8fd86a' : '#ffe080',
        font: hitReady ? 'bold 14px Courier New, monospace' : '11px Courier New, monospace',
      });

      for (const t of targets) {
        if (t.hit) continue;
        const def = TARGET_DEF[t.kind];
        const err = timingError(t);
        const inWindow = !t.missed && Math.abs(err) <= GOOD_WINDOW;

        if (t.kind === 'balloon') {
          ctx.fillStyle = def.color;
          ctx.beginPath();
          ctx.ellipse(t.x, t.y - 8, def.r, def.r + 6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#dddddd';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(t.x, t.y + 2);
          ctx.lineTo(t.x, t.y + 18);
          ctx.stroke();
        } else if (t.kind === 'bucket') {
          ctx.fillStyle = def.color;
          ctx.beginPath();
          ctx.moveTo(t.x - 15, t.y - 10);
          ctx.lineTo(t.x + 15, t.y - 10);
          ctx.lineTo(t.x + 11, t.y + 14);
          ctx.lineTo(t.x - 11, t.y + 14);
          ctx.closePath();
          ctx.fill();
        } else if (t.kind === 'soldier') {
          ctx.fillStyle = def.color;
          ctx.fillRect(t.x - 9, t.y - 16, 18, 26);
          ctx.fillStyle = '#3a3028';
          ctx.fillRect(t.x - 11, t.y - 24, 22, 9);
        } else {
          ctx.fillStyle = def.color;
          ctx.beginPath();
          ctx.moveTo(t.x, t.y - 16);
          ctx.lineTo(t.x + 11, t.y + 11);
          ctx.lineTo(t.x - 11, t.y + 11);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#3a8040';
          ctx.fillRect(t.x - 2, t.y - 22, 4, 7);
        }

        if (inWindow && t.row === row) {
          ctx.strokeStyle = Math.abs(err) <= PERFECT_WINDOW ? '#ffe080' : '#8fd86a';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(t.x, t.y, def.r + 8, 0, Math.PI * 2);
          ctx.stroke();
        } else if (inWindow && t.row !== row) {
          ctx.strokeStyle = 'rgba(255,100,80,0.55)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(t.x, t.y, def.r + 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      const dy = rowY(h, row);
      drawDonkey(ctx, {
        x: donkeyX - 22,
        y: dy - 34,
        scale: 1.15,
        facing: 1,
        pose: kickAnim > 0.05 ? 'kick' : ROW_POSE[row],
        runPhase,
      });

      particles.draw(ctx);
      for (const f of floaters) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, f.life / f.max);
        drawText(ctx, f.text, f.x, f.y, {
          align: 'center',
          font: 'bold 14px Courier New, monospace',
          color: f.color,
        });
        ctx.restore();
      }
      ctx.restore();

      if (fever > 0) {
        ctx.fillStyle = 'rgba(255,120,40,0.12)';
        ctx.fillRect(0, 0, w, h);
        drawText(ctx, `FEVER ${fever.toFixed(1)}s`, w / 2, h * 0.1, {
          align: 'center',
          font: 'bold 20px Courier New, monospace',
          color: '#ff9040',
        });
      }

      if (bigFlash) {
        const t = bigFlash.life / bigFlash.max;
        ctx.save();
        ctx.globalAlpha = clamp(t * 1.5, 0, 1);
        drawText(ctx, bigFlash.text, w * 0.55, h * 0.3, {
          align: 'center',
          font: 'bold 34px Courier New, monospace',
          color: bigFlash.color,
        });
        ctx.restore();
      }

      if (banner) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, banner.life * 2);
        drawText(ctx, banner.text, w / 2, h * 0.26, {
          align: 'center',
          font: 'bold 28px Courier New, monospace',
          color: PALETTE.accent,
        });
        ctx.restore();
      }

      if (elapsed < COACH_DUR) {
        const a = elapsed < COACH_DUR - 1 ? 1 : COACH_DUR - elapsed;
        ctx.save();
        ctx.globalAlpha = clamp(a, 0, 0.95);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(w * 0.14, h * 0.865, w * 0.72, 42);
        drawText(ctx, 'W/S choose height, then Space when it hits YOUR lane', w / 2, h * 0.888, {
          align: 'center',
          font: '13px Courier New, monospace',
          color: '#e8f0d8',
        });
        ctx.restore();
      }

      drawHearts(ctx, 16, 14, Math.max(0, MAX_MISSES - misses), MAX_MISSES);
      drawText(ctx, `SCORE ${score}`, 16, 38, { font: 'bold 16px Courier New, monospace' });
      drawText(ctx, formatTime(elapsed), w - 16, 14, { align: 'right', color: '#8a9878' });
      drawText(ctx, `COMBO ${combo}`, 16, 58, {
        color: combo >= FEVER_COMBO ? '#ff9040' : PALETTE.text,
      });
      drawText(ctx, `${comboMult(combo).toFixed(1)}x`, 16, 76, { color: PALETTE.accent });
      drawText(ctx, `SPD x${Math.pow(SPEED_STEP, speedTier).toFixed(2)}`, w - 16, 36, {
        align: 'right',
        color: '#8a9878',
        font: '12px Courier New, monospace',
      });

    },

    getMedalChecks(result) {
      const ids = [];
      const mc = result.extra?.maxCombo ?? maxCombo;
      const fc = result.extra?.feverCount ?? feverCount;
      const sc = result.score ?? score;
      if (mc >= 10) ids.push('kick_combo_10');
      if (fc >= 3) ids.push('kick_fever_3');
      if (sc >= 5000) ids.push('kick_score_5k');
      return ids;
    },
  };

  return createShellGame(DEF, api, controller);
}
