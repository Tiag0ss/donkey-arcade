function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/**
 * Shared procedural donkey with helmet.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x:number, y:number, scale?:number, facing?:number, pose?:string, blink?:boolean, hurt?:boolean, tint?:string, runPhase?:number }} opts
 */
export function drawDonkey(ctx, opts) {
  const {
    x,
    y,
    scale = 1,
    facing = 1,
    pose = 'idle',
    blink = false,
    hurt = false,
    tint = null,
    runPhase = 0,
  } = opts;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * scale, scale);

  if (hurt && Math.floor(performance.now() / 50) % 2 === 0) {
    ctx.restore();
    return;
  }

  const crouch = pose === 'crouch' || pose === 'sneak' || pose === 'block';
  const kick = pose === 'kick';
  const charge = pose === 'charge';
  const jump = pose === 'jump';
  const cart = pose === 'cart';
  const sit = pose === 'sit' || pose === 'stackHold';
  const hitstun = pose === 'hitstun';

  if (crouch) ctx.scale(1.05, 0.78);
  if (sit) ctx.scale(1.1, 0.85);
  if (hitstun) ctx.rotate(-0.15);

  const belly = jump ? 4 : 0;
  const legSwing =
    pose === 'run' || pose === 'sneak' ? Math.sin(runPhase) * (pose === 'sneak' ? 4 : 8) : kick ? 12 : 0;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(21, 58, 16, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // legs
  if (!cart) {
    ctx.fillStyle = '#6a5540';
    ctx.fillRect(11, 42 + legSwing * 0.35, 9, 14);
    ctx.fillRect(24, 42 - legSwing * 0.35, 9, 14);
    ctx.fillStyle = '#2a2218';
    ctx.fillRect(10, 53, 11, 5);
    ctx.fillRect(23, 53, 11, 5);
  } else {
    ctx.fillStyle = '#6a5540';
    ctx.fillRect(14, 44, 8, 10);
    ctx.fillRect(26, 44, 8, 10);
  }

  // body
  const bodyColor = tint || '#8a7360';
  ctx.fillStyle = bodyColor;
  roundRect(ctx, 5, 20 - belly, 32, 28 + belly, 8);
  ctx.fill();
  ctx.fillStyle = '#a89078';
  roundRect(ctx, 10, 30 - belly * 0.3, 22, 14, 5);
  ctx.fill();

  // vest
  ctx.fillStyle = '#3d4a32';
  roundRect(ctx, 9, 22, 24, 16, 3);
  ctx.fill();
  ctx.fillStyle = '#c9a227';
  ctx.fillRect(19, 24, 3, 10);

  // tail
  ctx.strokeStyle = '#5a4438';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(6, 36);
  ctx.quadraticCurveTo(-4, 40 + Math.sin(runPhase) * 3, -2, 48);
  ctx.stroke();

  // kick leg extend
  if (kick) {
    ctx.fillStyle = '#6a5540';
    ctx.fillRect(34, 34, 22, 8);
    ctx.fillStyle = '#2a2218';
    ctx.fillRect(52, 33, 8, 10);
  }

  // charge glow
  if (charge) {
    ctx.strokeStyle = 'rgba(255,200,80,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 18, 36, 32);
  }

  // arm
  ctx.fillStyle = '#7a6350';
  ctx.fillRect(30, 24, 9, 10);

  // neck + head
  ctx.fillStyle = '#8a7360';
  ctx.fillRect(14, 14, 12, 10);
  ctx.fillStyle = '#9a8068';
  roundRect(ctx, 22, 8, 22, 14, 5);
  ctx.fill();
  ctx.fillStyle = '#5a4438';
  ctx.fillRect(38, 14, 6, 5);

  // ears
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

  // helmet
  ctx.fillStyle = '#3a4a30';
  roundRect(ctx, 20, 2, 12, 7, 2);
  ctx.fill();
  ctx.fillStyle = '#2a3224';
  ctx.fillRect(23, 0, 5, 3);

  // eye
  if (!blink) {
    ctx.fillStyle = '#1a1810';
    ctx.fillRect(28, 10, 4, 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(29, 10, 1, 1);
  } else {
    ctx.fillStyle = '#1a1810';
    ctx.fillRect(28, 12, 4, 1);
  }

  // sneak sweat
  if (pose === 'sneak') {
    ctx.fillStyle = '#8af';
    ctx.fillRect(36, 8, 2, 4);
  }

  ctx.restore();
}

export const PALETTE = {
  skyTop: '#2a3a28',
  skyBot: '#5a6e48',
  ground: '#3a3228',
  groundTop: '#5c5344',
  dust: '#8a7e68',
  panel: 'rgba(12,16,10,0.88)',
  panelBorder: '#6a7860',
  accent: '#c9a227',
  text: '#c8d4b8',
  danger: '#c05040',
  good: '#6aab5a',
};
