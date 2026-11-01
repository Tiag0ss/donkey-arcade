import {
  drawPauseOverlay,
  drawConfirmBack,
  drawGameOver,
  drawCountdown,
} from './ui.js';
import * as audio from './audio.js';
import { addLeaderboardEntry, unlockMedals } from './storage.js';

/**
 * Wrap a gameplay controller with shared pause / esc / countdown / gameover.
 * controller: { reset(), updatePlay(dt), drawPlay(ctx), getMedalChecks(result) }
 */
export function createShellGame(def, api, controller) {
  let phase = 'countdown'; // countdown | play | paused | confirmBack | gameover
  let countdown = 3;
  let result = null;
  let goPayload = null;
  let lastMode = 'play';
  let finishing = false;
  const listeners = [];

  function emit(ev, data) {
    for (const cb of listeners) cb(ev, data);
  }

  function begin(mode) {
    lastMode = mode || 'play';
    phase = 'countdown';
    countdown = 3;
    result = null;
    goPayload = null;
    finishing = false;
    controller.reset(lastMode);
    audio.countdown();
  }

  function finish(raw) {
    if (finishing || phase === 'gameover') return;
    finishing = true;
    result = raw;
    const medals = unlockMedals(def.id, controller.getMedalChecks?.(raw) || []);
    let rank = 0;
    let newHigh = false;
    if (raw.submitScore !== false) {
      const lb = addLeaderboardEntry(def.id, {
        score: raw.score,
        time: raw.time,
        ...raw.extra,
      });
      rank = lb.rank;
      newHigh = lb.newHigh;
      if (newHigh) audio.medal();
    }
    if (medals.length) audio.medal();
    goPayload = {
      title: raw.title || 'GAME OVER',
      score: raw.score,
      stats: raw.stats || [],
      rank: raw.submitScore === false ? 0 : rank,
      newHigh,
      medals,
    };
    phase = 'gameover';
    emit('gameover', goPayload);
  }

  return {
    id: def.id,
    meta: def,
    onEvent(cb) {
      listeners.push(cb);
    },
    start(mode) {
      begin(mode);
    },
    pause() {
      if (phase === 'play') phase = 'paused';
    },
    resume() {
      if (phase === 'paused') phase = 'play';
    },
    destroy() {},
    getResult() {
      return result;
    },
    endWith(raw) {
      finish(raw);
    },
    update(dt) {
      const input = api.input;

      if (input.pressed('m')) {
        const muted = audio.toggleMute();
        api.storage?.setSettings?.({ muted });
      }

      if (phase === 'confirmBack') {
        if (input.pressed('Enter')) {
          emit('back');
          return;
        }
        if (input.pressed('Escape')) {
          phase = 'play';
        }
        return;
      }

      if (phase === 'gameover') {
        if (input.pressed('Enter')) begin(lastMode);
        if (input.pressed('Escape')) emit('back');
        return;
      }

      if (input.pressed('Escape')) {
        if (phase === 'paused') {
          emit('back');
          return;
        }
        if (phase === 'play' || phase === 'countdown') {
          phase = 'confirmBack';
          return;
        }
      }

      if (input.pressed('p')) {
        if (phase === 'play') phase = 'paused';
        else if (phase === 'paused') phase = 'play';
      }

      if (phase === 'paused' || phase === 'confirmBack') return;

      if (phase === 'countdown') {
        const prev = Math.ceil(countdown);
        countdown -= dt;
        const cur = Math.ceil(countdown);
        if (cur !== prev && cur > 0) audio.countdown();
        if (countdown <= 0) {
          phase = 'play';
          audio.go();
        }
        return;
      }

      if (phase === 'play') {
        const ended = controller.updatePlay(dt, (raw) => finish(raw));
        if (ended && typeof ended === 'object') finish(ended);
      }
    },
    draw(ctx) {
      const w = api.canvas.width;
      const h = api.canvas.height;
      controller.drawPlay(ctx, w, h, phase);
      // overlays always in screen space (games may leave transforms)
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (phase === 'countdown') drawCountdown(ctx, w, h, countdown);
      if (phase === 'paused') drawPauseOverlay(ctx, w, h);
      if (phase === 'confirmBack') drawConfirmBack(ctx, w, h);
      if (phase === 'gameover' && goPayload) drawGameOver(ctx, w, h, goPayload);
    },
  };
}
