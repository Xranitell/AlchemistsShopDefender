/**
 * Potion crafting (PR-«крафт»).
 *
 * Two pieces of data live here:
 *   • `INGREDIENTS` — what a player can collect from enemy drops, persisted
 *     across runs in `MetaSave.ingredients`.
 *   • `POTION_RECIPES` — 10 brewable potions, each with a deterministic
 *     ingredient cost and a runtime effect.
 *
 * The runtime application of an effect lives in `src/game/potions.ts`; this
 * file is data-only so it can be imported from both UI and game code without
 * causing cycles.
 */

export type IngredientId =
  | 'slime_jelly'
  | 'rat_fang'
  | 'sapper_ash'
  | 'mold_spore'
  | 'glass_shard'
  | 'iron_plate'
  | 'homunculus_frag';

export interface IngredientDef {
  id: IngredientId;
  /** Localisation key for the display name (i18n.craft.ing.<id>). */
  i18nKey: string;
  /** Hex colour used by the floating text and overlay swatches. */
  color: string;
  /** Single emoji glyph that doubles as the icon in the menus. */
  glyph: string;
}

export const INGREDIENTS: Record<IngredientId, IngredientDef> = {
  slime_jelly:    { id: 'slime_jelly',    i18nKey: 'craft.ing.slime_jelly',    color: '#7be07b', glyph: '🟢' },
  rat_fang:       { id: 'rat_fang',       i18nKey: 'craft.ing.rat_fang',       color: '#caa489', glyph: '🦷' },
  sapper_ash:     { id: 'sapper_ash',     i18nKey: 'craft.ing.sapper_ash',     color: '#ff8c4a', glyph: '🔥' },
  mold_spore:     { id: 'mold_spore',     i18nKey: 'craft.ing.mold_spore',     color: '#a3d977', glyph: '🌱' },
  glass_shard:    { id: 'glass_shard',    i18nKey: 'craft.ing.glass_shard',    color: '#9be4ff', glyph: '🔷' },
  iron_plate:     { id: 'iron_plate',     i18nKey: 'craft.ing.iron_plate',     color: '#bdc3c7', glyph: '⚙️' },
  homunculus_frag:{ id: 'homunculus_frag',i18nKey: 'craft.ing.homunculus_frag',color: '#d56cff', glyph: '✨' },
};

export const ALL_INGREDIENT_IDS: IngredientId[] = Object.keys(INGREDIENTS) as IngredientId[];

/** Drop chance per enemy kind. Bosses always drop a guaranteed amount. */
export const INGREDIENT_DROP_TABLE: Array<{
  enemyId: string;
  ingredient: IngredientId;
  chance: number;       // 0..1 per kill (regular drops)
  guaranteedAmount?: number; // fixed drop on death (boss / miniboss)
}> = [
  // Regular drops (rolled per kill) — reduced from v1 values
  { enemyId: 'slime',         ingredient: 'slime_jelly', chance: 0.06 },
  { enemyId: 'rat',           ingredient: 'rat_fang',    chance: 0.07 },
  { enemyId: 'sapper',        ingredient: 'sapper_ash',  chance: 0.09 },
  { enemyId: 'shaman',        ingredient: 'mold_spore',  chance: 0.09 },
  { enemyId: 'flying_flask',  ingredient: 'glass_shard', chance: 0.08 },
  { enemyId: 'golem',         ingredient: 'iron_plate',  chance: 0.07 },
  // Boss / miniboss guaranteed drops
  { enemyId: 'miniboss_slime',ingredient: 'slime_jelly', chance: 1, guaranteedAmount: 3 },
  { enemyId: 'boss_rat_king', ingredient: 'rat_fang',    chance: 1, guaranteedAmount: 2 },
  { enemyId: 'boss_homunculus',ingredient: 'homunculus_frag', chance: 1, guaranteedAmount: 2 },
];

// ────────────────────────────────────────────────────────────────────────────
// Recipes
// ────────────────────────────────────────────────────────────────────────────

export type PotionEffect =
  | { kind: 'potionDamage'; mult: number; duration: number }            // 1
  | { kind: 'potionCooldown'; mult: number; duration: number }          // 2
  | { kind: 'towerFireRate'; mult: number; duration: number }           // 3
  | { kind: 'towerRange'; mult: number; duration: number }              // 4
  | { kind: 'shield'; amount: number }                                  // 5 — instant
  | { kind: 'instantHeal'; amount: number }                             // 6 — instant
  | { kind: 'berserk'; towerDmgMult: number; takenDmgMult: number; duration: number } // 7
  | { kind: 'storm'; chargeCount: number; chargeMult: number }          // 8 — charges, no timer
  | { kind: 'frostMist'; speedMult: number; duration: number }          // 9
  | { kind: 'greed'; goldMult: number; duration: number };              // 10

export interface PotionRecipe {
  id: string;
  i18nKey: string;     // i18n base — `.name`, `.desc`
  glyph: string;       // emoji icon
  color: string;       // accent colour for HUD chip
  cost: Partial<Record<IngredientId, number>>;
  effect: PotionEffect;
}

export const POTION_RECIPES: PotionRecipe[] = [
  {
    id: 'rage',
    i18nKey: 'craft.potion.rage',
    glyph: '🍷',
    color: '#ff5e5e',
    cost: { slime_jelly: 2, sapper_ash: 1 },
    effect: { kind: 'potionDamage', mult: 1.3, duration: 25 },
  },
  {
    id: 'haste',
    i18nKey: 'craft.potion.haste',
    glyph: '⚡',
    color: '#ffd166',
    cost: { rat_fang: 2, mold_spore: 1 },
    effect: { kind: 'potionCooldown', mult: 0.6, duration: 25 },
  },
  {
    id: 'mech',
    i18nKey: 'craft.potion.mech',
    glyph: '🛠️',
    color: '#caa473',
    cost: { iron_plate: 2, glass_shard: 1 },
    effect: { kind: 'towerFireRate', mult: 1.3, duration: 30 },
  },
  {
    id: 'scope',
    i18nKey: 'craft.potion.scope',
    glyph: '🔭',
    color: '#9be4ff',
    cost: { glass_shard: 2, iron_plate: 1 },
    effect: { kind: 'towerRange', mult: 1.3, duration: 30 },
  },
  {
    id: 'stoneShield',
    i18nKey: 'craft.potion.stoneShield',
    glyph: '🛡️',
    color: '#bdc3c7',
    cost: { iron_plate: 3, mold_spore: 1 },
    effect: { kind: 'shield', amount: 60 },
  },
  {
    id: 'fieldRepair',
    i18nKey: 'craft.potion.fieldRepair',
    glyph: '✚',
    color: '#7be07b',
    cost: { slime_jelly: 2, mold_spore: 2 },
    effect: { kind: 'instantHeal', amount: 50 },
  },
  {
    id: 'berserk',
    i18nKey: 'craft.potion.berserk',
    glyph: '👹',
    color: '#ff8c4a',
    cost: { rat_fang: 2, sapper_ash: 1, iron_plate: 1 },
    effect: { kind: 'berserk', towerDmgMult: 1.25, takenDmgMult: 1.10, duration: 25 },
  },
  {
    id: 'storm',
    i18nKey: 'craft.potion.storm',
    glyph: '🌩️',
    color: '#bb8cff',
    cost: { sapper_ash: 1, glass_shard: 1, slime_jelly: 1 },
    effect: { kind: 'storm', chargeCount: 5, chargeMult: 1.6 },
  },
  {
    id: 'frostMist',
    i18nKey: 'craft.potion.frostMist',
    glyph: '❄️',
    color: '#5fb6ff',
    cost: { mold_spore: 2, glass_shard: 1 },
    effect: { kind: 'frostMist', speedMult: 0.5, duration: 12 },
  },
  {
    id: 'greed',
    i18nKey: 'craft.potion.greed',
    glyph: '💰',
    color: '#ffd700',
    cost: { slime_jelly: 2, iron_plate: 1, homunculus_frag: 1 },
    effect: { kind: 'greed', goldMult: 2, duration: 30 },
  },
];

export const POTION_BY_ID: Record<string, PotionRecipe> = Object.fromEntries(
  POTION_RECIPES.map((p) => [p.id, p]),
);

export const POTION_INVENTORY_SIZE = 4;
