import type { GameState } from './state';

// Keep the deployed technical ids stable. The first board is an all-time
// best despite its historical "endless" name.
export const ALL_TIME_WAVES_BOARD_ID = 'endlessWaves';
export const DAILY_WAVES_BOARD_ID = 'dailyWaves';
export const DAILY_BOARD_PREFIX = `${DAILY_WAVES_BOARD_ID}:`;
export const DAILY_SCORE_FACTOR = 1_000_000;

export function dailyBoardIdForDate(date: number): string {
  return `${DAILY_BOARD_PREFIX}${Math.floor(date)}`;
}

export function dailyDateFromBoardId(boardId: string): number | null {
  if (!boardId.startsWith(DAILY_BOARD_PREFIX)) return null;
  const date = Number(boardId.slice(DAILY_BOARD_PREFIX.length));
  return Number.isInteger(date) && date >= 10_000_000 && date <= 99_999_999
    ? date
    : null;
}

export function encodeDailyScore(date: number, score: number): number {
  const normalized = Math.min(
    DAILY_SCORE_FACTOR - 1,
    Math.max(0, Math.floor(score)),
  );
  return Math.floor(date) * DAILY_SCORE_FACTOR + normalized;
}

export function decodeDailyScore(score: number): { date: number; score: number } {
  return {
    date: Math.floor(score / DAILY_SCORE_FACTOR),
    score: Math.floor(score % DAILY_SCORE_FACTOR),
  };
}

/**
 * Wave reached in the current run. A defeat on wave N is recorded as N,
 * while `endlessLoop` already represents completed full cycles.
 */
export function leaderboardWaveNumber(
  endlessLoop: number,
  wavesPerLoop: number,
  currentWaveIndex: number,
  phase: GameState['phase'],
): number {
  const loops = Math.max(0, Math.floor(endlessLoop));
  const loopSize = Math.max(1, Math.floor(wavesPerLoop));
  const waveIndex = Math.floor(currentWaveIndex);
  const completedLoops = loops * loopSize;

  if (phase === 'endless_modifier_select') return completedLoops;
  return completedLoops + Math.max(0, waveIndex + 1);
}
