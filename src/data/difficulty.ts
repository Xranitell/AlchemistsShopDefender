import { t } from '../i18n';

// Difficulty / dungeon mode definitions.
//
// The game can be started in one of four modes. Each mode has its own stat
// multipliers that are applied to every spawned enemy, and may also attach
// extra abilities that change how enemies behave at runtime. These are kept
// in data (not scattered through the code) so the preview popup, the
// difficulty selector, and the wave logic all read from the same source.

export type DifficultyMode = 'normal' | 'epic' | 'ancient' | 'endless' | 'daily' | 'boss_challenge';

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
  | 'aura_heal';

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

export const DIFFICULTY_MODES: Record<DifficultyMode, DifficultyModeDef> = {
  normal: {
    id: 'normal',
    name: 'Обычное подземелье',
    shortName: 'Обычный',
    flavor: 'Стандартные волны. Награды — обычные.',
    keyCost: 'none',
    modifier: {
      hpMult: 1,
      speedMult: 1,
      damageMult: 1,
      goldMult: 1,
      abilities: [],
    },
    previewLines: ['Стандартные враги и скорость', 'Не требует ключа'],
    color: '#7fc97f',
  },
  epic: {
    id: 'epic',
    name: 'Эпическое подземелье',
    shortName: 'Эпический',
    flavor: 'Враги крепче, у слизней — раздел при смерти.',
    keyCost: 'epic',
    modifier: {
      hpMult: 1.3,
      speedMult: 1.15,
      damageMult: 1.15,
      goldMult: 1.5,
      abilities: ['split_on_death', 'dash_back_on_hit'],
    },
    previewLines: [
      '+30% здоровья врагов',
      '+15% скорости и урона',
      'Слизни распадаются на осколки',
      'Крысы отскакивают при попадании',
      'Золота больше на 50%',
    ],
    color: '#c084fc',
  },
  ancient: {
    id: 'ancient',
    name: 'Древнее подземелье',
    shortName: 'Древний',
    flavor: 'Закалённые враги, броня, ауры — только для опытных.',
    keyCost: 'ancient',
    modifier: {
      hpMult: 1.6,
      speedMult: 1.25,
      damageMult: 1.3,
      goldMult: 2,
      abilities: ['split_on_death', 'one_hit_shield', 'dash_back_on_hit', 'explode_on_death'],
    },
    previewLines: [
      '+60% здоровья врагов',
      '+25% скорости, +30% урона',
      'Големы с бронёй, блокирующей первое попадание',
      'Слизни распадаются, крысы отскакивают',
      'Колбы-враги взрываются при смерти',
      'Золота в 2 раза больше',
    ],
    color: '#ffd166',
  },
  endless: {
    id: 'endless',
    name: 'Бесконечный режим',
    shortName: 'Бесконечный',
    flavor: 'Волны идут по кругу с нарастающей сложностью.',
    keyCost: 'none',
    modifier: {
      hpMult: 1,
      speedMult: 1,
      damageMult: 1,
      goldMult: 1.2,
      abilities: [],
    },
    previewLines: [
      'Волны повторяются по кругу',
      'Сложность растёт линейно с каждой волной',
      'Не требует ключа',
    ],
    color: '#8ecae6',
  },
  daily: {
    id: 'daily',
    name: 'Дневной эксперимент',
    shortName: 'Дневной',
    flavor: 'Фиксированный seed дня — у всех одинаковый забег.',
    keyCost: 'none',
    modifier: {
      hpMult: 1,
      speedMult: 1,
      damageMult: 1,
      goldMult: 1,
      abilities: [],
    },
    previewLines: [
      'Seed забега одинаковый для всех игроков',
      'Детерминированные карты и волны',
      'Свой лидерборд каждый день',
    ],
    color: '#f9c74f',
  },
  boss_challenge: {
    id: 'boss_challenge',
    name: 'Испытание боссов',
    shortName: 'Боссы',
    flavor: 'Только боссовые волны — покажи свой навык!',
    keyCost: 'none',
    modifier: {
      hpMult: 1.2,
      speedMult: 1.1,
      damageMult: 1.1,
      goldMult: 1.5,
      abilities: [],
    },
    previewLines: [
      'Только волны 5, 10, 15 + финальный босс',
      '+20% здоровья, +10% скорости врагов',
      'Золота на 50% больше',
      'Свой лидерборд',
    ],
    color: '#ef476f',
  },
};

export function abilityLabel(ability: EnemyAbility): string {
  return t(`ui.ability.${ability}`);
}
