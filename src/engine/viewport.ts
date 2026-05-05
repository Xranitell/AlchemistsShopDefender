/**
 * Viewport manager — single source of truth for the *real* CSS viewport
 * the game lives in.
 *
 * Why this exists:
 *  - The previous mobile strategy pinned the meta viewport to
 *    `width=1280` so phones rendered the entire page at a 1280-wide CSS
 *    layout that the browser then CSS-scaled down to fit. This kept the
 *    PC visual identity but produced fragile sub-pixel text, mismatched
 *    touch targets and broke as soon as a screen had a non-720-tall
 *    aspect.
 *  - The new strategy lets the meta viewport stay at `width=device-width`
 *    so the game sees the *real* CSS viewport (e.g. 768×398 CSS px on a
 *    typical 19.5:9 phone in WebView). We then publish a small set of
 *    CSS custom properties on `:root` that the rest of the UI / canvas
 *    code can react to:
 *
 *      --vp-width  : real visual viewport width in CSS pixels.
 *      --vp-height : real visual viewport height in CSS pixels.
 *      --vp-dpr    : device pixel ratio, capped at MAX_DPR.
 *      --ui-scale  : uniform scale that fits a 1280×720 reference design
 *                    into the current viewport (clamped to [0.5, 1]).
 *      --hud-scale : same as `--ui-scale` but floored at MIN_HUD_SCALE so
 *                    in-battle buttons keep a 36+ CSS px tap target.
 *      --safe-top  : top safe-area inset (notch / status-bar cutout).
 *      --safe-bottom : bottom safe-area inset (home indicator / chrome).
 *
 *    A :root.viewport-fitted class is added when --ui-scale < 1 so CSS
 *    rules that need to know "we are smaller than the design size" can
 *    branch without re-doing the math.
 *
 * The manager listens to `resize`, `orientationchange`, and the
 * VisualViewport API so it stays in sync when the WebView or browser
 * chrome (Yandex address bar, iOS Safari toolbar) collapses / expands.
 */

/** Reference design size for the *desktop* layout. UI scaling is
 *  computed to fit this rectangle into the real viewport when the
 *  player is on a viewport big enough to host it comfortably. */
export const DESIGN_WIDTH_WIDE = 1280;
export const DESIGN_HEIGHT_WIDE = 720;

/** Reference design size for *narrow / short* viewports (typical phone
 *  WebViews in landscape — e.g. 768×398, 934×437). Picking a smaller
 *  reference rectangle directly lifts every CSS pixel inside the menu
 *  so 12 px chips render at ~9–10 px on a 768×398 phone instead of the
 *  unreadable 6–7 px Phase 1 produced when the whole 1280×720 frame
 *  had to fit into 768 CSS px.
 *
 *  Sized at 1024×576 (16:9, same aspect ratio as the wide design) so
 *  the existing 3-column / 3-card-stack layout keeps the same shape
 *  and only changes scale. Going smaller (e.g. 960×540) gave a few
 *  extra pixels of font but caused the bottom rows of the side panels
 *  to overflow the design rectangle on 540-tall viewports — the cards
 *  use mostly absolute pixel sizes internally and need ~570 design px
 *  to stack comfortably above the absolute-positioned battle CTA. */
export const DESIGN_WIDTH_NARROW = 1024;
export const DESIGN_HEIGHT_NARROW = 576;

/** Viewport must be at least this wide *and* this tall for the wide
 *  desktop design to be picked. Below either threshold we switch to
 *  the narrow design. The thresholds intentionally sit a bit below
 *  the wide design size (1100 < 1280, 620 < 720) so that already-
 *  small landscape laptops (e.g. 1280×640) still get the desktop
 *  visual identity, only switching to the narrow design when the
 *  device is meaningfully phone-shaped. */
export const NARROW_DESIGN_BREAKPOINT_WIDTH = 1100;
export const NARROW_DESIGN_BREAKPOINT_HEIGHT = 620;

/** Backwards-compatible aliases — the wide design is still considered
 *  the canonical reference for any non-fit-mode code (e.g. canvas /
 *  arena math) that sized itself against DESIGN_WIDTH × DESIGN_HEIGHT
 *  before phase 2 introduced the dual-design switch. */
export const DESIGN_WIDTH = DESIGN_WIDTH_WIDE;
export const DESIGN_HEIGHT = DESIGN_HEIGHT_WIDE;

/** Lower bound on `--ui-scale`. Below this, text becomes unreadable —
 *  we'd rather let some content overflow than shrink to a blur. */
export const MIN_UI_SCALE = 0.5;

/** Lower bound on `--hud-scale`. The in-battle HUD has tappable
 *  buttons (pause / overload / ability) whose hit area shrinks with
 *  `transform: scale(...)`. We floor the HUD-only scale so a 44 CSS
 *  px button never falls below ~37 px on the smallest phone — still
 *  comfortably above the 36 px touch-target Material guideline. */
export const MIN_HUD_SCALE = 0.85;

/** Cap the backing-store multiplier used by HiDPI-aware canvases. A
 *  3× backing store on a 2400×1080 phone would allocate 7.4 MP per
 *  frame, which is overkill for pixel-art and tanks low-end GPUs. */
export const MAX_DPR = 2;

export interface ViewportSnapshot {
  /** CSS-pixel width of the visual viewport (window.visualViewport when
   *  available, falling back to window.innerWidth). */
  width: number;
  /** CSS-pixel height of the visual viewport. */
  height: number;
  /** Physical:CSS pixel ratio, clamped to MAX_DPR. */
  dpr: number;
  /** Reference design width chosen for the current viewport (wide on
   *  desktop, narrow on phone). Published to CSS as `--design-w`. */
  designWidth: number;
  /** Reference design height chosen for the current viewport. Published
   *  to CSS as `--design-h`. */
  designHeight: number;
  /** Uniform scale factor that fits the chosen design rectangle into
   *  width × height. Clamped to [MIN_UI_SCALE, 1]. */
  uiScale: number;
  /** Tap-target-friendly scale used by the in-battle HUD. Same as
   *  `uiScale` on most viewports, but floored at MIN_HUD_SCALE so
   *  the smallest phones never shrink the pause/overload buttons
   *  below the 36 px touch-target guideline. */
  hudScale: number;
  /** Safe-area insets, in CSS pixels. */
  safeTop: number;
  safeBottom: number;
  safeLeft: number;
  safeRight: number;
}

type Listener = (snapshot: ViewportSnapshot) => void;

const listeners: Set<Listener> = new Set();

// Declared before `current` so the safe-area probe binding is out of
// the temporal dead zone by the time `readViewport()` is invoked at
// module init (line below). The probe div itself is created lazily
// inside readSafeAreaInsets() — `null` here just reserves the slot.
let probe: HTMLDivElement | null = null;

let current: ViewportSnapshot = readViewport();

function readViewport(): ViewportSnapshot {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  // VisualViewport.width/height already return the *visual* CSS-pixel
  // viewport — what the user actually sees, excluding any browser
  // chrome / pinch-zoom. innerWidth/innerHeight are the layout viewport
  // and are larger than the visual one when the user has pinch-zoomed.
  const width = Math.max(1, Math.floor(vv?.width ?? window.innerWidth));
  const height = Math.max(1, Math.floor(vv?.height ?? window.innerHeight));
  const rawDpr = Number.isFinite(window.devicePixelRatio) ? window.devicePixelRatio : 1;
  const dpr = Math.max(1, Math.min(MAX_DPR, rawDpr));

  // Pick the reference design rectangle. We deliberately use a single
  // hard threshold rather than a continuous formula so the menu
  // doesn't subtly redesign itself across a 50px resize range — the
  // player either gets the wide desktop frame or the narrow phone
  // frame, with no in-between blends.
  const isNarrow =
    width < NARROW_DESIGN_BREAKPOINT_WIDTH ||
    height < NARROW_DESIGN_BREAKPOINT_HEIGHT;
  const designWidth = isNarrow ? DESIGN_WIDTH_NARROW : DESIGN_WIDTH_WIDE;
  const designHeight = isNarrow ? DESIGN_HEIGHT_NARROW : DESIGN_HEIGHT_WIDE;

  const uiScaleRaw = Math.min(width / designWidth, height / designHeight);
  const uiScale = Math.max(MIN_UI_SCALE, Math.min(1, uiScaleRaw));
  // The HUD has tappable buttons whose hit area shrinks linearly with
  // CSS `transform: scale()`. We floor the HUD-only scale so a 44 CSS
  // px button never lands below ~37 px on the smallest phone, but we
  // still let `uiScale` itself dip lower for non-interactive content
  // (badges, hint labels, etc.) that benefits from a tighter fit.
  const hudScale = Math.max(MIN_HUD_SCALE, uiScale);

  const safe = readSafeAreaInsets();

  return {
    width,
    height,
    dpr,
    designWidth,
    designHeight,
    uiScale,
    hudScale,
    safeTop: safe.top,
    safeBottom: safe.bottom,
    safeLeft: safe.left,
    safeRight: safe.right,
  };
}

/** Read `env(safe-area-inset-*)` values via a hidden probe element. The
 *  CSS env() function only resolves inside CSS, so we bounce through a
 *  detached div whose padding is set to env() and read getComputedStyle.
 *  Cheap (single layout read) and works on all browsers that support
 *  safe-area at all; falls back to 0 on older ones. The `probe`
 *  binding itself is declared higher up so module-init reads (which
 *  happen before this function's source line) don't TDZ. */
function readSafeAreaInsets(): { top: number; bottom: number; left: number; right: number } {
  if (typeof document === 'undefined') {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
  if (!probe) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top);' +
      'padding-bottom:env(safe-area-inset-bottom);' +
      'padding-left:env(safe-area-inset-left);' +
      'padding-right:env(safe-area-inset-right);';
    document.documentElement.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  return {
    top: parseFloat(cs.paddingTop) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
    right: parseFloat(cs.paddingRight) || 0,
  };
}

function applySnapshotToCss(snap: ViewportSnapshot): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  // Note: setting custom properties via setProperty is cheap (single
  // style invalidation) compared to mutating individual CSS rules.
  root.style.setProperty('--vp-width', `${snap.width}px`);
  root.style.setProperty('--vp-height', `${snap.height}px`);
  root.style.setProperty('--vp-dpr', `${snap.dpr}`);
  // Publish the chosen design rectangle so fit-mode CSS can render
  // itself at the right reference size without re-doing the breakpoint
  // logic in the stylesheet (where it would have to live as a media
  // query duplicate of the one in readViewport()).
  root.style.setProperty('--design-w', `${snap.designWidth}px`);
  root.style.setProperty('--design-h', `${snap.designHeight}px`);
  root.style.setProperty('--ui-scale', `${snap.uiScale}`);
  // HUD-only scale, floored so tap targets stay usable on phones.
  // CSS reads this through `transform: scale(var(--hud-scale))` on
  // the in-battle HUD rows in `:root.viewport-fitted` mode.
  root.style.setProperty('--hud-scale', `${snap.hudScale}`);
  root.style.setProperty('--safe-top', `${snap.safeTop}px`);
  root.style.setProperty('--safe-bottom', `${snap.safeBottom}px`);
  root.style.setProperty('--safe-left', `${snap.safeLeft}px`);
  root.style.setProperty('--safe-right', `${snap.safeRight}px`);

  // Toggle a marker class so CSS rules can branch on "we are in
  // fit-mode" without re-doing the breakpoint math. We treat the
  // narrow design selection itself as a fit-mode signal — even when
  // uiScale lands at exactly 1.0 (e.g. 1280×540 viewport with the
  // 960×540 narrow design), we still want the menu to render at the
  // narrow reference rectangle and centre inside the real viewport
  // rather than fall back to the pre-Phase-1 landscape-mobile media
  // queries. The 0.999 threshold avoids float-rounding flicker at
  // exactly 1.0 for the wide-design path.
  const isNarrowDesign =
    snap.designWidth !== DESIGN_WIDTH_WIDE ||
    snap.designHeight !== DESIGN_HEIGHT_WIDE;
  const fitted = snap.uiScale < 0.999 || isNarrowDesign;
  root.classList.toggle('viewport-fitted', fitted);
  // A second, more specific marker class. Some fit-mode rules (e.g.
  // title font-size) need different values on the narrow design vs
  // the wide design because the same `clamp(min, vw, max)` rule
  // resolves to a different pixel size depending on the *real*
  // viewport, which can be wider than the narrow design (e.g.
  // 1280×540 viewport rendering the 960-wide design — vw=12.8 px
  // clamps to the desktop-intended 36 px title that doesn't fit in
  // 960 design pixels).
  root.classList.toggle('viewport-fitted-narrow', isNarrowDesign);
}

let scheduled = false;
function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  // Coalesce bursts of resize / orientation events into a single rAF.
  // VisualViewport in particular fires on every browser-chrome height
  // change during scroll, which can run at 60+ Hz on iOS.
  requestAnimationFrame(() => {
    scheduled = false;
    refresh();
  });
}

function refresh(): void {
  const next = readViewport();
  // Skip notification if nothing changed — common when an unrelated
  // event (e.g. scroll) bubbles through. Keeps subscribers quiet.
  if (
    next.width === current.width &&
    next.height === current.height &&
    next.dpr === current.dpr &&
    next.designWidth === current.designWidth &&
    next.designHeight === current.designHeight &&
    next.uiScale === current.uiScale &&
    next.safeTop === current.safeTop &&
    next.safeBottom === current.safeBottom &&
    next.safeLeft === current.safeLeft &&
    next.safeRight === current.safeRight
  ) {
    return;
  }
  current = next;
  applySnapshotToCss(next);
  // Clone the listener set before iterating so a subscriber removing
  // itself mid-callback doesn't skip the next listener.
  for (const fn of Array.from(listeners)) {
    try {
      fn(next);
    } catch (err) {
      // Swallow listener errors — one broken subscriber must not stop
      // the others (or the canvas) from updating.
      console.error('[viewport] listener error', err);
    }
  }
}

/** Install the global resize listeners. Idempotent. Call once at
 *  application boot. */
let installed = false;
export function installViewportManager(): ViewportSnapshot {
  if (typeof window === 'undefined') return current;
  if (!installed) {
    installed = true;
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', schedule);
      window.visualViewport.addEventListener('scroll', schedule);
    }
    // Some browsers don't fire `resize` when the URL bar / virtual
    // keyboard collapses but DO fire `pageshow` on tab restore.
    window.addEventListener('pageshow', schedule, { passive: true });
  }
  // Apply once synchronously so first-paint CSS sees the right values
  // before any downstream code reads them.
  current = readViewport();
  applySnapshotToCss(current);
  return current;
}

/** Last computed viewport snapshot. Cheap getter — does not re-measure. */
export function getViewport(): ViewportSnapshot {
  return current;
}

/** Subscribe to viewport changes. Returns an unsubscribe function. */
export function onViewportChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
