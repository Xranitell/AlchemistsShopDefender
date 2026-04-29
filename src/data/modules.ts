/**
 * Модули Манекена (GDD §11.2). The mannequin has two slots: one *active*
 * (consumes the Overload bar when triggered) and one *aura* (persistent
 * passive). The player picks one of each in the meta menu and it carries
 * over to every run until they pick a different one.
 *
 * Active modules
 * --------------
 *  - lightning   — Громоотвод: chains lightning to up to 6 enemies (boss prio).
 *  - chronos     — Хронос: slows all enemies for 5s.
 *  - transmute   — Трансмутация: x2 gold drops for the next 10s.
 *  - alch_dome   — Купол алхимика: 6s strong shield on the mannequin.
 *  - frost_nova  — Морозная вспышка: full freeze on every enemy for 3s.
 *  - vortex      — Алхимический вихрь: pulls enemies toward the mannequin
 *                  and damages everything caught in the rim.
 *
 * Aura modules
 * ------------
 *  - ether_amp   — Усилитель эфира: +15% tower fire rate.
 *  - thorn_shell — Шипастая оболочка: melee attackers take damage back.
 *  - elem_reson  — Резонатор стихий: +30% reaction damage.
 *  - vital_pulse — Витальный пульс: passive 1 HP/s regen during fights.
 *  - gold_aura   — Золотая аура: +20% gold from defeated enemies.
 *  - long_range  — Дальний фокус: +10% tower range.
 */

import { tWithFallback } from '../i18n';

export type ActiveModuleId =
  | 'lightning'
  | 'chronos'
  | 'transmute'
  | 'alch_dome'
  | 'frost_nova'
  | 'vortex';

export type AuraModuleId =
  | 'ether_amp'
  | 'thorn_shell'
  | 'elem_reson'
  | 'vital_pulse'
  | 'gold_aura'
  | 'long_range';

export interface ModuleDef {
  id: string;
  slot: 'active' | 'aura';
  name: string;
  desc: string;
}

export const ACTIVE_MODULES: Record<ActiveModuleId, ModuleDef> = {
  lightning: {
    id: 'lightning',
    slot: 'active',
    name: 'Громоотвод',
    desc: '+молния по 6 врагам, приоритет элите.',
  },
  chronos: {
    id: 'chronos',
    slot: 'active',
    name: 'Хронос',
    desc: '−60% скорость всех врагов на 5 сек.',
  },
  transmute: {
    id: 'transmute',
    slot: 'active',
    name: 'Трансмутация',
    desc: '×2 золота с убитых врагов на 10 сек.',
  },
  alch_dome: {
    id: 'alch_dome',
    slot: 'active',
    name: 'Купол алхимика',
    desc: '−90% урона Манекену на 6 сек.',
  },
  frost_nova: {
    id: 'frost_nova',
    slot: 'active',
    name: 'Морозная вспышка',
    desc: '+заморозка всех врагов на 3 сек.',
  },
  vortex: {
    id: 'vortex',
    slot: 'active',
    name: 'Алхимический вихрь',
    desc: '+тяга к Манекену и урон по площади.',
  },
};

export const AURA_MODULES: Record<AuraModuleId, ModuleDef> = {
  ether_amp: {
    id: 'ether_amp',
    slot: 'aura',
    name: 'Усилитель эфира',
    desc: '+15% скорострельность стоек.',
  },
  thorn_shell: {
    id: 'thorn_shell',
    slot: 'aura',
    name: 'Шипастая оболочка',
    desc: '+урон ответом ближним врагам.',
  },
  elem_reson: {
    id: 'elem_reson',
    slot: 'aura',
    name: 'Резонатор стихий',
    desc: '+30% урон стихийных реакций.',
  },
  vital_pulse: {
    id: 'vital_pulse',
    slot: 'aura',
    name: 'Витальный пульс',
    desc: '+1 HP/сек регенерация в бою.',
  },
  gold_aura: {
    id: 'gold_aura',
    slot: 'aura',
    name: 'Золотая аура',
    desc: '+20% золота с врагов.',
  },
  long_range: {
    id: 'long_range',
    slot: 'aura',
    name: 'Дальний фокус',
    desc: '+10% дальность стоек.',
  },
};

export const ALL_MODULES: ModuleDef[] = [
  ...Object.values(ACTIVE_MODULES),
  ...Object.values(AURA_MODULES),
];

export const DEFAULT_ACTIVE_MODULE: ActiveModuleId = 'lightning';
export const DEFAULT_AURA_MODULE: AuraModuleId = 'ether_amp';

export function isActiveModule(id: string): id is ActiveModuleId {
  return id in ACTIVE_MODULES;
}

export function isAuraModule(id: string): id is AuraModuleId {
  return id in AURA_MODULES;
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
export const TRANSMUTE_DURATION = 10;
export const TRANSMUTE_GOLD_MULT = 2.0;
export const ALCH_DOME_DURATION = 6;
export const ALCH_DOME_REDUCTION = 0.9;
export const ETHER_AMP_FIRE_RATE = 1.15;
export const ELEM_RESON_DAMAGE = 1.30;
/** Frost Nova: fully freezes every enemy on the field for this many seconds. */
export const FROST_NOVA_DURATION = 3;
/** Vortex: AoE pulse damage applied to every enemy near the mannequin. */
export const VORTEX_RADIUS = 260;
export const VORTEX_DAMAGE = 30;
export const VORTEX_PULL_FORCE = 220;
/** Vital Pulse aura: HP per second regenerated during waves. */
export const VITAL_PULSE_REGEN = 1;
/** Gold Aura: multiplicative bonus to gold drops. */
export const GOLD_AURA_MULT = 1.20;
/** Long Range aura: multiplicative bonus to tower range. */
export const LONG_RANGE_MULT = 1.10;
