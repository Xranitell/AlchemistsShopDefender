import { t } from '../i18n';

/** Battle-pass reward types. Same constraint as `DailyReward` — every
 *  entry must credit a real meta-save bucket; per-run currencies (gold)
 *  are deliberately excluded because they have no inventory between runs.
 *  Keys awarded here are difficulty keys (`epicKeys` / `ancientKeys`),
 *  not the legacy `meta.keys` field. */
export interface BpReward {
  type:
    | 'blue_essence'
    | 'ancient_essence'
    | 'epic_key'
    | 'ancient_key'
    | 'rerolls';
  amount: number;
}

export interface BpLevel {
  level: number;
  xpRequired: number;
  freeReward: BpReward | null;
  premiumReward: BpReward | null;
}

export const BP_MAX_LEVEL = 30;
export const BP_XP_PER_WAVE = 2;
export const BP_XP_PER_KILL = 1;
export const BP_XP_VICTORY = 20;

function xpForLevel(lv: number): number {
  return 10 + lv * 5;
}

export const BP_LEVELS: BpLevel[] = Array.from({ length: BP_MAX_LEVEL }, (_, i) => {
  const lv = i + 1;
  return {
    level: lv,
    xpRequired: xpForLevel(lv),
    freeReward: freeRewardForLevel(lv),
    premiumReward: premiumRewardForLevel(lv),
  };
});

// The free/premium curves use only meta-save-backed currencies. Every-other
// level (the "filler" tier) gives blue essence in escalating amounts so
// late-pass progression keeps feeling rewarding even outside the headline
// 5-level cadence.
function freeRewardForLevel(lv: number): BpReward | null {
  if (lv % 5 === 0) return { type: 'epic_key', amount: lv <= 15 ? 1 : 2 };
  if (lv % 3 === 0) return { type: 'blue_essence', amount: 5 + Math.floor(lv / 5) * 3 };
  if (lv % 2 === 0) return { type: 'rerolls', amount: 1 + Math.floor(lv / 10) };
  return null;
}

function premiumRewardForLevel(lv: number): BpReward | null {
  if (lv % 5 === 0) return { type: 'ancient_essence', amount: 1 };
  if (lv % 10 === 0) return { type: 'ancient_key', amount: 1 };
  if (lv % 4 === 0) return { type: 'epic_key', amount: 2 };
  if (lv % 3 === 0) return { type: 'blue_essence', amount: 8 + Math.floor(lv / 5) * 5 };
  if (lv % 2 === 0) return { type: 'rerolls', amount: 2 + Math.floor(lv / 10) };
  return null;
}

export function bpRewardLabel(r: BpReward): string {
  return t(`reward.${r.type}`, { n: r.amount });
}
