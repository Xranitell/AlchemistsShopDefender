export interface MetaUpgrade {
  id: string;
  branch: MetaBranch;
  name: string;
  desc: string;
  cost: number;
  currency: 'blue' | 'ancient';
  requires?: string;
  effect: MetaEffect;
}

export type MetaBranch = 'potions' | 'engineering' | 'core' | 'survival';

export type MetaEffect =
  | { kind: 'potionCooldown'; value: number }
  | { kind: 'potionDamage'; value: number }
  | { kind: 'potionRadius'; value: number }
  | { kind: 'potionEchoChance'; value: number }
  | { kind: 'potionAimBonus'; value: number }
  | { kind: 'towerDiscount'; value: number }
  | { kind: 'towerStartLevel'; value: number }
  | { kind: 'towerFireRate'; value: number }
  | { kind: 'runePointUnlock'; value: number }
  | { kind: 'overloadRate'; value: number }
  | { kind: 'overloadMaxCharge'; value: number }
  | { kind: 'catalystSlot'; value: number }
  | { kind: 'auraRadius'; value: number }
  | { kind: 'maxHp'; value: number }
  | { kind: 'armor'; value: number }
  | { kind: 'autoRepair'; value: number }
  | { kind: 'bossShield'; value: number }
  | { kind: 'essenceBonus'; value: number }
  | { kind: 'startGold'; value: number }
  | { kind: 'lootRadius'; value: number };

const BRANCH_NAMES: Record<MetaBranch, string> = {
  potions: 'Мастер Зельеварения',
  engineering: 'Инженерный круг',
  core: 'Ядро Голема',
  survival: 'Живучесть лавки',
};

export function branchName(b: MetaBranch): string {
  return BRANCH_NAMES[b];
}

export const META_UPGRADES: MetaUpgrade[] = [
  // --- Branch 1: Potions ---
  {
    id: 'potion_cooldown_1',
    branch: 'potions',
    name: 'Алхимический хват',
    desc: '-10% кулдаун склянок',
    cost: 15,
    currency: 'blue',
    effect: { kind: 'potionCooldown', value: 0.9 },
  },
  {
    id: 'potion_damage_1',
    branch: 'potions',
    name: 'Тяжёлый состав',
    desc: '+15% урон склянок',
    cost: 20,
    currency: 'blue',
    requires: 'potion_cooldown_1',
    effect: { kind: 'potionDamage', value: 1.15 },
  },
  {
    id: 'potion_radius_1',
    branch: 'potions',
    name: 'Радиус всплеска',
    desc: '+20% AoE склянок',
    cost: 25,
    currency: 'blue',
    requires: 'potion_damage_1',
    effect: { kind: 'potionRadius', value: 1.2 },
  },
  {
    id: 'potion_echo',
    branch: 'potions',
    name: 'Цепная реакция',
    desc: 'Шанс микровзрыва +15%',
    cost: 40,
    currency: 'blue',
    requires: 'potion_radius_1',
    effect: { kind: 'potionEchoChance', value: 0.15 },
  },
  {
    id: 'potion_aim',
    branch: 'potions',
    name: 'Прицельный бросок',
    desc: '+10% бонус за ручное попадание',
    cost: 30,
    currency: 'blue',
    requires: 'potion_damage_1',
    effect: { kind: 'potionAimBonus', value: 0.10 },
  },

  // --- Branch 2: Engineering ---
  {
    id: 'rune_point_5',
    branch: 'engineering',
    name: 'Руническая точка V',
    desc: 'Открыть 5-ю руническую точку',
    cost: 20,
    currency: 'blue',
    effect: { kind: 'runePointUnlock', value: 5 },
  },
  {
    id: 'tower_discount',
    branch: 'engineering',
    name: 'Скидка на стойки',
    desc: '-15 золота на первую стойку',
    cost: 15,
    currency: 'blue',
    requires: 'rune_point_5',
    effect: { kind: 'towerDiscount', value: 15 },
  },
  {
    id: 'tower_start_level',
    branch: 'engineering',
    name: 'Мастер-сборка',
    desc: 'Первая стойка начинает с Lv 2',
    cost: 50,
    currency: 'blue',
    requires: 'tower_discount',
    effect: { kind: 'towerStartLevel', value: 2 },
  },
  {
    id: 'tower_fire_rate',
    branch: 'engineering',
    name: 'Смазанные шестерни',
    desc: '+10% скорострельность стоек',
    cost: 25,
    currency: 'blue',
    requires: 'rune_point_5',
    effect: { kind: 'towerFireRate', value: 1.1 },
  },
  {
    id: 'rune_point_6',
    branch: 'engineering',
    name: 'Руническая точка VI',
    desc: 'Открыть 6-ю руническую точку',
    cost: 60,
    currency: 'ancient',
    requires: 'tower_fire_rate',
    effect: { kind: 'runePointUnlock', value: 6 },
  },

  // --- Branch 3: Core ---
  {
    id: 'overload_rate_1',
    branch: 'core',
    name: 'Ускоренный заряд',
    desc: '+20% скорость заряда Overload',
    cost: 20,
    currency: 'blue',
    effect: { kind: 'overloadRate', value: 1.2 },
  },
  {
    id: 'overload_max_1',
    branch: 'core',
    name: 'Расширенный конденсатор',
    desc: '+25 макс. заряд Overload',
    cost: 25,
    currency: 'blue',
    requires: 'overload_rate_1',
    effect: { kind: 'overloadMaxCharge', value: 25 },
  },
  {
    id: 'aura_radius',
    branch: 'core',
    name: 'Усиление аур',
    desc: '+15% радиус аур',
    cost: 30,
    currency: 'blue',
    requires: 'overload_rate_1',
    effect: { kind: 'auraRadius', value: 1.15 },
  },
  {
    id: 'catalyst_slot',
    branch: 'core',
    name: 'Слот катализатора',
    desc: '+1 катализатор в забеге',
    cost: 80,
    currency: 'ancient',
    requires: 'aura_radius',
    effect: { kind: 'catalystSlot', value: 1 },
  },

  // --- Branch 4: Survival ---
  {
    id: 'max_hp_1',
    branch: 'survival',
    name: 'Прочный каркас',
    desc: '+20 макс. HP манекена',
    cost: 15,
    currency: 'blue',
    effect: { kind: 'maxHp', value: 20 },
  },
  {
    id: 'armor_1',
    branch: 'survival',
    name: 'Железная обшивка',
    desc: '+5% брони манекена',
    cost: 20,
    currency: 'blue',
    requires: 'max_hp_1',
    effect: { kind: 'armor', value: 0.05 },
  },
  {
    id: 'auto_repair',
    branch: 'survival',
    name: 'Авто-ремонт',
    desc: 'Восстановление 2 HP/сек (5 сек без урона)',
    cost: 40,
    currency: 'blue',
    requires: 'armor_1',
    effect: { kind: 'autoRepair', value: 2 },
  },
  {
    id: 'boss_shield',
    branch: 'survival',
    name: 'Щит босс-волны',
    desc: 'Щит 15 HP на старте босс-волны',
    cost: 35,
    currency: 'blue',
    requires: 'armor_1',
    effect: { kind: 'bossShield', value: 15 },
  },
  {
    id: 'essence_bonus',
    branch: 'survival',
    name: 'Эссенциальная жатва',
    desc: '+25% Синей Эссенции за забег',
    cost: 50,
    currency: 'blue',
    requires: 'max_hp_1',
    effect: { kind: 'essenceBonus', value: 1.25 },
  },
  {
    id: 'start_gold',
    branch: 'survival',
    name: 'Стартовый кошелёк',
    desc: '+30 стартового золота',
    cost: 25,
    currency: 'blue',
    effect: { kind: 'startGold', value: 30 },
  },
];
