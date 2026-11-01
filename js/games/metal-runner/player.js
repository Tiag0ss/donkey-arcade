import { WEAPONS, WEAPON_ORDER, scaledWeapon } from './weapons.js';

export const PLAYER_W = 42;
export const PLAYER_H = 56;
export const PLAYER_CROUCH_H = 28;
export const MAX_HP = 3;

function emptyLevels() {
  return { pistol: 1 };
}

export function createPlayer(groundY) {
  return {
    x: 120,
    baseX: 120,
    y: groundY - PLAYER_H,
    w: PLAYER_W,
    h: PLAYER_H,
    vy: 0,
    onGround: true,
    onPlatform: false,
    crouching: false,
    fastFall: false,
    dropThrough: 0,
    jumpsLeft: 2,
    facing: 1,
    weaponId: 'pistol',
    weaponLevels: emptyLevels(),
    unlocked: { pistol: true },
    shootCd: 0,
    grenades: 3,
    invuln: 0,
    hp: MAX_HP,
    maxHp: MAX_HP,
    muzzle: 0,
    runPhase: 0,
    knockX: 0,
    shooting: false,
    dead: false,
    flash: 0,
  };
}

export function playerRect(p) {
  if (p.crouching) {
    return { x: p.x + 6, y: p.y + 4, w: p.w - 12, h: p.h - 6 };
  }
  return { x: p.x + 8, y: p.y + 10, w: p.w - 16, h: p.h - 12 };
}

export function resetPlayer(p, groundY) {
  p.x = p.baseX;
  p.h = PLAYER_H;
  p.y = groundY - PLAYER_H;
  p.vy = 0;
  p.onGround = true;
  p.onPlatform = false;
  p.crouching = false;
  p.dropThrough = 0;
  p.jumpsLeft = 2;
  p.weaponId = 'pistol';
  p.weaponLevels = emptyLevels();
  p.unlocked = { pistol: true };
  p.shootCd = 0;
  p.grenades = 3;
  p.invuln = 0;
  p.hp = MAX_HP;
  p.maxHp = MAX_HP;
  p.muzzle = 0;
  p.runPhase = 0;
  p.knockX = 0;
  p.fastFall = false;
  p.shooting = false;
  p.dead = false;
  p.flash = 0;
}

export function weaponLevel(p, id) {
  return p.weaponLevels[id] || 0;
}

export function jumpPlayer(p, jumpV = -780) {
  if (p.dead || p.jumpsLeft <= 0 || p.crouching) return false;
  const isDouble = !p.onGround;
  p.vy = isDouble ? jumpV * 0.9 : jumpV;
  p.onGround = false;
  p.onPlatform = false;
  p.jumpsLeft -= 1;
  return true;
}

const FAST_FALL_VY = 1400;

/**
 * solids: [{ x, y, w, h, oneWay?, isGround? }]
 * y = topo da superfície
 */
export function setCrouch(p, want, solids) {
  if (p.dead) return;

  if (!p.onGround) {
    // durante drop-through não activar fast-fall (senão atravessa o chão)
    if (want && p.dropThrough <= 0) {
      p.fastFall = true;
      if (p.vy < FAST_FALL_VY) p.vy = FAST_FALL_VY;
    }
    p.crouching = false;
    p.h = PLAYER_H;
    return;
  }

  // agachar em plataforma = cair através (só ignora plataformas, não o chão)
  if (want && p.onPlatform) {
    p.dropThrough = 0.22;
    p.onGround = false;
    p.onPlatform = false;
    p.crouching = false;
    p.fastFall = false;
    p.h = PLAYER_H;
    p.vy = 280;
    return;
  }

  p.fastFall = false;
  const feetY = p.y + p.h;
  p.crouching = !!want;
  if (p.crouching) {
    p.h = PLAYER_CROUCH_H;
  } else {
    p.h = PLAYER_H;
  }
  p.y = feetY - p.h;
}

export function tryShoot(p) {
  if (p.dead || p.shootCd > 0) return null;
  const level = weaponLevel(p, p.weaponId) || 1;
  const w = scaledWeapon(p.weaponId, level);
  p.shootCd = w.cooldown;
  p.muzzle = 0.08;
  p.shooting = true;
  p.knockX = -Math.min(4, w.knockback * 0.25);
  const muzzleX = p.x + p.w - 2;
  const muzzleY = p.y + (p.crouching ? p.h * 0.45 : 28);
  return {
    x: muzzleX,
    y: muzzleY,
    weaponId: p.weaponId,
    level,
    pellets: w.pellets || 1,
    spread: w.spread || 0,
  };
}

export function tryGrenade(p) {
  if (p.dead || p.grenades <= 0) return null;
  p.grenades -= 1;
  return { x: p.x + p.w * 0.6, y: p.y + 18 };
}

export function selectWeapon(p, id) {
  if (p.unlocked[id]) p.weaponId = id;
}

export function cycleWeapon(p, dir) {
  const unlocked = WEAPON_ORDER.filter((id) => p.unlocked[id]);
  if (unlocked.length === 0) return;
  let i = unlocked.indexOf(p.weaponId);
  if (i < 0) i = 0;
  i = (i + dir + unlocked.length) % unlocked.length;
  p.weaponId = unlocked[i];
}

export function pickupWeapon(p, id, { equipIfStronger = true } = {}) {
  if (!WEAPONS[id]) return null;
  const prev = p.weaponLevels[id] || 0;
  if (prev >= 1) {
    p.weaponLevels[id] = prev + 1;
    p.unlocked[id] = true;
    return { id, level: p.weaponLevels[id], upgraded: true, isNew: false };
  }
  p.weaponLevels[id] = 1;
  p.unlocked[id] = true;
  if (equipIfStronger && WEAPONS[id].rank > (WEAPONS[p.weaponId]?.rank ?? 0)) {
    p.weaponId = id;
  }
  return { id, level: 1, upgraded: false, isNew: true };
}

/** @returns {'hurt'|'dead'|null} */
export function hurtPlayer(p, amount = 1) {
  if (p.dead || p.invuln > 0) return null;
  p.hp -= amount;
  p.flash = 0.15;
  if (p.hp <= 0) {
    p.hp = 0;
    p.dead = true;
    return 'dead';
  }
  p.invuln = 1.05;
  return 'hurt';
}

export function healPlayer(p, amount = 1) {
  p.hp = Math.min(p.maxHp, p.hp + amount);
}

export function updatePlayer(p, dt, solids, gravity) {
  if (p.dead) return;

  p.shootCd = Math.max(0, p.shootCd - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  p.muzzle = Math.max(0, p.muzzle - dt);
  p.dropThrough = Math.max(0, p.dropThrough - dt);
  p.flash = Math.max(0, p.flash - dt);
  if (p.muzzle <= 0) p.shooting = false;

  p.knockX *= Math.pow(0.001, dt);
  if (Math.abs(p.knockX) < 0.2) p.knockX = 0;
  p.x = p.baseX + p.knockX;

  const footL = p.x + 8;
  const footR = p.x + p.w - 8;

  if (!p.onGround) {
    p.crouching = false;
    p.h = PLAYER_H;
    if (p.fastFall) {
      if (p.vy < FAST_FALL_VY) p.vy = FAST_FALL_VY;
    } else {
      const g = p.vy < 0 ? gravity * 0.68 : gravity * 0.88;
      p.vy += g * dt;
    }
    const prevBottom = p.y + p.h;
    p.y += p.vy * dt;
    const bottom = p.y + p.h;

    if (p.vy >= 0) {
      let landed = null;
      for (const s of solids) {
        // drop-through: atravessa plataformas, mas aterra sempre no chão
        if (p.dropThrough > 0 && !s.isGround) continue;
        if (footR <= s.x || footL >= s.x + s.w) continue;
        const top = s.y;
        if (prevBottom <= top + 8 && bottom >= top) {
          if (!landed || top < landed.y) landed = s;
        }
      }
      if (landed) {
        p.y = landed.y - p.h;
        p.vy = 0;
        p.onGround = true;
        p.onPlatform = !landed.isGround;
        p.jumpsLeft = 2;
        p.fastFall = false;
        p.dropThrough = 0;
        p.knockX = 0;
      }
    }
  } else {
    p.jumpsLeft = 2;
    // manter no solid actual se ainda por baixo dos pés
    let support = null;
    for (const s of solids) {
      if (p.dropThrough > 0 && !s.isGround) continue;
      if (footR <= s.x || footL >= s.x + s.w) continue;
      const top = s.y;
      if (Math.abs(p.y + p.h - top) <= 8) {
        if (!support || top < support.y) support = s;
      }
    }
    if (support) {
      p.y = support.y - p.h;
      p.onPlatform = !support.isGround;
      if (!p.crouching) p.runPhase += dt * 12;
    } else {
      p.onGround = false;
      p.onPlatform = false;
      p.vy = 40;
    }
  }
}
