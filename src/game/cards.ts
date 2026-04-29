import {
  CARDS,
  CARD_SYNERGIES,
  cursedCardPool,
  isCursedCard,
  normalCardPool,
} from '../data/cards';
import { cursedExtraPool, getCursedExtra } from '../data/cursedExtras';
import type { CardDef, Rarity } from './types';
import type { GameState } from './state';

const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 1.00,
  rare: 0.55,
  epic: 0.22,
  legendary: 0.07,
};

/** Base draft size before guarantees / cooldowns. */
const DRAFT_SIZE = 3;
/** GDD §8.3: Legendary cards may be offered at most once per 5 waves. */
const LEGENDARY_WAVE_COOLDOWN = 5;
/** GDD §8.3: at least one of every 3 drafts must contain a non-Common option. */
const NON_COMMON_GUARANTEE_GAP = 3;

/** A card draft is "cursed" when the wave that just ended is the 3rd, 6th,
 *  9th… wave of the run. Cursed drafts pull from the cursed-only pool and
 *  every option mixes a unique effect with epic stats and a drawback. */
export function isCursedWave(currentWave: number): boolean {
  return currentWave > 0 && currentWave % 3 === 0;
}

/**
 * Roll the 3 cards offered after the current wave. Implements GDD §8.3 rules:
 *  - on cursed waves (every 3rd wave), the entire offer is drawn from the
 *    cursed pool — combos of stat boosts + unique effects + a drawback;
 *  - on regular waves, the offer is purely stat-bonus cards whose magnitude
 *    is pinned to their rarity;
 *  - smart-bias: cards from already-picked categories get a soft weight
 *    boost, and cards listed as synergy partners of picked cards get a
 *    stronger one;
 *  - Legendary may not be offered twice within `LEGENDARY_WAVE_COOLDOWN` waves;
 *  - if no non-Common option has been offered for `NON_COMMON_GUARANTEE_GAP`
 *    consecutive (regular) drafts, force at least one non-Common.
 *
 * The function ALSO advances the bookkeeping fields on `state.cardChoice`
 * (`lastLegendaryWave`, `lastNonCommonDraft`, `draftCount`) so the next
 * draft sees the updated cooldown windows.
 */
export function rollCardOptions(state: GameState): CardDef[] {
  const cc = state.cardChoice;
  const currentWave = state.waveState.currentIndex + 1; // 1-based
  const taken = new Set(cc.pickedIds);

  const cursed = isCursedWave(currentWave);

  // Choose the appropriate base pool.
  let pool = (cursed ? cursedCardPool() : normalCardPool()).filter((c) => !taken.has(c.id));

  // Catalyst slot cap (GDD §7.5): if the player has filled every catalyst
  // slot, stop offering catalyst cards (cursed or otherwise). Crown of
  // Elements grants its own bonus slot when picked.
  if (state.equippedCatalysts.length >= state.catalystSlots) {
    pool = pool.filter((c) => c.category !== 'catalyst');
  }

  // Legendary cooldown window — drop legendaries if we offered one recently.
  // Cursed waves still respect the cooldown so the player isn't drowned in
  // legendary-cursed offers.
  const wavesSinceLegendary = currentWave - cc.lastLegendaryWave;
  if (wavesSinceLegendary < LEGENDARY_WAVE_COOLDOWN) {
    pool = pool.filter((c) => c.rarity !== 'legendary');
  }

  if (pool.length === 0) return [];

  // Build the per-card weight profile based on rarity, category synergy, and
  // explicit synergy graph picks. Weights are recomputed every draft so
  // freshly-picked cards immediately influence subsequent drafts.
  const synergyGraph = CARD_SYNERGIES;
  const catCounts: Record<string, number> = {};
  for (const id of cc.pickedIds) {
    const def = CARDS.find((c) => c.id === id);
    if (def) catCounts[def.category] = (catCounts[def.category] ?? 0) + 1;
  }

  const computeWeight = (card: CardDef): number => {
    let w = RARITY_WEIGHT[card.rarity];
    // Soft category bias: 1.25× once a category has 2 picks.
    const cc2 = catCounts[card.category] ?? 0;
    if (cc2 >= 2) w *= 1.25;
    if (cc2 >= 4) w *= 1.15;
    // Synergy bias: each picked partner adds +30% weight, capped at +90%.
    const partners = synergyGraph[card.id] ?? [];
    let synergyBoost = 0;
    for (const p of partners) {
      if (taken.has(p)) synergyBoost += 0.3;
    }
    w *= 1 + Math.min(synergyBoost, 0.9);
    return w;
  };

  const weighted = pool.map((c) => ({ card: c, w: computeWeight(c) }));
  const result: CardDef[] = [];
  for (let i = 0; i < DRAFT_SIZE && weighted.length > 0; i++) {
    const idx = weightedPick(state, weighted.map((x) => x.w));
    result.push(weighted[idx]!.card);
    weighted.splice(idx, 1);
  }

  // Non-Common guarantee — only meaningful for regular drafts (cursed cards
  // are all epic/legendary, so this is always satisfied for them).
  if (!cursed) {
    const hasNonCommon = result.some((c) => c.rarity !== 'common');
    const draftsSinceNonCommon = cc.draftCount - cc.lastNonCommonDraft;
    if (!hasNonCommon && draftsSinceNonCommon >= NON_COMMON_GUARANTEE_GAP - 1) {
      const remainingNonCommons = pool.filter(
        (c) => c.rarity !== 'common' && !result.includes(c),
      );
      if (remainingNonCommons.length > 0) {
        const replacement = state.rng.pick(remainingNonCommons);
        const swapIdx = result.findIndex((c) => c.rarity === 'common');
        if (swapIdx >= 0) result[swapIdx] = replacement;
      }
    }
  }

  // Bookkeeping.
  cc.draftCount += 1;
  if (result.some((c) => c.rarity !== 'common')) {
    cc.lastNonCommonDraft = cc.draftCount;
  }
  if (result.some((c) => c.rarity === 'legendary')) {
    cc.lastLegendaryWave = currentWave;
  }

  // Cursed-only: clone each cursed card and attach 1-2 randomly-rolled
  // extras so the displayed bullet count lands at 4-5 with a randomised
  // pos/neg ratio. We clone so we don't mutate the source-of-truth
  // CURSED_CARDS array — subsequent drafts must roll fresh extras.
  for (let i = 0; i < result.length; i++) {
    const c = result[i]!;
    if (!isCursedCard(c)) continue;
    result[i] = withRolledExtras(state, c);
  }

  return result;
}

/** Clone a cursed card and pick `1-2` extras from the shared pool. The
 *  number of extras and the pos/neg split are RNG-driven; we never pick
 *  the same effect id twice. Magnitudes are small (≤±10 %) so extras
 *  flavour the draft without dwarfing the static cursed payload. */
function withRolledExtras(state: GameState, card: CardDef): CardDef {
  // 50/50 between 1 and 2 extras → final bullet count is 4 (3 base + 1)
  // or 5 (3 base + 2).
  const extraCount = state.rng.chance(0.5) ? 1 : 2;
  const ids: string[] = [];
  for (let i = 0; i < extraCount; i++) {
    // Independent 50/50 polarity per extra so the row of cursed cards in
    // a single draft can show distinctly different pos/neg ratios.
    const polarity = state.rng.chance(0.5) ? 'pos' : 'neg';
    const pool = cursedExtraPool(polarity).filter((e) => !ids.includes(e.id));
    if (pool.length === 0) continue;
    ids.push(state.rng.pick(pool).id);
  }
  return { ...card, rolledExtraIds: ids };
}

// Tiny weighted-pick helper that uses the shared RNG for determinism.
function weightedPick(state: GameState, weights: number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  let r = state.rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

/** Reset reroll state at the start of a fresh draft. */
export function beginNewDraft(state: GameState): void {
  state.cardChoice.rerollCost = 50;
  state.cardChoice.freeRerollUsed = false;
}

/** Attempt a paid reroll. Returns true on success. Increases the cost for
 *  subsequent rerolls within the same draft. */
export function rerollForGold(state: GameState): boolean {
  const cost = state.cardChoice.rerollCost;
  if (state.gold < cost) return false;
  state.gold -= cost;
  state.cardChoice.rerollCost = cost + 25;
  // A reroll counts as a re-draft for the cooldown bookkeeping. We undo the
  // increment that rollCardOptions just did so a reroll doesn't artificially
  // burn through the legendary cooldown.
  state.cardChoice.draftCount -= 1;
  state.cardChoice.options = rollCardOptions(state);
  return true;
}

/** One free reroll per draft, granted after watching a rewarded ad. */
export function rerollForAd(state: GameState): boolean {
  if (state.cardChoice.freeRerollUsed) return false;
  state.cardChoice.freeRerollUsed = true;
  state.cardChoice.draftCount -= 1;
  state.cardChoice.options = rollCardOptions(state);
  return true;
}

// ────────────────────────────────────────────────────────────────────────────
// applyCard
//
// Dispatches on `card.id`. Normal cards (`<stat>_<rarity>`) only mutate the
// matching modifier or stat. Cursed cards (`curse_*`) layer their unique
// effect, the bonus stat, and the drawback in a single switch arm.
// ────────────────────────────────────────────────────────────────────────────

export function applyCard(state: GameState, card: CardDef): void {
  const m = state.modifiers;
  const mq = state.mannequin;
  const dm = state.difficultyModifier;

  // Track equipped catalysts so the renderer can orbit icons around the
  // Mannequin and so the draft pool can stop offering them once the slot
  // cap is reached. Cursed catalyst cards count too.
  if (card.category === 'catalyst' && !state.equippedCatalysts.includes(card.id)) {
    state.equippedCatalysts.push(card.id);
  }

  // ── Normal stat-only cards ────────────────────────────────────────────────
  switch (card.id) {
    // Potion damage
    case 'pdmg_c': m.potionDamageMult *= 1.08; break;
    case 'pdmg_r': m.potionDamageMult *= 1.15; break;
    case 'pdmg_e': m.potionDamageMult *= 1.25; break;
    case 'pdmg_l': m.potionDamageMult *= 1.40; break;
    // Potion radius
    case 'prad_c': m.potionRadiusMult *= 1.08; break;
    case 'prad_r': m.potionRadiusMult *= 1.13; break;
    case 'prad_e': m.potionRadiusMult *= 1.23; break;
    case 'prad_l': m.potionRadiusMult *= 1.35; break;
    // Potion cooldown
    case 'pcd_c': m.potionCooldownMult *= 0.94; break;
    case 'pcd_r': m.potionCooldownMult *= 0.89; break;
    case 'pcd_e': m.potionCooldownMult *= 0.82; break;
    case 'pcd_l': m.potionCooldownMult *= 0.75; break;
    // Tower damage
    case 'tdmg_c': m.towerDamageMult *= 1.08; break;
    case 'tdmg_r': m.towerDamageMult *= 1.15; break;
    case 'tdmg_e': m.towerDamageMult *= 1.25; break;
    case 'tdmg_l': m.towerDamageMult *= 1.40; break;
    // Tower fire rate
    case 'tfr_c': m.towerFireRateMult *= 1.06; break;
    case 'tfr_r': m.towerFireRateMult *= 1.11; break;
    case 'tfr_e': m.towerFireRateMult *= 1.20; break;
    case 'tfr_l': m.towerFireRateMult *= 1.30; break;
    // Tower range
    case 'trng_c': m.towerRangeMult *= 1.05; break;
    case 'trng_r': m.towerRangeMult *= 1.10; break;
    case 'trng_e': m.towerRangeMult *= 1.18; break;
    case 'trng_l': m.towerRangeMult *= 1.28; break;
    // Mannequin HP
    case 'hp_c': mq.maxHp += 13;  mq.hp = Math.min(mq.maxHp, mq.hp + 13);  break;
    case 'hp_r': mq.maxHp += 25;  mq.hp = Math.min(mq.maxHp, mq.hp + 25);  break;
    case 'hp_e': mq.maxHp += 45;  mq.hp = Math.min(mq.maxHp, mq.hp + 45);  break;
    case 'hp_l': mq.maxHp += 75; mq.hp = Math.min(mq.maxHp, mq.hp + 75); break;
    // Gold drops
    case 'gold_c': m.goldDropMult *= 1.08; break;
    case 'gold_r': m.goldDropMult *= 1.15; break;
    case 'gold_e': m.goldDropMult *= 1.25; break;
    case 'gold_l': m.goldDropMult *= 1.40; break;
    // ── Cursed cards ────────────────────────────────────────────────────────
    // Recipes / brews
    case 'curse_flammable_mix':
      m.potionLeavesFire = true;
      m.potionDamageMult *= 1.15;
      dm.hpMult *= 1.15;
      break;
    case 'curse_unstable_flask':
      m.potionEchoExplode = Math.max(m.potionEchoExplode, 0.5);
      m.potionRadiusMult *= 1.13;
      m.potionCooldownMult *= 1.20;
      break;
    case 'curse_frost_brew':
      m.potionFrostActive = true;
      m.potionRadiusMult *= 1.15;
      dm.hpMult *= 1.15;
      break;
    case 'curse_acid_brew':
      m.potionAcidActive = true;
      m.potionDamageMult *= 1.15;
      dm.hpMult *= 1.15;
      break;
    case 'curse_mercury_brew':
      m.potionMercuryActive = true;
      m.potionDamageMult *= 1.13;
      m.potionRadiusMult *= 1.10;
      m.goldDropMult *= 0.75;
      break;
    case 'curse_aether_brew':
      m.potionAetherActive = true;
      m.potionDamageMult *= 1.20;
      dm.hpMult *= 1.20;
      break;
    case 'curse_mutagen_brew':
      m.potionPoisonActive = true;
      m.potionDamageMult *= 1.18;
      dm.hpMult *= 1.20;
      break;
    case 'curse_triple_throw':
      m.tripleThrowActive = true;
      m.tripleThrowTimer = m.tripleThrowInterval;
      m.potionCooldownMult *= 0.90;
      m.potionRadiusMult *= 0.80;
      break;

    // Engineering / towers
    case 'curse_crossfire':
      m.towerBonusVsBurning = true;
      m.towerDamageMult *= 1.10;
      dm.speedMult *= 1.15;
      break;
    case 'curse_mercury_coating':
      m.towerMercurySlow = true;
      m.towerFireRateMult *= 1.13;
      mq.maxHp = Math.max(50, mq.maxHp - 30);
      mq.hp = Math.min(mq.maxHp, mq.hp);
      break;
    case 'curse_acid_tips':
      m.towerAcidBreak = true;
      m.towerDamageMult *= 1.13;
      m.towerCostMult *= 1.30;
      break;
    case 'curse_synchronized_volley':
      m.towerSyncVolley = true;
      m.towerDamageMult *= 1.10;
      dm.hpMult *= 1.20;
      break;

    // Rituals / mannequin
    case 'curse_thorny_shell':
      m.thornyShell = true;
      mq.maxHp += 25; mq.hp = Math.min(mq.maxHp, mq.hp + 25);
      m.goldDropMult *= 0.80;
      break;
    case 'curse_chronos':
      state.activeModuleId = 'chronos';
      m.potionDamageMult *= 1.15;
      m.potionCooldownMult *= 1.20;
      break;
    case 'curse_golem_heart':
      state.golemHeartCharges = 1;
      mq.maxHp += 38; mq.hp = Math.min(mq.maxHp, mq.hp + 38);
      m.potionDamageMult *= 0.70;
      break;

    // Catalysts
    case 'curse_fire_ruby':
      m.fireRubyCounter = 5;
      m.potionDamageMult *= 1.13;
      dm.speedMult *= 1.15;
      break;
    case 'curse_mercury_ring':
      m.mercuryRingActive = true;
      m.goldDropMult *= 1.15;
      dm.hpMult *= 1.15;
      break;
    case 'curse_acid_prism':
      m.reactionDamageMult *= 1.13;
      m.potionDamageMult *= 1.13;
      mq.maxHp = Math.max(50, mq.maxHp - 35);
      mq.hp = Math.min(mq.maxHp, mq.hp);
      break;
    case 'curse_aether_engine':
      m.aetherEngineActive = true;
      m.potionDamageMult *= 1.18;
      m.potionCooldownMult *= 1.20;
      break;
    case 'curse_crown_of_elements':
      m.reactionDamageMult *= 1.25;
      m.reactionOverloadCharge = Math.max(m.reactionOverloadCharge, 10);
      state.catalystSlots += 1;
      m.potionDamageMult *= 1.13;
      dm.hpMult *= 1.20;
      break;

    // Legendary pacts
    case 'curse_salamander':
      m.salamanderActive = true;
      m.potionLeavesFire = true;
      m.potionDamageMult *= 1.25;
      mq.basePotionCooldown *= 1.25;
      break;
    case 'curse_archmaster':
      m.archmasterActive = true;
      m.towerDamageMult *= 1.13;
      m.towerCostMult *= 1.10;
      break;

    default:
      break;
  }

  // Cursed-only: apply each rolled extra's mutator. Extras are no-ops on
  // normal cards (rolledExtraIds is undefined). Order doesn't matter
  // because every extra is a small independent mult on its own field.
  if (card.rolledExtraIds) {
    for (const id of card.rolledExtraIds) {
      const def = getCursedExtra(id);
      if (def) def.apply(state);
    }
  }

  state.cardChoice.pickedIds.push(card.id);
}

// Re-export for tests / debug tools that previously imported from this file.
export { isCursedCard };
