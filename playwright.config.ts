import { defineConfig } from '@playwright/test';

/**
 * Playwright configuration for the viewport-regression suite.
 *
 * Phase 6 of the mobile-viewport refactor (see
 * `mobile-viewport-phase2-plan.md`). The suite renders the menu / first
 * paint of the production build at the seven viewports we manually
 * validated through Phase 2–5 and compares against a stored screenshot
 * baseline. Any layout regression — element clipped, font shrunk past
 * the readable threshold, overlay re-flowed past the design rectangle —
 * fails CI before it reaches the player.
 *
 * The seven viewports were chosen to match the real fleet:
 *   - 768  × 398 — typical 19.5:9 phone in WebView, lower bound for
 *                   `--ui-scale`. Most aggressive narrow-design test.
 *   - 934  × 437 — taller phone (e.g. Pixel 6 landscape); narrow design.
 *   - 1024 × 600 — short tablet / Yandex Games WebView; narrow design,
 *                   `--ui-scale` clamped to 1.
 *   - 1280 × 540 — 21:9 ultrawide laptop, just *under* the
 *                   NARROW_DESIGN_BREAKPOINT_HEIGHT (620) so the narrow
 *                   design kicks in despite a 1280-wide viewport.
 *   - 1280 × 576 — same width but tall enough to clear the narrow
 *                   design's 576 floor.
 *   - 1366 × 768 — classic small-laptop reference; wide design, scale=1.
 *   - 1920 × 1080 — desktop reference; wide design, scale=1.
 *
 * Each viewport is a separate Playwright project so reports / failure
 * artifacts cleanly attribute to the viewport they came from.
 *
 * The suite runs against the production build served by `vite preview`
 * — *not* `vite dev` — because the dev server's HMR runtime injects an
 * iframe overlay on errors and tweaks asset URLs in ways that flap
 * snapshots. `webServer` boots `npm run preview` automatically.
 */

const VIEWPORTS = [
  { name: '768x398', width: 768, height: 398 },
  { name: '934x437', width: 934, height: 437 },
  { name: '1024x600', width: 1024, height: 600 },
  { name: '1280x540', width: 1280, height: 540 },
  { name: '1280x576', width: 1280, height: 576 },
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1920x1080', width: 1920, height: 1080 },
] as const;

export default defineConfig({
  testDir: './tests/viewport',
  /* Snapshots live next to the spec files in
   * `tests/viewport/__screenshots__/<spec>/<viewport>.png`. We omit the
   * test-name segment because every spec file in this suite has a
   * single screenshot assertion — the spec file path is already enough
   * to disambiguate. */
  snapshotPathTemplate:
    '{testDir}/__screenshots__/{testFilePath}/{projectName}{ext}',
  expect: {
    /* Pixel-diff tolerance. The plan target is "fail at >1% pixel
     * diff". We use Playwright's `maxDiffPixelRatio` (the same metric)
     * so a regression on a single chip on one viewport fails. The CSS
     * scale + canvas blending introduces some legitimate sub-pixel
     * jitter between renders, hence the small floor on
     * `maxDiffPixels`. */
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      maxDiffPixels: 100,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  /* Don't keep retrying — a flaky baseline should be investigated, not
   * masked by retries. */
  retries: 0,
  /* Single worker keeps the canvas + audio context predictable and
   * avoids Vite preview port contention. */
  workers: 1,
  fullyParallel: false,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    /* Ensure cross-machine determinism. */
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    colorScheme: 'dark',
    /* Always grab a trace + screenshot on failure so the human reviewer
     * can diagnose regressions without re-running locally. */
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: VIEWPORTS.map((vp) => ({
    name: vp.name,
    use: {
      viewport: { width: vp.width, height: vp.height },
      /* Force DPR=1 so screenshot byte sizes are deterministic across
       * dev machines (a Retina laptop locally and a 1× CI runner would
       * otherwise produce visually identical but byte-different PNGs). */
      deviceScaleFactor: 1,
      hasTouch: vp.width < 1100 || vp.height < 620,
      isMobile: false,
      /* Use the same desktop UA across all viewports — `isMobile=true`
       * trips other Chromium heuristics we don't want here. */
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })),
  webServer: {
    /* `--strictPort` so the suite fails loudly if 4173 is busy instead
     * of silently binding to a different port and timing out on
     * baseURL. */
    command: 'npm run preview -- --port=4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
