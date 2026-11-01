let ctx = null;
let muted = false;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function beep(freq, dur, type = 'square', vol = 0.07, slide = 0) {
  if (muted) return;
  const ac = ensure();
  if (!ac) return;
  const t0 = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g);
  g.connect(ac.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export function unlock() {
  ensure();
}

export function isMuted() {
  return muted;
}

export function setMuted(v) {
  muted = !!v;
  return muted;
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

export function uiClick() {
  beep(520, 0.04, 'square', 0.035);
}

export function medal() {
  beep(660, 0.05, 'square', 0.04, 120);
  setTimeout(() => beep(880, 0.07, 'square', 0.035), 50);
}

export function countdown() {
  beep(400, 0.06, 'square', 0.04);
}

export function go() {
  beep(560, 0.08, 'square', 0.05, 80);
}

export function jump() {
  beep(320, 0.08, 'square', 0.045, 180);
}

export function shoot(weapon = 'pistol') {
  if (weapon === 'rocket') beep(85, 0.14, 'sawtooth', 0.07, -25);
  else if (weapon === 'heavy') beep(100, 0.12, 'sawtooth', 0.065, -35);
  else if (weapon === 'laser') beep(920, 0.04, 'sine', 0.035, 120);
  else if (weapon === 'shotgun') beep(150, 0.09, 'sawtooth', 0.055, -60);
  else if (weapon === 'mg') beep(480, 0.035, 'square', 0.03, -60);
  else beep(560, 0.05, 'square', 0.04, -90);
}

export function enemyShot() {
  beep(240, 0.045, 'square', 0.035, -50);
}

export function grenadeThrow() {
  beep(200, 0.07, 'triangle', 0.04, -40);
}

export function explode() {
  if (muted) return;
  const ac = ensure();
  if (!ac) return;
  const t0 = ac.currentTime;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(100, t0);
  o.frequency.exponentialRampToValueAtTime(45, t0 + 0.22);
  g.gain.setValueAtTime(0.08, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
  o.connect(g);
  g.connect(ac.destination);
  o.start(t0);
  o.stop(t0 + 0.25);
}

export function hit() {
  beep(180, 0.04, 'square', 0.04, -50);
}

export function kill() {
  beep(240, 0.05, 'square', 0.05, -80);
}

export function block() {
  beep(100, 0.035, 'triangle', 0.03, -15);
}

export function hurt() {
  beep(140, 0.09, 'sawtooth', 0.06, -45);
}

export function pickup() {
  beep(700, 0.05, 'square', 0.04, 160);
  setTimeout(() => beep(920, 0.06, 'square', 0.035), 45);
}

export function die() {
  beep(180, 0.1, 'sawtooth', 0.07, -90);
  setTimeout(() => beep(95, 0.18, 'sawtooth', 0.055, -30), 60);
}

export function start() {
  beep(360, 0.05, 'square', 0.04);
  setTimeout(() => beep(480, 0.06, 'square', 0.04), 50);
}

export function kick() {
  beep(220, 0.07, 'sawtooth', 0.055, -70);
}

export function perfect() {
  beep(800, 0.05, 'sine', 0.04, 100);
}

export function nitro() {
  beep(180, 0.12, 'sawtooth', 0.05, 200);
}

export function heehaw() {
  beep(280, 0.08, 'square', 0.05, -40);
  setTimeout(() => beep(220, 0.1, 'square', 0.045, -30), 70);
}

export function alarm() {
  beep(600, 0.08, 'square', 0.05);
  setTimeout(() => beep(480, 0.08, 'square', 0.05), 90);
}
