/**
 * Boot-time loading screen helper.
 *
 * The loader DOM (`#app-loader`) is rendered by `index.html` so the player
 * sees the dark-wine + warm-gold logo, spinning flask, and progress bar
 * during the *first* paint — before the JS module bundle has finished
 * parsing and before the external `style.css` is fully loaded.
 *
 * `hideAppLoader()` is called by `main.ts` once everything (Yandex SDK
 * init, locale, meta-save, main menu) is ready. We enforce a minimum
 * 2-second on-screen time so the staggered element pop-in (the original
 * "stuttering load" bug) is masked behind the loader, then animate the
 * loader out and remove it from the DOM.
 */

const MIN_VISIBLE_MS = 2000;

let bootStart = -1;

/**
 * Capture the wall-clock time at which the page started loading. Should be
 * called as early as possible — we read it from `performance.timing` /
 * `performance.now()` so the minimum-visibility window is measured from
 * the first byte the browser received, not from when this module ran.
 */
function getBootStart(): number {
  if (bootStart >= 0) return bootStart;
  const entry =
    typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function'
      ? (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)
      : undefined;
  if (entry && typeof entry.startTime === 'number') {
    bootStart = performance.timeOrigin + entry.startTime;
  } else if (typeof performance !== 'undefined' && typeof performance.timeOrigin === 'number') {
    bootStart = performance.timeOrigin;
  } else {
    bootStart = Date.now();
  }
  return bootStart;
}

/**
 * Animate the boot-time loading screen out of view and remove it from the
 * DOM. Idempotent — calling it twice is a no-op the second time.
 *
 * Honors a minimum-visible duration so even when the SDK / module bundle
 * is cached and resolves instantly, the loader sticks around long enough
 * for the progress bar animation to read.
 */
export function hideAppLoader(): void {
  const el = document.getElementById('app-loader');
  if (!el) return;
  const elapsed = Date.now() - getBootStart();
  const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed);
  window.setTimeout(() => {
    el.classList.add('hidden');
    document.body.classList.remove('app-booting');
    // Drop the loader from the tree once the fade-out completes so it can't
    // intercept any future pointer / focus events. The CSS transition is
    // ~360ms; pad to 500 to be safe across slow devices.
    window.setTimeout(() => {
      el.remove();
    }, 500);
  }, remaining);
}
