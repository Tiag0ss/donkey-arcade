import { createShellGame } from '../../shared/gameShell.js';
import { drawDonkey, PALETTE } from '../../shared/donkey.js';
import { drawText, drawHearts, formatTime } from '../../shared/ui.js';
import * as audio from '../../shared/audio.js';

const DEF = {
  id: 'derby',
  title: 'DONKEY DERBY',
};

const LANES = 3;
const WORLD_SCALE = 10; // px of scroll per 1 "meter" of distance
const BASE_SCROLL = 220; // px/s at start
const SCROLL_CAP = 520; // px/s max
const SPEED_STEP = 1.25; // multiply every SPEED_EVERY seconds
const SPEED_EVERY = 30;
const EASY_WINDOW = 16; // seconds of forgiving spawn rates
const HAZARD_DELAY = 2.2; // no hazards before this
const IFRAME_DUR = 1.0;
const NITRO_DUR = 2.0;
const NITRO_MAX = 2;
const SLOW_DUR = 1.1;
const LANE_LERP_RATE = 14;
const NEAR_MISS_BONUS = 35;
const CARROT_BONUS = 20;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function approach(current, target, dt, rate) {
  const t = 1 - Math.exp(-rate * dt);
  return current + (target - current) * t;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function laneX(w, laneF) {
  const pad = w * 0.14;
  const inner = w - pad * 2;
  return pad + (inner * (laneF + 0.5)) / LANES;
}

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function createGame(canvas, api) {
  const { input, particles } = api;

  let elapsed = 0;
  let distance = 0;
  let scrollSpeed = BASE_SCROLL;
  let runPhase = 0;

  let lane = 1;
  let playerX = 0;
  let playerScreenY = 0;

  let hp = 3;
  let iframes = 0;
  let slowT = 0;
  let shake = 0;

  let nitroStock = 0;
  let nitroActive = 0;
  let nitroGhost = false;
  let nitroUsed = 0;

  let carrots = 0;
  let nearMisses = 0;
  let hits = 0;
  let dustT = 0;
  let speedTier = 0;
  let banner = null;

  let entities = [];
  let spawnT = HAZARD_DELAY;
  let floaters = [];

  let rivals = [];

  function spawnFloater(x, y, text, color) {
    floaters.push({ x, y, text, color, life: 0.75, max: 0.75, vy: -42 });
  }

  function makeRival(startLane, offset, name, color) {
    return {
      name,
      color,
      lane: startLane,
      visualX: 0,
      dist: offset,
      dodgeCd: Math.random() * 0.4,
      mult: 0.94 + Math.random() * 0.12,
    };
  }

  function reset() {
    const w = api.canvas.width;
    const h = api.canvas.height;
    elapsed = 0;
    distance = 0;
    scrollSpeed = BASE_SCROLL;
    runPhase = 0;
    lane = 1;
    playerX = laneX(w, lane);
    playerScreenY = h * 0.74;
    hp = 3;
    iframes = 0;
    slowT = 0;
    shake = 0;
    nitroStock = 0;
    nitroActive = 0;
    nitroGhost = false;
    nitroUsed = 0;
    carrots = 0;
    nearMisses = 0;
    hits = 0;
    dustT = 0;
    speedTier = 0;
    banner = null;
    entities = [];
    spawnT = HAZARD_DELAY;
    floaters = [];
    rivals = [makeRival(0, -24, 'Dusty', '#8a7050'), makeRival(2, -52, 'Mule', '#6a7d5c')];
  }

  function scoreNow() {
    return Math.floor(distance) + carrots * CARROT_BONUS + nearMisses * NEAR_MISS_BONUS;
  }

  function easeProgress() {
    return clamp(elapsed / EASY_WINDOW, 0, 1);
  }

  function spawnAheadDist() {
    return (api.canvas.height * 1.35) / WORLD_SCALE;
  }

  function spawnEntity() {
    const ease = easeProgress();
    const hazardChance = lerp(0.22, 0.62, ease);
    const ahead = spawnAheadDist();
    const worldY = distance + ahead;

    if (Math.random() < hazardChance) {
      const roll = Math.random();
      if (roll < 0.14 && elapsed > 6) {
        const startLane = Math.random() < 0.5 ? 0 : LANES - 1;
        const endLane = LANES - 1 - startLane;
        entities.push({
          kind: 'tractor',
          startLane,
          endLane,
          spawnAhead: ahead,
          worldY,
          hit: false,
          passed: false,
          nearChecked: false,
        });
      } else if (roll < 0.45) {
        entities.push({
          kind: 'puddle',
          lane: Math.floor(Math.random() * LANES),
          worldY,
          hit: false,
          passed: false,
          nearChecked: false,
        });
      } else {
        entities.push({
          kind: 'barrier',
          lane: Math.floor(Math.random() * LANES),
          worldY,
          hit: false,
          passed: false,
          nearChecked: false,
        });
      }
    } else {
      const kind = Math.random() < 0.68 ? 'carrot' : 'chili';
      entities.push({
        kind,
        lane: Math.floor(Math.random() * LANES),
        worldY,
        hit: false,
        passed: false,
        nearChecked: false,
      });
    }
  }

  function entityLaneF(e) {
    if (e.kind !== 'tractor') return e.lane;
    const progress = clamp(1 - (e.worldY - distance) / e.spawnAhead, 0, 1);
    return lerp(e.startLane, e.endLane, progress);
  }

  function entityScreenY(e) {
    return playerScreenY - (e.worldY - distance) * WORLD_SCALE;
  }

  function entityRect(w, e) {
    const laneF = entityLaneF(e);
    const x = laneX(w, laneF);
    const y = entityScreenY(e);
    if (e.kind === 'barrier') return { x: x - 20, y: y - 26, w: 40, h: 52, cx: x, cy: y };
    if (e.kind === 'puddle') return { x: x - 26, y: y - 14, w: 52, h: 26, cx: x, cy: y };
    if (e.kind === 'tractor') return { x: x - 27, y: y - 28, w: 54, h: 56, cx: x, cy: y };
    return { x: x - 15, y: y - 17, w: 30, h: 34, cx: x, cy: y };
  }

  function playerRect() {
    return {
      x: playerX - 21,
      y: playerScreenY - 28,
      w: 42,
      h: 56,
      cx: playerX,
      cy: playerScreenY,
    };
  }

  function damage() {
    if (iframes > 0) return false;
    if (nitroActive > 0 && nitroGhost) {
      nitroGhost = false;
      return false;
    }
    hp--;
    hits++;
    iframes = IFRAME_DUR;
    shake = Math.max(shake, 0.4);
    audio.hurt();
    particles.burst(playerX, playerScreenY, '#c05040', 12, 160);
    return hp <= 0;
  }

  function collect(e, rect) {
    if (e.kind === 'carrot') {
      carrots++;
      audio.pickup();
      particles.burst(rect.cx, rect.cy, '#ff9040', 7, 110);
      spawnFloater(rect.cx, rect.cy, `+${CARROT_BONUS}`, '#ffb060');
    } else if (e.kind === 'chili') {
      if (nitroStock < NITRO_MAX) {
        nitroStock++;
        particles.burst(rect.cx, rect.cy, '#e04030', 9, 130);
        spawnFloater(rect.cx, rect.cy, 'NITRO!', '#ff6040');
      }
      audio.pickup();
    }
  }

  function tryNitro() {
    if (nitroStock <= 0 || nitroActive > 0) return;
    nitroStock--;
    nitroActive = NITRO_DUR;
    nitroGhost = true;
    nitroUsed++;
    audio.nitro();
    particles.burst(playerX, playerScreenY + 20, '#8ad0ff', 14, 160);
  }

  function rankPlayer() {
    let rank = 1;
    for (const r of rivals) if (r.dist > distance) rank++;
    return rank;
  }

  const controller = {
    reset,
    updatePlay(dt, endFn) {
      elapsed += dt;
      runPhase += dt * 12;
      if (iframes > 0) iframes -= dt;
      if (slowT > 0) slowT -= dt;
      if (nitroActive > 0) nitroActive -= dt;
      shake = Math.max(0, shake - dt * 2.6);

      if (banner) {
        banner.life -= dt;
        if (banner.life <= 0) banner = null;
      }

      const tier = Math.floor(elapsed / SPEED_EVERY);
      if (tier > speedTier) {
        speedTier = tier;
        banner = { text: 'SPEED UP!', life: 1.2 };
        audio.pickup();
      }
      const rampedBase = Math.min(SCROLL_CAP, BASE_SCROLL * Math.pow(SPEED_STEP, tier));
      const slowMul = slowT > 0 ? 0.55 : 1;
      const nitroMul = nitroActive > 0 ? 1.55 : 1;
      scrollSpeed = rampedBase * slowMul * nitroMul;
      distance += (scrollSpeed * dt) / WORLD_SCALE;

      const w = api.canvas.width;
      const h = api.canvas.height;
      playerScreenY = h * 0.74;

      if (input.pressed('a') || input.pressed('ArrowLeft')) {
        if (lane > 0) {
          lane--;
          audio.uiClick();
        }
      }
      if (input.pressed('d') || input.pressed('ArrowRight')) {
        if (lane < LANES - 1) {
          lane++;
          audio.uiClick();
        }
      }
      if (input.pressed('Space')) tryNitro();

      const targetX = laneX(w, lane);
      playerX = approach(playerX, targetX, dt, LANE_LERP_RATE);

      dustT -= dt;
      if (dustT <= 0) {
        dustT = nitroActive > 0 ? 0.05 : 0.14;
        particles.burst(
          playerX + (Math.random() - 0.5) * 10,
          playerScreenY + 22,
          nitroActive > 0 ? '#8ad0ff' : '#8a7e68',
          2,
          40
        );
      }

      spawnT -= dt;
      if (spawnT <= 0) {
        spawnEntity();
        const ease = easeProgress();
        spawnT = lerp(1.05, 0.5, ease) + Math.random() * 0.25;
      }

      // Rivals: advance, rubber-band toward the player, and dodge hazards ahead.
      for (const r of rivals) {
        const gap = r.dist - distance;
        let mult = r.mult;
        if (gap > 55) mult *= 0.82;
        else if (gap < -55) mult *= 1.18;
        r.dist += ((rampedBase * dt) / WORLD_SCALE) * mult;

        r.dodgeCd -= dt;
        if (r.dodgeCd <= 0) {
          const lookahead = 42;
          let blocked = false;
          for (const e of entities) {
            if (e.kind === 'carrot' || e.kind === 'chili') continue;
            const eLane = Math.round(entityLaneF(e));
            if (eLane !== r.lane) continue;
            const gapToRival = e.worldY - r.dist;
            if (gapToRival > 0 && gapToRival < lookahead) {
              blocked = true;
              break;
            }
          }
          if (blocked) {
            const options = [0, 1, 2].filter((l) => l !== r.lane);
            for (const opt of options) {
              let clear = true;
              for (const e of entities) {
                if (e.kind === 'carrot' || e.kind === 'chili') continue;
                const eLane = Math.round(entityLaneF(e));
                if (eLane !== opt) continue;
                const gapToRival = e.worldY - r.dist;
                if (gapToRival > -10 && gapToRival < lookahead) {
                  clear = false;
                  break;
                }
              }
              if (clear) {
                r.lane = opt;
                break;
              }
            }
            r.dodgeCd = 0.5 + Math.random() * 0.3;
          } else {
            r.dodgeCd = 0.25;
          }
        }
        r.visualX = approach(r.visualX || laneX(w, r.lane), laneX(w, r.lane), dt, 9);
      }

      const pr = playerRect();
      let dead = false;

      for (let i = entities.length - 1; i >= 0; i--) {
        const e = entities[i];
        const sy = entityScreenY(e);

        if (!e.nearChecked && e.worldY <= distance) {
          e.nearChecked = true;
          const eLane = Math.round(entityLaneF(e));
          const isHazard = e.kind === 'barrier' || e.kind === 'puddle' || e.kind === 'tractor';
          if (isHazard && !e.hit && Math.abs(eLane - lane) === 1) {
            nearMisses++;
            audio.uiClick();
            spawnFloater(playerX, playerScreenY - 36, 'NICE!', '#ffe080');
          }
        }

        if (!e.passed && !e.hit) {
          const er = entityRect(w, e);
          if (aabb(pr, er)) {
            if (e.kind === 'carrot' || e.kind === 'chili') {
              collect(e, er);
              e.hit = true;
            } else if (e.kind === 'puddle') {
              slowT = SLOW_DUR;
              e.hit = true;
              audio.hit();
              spawnFloater(playerX, playerScreenY - 36, 'MUD!', '#6ab0e0');
            } else {
              const prevGhost = nitroGhost;
              dead = damage();
              e.hit = true;
              if (prevGhost && nitroActive > 0) {
                particles.burst(er.cx, er.cy, '#8ad0ff', 10, 130);
              }
            }
          }
        }

        if (sy > h + 70 || e.worldY < distance - 20) entities.splice(i, 1);
      }

      for (let i = floaters.length - 1; i >= 0; i--) {
        const f = floaters[i];
        f.life -= dt;
        f.y += f.vy * dt;
        if (f.life <= 0) floaters.splice(i, 1);
      }

      if (dead || hp <= 0) {
        audio.die();
        return endFn({
          score: scoreNow(),
          time: elapsed,
          stats: [
            `Distance ${Math.floor(distance)}m`,
            `Carrots ${carrots} · Near-miss ${nearMisses}`,
            `Nitro used ${nitroUsed}`,
          ],
          extra: { distance, nitroUsed, hits, score: scoreNow() },
        });
      }
      return null;
    },

    drawPlay(ctx, w, h) {
      ctx.save();
      if (shake > 0) {
        const m = shake * 9;
        ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
      }

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, PALETTE.skyTop);
      grad.addColorStop(1, PALETTE.skyBot);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      const pad = w * 0.14;
      ctx.fillStyle = '#44583a';
      ctx.fillRect(0, 0, pad, h);
      ctx.fillRect(w - pad, 0, pad, h);

      const fenceOff = (distance * WORLD_SCALE) % 46;
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 3;
      for (let y = -fenceOff; y < h; y += 46) {
        ctx.beginPath();
        ctx.moveTo(pad * 0.4, y);
        ctx.lineTo(pad * 0.4, y + 22);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(w - pad * 0.4, y);
        ctx.lineTo(w - pad * 0.4, y + 22);
        ctx.stroke();
      }

      ctx.fillStyle = PALETTE.ground;
      ctx.fillRect(pad, 0, w - pad * 2, h);

      // solid outer rails (edges only — no fixed dashes)
      ctx.strokeStyle = 'rgba(201,162,39,0.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pad, 0);
      ctx.lineTo(pad, h);
      ctx.moveTo(w - pad, 0);
      ctx.lineTo(w - pad, h);
      ctx.stroke();

      // scrolling road texture + lane dashes (synced to scrollSpeed / distance)
      const scrollPx = distance * WORLD_SCALE;
      const dashPeriod = 48;
      const scrollOff = ((scrollPx % dashPeriod) + dashPeriod) % dashPeriod;

      // dirt streaks across track
      ctx.fillStyle = 'rgba(90,80,60,0.18)';
      const streakPeriod = 36;
      const streakOff = ((scrollPx % streakPeriod) + streakPeriod) % streakPeriod;
      for (let y = -streakOff; y < h + streakPeriod; y += streakPeriod) {
        for (let ln = 0; ln < LANES; ln++) {
          const cx = laneX(w, ln);
          ctx.fillRect(cx - 22 + (ln % 2) * 6, y + 4, 18, 2);
          ctx.fillRect(cx + 8, y + 18, 12, 2);
        }
      }

      // lane separators — scrolling dashes only (never fixed on screen)
      ctx.strokeStyle = 'rgba(201,162,39,0.55)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'butt';
      for (let i = 1; i < LANES; i++) {
        const lx = pad + ((w - pad * 2) * i) / LANES;
        for (let y = -scrollOff; y < h + dashPeriod; y += dashPeriod) {
          ctx.beginPath();
          ctx.moveTo(lx, y);
          ctx.lineTo(lx, y + 22);
          ctx.stroke();
        }
      }

      // center lane chevrons moving toward player
      ctx.strokeStyle = 'rgba(200,212,184,0.22)';
      ctx.lineWidth = 2;
      const chevPeriod = 56;
      const chevOff = ((scrollPx % chevPeriod) + chevPeriod) % chevPeriod;
      for (let y = -chevOff; y < h + chevPeriod; y += chevPeriod) {
        for (let ln = 0; ln < LANES; ln++) {
          const cx = laneX(w, ln);
          ctx.beginPath();
          ctx.moveTo(cx - 8, y);
          ctx.lineTo(cx, y + 10);
          ctx.lineTo(cx + 8, y);
          ctx.stroke();
        }
      }

      const sorted = [...entities].sort((a, b) => b.worldY - a.worldY);
      for (const e of sorted) {
        const er = entityRect(w, e);
        if (e.kind === 'barrier') {
          ctx.fillStyle = '#7a3828';
          ctx.fillRect(er.x, er.y, er.w, er.h);
          ctx.fillStyle = PALETTE.accent;
          ctx.fillRect(er.x + 3, er.y + 8, er.w - 6, 7);
          ctx.fillRect(er.x + 3, er.y + er.h - 16, er.w - 6, 7);
        } else if (e.kind === 'puddle') {
          ctx.fillStyle = 'rgba(50,90,130,0.6)';
          ctx.beginPath();
          ctx.ellipse(er.cx, er.cy, er.w / 2, er.h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'rgba(140,190,230,0.5)';
          ctx.lineWidth = 2;
          ctx.stroke();
        } else if (e.kind === 'tractor') {
          ctx.fillStyle = '#35481f';
          ctx.fillRect(er.x + 6, er.y + 10, er.w - 12, er.h - 18);
          ctx.fillStyle = '#c9a227';
          ctx.fillRect(er.x + 10, er.y, er.w - 20, 18);
          ctx.fillStyle = '#1c1c18';
          ctx.beginPath();
          ctx.arc(er.x + 12, er.y + er.h - 8, 9, 0, Math.PI * 2);
          ctx.arc(er.x + er.w - 12, er.y + er.h - 8, 9, 0, Math.PI * 2);
          ctx.fill();
        } else if (e.kind === 'carrot') {
          ctx.fillStyle = '#ff8030';
          ctx.beginPath();
          ctx.moveTo(er.cx, er.y + 4);
          ctx.lineTo(er.x + er.w - 3, er.y + er.h - 3);
          ctx.lineTo(er.x + 3, er.y + er.h - 3);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#3a8040';
          ctx.fillRect(er.cx - 2, er.y - 6, 4, 10);
        } else {
          ctx.fillStyle = '#e03020';
          ctx.beginPath();
          ctx.moveTo(er.cx, er.y);
          ctx.quadraticCurveTo(er.x + er.w, er.y + 6, er.cx + 4, er.y + er.h);
          ctx.quadraticCurveTo(er.x, er.y + er.h - 4, er.cx, er.y);
          ctx.fill();
          ctx.fillStyle = '#3a8040';
          ctx.fillRect(er.cx - 2, er.y - 7, 4, 9);
        }
      }

      for (const r of rivals) {
        const sy = playerScreenY - (r.dist - distance) * WORLD_SCALE;
        if (sy < -60 || sy > h + 60) continue;
        drawDonkey(ctx, {
          x: r.visualX - 19,
          y: sy - 26,
          scale: 0.82,
          facing: 1,
          pose: 'run',
          runPhase: runPhase + r.dist * 0.3,
          tint: r.color,
        });
      }

      const pr = playerRect();
      if (nitroActive > 0) {
        ctx.fillStyle = 'rgba(120,200,255,0.22)';
        ctx.beginPath();
        ctx.ellipse(pr.cx, pr.cy, 36, 46, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      drawDonkey(ctx, {
        x: pr.x,
        y: pr.y,
        scale: 1.05,
        facing: 1,
        pose: 'run',
        runPhase,
        hurt: iframes > 0 && hp > 0,
        tint: nitroActive > 0 ? '#bcdcf0' : null,
      });

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

      drawHearts(ctx, 16, 14, hp, 3);
      drawText(ctx, `${Math.floor(distance)}m`, w - 16, 14, {
        align: 'right',
        font: 'bold 16px Courier New, monospace',
      });
      drawText(ctx, `SCORE ${scoreNow()}`, 16, 36, { font: '14px Courier New, monospace' });
      drawText(ctx, formatTime(elapsed), w - 16, 36, { align: 'right', color: '#8a9878' });
      drawText(ctx, `NITRO ${'I'.repeat(nitroStock)}${nitroStock === 0 ? '-' : ''}`, 16, 56, {
        color: nitroStock ? '#8ad0ff' : '#6a7860',
      });
      if (slowT > 0) drawText(ctx, 'MUD!', 16, 74, { color: '#6ab0e0' });
      if (rankPlayer() === 1) {
        drawText(ctx, '1ST', w / 2, 14, { align: 'center', font: 'bold 14px Courier New, monospace', color: PALETTE.accent });
      }
      drawText(ctx, `SPD x${Math.pow(SPEED_STEP, speedTier).toFixed(2)}`, w - 16, 56, {
        align: 'right',
        color: '#8a9878',
        font: '12px Courier New, monospace',
      });
      if (banner) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, banner.life * 2);
        drawText(ctx, banner.text, w / 2, h * 0.28, {
          align: 'center',
          font: 'bold 28px Courier New, monospace',
          color: PALETTE.accent,
        });
        ctx.restore();
      }
    },

    getMedalChecks(result) {
      const ids = [];
      const dist = result.extra?.distance ?? distance;
      const nu = result.extra?.nitroUsed ?? nitroUsed;
      const sc = result.score ?? scoreNow();
      const ht = result.extra?.hits ?? hits;
      if (sc >= 1000) ids.push('derby_1k');
      if (nu >= 5) ids.push('derby_nitro_5');
      if (dist >= 500 && ht === 0) ids.push('derby_no_hit_500m');
      return ids;
    },
  };

  return createShellGame(DEF, api, controller);
}
