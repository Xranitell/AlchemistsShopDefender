export interface BpReward {
  type: 'gold' | 'blue_essence' | 'ancient_essence' | 'keys';
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

function freeRewardForLevel(lv: number): BpReward | null {
  if (lv % 5 === 0) return { type: 'keys', amount: lv <= 15 ? 1 : 2 };
  if (lv % 3 === 0) return { type: 'blue_essence', amount: 5 + Math.floor(lv / 5) * 3 };
  if (lv % 2 === 0) return { type: 'gold', amount: 30 + lv * 5 };
  return null;
}

function premiumRewardForLevel(lv: number): BpReward | null {
  if (lv % 5 === 0) return { type: 'ancient_essence', amount: 1 };
  if (lv % 4 === 0) return { type: 'keys', amount: 2 };
  if (lv % 3 === 0) return { type: 'blue_essence', amount: 8 + Math.floor(lv / 5) * 5 };
  if (lv % 2 === 0) return { type: 'gold', amount: 50 + lv * 5 };
  return null;
}

export function bpRewardLabel(r: BpReward): string {
  switch (r.type) {
    case 'gold': return `${r.amount} зол.`;
    case 'blue_essence': return `${r.amount} СЭ`;
    case 'ancient_essence': return `${r.amount} ДЭ`;
    case 'keys': return `${r.amount} кл.`;
  }
}
