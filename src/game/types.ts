import type { Vec2 } from '../engine/math';

export type Element = 'neutral' | 'fire' | 'mercury' | 'acid' | 'aether';

export interface StatusEffects {
  /** Burn applies damage over time, in HP/sec, while remaining > 0. */
  burnDps: number;
  burnTime: number;
  /** Slow multiplier applied to enemy speed (e.g. 0.5 = 50% speed). */
  slowFactor: number;
  slowTime: number;
  /** Armor reduction factor (1 = full armor, 0 = no armor). */
  armorBreakFactor: number;
  armorBreakTime: number;
  /** Aether mark: tracks recent aether damage for reaction triggers. */
  aetherMarkTime: number;
}

export const newStatus = (): StatusEffects => ({
  burnDps: 0,
  burnTime: 0,
  slowFactor: 1,
  slowTime: 0,
  armorBreakFactor: 1,
  armorBreakTime: 0,
  aetherMarkTime: 0,
});

export interface EnemyKind {
  id: string;
  name: string;
  hp: number;
  speed: number; // px / sec
  armor: number; // damage reduction 0..1
  goldDrop: [number, number];
  damage: number; // damage to mannequin on touch
  radius: number;
  color: string;
  isBoss?: boolean;
}

export interface TowerKind {
  id: string;
  name: string;
  cost: number;
  damage: number;
  range: number;
  fireRate: number; // shots per second
  projectileSpeed: number;
  splashRadius: number;
  element: Element;
  color: string;
  desc: string;
}

export type CardCategory = 'recipe' | 'engineering' | 'ritual' | 'catalyst';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface CardDef {
  id: string;
  name: string;
  category: CardCategory;
  rarity: Rarity;
  desc: string;
}

export interface WaveDef {
  index: number; // 1-based for player display
  isBoss: boolean;
  durationSec: number;
  pauseAfterSec: number;
  /** Enemy spawn schedule: [enemyKindId, spawnTimeSec, entranceIndex]. */
  spawns: { kind: string; at: number; entrance: number }[];
}

export interface Entrance {
  pos: Vec2;
  active: boolean;
}
