import { test, expect, type Page } from '@playwright/test';

/**
 * Viewport-regression suite for the main-menu first paint.
 *
 * Each Playwright project (defined in `playwright.config.ts`) runs this
 * file at a different viewport size. The test boots the production
 * preview build, waits for the boot-time loader to disappear, freezes
 * any remaining motion, and captures a full-page screenshot. The
 * expected baseline lives next to the spec under
 * `__screenshots__/main-menu.spec.ts/<projectName>.png`.
 *
 * On any > 1% pixel diff (see `expect.toHaveScreenshot.maxDiffPixelRatio`
 * in `playwright.config.ts`) Playwright fails CI and uploads a side-by-
 * side diff so the reviewer can decide whether the regression was
 * intentional (run `npm run test:viewport:update` to refresh the
 * baselines) or a bug.
 *
 * Stability strategy:
 *  - Disable all CSS animations / transitions before the page renders
 *    so the loader fade, mannequin idle wobble, and ember-spark
 *    parallax don't flap snapshots.
 *  - Hide elements whose layout is intentionally random per page-load
 *    (`.mm-sparks` ember dust generated with random `--x` / `--scale`
 *    custom properties).
 *  - Pin `Math.random` to a deterministic sequence before app code
 *    runs, so any *new* per-load randomness picked up later still
 *    snapshots the same way.
 *  - Wait for the loader to clear (`body` no longer has `app-booting`)
 *    *and* for the menu DOM (`.main-menu`) to be attached — both
 *    signals are required because the loader's min-visible window
 *    races the menu mount.
 *  - Wait for `document.fonts.ready` so Press Start 2P / VT323 are
 *    rendered with their final glyphs, not the fallback metric.
 */

const STABILITY_CSS = `
  /* Freeze every animated property so the snapshot is deterministic. */
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
  /* Embers are positioned by random custom properties; hiding them
   * is cheaper than pinning the RNG just for the spark layer. */
  .mm-sparks { display: none !important; }
  /* Caret blinking inside the leaderboard's nickname input. */
  * { caret-color: transparent !important; }
`;

async function pinRandomness(page: Page): Promise<void> {
  await page.addInitScript(() => {
    /* Mulberry32 — deterministic, seeded to a fixed constant so any
     * code that calls Math.random during boot lays out identically
     * across runs. */
    let state = 0xC0FFEE;
    Math.random = () => {
      state |= 0;
      state = (state + 0x6D2B79F5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
}

async function waitForMenuStable(page: Page): Promise<void> {
  /* The boot loader has a 2 s minimum-visible window enforced in JS,
   * so we deliberately allow up to 15 s for it to disappear on a slow
   * CI runner. */
  await page.waitForFunction(
    () => !document.body.classList.contains('app-booting'),
    null,
    { timeout: 15_000 },
  );
  /* The loader fades out with a 360 ms CSS transition (which we have
   * disabled in `STABILITY_CSS`, so it becomes instant) and is removed
   * from the DOM ~500 ms later by a setTimeout. With the transition
   * gated to 0s the removal still runs, but `display:none` would not
   * matter for the screenshot anyway. */
  await page.waitForSelector('.main-menu', { state: 'visible', timeout: 15_000 });
  /* Ensure custom fonts are rasterised before snapshotting. */
  await page.evaluate(() => document.fonts && document.fonts.ready);
  /* Two RAFs let any layout settle after font swap. */
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

test.describe('main menu — first paint', () => {
  test.beforeEach(async ({ page }) => {
    await pinRandomness(page);
    await page.addStyleTag({ content: STABILITY_CSS }).catch(() => {
      /* The page hasn't loaded yet on the first call; we re-inject
       * after navigation below. The catch makes that race harmless. */
    });
  });

  test('matches baseline screenshot', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: STABILITY_CSS });
    await waitForMenuStable(page);

    /* `fullPage: false` (the default) is the right choice here — the
     * game is a single-screen layout sized to the viewport, so a
     * full-page capture would just include the same content padded
     * with whatever scrollbar the canvas overflow introduces.
     *
     * The snapshot file is named via `snapshotPathTemplate` in
     * `playwright.config.ts` (`{projectName}.png`), so we don't need to
     * reach into `testInfo` here. */
    await expect(page).toHaveScreenshot();
  });
});
