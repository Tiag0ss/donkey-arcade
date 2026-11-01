import { createShellGame } from '../../shared/gameShell.js';
import { PALETTE } from '../../shared/donkey.js';
import { drawText, drawHearts } from '../../shared/ui.js';
import * as audio from '../../shared/audio.js';

const DEF = { id: 'duel', title: 'DONKEY DUEL' };

const GRAVITY = 1450;
const FLOOR = 0.8;
const MOVE_SPEED = 260;
const JUMP_VY = -460;
const ROUND_TIME = 25;
const CHARGE_RATE = 1.05;
const MAX_CHARGE = 1.15;
const KICK_RANGE = 108;
const BODY_HALF = 22;
const WINS_NEEDED = 3;
const KICK_ACTIVE = 0.12;
const KICK_RECOVERY = 0.28;
const LUNGE = 210;

function kickPower(charge) {
  if (charge < 0.28) return { type: 'whiff', dmg: 0, kb: 40, label: 'WHIFF' };
  if (charge < 0.62) return { type: 'normal', dmg: 1, kb: 220, label: 'HIT' };
  if (charge <= 0.9) return { type: 'perfect', dmg: 2, kb: 320, label: 'PERFECT' };
  return { type: 'over', dmg: 1, kb: 0, self: true, label: 'OVERCHARGE' };
}

function zoneColor(charge) {
  if (charge < 0.28) return '#7a8a70';
  if (charge < 0.62) return '#6aa8d0';
  if (charge <= 0.9) return '#e0b040';
  return '#d05040';
}

export function createGame(canvas, api) {
  const { input, particles, drawDonkey: drawDk, storage } = api;

  let mode = 'vsAi';
  let round = 0;
  let p1Wins = 0;
  let p2Wins = 0;
  let roundTimer = 0;
  let sudden = false;
  let matchOver = false;
  let ending = false;
  let p1 = null;
  let p2 = null;
  let perfects = 0;
  let clashes = 0;
  let beatAi = false;
  let streakUpdated = false;

  let hitStopT = 0;
  let shakeT = 0;
  let roundPauseT = 0;
  let koBannerT = 0;
  let koText = '';
  let floats = [];
  let dust = [];

  // AI
  let aiState = 'idle';
  let aiTimer = 0.5;
  let aiTargetCharge = 0.7;
  let aiDesire = 0;

  function mkPlayer(x, facing, isAi, tint) {
    return {
      x,
      y: 0,
      vx: 0,
      vy: 0,
      hp: 3,
      facing,
      onGround: true,
      block: false,
      charge: 0,
      charging: false,
      kickT: 0,
      kickActive: false,
      kickHit: false,
      kickData: null,
      hitstun: 0,
      runPhase: 0,
      isAi,
      tint: tint || null,
      landDust: false,
    };
  }

  function floorY(h) {
    return h * FLOOR;
  }

  function addFloat(x, y, text, color) {
    floats.push({ x, y, text, color, t: 0.9, vy: -55 });
  }

  function spawnDust(x, y, n = 4) {
    for (let i = 0; i < n; i++) {
      dust.push({
        x: x + (Math.random() - 0.5) * 18,
        y: y + (Math.random() - 0.5) * 4,
        vx: (Math.random() - 0.5) * 60,
        vy: -20 - Math.random() * 40,
        t: 0.25 + Math.random() * 0.25,
        r: 2 + Math.random() * 3,
      });
    }
  }

  function resetRoundPositions() {
    const w = api.canvas.width;
    const h = api.canvas.height;
    const fy = floorY(h);
    p1 = mkPlayer(w * 0.26, 1, false, null);
    p2 = mkPlayer(w * 0.74, -1, mode === 'vsAi', mode === 'vsAi' ? '#7a6a58' : '#6a5a70');
    p1.y = fy;
    p2.y = fy;
    roundTimer = 0;
    sudden = false;
    aiState = 'approach';
    aiTimer = 0.4 + Math.random() * 0.5;
    aiDesire = 0;
    roundPauseT = 1.05;
    floats = [];
  }

  function reset(m) {
    mode = m === 'vsLocal' ? 'vsLocal' : 'vsAi';
    round = 0;
    p1Wins = 0;
    p2Wins = 0;
    matchOver = false;
    ending = false;
    perfects = 0;
    clashes = 0;
    beatAi = false;
    streakUpdated = false;
    hitStopT = 0;
    shakeT = 0;
    dust = [];
    floats = [];
    resetRoundPositions();
  }

  function releaseKick(p) {
    p.charging = false;
    p.kickData = kickPower(p.charge);
    p.kickT = KICK_ACTIVE + KICK_RECOVERY;
    p.kickActive = false;
    p.kickHit = false;
    // Lunge toward facing
    if (p.kickData.type !== 'whiff' && !p.kickData.self) {
      p.vx = p.facing * LUNGE * (p.kickData.type === 'perfect' ? 1.15 : 1);
    } else {
      p.vx = p.facing * 40;
    }
    audio.kick();
    spawnDust(p.x, p.y, 5);
    p.charge = 0;
  }

  function facingToward(attacker, defender) {
    return Math.sign(defender.x - attacker.x) === attacker.facing || Math.abs(defender.x - attacker.x) < 12;
  }

  function inKickArc(attacker, defender) {
    const dx = defender.x - attacker.x;
    const ahead = dx * attacker.facing;
    if (ahead < -8) return false;
    return ahead <= KICK_RANGE && Math.abs(defender.y - attacker.y) < 56;
  }

  function applyKick(attacker, defender) {
    const data = attacker.kickData;
    if (!data || attacker.kickHit) return;

    if (data.self) {
      attacker.kickHit = true;
      attacker.hp = Math.max(0, attacker.hp - data.dmg);
      attacker.hitstun = 0.35;
      attacker.vx = -attacker.facing * 120;
      audio.hurt();
      shakeT = Math.max(shakeT, 0.35);
      particles.burst(attacker.x, attacker.y - 30, PALETTE.danger, 12, 120);
      addFloat(attacker.x, attacker.y - 70, 'OVERCHARGED!', PALETTE.danger);
      return;
    }

    if (data.type === 'whiff') {
      attacker.kickHit = true;
      addFloat(attacker.x + attacker.facing * 30, attacker.y - 50, 'WHIFF', '#8a9878');
      return;
    }

    if (!facingToward(attacker, defender) || !inKickArc(attacker, defender)) {
      return; // still in active frames — keep trying
    }

    attacker.kickHit = true;
    const defending = defender.block && defender.onGround && !defender.charging && defender.hitstun <= 0 && defender.kickT <= 0;

    if (defending) {
      let dmg = 0;
      if (data.type === 'perfect') dmg = 1;
      audio.block();
      const push = Math.sign(defender.x - attacker.x) || attacker.facing;
      defender.vx += push * 140;
      attacker.vx -= push * 100;
      particles.burst((attacker.x + defender.x) / 2, defender.y - 38, '#d0d8e0', 12, 130);
      hitStopT = Math.max(hitStopT, 0.06);
      shakeT = Math.max(shakeT, 0.2);
      if (dmg <= 0) {
        addFloat(defender.x, defender.y - 64, 'BLOCK!', '#9ab0c0');
      } else {
        defender.hp = Math.max(0, defender.hp - dmg);
        defender.hitstun = 0.18;
        audio.hit();
        addFloat(defender.x, defender.y - 64, 'CHIP', '#e0a060');
      }
      return;
    }

    if (data.type === 'perfect') {
      perfects++;
      audio.perfect();
      addFloat(defender.x, defender.y - 70, 'PERFECT!', '#f0c050');
      hitStopT = Math.max(hitStopT, 0.14);
      shakeT = Math.max(shakeT, 0.55);
      particles.burst(defender.x, defender.y - 35, '#ffe080', 16, 170);
    } else {
      audio.hit();
      addFloat(defender.x, defender.y - 64, 'HIT!', '#e07060');
      hitStopT = Math.max(hitStopT, 0.08);
      shakeT = Math.max(shakeT, 0.3);
      particles.burst(defender.x, defender.y - 35, PALETTE.danger, 12, 150);
    }

    defender.hp = Math.max(0, defender.hp - data.dmg);
    defender.hitstun = data.type === 'perfect' ? 0.45 : 0.32;
    defender.charging = false;
    defender.charge = 0;
    defender.block = false;
    defender.vx = Math.sign(defender.x - attacker.x) * data.kb;
    defender.vy = data.type === 'perfect' ? -280 : -200;
    defender.onGround = false;
  }

  function separateBodies() {
    const dx = p2.x - p1.x;
    const overlap = BODY_HALF * 2 - Math.abs(dx);
    if (overlap > 0) {
      const push = (overlap / 2 + 0.5) * (dx === 0 ? 1 : Math.sign(dx));
      p1.x -= push;
      p2.x += push;
    }
  }

  function updatePlayer(p, dt, h, controls, isAi, foe) {
    const wasAir = !p.onGround;
    p.runPhase += dt * (Math.abs(p.vx) > 20 ? 12 : 6);
    p.hitstun = Math.max(0, p.hitstun - dt);
    if (p.kickT > 0) p.kickT = Math.max(0, p.kickT - dt);
    const fy = floorY(h);

    // Always face opponent when idle-ish
    if (p.hitstun <= 0 && p.kickT <= 0 && foe) {
      const dir = Math.sign(foe.x - p.x);
      if (dir && !(controls && !isAi && (controls.left() || controls.right()))) {
        // keep facing foe unless actively strafing
      }
      if (dir && Math.abs(p.vx) < 30 && !p.charging) p.facing = dir;
    }

    if (p.hitstun > 0) {
      p.vy += GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - Math.min(1, 3.5 * dt);
      if (p.y >= fy) {
        p.y = fy;
        p.vy = 0;
        p.onGround = true;
        p.vx *= 0.5;
        spawnDust(p.x, fy, 3);
      } else p.onGround = false;
      return;
    }

    if (!isAi) {
      p.block = controls.block() && p.onGround && !p.charging && p.kickT <= 0;

      if (!p.block && controls.chargePress() && p.onGround && p.kickT <= 0) {
        p.charging = true;
        p.charge = 0;
      }
      if (p.charging) {
        if (controls.charge() && p.charge < MAX_CHARGE) {
          p.charge += dt * CHARGE_RATE;
          // Slow walk while charging
          let move = 0;
          if (controls.left()) move -= 1;
          if (controls.right()) move += 1;
          p.vx = move * MOVE_SPEED * 0.35;
          if (move) p.facing = move;
        } else {
          releaseKick(p);
        }
      }

      if (!p.charging && p.kickT <= 0 && !p.block) {
        let move = 0;
        if (controls.left()) move -= 1;
        if (controls.right()) move += 1;
        p.vx = move !== 0 ? move * MOVE_SPEED : p.vx * (1 - Math.min(1, 12 * dt));
        if (move) p.facing = move;
        else if (foe) {
          const dir = Math.sign(foe.x - p.x);
          if (dir) p.facing = dir;
        }

        if (controls.jump() && p.onGround) {
          p.vy = JUMP_VY;
          p.onGround = false;
          audio.jump();
        }
      } else if (p.kickT > 0) {
        p.vx *= 1 - Math.min(1, 4 * dt);
      } else if (p.block) {
        p.vx *= 1 - Math.min(1, 14 * dt);
      }
    } else {
      // AI physics only — decisions in aiThink
      if (p.charging && p.charge >= MAX_CHARGE) releaseKick(p);
      if (p.vx > 18) p.facing = 1;
      else if (p.vx < -18) p.facing = -1;
      else if (foe) {
        const dir = Math.sign(foe.x - p.x);
        if (dir) p.facing = dir;
      }
    }

    p.vy += GRAVITY * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.y >= fy) {
      p.y = fy;
      if (wasAir && p.vy > 80) spawnDust(p.x, fy, 4);
      p.vy = 0;
      p.onGround = true;
    } else {
      p.onGround = false;
    }
    p.x = Math.max(48, Math.min(api.canvas.width - 48, p.x));
  }

  function aiThink(dt) {
    const dist = p2.x - p1.x;
    const absDist = Math.abs(dist);
    const toward = dist > 0 ? -1 : 1;
    const away = -toward;
    aiTimer -= dt;
    aiDesire += dt;

    const p1ChargingDanger = p1.charging && p1.charge > 0.35 && absDist < 130;
    const p1Kicking = p1.kickT > KICK_RECOVERY * 0.4 && p1.kickT <= KICK_ACTIVE + KICK_RECOVERY && !p1.kickHit;
    const p1Whiffed = p1.kickHit && p1.kickT > 0 && p1.kickData && (p1.kickData.type === 'whiff' || p1.kickData.self);
    const p1Recover = p1.kickT > 0 && p1.kickHit;

    // Interrupt: react to danger / punish windows
    if (p1Kicking && absDist < KICK_RANGE + 20 && aiState !== 'block' && aiState !== 'punish') {
      if (Math.random() < 0.55) {
        aiState = 'block';
        aiTimer = 0.35;
      } else {
        aiState = 'retreat';
        aiTimer = 0.28;
      }
    } else if (p1ChargingDanger && Math.random() < 0.04) {
      aiState = Math.random() < 0.5 ? 'block' : 'retreat';
      aiTimer = 0.3;
    } else if ((p1Whiffed || p1Recover) && absDist < 160 && !p2.charging && p2.kickT <= 0) {
      aiState = 'punish';
      aiTimer = 0.55;
    }

    if (aiTimer <= 0 && aiState !== 'punish') {
      if (absDist > 170) aiState = 'approach';
      else if (absDist < 48) aiState = Math.random() < 0.55 ? 'retreat' : 'charge';
      else if (p1.charging && absDist < 140) aiState = Math.random() < 0.45 ? 'block' : 'retreat';
      else {
        const r = Math.random();
        if (r < 0.38) aiState = 'charge';
        else if (r < 0.62) aiState = 'approach';
        else if (r < 0.78) aiState = 'retreat';
        else if (r < 0.9) aiState = 'block';
        else aiState = 'hop';
      }
      aiTimer = 0.35 + Math.random() * 0.65;
    }

    p2.block = false;

    if (p2.kickT > 0) {
      p2.vx *= 0.9;
      return;
    }

    if (aiState === 'approach') {
      p2.vx = toward * MOVE_SPEED * (0.75 + Math.sin(aiDesire * 3) * 0.08);
      if (absDist < 95) {
        aiState = Math.random() < 0.7 ? 'charge' : 'block';
        aiTimer = 0.25 + Math.random() * 0.3;
      }
    } else if (aiState === 'retreat') {
      p2.vx = away * MOVE_SPEED * 0.85;
      if (absDist > 140 || aiTimer <= 0) {
        aiState = 'approach';
        aiTimer = 0.3;
      }
    } else if (aiState === 'block') {
      p2.vx *= 0.7;
      if (absDist < 120) p2.block = true;
      else {
        aiState = 'approach';
        aiTimer = 0.2;
      }
      if (aiTimer <= 0) {
        aiState = absDist < 100 ? 'charge' : 'approach';
        aiTimer = 0.3;
      }
    } else if (aiState === 'hop') {
      if (p2.onGround && p2.kickT <= 0 && !p2.charging) {
        p2.vy = JUMP_VY * 0.9;
        p2.onGround = false;
        audio.jump();
        p2.vx = toward * MOVE_SPEED * 0.5;
      }
      if (aiTimer <= 0) aiState = 'approach';
    } else if (aiState === 'charge' || aiState === 'punish') {
      if (p2.onGround && p2.kickT <= 0) {
        if (!p2.charging) {
          p2.charging = true;
          p2.charge = 0;
          // Bias toward sweet spot; punish = faster lighter kick
          if (aiState === 'punish') aiTargetCharge = 0.38 + Math.random() * 0.22;
          else aiTargetCharge = 0.55 + Math.random() * 0.3; // often in perfect/normal band
          if (Math.random() < 0.12) aiTargetCharge = 0.95 + Math.random() * 0.12; // rare overcharge mistake
        }
        // Creep in while charging
        const prefer = absDist > 85 ? toward : absDist < 55 ? away : 0;
        p2.vx = prefer * MOVE_SPEED * 0.32;
        p2.charge += dt * CHARGE_RATE * (0.92 + Math.random() * 0.2);
        if (p2.charge >= aiTargetCharge || p2.charge >= MAX_CHARGE) {
          releaseKick(p2);
          aiState = 'idle';
          aiTimer = 0.45 + Math.random() * 0.4;
        }
      }
    } else {
      // idle / micro-adjust
      p2.vx = toward * MOVE_SPEED * 0.2 * Math.sin(aiDesire * 2);
      if (aiTimer <= 0) {
        aiState = 'approach';
        aiTimer = 0.3;
      }
    }
  }

  function p1Controls() {
    return {
      left: () => input.p1Left(),
      right: () => input.p1Right(),
      jump: () => input.p1JumpArrowPressed(),
      block: () => input.p1Block(),
      charge: () => input.p1Fire(),
      chargePress: () => input.p1FirePressed(),
    };
  }

  function p2Controls() {
    return {
      left: () => input.p2Left(),
      right: () => input.p2Right(),
      jump: () => input.p2JumpPressed(),
      block: () => input.p2Block(),
      charge: () => input.p2Fire(),
      chargePress: () => input.p2FirePressed(),
    };
  }

  function endMatch(endFn) {
    ending = true;
    const won = p1Wins >= WINS_NEEDED;
    const score = p1Wins * 1000 + perfects * 80 + clashes * 40;
    if (mode === 'vsAi' && !streakUpdated) {
      const meta = storage.getMeta();
      if (won) {
        beatAi = true;
        storage.setMeta({ duelStreak: (meta.duelStreak || 0) + 1 });
      } else {
        storage.setMeta({ duelStreak: 0 });
      }
      streakUpdated = true;
    }
    endFn({
      title: won ? 'YOU WIN!' : mode === 'vsAi' ? 'DEFEAT' : 'P2 WINS!',
      score,
      time: Math.floor(roundTimer),
      submitScore: mode === 'vsAi',
      stats: [`Rounds ${p1Wins}-${p2Wins}`, `Perfects ${perfects}`, `Clashes ${clashes}`],
      extra: { wins: p1Wins, perfects, clashes, mode },
    });
  }

  function drawArena(ctx, w, h) {
    const fy = floorY(h);
    // Dusk corral — warm, not purple
    const sky = ctx.createLinearGradient(0, 0, 0, fy);
    sky.addColorStop(0, '#2a1c14');
    sky.addColorStop(0.45, '#6a3a28');
    sky.addColorStop(0.78, '#c07840');
    sky.addColorStop(1, '#e0a868');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, fy);

    // Sun disc
    ctx.fillStyle = 'rgba(255,200,120,0.35)';
    ctx.beginPath();
    ctx.arc(w * 0.72, fy * 0.42, 48, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,220,150,0.55)';
    ctx.beginPath();
    ctx.arc(w * 0.72, fy * 0.42, 28, 0, Math.PI * 2);
    ctx.fill();

    // Far hills
    ctx.fillStyle = '#3a2820';
    ctx.beginPath();
    ctx.moveTo(0, fy);
    ctx.lineTo(0, fy * 0.72);
    ctx.quadraticCurveTo(w * 0.2, fy * 0.55, w * 0.4, fy * 0.7);
    ctx.quadraticCurveTo(w * 0.6, fy * 0.85, w * 0.85, fy * 0.62);
    ctx.lineTo(w, fy * 0.68);
    ctx.lineTo(w, fy);
    ctx.fill();

    // Fence posts
    ctx.strokeStyle = '#4a3428';
    ctx.lineWidth = 3;
    for (let x = 40; x < w; x += 56) {
      ctx.beginPath();
      ctx.moveTo(x, fy - 36);
      ctx.lineTo(x, fy);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(20, fy - 28);
    ctx.lineTo(w - 20, fy - 28);
    ctx.moveTo(20, fy - 14);
    ctx.lineTo(w - 20, fy - 14);
    ctx.stroke();

    // Ground
    ctx.fillStyle = '#3a2e22';
    ctx.fillRect(0, fy, w, h - fy);
    const dirt = ctx.createLinearGradient(0, fy, 0, h);
    dirt.addColorStop(0, '#6a5640');
    dirt.addColorStop(0.15, '#4a3c2e');
    dirt.addColorStop(1, '#2a2218');
    ctx.fillStyle = dirt;
    ctx.fillRect(0, fy, w, h - fy);

    // Arena ring marks
    ctx.strokeStyle = 'rgba(200,170,100,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(36, fy - 4, w - 72, 8);
    ctx.fillStyle = 'rgba(180,140,70,0.12)';
    ctx.fillRect(w / 2 - 3, fy - 70, 6, 66);

    // Hay tufts
    ctx.strokeStyle = '#8a7040';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      const hx = 50 + i * ((w - 100) / 13);
      ctx.beginPath();
      ctx.moveTo(hx, fy + 2);
      ctx.lineTo(hx - 3, fy - 8 - (i % 3) * 2);
      ctx.moveTo(hx, fy + 2);
      ctx.lineTo(hx + 4, fy - 6);
      ctx.stroke();
    }
  }

  const controller = {
    reset(m) {
      reset(m);
    },
    updatePlay(dt, endFn) {
      if (ending) return true;
      if (matchOver) {
        endMatch(endFn);
        return true;
      }

      for (let i = floats.length - 1; i >= 0; i--) {
        floats[i].t -= dt;
        floats[i].y += floats[i].vy * dt;
        if (floats[i].t <= 0) floats.splice(i, 1);
      }
      for (let i = dust.length - 1; i >= 0; i--) {
        const d = dust[i];
        d.t -= dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vy += 80 * dt;
        if (d.t <= 0) dust.splice(i, 1);
      }
      if (shakeT > 0) shakeT = Math.max(0, shakeT - dt * 2.6);
      if (koBannerT > 0) koBannerT -= dt;

      if (roundPauseT > 0) {
        roundPauseT -= dt;
        return false;
      }

      if (hitStopT > 0) {
        hitStopT -= dt;
        return false;
      }

      const h = api.canvas.height;
      roundTimer += dt;
      if (roundTimer >= ROUND_TIME && !sudden) {
        sudden = true;
        audio.alarm();
        p1.hp = Math.min(p1.hp, 1);
        p2.hp = Math.min(p2.hp, 1);
        addFloat(api.canvas.width / 2, h * 0.28, 'SUDDEN DEATH', PALETTE.danger);
      }

      updatePlayer(p1, dt, h, p1Controls(), false, p2);
      if (mode === 'vsAi') {
        aiThink(dt);
        updatePlayer(p2, dt, h, p2Controls(), true, p1);
      } else {
        updatePlayer(p2, dt, h, p2Controls(), false, p1);
      }
      separateBodies();

      // Active kick windows
      const p1Active = p1.kickT > KICK_RECOVERY && p1.kickData && !p1.kickHit;
      const p2Active = p2.kickT > KICK_RECOVERY && p2.kickData && !p2.kickHit;

      if (p1Active && p2Active && p1.kickData.type !== 'whiff' && p2.kickData.type !== 'whiff' && !p1.kickData.self && !p2.kickData.self && Math.abs(p1.x - p2.x) <= KICK_RANGE + 10) {
        p1.kickHit = true;
        p2.kickHit = true;
        clashes++;
        audio.block();
        const push = Math.sign(p2.x - p1.x) || 1;
        p1.vx = -push * 200;
        p2.vx = push * 200;
        p1.vy = -120;
        p2.vy = -120;
        shakeT = Math.max(shakeT, 0.4);
        hitStopT = Math.max(hitStopT, 0.1);
        particles.burst((p1.x + p2.x) / 2, Math.min(p1.y, p2.y) - 42, '#ffe080', 18, 160);
        addFloat((p1.x + p2.x) / 2, Math.min(p1.y, p2.y) - 78, 'CLASH!', '#f0c050');
      } else {
        if (p1Active) applyKick(p1, p2);
        if (p2Active) applyKick(p2, p1);
      }

      if (p1.hp <= 0 || p2.hp <= 0) {
        if (p1.hp > 0 && p2.hp <= 0) {
          p1Wins++;
          koText = mode === 'vsAi' ? 'KO!' : 'P1 WINS ROUND';
          audio.start();
        } else if (p2.hp > 0 && p1.hp <= 0) {
          p2Wins++;
          koText = mode === 'vsAi' ? 'YOU LOSE' : 'P2 WINS ROUND';
          audio.hurt();
        } else {
          koText = 'DOUBLE KO';
        }
        koBannerT = 1.0;
        round++;
        if (p1Wins >= WINS_NEEDED || p2Wins >= WINS_NEEDED) {
          matchOver = true;
        } else {
          resetRoundPositions();
          roundPauseT = 1.35;
          koBannerT = 0.9;
        }
      }

      return false;
    },

    drawPlay(ctx, w, h) {
      const shx = shakeT > 0 ? (Math.random() - 0.5) * 12 * shakeT : 0;
      const shy = shakeT > 0 ? (Math.random() - 0.5) * 8 * shakeT : 0;
      ctx.save();
      ctx.translate(shx, shy);

      drawArena(ctx, w, h);
      const fy = floorY(h);

      // Dust
      for (const d of dust) {
        ctx.globalAlpha = Math.max(0, d.t * 2);
        ctx.fillStyle = '#a89070';
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      function drawFighter(p, label) {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath();
        ctx.ellipse(p.x, fy + 6, 22, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        let pose = 'idle';
        if (p.kickT > KICK_RECOVERY) pose = 'kick';
        else if (p.kickT > 0) pose = 'hitstun';
        else if (p.charging) pose = 'charge';
        else if (p.block) pose = 'block';
        else if (!p.onGround) pose = 'jump';
        else if (Math.abs(p.vx) > 25) pose = 'run';
        if (p.hitstun > 0) pose = 'hitstun';

        // Charge aura
        if (p.charging) {
          const c = zoneColor(p.charge);
          ctx.strokeStyle = c;
          ctx.globalAlpha = 0.35 + Math.sin(p.runPhase * 4) * 0.15;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y - 28, 28 + p.charge * 10, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Kick telegraph arc
        if (p.kickT > KICK_RECOVERY && !p.kickHit) {
          ctx.strokeStyle = 'rgba(255,180,80,0.35)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y - 24, KICK_RANGE * 0.55, p.facing > 0 ? -0.6 : Math.PI - 0.6, p.facing > 0 ? 0.6 : Math.PI + 0.6);
          ctx.stroke();
        }

        drawDk(ctx, {
          x: p.x - 20,
          y: p.y - 54,
          scale: 0.95,
          facing: p.facing,
          pose,
          runPhase: p.runPhase,
          hurt: p.hitstun > 0,
          tint: p.tint,
        });

        if (p.block) {
          ctx.fillStyle = 'rgba(160,190,220,0.35)';
          ctx.fillRect(p.x + p.facing * 8 - 4, p.y - 48, 8, 36);
        }

        if (p.charging) {
          const barW = 72;
          const bx = p.x - barW / 2;
          const by = p.y - 78;
          ctx.fillStyle = 'rgba(16,12,8,0.85)';
          ctx.fillRect(bx - 3, by - 3, barW + 6, 12);
          const zones = [
            { from: 0, to: 0.28, color: '#5a6850' },
            { from: 0.28, to: 0.62, color: '#4a88b0' },
            { from: 0.62, to: 0.9, color: '#d0a030' },
            { from: 0.9, to: 1, color: '#c04030' },
          ];
          for (const z of zones) {
            ctx.fillStyle = z.color;
            ctx.fillRect(bx + z.from * barW, by, (z.to - z.from) * barW, 6);
          }
          // Sweet spot markers
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.fillRect(bx + 0.62 * barW, by - 1, 1, 8);
          ctx.fillRect(bx + 0.9 * barW, by - 1, 1, 8);
          const needle = Math.min(1, p.charge);
          ctx.fillStyle = '#fff';
          ctx.fillRect(bx + needle * barW - 1, by - 3, 3, 12);
        }

        void label;
      }

      drawFighter(p1, 'p1');
      drawFighter(p2, 'p2');

      // HUD
      ctx.fillStyle = 'rgba(12,10,8,0.45)';
      ctx.fillRect(0, 0, w, 78);

      drawHearts(ctx, 18, 12, p1.hp, 3);
      drawHearts(ctx, w - 78, 12, p2.hp, 3);
      drawText(ctx, mode === 'vsAi' ? 'YOU' : 'P1', 18, 36, { color: '#d8c8a0', font: '11px Courier New, monospace' });
      drawText(ctx, mode === 'vsAi' ? 'CPU' : 'P2', w - 18, 36, {
        align: 'right',
        color: '#c8b0a0',
        font: '11px Courier New, monospace',
      });

      drawText(ctx, `ROUND ${round + 1}`, w / 2, 8, {
        align: 'center',
        font: 'bold 13px Courier New, monospace',
        color: '#e0b060',
      });
      drawText(ctx, `${p1Wins}  —  ${p2Wins}`, w / 2, 26, {
        align: 'center',
        color: '#f0e8d0',
        font: 'bold 16px Courier New, monospace',
      });
      drawText(ctx, sudden ? 'SUDDEN DEATH' : `${Math.max(0, Math.ceil(ROUND_TIME - roundTimer))}s`, w / 2, 46, {
        align: 'center',
        color: sudden ? '#ff6050' : '#a09070',
        font: '12px Courier New, monospace',
      });

      for (let i = 0; i < WINS_NEEDED; i++) {
        ctx.fillStyle = i < p1Wins ? '#e0b040' : 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.arc(w / 2 - 36 + i * 12, 66, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = i < p2Wins ? '#e0b040' : 'rgba(255,255,255,0.12)';
        ctx.beginPath();
        ctx.arc(w / 2 + 12 + i * 12, 66, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const f of floats) {
        ctx.globalAlpha = Math.max(0, Math.min(1, f.t / 0.35));
        drawText(ctx, f.text, f.x, f.y, {
          align: 'center',
          font: 'bold 17px Courier New, monospace',
          color: f.color,
        });
        ctx.globalAlpha = 1;
      }

      if (roundPauseT > 0.05) {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, h * 0.34, w, 70);
        const label = roundPauseT > 0.55 ? `ROUND ${round + 1}` : 'FIGHT!';
        drawText(ctx, label, w / 2, h * 0.4, {
          align: 'center',
          font: 'bold 26px Courier New, monospace',
          color: label === 'FIGHT!' ? '#f0c050' : '#e0b060',
        });
      }

      if (koBannerT > 0) {
        ctx.fillStyle = `rgba(0,0,0,${0.35 * Math.min(1, koBannerT)})`;
        ctx.fillRect(0, h * 0.38, w, 50);
        drawText(ctx, koText, w / 2, h * 0.42, {
          align: 'center',
          font: 'bold 24px Courier New, monospace',
          color: '#ff8060',
        });
      }

      ctx.restore();
      api.particles.draw(ctx);
    },

    getMedalChecks() {
      const m = [];
      if (mode === 'vsAi' && beatAi && p1Wins >= WINS_NEEDED) m.push('duel_beat_ai');
      if (perfects >= 5) m.push('duel_perfect_5');
      if ((storage.getMeta().duelStreak || 0) >= 3) m.push('duel_streak_3');
      return m;
    },
  };

  return createShellGame(DEF, api, controller);
}
