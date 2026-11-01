export const WEAPONS = {
  pistol: {
    id: 'pistol',
    rank: 0,
    label: 'PISTOL',
    cooldown: 0.28,
    damage: 1,
    speed: 520,
    size: 5,
    knockback: 4,
    pellets: 1,
  },
  shotgun: {
    id: 'shotgun',
    rank: 1,
    label: 'SHOTGUN',
    cooldown: 0.42,
    damage: 1,
    speed: 500,
    size: 4,
    knockback: 8,
    pellets: 5,
    spread: 0.28,
  },
  mg: {
    id: 'mg',
    rank: 2,
    label: 'MG',
    cooldown: 0.09,
    damage: 1,
    speed: 580,
    size: 4,
    knockback: 2,
    pellets: 1,
  },
  laser: {
    id: 'laser',
    rank: 3,
    label: 'LASER',
    cooldown: 0.14,
    damage: 2,
    speed: 920,
    size: 3,
    knockback: 1,
    pellets: 1,
    pierce: true,
  },
  heavy: {
    id: 'heavy',
    rank: 4,
    label: 'CANNON',
    cooldown: 0.55,
    damage: 4,
    speed: 380,
    size: 12,
    knockback: 14,
    pellets: 1,
  },
  rocket: {
    id: 'rocket',
    rank: 5,
    label: 'ROCKET',
    cooldown: 0.65,
    damage: 3,
    speed: 340,
    size: 8,
    knockback: 12,
    pellets: 1,
    explosive: true,
  },
};

export const WEAPON_ORDER = ['pistol', 'shotgun', 'mg', 'laser', 'heavy', 'rocket'];

/** Damage scales with weapon level AND run distance so power keeps up with enemies. */
export function scaledWeapon(weaponId, level = 1, distance = 0) {
  const base = WEAPONS[weaponId] || WEAPONS.pistol;
  const lv = Math.max(1, level);
  const dmgMul = 1 + (lv - 1) * 0.45;
  const progressTier = Math.floor(Math.max(0, distance) / 500);
  const progressMul = 1 + progressTier * 0.28;
  const cdMul = Math.max(0.5, 1 - (lv - 1) * 0.05);
  return {
    ...base,
    damage: base.damage * dmgMul * progressMul,
    cooldown: base.cooldown * cdMul,
    size: base.size + Math.min(4, (lv - 1) * 0.35),
    level: lv,
  };
}

export function createBullet(x, y, weaponId, level = 1, angle = 0, distance = 0) {
  const w = scaledWeapon(weaponId, level, distance);
  const speed = w.speed;
  return {
    kind: 'bullet',
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: w.size,
    damage: w.damage,
    weaponId: w.id,
    pierce: !!w.pierce,
    explosive: !!w.explosive,
    hitIds: new Set(),
    life: w.pierce ? 0.9 : 1.6,
    dead: false,
  };
}

export function createGrenade(x, y, throwVx = 220) {
  return {
    kind: 'grenade',
    x,
    y,
    vx: throwVx,
    vy: -280,
    r: 7,
    fuse: 0.85,
    dead: false,
  };
}

export function createExplosion(x, y, radius = 72, damage = 3) {
  return {
    kind: 'explosion',
    x,
    y,
    radius,
    life: 0.35,
    maxLife: 0.35,
    damage,
    hitIds: new Set(),
    dead: false,
  };
}

/** Enemy projectile — vx/vy in screen space (negative vx = toward player on the left). */
export function createEnemyBullet(x, y, vx = -280, vy = 0) {
  return {
    kind: 'enemyBullet',
    x,
    y,
    vx,
    vy,
    r: 4,
    damage: 1,
    life: 2.5,
    dead: false,
  };
}

export function updateProjectiles(list, dt, gravity) {
  for (const p of list) {
    if (p.dead) continue;
    if (p.kind === 'grenade') {
      p.vy += gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.fuse -= dt;
      if (p.fuse <= 0) p.dead = true;
    } else if (p.kind === 'explosion') {
      p.life -= dt;
      if (p.life <= 0) p.dead = true;
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) p.dead = true;
    }
  }
}
