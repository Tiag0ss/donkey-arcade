import { Game } from './game.js';
import { createShellGame } from '../../shared/gameShell.js';
import { formatTime } from '../../shared/ui.js';

const DEF = {
  id: 'metal-runner',
  title: 'METAL RUNNER',
};

const TRACK = [
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'w',
  'a',
  's',
  'd',
  'z',
  'x',
  'j',
  'k',
  'q',
  'e',
  'Tab',
  'Control',
  'c',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
];

export function createGame(canvas, api) {
  const game = new Game(canvas, { hubMode: true, skipBind: true });
  let ended = false;

  function fit() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    game.resize(window.innerWidth, window.innerHeight, dpr);
  }

  return createShellGame(DEF, api, {
    reset() {
      ended = false;
      fit();
      game.startRun();
    },
    updatePlay(dt, endFn) {
      if (ended) return;
      fit();
      const held = new Set();
      const just = [];
      for (const k of TRACK) {
        if (api.input.down(k)) held.add(k);
        if (api.input.pressed(k)) just.push(k);
      }
      game.syncExternalKeys(held, just);
      game.update(dt);

      if (game.state === 'gameover' && game.gameOverPayload && !ended) {
        ended = true;
        const p = game.gameOverPayload;
        endFn({
          score: p.score,
          time: p.time,
          stats: [
            `DISTANCE ${p.distance}`,
            `KILLS ${p.kills}`,
            `TIME ${formatTime(p.time)}`,
          ],
          extra: {
            distance: p.distance,
            kills: p.kills,
          },
        });
      }
    },
    drawPlay(ctx) {
      game.ctx = ctx;
      game.draw();
    },
    getMedalChecks(result) {
      const medals = ['first_play'];
      if ((result.time || 0) >= 60) medals.push('survive_60s');
      if ((result.extra?.kills || 0) >= 50) medals.push('kills_50');
      if ((result.extra?.distance || 0) >= 2000) medals.push('distance_2k');
      return medals;
    },
  });
}
