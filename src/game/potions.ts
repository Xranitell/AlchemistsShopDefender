/**
 * Runtime helpers for the crafting system. Splits cleanly into:
 *
 *   • crafting   — checking ingredient availability, brewing, refunding
 *   • inventory  — copying MetaSave inventory into a run, persisting back
 *   • runtime    — applying instant effects, ticking timers, querying
 *                  active multipliers from gameplay code
 *
 * Recipe data (effect kinds, costs, glyphs) lives in `src/data/potions.ts`.
 */
import type { GameState } from './state';
import type { ActivePotion } from './state';
import { spawnFloatingText } from './state';
import type { MetaSave } from './save';
import { saveMeta } from './save';
import {
  POTION_BY_ID,
  POTION_INVENTORY_SIZE,
  type IngredientId,
  type PotionRecipe,
} from '../data/potions';
import { t } from '../i18n';

// ─── Crafting (between-run) ────────────────────────────────────────────────

/** True when the meta save has every ingredient required by the recipe. */
export function canBrew(meta: MetaSave, recipe: PotionRecipe): boolean {
  for (const [id, need] of Object.entries(recipe.cost)) {
    if (need === undefined) continue;
    const have = meta.ingredients[id as IngredientId] ?? 0;
    if (have < need) return false;
  }
  return firstEmptyInventorySlot(meta) >= 0;
}

/** Apply a brew: deduct ingredients, place potion in the first empty slot.
 *  Returns the slot index used, or -1 on failure. */
export function brewPotion(meta: MetaSave, recipe: PotionRecipe): number {
  if (!canBrew(meta, recipe)) return -1;
  const slot = firstEmptyInventorySlot(meta);
  for (const [id, need] of Object.entries(recipe.cost)) {
    if (need === undefined) continue;
    const key = id as IngredientId;
    const have = meta.ingredients[key] ?? 0;
    meta.ingredients[key] = have - need;
  }
  meta.inventory[slot] = recipe.id;
  saveMeta(meta);
  return slot;
}

function firstEmptyInventorySlot(meta: MetaSave): number {
  for (let i = 0; i < POTION_INVENTORY_SIZE; i++) {
    if (!meta.inventory[i]) return i;
  }
  return -1;
}

// ─── Inventory ↔ run ───────────────────────────────────────────────────────

/** Mirror the meta inventory into the run state at start-of-run. */
export function attachRunInventory(state: GameState, meta: MetaSave): void {
  state.inventory = meta.inventory.slice(0, POTION_INVENTORY_SIZE);
  while (state.inventory.length < POTION_INVENTORY_SIZE) state.inventory.push(null);
  state.activePotions = [];
  state.stormCharges = 0;
  state.stormChargeMult = 1;
  state.potionShieldHp = 0;
}

/** Persist the surviving slots back into the meta save (called when the
 *  run ends, succeeds, or the player exits). Consumed potions are gone for
 *  good — only the unused slots carry over. */
export function persistRunInventory(state: GameState, meta: MetaSave): void {
  for (let i = 0; i < POTION_INVENTORY_SIZE; i++) {
    meta.inventory[i] = state.inventory[i] ?? null;
  }
  saveMeta(meta);
}

// ─── Consume + tick ────────────────────────────────────────────────────────

/** Use the potion in `slot` (0..3). Returns true if consumed. */
export function consumePotion(state: GameState, slot: number): boolean {
  if (slot < 0 || slot >= POTION_INVENTORY_SIZE) return false;
  const id = state.inventory[slot];
  if (!id) return false;
  const recipe = POTION_BY_ID[id];
  if (!recipe) {
    state.inventory[slot] = null;
    return false;
  }
  applyPotionEffect(state, recipe);
  state.inventory[slot] = null;
  return true;
}

/** Apply a recipe — instantly for non-timed effects, otherwise push or refresh
 *  an `ActivePotion` entry. */
function applyPotionEffect(state: GameState, recipe: PotionRecipe): void {
  const e = recipe.effect;
  switch (e.kind) {
    case 'shield':
      state.potionShieldHp += e.amount;
      spawnFloatingText(
        state,
        t('craft.float.shield', { n: e.amount }),
        state.mannequin.pos,
        recipe.color,
      );
      break;
    case 'instantHeal': {
      const m = state.mannequin;
      const before = m.hp;
      m.hp = Math.min(m.maxHp, m.hp + e.amount);
      spawnFloatingText(
        state,
        t('craft.float.heal', { n: Math.round(m.hp - before) }),
        m.pos,
        recipe.color,
      );
      break;
    }
    case 'storm':
      // Charges DON'T stack with themselves — using two storms in a row resets
      // the count + multiplier so the player can chain up to a fresh window.
      state.stormCharges = e.chargeCount;
      state.stormChargeMult = e.chargeMult;
      spawnFloatingText(
        state,
        t('craft.float.storm', { n: e.chargeCount }),
        state.mannequin.pos,
        recipe.color,
      );
      break;
    default: {
      // Timed effect — refresh duration if already active so the user can stack
      // their own chains, otherwise add a new entry.
      const duration = e.duration;
      const existing = state.activePotions.find((p) => p.id === recipe.id);
      if (existing) {
        existing.timeLeft = duration;
        existing.duration = duration;
      } else {
        state.activePotions.push({ id: recipe.id, timeLeft: duration, duration });
      }
      spawnFloatingText(state, recipe.glyph, state.mannequin.pos, recipe.color);
      break;
    }
  }
}

/** Decrement timers; remove expired potions. Called once per main-loop tick. */
export function tickActivePotions(state: GameState, dt: number): void {
  if (state.activePotions.length === 0) return;
  for (const p of state.activePotions) p.timeLeft -= dt;
  state.activePotions = state.activePotions.filter((p) => p.timeLeft > 0);
}

// ─── Multiplier accessors used by gameplay code ────────────────────────────

function effectFor(state: GameState, id: string): PotionRecipe | undefined {
  const has = state.activePotions.some((p) => p.id === id);
  return has ? POTION_BY_ID[id] : undefined;
}

export function potionDamageMultiplier(state: GameState): number {
  const r = effectFor(state, 'rage');
  return r && r.effect.kind === 'potionDamage' ? r.effect.mult : 1;
}

export function potionCooldownMultiplier(state: GameState): number {
  const r = effectFor(state, 'haste');
  return r && r.effect.kind === 'potionCooldown' ? r.effect.mult : 1;
}

export function towerFireRateMultiplier(state: GameState): number {
  const r = effectFor(state, 'mech');
  return r && r.effect.kind === 'towerFireRate' ? r.effect.mult : 1;
}

export function towerRangeMultiplier(state: GameState): number {
  const r = effectFor(state, 'scope');
  return r && r.effect.kind === 'towerRange' ? r.effect.mult : 1;
}

export function towerDamageMultiplier(state: GameState): number {
  const r = effectFor(state, 'berserk');
  return r && r.effect.kind === 'berserk' ? r.effect.towerDmgMult : 1;
}

export function takenDamageMultiplier(state: GameState): number {
  const r = effectFor(state, 'berserk');
  return r && r.effect.kind === 'berserk' ? r.effect.takenDmgMult : 1;
}

export function enemySpeedMultiplier(state: GameState): number {
  const r = effectFor(state, 'frostMist');
  return r && r.effect.kind === 'frostMist' ? r.effect.speedMult : 1;
}

export function goldMultiplier(state: GameState): number {
  const r = effectFor(state, 'greed');
  return r && r.effect.kind === 'greed' ? r.effect.goldMult : 1;
}

/** Consume a single storm charge if any, returning the damage multiplier
 *  to apply (1 if no charge). Called once per thrown potion. */
export function consumeStormCharge(state: GameState): number {
  if (state.stormCharges <= 0) return 1;
  state.stormCharges -= 1;
  return state.stormChargeMult;
}

/** Damage routed through the potion shield first; spillover hits HP. */
export function absorbWithShield(state: GameState, damage: number): number {
  if (state.potionShieldHp <= 0 || damage <= 0) return damage;
  const taken = Math.min(state.potionShieldHp, damage);
  state.potionShieldHp -= taken;
  return damage - taken;
}

export function activePotionEntries(state: GameState): ActivePotion[] {
  return state.activePotions;
}
