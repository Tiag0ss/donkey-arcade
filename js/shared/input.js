export function createInput() {
  const down = new Set();
  const pressed = new Set();
  const released = new Set();

  function normalize(e) {
    const k = e.key;
    if (k === ' ') return 'Space';
    if (k.length === 1) return k.toLowerCase();
    return k;
  }

  function onDown(e) {
    const k = normalize(e);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k) || e.code === 'Space') {
      e.preventDefault();
    }
    const key = e.code === 'Space' ? 'Space' : k;
    if (!down.has(key)) pressed.add(key);
    down.add(key);
  }

  function onUp(e) {
    const k = e.code === 'Space' ? 'Space' : normalize(e);
    if (down.has(k)) released.add(k);
    down.delete(k);
  }

  window.addEventListener('keydown', onDown, true);
  window.addEventListener('keyup', onUp, true);

  return {
    down: (k) => down.has(k),
    pressed: (k) => pressed.has(k),
    released: (k) => released.has(k),
    anyPressed: (...keys) => keys.some((k) => pressed.has(k)),
    anyDown: (...keys) => keys.some((k) => down.has(k)),
    endFrame() {
      pressed.clear();
      released.clear();
    },
    destroy() {
      window.removeEventListener('keydown', onDown, true);
      window.removeEventListener('keyup', onUp, true);
      down.clear();
      pressed.clear();
      released.clear();
    },
    // P1 helpers — WASD + arrows
    p1Left: () => down.has('a') || down.has('ArrowLeft'),
    p1Right: () => down.has('d') || down.has('ArrowRight'),
    p1Up: () => down.has('w') || down.has('ArrowUp'),
    p1Down: () => down.has('s') || down.has('ArrowDown'),
    p1JumpPressed: () => pressed.has('w') || pressed.has('ArrowUp') || pressed.has('Space'),
    /** Jump without Space (Space is fire/charge in some games). */
    p1JumpArrowPressed: () => pressed.has('w') || pressed.has('ArrowUp'),
    p1Fire: () => down.has('Space'),
    p1FirePressed: () => pressed.has('Space'),
    p1FireReleased: () => released.has('Space'),
    p1Block: () => down.has('s') || down.has('ArrowDown'),
    p1Sneak: () => down.has('Shift'),
    // P2 helpers — IJKL + Enter only (arrows reserved for P1)
    p2Left: () => down.has('j'),
    p2Right: () => down.has('l'),
    p2Up: () => down.has('i'),
    p2Down: () => down.has('k'),
    p2JumpPressed: () => pressed.has('i'),
    p2Fire: () => down.has('Enter'),
    p2FirePressed: () => pressed.has('Enter'),
    p2FireReleased: () => released.has('Enter'),
    p2Block: () => down.has('k'),
  };
}
