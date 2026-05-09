// ── Alchemist's Diary content ────────────────────────────────────────
//
// Pure-data definitions for the three diary tabs (Алхимия / Бестиарий /
// Стойки). The diary overlay (`src/ui/diaryOverlay.ts`) reads everything
// from here so adding a new element / enemy / tower entry is a one-file
// content change.
//
// • `ELEMENT_ENTRIES` — the seven elements that show up in tower /
//   vial descriptions, with a short lore line and a list of features
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

export interface SynergyEntry {
  id: string;
  /** i18n key prefix; resolves `.name`, `.result`, `.features.<idx>`. */
  i18nKey: string;
  first: Element;
  second: Element;
  /** Russian source-of-truth result name. */
  ruName: string;
  /** Russian source-of-truth result description. */
  ruResult: string;
  /** Russian source-of-truth mechanic bullets. */
  ruFeatures: string[];
  /** Glyph shown near the reaction result. */
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
  /** Russian source-of-truth ability summary per difficulty mode. Once
   *  the player has met that mode's `killThresholds` entry the diary
   *  swaps the progress bar for the matching tier note, so the bestiary
   *  card turns into a quick reminder of what the enemy actually does
   *  on that mode (base behaviour on Обычный, the epic-only ability on
   *  Эпический, the amplified ancient version on Древний, etc.). The
   *  i18n suffix is `.tier.<mode>`. */
  ruTierNotes: Partial<Record<DifficultyMode, string>>;
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
      'Реакция Огонь+Кислота — едкое облако урона и снижения брони.',
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
      'Сочетается с поджогом: создаёт едкое облако урона и снижения брони.',
      'Незаменима против элиты и боссов в тяжёлой броне.',
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
      'Ртутный обруч вокруг Манекена замедляет ближайших врагов.',
      'Реакция Ртуть+Эфир — временной разлом, резко замедляющий группу.',
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
      'Реакция Эфир+Ртуть открывает временной разлом и резко замедляет группу.',
    ],
  },
  {
    id: 'frost',
    i18nKey: 'diary.element.frost',
    glyph: '❄',
    color: '#9be4ff',
    ruName: 'Холод',
    ruFlavor: 'Сковывает врагов холодом и открывает ледяные реакции.',
    ruFeatures: [
      'Ледяной удар резко замедляет цель на короткое время.',
      'Холод с кислотой создаёт поле, которое дополнительно снижает броню.',
      'Морозная вспышка Манекена полностью замораживает всех врагов на 3 секунды.',
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
      'Сочетается с поджогом: враг получает урон от двух эффектов сразу.',
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
      'Базовая стрельба игломётов и снаряды мортиры.',
    ],
  },
];

// ────────────────────────────────────────────────────────────────────────
// Synergies
// ────────────────────────────────────────────────────────────────────────

export const SYNERGY_ENTRIES: SynergyEntry[] = [
  {
    id: 'caustic_vapor',
    i18nKey: 'diary.synergy.caustic_vapor',
    first: 'fire',
    second: 'acid',
    glyph: '☣',
    color: '#d2f55a',
    ruName: 'Едкий пар',
    ruResult: 'Огонь испаряет кислоту в ядовитое облако, которое обжигает врагов и разъедает броню.',
    ruFeatures: [
      'Создаёт облако радиусом 55 px на 3 секунды.',
      'Внутри облака враги получают урон и сильнее теряют броню.',
    ],
  },
  {
    id: 'time_rift',
    i18nKey: 'diary.synergy.time_rift',
    first: 'mercury',
    second: 'aether',
    glyph: '⌁',
    color: '#7df9ff',
    ruName: 'Временной разлом',
    ruResult: 'Ртуть удерживает эфирный заряд, открывая разлом, который резко замедляет группу врагов.',
    ruFeatures: [
      'Создаёт поле радиусом 65 px на 2.5 секунды.',
      'Враги в поле движутся почти в четыре раза медленнее.',
    ],
  },
  {
    id: 'spark_cascade',
    i18nKey: 'diary.synergy.spark_cascade',
    first: 'fire',
    second: 'aether',
    glyph: '✦',
    color: '#a78bfa',
    ruName: 'Искровой каскад',
    ruResult: 'Эфир подхватывает пламя и перебрасывает искры на ближайших врагов цепной молнией.',
    ruFeatures: [
      'Мгновенно бьёт до 3 врагов в радиусе 180 px.',
      'Каждый поражённый враг получает эфирную метку для новых реакций.',
    ],
  },
  {
    id: 'brittle_frost',
    i18nKey: 'diary.synergy.brittle_frost',
    first: 'acid',
    second: 'frost',
    glyph: '❖',
    color: '#7dd3fc',
    ruName: 'Хрупкая глазурь',
    ruResult: 'Кислота въедается в ледяную корку: броня трескается, а цель застывает под давлением кристаллов.',
    ruFeatures: [
      'Создаёт морозное поле радиусом 50 px на 2.5 секунды.',
      'Обновляет холод и снижает броню цели до 30%.',
    ],
  },
  {
    id: 'glass_shatter',
    i18nKey: 'diary.synergy.glass_shatter',
    first: 'mercury',
    second: 'frost',
    glyph: '✧',
    color: '#c0e8ff',
    ruName: 'Стеклянная заморозка',
    ruResult: 'Ртутный холод делает врага стеклянно-хрупким и взрывает его осколочным импульсом.',
    ruFeatures: [
      'Наносит мощный разовый урон в радиусе 45 px.',
      'Лучше всего срабатывает по уже замедленным и охлаждённым целям.',
    ],
  },
  {
    id: 'mutagen_burst',
    i18nKey: 'diary.synergy.mutagen_burst',
    first: 'acid',
    second: 'poison',
    glyph: '✺',
    color: '#9be36b',
    ruName: 'Мутагенный взрыв',
    ruResult: 'Кислота раскрывает яд, превращая его в стойкую мутагенную вспышку вокруг цели.',
    ruFeatures: [
      'Создаёт токсичную зону радиусом 60 px на 4 секунды.',
      'Накладывает сильный яд и оставляет цель с ослабленной бронёй.',
    ],
  },
  {
    id: 'flash_steam',
    i18nKey: 'diary.synergy.flash_steam',
    first: 'fire',
    second: 'frost',
    glyph: '♨',
    color: '#f4a261',
    ruName: 'Паровой удар',
    ruResult: 'Пламя резко срывает ледяную корку, превращая холод в обжигающий пар по площади.',
    ruFeatures: [
      'Создаёт широкий паровой удар радиусом 70 px на 1.5 секунды.',
      'Снимает холод и оставляет на врагах сильный поджог.',
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
    ruFlavor: 'Желейный сгусток — вечный обитатель тёмных коридоров.',
    ruFeatures: [
      'Медленный, но часто приходит большими группами.',
      'При смерти распадается на несколько малых слизней.',
      'Уязвим к огню и кислоте.',
    ],
    killThresholds: REGULAR_THRESHOLDS,
    ruTierNotes: {
      normal: 'При смерти распадается на 2 малых слизня.',
      epic: 'Распад усилен: 3 малых слизня с увеличенным запасом ХП.',
      ancient: 'Распадается на 4 малых слизня; каждый может разделиться ещё раз.',
    },
  },
  {
    id: 'rat',
    i18nKey: 'diary.bestiary.rat',
    ruFlavor: 'Юркий вор, охотится за блестящими монетами.',
    ruFeatures: [
      'Высокая скорость, лёгкая броня.',
      'Периодически делает резкий рывок вперёд, удваивая скорость на короткий миг.',
      'Отскакивает назад при попадании, сбивая серии ударов.',
    ],
    killThresholds: REGULAR_THRESHOLDS,
    ruTierNotes: {
      normal: 'Резкие рывки вперёд каждые ~1.5–2 сек, удвоенная скорость на 0.4 сек.',
      epic: 'Рывки чаще и быстрее.',
      ancient: 'Рывки почти без пауз.',
    },
  },
  {
    id: 'golem',
    i18nKey: 'diary.bestiary.golem',
    ruFlavor: 'Тяжёлый страж, выкованный из живого железа.',
    ruFeatures: [
      'Высокий запас ХП и значительная броня.',
      'Поглощает первый удар одноразовым щитом.',
      'Эпический/Древний: при смерти выпускает ЭМИ-импульс, отключающий ближайшие стойки на 2–3 сек.',
      'Кислота снимает броню и открывает уязвимости.',
    ],
    killThresholds: REGULAR_THRESHOLDS,
    ruTierNotes: {
      normal: 'Одноразовый щит гасит первый удар.',
      epic: 'При смерти отключает стойки в радиусе ~100 px на 2 сек.',
      ancient: 'ЭМИ-радиус 130 px, отключение длится 3 сек.',
    },
  },
  {
    id: 'flying_flask',
    i18nKey: 'diary.bestiary.flying_flask',
    ruFlavor: 'Парящая колба с нестабильным варевом внутри.',
    ruFeatures: [
      'Парит над препятствиями и стойками.',
      'При гибели выпускает ЭМИ-импульс, отключающий ближайшие стойки.',
    ],
    killThresholds: REGULAR_THRESHOLDS,
    ruTierNotes: {
      normal: 'ЭМИ отключает стойки в радиусе ~70 px на 1.5 сек.',
      epic: 'Радиус и длительность отключения возрастают — связка стоек может выпасть на 2 сек.',
      ancient: 'ЭМИ накрывает 110 px и отключает стойки на 2.5 сек.',
    },
  },
  {
    id: 'shaman',
    i18nKey: 'diary.bestiary.shaman',
    ruFlavor: 'Колдует над спорами и исцеляет ближайших союзников.',
    ruFeatures: [
      'Аура исцеления восстанавливает ХП ближайшим врагам.',
      'Уязвим к огню — постоянный урон быстрее пробивает его лечение.',
    ],
    killThresholds: REGULAR_THRESHOLDS,
    ruTierNotes: {
      normal: 'Аура лечения восстанавливает ближайших союзников.',
      epic: 'Радиус и сила ауры увеличены.',
      ancient: 'Аура возвращает добитых союзников в бой.',
    },
  },
  {
    id: 'sapper',
    i18nKey: 'diary.bestiary.sapper',
    ruFlavor: 'Бежит к цели с зажжённой бомбой в руках.',
    ruFeatures: [
      'Подрывается на манекене, нанося огромный урон.',
      'Запал зажигается за пару секунд.',
      'Эпический/Древний: цепляется к ближайшей стойке и отключает её на 3–4 сек до взрыва.',
    ],
    killThresholds: REGULAR_THRESHOLDS,
    ruTierNotes: {
      normal: 'Подрывается на манекене за 1.5 сек.',
      epic: 'Цепляется к ближайшей стойке и отключает её ЭМИ-импульсом на 3 сек до подрыва.',
      ancient: 'Дольше отключает стойку (4 сек), а взрыв оставляет огненную лужу.',
    },
  },
  {
    id: 'miniboss_slime',
    i18nKey: 'diary.bestiary.miniboss_slime',
    ruFlavor: 'Огромный комок слизи, отъевшийся на павших собратьях.',
    ruFeatures: [
      'При смерти взрывом разбрасывает целую волну обычных слизней.',
      'Очень большой запас ХП.',
    ],
    killThresholds: BOSS_THRESHOLDS,
    ruTierNotes: {
      normal: 'При смерти взрывом разбрасывает 4 обычных слизней.',
      epic: 'Каждый малый слизень при смерти делится ещё раз.',
      ancient: 'Двухступенчатое деление, малые слизни двигаются быстрее.',
    },
  },
  {
    id: 'boss_rat_king',
    i18nKey: 'diary.bestiary.boss_rat_king',
    ruFlavor: 'Механический повелитель крыс в латах и редукторах.',
    ruFeatures: [
      'Периодически ускоряется рывками, как усиленная крыса-вор.',
      'После 80% ХП уклоняется боковым рывком при получении урона.',
      'Высокий запас ХП, броня и награда за победу.',
    ],
    killThresholds: BOSS_THRESHOLDS,
    ruTierNotes: {
      normal: 'Сочетает ускоряющие рывки вперёд и боковое уклонение после 80% ХП.',
      epic: 'Получает одно одноразовое щитовое срабатывание.',
      ancient: 'Запас одноразовых щитов увеличен до двух зарядов.',
    },
  },
  {
    id: 'boss_homunculus',
    i18nKey: 'diary.bestiary.boss_homunculus',
    ruFlavor: 'Нестабильное творение алхимика-перфекциониста.',
    ruFeatures: [
      'Переходит во 2-ю и 3-ю фазы на порогах 66% и 33% ХП.',
      'Призывает миньонов: слизней, затем крыс, затем сапёров.',
      'Во 2-й фазе получает дополнительную броню и начинает телепортироваться.',
    ],
    killThresholds: BOSS_THRESHOLDS,
    ruTierNotes: {
      normal: 'В 3-й фазе ускоряется в 1.5 раза; смерть призванных миньонов лечит босса на 3 ХП.',
      epic: 'Во 2-й фазе чаще меняет позицию телепортом.',
      ancient: 'В финальной фазе сочетает ускорение, броню, телепорты и волны сапёров.',
    },
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
      'Снаряд летит долго — лучше ставить мортиру против плотных маршрутов.',
      'Идеальна против плотных скоплений и слизней.',
    ],
  },
  {
    id: 'mercury_sprayer',
    i18nKey: 'diary.stance.mercury_sprayer',
    ruFlavor: 'Конус ртутной взвеси замедляет всё, что попадает под распыление.',
    ruFeatures: [
      'Накладывает замедление на цель.',
      'Сильный контроль узких проходов.',
      'Синергия с эфирными катушками — замедленные враги дольше остаются в цепи.',
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
    ruFlavor: 'Сторожевой фонарь — не стреляет, но усиливает соседей по слотам.',
    ruFeatures: [
      '+20% к скорострельности и +10% к дальности выбранных соседних стоек.',
      'Усиление идёт по соседним слотам по порядку, а не по радиусу.',
      'Число усиленных соседей равно уровню фонаря, максимум 5.',
      'За забег можно построить только 1 Сторожевой фонарь.',
    ],
  },
];
