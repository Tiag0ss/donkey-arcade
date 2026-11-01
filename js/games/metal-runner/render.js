const SKY_TOP = '#2a3a28';
const SKY_BOT = '#5a6e48';
const GROUND = '#3a3228';
const GROUND_TOP = '#5c5344';
const DUST = '#8a7e68';

export function clearScene(ctx, w, h, groundY, scroll) {
  const g = ctx.createLinearGradient(0, 0, 0, groundY);
  g.addColorStop(0, SKY_TOP);
  g.addColorStop(1, SKY_BOT);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, groundY);

  // parallax hills — still behind world, but strong enough to sell speed tiers
  ctx.fillStyle = '#3d4f38';
  drawHills(ctx, w, groundY - 40, scroll * 0.35, 90, 240);
  ctx.fillStyle = '#465a40';
  drawHills(ctx, w, groundY - 18, scroll * 0.65, 55, 180);

  // ground — scroll factor 1.0 matches entity scrollSpeed exactly
  ctx.fillStyle = GROUND;
  ctx.fillRect(0, groundY, w, h - groundY);
  ctx.fillStyle = GROUND_TOP;
  ctx.fillRect(0, groundY, w, 6);

  const ox = -mod(scroll, 40);
  ctx.fillStyle = DUST;
  for (let x = ox; x < w + 40; x += 40) {
    ctx.fillRect(x, groundY + 14, 18, 3);
    ctx.fillRect(x + 10, groundY + 28, 10, 2);
  }
  // closer ground detail (same world speed as crates/enemies)
  ctx.fillStyle = '#4a4034';
  const ox2 = -mod(scroll, 64);
  for (let x = ox2; x < w + 64; x += 64) {
    ctx.fillRect(x + 4, groundY + 8, 22, 2);
    ctx.fillRect(x + 36, groundY + 40, 14, 2);
  }
  ctx.fillStyle = '#2e2820';
  const ox3 = -mod(scroll, 96);
  for (let x = ox3; x < w + 96; x += 96) {
    ctx.fillRect(x + 50, groundY + 52, 28, 3);
  }
}

function mod(n, m) {
  return ((n % m) + m) % m;
}

function drawHills(ctx, w, baseY, scroll, amp, period = 220) {
  ctx.beginPath();
  ctx.moveTo(0, baseY + amp);
  const ox = -mod(scroll, period);
  const half = period * 0.5;
  for (let x = ox - period; x < w + period; x += half) {
    ctx.quadraticCurveTo(x + half * 0.5, baseY - amp * 0.4, x + half, baseY + amp * 0.2);
  }
  ctx.lineTo(w, baseY + amp + 40);
  ctx.lineTo(0, baseY + amp + 40);
  ctx.fill();
}

/** Burro de guerra bipede — capacete pequenino + arma absurda */
export function drawGrom(ctx, p) {
  drawBurro(ctx, p);
}

export function drawBurro(ctx, p) {
  const { x, y, w, h, runPhase, onGround, shooting, muzzle, invuln, weaponId, crouching } = p;
  if (invuln > 0 && Math.floor(invuln * 20) % 2 === 0) return;

  ctx.save();
  ctx.translate(x, y);
  if (crouching) ctx.scale(1.05, 0.72);

  const belly = onGround && !crouching ? 0 : 4;
  const legSwing = onGround && !crouching ? Math.sin(runPhase) * 8 : 1;
  const bodyH = crouching ? 56 : h;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(w * 0.5, bodyH + 2, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#6a5540';
  ctx.fillRect(11, bodyH - 16 + legSwing * 0.35, 9, 14);
  ctx.fillRect(24, bodyH - 16 - legSwing * 0.35, 9, 14);
  ctx.fillStyle = '#2a2218';
  ctx.fillRect(10, bodyH - 5, 11, 5);
  ctx.fillRect(23, bodyH - 5, 11, 5);

  ctx.fillStyle = '#8a7360';
  roundRect(ctx, 5, 20 - belly, 32, 28 + belly, 8);
  ctx.fill();
  ctx.fillStyle = '#a89078';
  roundRect(ctx, 10, 30 - belly * 0.3, 22, 14, 5);
  ctx.fill();

  ctx.fillStyle = '#3d4a32';
  roundRect(ctx, 9, 22, 24, 16, 3);
  ctx.fill();
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(19, 24, 3, 10);

  ctx.fillStyle = '#7a6350';
  ctx.fillRect(1, 26, 8, 12);

  ctx.strokeStyle = '#5a4438';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(6, 36);
  ctx.quadraticCurveTo(-4, 40 + Math.sin(runPhase) * 3, -2, 48);
  ctx.stroke();

  drawGun(ctx, weaponId, shooting);

  ctx.fillStyle = '#7a6350';
  ctx.fillRect(30, 24, 9, 10);

  ctx.fillStyle = '#8a7360';
  ctx.fillRect(14, 14, 12, 10);

  ctx.fillStyle = '#9a8068';
  roundRect(ctx, 22, 8, 22, 14, 5);
  ctx.fill();
  ctx.fillStyle = '#5a4438';
  ctx.fillRect(38, 14, 6, 5);

  ctx.fillStyle = '#6a5540';
  ctx.beginPath();
  ctx.moveTo(18, 10);
  ctx.lineTo(12, -6);
  ctx.lineTo(22, 8);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(28, 8);
  ctx.lineTo(34, -8);
  ctx.lineTo(32, 10);
  ctx.fill();
  ctx.fillStyle = '#c4a090';
  ctx.fillRect(15, -2, 3, 8);
  ctx.fillRect(31, -4, 3, 8);

  ctx.fillStyle = '#3a4a30';
  roundRect(ctx, 20, 2, 12, 7, 2);
  ctx.fill();
  ctx.fillStyle = '#2a3224';
  ctx.fillRect(23, 0, 5, 3);

  ctx.fillStyle = '#1a1810';
  ctx.fillRect(28, 10, 4, 4);
  ctx.fillStyle = '#fff';
  ctx.fillRect(29, 10, 1, 1);

  if (muzzle > 0) {
    ctx.fillStyle = '#ffe080';
    ctx.beginPath();
    ctx.arc(w + 8, 28, 8 + muzzle * 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(w + 10, 28, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawGun(ctx, weaponId, shooting) {
  const kick = shooting ? -3 : 0;
  if (weaponId === 'rocket') {
    ctx.fillStyle = '#3a3020';
    ctx.fillRect(28 + kick, 24, 28, 12);
    ctx.fillStyle = '#c04030';
    ctx.fillRect(52 + kick, 26, 8, 8);
    ctx.fillStyle = '#888';
    ctx.fillRect(30 + kick, 20, 10, 6);
  } else if (weaponId === 'heavy') {
    ctx.fillStyle = '#2a2e28';
    ctx.fillRect(28 + kick, 26, 26, 10);
    ctx.fillStyle = '#4a4030';
    ctx.fillRect(48 + kick, 28, 8, 6);
    ctx.fillStyle = '#1a1c18';
    ctx.fillRect(34 + kick, 22, 8, 6);
  } else if (weaponId === 'laser') {
    ctx.fillStyle = '#203040';
    ctx.fillRect(30 + kick, 27, 24, 5);
    ctx.fillStyle = '#40e0ff';
    ctx.fillRect(52 + kick, 28, 6, 3);
  } else if (weaponId === 'mg') {
    ctx.fillStyle = '#2a2e28';
    ctx.fillRect(30 + kick, 27, 22, 6);
    ctx.fillRect(34 + kick, 33, 10, 4);
    ctx.fillStyle = '#555';
    ctx.fillRect(48 + kick, 28, 4, 4);
  } else if (weaponId === 'shotgun') {
    ctx.fillStyle = '#4a3828';
    ctx.fillRect(30 + kick, 26, 24, 8);
    ctx.fillStyle = '#2a2018';
    ctx.fillRect(50 + kick, 27, 6, 6);
  } else {
    ctx.fillStyle = '#2a2e28';
    ctx.fillRect(32 + kick, 28, 16, 5);
    ctx.fillStyle = '#4a4030';
    ctx.fillRect(34 + kick, 33, 4, 5);
  }
}

export function drawEntity(ctx, e) {
  if (e.dead) return;
  if (e.flash > 0) {
    ctx.save();
    ctx.globalAlpha = 0.55 + Math.sin(e.flash * 40) * 0.25;
  }
  if (e.type === 'platform') drawPlatform(ctx, e);
  else if (e.type === 'crate') drawCrate(ctx, e);
  else if (e.type === 'overhead') drawOverhead(ctx, e);
  else if (e.type === 'soldier') drawSoldier(ctx, e);
  else if (e.type === 'shooter') drawShooter(ctx, e);
  else if (e.type === 'jeep') drawJeep(ctx, e);
  else if (e.type === 'drone') drawDrone(ctx, e);
  else if (e.type === 'pickup') drawPickup(ctx, e);
  if (e.flash > 0) ctx.restore();
}

function drawPlatform(ctx, e) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(e.x + 8, e.y + e.h + 4, e.w - 16, 6);
  ctx.fillStyle = '#5a5040';
  ctx.fillRect(e.x, e.y, e.w, e.h);
  ctx.fillStyle = '#8a7a60';
  ctx.fillRect(e.x + 2, e.y + 2, e.w - 4, 4);
  ctx.fillStyle = '#3a3428';
  ctx.fillRect(e.x + 10, e.y + e.h, 8, 18);
  ctx.fillRect(e.x + e.w - 18, e.y + e.h, 8, 18);
  ctx.fillStyle = '#6a5a48';
  for (let i = 16; i < e.w - 8; i += 22) {
    ctx.fillRect(e.x + i, e.y + 7, 14, 3);
  }
}

function drawOverhead(ctx, e) {
  // barra flutuante (sem texto) — agacha por baixo ou salta por cima
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(e.x + 10, 0);
  ctx.lineTo(e.x + 10, e.y);
  ctx.moveTo(e.x + e.w - 10, 0);
  ctx.lineTo(e.x + e.w - 10, e.y);
  ctx.stroke();
  ctx.fillStyle = '#4a4038';
  ctx.fillRect(e.x, e.y, e.w, e.h);
  ctx.fillStyle = '#2a2820';
  ctx.fillRect(e.x + 3, e.y + 3, e.w - 6, e.h - 6);
  ctx.fillStyle = '#6a6050';
  ctx.fillRect(e.x + 6, e.y + e.h / 2 - 2, e.w - 12, 4);
}

function drawDrone(ctx, e) {
  const bob = Math.sin(e.bob) * 2;
  const heavy = !!e.heavy;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(e.x + e.w / 2, e.y + e.h + 14, heavy ? 18 : 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = heavy ? '#4a3038' : '#3a4a50';
  ctx.fillRect(e.x + 6, e.y + 8 + bob, e.w - 12, 14);
  ctx.fillStyle = '#2a3038';
  ctx.fillRect(e.x, e.y + 12 + bob, 8, 6);
  ctx.fillRect(e.x + e.w - 8, e.y + 12 + bob, 8, 6);
  ctx.fillStyle = heavy ? '#d0a060' : '#9aa8b0';
  ctx.fillRect(e.x - 4, e.y + 4 + bob, e.w + 8, 3);
  ctx.fillStyle = '#c04030';
  ctx.fillRect(e.x + e.w / 2 - 3, e.y + 18 + bob, 6, 6);
  if (heavy) {
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(e.x + 10, e.y + 10 + bob, e.w - 20, 3);
  }
  if (e.hp < e.maxHp) {
    ctx.fillStyle = '#222';
    ctx.fillRect(e.x, e.y - 6 + bob, e.w, 3);
    ctx.fillStyle = '#c04030';
    ctx.fillRect(e.x, e.y - 6 + bob, e.w * Math.max(0.1, e.hp / (e.maxHp || 5)), 3);
  }
}

function drawCrate(ctx, e) {
  // caixa militar opaca no chão — sem brilho dourado (isso era confundido com loot)
  ctx.fillStyle = '#6b4a2e';
  ctx.fillRect(e.x, e.y, e.w, e.h);
  ctx.fillStyle = '#8a6238';
  ctx.fillRect(e.x + 2, e.y + 2, e.w - 4, e.h - 4);
  ctx.strokeStyle = '#3a2818';
  ctx.lineWidth = 2;
  ctx.strokeRect(e.x + 1, e.y + 1, e.w - 2, e.h - 2);
  ctx.beginPath();
  ctx.moveTo(e.x + 4, e.y + e.h * 0.5);
  ctx.lineTo(e.x + e.w - 4, e.y + e.h * 0.5);
  ctx.moveTo(e.x + e.w * 0.5, e.y + 4);
  ctx.lineTo(e.x + e.w * 0.5, e.y + e.h - 4);
  ctx.stroke();
  ctx.fillStyle = '#4a3020';
  ctx.fillRect(e.x + e.w * 0.5 - 3, e.y + e.h * 0.5 - 3, 6, 6);
}

function drawSoldier(ctx, e) {
  const wob = Math.sin(e.walkPhase) * 2;
  const elite = !!e.elite;
  ctx.fillStyle = elite ? '#5a2030' : '#4a3028';
  ctx.fillRect(e.x + 6, e.y + 20 + wob, 16, 22);
  ctx.fillStyle = elite ? '#8a4050' : '#6a5040';
  ctx.fillRect(e.x + 8, e.y + 6, 14, 16);
  ctx.fillStyle = '#2a2820';
  ctx.fillRect(e.x + 10, e.y + 2, 10, 6);
  if (elite) {
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(e.x + 12, e.y, 8, 4);
  }
  ctx.fillStyle = '#1a1810';
  ctx.fillRect(e.x + 11, e.y + 10, 3, 3);
  ctx.fillRect(e.x + 16, e.y + 10, 3, 3);
  // rifle toward player (left)
  ctx.fillStyle = elite ? '#222' : '#333';
  ctx.fillRect(e.x - (elite ? 10 : 8), e.y + 22, elite ? 16 : 14, 4);
  if (e.hp < e.maxHp) {
    ctx.fillStyle = '#a03028';
    ctx.fillRect(e.x + 8, e.y - 4, 12, 3);
  }
}

function drawShooter(ctx, e) {
  const sniper = !!e.sniper;
  ctx.fillStyle = sniper ? '#2a3a40' : '#3a2a28';
  ctx.fillRect(e.x + 4, e.y + 18, 22, 22);
  ctx.fillStyle = sniper ? '#4a6068' : '#5a4840';
  ctx.fillRect(e.x + 8, e.y + 4, 16, 16);
  ctx.fillStyle = '#2a2820';
  ctx.fillRect(e.x + 10, e.y, 12, 6);
  // gun barrel toward player (left)
  ctx.fillStyle = '#222';
  ctx.fillRect(e.x - (sniper ? 18 : 12), e.y + 14, sniper ? 22 : 16, sniper ? 4 : 5);
  if (sniper) {
    ctx.fillStyle = '#40c0e0';
    ctx.fillRect(e.x - 18, e.y + 13, 4, 6);
  }
  ctx.fillStyle = '#c04030';
  ctx.fillRect(e.x + 12, e.y + 10, 3, 3);
  ctx.fillRect(e.x + 17, e.y + 10, 3, 3);
}

function drawJeep(ctx, e) {
  const bob = Math.sin(e.bob) * 1.5;
  const bodyH = e.boss ? 36 : 28;
  ctx.fillStyle = e.boss ? '#4a3028' : '#3a4a30';
  ctx.fillRect(e.x, e.y + 12 + bob, e.w, bodyH);
  ctx.fillStyle = '#2a3224';
  ctx.fillRect(e.x + 8, e.y + bob, e.boss ? 48 : 36, 16);
  ctx.fillStyle = '#1a1c18';
  ctx.beginPath();
  ctx.arc(e.x + 16, e.y + e.h + bob, 8, 0, Math.PI * 2);
  ctx.arc(e.x + e.w - 16, e.y + e.h + bob, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#555';
  ctx.fillRect(e.x + e.w - 8, e.y + 8 + bob, 18, 5);
  if (e.boss) {
    ctx.fillStyle = '#c9a227';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BOSS', e.x + e.w / 2, e.y + 8 + bob);
  }
  const maxHp = e.maxHp || 8;
  ctx.fillStyle = '#222';
  ctx.fillRect(e.x, e.y - 8 + bob, e.w, 4);
  ctx.fillStyle = '#c04030';
  ctx.fillRect(e.x, e.y - 8 + bob, (e.w * Math.max(0, e.hp)) / maxHp, 4);
}

function drawPickup(ctx, e) {
  const by = e.y + Math.sin(e.bob) * 6;
  const cx = e.x + e.w / 2;
  const cy = by + e.h / 2;
  const colors = {
    pistol: '#c0c8b0',
    shotgun: '#d4a060',
    mg: '#ffe040',
    laser: '#40e0ff',
    heavy: '#ff7040',
    rocket: '#ff5060',
    grenades: '#40e080',
    invuln: '#60e0ff',
    bonus: '#ffffff',
    hp: '#e06070',
  };
  const names = {
    pistol: 'PISTOL',
    shotgun: 'SHOTGUN',
    mg: 'MG',
    laser: 'LASER',
    heavy: 'CANNON',
    rocket: 'ROCKET',
    grenades: 'GRENADES',
    invuln: 'SHIELD',
    bonus: 'BONUS',
    hp: '+HP',
  };
  const col = colors[e.kind] || '#fff';
  const pulse = 0.55 + 0.35 * Math.sin(e.bob * 2);

  ctx.fillStyle = `rgba(255,255,200,${0.22 * pulse})`;
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = col;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 15, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(cx, cy, 11, 0, Math.PI * 2);
  ctx.fill();

  // nome completo por cima — o que o loot é
  const name = names[e.kind] || 'LOOT';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const tw = ctx.measureText(name).width;
  ctx.fillStyle = 'rgba(8,10,6,0.75)';
  ctx.fillRect(cx - tw / 2 - 6, by - 22, tw + 12, 18);
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - tw / 2 - 6, by - 22, tw + 12, 18);
  ctx.fillStyle = col;
  ctx.fillText(name, cx, by - 13);

  ctx.fillStyle = '#101208';
  ctx.font = 'bold 11px monospace';
  const short = {
    pistol: 'P',
    shotgun: 'S',
    mg: 'M',
    laser: 'L',
    heavy: 'C',
    rocket: 'F',
    grenades: 'G',
    invuln: 'E',
    bonus: '+',
    hp: '♥',
  }[e.kind] || '?';
  ctx.fillText(short, cx, cy + 1);
  ctx.textBaseline = 'alphabetic';
}

export function drawProjectile(ctx, p) {
  if (p.dead) return;
  if (p.kind === 'bullet') {
    if (p.weaponId === 'laser') {
      ctx.strokeStyle = '#40e0ff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x - 14, p.y);
      ctx.lineTo(p.x + 8, p.y);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.fillRect(p.x + 4, p.y - 2, 6, 4);
    } else if (p.weaponId === 'rocket') {
      ctx.fillStyle = '#e05040';
      ctx.fillRect(p.x - 8, p.y - 4, 16, 8);
      ctx.fillStyle = '#ffe080';
      ctx.beginPath();
      ctx.arc(p.x - 10, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.weaponId === 'heavy' ? '#e09040' : p.weaponId === 'shotgun' ? '#d4a060' : '#f0e8a0';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      if (p.weaponId === 'heavy') {
        ctx.fillStyle = '#fff8c0';
        ctx.beginPath();
        ctx.arc(p.x - 4, p.y, p.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (p.kind === 'enemyBullet') {
    ctx.fillStyle = '#ff5030';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe0a0';
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(2, p.r * 0.45), 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'grenade') {
    ctx.fillStyle = '#3a5a30';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(p.x - 2, p.y - p.r - 2, 4, 4);
  } else if (p.kind === 'explosion') {
    const t = p.life / p.maxLife;
    const r = p.radius * (1.1 - t * 0.3);
    ctx.fillStyle = `rgba(255,180,40,${0.55 * t})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255,255,200,${0.7 * t})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawParticles(ctx, particles) {
  for (const pt of particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x, pt.y, pt.s, pt.s);
  }
  ctx.globalAlpha = 1;
}

const WEAPON_HOTKEYS = [
  { id: 'pistol', key: '1', short: 'PST' },
  { id: 'shotgun', key: '2', short: 'SHG' },
  { id: 'mg', key: '3', short: 'MG' },
  { id: 'laser', key: '4', short: 'LSR' },
  { id: 'heavy', key: '5', short: 'CAN' },
  { id: 'rocket', key: '6', short: 'RKT' },
];

export function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

export function drawHud(ctx, w, state) {
  ctx.fillStyle = 'rgba(10,12,8,0.55)';
  ctx.fillRect(8, 8, Math.min(480, w - 16), 86);
  ctx.fillStyle = '#d8e0c8';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`DIST ${Math.floor(state.distance)}m`, 18, 24);
  ctx.fillText(`SCORE ${Math.floor(state.score || 0)}`, 18, 42);
  ctx.fillText(`TIME ${formatTime(state.time)}`, 18, 60);
  ctx.fillText(`GUN ${state.weaponLabel}`, 170, 24);
  ctx.fillText(`GRENADES ${state.grenades} (X)`, 170, 42);
  ctx.fillText(`KILLS ${state.kills}`, 320, 42);

  // vidas
  const maxHp = state.maxHp || 3;
  for (let i = 0; i < maxHp; i++) {
    ctx.fillStyle = i < state.hp ? '#e04050' : '#3a3030';
    ctx.beginPath();
    const hx = 170 + i * 18;
    const hy = 56;
    ctx.moveTo(hx, hy + 4);
    ctx.bezierCurveTo(hx, hy, hx + 7, hy, hx + 7, hy + 4);
    ctx.bezierCurveTo(hx + 7, hy, hx + 14, hy, hx + 14, hy + 4);
    ctx.lineTo(hx + 7, hy + 14);
    ctx.closePath();
    ctx.fill();
  }

  let wx = 18;
  const wy = 80;
  ctx.font = 'bold 11px monospace';
  for (const slot of WEAPON_HOTKEYS) {
    const lv = (state.weaponLevels && state.weaponLevels[slot.id]) || 0;
    if (lv < 1 && !(state.unlocked && state.unlocked[slot.id])) continue;
    const level = Math.max(1, lv);
    const active = state.weaponId === slot.id;
    const label = `${slot.key}:${slot.short} L${level}`;
    const tw = ctx.measureText(label).width + 10;
    ctx.fillStyle = active ? 'rgba(224,112,32,0.85)' : 'rgba(40,48,32,0.9)';
    ctx.fillRect(wx, wy - 11, tw, 16);
    ctx.strokeStyle = active ? '#f0e080' : '#6a7860';
    ctx.lineWidth = 1;
    ctx.strokeRect(wx, wy - 11, tw, 16);
    ctx.fillStyle = active ? '#fff8d0' : '#a8b898';
    ctx.fillText(label, wx + 5, wy + 1);
    wx += tw + 6;
  }

  ctx.textAlign = 'right';
  ctx.fillStyle = '#a8b898';
  ctx.font = 'bold 14px monospace';
  ctx.fillText(`HI ${state.highScore}${state.muted ? '  MUTE' : ''}`, w - 16, 24);
}

export function drawPopups(ctx, popups) {
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px monospace';
  for (const p of popups) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color || '#f0e080';
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

export function drawBanner(ctx, w, h, banner) {
  if (!banner) return;
  const a = Math.min(1, banner.life * 2);
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(8,10,6,0.45)';
  ctx.fillRect(0, h * 0.28, w, 48);
  ctx.fillStyle = '#f0e080';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(banner.text, w / 2, h * 0.28 + 34);
  ctx.globalAlpha = 1;
}

export function drawPause(ctx, w, h) {
  ctx.fillStyle = 'rgba(8,10,6,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#d8e0c8';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', w / 2, h * 0.45);
  ctx.font = '16px monospace';
  ctx.fillStyle = '#a8b898';
  ctx.fillText('P / Esc to resume · M mute', w / 2, h * 0.52);
}

function drawLeaderboard(ctx, w, h, entries, highlightRank = 0) {
  const list = entries || [];
  const top = Math.min(5, list.length);
  if (top === 0) {
    ctx.fillStyle = '#6a7860';
    ctx.font = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('No scores yet', w / 2, h * 0.72);
    return;
  }
  ctx.fillStyle = '#c4a878';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('LOCAL LEADERBOARD', w / 2, h * 0.58);
  ctx.font = '12px monospace';
  ctx.textAlign = 'left';
  const left = w / 2 - 190;
  for (let i = 0; i < top; i++) {
    const e = list[i];
    const y = h * 0.58 + 22 + i * 18;
    const rank = i + 1;
    ctx.fillStyle = rank === highlightRank ? '#f0e080' : '#a8b898';
    ctx.fillText(
      `#${rank}  ${e.score} pts  ${e.distance}m  ${formatTime(e.time)}  ${e.kills}k`,
      left,
      y
    );
  }
}

export function drawOverlay(ctx, w, h, mode, payload = {}) {
  ctx.fillStyle = 'rgba(8,10,6,0.62)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';

  if (mode === 'menu') {
    ctx.fillStyle = '#e07020';
    ctx.font = 'bold 48px monospace';
    ctx.fillText('METAL RUNNER', w / 2, h * 0.22);
    ctx.fillStyle = '#c4a878';
    ctx.font = 'bold 22px monospace';
    ctx.fillText('DONKEY  vs  THE BATTLEFIELD', w / 2, h * 0.32);
    ctx.fillStyle = '#d8e0c8';
    ctx.font = '16px monospace';
    ctx.fillText('A donkey. A tiny helmet. Too much ammo.', w / 2, h * 0.4);
    ctx.fillStyle = '#f0e080';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('PRESS ENTER', w / 2, h * 0.48);
    ctx.fillStyle = '#9aaa88';
    ctx.font = '13px monospace';
    ctx.fillText('Space/↑/W jump · S/↓ duck · Z/J shoot · X/K grenade · Q/E or 1-6 guns · P pause', w / 2, h * 0.54);
    drawLeaderboard(ctx, w, h, payload.leaderboard);
  } else if (mode === 'gameover') {
    ctx.fillStyle = '#e04030';
    ctx.font = 'bold 44px monospace';
    ctx.fillText('GAME OVER', w / 2, h * 0.16);
    ctx.fillStyle = '#d8e0c8';
    ctx.font = '18px monospace';
    ctx.fillText(`SCORE  ${payload.score}`, w / 2, h * 0.26);
    ctx.fillText(
      `DIST ${payload.distance}m   TIME ${formatTime(payload.time)}   KILLS ${payload.kills}`,
      w / 2,
      h * 0.33
    );
    if (payload.newHigh) {
      ctx.fillStyle = '#f0e080';
      ctx.font = 'bold 16px monospace';
      ctx.fillText('NEW HIGH SCORE!', w / 2, h * 0.4);
    } else if (payload.rank > 0 && payload.rank <= 10) {
      ctx.fillStyle = '#a8b898';
      ctx.font = '14px monospace';
      ctx.fillText(`Leaderboard rank #${payload.rank}`, w / 2, h * 0.4);
    }
    drawLeaderboard(ctx, w, h, payload.leaderboard, payload.rank);
    ctx.fillStyle = '#f0e080';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('PRESS ENTER', w / 2, h * 0.9);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
