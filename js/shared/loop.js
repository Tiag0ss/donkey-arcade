export function createLoop(onFrame) {
  let last = performance.now();
  let raf = 0;
  let running = false;

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    onFrame(dt);
    raf = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
