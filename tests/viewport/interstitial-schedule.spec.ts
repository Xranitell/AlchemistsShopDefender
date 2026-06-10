import { expect, test } from '@playwright/test';
import {
  cumulativeWaveNumber,
  hasInterstitialIntervalElapsed,
  isScheduledInterstitialWave,
  shouldUseInterstitialCountdown,
} from '../../src/game/interstitialSchedule';

test('keeps the countdown for Yandex and skips it for CrazyGames', () => {
  expect(shouldUseInterstitialCountdown('yandex')).toBe(true);
  expect(shouldUseInterstitialCountdown('crazygames')).toBe(false);
});

test('schedules an interstitial after every third completed wave', () => {
  expect(isScheduledInterstitialWave(1)).toBe(false);
  expect(isScheduledInterstitialWave(2)).toBe(false);
  expect(isScheduledInterstitialWave(3)).toBe(true);
  expect(isScheduledInterstitialWave(6)).toBe(true);
});

test('continues the schedule across endless-mode loops', () => {
  const completedWave = cumulativeWaveNumber(1, 15, 2);

  expect(completedWave).toBe(18);
  expect(isScheduledInterstitialWave(completedWave)).toBe(true);
});

test('requires ninety seconds between interstitials', () => {
  expect(hasInterstitialIntervalElapsed(89_999, 0)).toBe(false);
  expect(hasInterstitialIntervalElapsed(90_000, 0)).toBe(true);
});
