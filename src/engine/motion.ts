/**
 * Motion / animation preference manager.
 *
 * The CSS in `src/style.css` used to gate every "decorative" animation
 * behind `@media (prefers-reduced-motion: reduce)` blocks. That works on
 * iOS — Low-Power-Mode and the "Reduce Motion" Accessibility toggle both
 * flip the OS preference automatically — but Android offers no such hook,
 * so Android players were stuck with the full desktop animation set
 * regardless of how laggy it felt on their device.
 *
 * To fix that, every reduced-motion CSS block was converted from
 *   `@media (prefers-reduced-motion: reduce) { … }`
 * to
 *   `:root.motion-reduced { … }`
 * and this module owns the `motion-reduced` class on `<html>`. The class
 * is applied based on a 3-way save-file setting:
 *
 *   - `'auto'`    : follow the OS `prefers-reduced-motion: reduce` query.
 *   - `'minimal'` : always reduced-motion (default for touch devices).
 *   - `'full'`    : never reduced-motion (the "force animations" toggle).
 *
 * `applyMotionMode()` is idempotent and re-evaluates on OS-preference
 * change, so toggling Low-Power-Mode while the game is open updates the
 * UI live in `'auto'` mode.
 */
import type { MetaSave, MotionMode } from '../game/save';

const REDUCED_MEDIA = '(prefers-reduced-motion: reduce)';
const COARSE_POINTER_MEDIA = '(pointer: coarse)';

let mediaQuery: MediaQueryList | null = null;
let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;
let currentMode: MotionMode = 'auto';

/** True when the current device looks like a phone / tablet. We use a
 *  *coarse pointer* + *no hover* check rather than UA sniffing because it
 *  matches what `@media` queries see — same source of truth. */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(COARSE_POINTER_MEDIA).matches;
}

/** OS-level reduced-motion preference. Set by iOS Low-Power-Mode, the
 *  system "Reduce Motion" Accessibility toggle, and (on some platforms)
 *  custom Chromium flags. Android typically reports `false`. */
export function osPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_MEDIA).matches;
}

/** Decide whether `motion-reduced` should be on `<html>` for the given mode. */
function shouldReduceMotion(mode: MotionMode): boolean {
  if (mode === 'minimal') return true;
  if (mode === 'full') return false;
  return osPrefersReducedMotion();
}

/** Apply `mode` to the document immediately and start (or refresh) the
 *  OS-preference listener so `'auto'` stays live. */
export function applyMotionMode(mode: MotionMode): void {
  currentMode = mode;
  const root = typeof document !== 'undefined' ? document.documentElement : null;
  if (!root) return;
  root.classList.toggle('motion-reduced', shouldReduceMotion(mode));

  // Set up the live listener exactly once. We only react to OS changes
  // when the player has the mode left on `'auto'` — otherwise the
  // explicit choice wins.
  if (typeof window !== 'undefined' && window.matchMedia && !mediaQuery) {
    mediaQuery = window.matchMedia(REDUCED_MEDIA);
    mediaListener = () => {
      if (currentMode !== 'auto') return;
      root.classList.toggle('motion-reduced', shouldReduceMotion('auto'));
    };
    // Older Safari only supports `addListener` / `removeListener`.
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', mediaListener);
    } else {
      type LegacyMediaQueryList = MediaQueryList & {
        addListener: (cb: (e: MediaQueryListEvent) => void) => void;
      };
      (mediaQuery as LegacyMediaQueryList).addListener(mediaListener);
    }
  }
}

/** Pick the default motion mode for a fresh save: touch devices land on
 *  `'minimal'` so Android phones look smooth out of the box; everyone
 *  else gets `'auto'` (i.e. follow the OS). */
export function defaultMotionMode(): MotionMode {
  return isTouchDevice() ? 'minimal' : 'auto';
}

/** Convenience wrapper: read `meta.motionMode` and apply it. */
export function applyMotionModeFromMeta(meta: MetaSave): void {
  applyMotionMode(meta.motionMode);
}
