import { createGame as createMetalRunner } from './metal-runner/index.js';
import { createGame as createDerby } from './derby/index.js';
import { createGame as createBounce } from './bounce/index.js';
import { createGame as createKickfield } from './kickfield/index.js';
import { createGame as createMinecart } from './minecart/index.js';
import { createGame as createStack } from './stack/index.js';
import { createGame as createHeist } from './heist/index.js';
import { createGame as createDuel } from './duel/index.js';

export const GAMES = [
  {
    id: 'metal-runner',
    title: 'METAL RUNNER',
    blurb: 'Run-and-gun endless war donkey',
    accent: '#c05040',
    create: createMetalRunner,
    controls: ['Space / ↑ / W jump', 'S / ↓ / Ctrl duck-drop', 'Z / J shoot', 'X / K grenade', 'Q / E or 1-6 guns'],
    tips: ['Distance unlocks weapons. Survive the speed tiers.'],
  },
  {
    id: 'derby',
    title: 'DONKEY DERBY',
    blurb: 'Top-down fairground lane race',
    accent: '#c9a227',
    create: createDerby,
    controls: ['A / D or ← / → change lane', 'Space nitro'],
    tips: ['Near-miss barriers for bonus points.'],
  },
  {
    id: 'bounce',
    title: 'BURRO BOUNCE',
    blurb: 'Climb forever — do not fall',
    accent: '#6a9ec8',
    create: createBounce,
    controls: ['A / D or ← / → move', 'Space jet kick'],
    tips: ['Land on any platform to refill jet. Space = rescue boost.'],
  },
  {
    id: 'kickfield',
    title: 'KICKFIELD',
    blurb: 'Timing kicks, combos, fever',
    accent: '#d08040',
    create: createKickfield,
    controls: ['W/S or ↑/↓ choose height', 'Space kick'],
    tips: ['Match height first, then Space on the line. Speed x1.25 every 30s.'],
  },
  {
    id: 'minecart',
    title: 'MINE CART BURRO',
    blurb: 'Two rails — dodge, jump, survive',
    accent: '#8a7060',
    create: createMinecart,
    controls: ['W/S or ↑/↓ change rail', 'Space jump'],
    tips: ['Rocks and gaps: jump. Low beams: switch rail. Speed rises every 10s.'],
  },
  {
    id: 'stack',
    title: 'STABLE STACK',
    blurb: 'Tetris + balance — clear lines, keep it steady',
    accent: '#b8a050',
    create: createStack,
    controls: ['←/→ move', '↑/E rotate', '↓ soft-drop', 'Space hard-drop', 'C hold'],
    tips: ['Stack near the center or the tower tips over. Clearing lines stabilizes. Speed ×1.1 / 10s.'],
  },
  {
    id: 'heist',
    title: 'HEE-HAW HEIST',
    blurb: 'Steal carrots. Avoid flashlight cones',
    accent: '#5a8a5a',
    create: createHeist,
    controls: ['WASD / arrows move', 'Shift sneak', 'Space hee-haw'],
    tips: ['Sneak past cones. Extract only with quota.'],
  },
  {
    id: 'duel',
    title: 'DONKEY DUEL',
    blurb: 'Charge-kick best of five',
    accent: '#c07840',
    create: createDuel,
    supports2P: true,
    controls: [
      'P1: A/D or ←/→ move · W/↑ jump · S/↓ block · Space hold & release',
      'P2: J/L move · I jump · K block · Enter hold & release',
    ],
    tips: ['Release in the gold zone for a Perfect. Overcharge hurts you.'],
  },
];

export function getGame(id) {
  return GAMES.find((g) => g.id === id);
}
