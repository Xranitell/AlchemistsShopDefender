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
}

class YandexGames {
  private sdk: YGameSdk | null = null;
  private ready = false;

  async init(): Promise<void> {
    if (typeof window === 'undefined' || !window.YaGames) {
      // Stubbed: not running inside Yandex Games iframe.
      return;
    }
    try {
      this.sdk = await window.YaGames.init();
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
}

export const yandex = new YandexGames();
