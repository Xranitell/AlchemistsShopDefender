// ── Run Blessings & Curses ("Дар алхимика") ───────────────────────────
//
// Slay-the-Spire-style pre-run pick:
//   • Epic    → choose 1 of 3 random blessings (positive run-wide buff).
//   • Ancient → choose 1 of 3 random blessings AND 1 of 3 random curses
//               (mandatory drawback).
//
// Both pools modify the same `state.modifiers` / `state.difficultyModifier`
// knobs that the existing meta-upgrade / biome / daily-event / mutator
// pipelines write into. They are applied right after `applyRunMutators`
// in `startRun`, after the player has confirmed their picks.
//
// Like mutators, every blessing/curse is a single multiplicative bump on
// an existing field — the entire system costs nothing at runtime once the
// run is rolling. The only new state is `activeBlessingIds` and
// `activeCurseId` (see `game/state.ts`) so the HUD ribbon and pause
// overlay can show them.

import type { GameState } from '../game/state';
import type { DifficultyMode } from './difficulty';

export type BlessingId =
  | 'alchemy_grip'
  | 'glassblower'
  | 'quick_hand'
  | 'sharp_aim'
  | 'far_sight'
  | 'merchant_discount'
  | 'steel_vow'
  | 'greedy_reaper';

export type CurseId =
  | 'fragile_flasks_curse'
  | 'foggy_runes'
  | 'tangled_hands'
  | 'beast_fury'
  | 'boiling_blood'
  | 'bloody_harvest';

export interface BlessingDef {
  id: BlessingId;
  icon: string;
  color: string;
  /** i18n key for the short name (HUD chip + card title). */
  i18nName: string;
  /** i18n key for the one-liner flavour text. */
  i18nFlavor: string;
  /** i18n key for the single-line effect description. */
  i18nEffect: string;
  /** Mutates `state` directly. Runs once at run start, after the player
   *  picks this blessing in the intro overlay. */
  apply: (state: GameState) => void;
}

export interface CurseDef {
  id: CurseId;
  icon: string;
  color: string;
  i18nName: string;
  i18nFlavor: string;
  i18nEffect: string;
  apply: (state: GameState) => void;
}

export const BLESSINGS: BlessingDef[] = [
  {
    id: 'alchemy_grip',
    icon: '🧪',
    color: '#7df9ff',
    i18nName: 'ui.blessing.alchemy_grip.name',
    i18nFlavor: 'ui.blessing.alchemy_grip.flavor',
    i18nEffect: 'ui.blessing.alchemy_grip.effect',
    apply: (state) => {
      // Heavier potion strikes — pairs well with builds that lean on
      // direct mannequin throws over tower DPS.
      state.modifiers.potionDamageMult *= 1.25;
    },
  },
  {
    id: 'glassblower',
    icon: '💥',
    color: '#a78bfa',
    i18nName: 'ui.blessing.glassblower.name',
    i18nFlavor: 'ui.blessing.glassblower.flavor',
    i18nEffect: 'ui.blessing.glassblower.effect',
    apply: (state) => {
      // Wider splash for crowd control.
      state.modifiers.potionRadiusMult *= 1.20;
    },
  },
  {
    id: 'quick_hand',
    icon: '⚡',
    color: '#fde047',
    i18nName: 'ui.blessing.quick_hand.name',
    i18nFlavor: 'ui.blessing.quick_hand.flavor',
    i18nEffect: 'ui.blessing.quick_hand.effect',
    apply: (state) => {
      // Faster potion cooldown (lower mult = faster).
      state.modifiers.potionCooldownMult *= 0.80;
    },
  },
  {
    id: 'sharp_aim',
    icon: '🎯',
    color: '#ffd166',
    i18nName: 'ui.blessing.sharp_aim.name',
    i18nFlavor: 'ui.blessing.sharp_aim.flavor',
    i18nEffect: 'ui.blessing.sharp_aim.effect',
    apply: (state) => {
      state.modifiers.towerDamageMult *= 1.20;
    },
  },
  {
    id: 'far_sight',
    icon: '🔭',
    color: '#7dd3fc',
    i18nName: 'ui.blessing.far_sight.name',
    i18nFlavor: 'ui.blessing.far_sight.flavor',
    i18nEffect: 'ui.blessing.far_sight.effect',
    apply: (state) => {
      state.modifiers.towerRangeMult *= 1.25;
    },
  },
  {
    id: 'merchant_discount',
    icon: '💸',
    color: '#34d399',
    i18nName: 'ui.blessing.merchant_discount.name',
    i18nFlavor: 'ui.blessing.merchant_discount.flavor',
    i18nEffect: 'ui.blessing.merchant_discount.effect',
    apply: (state) => {
      // Cheaper towers throughout the run.
      state.modifiers.towerCostMult *= 0.80;
    },
  },
  {
    id: 'steel_vow',
    icon: '🛡️',
    color: '#9ca3af',
    i18nName: 'ui.blessing.steel_vow.name',
    i18nFlavor: 'ui.blessing.steel_vow.flavor',
    i18nEffect: 'ui.blessing.steel_vow.effect',
    apply: (state) => {
      // +25% mannequin max HP (current HP scales proportionally so the
      // player starts at full).
      const ratio = 1.25;
      state.mannequin.maxHp = Math.round(state.mannequin.maxHp * ratio);
      state.mannequin.hp = state.mannequin.maxHp;
    },
  },
  {
    id: 'greedy_reaper',
    icon: '💰',
    color: '#fbbf24',
    i18nName: 'ui.blessing.greedy_reaper.name',
    i18nFlavor: 'ui.blessing.greedy_reaper.flavor',
    i18nEffect: 'ui.blessing.greedy_reaper.effect',
    apply: (state) => {
      // Enemies drop +30% gold across the entire run.
      state.difficultyModifier.goldMult *= 1.30;
    },
  },
];

export const BLESSING_BY_ID: Record<BlessingId, BlessingDef> =
  Object.fromEntries(BLESSINGS.map((b) => [b.id, b])) as Record<BlessingId, BlessingDef>;

export const CURSES: CurseDef[] = [
  {
    id: 'fragile_flasks_curse',
    icon: '🥀',
    color: '#fb7185',
    i18nName: 'ui.curse.fragile_flasks_curse.name',
    i18nFlavor: 'ui.curse.fragile_flasks_curse.flavor',
    i18nEffect: 'ui.curse.fragile_flasks_curse.effect',
    apply: (state) => {
      state.modifiers.potionDamageMult *= 0.80;
    },
  },
  {
    id: 'foggy_runes',
    icon: '🌫️',
    color: '#94a3b8',
    i18nName: 'ui.curse.foggy_runes.name',
    i18nFlavor: 'ui.curse.foggy_runes.flavor',
    i18nEffect: 'ui.curse.foggy_runes.effect',
    apply: (state) => {
      state.modifiers.towerRangeMult *= 0.80;
    },
  },
  {
    id: 'tangled_hands',
    icon: '⛓️',
    color: '#a3a3a3',
    i18nName: 'ui.curse.tangled_hands.name',
    i18nFlavor: 'ui.curse.tangled_hands.flavor',
    i18nEffect: 'ui.curse.tangled_hands.effect',
    apply: (state) => {
      state.modifiers.towerCostMult *= 1.25;
    },
  },
  {
    id: 'beast_fury',
    icon: '🐺',
    color: '#ef4444',
    i18nName: 'ui.curse.beast_fury.name',
    i18nFlavor: 'ui.curse.beast_fury.flavor',
    i18nEffect: 'ui.curse.beast_fury.effect',
    apply: (state) => {
      state.difficultyModifier.speedMult *= 1.20;
    },
  },
  {
    id: 'boiling_blood',
    icon: '🩸',
    color: '#dc2626',
    i18nName: 'ui.curse.boiling_blood.name',
    i18nFlavor: 'ui.curse.boiling_blood.flavor',
    i18nEffect: 'ui.curse.boiling_blood.effect',
    apply: (state) => {
      state.difficultyModifier.damageMult *= 1.25;
    },
  },
  {
    id: 'bloody_harvest',
    icon: '🌾',
    color: '#b91c1c',
    i18nName: 'ui.curse.bloody_harvest.name',
    i18nFlavor: 'ui.curse.bloody_harvest.flavor',
    i18nEffect: 'ui.curse.bloody_harvest.effect',
    apply: (state) => {
      state.difficultyModifier.hpMult *= 1.25;
    },
  },
];

export const CURSE_BY_ID: Record<CurseId, CurseDef> =
  Object.fromEntries(CURSES.map((c) => [c.id, c])) as Record<CurseId, CurseDef>;

/** How many blessings to offer (the player picks 1). 3 in Epic and Ancient,
 *  0 in Normal/Endless/Daily. */
export function blessingChoiceCount(mode: DifficultyMode): number {
  return (mode === 'epic' || mode === 'ancient') ? 3 : 0;
}

/** How many curses to offer (the player picks 1, mandatory). 3 in Ancient
 *  only. Epic/Normal/Endless/Daily get no curses. */
export function curseChoiceCount(mode: DifficultyMode): number {
  return mode === 'ancient' ? 3 : 0;
}
