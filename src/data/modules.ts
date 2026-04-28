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
 *
 * Aura modules
 * ------------
 *  - magnet_res  — Магнитный резонанс: +50% loot pickup radius.
 *  - ether_amp   — Усилитель эфира: +15% tower fire rate.
 *  - thorn_shell — Шипастая оболочка: melee attackers take damage back.
 *  - elem_reson  — Резонатор стихий: +30% reaction damage.
 */

import { tWithFallback } from '../i18n';

export type ActiveModuleId =
  | 'lightning'
  | 'chronos'
  | 'transmute'
  | 'alch_dome';

export type AuraModuleId =
  | 'magnet_res'
  | 'ether_amp'
  | 'thorn_shell'
  | 'elem_reson';

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
    desc: 'Q-Overload: молния по 6 врагам, приоритет элите.',
  },
  chronos: {
    id: 'chronos',
    slot: 'active',
    name: 'Хронос',
    desc: 'Q-Overload: замедляет всех врагов на 5 сек.',
  },
  transmute: {
    id: 'transmute',
    slot: 'active',
    name: 'Трансмутация',
    desc: 'Q-Overload: убитые враги дают ×2 золота 10 сек.',
  },
  alch_dome: {
    id: 'alch_dome',
    slot: 'active',
    name: 'Купол алхимика',
    desc: 'Q-Overload: щит Манекена −90% урона на 6 сек.',
  },
};

export const AURA_MODULES: Record<AuraModuleId, ModuleDef> = {
  magnet_res: {
    id: 'magnet_res',
    slot: 'aura',
    name: 'Магнитный резонанс',
    desc: 'Радиус сбора лута +50%.',
  },
  ether_amp: {
    id: 'ether_amp',
    slot: 'aura',
    name: 'Усилитель эфира',
    desc: 'Все стойки получают +15% скорострельности.',
  },
  thorn_shell: {
    id: 'thorn_shell',
    slot: 'aura',
    name: 'Шипастая оболочка',
    desc: 'Враги вблизи Манекена получают часть урона обратно.',
  },
  elem_reson: {
    id: 'elem_reson',
    slot: 'aura',
    name: 'Резонатор стихий',
    desc: 'Стихийные реакции наносят +30% урона.',
  },
};

export const ALL_MODULES: ModuleDef[] = [
  ...Object.values(ACTIVE_MODULES),
  ...Object.values(AURA_MODULES),
];

export const DEFAULT_ACTIVE_MODULE: ActiveModuleId = 'lightning';
export const DEFAULT_AURA_MODULE: AuraModuleId = 'magnet_res';

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
export const MAGNET_RES_LOOT_RADIUS = 1.5;
