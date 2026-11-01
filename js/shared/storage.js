const SETTINGS_KEY = 'donkey-arcade:settings';
const META_KEY = 'donkey-arcade:meta';
const LB_MAX = 10;

const STAR_THRESHOLDS = {
  'metal-runner': [500, 2000, 5000],
  derby: [400, 1500, 4000],
  bounce: [500, 1500, 4000],
  kickfield: [800, 3000, 8000],
  minecart: [400, 1500, 4000],
  stack: [500, 2000, 5000],
  heist: [600, 2500, 6000],
  duel: [1000, 3000, 6000],
};

function lbKey(gameId) {
  return `donkey-arcade:lb:${gameId}`;
}

function medalKey(gameId) {
  return `donkey-arcade:medals:${gameId}`;
}

export function getSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const s = raw ? JSON.parse(raw) : {};
    return { muted: !!s.muted };
  } catch {
    return { muted: false };
  }
}

export function setSettings(partial) {
  const next = { ...getSettings(), ...partial };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

export function getMeta() {
  try {
    const raw = localStorage.getItem(META_KEY);
    const m = raw ? JSON.parse(raw) : {};
    return {
      starsTotal: Number(m.starsTotal) || 0,
      gamesPlayed: Number(m.gamesPlayed) || 0,
      firstVisitDone: !!m.firstVisitDone,
      duelStreak: Number(m.duelStreak) || 0,
    };
  } catch {
    return { starsTotal: 0, gamesPlayed: 0, firstVisitDone: false, duelStreak: 0 };
  }
}

export function setMeta(partial) {
  const next = { ...getMeta(), ...partial };
  localStorage.setItem(META_KEY, JSON.stringify(next));
  return next;
}

export function getLeaderboard(gameId) {
  try {
    const raw = localStorage.getItem(lbKey(gameId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function getHighScore(gameId) {
  const list = getLeaderboard(gameId);
  return list.length ? list[0].score : 0;
}

/** Migrate old Metal Runner keys once into arcade LB. */
export function migrateMetalRunnerScores() {
  const existing = getLeaderboard('metal-runner');
  if (existing.length) return existing;
  try {
    const raw = localStorage.getItem('metal-runner-leaderboard');
    const old = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(old) || !old.length) return [];
    const mapped = old.map((e) => ({
      score: Math.floor(e.score || 0),
      distance: Math.floor(e.distance || 0),
      kills: Math.floor(e.kills || 0),
      time: Math.floor(e.time || 0),
      at: e.at || Date.now(),
    }));
    mapped.sort((a, b) => b.score - a.score || b.distance - a.distance);
    const trimmed = mapped.slice(0, LB_MAX);
    localStorage.setItem(lbKey('metal-runner'), JSON.stringify(trimmed));
    return trimmed;
  } catch {
    return [];
  }
}

export function addLeaderboardEntry(gameId, data) {
  const entry = {
    score: Math.floor(data.score || 0),
    time: Math.max(0, Math.floor(data.time || 0)),
    at: Date.now(),
    ...Object.fromEntries(
      Object.entries(data).filter(([k]) => !['score', 'time'].includes(k))
    ),
  };
  entry.score = Math.floor(data.score || 0);
  entry.time = Math.max(0, Math.floor(data.time || 0));
  entry.at = Date.now();

  const list = getLeaderboard(gameId);
  list.push(entry);
  list.sort((a, b) => b.score - a.score || (b.distance || 0) - (a.distance || 0));
  const trimmed = list.slice(0, LB_MAX);
  localStorage.setItem(lbKey(gameId), JSON.stringify(trimmed));

  const prevBest = trimmed[0]?.score === entry.score && trimmed[0]?.at === entry.at;
  const rank = trimmed.findIndex((e) => e.at === entry.at && e.score === entry.score);
  const newHigh = prevBest && (trimmed.length === 1 || entry.score >= (trimmed[1]?.score || 0));

  bumpStars(gameId, entry.score);
  const meta = getMeta();
  setMeta({ gamesPlayed: meta.gamesPlayed + 1 });

  return {
    entries: trimmed,
    rank: rank >= 0 ? rank + 1 : 0,
    newHigh: rank === 0,
  };
}

export function getMedals(gameId) {
  try {
    const raw = localStorage.getItem(medalKey(gameId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function unlockMedals(gameId, ids) {
  const cur = new Set(getMedals(gameId));
  const earned = [];
  for (const id of ids) {
    if (!cur.has(id)) {
      cur.add(id);
      earned.push(id);
    }
  }
  localStorage.setItem(medalKey(gameId), JSON.stringify([...cur]));
  return earned;
}

export function starsForScore(gameId, score) {
  const t = STAR_THRESHOLDS[gameId] || [500, 2000, 5000];
  let s = 0;
  for (const thr of t) if (score >= thr) s++;
  return s;
}

export function getGameStars(gameId) {
  return starsForScore(gameId, getHighScore(gameId));
}

function bumpStars(gameId, score) {
  const allIds = Object.keys(STAR_THRESHOLDS);
  let total = 0;
  for (const id of allIds) {
    const sc = id === gameId ? Math.max(getHighScore(gameId), score) : getHighScore(id);
    total += starsForScore(id, sc);
  }
  setMeta({ starsTotal: total });
}

export function recomputeStarsTotal() {
  let total = 0;
  for (const id of Object.keys(STAR_THRESHOLDS)) {
    total += getGameStars(id);
  }
  setMeta({ starsTotal: total });
  return total;
}

export { STAR_THRESHOLDS, LB_MAX };
