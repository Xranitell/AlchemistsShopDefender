// Thin wrapper around the Yandex Games SDK so the rest of the game does not
// need to know whether the SDK is actually loaded.
//
// Documentation: https://yandex.ru/dev/games/doc/dg/sdk/sdk-about.html
//
// In non-Yandex environments (local dev, CrazyGames, plain web) all calls are
// stubbed to no-ops so we can develop and run the game offline.

declare global {
  interface Window {
    YaGames?: {
      init(): Promise<YGameSdk>;
    };
  }
}

interface YaLeaderboards {
  setLeaderboardScore(boardName: string, score: number): Promise<void>;
  getLeaderboardEntries(
    boardName: string,
    opts?: { quantityTop?: number; quantityAround?: number },
  ): Promise<{
    entries: {
      rank: number;
      score: number;
      player: { publicName: string; scopePermissions?: { avatar?: string }; getAvatarSrc?(size: string): string };
    }[];
  }>;
}

interface YGameSdk {
  features?: {
    LoadingAPI?: {
      ready(): void;
    };
    GameplayAPI?: {
      start(): void;
      stop(): void;
    };
  };
  adv?: {
    showFullscreenAdv(opts: {
      callbacks?: {
        onClose?(wasShown: boolean): void;
        onError?(err: unknown): void;
        onOffline?(): void;
      };
    }): void;
    showRewardedVideo(opts: {
      callbacks?: {
        onOpen?(): void;
        onRewarded?(): void;
        onClose?(): void;
        onError?(err: unknown): void;
      };
    }): void;
  };
  getPlayer?(opts?: { scopes?: boolean }): Promise<unknown>;
  getLeaderboards?(): Promise<YaLeaderboards>;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  score: number;
  avatarUrl: string;
}

// localStorage-based mock for leaderboards during local development.
const MOCK_KEY_PREFIX = 'asd_lb_';

function mockGetBoard(boardId: string): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(MOCK_KEY_PREFIX + boardId);
    if (!raw) return [];
    return JSON.parse(raw) as LeaderboardEntry[];
  } catch { return []; }
}

function mockSetScore(boardId: string, score: number): void {
  const board = mockGetBoard(boardId);
  const existing = board.find((e) => e.name === 'Вы');
  if (existing) {
    if (score > existing.score) existing.score = score;
  } else {
    board.push({ rank: 0, name: 'Вы', score, avatarUrl: '' });
  }
  board.sort((a, b) => b.score - a.score);
  board.forEach((e, i) => { e.rank = i + 1; });
  try {
    localStorage.setItem(MOCK_KEY_PREFIX + boardId, JSON.stringify(board.slice(0, 20)));
  } catch { /* noop */ }
}

class YandexGames {
  private sdk: YGameSdk | null = null;
  private lb: YaLeaderboards | null = null;
  private ready = false;

  async init(): Promise<void> {
    if (typeof window === 'undefined' || !window.YaGames) {
      // Stubbed: not running inside Yandex Games iframe.
      return;
    }
    try {
      this.sdk = await window.YaGames.init();
      if (this.sdk.getLeaderboards) {
        this.lb = await this.sdk.getLeaderboards();
      }
    } catch (err) {
      console.warn('[YandexGames] init failed, running in stub mode', err);
    }
  }

  /** Tell the platform that game assets have loaded. Hides the Yandex spinner. */
  loadingReady(): void {
    if (this.ready) return;
    this.ready = true;
    this.sdk?.features?.LoadingAPI?.ready();
  }

  /** Notify Yandex that gameplay has started (used for ad pacing). */
  gameplayStart(): void {
    this.sdk?.features?.GameplayAPI?.start();
  }

  /** Notify Yandex that gameplay has paused/ended. */
  gameplayStop(): void {
    this.sdk?.features?.GameplayAPI?.stop();
  }

  /** Show a rewarded video. Resolves true if the user actually got the reward. */
  showRewarded(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.sdk?.adv) {
        resolve(false);
        return;
      }
      let rewarded = false;
      this.sdk.adv.showRewardedVideo({
        callbacks: {
          onRewarded: () => { rewarded = true; },
          onClose: () => resolve(rewarded),
          onError: () => resolve(false),
        },
      });
    });
  }

  isReal(): boolean {
    return this.sdk !== null;
  }

  /** Submit a score to a leaderboard. Falls back to localStorage mock. */
  async setLeaderboardScore(boardId: string, score: number): Promise<void> {
    if (this.lb) {
      try {
        await this.lb.setLeaderboardScore(boardId, score);
      } catch (err) {
        console.warn('[YandexGames] setLeaderboardScore failed', err);
      }
    } else {
      mockSetScore(boardId, score);
    }
  }

  /** Get top players for a leaderboard. Falls back to localStorage mock. */
  async getTopPlayers(boardId: string, limit = 10): Promise<LeaderboardEntry[]> {
    if (this.lb) {
      try {
        const res = await this.lb.getLeaderboardEntries(boardId, {
          quantityTop: limit,
          quantityAround: 0,
        });
        return res.entries.map((e) => ({
          rank: e.rank,
          name: e.player.publicName || '???',
          score: e.score,
          avatarUrl: e.player.getAvatarSrc?.('small') ?? '',
        }));
      } catch (err) {
        console.warn('[YandexGames] getTopPlayers failed', err);
        return [];
      }
    }
    return mockGetBoard(boardId).slice(0, limit);
  }
}

export const yandex = new YandexGames();
