import type { CardDef } from '../game/types';

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
    id: 'magnet',
    name: 'Магнитный резонанс',
    category: 'ritual',
    rarity: 'common',
    desc: '+50% радиус сбора золота.',
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
];
