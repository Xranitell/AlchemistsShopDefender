import {
  META_BY_ID,
  META_UPGRADES,
  ROOT_NODE_IDS,
  type MetaUpgrade,
  type MetaEffect,
} from '../data/metaTree';
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

/** Always-allocated ids that don't need to be in the save file (the per-tree
 *  roots are granted for free). Keeping them in a single place lets the UI
 *  and the effect application agree on what is pre-allocated.
 *
 *  Three diamond trees mean three roots — see `metaTree.ts`. */
export { ROOT_NODE_IDS };

/** Backwards-compatible singular alias used by callers that just need *some*
 *  root id (e.g. when the UI needs a default selection). */
export const ROOT_NODE_ID = ROOT_NODE_IDS[0] ?? '';

/** Set of all root node ids — used to pre-allocate every tree's entry node. */
const ROOT_SET = new Set<string>(ROOT_NODE_IDS);

/** Is `id` one of the always-allocated root nodes? */
export function isRootNode(id: string): boolean {
  return ROOT_SET.has(id);
}

/** Snapshot the set of allocated upgrade ids. Includes every implicit root. */
export function allocatedSet(meta: MetaSave): Set<string> {
  const s = new Set(meta.purchased);
  for (const r of ROOT_NODE_IDS) s.add(r);
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
 *  the rest of the allocated nodes connected to a root. This is the standard
 *  PoE "respec a single node" behaviour, generalised across the three trees:
 *  every remaining allocated node must still be reachable from at least one
 *  per-tree root through allocated edges only. */
export function refundMetaUpgrade(meta: MetaSave, upg: MetaUpgrade): boolean {
  if (!meta.purchased.includes(upg.id)) return false;
  if (upg.kind === 'root') return false;

  const after = new Set(meta.purchased.filter((id) => id !== upg.id));
  for (const r of ROOT_NODE_IDS) after.add(r);
  if (!isAllocationConnected(after)) return false;

  meta.purchased = meta.purchased.filter((id) => id !== upg.id);
  if (upg.currency === 'blue') meta.blueEssence += upg.cost;
  else meta.ancientEssence += upg.cost;
  return true;
}

function isAllocationConnected(allocated: Set<string>): boolean {
  // BFS from every per-tree root and require that every allocated node ends
  // up visited. Trees are independent graphs — nodes can only reach their
  // own tree's root, but every tree's root is always allocated, so every
  // valid allocation across all three trees is reachable.
  const visited = new Set<string>();
  const queue: string[] = [];
  for (const r of ROOT_NODE_IDS) {
    if (allocated.has(r)) queue.push(r);
  }
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

/** Per-mode multipliers applied on top of the base reward formula. Higher
 *  difficulties always pay out *more* of every currency, so the player
 *  always has a concrete reason to climb the difficulty ladder rather than
 *  farm Normal forever. */
const DIFFICULTY_REWARD_MULT: Record<DifficultyMode, number> = {
  normal: 1,
  epic: 1.5,
  ancient: 2.5,
  endless: 1.2,
  daily: 1,
};

/** Base ancient-essence drops per difficulty (added together with the
 *  late-wave bonus). Ancient mode pours out the rare currency precisely
 *  because that's the loop hook — meta-tree keystones cost ancient
 *  essence, and you should be able to afford one keystone per ~2 Ancient
 *  victories. */
const ANCIENT_BASE_BY_DIFFICULTY: Record<DifficultyMode, number> = {
  normal: 1,
  epic: 2,
  ancient: 4,
  endless: 1,
  daily: 1,
};

/** Soft cap on the mastery-bonus multiplier so a veteran player doesn't
 *  outscale the meta tree. +2% blue essence per Epic mastery point and +3%
 *  per Ancient mastery point, capped at +60% combined. */
export function masteryEssenceMult(meta: MetaSave): number {
  const epic = Math.max(0, meta.epicMastery ?? 0);
  const ancient = Math.max(0, meta.ancientMastery ?? 0);
  const raw = epic * 0.02 + ancient * 0.03;
  return 1 + Math.min(0.6, raw);
}

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
  // Mastery bonus stacks multiplicatively on top of meta-tree bonuses.
  mult *= masteryEssenceMult(meta);
  // Per-mode multiplier — Epic 1.5x, Ancient 2.5x, Endless 1.2x.
  const diffMult = DIFFICULTY_REWARD_MULT[difficulty] ?? 1;

  // v3 reward curve: reduced further so the expanded talent tree takes
  // 25-40 runs to fully explore.
  //   Wave 1 fail with 8 kills    →  1*3 + 8*0.2 + 4  ≈ 9 blue
  //   Wave 5 victory + 60 kills   →  5*3 + 60*0.2 + 4 + 15 ≈ 46 blue
  //   Wave 10 fail with 90 kills  →  10*3 + 90*0.2 + 4 ≈ 52 blue
  //   Wave 15 victory + 140 kills →  15*3 + 140*0.2 + 4 + 15 ≈ 92 blue
  let blue = Math.floor(waveReached * 3 + totalKills * 0.2 + 4);
  if (victory) blue += 15;
  blue = Math.round(blue * mult * diffMult);

  // Ancient essence: difficulty-scaled base (Normal 1, Epic 2, Ancient 4)
  // only on a full victory, +1 if you also cleared past wave 12. Ancient
  // also gets +1 extra for clearing wave 12. That makes Ancient the
  // dedicated farm for keystone unlocks.
  let ancient = 0;
  if (victory) {
    ancient = ANCIENT_BASE_BY_DIFFICULTY[difficulty] ?? 1;
    if (waveReached >= 12) ancient += difficulty === 'ancient' ? 2 : 1;
  }

  // Difficulty-based key drops:
  //   normal → epic keys (the ticket into Epic mode).
  //   epic   → ancient keys (the ticket into Ancient mode).
  //   ancient → bonus ancient keys on victory (so a perfect Ancient run
  //   funds the *next* Ancient run instead of grinding Epic in between).
  // Keys scale with progress: 1 every ~5 waves, +1 on full victory.
  let epicKeys = 0;
  let ancientKeys = 0;
  if (difficulty === 'normal') {
    epicKeys = Math.max(0, Math.floor(waveReached / 5));
    if (victory) epicKeys += 1;
  } else if (difficulty === 'epic') {
    ancientKeys = Math.max(0, Math.floor(waveReached / 5));
    if (victory) ancientKeys += 1;
  } else if (difficulty === 'ancient' && victory) {
    // Ancient sustains itself: 1 ancient key on full victory so a
    // committed player can chain Ancient runs.
    ancientKeys = 1;
  }

  return { blue, ancient, epicKeys, ancientKeys };
}

// Ensure no dead-code warning for full export coverage.
export { META_UPGRADES };
