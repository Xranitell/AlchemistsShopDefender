// ── Alchemist's Diary content ────────────────────────────────────────
//
// Pure-data definitions for the three diary tabs (Алхимия / Бестиарий /
// Стойки). The diary overlay (`src/ui/diaryOverlay.ts`) reads everything
// from here so adding a new element / enemy / tower entry is a one-file
// content change.
//
// • `ELEMENT_ENTRIES` — the seven elements that show up in tower /
//   potion descriptions, with a short lore line and a list of features
//   (reactions, status effects, recommended pairings).
// • `BESTIARY_ENTRIES` — every enemy that the player can encounter, with
//   a short flavour line and a list of behavioural features. The kill
//   threshold per difficulty controls how full the progress bar reads.
// • `STANCE_ENTRIES` — every tower kind, with a flavour line and a list
//   of mechanical features so the player can compare loadouts before a
//   run.
//
// All localisable text goes through `tWithFallback` so RU is the source
// of truth and EN strings live in `src/i18n/en.ts`. The `i18nKey` field
// is the prefix (`bestiary.<id>` etc.), with `.flavor` / `.features.<n>`
// suffixes resolved at render time.

import type { DifficultyMode } from './difficulty';
import type { Element } from '../game/types';

export interface ElementEntry {
  id: Element;
  /** i18n key prefix; resolves `.name`, `.flavor`, `.features.<idx>`. */
  i18nKey: string;
  /** Russian source-of-truth display name. */
  ruName: string;
  /** Russian source-of-truth one-line flavour. */
  ruFlavor: string;
  /** Russian source-of-truth feature bullets. */
  ruFeatures: string[];
  /** Single-glyph icon shown on the entry card. */
  glyph: string;
  /** Hex accent colour used for the card border / title glow. */
  color: string;
}

export interface BestiaryEntry {
  /** Matches `EnemyKind.id` in `data/enemies.ts`. */
  id: string;
  /** i18n key prefix; resolves `.flavor` and `.features.<idx>`. */
  i18nKey: string;
  /** Russian source-of-truth flavour line. */
  ruFlavor: string;
  /** Russian source-of-truth feature bullets. */
  ruFeatures: string[];
  /** Per-difficulty kill counts that fully complete the entry's progress
   *  bar. The bestiary record stores any kill count past the threshold
   *  as 100% — the bar caps visually at the threshold so the player
   *  always sees a finished bar once they've put in the work. */
  killThresholds: Record<DifficultyMode, number>;
}

export interface StanceEntry {
  /** Matches `TowerKind.id` in `data/towers.ts`. */
  id: string;
  /** i18n key prefix; resolves `.flavor` and `.features.<idx>`. */
  i18nKey: string;
  /** Russian source-of-truth flavour line. */
  ruFlavor: string;
  /** Russian source-of-truth feature bullets. */
  ruFeatures: string[];
}

// ────────────────────────────────────────────────────────────────────────
// Elements
// ────────────────────────────────────────────────────────────────────────

export const ELEMENT_ENTRIES: ElementEntry[] = [
  {
    id: 'fire',
    i18nKey: 'diary.element.fire',
    glyph: '🔥',
    color: '#ff8c5a',
    ruName: 'Огонь',
    ruFlavor: 'Жар разгоняет толпу и оставляет тлеющие лужи.',
    ruFeatures: [
      'Поджог: цель горит, получая урон каждую секунду.',
      'Огненная лужа поджигает всех, кто входит в радиус.',
      'Реакция Огонь+Кислота — мощный взрыв по площади.',
    ],
  },
  {
    id: 'acid',
    i18nKey: 'diary.element.acid',
    glyph: '🧪',
    color: '#d2f55a',
    ruName: 'Кислота',
    ruFlavor: 'Растворяет броню и делает врагов уязвимее.',
    ruFeatures: [
      'Снижает броню цели на время действия эффекта.',
      'Стак с поджогом усиливает урон от огня.',
      'Идеальна против элиты и боссов с тяжёлым доспехом.',
    ],
  },
  {
    id: 'mercury',
    i18nKey: 'diary.element.mercury',
    glyph: '💧',
    color: '#c9c9d8',
    ruName: 'Ртуть',
    ruFlavor: 'Тяжёлый туман, замедляющий шаг и реакции.',
    ruFeatures: [
      'Замедляет цель до 60% скорости на несколько секунд.',
      'Ртутное кольцо вокруг манекена держит ближних врагов в инее.',
      'Реакция Ртуть+Эфир — статический разряд по группе.',
    ],
  },
  {
    id: 'aether',
    i18nKey: 'diary.element.aether',
    glyph: '⚡',
    color: '#a78bfa',
    ruName: 'Эфир',
    ruFlavor: 'Цепная молния скачет между уязвимыми целями.',
    ruFeatures: [
      'Помечает цель эфирным резонансом — открывает реакции.',
      'Цепной разряд бьёт до 2 ближайших врагов с падающим уроном.',
      'Реакция Эфир+Ртуть детонирует помеченных врагов.',
    ],
  },
  {
    id: 'frost',
    i18nKey: 'diary.element.frost',
    glyph: '❄',
    color: '#9be4ff',
    ruName: 'Холод',
    ruFlavor: 'Замораживает врагов, делая их хрупкими к удару.',
    ruFeatures: [
      'Заморозка останавливает движение цели на короткое время.',
      'Хрупкий враг получает повышенный урон от следующего удара.',
      'Морозная вспышка манекена накладывает заморозку всем рядом.',
    ],
  },
  {
    id: 'poison',
    i18nKey: 'diary.element.poison',
    glyph: '☠',
    color: '#a3d977',
    ruName: 'Яд',
    ruFlavor: 'Точит здоровье врага в обход брони.',
    ruFeatures: [
      'Урон от яда игнорирует броню цели.',
      'Действует длительно — выгоден против выживающих врагов.',
      'Стакается с поджогом для двойного DoT.',
    ],
  },
  {
    id: 'neutral',
    i18nKey: 'diary.element.neutral',
    glyph: '◆',
    color: '#d6d6e0',
    ruName: 'Нейтральный',
    ruFlavor: 'Чистый физический урон без побочных эффектов.',
    ruFeatures: [
      'Не вызывает реакции и не накладывает статусы.',
      'Стабилен против любого типа защиты.',
      'Базовая стрельба иглометов и снарядов мортиры.',
    ],
  },
];

// ────────────────────────────────────────────────────────────────────────
// Bestiary
// ────────────────────────────────────────────────────────────────────────

/** Default per-difficulty kill thresholds for completing an entry's
 *  progress bar. Tougher modes need fewer kills because each kill is a
 *  bigger investment. Bosses use a smaller table (see `BOSS_THRESHOLDS`). */
const REGULAR_THRESHOLDS: Record<DifficultyMode, number> = {
  normal: 15,
  epic: 8,
  ancient: 5,
  endless: 15,
  daily: 10,
};

const BOSS_THRESHOLDS: Record<DifficultyMode, number> = {
  normal: 3,
  epic: 2,
  ancient: 1,
  endless: 3,
  daily: 2,
};

export const BESTIARY_ENTRIES: BestiaryEntry[] = [
  {
    id: 'slime',
    i18nKey: 'diary.bestiary.slime',
    ruFlavor: 'Желейный сгусток, вечный спутник тёмных коридоров.',
    ruFeatures: [
      'Медленный, но многочисленный.',
      'При смерти раскалывается на меньшие слизни.',
      'Уязвим к огню и кислоте.',
    ],
    killThresholds: REGULAR_THRESHOLDS,
  },
  {
    id: 'rat',
    i18nKey: 'diary.bestiary.rat',
    ruFlavor: 'Юркий вор, охотится за блестящими монетами.',
    ruFeatures: [
      'Высокая скорость, лёгкая броня.',
      'Отскакивает назад при попадании, мешая чейнить урон.',
      'Замедление и ртуть резко снижают его опасность.',
    ],
    killThresholds: REGULAR_THRESHOLDS,
  },
  {
    id: 'golem',
    i18nKey: 'diary.bestiary.golem',
    ruFlavor: 'Тяжёлый страж, выкованный из живого железа.',
    ruFeatures: [
      'Высокое HP и значительная броня.',
      'Поглощает первый удар одноразовым щитом.',
      'Кислота снимает броню и открывает уязвимости.',
    ],
    killThresholds: REGULAR_THRESHOLDS,
  },
  {
    id: 'flying_flask',
    i18nKey: 'diary.bestiary.flying_flask',
    ruFlavor: 'Парящая колба с нестабильным варевом внутри.',
    ruFeatures: [
      'Летает над препятствиями.',
      'Взрывается при гибели, нанося урон по площади.',
      'Эфир и точные броски сбивают её до взрыва.',
    ],
    killThresholds: REGULAR_THRESHOLDS,
  },
  {
    id: 'shaman',
    i18nKey: 'diary.bestiary.shaman',
    ruFlavor: 'Колдует над спорами, исцеляя соседей по толпе.',
    ruFeatures: [
      'Аура исцеления восстанавливает HP ближайшим врагам.',
      'Уничтожать в первую очередь, иначе бой затянется.',
      'Уязвим к огню — DoT гасит ауру быстрее одиночных ударов.',
    ],
    killThresholds: REGULAR_THRESHOLDS,
  },
  {
    id: 'sapper',
    i18nKey: 'diary.bestiary.sapper',
    ruFlavor: 'Бежит к цели с зажжённой бомбой в обнимку.',
    ruFeatures: [
      'Подрывается на манекене, нанося огромный урон.',
      'Запал зажигается за пару секунд — успей сбить.',
      'Замедление ртутью и эфирная цепь обезвреживают раньше.',
    ],
    killThresholds: REGULAR_THRESHOLDS,
  },
  {
    id: 'miniboss_slime',
    i18nKey: 'diary.bestiary.miniboss_slime',
    ruFlavor: 'Огромный комок слизи, питающийся павшими собратьями.',
    ruFeatures: [
      'Многократно делится, оставляя за собой армию слизней.',
      'Высокий HP — требует сосредоточенного огня.',
      'Огненные лужи режут популяцию «деток» сразу после деления.',
    ],
    killThresholds: BOSS_THRESHOLDS,
  },
  {
    id: 'boss_rat_king',
    i18nKey: 'diary.bestiary.boss_rat_king',
    ruFlavor: 'Механический повелитель крыс — закован в латы и редукторы.',
    ruFeatures: [
      'Уклоняется от тяжёлых снарядов рывком в сторону.',
      'Призывает крыс-воров на помощь во второй фазе.',
      'Кислота и эфир снимают броню и сбивают рывки.',
    ],
    killThresholds: BOSS_THRESHOLDS,
  },
  {
    id: 'boss_homunculus',
    i18nKey: 'diary.bestiary.boss_homunculus',
    ruFlavor: 'Нестабильный продукт алхимика-перфекциониста.',
    ruFeatures: [
      'Меняет фазы — на третьей ускоряется в 1.5 раза.',
      'Слабые места открываются после прерывания заклинания.',
      'Реакция Эфир+Ртуть детонирует сразу несколько фрагментов.',
    ],
    killThresholds: BOSS_THRESHOLDS,
  },
];

export const BESTIARY_BY_ID: Record<string, BestiaryEntry> = (() => {
  const out: Record<string, BestiaryEntry> = {};
  for (const e of BESTIARY_ENTRIES) out[e.id] = e;
  return out;
})();

// ────────────────────────────────────────────────────────────────────────
// Stances (towers)
// ────────────────────────────────────────────────────────────────────────

export const STANCE_ENTRIES: StanceEntry[] = [
  {
    id: 'needler',
    i18nKey: 'diary.stance.needler',
    ruFlavor: 'Базовый игломёт — стреляет часто и дёшево.',
    ruFeatures: [
      'Низкая стоимость постройки.',
      'Высокая скорострельность по одной цели.',
      'Идеален против быстрых, но хрупких врагов.',
    ],
  },
  {
    id: 'mortar',
    i18nKey: 'diary.stance.mortar',
    ruFlavor: 'Алхимическая мортира — редкие, но опустошающие залпы.',
    ruFeatures: [
      'Огромный радиус разлёта снаряда.',
      'Снаряд летит долго — целься на упреждение.',
      'Идеальна против плотных скоплений и слизней.',
    ],
  },
  {
    id: 'mercury_sprayer',
    i18nKey: 'diary.stance.mercury_sprayer',
    ruFlavor: 'Конус ртутной взвеси замедляет всё, что влетает.',
    ruFeatures: [
      'Накладывает замедление на цель.',
      'Сильный контроль узких проходов.',
      'Синергия с эфирными катушками — больше времени на цепь.',
    ],
  },
  {
    id: 'acid_injector',
    i18nKey: 'diary.stance.acid_injector',
    ruFlavor: 'Точечный инжектор кислоты — снимает броню одиночек.',
    ruFeatures: [
      'Снижает броню цели на время.',
      'Незаменим против големов и боссов.',
      'Готовит цель для огневых стоек и реакций.',
    ],
  },
  {
    id: 'ether_coil',
    i18nKey: 'diary.stance.ether_coil',
    ruFlavor: 'Эфирная катушка пускает цепной разряд по толпе.',
    ruFeatures: [
      'Бьёт основную цель и до 2 соседей.',
      'Урон падает с каждым прыжком.',
      'Лучше всего работает по сгрудившимся врагам.',
    ],
  },
  {
    id: 'watch_tower',
    i18nKey: 'diary.stance.watch_tower',
    ruFlavor: 'Сторожевой фонарь — не стреляет, но усиливает соседей.',
    ruFeatures: [
      '+20% скорострельности соседним стойкам.',
      '+10% дальности соседним стойкам.',
      'Ставится позади боевых стоек, чтобы не занимать линию огня.',
    ],
  },
];
