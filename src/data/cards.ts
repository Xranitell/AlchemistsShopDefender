import type { CardDef } from '../game/types';
import { tWithFallback } from '../i18n';

/** Localised display name for a card. Falls back to the source-of-truth
 *  Russian string in `CARDS` if the active locale doesn't translate it. */
export function cardName(card: CardDef): string {
  return tWithFallback(`cards.${card.id}.name`, card.name);
}

/** Localised description for a card (effects shown below the title). */
export function cardDesc(card: CardDef): string {
  return tWithFallback(`cards.${card.id}.desc`, card.desc);
}

export const CARDS: CardDef[] = [
  // --- Recipes (potions) ---
  {
    id: 'heavy_brew',
    name: 'Тяжёлый состав',
    category: 'recipe',
    rarity: 'common',
    desc: '+25% урона склянок.',
  },
  {
    id: 'wide_splash',
    name: 'Широкий всплеск',
    category: 'recipe',
    rarity: 'common',
    desc: '+20% радиус взрыва склянок.',
  },
  {
    id: 'quick_hands',
    name: 'Алхимический хват',
    category: 'recipe',
    rarity: 'common',
    desc: '−15% откат склянок.',
  },
  {
    id: 'flammable_mix',
    name: 'Горючая смесь',
    category: 'recipe',
    rarity: 'rare',
    desc: 'Склянки оставляют горящую лужу (8 урона/сек, 3 сек).',
  },
  {
    id: 'unstable_flask',
    name: 'Нестабильная колба',
    category: 'recipe',
    rarity: 'epic',
    desc: '50% шанс вторичного микровзрыва после броска (+50% урона повторно).',
  },

  // --- Engineering (towers) ---
  {
    id: 'oiled_gears',
    name: 'Смазанные механизмы',
    category: 'engineering',
    rarity: 'common',
    desc: '+15% скорость атаки стоек.',
  },
  {
    id: 'wider_lenses',
    name: 'Расширенные линзы',
    category: 'engineering',
    rarity: 'common',
    desc: '+12% радиус и +10% урона стоек.',
  },
  {
    id: 'crossfire',
    name: 'Перекрёстный огонь',
    category: 'engineering',
    rarity: 'rare',
    desc: 'Стойки наносят +30% урона горящим врагам.',
  },
  {
    id: 'mercury_coating',
    name: 'Ртутное покрытие',
    category: 'engineering',
    rarity: 'rare',
    desc: 'Все стойки получают +20% замедления целей.',
  },
  {
    id: 'acid_tips',
    name: 'Кислотные наконечники',
    category: 'engineering',
    rarity: 'rare',
    desc: 'Стойки снимают 15% брони при попадании.',
  },
  {
    id: 'synchronized_volley',
    name: 'Синхронный залп',
    category: 'engineering',
    rarity: 'rare',
    desc: 'Каждая 4-я атака стойки стреляет дважды.',
  },

  // --- Rituals / Mannequin ---
  {
    id: 'reinforced_frame',
    name: 'Укреплённый каркас',
    category: 'ritual',
    rarity: 'common',
    desc: '+25 максимального HP Манекена и +25 текущего HP.',
  },
  {
    id: 'chronos',
    name: 'Хронос',
    category: 'ritual',
    rarity: 'epic',
    desc: 'Overload: замедляет всех врагов на 5 сек (заменяет Громоотвод).',
  },
  {
    id: 'thorny_shell',
    name: 'Шипастая оболочка',
    category: 'ritual',
    rarity: 'rare',
    desc: 'Враги получают 8 урона при касании Манекена.',
  },
  {
    id: 'gold_rush',
    name: 'Золотая лихорадка',
    category: 'ritual',
    rarity: 'common',
    desc: '+30% золота с врагов.',
  },

  // --- Catalysts ---
  {
    id: 'fire_ruby',
    name: 'Малый огненный камень',
    category: 'catalyst',
    rarity: 'common',
    desc: 'Каждая 5-я склянка поджигает врагов.',
  },
  {
    id: 'mercury_ring',
    name: 'Ртутный обруч',
    category: 'catalyst',
    rarity: 'rare',
    desc: 'Враги рядом с Манекеном замедляются на 40%.',
  },
  {
    id: 'acid_prism',
    name: 'Кислотная призма',
    category: 'catalyst',
    rarity: 'rare',
    desc: 'Стихийные реакции наносят +25% урона.',
  },
  {
    id: 'aether_engine',
    name: 'Эфирный двигатель',
    category: 'catalyst',
    rarity: 'epic',
    desc: 'Каждая стихийная реакция заряжает +15 Overload.',
  },

  // --- New elemental brews ---
  {
    id: 'frost_brew',
    name: 'Морозная склянка',
    category: 'recipe',
    rarity: 'rare',
    desc: 'Базовая склянка получает стихию Мороза (сильное замедление, метка холода).',
  },
  {
    id: 'acid_brew',
    name: 'Кислотная склянка',
    category: 'recipe',
    rarity: 'rare',
    desc: 'Базовая склянка получает стихию Кислоты (–50% брони на 4 сек).',
  },
  {
    id: 'mercury_brew',
    name: 'Ртутная склянка',
    category: 'recipe',
    rarity: 'rare',
    desc: 'Базовая склянка получает стихию Ртути (сильное замедление 2.5 сек).',
  },
  {
    id: 'aether_brew',
    name: 'Эфирная склянка',
    category: 'recipe',
    rarity: 'epic',
    desc: 'Базовая склянка получает стихию Эфира (метка эфира, открывает реакции).',
  },
  {
    id: 'mutagen_brew',
    name: 'Мутагенная склянка',
    category: 'recipe',
    rarity: 'epic',
    desc: 'Базовая склянка отравляет врагов: 4 урона/сек 5 сек, игнорирует броню.',
  },

  // --- High-tier cards (GDD §8.2) ---
  {
    id: 'triple_throw',
    name: 'Тройной бросок',
    category: 'recipe',
    rarity: 'rare',
    desc: 'Раз в 8 сек Манекен дополнительно бросает 3 склянки веером.',
  },
  {
    id: 'salamander',
    name: 'Великий рецепт Саламандры',
    category: 'recipe',
    rarity: 'legendary',
    desc: 'Все склянки становятся огненными и оставляют лужу, но откат склянок +20%.',
  },
  {
    id: 'archmaster',
    name: 'Башенный чертёж Архимастера',
    category: 'engineering',
    rarity: 'legendary',
    desc: 'Все новые стойки появляются 2-го уровня, но стоят на 25% дороже.',
  },
  {
    id: 'golem_heart',
    name: 'Сердце Голема',
    category: 'ritual',
    rarity: 'legendary',
    desc: 'При смертельном уроне Манекен остаётся с 1 HP и получает щит на 6 сек. Раз за забег.',
  },
  {
    id: 'crown_of_elements',
    name: 'Корона четырёх элементов',
    category: 'catalyst',
    rarity: 'legendary',
    desc: 'Все стихийные реакции наносят +50% урона и заряжают +10 Overload. +1 слот катализатора.',
  },
];

/**
 * Static synergy graph used by the card draft UI to surface "this combos with
 * a card you already took". Pairs are bidirectional — if A→[B] is listed, the
 * UI also lights up A when B is the new card. Keep entries small (≤ 3 partners
 * per card) so the hint stays readable.
 */
export const CARD_SYNERGIES: Record<string, string[]> = {
  // Fire family
  flammable_mix: ['acid_brew', 'aether_brew', 'crossfire', 'fire_ruby', 'salamander'],
  fire_ruby: ['flammable_mix', 'crossfire', 'salamander'],
  salamander: ['flammable_mix', 'fire_ruby', 'crossfire'],
  crossfire: ['flammable_mix', 'fire_ruby', 'salamander'],
  // Acid + reactions
  acid_brew: ['flammable_mix', 'frost_brew', 'mutagen_brew', 'acid_prism', 'acid_tips'],
  acid_prism: ['acid_brew', 'aether_engine', 'crown_of_elements'],
  acid_tips: ['acid_brew', 'mercury_coating'],
  mutagen_brew: ['acid_brew', 'acid_prism'],
  // Frost / Mercury
  frost_brew: ['acid_brew', 'mercury_brew', 'flammable_mix'],
  mercury_brew: ['aether_brew', 'frost_brew', 'mercury_ring', 'mercury_coating'],
  mercury_ring: ['mercury_brew', 'mercury_coating'],
  mercury_coating: ['mercury_brew', 'mercury_ring', 'acid_tips'],
  // Aether
  aether_brew: ['flammable_mix', 'mercury_brew', 'aether_engine', 'crown_of_elements'],
  aether_engine: ['aether_brew', 'acid_prism', 'crown_of_elements'],
  // Engineering
  oiled_gears: ['wider_lenses', 'synchronized_volley', 'archmaster'],
  wider_lenses: ['oiled_gears', 'synchronized_volley', 'archmaster'],
  synchronized_volley: ['oiled_gears', 'wider_lenses', 'crossfire'],
  archmaster: ['oiled_gears', 'wider_lenses', 'synchronized_volley'],
  // Survival
  reinforced_frame: ['thorny_shell', 'golem_heart'],
  thorny_shell: ['reinforced_frame', 'golem_heart'],
  golem_heart: ['reinforced_frame', 'thorny_shell'],
  // Crown / catalysts
  crown_of_elements: ['acid_prism', 'aether_engine', 'fire_ruby', 'mercury_ring'],
  // Potion utility
  heavy_brew: ['wide_splash', 'unstable_flask', 'triple_throw'],
  wide_splash: ['heavy_brew', 'unstable_flask', 'triple_throw'],
  unstable_flask: ['heavy_brew', 'wide_splash'],
  quick_hands: ['triple_throw', 'unstable_flask'],
  triple_throw: ['heavy_brew', 'wide_splash', 'quick_hands'],
};

/** Look up the names of synergy partners that the player has already picked. */
export function pickedSynergyNames(cardId: string, pickedIds: readonly string[]): string[] {
  const partners = CARD_SYNERGIES[cardId];
  if (!partners || partners.length === 0) return [];
  const taken = new Set(pickedIds);
  const names: string[] = [];
  for (const id of partners) {
    if (!taken.has(id)) continue;
    const def = CARDS.find((c) => c.id === id);
    if (def) names.push(cardName(def));
  }
  return names;
}
