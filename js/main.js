import { createInput } from './shared/input.js';
import { createLoop } from './shared/loop.js';
import { createParticles } from './shared/particles.js';
import { drawDonkey } from './shared/donkey.js';
import * as audio from './shared/audio.js';
import * as storage from './shared/storage.js';
import { createHub } from './hub.js';
import { getGame } from './games/catalog.js';

const canvas = document.getElementById('game');
const hint = document.getElementById('hint');
const input = createInput();
const particles = createParticles();

const settings = storage.getSettings();
audio.setMuted(settings.muted);
storage.migrateMetalRunnerScores();
storage.recomputeStarsTotal();

let current = null;

const api = {
  canvas,
  input,
  audio,
  storage,
  drawDonkey,
  particles,
  goHub() {
    returnToHub();
  },
};

function fitCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(320, Math.floor(window.innerWidth * dpr));
  const h = Math.max(240, Math.floor(window.innerHeight * dpr));
  canvas.width = w;
  canvas.height = h;
}

fitCanvas();
window.addEventListener('resize', fitCanvas);
canvas.tabIndex = 0;
canvas.style.outline = 'none';
canvas.addEventListener('pointerdown', () => canvas.focus());
canvas.focus();

function returnToHub() {
  if (current?.destroy) current.destroy();
  particles.clear();
  current = createHub(api);
  current.onEvent((ev, data) => {
    if (ev === 'play') startGame(data.gameId, data.mode);
  });
  current.start();
  hint.textContent = 'Enter select · Esc back · M mute · P pause';
}

function startGame(gameId, mode) {
  const def = getGame(gameId);
  if (!def) return;
  if (current?.destroy) current.destroy();
  particles.clear();
  audio.unlock();
  try {
    current = def.create(canvas, api);
  } catch (err) {
    console.error('Failed to start game', gameId, err);
    returnToHub();
    return;
  }
  current.onEvent((ev) => {
    if (ev === 'back') returnToHub();
  });
  current.start(mode || 'play');
  const binds = (def.controls || []).join(' · ');
  hint.textContent = binds ? `${binds} · Esc arcade` : 'Esc arcade · M mute · P pause';
}

returnToHub();

const loop = createLoop((dt) => {
  if (!current) return;
  current.update(dt);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  current.draw(ctx);
  particles.update(dt);
  // draw particles on top only if game didn't already
  input.endFrame();
});
loop.start();
