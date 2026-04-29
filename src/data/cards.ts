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

// ─────────────────────────────────────────────────────────────────────────────
// CARD POOL OVERVIEW
//
// The draft is split into two distinct pools:
//
//  • Normal cards  — ONLY raw stat bonuses. Magnitudes are pinned to the
//    rarity (common < rare < epic < legendary). No unique effects, no
//    drawbacks. Offered on regular waves.
//
//  • Cursed cards  — combine a unique effect (e.g. "потионы становятся
//    эфирными") with one or two epic-tier stat bonuses AND a debuff that
//    weakens the player or buffs enemies. Offered on every 3rd wave
//    (wave 3, 6, 9, …).
//
// `applyCard` in `src/game/cards.ts` dispatches on `card.id` to apply each
// card's effects, including the cursed drawbacks.
// ─────────────────────────────────────────────────────────────────────────────

// — NORMAL CARDS — pure stat bumps, magnitudes scaled by rarity ─────────────

const NORMAL_CARDS: CardDef[] = [
  // Potion damage
  { id: 'pdmg_c', name: 'Тяжёлый состав I', category: 'recipe', rarity: 'common',
    desc: '+15% урона склянок.' },
  { id: 'pdmg_r', name: 'Тяжёлый состав II', category: 'recipe', rarity: 'rare',
    desc: '+30% урона склянок.' },
  { id: 'pdmg_e', name: 'Тяжёлый состав III', category: 'recipe', rarity: 'epic',
    desc: '+50% урона склянок.' },
  { id: 'pdmg_l', name: 'Тяжёлый состав IV', category: 'recipe', rarity: 'legendary',
    desc: '+80% урона склянок.' },

  // Potion radius
  { id: 'prad_c', name: 'Широкий всплеск I', category: 'recipe', rarity: 'common',
    desc: '+15% радиус взрыва склянок.' },
  { id: 'prad_r', name: 'Широкий всплеск II', category: 'recipe', rarity: 'rare',
    desc: '+25% радиус взрыва склянок.' },
  { id: 'prad_e', name: 'Широкий всплеск III', category: 'recipe', rarity: 'epic',
    desc: '+45% радиус взрыва склянок.' },
  { id: 'prad_l', name: 'Широкий всплеск IV', category: 'recipe', rarity: 'legendary',
    desc: '+70% радиус взрыва склянок.' },

  // Potion cooldown reduction
  { id: 'pcd_c', name: 'Алхимический хват I', category: 'recipe', rarity: 'common',
    desc: '−12% откат склянок.' },
  { id: 'pcd_r', name: 'Алхимический хват II', category: 'recipe', rarity: 'rare',
    desc: '−22% откат склянок.' },
  { id: 'pcd_e', name: 'Алхимический хват III', category: 'recipe', rarity: 'epic',
    desc: '−35% откат склянок.' },
  { id: 'pcd_l', name: 'Алхимический хват IV', category: 'recipe', rarity: 'legendary',
    desc: '−50% откат склянок.' },

  // Tower damage
  { id: 'tdmg_c', name: 'Точная наводка I', category: 'engineering', rarity: 'common',
    desc: '+15% урона стоек.' },
  { id: 'tdmg_r', name: 'Точная наводка II', category: 'engineering', rarity: 'rare',
    desc: '+30% урона стоек.' },
  { id: 'tdmg_e', name: 'Точная наводка III', category: 'engineering', rarity: 'epic',
    desc: '+50% урона стоек.' },
  { id: 'tdmg_l', name: 'Точная наводка IV', category: 'engineering', rarity: 'legendary',
    desc: '+80% урона стоек.' },

  // Tower fire rate
  { id: 'tfr_c', name: 'Смазанные механизмы I', category: 'engineering', rarity: 'common',
    desc: '+12% скорость атаки стоек.' },
  { id: 'tfr_r', name: 'Смазанные механизмы II', category: 'engineering', rarity: 'rare',
    desc: '+22% скорость атаки стоек.' },
  { id: 'tfr_e', name: 'Смазанные механизмы III', category: 'engineering', rarity: 'epic',
    desc: '+40% скорость атаки стоек.' },
  { id: 'tfr_l', name: 'Смазанные механизмы IV', category: 'engineering', rarity: 'legendary',
    desc: '+60% скорость атаки стоек.' },

  // Tower range
  { id: 'trng_c', name: 'Расширенные линзы I', category: 'engineering', rarity: 'common',
    desc: '+10% радиус стоек.' },
  { id: 'trng_r', name: 'Расширенные линзы II', category: 'engineering', rarity: 'rare',
    desc: '+20% радиус стоек.' },
  { id: 'trng_e', name: 'Расширенные линзы III', category: 'engineering', rarity: 'epic',
    desc: '+35% радиус стоек.' },
  { id: 'trng_l', name: 'Расширенные линзы IV', category: 'engineering', rarity: 'legendary',
    desc: '+55% радиус стоек.' },

  // Mannequin HP
  { id: 'hp_c', name: 'Укреплённый каркас I', category: 'ritual', rarity: 'common',
    desc: '+25 макс. HP Манекена и +25 текущего HP.' },
  { id: 'hp_r', name: 'Укреплённый каркас II', category: 'ritual', rarity: 'rare',
    desc: '+50 макс. HP Манекена и +50 текущего HP.' },
  { id: 'hp_e', name: 'Укреплённый каркас III', category: 'ritual', rarity: 'epic',
    desc: '+90 макс. HP Манекена и +90 текущего HP.' },
  { id: 'hp_l', name: 'Укреплённый каркас IV', category: 'ritual', rarity: 'legendary',
    desc: '+150 макс. HP Манекена и +150 текущего HP.' },

  // Gold drop
  { id: 'gold_c', name: 'Золотая лихорадка I', category: 'ritual', rarity: 'common',
    desc: '+15% золота с врагов.' },
  { id: 'gold_r', name: 'Золотая лихорадка II', category: 'ritual', rarity: 'rare',
    desc: '+30% золота с врагов.' },
  { id: 'gold_e', name: 'Золотая лихорадка III', category: 'ritual', rarity: 'epic',
    desc: '+50% золота с врагов.' },
  { id: 'gold_l', name: 'Золотая лихорадка IV', category: 'ritual', rarity: 'legendary',
    desc: '+80% золота с врагов.' },

];

// — CURSED CARDS — unique effect + epic stats + drawback ────────────────────

const CURSED_CARDS: CardDef[] = [
  // Recipes / brews
  {
    id: 'curse_flammable_mix',
    name: 'Договор Пламени',
    category: 'recipe', rarity: 'epic', isCursed: true,
    desc: 'Склянки оставляют горящую лужу (8 урона/сек, 3 сек) · +30% урона склянок · враги +10% HP.',
  },
  {
    id: 'curse_unstable_flask',
    name: 'Нестабильная колба (проклятая)',
    category: 'recipe', rarity: 'epic', isCursed: true,
    desc: '50% шанс вторичного микровзрыва (+50% урона повторно) · +25% радиус склянок · откат склянок +15%.',
  },
  {
    id: 'curse_frost_brew',
    name: 'Морозный обет',
    category: 'recipe', rarity: 'epic', isCursed: true,
    desc: 'Склянки получают стихию Мороза · +30% радиус склянок · враги +10% HP.',
  },
  {
    id: 'curse_acid_brew',
    name: 'Кислотный пакт',
    category: 'recipe', rarity: 'epic', isCursed: true,
    desc: 'Склянки получают стихию Кислоты (−50% брони на 4с) · +30% урона склянок · враги +10% HP.',
  },
  {
    id: 'curse_mercury_brew',
    name: 'Ртутный обет',
    category: 'recipe', rarity: 'epic', isCursed: true,
    desc: 'Склянки получают стихию Ртути · +25% урона и +20% радиус склянок · −20% золота.',
  },
  {
    id: 'curse_aether_brew',
    name: 'Эфирный заговор',
    category: 'recipe', rarity: 'legendary', isCursed: true,
    desc: 'Склянки получают стихию Эфира (открывает реакции) · +40% урона склянок · враги +15% HP.',
  },
  {
    id: 'curse_mutagen_brew',
    name: 'Мутагенное проклятие',
    category: 'recipe', rarity: 'epic', isCursed: true,
    desc: 'Склянки отравляют врагов (4 ур/с 5с, игнорирует броню) · +35% урона склянок · враги +15% HP.',
  },
  {
    id: 'curse_triple_throw',
    name: 'Тройной обет',
    category: 'recipe', rarity: 'epic', isCursed: true,
    desc: 'Раз в 8с Манекен бросает 3 склянки веером · −20% откат склянок · −15% радиус склянок.',
  },

  // Engineering / towers
  {
    id: 'curse_crossfire',
    name: 'Перекрёстный огонь (проклятый)',
    category: 'engineering', rarity: 'epic', isCursed: true,
    desc: 'Стойки наносят +30% урона горящим врагам · +20% урона стоек · враги +10% скорости.',
  },
  {
    id: 'curse_mercury_coating',
    name: 'Ртутное покрытие (проклятое)',
    category: 'engineering', rarity: 'epic', isCursed: true,
    desc: 'Стойки замедляют целей на +20% · +25% скорость атаки стоек · −20 макс. HP Манекена.',
  },
  {
    id: 'curse_acid_tips',
    name: 'Кислотные наконечники (проклятые)',
    category: 'engineering', rarity: 'epic', isCursed: true,
    desc: 'Стойки снимают 15% брони при попадании · +25% урона стоек · стойки стоят на 25% дороже.',
  },
  {
    id: 'curse_synchronized_volley',
    name: 'Синхронный залп (проклятый)',
    category: 'engineering', rarity: 'epic', isCursed: true,
    desc: 'Каждая 4-я атака стойки стреляет дважды · +20% урона стоек · враги +15% HP.',
  },

  // Rituals / Mannequin
  {
    id: 'curse_thorny_shell',
    name: 'Шипастая оболочка (проклятая)',
    category: 'ritual', rarity: 'epic', isCursed: true,
    desc: 'Враги получают 8 урона при касании · +50 макс. HP Манекена · −15% золота.',
  },
  {
    id: 'curse_chronos',
    name: 'Хронос (проклятый)',
    category: 'ritual', rarity: 'epic', isCursed: true,
    desc: 'Overload замедляет всех врагов на 5с (заменяет Громоотвод) · +30% урона склянок · откат склянок +15%.',
  },
  {
    id: 'curse_golem_heart',
    name: 'Сердце Голема (проклятое)',
    category: 'ritual', rarity: 'legendary', isCursed: true,
    desc: 'При смертельном уроне Манекен спасается с 1 HP и щитом 6с (1 раз) · +75 макс. HP · −25% урона склянок.',
  },

  // Catalysts
  {
    id: 'curse_fire_ruby',
    name: 'Малый огненный камень (проклятый)',
    category: 'catalyst', rarity: 'epic', isCursed: true,
    desc: 'Каждая 5-я склянка поджигает врагов · +25% урона склянок · враги +10% скорости.',
  },
  {
    id: 'curse_mercury_ring',
    name: 'Ртутный обруч (проклятый)',
    category: 'catalyst', rarity: 'epic', isCursed: true,
    desc: 'Враги рядом с Манекеном замедляются на 40% · +30% золота · враги +10% HP.',
  },
  {
    id: 'curse_acid_prism',
    name: 'Кислотная призма (проклятая)',
    category: 'catalyst', rarity: 'epic', isCursed: true,
    desc: 'Стихийные реакции наносят +25% урона · +25% урона склянок · −25 макс. HP Манекена.',
  },
  {
    id: 'curse_aether_engine',
    name: 'Эфирный двигатель (проклятый)',
    category: 'catalyst', rarity: 'legendary', isCursed: true,
    desc: 'Каждая стихийная реакция заряжает +15 Overload · +35% урона склянок · откат склянок +15%.',
  },
  {
    id: 'curse_crown_of_elements',
    name: 'Корона стихий (проклятая)',
    category: 'catalyst', rarity: 'legendary', isCursed: true,
    desc: 'Реакции +50% урона, +10 Overload, +1 слот катализатора · +25% урона склянок · враги +15% HP.',
  },

  // Legendary brews / pacts
  {
    id: 'curse_salamander',
    name: 'Договор Саламандры',
    category: 'recipe', rarity: 'legendary', isCursed: true,
    desc: 'Все склянки становятся огненными и оставляют лужу · +50% урона склянок · откат склянок +20%.',
  },
  {
    id: 'curse_archmaster',
    name: 'Печать Архимастера',
    category: 'engineering', rarity: 'legendary', isCursed: true,
    desc: 'Все новые стойки появляются 2-го уровня · +25% урона стоек · стойки стоят на 25% дороже.',
  },
];

export const CARDS: CardDef[] = [...NORMAL_CARDS, ...CURSED_CARDS];

/** Predicate used by the card draft and the renderer to split the pool. */
export function isCursedCard(card: CardDef): boolean {
  return card.isCursed === true;
}

/** Cards available outside of cursed waves. */
export function normalCardPool(): CardDef[] {
  return NORMAL_CARDS;
}

/** Cards available on cursed waves (every 3rd wave). */
export function cursedCardPool(): CardDef[] {
  return CURSED_CARDS;
}

/**
 * Static synergy graph used by the card draft UI to surface "this combos with
 * a card you already took". Pairs are bidirectional. Kept compact — only the
 * strongest cross-card interactions are listed so the hint remains useful at
 * a glance.
 */
export const CARD_SYNERGIES: Record<string, string[]> = {
  // Fire family
  curse_flammable_mix: ['curse_acid_brew', 'curse_aether_brew', 'curse_crossfire', 'curse_fire_ruby', 'curse_salamander'],
  curse_fire_ruby: ['curse_flammable_mix', 'curse_crossfire', 'curse_salamander'],
  curse_salamander: ['curse_flammable_mix', 'curse_fire_ruby', 'curse_crossfire'],
  curse_crossfire: ['curse_flammable_mix', 'curse_fire_ruby', 'curse_salamander'],
  // Acid + reactions
  curse_acid_brew: ['curse_flammable_mix', 'curse_frost_brew', 'curse_mutagen_brew', 'curse_acid_prism', 'curse_acid_tips'],
  curse_acid_prism: ['curse_acid_brew', 'curse_aether_engine', 'curse_crown_of_elements'],
  curse_acid_tips: ['curse_acid_brew', 'curse_mercury_coating'],
  curse_mutagen_brew: ['curse_acid_brew', 'curse_acid_prism'],
  // Frost / Mercury
  curse_frost_brew: ['curse_acid_brew', 'curse_mercury_brew', 'curse_flammable_mix'],
  curse_mercury_brew: ['curse_aether_brew', 'curse_frost_brew', 'curse_mercury_ring', 'curse_mercury_coating'],
  curse_mercury_ring: ['curse_mercury_brew', 'curse_mercury_coating'],
  curse_mercury_coating: ['curse_mercury_brew', 'curse_mercury_ring', 'curse_acid_tips'],
  // Aether
  curse_aether_brew: ['curse_flammable_mix', 'curse_mercury_brew', 'curse_aether_engine', 'curse_crown_of_elements'],
  curse_aether_engine: ['curse_aether_brew', 'curse_acid_prism', 'curse_crown_of_elements'],
  // Engineering pacts
  curse_synchronized_volley: ['curse_crossfire', 'curse_archmaster'],
  curse_archmaster: ['curse_synchronized_volley', 'curse_crossfire'],
  // Survival pacts
  curse_thorny_shell: ['curse_golem_heart'],
  curse_golem_heart: ['curse_thorny_shell'],
  // Crown / catalysts
  curse_crown_of_elements: ['curse_acid_prism', 'curse_aether_engine', 'curse_fire_ruby', 'curse_mercury_ring'],
  // Potion utility
  curse_triple_throw: ['curse_unstable_flask'],
  curse_unstable_flask: ['curse_triple_throw'],
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
