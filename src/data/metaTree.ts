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
  /** Layout in the tree canvas (≈ 0..1400 × 0..900). */
  pos: { x: number; y: number };
  /** All neighbour ids — symmetrical edges, no special "parent" direction. */
  connects: string[];
  name: string;
  desc: string;
  cost: number;
  currency: 'blue' | 'ancient';
  effect: MetaEffect;
  /** Additional effects applied alongside the primary `effect`. Used by
   *  keystones and compound nodes that grant more than one bonus. */
  extraEffects?: MetaEffect[];
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
  | { kind: 'lootRadius'; value: number }
  // Combat extras (added in v2 rebalance)
  | { kind: 'armorPen'; value: number }   // additive: +X to enemy armour pen (0..1)
  | { kind: 'critChance'; value: number }; // additive: +X% per-shot crit chance

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
    pos: { x: 700, y: 450 },
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
    pos: { x: 626, y: 408 },
    connects: ['heart_root', 'p_dmg_2', 'p_aim_1'],
    name: 'Концентрат',
    desc: '+5% урон склянок',
    cost: 12, currency: 'blue',
    effect: { kind: 'potionDamage', value: 1.05 },
  },
  {
    id: 'p_cd_1',
    branch: 'potions',
    kind: 'small',
    pos: { x: 658, y: 376 },
    connects: ['heart_root', 'p_cd_2', 'p_radius_1'],
    name: 'Быстрые руки',
    desc: '-4% кулдаун склянок',
    cost: 12, currency: 'blue',
    effect: { kind: 'potionCooldown', value: 0.96 },
  },
  {
    id: 'p_dmg_2',
    branch: 'potions',
    kind: 'small',
    pos: { x: 564, y: 387 },
    connects: ['p_dmg_1', 'p_notable_brew', 'p_dmg_3'],
    name: 'Концентрат II',
    desc: '+5% урон склянок',
    cost: 15, currency: 'blue',
    effect: { kind: 'potionDamage', value: 1.05 },
  },
  {
    id: 'p_cd_2',
    branch: 'potions',
    kind: 'small',
    pos: { x: 649, y: 309 },
    connects: ['p_cd_1', 'p_notable_brew', 'p_cd_3'],
    name: 'Быстрые руки II',
    desc: '-4% кулдаун склянок',
    cost: 15, currency: 'blue',
    effect: { kind: 'potionCooldown', value: 0.96 },
  },
  {
    id: 'p_radius_1',
    branch: 'potions',
    kind: 'small',
    pos: { x: 590, y: 340 },
    connects: ['p_cd_1', 'p_radius_2'],
    name: 'Широкий всплеск',
    desc: '+5% радиус взрыва',
    cost: 15, currency: 'blue',
    effect: { kind: 'potionRadius', value: 1.05 },
  },
  {
    id: 'p_radius_2',
    branch: 'potions',
    kind: 'small',
    pos: { x: 535, y: 312 },
    connects: ['p_radius_1', 'p_notable_brew', 'p_radius_3'],
    name: 'Широкий всплеск II',
    desc: '+5% радиус взрыва',
    cost: 21, currency: 'blue',
    effect: { kind: 'potionRadius', value: 1.05 },
  },
  {
    id: 'p_notable_brew',
    branch: 'potions',
    kind: 'notable',
    pos: { x: 592, y: 264 },
    connects: ['p_dmg_2', 'p_cd_2', 'p_radius_2', 'p_aim_2', 'p_echo_1'],
    name: 'Тяжёлый состав',
    desc: '+15% урон, +10% радиус взрыва склянок',
    cost: 82, currency: 'blue',
    effect: { kind: 'potionDamage', value: 1.15 },
  },
  {
    id: 'p_aim_1',
    branch: 'potions',
    kind: 'small',
    pos: { x: 608, y: 196 },
    connects: ['p_dmg_1', 'p_aim_2', 'eco_essence_notable'],
    name: 'Прицельный бросок',
    desc: '+5% бонус за ручное попадание',
    cost: 15, currency: 'blue',
    effect: { kind: 'potionAimBonus', value: 0.05 },
  },
  {
    id: 'p_aim_2',
    branch: 'potions',
    kind: 'small',
    pos: { x: 545, y: 229 },
    connects: ['p_aim_1', 'p_notable_brew', 'p_keystone_salamander'],
    name: 'Точный бросок II',
    desc: '+5% бонус за ручное попадание',
    cost: 21, currency: 'blue',
    effect: { kind: 'potionAimBonus', value: 0.05 },
  },
  {
    id: 'p_echo_1',
    branch: 'potions',
    kind: 'small',
    pos: { x: 493, y: 276 },
    connects: ['p_notable_brew', 'p_echo_2'],
    name: 'Эхо взрыва',
    desc: '+8% шанс микровзрыва',
    cost: 27, currency: 'blue',
    effect: { kind: 'potionEchoChance', value: 0.08 },
  },
  {
    id: 'p_echo_2',
    branch: 'potions',
    kind: 'small',
    pos: { x: 486, y: 212 },
    connects: ['p_echo_1', 'p_keystone_salamander'],
    name: 'Эхо взрыва II',
    desc: '+8% шанс микровзрыва',
    cost: 33, currency: 'blue',
    effect: { kind: 'potionEchoChance', value: 0.08 },
  },
  {
    id: 'p_keystone_salamander',
    branch: 'potions',
    kind: 'keystone',
    pos: { x: 556, y: 142 },
    connects: ['p_aim_2', 'p_echo_2'],
    name: 'Великий рецепт Саламандры',
    desc: '+огонь от всех склянок, горение длится дольше',
    cost: 2, currency: 'ancient',
    effect: { kind: 'potionLeavesFire', value: 1 },
  },

  // ─────────────────────────── Engineering (NE) ───────────────────────────
  {
    id: 'e_fire_1',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 743, y: 376 },
    connects: ['heart_root', 'e_fire_2', 'e_range_1'],
    name: 'Смазанные шестерни',
    desc: '+4% скорострельность стоек',
    cost: 12, currency: 'blue',
    effect: { kind: 'towerFireRate', value: 1.04 },
  },
  {
    id: 'e_range_1',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 774, y: 408 },
    connects: ['heart_root', 'e_range_2', 'e_fire_1', 'e_dmg_1'],
    name: 'Точная оптика',
    desc: '+5% дальность стоек',
    cost: 12, currency: 'blue',
    effect: { kind: 'towerRange', value: 1.05 },
  },
  {
    id: 'e_fire_2',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 763, y: 314 },
    connects: ['e_fire_1', 'e_notable_workshop', 'e_discount'],
    name: 'Смазка II',
    desc: '+4% скорострельность стоек',
    cost: 15, currency: 'blue',
    effect: { kind: 'towerFireRate', value: 1.04 },
  },
  {
    id: 'e_range_2',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 836, y: 387 },
    connects: ['e_range_1', 'e_notable_workshop', 'e_range_3'],
    name: 'Оптика II',
    desc: '+5% дальность стоек',
    cost: 15, currency: 'blue',
    effect: { kind: 'towerRange', value: 1.05 },
  },
  {
    id: 'e_dmg_1',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 772, y: 253 },
    connects: ['e_range_1', 'e_dmg_2', 'e_notable_workshop'],
    name: 'Усиленные дюзы',
    desc: '+5% урон стоек',
    cost: 18, currency: 'blue',
    effect: { kind: 'towerDamage', value: 1.05 },
  },
  {
    id: 'e_dmg_2',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 897, y: 378 },
    connects: ['e_dmg_1', 'e_rune_1', 'e_dmg_3'],
    name: 'Усиленные дюзы II',
    desc: '+5% урон стоек',
    cost: 24, currency: 'blue',
    effect: { kind: 'towerDamage', value: 1.05 },
  },
  {
    id: 'e_notable_workshop',
    branch: 'engineering',
    kind: 'notable',
    pos: { x: 848, y: 302 },
    connects: ['e_fire_2', 'e_range_2', 'e_dmg_1', 'e_discount', 'e_rune_1'],
    name: 'Мастерская Архимастера',
    desc: '+10% урон, +5% скорострельность стоек',
    cost: 90, currency: 'blue',
    effect: { kind: 'towerDamage', value: 1.10 },
  },
  {
    id: 'e_discount',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 833, y: 221 },
    connects: ['e_fire_2', 'e_notable_workshop', 'e_start_level', 'e_fire_3'],
    name: 'Скидка на стойки',
    desc: '−10 золота на первую стойку',
    cost: 24, currency: 'blue',
    effect: { kind: 'towerDiscount', value: 10 },
  },
  {
    id: 'e_start_level',
    branch: 'engineering',
    kind: 'notable',
    pos: { x: 929, y: 318 },
    connects: ['e_discount', 'e_rune_1'],
    name: 'Мастер-сборка',
    desc: '+1 стартовый уровень первой стойки',
    cost: 105, currency: 'blue',
    effect: { kind: 'towerStartLevel', value: 2 },
  },
  {
    id: 'e_rune_1',
    branch: 'engineering',
    kind: 'notable',
    pos: { x: 772, y: 180 },
    connects: ['e_dmg_2', 'e_notable_workshop', 'e_start_level', 'e_rune_2'],
    name: 'Открытая руническая точка α',
    desc: '+1 руническая точка для стойки',
    cost: 105, currency: 'blue',
    effect: { kind: 'runePointUnlock', value: 1 },
  },
  {
    id: 'e_rune_2',
    branch: 'engineering',
    kind: 'notable',
    pos: { x: 970, y: 378 },
    connects: ['e_rune_1', 'e_keystone_archmaster'],
    name: 'Открытая руническая точка β',
    desc: '+1 руническая точка для стойки',
    cost: 150, currency: 'blue',
    effect: { kind: 'runePointUnlock', value: 2 },
  },
  {
    id: 'e_keystone_archmaster',
    branch: 'engineering',
    kind: 'keystone',
    pos: { x: 933, y: 217 },
    connects: ['e_rune_2'],
    name: 'Чертёж Архимастера',
    desc: '+1 руническая точка и +10% дальность стоек',
    cost: 2, currency: 'ancient',
    effect: { kind: 'runePointUnlock', value: 3 },
    extraEffects: [{ kind: 'towerRange', value: 1.10 }],
  },

  // ─────────────────────────── Arcanum (SW, core/overload) ───────────────────
  {
    id: 'c_overload_1',
    branch: 'core',
    kind: 'small',
    pos: { x: 658, y: 524 },
    connects: ['heart_root', 'c_overload_2', 'c_aura_1'],
    name: 'Ускоренный заряд',
    desc: '+8% скорость заряда Перегруза',
    cost: 15, currency: 'blue',
    effect: { kind: 'overloadRate', value: 1.08 },
  },
  {
    id: 'c_aura_1',
    branch: 'core',
    kind: 'small',
    pos: { x: 626, y: 493 },
    connects: ['heart_root', 'c_overload_1', 'c_reaction_1', 'c_aura_2'],
    name: 'Резонансная сетка',
    desc: '+8% радиус аур',
    cost: 15, currency: 'blue',
    effect: { kind: 'auraRadius', value: 1.08 },
  },
  {
    id: 'c_overload_2',
    branch: 'core',
    kind: 'small',
    pos: { x: 637, y: 586 },
    connects: ['c_overload_1', 'c_notable_capacitor', 'c_overload_3'],
    name: 'Конденсатор',
    desc: '+15 макс. заряд Перегруза',
    cost: 21, currency: 'blue',
    effect: { kind: 'overloadMaxCharge', value: 15 },
  },
  {
    id: 'c_reaction_1',
    branch: 'core',
    kind: 'small',
    pos: { x: 565, y: 611 },
    connects: ['c_aura_1', 'c_notable_capacitor', 'c_reaction_2'],
    name: 'Стихийный резонанс',
    desc: '+10% урон элементальных реакций',
    cost: 18, currency: 'blue',
    effect: { kind: 'reactionDamage', value: 1.10 },
  },
  {
    id: 'c_reaction_2',
    branch: 'core',
    kind: 'small',
    pos: { x: 518, y: 555 },
    connects: ['c_reaction_1', 'c_keystone_resonator', 'c_reaction_3'],
    name: 'Стихийный резонанс II',
    desc: '+10% урон элементальных реакций',
    cost: 27, currency: 'blue',
    effect: { kind: 'reactionDamage', value: 1.10 },
  },
  {
    id: 'c_notable_capacitor',
    branch: 'core',
    kind: 'notable',
    pos: { x: 609, y: 645 },
    connects: ['c_overload_2', 'c_reaction_1', 'c_catalyst', 'c_keystone_resonator'],
    name: 'Расширенный конденсатор',
    desc: '+25 макс. заряд Перегруза и +15% скорость заряда',
    cost: 82, currency: 'blue',
    effect: { kind: 'overloadMaxCharge', value: 25 },
  },
  {
    id: 'c_catalyst',
    branch: 'core',
    kind: 'notable',
    pos: { x: 509, y: 641 },
    connects: ['c_notable_capacitor'],
    name: 'Слот катализатора',
    desc: '+1 катализатор в забеге (зарезервирован)',
    cost: 2, currency: 'ancient',
    effect: { kind: 'catalystSlot', value: 1 },
  },
  {
    id: 'c_keystone_resonator',
    branch: 'core',
    kind: 'keystone',
    pos: { x: 455, y: 656 },
    connects: ['c_notable_capacitor', 'c_reaction_2'],
    name: 'Резонатор стихий',
    desc: '+30% урона реакциям стихий',
    cost: 2, currency: 'ancient',
    effect: { kind: 'reactionDamage', value: 1.30 },
  },

  // ─────────────────────────── Survival (SE) ───────────────────────────
  {
    id: 's_hp_1',
    branch: 'survival',
    kind: 'small',
    pos: { x: 774, y: 493 },
    connects: ['heart_root', 's_hp_2', 's_armor_1'],
    name: 'Прочный каркас',
    desc: '+10 макс. ХП манекена',
    cost: 12, currency: 'blue',
    effect: { kind: 'maxHp', value: 10 },
  },
  {
    id: 's_armor_1',
    branch: 'survival',
    kind: 'small',
    pos: { x: 743, y: 524 },
    connects: ['heart_root', 's_hp_1', 's_armor_2', 's_repair_1'],
    name: 'Железная обшивка',
    desc: '+3% брони манекена',
    cost: 15, currency: 'blue',
    effect: { kind: 'armor', value: 0.03 },
  },
  {
    id: 's_hp_2',
    branch: 'survival',
    kind: 'small',
    pos: { x: 836, y: 513 },
    connects: ['s_hp_1', 's_notable_frame', 's_hp_3'],
    name: 'Прочный каркас II',
    desc: '+15 макс. ХП манекена',
    cost: 21, currency: 'blue',
    effect: { kind: 'maxHp', value: 15 },
  },
  {
    id: 's_armor_2',
    branch: 'survival',
    kind: 'small',
    pos: { x: 763, y: 586 },
    connects: ['s_armor_1', 's_notable_frame', 's_repair_1', 's_armor_3'],
    name: 'Железная обшивка II',
    desc: '+3% брони манекена',
    cost: 21, currency: 'blue',
    effect: { kind: 'armor', value: 0.03 },
  },
  {
    id: 's_notable_frame',
    branch: 'survival',
    kind: 'notable',
    pos: { x: 848, y: 598 },
    connects: ['s_hp_2', 's_armor_2', 's_thorns', 's_boss_shield'],
    name: 'Усиленный корпус',
    desc: '+25 ХП и +5% брони манекена',
    cost: 82, currency: 'blue',
    effect: { kind: 'maxHp', value: 25 },
  },
  {
    id: 's_repair_1',
    branch: 'survival',
    kind: 'small',
    pos: { x: 929, y: 583 },
    connects: ['s_armor_1', 's_armor_2', 's_repair_notable'],
    name: 'Авто-ремонт',
    desc: '+1 ХП/сек регенерация вне боя',
    cost: 30, currency: 'blue',
    effect: { kind: 'autoRepair', value: 1 },
  },
  {
    id: 's_repair_notable',
    branch: 'survival',
    kind: 'notable',
    pos: { x: 974, y: 596 },
    connects: ['s_repair_1', 's_boss_shield', 's_keystone_thorns'],
    name: 'Полевой ремонт',
    desc: '+2 ХП/сек регенерация вне боя',
    cost: 90, currency: 'blue',
    effect: { kind: 'autoRepair', value: 2 },
  },
  {
    id: 's_thorns',
    branch: 'survival',
    kind: 'small',
    pos: { x: 833, y: 679 },
    connects: ['s_notable_frame', 's_keystone_thorns'],
    name: 'Шипастый каркас',
    desc: '+3 урона атакующему врагу',
    cost: 33, currency: 'blue',
    effect: { kind: 'thornyShell', value: 1 },
  },
  {
    id: 's_boss_shield',
    branch: 'survival',
    kind: 'notable',
    pos: { x: 769, y: 706 },
    connects: ['s_notable_frame', 's_repair_notable', 's_keystone_thorns'],
    name: 'Щит босс-волны',
    desc: '+25 ХП щита в начале босс-волны',
    cost: 105, currency: 'blue',
    effect: { kind: 'bossShield', value: 25 },
  },
  {
    id: 's_keystone_thorns',
    branch: 'survival',
    kind: 'keystone',
    pos: { x: 919, y: 710 },
    connects: ['s_thorns', 's_boss_shield', 's_repair_notable'],
    name: 'Сердце Голема (Закалённое)',
    desc: '+5 урона шипам, +30% эффективности авто-ремонта',
    cost: 2, currency: 'ancient',
    effect: { kind: 'thornyShell', value: 1 },
  },

  // ─────────────────────────── Economy ring (cross-branch) ──────────────────
  {
    id: 'eco_essence_1',
    branch: 'survival',
    kind: 'small',
    pos: { x: 700, y: 535 },
    connects: ['heart_root', 'eco_essence_notable'],
    name: 'Эссенциальная жатва I',
    desc: '+10% Синей Эссенции за забег',
    cost: 24, currency: 'blue',
    effect: { kind: 'essenceBonus', value: 1.10 },
  },
  {
    id: 'eco_essence_notable',
    branch: 'survival',
    kind: 'notable',
    pos: { x: 705, y: 600 },
    connects: ['eco_essence_1', 'eco_gold_1', 'p_aim_1'],
    name: 'Эссенциальная жатва II',
    desc: '+25% Синей Эссенции за забег',
    cost: 120, currency: 'blue',
    effect: { kind: 'essenceBonus', value: 1.25 },
  },
  {
    id: 'eco_gold_1',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 719, y: 664 },
    connects: ['eco_essence_notable', 'eco_gold_2'],
    name: 'Золотая жила',
    desc: '+10% золота с врагов',
    cost: 24, currency: 'blue',
    effect: { kind: 'goldDrop', value: 1.10 },
  },
  {
    id: 'eco_gold_2',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 714, y: 720 },
    connects: ['eco_gold_1'],
    name: 'Стартовый кошелёк',
    desc: '+30 стартового золота',
    cost: 30, currency: 'blue',
    effect: { kind: 'startGold', value: 30 },
  },
  // ─────────────────────────── v2: Alchemy expansion ───────────────────────
  {
    id: 'p_dmg_3',
    branch: 'potions',
    kind: 'small',
    pos: { x: 493, y: 375 },
    connects: ['p_dmg_2', 'p_notable_concentrate'],
    name: 'Концентрат III',
    desc: '+5% урон склянок',
    cost: 27, currency: 'blue',
    effect: { kind: 'potionDamage', value: 1.05 },
  },
  {
    id: 'p_cd_3',
    branch: 'potions',
    kind: 'small',
    pos: { x: 654, y: 235 },
    connects: ['p_cd_2', 'p_notable_concentrate'],
    name: 'Быстрые руки III',
    desc: '-4% кулдаун склянок',
    cost: 27, currency: 'blue',
    effect: { kind: 'potionCooldown', value: 0.96 },
  },
  {
    id: 'p_radius_3',
    branch: 'potions',
    kind: 'small',
    pos: { x: 462, y: 313 },
    connects: ['p_radius_2', 'p_notable_concentrate'],
    name: 'Широкий всплеск III',
    desc: '+5% радиус взрыва',
    cost: 27, currency: 'blue',
    effect: { kind: 'potionRadius', value: 1.05 },
  },
  {
    id: 'p_notable_concentrate',
    branch: 'potions',
    kind: 'notable',
    pos: { x: 419, y: 319 },
    connects: ['p_dmg_3', 'p_cd_3', 'p_radius_3', 'p_armor_pen', 'p_crit_1'],
    name: 'Совершенный состав',
    desc: '+20% урон, +5% радиус взрыва',
    cost: 98, currency: 'blue',
    effect: { kind: 'potionDamage', value: 1.20 },
  },
  {
    id: 'p_armor_pen',
    branch: 'potions',
    kind: 'small',
    pos: { x: 366, y: 329 },
    connects: ['p_notable_concentrate'],
    name: 'Бронебойные склянки',
    desc: '+10% бронепробитие склянок и стоек',
    cost: 24, currency: 'blue',
    effect: { kind: 'armorPen', value: 0.10 },
  },
  {
    id: 'p_crit_1',
    branch: 'potions',
    kind: 'small',
    pos: { x: 409, y: 246 },
    connects: ['p_notable_concentrate', 'p_armor_pen'],
    name: 'Алхимический скол',
    desc: '+5% шанс крит. удара (×2 урон)',
    cost: 21, currency: 'blue',
    effect: { kind: 'critChance', value: 0.05 },
  },
  {
    id: 'p_keystone_volcano',
    branch: 'potions',
    kind: 'keystone',
    pos: { x: 348, y: 271 },
    connects: ['p_armor_pen', 'p_crit_1'],
    name: 'Вулканический рецепт',
    desc: '+50% урона и +огонь каждому 4-му броску',
    cost: 2, currency: 'ancient',
    effect: { kind: 'potionLeavesFire', value: 1 },
  },

  // ─────────────────────────── v2: Engineering expansion ───────────────────
  {
    id: 'e_fire_3',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 816, y: 163 },
    connects: ['e_discount', 'e_notable_armament'],
    name: 'Смазка III',
    desc: '+4% скорострельность стоек',
    cost: 27, currency: 'blue',
    effect: { kind: 'towerFireRate', value: 1.04 },
  },
  {
    id: 'e_dmg_3',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 962, y: 365 },
    connects: ['e_dmg_2', 'e_notable_armament'],
    name: 'Усиленные дюзы III',
    desc: '+5% урон стоек',
    cost: 27, currency: 'blue',
    effect: { kind: 'towerDamage', value: 1.05 },
  },
  {
    id: 'e_range_3',
    branch: 'engineering',
    kind: 'small',
    pos: { x: 912, y: 413 },
    connects: ['e_range_2', 'e_notable_armament'],
    name: 'Оптика III',
    desc: '+5% дальность стоек',
    cost: 27, currency: 'blue',
    effect: { kind: 'towerRange', value: 1.05 },
  },
  {
    id: 'e_notable_armament',
    branch: 'engineering',
    kind: 'notable',
    pos: { x: 1000, y: 290 },
    connects: ['e_fire_3', 'e_dmg_3', 'e_range_3', 'e_keystone_overdrive', 'e_rune_3'],
    name: 'Полный арсенал',
    desc: '+15% урон и +10% дальность стоек',
    cost: 105, currency: 'blue',
    effect: { kind: 'towerDamage', value: 1.15 },
    extraEffects: [{ kind: 'towerRange', value: 1.10 }],
  },
  {
    id: 'e_rune_3',
    branch: 'engineering',
    kind: 'notable',
    pos: { x: 1053, y: 356 },
    connects: ['e_notable_armament', 'e_keystone_overdrive'],
    name: 'Открытая руническая точка γ',
    desc: '+1 руническая точка для стойки',
    cost: 150, currency: 'blue',
    effect: { kind: 'runePointUnlock', value: 4 },
  },
  {
    id: 'e_keystone_overdrive',
    branch: 'engineering',
    kind: 'keystone',
    pos: { x: 1031, y: 243 },
    connects: ['e_notable_armament', 'e_dmg_3', 'e_rune_3'],
    name: 'Overdrive',
    desc: '+5% крит-шанс стоек и склянок',
    cost: 2, currency: 'ancient',
    effect: { kind: 'critChance', value: 0.05 },
  },

  // ─────────────────────────── v2: Arcanum expansion ───────────────────────
  {
    id: 'c_overload_3',
    branch: 'core',
    kind: 'small',
    pos: { x: 643, y: 663 },
    connects: ['c_overload_2', 'c_notable_amplifier'],
    name: 'Конденсатор II',
    desc: '+20 макс. заряд Перегруза',
    cost: 33, currency: 'blue',
    effect: { kind: 'overloadMaxCharge', value: 20 },
  },
  {
    id: 'c_reaction_3',
    branch: 'core',
    kind: 'small',
    pos: { x: 462, y: 588 },
    connects: ['c_reaction_2', 'c_notable_amplifier'],
    name: 'Стихийный резонанс III',
    desc: '+10% урон элементальных реакций',
    cost: 27, currency: 'blue',
    effect: { kind: 'reactionDamage', value: 1.10 },
  },
  {
    id: 'c_aura_2',
    branch: 'core',
    kind: 'small',
    pos: { x: 564, y: 513 },
    connects: ['c_aura_1', 'c_notable_amplifier'],
    name: 'Резонансная сетка II',
    desc: '+8% радиус аур',
    cost: 21, currency: 'blue',
    effect: { kind: 'auraRadius', value: 1.08 },
  },
  {
    id: 'c_notable_amplifier',
    branch: 'core',
    kind: 'notable',
    pos: { x: 522, y: 704 },
    connects: ['c_overload_3', 'c_reaction_3', 'c_aura_2'],
    name: 'Усилитель резонанса',
    desc: '+30 макс. заряд Перегруза и +10% скорость заряда',
    cost: 90, currency: 'blue',
    effect: { kind: 'overloadMaxCharge', value: 30 },
  },

  // ─────────────────────────── v2: Survival expansion ──────────────────────
  {
    id: 's_hp_3',
    branch: 'survival',
    kind: 'small',
    pos: { x: 907, y: 525 },
    connects: ['s_hp_2', 's_armor_3'],
    name: 'Прочный каркас III',
    desc: '+20 макс. ХП манекена',
    cost: 30, currency: 'blue',
    effect: { kind: 'maxHp', value: 20 },
  },
  {
    id: 's_armor_3',
    branch: 'survival',
    kind: 'small',
    pos: { x: 775, y: 657 },
    connects: ['s_armor_2', 's_hp_3'],
    name: 'Железная обшивка III',
    desc: '+3% брони манекена',
    cost: 24, currency: 'blue',
    effect: { kind: 'armor', value: 0.03 },
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
