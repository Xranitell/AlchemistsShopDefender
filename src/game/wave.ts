import type { GameState } from './state';
import { newId } from './state';
import { newStatus } from './types';
import { ENEMIES } from '../data/enemies';
import { WAVES } from '../data/waves';

export function startNextWave(state: GameState): void {
  const ws = state.waveState;
  ws.currentIndex += 1;
  if (ws.currentIndex >= WAVES.length) {
    state.phase = 'victory';
    return;
  }
  const def = WAVES[ws.currentIndex]!;
  ws.timeInWave = 0;
  ws.spawnedCount = 0;
  ws.pendingSpawns = def.spawns.slice();

  // Light up the entrances used by this wave so the player can read threats.
  const used = new Set(def.spawns.map((s) => s.entrance));
  state.entrances.forEach((e, i) => {
    e.active = used.has(i);
  });

  // Boss shield (meta upgrade)
  if (def.isBoss && state.metaBossShield > 0) {
    state.mannequin.hp = Math.min(
      state.mannequin.maxHp,
      state.mannequin.hp + state.metaBossShield,
    );
  }

  state.phase = 'wave';
}

export function startPause(state: GameState): void {
  const ws = state.waveState;
  const def = WAVES[ws.currentIndex];
  ws.pauseTime = 0;
  ws.pauseDurationLeft = def?.pauseAfterSec ?? 6;
  state.entrances.forEach((e) => { e.active = false; });
  state.phase = 'preparing';
}

export function updateWave(state: GameState, dt: number): void {
  const ws = state.waveState;
  if (state.phase !== 'wave') return;
  const def = WAVES[ws.currentIndex];
  if (!def) return;
  ws.timeInWave += dt;

  // Spawn enemies whose timer has elapsed.
  while (ws.pendingSpawns.length > 0 && ws.pendingSpawns[0]!.at <= ws.timeInWave) {
    const spawn = ws.pendingSpawns.shift()!;
    const kind = ENEMIES[spawn.kind];
    if (!kind) continue;
    const entrance = state.entrances[spawn.entrance];
    if (!entrance) continue;
    const jitter = state.rng.range(-12, 12);
    const offset = state.rng.range(-12, 12);
    const px = entrance.pos.x + (spawn.entrance % 2 === 0 ? jitter : offset);
    const py = entrance.pos.y + (spawn.entrance % 2 === 1 ? jitter : offset);
    state.enemies.push({
      id: newId(state),
      kind,
      pos: { x: px, y: py },
      hp: kind.hp,
      maxHp: kind.hp,
      status: newStatus(),
      hitFlash: 0,
      goldPending: 0,
    });
    ws.spawnedCount += 1;
  }

  // Wave is over when all spawns finished and arena is empty.
  if (ws.pendingSpawns.length === 0 && state.enemies.length === 0) {
    if (ws.currentIndex >= WAVES.length - 1) {
      state.phase = 'victory';
    } else {
      // Award end-of-wave gold and trigger card draft.
      const reward = 25 + ws.currentIndex * 8;
      state.gold += reward;
      state.phase = 'card_select';
    }
  }
}

export function totalWaves(): number {
  return WAVES.length;
}
