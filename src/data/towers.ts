import type { TowerKind } from '../game/types';
import { tWithFallback } from '../i18n';

/** Localised display name for a tower; falls back to the source-of-truth
 *  Russian name from this file when no translation is registered. */
export function towerName(kind: TowerKind): string {
  return tWithFallback(`towers.${kind.id}.name`, kind.name);
}

/** Localised tower description (one-liner shown in the build menu). */
export function towerDesc(kind: TowerKind): string {
  return tWithFallback(`towers.${kind.id}.desc`, kind.desc);
}

export const TOWERS: Record<string, TowerKind> = {
  needler: {
    id: 'needler',
    name: 'Игломет',
    cost: 60,
    damage: 6,
    range: 220,
    fireRate: 2.4,
    projectileSpeed: 540,
    splashRadius: 0,
    element: 'neutral',
    color: '#d6d6e0',
    desc: 'Дешёвая стойка с быстрой одиночной стрельбой.',
  },
  mortar: {
    id: 'mortar',
    name: 'Алхимическая мортира',
    cost: 130,
    damage: 48,
    // Long arc: outranges every other turret so the splash zone can
    // cover most of an entrance corridor from the back rune.
    range: 360,
    // One shot every ~3.3 seconds. The mortar is positioned as a
    // "siege" piece — it rarely fires, but every shell deletes a
    // packed cluster.
    fireRate: 0.30,
    // Slow shell so the player can read it travelling — important
    // visual since the splash can wipe an entire wave when it lands.
    projectileSpeed: 320,
    // Significantly wider splash than before (60 → 140). The visual
    // ring now coincides with what `applyAreaDamage` already used.
    splashRadius: 140,
    element: 'fire',
    color: '#ff8c5a',
    desc: 'Редкие, но мощные снаряды по большой площади. Идеальна против плотных групп.',
  },
  mercury_sprayer: {
    id: 'mercury_sprayer',
    name: 'Ртутный распылитель',
    cost: 90,
    damage: 4,
    range: 200,
    fireRate: 1.8,
    projectileSpeed: 420,
    splashRadius: 45,
    element: 'mercury',
    color: '#c9c9d8',
    desc: 'Конус замедления. Контролирует проход.',
  },
  acid_injector: {
    id: 'acid_injector',
    name: 'Кислотный инжектор',
    cost: 100,
    damage: 8,
    range: 240,
    fireRate: 1.2,
    projectileSpeed: 480,
    splashRadius: 0,
    element: 'acid',
    color: '#d2f55a',
    desc: 'Снимает броню одиночной цели. Для элиты и боссов.',
  },
  ether_coil: {
    id: 'ether_coil',
    name: 'Эфирная катушка',
    cost: 130,
    damage: 7,
    range: 230,
    fireRate: 1.4,
    projectileSpeed: 0,
    splashRadius: 0,
    element: 'aether',
    color: '#a78bfa',
    desc: 'Цепная молния: бьёт цель и перепрыгивает на 2 ближайших врага.',
    behavior: 'chain',
  },
  watch_tower: {
    id: 'watch_tower',
    name: 'Сторожевой фонарь',
    cost: 80,
    damage: 0,
    range: 200,
    fireRate: 0,
    projectileSpeed: 0,
    splashRadius: 0,
    element: 'neutral',
    color: '#ffd166',
    desc: 'Не стреляет. Усиливает стойки на соседних слотах: +20% скорострельности и +10% дальности. Каждый уровень добавляет ещё один слот по очереди.',
    behavior: 'aura',
  },
};

/** Сторожевой фонарь aura buffs applied to other towers within its range. */
export const WATCH_TOWER_AURA = {
  fireRateMult: 1.20,
  rangeMult: 1.10,
};

/** Эфирная катушка chain parameters. */
export const ETHER_COIL_CHAIN = {
  /** Maximum number of additional hops after the primary target. */
  hops: 2,
  /** Maximum jump distance between consecutive enemies. */
  range: 180,
  /** Fraction of base damage retained on each hop. 1.0, 0.6, 0.36, ... */
  falloff: 0.6,
};

export const TOWER_UPGRADE_DAMAGE_MULT = 1.45;
export const TOWER_UPGRADE_RATE_MULT = 1.10;
export const TOWER_MAX_LEVEL = 5;

/** Gold cost to upgrade a tower currently at `currentLevel` to the next level.
 *  Cost grows with level so late upgrades are an investment. */
export function towerUpgradeCost(currentLevel: number): number {
  // L1→L2: 60, L2→L3: 100, L3→L4: 160, L4→L5: 240
  const TABLE = [60, 100, 160, 240];
  const i = Math.max(0, Math.min(TABLE.length - 1, currentLevel - 1));
  return TABLE[i]!;
}
