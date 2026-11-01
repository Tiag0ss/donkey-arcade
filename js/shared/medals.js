/** Human-readable medal catalog (id → display). */
export const MEDAL_DEFS = {
  first_play: { title: 'First Gallop', short: '1st', desc: 'Play a run' },

  survive_60s: { title: 'Minute Mile', short: '60s', desc: 'Survive 60 seconds' },
  kills_50: { title: 'Haymaker', short: '50K', desc: 'Get 50 kills' },
  distance_2k: { title: 'Long Haul', short: '2km', desc: 'Reach 2000m' },

  derby_1k: { title: 'Derby Champ', short: '1K', desc: 'Score 1000+' },
  derby_nitro_5: { title: 'Chili Burn', short: 'N5', desc: 'Use nitro 5 times' },
  derby_no_hit_500m: { title: 'Clean Hooves', short: 'CLN', desc: '500m with 0 hits' },

  bounce_100m: { title: 'Rooftop 100', short: '100', desc: 'Reach 100m height' },
  bounce_250m: { title: 'Sky Burro', short: '250', desc: 'Reach 250m height' },
  bounce_jet_10: { title: 'Jet Pack', short: 'J10', desc: 'Use jet 10 times' },

  kick_combo_10: { title: 'Combo Kick', short: 'C10', desc: 'Reach combo 10' },
  kick_fever_3: { title: 'Fever Pitch', short: 'F3', desc: 'Trigger fever 3 times' },
  kick_score_5k: { title: 'Kick Legend', short: '5K', desc: 'Score 5000+' },

  cart_1k: { title: 'Rail Runner', short: '1K', desc: 'Travel 1000m' },
  cart_no_crash_60s: { title: 'Steady Cart', short: '60s', desc: 'Survive 60s' },
  cart_gems_10: { title: 'Gem Miner', short: 'G10', desc: 'Collect 10 gems' },

  stack_20: { title: 'Hay Stacker', short: '20', desc: 'Stack 20 pieces' },
  stack_perfect_5: { title: 'Perfect Settle', short: 'P5', desc: '5 perfect stacks' },
  stack_roof: { title: 'Raise the Roof', short: 'ROOF', desc: 'Touch the roof' },

  heist_floor_3: { title: 'Deep Heist', short: 'F3', desc: 'Clear floor 3+' },
  heist_ghost: { title: 'Ghost Burro', short: 'GST', desc: 'Clear a floor with 0 strikes' },
  heist_distract_10: { title: 'Hee-Haw Pro', short: 'HH10', desc: 'Distract 10 times' },

  duel_beat_ai: { title: 'AI Tamer', short: 'AI', desc: 'Beat the AI' },
  duel_perfect_5: { title: 'Sweet Spot', short: 'P5', desc: 'Land 5 perfect kicks' },
  duel_streak_3: { title: 'Win Streak', short: 'W3', desc: '3 AI wins in a row' },
};

export const MEDALS_BY_GAME = {
  'metal-runner': ['first_play', 'survive_60s', 'kills_50', 'distance_2k'],
  derby: ['derby_1k', 'derby_nitro_5', 'derby_no_hit_500m'],
  bounce: ['bounce_100m', 'bounce_250m', 'bounce_jet_10'],
  kickfield: ['kick_combo_10', 'kick_fever_3', 'kick_score_5k'],
  minecart: ['cart_1k', 'cart_no_crash_60s', 'cart_gems_10'],
  stack: ['stack_20', 'stack_perfect_5', 'stack_roof'],
  heist: ['heist_floor_3', 'heist_ghost', 'heist_distract_10'],
  duel: ['duel_beat_ai', 'duel_perfect_5', 'duel_streak_3'],
};

export function getMedalDef(id) {
  return MEDAL_DEFS[id] || { title: id, short: '?', desc: id };
}

export function medalTitle(id) {
  return getMedalDef(id).title;
}

export function medalTitles(ids) {
  return (ids || []).map(medalTitle);
}
