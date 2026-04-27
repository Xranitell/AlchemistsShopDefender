import { META_UPGRADES, type MetaUpgrade } from '../data/metaTree';
import type { MetaSave } from './save';
import type { GameState } from './state';

export function applyMetaUpgrades(state: GameState, meta: MetaSave): void {
  for (const id of meta.purchased) {
    const upg = META_UPGRADES.find((u) => u.id === id);
    if (!upg) continue;
    applyEffect(state, upg);
  }
}

function applyEffect(state: GameState, upg: MetaUpgrade): void {
  const e = upg.effect;
  switch (e.kind) {
    case 'potionCooldown':
      state.modifiers.potionCooldownMult *= e.value;
      break;
    case 'potionDamage':
      state.modifiers.potionDamageMult *= e.value;
      break;
    case 'potionRadius':
      state.modifiers.potionRadiusMult *= e.value;
      break;
    case 'potionEchoChance':
      state.modifiers.potionEchoExplode = Math.max(state.modifiers.potionEchoExplode, e.value);
      break;
    case 'potionAimBonus':
      state.metaPotionAimBonus += e.value;
      break;
    case 'towerDiscount':
      state.metaTowerDiscount = e.value;
      break;
    case 'towerStartLevel':
      state.metaTowerStartLevel = e.value;
      break;
    case 'towerFireRate':
      state.modifiers.towerFireRateMult *= e.value;
      break;
    case 'runePointUnlock': {
      const idx = e.value - 1;
      if (idx < state.runePoints.length) {
        state.runePoints[idx]!.active = true;
      }
      break;
    }
    case 'overloadRate':
      state.metaOverloadRateMult = (state.metaOverloadRateMult ?? 1) * e.value;
      break;
    case 'overloadMaxCharge':
      state.overload.maxCharge += e.value;
      break;
    case 'auraRadius':
      state.metaAuraRadiusMult *= e.value;
      break;
    case 'catalystSlot':
      // Reserved for future catalyst system
      break;
    case 'maxHp':
      state.mannequin.maxHp += e.value;
      state.mannequin.hp += e.value;
      break;
    case 'armor':
      state.metaMannequinArmor = (state.metaMannequinArmor ?? 0) + e.value;
      break;
    case 'autoRepair':
      state.metaAutoRepairRate = e.value;
      break;
    case 'bossShield':
      state.metaBossShield = e.value;
      break;
    case 'essenceBonus':
      // Applied when awarding essence at end of run
      break;
    case 'startGold':
      state.gold += e.value;
      break;
    case 'lootRadius':
      state.modifiers.lootRadiusMult *= e.value;
      break;
  }
}

export function buyMetaUpgrade(meta: MetaSave, upg: MetaUpgrade): boolean {
  if (meta.purchased.includes(upg.id)) return false;
  if (upg.requires && !meta.purchased.includes(upg.requires)) return false;
  if (upg.currency === 'blue') {
    if (meta.blueEssence < upg.cost) return false;
    meta.blueEssence -= upg.cost;
  } else {
    if (meta.ancientEssence < upg.cost) return false;
    meta.ancientEssence -= upg.cost;
  }
  meta.purchased.push(upg.id);
  return true;
}

export function calcRunEssence(
  meta: MetaSave,
  waveReached: number,
  totalKills: number,
  victory: boolean,
): { blue: number; ancient: number } {
  const hasBonus = meta.purchased.includes('essence_bonus');
  const mult = hasBonus ? 1.25 : 1;

  let blue = Math.floor(waveReached * 2 + totalKills * 0.3);
  if (victory) blue += 15;
  blue = Math.round(blue * mult);

  let ancient = 0;
  if (victory) ancient = 1;

  return { blue, ancient };
}
