import { t } from '../i18n';

export interface DailyReward {
  day: number;
  type: 'gold' | 'blue_essence' | 'ancient_essence' | 'keys' | 'rerolls';
  amount: number;
}

export const DAILY_CYCLE = 14;

export const DAILY_REWARDS: DailyReward[] = [
  { day: 1, type: 'gold', amount: 50 },
  { day: 2, type: 'blue_essence', amount: 5 },
  { day: 3, type: 'keys', amount: 1 },
  { day: 4, type: 'gold', amount: 75 },
  { day: 5, type: 'blue_essence', amount: 8 },
  { day: 6, type: 'rerolls', amount: 2 },
  { day: 7, type: 'keys', amount: 2 },
  { day: 8, type: 'gold', amount: 50 },
  { day: 9, type: 'blue_essence', amount: 5 },
  { day: 10, type: 'gold', amount: 100 },
  { day: 11, type: 'keys', amount: 1 },
  { day: 12, type: 'blue_essence', amount: 10 },
  { day: 13, type: 'rerolls', amount: 3 },
  { day: 14, type: 'ancient_essence', amount: 1 },
];

export function rewardLabel(r: DailyReward): string {
  return t(`reward.${r.type}`, { n: r.amount });
}

export function rewardIcon(type: DailyReward['type']): string {
  switch (type) {
    case 'gold': return '🪙';
    case 'blue_essence': return '💎';
    case 'ancient_essence': return '🔮';
    case 'keys': return '🗝️';
    case 'rerolls': return '🔄';
  }
}
