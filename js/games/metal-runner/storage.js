import {
  getHighScore as arcadeHigh,
  getLeaderboard as arcadeLb,
  addLeaderboardEntry as arcadeAdd,
  migrateMetalRunnerScores,
} from '../../shared/storage.js';

const GAME_ID = 'metal-runner';

migrateMetalRunnerScores();

export function getHighScore() {
  return arcadeHigh(GAME_ID);
}

export function setHighScore() {
  return false;
}

export function getLeaderboard() {
  return arcadeLb(GAME_ID);
}

/** @returns {{ entries: object[], rank: number, newHigh: boolean }} */
export function addLeaderboardEntry({ score, distance, kills, time }) {
  return arcadeAdd(GAME_ID, { score, distance, kills, time });
}
