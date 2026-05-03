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

export const DAILY_CYCLE = 12;

/** 12-day rotating cycle. Tier curve:
 *   - Day-1 / 8 give a small starter blue-essence drop.
 *   - Mid-cycle (4, 6, 9) hands out rerolls / epic keys to keep the
 *     run-prep loop interesting.
 *   - Days 7 and 12 are the week-1 / week-2 capstones — ancient essence
 *     and an ancient key respectively.
 *  All amounts are intentionally below "single-run earn rate" so daily
 *  claims feel like a bonus, never a substitute for actually playing. */
export const DAILY_REWARDS: DailyReward[] = [
  { day: 1, type: 'blue_essence', amount: 5 },
  { day: 2, type: 'rerolls', amount: 1 },
  { day: 3, type: 'blue_essence', amount: 8 },
  { day: 4, type: 'epic_key', amount: 1 },
  { day: 5, type: 'blue_essence', amount: 12 },
  { day: 6, type: 'rerolls', amount: 2 },
  { day: 7, type: 'ancient_essence', amount: 1 },
  { day: 8, type: 'blue_essence', amount: 10 },
  { day: 9, type: 'epic_key', amount: 1 },
  { day: 10, type: 'blue_essence', amount: 15 },
  { day: 11, type: 'rerolls', amount: 3 },
  { day: 12, type: 'ancient_key', amount: 1 },
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
