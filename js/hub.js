import { GAMES } from './games/catalog.js';
import { drawDonkey, PALETTE } from './shared/donkey.js';
import { drawPanel, drawText, drawStars, drawMedalRow } from './shared/ui.js';
import {
  getHighScore,
  getGameStars,
  getMedals,
  getMeta,
  setMeta,
  getLeaderboard,
  recomputeStarsTotal,
} from './shared/storage.js';
import { MEDALS_BY_GAME, getMedalDef } from './shared/medals.js';
import * as audio from './shared/audio.js';

export function createHub(api) {
  let selected = 0;
  let screen = 'menu'; // menu | howto | modes
  let modeCursor = 0; // duel: 0 vsAi, 1 vsLocal
  let scrollY = 0;
  const meta = getMeta();
  if (!meta.firstVisitDone) {
    setMeta({ firstVisitDone: true });
  }
  recomputeStarsTotal();

  const listeners = [];
  function emit(ev, data) {
    for (const cb of listeners) cb(ev, data);
  }

  function cols(w) {
    return w < 700 ? 1 : 2;
  }

  function cardLayout(w, h) {
    const c = cols(w);
    const pad = 24;
    const gap = 14;
    const headerH = 90;
    const footerH = 50;
    const usableW = w - pad * 2;
    const cardW = (usableW - gap * (c - 1)) / c;
    const cardH = 118;
    return { c, pad, gap, headerH, footerH, cardW, cardH };
  }

  function ensureVisible(w, h) {
    const { c, pad, gap, headerH, cardH } = cardLayout(w, h);
    const row = Math.floor(selected / c);
    const y = headerH + row * (cardH + gap);
    const viewH = h - headerH - 50;
    if (y - scrollY < 0) scrollY = y;
    if (y + cardH - scrollY > viewH) scrollY = y + cardH - viewH;
    scrollY = Math.max(0, scrollY);
  }

  return {
    id: 'hub',
    onEvent(cb) {
      listeners.push(cb);
    },
    start() {
      screen = 'menu';
      selected = 0;
      scrollY = 0;
    },
    update(dt) {
      const input = api.input;
      const w = api.canvas.width;
      const h = api.canvas.height;
      const n = GAMES.length;
      const c = cols(w);

      if (input.pressed('m')) {
        const muted = audio.toggleMute();
        api.storage.setSettings({ muted });
      }

      if (screen === 'menu') {
        if (input.pressed('ArrowLeft') || input.pressed('a')) {
          selected = (selected - 1 + n) % n;
          audio.uiClick();
        }
        if (input.pressed('ArrowRight') || input.pressed('d')) {
          selected = (selected + 1) % n;
          audio.uiClick();
        }
        if (input.pressed('ArrowUp') || input.pressed('w')) {
          selected = (selected - c + n) % n;
          audio.uiClick();
        }
        if (input.pressed('ArrowDown') || input.pressed('s')) {
          selected = (selected + c) % n;
          audio.uiClick();
        }
        if (input.pressed('Enter') || input.pressed('Space')) {
          screen = 'howto';
          audio.uiClick();
        }
        ensureVisible(w, h);
      } else if (screen === 'howto') {
        if (input.pressed('Escape')) {
          screen = 'menu';
          audio.uiClick();
        } else if (input.pressed('Enter') || input.pressed('Space')) {
          const g = GAMES[selected];
          if (g.supports2P) {
            screen = 'modes';
            modeCursor = 0;
            audio.uiClick();
          } else {
            emit('play', { gameId: g.id, mode: 'play' });
          }
        }
      } else if (screen === 'modes') {
        if (input.pressed('Escape')) {
          screen = 'howto';
          audio.uiClick();
        }
        if (input.pressed('ArrowUp') || input.pressed('ArrowDown') || input.pressed('w') || input.pressed('s')) {
          modeCursor = 1 - modeCursor;
          audio.uiClick();
        }
        if (input.pressed('Enter') || input.pressed('Space')) {
          emit('play', {
            gameId: GAMES[selected].id,
            mode: modeCursor === 0 ? 'vsAi' : 'vsLocal',
          });
        }
      }
    },
    draw(ctx) {
      const w = api.canvas.width;
      const h = api.canvas.height;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#1a2818');
      g.addColorStop(1, '#2a3824');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // stable pattern
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      for (let y = 0; y < h; y += 24) {
        for (let x = (y / 24) % 2 === 0 ? 0 : 12; x < w; x += 24) {
          ctx.fillRect(x, y, 12, 12);
        }
      }

      const m = getMeta();
      drawText(ctx, 'DONKEY ARCADE', w / 2, 22, {
        align: 'center',
        font: `bold ${Math.min(36, w / 18)}px Courier New, monospace`,
        color: PALETTE.accent,
      });
      drawText(ctx, `★ ${m.starsTotal}   ${audio.isMuted() ? 'MUTED' : 'SFX ON'}`, w / 2, 56, {
        align: 'center',
        color: '#8a9878',
        font: '13px Courier New, monospace',
      });

      if (screen === 'menu') {
        drawMenu(ctx, w, h);
        if (!getMeta().firstVisitDone || m.gamesPlayed === 0) {
          drawText(ctx, 'PICK A GAME', w / 2, h - 48, {
            align: 'center',
            color: '#ffe080',
            font: 'bold 14px Courier New, monospace',
          });
        }
      } else if (screen === 'howto') {
        drawHowTo(ctx, w, h, GAMES[selected]);
      } else {
        drawModes(ctx, w, h);
      }

      // mascot
      drawDonkey(ctx, {
        x: 28,
        y: h - 90,
        scale: 1.1,
        pose: 'idle',
        runPhase: performance.now() / 200,
      });
    },
    destroy() {},
  };

  function drawMenu(ctx, w, h) {
    const { c, pad, gap, headerH, cardW, cardH } = cardLayout(w, h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, headerH - 4, w, h - headerH - 40);
    ctx.clip();

    GAMES.forEach((game, i) => {
      const col = i % c;
      const row = Math.floor(i / c);
      const x = pad + col * (cardW + gap);
      const y = headerH + row * (cardH + gap) - scrollY;
      const sel = i === selected;
      ctx.fillStyle = sel ? 'rgba(40,50,30,0.95)' : 'rgba(20,26,16,0.85)';
      ctx.fillRect(x, y, cardW, cardH);
      ctx.strokeStyle = sel ? game.accent : '#4a5848';
      ctx.lineWidth = sel ? 3 : 1;
      ctx.strokeRect(x + 1, y + 1, cardW - 2, cardH - 2);

      ctx.fillStyle = game.accent;
      ctx.fillRect(x + 8, y + 12, 6, cardH - 24);

      drawText(ctx, game.title, x + 24, y + 16, {
        font: 'bold 16px Courier New, monospace',
        color: sel ? '#f0f4e8' : PALETTE.text,
      });
      drawText(ctx, game.blurb, x + 24, y + 40, {
        font: '12px Courier New, monospace',
        color: '#7a8a70',
      });
      const best = getHighScore(game.id);
      const stars = getGameStars(game.id);
      const unlocked = getMedals(game.id);
      const catalog = MEDALS_BY_GAME[game.id] || [];
      drawText(ctx, `BEST ${best}`, x + 24, y + 58, {
        font: '12px Courier New, monospace',
        color: '#9aac88',
      });
      drawStars(ctx, x + cardW - 64, y + 56, stars);
      if (catalog.length) {
        drawMedalRow(ctx, x + 22, y + 78, catalog, unlocked, 22, 5);
      } else {
        drawText(ctx, unlocked.length ? `${unlocked.length} medals` : 'No medals yet', x + 24, y + 82, {
          font: '11px Courier New, monospace',
          color: '#6a7860',
        });
      }
    });
    ctx.restore();
  }

  function drawHowTo(ctx, w, h, game) {
    const pw = Math.min(520, w * 0.88);
    const ph = Math.min(420, h * 0.82);
    const px = (w - pw) / 2;
    const py = (h - ph) / 2;
    drawPanel(ctx, px, py, pw, ph);
    drawText(ctx, game.title, w / 2, py + 24, {
      align: 'center',
      font: 'bold 22px Courier New, monospace',
      color: game.accent,
    });
    drawText(ctx, game.blurb, w / 2, py + 54, {
      align: 'center',
      color: '#8a9878',
    });
    drawText(ctx, 'CONTROLS', px + 28, py + 90, {
      color: PALETTE.accent,
      font: 'bold 13px Courier New, monospace',
    });
    game.controls.forEach((line, i) => {
      drawText(ctx, `· ${line}`, px + 28, py + 114 + i * 20, {
        font: '13px Courier New, monospace',
      });
    });
    const tipY = py + 114 + game.controls.length * 20 + 16;
    drawText(ctx, 'TIP', px + 28, tipY, {
      color: PALETTE.accent,
      font: 'bold 13px Courier New, monospace',
    });
    drawText(ctx, game.tips[0] || '', px + 28, tipY + 22, {
      font: '13px Courier New, monospace',
      color: '#a8b898',
    });

    const lb = getLeaderboard(game.id).slice(0, 3);
    drawText(ctx, 'TOP 3', px + 28, tipY + 52, {
      color: PALETTE.accent,
      font: 'bold 13px Courier New, monospace',
    });
    if (!lb.length) {
      drawText(ctx, 'No scores yet', px + 28, tipY + 74, { color: '#6a7860' });
    } else {
      lb.forEach((e, i) => {
        drawText(ctx, `${i + 1}. ${e.score}`, px + 28, tipY + 74 + i * 18, {
          font: '13px Courier New, monospace',
        });
      });
    }

    const catalog = MEDALS_BY_GAME[game.id] || [];
    const unlocked = getMedals(game.id);
    const medalY = tipY + 74 + Math.max(1, lb.length) * 18 + 12;
    drawText(ctx, 'MEDALS', px + 28, medalY, {
      color: PALETTE.accent,
      font: 'bold 13px Courier New, monospace',
    });
    if (catalog.length) {
      drawMedalRow(ctx, px + 28, medalY + 20, catalog, unlocked, 28, 8);
      catalog.forEach((id, i) => {
        const def = getMedalDef(id);
        const on = unlocked.includes(id);
        const bx = px + 28 + i * 36;
        // title under badge if space
        if (i < 4) {
          drawText(ctx, on ? def.title : '???', bx + 14, medalY + 54, {
            align: 'center',
            font: '9px Courier New, monospace',
            color: on ? '#c8d4b8' : '#4a5848',
          });
        }
      });
      drawText(
        ctx,
        `${unlocked.length}/${catalog.length} unlocked`,
        px + 28 + catalog.length * 36 + 8,
        medalY + 28,
        { font: '12px Courier New, monospace', color: '#8a9878' }
      );
    }

    drawText(ctx, 'Enter to play', w / 2, py + ph - 28, {
      align: 'center',
      color: '#ffe080',
    });
  }

  function drawModes(ctx, w, h) {
    const pw = Math.min(400, w * 0.8);
    const ph = 200;
    const px = (w - pw) / 2;
    const py = (h - ph) / 2;
    drawPanel(ctx, px, py, pw, ph);
    drawText(ctx, 'DONKEY DUEL', w / 2, py + 28, {
      align: 'center',
      font: 'bold 20px Courier New, monospace',
      color: '#a060c0',
    });
    const opts = ['VS AI', '2 PLAYERS'];
    opts.forEach((o, i) => {
      const sel = i === modeCursor;
      drawText(ctx, `${sel ? '▶ ' : '  '}${o}`, w / 2, py + 80 + i * 36, {
        align: 'center',
        font: sel ? 'bold 18px Courier New, monospace' : '16px Courier New, monospace',
        color: sel ? PALETTE.accent : PALETTE.text,
      });
    });
    drawText(ctx, 'Enter confirm · Esc back', w / 2, py + ph - 28, {
      align: 'center',
      color: '#6a7860',
    });
  }
}
