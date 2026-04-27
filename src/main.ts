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
import { render } from './game/render';
import { Hud } from './ui/hud';
import { CardOverlay } from './ui/cardOverlay';
import { TowerShop } from './ui/towerShop';
import type { GameState } from './game/state';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
const hudRoot = document.getElementById('hud') as HTMLDivElement | null;
const overlayRoot = document.getElementById('overlay') as HTMLDivElement | null;

if (!canvas || !hudRoot || !overlayRoot) {
  throw new Error('Game DOM not found');
}

const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D context not available');
ctx.imageSmoothingEnabled = true;

let state: GameState = buildInitialState();
const input = new Input(canvas);
const overlay = new CardOverlay(overlayRoot);
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
  state.aim = { ...input.state.mouse };

  // Pause input while UI overlays are visible (card_select, gameover, victory).
  const interactive = state.phase === 'wave' || state.phase === 'preparing';

  // Click handling.
  if (interactive && input.state.mousePressedThisFrame) {
    handleClick(input.state.mouse);
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

function showVictory(): void {
  yandex.gameplayStop();
  overlay.showSimple({
    title: 'Победа!',
    subtitle: `Ты защитил лавку и прошёл все ${totalWaves()} волн. Убийств: ${state.totalKills}. Золота собрано: ${state.gold}.`,
    buttons: [
      {
        label: 'Сыграть ещё раз',
        primary: true,
        onClick: () => restart(),
      },
    ],
  });
}

function showGameOver(): void {
  yandex.gameplayStop();
  overlay.showSimple({
    title: 'Манекен пал',
    subtitle: `Ты дошёл до волны ${state.waveState.currentIndex + 1}. Попробуй другой билд!`,
    buttons: [
      {
        label: 'Начать заново',
        primary: true,
        onClick: () => restart(),
      },
    ],
  });
}

function showMainMenu(): void {
  overlay.showSimple({
    title: "Alchemist's Shop Defender",
    subtitle:
      'Roguelike Tower Defense. Защити лавку, бросай склянки, ставь стойки и собирай билд через карты улучшений. ЛКМ — точный бросок. Q — Overload.',
    buttons: [
      {
        label: 'Начать забег',
        primary: true,
        onClick: () => {
          overlay.hide();
          startNextWave(state);
          yandex.gameplayStart();
        },
      },
    ],
  });
}

function restart(): void {
  state = buildInitialState();
  towerShop.attach(state);
  overlay.hide();
  showMainMenu();
}


