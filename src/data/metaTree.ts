/**
 * Meta-progression — three independent diamond-shaped trees.
 *
 *  - Each tree is its own self-contained graph: nodes only connect to other
 *    nodes within the same tree. The graph forms a vertical rhombus made of
 *    seven tiers (1 – 3 – 3 – 5 – 3 – 3 – 1). The lone bottom node of every
 *    tree is its `root` (always allocated for free); the lone top node is the
 *    tree's `keystone` (powerful, paid in Древняя Эссенция).
 *  - The three tree branches are: «Мастер колб» (potions), «Мастер стоек»
 *    (engineering / towers) and «Выживаемость» (survival / mannequin).
 *  - Allocation rule unchanged: a node becomes available once at least one of
 *    its neighbours is allocated. Roots are pre-allocated, so every tree has
 *    one always-reachable entry point.
 *  - Saves still store an array of allocated ids; ids that no longer exist
 *    are silently ignored, so an old save just loses progress.
 */
export interface MetaUpgrade {
  id: string;
  branch: MetaBranch;
  /** Node tier — drives cost class, render size and outline thickness. */
  kind: NodeKind;
  /** Layout in the tree canvas (≈ 0..1500 × 0..900). */
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

export type MetaBranch = 'potions' | 'engineering' | 'survival';

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
  potions: 'Мастер колб',
  engineering: 'Мастер стоек',
  survival: 'Выживаемость',
};

export function branchName(b: MetaBranch): string {
  return BRANCH_NAMES[b];
}

// ────────── Layout constants for the three diamond trees ──────────
//
// The tree panel renders three rhombi side-by-side. Each tree spans the
// same seven tiers (top keystone → 3 → 5 → 5 → 5 → 3 → bottom root) and
// the same widths, so the player sees three identical-shaped diamonds.
// The middle three tiers all hold 5 cells, which gives every tree two extra
// slots compared with the original 1-3-3-5-3-3-1 shape — the engineering
// branch uses those slots to host the two new "+1 руническая точка" talents
// (δ / ε) that unlock the last pair of locked rune points around the dais.

/** Per-row Y coordinate inside the SVG view-box. Tier indices are top→bottom. */
const TIER_Y = [110, 220, 330, 440, 550, 660, 770];
/** Per-row column X-offsets relative to the tree's centre. Each entry maps a
 *  tier index to the offsets used by the cells in that row (left → right). */
const TIER_X_OFFSETS: number[][] = [
  [0],                                    // tier 0 — top apex (1 cell)
  [-80, 0, 80],                           // tier 1 — 3 cells
  [-160, -80, 0, 80, 160],                // tier 2 — 5 cells
  [-160, -80, 0, 80, 160],                // tier 3 — 5 cells (widest)
  [-160, -80, 0, 80, 160],                // tier 4 — 5 cells
  [-80, 0, 80],                           // tier 5 — 3 cells
  [0],                                    // tier 6 — bottom apex (1 cell)
];

/** Centres of each tree along the X axis (in SVG view-box coords). */
export const TREE_CENTERS: Record<MetaBranch, number> = {
  potions: 250,
  engineering: 750,
  survival: 1250,
};

export const TREE_TIER_Y = TIER_Y;
export const TREE_KEYSTONE_Y = TIER_Y[0];
export const TREE_ROOT_Y = TIER_Y[TIER_Y.length - 1];

/** Tree title Y (above the keystone). Used by metaOverlay to render labels. */
export const TREE_TITLE_Y = 50;

// View-box dimensions used by the overlay SVG.
export const VIEW_W = 1500;
export const VIEW_H = 900;

// ────────── Node-construction helper ──────────

/** Compact intermediate description of a single tree cell. */
interface CellDef {
  kind: NodeKind;
  name: string;
  desc: string;
  cost: number;
  currency: 'blue' | 'ancient';
  effect: MetaEffect;
  extraEffects?: MetaEffect[];
}

/** Per-tree definition — exactly seven tiers; widths must match TIER_X_OFFSETS. */
interface TreeDef {
  prefix: string;
  branch: MetaBranch;
  /** rows[i] is the array of cells at tier i, left → right. */
  rows: CellDef[][];
}

/** Default vertical edges: each cell connects to the cells in the row above
 *  whose horizontal offset is closest. Adjacent same-row cells are also
 *  connected so the layout reads as a connected rhombus.
 *
 *  The result is encoded as symmetric `connects` arrays on the produced
 *  `MetaUpgrade` objects. */
function buildTreeNodes(def: TreeDef): MetaUpgrade[] {
  const cellId = (tier: number, col: number) => `${def.prefix}_${tier}_${col}`;
  const cx = TREE_CENTERS[def.branch];
  const nodes: MetaUpgrade[] = [];
  for (let tier = 0; tier < def.rows.length; tier++) {
    const row = def.rows[tier];
    const offsets = TIER_X_OFFSETS[tier];
    if (row.length !== offsets.length) {
      throw new Error(
        `metaTree: tree '${def.prefix}' tier ${tier} has ${row.length} cells but expected ${offsets.length}`,
      );
    }
    for (let col = 0; col < row.length; col++) {
      const cell = row[col];
      nodes.push({
        id: cellId(tier, col),
        branch: def.branch,
        kind: cell.kind,
        pos: { x: cx + offsets[col], y: TIER_Y[tier] },
        connects: [],
        name: cell.name,
        desc: cell.desc,
        cost: cell.cost,
        currency: cell.currency,
        effect: cell.effect,
        extraEffects: cell.extraEffects,
      });
    }
  }

  // Index by id for fast lookup while wiring edges.
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const link = (a: string, b: string) => {
    const na = byId.get(a);
    const nb = byId.get(b);
    if (!na || !nb) return;
    if (!na.connects.includes(b)) na.connects.push(b);
    if (!nb.connects.includes(a)) nb.connects.push(a);
  };

  // Vertical edges: each cell links to the cell(s) directly above whose
  // x-offset is identical OR the two whose x-offsets bracket it.
  for (let tier = 1; tier < def.rows.length; tier++) {
    const upper = TIER_X_OFFSETS[tier - 1];
    const lower = TIER_X_OFFSETS[tier];
    for (let col = 0; col < lower.length; col++) {
      const x = lower[col];
      // Find upper indices that are the closest above this cell. Connect to
      // the closest, and additionally to the second-closest if both sides of
      // the cell exist (so a wide-row cell at -160 still links upward).
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < upper.length; i++) {
        const d = Math.abs(upper[i] - x);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      link(cellId(tier - 1, bestIdx), cellId(tier, col));
      // If the cell sits between two upper cells (tie or near-tie), link both.
      for (let i = 0; i < upper.length; i++) {
        if (i === bestIdx) continue;
        if (Math.abs(upper[i] - x) <= bestDist + 1e-3) {
          link(cellId(tier - 1, i), cellId(tier, col));
        }
      }
    }
  }

  // Horizontal edges: connect adjacent cells in the same row so the diamond
  // reads as a single mesh, not a tree of disconnected verticals.
  for (let tier = 0; tier < def.rows.length; tier++) {
    const row = def.rows[tier];
    for (let col = 0; col + 1 < row.length; col++) {
      link(cellId(tier, col), cellId(tier, col + 1));
    }
  }

  // The wide centre tier (3) and its neighbours (2 / 4) all share the same
  // five-cell offsets, so the auto-linker above already wires same-offset
  // cells together. No extra fan-out is needed for the wing cells: each ±160
  // cell has its same-offset partner directly above and below.

  // The single-cell apex tiers (root at the bottom, keystone at the top)
  // fan out to *every* cell of the adjacent 3-cell tier. This makes the
  // diamond a true converging point: the player can enter the tree from
  // any of the three nodes flanking the root, and likewise the keystone
  // can be reached from any of the three tier-1 nodes — no single
  // forced path through the middle.
  const lastTier = def.rows.length - 1;
  for (let i = 0; i < TIER_X_OFFSETS[lastTier - 1].length; i++) {
    link(cellId(lastTier, 0), cellId(lastTier - 1, i));
  }
  for (let i = 0; i < TIER_X_OFFSETS[1].length; i++) {
    link(cellId(0, 0), cellId(1, i));
  }

  return nodes;
}

// ────────── Tree 1: Мастер колб (Potion Master) ──────────

const POTION_TREE: TreeDef = {
  prefix: 'pm',
  branch: 'potions',
  rows: [
    // Tier 0 — apex keystone
    [
      {
        kind: 'keystone',
        name: 'Вулканический рецепт',
        desc: '+огонь к каждому 4-му броску склянки и +50% урона горения',
        cost: 2,
        currency: 'ancient',
        effect: { kind: 'potionLeavesFire', value: 1 },
      },
    ],
    // Tier 1 — 3 small (close to keystone)
    [
      {
        kind: 'small',
        name: 'Прицельный бросок II',
        desc: '+5% бонус ручного попадания склянками',
        cost: 33,
        currency: 'blue',
        effect: { kind: 'potionAimBonus', value: 0.05 },
      },
      {
        kind: 'small',
        name: 'Эхо взрыва II',
        desc: '+8% шанс микровзрыва склянки',
        cost: 33,
        currency: 'blue',
        effect: { kind: 'potionEchoChance', value: 0.08 },
      },
      {
        kind: 'small',
        name: 'Стихийный резонанс II',
        desc: '+10% урона элементальным реакциям',
        cost: 33,
        currency: 'blue',
        effect: { kind: 'reactionDamage', value: 1.10 },
      },
    ],
    // Tier 2 — 5 cells (small / small / notable / small / small)
    [
      {
        kind: 'small',
        name: 'Резонансный порошок',
        desc: '+10% урона элементальным реакциям',
        cost: 30,
        currency: 'blue',
        effect: { kind: 'reactionDamage', value: 1.10 },
      },
      {
        kind: 'small',
        name: 'Бронебойные склянки',
        desc: '+10% бронепробития склянок и стоек',
        cost: 30,
        currency: 'blue',
        effect: { kind: 'armorPen', value: 0.10 },
      },
      {
        kind: 'notable',
        name: 'Совершенный состав',
        desc: '+20% урона склянок',
        cost: 98,
        currency: 'blue',
        effect: { kind: 'potionDamage', value: 1.20 },
      },
      {
        kind: 'small',
        name: 'Алхимический скол',
        desc: '+5% шанса критического удара (×2 урон)',
        cost: 30,
        currency: 'blue',
        effect: { kind: 'critChance', value: 0.05 },
      },
      {
        kind: 'small',
        name: 'Широкий всплеск III',
        desc: '+5% радиус взрыва склянок',
        cost: 30,
        currency: 'blue',
        effect: { kind: 'potionRadius', value: 1.05 },
      },
    ],
    // Tier 3 — 5 small (widest)
    [
      {
        kind: 'small',
        name: 'Концентрат III',
        desc: '+5% урона склянок',
        cost: 24,
        currency: 'blue',
        effect: { kind: 'potionDamage', value: 1.05 },
      },
      {
        kind: 'small',
        name: 'Прицельный бросок',
        desc: '+5% бонус ручного попадания',
        cost: 21,
        currency: 'blue',
        effect: { kind: 'potionAimBonus', value: 0.05 },
      },
      {
        kind: 'small',
        name: 'Широкий всплеск II',
        desc: '+5% радиус взрыва склянок',
        cost: 21,
        currency: 'blue',
        effect: { kind: 'potionRadius', value: 1.05 },
      },
      {
        kind: 'small',
        name: 'Стихийный резонанс',
        desc: '+10% урона элементальным реакциям',
        cost: 27,
        currency: 'blue',
        effect: { kind: 'reactionDamage', value: 1.10 },
      },
      {
        kind: 'small',
        name: 'Эхо взрыва',
        desc: '+8% шанс микровзрыва склянки',
        cost: 27,
        currency: 'blue',
        effect: { kind: 'potionEchoChance', value: 0.08 },
      },
    ],
    // Tier 4 — 5 cells (small / small / notable / small / small)
    [
      {
        kind: 'small',
        name: 'Тонкий помол II',
        desc: '+5% радиус взрыва склянок',
        cost: 18,
        currency: 'blue',
        effect: { kind: 'potionRadius', value: 1.05 },
      },
      {
        kind: 'small',
        name: 'Концентрат II',
        desc: '+5% урона склянок',
        cost: 18,
        currency: 'blue',
        effect: { kind: 'potionDamage', value: 1.05 },
      },
      {
        kind: 'notable',
        name: 'Тяжёлый состав',
        desc: '+15% урона и +10% радиус взрыва склянок',
        cost: 82,
        currency: 'blue',
        effect: { kind: 'potionDamage', value: 1.15 },
        extraEffects: [{ kind: 'potionRadius', value: 1.10 }],
      },
      {
        kind: 'small',
        name: 'Быстрые руки II',
        desc: '−4% откат склянок',
        cost: 18,
        currency: 'blue',
        effect: { kind: 'potionCooldown', value: 0.96 },
      },
      {
        kind: 'small',
        name: 'Запальный клапан',
        desc: '+4% шанс микровзрыва склянки',
        cost: 18,
        currency: 'blue',
        effect: { kind: 'potionEchoChance', value: 0.04 },
      },
    ],
    // Tier 5 — 3 small
    [
      {
        kind: 'small',
        name: 'Концентрат',
        desc: '+5% урона склянок',
        cost: 12,
        currency: 'blue',
        effect: { kind: 'potionDamage', value: 1.05 },
      },
      {
        kind: 'small',
        name: 'Широкий всплеск',
        desc: '+5% радиус взрыва склянок',
        cost: 12,
        currency: 'blue',
        effect: { kind: 'potionRadius', value: 1.05 },
      },
      {
        kind: 'small',
        name: 'Быстрые руки',
        desc: '−4% откат склянок',
        cost: 12,
        currency: 'blue',
        effect: { kind: 'potionCooldown', value: 0.96 },
      },
    ],
    // Tier 6 — root
    [
      {
        kind: 'root',
        name: 'Сердце алхимика',
        desc: 'Стартовый узел школы склянок.',
        cost: 0,
        currency: 'blue',
        effect: { kind: 'potionDamage', value: 1 },
      },
    ],
  ],
};

// ────────── Tree 2: Мастер стоек (Tower / Engineering Master) ──────────

const TOWER_TREE: TreeDef = {
  prefix: 'tm',
  branch: 'engineering',
  rows: [
    // Tier 0 — apex keystone
    [
      {
        kind: 'keystone',
        name: 'Чертёж Архимастера',
        desc: '+1 руническая точка стойки и +10% дальность стоек',
        cost: 2,
        currency: 'ancient',
        effect: { kind: 'runePointUnlock', value: 3 },
        extraEffects: [{ kind: 'towerRange', value: 1.10 }],
      },
    ],
    // Tier 1 — 3 small near keystone
    [
      {
        kind: 'small',
        name: 'Открытая руническая точка β',
        desc: '+1 руническая точка стойки',
        cost: 33,
        currency: 'blue',
        effect: { kind: 'runePointUnlock', value: 2 },
      },
      {
        kind: 'small',
        name: 'Перегрузная катушка II',
        desc: '+25 макс. заряда Перегруза',
        cost: 33,
        currency: 'blue',
        effect: { kind: 'overloadMaxCharge', value: 25 },
      },
      {
        kind: 'small',
        name: 'Открытая руническая точка γ',
        desc: '+1 руническая точка стойки',
        cost: 33,
        currency: 'blue',
        effect: { kind: 'runePointUnlock', value: 4 },
      },
    ],
    // Tier 2 — 5 cells; the wing slots host the new rune-unlock talents δ / ε
    // so every locked rune around the dais now has a matching talent.
    [
      {
        kind: 'small',
        name: 'Открытая руническая точка δ',
        desc: '+1 руническая точка стойки',
        cost: 36,
        currency: 'blue',
        effect: { kind: 'runePointUnlock', value: 5 },
      },
      {
        kind: 'small',
        name: 'Стартовый разряд',
        desc: '+1 стартовый уровень первой стойки',
        cost: 30,
        currency: 'blue',
        effect: { kind: 'towerStartLevel', value: 2 },
      },
      {
        kind: 'notable',
        name: 'Полный арсенал',
        desc: '+15% урона и +10% дальность стоек',
        cost: 105,
        currency: 'blue',
        effect: { kind: 'towerDamage', value: 1.15 },
        extraEffects: [{ kind: 'towerRange', value: 1.10 }],
      },
      {
        kind: 'small',
        name: 'Скидка на стойки',
        desc: '−10 золота на первую стойку',
        cost: 27,
        currency: 'blue',
        effect: { kind: 'towerDiscount', value: 10 },
      },
      {
        kind: 'small',
        name: 'Открытая руническая точка ε',
        desc: '+1 руническая точка стойки',
        cost: 36,
        currency: 'blue',
        effect: { kind: 'runePointUnlock', value: 6 },
      },
    ],
    // Tier 3 — 5 small (widest)
    [
      {
        kind: 'small',
        name: 'Усиленные дюзы III',
        desc: '+5% урона стоек',
        cost: 24,
        currency: 'blue',
        effect: { kind: 'towerDamage', value: 1.05 },
      },
      {
        kind: 'small',
        name: 'Открытая руническая точка α',
        desc: '+1 руническая точка стойки',
        cost: 27,
        currency: 'blue',
        effect: { kind: 'runePointUnlock', value: 1 },
      },
      {
        kind: 'small',
        name: 'Перегрузная катушка',
        desc: '+15 макс. заряда Перегруза',
        cost: 24,
        currency: 'blue',
        effect: { kind: 'overloadMaxCharge', value: 15 },
      },
      {
        kind: 'small',
        name: 'Ускоренный заряд',
        desc: '+8% скорости заряда Перегруза',
        cost: 21,
        currency: 'blue',
        effect: { kind: 'overloadRate', value: 1.08 },
      },
      {
        kind: 'small',
        name: 'Оптика III',
        desc: '+5% дальности стоек',
        cost: 24,
        currency: 'blue',
        effect: { kind: 'towerRange', value: 1.05 },
      },
    ],
    // Tier 4 — 5 cells (small / small / notable / small / small)
    [
      {
        kind: 'small',
        name: 'Перегрузная катушка III',
        desc: '+15 макс. заряда Перегруза',
        cost: 18,
        currency: 'blue',
        effect: { kind: 'overloadMaxCharge', value: 15 },
      },
      {
        kind: 'small',
        name: 'Усиленные дюзы II',
        desc: '+5% урона стоек',
        cost: 18,
        currency: 'blue',
        effect: { kind: 'towerDamage', value: 1.05 },
      },
      {
        kind: 'notable',
        name: 'Мастерская Архимастера',
        desc: '+10% урон и +5% скорострельность стоек',
        cost: 90,
        currency: 'blue',
        effect: { kind: 'towerDamage', value: 1.10 },
        extraEffects: [{ kind: 'towerFireRate', value: 1.05 }],
      },
      {
        kind: 'small',
        name: 'Оптика II',
        desc: '+5% дальности стоек',
        cost: 18,
        currency: 'blue',
        effect: { kind: 'towerRange', value: 1.05 },
      },
      {
        kind: 'small',
        name: 'Смазанные шестерни II',
        desc: '+4% скорострельности стоек',
        cost: 18,
        currency: 'blue',
        effect: { kind: 'towerFireRate', value: 1.04 },
      },
    ],
    // Tier 5 — 3 small (entry tier)
    [
      {
        kind: 'small',
        name: 'Усиленные дюзы',
        desc: '+5% урона стоек',
        cost: 12,
        currency: 'blue',
        effect: { kind: 'towerDamage', value: 1.05 },
      },
      {
        kind: 'small',
        name: 'Смазанные шестерни',
        desc: '+4% скорострельности стоек',
        cost: 12,
        currency: 'blue',
        effect: { kind: 'towerFireRate', value: 1.04 },
      },
      {
        kind: 'small',
        name: 'Точная оптика',
        desc: '+5% дальности стоек',
        cost: 12,
        currency: 'blue',
        effect: { kind: 'towerRange', value: 1.05 },
      },
    ],
    // Tier 6 — root
    [
      {
        kind: 'root',
        name: 'Сердце инженера',
        desc: 'Стартовый узел школы стоек.',
        cost: 0,
        currency: 'blue',
        effect: { kind: 'towerDamage', value: 1 },
      },
    ],
  ],
};

// ────────── Tree 3: Выживаемость (Survival) ──────────

const SURVIVAL_TREE: TreeDef = {
  prefix: 'sv',
  branch: 'survival',
  rows: [
    // Tier 0 — apex keystone
    [
      {
        kind: 'keystone',
        name: 'Шипастый голем',
        desc: 'Враги получают 3 урона при атаке Манекена и +30 макс. ХП',
        cost: 2,
        currency: 'ancient',
        effect: { kind: 'thornyShell', value: 1 },
        extraEffects: [{ kind: 'maxHp', value: 30 }],
      },
    ],
    // Tier 1 — 3 small near keystone
    [
      {
        kind: 'small',
        name: 'Полевой ремонт',
        desc: '+2 ХП/сек регенерации Манекена вне боя',
        cost: 33,
        currency: 'blue',
        effect: { kind: 'autoRepair', value: 2 },
      },
      {
        kind: 'small',
        name: 'Шипастый каркас II',
        desc: '+3 урона врагу при атаке Манекена',
        cost: 33,
        currency: 'blue',
        effect: { kind: 'thornyShell', value: 1 },
      },
      {
        kind: 'small',
        name: 'Щит босс-волны II',
        desc: '+25 ХП щит в начале босс-волны',
        cost: 33,
        currency: 'blue',
        effect: { kind: 'bossShield', value: 25 },
      },
    ],
    // Tier 2 — 5 cells (small / small / notable / small / small)
    [
      {
        kind: 'small',
        name: 'Боевой ремонт',
        desc: '+1 ХП/сек регенерации Манекена вне боя',
        cost: 30,
        currency: 'blue',
        effect: { kind: 'autoRepair', value: 1 },
      },
      {
        kind: 'small',
        name: 'Прочный каркас III',
        desc: '+20 макс. ХП Манекена',
        cost: 30,
        currency: 'blue',
        effect: { kind: 'maxHp', value: 20 },
      },
      {
        kind: 'notable',
        name: 'Усиленный корпус',
        desc: '+25 ХП и +5% брони Манекена',
        cost: 90,
        currency: 'blue',
        effect: { kind: 'maxHp', value: 25 },
        extraEffects: [{ kind: 'armor', value: 0.05 }],
      },
      {
        kind: 'small',
        name: 'Железная обшивка III',
        desc: '+3% брони Манекена',
        cost: 30,
        currency: 'blue',
        effect: { kind: 'armor', value: 0.03 },
      },
      {
        kind: 'small',
        name: 'Щит босс-волны III',
        desc: '+25 ХП щит в начале босс-волны',
        cost: 30,
        currency: 'blue',
        effect: { kind: 'bossShield', value: 25 },
      },
    ],
    // Tier 3 — 5 small (widest)
    [
      {
        kind: 'small',
        name: 'Авто-ремонт',
        desc: '+1 ХП/сек регенерации Манекена вне боя',
        cost: 27,
        currency: 'blue',
        effect: { kind: 'autoRepair', value: 1 },
      },
      {
        kind: 'small',
        name: 'Шипастый каркас',
        desc: '+3 урона врагу при атаке Манекена',
        cost: 27,
        currency: 'blue',
        effect: { kind: 'thornyShell', value: 1 },
      },
      {
        kind: 'small',
        name: 'Щит босс-волны',
        desc: '+25 ХП щит в начале босс-волны',
        cost: 27,
        currency: 'blue',
        effect: { kind: 'bossShield', value: 25 },
      },
      {
        kind: 'small',
        name: 'Эссенциальная жатва',
        desc: '+25% Синей Эссенции за забег',
        cost: 24,
        currency: 'blue',
        effect: { kind: 'essenceBonus', value: 1.25 },
      },
      {
        kind: 'small',
        name: 'Золотая жила',
        desc: '+10% золота с врагов',
        cost: 24,
        currency: 'blue',
        effect: { kind: 'goldDrop', value: 1.10 },
      },
    ],
    // Tier 4 — 5 cells (small / small / notable / small / small)
    [
      {
        kind: 'small',
        name: 'Лёгкий ход',
        desc: '+10% радиус подбора лута',
        cost: 18,
        currency: 'blue',
        effect: { kind: 'lootRadius', value: 1.10 },
      },
      {
        kind: 'small',
        name: 'Прочный каркас II',
        desc: '+15 макс. ХП Манекена',
        cost: 18,
        currency: 'blue',
        effect: { kind: 'maxHp', value: 15 },
      },
      {
        kind: 'notable',
        name: 'Стальная клёпка',
        desc: '+25 ХП и +3% брони Манекена',
        cost: 82,
        currency: 'blue',
        effect: { kind: 'maxHp', value: 25 },
        extraEffects: [{ kind: 'armor', value: 0.03 }],
      },
      {
        kind: 'small',
        name: 'Железная обшивка II',
        desc: '+3% брони Манекена',
        cost: 18,
        currency: 'blue',
        effect: { kind: 'armor', value: 0.03 },
      },
      {
        kind: 'small',
        name: 'Крепкий кошелёк',
        desc: '+30 стартового золота',
        cost: 18,
        currency: 'blue',
        effect: { kind: 'startGold', value: 30 },
      },
    ],
    // Tier 5 — 3 small (entry tier)
    [
      {
        kind: 'small',
        name: 'Прочный каркас',
        desc: '+10 макс. ХП Манекена',
        cost: 12,
        currency: 'blue',
        effect: { kind: 'maxHp', value: 10 },
      },
      {
        kind: 'small',
        name: 'Стартовый кошелёк',
        desc: '+30 стартового золота',
        cost: 12,
        currency: 'blue',
        effect: { kind: 'startGold', value: 30 },
      },
      {
        kind: 'small',
        name: 'Железная обшивка',
        desc: '+3% брони Манекена',
        cost: 12,
        currency: 'blue',
        effect: { kind: 'armor', value: 0.03 },
      },
    ],
    // Tier 6 — root
    [
      {
        kind: 'root',
        name: 'Сердце голема',
        desc: 'Стартовый узел школы выживания.',
        cost: 0,
        currency: 'blue',
        effect: { kind: 'maxHp', value: 0 },
      },
    ],
  ],
};

const ALL_TREES: TreeDef[] = [POTION_TREE, TOWER_TREE, SURVIVAL_TREE];

export const META_UPGRADES: MetaUpgrade[] = ALL_TREES.flatMap(buildTreeNodes);

/** Convenience: id → upgrade map. */
export const META_BY_ID: Record<string, MetaUpgrade> = Object.fromEntries(
  META_UPGRADES.map((u) => [u.id, u]),
);

/** Per-tree root ids. The root nodes are pre-allocated for free, so each
 *  tree always has one reachable entry point. */
export const ROOT_NODE_IDS: readonly string[] = META_UPGRADES
  .filter((u) => u.kind === 'root')
  .map((u) => u.id);

import { tWithFallback } from '../i18n';

/** Localised name for a meta-tree node; falls back to source-of-truth Russian. */
export function metaNodeName(node: MetaUpgrade): string {
  return tWithFallback(`meta.node.${node.id}.name`, node.name);
}

/** Localised description for a meta-tree node; falls back to Russian. */
export function metaNodeDesc(node: MetaUpgrade): string {
  return tWithFallback(`meta.node.${node.id}.desc`, node.desc);
}
