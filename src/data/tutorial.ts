/**
 * Declarative FTUE / tutorial steps (GDD §18 / PR-8).
 *
 * Steps are *pulled* by the TutorialController as triggers are emitted
 * during the first run. The flow is intentionally non-blocking — a step
 * surfaces a tooltip + spotlight, and the player can keep playing while
 * reading. Each step dismisses itself either:
 *   - automatically when the matching gameplay action is performed
 *     (e.g. "first manual throw" hides the throw tooltip), or
 *   - on a hard timeout if the player ignores it, or
 *   - on the player clicking "Далее"/"Next" inside a panel-bound sequence.
 *
 * A step is shown at most once; the controller persists nothing yet, but
 * once wave 5 is cleared the meta-save flag `tutorialDone` is set so the
 * tutorial never triggers again. Pause-panel and main-menu sequences are
 * gated by their own `pauseTutorialDone` / `menuTutorialDone` flags so
 * each one teaches the player exactly once.
 */

export type TutorialTrigger =
  /** Play this step the moment the given (1-based) wave starts. */
  | { kind: 'waveStart'; wave: number }
  /** Play during the prep phase *before* the given wave — so hints that
   *  require between-wave interaction (e.g. tower placement) surface when
   *  the player can actually act on them. */
  | { kind: 'prepStart'; wave: number }
  /** Play once the player lands their first manual-aim vial hit. */
  | { kind: 'firstManualHit' }
  /** Play once the player picks their first card after wave 1. */
  | { kind: 'firstCardPicked' }
  /** Played by `tutorial.startSequence('pauseOpen', …)` when the player
   *  opens the pause-stats panel for the first time. All steps that share
   *  this trigger run in the order they appear in `TUTORIAL_STEPS`. */
  | { kind: 'pauseOpen' }
  /** Played by `tutorial.startSequence('mainMenuOpen', …)` when the
   *  player lands on the main menu for the first time. */
  | { kind: 'mainMenuOpen' }
  /** Played by `tutorial.startSequence('settingsOpen', …)` when the
   *  player opens the settings panel for the first time. Walks them
   *  through the audio / language / motion / stats / reset rows so they
   *  know where to find the animation toggle on phones (the most-asked
   *  performance setting) and where their long-term progress numbers
   *  live. Same `next`-driven sequence semantics as the other panel
   *  walkthroughs. */
  | { kind: 'settingsOpen' }
  /** Played by `tutorial.startSequence('cursedDraft', …)` the first time
   *  the player is offered a cursed-card draft (every-3rd-wave special
   *  offering, or every wave on the «Проклятый день» daily event).
   *  One-shot walkthrough explaining that cursed cards bundle a strong
   *  bonus with a hard drawback and that you can skip them. */
  | { kind: 'cursedDraft' };

export type TutorialDismiss =
  /** Player threw a vial (mouse press in arena). */
  | { kind: 'manualThrow' }
  /** Manual-aim hit landed. */
  | { kind: 'manualHit' }
  /** Picked a card from the offering. */
  | { kind: 'cardPicked' }
  /** Bought a tower at any rune point. */
  | { kind: 'towerPlaced' }
  /** Levelled up a tower at least once. */
  | { kind: 'towerUpgraded' }
  /** Activated Overload (any active module). */
  | { kind: 'overloadActivated' }
  /** Opened the mannequin repair / shield popup at least once. */
  | { kind: 'mannequinShopOpened' }
  /** Hard timeout — auto-dismiss after N ms even if untouched. */
  | { kind: 'auto'; afterMs: number }
  /** No timeout — dismiss only when the player clicks the "Next"/"Got
   *  it" button (or skips the whole sequence). Used for panel walk-
   *  throughs where we don't want a hint to evaporate while the player
   *  is reading. */
  | { kind: 'next' };

export type TutorialTarget =
  /** Highlight a DOM element by `[data-tutorial-target=...]`. */
  | { kind: 'hud'; selector: string; arrow: 'down' | 'up' | 'left' | 'right' }
  /** Highlight the mannequin sprite (world-space). */
  | { kind: 'mannequin' }
  /** Highlight the first inactive rune point (world-space). */
  | { kind: 'rune' }
  /** Highlight the first existing tower (world-space). */
  | { kind: 'firstTower' }
  /** No spotlight — just a centered tooltip. */
  | { kind: 'centered' };

export interface TutorialStep {
  id: string;
  trigger: TutorialTrigger;
  /** Translation-ready text. Plain text only (no HTML). */
  text: string;
  target: TutorialTarget;
  dismiss: TutorialDismiss;
  /** Show the "Пропустить обучение" button alongside the tooltip. */
  showSkip?: boolean;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'w1-throw',
    trigger: { kind: 'waveStart', wave: 1 },
    text: 'Зажми ЛКМ, чтобы прицелиться, и отпусти — манекен бросит склянку.',
    target: { kind: 'mannequin' },
    dismiss: { kind: 'manualThrow' },
    showSkip: true,
  },
  {
    id: 'w1-aim-bonus',
    trigger: { kind: 'firstManualHit' },
    text: 'Точное попадание ручным броском даёт +20% к урону. Выбирай момент и целься точнее.',
    target: { kind: 'centered' },
    dismiss: { kind: 'auto', afterMs: 4500 },
  },
  {
    // Repair / shield panel — fires the first time the player has
    // the prep window before wave 2, after the throw + manual-hit
    // tutorials have introduced combat. Mannequin clicks only open
    // the popup during prep, so the hint surfaces exactly when the
    // action is reachable.
    id: 'w2-mannequin-shop',
    trigger: { kind: 'prepStart', wave: 2 },
    text: 'Во время подготовки кликни по манекену, чтобы открыть панель ремонта и щита. За золото можно восстановить Прочность или поставить временный щит на 10 секунд.',
    target: { kind: 'mannequin' },
    dismiss: { kind: 'mannequinShopOpened' },
  },
  {
    // Tower placement / upgrade tutorials — surface during the very
    // first prep window (before wave 1) so newcomers learn how to
    // build defenders before the first slime hits the dais. The id
    // still reads `w3-*` for save / i18n stability — the wave it fires
    // on lives in `trigger.wave` below.
    id: 'w3-rune',
    trigger: { kind: 'prepStart', wave: 1 },
    text: 'Кликни по руне рядом с манекеном, чтобы поставить боевую стойку. Стойки можно строить и улучшать только во время подготовки — между волнами.',
    target: { kind: 'rune' },
    dismiss: { kind: 'towerPlaced' },
  },
  {
    id: 'w3-upgrade',
    trigger: { kind: 'prepStart', wave: 1 },
    text: 'Кликни по построенной стойке, чтобы улучшить её. Обычно это дешевле, чем ставить новую, и тоже доступно только во время подготовки.',
    target: { kind: 'firstTower' },
    dismiss: { kind: 'towerUpgraded' },
  },
  {
    // Cursed-cards walkthrough — single-step sequence kicked off by
    // `tutorial.startSequence('cursedDraft', …)` the first time the
    // player is offered a cursed draft (every 3rd wave normally, or
    // every wave during the «Проклятый день» daily event).
    id: 'cursed-cards',
    trigger: { kind: 'cursedDraft' },
    text: 'Проклятые карты: каждая даёт сильный эффект и в придачу 1–2 случайных дополнения — они могут быть как плюсами, так и минусами. Читай все строки карты: если минусы окажутся слишком больными, лучше нажми «Пропустить».',
    target: { kind: 'centered' },
    dismiss: { kind: 'next' },
    showSkip: true,
  },
  {
    id: 'w5-boss',
    trigger: { kind: 'waveStart', wave: 5 },
    text: 'Босс! Заполняй шкалу Перегрузки бросками и стихийными реакциями — когда она полна, активируй модуль манекена.',
    target: { kind: 'hud', selector: '[data-tutorial-target="overload"]', arrow: 'down' },
    dismiss: { kind: 'overloadActivated' },
  },

  // ── Pause-panel walkthrough (first time the player opens the pause
  //    overlay during a run). Played as a single sequence: every step's
  //    dismiss is `next`, so the player advances by clicking the OK
  //    button. Closing the pause panel cancels the rest of the sequence.
  //
  //    Some sections are rendered conditionally inside the pause overlay
  //    (contracts only show up on Epic / Ancient, blessings on Epic / Ancient,
  //    etc.). Steps with optional targets fall back to a centered tip
  //    when the targeted element isn't on-screen.
  {
    id: 'pause-intro',
    trigger: { kind: 'pauseOpen' },
    text: 'Это панель паузы. Здесь собрана вся статистика забега: активные эффекты, законы подземелья, контракты и цели.',
    target: { kind: 'hud', selector: '[data-tutorial-target="pause-title"]', arrow: 'up' },
    dismiss: { kind: 'next' },
    showSkip: true,
  },
  {
    id: 'pause-player-stats',
    trigger: { kind: 'pauseOpen' },
    text: 'Слева — модификаторы игрока: урон, скорострельность и экономика. Здесь суммируются все выбранные карты.',
    target: { kind: 'hud', selector: '[data-tutorial-target="pause-player-stats"]', arrow: 'right' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'pause-unique',
    trigger: { kind: 'pauseOpen' },
    text: 'Уникальные эффекты — стихии и редкие синергии от карт. Здесь видно, чем именно бьют твои склянки и стойки.',
    target: { kind: 'hud', selector: '[data-tutorial-target="pause-unique"]', arrow: 'right' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'pause-enemy-stats',
    trigger: { kind: 'pauseOpen' },
    text: 'Модификаторы врагов от выбранной сложности: Прочность, скорость и урон. Способности отдельных врагов смотри в Дневнике алхимика.',
    target: { kind: 'hud', selector: '[data-tutorial-target="pause-enemy-stats"]', arrow: 'right' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'pause-blessings',
    trigger: { kind: 'pauseOpen' },
    text: 'Дар алхимика — благословение и проклятие, которые ты выбрал перед стартом Эпического или Древнего забега.',
    target: { kind: 'hud', selector: '[data-tutorial-target="pause-blessings"]', arrow: 'left' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'pause-mutators',
    trigger: { kind: 'pauseOpen' },
    text: 'Закон подземелья — модификатор волны. В Эпическом и Древнем забеге он меняет условия боя.',
    target: { kind: 'hud', selector: '[data-tutorial-target="pause-mutators"]', arrow: 'left' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'pause-contracts',
    trigger: { kind: 'pauseOpen' },
    text: 'Контракты — цели Эпического и Древнего забегов. Прогресс и награды отображаются здесь же; провал не завершает забег, но отменяет приз.',
    target: { kind: 'hud', selector: '[data-tutorial-target="pause-contracts"]', arrow: 'left' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'pause-endless',
    trigger: { kind: 'pauseOpen' },
    text: 'В Бесконечном режиме после каждого 15-волнового круга добавляются новые модификаторы; все активные показаны здесь.',
    target: { kind: 'hud', selector: '[data-tutorial-target="pause-endless"]', arrow: 'left' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'pause-exit',
    trigger: { kind: 'pauseOpen' },
    text: 'Кнопка «Выйти в меню» досрочно завершает забег. Потраченный эпический или древний ключ при этом не возвращается.',
    target: { kind: 'hud', selector: '[data-tutorial-target="pause-exit"]', arrow: 'down' },
    dismiss: { kind: 'next' },
  },

  // ── Main-menu walkthrough (first time the player lands on the main
  //    menu after creating a save). Same sequence semantics as the pause
  //    walkthrough — `next` everywhere, skip cancels the rest.
  {
    id: 'menu-intro',
    trigger: { kind: 'mainMenuOpen' },
    text: 'Это главное меню: здесь ты готовишься к забегу и забираешь награды между ними.',
    target: { kind: 'centered' },
    dismiss: { kind: 'next' },
    showSkip: true,
  },
  {
    id: 'menu-shop',
    trigger: { kind: 'mainMenuOpen' },
    text: 'Зельеварка. Из ингредиентов, выпавших в забегах, можно варить зелья и брать до 4 штук в следующий забег. Кликни по карточке, чтобы открыть.',
    target: { kind: 'hud', selector: '[data-tutorial-target="menu-shop"]', arrow: 'right' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'menu-laboratory',
    trigger: { kind: 'mainMenuOpen' },
    text: 'Лаборатория талантов — постоянные улучшения за синюю и древнюю эссенцию. Бонусы действуют во всех будущих забегах.',
    target: { kind: 'hud', selector: '[data-tutorial-target="menu-laboratory"]', arrow: 'right' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'menu-loadout',
    trigger: { kind: 'mainMenuOpen' },
    text: 'Снаряжение манекена. Выбери один активный модуль для Перегрузки и одну пассивную ауру — по одному эффекту в каждый слот.',
    target: { kind: 'hud', selector: '[data-tutorial-target="menu-loadout"]', arrow: 'right' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'menu-diary',
    trigger: { kind: 'mainMenuOpen' },
    text: 'Дневник алхимика. Вкладки: Алхимия, Синергии, Бестиарий и Стойки. Здесь можно изучить стихии, реакции, врагов и характеристики башен.',
    target: { kind: 'hud', selector: '[data-tutorial-target="menu-diary"]', arrow: 'left' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'menu-leaderboard',
    trigger: { kind: 'mainMenuOpen' },
    text: 'Таблицы лидеров. Сравнивай свои результаты в бесконечном режиме и дневном эксперименте с результатами других игроков.',
    target: { kind: 'hud', selector: '[data-tutorial-target="menu-leaderboard"]', arrow: 'left' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'menu-daily',
    trigger: { kind: 'mainMenuOpen' },
    text: 'Ежедневные награды. Заходи раз в день, чтобы забрать золото, ключи и эссенцию. Кнопка «Забрать!» активна, пока висит восклицательный знак.',
    target: { kind: 'hud', selector: '[data-tutorial-target="menu-daily"]', arrow: 'left' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'menu-battle',
    trigger: { kind: 'mainMenuOpen' },
    text: 'Готов? Жми «В БОЙ», выбирай сложность и начинай забег. Удачи!',
    target: { kind: 'hud', selector: '[data-tutorial-target="menu-battle"]', arrow: 'down' },
    dismiss: { kind: 'next' },
  },

  // ── Settings walkthrough (first time the player opens the settings
  //    panel from the main menu / pause / boot menu — whichever surfaces
  //    the gear icon first). Same sequence semantics as pause / main-
  //    menu — `next` everywhere, skip cancels the rest. We deliberately
  //    surface the *animation* row early because the most-asked phone
  //    perf complaint ("game lags on Android") is solved by switching it
  //    to "Минимум", and players struggle to find that toggle without a
  //    pointer.
  {
    id: 'settings-intro',
    trigger: { kind: 'settingsOpen' },
    text: 'Это панель настроек: здесь можно подстроить громкость, язык, анимации и проверить статистику. Тут же кнопка сброса прогресса.',
    target: { kind: 'centered' },
    dismiss: { kind: 'next' },
    showSkip: true,
  },
  {
    id: 'settings-audio',
    trigger: { kind: 'settingsOpen' },
    text: 'Звук — два ползунка: «Эффекты» (выстрелы, взрывы, клики UI) и «Музыка» (фоновая мелодия в забеге и меню). Изменения применяются на лету; смело двигай прямо во время игры.',
    target: { kind: 'hud', selector: '[data-tutorial-target="settings-audio"]', arrow: 'right' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'settings-language',
    trigger: { kind: 'settingsOpen' },
    text: 'Язык интерфейса. Сейчас доступны русский и английский — переключение мгновенное, перезапуск не требуется.',
    target: { kind: 'hud', selector: '[data-tutorial-target="settings-language"]', arrow: 'right' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'settings-motion',
    trigger: { kind: 'settingsOpen' },
    text: 'Анимации: «Авто» — по системным настройкам устройства, «Минимум» — отключает декоративные эффекты (рекомендуется на телефоне, если игра подтормаживает), «Полные» — все эффекты включены. Это самый важный пункт для слабых устройств.',
    target: { kind: 'hud', selector: '[data-tutorial-target="settings-motion"]', arrow: 'right' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'settings-stats',
    trigger: { kind: 'settingsOpen' },
    text: 'Статистика — твой долгосрочный прогресс: количество забегов, лучшая волна, накопленные эссенции и ключи. Эти числа сохраняются между сессиями.',
    target: { kind: 'hud', selector: '[data-tutorial-target="settings-stats"]', arrow: 'right' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'settings-reset',
    trigger: { kind: 'settingsOpen' },
    text: 'Сброс прогресса полностью обнуляет сохранение: эссенции, ключи, рецепты, бестиарий и все таланты. Откатить нельзя — кнопка перед этим показывает подтверждение.',
    target: { kind: 'hud', selector: '[data-tutorial-target="settings-reset"]', arrow: 'right' },
    dismiss: { kind: 'next' },
  },
];
