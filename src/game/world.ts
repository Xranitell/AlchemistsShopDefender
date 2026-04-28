import { Rng } from '../engine/rng';
import { v2 } from '../engine/math';
import type { Entrance } from './types';
import {
  newModifiers,
  type GameState,
  type Mannequin,
  type RunePoint,
  type WaveState,
} from './state';
import { DIFFICULTY_MODES, type DifficultyMode } from '../data/difficulty';

const ARENA_W = 1280;
const ARENA_H = 720;

export function buildEntrances(): Entrance[] {
  // Enemies spawn just off-screen (beyond the canvas edges) and walk onto
  // the arena floor. Order: top, right, bottom, left.
  const OFFSCREEN = 30;
  return [
    { pos: v2(ARENA_W / 2, -OFFSCREEN), active: false },
    { pos: v2(ARENA_W + OFFSCREEN, ARENA_H / 2), active: false },
    { pos: v2(ARENA_W / 2, ARENA_H + OFFSCREEN), active: false },
    { pos: v2(-OFFSCREEN, ARENA_H / 2), active: false },
  ];
}

export function buildRunePoints(): RunePoint[] {
  // 8 points on a ring around the centre, of which the first 4 (indices 0..3
  // in unlock order) are active by default. The remaining 4 slots unlock via
  // meta-progression — see `runePointUnlock` upgrades. The unlock order is
  // separate from the visual angle so each unlock opens a slot on a different
  // side of the arena rather than them all clustering together.
  const points: RunePoint[] = [];
  const cx = ARENA_W / 2;
  const cy = ARENA_H / 2;
  const rx = 250;
  const ry = 130;
  // Visual angles around the dais.
  const angles = [
    -Math.PI / 2,                  // 0  top         (active)
    -Math.PI / 2 + Math.PI / 4,    // 1  top-right   (locked)
    0,                              // 2  right       (active)
    Math.PI / 4,                    // 3  bottom-right(locked)
    Math.PI / 2,                    // 4  bottom      (active)
    Math.PI / 2 + Math.PI / 4,      // 5  bottom-left (locked)
    Math.PI,                        // 6  left        (active)
    -Math.PI / 2 - Math.PI / 4,     // 7  top-left    (locked)
  ];
  // Indices that start active. Other indices are revealed by meta upgrades —
  // `runePointUnlock` effects use 1-based slot numbers matching this list:
  // unlock 1 → index 1, unlock 2 → index 3, unlock 3 → index 5, unlock 4 → 7.
  const startActive = new Set([0, 2, 4, 6]);
  for (let i = 0; i < angles.length; i++) {
    const angle = angles[i]!;
    points.push({
      id: i,
      pos: { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry },
      active: startActive.has(i),
      towerId: null,
    });
  }
  return points;
}

/** Map a 1-based "rune unlock slot" (the value carried by a `runePointUnlock`
 *  meta effect) to the actual rune-point array index that should be opened.
 *  The mapping points only to the slots that start LOCKED, so an unlock can
 *  never be a no-op. */
export function runeUnlockSlotToIndex(slot: number): number {
  const LOCKED = [1, 3, 5, 7];
  const i = Math.max(0, Math.min(LOCKED.length - 1, slot - 1));
  return LOCKED[i]!;
}

export function buildMannequin(): Mannequin {
  return {
    pos: v2(ARENA_W / 2, ARENA_H / 2),
    hp: 120,
    maxHp: 120,
    basePotionDamage: 12,
    basePotionRadius: 60,
    basePotionCooldown: 1.3,
    potionTimer: 0,
    baseLootRadius: 110,
    damageFlash: 0,
    throwAnim: 0,
    throwDir: v2(0, -1),
  };
}

export function buildWaveState(): WaveState {
  return {
    currentIndex: -1,
    timeInWave: 0,
    pauseTime: 0,
    spawnedCount: 0,
    pendingSpawns: [],
    pauseDurationLeft: 0,
  };
}

export function buildInitialState(
  seed?: number,
  difficulty: DifficultyMode = 'normal',
): GameState {
  const mode = DIFFICULTY_MODES[difficulty];
  return {
    rng: new Rng(seed ?? (Date.now() >>> 0)),
    phase: 'preparing',
    arena: {
      width: ARENA_W,
      height: ARENA_H,
      center: v2(ARENA_W / 2, ARENA_H / 2),
      arenaRadius: 320,
    },
    entrances: buildEntrances(),
    runePoints: buildRunePoints(),
    mannequin: buildMannequin(),
    enemies: [],
    towers: [],
    projectiles: [],
    firePools: [],
    goldPickups: [],
    floatingTexts: [],
    reactionPools: [],
    gold: 90, // enough for one starter tower
    essence: 0,
    totalKills: 0,
    modifiers: newModifiers(),
    waveState: buildWaveState(),
    cardChoice: { options: [], pickedIds: [], rerollCost: 50, freeRerollUsed: false },
    overload: { charge: 0, maxCharge: 100 },
    aim: v2(ARENA_W / 2, ARENA_H / 2 - 200),
    manualFireRequested: false,
    overloadRequested: false,
    activeRunePoint: null,
    magnetTimer: 0,
    worldTime: 0,
    nextEntityId: 1,
    metaTowerDiscount: 0,
    metaTowerStartLevel: 1,
    metaOverloadRateMult: 1,
    metaMannequinArmor: 0,
    metaAutoRepairRate: 0,
    metaBossShield: 0,
    metaAutoRepairCooldown: 0,
    metaPotionAimBonus: 0,
    metaAuraRadiusMult: 1,
    difficulty,
    difficultyModifier: { ...mode.modifier, abilities: [...mode.modifier.abilities] },
    endlessLoop: 0,
    tempShieldTime: 0,
    tempShieldReduction: 0,
  };
}
