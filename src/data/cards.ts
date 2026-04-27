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
];
