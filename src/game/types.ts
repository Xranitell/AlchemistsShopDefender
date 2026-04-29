import type { Vec2 } from '../engine/math';

export type Element = 'neutral' | 'fire' | 'mercury' | 'acid' | 'aether' | 'frost' | 'poison';

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
  /** Frost mark: enemy is "chilled" (slowed AND vulnerable to brittle). */
  frostMarkTime: number;
  /** Poison damage-over-time, similar to burn but armor-piercing. */
  poisonDps: number;
  poisonTime: number;
}

export const newStatus = (): StatusEffects => ({
  burnDps: 0,
  burnTime: 0,
  slowFactor: 1,
  slowTime: 0,
  armorBreakFactor: 1,
  armorBreakTime: 0,
  aetherMarkTime: 0,
  frostMarkTime: 0,
  poisonDps: 0,
  poisonTime: 0,
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
  /** Special behavior tag. Towers without a behavior fire a regular tracking
   *  projectile. */
  behavior?: TowerBehavior;
}

export type TowerBehavior =
  | 'projectile'
  /** Эфирная катушка: instant chain-lightning that arcs to up to N nearby
   *  enemies, dealing decreasing damage with each hop. */
  | 'chain'
  /** Сторожевой фонарь: passive aura tower — never fires a projectile, but
   *  buffs other towers within `range`. */
  | 'aura';

export type CardCategory = 'recipe' | 'engineering' | 'ritual' | 'catalyst';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface CardDef {
  id: string;
  name: string;
  category: CardCategory;
  rarity: Rarity;
  desc: string;
  /** Cursed cards combine 2-3 strong stat boosts with a unique effect AND a
   *  drawback (weakened mannequin / towers, or strengthened enemies). They
   *  are only offered every 3rd wave (see {@link rollCardOptions}) and use a
   *  distinct dark-purple frame in the card draft UI. */
  isCursed?: boolean;
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
