import type { GameState } from './state';
import { newId, ENDLESS_MODIFIER_POOL } from './state';
import { newStatus, type EnemyKind } from './types';
import type { Vec2 } from '../engine/math';
import { ENEMIES } from '../data/enemies';
import { WAVES } from '../data/waves';
import type { EnemyAbility } from '../data/difficulty';
import { audio } from '../audio/audio';

/** Configured length of the active wave in seconds, or 0 if no wave is set. */
export function currentWaveDuration(state: GameState): number {
  const def = WAVES[state.waveState.currentIndex];
  return def?.durationSec ?? 0;
}

/** Configured length of the upcoming pause (used while the game is in the
 *  'preparing' phase). Falls back to a sensible default when no wave has run
 *  yet (e.g. just after starting a new run). */
export function currentPauseDuration(state: GameState): number {
  const idx = state.waveState.currentIndex;
  if (idx < 0) return Math.max(state.waveState.pauseDurationLeft, 6);
  const def = WAVES[idx];
  return def?.pauseAfterSec ?? 6;
}

export function startNextWave(state: GameState): void {
  const ws = state.waveState;
  ws.currentIndex += 1;
  if (ws.currentIndex >= WAVES.length) {
    if (state.difficulty === 'endless') {
      // Endless: loop back to wave 0 with stiffer modifiers + random
      // modifier from the pool. Show the modifier selector overlay first.
      state.endlessLoop += 1;
      ws.currentIndex = 0;

      // Roll a random modifier from the pool.
      const pool = ENDLESS_MODIFIER_POOL;
      const idx = state.rng.int(0, pool.length);
      state.pendingEndlessModifier = pool[idx]!.id;
      state.phase = 'endless_modifier_select';
      return;
    } else {
      state.phase = 'victory';
      return;
    }
  }
  doStartWave(state);
}

/** Shared wave-start logic used by both startNextWave and confirmEndlessModifier. */
function doStartWave(state: GameState): void {
  const ws = state.waveState;
  const def = WAVES[ws.currentIndex]!;
  ws.timeInWave = 0;
  ws.spawnedCount = 0;

  // Clone spawns; add +2 extra enemies per `extra_enemies` modifier accumulated.
  const extraCount = state.endlessModifiers.filter((m) => m.id === 'extra_enemies').length * 2;
  const baseSpawns = def.spawns.slice();
  const extra: typeof baseSpawns = [];
  for (let i = 0; i < extraCount; i++) {
    const template = baseSpawns[i % baseSpawns.length]!;
    extra.push({
      kind: template.kind,
      at: (def.durationSec - 1) * Math.random(),
      entrance: state.rng.int(0, 3),
    });
  }
  ws.pendingSpawns = [...baseSpawns, ...extra].sort((a, b) => a.at - b.at);

  // Boss waves swap to the dedicated boss music track and play a stinger;
  // otherwise we just bump the regular waveStart fanfare.
  if (def.isBoss) {
    audio.playSfx('bossSpawn');
    audio.playMusic('boss');
  } else {
    audio.playSfx('waveStart');
    audio.playMusic('battle');
  }

  // Light up the entrances used by this wave so the player can read threats.
  const used = new Set(ws.pendingSpawns.map((s) => s.entrance));
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
    const pos = pickOffscreenPoint(state, angle);
    spawnEnemy(state, kind, pos);
    ws.spawnedCount += 1;
  }

  // Wave is over when all spawns finished and arena is empty.
  if (ws.pendingSpawns.length === 0 && state.enemies.length === 0) {
    if (state.difficulty === 'endless') {
      // Award end-of-wave gold and trigger card draft — no victory.
      const reward = 25 + ws.currentIndex * 8;
      state.gold += reward;
      state.phase = 'card_select';
    } else if (ws.currentIndex >= WAVES.length - 1) {
      state.phase = 'victory';
    } else {
      // Award end-of-wave gold and trigger card draft.
      const reward = 25 + ws.currentIndex * 8;
      state.gold += reward;
      state.phase = 'card_select';
    }
  }
}

/**
 * Spawn an enemy with the current difficulty's HP/speed/abilities applied.
 * `splitGeneration` is used by the slime-split ability so offspring cannot
 * infinitely chain.
 */
export function spawnEnemy(
  state: GameState,
  kind: EnemyKind,
  pos: Vec2,
  splitGeneration = 0,
): void {
  const mod = state.difficultyModifier;
  const maxHp = Math.round(kind.hp * mod.hpMult);
  const abilities = pickEnemyAbilities(kind.id, mod.abilities);
  // Homunculus enters phase 1 and starts summoning minions every 4 sec.
  const isHomunculus = kind.id === 'boss_homunculus';
  state.enemies.push({
    id: newId(state),
    kind,
    pos: { x: pos.x, y: pos.y },
    hp: maxHp,
    maxHp,
    status: newStatus(),
    hitFlash: 0,
    goldPending: 0,
    abilities,
    shieldCharges: abilities.includes('one_hit_shield') ? 1 : 0,
    dashBackTimer: 0,
    splitGeneration,
    damageTaken: 1,
    sapperFuse: 0,
    bossPhase: isHomunculus ? 1 : 0,
    minionSummonTimer: isHomunculus ? 4 : 0,
  });
}

/**
 * Only attach abilities that actually make sense for a given enemy kind.
 * For example, `split_on_death` is flavoured for slimes, `one_hit_shield`
 * for golems, etc.
 */
function pickEnemyAbilities(kindId: string, abilities: EnemyAbility[]): EnemyAbility[] {
  const out: EnemyAbility[] = [];
  for (const a of abilities) {
    switch (a) {
      case 'split_on_death':
        if (kindId === 'slime' || kindId === 'miniboss_slime') out.push(a);
        break;
      case 'one_hit_shield':
        if (kindId === 'golem' || kindId === 'boss_rat_king') out.push(a);
        break;
      case 'dash_back_on_hit':
        if (kindId === 'rat' || kindId === 'flying_flask') out.push(a);
        break;
      case 'explode_on_death':
        if (kindId === 'flying_flask') out.push(a);
        break;
      case 'aura_heal':
        if (kindId === 'shaman') out.push(a);
        break;
    }
  }
  return out;
}

/** Apply the pending endless modifier, push it to the cumulative list,
 *  and start the next wave cycle. Called from the UI after the player
 *  sees the modifier selector. */
export function confirmEndlessModifier(state: GameState): void {
  const modId = state.pendingEndlessModifier;
  if (!modId) return;
  const mod = ENDLESS_MODIFIER_POOL.find((m) => m.id === modId);
  if (mod) state.endlessModifiers.push(mod);

  // Apply the modifier to the difficulty bundle.
  switch (modId) {
    case 'hp_x125':
      state.difficultyModifier.hpMult *= 1.25;
      break;
    case 'speed_x110':
      state.difficultyModifier.speedMult *= 1.10;
      break;
    case 'gold_minus10':
      state.difficultyModifier.goldMult *= 0.90;
      break;
    case 'extra_enemies':
      // Handled at spawn time — flag stored in endlessModifiers list.
      break;
    case 'elites_on_normal':
      // Handled at spawn time — adds elite abilities on non-boss waves.
      if (!state.difficultyModifier.abilities.includes('one_hit_shield')) {
        state.difficultyModifier.abilities.push('one_hit_shield');
      }
      if (!state.difficultyModifier.abilities.includes('dash_back_on_hit')) {
        state.difficultyModifier.abilities.push('dash_back_on_hit');
      }
      break;
  }

  state.pendingEndlessModifier = null;
  // Resume: start the first wave of the new cycle.
  doStartWave(state);
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
): Vec2 {
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
    x: cx + dx * t + jx,
    y: cy + dy * t + jy,
  };
}
