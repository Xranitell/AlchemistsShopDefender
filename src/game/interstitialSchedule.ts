export const INTERSTITIAL_WAVE_INTERVAL = 3;
export const INTERSTITIAL_MIN_INTERVAL_MS = 90_000;

export function shouldUseInterstitialCountdown(
  platformKind: 'yandex' | 'crazygames',
): boolean {
  return platformKind === 'yandex';
}

export function cumulativeWaveNumber(
  endlessLoop: number,
  wavesPerLoop: number,
  currentWaveIndex: number,
): number {
  const loop = Math.max(0, Math.floor(endlessLoop));
  const loopSize = Math.max(1, Math.floor(wavesPerLoop));
  const waveIndex = Math.max(0, Math.floor(currentWaveIndex));
  return loop * loopSize + waveIndex + 1;
}

export function isScheduledInterstitialWave(completedWave: number): boolean {
  return Number.isInteger(completedWave)
    && completedWave > 0
    && completedWave % INTERSTITIAL_WAVE_INTERVAL === 0;
}

export function hasInterstitialIntervalElapsed(
  now: number,
  lastInterstitialAt: number,
): boolean {
  return now - lastInterstitialAt >= INTERSTITIAL_MIN_INTERVAL_MS;
}
