// ── Run Mutators (Закон Подземелья) ────────────────────────────────────
//
// A small pool of run-wide modifiers ("dungeon laws") that are rolled at
// run start for Epic (1 mutator) and Ancient (2 mutators). Each mutator is
// a clean trade-off — a buff paired with a drawback — designed to nudge
// the player into a different build for that run without overwhelming
// existing difficulty multipliers.
//
// The system reuses the same modifier knobs already exposed by the engine
// (`state.modifiers`, `state.difficultyModifier`, `state.metaOverloadRateMult`)
// rather than introducing a new per-mutator effect pipeline. This keeps
// the patch surface tiny and means every mutator is "free" in terms of
// runtime cost — they are applied once at run start.

import type { GameState } from '../game/state';

export type MutatorId =
  | 'fog'
  | 'fragile_flasks'
  | 'steady_aim'
  | 'mana_rhythm'
  | 'arcane_storm'
  | 'greedy_walls'
  | 'iron_skin'
  | 'swift_throws';

export interface MutatorDef {
  id: MutatorId;
  /** Emoji / glyph used as the mutator icon in the HUD ribbon. */
  icon: string;
  /** Accent colour for ribbon / border. */
  color: string;
  /** i18n key for the human-readable name. */
  i18nName: string;
  /** i18n key for a one-line tagline. */
  i18nFlavor: string;
  /** i18n keys for the bullet-list of effects (buff line then drawback). */
  i18nLines: string[];
  /** Applied once at run start, after meta upgrades, biome modifiers and
   *  daily-event modifiers (when applicable). Mutates `state` directly. */
  apply: (state: GameState) => void;
}

export const MUTATORS: MutatorDef[] = [
  {
    id: 'fog',
    icon: '☁️',
    color: '#9ca3af',
    i18nName: 'ui.mutator.fog.name',
    i18nFlavor: 'ui.mutator.fog.flavor',
    i18nLines: [
      'ui.mutator.fog.line.range',
      'ui.mutator.fog.line.gold',
    ],
    apply: (state) => {
      // Towers see less of the arena, but enemies drop more gold.
      state.modifiers.towerRangeMult *= 0.75;
      state.difficultyModifier.goldMult *= 1.30;
    },
  },
  {
    id: 'fragile_flasks',
    icon: '🧪',
    color: '#7df9ff',
    i18nName: 'ui.mutator.fragile_flasks.name',
    i18nFlavor: 'ui.mutator.fragile_flasks.flavor',
    i18nLines: [
      'ui.mutator.fragile_flasks.line.dmg',
      'ui.mutator.fragile_flasks.line.radius',
    ],
    apply: (state) => {
      // Big damage spikes, but tighter splash — punishes sloppy aim.
      state.modifiers.potionDamageMult *= 1.30;
      state.modifiers.potionRadiusMult *= 0.75;
    },
  },
  {
    id: 'steady_aim',
    icon: '🎯',
    color: '#ffd166',
    i18nName: 'ui.mutator.steady_aim.name',
    i18nFlavor: 'ui.mutator.steady_aim.flavor',
    i18nLines: [
      'ui.mutator.steady_aim.line.dmg',
      'ui.mutator.steady_aim.line.rate',
    ],
    apply: (state) => {
      // Heavier shots, slower trigger — favours single-target towers.
      state.modifiers.towerDamageMult *= 1.40;
      state.modifiers.towerFireRateMult *= 0.75;
    },
  },
  {
    id: 'mana_rhythm',
    icon: '⚡',
    color: '#8ecae6',
    i18nName: 'ui.mutator.mana_rhythm.name',
    i18nFlavor: 'ui.mutator.mana_rhythm.flavor',
    i18nLines: [
      'ui.mutator.mana_rhythm.line.overload',
      'ui.mutator.mana_rhythm.line.hp',
    ],
    apply: (state) => {
      // Overload comes back faster; in exchange, enemies are tankier.
      state.metaOverloadRateMult *= 1.75;
      state.difficultyModifier.hpMult *= 1.20;
    },
  },
  {
    id: 'arcane_storm',
    icon: '🌀',
    color: '#c084fc',
    i18nName: 'ui.mutator.arcane_storm.name',
    i18nFlavor: 'ui.mutator.arcane_storm.flavor',
    i18nLines: [
      'ui.mutator.arcane_storm.line.reactions',
      'ui.mutator.arcane_storm.line.speed',
    ],
    apply: (state) => {
      // Reactions hit harder, enemies move faster — encourages combo plays.
      state.modifiers.reactionDamageMult *= 1.60;
      state.difficultyModifier.speedMult *= 1.15;
    },
  },
  {
    id: 'greedy_walls',
    icon: '💰',
    color: '#f9c74f',
    i18nName: 'ui.mutator.greedy_walls.name',
    i18nFlavor: 'ui.mutator.greedy_walls.flavor',
    i18nLines: [
      'ui.mutator.greedy_walls.line.gold',
      'ui.mutator.greedy_walls.line.hp',
    ],
    apply: (state) => {
      // More gold per kill, but enemies have more HP — survivor's purse.
      state.difficultyModifier.goldMult *= 1.50;
      state.difficultyModifier.hpMult *= 1.25;
    },
  },
  {
    id: 'iron_skin',
    icon: '🛡',
    color: '#a8a29e',
    i18nName: 'ui.mutator.iron_skin.name',
    i18nFlavor: 'ui.mutator.iron_skin.flavor',
    i18nLines: [
      'ui.mutator.iron_skin.line.armor',
      'ui.mutator.iron_skin.line.dmg',
    ],
    apply: (state) => {
      // Enemies are armoured but hit softer — damage management run.
      state.modifiers.enemyArmorAdd += 0.20;
      state.difficultyModifier.damageMult *= 0.75;
    },
  },
  {
    id: 'swift_throws',
    icon: '💨',
    color: '#06d6a0',
    i18nName: 'ui.mutator.swift_throws.name',
    i18nFlavor: 'ui.mutator.swift_throws.flavor',
    i18nLines: [
      'ui.mutator.swift_throws.line.cd',
      'ui.mutator.swift_throws.line.dmg',
    ],
    apply: (state) => {
      // Faster potions, weaker per-throw — rewards spammy, accurate play.
      state.modifiers.potionCooldownMult *= 0.75;
      state.modifiers.potionDamageMult *= 0.80;
    },
  },
];

export const MUTATOR_BY_ID: Record<MutatorId, MutatorDef> = MUTATORS.reduce(
  (acc, def) => {
    acc[def.id] = def;
    return acc;
  },
  {} as Record<MutatorId, MutatorDef>,
);

/** Number of mutators rolled for the given difficulty. Normal/Endless/Daily
 *  do NOT receive mutators — they have their own modifier systems. */
export function mutatorCountForDifficulty(mode: string): number {
  if (mode === 'epic') return 1;
  if (mode === 'ancient') return 2;
  return 0;
}
