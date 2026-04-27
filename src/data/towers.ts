import type { TowerKind } from '../game/types';

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
    cost: 110,
    damage: 14,
    range: 260,
    fireRate: 0.7,
    projectileSpeed: 360,
    splashRadius: 60,
    element: 'fire',
    color: '#ff8c5a',
    desc: 'Медленная AoE-мортира. Хороша против толп.',
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
};

export const TOWER_UPGRADE_COST = 70;
export const TOWER_UPGRADE_DAMAGE_MULT = 1.6;
export const TOWER_UPGRADE_RATE_MULT = 1.15;
export const TOWER_MAX_LEVEL = 3;
