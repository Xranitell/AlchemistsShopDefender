import { audio } from './audio/audio';
import type { LeaderboardEntry } from './yandex';
import { ALL_TIME_WAVES_BOARD_ID } from './game/leaderboardRules';

declare global {
  interface Window {
    CrazyGames?: {
      SDK: CrazyGamesSdk;
    };
  }
}

interface CrazyGamesSdk {
  init(): Promise<void>;
  environment: 'local' | 'crazygames' | 'disabled';
  ad: {
    requestAd(
      type: 'midgame' | 'rewarded',
      callbacks: {
        adStarted(): void;
        adFinished(): void;
        adError(error: unknown): void;
      },
    ): void;
  };
  game: {
    gameplayStart(): void;
    gameplayStop(): void;
    settings?: {
      muteAudio?: boolean;
    };
    addSettingsChangeListener?(
      listener: (settings: { muteAudio?: boolean }) => void,
    ): void;
  };
  user: {
    readonly isUserAccountAvailable: boolean;
    getUser(): Promise<CrazyGamesUser | null>;
    showAuthPrompt(): Promise<CrazyGamesUser>;
    addAuthListener(listener: (user: CrazyGamesUser) => void): void;
    removeAuthListener(listener: (user: CrazyGamesUser) => void): void;
    submitScore(payload: { encryptedScore: string; score: number }): void;
  };
}

interface CrazyGamesUser {
  __dangerousUserId: string;
  username: string;
  profilePictureUrl: string;
}

interface StoredWeeklyLeaderboardBest {
  seasonStart: number;
  score: number;
}

const LEADERBOARD_KEY = import.meta.env.VITE_CRAZYGAMES_LEADERBOARD_KEY ?? '';
const LEADERBOARD_BEST_KEY = 'asd_crazygames_leaderboard_best_v1';
const PERSONAL_BOARD_PREFIX = 'asd_crazygames_personal_board_v1:';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

class CrazyGamesPlatform {
  private sdk: CrazyGamesSdk | null = null;
  private initialized = false;
  private user: CrazyGamesUser | null = null;
  private userAccountAvailable = false;
  private authListeners: Array<() => void> = [];
  private leaderboardSeasonStart = currentLeaderboardSeasonStart();
  private highestScheduledScore = this.readCurrentSeasonBest();
  private sdkAuthListener: ((user: CrazyGamesUser) => void) | null = null;

  async init(): Promise<void> {
    const sdk = window.CrazyGames?.SDK;
    if (!sdk) return;
    try {
      await sdk.init();
      this.sdk = sdk;
      this.initialized = sdk.environment !== 'disabled';
      this.applySettings(sdk.game.settings);
      sdk.game.addSettingsChangeListener?.((settings) => this.applySettings(settings));
      this.userAccountAvailable = sdk.user.isUserAccountAvailable;
      if (this.userAccountAvailable) {
        this.user = await sdk.user.getUser();
        this.sdkAuthListener = (user) => {
          this.user = user;
          this.notifyAuthListeners();
        };
        sdk.user.addAuthListener(this.sdkAuthListener);
      }
      this.notifyAuthListeners();
    } catch (err) {
      console.warn('[CrazyGames] init failed, running without SDK', err);
    }
  }

  gameplayStart(): void {
    if (!this.initialized) return;
    this.sdk?.game.gameplayStart();
  }

  gameplayStop(): void {
    if (!this.initialized) return;
    this.sdk?.game.gameplayStop();
  }

  showRewarded(): Promise<boolean> {
    return this.requestAd('rewarded');
  }

  showInterstitial(): Promise<boolean> {
    return this.requestAd('midgame');
  }

  isReal(): boolean {
    return this.initialized && this.sdk?.environment === 'crazygames';
  }

  getLang(): string {
    return 'en';
  }

  isAuthorized(): boolean {
    return this.user !== null;
  }

  async signIn(): Promise<boolean> {
    const sdk = this.sdk;
    if (!this.initialized || !sdk || !this.userAccountAvailable) return false;
    if (this.user) return true;
    try {
      this.user = await sdk.user.showAuthPrompt();
      this.notifyAuthListeners();
      return this.user !== null;
    } catch {
      return false;
    }
  }

  onAuthChange(cb: () => void): () => void {
    this.authListeners.push(cb);
    return () => {
      const index = this.authListeners.indexOf(cb);
      if (index >= 0) this.authListeners.splice(index, 1);
    };
  }

  async setLeaderboardScore(boardId: string, score: number): Promise<void> {
    const normalizedScore = Math.floor(score);
    if (!Number.isFinite(normalizedScore) || normalizedScore < 1) return;
    if (boardId !== ALL_TIME_WAVES_BOARD_ID) return;
    this.writePersonalBest(ALL_TIME_WAVES_BOARD_ID, normalizedScore);

    // CrazyGames exposes one weekly leaderboard per game. Its score is the
    // highest wave reached in a single run, shared by every game mode.

    const sdk = this.sdk;
    if (!this.initialized || !sdk) return;

    const seasonStart = currentLeaderboardSeasonStart();
    if (seasonStart !== this.leaderboardSeasonStart) {
      this.leaderboardSeasonStart = seasonStart;
      this.highestScheduledScore = this.readCurrentSeasonBest();
    }
    if (normalizedScore <= this.highestScheduledScore) return;

    this.highestScheduledScore = normalizedScore;
    try {
      const encryptedScore = await encryptScore(normalizedScore, LEADERBOARD_KEY);
      sdk.user.submitScore({ encryptedScore, score: normalizedScore });
      this.writeCurrentSeasonBest(normalizedScore, seasonStart);
    } catch (err) {
      this.highestScheduledScore = this.readCurrentSeasonBest();
      console.warn('[CrazyGames] leaderboard score submission failed', err);
    }
  }

  getTopPlayers(boardId: string, _limit = 10): Promise<LeaderboardEntry[]> {
    if (boardId !== ALL_TIME_WAVES_BOARD_ID) return Promise.resolve([]);
    const score = this.readPersonalBest(ALL_TIME_WAVES_BOARD_ID);
    if (score < 1) return Promise.resolve([]);
    return Promise.resolve([{
      rank: 0,
      name: this.user?.username || 'You',
      score,
      avatarUrl: this.user?.profilePictureUrl || '',
    }]);
  }

  private requestAd(type: 'midgame' | 'rewarded'): Promise<boolean> {
    return new Promise((resolve) => {
      const sdk = this.sdk;
      if (!this.initialized || !sdk) {
        resolve(false);
        return;
      }

      let settled = false;
      let adStarted = false;
      let safetyTimer: number | null = null;
      const blocker = this.showAdBlocker();

      const finish = (completed: boolean): void => {
        if (settled) return;
        settled = true;
        if (safetyTimer !== null) window.clearTimeout(safetyTimer);
        if (adStarted) audio.resumeAfterAd();
        blocker.remove();
        resolve(completed);
      };

      try {
        sdk.ad.requestAd(type, {
          adStarted: () => {
            if (adStarted) return;
            adStarted = true;
            audio.pauseForAd();
          },
          adFinished: () => finish(true),
          adError: () => finish(false),
        });
      } catch {
        finish(false);
        return;
      }

      safetyTimer = window.setTimeout(() => finish(false), 120_000);
    });
  }

  private showAdBlocker(): HTMLElement {
    const blocker = document.createElement('div');
    blocker.className = 'platform-ad-blocker';
    blocker.setAttribute('role', 'status');
    blocker.setAttribute('aria-live', 'polite');
    blocker.innerHTML = '<span class="platform-ad-spinner"></span><span>Loading ad...</span>';
    document.body.appendChild(blocker);
    return blocker;
  }

  private applySettings(settings: { muteAudio?: boolean } | undefined): void {
    audio.mute(settings?.muteAudio === true);
  }

  private notifyAuthListeners(): void {
    for (const cb of this.authListeners) cb();
  }

  private readCurrentSeasonBest(): number {
    try {
      const raw = localStorage.getItem(LEADERBOARD_BEST_KEY);
      if (!raw) return 0;
      const stored = JSON.parse(raw) as Partial<StoredWeeklyLeaderboardBest>;
      if (stored.seasonStart !== currentLeaderboardSeasonStart()) return 0;
      return typeof stored.score === 'number' && Number.isFinite(stored.score)
        ? Math.max(0, Math.floor(stored.score))
        : 0;
    } catch {
      return 0;
    }
  }

  private writeCurrentSeasonBest(score: number, seasonStart: number): void {
    try {
      const stored: StoredWeeklyLeaderboardBest = {
        seasonStart,
        score,
      };
      localStorage.setItem(LEADERBOARD_BEST_KEY, JSON.stringify(stored));
    } catch {
      // Submission still succeeded; local gating is only an optimization.
    }
  }

  private readPersonalBest(boardId: string): number {
    try {
      const raw = localStorage.getItem(PERSONAL_BOARD_PREFIX + boardId);
      const score = raw === null ? 0 : Number(raw);
      return Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0;
    } catch {
      return 0;
    }
  }

  private writePersonalBest(boardId: string, score: number): void {
    const previous = this.readPersonalBest(boardId);
    if (score <= previous) return;
    try {
      localStorage.setItem(PERSONAL_BOARD_PREFIX + boardId, String(score));
    } catch {
      // The official score can still be submitted if local storage is blocked.
    }
  }
}

async function encryptScore(score: number, encryptionKey: string): Promise<string> {
  const keyBytes = decodeBase64(encryptionKey);
  if (keyBytes.length !== 32) {
    throw new Error('CrazyGames leaderboard key must decode to exactly 32 bytes');
  }

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const algorithm: AesGcmParams = { name: 'AES-GCM', iv };
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes.buffer,
    algorithm,
    false,
    ['encrypt'],
  );
  const data = new TextEncoder().encode(String(score));
  const encrypted = await window.crypto.subtle.encrypt(algorithm, cryptoKey, data);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return encodeBase64(combined);
}

function decodeBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function encodeBase64(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function currentLeaderboardSeasonStart(now = Date.now()): number {
  const date = new Date(now);
  const midnightUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  let seasonStart = midnightUtc - daysSinceMonday * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000;
  if (now < seasonStart) seasonStart -= WEEK_MS;
  return seasonStart;
}

export const crazyGames = new CrazyGamesPlatform();
