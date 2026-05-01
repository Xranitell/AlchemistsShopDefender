import { TUTORIAL_STEPS, type TutorialDismiss, type TutorialStep, type TutorialTarget } from '../data/tutorial';
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

interface ResolvedTarget {
  /** Centre of the spotlight, in viewport pixels. */
  cx: number;
  cy: number;
  /** Spotlight radius, in viewport pixels. */
  radius: number;
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
 */
class TutorialController {
  private root: HTMLDivElement | null = null;
  private dimmerMaskCircle: SVGCircleElement | null = null;
  private tooltipEl: HTMLDivElement | null = null;
  private tooltipText: HTMLParagraphElement | null = null;
  private tooltipActions: HTMLDivElement | null = null;
  private arrowEl: HTMLDivElement | null = null;

  private canvas: HTMLCanvasElement | null = null;
  /** Active steps tied to `firstX` events that haven't fired yet. */
  private active = false;
  private currentStep: TutorialStep | null = null;
  private currentDismissTimer: number | null = null;
  private completed = new Set<string>();
  private lastWaveIndex = -1;
  /** Snapshot of the latest game state, refreshed every frame via update(). */
  private lastState: GameState | null = null;

  private skipCallback: (() => void) | null = null;

  /** Initialise the controller and attach to the DOM. Idempotent. */
  attach(canvas: HTMLCanvasElement, opts: { onSkip?: () => void } = {}): void {
    this.canvas = canvas;
    this.skipCallback = opts.onSkip ?? null;
    if (this.root) return;
    this.buildDom();
  }

  /** Begin the tutorial. Should only be called when the player hasn't
   *  finished it before (i.e. `meta.tutorialDone === false`). */
  start(): void {
    this.active = true;
    this.completed.clear();
    this.lastWaveIndex = -1;
    if (this.root) this.root.classList.remove('hidden');
  }

  /** Stop the tutorial entirely (skip button or completion). */
  stop(): void {
    this.active = false;
    this.hideStep();
    if (this.root) this.root.classList.add('hidden');
  }

  /** Drive the wave-based triggers and re-position the spotlight on the
   *  current frame. Must be called every game tick. */
  update(state: GameState): void {
    this.lastState = state;
    if (!this.active) return;

    // Detect wave transitions to fire `waveStart` triggers.
    const wave = state.waveState.currentIndex + 1;
    if (wave !== this.lastWaveIndex && state.phase === 'wave') {
      this.lastWaveIndex = wave;
      this.tryFireWaveStart(wave);
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

  // -- Step lifecycle ------------------------------------------------------

  private tryFireWaveStart(wave: number): void {
    for (const step of TUTORIAL_STEPS) {
      if (this.completed.has(step.id)) continue;
      if (step.trigger.kind !== 'waveStart') continue;
      if (step.trigger.wave !== wave) continue;
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
    // may not have the gold to proceed).
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tutorial-ok-btn';
    closeBtn.textContent = t('ui.tutorial.ok');
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
    this.completed.add(this.currentStep.id);
    this.hideStep();
    // Pop the next queued step (used for multiple W3 tips in sequence).
    const next = this.pendingSteps.shift();
    if (next) {
      // Slight delay so the player can see the previous tooltip vanish
      // before the next one materialises.
      window.setTimeout(() => {
        if (this.active) this.showStep(next);
      }, 350);
    }
  }

  private skipAll(): void {
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
    // place it below; if that runs off-screen, place it above.
    const rect = this.tooltipEl.getBoundingClientRect();
    const spaceBelow = window.innerHeight - (cy + radius);
    let tipY: number;
    let arrowAbove = false;
    if (spaceBelow > rect.height + 60 || target.kind === 'centered') {
      tipY = cy + radius + 24;
    } else {
      tipY = cy - radius - rect.height - 24;
      arrowAbove = true;
    }
    let tipX = cx - rect.width / 2;
    tipX = Math.max(16, Math.min(window.innerWidth - rect.width - 16, tipX));
    if (target.kind === 'centered') {
      tipX = window.innerWidth / 2 - rect.width / 2;
      tipY = window.innerHeight / 2 - rect.height / 2;
    }
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
      return {
        cx: rect.left + rect.width / 2,
        cy: rect.top + rect.height / 2,
        radius: Math.max(rect.width, rect.height) * 0.65 + 6,
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

// Type-only re-export so consumers don't need to import from data/.
export type { TutorialDismiss };
