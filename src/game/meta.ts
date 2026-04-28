import { META_BY_ID, META_UPGRADES, type MetaUpgrade } from '../data/metaTree';
import {
  ACTIVE_MODULES,
  AURA_MODULES,
  DEFAULT_ACTIVE_MODULE,
  DEFAULT_AURA_MODULE,
  ETHER_AMP_FIRE_RATE,
  ELEM_RESON_DAMAGE,
  MAGNET_RES_LOOT_RADIUS,
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
    case 'magnet_res':
      m.lootRadiusMult *= MAGNET_RES_LOOT_RADIUS;
      break;
    case 'ether_amp':
      m.towerFireRateMult *= ETHER_AMP_FIRE_RATE;
      break;
    case 'thorn_shell':
      m.thornyShell = true;
      break;
    case 'elem_reson':
      m.reactionDamageMult *= ELEM_RESON_DAMAGE;
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
  const e = upg.effect;
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
      // Reserved for future catalyst system
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
    case 'lootRadius':
      m.lootRadiusMult *= e.value;
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

export function calcRunEssence(
  meta: MetaSave,
  waveReached: number,
  totalKills: number,
  victory: boolean,
): { blue: number; ancient: number } {
  // Sum every allocated essenceBonus effect (multiplicative).
  let mult = 1;
  for (const id of meta.purchased) {
    const u = META_BY_ID[id];
    if (u && u.effect.kind === 'essenceBonus') mult *= u.effect.value;
  }

  // Reward curve tuned so a casual full clear funds ~3-4 small talents and
  // 2-3 fully-lost early runs are still enough to taste a notable.
  //   Wave 1 fail with 8 kills    →  1*8 + 8*0.6 + 12 = ~25 blue
  //   Wave 5 victory + 60 kills   →  5*8 + 60*0.6 + 12 + 40 = ~128 blue
  //   Wave 10 fail with 90 kills  →  10*8 + 90*0.6 + 12   = ~146 blue
  //   Wave 15 victory + 140 kills →  15*8 + 140*0.6 + 12 + 40 = ~256 blue
  let blue = Math.floor(waveReached * 8 + totalKills * 0.6 + 12);
  if (victory) blue += 40;
  blue = Math.round(blue * mult);

  // Ancient essence: 1 per victory, +1 if cleared past wave 10.
  let ancient = 0;
  if (victory) ancient = 1;
  if (waveReached >= 10) ancient += 1;

  return { blue, ancient };
}

// Ensure no dead-code warning for full export coverage.
export { META_UPGRADES };
