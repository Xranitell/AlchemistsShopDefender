/**
 * Declarative FTUE / tutorial steps (GDD §18 / PR-8).
 *
 * Steps are *pulled* by the TutorialController as triggers are emitted
 * during the first run. The flow is intentionally non-blocking — a step
 * surfaces a tooltip + spotlight, and the player can keep playing while
 * reading. Each step dismisses itself either:
 *   - automatically when the matching gameplay action is performed
 *     (e.g. "first manual throw" hides the throw tooltip), or
 *   - on a hard timeout if the player ignores it.
 *
 * A step is shown at most once; the controller persists nothing yet, but
 * once wave 5 is cleared the meta-save flag `tutorialDone` is set so the
 * tutorial never triggers again.
 */

export type TutorialTrigger =
  /** Play this step the moment the given (1-based) wave starts. */
  | { kind: 'waveStart'; wave: number }
  /** Play once the player lands their first manual-aim hit (potion). */
  | { kind: 'firstManualHit' }
  /** Play once the player picks their first card after wave 1. */
  | { kind: 'firstCardPicked' };

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
  | { kind: 'auto'; afterMs: number };

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
];
