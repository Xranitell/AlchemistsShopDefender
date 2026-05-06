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

/** Subset of the player object the SDK returns from getPlayer().
 *  `getMode()` returns the string `'lite'` for anonymous (un-signed-in)
 *  players — the leaderboard API rejects writes from those players. */
interface YaPlayer {
  getMode?(): string;
  getUniqueID?(): string;
}

interface YaAuth {
  openAuthDialog(): Promise<void>;
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
  auth?: YaAuth;
  getPlayer?(opts?: { scopes?: boolean }): Promise<YaPlayer>;
  getLeaderboards?(): Promise<YaLeaderboards>;
  /** Player environment — the Yandex SDK exposes the user's preferred
   *  interface language here. We forward this to our i18n engine so the
   *  Yandex console stops flagging "i18n не используется" and players
   *  who switch their Yandex profile language see the game follow. */
  environment?: {
    i18n?: {
      lang?: string;
    };
    app?: { id?: string };
    browser?: { lang?: string };
  };
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
  private player: YaPlayer | null = null;
  private ready = false;
  /** Listeners notified when the player auth state changes (init / sign-in). */
  private authListeners: Array<() => void> = [];

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
      // Probe the player so we know whether leaderboard writes will be
      // accepted. Yandex rejects setLeaderboardScore from `'lite'`
      // (anonymous) players, so we surface auth state to the UI.
      await this.refreshPlayer();
    } catch (err) {
      console.warn('[YandexGames] init failed, running in stub mode', err);
    }
  }

  private async refreshPlayer(): Promise<void> {
    if (!this.sdk?.getPlayer) return;
    try {
      this.player = await this.sdk.getPlayer({ scopes: false });
    } catch (err) {
      console.warn('[YandexGames] getPlayer failed', err);
      this.player = null;
    }
    for (const cb of this.authListeners) cb();
  }

  /** Subscribe to player auth-state changes. The callback fires after
   *  `init()` resolves and again whenever `signIn()` succeeds. */
  onAuthChange(cb: () => void): () => void {
    this.authListeners.push(cb);
    return () => {
      const i = this.authListeners.indexOf(cb);
      if (i >= 0) this.authListeners.splice(i, 1);
    };
  }

  /** True when the SDK reports the player is authorised to write to
   *  leaderboards (i.e. signed into a Yandex account, not in `'lite'`
   *  guest mode). On non-Yandex hosts (local dev) we return true so
   *  the mock leaderboard works without a sign-in flow. */
  isAuthorized(): boolean {
    if (!this.sdk) return true; // local / non-Yandex: mock board accepts writes
    const mode = this.player?.getMode?.();
    return mode !== undefined && mode !== 'lite';
  }

  /** Open the Yandex auth dialog to upgrade a `'lite'` guest into a
   *  signed-in account. Resolves true when the player is authorised
   *  after the dialog closes. Bound to a UI button (Leaderboard panel)
   *  so we never trigger it without a user gesture. */
  async signIn(): Promise<boolean> {
    if (!this.sdk?.auth) return this.isAuthorized();
    try {
      await this.sdk.auth.openAuthDialog();
    } catch (err) {
      console.warn('[YandexGames] auth dialog failed', err);
      return this.isAuthorized();
    }
    await this.refreshPlayer();
    // Re-fetch the leaderboards handle — Yandex docs note that the
    // leaderboards object is bound to the player session at call time.
    if (this.sdk.getLeaderboards) {
      try {
        this.lb = await this.sdk.getLeaderboards();
      } catch { /* keep previous handle */ }
    }
    return this.isAuthorized();
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

  /** Returns the user's preferred interface language as reported by the
   *  Yandex Games SDK ("ru", "en", "tr", ...). When the SDK is not
   *  available (local dev / non-Yandex hosts) we fall back to the browser
   *  language. The Yandex publishing console uses this call to verify
   *  that a game actually integrates with their localization API. */
  getLang(): string | null {
    const sdkLang = this.sdk?.environment?.i18n?.lang;
    if (typeof sdkLang === 'string' && sdkLang.length > 0) return sdkLang;
    const browserLang = this.sdk?.environment?.browser?.lang;
    if (typeof browserLang === 'string' && browserLang.length > 0) return browserLang;
    if (typeof navigator !== 'undefined' && typeof navigator.language === 'string') {
      return navigator.language;
    }
    return null;
  }

  /** Submit a score to a leaderboard. Falls back to localStorage mock.
   *  Skips the SDK call when the player is in `'lite'` (anonymous)
   *  mode — Yandex throws on those, and a noisy console warn after
   *  every cleared wave isn't useful when the fix is "sign in" rather
   *  than "retry". The Leaderboard panel surfaces a sign-in button
   *  so the player can fix the auth state explicitly. */
  async setLeaderboardScore(boardId: string, score: number): Promise<void> {
    if (this.lb) {
      if (!this.isAuthorized()) {
        console.info('[YandexGames] skipping leaderboard write — player not signed in (lite mode)');
        return;
      }
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
