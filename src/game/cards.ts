import { CARDS, CARD_SYNERGIES } from '../data/cards';
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

/**
 * Roll the 3 cards offered after the current wave. Implements GDD §8.3 rules:
 *  - smart-bias: cards from already-picked categories get a soft weight boost,
 *    and cards listed as synergy partners of picked cards get a stronger one;
 *  - Legendary may not be offered twice within `LEGENDARY_WAVE_COOLDOWN` waves;
 *  - if no non-Common option has been offered for `NON_COMMON_GUARANTEE_GAP`
 *    consecutive drafts, force at least one non-Common into the result.
 *
 * The function ALSO advances the bookkeeping fields on `state.cardChoice`
 * (`lastLegendaryWave`, `lastNonCommonDraft`) so that the next draft sees the
 * updated cooldown windows.
 */
export function rollCardOptions(state: GameState): CardDef[] {
  const cc = state.cardChoice;
  const currentWave = state.waveState.currentIndex + 1; // 1-based
  const taken = new Set(cc.pickedIds);

  // Filter out already-picked cards.
  let pool = CARDS.filter((c) => !taken.has(c.id));

  // Legendary cooldown window — drop legendaries if we offered one too recently.
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

  // Non-Common guarantee. If the result is all-Common AND the streak of
  // common-only drafts has reached the gap, swap one Common for a random
  // non-Common still in the pool.
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

  // Bookkeeping: record what we just offered so the next draft can apply
  // the same cooldown rules. We bump `draftCount` here (after the offering)
  // so the very first draft of the run is index 0.
  cc.draftCount += 1;
  if (result.some((c) => c.rarity !== 'common')) {
    cc.lastNonCommonDraft = cc.draftCount;
  }
  if (result.some((c) => c.rarity === 'legendary')) {
    cc.lastLegendaryWave = currentWave;
  }

  return result;
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

export function applyCard(state: GameState, card: CardDef): void {
  const m = state.modifiers;
  const mq = state.mannequin;

  switch (card.id) {
    case 'heavy_brew':
      m.potionDamageMult *= 1.25;
      break;
    case 'wide_splash':
      m.potionRadiusMult *= 1.20;
      break;
    case 'quick_hands':
      m.potionCooldownMult *= 0.85;
      break;
    case 'flammable_mix':
      m.potionLeavesFire = true;
      break;
    case 'unstable_flask':
      m.potionEchoExplode = Math.max(m.potionEchoExplode, 0.5);
      break;
    case 'oiled_gears':
      m.towerFireRateMult *= 1.15;
      break;
    case 'wider_lenses':
      m.towerRangeMult *= 1.12;
      m.towerDamageMult *= 1.10;
      break;
    case 'crossfire':
      m.towerBonusVsBurning = true;
      break;
    case 'mercury_coating':
      m.towerMercurySlow = true;
      break;
    case 'acid_tips':
      m.towerAcidBreak = true;
      break;
    case 'synchronized_volley':
      m.towerSyncVolley = true;
      break;
    case 'reinforced_frame':
      mq.maxHp += 25;
      mq.hp = Math.min(mq.maxHp, mq.hp + 25);
      break;
    case 'magnet':
      m.lootRadiusMult *= 1.5;
      break;
    case 'chronos':
      m.overloadType = 'chronos';
      break;
    case 'thorny_shell':
      m.thornyShell = true;
      break;
    case 'gold_rush':
      m.goldDropMult *= 1.3;
      break;
    case 'fire_ruby':
      m.fireRubyCounter = 5;
      break;
    case 'mercury_ring':
      m.mercuryRingActive = true;
      break;
    case 'acid_prism':
      m.reactionDamageMult *= 1.25;
      break;
    case 'aether_engine':
      m.aetherEngineActive = true;
      break;
    case 'frost_brew':
      m.potionFrostActive = true;
      break;
    case 'acid_brew':
      m.potionAcidActive = true;
      break;
    case 'mercury_brew':
      m.potionMercuryActive = true;
      break;
    case 'aether_brew':
      m.potionAetherActive = true;
      break;
    case 'mutagen_brew':
      m.potionPoisonActive = true;
      break;

    // High-tier cards
    case 'triple_throw':
      m.tripleThrowActive = true;
      // First fan triggers after the first interval, not immediately.
      m.tripleThrowTimer = m.tripleThrowInterval;
      break;
    case 'salamander':
      m.salamanderActive = true;
      m.potionLeavesFire = true;
      mq.basePotionCooldown *= 1.20;
      break;
    case 'archmaster':
      m.archmasterActive = true;
      break;
    case 'golem_heart':
      // Idempotent: only ever 1 charge per run.
      state.golemHeartCharges = 1;
      break;
    case 'crown_of_elements':
      m.reactionDamageMult *= 1.5;
      m.reactionOverloadCharge = Math.max(m.reactionOverloadCharge, 10);
      // The "+1 catalyst slot" sub-effect is reserved for the catalyst slot
      // system (PR4); for now the damage + overload bonuses already make this
      // a strong pick.
      break;

    default:
      break;
  }
  state.cardChoice.pickedIds.push(card.id);
}
