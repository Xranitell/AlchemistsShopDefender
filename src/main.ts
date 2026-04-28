import './style.css';
import { Input } from './engine/input';
import { Loop } from './engine/loop';
import { dist } from './engine/math';
import { yandex } from './yandex';
import { buildInitialState } from './game/world';
import { updateMannequin } from './game/mannequin';
import { updateEnemies, updateGoldPickups, updateFirePools, updateFloatingTexts } from './game/enemy';
import { updateReactionPools } from './game/reactions';
import { updateTowers } from './game/tower';
import { updateProjectiles } from './game/projectile';
import { startNextWave, startPause, updateWave, totalWaves } from './game/wave';
import { applyCard, rollCardOptions } from './game/cards';
import { tickOverloadEffect } from './game/overload';
import { render, getRenderCamera } from './game/render';
import { screenToWorld } from './render/camera';
import { Hud } from './ui/hud';
import { CardOverlay } from './ui/cardOverlay';
import { TowerShop } from './ui/towerShop';
import { MetaOverlay } from './ui/metaOverlay';
import { MainMenu } from './ui/mainMenu';
import { DailyRewardsOverlay } from './ui/dailyRewardsOverlay';
import { BattlePassOverlay, addBpXp } from './ui/battlePassOverlay';
import { SettingsOverlay } from './ui/settingsOverlay';
import { DifficultyOverlay } from './ui/difficultyOverlay';
import { ModifierPreviewOverlay } from './ui/modifierPreviewOverlay';
import type { DifficultyMode } from './data/difficulty';
import { BP_XP_PER_WAVE, BP_XP_PER_KILL, BP_XP_VICTORY } from './data/battlePass';
import type { GameState } from './game/state';
import { loadMeta, saveMeta, resetMeta, type MetaSave } from './game/save';
import { applyMetaUpgrades, buyMetaUpgrade, calcRunEssence } from './game/meta';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
const hudRoot = document.getElementById('hud') as HTMLDivElement | null;
const overlayRoot = document.getElementById('overlay') as HTMLDivElement | null;

if (!canvas || !hudRoot || !overlayRoot) {
  throw new Error('Game DOM not found');
}

const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D context not available');
ctx.imageSmoothingEnabled = true;

let meta: MetaSave = loadMeta();
let state: GameState = buildInitialState();
const input = new Input(canvas);
const overlay = new CardOverlay(overlayRoot);
const metaOverlay = new MetaOverlay(overlayRoot);
const mainMenu = new MainMenu(overlayRoot);
const dailyOverlay = new DailyRewardsOverlay(overlayRoot);
const bpOverlay = new BattlePassOverlay(overlayRoot);
const settingsOverlay = new SettingsOverlay(overlayRoot);
const difficultyOverlay = new DifficultyOverlay(overlayRoot);
const modifierPreview = new ModifierPreviewOverlay(overlayRoot);
const towerShop = new TowerShop(hudRoot);
towerShop.attach(state);

const hud = new Hud(hudRoot, {
  onPause: () => {},
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
});

const loop = new Loop((dt) => tick(dt));

void (async () => {
  await yandex.init();
  yandex.loadingReady();
  showMainMenu();
  loop.start();
})();

function tick(dt: number): void {
  state.worldTime += dt;
  // Convert screen mouse position to world coordinates through inverse iso transform
  const cam = getRenderCamera(state.arena.width, state.arena.height);
  state.aim = screenToWorld(input.state.mouse.x, input.state.mouse.y, cam);

  // Pause input while UI overlays are visible (card_select, gameover, victory).
  const interactive = state.phase === 'wave' || state.phase === 'preparing';

  // Click handling.
  if (interactive && input.state.mousePressedThisFrame) {
    const worldClick = screenToWorld(input.state.mouse.x, input.state.mouse.y, cam);
    handleClick(worldClick);
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
  input.endFrame();

  // Phase update.
  if (state.phase === 'preparing') {
    state.waveState.pauseTime += dt;
    state.waveState.pauseDurationLeft -= dt;
    if (state.waveState.pauseDurationLeft <= 0 && state.waveState.currentIndex >= 0) {
      towerShop.close();
      startNextWave(state);
    }
  }

  if (state.phase === 'wave') {
    updateMannequin(state, dt);
    updateTowers(state, dt);
    updateProjectiles(state, dt);
    updateEnemies(state, dt);
    updateFirePools(state, dt);
    updateReactionPools(state, dt);
    updateGoldPickups(state, dt);
    updateFloatingTexts(state, dt);
    tickOverloadEffect(dt);
    updateWave(state, dt);
  } else if (state.phase === 'preparing') {
    // Allow projectile and gold pickup decay during pause for clean transitions.
    updateProjectiles(state, dt);
    updateGoldPickups(state, dt);
    updateFloatingTexts(state, dt);
  }

  // Auto-repair ticks in both wave and preparing phases
  if ((state.phase === 'wave' || state.phase === 'preparing') && state.metaAutoRepairRate > 0) {
    state.metaAutoRepairCooldown = Math.max(0, state.metaAutoRepairCooldown - dt);
    if (state.metaAutoRepairCooldown <= 0 && state.mannequin.hp < state.mannequin.maxHp) {
      state.mannequin.hp = Math.min(
        state.mannequin.maxHp,
        state.mannequin.hp + state.metaAutoRepairRate * dt,
      );
    }
  }

  // Phase transitions that drive overlays.
  if (state.phase === 'card_select' && !overlay.isVisible()) {
    showCardOverlay();
  }
  if (state.phase === 'victory' && !overlay.isVisible()) {
    showVictory();
  }
  if (state.phase === 'gameover' && !overlay.isVisible()) {
    showGameOver();
  }

  render(ctx!, state);
  hud.update(state);
}

function handleClick(at: { x: number; y: number }): void {
  // Rune point click → tower shop.
  for (const rp of state.runePoints) {
    if (!rp.active) continue;
    if (dist(at, rp.pos) < 22) {
      const screen = canvasToScreen(canvas!, rp.pos);
      towerShop.open(rp.id, screen);
      return;
    }
  }

  // Otherwise, throw potion (only during wave or just before).
  if (state.phase === 'wave') {
    state.manualFireRequested = true;
  }
  // If shop was open and user clicked elsewhere, close it.
  if (towerShop.isOpen()) towerShop.close();
}

function canvasToScreen(c: HTMLCanvasElement, gamePos: { x: number; y: number }) {
  const rect = c.getBoundingClientRect();
  const sx = rect.width / c.width;
  const sy = rect.height / c.height;
  const parent = c.parentElement!.getBoundingClientRect();
  return {
    x: rect.left - parent.left + gamePos.x * sx,
    y: rect.top - parent.top + gamePos.y * sy,
  };
}

function showCardOverlay(): void {
  yandex.gameplayStop();
  const options = rollCardOptions(state);
  state.cardChoice.options = options;
  const idx = state.waveState.currentIndex;
  overlay.show({
    title: `Волна ${idx + 1} пройдена`,
    subtitle: options.length > 0
      ? 'Выбери одну карту улучшения. Между волнами можно докупить стойки.'
      : 'Все карты MVP уже получены.',
    cards: options,
    onPick: (card) => {
      applyCard(state, card);
      overlay.hide();
      startPause(state);
      yandex.gameplayStart();
    },
  });

  if (options.length === 0) {
    // Auto-continue if no cards left.
    overlay.showSimple({
      title: `Волна ${idx + 1} пройдена`,
      subtitle: 'Карт улучшений не осталось. Готовься к следующей волне.',
      buttons: [
        { label: 'Дальше', primary: true, onClick: () => {
          overlay.hide();
          startPause(state);
          yandex.gameplayStart();
        }},
      ],
    });
  }
}

function awardRunEssence(victory: boolean): void {
  const wave = state.waveState.currentIndex + 1;
  const reward = calcRunEssence(meta, wave, state.totalKills, victory);
  meta.blueEssence += reward.blue;
  meta.ancientEssence += reward.ancient;
  meta.totalRuns += 1;
  if (wave > meta.bestWave) meta.bestWave = wave;
  // Battle pass XP
  const bpXp = wave * BP_XP_PER_WAVE + state.totalKills * BP_XP_PER_KILL + (victory ? BP_XP_VICTORY : 0);
  addBpXp(meta, bpXp);
  saveMeta(meta);
}

function showVictory(): void {
  yandex.gameplayStop();
  awardRunEssence(true);
  const wave = state.waveState.currentIndex + 1;
  const reward = calcRunEssence(meta, wave, state.totalKills, true);
  overlay.showSimple({
    title: 'Победа!',
    subtitle: `Все ${totalWaves()} волн пройдены! Убийств: ${state.totalKills}. +${reward.blue} СЭ${reward.ancient > 0 ? `, +${reward.ancient} ДЭ` : ''}.`,
    buttons: [
      {
        label: 'Улучшения',
        primary: true,
        onClick: () => restart(),
      },
    ],
  });
}

function showGameOver(): void {
  yandex.gameplayStop();
  awardRunEssence(false);
  const wave = state.waveState.currentIndex + 1;
  const reward = calcRunEssence(meta, wave, state.totalKills, false);
  overlay.showSimple({
    title: 'Манекен пал',
    subtitle: `Волна ${wave}. Убийств: ${state.totalKills}. +${reward.blue} СЭ. Улучши манекена и попробуй снова!`,
    buttons: [
      {
        label: 'Улучшения',
        primary: true,
        onClick: () => restart(),
      },
    ],
  });
}

function showMainMenu(): void {
  meta = loadMeta();
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
  });
}

function showDifficultySelect(): void {
  difficultyOverlay.show({
    meta,
    onSelect: (mode) => {
      if (mode === 'normal' || mode === 'endless') {
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
  state = buildInitialState(undefined, mode);
  applyMetaUpgrades(state, meta);
  towerShop.attach(state);
  startNextWave(state);
  yandex.gameplayStart();
}

function showLaboratory(): void {
  metaOverlay.show({
    meta,
    onBuy: (upg) => {
      const ok = buyMetaUpgrade(meta, upg);
      if (ok) saveMeta(meta);
      return ok;
    },
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

function restart(): void {
  overlay.hide();
  showMainMenu();
}


