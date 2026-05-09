/**
 * Перегрузка (formerly «Снаряжение Манекена», GDD §11.2).
 *
 * The mannequin has a single slot — the player picks one Overload ability
 * in the meta menu and it carries over to every run until they choose a
 * different one. The previous "Aura" passive slot was removed: passive
 * "+N to stat" buffs were felt as a flat baseline rather than a meaningful
 * choice, so the loadout has been pared down to one *active* button that
 * actually changes how the player plays.
 *
 * Every Overload ability is **unique** — no plain stat boosts. The pool
 * intentionally mixes offensive bursts (Lightning, Meteor Shower, Death
 * Mark, Element Prism), crowd control (Chronos, Frost Nova, Vortex), and
 * a defensive panic button (Alchemic Dome) so each choice changes the
 * fight in a recognisable, distinct way:
 *
 *  - lightning       — Громоотвод: chains lightning to up to 6 enemies
 *                      (boss prio).
 *  - chronos         — Хронос: slows all enemies to 40 % speed for 5 s.
 *  - alch_dome       — Купол алхимика: 6 s strong shield on the mannequin.
 *  - frost_nova      — Морозная вспышка: full freeze on every enemy for 3 s.
 *  - vortex          — Алхимический вихрь: pulls enemies toward the
 *                      mannequin and damages everything in range.
 *  - meteor_shower   — Звездопад: drops 5 meteors on the densest enemy
 *                      clusters, each detonating for AoE damage.
 *  - death_mark      — Метка смерти: marks the 3 strongest non-boss enemies;
 *                      after 2 s they detonate, dealing 60 % of their current
 *                      HP as AoE damage to nearby enemies.
 *  - element_prism   — Призма стихий: applies burn, frost mark, *and* aether
 *                      mark to every enemy at once, triggering chains of
 *                      elemental reactions.
 */

import { tWithFallback } from '../i18n';

export type ActiveModuleId =
  | 'lightning'
  | 'chronos'
  | 'alch_dome'
  | 'frost_nova'
  | 'vortex'
  | 'meteor_shower'
  | 'death_mark'
  | 'element_prism';

export interface ModuleDef {
  id: string;
  name: string;
  desc: string;
}

export const ACTIVE_MODULES: Record<ActiveModuleId, ModuleDef> = {
  lightning: {
    id: 'lightning',
    name: 'Громоотвод',
    desc: 'Цепная молния поражает до 6 врагов в радиусе 380, приоритет — боссы.',
  },
  chronos: {
    id: 'chronos',
    name: 'Хронос',
    desc: 'Замедляет всех врагов до 40 % скорости на 5 сек.',
  },
  alch_dome: {
    id: 'alch_dome',
    name: 'Купол алхимика',
    desc: 'Снижает входящий урон по манекену на 90 % в течение 6 сек.',
  },
  frost_nova: {
    id: 'frost_nova',
    name: 'Морозная вспышка',
    desc: 'Полностью замораживает всех врагов на 3 сек.',
  },
  vortex: {
    id: 'vortex',
    name: 'Алхимический вихрь',
    desc: 'Стягивает врагов в радиусе 260 к манекену и наносит 30 урона по площади.',
  },
  meteor_shower: {
    id: 'meteor_shower',
    name: 'Звездопад',
    desc: 'Призывает 5 метеоров на самые плотные скопления врагов: по 80 урона огнём в радиусе 100.',
  },
  death_mark: {
    id: 'death_mark',
    name: 'Метка смерти',
    desc: 'Помечает 3 сильнейших не-боссов; через 2 сек они детонируют, нанося 60 % их текущего ХП по площади 160.',
  },
  element_prism: {
    id: 'element_prism',
    name: 'Призма стихий',
    desc: 'Накладывает на всех врагов горение, ледяную метку и эфирную метку — провоцирует цепочки стихийных реакций.',
  },
};

export const ALL_MODULES: ModuleDef[] = Object.values(ACTIVE_MODULES);

export const DEFAULT_ACTIVE_MODULE: ActiveModuleId = 'lightning';

export function isActiveModule(id: string): id is ActiveModuleId {
  return id in ACTIVE_MODULES;
}

// Localised display accessors. Source-of-truth Russian strings live above as
// `name`/`desc` fields and serve as fallback if a translation is missing.
export function moduleName(def: ModuleDef): string {
  return tWithFallback(`modules.${def.id}.name`, def.name);
}

export function moduleDesc(def: ModuleDef): string {
  return tWithFallback(`modules.${def.id}.desc`, def.desc);
}

/** Module-specific tuning constants. */
export const ALCH_DOME_DURATION = 6;
export const ALCH_DOME_REDUCTION = 0.9;
/** Frost Nova: fully freezes every enemy on the field for this many seconds. */
export const FROST_NOVA_DURATION = 3;
/** Vortex: AoE pulse damage applied to every enemy near the mannequin. */
export const VORTEX_RADIUS = 260;
export const VORTEX_DAMAGE = 30;
export const VORTEX_PULL_FORCE = 220;
/** Meteor Shower: number of meteors, per-meteor damage, and AoE radius. */
export const METEOR_COUNT = 5;
export const METEOR_DAMAGE = 80;
export const METEOR_RADIUS = 100;
/** Stagger between meteor impacts so the screen doesn't flash all at once. */
export const METEOR_INTERVAL = 0.18;
/** Death Mark: number of marks, fuse delay, AoE radius, and HP fraction
 *  detonated as damage to neighbours. */
export const DEATH_MARK_COUNT = 3;
export const DEATH_MARK_DELAY = 2;
export const DEATH_MARK_RADIUS = 160;
export const DEATH_MARK_HP_FRACTION = 0.6;
/** Element Prism: how long each applied status lingers (seconds). The
 *  follow-up reactions tick within this window so the player gets the
 *  cascade even if no other source refreshes the marks. */
export const PRISM_BURN_DPS = 18;
export const PRISM_BURN_TIME = 4;
export const PRISM_FROST_TIME = 3;
export const PRISM_AETHER_TIME = 3;
