import { META_BY_ID, META_UPGRADES, type MetaUpgrade, type MetaEffect } from '../data/metaTree';
import {
  ACTIVE_MODULES,
  AURA_MODULES,
  DEFAULT_ACTIVE_MODULE,
  DEFAULT_AURA_MODULE,
  ETHER_AMP_FIRE_RATE,
  ELEM_RESON_DAMAGE,
  GOLD_AURA_MULT,
  LONG_RANGE_MULT,
  isActiveModule,
  isAuraModule,
} from '../data/modules';
import type { MetaSave } from './save';
import type { GameState } from './state';
import { runeUnlockSlotToIndex } from './world';

/** Always-allocated ids that don't need to be in the save file (the root
 *  is granted for free). Keeping them in a single place lets the UI and the
 *  effect application agree on what is pre-allocated. */
export const ROOT_NODE_ID = 'heart_root';

/** Snapshot the set of allocated upgrade ids. Includes the implicit root. */
export function allocatedSet(meta: MetaSave): Set<string> {
  const s = new Set(meta.purchased);
  s.add(ROOT_NODE_ID);
  return s;
}

export function applyMetaUpgrades(state: GameState, meta: MetaSave): void {
  const allocated = allocatedSet(meta);
  for (const id of allocated) {
    const upg = META_BY_ID[id];
    if (!upg) continue;
    applyEffect(state, upg);
  }
  applyModuleLoadout(state, meta);
}

/** Mirror the chosen module loadout into the run state and apply the aura's
 *  passive effects. Active modules don't apply anything until Overload is
 *  triggered — they're handled by `tryActivateOverload` reading
 *  `state.activeModuleId`. */
export function applyModuleLoadout(state: GameState, meta: MetaSave): void {
  const active = isActiveModule(meta.selectedActiveModule)
    ? meta.selectedActiveModule
    : DEFAULT_ACTIVE_MODULE;
  const aura = isAuraModule(meta.selectedAuraModule)
    ? meta.selectedAuraModule
    : DEFAULT_AURA_MODULE;
  state.activeModuleId = active;
  state.auraModuleId = aura;

  const m = state.modifiers;
  switch (aura) {
    case 'ether_amp':
      m.towerFireRateMult *= ETHER_AMP_FIRE_RATE;
      break;
    case 'thorn_shell':
      m.thornyShell = true;
      break;
    case 'elem_reson':
      m.reactionDamageMult *= ELEM_RESON_DAMAGE;
      break;
    case 'vital_pulse':
      // Layered with the Auto-Repair meta upgrade — both stack additively.
      m.vitalPulseRegen = true;
      break;
    case 'gold_aura':
      m.goldDropMult *= GOLD_AURA_MULT;
      break;
    case 'long_range':
      m.towerRangeMult *= LONG_RANGE_MULT;
      break;
  }
}

/** Lookup a module by id from either pool. */
export function getModuleDef(id: string): { name: string; desc: string; slot: 'active' | 'aura' } | null {
  if (id in ACTIVE_MODULES) return ACTIVE_MODULES[id as keyof typeof ACTIVE_MODULES];
  if (id in AURA_MODULES) return AURA_MODULES[id as keyof typeof AURA_MODULES];
  return null;
}

function applyEffect(state: GameState, upg: MetaUpgrade): void {
  applySingleEffect(state, upg.effect);
  if (upg.extraEffects) {
    for (const extra of upg.extraEffects) applySingleEffect(state, extra);
  }
}

function applySingleEffect(state: GameState, e: MetaEffect): void {
  const m = state.modifiers;
  switch (e.kind) {
    // Potions
    case 'potionCooldown':
      m.potionCooldownMult *= e.value;
      break;
    case 'potionDamage':
      m.potionDamageMult *= e.value;
      break;
    case 'potionRadius':
      m.potionRadiusMult *= e.value;
      break;
    case 'potionEchoChance':
      m.potionEchoExplode = Math.max(m.potionEchoExplode, e.value);
      break;
    case 'potionAimBonus':
      state.metaPotionAimBonus += e.value;
      break;
    case 'potionLeavesFire':
      m.potionLeavesFire = true;
      break;

    // Engineering
    case 'towerDiscount':
      state.metaTowerDiscount += e.value;
      break;
    case 'towerStartLevel':
      state.metaTowerStartLevel = Math.max(state.metaTowerStartLevel, e.value);
      break;
    case 'towerFireRate':
      m.towerFireRateMult *= e.value;
      break;
    case 'towerDamage':
      m.towerDamageMult *= e.value;
      break;
    case 'towerRange':
      m.towerRangeMult *= e.value;
      break;
    case 'runePointUnlock': {
      // `e.value` is a 1-based slot id (1..4) for the unlockable points so
      // callers don't have to know about the underlying ring layout.
      const idx = runeUnlockSlotToIndex(e.value);
      const rp = state.runePoints[idx];
      if (rp) rp.active = true;
      break;
    }

    // Core / arcanum
    case 'overloadRate':
      state.metaOverloadRateMult = (state.metaOverloadRateMult ?? 1) * e.value;
      break;
    case 'overloadMaxCharge':
      state.overload.maxCharge += e.value;
      break;
    case 'auraRadius':
      state.metaAuraRadiusMult *= e.value;
      break;
    case 'reactionDamage':
      m.reactionDamageMult *= e.value;
      break;
    case 'catalystSlot':
      // GDD §7.5: each allocation grants one extra orbital catalyst slot.
      state.catalystSlots += e.value;
      break;

    // Survival
    case 'maxHp':
      state.mannequin.maxHp += e.value;
      state.mannequin.hp += e.value;
      break;
    case 'armor':
      state.metaMannequinArmor = (state.metaMannequinArmor ?? 0) + e.value;
      break;
    case 'autoRepair':
      state.metaAutoRepairRate = (state.metaAutoRepairRate ?? 0) + e.value;
      break;
    case 'bossShield':
      state.metaBossShield = Math.max(state.metaBossShield, e.value);
      break;
    case 'thornyShell':
      m.thornyShell = true;
      break;

    // Economy
    case 'essenceBonus':
      // Applied when awarding essence at end of run
      break;
    case 'startGold':
      state.gold += e.value;
      break;
    case 'goldDrop':
      m.goldDropMult *= e.value;
      break;
    // Combat extras (v2)
    case 'armorPen':
      // Stack additively, capped at 0.85 so even fully-invested players still
      // see an armour effect on plated bosses.
      state.metaArmorPen = Math.min(0.85, state.metaArmorPen + e.value);
      break;
    case 'critChance':
      state.metaCritChance = Math.min(0.5, state.metaCritChance + e.value);
      break;
  }
}

/** Can the player allocate this node right now?
 *  - already owned ⇒ false
 *  - cost not affordable ⇒ false
 *  - root node ⇒ always true (but `buy` is a no-op since it's pre-allocated)
 *  - otherwise: at least one neighbour must already be allocated. */
export function canAllocate(meta: MetaSave, upg: MetaUpgrade): boolean {
  if (meta.purchased.includes(upg.id)) return false;
  if (upg.kind === 'root') return false;
  const allocated = allocatedSet(meta);
  const reachable = upg.connects.some((id) => allocated.has(id));
  if (!reachable) return false;
  if (upg.currency === 'blue') return meta.blueEssence >= upg.cost;
  return meta.ancientEssence >= upg.cost;
}

/** Is this node *reachable* (a neighbour is allocated) regardless of price? */
export function isReachable(meta: MetaSave, upg: MetaUpgrade): boolean {
  if (meta.purchased.includes(upg.id)) return true;
  if (upg.kind === 'root') return true;
  const allocated = allocatedSet(meta);
  return upg.connects.some((id) => allocated.has(id));
}

export function buyMetaUpgrade(meta: MetaSave, upg: MetaUpgrade): boolean {
  if (!canAllocate(meta, upg)) return false;
  if (upg.currency === 'blue') {
    meta.blueEssence -= upg.cost;
  } else {
    meta.ancientEssence -= upg.cost;
  }
  meta.purchased.push(upg.id);
  return true;
}

/** Remove an allocated node and refund its cost, but only if doing so keeps
 *  the rest of the allocated tree connected to the root. This is the standard
 *  PoE "respec a single node" behaviour. */
export function refundMetaUpgrade(meta: MetaSave, upg: MetaUpgrade): boolean {
  if (!meta.purchased.includes(upg.id)) return false;
  if (upg.kind === 'root') return false;

  // After removal, every other allocated node must still have a path to the
  // root through allocated edges only.
  const after = new Set(meta.purchased.filter((id) => id !== upg.id));
  after.add(ROOT_NODE_ID);
  if (!isAllocationConnected(after)) return false;

  meta.purchased = meta.purchased.filter((id) => id !== upg.id);
  if (upg.currency === 'blue') meta.blueEssence += upg.cost;
  else meta.ancientEssence += upg.cost;
  return true;
}

function isAllocationConnected(allocated: Set<string>): boolean {
  if (!allocated.has(ROOT_NODE_ID)) return false;
  const visited = new Set<string>();
  const queue: string[] = [ROOT_NODE_ID];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const node = META_BY_ID[id];
    if (!node) continue;
    for (const n of node.connects) {
      if (allocated.has(n) && !visited.has(n)) queue.push(n);
    }
  }
  return visited.size === allocated.size;
}

import type { DifficultyMode } from '../data/difficulty';

export function calcRunEssence(
  meta: MetaSave,
  waveReached: number,
  totalKills: number,
  victory: boolean,
  difficulty: DifficultyMode = 'normal',
): { blue: number; ancient: number; epicKeys: number; ancientKeys: number } {
  // Sum every allocated essenceBonus effect (multiplicative).
  let mult = 1;
  for (const id of meta.purchased) {
    const u = META_BY_ID[id];
    if (u && u.effect.kind === 'essenceBonus') mult *= u.effect.value;
  }

  // v3 reward curve: reduced further so the expanded talent tree takes
  // 25-40 runs to fully explore.
  //   Wave 1 fail with 8 kills    →  1*3 + 8*0.2 + 4  ≈ 9 blue
  //   Wave 5 victory + 60 kills   →  5*3 + 60*0.2 + 4 + 15 ≈ 46 blue
  //   Wave 10 fail with 90 kills  →  10*3 + 90*0.2 + 4 ≈ 52 blue
  //   Wave 15 victory + 140 kills →  15*3 + 140*0.2 + 4 + 15 ≈ 92 blue
  let blue = Math.floor(waveReached * 3 + totalKills * 0.2 + 4);
  if (victory) blue += 15;
  blue = Math.round(blue * mult);

  // Ancient essence: scarcer in v2 — only on a full victory, +1 if you also
  // cleared past wave 12 (so ancient keystones cost 2 and require multiple
  // full runs to stack up).
  let ancient = 0;
  if (victory) ancient = 1;
  if (waveReached >= 12 && victory) ancient += 1;

  // Difficulty-based key drops:
  //   normal → epic keys (the ticket into Epic mode).
  //   epic   → ancient keys (the ticket into Ancient mode).
  // Keys scale with progress: 1 every ~5 waves, +1 on full victory.
  // Higher difficulties don't drop their own key tier — Ancient is the cap.
  let epicKeys = 0;
  let ancientKeys = 0;
  if (difficulty === 'normal') {
    epicKeys = Math.max(0, Math.floor(waveReached / 5));
    if (victory) epicKeys += 1;
  } else if (difficulty === 'epic') {
    ancientKeys = Math.max(0, Math.floor(waveReached / 5));
    if (victory) ancientKeys += 1;
  }

  return { blue, ancient, epicKeys, ancientKeys };
}

// Ensure no dead-code warning for full export coverage.
export { META_UPGRADES };
