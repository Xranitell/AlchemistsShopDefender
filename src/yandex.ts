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
  /** Fetch the metadata for a leaderboard. Returns the technical id +
   *  default sort order + per-locale display titles. We use this on
   *  init to verify that the boards we submit to (`endlessWaves`,
   *  `dailyWaves`) are actually registered in the Yandex console — if
   *  the SDK rejects the call the board doesn't exist and submits will
   *  silently fail no matter what we do client-side. */
  getLeaderboardDescription(boardName: string): Promise<{
    name?: string;
    title?: { ru?: string; en?: string; tr?: string };
    isDefault?: boolean;
    description?: { invert_sort_order?: boolean; type?: string };
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

/** One row of the in-memory diagnostic log. Captures every leaderboard
 *  submit attempt — what board, what score, what happened — so the
 *  Diagnostics panel inside `leaderboardOverlay` can show players (and
 *  us, post-incident) why the board appears empty. */
export interface LeaderboardSubmitLogEntry {
  /** Wall-clock time the submit was issued. */
  ts: number;
  /** Technical board id (`endlessWaves` / `dailyWaves`). */
  boardId: string;
  /** Score we tried to submit. */
  score: number;
  /** What actually happened.
   *   `mock`        → no SDK; fell back to localStorage mock board.
   *   `skipped`     → SDK present but player is `'lite'` guest.
   *   `sent`        → setLeaderboardScore resolved without throwing.
   *   `failed`      → setLeaderboardScore rejected (error captured). */
  status: 'mock' | 'skipped' | 'sent' | 'failed';
  /** Human-readable error message when `status==='failed'`. */
  error?: string;
}

/** Result of probing `getLeaderboardDescription(boardId)` once at SDK
 *  init. If the board is not registered in Yandex Games Console the
 *  SDK throws and we capture the error here so the diagnostics panel
 *  can surface "board not found" instead of "the player must not be
 *  scoring high enough". */
export interface LeaderboardProbeResult {
  /** Technical board id we probed. */
  boardId: string;
  /** True if `getLeaderboardDescription` resolved successfully (board
   *  exists and SDK is reachable). */
  ok: boolean;
  /** Human-readable error / status when `ok===false`. */
  error?: string;
  /** Display title returned by the SDK (preferred locale or `name`). */
  title?: string;
  /** Score format hint reported by the SDK
   *  (`description.type` — usually `'numeric'` or `'time'`). When
   *  this differs between the boards we write to it usually explains
   *  why one board accepts our score and another doesn't. */
  scoreType?: string;
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

/** Soft cap on the in-memory submit log so the Diagnostics panel never
 *  bloats memory in a long endless run. The most recent N submits are
 *  what's actionable anyway. */
const SUBMIT_LOG_CAP = 24;

/** Stringify an error / rejection value into a multi-line string that
 *  preserves every diagnostic field the runtime exposed.
 *
 *  Why this exists: Yandex Games SDK rejections sometimes carry only a
 *  vague `.message` ("The request to setLeaderboardScore is invalid")
 *  while the *real* signal (HTTP status, error code, server-side
 *  details) lives on enumerable own-properties or under a `.data`
 *  object. The previous `err.message` extraction silently dropped all
 *  of that, leaving the diagnostics panel unable to distinguish a
 *  rate-limit from a malformed-payload from an unauthorized-write.
 *  This helper joins `.message` with a JSON dump of any extra fields
 *  so the panel shows the full picture. */
function serializeError(err: unknown): string {
  if (err == null) return 'null';
  if (typeof err !== 'object') return String(err);
  const e = err as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof e.message === 'string' && e.message) parts.push(e.message);
  // Collect any non-standard fields ('code', 'statusCode',
  // 'data', 'details', 'name' if non-trivial, etc.).
  const extra: Record<string, unknown> = {};
  for (const k of Object.keys(e)) {
    if (k === 'message' || k === 'stack') continue;
    if (k === 'name' && (e[k] === 'Error' || e[k] === '')) continue;
    extra[k] = e[k];
  }
  if (Object.keys(extra).length > 0) {
    try { parts.push(JSON.stringify(extra)); }
    catch { parts.push(String(extra)); }
  }
  return parts.join(' · ') || String(err);
}

/** Boards we probe at init. Aligns with the technical ids used by
 *  `setLeaderboardScore` in main.ts (`submitWaveLeaderboards`). If the
 *  designer renames a board in the Yandex console we want this list
 *  updated in lock-step. */
const PROBE_BOARDS = ['endlessWaves', 'dailyWaves'] as const;

class YandexGames {
  private sdk: YGameSdk | null = null;
  private lb: YaLeaderboards | null = null;
  private player: YaPlayer | null = null;
  private ready = false;
  /** Listeners notified when the player auth state changes (init / sign-in). */
  private authListeners: Array<() => void> = [];
  /** Listeners notified when the leaderboard diagnostics state changes
   *  (init probes complete or a submit was logged). The leaderboard
   *  overlay renders a live "last attempts" table from this state. */
  private diagListeners: Array<() => void> = [];
  /** Rolling in-memory log of recent submit attempts (newest first). */
  private submitLog: LeaderboardSubmitLogEntry[] = [];
  /** Result of the init-time `getLeaderboardDescription` probe per
   *  board. `null` until the probe completes; a non-null entry means
   *  we have a definitive answer (`ok` true/false). */
  private probeResults: LeaderboardProbeResult[] = [];

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
      // Probe each leaderboard's description so the diagnostics panel
      // can tell players whether the boards we submit to are even
      // registered in the Yandex console. A non-existent board makes
      // every setLeaderboardScore fail silently and is the most likely
      // root cause of "leaderboard is empty even though I cleared
      // 30 waves" reports. Awaited in parallel so init isn't slow.
      await this.probeLeaderboards();
    } catch (err) {
      console.warn('[YandexGames] init failed, running in stub mode', err);
    }
  }

  private async probeLeaderboards(): Promise<void> {
    if (!this.lb?.getLeaderboardDescription) {
      // Older SDK build without the description API — record the boards
      // as un-probed (`ok: false`) so the diag panel makes the gap
      // visible instead of pretending the probe passed.
      this.probeResults = PROBE_BOARDS.map((id) => ({
        boardId: id,
        ok: false,
        error: 'getLeaderboardDescription not available',
      }));
      for (const cb of this.diagListeners) cb();
      return;
    }
    const lb = this.lb;
    this.probeResults = await Promise.all(
      PROBE_BOARDS.map(async (boardId): Promise<LeaderboardProbeResult> => {
        try {
          const desc = await lb.getLeaderboardDescription(boardId);
          const title = desc.title?.ru ?? desc.title?.en ?? desc.name ?? boardId;
          return {
            boardId,
            ok: true,
            title,
            scoreType: desc.description?.type,
          };
        } catch (err) {
          return {
            boardId,
            ok: false,
            error: serializeError(err),
          };
        }
      }),
    );
    for (const cb of this.diagListeners) cb();
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
    // Auth state changing (e.g. after signIn) flips the `authorized`
    // field on the diagnostics snapshot — re-render any open
    // diagnostics panels too.
    for (const cb of this.diagListeners) cb();
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
   *  so the player can fix the auth state explicitly.
   *
   *  Every attempt is also pushed onto `submitLog` so the Diagnostics
   *  section inside leaderboardOverlay can show the last few results
   *  (board, score, status, error) — invaluable when a player reports
   *  "the board is empty even after I cleared 20 waves". */
  async setLeaderboardScore(boardId: string, score: number): Promise<void> {
    if (this.lb) {
      if (!this.isAuthorized()) {
        console.info('[YandexGames] skipping leaderboard write — player not signed in (lite mode)');
        this.recordSubmit({ ts: Date.now(), boardId, score, status: 'skipped' });
        return;
      }
      try {
        await this.lb.setLeaderboardScore(boardId, score);
        this.recordSubmit({ ts: Date.now(), boardId, score, status: 'sent' });
      } catch (err) {
        // Yandex SDK rejection objects sometimes carry rich context
        // beyond `.message` — e.g. `{ code, statusCode, details }` —
        // and the bare `.message` can be vague ("The request to
        // setLeaderboardScore is invalid"). Stringify any extra
        // own-properties so the diag panel surfaces the *full*
        // diagnostic payload, not just a pre-mangled summary.
        const msg = serializeError(err);
        console.warn('[YandexGames] setLeaderboardScore failed', err);
        this.recordSubmit({
          ts: Date.now(),
          boardId,
          score,
          status: 'failed',
          error: msg,
        });
      }
    } else {
      mockSetScore(boardId, score);
      this.recordSubmit({ ts: Date.now(), boardId, score, status: 'mock' });
    }
  }

  private recordSubmit(entry: LeaderboardSubmitLogEntry): void {
    this.submitLog.unshift(entry);
    if (this.submitLog.length > SUBMIT_LOG_CAP) {
      this.submitLog.length = SUBMIT_LOG_CAP;
    }
    for (const cb of this.diagListeners) cb();
  }

  /** Snapshot of the leaderboard diagnostic state for the UI. Always
   *  returns a fresh array/object so the caller can safely render
   *  without worrying about mutation. */
  getLeaderboardDiagnostics(): {
    sdkReachable: boolean;
    authorized: boolean;
    playerMode: string | null;
    probes: LeaderboardProbeResult[];
    submits: LeaderboardSubmitLogEntry[];
  } {
    return {
      sdkReachable: this.sdk !== null,
      authorized: this.isAuthorized(),
      playerMode: this.player?.getMode?.() ?? null,
      probes: [...this.probeResults],
      submits: [...this.submitLog],
    };
  }

  /** Subscribe to diagnostic-state changes (probe results landing, a
   *  submit being logged, sign-in flipping the auth state). Returns
   *  the usual unsubscribe function. */
  onDiagnosticsChange(cb: () => void): () => void {
    this.diagListeners.push(cb);
    return () => {
      const i = this.diagListeners.indexOf(cb);
      if (i >= 0) this.diagListeners.splice(i, 1);
    };
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
