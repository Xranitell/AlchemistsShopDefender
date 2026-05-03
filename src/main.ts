import './style.css';
import { Input } from './engine/input';
import { Loop } from './engine/loop';
import { dist } from './engine/math';
import { yandex } from './yandex';
import {
  buildInitialState,
  applyBiomeModifiers,
  applyDailyEventModifiers,
  applyRunMutators,
  applyRunContracts,
  getTodayDailyEvent,
  dailySeed,
  dailyBoardId,
  resizeArena,
  setArenaSize,
} from './game/world';
import { updateMannequin } from './game/mannequin';
import { updateEnemies, updateGoldPickups, updateFirePools, updateFloatingTexts } from './game/enemy';
import { updateReactionPools } from './game/reactions';
import { updateTowers } from './game/tower';
import { updateProjectiles } from './game/projectile';
import { startNextWave, startPause, updateWave, totalWaves, confirmEndlessModifier, INITIAL_PREP_DURATION } from './game/wave';
import { applyCard, beginNewDraft, isCursedWave, rerollForAd, rerollForGold, rollCardOptions } from './game/cards';
import { tickOverloadEffect, tickModuleTimers } from './game/overload';
import { tickShake, resetShake } from './engine/shake';
import { resetShockwaves } from './render/shockwaves';
import { tickScreenFlash, resetScreenFlash } from './render/screenFlash';
import { render, getRenderCamera } from './game/render';
import { screenToWorld, worldToScreen } from './render/camera';
import { getSprites } from './render/sprites';
import { spriteIcon } from './render/spriteIcon';
import type { BakedSprite } from './render/sprite';
import { Hud } from './ui/hud';
import { CardOverlay } from './ui/cardOverlay';
import { TowerShop } from './ui/towerShop';
import { MannequinShop } from './ui/mannequinShop';
import { MetaOverlay } from './ui/metaOverlay';
import { LoadoutOverlay } from './ui/loadoutOverlay';
import { MainMenu } from './ui/mainMenu';
import { DailyRewardsOverlay } from './ui/dailyRewardsOverlay';
import { BattlePassOverlay, addBpXp } from './ui/battlePassOverlay';
import { SettingsOverlay } from './ui/settingsOverlay';
import { DifficultyOverlay } from './ui/difficultyOverlay';
import { ModifierPreviewOverlay } from './ui/modifierPreviewOverlay';
import { EndlessModifierOverlay } from './ui/endlessModifierOverlay';
import { DailyEventOverlay } from './ui/dailyEventOverlay';
import { BlessingOverlay } from './ui/blessingOverlay';
import { ReviveOverlay } from './ui/reviveOverlay';
import { PauseStatsOverlay } from './ui/pauseStatsOverlay';
import { LawAnnounceOverlay } from './ui/lawAnnounceOverlay';
import { MUTATOR_BY_ID } from './data/mutators';
import type { DifficultyMode } from './data/difficulty';
import { BP_XP_PER_WAVE, BP_XP_PER_KILL, BP_XP_VICTORY } from './data/battlePass';
import { CONTRACT_BY_ID, type ContractId, type ContractDef } from './data/contracts';
import {
  BLESSINGS,
  BLESSING_BY_ID,
  CURSES,
  CURSE_BY_ID,
  blessingChoiceCount,
  curseChoiceCount,
} from './data/blessings';
import type { GameState } from './game/state';
import { loadMeta, saveMeta, resetMeta, type MetaSave } from './game/save';
import { applyMetaUpgrades, calcRunEssence } from './game/meta';
import {
  attachRunInventory,
  persistRunInventory,
  tickActivePotions,
  consumePotion,
} from './game/potions';
import { CraftingOverlay } from './ui/craftingOverlay';
import type { IngredientId } from './data/potions';
import { audio } from './audio/audio';
import { tutorial } from './ui/tutorial';
import { hideAppLoader } from './ui/appLoader';
import { setLocale, t, onLocaleChange, normalizeToLocale } from './i18n';

// ── Mobile viewport scaling ──────────────────────────────────────────
// On small screens (phones / small tablets) we override the viewport
// width to 1280 CSS-px so the browser renders the page at the same scale
// as a 1280-wide PC window and then CSS-scales it down to fit. This
// preserves the exact same look as the desktop version.
const DESIGN_WIDTH = 1280;
const MOBILE_BREAKPOINT = 1024;

function applyMobileViewport(): void {
  const vpMeta = document.querySelector('meta[name="viewport"]');
  if (!vpMeta) return;
  const physSmall = Math.min(screen.width, screen.height);
  if (physSmall < MOBILE_BREAKPOINT) {
    vpMeta.setAttribute(
      'content',
      `width=${DESIGN_WIDTH}, viewport-fit=cover, user-scalable=no`,
    );
  }
  // Try to lock orientation to landscape on mobile.
  try {
    const orient = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    if (orient?.lock) orient.lock('landscape').catch(() => {});
  } catch { /* not supported — no-op */ }
}
applyMobileViewport();

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
const hudRoot = document.getElementById('hud') as HTMLDivElement | null;
const overlayRoot = document.getElementById('overlay') as HTMLDivElement | null;

if (!canvas || !hudRoot || !overlayRoot) {
  throw new Error('Game DOM not found');
}

const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D context not available');
ctx.imageSmoothingEnabled = true;

/** Resize the canvas + game arena to fully cover the current viewport.
 *  The canvas internal resolution matches the CSS viewport (no DPR
 *  multiplication; existing render code is not HiDPI-aware). The world is
 *  separately sized in `setArenaSize` to a 1080-tall reference and is
 *  scaled-to-fit by `getRenderCamera()` — so on a 1280×576 mobile viewport
 *  the world is 2400×1080 and is rendered at scale 0.533, giving the same
 *  dais-to-canvas ratio the player sees on PC. */
function syncArenaToViewport(): void {
  const c = canvas!;
  const w = Math.max(640, Math.floor(window.innerWidth));
  const h = Math.max(360, Math.floor(window.innerHeight));
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
  setArenaSize(w, h);
  // Re-enable smoothing every resize (Canvas resets context state when
  // the backing store size changes).
  if (ctx) ctx.imageSmoothingEnabled = true;
}
syncArenaToViewport();
window.addEventListener('resize', () => {
  syncArenaToViewport();
  // The first call inside `state` setup already used the right size, but
  // subsequent runtime resizes need to reposition the mannequin / runes.
  if (state) resizeArena(state, window.innerWidth, window.innerHeight);
});

let meta: MetaSave = loadMeta();
// Apply the saved locale before any UI is rendered so the very first
// frames already show the player's language preference.
setLocale(meta.locale);
let state: GameState = buildInitialState();

// Initialise the audio engine on the first user gesture (click / keydown).
// AudioContext can only be created from inside a gesture handler under the
// Yandex/Chrome autoplay policy, so we attach one-shot listeners that bring
// up the engine, push the user-saved volumes in and start the menu loop.
function startAudioOnGesture(): void {
  audio.ensureStarted();
  audio.setVolumes({ sfxVolume: meta.sfxVolume, musicVolume: meta.musicVolume });
  // Whatever phase we're in when the gesture lands, kick off the matching
  // music. Most players will land here from the main-menu screen.
  audio.playMusic(state.phase === 'wave' || state.phase === 'preparing' ? 'battle' : 'menu');
}
['pointerdown', 'keydown', 'touchstart'].forEach((evt) => {
  window.addEventListener(evt, startAudioOnGesture, { once: true, passive: true });
});

// On mobile, request fullscreen on first tap to hide the browser chrome
// and give the game the entire screen. `requestFullscreen` must be called
// from inside a user-gesture handler.
function requestFullscreenOnMobile(): void {
  const isMobile = Math.min(screen.width, screen.height) < MOBILE_BREAKPOINT;
  if (!isMobile) return;
  const el = document.documentElement;
  const rfs = el.requestFullscreen
    ?? (el as unknown as Record<string, unknown>).webkitRequestFullscreen;
  if (typeof rfs === 'function') rfs.call(el).catch(() => {});
}
['pointerdown', 'touchstart'].forEach((evt) => {
  window.addEventListener(evt, requestFullscreenOnMobile, { once: true, passive: true });
});
const input = new Input(canvas);
const overlay = new CardOverlay(overlayRoot);
const metaOverlay = new MetaOverlay(overlayRoot);
const loadoutOverlay = new LoadoutOverlay(overlayRoot);
const mainMenu = new MainMenu(overlayRoot);
const dailyOverlay = new DailyRewardsOverlay(overlayRoot);
const bpOverlay = new BattlePassOverlay(overlayRoot);
const settingsOverlay = new SettingsOverlay(overlayRoot);
const difficultyOverlay = new DifficultyOverlay(overlayRoot);
const modifierPreview = new ModifierPreviewOverlay(overlayRoot);
const endlessModOverlay = new EndlessModifierOverlay(overlayRoot);
const dailyEventOverlay = new DailyEventOverlay(overlayRoot);
const blessingOverlay = new BlessingOverlay(overlayRoot);
const reviveOverlay = new ReviveOverlay(overlayRoot);
const craftingOverlay = new CraftingOverlay(overlayRoot);
const pauseStats = new PauseStatsOverlay(document.body, {
  onClose: () => {
    userPaused = false;
    hud.setPaused(false);
    // Pause walkthrough is bound to the lifetime of the panel — tear it
    // down here too (the X button bypasses togglePause). Mark the
    // walkthrough as done if a sequence was actually running.
    const wasSequenceRunning = tutorial.isSequenceActive();
    tutorial.cancelSequence('pauseOpen');
    if (wasSequenceRunning && !meta.pauseTutorialDone) {
      meta.pauseTutorialDone = true;
      saveMeta(meta);
    }
  },
  onExitToMenu: () => {
    // Player chose to abandon the run from the pause menu after the
    // confirm dialog. The pause overlay closes itself; reset the HUD
    // pause indicator and recycle the run via `restart()`, which builds
    // a fresh state and shows the main menu. The Epic / Ancient key
    // already spent at run start does NOT come back — the warning text
    // in the confirm dialog made that contract explicit.
    userPaused = false;
    hud.setPaused(false);
    const wasSequenceRunning = tutorial.isSequenceActive();
    tutorial.cancelSequence('pauseOpen');
    if (wasSequenceRunning && !meta.pauseTutorialDone) {
      meta.pauseTutorialDone = true;
      saveMeta(meta);
    }
    restart();
  },
});

// Toast that surfaces a freshly-rolled "dungeon law" right after the
// player closes the card draft. Only the wave-rotating mutators trigger
// it; modes without mutators (Normal / Endless / Daily) never see this
// toast. Lives in `document.body` so it sits above HUD + canvas without
// interfering with the in-game overlay stack.
const lawAnnounce = new LawAnnounceOverlay(document.body);
const towerShop = new TowerShop(hudRoot);
towerShop.attach(state);
const mannequinShop = new MannequinShop(hudRoot);
mannequinShop.attach(state);

/** User-driven pause flag. Toggled by the HUD pause button (and the
 *  matching mobile control). When true, the simulation does not tick —
 *  all enemies, projectiles, towers, and timers freeze until the player
 *  resumes. We still keep rendering the canvas / HUD so the frozen frame
 *  is visible. */
let userPaused = false;
function togglePause(): void {
  // Pause is only meaningful during active gameplay phases. The flag stays
  // false outside of `wave` / `preparing` so re-entering gameplay never
  // starts mid-pause.
  if (state.phase !== 'wave' && state.phase !== 'preparing') {
    userPaused = false;
    hud.setPaused(false);
    pauseStats.hide();
    return;
  }
  userPaused = !userPaused;
  hud.setPaused(userPaused);
  if (userPaused) {
    pauseStats.show(state);
    // First-time pause walkthrough — fires once per save. Steps whose
    // section isn't on-screen for this difficulty (e.g. contracts on a
    // standard run) are skipped automatically by the tutorial controller.
    if (!meta.pauseTutorialDone) {
      tutorial.startSequence('pauseOpen', {
        onComplete: () => {
          meta.pauseTutorialDone = true;
          saveMeta(meta);
        },
        onSkip: () => {
          meta.pauseTutorialDone = true;
          saveMeta(meta);
        },
      });
    }
  } else {
    pauseStats.hide();
    // The player closing the pause panel mid-walkthrough still counts
    // as "they've seen it" — flip the flag so re-opening pause doesn't
    // restart the same sequence from step one. We only flip when the
    // sequence was actually running (not deferred due to a wave hint).
    const wasSequenceRunning = tutorial.isSequenceActive();
    tutorial.cancelSequence('pauseOpen');
    if (wasSequenceRunning && !meta.pauseTutorialDone) {
      meta.pauseTutorialDone = true;
      saveMeta(meta);
    }
  }
}

const hud = new Hud(hudRoot, {
  onPause: () => togglePause(),
  onSkipPause: () => {
    if (state.phase === 'preparing') {
      towerShop.close();
      startNextWave(state);
    }
  },
  onActivateOverload: () => { state.overloadRequested = true; },
  onActivateMagnet: () => {
    // Short magnet pulse: for the next ~1.2s every gold pickup on the map is
    // yanked hard toward the hero regardless of the base loot radius.
    if (state.phase === 'wave' || state.phase === 'preparing') {
      state.magnetTimer = Math.max(state.magnetTimer, 1.2);
    }
  },
  onUsePotion: (slot) => {
    if (state.phase !== 'wave' && state.phase !== 'preparing') return;
    if (consumePotion(state, slot)) {
      // Mirror back to meta so the slot stays empty across saves/exits.
      persistRunInventory(state, meta);
      audio.playSfx('throwPotion', { detune: 0.85 });
    }
  },
});

const loop = new Loop((dt) => tick(dt));

// Attach the FTUE tutorial overlay once the canvas is in the DOM. The
// controller stays dormant until startRun() decides to call .start().
// Re-render the visible top-level overlay when the player flips RU/EN, so
// labels update without requiring a navigation. We rebuild whichever
// screen is currently mounted (main menu, settings, or difficulty pick).
onLocaleChange(() => {
  if (mainMenu.isVisible?.()) showMainMenu();
  else if (settingsOverlay.isVisible?.()) showSettings();
  updateStaticI18nText();
});
updateStaticI18nText();

function updateStaticI18nText(): void {
  const pw = document.getElementById('portrait-warning');
  if (!pw) return;
  const main = pw.querySelector('[data-i18n="ui.rotate"]');
  const sub = pw.querySelector('[data-i18n="ui.rotate.sub"]');
  if (main) main.textContent = t('ui.rotate');
  if (sub) sub.textContent = t('ui.rotate.sub');
}

tutorial.attach(canvas, {
  onSkip: () => {
    meta.tutorialDone = true;
    saveMeta(meta);
  },
});

void (async () => {
  await yandex.init();
  // Yandex Games console flags any submission that doesn't read the
  // player's preferred language through their SDK as "i18n не
  // используется". Pull the lang now and forward it to our own engine
  // — but only when the player has not already picked a locale via the
  // in-game switcher, so a manual choice always wins over the SDK.
  if (!meta.localeUserChoice) {
    const sdkLocale = normalizeToLocale(yandex.getLang());
    if (sdkLocale !== meta.locale) {
      setLocale(sdkLocale);
      meta.locale = sdkLocale;
      saveMeta(meta);
    }
  }
  yandex.loadingReady();
  hideAppLoader();
  showMainMenu();
  loop.start();
})();

function tick(dt: number): void {
  // Convert screen mouse position to world coordinates through inverse iso transform
  const cam = getRenderCamera(state.arena.width, state.arena.height);
  state.aim = screenToWorld(input.state.mouse.x, input.state.mouse.y, cam);

  // User-driven pause — freeze the entire simulation (worldTime included
  // so animations don't drift) but keep rendering the last frame so the
  // player can read the board. Input is dropped so accidental taps on the
  // arena don't queue throws while we're paused.
  if (userPaused) {
    if (state.phase !== 'wave' && state.phase !== 'preparing') {
      // Phase changed under us (e.g. wave finished into card_select). Auto-
      // resume so we never stay paused on a non-gameplay screen.
      userPaused = false;
      hud.setPaused(false);
    } else {
      input.endFrame();
      render(ctx!, state);
      hud.update(state);
      return;
    }
  }

  // Tutorial pause — freeze simulation while a tutorial tooltip is visible
  // so the player can read the hint without enemies advancing. We still
  // process input so the player can fulfil the step's dismiss condition
  // (e.g. clicking a rune point to place a tower).
  const tutorialFrozen = tutorial.isShowingStep()
    && (state.phase === 'wave' || state.phase === 'preparing');

  if (!tutorialFrozen) {
    state.worldTime += dt;
    tickShake(dt);
    tickScreenFlash(dt);
  }

  // Pause input while UI overlays are visible (card_select, gameover, victory).
  const interactive = state.phase === 'wave' || state.phase === 'preparing';

  // Click handling. The first frame of a press handles UI: rune points,
  // mannequin popup, etc. Subsequent held frames during a wave keep firing
  // potions ("hold to throw") so the player doesn't have to spam-click.
  if (interactive && input.state.mousePressedThisFrame) {
    const worldClick = screenToWorld(input.state.mouse.x, input.state.mouse.y, cam);
    handleClick(worldClick);
  } else if (
    interactive
    && input.state.mouseDown
    && state.phase === 'wave'
    && !towerShop.isOpen()
    && !mannequinShop.isOpen()
  ) {
    const worldAt = screenToWorld(input.state.mouse.x, input.state.mouse.y, cam);
    // Don't auto-fire if the cursor is hovering a clickable game object —
    // otherwise pressing on a rune / the mannequin would also throw a potion.
    if (!isHoveringInteractive(worldAt)) {
      state.manualFireRequested = true;
    }
  }

  // Hotkeys.
  if (input.state.keysPressedThisFrame.has('KeyQ')) {
    state.overloadRequested = true;
  }
  if (input.state.keysPressedThisFrame.has('Space')) {
    if (state.phase === 'preparing') {
      towerShop.close();
      startNextWave(state);
    }
  }
  // Potion hotkeys: 1..4 maps to inventory slots 0..3. Works during the
  // same phases as the HUD buttons (`wave` / `preparing`).
  if (state.phase === 'wave' || state.phase === 'preparing') {
    for (let i = 0; i < 4; i++) {
      if (input.state.keysPressedThisFrame.has(`Digit${i + 1}`)) {
        if (consumePotion(state, i)) {
          persistRunInventory(state, meta);
          audio.playSfx('throwPotion', { detune: 0.85 });
        }
      }
    }
  }
  input.endFrame();

  // Phase update — skip all simulation ticks while tutorial is frozen.
  if (!tutorialFrozen) {
    if (state.phase === 'preparing') {
      state.waveState.pauseTime += dt;
      state.waveState.pauseDurationLeft -= dt;
      if (state.waveState.pauseDurationLeft <= 0) {
        towerShop.close();
        startNextWave(state);
      }
    }

    if (state.phase === 'wave' && !state.revivePaused) {
      updateMannequin(state, dt);
      updateTowers(state, dt);
      updateProjectiles(state, dt);
      updateEnemies(state, dt);
      updateFirePools(state, dt);
      updateReactionPools(state, dt);
      updateGoldPickups(state, dt);
      updateFloatingTexts(state, dt);
      tickOverloadEffect(dt);
      tickModuleTimers(state, dt);
      tickActivePotions(state, dt);
      updateWave(state, dt);
    } else if (state.phase === 'preparing') {
      // Allow projectile and gold pickup decay during pause for clean transitions.
      updateProjectiles(state, dt);
      updateGoldPickups(state, dt);
      updateFloatingTexts(state, dt);
      tickActivePotions(state, dt);
    }

    // Auto-repair ticks in both wave and preparing phases
    if ((state.phase === 'wave' || state.phase === 'preparing') && state.metaAutoRepairRate > 0 && !state.revivePaused) {
      state.metaAutoRepairCooldown = Math.max(0, state.metaAutoRepairCooldown - dt);
      if (state.metaAutoRepairCooldown <= 0 && state.mannequin.hp < state.mannequin.maxHp) {
        state.mannequin.hp = Math.min(
          state.mannequin.maxHp,
          state.mannequin.hp + state.metaAutoRepairRate * dt,
        );
      }
    }

    // Vital Pulse aura — heals the mannequin while a wave is in progress.
    // The trickle is intentionally small (1 HP/s) so it stacks meaningfully
    // with Auto-Repair without trivialising tougher waves.
    if (state.phase === 'wave' && state.modifiers.vitalPulseRegen && !state.revivePaused) {
      if (state.mannequin.hp < state.mannequin.maxHp) {
        state.mannequin.hp = Math.min(
          state.mannequin.maxHp,
          state.mannequin.hp + 1 * dt,
        );
      }
    }

    // Run-contract bookkeeping: track the highest gold balance ever seen
    // during the run for the gold-hoarder contract. Cheap — a single
    // numeric compare per frame.
    if (state.gold > state.contractStats.goldPeak) {
      state.contractStats.goldPeak = state.gold;
    }
  }

  // Phase transitions that drive overlays.
  //
  // Skip every in-game overlay trigger while a meta-menu (main menu, lab,
  // crafting, daily rewards, settings, etc.) owns the overlay root. The
  // shared `#overlay` host has the `.visible` class only when something is
  // currently rendered into it; if that "something" is the player's menu
  // we must not stomp it with a stale `gameover` / `revivePaused` carried
  // over from a previous run.
  const metaMenuOpen =
    overlayRoot!.classList.contains('visible') &&
    !overlay.isVisible() &&
    !endlessModOverlay.isVisible() &&
    !reviveOverlay.isVisible();
  if (!metaMenuOpen) {
    if (state.phase === 'card_select' && !overlay.isVisible()) {
      showCardOverlay();
    }
    if (state.phase === 'endless_modifier_select' && !endlessModOverlay.isVisible()) {
      showEndlessModifierOverlay();
    }
    // The revive overlay ("Манекен разрушен!") was the old defeat popup
    // that flashed before the new "Манекен пал" panel. Players read this
    // as a duplicate, so the gating happens now in enemy.ts (it never
    // sets `revivePaused = true` anymore). We also defensively clear
    // any stale `revivePaused` carried over from older saves so the
    // overlay can never be re-opened.
    if (state.revivePaused) {
      state.revivePaused = false;
      state.reviveUsed = true;
      reviveOverlay.hide();
    }
    if (state.phase === 'victory' && !overlay.isVisible()) {
      showVictory();
    }
    if (state.phase === 'gameover' && !overlay.isVisible()) {
      showGameOver();
    }
  }

  render(ctx!, state);
  hud.update(state);
  tutorial.update(state);
}

/** Hit-test thresholds in world units, scaled up so the equivalent screen-px
 *  hit zone stays the same on zoomed-out viewports (mobile). At PC scale=1
 *  the rune threshold is 22 world units = 22 px on screen, matching the
 *  tuned-on-desktop touch target; on a 1280×576 mobile viewport scale≈0.53
 *  so the world threshold becomes ~41 to keep the same 22-px screen radius. */
function runeHitRadius(): number {
  const cam = getRenderCamera(state.arena.width, state.arena.height);
  return 22 / Math.max(0.1, cam.scale);
}
function mannequinHitRadius(): number {
  const cam = getRenderCamera(state.arena.width, state.arena.height);
  return 32 / Math.max(0.1, cam.scale);
}

/** True when the cursor is over an in-world UI hot-spot (rune point or the
 *  mannequin) and a click would trigger a popup rather than throwing. */
function isHoveringInteractive(at: { x: number; y: number }): boolean {
  const rR = runeHitRadius();
  for (const rp of state.runePoints) {
    if (!rp.active) continue;
    if (dist(at, rp.pos) < rR) return true;
  }
  if (dist(at, state.mannequin.pos) < mannequinHitRadius()) return true;
  return false;
}

function handleClick(at: { x: number; y: number }): void {
  // Rune point click → tower shop.
  const rR = runeHitRadius();
  for (const rp of state.runePoints) {
    if (!rp.active) continue;
    if (dist(at, rp.pos) < rR) {
      const screen = canvasToScreen(canvas!, rp.pos);
      mannequinShop.close();
      towerShop.open(rp.id, screen);
      return;
    }
  }

  // Mannequin click → repair / shield popup. Only useful between waves.
  if (dist(at, state.mannequin.pos) < mannequinHitRadius()) {
    const screen = canvasToScreen(canvas!, state.mannequin.pos);
    towerShop.close();
    mannequinShop.open(screen);
    return;
  }

  // Otherwise, throw potion (only during wave or just before).
  if (state.phase === 'wave') {
    state.manualFireRequested = true;
  }
  // If shops were open and user clicked elsewhere, close them.
  if (towerShop.isOpen()) towerShop.close();
  if (mannequinShop.isOpen()) mannequinShop.close();
}

/** Translate a *world* coordinate into a DOM-space pixel position so popups
 *  (tower-shop / mannequin-shop) can be anchored to in-game entities. The
 *  world→canvas step uses the active render camera (so a rune at world
 *  (1578, 540) on a zoomed-out mobile viewport correctly maps to the canvas
 *  pixel position where it actually appears), then canvas→DOM scales by the
 *  CSS display size of the canvas element. */
function canvasToScreen(c: HTMLCanvasElement, gamePos: { x: number; y: number }) {
  const cam = getRenderCamera(state.arena.width, state.arena.height);
  const canvasPos = worldToScreen(gamePos.x, gamePos.y, cam);
  const rect = c.getBoundingClientRect();
  const sx = rect.width / c.width;
  const sy = rect.height / c.height;
  const parent = c.parentElement!.getBoundingClientRect();
  return {
    x: rect.left - parent.left + canvasPos.x * sx,
    y: rect.top - parent.top + canvasPos.y * sy,
  };
}

function showCardOverlay(): void {
  yandex.gameplayStop();
  beginNewDraft(state);
  state.cardChoice.options = rollCardOptions(state);
  renderCardOverlay();

  if (state.cardChoice.options.length === 0) {
    // Auto-continue if no cards left.
    const idx = state.waveState.currentIndex;
    overlay.showSimple({
      title: t('ui.cards.waveCleared', { n: idx + 1 }),
      subtitle: t('ui.cards.subtitle.none'),
      buttons: [
        { label: t('ui.cards.next'), primary: true, onClick: () => {
          overlay.hide();
          const prevMutators = [...state.activeMutatorIds];
          startPause(state);
          announceNewDungeonLawIfChanged(prevMutators);
          yandex.gameplayStart();
        }},
      ],
    });
  }
}

/** Fire the "dungeon law has changed" toast when `startPause` rolled new
 *  mutators on top of `prev`. No-op for modes without mutators (the active
 *  list stays empty there) and when the new roll happens to repeat the
 *  previous IDs in the same order — there's nothing new to surface. */
function announceNewDungeonLawIfChanged(prev: readonly string[]): void {
  const next = state.activeMutatorIds;
  if (next.length === 0) return;
  if (next.length === prev.length && next.every((id, i) => id === prev[i])) return;
  const defs = next
    .map((id) => MUTATOR_BY_ID[id])
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  if (defs.length === 0) return;
  lawAnnounce.show(defs);
}

/** Re-render the card overlay from the current `state.cardChoice`. Called
 *  when the draft is first shown and after every reroll. */
function renderCardOverlay(): void {
  const options = state.cardChoice.options;
  const idx = state.waveState.currentIndex;
  const cursed = isCursedWave(idx + 1);
  const title = cursed
    ? t('ui.cards.cursedTitle', { n: idx + 1 })
    : t('ui.cards.waveCleared', { n: idx + 1 });
  const subtitle = options.length === 0
    ? t('ui.cards.subtitle.empty')
    : (cursed ? t('ui.cards.subtitle.cursed') : t('ui.cards.subtitle.has'));
  overlay.show({
    title,
    subtitle,
    cards: options,
    cursed,
    pickedIds: state.cardChoice.pickedIds,
    onPick: (card) => {
      applyCard(state, card);
      tutorial.notify('cardPicked');
      overlay.hide();
      const prevMutators = [...state.activeMutatorIds];
      startPause(state);
      announceNewDungeonLawIfChanged(prevMutators);
      yandex.gameplayStart();
    },
    // Skip: dismiss the draft entirely without applying a card. We still
    // notify the tutorial so the "you've seen the draft" gate trips.
    onSkip: options.length > 0 ? () => {
      tutorial.notify('cardPicked');
      state.contractStats.cardSkipUsed = true;
      overlay.hide();
      const prevMutators = [...state.activeMutatorIds];
      startPause(state);
      announceNewDungeonLawIfChanged(prevMutators);
      yandex.gameplayStart();
    } : undefined,
    rerollGold: options.length > 0 ? {
      cost: state.cardChoice.rerollCost,
      canAfford: state.gold >= state.cardChoice.rerollCost,
      onReroll: () => {
        if (rerollForGold(state)) renderCardOverlay();
      },
    } : undefined,
    rerollAd: options.length > 0 && !state.cardChoice.freeRerollUsed ? {
      onReroll: () => {
        void yandex.showRewarded().then((ok) => {
          if (!ok) return;
          if (rerollForAd(state)) renderCardOverlay();
        });
      },
    } : undefined,
  });
}

function showEndlessModifierOverlay(): void {
  if (!state.pendingEndlessModifier) return;
  endlessModOverlay.show({
    modifierId: state.pendingEndlessModifier,
    loop: state.endlessLoop,
    activeModifiers: state.endlessModifiers,
    onConfirm: () => {
      endlessModOverlay.hide();
      confirmEndlessModifier(state);
      yandex.gameplayStart();
    },
  });
}

function awardRunEssence(victory: boolean): { blue: number; ancient: number; epicKeys: number; ancientKeys: number; bpXp: number; contractBlue: number; contractAncient: number; completedContracts: ContractId[] } {
  const wave = state.waveState.currentIndex + 1;
  const reward = calcRunEssence(meta, wave, state.totalKills, victory, state.difficulty);
  // Score completed contracts and add their bonuses on top of the base
  // reward. Contracts pay out on both victory and defeat — they're
  // "side bets" the player completes during the run, not victory-only
  // achievements. (The flawless-late contract still requires reaching
  // wave 10, so naturally short defeats can't complete every contract.)
  const completedContracts: ContractId[] = [];
  let contractBlue = 0;
  let contractAncient = 0;
  let contractEpicKeys = 0;
  let blueMultBonus = 0;
  for (const id of state.activeContractIds) {
    const def: ContractDef | undefined = CONTRACT_BY_ID[id];
    if (!def) continue;
    if (!def.progress(state).done) continue;
    completedContracts.push(id);
    switch (def.reward.kind) {
      case 'blue': contractBlue += def.reward.amount; break;
      case 'ancient': contractAncient += def.reward.amount; break;
      case 'epicKey': contractEpicKeys += def.reward.amount; break;
      case 'blueMult': blueMultBonus += def.reward.amount; break;
    }
  }
  // Apply the multiplier bump retroactively to the *base* blue total —
  // not to the flat contractBlue add-ons (so a +25% reward feels valuable
  // without runaway scaling when stacked).
  const blueMultBonusGain = Math.round(reward.blue * blueMultBonus);
  reward.blue += blueMultBonusGain + contractBlue;
  reward.ancient += contractAncient;
  reward.epicKeys += contractEpicKeys;
  meta.blueEssence += reward.blue;
  meta.ancientEssence += reward.ancient;
  meta.epicKeys += reward.epicKeys;
  meta.ancientKeys += reward.ancientKeys;
  meta.totalRuns += 1;
  if (wave > meta.bestWave) meta.bestWave = wave;
  // Mastery: +1 on a full victory of Epic / Ancient. Mastery permanently
  // multiplies blue-essence drops in *every* future run (see
  // `masteryEssenceMult`), giving the player a long-term reason to keep
  // climbing the difficulty ladder.
  if (victory) {
    if (state.difficulty === 'epic') meta.epicMastery = (meta.epicMastery ?? 0) + 1;
    if (state.difficulty === 'ancient') meta.ancientMastery = (meta.ancientMastery ?? 0) + 1;
  }
  // Battle pass XP
  const bpXp = wave * BP_XP_PER_WAVE + state.totalKills * BP_XP_PER_KILL + (victory ? BP_XP_VICTORY : 0);
  addBpXp(meta, bpXp);
  // Persist surviving (unused) potion slots back to the meta save.
  persistRunInventory(state, meta);
  saveMeta(meta);

  // Submit scores to the two Yandex Games leaderboards. `endlessWaves`
  // tracks the highest wave reached across any run; `dailyWaves` is a
  // permanent board for daily-event runs (no per-day rollover — the same
  // table is reused every weekday).
  void yandex.setLeaderboardScore('endlessWaves', wave);
  if (state.difficulty === 'daily') {
    const score = wave * 1000 + state.totalKills;
    void yandex.setLeaderboardScore(dailyBoardId(), score);
  }

  return { blue: reward.blue, ancient: reward.ancient, epicKeys: reward.epicKeys, ancientKeys: reward.ancientKeys, bpXp, contractBlue, contractAncient, completedContracts };
}

/** Build the per-currency reward grid that replaces the old single-line
 *  text breakdown on the victory chest screen. Each non-zero currency
 *  becomes a tile with the canonical pixel-art icon + amount, matching
 *  the Daily Rewards and Battle Pass visual language. The same factory
 *  is reused by the falling-icons animation: every tile is paired with a
 *  flying clone of the icon that drops out of the chest and lands on
 *  the tile. Returns the list of {sprite, tile} pairs so the caller can
 *  schedule the animations. */
interface ChestRewardEntry {
  sprite: BakedSprite;
  amount: number;
  label: string;
  glow?: boolean;
}

function buildChestRewardEntries(
  r: { blue: number; ancient: number; epicKeys: number; ancientKeys: number; bpXp: number },
): ChestRewardEntry[] {
  const sprites = getSprites();
  const entries: ChestRewardEntry[] = [];
  // The kill counter is shown alongside the meta-currency tiles so the
  // chest reads as a "what you walked away with" board — same gold-coin
  // glyph the in-run HUD uses, with the run's kill total. Other tiles
  // are skipped when the currency value is 0 (a defeat-on-victory edge
  // case), so the grid never shows empty slots.
  entries.push({ sprite: sprites.iconCoin, amount: state.totalKills, label: t('ui.chest.label.kills') });
  if (r.blue > 0) entries.push({ sprite: sprites.iconBlueEssence, amount: r.blue, label: t('ui.chest.label.blue') });
  if (r.ancient > 0) entries.push({ sprite: sprites.iconAncientEssence, amount: r.ancient, label: t('ui.chest.label.ancient'), glow: true });
  if (r.epicKeys > 0) entries.push({ sprite: sprites.iconEpicKey, amount: r.epicKeys, label: t('ui.chest.label.epicKey') });
  if (r.ancientKeys > 0) entries.push({ sprite: sprites.iconAncientKey, amount: r.ancientKeys, label: t('ui.chest.label.ancientKey'), glow: true });
  if (r.bpXp > 0) entries.push({ sprite: sprites.iconRerolls, amount: r.bpXp, label: t('ui.chest.label.bpXp') });
  return entries;
}

/** Build a small list element summarising the run's active contracts —
 *  completed ones get a green checkmark + bonus reward note, others are
 *  greyed out. Returns null if the run had no contracts. */
function renderContractsSummary(completedIds: ContractId[]): HTMLElement | null {
  if (state.activeContractIds.length === 0) return null;
  const wrap = document.createElement('div');
  wrap.className = 'chest-contracts';
  const heading = document.createElement('div');
  heading.className = 'chest-contracts-heading';
  heading.textContent = t('ui.contract.summaryTitle');
  wrap.appendChild(heading);
  const completedSet = new Set(completedIds);
  for (const id of state.activeContractIds) {
    const def = CONTRACT_BY_ID[id];
    if (!def) continue;
    const row = document.createElement('div');
    row.className = 'chest-contract-row';
    const done = completedSet.has(id);
    if (done) row.classList.add('done');
    row.textContent = `${done ? '✔' : '✗'} ${def.icon} ${t(def.i18nName)}`;
    wrap.appendChild(row);
  }
  return wrap;
}

/** Award the same reward payload again (chest doubling via rewarded ad). */
function doubleRewards(r: { blue: number; ancient: number; epicKeys: number; ancientKeys: number; bpXp: number }): void {
  meta.blueEssence += r.blue;
  meta.ancientEssence += r.ancient;
  meta.epicKeys += r.epicKeys;
  meta.ancientKeys += r.ancientKeys;
  addBpXp(meta, r.bpXp);
  saveMeta(meta);
}

function showVictory(): void {
  yandex.gameplayStop();
  audio.playSfx('waveWin');
  audio.playMusic('menu');
  if (!meta.tutorialDone) {
    meta.tutorialDone = true;
  }
  tutorial.stop();
  const reward = awardRunEssence(true);
  const wave = state.waveState.currentIndex + 1;
  const sprites = getSprites();

  // Chest click-to-open mechanic: player taps the chest 3 times, then it
  // opens, the chest sprite swaps to the "open" frame, and per-currency
  // reward icons fly out of the chest in a parabolic arc and land into
  // their tiles in the reward grid.
  const TAPS_NEEDED = 3;
  let tapCount = 0;
  let chestOpened = false;

  const root = overlay.getRootElement();
  root.innerHTML = '';
  root.classList.remove('cards-mode');

  const panel = document.createElement('div');
  panel.className = 'panel chest-overlay';

  const title = document.createElement('h2');
  title.textContent = t('ui.victory.title');
  panel.appendChild(title);

  // Wave / kills summary line — matches the small subtitle line under the
  // big title in the reference mock-up. Replaces the bullet-separated
  // text dump that used to live below the chest.
  const summary = document.createElement('div');
  summary.className = 'chest-summary';
  summary.textContent = t('ui.chest.summary', {
    wave,
    total: totalWaves(state),
    kills: state.totalKills,
  });
  panel.appendChild(summary);

  // Chest stage: holds the radial-rays backdrop, the chest sprite, and
  // the layer where flying-out icons are spawned. Position: relative so
  // the flying icons (position: absolute) anchor to the chest centre.
  const stage = document.createElement('div');
  stage.className = 'chest-stage';
  panel.appendChild(stage);

  const rays = document.createElement('div');
  rays.className = 'chest-rays';
  stage.appendChild(rays);

  const flyLayer = document.createElement('div');
  flyLayer.className = 'chest-fly-layer';
  stage.appendChild(flyLayer);

  // Chest sprite — closed initially, swapped to the open frame on the
  // final tap. We wrap the sprite in a button so the click target also
  // reads as "press me" to keyboards / screen readers.
  const chestBtn = document.createElement('button');
  chestBtn.type = 'button';
  chestBtn.className = 'chest-button';
  const closedIcon = spriteIcon(sprites.iconChestClosed, { scale: 6, extraClass: 'chest-sprite chest-sprite-closed' });
  chestBtn.appendChild(closedIcon);
  stage.appendChild(chestBtn);

  const hint = document.createElement('div');
  hint.className = 'chest-hint';
  hint.textContent = t('ui.chest.tapToOpen');
  panel.appendChild(hint);

  const progressBar = document.createElement('div');
  progressBar.className = 'chest-progress';
  const progressFill = document.createElement('div');
  progressFill.className = 'chest-progress-fill';
  progressFill.style.width = '0%';
  progressBar.appendChild(progressFill);
  panel.appendChild(progressBar);

  const rewardContainer = document.createElement('div');
  rewardContainer.className = 'chest-reward-container';
  rewardContainer.style.display = 'none';
  panel.appendChild(rewardContainer);

  chestBtn.addEventListener('click', () => {
    if (chestOpened) return;
    tapCount++;
    audio.playSfx('uiClick');

    chestBtn.classList.remove('shake');
    void chestBtn.offsetWidth; // reflow to re-trigger the animation
    chestBtn.classList.add('shake');

    progressFill.style.width = `${Math.min(100, (tapCount / TAPS_NEEDED) * 100)}%`;
    hint.textContent = t('ui.chest.opening');

    if (tapCount >= TAPS_NEEDED) {
      chestOpened = true;
      chestBtn.classList.remove('shake');
      chestBtn.classList.add('opened');
      chestBtn.disabled = true;

      // Swap closed → open chest sprite. We rebuild the open icon (rather
      // than re-skinning the closed one) because both are baked-canvas
      // sprites; cheaper to swap children than redraw.
      closedIcon.remove();
      const openIcon = spriteIcon(sprites.iconChestOpen, { scale: 6, extraClass: 'chest-sprite chest-sprite-open' });
      chestBtn.appendChild(openIcon);
      rays.classList.add('blasting');

      hint.style.display = 'none';
      progressBar.style.display = 'none';

      // Build the reward grid + per-tile flying icons. The reward grid
      // is rendered immediately but with `landed=false`; each tile waits
      // for its own flying icon to "land" on it before flipping to the
      // landed visual. See `spawnFlyOut` below.
      const rewardGrid = document.createElement('div');
      rewardGrid.className = 'chest-reward-grid';
      rewardContainer.appendChild(rewardGrid);

      const entries = buildChestRewardEntries(reward);
      const tiles: HTMLElement[] = [];
      for (const e of entries) {
        const tile = document.createElement('div');
        tile.className = 'chest-reward-tile';
        const iconWrap = document.createElement('div');
        iconWrap.className = 'chest-reward-tile-icon';
        // Placeholder canvas (invisible) so the tile reserves the icon
        // slot height; the actual icon is filled in once the flying
        // copy lands.
        iconWrap.appendChild(spriteIcon(e.sprite, { scale: 2, extraClass: e.glow ? 'glow-gold' : '' }));
        tile.appendChild(iconWrap);
        const amt = document.createElement('div');
        amt.className = 'chest-reward-tile-amount';
        amt.textContent = `+${e.amount}`;
        tile.appendChild(amt);
        const lab = document.createElement('div');
        lab.className = 'chest-reward-tile-label';
        lab.textContent = e.label;
        tile.appendChild(lab);
        tile.classList.add('pending');
        rewardGrid.appendChild(tile);
        tiles.push(tile);
      }

      // Per-contract summary: highlight goals that resolved as completed
      // and grey-out unfinished ones. Empty for runs without contracts.
      const contractSummary = renderContractsSummary(reward.completedContracts);
      if (contractSummary) rewardContainer.appendChild(contractSummary);

      rewardContainer.style.display = '';

      // Spawn the flying-out icon animation. Each entry gets a clone of
      // its sprite that starts at the chest centre, arcs upward, then
      // falls into the matching tile's icon slot. We use FLIP-style
      // measurement: read the chest-centre and tile-centre coordinates
      // *after* layout, then animate the clone with absolute pixel
      // offsets so it lines up perfectly regardless of viewport size.
      requestAnimationFrame(() => {
        const stageRect = stage.getBoundingClientRect();
        const chestRect = chestBtn.getBoundingClientRect();
        const startX = chestRect.left - stageRect.left + chestRect.width / 2;
        const startY = chestRect.top - stageRect.top + chestRect.height * 0.4;
        for (let i = 0; i < entries.length; i++) {
          const e = entries[i]!;
          const tile = tiles[i]!;
          const tileIconEl = tile.querySelector<HTMLElement>('.chest-reward-tile-icon');
          if (!tileIconEl) continue;
          const tileRect = tileIconEl.getBoundingClientRect();
          const endX = tileRect.left - stageRect.left + tileRect.width / 2;
          const endY = tileRect.top - stageRect.top + tileRect.height / 2;
          // Mid-arc apex sits a chest-height above the chest centre, with
          // a slight horizontal lean toward the tile so the arc reads as
          // a believable parabola (not a rainbow).
          const peakX = startX + (endX - startX) * 0.4;
          const peakY = startY - 140 - Math.random() * 40;
          spawnFlyOut({
            layer: flyLayer,
            tile,
            sprite: e.sprite,
            glow: !!e.glow,
            startX,
            startY,
            peakX,
            peakY,
            endX,
            endY,
            delayMs: 90 * i,
          });
        }
      });

      // Action buttons (Double via ad / To menu) — same logic as before,
      // but now grouped under a footer so the reward grid stays visually
      // separate from the CTA.
      let doubled = false;
      const footer = document.createElement('div');
      footer.className = 'menu-buttons chest-footer';

      const adBtn = document.createElement('button');
      adBtn.textContent = t('ui.victory.doubleAd');
      adBtn.className = 'chest-cta-double';
      adBtn.addEventListener('mouseenter', () => audio.playSfx('uiHover'));
      adBtn.addEventListener('click', () => {
        audio.playSfx('uiClick');
        if (doubled) return;
        void yandex.showRewarded().then((ok) => {
          if (!ok) return;
          doubled = true;
          doubleRewards(reward);
          overlay.showSimple({
            title: t('ui.victory.doubled'),
            subtitle: t('ui.victory.doubledSubtitle', {
              blue: reward.blue * 2,
              ancient: reward.ancient > 0
                ? t('ui.victory.doubledSubtitleAncient', { n: reward.ancient * 2 })
                : '',
            }),
            buttons: [
              { label: t('ui.common.toMenu'), primary: true, onClick: () => restart() },
            ],
          });
        });
      });
      footer.appendChild(adBtn);

      const menuBtn = document.createElement('button');
      menuBtn.textContent = t('ui.common.toMenu');
      menuBtn.addEventListener('mouseenter', () => audio.playSfx('uiHover'));
      menuBtn.addEventListener('click', () => {
        audio.playSfx('uiClick');
        restart();
      });
      footer.appendChild(menuBtn);

      rewardContainer.appendChild(footer);
    }
  });

  root.appendChild(panel);
  root.classList.add('visible');
}

/** Spawn one icon that flies out of the chest, peaks, and falls onto
 *  its target reward tile. Driven by stacked CSS animations: the X axis
 *  follows a `chest-fly-x` linear ease (start→peakX→endX in two halves)
 *  and the Y axis a `chest-fly-y` cubic ease so the arc looks like a
 *  parabolic toss. On animationend the flying clone is removed and the
 *  tile flips to its `landed` state, triggering the small bounce + glow
 *  pulse defined in CSS. */
function spawnFlyOut(args: {
  layer: HTMLElement;
  tile: HTMLElement;
  sprite: BakedSprite;
  glow: boolean;
  startX: number;
  startY: number;
  peakX: number;
  peakY: number;
  endX: number;
  endY: number;
  delayMs: number;
}): void {
  const fly = document.createElement('div');
  fly.className = 'chest-fly-out';
  const icon = spriteIcon(args.sprite, {
    scale: 3,
    extraClass: args.glow ? 'glow-gold' : '',
  });
  fly.appendChild(icon);
  // CSS variables drive the keyframe trajectory; this lets us reuse a
  // single keyframe pair for any number of icons / target positions.
  fly.style.setProperty('--start-x', `${args.startX}px`);
  fly.style.setProperty('--start-y', `${args.startY}px`);
  fly.style.setProperty('--peak-x', `${args.peakX}px`);
  fly.style.setProperty('--peak-y', `${args.peakY}px`);
  fly.style.setProperty('--end-x', `${args.endX}px`);
  fly.style.setProperty('--end-y', `${args.endY}px`);
  fly.style.animationDelay = `${args.delayMs}ms`;
  args.layer.appendChild(fly);
  fly.addEventListener('animationend', () => {
    fly.remove();
    args.tile.classList.remove('pending');
    args.tile.classList.add('landed');
  }, { once: true });
}

/** Tracks whether the defeat overlay has already been shown for the current
 *  run. Without this guard a stale `state.phase === 'gameover'` could trigger
 *  `showGameOver` more than once (e.g. after the player closes the doubled-
 *  reward sub-overlay), stacking a second copy of the panel on top of the
 *  first — what the player perceives as "old version, then new version". */
let gameOverShown = false;

function showGameOver(): void {
  if (gameOverShown) return;
  gameOverShown = true;
  yandex.gameplayStop();
  audio.playSfx('runDefeat');
  audio.playMusic('menu');
  tutorial.stop();
  // Defensive: tear down every sibling overlay so the defeat panel is the
  // only thing visible. The blessing / revive / endless-modifier / pause
  // overlays all share the same root, and any of them lingering would read
  // as "the old popup is still on screen" behind the new defeat panel.
  reviveOverlay.hide();
  blessingOverlay.hide();
  endlessModOverlay.hide();
  modifierPreview.hide();
  difficultyOverlay.hide();
  dailyEventOverlay.hide();
  pauseStats.hide();
  lawAnnounce.hide();
  const wave = state.waveState.currentIndex + 1;
  // FTUE: clearing wave 5 satisfies the tutorial even if the player
  // dies on a later wave — otherwise the entire script would replay on
  // their next run, since `tutorial.start()` resets the per-run state.
  if (!meta.tutorialDone && wave >= 5) {
    meta.tutorialDone = true;
  }
  const reward = awardRunEssence(false);
  const sprites = getSprites();
  const lastMode = state.difficulty;

  // Build the dramatic "Mannequin has fallen" panel. Custom DOM (instead
  // of overlay.showSimple) so we can compose: shattered red rays + sparks
  // backdrop, the fallen mannequin sprite, glitched title, reward chips,
  // a rotating tip line, and the dominant pulsing "Try again" CTA.
  const root = overlay.getRootElement();
  root.innerHTML = '';
  root.classList.remove('cards-mode');

  const panel = document.createElement('div');
  panel.className = 'panel defeat-overlay';

  // Backdrop: red rays that shimmer + a layer of upward-floating ember
  // particles. Both purely cosmetic — the real CTA hierarchy below is
  // what carries the "try again" emotion.
  const stage = document.createElement('div');
  stage.className = 'defeat-stage';
  panel.appendChild(stage);

  const rays = document.createElement('div');
  rays.className = 'defeat-rays';
  stage.appendChild(rays);

  const sparkLayer = document.createElement('div');
  sparkLayer.className = 'defeat-sparks';
  for (let i = 0; i < 14; i++) {
    const spark = document.createElement('span');
    spark.className = 'defeat-spark';
    spark.style.setProperty('--x', `${Math.round(Math.random() * 100)}%`);
    spark.style.setProperty('--delay', `${(Math.random() * 2.4).toFixed(2)}s`);
    spark.style.setProperty('--dur', `${(2.2 + Math.random() * 1.6).toFixed(2)}s`);
    spark.style.setProperty('--scale', `${(0.6 + Math.random() * 0.9).toFixed(2)}`);
    sparkLayer.appendChild(spark);
  }
  stage.appendChild(sparkLayer);

  // Fallen mannequin: reuse the existing battle sprite, rotated + dimmed
  // via CSS so it reads as "knocked over". A "crack" pseudo-element on
  // the wrapper paints a chest-fracture line over the chest plate.
  const mannequinWrap = document.createElement('div');
  mannequinWrap.className = 'defeat-mannequin';
  const fallen = spriteIcon(sprites.mannequin, { scale: 4, extraClass: 'defeat-mannequin-sprite' });
  mannequinWrap.appendChild(fallen);
  stage.appendChild(mannequinWrap);

  // Glitched title — letters jitter independently to sell the "system
  // failure" beat without us shipping an image. Each character gets a
  // randomized animation delay so they desync slightly.
  const titleText = t('ui.defeat.title');
  const title = document.createElement('h2');
  title.className = 'defeat-title';
  for (const ch of Array.from(titleText)) {
    if (ch === ' ') {
      title.appendChild(document.createTextNode(' '));
      continue;
    }
    const span = document.createElement('span');
    span.className = 'defeat-title-char';
    span.textContent = ch;
    span.dataset.char = ch;
    span.style.animationDelay = `${(Math.random() * 0.6).toFixed(2)}s`;
    title.appendChild(span);
  }
  panel.appendChild(title);

  const tagline = document.createElement('div');
  tagline.className = 'defeat-tagline';
  tagline.textContent = t('ui.defeat.tagline');
  panel.appendChild(tagline);

  // One-line summary — wave reached + kills, mirroring the victory chest.
  const summary = document.createElement('div');
  summary.className = 'defeat-summary';
  summary.textContent = t('ui.defeat.summary', {
    wave,
    total: totalWaves(state),
    kills: state.totalKills,
  });
  panel.appendChild(summary);

  // Reward chips: only the resources that actually accrued from the
  // partial run. Each chip uses the same canonical pixel-art icon as the
  // victory grid so the player sees concretely what they walked away
  // with — a visible "you didn't lose nothing" nudge to retry.
  const chipRow = document.createElement('div');
  chipRow.className = 'defeat-chips';
  const chips: { sprite: BakedSprite; amount: number; glow?: boolean }[] = [
    { sprite: sprites.iconCoin, amount: state.totalKills },
  ];
  if (reward.blue > 0) chips.push({ sprite: sprites.iconBlueEssence, amount: reward.blue });
  if (reward.ancient > 0) chips.push({ sprite: sprites.iconAncientEssence, amount: reward.ancient, glow: true });
  if (reward.epicKeys > 0) chips.push({ sprite: sprites.iconEpicKey, amount: reward.epicKeys });
  if (reward.ancientKeys > 0) chips.push({ sprite: sprites.iconAncientKey, amount: reward.ancientKeys, glow: true });
  if (reward.bpXp > 0) chips.push({ sprite: sprites.iconRerolls, amount: reward.bpXp });
  for (const c of chips) {
    const chip = document.createElement('div');
    chip.className = 'defeat-chip';
    chip.appendChild(spriteIcon(c.sprite, { scale: 2, extraClass: c.glow ? 'glow-gold' : '' }));
    const num = document.createElement('span');
    num.textContent = `+${c.amount}`;
    chip.appendChild(num);
    chipRow.appendChild(chip);
  }
  panel.appendChild(chipRow);

  // Random motivational tip — picks one of six Russian/English coaching
  // lines so a defeat screen never feels identical twice in a row, and
  // the player always leaves with a concrete "try this next time" hook.
  const tipKey = `ui.defeat.tip.${Math.floor(Math.random() * 6)}` as const;
  const tip = document.createElement('div');
  tip.className = 'defeat-tip';
  tip.textContent = t(tipKey);
  panel.appendChild(tip);

  // Footer — the primary CTA is "Try again" (gold, pulsing, oversized)
  // because the brief is "make the player want to retry". Secondary
  // actions (rewarded ad to double the partial-run reward, return to
  // menu) are demoted to a smaller row below.
  const ctaWrap = document.createElement('div');
  ctaWrap.className = 'defeat-cta-wrap';

  let doubled = false;
  const tryBtn = document.createElement('button');
  tryBtn.className = 'defeat-cta-primary';
  tryBtn.textContent = t('ui.defeat.tryAgain');
  tryBtn.addEventListener('mouseenter', () => audio.playSfx('uiHover'));
  tryBtn.addEventListener('click', () => {
    audio.playSfx('uiClick');
    // Epic / Ancient retries cost a key. Without this guard the player
    // could farm dungeons indefinitely from the defeat screen, even with
    // zero keys in inventory, since `consumeKey` was never called on
    // retry. Bounce back to the difficulty picker if no key is available.
    if (!consumeKey(lastMode)) {
      overlay.hide();
      restart();
      return;
    }
    overlay.hide();
    startRun(lastMode);
  });
  ctaWrap.appendChild(tryBtn);

  const secondaryRow = document.createElement('div');
  secondaryRow.className = 'defeat-secondary-row';

  const adBtn = document.createElement('button');
  adBtn.className = 'defeat-cta-secondary defeat-cta-double';
  adBtn.textContent = t('ui.victory.doubleAd');
  adBtn.addEventListener('mouseenter', () => audio.playSfx('uiHover'));
  adBtn.addEventListener('click', () => {
    audio.playSfx('uiClick');
    if (doubled) return;
    void yandex.showRewarded().then((ok) => {
      if (!ok) return;
      doubled = true;
      doubleRewards(reward);
      overlay.showSimple({
        title: t('ui.defeat.doubledTitle'),
        subtitle: t('ui.defeat.doubledSubtitle', { blue: reward.blue * 2 }),
        buttons: [
          {
            label: t('ui.defeat.tryAgain'),
            primary: true,
            onClick: () => {
              if (!consumeKey(lastMode)) {
                overlay.hide();
                restart();
                return;
              }
              overlay.hide();
              startRun(lastMode);
            },
          },
          { label: t('ui.common.toMenu'), onClick: () => restart() },
        ],
      });
    });
  });
  secondaryRow.appendChild(adBtn);

  const menuBtn = document.createElement('button');
  menuBtn.className = 'defeat-cta-secondary';
  menuBtn.textContent = t('ui.common.toMenu');
  menuBtn.addEventListener('mouseenter', () => audio.playSfx('uiHover'));
  menuBtn.addEventListener('click', () => {
    audio.playSfx('uiClick');
    restart();
  });
  secondaryRow.appendChild(menuBtn);

  ctaWrap.appendChild(secondaryRow);
  panel.appendChild(ctaWrap);

  root.appendChild(panel);
  root.classList.add('visible');
}

function showMainMenu(): void {
  meta = loadMeta();
  audio.setVolumes({ sfxVolume: meta.sfxVolume, musicVolume: meta.musicVolume });
  audio.playMusic('menu');
  // Closing one of the menu cards always tears down the walkthrough
  // (the targeted card disappears with the menu, so the spotlight
  // would no longer make sense). Only flip the meta-save flag when
  // the sequence was actually running — if it was deferred (e.g. a
  // wave-tutorial step is somehow still active), let it replay later.
  const dismissMenuTutorial = (): void => {
    const wasSequenceRunning = tutorial.isSequenceActive();
    tutorial.cancelSequence('mainMenuOpen');
    if (wasSequenceRunning && !meta.menuTutorialDone) {
      meta.menuTutorialDone = true;
      saveMeta(meta);
    }
  };
  mainMenu.show({
    meta,
    onBattle: () => {
      dismissMenuTutorial();
      mainMenu.hide();
      showDifficultySelect();
    },
    onLaboratory: () => {
      dismissMenuTutorial();
      mainMenu.hide();
      showLaboratory();
    },
    onDailyRewards: () => {
      dismissMenuTutorial();
      mainMenu.hide();
      showDailyRewards();
    },
    onSettings: () => {
      dismissMenuTutorial();
      mainMenu.hide();
      showSettings();
    },
    onCrafting: () => {
      dismissMenuTutorial();
      mainMenu.hide();
      showCrafting();
    },
    onLoadout: () => {
      dismissMenuTutorial();
      mainMenu.hide();
      showLoadout();
    },
  });
  // First-time main-menu walkthrough — fires once per save. Steps
  // whose target card isn't on-screen for some reason are skipped
  // automatically by the controller.
  if (!meta.menuTutorialDone) {
    tutorial.startSequence('mainMenuOpen', {
      onComplete: () => {
        meta.menuTutorialDone = true;
        saveMeta(meta);
      },
      onSkip: () => {
        meta.menuTutorialDone = true;
        saveMeta(meta);
      },
    });
  }
}

function showLoadout(): void {
  loadoutOverlay.show({
    meta,
    onSave: () => saveMeta(meta),
    onClose: () => {
      loadoutOverlay.hide();
      showMainMenu();
    },
  });
}

function showCrafting(): void {
  craftingOverlay.show({
    meta,
    onClose: () => {
      craftingOverlay.hide();
      showMainMenu();
    },
  });
}

function showDifficultySelect(): void {
  difficultyOverlay.show({
    meta,
    onSelect: (mode) => {
      if (mode === 'daily') {
        // Daily lives in the same picker as the regular modes now; route
        // through the dedicated event-preview overlay so the player sees
        // today's rotating event before starting.
        difficultyOverlay.hide();
        dailyEventOverlay.show({
          onStart: () => {
            dailyEventOverlay.hide();
            startRun('daily');
          },
          onClose: () => {
            dailyEventOverlay.hide();
            showDifficultySelect();
          },
        });
      } else if (mode === 'normal' || mode === 'endless') {
        difficultyOverlay.hide();
        startRun(mode);
      } else {
        // Show modifier preview before consuming the key.
        difficultyOverlay.hide();
        modifierPreview.show({
          mode,
          onConfirm: () => {
            if (!consumeKey(mode)) {
              modifierPreview.hide();
              showDifficultySelect();
              return;
            }
            modifierPreview.hide();
            startRun(mode);
          },
          onCancel: () => {
            modifierPreview.hide();
            showDifficultySelect();
          },
        });
      }
    },
    onClose: () => {
      difficultyOverlay.hide();
      showMainMenu();
    },
  });
}

function consumeKey(mode: DifficultyMode): boolean {
  if (mode === 'epic') {
    if (meta.epicKeys <= 0) return false;
    meta.epicKeys -= 1;
  } else if (mode === 'ancient') {
    if (meta.ancientKeys <= 0) return false;
    meta.ancientKeys -= 1;
  }
  saveMeta(meta);
  return true;
}

function startRun(mode: DifficultyMode): void {
  const seed = mode === 'daily' ? dailySeed() : undefined;
  state = buildInitialState(seed, mode);
  gameOverShown = false;
  resetShake();
  resetShockwaves();
  resetScreenFlash();
  applyMetaUpgrades(state, meta);
  applyBiomeModifiers(state);
  // Daily Experiment runs an MSK-day-of-week event with its own modifier
  // bundle, mannequin tweaks, and visual flags. Stack on top of biome.
  if (mode === 'daily') {
    applyDailyEventModifiers(state, getTodayDailyEvent());
  }
  // Roll the per-run "dungeon law" mutators (1 in Epic, 2 in Ancient).
  // No-op for other modes. Stacks on top of biome / daily event.
  applyRunMutators(state);
  // Roll the per-run side contracts (2 in Epic, 3 in Ancient). Contracts
  // are pure scoring goals — they don't touch combat numbers, only the
  // final reward bundle.
  applyRunContracts(state);
  attachRunInventory(state, meta);
  state.onIngredientDrop = (id, amount) => {
    const key = id as IngredientId;
    meta.ingredients[key] = (meta.ingredients[key] ?? 0) + amount;
    saveMeta(meta);
  };
  towerShop.attach(state);
  mannequinShop.attach(state);
  // Light up the FTUE for first-time players. We only run the tutorial on
  // standard difficulty — dropping into Epic/Ancient already means the
  // player has cleared the basics.
  if (!meta.tutorialDone && mode === 'normal') {
    tutorial.start();
  } else {
    tutorial.stop();
  }
  // Final transition is split out so the blessing/curse picker (Epic /
  // Ancient only) can interrupt synchronous startup — gameplay stays on
  // the `'menu'` phase until the player confirms their picks.
  const finishStart = (): void => {
    state.phase = 'preparing';
    state.waveState.pauseDurationLeft = INITIAL_PREP_DURATION;
    state.waveState.pauseTime = 0;
    yandex.gameplayStart();
  };
  // Roll & show the "Дар алхимика" picker. Epic = 1 of 3 blessings;
  // Ancient = 1 of 3 blessings + 1 of 3 curses (mandatory). Other modes
  // skip straight to the prep window.
  const blessingCount = blessingChoiceCount(mode);
  if (blessingCount > 0) {
    const blessingPool = state.rng.shuffle(BLESSINGS.slice()).slice(0, blessingCount);
    const cursePoolSize = curseChoiceCount(mode);
    const cursePool = cursePoolSize > 0
      ? state.rng.shuffle(CURSES.slice()).slice(0, cursePoolSize)
      : [];
    blessingOverlay.show({
      blessings: blessingPool,
      curses: cursePool,
      onComplete: ({ blessingId, curseId }) => {
        const bdef = BLESSING_BY_ID[blessingId];
        bdef.apply(state);
        state.activeBlessingIds = [blessingId];
        if (curseId) {
          const cdef = CURSE_BY_ID[curseId];
          cdef.apply(state);
          state.activeCurseId = curseId;
        }
        blessingOverlay.hide();
        finishStart();
      },
    });
  } else {
    finishStart();
  }
}

function showLaboratory(): void {
  metaOverlay.show({
    meta,
    onSave: () => saveMeta(meta),
    onStart: () => {
      metaOverlay.hide();
      showMainMenu();
    },
    onReset: () => {
      resetMeta();
      meta = loadMeta();
      metaOverlay.hide();
      showMainMenu();
    },
  });
}

function showDailyRewards(): void {
  dailyOverlay.show({
    meta,
    onClose: () => {
      dailyOverlay.hide();
      showMainMenu();
    },
  });
}

// @ts-ignore TS6133 — kept for future use
function showBattlePass(): void {
  bpOverlay.show({
    meta,
    onClose: () => {
      bpOverlay.hide();
      showMainMenu();
    },
  });
}

function showSettings(): void {
  settingsOverlay.show({
    meta,
    onClose: () => {
      settingsOverlay.hide();
      showMainMenu();
    },
    onReset: () => {
      settingsOverlay.hide();
      meta = loadMeta();
      showMainMenu();
    },
  });
}

// `showReviveOverlay()` previously rendered the "Манекен разрушен!"
// rewarded-ad / surrender prompt that fired before the new "Манекен пал"
// defeat panel. Players reported it as a duplicate "old popup", so the
// flow was retired — death now goes straight to the new defeat panel
// (see `game/enemy.ts`). The function and overlay class itself are
// retained intentionally: the revive overlay is still imported and
// .hide()-ed defensively in `showGameOver()` to clear any stale state
// from older save files, and we don't want to drop the dependency in
// case a future build wants to re-introduce a revive moment elsewhere.

function restart(): void {
  overlay.hide();
  // Force-dismiss any in-flight UI toasts so they don't bleed onto the
  // main menu on restart / exit-to-menu.
  lawAnnounce.hide();
  state = buildInitialState();
  towerShop.attach(state);
  mannequinShop.attach(state);
  showMainMenu();
}
