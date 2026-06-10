import { crazyGames } from './crazygames';
import { yandex, type LeaderboardEntry } from './yandex';
import { hasInterstitialIntervalElapsed } from './game/interstitialSchedule';

export type PlatformKind = 'yandex' | 'crazygames';
export type RewardId = 'cardReroll' | 'runRewardDouble';

const REWARD_COOLDOWN_MS = 60_000;
const MIDGAME_AFTER_REWARD_BLOCK_MS = 60_000;
const REWARD_TIMES_KEY = 'asd_crazygames_reward_times_v1';
const FIRST_LAUNCH_KEY = 'asd_platform_launched_v1';
const LEGACY_CRAZYGAMES_FIRST_LAUNCH_KEY = 'asd_crazygames_launched_v1';
const META_SAVE_KEYS = ['asd_meta_v2', 'asd_meta_v1'] as const;

function readRewardTimes(): Partial<Record<RewardId, number>> {
  try {
    const raw = localStorage.getItem(REWARD_TIMES_KEY);
    return raw ? JSON.parse(raw) as Partial<Record<RewardId, number>> : {};
  } catch {
    return {};
  }
}

function writeRewardTimes(times: Partial<Record<RewardId, number>>): void {
  try {
    localStorage.setItem(REWARD_TIMES_KEY, JSON.stringify(times));
  } catch {
    // Storage can be unavailable in locked-down browser contexts.
  }
}

function latestRewardTime(): number {
  return Math.max(0, ...Object.values(readRewardTimes()).filter(
    (value): value is number => typeof value === 'number',
  ));
}

class PlatformService {
  readonly kind: PlatformKind =
    import.meta.env.MODE === 'crazygames' ? 'crazygames' : 'yandex';
  readonly englishOnly = this.kind === 'crazygames';
  readonly supportsLeaderboards = true;
  readonly supportsDailyLeaderboard = this.kind === 'yandex';
  readonly leaderboardEntriesArePersonal = this.kind === 'crazygames';
  readonly requiresPrivacyPolicy = this.kind === 'crazygames';

  private gameplayActive: boolean | null = null;
  private lastRewardAt = latestRewardTime();
  private lastInterstitialAt = 0;
  private firstLaunchPending: boolean | null = null;

  async init(): Promise<void> {
    if (this.kind === 'crazygames') {
      await crazyGames.init();
      return;
    }
    await yandex.init();
  }

  loadingReady(): void {
    if (this.kind === 'yandex') yandex.loadingReady();
  }

  gameplayStart(): void {
    if (this.gameplayActive === true) return;
    this.gameplayActive = true;
    if (this.kind === 'crazygames') crazyGames.gameplayStart();
    else yandex.gameplayStart();
  }

  gameplayStop(): void {
    if (this.gameplayActive === false) return;
    this.gameplayActive = false;
    if (this.kind === 'crazygames') crazyGames.gameplayStop();
    else yandex.gameplayStop();
  }

  async showRewarded(rewardId: RewardId): Promise<boolean> {
    if (this.getRewardCooldownRemaining(rewardId) > 0) return false;
    const completed = this.kind === 'crazygames'
      ? await crazyGames.showRewarded()
      : await yandex.showRewarded();
    if (!completed) return false;

    const now = Date.now();
    const times = readRewardTimes();
    times[rewardId] = now;
    writeRewardTimes(times);
    this.lastRewardAt = now;
    return true;
  }

  async showInterstitial(): Promise<boolean> {
    if (!this.canShowInterstitial()) return false;

    if (this.kind === 'crazygames') {
      const completed = await crazyGames.showInterstitial();
      if (completed) this.lastInterstitialAt = Date.now();
      return completed;
    }
    const completed = await yandex.showFullscreen();
    if (completed) this.lastInterstitialAt = Date.now();
    return completed;
  }

  canShowInterstitial(): boolean {
    const now = Date.now();
    if (!hasInterstitialIntervalElapsed(now, this.lastInterstitialAt)) return false;
    if (now - this.lastRewardAt < MIDGAME_AFTER_REWARD_BLOCK_MS) {
      return false;
    }
    return this.kind === 'crazygames'
      ? crazyGames.isReal()
      : yandex.isReal();
  }

  getRewardCooldownRemaining(rewardId: RewardId): number {
    const lastReward = readRewardTimes()[rewardId] ?? 0;
    return Math.max(0, REWARD_COOLDOWN_MS - (Date.now() - lastReward));
  }

  prepareFirstLaunch(): void {
    if (this.firstLaunchPending !== null) return;
    try {
      const alreadyLaunched =
        localStorage.getItem(FIRST_LAUNCH_KEY) === '1'
        || localStorage.getItem(LEGACY_CRAZYGAMES_FIRST_LAUNCH_KEY) === '1'
        || META_SAVE_KEYS.some((key) => localStorage.getItem(key) !== null);
      this.firstLaunchPending = !alreadyLaunched;
    } catch {
      this.firstLaunchPending = false;
    }
  }

  consumeFirstLaunch(): boolean {
    this.prepareFirstLaunch();
    const firstLaunch = this.firstLaunchPending === true;
    this.firstLaunchPending = false;
    try {
      localStorage.setItem(FIRST_LAUNCH_KEY, '1');
    } catch {
      // Storage can be unavailable; the current launch can still continue.
    }
    return firstLaunch;
  }

  getLang(): string | null {
    return this.kind === 'crazygames' ? crazyGames.getLang() : yandex.getLang();
  }

  isAuthorized(): boolean {
    return this.kind === 'crazygames'
      ? crazyGames.isAuthorized()
      : yandex.isAuthorized();
  }

  signIn(): Promise<boolean> {
    return this.kind === 'crazygames'
      ? crazyGames.signIn()
      : yandex.signIn();
  }

  onAuthChange(cb: () => void): () => void {
    return this.kind === 'crazygames'
      ? crazyGames.onAuthChange(cb)
      : yandex.onAuthChange(cb);
  }

  setLeaderboardScore(boardId: string, score: number): Promise<void> {
    return this.kind === 'crazygames'
      ? crazyGames.setLeaderboardScore(boardId, score)
      : yandex.setLeaderboardScore(boardId, score);
  }

  getTopPlayers(boardId: string, limit = 10): Promise<LeaderboardEntry[]> {
    return this.kind === 'crazygames'
      ? crazyGames.getTopPlayers(boardId, limit)
      : yandex.getTopPlayers(boardId, limit);
  }
}

export const platform = new PlatformService();
export type { LeaderboardEntry };
