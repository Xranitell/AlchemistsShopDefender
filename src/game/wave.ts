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

  // Spawn enemies whose timer has elapsed. Rather than using the 4 cardinal
  // entrance points, we pick a random angle inside the quadrant suggested by
  // the wave's entrance index and project that onto a point just off the
  // canvas edge. This keeps wave "direction" semantics (top/right/bottom/left)
  // while letting enemies emerge from any off-screen point around the arena.
  while (ws.pendingSpawns.length > 0 && ws.pendingSpawns[0]!.at <= ws.timeInWave) {
    const spawn = ws.pendingSpawns.shift()!;
    const kind = ENEMIES[spawn.kind];
    if (!kind) continue;

    // Cardinal base angles: 0=top, 1=right, 2=bottom, 3=left.
    // Top = -π/2, right = 0, bottom = π/2, left = π (on canvas y-down).
    const baseAngles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    const baseAngle = baseAngles[spawn.entrance % 4]!;
    // Wide ±60° jitter so a single wave direction still spans a full side.
    const angle = baseAngle + state.rng.range(-Math.PI / 3, Math.PI / 3);
    const { px, py } = pickOffscreenPoint(state, angle);
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

// Project a world-space angle onto a point just off the arena bounds so an
// enemy spawned there walks in from off-screen regardless of direction. We
// cast a ray from the arena centre along the angle and stop where it crosses
// the padded rectangle that surrounds the canvas.
function pickOffscreenPoint(
  state: GameState,
  angle: number,
): { px: number; py: number } {
  const OFFSCREEN = 40;
  const { width: W, height: H } = state.arena;
  const cx = W / 2;
  const cy = H / 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  // Find the smallest positive t so the ray hits the padded rect.
  const halfW = W / 2 + OFFSCREEN;
  const halfH = H / 2 + OFFSCREEN;
  const tX = Math.abs(dx) > 1e-4 ? halfW / Math.abs(dx) : Infinity;
  const tY = Math.abs(dy) > 1e-4 ? halfH / Math.abs(dy) : Infinity;
  const t = Math.min(tX, tY);
  const jitter = state.rng.range(-10, 10);
  // Small tangential jitter so spawns aren't perfectly lined up.
  const jx = -dy * jitter;
  const jy = dx * jitter;
  return {
    px: cx + dx * t + jx,
    py: cy + dy * t + jy,
  };
}
