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
import { render, getRenderCamera } from './game/render';
import { screenToWorld, worldToScreen } from './render/camera';
import { Hud } from './ui/hud';
import { CardOverlay } from './ui/cardOverlay';
import { TowerShop } from './ui/towerShop';
import { MannequinShop } from './ui/mannequinShop';
import { MetaOverlay } from './ui/metaOverlay';
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
import { setLocale, t, onLocaleChange } from './i18n';

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
  },
});
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
  } else {
    pauseStats.hide();
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
  // Update portrait-warning text for the current locale.
  const pw = document.getElementById('portrait-warning');
  if (pw) {
    const main = pw.querySelector('[data-i18n="ui.rotate"]');
    const sub = pw.querySelector('[data-i18n="ui.rotate.sub"]');
    if (main) main.textContent = t('ui.rotate');
    if (sub) sub.textContent = t('ui.rotate.sub');
  }
});

tutorial.attach(canvas, {
  onSkip: () => {
    meta.tutorialDone = true;
    saveMeta(meta);
  },
});

void (async () => {
  await yandex.init();
  yandex.loadingReady();
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

  if (!tutorialFrozen) state.worldTime += dt;

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
    if (state.revivePaused && !reviveOverlay.isVisible()) {
      showReviveOverlay();
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
          startPause(state);
          yandex.gameplayStart();
        }},
      ],
    });
  }
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
      startPause(state);
      yandex.gameplayStart();
    },
    // Skip: dismiss the draft entirely without applying a card. We still
    // notify the tutorial so the "you've seen the draft" gate trips.
    onSkip: options.length > 0 ? () => {
      tutorial.notify('cardPicked');
      state.contractStats.cardSkipUsed = true;
      overlay.hide();
      startPause(state);
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

/** Compose a reward-breakdown subtitle string for victory/defeat screens. */
function rewardBreakdown(r: { blue: number; ancient: number; epicKeys: number; ancientKeys: number; bpXp: number }, kills: number, wave: number, victory: boolean): string {
  const parts = [
    t('ui.reward.wave', { wave, total: totalWaves(state) }),
    t('ui.reward.kills', { n: kills }),
    t('ui.reward.blueGain', { n: r.blue }),
  ];
  if (r.ancient > 0) parts.push(t('ui.reward.ancientGain', { n: r.ancient }));
  if (r.epicKeys > 0) parts.push(t('ui.reward.epicKeyGain', { n: r.epicKeys }));
  if (r.ancientKeys > 0) parts.push(t('ui.reward.ancientKeyGain', { n: r.ancientKeys }));
  parts.push(t('ui.reward.bpGain', { n: r.bpXp }));
  if (victory) parts.unshift(t('ui.reward.chestOpened'));
  return parts.join(' • ');
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

  // Chest click-to-open mechanic: player taps the chest 3 times, then
  // it opens revealing the reward breakdown + double/menu buttons.
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

  const chestIcon = document.createElement('div');
  chestIcon.className = 'chest-icon';
  chestIcon.textContent = '🧰';
  panel.appendChild(chestIcon);

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
  rewardContainer.style.display = 'none';
  panel.appendChild(rewardContainer);

  chestIcon.addEventListener('click', () => {
    if (chestOpened) return;
    tapCount++;
    audio.playSfx('uiClick');

    // Shake animation
    chestIcon.classList.remove('shake');
    void chestIcon.offsetWidth; // reflow to re-trigger animation
    chestIcon.classList.add('shake');

    progressFill.style.width = `${Math.min(100, (tapCount / TAPS_NEEDED) * 100)}%`;
    hint.textContent = t('ui.chest.opening');

    if (tapCount >= TAPS_NEEDED) {
      chestOpened = true;
      chestIcon.classList.remove('shake');
      chestIcon.classList.add('opened');
      chestIcon.textContent = '✨';
      hint.style.display = 'none';
      progressBar.style.display = 'none';

      // Show reward after short delay
      setTimeout(() => {
        const rewardText = document.createElement('div');
        rewardText.className = 'chest-reward';
        rewardText.textContent = rewardBreakdown(reward, state.totalKills, wave, true);
        rewardContainer.appendChild(rewardText);

        // Per-contract summary: highlight goals that resolved as completed
        // and grey-out unfinished ones. Empty for runs without contracts.
        const contractSummary = renderContractsSummary(reward.completedContracts);
        if (contractSummary) rewardContainer.appendChild(contractSummary);

        rewardContainer.style.display = '';

        // Show action buttons
        let doubled = false;
        const wrap = document.createElement('div');
        wrap.className = 'menu-buttons';
        wrap.style.marginTop = '12px';

        const adBtn = document.createElement('button');
        adBtn.textContent = t('ui.victory.doubleAd');
        adBtn.style.borderColor = 'var(--accent)';
        adBtn.style.color = 'var(--accent)';
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
        wrap.appendChild(adBtn);

        const menuBtn = document.createElement('button');
        menuBtn.textContent = t('ui.common.toMenu');
        menuBtn.addEventListener('mouseenter', () => audio.playSfx('uiHover'));
        menuBtn.addEventListener('click', () => {
          audio.playSfx('uiClick');
          restart();
        });
        wrap.appendChild(menuBtn);

        rewardContainer.appendChild(wrap);
      }, 500);
    }
  });

  root.appendChild(panel);
  root.classList.add('visible');
}

function showGameOver(): void {
  yandex.gameplayStop();
  audio.playSfx('runDefeat');
  audio.playMusic('menu');
  tutorial.stop();
  const wave = state.waveState.currentIndex + 1;
  // FTUE: clearing wave 5 satisfies the tutorial even if the player
  // dies on a later wave — otherwise the entire script would replay on
  // their next run, since `tutorial.start()` resets the per-run state.
  if (!meta.tutorialDone && wave >= 5) {
    meta.tutorialDone = true;
  }
  const reward = awardRunEssence(false);
  overlay.showSimple({
    title: t('ui.defeat.title'),
    subtitle: rewardBreakdown(reward, state.totalKills, wave, false) + t('ui.defeat.subtitleSuffix'),
    buttons: [
      {
        label: t('ui.victory.doubleAd'),
        primary: true,
        onClick: () => {
          void yandex.showRewarded().then((ok) => {
            if (!ok) return;
            doubleRewards(reward);
            overlay.showSimple({
              title: t('ui.defeat.doubledTitle'),
              subtitle: t('ui.defeat.doubledSubtitle', { blue: reward.blue * 2 }),
              buttons: [{ label: t('ui.common.toMenu'), primary: true, onClick: () => restart() }],
            });
          });
        },
      },
      { label: t('ui.common.toMenu'), onClick: () => restart() },
    ],
  });
}

function showMainMenu(): void {
  meta = loadMeta();
  audio.setVolumes({ sfxVolume: meta.sfxVolume, musicVolume: meta.musicVolume });
  audio.playMusic('menu');
  mainMenu.show({
    meta,
    onBattle: () => {
      mainMenu.hide();
      showDifficultySelect();
    },
    onLaboratory: () => {
      mainMenu.hide();
      showLaboratory();
    },
    onBattlePass: () => {
      mainMenu.hide();
      showBattlePass();
    },
    onDailyRewards: () => {
      mainMenu.hide();
      showDailyRewards();
    },
    onSettings: () => {
      mainMenu.hide();
      showSettings();
    },
    onCrafting: () => {
      mainMenu.hide();
      showCrafting();
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

function showReviveOverlay(): void {
  yandex.gameplayStop();
  reviveOverlay.show({
    onRevive: () => {
      void yandex.showRewarded().then((ok) => {
        reviveOverlay.hide();
        // Guard: if user already clicked Give Up while ad was loading, bail.
        if (!state.revivePaused) return;
        if (!ok) {
          // Ad failed or was skipped — game over.
          state.revivePaused = false;
          state.reviveUsed = true;
          state.phase = 'gameover';
          return;
        }
        state.reviveUsed = true;
        state.revivePaused = false;
        state.mannequin.hp = Math.round(state.mannequin.maxHp * 0.5);
        state.tempShieldTime = 4;
        state.tempShieldReduction = 0.8;
        yandex.gameplayStart();
      });
    },
    onGiveUp: () => {
      reviveOverlay.hide();
      state.revivePaused = false;
      state.reviveUsed = true;
      state.phase = 'gameover';
    },
  });
}

function restart(): void {
  overlay.hide();
  state = buildInitialState();
  towerShop.attach(state);
  mannequinShop.attach(state);
  showMainMenu();
}


