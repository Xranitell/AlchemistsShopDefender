import { t } from '../i18n';

// Difficulty / dungeon mode definitions.
//
// The game can be started in one of four modes. Each mode has its own stat
// multipliers that are applied to every spawned enemy, and may also attach
// extra abilities that change how enemies behave at runtime. These are kept
// in data (not scattered through the code) so the preview popup, the
// difficulty selector, and the wave logic all read from the same source.

export type DifficultyMode = 'normal' | 'epic' | 'ancient' | 'endless' | 'daily';

export type EnemyAbility =
  // Slimes split into a smaller version on death.
  | 'split_on_death'
  // Golems gain a one-hit shield that absorbs the first potion landing on them.
  | 'one_hit_shield'
  // Rats leap back a bit when they take a hit so they are harder to chain.
  | 'dash_back_on_hit'
  // Flying flasks explode on death in a short radius.
  | 'explode_on_death'
  // Shamans heal nearby enemies on a timer.
  | 'aura_heal'
  // Rats sprint in a periodic zig-zag — alternating left / right
  // perpendicular dashes — so chain-volley towers can't pre-fire a
  // straight line through them.
  | 'zigzag_dash'
  // Sappers latch onto the closest tower if they reach point-blank
  // range and EMP-disable it for several seconds before exploding,
  // applied on Эпический+ to make sapper waves a tower-protection
  // problem rather than just a manequin-damage one.
  | 'disable_tower_on_contact'
  // Golems release a stun pulse on death that briefly silences nearby
  // towers, applied on Эпический+ so killing the front-liner has a
  // real cost beyond losing a damage soak.
  | 'stun_towers_on_death';

export interface DifficultyModifier {
  hpMult: number;
  speedMult: number;
  damageMult: number;
  goldMult: number;
  abilities: EnemyAbility[];
}

export interface DifficultyModeDef {
  id: DifficultyMode;
  name: string;
  shortName: string;
  flavor: string;
  /** Key resource that must be spent to start the mode. */
  keyCost: 'none' | 'epic' | 'ancient';
  modifier: DifficultyModifier;
  /** Human-readable bullet points for the pre-run preview. */
  previewLines: string[];
  /** Colour used for the ribbon / border in UI so the mode is recognizable. */
  color: string;
}

/** Master list of every enemy ability flag the wave system understands.
 *  Each enemy kind only picks up the ones that make sense for it (see
 *  `pickEnemyAbilities` in `wave.ts`), so handing out the full set on
 *  every difficulty mode is what gives every monster its baseline
 *  signature ability — slimes split, golems shield, rats dash, flying
 *  flasks explode, shamans heal — at no extra cost. The Epic / Ancient
 *  modes layer extra scaling on top via `abilityTier` (see
 *  `Enemy.abilityTier`), not by adding new flags here. */
export const ALL_ENEMY_ABILITIES: EnemyAbility[] = [
  'split_on_death',
  'one_hit_shield',
  'dash_back_on_hit',
  'explode_on_death',
  'aura_heal',
  // Rats zig-zag on every difficulty — it's their signature behaviour
  // so even Обычный players see the new movement pattern.
  'zigzag_dash',
];

/** Abilities that only attach when the enemy is spawned in
 *  Эпический or Древний. They stack on top of the kind's base ability
 *  rather than replacing it: an Эпический rat keeps the on-hit
 *  back-dash AND now also zig-zags, an Эпический sapper keeps the
 *  detonation fuse AND now also disables towers it touches, etc. */
export const EPIC_ONLY_ENEMY_ABILITIES: EnemyAbility[] = [
  'disable_tower_on_contact',
  'stun_towers_on_death',
];

export const DIFFICULTY_MODES: Record<DifficultyMode, DifficultyModeDef> = {
  normal: {
    id: 'normal',
    name: 'Обычное подземелье',
    shortName: 'Обычный',
    flavor: 'Стандартные волны и базовые награды. У каждого монстра — своя способность.',
    keyCost: 'none',
    modifier: {
      hpMult: 1,
      speedMult: 1,
      damageMult: 1,
      goldMult: 1,
      abilities: [...ALL_ENEMY_ABILITIES],
    },
    previewLines: [
      'Стандартные характеристики врагов',
      'Базовые способности у каждого вида монстров',
      'Не требует ключа',
    ],
    color: '#7fc97f',
  },
  epic: {
    id: 'epic',
    name: 'Эпическое подземелье',
    shortName: 'Эпический',
    flavor: 'Враги крепче и опаснее; их способности усилены.',
    keyCost: 'epic',
    modifier: {
      hpMult: 1.3,
      speedMult: 1.15,
      damageMult: 1.15,
      goldMult: 1.5,
      abilities: [...ALL_ENEMY_ABILITIES],
    },
    previewLines: [
      '+30% к здоровью врагов',
      '+15% к скорости и урону врагов',
      'Усиленные способности монстров',
      '×1.5 синей эссенции, ×2 древней',
      'Победа: +1 эпич. мастерство (+2% эссенции навсегда)',
    ],
    color: '#c084fc',
  },
  ancient: {
    id: 'ancient',
    name: 'Древнее подземелье',
    shortName: 'Древний',
    flavor: 'Закалённые враги: способности раскрываются полностью.',
    keyCost: 'ancient',
    modifier: {
      hpMult: 1.6,
      speedMult: 1.25,
      damageMult: 1.3,
      goldMult: 2,
      abilities: [...ALL_ENEMY_ABILITIES],
    },
    previewLines: [
      '+60% к здоровью врагов',
      '+25% к скорости, +30% к урону врагов',
      'Древние версии способностей монстров',
      '×2.5 синей эссенции, ×4 древней, +1 древн. ключ за победу',
      'Победа: +1 древн. мастерство (+3% эссенции навсегда)',
    ],
    color: '#ffd166',
  },
  endless: {
    id: 'endless',
    name: 'Бесконечный режим',
    shortName: 'Бесконечный',
    flavor: 'Волны повторяются по кругу, а сложность постепенно растёт.',
    keyCost: 'none',
    modifier: {
      hpMult: 1,
      speedMult: 1,
      damageMult: 1,
      goldMult: 1.2,
      abilities: [...ALL_ENEMY_ABILITIES],
    },
    previewLines: [
      'Волны повторяются по кругу',
      'Сложность растёт с каждой волной',
      'Не требует ключа',
    ],
    color: '#8ecae6',
  },
  daily: {
    id: 'daily',
    name: 'Дневной эксперимент',
    shortName: 'Дневной',
    flavor: 'Фиксированный seed дня: у всех игроков одинаковый забег.',
    keyCost: 'none',
    modifier: {
      hpMult: 1,
      speedMult: 1,
      damageMult: 1,
      goldMult: 1,
      abilities: [...ALL_ENEMY_ABILITIES],
    },
    previewLines: [
      'Уникальное событие каждого дня недели',
      'Бесконечные волны, общий лидерборд за день',
      'Сбрасывается в 00:00 МСК',
    ],
    color: '#f9c74f',
  },
};

/** Map a difficulty mode to the ability-strength tier that should be
 *  applied to each enemy spawned in that mode. `base` keeps the default
 *  mechanics, `epic` amplifies them (e.g. larger splash, more children),
 *  and `ancient` adds an extra layer of behaviour on top (e.g. minis
 *  split once more, exploding flasks leave a poison pool). */
export function abilityTierFor(mode: DifficultyMode): 'base' | 'epic' | 'ancient' {
  if (mode === 'epic') return 'epic';
  if (mode === 'ancient') return 'ancient';
  return 'base';
}

export function abilityLabel(ability: EnemyAbility): string {
  return t(`ui.ability.${ability}`);
}
