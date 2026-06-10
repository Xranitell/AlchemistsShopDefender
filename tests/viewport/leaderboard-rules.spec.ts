import { expect, test } from '@playwright/test';
import {
  DAILY_SCORE_FACTOR,
  leaderboardWaveNumber,
  dailyBoardIdForDate,
  dailyDateFromBoardId,
  decodeDailyScore,
  encodeDailyScore,
} from '../../src/game/leaderboardRules';

test('records the wave reached in a single run, including the failed wave', () => {
  expect(leaderboardWaveNumber(0, 15, -1, 'preparing')).toBe(0);
  expect(leaderboardWaveNumber(0, 15, 0, 'card_select')).toBe(1);
  expect(leaderboardWaveNumber(0, 15, 4, 'gameover')).toBe(5);
  expect(leaderboardWaveNumber(0, 15, 14, 'victory')).toBe(15);
});

test('continues single-run wave scoring across endless loops', () => {
  expect(leaderboardWaveNumber(1, 15, 0, 'endless_modifier_select')).toBe(15);
  expect(leaderboardWaveNumber(1, 15, 0, 'wave')).toBe(16);
  expect(leaderboardWaveNumber(1, 15, 0, 'gameover')).toBe(16);
});

test('encodes a dated daily score without mixing days', () => {
  const boardId = dailyBoardIdForDate(20260610);
  const encoded = encodeDailyScore(20260610, 37);

  expect(boardId).toBe('dailyWaves:20260610');
  expect(dailyDateFromBoardId(boardId)).toBe(20260610);
  expect(decodeDailyScore(encoded)).toEqual({ date: 20260610, score: 37 });
  expect(encodeDailyScore(20260610, DAILY_SCORE_FACTOR + 5))
    .toBe(20260611 * DAILY_SCORE_FACTOR - 1);
});
