/**
 * Meta-progression tree, modelled after the Path-of-Exile passive tree:
 *
 *  - Every node has an explicit (x, y) position on a fixed canvas.
 *  - Nodes connect to one or more neighbours via the `connects` field.
 *  - To allocate a node the player must own AT LEAST ONE of its neighbours
 *    (the central `heart_root` node is allocated for free at the start).
 *  - Three sizes / tiers exist:
 *      "small"    - cheap +x% nodes (cost ~3-8 СЭ)
 *      "notable"  - thicker rings, larger payoffs (cost ~20-40 СЭ)
 *      "keystone" - dramatic build-defining effects, paid in Древняя Эссенция
 *
 *  Saves still store an array of allocated ids — the only thing that changes
 *  is how the UI renders the graph and how `applyMetaUpgrades` follows the
 *  links. Previously-saved ids that no longer exist are silently ignored,
 *  so an old save just loses meta upgrades that were removed.
 */
export interface MetaUpgrade {
  id: string;
  branch: MetaBranch;
  /** Node tier — drives cost class, render size and outline thickness. */
  kind: NodeKind;
  /** Layout in the tree canvas (≈ 0..1100 × 0..740). */
  pos: { x: number; y: number };
  /** All neighbour ids — symmetrical edges, no special "parent" direction. */
  connects: string[];
  name: string;
  desc: string;
  cost: number;
  currency: 'blue' | 'ancient';
  effect: MetaEffect;
}

export type NodeKind = 'root' | 'small' | 'notable' | 'keystone';

export type MetaBranch = 'potions' | 'engineering' | 'core' | 'survival';

export type MetaEffect =
  // Potions
  | { kind: 'potionCooldown'; value: number }
  | { kind: 'potionDamage'; value: number }
  | { kind: 'potionRadius'; value: number }
  | { kind: 'potionEchoChance'; value: number }
  | { kind: 'potionAimBonus'; value: number }
  | { kind: 'potionLeavesFire'; value: number }
  // Engineering
  | { kind: 'towerDiscount'; value: number }
  | { kind: 'towerStartLevel'; value: number }
  | { kind: 'towerFireRate'; value: number }
  | { kind: 'towerDamage'; value: number }
  | { kind: 'towerRange'; value: number }
  | { kind: 'runePointUnlock'; value: number }
  // Core / arcanum
  | { kind: 'overloadRate'; value: number }
  | { kind: 'overloadMaxCharge'; value: number }
  | { kind: 'auraRadius'; value: number }
  | { kind: 'reactionDamage'; value: number }
  | { kind: 'catalystSlot'; value: number }
  // Survival
  | { kind: 'maxHp'; value: number }
  | { kind: 'armor'; value: number }
  | { kind: 'autoRepair'; value: number }
  | { kind: 'bossShield'; value: number }
  | { kind: 'thornyShell'; value: number }
  // Economy
  | { kind: 'essenceBonus'; value: number }
  | { kind: 'startGold'; value: number }
  | { kind: 'goldDrop'; value: number }
  | { kind: 'lootRadius'; value: number };

const BRANCH_NAMES: Record<MetaBranch, string> = {
  potions: 'Алхимия',
  engineering: 'Инженерия',
  core: 'Аркана',
  survival: 'Живучесть',
};

export function branchName(b: MetaBranch): string {
  return BRANCH_NAMES[b];
}

// Rough quadrant guide:
//   NW = potions     NE = engineering
//   SW = core        SE = survival

export const META_UPGRADES: MetaUpgrade[] = [
  // ─────────────────────────── Root ───────────────────────────
  {
    id: 'heart_root',
    branch: 'survival',
    kind: 'root',
    pos: { x: 550, y: 370 },
    connects: [
      'p_cd_1', 'p_dmg_1',
      'e_fire_1', 'e_range_1',
      'c_overload_1', 'c_aura_1',
      's_hp_1', 's_armor_1',
      'eco_essence_1',
    ],
    name: 'Сердце Голема',
    desc: 'Стартовый узел. Открывает четыре круга школ.',
    cost: 0,
    currency: 'blue',
    effect: { kind: 'maxHp', value: 0 },
  },

  // ─────────────────────────── Alchemy (NW) ───────────────────────────
  {
    id: 'p_dmg_1',
    branch: 'potions',
    kind: 'small',
    pos: { x: 460, y: 320 },
    connects: ['heart_root', 'p_dmg_2', 'p_aim_1'],
    name: 'Концентрат',
    desc: '+5% урон склянок',
    cost: 4, currency: 'blue',
    effect: { kind: 'potionDamage', value: 1.05 },
  },
  {
    id: 'p_cd_1',
    branch: 'potions',
    kind: 'small',
    pos: { x: 460, y: 410 },
    connects: ['heart_root', 'p_cd_2', 'p_radius_1'],
    name: 'Быстрые руки',
    desc: '-4% кулдаун склянок',
    cost: 4, currency: 'blue',
    effect: { kind: 'potionCooldown', value: 0.96 },
  },
  {
    id: 'p_dmg_2',
    branch: 'potions',
    kind: 'small',
    pos: { x: 380, y: 290 },
    connects: ['p_dmg_1', 'p_notable_brew'],
    name: 'Концентрат II',
    desc: '+5% урон склянок',
    cost: 5, currency: 'blue',
    effect: { kind: 'potionDamage', value: 1.05 },
  },
  {
    id: 'p_cd_2',
    branch: 'potions',
    kind: 'small',
    pos: { x: 380, y: 440 },
    connects: ['p_cd_1', 'p_notable_brew'],
    name: 'Быстрые руки II',
    desc: '-4% кулдаун склянок',
    cost: 5, currency: 'blue',
    effect: { kind: 'potionCooldown', value: 0.96 },
  },
  {
    id: 'p_radius_1',
    branch: 'potions',
    kind: 'small',
    pos: { x: 360, y: 380 },
    connects: ['p_cd_1', 'p_radius_2'],
    name: 'Широкий всплеск',
    desc: '+5% радиус AoE',
    cost: 5, currency: 'blue',
    effect: { kind: 'potionRadius', value: 1.05 },
  },
  {
    id: 'p_radius_2',
    branch: 'potions',
    kind: 'small',
    pos: { x: 280, y: 400 },
    connects: ['p_radius_1', 'p_notable_brew'],
    name: 'Широкий всплеск II',
    desc: '+5% радиус AoE',
    cost: 7, currency: 'blue',
    effect: { kind: 'potionRadius', value: 1.05 },
  },
  {
    id: 'p_notable_brew',
    branch: 'potions',
    kind: 'notable',
    pos: { x: 290, y: 340 },
    connects: ['p_dmg_2', 'p_cd_2', 'p_radius_2', 'p_aim_2', 'p_echo_1'],
    name: 'Тяжёлый состав',
    desc: '+15% урон, +10% радиус AoE склянок',
    cost: 22, currency: 'blue',
    effect: { kind: 'potionDamage', value: 1.15 },
  },
  {
    id: 'p_aim_1',
    branch: 'potions',
    kind: 'small',
    pos: { x: 410, y: 240 },
    connects: ['p_dmg_1', 'p_aim_2', 'eco_loot_1'],
    name: 'Прицельный бросок',
    desc: '+5% бонус за ручное попадание',
    cost: 5, currency: 'blue',
    effect: { kind: 'potionAimBonus', value: 0.05 },
  },
  {
    id: 'p_aim_2',
    branch: 'potions',
    kind: 'small',
    pos: { x: 320, y: 230 },
    connects: ['p_aim_1', 'p_notable_brew', 'p_keystone_salamander'],
    name: 'Точный бросок II',
    desc: '+5% бонус за ручное попадание',
    cost: 7, currency: 'blue',
    effect: { kind: 'potionAimBonus', value: 0.05 },
  },
  {
    id: 'p_echo_1',
    branch: 'potions',
    kind: 'small',
    pos: { x: 230, y: 320 },
    connects: ['p_notable_brew', 'p_echo_2'],
    name: 'Эхо взрыва',
    desc: '+8% шанс микровзрыва',
    cost: 8, currency: 'blue',
    effect: { kind: 'potionEchoChance', value: 0.08 },
  },
  {
    id: 'p_echo_2',
    branch: 'potions',
    kind: 'small',
    pos: { x: 170, y: 360 },
    connects: ['p_echo_1', 'p_keystone_salamander'],
    name: 'Эхо взрыва II',
    desc: '+8% шанс микровзрыва',
    cost: 10, currency: 'blue',
    effect: { kind: 'potionEchoChance', value: 0.08 },
  },
  {
    id: 'p_keystone_salamander',
    branch: 'potions',
    kind: 'keystone',
    pos: { x: 130, y: 270 },
    connects: ['p_aim_2', 'p_echo_2'],
    name: 'Великий рецепт Саламандры',
    desc: 'Все склянки оставляют огонь и горят дольше',
    cost: 1, currency: 'ancient',
    effect: { kind: 'potionLeavesFire', value: 1 },
  },

  // ─────────────────────────── Engineering (NE) ───────────────────────────
  {
    id: 'e_fire_1',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 640, y: 320 },
    connects: ['heart_root', 'e_fire_2', 'e_range_1'],
    name: 'Смазанные шестерни',
    desc: '+4% скорострельность стоек',
    cost: 4, currency: 'blue',
    effect: { kind: 'towerFireRate', value: 1.04 },
  },
  {
    id: 'e_range_1',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 640, y: 410 },
    connects: ['heart_root', 'e_range_2', 'e_fire_1', 'e_dmg_1'],
    name: 'Точная оптика',
    desc: '+5% дальность стоек',
    cost: 4, currency: 'blue',
    effect: { kind: 'towerRange', value: 1.05 },
  },
  {
    id: 'e_fire_2',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 720, y: 290 },
    connects: ['e_fire_1', 'e_notable_workshop', 'e_discount'],
    name: 'Смазка II',
    desc: '+4% скорострельность стоек',
    cost: 5, currency: 'blue',
    effect: { kind: 'towerFireRate', value: 1.04 },
  },
  {
    id: 'e_range_2',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 720, y: 440 },
    connects: ['e_range_1', 'e_notable_workshop'],
    name: 'Оптика II',
    desc: '+5% дальность стоек',
    cost: 5, currency: 'blue',
    effect: { kind: 'towerRange', value: 1.05 },
  },
  {
    id: 'e_dmg_1',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 750, y: 380 },
    connects: ['e_range_1', 'e_dmg_2', 'e_notable_workshop'],
    name: 'Усиленные дюзы',
    desc: '+5% урон стоек',
    cost: 6, currency: 'blue',
    effect: { kind: 'towerDamage', value: 1.05 },
  },
  {
    id: 'e_dmg_2',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 820, y: 410 },
    connects: ['e_dmg_1', 'e_rune_1'],
    name: 'Усиленные дюзы II',
    desc: '+5% урон стоек',
    cost: 8, currency: 'blue',
    effect: { kind: 'towerDamage', value: 1.05 },
  },
  {
    id: 'e_notable_workshop',
    branch: 'engineering',
    kind: 'notable',
    pos: { x: 810, y: 340 },
    connects: ['e_fire_2', 'e_range_2', 'e_dmg_1', 'e_discount', 'e_rune_1'],
    name: 'Мастерская Архимастера',
    desc: '+10% урон, +5% скорострельность стоек',
    cost: 25, currency: 'blue',
    effect: { kind: 'towerDamage', value: 1.10 },
  },
  {
    id: 'e_discount',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 770, y: 250 },
    connects: ['e_fire_2', 'e_notable_workshop', 'e_start_level'],
    name: 'Скидка на стойки',
    desc: '−10 золота на первую стойку',
    cost: 8, currency: 'blue',
    effect: { kind: 'towerDiscount', value: 10 },
  },
  {
    id: 'e_start_level',
    branch: 'engineering',
    kind: 'notable',
    pos: { x: 850, y: 230 },
    connects: ['e_discount', 'e_rune_1'],
    name: 'Мастер-сборка',
    desc: 'Первая стойка появляется уже на Lv 2',
    cost: 30, currency: 'blue',
    effect: { kind: 'towerStartLevel', value: 2 },
  },
  {
    id: 'e_rune_1',
    branch: 'engineering',
    kind: 'notable',
    pos: { x: 900, y: 360 },
    connects: ['e_dmg_2', 'e_notable_workshop', 'e_start_level', 'e_rune_2'],
    name: 'Открытая руническая точка α',
    desc: '+1 руническая точка для стойки',
    cost: 35, currency: 'blue',
    effect: { kind: 'runePointUnlock', value: 1 },
  },
  {
    id: 'e_rune_2',
    branch: 'engineering',
    kind: 'notable',
    pos: { x: 980, y: 320 },
    connects: ['e_rune_1', 'e_keystone_archmaster'],
    name: 'Открытая руническая точка β',
    desc: '+1 руническая точка для стойки',
    cost: 60, currency: 'blue',
    effect: { kind: 'runePointUnlock', value: 2 },
  },
  {
    id: 'e_keystone_archmaster',
    branch: 'engineering',
    kind: 'keystone',
    pos: { x: 1010, y: 230 },
    connects: ['e_rune_2'],
    name: 'Чертёж Архимастера',
    desc: '+1 руническая точка β и +10% дальность стоек',
    cost: 1, currency: 'ancient',
    effect: { kind: 'towerRange', value: 1.10 },
  },

  // ─────────────────────────── Arcanum (SW, core/overload) ───────────────────
  {
    id: 'c_overload_1',
    branch: 'core',
    kind: 'small',
    pos: { x: 470, y: 460 },
    connects: ['heart_root', 'c_overload_2', 'c_aura_1'],
    name: 'Ускоренный заряд',
    desc: '+8% скорость заряда Overload',
    cost: 5, currency: 'blue',
    effect: { kind: 'overloadRate', value: 1.08 },
  },
  {
    id: 'c_aura_1',
    branch: 'core',
    kind: 'small',
    pos: { x: 540, y: 480 },
    connects: ['heart_root', 'c_overload_1', 'c_reaction_1'],
    name: 'Резонансная сетка',
    desc: '+8% радиус аур',
    cost: 5, currency: 'blue',
    effect: { kind: 'auraRadius', value: 1.08 },
  },
  {
    id: 'c_overload_2',
    branch: 'core',
    kind: 'small',
    pos: { x: 400, y: 510 },
    connects: ['c_overload_1', 'c_notable_capacitor'],
    name: 'Конденсатор',
    desc: '+15 макс. заряд Overload',
    cost: 7, currency: 'blue',
    effect: { kind: 'overloadMaxCharge', value: 15 },
  },
  {
    id: 'c_reaction_1',
    branch: 'core',
    kind: 'small',
    pos: { x: 540, y: 560 },
    connects: ['c_aura_1', 'c_notable_capacitor', 'c_reaction_2'],
    name: 'Стихийный резонанс',
    desc: '+10% урон элементальных реакций',
    cost: 6, currency: 'blue',
    effect: { kind: 'reactionDamage', value: 1.10 },
  },
  {
    id: 'c_reaction_2',
    branch: 'core',
    kind: 'small',
    pos: { x: 470, y: 590 },
    connects: ['c_reaction_1', 'c_keystone_resonator'],
    name: 'Стихийный резонанс II',
    desc: '+10% урон элементальных реакций',
    cost: 9, currency: 'blue',
    effect: { kind: 'reactionDamage', value: 1.10 },
  },
  {
    id: 'c_notable_capacitor',
    branch: 'core',
    kind: 'notable',
    pos: { x: 380, y: 580 },
    connects: ['c_overload_2', 'c_reaction_1', 'c_catalyst', 'c_keystone_resonator'],
    name: 'Расширенный конденсатор',
    desc: '+25 макс. заряд Overload и +15% скорость заряда',
    cost: 22, currency: 'blue',
    effect: { kind: 'overloadMaxCharge', value: 25 },
  },
  {
    id: 'c_catalyst',
    branch: 'core',
    kind: 'notable',
    pos: { x: 290, y: 540 },
    connects: ['c_notable_capacitor'],
    name: 'Слот катализатора',
    desc: '+1 катализатор в забеге (зарезервирован)',
    cost: 1, currency: 'ancient',
    effect: { kind: 'catalystSlot', value: 1 },
  },
  {
    id: 'c_keystone_resonator',
    branch: 'core',
    kind: 'keystone',
    pos: { x: 290, y: 620 },
    connects: ['c_notable_capacitor', 'c_reaction_2'],
    name: 'Резонатор стихий',
    desc: 'Реакции стихий наносят +30% урона',
    cost: 1, currency: 'ancient',
    effect: { kind: 'reactionDamage', value: 1.30 },
  },

  // ─────────────────────────── Survival (SE) ───────────────────────────
  {
    id: 's_hp_1',
    branch: 'survival',
    kind: 'small',
    pos: { x: 620, y: 470 },
    connects: ['heart_root', 's_hp_2', 's_armor_1'],
    name: 'Прочный каркас',
    desc: '+10 макс. HP манекена',
    cost: 4, currency: 'blue',
    effect: { kind: 'maxHp', value: 10 },
  },
  {
    id: 's_armor_1',
    branch: 'survival',
    kind: 'small',
    pos: { x: 670, y: 430 },
    connects: ['heart_root', 's_hp_1', 's_armor_2', 's_repair_1'],
    name: 'Железная обшивка',
    desc: '+3% брони манекена',
    cost: 5, currency: 'blue',
    effect: { kind: 'armor', value: 0.03 },
  },
  {
    id: 's_hp_2',
    branch: 'survival',
    kind: 'small',
    pos: { x: 620, y: 540 },
    connects: ['s_hp_1', 's_notable_frame'],
    name: 'Прочный каркас II',
    desc: '+15 макс. HP манекена',
    cost: 7, currency: 'blue',
    effect: { kind: 'maxHp', value: 15 },
  },
  {
    id: 's_armor_2',
    branch: 'survival',
    kind: 'small',
    pos: { x: 740, y: 490 },
    connects: ['s_armor_1', 's_notable_frame', 's_repair_1'],
    name: 'Железная обшивка II',
    desc: '+3% брони манекена',
    cost: 7, currency: 'blue',
    effect: { kind: 'armor', value: 0.03 },
  },
  {
    id: 's_notable_frame',
    branch: 'survival',
    kind: 'notable',
    pos: { x: 700, y: 580 },
    connects: ['s_hp_2', 's_armor_2', 's_thorns', 's_boss_shield'],
    name: 'Усиленный корпус',
    desc: '+25 HP и +5% брони манекена',
    cost: 22, currency: 'blue',
    effect: { kind: 'maxHp', value: 25 },
  },
  {
    id: 's_repair_1',
    branch: 'survival',
    kind: 'small',
    pos: { x: 780, y: 430 },
    connects: ['s_armor_1', 's_armor_2', 's_repair_notable'],
    name: 'Авто-ремонт',
    desc: 'Восстановление 1 HP/сек вне боя',
    cost: 10, currency: 'blue',
    effect: { kind: 'autoRepair', value: 1 },
  },
  {
    id: 's_repair_notable',
    branch: 'survival',
    kind: 'notable',
    pos: { x: 850, y: 470 },
    connects: ['s_repair_1', 's_boss_shield', 's_keystone_thorns'],
    name: 'Полевой ремонт',
    desc: 'Восстановление +2 HP/сек вне боя',
    cost: 25, currency: 'blue',
    effect: { kind: 'autoRepair', value: 2 },
  },
  {
    id: 's_thorns',
    branch: 'survival',
    kind: 'small',
    pos: { x: 700, y: 640 },
    connects: ['s_notable_frame', 's_keystone_thorns'],
    name: 'Шипастый каркас',
    desc: 'Атакующий враг получает 3 урона',
    cost: 12, currency: 'blue',
    effect: { kind: 'thornyShell', value: 1 },
  },
  {
    id: 's_boss_shield',
    branch: 'survival',
    kind: 'notable',
    pos: { x: 800, y: 580 },
    connects: ['s_notable_frame', 's_repair_notable', 's_keystone_thorns'],
    name: 'Щит босс-волны',
    desc: 'Щит 25 HP в начале каждой босс-волны',
    cost: 30, currency: 'blue',
    effect: { kind: 'bossShield', value: 25 },
  },
  {
    id: 's_keystone_thorns',
    branch: 'survival',
    kind: 'keystone',
    pos: { x: 900, y: 640 },
    connects: ['s_thorns', 's_boss_shield', 's_repair_notable'],
    name: 'Сердце Голема (Закалённое)',
    desc: 'Шипы +5 урон, +30% эффективности авто-ремонта',
    cost: 1, currency: 'ancient',
    effect: { kind: 'thornyShell', value: 1 },
  },

  // ─────────────────────────── Economy ring (cross-branch) ──────────────────
  {
    id: 'eco_essence_1',
    branch: 'survival',
    kind: 'small',
    pos: { x: 600, y: 280 },
    connects: ['heart_root', 'eco_essence_notable'],
    name: 'Эссенциальная жатва I',
    desc: '+10% Синей Эссенции за забег',
    cost: 8, currency: 'blue',
    effect: { kind: 'essenceBonus', value: 1.10 },
  },
  {
    id: 'eco_essence_notable',
    branch: 'survival',
    kind: 'notable',
    pos: { x: 600, y: 210 },
    connects: ['eco_essence_1', 'eco_gold_1', 'eco_loot_1'],
    name: 'Эссенциальная жатва II',
    desc: '+25% Синей Эссенции за забег',
    cost: 35, currency: 'blue',
    effect: { kind: 'essenceBonus', value: 1.25 },
  },
  {
    id: 'eco_gold_1',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 690, y: 220 },
    connects: ['eco_essence_notable', 'eco_gold_2'],
    name: 'Золотая жила',
    desc: '+10% золота с врагов',
    cost: 8, currency: 'blue',
    effect: { kind: 'goldDrop', value: 1.10 },
  },
  {
    id: 'eco_gold_2',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 730, y: 170 },
    connects: ['eco_gold_1'],
    name: 'Стартовый кошелёк',
    desc: '+30 стартового золота',
    cost: 10, currency: 'blue',
    effect: { kind: 'startGold', value: 30 },
  },
  {
    id: 'eco_loot_1',
    branch: 'core',
    kind: 'small',
    pos: { x: 510, y: 210 },
    connects: ['eco_essence_notable', 'p_aim_1'],
    name: 'Магнит',
    desc: '+15% радиус подбора золота',
    cost: 7, currency: 'blue',
    effect: { kind: 'lootRadius', value: 1.15 },
  },
];

/** Convenience: id → upgrade map. */
export const META_BY_ID: Record<string, MetaUpgrade> = Object.fromEntries(
  META_UPGRADES.map((u) => [u.id, u]),
);

import { tWithFallback } from '../i18n';

/** Localised name for a meta-tree node; falls back to source-of-truth Russian. */
export function metaNodeName(node: MetaUpgrade): string {
  return tWithFallback(`meta.node.${node.id}.name`, node.name);
}

/** Localised description for a meta-tree node; falls back to Russian. */
export function metaNodeDesc(node: MetaUpgrade): string {
  return tWithFallback(`meta.node.${node.id}.desc`, node.desc);
}
