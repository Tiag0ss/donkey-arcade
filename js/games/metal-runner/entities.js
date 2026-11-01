let nextId = 1;
function id() {
  return nextId++;
}

export function enemyTier(distance) {
  return Math.floor(Math.max(0, distance) / 500);
}

function scaleHp(base, distance) {
  const t = enemyTier(distance);
  // softer than before so upgraded / progress-scaled guns stay lethal
  return Math.ceil(base * (1 + t * 0.22));
}

export const PLATFORM_HEIGHT = 100;

export function createPlatform(x, groundY, width) {
  const w = width || 140 + Math.floor(Math.random() * 80);
  const top = groundY - PLATFORM_HEIGHT;
  return {
    id: id(),
    type: 'platform',
    x,
    y: top,
    w,
    h: 14,
    top,
    hp: 999,
    solid: true,
    deadly: false,
    prop: true,
    oneWay: true,
    dead: false,
    score: 0,
  };
}

export function createCrate(x, surfaceY, distance = 0, opts = {}) {
  const h = opts.small ? 24 + Math.floor(Math.random() * 10) : 36 + Math.floor(Math.random() * 18);
  const w = opts.small ? 22 + Math.floor(Math.random() * 10) : 28 + Math.floor(Math.random() * 16);
  return {
    id: id(),
    type: 'crate',
    x,
    y: surfaceY - h,
    w,
    h,
    hp: 999,
    solid: true,
    deadly: true,
    prop: true,
    duck: false,
    dead: false,
    score: 0,
  };
}

export function createOverhead(x, groundY, distance = 0) {
  const barH = 26;
  const crouchClear = 34;
  const bottom = groundY - crouchClear;
  const y = bottom - barH;
  return {
    id: id(),
    type: 'overhead',
    x,
    y,
    w: 52 + Math.floor(Math.random() * 18),
    h: barH,
    hp: 999,
    solid: true,
    deadly: true,
    prop: true,
    duck: true,
    dead: false,
    score: 0,
  };
}

export function createSoldier(x, surfaceY, distance = 0, opts = {}) {
  const elite = !!opts.elite;
  const hp = scaleHp(elite ? 4 : 2, distance);
  return {
    id: id(),
    type: 'soldier',
    x,
    y: surfaceY - (elite ? 52 : 48),
    w: elite ? 30 : 28,
    h: elite ? 52 : 48,
    hp,
    maxHp: hp,
    solid: false,
    deadly: true,
    duck: false,
    dead: false,
    score: elite ? 180 : 100,
    walkPhase: Math.random() * Math.PI * 2,
    flash: 0,
    elite,
  };
}

export function createShooter(x, surfaceY, distance = 0, opts = {}) {
  const t = enemyTier(distance);
  const sniper = !!opts.sniper;
  const hp = scaleHp(sniper ? 4 : 3, distance);
  return {
    id: id(),
    type: 'shooter',
    x,
    y: surfaceY - (sniper ? 44 : 40),
    w: sniper ? 32 : 30,
    h: sniper ? 44 : 40,
    hp,
    maxHp: hp,
    solid: false,
    deadly: true,
    duck: false,
    dead: false,
    score: sniper ? 220 : 150,
    shootCd: Math.max(0.55, (sniper ? 1.1 : 1.8) - t * 0.15) + Math.random() * 0.4,
    shotsLeft: sniper ? 2 + Math.min(3, t) : 1 + Math.min(2, t),
    flash: 0,
    sniper,
  };
}

export function createJeep(x, groundY, distance = 0, opts = {}) {
  const base = opts.boss ? 16 : 8;
  const hp = scaleHp(base, distance);
  return {
    id: id(),
    type: 'jeep',
    x,
    y: groundY - (opts.boss ? 52 : 44),
    w: opts.boss ? 90 : 70,
    h: opts.boss ? 52 : 44,
    hp,
    maxHp: hp,
    solid: false,
    deadly: true,
    duck: false,
    dead: false,
    score: opts.boss ? 800 : 300,
    bob: 0,
    boss: !!opts.boss,
    flash: 0,
  };
}

export function createDrone(x, groundY, distance = 0, opts = {}) {
  const t = enemyTier(distance);
  const heavy = !!opts.heavy;
  const baseY = groundY - (heavy ? 78 : 68) - (heavy ? Math.random() * 10 : 0);
  const hp = scaleHp(heavy ? 5 : 3, distance);
  return {
    id: id(),
    type: 'drone',
    x,
    y: baseY,
    baseY,
    w: heavy ? 48 : 40,
    h: heavy ? 28 : 24,
    hp,
    maxHp: hp,
    solid: false,
    deadly: true,
    duck: true,
    dead: false,
    score: heavy ? 320 : 200,
    bob: Math.random() * Math.PI * 2,
    shootCd: (heavy ? 1.0 : 1.4) + Math.random(),
    shotsLeft: heavy ? 2 + Math.min(3, Math.floor(t / 2)) : 1 + Math.min(2, Math.floor(t / 2)),
    flash: 0,
    heavy,
  };
}

export function createPickup(x, surfaceY, kind) {
  return {
    id: id(),
    type: 'pickup',
    kind,
    x,
    y: surfaceY - 50,
    w: 32,
    h: 32,
    bob: Math.random() * Math.PI * 2,
    dead: false,
  };
}

export function entityRect(e) {
  if (e.type === 'pickup') {
    const by = e.y + Math.sin(e.bob) * 5;
    return { x: e.x - 6, y: by - 6, w: e.w + 12, h: e.h + 12 };
  }
  if (e.type === 'platform') {
    return { x: e.x, y: e.y, w: e.w, h: e.h };
  }
  if (e.type === 'drone') {
    return { x: e.x + 2, y: e.y + 2, w: e.w - 4, h: e.h - 4 };
  }
  return { x: e.x + 2, y: e.y + 2, w: e.w - 4, h: e.h - 4 };
}

export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function circleRect(cx, cy, r, rect) {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

/** Roster unlocks and weights scale with distance → more variety over time. */
const SPAWN_TABLE = [
  {
    unlock: 0,
    early: 48,
    late: 10,
    fn: (x, g, d) => createCrate(x, g, d),
  },
  {
    unlock: 0,
    early: 34,
    late: 16,
    fn: (x, g, d) => createSoldier(x, g, d),
  },
  {
    unlock: 120,
    early: 10,
    late: 12,
    fn: (x, g, d) => createOverhead(x, g, d),
  },
  {
    unlock: 320,
    early: 8,
    late: 15,
    fn: (x, g, d) => createShooter(x, g, d),
  },
  {
    unlock: 520,
    early: 7,
    late: 13,
    fn: (x, g, d) => createJeep(x, g, d),
  },
  {
    unlock: 720,
    early: 6,
    late: 14,
    fn: (x, g, d) => createDrone(x, g, d),
  },
  {
    unlock: 1100,
    early: 0,
    late: 11,
    fn: (x, g, d) => createSoldier(x, g, d, { elite: true }),
  },
  {
    unlock: 1400,
    early: 0,
    late: 10,
    fn: (x, g, d) => createShooter(x, g, d, { sniper: true }),
  },
  {
    unlock: 1800,
    early: 0,
    late: 9,
    fn: (x, g, d) => createDrone(x, g, d, { heavy: true }),
  },
];

const PICKUP_KINDS = [
  'shotgun',
  'mg',
  'laser',
  'heavy',
  'rocket',
  'pistol',
  'grenades',
  'invuln',
  'bonus',
  'hp',
];

function spawnProgress(distance) {
  return Math.min(1, Math.max(0, distance) / 4200);
}

export function pickSpawn(x, groundY, distance) {
  const p = spawnProgress(distance);
  const table = [];
  for (const s of SPAWN_TABLE) {
    if (distance < s.unlock) continue;
    // ramp in for ~250m after unlock so new types appear gradually
    const open = Math.min(1, (distance - s.unlock) / 250);
    const w = (s.early * (1 - p) + s.late * p) * open;
    if (w > 0.05) table.push({ w, fn: s.fn });
  }
  if (!table.length) return createCrate(x, groundY, distance);
  const total = table.reduce((a, s) => a + s.w, 0);
  let r = Math.random() * total;
  for (const s of table) {
    r -= s.w;
    if (r <= 0) return s.fn(x, groundY, distance);
  }
  return table[table.length - 1].fn(x, groundY, distance);
}

export function maybePickup(x, surfaceY) {
  if (Math.random() > 0.22) return null;
  const kind = PICKUP_KINDS[Math.floor(Math.random() * PICKUP_KINDS.length)];
  return createPickup(x, surfaceY, kind);
}

/** Platform chunk — top threat variety grows with distance. */
export function spawnPlatformChunk(x, groundY, distance) {
  const plat = createPlatform(x, groundY);
  const out = [plat];
  const top = plat.top;
  const midX = x + plat.w * 0.45;
  const p = spawnProgress(distance);
  const emptyChance = Math.max(0.12, 0.4 - p * 0.22);
  const roll = Math.random();

  if (roll < emptyChance) {
    // empty shortcut
  } else if (roll < emptyChance + 0.28) {
    out.push(createSoldier(midX, top, distance, distance > 1100 && Math.random() < 0.35 ? { elite: true } : {}));
  } else if (roll < emptyChance + 0.48 && distance >= 320) {
    out.push(createShooter(midX, top, distance, distance > 1400 && Math.random() < 0.3 ? { sniper: true } : {}));
  } else if (roll < emptyChance + 0.62 && distance >= 720) {
    out.push(createDrone(midX - 10, groundY, distance, distance > 1800 && Math.random() < 0.35 ? { heavy: true } : {}));
  } else if (roll < emptyChance + 0.78) {
    out.push(createCrate(midX, top, distance, { small: true }));
  } else {
    const pk = maybePickup(midX, top);
    if (pk) out.push(pk);
    else out.push(createSoldier(midX, top, distance));
  }

  // late game: sometimes a second threat on a longer platform
  if (p > 0.45 && plat.w > 160 && Math.random() < 0.35 + p * 0.25) {
    const sideX = midX + 50 + Math.random() * 30;
    if (sideX + 20 < x + plat.w) {
      out.push(
        Math.random() < 0.5
          ? createSoldier(sideX, top, distance)
          : createShooter(sideX, top, distance)
      );
    }
  }

  return out;
}

export function updateEntities(entities, dt, scrollSpeed) {
  for (const e of entities) {
    if (e.dead) continue;
    e.x -= scrollSpeed * dt;
    if (e.flash) e.flash = Math.max(0, e.flash - dt);
    if (e.type === 'soldier') {
      e.walkPhase += dt * 8;
    } else if (e.type === 'shooter') {
      e.shootCd -= dt;
    } else if (e.type === 'jeep') {
      e.bob += dt * 6;
    } else if (e.type === 'drone') {
      e.bob += dt * 3.2;
      e.y = e.baseY + Math.sin(e.bob) * 6;
      e.shootCd -= dt;
    } else if (e.type === 'pickup') {
      e.bob += dt * 5;
    }
  }
}

export function collectSolids(groundY, groundW, entities) {
  const solids = [{ x: -200, y: groundY, w: groundW + 400, h: 40, isGround: true }];
  for (const e of entities) {
    if (e.dead || e.type !== 'platform') continue;
    solids.push({ x: e.x, y: e.y, w: e.w, h: e.h, isGround: false, oneWay: true });
  }
  return solids;
}
