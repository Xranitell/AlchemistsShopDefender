import type { EffectPolarity } from '../game/types';
import type { GameState } from '../game/state';
import { tWithFallback } from '../i18n';

/** A small extra effect that gets rolled onto a cursed card at draft time
 *  to push the bullet count up to 4-5 and randomise the pos/neg ratio.
 *
 *  Magnitudes are intentionally smaller than the base cursed-card stat
 *  bumps (10-20 % typical) — the extras are flavour swing, not the main
 *  reward. */
export interface CursedExtraEffect {
  id: string;
  polarity: EffectPolarity;
  /** Russian label, used as fallback when no translation key matches. */
  label: string;
  /** Mutates `state` to apply this extra alongside the card's static
   *  `curse_*` arm in `applyCard`. */
  apply: (state: GameState) => void;
}

const ALL: CursedExtraEffect[] = [
  // ── Positive: damage / range / cooldown / sustain ─────────────────────
  {
    id: 'extra_pdmg_10',
    polarity: 'pos',
    label: '+5% урона склянок',
    apply: (s) => { s.modifiers.potionDamageMult *= 1.05; },
  },
  {
    id: 'extra_tdmg_10',
    polarity: 'pos',
    label: '+5% урона стоек',
    apply: (s) => { s.modifiers.towerDamageMult *= 1.05; },
  },
  {
    id: 'extra_pcd_-10',
    polarity: 'pos',
    label: '−5% откат склянок',
    apply: (s) => { s.modifiers.potionCooldownMult *= 0.95; },
  },
  {
    id: 'extra_trng_10',
    polarity: 'pos',
    label: '+5% радиус стоек',
    apply: (s) => { s.modifiers.towerRangeMult *= 1.05; },
  },
  {
    id: 'extra_tfr_10',
    polarity: 'pos',
    label: '+5% скорость атаки стоек',
    apply: (s) => { s.modifiers.towerFireRateMult *= 1.05; },
  },
  {
    id: 'extra_prad_10',
    polarity: 'pos',
    label: '+5% радиус склянок',
    apply: (s) => { s.modifiers.potionRadiusMult *= 1.05; },
  },
  {
    id: 'extra_hp_15',
    polarity: 'pos',
    label: '+8 макс. ХП Манекена',
    apply: (s) => {
      s.mannequin.maxHp += 8;
      s.mannequin.hp = Math.min(s.mannequin.maxHp, s.mannequin.hp + 8);
    },
  },
  {
    id: 'extra_gold_10',
    polarity: 'pos',
    label: '+5% золота',
    apply: (s) => { s.modifiers.goldDropMult *= 1.05; },
  },

  // ── Negative: enemy buffs / player penalties ──────────────────────────
  // Magnitudes are deliberately a tier above the positive extras (≈15-20 %)
  // so cursed drafts feel weighty — the player should hesitate to scoop a
  // 1+/3- card even when the unique effect is tempting.
  {
    id: 'extra_enemy_hp_15',
    polarity: 'neg',
    label: '+15% ХП врагов',
    apply: (s) => { s.difficultyModifier.hpMult *= 1.15; },
  },
  {
    id: 'extra_enemy_speed_12',
    polarity: 'neg',
    label: '+12% скорость врагов',
    apply: (s) => { s.difficultyModifier.speedMult *= 1.12; },
  },
  {
    id: 'extra_gold_-15',
    polarity: 'neg',
    label: '−15% золота',
    apply: (s) => { s.modifiers.goldDropMult *= 0.85; },
  },
  {
    id: 'extra_pcd_15',
    polarity: 'neg',
    label: '+15% откат склянок',
    apply: (s) => { s.modifiers.potionCooldownMult *= 1.15; },
  },
  {
    id: 'extra_tcost_15',
    polarity: 'neg',
    label: '+15% стоимость стоек',
    apply: (s) => { s.modifiers.towerCostMult *= 1.15; },
  },
  {
    id: 'extra_hp_-25',
    polarity: 'neg',
    label: '−25 макс. ХП Манекена',
    apply: (s) => {
      s.mannequin.maxHp = Math.max(50, s.mannequin.maxHp - 25);
      s.mannequin.hp = Math.min(s.mannequin.maxHp, s.mannequin.hp);
    },
  },
  {
    id: 'extra_pdmg_-15',
    polarity: 'neg',
    label: '−15% урон склянок',
    apply: (s) => { s.modifiers.potionDamageMult *= 0.85; },
  },
  {
    id: 'extra_tdmg_-15',
    polarity: 'neg',
    label: '−15% урон стоек',
    apply: (s) => { s.modifiers.towerDamageMult *= 0.85; },
  },

  // ── Negative: unique enemy mechanics (mechanical, not just stat-mults) ─
  // These are the marquee drawbacks — they change how combat plays, not
  // just the numbers. Stacks additively when the same id is rolled across
  // multiple drafts; per-effect caps live where each modifier is consumed.
  {
    id: 'extra_enemy_dodge_15',
    polarity: 'neg',
    label: '+15% шанс уворота врагов',
    apply: (s) => { s.modifiers.enemyDodgeChance += 0.15; },
  },
  {
    id: 'extra_enemy_shield_20',
    polarity: 'neg',
    label: '+щит врагов 20% от ХП',
    apply: (s) => { s.modifiers.enemyExtraShieldFraction += 0.20; },
  },
  {
    id: 'extra_enemy_regen_3',
    polarity: 'neg',
    label: '+регенерация врагов 3 ХП/с',
    apply: (s) => { s.modifiers.enemyRegenPerSec += 3; },
  },
  {
    id: 'extra_enemy_armor_10',
    polarity: 'neg',
    label: '+10% брони врагов',
    apply: (s) => { s.modifiers.enemyArmorAdd += 0.10; },
  },
];

const BY_ID: Record<string, CursedExtraEffect> = Object.fromEntries(
  ALL.map((e) => [e.id, e]),
);

export function getCursedExtra(id: string): CursedExtraEffect | undefined {
  return BY_ID[id];
}

export function cursedExtraPool(polarity: EffectPolarity): CursedExtraEffect[] {
  return ALL.filter((e) => e.polarity === polarity);
}

/** Localised label for an extra effect — falls back to the source Russian
 *  string in `ALL` when no translation is registered. */
export function cursedExtraLabel(id: string): string {
  const def = BY_ID[id];
  if (!def) return '';
  return tWithFallback(`cardExtras.${id}.label`, def.label);
}
