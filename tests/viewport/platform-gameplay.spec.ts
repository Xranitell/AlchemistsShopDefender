import { expect, test } from '@playwright/test';
import { shouldReportGameplayActive } from '../../src/game/platformGameplay';

const ACTIVE_WAVE = {
  phase: 'wave' as const,
  userPaused: false,
  tutorialVisible: false,
  revivePaused: false,
  transitionPending: false,
};

test('reports gameplay only for an uninterrupted active wave', () => {
  expect(shouldReportGameplayActive(ACTIVE_WAVE)).toBe(true);
  expect(shouldReportGameplayActive({
    ...ACTIVE_WAVE,
    phase: 'preparing',
  })).toBe(false);
});

test('does not report gameplay while a level restart is pending', () => {
  expect(shouldReportGameplayActive({
    ...ACTIVE_WAVE,
    transitionPending: true,
  })).toBe(false);
});
