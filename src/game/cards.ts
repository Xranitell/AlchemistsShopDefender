import { CARDS } from '../data/cards';
import type { CardDef } from './types';
import type { GameState } from './state';

export function rollCardOptions(state: GameState): CardDef[] {
  const taken = new Set(state.cardChoice.pickedIds);
  const pool = CARDS.filter((c) => !taken.has(c.id));
  const shuffled = state.rng.shuffle(pool);
  return shuffled.slice(0, Math.min(3, shuffled.length));
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
  state.cardChoice.options = rollCardOptions(state);
  return true;
}

/** One free reroll per draft, granted after watching a rewarded ad. */
export function rerollForAd(state: GameState): boolean {
  if (state.cardChoice.freeRerollUsed) return false;
  state.cardChoice.freeRerollUsed = true;
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
    default:
      break;
  }
  state.cardChoice.pickedIds.push(card.id);
}
