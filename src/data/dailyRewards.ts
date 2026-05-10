import { t } from '../i18n';
import { getSprites } from '../render/sprites';
import type { BakedSprite } from '../render/sprite';

/** Daily-calendar reward types. Every entry MUST map to a real meta-save
 *  field (`MetaSave` in `src/game/save.ts`); we deliberately don't expose
 *  per-run currencies (gold) here because the player has no inventory for
 *  them between runs and the reward would silently get miscredited to
 *  another bucket. The keys awarded here are the difficulty keys
 *  (`epicKeys` / `ancientKeys`), not the legacy `meta.keys` field. */
export interface DailyReward {
  day: number;
  type:
    | 'blue_essence'
    | 'ancient_essence'
    | 'epic_key'
    | 'ancient_key'
    | 'rerolls';
  amount: number;
}

export const DAILY_CYCLE = 7;

/** 7-day rotating cycle (one reward per weekday). Tier curve:
 *   - Days 1-2 hand out a small blue-essence starter drop.
 *   - Day 3 introduces an ancient-essence trickle.
 *   - Day 4 bumps the blue-essence payout.
 *   - Day 5 grants an epic key for the run-prep loop.
 *   - Day 6 doubles the ancient-essence drop as the mid-week reward.
 *   - Day 7 is the weekly capstone — an ancient key.
 *  All amounts are intentionally below "single-run earn rate" so daily
 *  claims feel like a bonus, never a substitute for actually playing. */
export const DAILY_REWARDS: DailyReward[] = [
  { day: 1, type: 'blue_essence', amount: 5 },
  { day: 2, type: 'blue_essence', amount: 8 },
  { day: 3, type: 'ancient_essence', amount: 1 },
  { day: 4, type: 'blue_essence', amount: 12 },
  { day: 5, type: 'epic_key', amount: 1 },
  { day: 6, type: 'ancient_essence', amount: 2 },
  { day: 7, type: 'ancient_key', amount: 1 },
];

export function rewardLabel(r: DailyReward): string {
  return t(`reward.${r.type}`, { n: r.amount });
}

/**
 * Returns the baked pixel-art sprite that represents a given reward type.
 * Used by the daily-rewards calendar and the battle-pass track so both
 * surfaces speak the same visual language as the in-game HUD.
 */
export function rewardSprite(type: DailyReward['type']): BakedSprite {
  const s = getSprites();
  switch (type) {
    case 'blue_essence': return s.iconBlueEssence;
    case 'ancient_essence': return s.iconAncientEssence;
    case 'epic_key': return s.iconEpicKey;
    case 'ancient_key': return s.iconAncientKey;
    case 'rerolls': return s.iconRerolls;
  }
}
