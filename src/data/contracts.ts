import type { GameState } from '../game/state';
import type { DifficultyMode } from './difficulty';
import type { Element } from '../game/types';

/**
 * Per-run "contracts" — small optional goals rolled at the start of an Epic
 * (2 contracts) or Ancient (3 contracts) run. Each contract is a tiny side
 * objective ("kill 50 slimes", "don't take damage in waves 3..5", etc.) that
 * pays out a *bonus* on top of the regular run rewards if completed.
 *
 * Design notes:
 * — Contracts are intentionally cheap to track. They reuse the existing
 *   on-death / on-tower-buy / on-mannequin-hit hooks via a single
 *   `state.contractStats` bag of counters (see `game/state.ts`).
 * — Each contract's `progress(state)` returns `{ done, current, target }`
 *   so the pause overlay and victory screen can render a unified bar.
 * — Rewards are awarded in `awardRunEssence` only on a successful run-end
 *   (so a contract you "completed mid-run but then died" still counts —
 *   the goal is to nudge variety, not punish bad luck).
 */

export type ContractId =
  | 'slay_slimes'
  | 'slay_rats'
  | 'fire_kills'
  | 'frost_kills'
  | 'mercury_kills'
  | 'aether_kills'
  | 'flawless_early'
  | 'flawless_late'
  | 'no_reroll'
  | 'no_skip'
  | 'gold_hoarder'
  | 'tower_collector'
  | 'boss_slayer';

export type ContractRewardKind = 'blue' | 'ancient' | 'blueMult' | 'epicKey';

export interface ContractReward {
  /** Which currency / multiplier this contract pays out. `blueMult` is a
   *  flat additive bump to the per-run blue-essence multiplier (so two
   *  +0.25 rewards stack additively to +50%). */
  kind: ContractRewardKind;
  amount: number;
}

export interface ContractProgress {
  current: number;
  target: number;
  done: boolean;
  /** Optional set to true for pass/fail goals that have "broken" mid-run
   *  (e.g. you used a reroll on a no-reroll contract). The goal is no
   *  longer reachable so the UI can grey it out. */
  failed: boolean;
}

export interface ContractDef {
  id: ContractId;
  icon: string;
  /** i18n key for the human-readable goal name (short form for the HUD). */
  i18nName: string;
  /** i18n key for the longer "what does this mean" description. */
  i18nDesc: string;
  /** Reward paid out on successful run-end if `progress(state).done` holds. */
  reward: ContractReward;
  /** Returns the current state of this contract. Pure read-only — never
   *  mutates `state`. */
  progress: (state: GameState) => ContractProgress;
}

const TARGET = {
  SLIME_KILLS: 30,
  RAT_KILLS: 25,
  FIRE_KILLS: 20,
  FROST_KILLS: 20,
  MERCURY_KILLS: 20,
  AETHER_KILLS: 15,
  GOLD_PEAK: 250,
  TOWER_COLLECTOR: 5,
  BOSS_KILLS: 2,
} as const;

const FLAWLESS_EARLY_RANGE: [number, number] = [3, 5];
const FLAWLESS_LATE_RANGE: [number, number] = [8, 10];

function elementProgress(state: GameState, element: Element, target: number): ContractProgress {
  const current = Math.min(target, state.contractStats.killsByElement[element] ?? 0);
  return { current, target, done: current >= target, failed: false };
}

function kindProgress(state: GameState, kindId: string, target: number): ContractProgress {
  const current = Math.min(target, state.contractStats.killsByKind[kindId] ?? 0);
  return { current, target, done: current >= target, failed: false };
}

function flawlessProgress(state: GameState, range: [number, number]): ContractProgress {
  const [from, to] = range;
  const target = to - from + 1;
  // Failed iff any wave in the range has been started AND damage was logged
  // for it (or the wave is still ongoing and we already took damage).
  let damagedCount = 0;
  let clearedNoDamage = 0;
  const current = state.waveState.currentIndex + 1;
  for (let w = from; w <= to; w++) {
    const damaged = state.contractStats.damageInWave[w] === true;
    if (damaged) damagedCount += 1;
    // wave w is "cleared" iff the player has progressed past it.
    if (current > w && !damaged) clearedNoDamage += 1;
  }
  const failed = damagedCount > 0;
  return {
    current: clearedNoDamage,
    target,
    done: !failed && clearedNoDamage >= target,
    failed,
  };
}

export const CONTRACTS: ContractDef[] = [
  {
    id: 'slay_slimes',
    icon: '🟢',
    i18nName: 'ui.contract.slay_slimes.name',
    i18nDesc: 'ui.contract.slay_slimes.desc',
    reward: { kind: 'blue', amount: 6 },
    progress: (s) => kindProgress(s, 'slime', TARGET.SLIME_KILLS),
  },
  {
    id: 'slay_rats',
    icon: '🐀',
    i18nName: 'ui.contract.slay_rats.name',
    i18nDesc: 'ui.contract.slay_rats.desc',
    reward: { kind: 'blue', amount: 6 },
    progress: (s) => kindProgress(s, 'rat', TARGET.RAT_KILLS),
  },
  {
    id: 'fire_kills',
    icon: '🔥',
    i18nName: 'ui.contract.fire_kills.name',
    i18nDesc: 'ui.contract.fire_kills.desc',
    reward: { kind: 'blue', amount: 8 },
    progress: (s) => elementProgress(s, 'fire', TARGET.FIRE_KILLS),
  },
  {
    id: 'frost_kills',
    icon: '❄️',
    i18nName: 'ui.contract.frost_kills.name',
    i18nDesc: 'ui.contract.frost_kills.desc',
    reward: { kind: 'blue', amount: 8 },
    progress: (s) => elementProgress(s, 'frost', TARGET.FROST_KILLS),
  },
  {
    id: 'mercury_kills',
    icon: '💧',
    i18nName: 'ui.contract.mercury_kills.name',
    i18nDesc: 'ui.contract.mercury_kills.desc',
    reward: { kind: 'blue', amount: 8 },
    progress: (s) => elementProgress(s, 'mercury', TARGET.MERCURY_KILLS),
  },
  {
    id: 'aether_kills',
    icon: '✨',
    i18nName: 'ui.contract.aether_kills.name',
    i18nDesc: 'ui.contract.aether_kills.desc',
    reward: { kind: 'ancient', amount: 1 },
    progress: (s) => elementProgress(s, 'aether', TARGET.AETHER_KILLS),
  },
  {
    id: 'flawless_early',
    icon: '🛡️',
    i18nName: 'ui.contract.flawless_early.name',
    i18nDesc: 'ui.contract.flawless_early.desc',
    reward: { kind: 'blue', amount: 10 },
    progress: (s) => flawlessProgress(s, FLAWLESS_EARLY_RANGE),
  },
  {
    id: 'flawless_late',
    icon: '🛡️',
    i18nName: 'ui.contract.flawless_late.name',
    i18nDesc: 'ui.contract.flawless_late.desc',
    reward: { kind: 'ancient', amount: 1 },
    progress: (s) => flawlessProgress(s, FLAWLESS_LATE_RANGE),
  },
  {
    id: 'no_reroll',
    icon: '🎯',
    i18nName: 'ui.contract.no_reroll.name',
    i18nDesc: 'ui.contract.no_reroll.desc',
    reward: { kind: 'blueMult', amount: 0.25 },
    // Pass-fail goal: predicate is "the player never used a reroll".
    // Goal is *only* realised once the run terminates, so we gate `done`
    // on the run actually being over. Otherwise the HUD would flip to
    // "✓ Выполнено" on wave 1 before the player has drafted anything,
    // which players read as a bug.
    progress: (s) => {
      const broken = s.contractStats.rerollUsed;
      const runEnded = s.phase === 'victory' || s.phase === 'gameover';
      return {
        current: broken || !runEnded ? 0 : 1,
        target: 1,
        done: !broken && runEnded,
        failed: broken,
      };
    },
  },
  {
    id: 'no_skip',
    icon: '🃏',
    i18nName: 'ui.contract.no_skip.name',
    i18nDesc: 'ui.contract.no_skip.desc',
    reward: { kind: 'blue', amount: 8 },
    // See `no_reroll` — same gating: the contract counts as `done` only
    // after the run ends without any draft skip.
    progress: (s) => {
      const broken = s.contractStats.cardSkipUsed;
      const runEnded = s.phase === 'victory' || s.phase === 'gameover';
      return {
        current: broken || !runEnded ? 0 : 1,
        target: 1,
        done: !broken && runEnded,
        failed: broken,
      };
    },
  },
  {
    id: 'gold_hoarder',
    icon: '💰',
    i18nName: 'ui.contract.gold_hoarder.name',
    i18nDesc: 'ui.contract.gold_hoarder.desc',
    reward: { kind: 'blue', amount: 6 },
    progress: (s) => ({
      current: Math.min(TARGET.GOLD_PEAK, s.contractStats.goldPeak),
      target: TARGET.GOLD_PEAK,
      done: s.contractStats.goldPeak >= TARGET.GOLD_PEAK,
      failed: false,
    }),
  },
  {
    id: 'tower_collector',
    icon: '🏗️',
    i18nName: 'ui.contract.tower_collector.name',
    i18nDesc: 'ui.contract.tower_collector.desc',
    reward: { kind: 'blue', amount: 6 },
    progress: (s) => ({
      current: Math.min(TARGET.TOWER_COLLECTOR, s.contractStats.towersBuilt),
      target: TARGET.TOWER_COLLECTOR,
      done: s.contractStats.towersBuilt >= TARGET.TOWER_COLLECTOR,
      failed: false,
    }),
  },
  {
    id: 'boss_slayer',
    icon: '👑',
    i18nName: 'ui.contract.boss_slayer.name',
    i18nDesc: 'ui.contract.boss_slayer.desc',
    reward: { kind: 'ancient', amount: 1 },
    progress: (s) => ({
      current: Math.min(TARGET.BOSS_KILLS, s.contractStats.bossKills),
      target: TARGET.BOSS_KILLS,
      done: s.contractStats.bossKills >= TARGET.BOSS_KILLS,
      failed: false,
    }),
  },
];

export const CONTRACT_BY_ID: Record<ContractId, ContractDef> =
  Object.fromEntries(CONTRACTS.map((c) => [c.id, c])) as Record<ContractId, ContractDef>;

/** How many contracts to roll for the given difficulty. Normal/Endless/Daily
 *  return 0 — contracts only exist in Epic and Ancient runs. */
export function contractCountForDifficulty(mode: DifficultyMode): number {
  if (mode === 'epic') return 2;
  if (mode === 'ancient') return 3;
  return 0;
}
