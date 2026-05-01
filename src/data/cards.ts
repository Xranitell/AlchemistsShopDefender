import type { CardDef, EffectPolarity } from '../game/types';
import { tWithFallback } from '../i18n';
import { cursedExtraLabel, getCursedExtra } from './cursedExtras';

/** Localised display name for a card. Falls back to the source-of-truth
 *  Russian string in `CARDS` if the active locale doesn't translate it. */
export function cardName(card: CardDef): string {
  return tWithFallback(`cards.${card.id}.name`, card.name);
}

/** Localised description for a card (effects shown below the title). */
export function cardDesc(card: CardDef): string {
  return tWithFallback(`cards.${card.id}.desc`, card.desc);
}

/** A single bullet line on a card, classified as helping the player
 *  (`pos`) or hurting them (`neg`) based on the bullet text + sign. */
export interface CardBullet {
  text: string;
  polarity: EffectPolarity;
  /** True when this bullet describes a unique mechanic (not a plain stat
   *  bonus). Used by the card renderer to paint a special backing. */
  isUnique?: boolean;
}

// Patterns that flip the natural sign-based polarity. Order is checked
// first against `+`-prefixed bullets and then `−`-prefixed; the first match
// wins. Patterns are anchored to whole-word substrings (with optional
// preceding "макс. " etc.) and case-insensitive.
//
// `+` is normally GOOD for the player (more damage / radius / ХП / gold);
// these patterns mark a `+` bullet as a DRAWBACK because they buff enemies
// or inflate cooldowns / costs.
const PLUS_IS_NEGATIVE: RegExp[] = [
  /ХП\s+врагов/i,           // +X% enemy ХП
  /скорость\s+врагов/i,     // +X% enemy speed (NB: NOT "скорость атаки стоек")
  /урон\s+врагов/i,         // +X% enemy damage
  /стоимость\s+ст(?:о[ея]ек|ойки)/i, // +X% tower cost
  /(?:^|\s)откат\s+склянок/i,        // +X% potion cooldown
  /(?:^|\s)откат\s+ст(?:о[ея]ек|ойки)/i, // +X% tower cooldown (rare)
  /\bcost\b/i,
  /\bcooldown\b/i,
  /\benemy\s+ХП\b/i,
  /\benemy\s+speed\b/i,
  /\benemy\s+damage\b/i,
];

// `−` is normally BAD for the player (less ХП / less damage / less gold);
// these patterns mark a `−` bullet as a DRAWBACK because they reduce a
// player-beneficial stat. Anything that ISN'T in this list is treated as
// debuffing enemies (e.g. `−50% брони цели` is good for the player).
const MINUS_IS_NEGATIVE: RegExp[] = [
  /макс\.?\s*ХП\s+(?:Манекена|Mannequin)/i,
  /\bурон\s+склянок/i,
  /\bурон\s+стоек/i,
  /\bурон\s+реакций/i,
  /\bрадиус\s+склянок/i,
  /\bрадиус\s+стоек/i,
  /\bскорость\s+атаки\s+ст(?:о[ея]ек|ойки)/i,
  /\bзолот[ао]/i,
  /\bpotion\s+(damage|radius)\b/i,
  /\btower\s+(damage|range|fire-rate)\b/i,
  /\bgold\b/i,
  /\bmax\s+(?:mannequin\s+)?ХП\b/i,
];

/** Classify a single bullet as `pos` or `neg` for the player based on
 *  its leading sign + the keyword set. Bullets without an explicit sign
 *  (pure flavour effects like "+стихия Мороза") are treated as positive. */
export function classifyBullet(text: string): EffectPolarity {
  const trimmed = text.trim();
  const sign = trimmed[0];
  if (sign === '+') {
    return PLUS_IS_NEGATIVE.some((rx) => rx.test(trimmed)) ? 'neg' : 'pos';
  }
  if (sign === '−' || sign === '-') {
    return MINUS_IS_NEGATIVE.some((rx) => rx.test(trimmed)) ? 'neg' : 'pos';
  }
  return 'pos';
}

/** Detect whether a bullet describes a unique mechanic (not a plain stat
 *  +/−X% change). Unique bullets typically start with `+` followed by a
 *  word rather than a number, or describe a game-changing ability. */
function isUniqueBullet(text: string): boolean {
  const t = text.trim();
  // Starts with + but no number right after → mechanic like "+огненная лужа"
  if (/^\+[^\d\s−]/.test(t)) return true;
  // Explicit mechanic keywords (RU + EN)
  if (/(?:лужа|стихия|яд|веер|замедление|поджог|спасение|заряд|двойной\s+выстрел|удвоен|element|puddle|ignite|fan|double\s+shot|slow|death\s+save)/i.test(t)) return true;
  return false;
}

/** Split a card description into its `·`-separated bullets, classify each
 *  as pos/neg, and append any rolled-extra bullets attached to a per-draft
 *  card instance. Returns the bullets in their original order; the renderer
 *  is responsible for grouping by polarity. */
export function cardBullets(card: CardDef): CardBullet[] {
  const desc = cardDesc(card);
  const parts = desc
    .split(/(?:\.\s+|;\s+|\s\u00B7\s)/)
    .map((p) => p.trim().replace(/\.$/, ''))
    .filter((p) => p.length > 0);
  const isCursed = card.isCursed === true;
  const base: CardBullet[] = (parts.length > 0 ? parts : [desc]).map((text, idx) => ({
    text,
    polarity: classifyBullet(text),
    isUnique: isCursed && idx === 0 && isUniqueBullet(text),
  }));
  const extras = card.rolledExtraIds ?? [];
  for (const id of extras) {
    const def = getCursedExtra(id);
    if (!def) continue;
    base.push({ text: cursedExtraLabel(id), polarity: def.polarity });
  }
  return base;
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
    desc: '+8% урона склянок.' },
  { id: 'pdmg_r', name: 'Тяжёлый состав II', category: 'recipe', rarity: 'rare',
    desc: '+15% урона склянок.' },
  { id: 'pdmg_e', name: 'Тяжёлый состав III', category: 'recipe', rarity: 'epic',
    desc: '+25% урона склянок.' },
  { id: 'pdmg_l', name: 'Тяжёлый состав IV', category: 'recipe', rarity: 'legendary',
    desc: '+40% урона склянок.' },

  // Potion radius
  { id: 'prad_c', name: 'Широкий всплеск I', category: 'recipe', rarity: 'common',
    desc: '+8% радиус взрыва склянок.' },
  { id: 'prad_r', name: 'Широкий всплеск II', category: 'recipe', rarity: 'rare',
    desc: '+13% радиус взрыва склянок.' },
  { id: 'prad_e', name: 'Широкий всплеск III', category: 'recipe', rarity: 'epic',
    desc: '+23% радиус взрыва склянок.' },
  { id: 'prad_l', name: 'Широкий всплеск IV', category: 'recipe', rarity: 'legendary',
    desc: '+35% радиус взрыва склянок.' },

  // Potion cooldown reduction
  { id: 'pcd_c', name: 'Алхимический хват I', category: 'recipe', rarity: 'common',
    desc: '−6% откат склянок.' },
  { id: 'pcd_r', name: 'Алхимический хват II', category: 'recipe', rarity: 'rare',
    desc: '−11% откат склянок.' },
  { id: 'pcd_e', name: 'Алхимический хват III', category: 'recipe', rarity: 'epic',
    desc: '−18% откат склянок.' },
  { id: 'pcd_l', name: 'Алхимический хват IV', category: 'recipe', rarity: 'legendary',
    desc: '−25% откат склянок.' },

  // Tower damage
  { id: 'tdmg_c', name: 'Точная наводка I', category: 'engineering', rarity: 'common',
    desc: '+8% урона стоек.' },
  { id: 'tdmg_r', name: 'Точная наводка II', category: 'engineering', rarity: 'rare',
    desc: '+15% урона стоек.' },
  { id: 'tdmg_e', name: 'Точная наводка III', category: 'engineering', rarity: 'epic',
    desc: '+25% урона стоек.' },
  { id: 'tdmg_l', name: 'Точная наводка IV', category: 'engineering', rarity: 'legendary',
    desc: '+40% урона стоек.' },

  // Tower fire rate
  { id: 'tfr_c', name: 'Смазанные механизмы I', category: 'engineering', rarity: 'common',
    desc: '+6% скорость атаки стоек.' },
  { id: 'tfr_r', name: 'Смазанные механизмы II', category: 'engineering', rarity: 'rare',
    desc: '+11% скорость атаки стоек.' },
  { id: 'tfr_e', name: 'Смазанные механизмы III', category: 'engineering', rarity: 'epic',
    desc: '+20% скорость атаки стоек.' },
  { id: 'tfr_l', name: 'Смазанные механизмы IV', category: 'engineering', rarity: 'legendary',
    desc: '+30% скорость атаки стоек.' },

  // Tower range
  { id: 'trng_c', name: 'Расширенные линзы I', category: 'engineering', rarity: 'common',
    desc: '+5% радиус стоек.' },
  { id: 'trng_r', name: 'Расширенные линзы II', category: 'engineering', rarity: 'rare',
    desc: '+10% радиус стоек.' },
  { id: 'trng_e', name: 'Расширенные линзы III', category: 'engineering', rarity: 'epic',
    desc: '+18% радиус стоек.' },
  { id: 'trng_l', name: 'Расширенные линзы IV', category: 'engineering', rarity: 'legendary',
    desc: '+28% радиус стоек.' },

  // Mannequin ХП
  { id: 'hp_c', name: 'Укреплённый каркас I', category: 'ritual', rarity: 'common',
    desc: '+13 макс. ХП Манекена и +13 текущего ХП.' },
  { id: 'hp_r', name: 'Укреплённый каркас II', category: 'ritual', rarity: 'rare',
    desc: '+25 макс. ХП Манекена и +25 текущего ХП.' },
  { id: 'hp_e', name: 'Укреплённый каркас III', category: 'ritual', rarity: 'epic',
    desc: '+45 макс. ХП Манекена и +45 текущего ХП.' },
  { id: 'hp_l', name: 'Укреплённый каркас IV', category: 'ritual', rarity: 'legendary',
    desc: '+75 макс. ХП Манекена и +75 текущего ХП.' },

  // Gold drop
  { id: 'gold_c', name: 'Золотая лихорадка I', category: 'ritual', rarity: 'common',
    desc: '+8% золота с врагов.' },
  { id: 'gold_r', name: 'Золотая лихорадка II', category: 'ritual', rarity: 'rare',
    desc: '+15% золота с врагов.' },
  { id: 'gold_e', name: 'Золотая лихорадка III', category: 'ritual', rarity: 'epic',
    desc: '+25% золота с врагов.' },
  { id: 'gold_l', name: 'Золотая лихорадка IV', category: 'ritual', rarity: 'legendary',
    desc: '+40% золота с врагов.' },

];

// — CURSED CARDS — unique effect + epic stats + drawback ────────────────────

const CURSED_CARDS: CardDef[] = [
  // Recipes / brews
  {
    id: 'curse_flammable_mix',
    name: 'Договор Пламени',
    category: 'recipe', rarity: 'epic', isCursed: true,
    desc: '+огненная лужа от склянок (8 урон/с, 3 с) · +15% урон склянок · +15% ХП врагов.',
  },
  {
    id: 'curse_unstable_flask',
    name: 'Нестабильная колба (проклятая)',
    category: 'recipe', rarity: 'epic', isCursed: true,
    desc: '+50% шанс вторичного микровзрыва (+50% доп. урона) · +13% радиус склянок · +20% откат склянок.',
  },
  {
    id: 'curse_frost_brew',
    name: 'Морозный обет',
    category: 'recipe', rarity: 'epic', isCursed: true,
    desc: '+стихия Мороза ко всем склянкам · +15% радиус склянок · +15% ХП врагов.',
  },
  {
    id: 'curse_acid_brew',
    name: 'Кислотный пакт',
    category: 'recipe', rarity: 'epic', isCursed: true,
    desc: '+стихия Кислоты ко всем склянкам (−50% брони цели 4 с) · +15% урон склянок · +15% ХП врагов.',
  },
  {
    id: 'curse_mercury_brew',
    name: 'Ртутный обет',
    category: 'recipe', rarity: 'epic', isCursed: true,
    desc: '+стихия Ртути ко всем склянкам · +13% урон и +10% радиус склянок · −25% золота.',
  },
  {
    id: 'curse_aether_brew',
    name: 'Эфирный заговор',
    category: 'recipe', rarity: 'legendary', isCursed: true,
    desc: '+стихия Эфира ко всем склянкам (открывает реакции) · +20% урон склянок · +20% ХП врагов.',
  },
  {
    id: 'curse_mutagen_brew',
    name: 'Мутагенное проклятие',
    category: 'recipe', rarity: 'epic', isCursed: true,
    desc: '+яд от склянок (4 ур/с 5 с, игнор брони) · +18% урон склянок · +20% ХП врагов.',
  },
  {
    id: 'curse_triple_throw',
    name: 'Тройной обет',
    category: 'recipe', rarity: 'epic', isCursed: true,
    desc: '+веер из 3 склянок раз в 8 с · −10% откат склянок · −20% радиус склянок.',
  },

  // Engineering / towers
  {
    id: 'curse_crossfire',
    name: 'Перекрёстный огонь (проклятый)',
    category: 'engineering', rarity: 'epic', isCursed: true,
    desc: '+30% урон стоек по горящим врагам · +10% урон стоек · +15% скорость врагов.',
  },
  {
    id: 'curse_mercury_coating',
    name: 'Ртутное покрытие (проклятое)',
    category: 'engineering', rarity: 'epic', isCursed: true,
    desc: '+20% замедление от стоек · +13% скорость атаки стоек · −30 макс. ХП Манекена.',
  },
  {
    id: 'curse_acid_tips',
    name: 'Кислотные наконечники (проклятые)',
    category: 'engineering', rarity: 'epic', isCursed: true,
    desc: '−15% брони цели при попадании стоек · +13% урон стоек · +30% стоимость стоек.',
  },
  {
    id: 'curse_synchronized_volley',
    name: 'Синхронный залп (проклятый)',
    category: 'engineering', rarity: 'epic', isCursed: true,
    desc: '+1 двойной выстрел каждые 4 атаки · +10% урон стоек · +20% ХП врагов.',
  },

  // Rituals / Mannequin
  {
    id: 'curse_thorny_shell',
    name: 'Шипастая оболочка (проклятая)',
    category: 'ritual', rarity: 'epic', isCursed: true,
    desc: '+8 урон в ответ при касании Манекена · +25 макс. ХП Манекена · −20% золота.',
  },
  {
    id: 'curse_chronos',
    name: 'Хронос (проклятый)',
    category: 'ritual', rarity: 'epic', isCursed: true,
    desc: '+5 с замедления всех врагов от Перегруза (заменяет Громоотвод) · +15% урон склянок · +20% откат склянок.',
  },
  {
    id: 'curse_golem_heart',
    name: 'Сердце Голема (проклятое)',
    category: 'ritual', rarity: 'legendary', isCursed: true,
    desc: '+1 спасение от смерти на 1 ХП и щит 6 с · +38 макс. ХП · −30% урон склянок.',
  },

  // Catalysts
  {
    id: 'curse_fire_ruby',
    name: 'Малый огненный камень (проклятый)',
    category: 'catalyst', rarity: 'epic', isCursed: true,
    desc: '+поджог каждой 5-й склянкой · +13% урон склянок · +15% скорость врагов.',
  },
  {
    id: 'curse_mercury_ring',
    name: 'Ртутный обруч (проклятый)',
    category: 'catalyst', rarity: 'epic', isCursed: true,
    desc: '−40% скорость врагов рядом с Манекеном · +15% золота · +15% ХП врагов.',
  },
  {
    id: 'curse_acid_prism',
    name: 'Кислотная призма (проклятая)',
    category: 'catalyst', rarity: 'epic', isCursed: true,
    desc: '+13% урон стихийных реакций · +13% урон склянок · −35 макс. ХП Манекена.',
  },
  {
    id: 'curse_aether_engine',
    name: 'Эфирный двигатель (проклятый)',
    category: 'catalyst', rarity: 'legendary', isCursed: true,
    desc: '+15 заряд Перегруза за реакцию · +18% урон склянок · +20% откат склянок.',
  },
  {
    id: 'curse_crown_of_elements',
    name: 'Корона стихий (проклятая)',
    category: 'catalyst', rarity: 'legendary', isCursed: true,
    desc: '+25% урон реакций, +10 Перегруз, +1 слот катализатора · +13% урон склянок · +20% ХП врагов.',
  },

  // Legendary brews / pacts
  {
    id: 'curse_salamander',
    name: 'Договор Саламандры',
    category: 'recipe', rarity: 'legendary', isCursed: true,
    desc: '+огонь и лужа от всех склянок · +25% урон склянок · +25% откат склянок.',
  },
  {
    id: 'curse_archmaster',
    name: 'Печать Архимастера',
    category: 'engineering', rarity: 'legendary', isCursed: true,
    desc: '+1 уровень новой стойки · +13% урон стоек · +35% стоимость стоек.',
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
