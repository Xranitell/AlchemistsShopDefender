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
  /** Play once the player lands their first manual-aim hit (potion). */
  | { kind: 'firstManualHit' }
  /** Play once the player picks their first card after wave 1. */
  | { kind: 'firstCardPicked' }
  /** Played by `tutorial.startSequence('pauseOpen', …)` when the player
   *  opens the pause-stats panel for the first time. All steps that share
   *  this trigger run in the order they appear in `TUTORIAL_STEPS`. */
  | { kind: 'pauseOpen' }
  /** Played by `tutorial.startSequence('mainMenuOpen', …)` when the
   *  player lands on the main menu for the first time. */
  | { kind: 'mainMenuOpen' };

export type TutorialDismiss =
  /** Player threw a potion (mouse press in arena). */
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
    text: 'Зажми ЛКМ, чтобы прицелиться, и отпусти — манекен швырнёт зелье.',
    target: { kind: 'mannequin' },
    dismiss: { kind: 'manualThrow' },
    showSkip: true,
  },
  {
    id: 'w1-aim-bonus',
    trigger: { kind: 'firstManualHit' },
    text: 'Точное попадание ручным броском даёт +20% урона. Целься, не спамь.',
    target: { kind: 'centered' },
    dismiss: { kind: 'auto', afterMs: 4500 },
  },
  {
    id: 'w2-cards',
    trigger: { kind: 'firstCardPicked' },
    text: 'Отлично! Каждые 3 волны выбираешь карту улучшения. Они складываются в синергии.',
    target: { kind: 'centered' },
    dismiss: { kind: 'auto', afterMs: 4500 },
  },
  {
    id: 'w3-rune',
    trigger: { kind: 'waveStart', wave: 3 },
    text: 'Кликни на руну рядом с манекеном, чтобы поставить туда автоматическую стойку.',
    target: { kind: 'rune' },
    dismiss: { kind: 'towerPlaced' },
  },
  {
    id: 'w3-upgrade',
    trigger: { kind: 'waveStart', wave: 3 },
    text: 'Кликни по своей стойке, чтобы прокачать её — это сильно дешевле, чем ставить новую.',
    target: { kind: 'firstTower' },
    dismiss: { kind: 'towerUpgraded' },
  },
  {
    id: 'w5-boss',
    trigger: { kind: 'waveStart', wave: 5 },
    text: 'Босс! Заполни шкалу Перегруза реакциями и бросками — потом нажми кнопку, чтобы ударить молнией.',
    target: { kind: 'hud', selector: '[data-tutorial-target="overload"]', arrow: 'down' },
    dismiss: { kind: 'overloadActivated' },
  },

  // ── Pause-panel walkthrough (first time the player opens the pause
  //    overlay during a run). Played as a single sequence: every step's
  //    dismiss is `next`, so the player advances by clicking the OK
  //    button. Closing the pause panel cancels the rest of the sequence.
  //
  //    Some sections are rendered conditionally inside the pause overlay
  //    (contracts only show up on Daily, blessings on Epic / Ancient,
  //    etc.). Steps with optional targets fall back to a centered tip
  //    when the targeted element isn't on-screen.
  {
    id: 'pause-intro',
    trigger: { kind: 'pauseOpen' },
    text: 'Это панель паузы. Здесь видно всю статистику забега, активные эффекты, законы подземелья, контракты и цели.',
    target: { kind: 'hud', selector: '[data-tutorial-target="pause-title"]', arrow: 'up' },
    dismiss: { kind: 'next' },
    showSkip: true,
  },
  {
    id: 'pause-player-stats',
    trigger: { kind: 'pauseOpen' },
    text: 'Слева — модификаторы игрока: урон, скорострельность, экономика. Сюда складываются все взятые карты.',
    target: { kind: 'hud', selector: '[data-tutorial-target="pause-player-stats"]', arrow: 'right' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'pause-unique',
    trigger: { kind: 'pauseOpen' },
    text: 'Уникальные эффекты — стихии и редкие синергии от карт. Тут видно, чем именно бьют твои зелья и стойки.',
    target: { kind: 'hud', selector: '[data-tutorial-target="pause-unique"]', arrow: 'right' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'pause-enemy-stats',
    trigger: { kind: 'pauseOpen' },
    text: 'Модификаторы врагов от выбранной сложности: их HP, скорость и урон. Здесь же — особые способности режима.',
    target: { kind: 'hud', selector: '[data-tutorial-target="pause-enemy-stats"]', arrow: 'right' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'pause-blessings',
    trigger: { kind: 'pauseOpen' },
    text: 'Дар алхимика — благословение и проклятие, которые ты выбрал на старте Эпического или Древнего забега.',
    target: { kind: 'hud', selector: '[data-tutorial-target="pause-blessings"]', arrow: 'left' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'pause-mutators',
    trigger: { kind: 'pauseOpen' },
    text: 'Закон подземелья меняется каждые несколько волн в Эпике и Древнем — он усиливает врагов.',
    target: { kind: 'hud', selector: '[data-tutorial-target="pause-mutators"]', arrow: 'left' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'pause-contracts',
    trigger: { kind: 'pauseOpen' },
    text: 'Контракты — это цели забега. Прогресс и награды отображаются здесь же; провал не закрывает забег, но забирает приз.',
    target: { kind: 'hud', selector: '[data-tutorial-target="pause-contracts"]', arrow: 'left' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'pause-endless',
    trigger: { kind: 'pauseOpen' },
    text: 'В Бесконечном режиме после 15-й волны добавляются модификаторы — все активные показаны здесь.',
    target: { kind: 'hud', selector: '[data-tutorial-target="pause-endless"]', arrow: 'left' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'pause-exit',
    trigger: { kind: 'pauseOpen' },
    text: 'Кнопка «Выйти в меню» досрочно завершает забег. Потраченный ключ Эпика или Древнего при этом не возвращается.',
    target: { kind: 'hud', selector: '[data-tutorial-target="pause-exit"]', arrow: 'down' },
    dismiss: { kind: 'next' },
  },

  // ── Main-menu walkthrough (first time the player lands on the main
  //    menu after creating a save). Same sequence semantics as the pause
  //    walkthrough — `next` everywhere, skip cancels the rest.
  {
    id: 'menu-intro',
    trigger: { kind: 'mainMenuOpen' },
    text: 'Это главное меню — отсюда ты готовишься к забегу и забираешь награды между ними.',
    target: { kind: 'centered' },
    dismiss: { kind: 'next' },
    showSkip: true,
  },
  {
    id: 'menu-shop',
    trigger: { kind: 'mainMenuOpen' },
    text: 'Зельеварка. Из ингредиентов, выпавших в забегах, варишь зелья и берёшь до 4 штук в следующий забег. Кликни по карточке, чтобы открыть.',
    target: { kind: 'hud', selector: '[data-tutorial-target="menu-shop"]', arrow: 'right' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'menu-laboratory',
    trigger: { kind: 'mainMenuOpen' },
    text: 'Лаборатория талантов — постоянные апгрейды за синюю и древнюю эссенцию. Бонусы действуют во всех будущих забегах.',
    target: { kind: 'hud', selector: '[data-tutorial-target="menu-laboratory"]', arrow: 'right' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'menu-loadout',
    trigger: { kind: 'mainMenuOpen' },
    text: 'Снаряжение манекена. Выбираешь активный модуль (Перегруз) и пассивную ауру — по одному в каждый слот.',
    target: { kind: 'hud', selector: '[data-tutorial-target="menu-loadout"]', arrow: 'right' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'menu-leaderboard',
    trigger: { kind: 'mainMenuOpen' },
    text: 'Лидерборды. Тут видно, как далеко зашли другие игроки в твоём режиме и в ежедневном испытании.',
    target: { kind: 'hud', selector: '[data-tutorial-target="menu-leaderboard"]', arrow: 'left' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'menu-daily',
    trigger: { kind: 'mainMenuOpen' },
    text: 'Ежедневные награды. Заходи раз в день — золото, ключи и эссенция за пройденные дни. Кнопка «Забрать!» доступна, пока есть восклицательный знак.',
    target: { kind: 'hud', selector: '[data-tutorial-target="menu-daily"]', arrow: 'left' },
    dismiss: { kind: 'next' },
  },
  {
    id: 'menu-battle',
    trigger: { kind: 'mainMenuOpen' },
    text: 'Готов? Жми «В БОЙ», чтобы выбрать сложность и начать забег. Удачи!',
    target: { kind: 'hud', selector: '[data-tutorial-target="menu-battle"]', arrow: 'down' },
    dismiss: { kind: 'next' },
  },
];
