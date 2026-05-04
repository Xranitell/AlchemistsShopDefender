import { TUTORIAL_STEPS, type TutorialDismiss, type TutorialStep, type TutorialTarget, type TutorialTrigger } from '../data/tutorial';
import type { GameState } from '../game/state';
import { worldToScreen } from '../render/camera';
import { getRenderCamera } from '../game/render';
import { t, tWithFallback } from '../i18n';

/**
 * Game-side events the tutorial reacts to. Emitted from gameplay code via
 * `tutorial.notify(...)` rather than a global eventbus so the dependency is
 * explicit and TS-checked.
 */
export type TutorialEventKind =
  | 'manualThrow'
  | 'manualHit'
  | 'cardPicked'
  | 'towerPlaced'
  | 'towerUpgraded'
  | 'overloadActivated';

/** Trigger kinds that map to panel-bound walkthroughs (non-wave). */
type SequenceTriggerKind = 'pauseOpen' | 'mainMenuOpen';

interface ResolvedTarget {
  /** Centre of the spotlight, in viewport pixels. */
  cx: number;
  cy: number;
  /** Spotlight radius, in viewport pixels. */
  radius: number;
}

interface SequenceCallbacks {
  /** Fired when the player clicks the panel-step "Skip" button. The
   *  caller is expected to flip the meta-save flag so the sequence
   *  doesn't replay on the next session. */
  onSkip?: () => void;
  /** Fired exactly once when every step in the sequence has been
   *  dismissed cleanly via the OK button (i.e. the player walked through
   *  the whole thing). The caller flips the meta-save flag. */
  onComplete?: () => void;
}

/**
 * Tutorial controller (FTUE / GDD §18). Manages a single non-modal overlay
 * sitting above the game canvas + HUD. The overlay consists of:
 *  - a soft full-screen dimmer with an SVG mask cutout around the spotlight,
 *  - a tooltip card with the step text + optional "skip tutorial" button,
 *  - an arrow glyph pointing at the spotlight target.
 *
 * The overlay uses `pointer-events: none` everywhere except its tooltip so
 * the player can keep interacting with the game while a hint is shown — the
 * GDD explicitly calls out that the tutorial must not block input during
 * critical moments.
 *
 * In addition to the wave-based FTUE flow, the controller also drives
 * panel-bound *sequences* — walkthroughs that fire the first time the
 * player opens a particular UI surface (pause panel, main menu). Each
 * sequence is a flat list of steps drawn from `TUTORIAL_STEPS`, played
 * in declaration order, advanced by the player clicking "Далее"/"Next".
 * Sequences are independent of the wave-based `active` flag — they can
 * run between runs (main menu) or during a run (pause), and they expose
 * `onComplete` / `onSkip` callbacks so the caller can persist a "done"
 * flag in the meta-save.
 */
class TutorialController {
  private root: HTMLDivElement | null = null;
  private dimmerMaskCircle: SVGCircleElement | null = null;
  private tooltipEl: HTMLDivElement | null = null;
  private tooltipText: HTMLParagraphElement | null = null;
  private tooltipActions: HTMLDivElement | null = null;
  private arrowEl: HTMLDivElement | null = null;

  private canvas: HTMLCanvasElement | null = null;
  /** Wave-based tutorial active flag — set by `start()`, cleared by
   *  `stop()`. Independent from the panel-sequence active flag below. */
  private active = false;
  private currentStep: TutorialStep | null = null;
  private currentDismissTimer: number | null = null;
  private completed = new Set<string>();
  private lastWaveIndex = -1;
  private lastPrepIndex = -1;
  /** Snapshot of the latest game state, refreshed every frame via update(). */
  private lastState: GameState | null = null;

  /** Skip callback for the wave-based FTUE — flips `meta.tutorialDone`. */
  private skipCallback: (() => void) | null = null;

  /** Active panel sequence (pauseOpen / mainMenuOpen) trigger, if any. */
  private sequenceTrigger: SequenceTriggerKind | null = null;
  private sequenceCallbacks: SequenceCallbacks | null = null;

  /** Initialise the controller and attach to the DOM. Idempotent. */
  attach(canvas: HTMLCanvasElement, opts: { onSkip?: () => void } = {}): void {
    this.canvas = canvas;
    this.skipCallback = opts.onSkip ?? null;
    if (this.root) return;
    this.buildDom();
  }

  /** Begin the wave-based tutorial. Should only be called when the
   *  player hasn't finished it before (i.e. `meta.tutorialDone === false`). */
  start(): void {
    this.active = true;
    this.completed.clear();
    this.lastWaveIndex = -1;
    this.lastPrepIndex = -1;
    this.refreshRootVisibility();
  }

  /** Stop the wave-based tutorial entirely (skip button or completion). */
  stop(): void {
    this.active = false;
    if (this.currentStep && !this.isSequenceStep(this.currentStep)) {
      this.hideStep();
    }
    this.refreshRootVisibility();
  }

  /** Drive the wave-based triggers and re-position the spotlight on the
   *  current frame. Must be called every game tick. */
  update(state: GameState): void {
    this.lastState = state;
    if (this.active) {
      // `waveStart` fires when wave N's combat begins; `prepStart` fires
      // during the prep window leading into wave N (so prep-only hints
      // like tower placement appear when the player can actually act).
      // The +2 during prep accounts for `currentIndex` still pointing
      // at the just-finished wave while `pauseDurationLeft` ticks down
      // toward the next one.
      const idx = state.waveState.currentIndex;
      if (state.phase === 'wave') {
        const wave = idx + 1;
        if (wave !== this.lastWaveIndex) {
          this.lastWaveIndex = wave;
          this.tryFireWaveStart(wave);
        }
      } else if (state.phase === 'preparing') {
        const upcoming = idx + 2;
        if (upcoming !== this.lastPrepIndex) {
          this.lastPrepIndex = upcoming;
          this.tryFirePrepStart(upcoming);
        }
      }
    }

    if (this.currentStep) {
      this.positionSpotlight(this.currentStep.target);
    }
  }

  /** Push a gameplay event. Resolves matching dismiss conditions and
   *  trigger conditions (`firstManualHit`, `firstCardPicked`). */
  notify(kind: TutorialEventKind): void {
    if (!this.active) return;

    // Trigger-style events.
    if (kind === 'manualHit') this.tryFireImmediate('firstManualHit');
    if (kind === 'cardPicked') this.tryFireImmediate('firstCardPicked');

    // Dismiss-style events for the active step.
    if (!this.currentStep) return;
    const d = this.currentStep.dismiss;
    if (
      (kind === 'manualThrow' && d.kind === 'manualThrow') ||
      (kind === 'manualHit' && d.kind === 'manualHit') ||
      (kind === 'cardPicked' && d.kind === 'cardPicked') ||
      (kind === 'towerPlaced' && d.kind === 'towerPlaced') ||
      (kind === 'towerUpgraded' && d.kind === 'towerUpgraded') ||
      (kind === 'overloadActivated' && d.kind === 'overloadActivated')
    ) {
      this.completeStep();
    }
  }

  /** Called by main.ts when wave 5 finishes — flips the meta-save flag so
   *  the tutorial never runs again. */
  isActive(): boolean { return this.active; }

  /** True when a tutorial tooltip is currently on-screen. Used by main.ts
   *  to freeze the simulation while the player reads the hint. */
  isShowingStep(): boolean { return this.currentStep !== null; }

  /** True when a panel-bound sequence is currently running (or queued to
   *  resume after a 350ms pause between steps). */
  isSequenceActive(): boolean { return this.sequenceTrigger !== null; }

  // -- Panel sequences -----------------------------------------------------

  /** Kick off a panel-bound walkthrough. All steps in `TUTORIAL_STEPS`
   *  with `trigger.kind === triggerKind` are queued in declaration
   *  order; the first one whose target resolves is shown immediately,
   *  and subsequent steps fire as the player advances via the OK
   *  button. Steps whose target element isn't in the DOM (e.g. the
   *  contracts section on a Normal run) are silently skipped.
   *
   *  If a sequence with the same trigger is already active, this is a
   *  no-op so opening / re-opening the panel doesn't restart the walk-
   *  through halfway through. Calling with a different trigger cancels
   *  the in-flight sequence first.
   */
  startSequence(triggerKind: SequenceTriggerKind, callbacks?: SequenceCallbacks): void {
    if (this.sequenceTrigger === triggerKind) return;
    // Don't trample on an in-flight wave-tutorial step — the player is
    // still mid-FTUE and the wave hint is more important than the panel
    // walkthrough. The sequence will start naturally the next time the
    // player opens the panel (typically after the wave hint resolves).
    if (this.currentStep !== null && !this.isSequenceStep(this.currentStep)) return;
    if (this.sequenceTrigger !== null) this.cancelSequence(this.sequenceTrigger);

    const steps = TUTORIAL_STEPS.filter((s) => s.trigger.kind === triggerKind);
    if (steps.length === 0) return;

    this.sequenceTrigger = triggerKind;
    this.sequenceCallbacks = callbacks ?? null;
    this.pendingSteps = steps.slice();
    this.refreshRootVisibility();
    // Pull the first step that has a resolvable target. `advanceSequence`
    // takes care of skipping any leading steps whose target isn't in the
    // DOM yet (e.g. when the panel hasn't fully populated by the time
    // we're called) — for those we still want the walkthrough to start
    // somewhere useful.
    this.advanceSequence();
  }

  /** Tear down an active panel sequence — used when the matching panel
   *  closes. Doesn't fire `onComplete`, but the caller is expected to
   *  flip the meta-save "done" flag itself so the sequence doesn't
   *  replay; we keep this controller agnostic of persistence. */
  cancelSequence(triggerKind: SequenceTriggerKind): void {
    if (this.sequenceTrigger !== triggerKind) return;
    this.sequenceTrigger = null;
    this.sequenceCallbacks = null;
    this.pendingSteps = [];
    if (this.currentStep && this.isSequenceStep(this.currentStep)) {
      this.hideStep();
    }
    this.refreshRootVisibility();
  }

  private isSequenceStep(step: TutorialStep): boolean {
    return step.trigger.kind === 'pauseOpen' || step.trigger.kind === 'mainMenuOpen';
  }

  /** Pop steps off the queue until we find one whose target resolves,
   *  show it, and pass through any whose target isn't in the DOM. If
   *  the queue is exhausted, the sequence completes cleanly. */
  private advanceSequence(): void {
    if (this.sequenceTrigger === null) return;
    while (this.pendingSteps.length > 0) {
      const next = this.pendingSteps.shift();
      if (!next) break;
      if (this.canResolveTarget(next.target)) {
        this.showStep(next);
        return;
      }
      // Mark the unresolved step as completed so re-entering this
      // sequence in the same session doesn't re-queue it.
      this.completed.add(next.id);
    }
    // Nothing left — sequence is done.
    this.finishSequence();
  }

  private finishSequence(): void {
    const cb = this.sequenceCallbacks?.onComplete;
    this.sequenceTrigger = null;
    this.sequenceCallbacks = null;
    this.pendingSteps = [];
    this.hideStep();
    this.refreshRootVisibility();
    if (cb) cb();
  }

  /** Quick check for whether a step's target is currently visible in
   *  the DOM. Used to skip optional pause-panel sections (contracts,
   *  blessings) on runs that don't have them. */
  private canResolveTarget(target: TutorialTarget): boolean {
    if (target.kind === 'centered') return true;
    if (target.kind === 'hud') {
      const el = document.querySelector(target.selector) as HTMLElement | null;
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      // A zero-sized rect means the element is in the DOM but hidden
      // (display:none ancestors collapse to 0×0). Treat as unresolvable.
      return rect.width > 0 && rect.height > 0;
    }
    if (target.kind === 'mannequin') {
      return Boolean(this.lastState?.mannequin);
    }
    if (target.kind === 'rune') {
      return Boolean(this.lastState?.runePoints.some((r) => r.active));
    }
    if (target.kind === 'firstTower') {
      return Boolean(this.lastState && this.lastState.towers.length > 0);
    }
    return false;
  }

  // -- DOM ----------------------------------------------------------------

  private buildDom(): void {
    const root = document.createElement('div');
    root.className = 'tutorial-root hidden';
    root.setAttribute('aria-hidden', 'true');

    // SVG dimmer: full-screen rect with a circular cutout via mask.
    const svgNs = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNs, 'svg');
    svg.classList.add('tutorial-dimmer');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'none');

    const defs = document.createElementNS(svgNs, 'defs');
    const mask = document.createElementNS(svgNs, 'mask');
    mask.setAttribute('id', 'tutorial-mask');
    const maskBg = document.createElementNS(svgNs, 'rect');
    maskBg.setAttribute('width', '100%');
    maskBg.setAttribute('height', '100%');
    maskBg.setAttribute('fill', 'white');
    mask.appendChild(maskBg);
    const maskCircle = document.createElementNS(svgNs, 'circle');
    maskCircle.setAttribute('cx', '0');
    maskCircle.setAttribute('cy', '0');
    maskCircle.setAttribute('r', '0');
    maskCircle.setAttribute('fill', 'black');
    mask.appendChild(maskCircle);
    defs.appendChild(mask);
    svg.appendChild(defs);

    const dim = document.createElementNS(svgNs, 'rect');
    dim.setAttribute('width', '100%');
    dim.setAttribute('height', '100%');
    dim.setAttribute('fill', 'rgba(8, 6, 16, 0.55)');
    dim.setAttribute('mask', 'url(#tutorial-mask)');
    svg.appendChild(dim);

    // A glowing ring on top of the spotlight to draw the eye.
    const ring = document.createElementNS(svgNs, 'circle');
    ring.classList.add('tutorial-spotlight-ring');
    ring.setAttribute('cx', '0');
    ring.setAttribute('cy', '0');
    ring.setAttribute('r', '0');
    ring.setAttribute('fill', 'none');
    ring.setAttribute('stroke', '#f5c453');
    ring.setAttribute('stroke-width', '3');
    svg.appendChild(ring);

    this.dimmerMaskCircle = maskCircle;
    // Track ring updates alongside the cutout.
    this.dimmerRing = ring;
    root.appendChild(svg);

    // Tooltip card.
    const tip = document.createElement('div');
    tip.className = 'tutorial-tooltip';
    const text = document.createElement('p');
    text.className = 'tutorial-text';
    tip.appendChild(text);
    const actions = document.createElement('div');
    actions.className = 'tutorial-actions';
    tip.appendChild(actions);
    root.appendChild(tip);

    // Arrow indicator (▲▼◀▶) — repositioned per-step.
    const arrow = document.createElement('div');
    arrow.className = 'tutorial-arrow hidden';
    arrow.textContent = '▼';
    root.appendChild(arrow);

    this.tooltipEl = tip;
    this.tooltipText = text;
    this.tooltipActions = actions;
    this.arrowEl = arrow;

    document.body.appendChild(root);
    this.root = root;
  }

  // Spotlight ring is captured separately so we can update r/cx/cy on it.
  private dimmerRing: SVGCircleElement | null = null;

  /** Toggle root visibility and z-index based on whether anything is
   *  active. Sequences raise the layer above the modal panels (pause
   *  overlay z=2000) so the dimmer / tooltip render on top. */
  private refreshRootVisibility(): void {
    if (!this.root) return;
    const visible = this.active || this.sequenceTrigger !== null;
    this.root.classList.toggle('hidden', !visible);
    this.root.classList.toggle('over-modal', this.sequenceTrigger !== null);
  }

  // -- Step lifecycle ------------------------------------------------------

  private tryFireWaveStart(wave: number): void {
    for (const step of TUTORIAL_STEPS) {
      if (step.trigger.kind !== 'waveStart') continue;
      if (step.trigger.wave !== wave) continue;
      if (this.completed.has(step.id)) continue;
      this.showStep(step);
      // Stop after the first match — multiple steps with the same wave
      // (e.g. the W3 rune + upgrade tips) are queued via `pendingSteps`.
      this.pendingSteps = TUTORIAL_STEPS.filter(
        (s) =>
          s !== step &&
          !this.completed.has(s.id) &&
          s.trigger.kind === 'waveStart' &&
          s.trigger.wave === wave,
      );
      return;
    }
  }

  /** Like tryFireWaveStart but for `prepStart` triggers — fires during the
   *  preparing phase so hints that need between-wave interaction (tower
   *  placement) appear while the player can actually act on them. */
  private tryFirePrepStart(wave: number): void {
    for (const step of TUTORIAL_STEPS) {
      if (step.trigger.kind !== 'prepStart') continue;
      if (step.trigger.wave !== wave) continue;
      if (this.completed.has(step.id)) continue;
      this.showStep(step);
      this.pendingSteps = TUTORIAL_STEPS.filter(
        (s) =>
          s !== step &&
          !this.completed.has(s.id) &&
          s.trigger.kind === 'prepStart' &&
          s.trigger.wave === wave,
      );
      return;
    }
  }

  private pendingSteps: TutorialStep[] = [];

  private tryFireImmediate(triggerKind: 'firstManualHit' | 'firstCardPicked'): void {
    for (const step of TUTORIAL_STEPS) {
      if (this.completed.has(step.id)) continue;
      if (step.trigger.kind !== triggerKind) continue;
      // Skip if this step is already the active one — re-calling showStep
      // would tear down its DOM, restart the auto-dismiss timer and prevent
      // the timeout from ever expiring while the player keeps producing the
      // triggering event (e.g. landing manual hits in quick succession).
      // Order matters: this check must run *after* the triggerKind filter so
      // an active manualHit step doesn't block a `cardPicked` lookup from
      // reaching `w2-cards` later in the list.
      if (this.currentStep?.id === step.id) return;
      this.showStep(step);
      return;
    }
  }

  private showStep(step: TutorialStep): void {
    // Hide any active step before showing the new one — only one tooltip
    // at a time, otherwise the screen gets cluttered fast.
    this.hideStep();
    this.currentStep = step;
    if (!this.tooltipText || !this.tooltipActions || !this.root || !this.arrowEl) return;

    this.tooltipText.textContent = tWithFallback(`tutorial.${step.id}`, step.text);
    this.tooltipActions.innerHTML = '';
    // Close button — always present so the player can dismiss any tutorial
    // step at will (critical for steps like tower-upgrade where the player
    // may not have the gold to proceed). For sequence steps the button
    // reads "Далее" / "Next" so the player understands clicking it
    // advances the walkthrough rather than ending it.
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tutorial-ok-btn';
    const isSeqStep = this.isSequenceStep(step);
    const isLast = isSeqStep && this.pendingSteps.length === 0;
    if (isSeqStep && !isLast) {
      closeBtn.textContent = t('ui.tutorial.next');
    } else if (isSeqStep && isLast) {
      closeBtn.textContent = t('ui.tutorial.done');
    } else {
      closeBtn.textContent = t('ui.tutorial.ok');
    }
    closeBtn.addEventListener('click', () => this.completeStep());
    this.tooltipActions.appendChild(closeBtn);

    if (step.showSkip) {
      const skipBtn = document.createElement('button');
      skipBtn.className = 'tutorial-skip-btn';
      skipBtn.textContent = t('ui.tutorial.skip');
      skipBtn.addEventListener('click', () => {
        this.skipAll();
      });
      this.tooltipActions.appendChild(skipBtn);
    }

    if (step.target.kind === 'hud' && this.arrowEl) {
      this.arrowEl.classList.remove('hidden');
      this.arrowEl.textContent = arrowGlyph(step.target.arrow);
    } else if (step.target.kind === 'centered') {
      this.arrowEl.classList.add('hidden');
    } else {
      this.arrowEl.classList.remove('hidden');
      this.arrowEl.textContent = '▼';
    }

    this.root.classList.add('step-visible');
    this.positionSpotlight(step.target);

    if (step.dismiss.kind === 'auto') {
      this.currentDismissTimer = window.setTimeout(
        () => this.completeStep(),
        step.dismiss.afterMs,
      );
    }
  }

  private hideStep(): void {
    if (this.currentDismissTimer !== null) {
      clearTimeout(this.currentDismissTimer);
      this.currentDismissTimer = null;
    }
    this.currentStep = null;
    if (this.root) this.root.classList.remove('step-visible');
    if (this.dimmerMaskCircle) this.dimmerMaskCircle.setAttribute('r', '0');
    if (this.dimmerRing) this.dimmerRing.setAttribute('r', '0');
    if (this.arrowEl) this.arrowEl.classList.add('hidden');
  }

  private completeStep(): void {
    if (!this.currentStep) return;
    const step = this.currentStep;
    this.completed.add(step.id);
    this.hideStep();
    if (this.isSequenceStep(step)) {
      // Walk forward through the sequence — `advanceSequence` will pop
      // the next valid step (or finish cleanly when the queue empties).
      // Slight delay so the previous tooltip visibly fades out before
      // the next one materialises.
      window.setTimeout(() => {
        if (this.sequenceTrigger !== null) this.advanceSequence();
      }, 200);
      return;
    }
    // Wave-based: pop the next queued same-wave step (used for multiple
    // W3 tips in sequence).
    const next = this.pendingSteps.shift();
    if (next) {
      window.setTimeout(() => {
        if (this.active) this.showStep(next);
      }, 350);
    }
  }

  private skipAll(): void {
    if (this.currentStep && this.isSequenceStep(this.currentStep)) {
      // Sequence skip — only abort this sequence, leave the wave-based
      // tutorial running if it happens to be active too.
      const cb = this.sequenceCallbacks?.onSkip;
      this.sequenceTrigger = null;
      this.sequenceCallbacks = null;
      this.pendingSteps = [];
      this.hideStep();
      this.refreshRootVisibility();
      if (cb) cb();
      return;
    }
    // Wave-based skip — full FTUE bail-out, mark every step as seen.
    this.completed = new Set(TUTORIAL_STEPS.map((s) => s.id));
    this.pendingSteps = [];
    this.hideStep();
    if (this.skipCallback) this.skipCallback();
    this.stop();
  }

  // -- Positioning ---------------------------------------------------------

  private positionSpotlight(target: TutorialTarget): void {
    const resolved = this.resolveTarget(target);
    if (!resolved || !this.dimmerMaskCircle || !this.dimmerRing || !this.tooltipEl || !this.arrowEl) {
      return;
    }
    const { cx, cy, radius } = resolved;
    this.dimmerMaskCircle.setAttribute('cx', String(cx));
    this.dimmerMaskCircle.setAttribute('cy', String(cy));
    this.dimmerMaskCircle.setAttribute('r', String(radius + 8));
    this.dimmerRing.setAttribute('cx', String(cx));
    this.dimmerRing.setAttribute('cy', String(cy));
    this.dimmerRing.setAttribute('r', String(radius));

    // Position the tooltip so it doesn't cover the spotlight. Default:
    // place it below; if that runs off-screen, place it above. For very
    // large targets (e.g. a tall main-menu card) the spotlight radius
    // can exceed the viewport, in which case both candidates may be
    // off-screen — clamp the result so the tooltip stays visible no
    // matter how big the spotlight is.
    const rect = this.tooltipEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - (cy + radius);
    const spaceAbove = cy - radius;
    let tipY: number;
    let arrowAbove = false;
    if (target.kind === 'centered') {
      tipY = cy + radius + 24;
    } else if (spaceBelow >= rect.height + 32) {
      tipY = cy + radius + 24;
    } else if (spaceAbove >= rect.height + 32) {
      tipY = cy - radius - rect.height - 24;
      arrowAbove = true;
    } else {
      // Neither side fits — pin to the viewport edge with the larger
      // gap and let the tooltip overlap the spotlight border instead of
      // disappearing. The arrow is hidden in this case so it doesn't
      // float in the middle of the dimmer.
      if (spaceBelow >= spaceAbove) {
        tipY = window.innerHeight - rect.height - 16;
      } else {
        tipY = 16;
        arrowAbove = true;
      }
    }
    let tipX = cx - rect.width / 2;
    tipX = Math.max(16, Math.min(window.innerWidth - rect.width - 16, tipX));
    if (target.kind === 'centered') {
      tipX = window.innerWidth / 2 - rect.width / 2;
      tipY = window.innerHeight / 2 - rect.height / 2;
    }
    // Final clamp: even with the above logic, a viewport smaller than
    // the tooltip itself (rare, but possible on phones in landscape)
    // would still produce off-screen coordinates. Pin to (16, 16) at
    // worst — the tooltip text wraps and the player can scroll if the
    // panel below it is itself scrollable.
    tipY = Math.max(16, Math.min(window.innerHeight - rect.height - 16, tipY));
    this.tooltipEl.style.left = `${tipX}px`;
    this.tooltipEl.style.top = `${tipY}px`;

    // Arrow points from the tooltip toward the spotlight.
    if (target.kind === 'centered') {
      this.arrowEl.classList.add('hidden');
    } else {
      this.arrowEl.classList.remove('hidden');
      this.arrowEl.textContent = arrowAbove ? '▲' : '▼';
      this.arrowEl.style.left = `${cx - 12}px`;
      this.arrowEl.style.top = arrowAbove ? `${tipY + rect.height + 4}px` : `${tipY - 28}px`;
    }
  }

  private resolveTarget(target: TutorialTarget): ResolvedTarget | null {
    if (target.kind === 'hud') {
      const el = document.querySelector(target.selector) as HTMLElement | null;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      // Spotlight radius = the circle that exactly encompasses the
      // target rectangle (all four corners on the ring). This keeps
      // the highlight tight around wide-and-short panel sections like
      // "Бонусы игрока" instead of producing a giant circle dictated
      // by the longer edge alone. We pad by 12px so the ring doesn't
      // visually clip the rect's stroke.
      const half = Math.sqrt(
        (rect.width / 2) * (rect.width / 2) +
          (rect.height / 2) * (rect.height / 2),
      );
      // Cap the radius at ~40% of the viewport's shorter side so the
      // tooltip below/above the spotlight has room to breathe even for
      // very tall or wide cards (e.g. the leaderboard column).
      const cap = Math.min(window.innerWidth, window.innerHeight) * 0.4;
      return {
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        radius: Math.min(half + 12, cap),
      };
    }
    if (target.kind === 'centered') {
      return { cx: window.innerWidth / 2, cy: window.innerHeight / 2, radius: 0 };
    }
    if (!this.canvas || !this.lastState) return null;
    const rect = this.canvas.getBoundingClientRect();
    const camera = getRenderCamera(this.lastState.arena.width, this.lastState.arena.height);

    let world: { x: number; y: number } | null = null;
    let radius = 60;
    if (target.kind === 'mannequin') {
      world = this.lastState.mannequin.pos;
      radius = 60;
    } else if (target.kind === 'rune') {
      // First inactive rune (no tower yet) — that's what the player should
      // click. Falls back to any active rune.
      const empty = this.lastState.runePoints.find((r) => r.active && r.towerId === null);
      const any = empty ?? this.lastState.runePoints.find((r) => r.active);
      if (any) {
        world = any.pos;
        radius = 38;
      }
    } else if (target.kind === 'firstTower') {
      const t = this.lastState.towers[0];
      if (t) {
        world = t.pos;
        radius = 42;
      }
    }
    if (!world) return null;
    const screen = worldToScreen(world.x, world.y, camera);
    // Convert canvas-space pixels into viewport-space pixels.
    const sx = rect.left + screen.x * (rect.width / this.canvas.width);
    const sy = rect.top + screen.y * (rect.height / this.canvas.height);
    return { cx: sx, cy: sy, radius };
  }
}

function arrowGlyph(d: 'down' | 'up' | 'left' | 'right'): string {
  switch (d) {
    case 'up': return '▲';
    case 'left': return '◀';
    case 'right': return '▶';
    case 'down':
    default:
      return '▼';
  }
}

/** Singleton — imported wherever gameplay code emits tutorial events. */
export const tutorial = new TutorialController();

// Type-only re-exports so consumers don't need to import from data/.
export type { TutorialDismiss, TutorialTrigger };
