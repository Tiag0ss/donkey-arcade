import { PALETTE } from './donkey.js';
import { getMedalDef, medalTitles } from './medals.js';

export function drawPanel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PALETTE.panelBorder;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.strokeStyle = PALETTE.accent;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
}

export function drawBanner(ctx, text, w, h, y = h * 0.35) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, y - 28, w, 56);
  ctx.fillStyle = PALETTE.accent;
  ctx.font = 'bold 28px Courier New, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, y);
}

export function drawText(ctx, text, x, y, opts = {}) {
  ctx.fillStyle = opts.color || PALETTE.text;
  ctx.font = opts.font || '14px Courier New, monospace';
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = opts.baseline || 'top';
  ctx.fillText(text, x, y);
}

export function drawHearts(ctx, x, y, hp, max = 3) {
  for (let i = 0; i < max; i++) {
    ctx.fillStyle = i < hp ? '#c05040' : '#3a3228';
    ctx.beginPath();
    const hx = x + i * 18;
    ctx.moveTo(hx + 6, y + 4);
    ctx.bezierCurveTo(hx + 6, y, hx, y, hx, y + 5);
    ctx.bezierCurveTo(hx, y + 10, hx + 6, y + 14, hx + 6, y + 14);
    ctx.bezierCurveTo(hx + 6, y + 14, hx + 12, y + 10, hx + 12, y + 5);
    ctx.bezierCurveTo(hx + 12, y, hx + 6, y, hx + 6, y + 4);
    ctx.fill();
  }
}

export function drawStars(ctx, x, y, n, max = 3) {
  for (let i = 0; i < max; i++) {
    ctx.fillStyle = i < n ? PALETTE.accent : '#3a3228';
    ctx.font = '14px Courier New, monospace';
    ctx.fillText('★', x + i * 16, y);
  }
}


export function drawMedalBadge(ctx, x, y, id, unlocked, size = 28) {
  const def = getMedalDef(id);
  ctx.save();
  ctx.fillStyle = unlocked ? '#3a4a28' : '#1a2218';
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = unlocked ? PALETTE.accent : '#3a4238';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
  ctx.fillStyle = unlocked ? PALETTE.accent : '#4a5848';
  ctx.font = `bold ${Math.max(8, Math.floor(size * 0.28))}px Courier New, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(def.short, x + size / 2, y + size / 2 + 1);
  if (unlocked) {
    ctx.fillStyle = '#ffe080';
    ctx.font = `${Math.floor(size * 0.3)}px Courier New, monospace`;
    ctx.fillText('*', x + size - 7, y + 8);
  }
  ctx.restore();
  return { x, y, w: size, h: size, id };
}

/** Draw a row of medals; returns total width used. */
export function drawMedalRow(ctx, x, y, ids, unlockedSet, size = 26, gap = 6) {
  const set = unlockedSet instanceof Set ? unlockedSet : new Set(unlockedSet || []);
  ids.forEach((id, i) => {
    drawMedalBadge(ctx, x + i * (size + gap), y, id, set.has(id), size);
  });
  return ids.length * (size + gap) - gap;
}

export function drawPauseOverlay(ctx, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, w, h);
  drawBanner(ctx, 'PAUSED', w, h);
  drawText(ctx, 'P resume · Esc arcade', w / 2, h * 0.35 + 36, {
    align: 'center',
    color: '#8a9878',
  });
}

export function drawConfirmBack(ctx, w, h) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);
  const pw = Math.min(420, w * 0.8);
  const ph = 140;
  const px = (w - pw) / 2;
  const py = (h - ph) / 2;
  drawPanel(ctx, px, py, pw, ph);
  drawText(ctx, 'BACK TO ARCADE?', w / 2, py + 40, {
    align: 'center',
    font: 'bold 20px Courier New, monospace',
    color: PALETTE.accent,
  });
  drawText(ctx, 'Enter = yes   Esc = no', w / 2, py + 85, {
    align: 'center',
    color: PALETTE.text,
  });
}

export function drawGameOver(ctx, w, h, payload) {
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, w, h);
  const hasMedals = !!(payload.medals && payload.medals.length);
  const pw = Math.min(480, w * 0.88);
  const ph = Math.min(hasMedals ? 380 : 320, h * 0.78);
  const px = (w - pw) / 2;
  const py = (h - ph) / 2;
  drawPanel(ctx, px, py, pw, ph);

  drawText(ctx, payload.title || 'GAME OVER', w / 2, py + 28, {
    align: 'center',
    font: 'bold 24px Courier New, monospace',
    color: PALETTE.accent,
  });

  if (payload.newHigh) {
    drawText(ctx, 'NEW RECORD!', w / 2, py + 58, {
      align: 'center',
      color: '#ffe080',
      font: 'bold 16px Courier New, monospace',
    });
  }

  drawText(ctx, `SCORE  ${payload.score ?? 0}`, w / 2, py + 88, {
    align: 'center',
    font: '18px Courier New, monospace',
  });

  const stats = payload.stats || [];
  stats.slice(0, 3).forEach((s, i) => {
    drawText(ctx, s, w / 2, py + 120 + i * 22, {
      align: 'center',
      color: '#8a9878',
    });
  });

  let foot = py + ph - 28;
  if (payload.rank) {
    drawText(ctx, `RANK #${payload.rank}`, w / 2, foot - (hasMedals ? 78 : 28), {
      align: 'center',
      color: PALETTE.good,
    });
  }

  if (hasMedals) {
    const titles = medalTitles(payload.medals);
    drawText(ctx, 'NEW MEDAL' + (titles.length > 1 ? 'S' : ''), w / 2, foot - 58, {
      align: 'center',
      color: '#ffe080',
      font: 'bold 12px Courier New, monospace',
    });
    const size = 32;
    const gap = 8;
    const totalW = payload.medals.length * (size + gap) - gap;
    let mx = w / 2 - totalW / 2;
    payload.medals.forEach((id) => {
      drawMedalBadge(ctx, mx, foot - 48, id, true, size);
      mx += size + gap;
    });
    drawText(ctx, titles.join(' · '), w / 2, foot - 10, {
      align: 'center',
      color: PALETTE.accent,
      font: '11px Courier New, monospace',
    });
    foot -= 8;
  }

  drawText(ctx, 'Enter retry · Esc arcade', w / 2, py + ph - 14, {
    align: 'center',
    color: '#6a7860',
    font: '13px Courier New, monospace',
  });
}

export function drawCountdown(ctx, w, h, value) {
  const label = value <= 0 ? 'GO!' : String(Math.ceil(value));
  drawBanner(ctx, label, w, h);
}

export function hitTest(mx, my, rect) {
  return mx >= rect.x && mx <= rect.x + rect.w && my >= rect.y && my <= rect.y + rect.h;
}

export function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}
