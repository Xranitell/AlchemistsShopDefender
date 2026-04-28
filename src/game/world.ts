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
  // 6 points on a ring around the centre. Only every OTHER slot is active at
  // the start (3 active, 3 locked) so the player can't wall off every angle
  // of approach — the remaining slots unlock via meta-progression / shop.
  // Indices 0, 2, 4 are active; 1, 3, 5 are locked.
  const points: RunePoint[] = [];
  const cx = ARENA_W / 2;
  const cy = ARENA_H / 2;
  // Iso-plane: visually the ring is a 2:1 ellipse. Use a wider x-radius and
  // half y-radius so slot positions land on an iso-oval, matching the dais.
  const rx = 220;
  const ry = 110;
  const total = 6;
  for (let i = 0; i < total; i++) {
    const angle = (-Math.PI / 2) + (i / total) * Math.PI * 2;
    points.push({
      id: i,
      pos: { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry },
      active: i % 2 === 0,
      towerId: null,
    });
  }
  return points;
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
