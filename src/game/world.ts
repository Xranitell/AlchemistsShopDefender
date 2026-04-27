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

const ARENA_W = 1280;
const ARENA_H = 720;

export function buildEntrances(): Entrance[] {
  // Top, right, bottom, left.
  return [
    { pos: v2(ARENA_W / 2, 30), active: false },
    { pos: v2(ARENA_W - 30, ARENA_H / 2), active: false },
    { pos: v2(ARENA_W / 2, ARENA_H - 30), active: false },
    { pos: v2(30, ARENA_H / 2), active: false },
  ];
}

export function buildRunePoints(): RunePoint[] {
  // 6 points on a ring around the centre. The first 4 are "active" in the
  // vertical slice; the last 2 are placeholders for meta-progression.
  const points: RunePoint[] = [];
  const cx = ARENA_W / 2;
  const cy = ARENA_H / 2;
  const r = 170;
  const total = 6;
  for (let i = 0; i < total; i++) {
    const angle = (-Math.PI / 2) + (i / total) * Math.PI * 2;
    points.push({
      id: i,
      pos: { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r },
      active: i < 4,
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

export function buildInitialState(seed?: number): GameState {
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
    gold: 90, // enough for one starter tower
    totalKills: 0,
    modifiers: newModifiers(),
    waveState: buildWaveState(),
    cardChoice: { options: [], pickedIds: [] },
    overload: { charge: 0, maxCharge: 100 },
    aim: v2(ARENA_W / 2, ARENA_H / 2 - 200),
    manualFireRequested: false,
    overloadRequested: false,
    activeRunePoint: null,
    worldTime: 0,
    nextEntityId: 1,
  };
}
