import {
  createPlayer,
  resetPlayer,
  jumpPlayer,
  setCrouch,
  tryShoot,
  tryGrenade,
  selectWeapon,
  cycleWeapon,
  pickupWeapon,
  weaponLevel,
  updatePlayer,
  playerRect,
  hurtPlayer,
  healPlayer,
  MAX_HP,
} from './player.js';
import {
  WEAPONS,
  scaledWeapon,
  createBullet,
  createGrenade,
  createExplosion,
  createEnemyBullet,
  updateProjectiles,
} from './weapons.js';
import {
  pickSpawn,
  maybePickup,
  spawnPlatformChunk,
  updateEntities,
  collectSolids,
  entityRect,
  aabb,
  circleRect,
  createJeep,
  createSoldier,
  createShooter,
  createDrone,
  createPlatform,
} from './entities.js';
import * as render from './render.js';
import * as audio from './audio.js';
import { getHighScore, addLeaderboardEntry, getLeaderboard } from './storage.js';

const GRAVITY = 1600;
const BASE_SPEED = 220;
const MAX_SPEED = 560;
const SPEED_STEP = 1.25;
const SPEED_EVERY = 1000;

export class Game {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.w = canvas.width;
    this.h = canvas.height;
    this.groundY = this.h - 80;
    this.state = 'menu';
    this.keys = new Set();
    this.player = createPlayer(this.groundY);
    this.entities = [];
    this.projectiles = [];
    this.particles = [];
    this.popups = [];
    this.scroll = 0;
    this.distance = 0;
    this.kills = 0;
    this.spawnTimer = 0;
    this.score = 0;
    this.highScore = getHighScore();
    this.gameOverPayload = null;
    this.shake = 0;
    this.hitstop = 0;
    this.banner = null;
    this.clearTimer = 0;
    this.nextWaveAt = 900;
    this.lastSpeedTier = 0;
    this.lastSpawnX = 0;
    this.runTime = 0;
    this.leaderboard = getLeaderboard();
    this.paused = false;
    this.hubMode = !!opts.hubMode;
    this._justKeys = [];
    if (!opts.skipBind) this._bindInput();
  }

  /** Hub shell feeds held keys + edge presses each frame. */
  syncExternalKeys(held, just = []) {
    this.keys = held instanceof Set ? held : new Set(held || []);
    this._justKeys = just || [];
    for (const k of this._justKeys) {
      if (k === 'Space' || k === 'ArrowUp' || k === 'w') {
        if (this.state === 'playing' && !this.paused && jumpPlayer(this.player)) audio.jump();
      }
      if ((k === 'z' || k === 'j') && this.state === 'playing' && !this.paused) this.fire();
      if ((k === 'x' || k === 'k') && this.state === 'playing' && !this.paused) this.throwGrenade();
      if (k === 'q' && this.state === 'playing' && !this.paused) cycleWeapon(this.player, -1);
      if ((k === 'e' || k === 'Tab') && this.state === 'playing' && !this.paused) cycleWeapon(this.player, 1);
      if (k === '1') selectWeapon(this.player, 'pistol');
      if (k === '2') selectWeapon(this.player, 'shotgun');
      if (k === '3') selectWeapon(this.player, 'mg');
      if (k === '4') selectWeapon(this.player, 'laser');
      if (k === '5') selectWeapon(this.player, 'heavy');
      if (k === '6') selectWeapon(this.player, 'rocket');
    }
  }

  resize(cssW, cssH, dpr) {
    const w = Math.max(320, Math.floor(cssW * dpr));
    const h = Math.max(240, Math.floor(cssH * dpr));
    this.canvas.width = w;
    this.canvas.height = h;
    this.w = w;
    this.h = h;
    this.groundY = h - Math.max(70, Math.floor(h * 0.14));
    const wasOnGround = this.player.onGround;
    this.player.baseX = Math.floor(w * 0.12);
    this.player.x = this.player.baseX + this.player.knockX;
    if (wasOnGround) this.player.y = this.groundY - this.player.h;
  }

  _normalizeKey(e) {
    if (e.code === 'Space' || e.key === ' ') return 'Space';
    if (e.key === 'Control') return 'Control';
    if (e.key === 'Escape') return 'Escape';
    if (e.key.length === 1) return e.key.toLowerCase();
    return e.key;
  }

  _bindInput() {
    window.addEventListener('keydown', (e) => {
      const k = this._normalizeKey(e);
      if (k === 'Space' || e.key.startsWith('Arrow') || k === 'tab' || k === 'Control' || k === 'Escape') {
        e.preventDefault();
      }
      this.keys.add(k);
      audio.unlock();

      if (k === 'm') {
        audio.toggleMute();
        return;
      }

      if (k === 'Enter') {
        if (this.state === 'menu' || this.state === 'gameover') this.startRun();
        return;
      }

      if ((k === 'p' || k === 'Escape') && this.state === 'playing') {
        this.paused = !this.paused;
        return;
      }

      if (this.state !== 'playing' || this.paused) return;

      if (k === 'Space' || k === 'ArrowUp' || k === 'w') {
        if (jumpPlayer(this.player)) audio.jump();
      }
      if (k === 'z' || k === 'j') this.fire();
      if (k === 'x' || k === 'k') this.throwGrenade();
      if (k === 'q') cycleWeapon(this.player, -1);
      if (k === 'e' || k === 'Tab') cycleWeapon(this.player, 1);
      if (k === '1') selectWeapon(this.player, 'pistol');
      if (k === '2') selectWeapon(this.player, 'shotgun');
      if (k === '3') selectWeapon(this.player, 'mg');
      if (k === '4') selectWeapon(this.player, 'laser');
      if (k === '5') selectWeapon(this.player, 'heavy');
      if (k === '6') selectWeapon(this.player, 'rocket');
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(this._normalizeKey(e));
    });
  }

  _wantCrouch() {
    return (
      this.keys.has('s') ||
      this.keys.has('ArrowDown') ||
      this.keys.has('Control') ||
      this.keys.has('c')
    );
  }

  startRun() {
    resetPlayer(this.player, this.groundY);
    this.entities = [];
    this.projectiles = [];
    this.particles = [];
    this.popups = [];
    this.scroll = 0;
    this.distance = 0;
    this.kills = 0;
    this.spawnTimer = 0.8;
    this.score = 0;
    this.state = 'playing';
    this.paused = false;
    this.gameOverPayload = null;
    this.highScore = getHighScore();
    this.shake = 0;
    this.hitstop = 0;
    this.banner = null;
    this.clearTimer = 0;
    this.nextWaveAt = 1100;
    this.lastSpeedTier = 0;
    this.lastSpawnX = 0;
    this.runTime = 0;
    this.leaderboard = getLeaderboard();
    audio.start();
  }

  fire() {
    const shot = tryShoot(this.player);
    if (!shot) return;
    const n = shot.pellets || 1;
    const spread = shot.spread || 0;
    for (let i = 0; i < n; i++) {
      let angle = 0;
      if (n > 1) angle = -spread / 2 + (spread * i) / (n - 1);
      this.projectiles.push(
        createBullet(shot.x, shot.y, shot.weaponId, shot.level, angle, this.distance)
      );
    }
    audio.shoot(shot.weaponId);
  }

  throwGrenade() {
    const g = tryGrenade(this.player);
    if (!g) return;
    this.projectiles.push(createGrenade(g.x, g.y, 240 + this.speed() * 0.15));
    audio.grenadeThrow();
  }

  speed() {
    const tier = Math.floor(this.distance / SPEED_EVERY);
    const mul = Math.pow(SPEED_STEP, tier);
    return Math.min(MAX_SPEED, BASE_SPEED * mul);
  }

  showBanner(text, life = 1.4) {
    this.banner = { text, life };
  }

  addPopup(x, y, text, color = '#f0e080') {
    this.popups.push({ x, y, text, color, life: 0.8, maxLife: 0.8 });
  }

  update(dt) {
    if (this.state === 'playing' && !this.paused) {
      if (this.keys.has('z') || this.keys.has('j')) this.fire();
      if (this.hitstop > 0) {
        this.hitstop -= dt;
      } else {
        this.updatePlay(dt);
      }
    }
    this.updateFx(dt);
  }

  updateFx(dt) {
    this.shake = Math.max(0, this.shake - dt * 2.5);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }
    for (const p of this.popups) {
      p.y -= 40 * dt;
      p.life -= dt;
    }
    this.popups = this.popups.filter((p) => p.life > 0);
    this.updateParticles(dt);
  }

  updatePlay(dt) {
    const speed = this.speed();
    this.runTime += dt;
    this.scroll += speed * dt;
    this.distance += speed * dt * 0.1;
    this.score = Math.floor(this.distance) + this.kills * 50;

    const tier = Math.floor(this.distance / SPEED_EVERY);
    if (tier > this.lastSpeedTier) {
      this.lastSpeedTier = tier;
      this.showBanner('SPEED UP!');
      audio.pickup();
    }

    if (this.distance >= this.nextWaveAt) {
      this.spawnMiniWave();
      this.nextWaveAt += 900 + Math.random() * 200;
    }

    const solids = collectSolids(this.groundY, this.w, this.entities);
    setCrouch(this.player, this._wantCrouch(), solids);
    updatePlayer(this.player, dt, solids, GRAVITY);
    updateEntities(this.entities, dt, speed);
    updateProjectiles(this.projectiles, dt, GRAVITY);

    for (const p of this.projectiles) {
      if (p.kind === 'grenade' && !p.dead) {
        for (const e of this.entities) {
          if (e.dead || e.type === 'pickup' || e.type === 'platform') continue;
          if (circleRect(p.x, p.y, p.r + 3, entityRect(e))) {
            p.dead = true;
            p.fuse = 0;
            break;
          }
        }
        // pousar em solids (chão / plataformas)
        if (!p.dead && p.vy >= 0) {
          for (const s of solids) {
            if (p.x < s.x || p.x > s.x + s.w) continue;
            if (p.y + p.r >= s.y && p.y + p.r <= s.y + 12) {
              p.y = s.y - p.r;
              p.vy *= -0.35;
              p.vx *= 0.85;
              if (Math.abs(p.vy) < 40) p.vy = 0;
              break;
            }
          }
        }
      }
      if (p.kind === 'grenade' && p.dead && p.fuse <= 0) {
        {
          const lv = weaponLevel(this.player, this.player.weaponId) || 1;
          const tier = Math.floor(this.distance / 500);
          this.boom(p.x, p.y, 78, (3 + lv * 0.55) * (1 + tier * 0.28));
        }
      }
    }

    this.clearTimer = Math.max(0, this.clearTimer - dt);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      // breathing room rarer as distance grows
      const clearChance = Math.max(0.06, 0.22 - this.distance * 0.00004);
      if (this.clearTimer <= 0 && Math.random() < clearChance) {
        this.clearTimer = Math.max(0.9, 2.2 - this.distance * 0.0002) + Math.random() * 0.6;
        this.spawnTimer = this.clearTimer;
      } else if (this.clearTimer <= 0) {
        this.spawnWave();
        // gaps shrink with distance → more enemies over time
        const gap = Math.max(0.55, 2.35 - this.distance * 0.00055);
        this.spawnTimer = gap + Math.random() * Math.max(0.2, 0.55 - this.distance * 0.00008);
      } else {
        this.spawnTimer = 0.35;
      }
    }

    this.handleEnemyFire();
    this.resolveCombat();
    this.resolvePickups();
    this.resolvePlayerHits();

    this.entities = this.entities.filter((e) => !e.dead && e.x + (e.w || 0) > -140);
    this.projectiles = this.projectiles.filter((p) => {
      if (p.dead) return false;
      if (p.kind === 'explosion') return true;
      return p.x > -40 && p.x < this.w + 80 && p.y > -40 && p.y < this.h + 40;
    });
  }

  _spawnX(minGap = 320) {
    // space relative to threats still ahead on screen
    let rightmost = this.w * 0.35;
    for (const e of this.entities) {
      if (e.dead || e.type === 'pickup') continue;
      rightmost = Math.max(rightmost, e.x + (e.w || 0));
    }
    return Math.max(this.w + 70, rightmost + minGap) + Math.random() * 40;
  }

  spawnWave() {
    const dens = Math.min(1, this.distance / 4500);
    const minGap = Math.max(160, 320 - dens * 120);
    const x = this._spawnX(minGap);
    const usePlat = this.distance > 200 && Math.random() < 0.22;

    if (usePlat) {
      const chunk = spawnPlatformChunk(x, this.groundY, this.distance);
      this.entities.push(...chunk);
      const groundChance = Math.min(0.55, 0.28 + dens * 0.3);
      if (Math.random() < groundChance) {
        const gx = x + 220 + Math.random() * 80;
        const groundThreat = pickSpawn(gx, this.groundY, this.distance);
        // early: avoid awkward overhead under platforms; late: full mix
        const allow =
          groundThreat.type !== 'overhead' || dens > 0.4;
        if (allow) {
          this.entities.push(groundThreat);
          this.lastSpawnX = Math.max(this.lastSpawnX, gx);
        }
      }
      if (dens > 0.35 && Math.random() < 0.35) {
        const gx2 = x + 380 + Math.random() * 60;
        this.entities.push(pickSpawn(gx2, this.groundY, this.distance));
        this.lastSpawnX = Math.max(this.lastSpawnX, gx2);
      }
      return;
    }

    const e = pickSpawn(x, this.groundY, this.distance);
    this.entities.push(e);

    // more packed threats as distance grows
    const multiChance = Math.min(0.62, 0.12 + dens * 0.5 + (this.distance > 700 ? 0.08 : 0));
    let lastX = x;
    if (Math.random() < multiChance) {
      const x2 = x + Math.max(140, 260 - dens * 80) + Math.random() * 60;
      this.entities.push(pickSpawn(x2, this.groundY, this.distance));
      lastX = x2;
    }
    if (dens > 0.45 && Math.random() < 0.28 + dens * 0.25) {
      const x3 = lastX + Math.max(130, 220 - dens * 60) + Math.random() * 50;
      this.entities.push(pickSpawn(x3, this.groundY, this.distance));
      lastX = x3;
    }
    this.lastSpawnX = Math.max(this.lastSpawnX, lastX);

    if (Math.random() < 0.55) {
      const pk = maybePickup(x - 180, this.groundY);
      if (pk) this.entities.push(pk);
    }
  }

  spawnMiniWave() {
    this.showBanner('WAVE!');
    const dens = Math.min(1, this.distance / 4500);
    const x = this._spawnX(Math.max(280, 400 - dens * 80));
    const plat = createPlatform(x + 60, this.groundY, 160);
    this.entities.push(plat);
    this.entities.push(
      createSoldier(x + 90, plat.top, this.distance, dens > 0.5 ? { elite: true } : {})
    );
    const midRoll = Math.random();
    if (midRoll < 0.34) {
      this.entities.push(createDrone(x + 280, this.groundY, this.distance, dens > 0.6 ? { heavy: true } : {}));
    } else if (midRoll < 0.67) {
      this.entities.push(createShooter(x + 300, this.groundY, this.distance, dens > 0.55 ? { sniper: true } : {}));
    } else {
      this.entities.push(createJeep(x + 280, this.groundY, this.distance));
    }
    if (dens > 0.25 && Math.random() < 0.55 + dens * 0.2) {
      this.entities.push(createSoldier(x + 200, this.groundY, this.distance));
    }
    if (dens > 0.55 && Math.random() < 0.4) {
      this.entities.push(createDrone(x + 360, this.groundY, this.distance));
    }
    if (Math.random() < 0.4 + dens * 0.25) {
      this.entities.push(createJeep(x + 420, this.groundY, this.distance, { boss: true }));
      this.lastSpawnX = x + 420;
    } else {
      this.lastSpawnX = x + 360;
    }
  }

  _aimAtPlayer(fromX, fromY, speed) {
    const px = this.player.x + this.player.w * 0.45;
    const py = this.player.y + this.player.h * 0.45;
    let dx = px - fromX;
    let dy = py - fromY;
    const len = Math.hypot(dx, dy) || 1;
    // always bias toward the player (left side); never shoot away
    if (dx > -40) dx = -Math.abs(dx) - 80;
    const n = Math.hypot(dx, dy) || 1;
    return { vx: (dx / n) * speed, vy: (dy / n) * speed };
  }

  handleEnemyFire() {
    for (const e of this.entities) {
      if (e.dead) continue;
      if (e.type === 'shooter') {
        if (e.shotsLeft <= 0 || e.shootCd > 0) continue;
        if (e.x > this.w - 40 || e.x < 60) continue;
        e.shotsLeft -= 1;
        e.shootCd = Math.max(0.85, 1.5 - this.distance * 0.00015);
        const muzzleX = e.x - 4;
        const muzzleY = e.y + e.h * 0.35;
        const { vx, vy } = this._aimAtPlayer(muzzleX, muzzleY, 300);
        const b = createEnemyBullet(muzzleX, muzzleY, vx, vy);
        b.r = 6;
        b.life = 3;
        this.projectiles.push(b);
        audio.enemyShot();
      } else if (e.type === 'drone') {
        if (e.shotsLeft <= 0 || e.shootCd > 0) continue;
        if (e.x > this.w - 40 || e.x < 80) continue;
        e.shotsLeft -= 1;
        e.shootCd = Math.max(1.0, 1.7 - this.distance * 0.00012);
        const muzzleX = e.x + e.w * 0.2;
        const muzzleY = e.y + e.h;
        const { vx, vy } = this._aimAtPlayer(muzzleX, muzzleY, 260);
        const b = createEnemyBullet(muzzleX, muzzleY, vx, Math.max(40, vy));
        b.r = 6;
        b.life = 3;
        this.projectiles.push(b);
        audio.enemyShot();
      }
    }
  }

  boom(x, y, radius = 78, damage = 3) {
    this.projectiles.push(createExplosion(x, y, radius, damage));
    audio.explode();
    this.shake = Math.max(this.shake, 0.35);
    this.spawnBurst(x, y, '#e09030', 18);
  }

  spawnBurst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 180;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 40,
        life: 0.3 + Math.random() * 0.35,
        maxLife: 0.5,
        s: 2 + Math.random() * 3,
        color,
      });
    }
  }

  _isProp(e) {
    return e.prop || e.type === 'crate' || e.type === 'overhead' || e.type === 'platform';
  }

  resolveCombat() {
    for (const p of this.projectiles) {
      if (p.dead) continue;

      if (p.kind === 'bullet') {
        let blocked = false;
        for (const e of this.entities) {
          if (e.dead || !this._isProp(e) || e.type === 'platform') continue;
          if (!circleRect(p.x, p.y, p.r, entityRect(e))) continue;
          blocked = true;
          if (p.explosive) {
            p.dead = true;
            this.boom(p.x, p.y, 70, 2.5 + p.damage);
          } else {
            p.dead = true;
            this.spawnBurst(p.x, p.y, '#8a6238', 4);
            audio.block();
          }
          break;
        }
        if (blocked || p.dead) continue;

        for (const e of this.entities) {
          if (e.dead || e.type === 'pickup' || this._isProp(e)) continue;
          if (p.hitIds && p.hitIds.has(e.id)) continue;
          if (!circleRect(p.x, p.y, p.r, entityRect(e))) continue;

          e.hp -= p.damage;
          e.flash = 0.1;
          if (p.hitIds) p.hitIds.add(e.id);
          audio.hit();
          this.spawnBurst(p.x, p.y, '#f0e080', 5);

          if (p.explosive) {
            p.dead = true;
            this.boom(p.x, p.y, 70, 2.5 + p.damage);
            break;
          }
          if (!p.pierce) {
            p.dead = true;
            if (e.hp <= 0) this.killEntity(e);
            else if (p.weaponId === 'heavy') this.hitstop = Math.max(this.hitstop, 0.04);
            break;
          }
          if (e.hp <= 0) this.killEntity(e);
        }
      }

      if (p.kind === 'explosion') {
        for (const e of this.entities) {
          if (e.dead || e.type === 'pickup' || this._isProp(e)) continue;
          if (p.hitIds.has(e.id)) continue;
          const r = entityRect(e);
          const cx = r.x + r.w / 2;
          const cy = r.y + r.h / 2;
          const dx = cx - p.x;
          const dy = cy - p.y;
          if (dx * dx + dy * dy < p.radius * p.radius) {
            p.hitIds.add(e.id);
            e.hp -= p.damage;
            e.flash = 0.12;
            if (e.hp <= 0) this.killEntity(e);
            else audio.hit();
          }
        }
      }
    }
  }

  killEntity(e) {
    e.dead = true;
    e.deadly = false;
    this.kills += 1;
    const pts = e.score || 100;
    this.score += pts;
    this.addPopup(e.x + e.w / 2, e.y, `+${pts}`);
    this.spawnBurst(e.x + e.w / 2, e.y + e.h / 2, '#c04030', 12);
    this.shake = Math.max(this.shake, 0.18);
    this.hitstop = Math.max(this.hitstop, 0.05);
    audio.kill();
  }

  resolvePickups() {
    const pr = playerRect(this.player);
    const magnet = 36;
    for (const e of this.entities) {
      if (e.dead || e.type !== 'pickup') continue;
      const er = entityRect(e);
      const nearX = Math.abs(pr.x + pr.w / 2 - (er.x + er.w / 2)) < magnet + pr.w;
      const nearY = Math.abs(pr.y + pr.h / 2 - (er.y + er.h / 2)) < magnet + pr.h;
      if (!aabb(pr, er) && !(nearX && nearY)) continue;
      e.dead = true;
      audio.pickup();
      this.applyPickup(e.kind);
    }
  }

  applyPickup(kind) {
    const p = this.player;
    if (WEAPONS[kind]) {
      const res = pickupWeapon(p, kind);
      if (res?.isNew) this.showBanner(`${WEAPONS[kind].label}!`);
      else if (res?.upgraded) this.showBanner(`${WEAPONS[kind].label} Lv${res.level}`);
    } else if (kind === 'grenades') p.grenades = Math.min(9, p.grenades + 3);
    else if (kind === 'invuln') p.invuln = Math.max(p.invuln, 2);
    else if (kind === 'bonus') {
      this.score += 250;
      this.addPopup(p.x + 20, p.y, '+250', '#fff');
    } else if (kind === 'hp') healPlayer(p, 1);
  }

  resolvePlayerHits() {
    const p = this.player;
    if (p.dead || p.invuln > 0) return;
    const pr = playerRect(p);

    for (const e of this.entities) {
      if (e.dead || !e.deadly) continue;
      if (aabb(pr, entityRect(e))) {
        this.damagePlayer();
        return;
      }
    }

    for (const b of this.projectiles) {
      if (b.dead || b.kind !== 'enemyBullet') continue;
      if (circleRect(b.x, b.y, b.r, pr)) {
        b.dead = true;
        this.damagePlayer();
        return;
      }
    }
  }

  damagePlayer() {
    const result = hurtPlayer(this.player, 1);
    if (result === 'dead') {
      this.die();
      return;
    }
    if (result === 'hurt') {
      this.shake = Math.max(this.shake, 0.28);
      audio.hurt();
    }
  }

  die() {
    if (!this.player.dead) this.player.dead = true;
    audio.die();
    this.spawnBurst(this.player.x + 20, this.player.y + 28, '#8a7360', 20);
    this.shake = 0.5;
    const score = Math.floor(this.score);
    const { entries, rank, newHigh } = addLeaderboardEntry({
      score,
      distance: this.distance,
      kills: this.kills,
      time: this.runTime,
    });
    this.leaderboard = entries;
    this.highScore = getHighScore();
    this.gameOverPayload = {
      score,
      distance: Math.floor(this.distance),
      kills: this.kills,
      time: this.runTime,
      highScore: this.highScore,
      newHigh,
      rank,
      leaderboard: entries,
    };
    this.state = 'gameover';
  }

  updateParticles(dt) {
    for (const pt of this.particles) {
      pt.vy += GRAVITY * 0.35 * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }

  draw() {
    const ctx = this.ctx;
    const { w, h } = this;

    ctx.save();
    if (this.shake > 0) {
      const m = this.shake * 10;
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }

    render.clearScene(ctx, w, h, this.groundY, this.scroll);

    for (const e of this.entities) render.drawEntity(ctx, e);
    for (const p of this.projectiles) render.drawProjectile(ctx, p);
    render.drawParticles(ctx, this.particles);
    render.drawPopups(ctx, this.popups);

    if (!this.player.dead || this.state === 'playing') {
      render.drawGrom(ctx, this.player);
    }

    ctx.restore();

    if (this.state === 'playing' || this.state === 'gameover') {
      const lv = weaponLevel(this.player, this.player.weaponId) || 1;
      const wpn = scaledWeapon(this.player.weaponId, lv, this.distance);
      render.drawHud(ctx, w, {
        distance: this.distance,
        kills: this.kills,
        score: this.score,
        time: this.runTime,
        weaponLabel: `${wpn.label} Lv${lv}`,
        weaponId: this.player.weaponId,
        unlocked: this.player.unlocked,
        weaponLevels: this.player.weaponLevels,
        grenades: this.player.grenades,
        highScore: this.highScore,
        hp: this.player.hp,
        maxHp: this.player.maxHp ?? MAX_HP,
        muted: audio.isMuted(),
      });
    }

    if (this.banner) render.drawBanner(ctx, w, h, this.banner);
    // Hub shell owns pause / game-over / menu chrome (avoids duplicate keybind footers)
    if (this.hubMode) return;
    if (this.paused && this.state === 'playing') render.drawPause(ctx, w, h);
    if (this.state === 'menu') {
      render.drawOverlay(ctx, w, h, 'menu', { leaderboard: this.leaderboard });
    }
    if (this.state === 'gameover' && this.gameOverPayload) {
      render.drawOverlay(ctx, w, h, 'gameover', this.gameOverPayload);
    }
  }
}
