# Viewport regression suite

Phase 6 of the mobile-viewport refactor. Runs the production build at
seven representative viewports and compares the first-paint screenshot
of the main menu against a stored baseline. Any layout regression — a
chip clipped, a font shrunk past the readable threshold, an overlay
re-flowing past the design rectangle — fails CI before it reaches
`main`.

## Why

Up through Phase 5 the only validation was manual: open DevTools, type
`768x398` into the device toolbar, hope to remember the seven sizes
that mattered. The plan called this out as the obvious gap and made
this suite the prerequisite for any further mobile work.

## How it runs

- `playwright.config.ts` defines one **project** per viewport (768×398,
  934×437, 1024×600, 1280×540, 1280×576, 1366×768, 1920×1080).
- The config's `webServer` boots `npm run preview` (the production
  Vite preview, *not* the dev server — HMR adds non-deterministic
  overlays) on port 4173 and tears it down at the end of the run.
- `main-menu.spec.ts` navigates to `/`, waits for the boot loader to
  fade out and the menu DOM to mount, freezes animations, hides
  intentionally-random elements (ember sparks), and snapshots the
  viewport.
- The expected baseline lives in
  `tests/viewport/__screenshots__/main-menu.spec.ts/<viewport>.png`.
- A diff > 1% pixels (`maxDiffPixelRatio: 0.01`) fails the job and
  uploads the HTML report + diff images as a CI artifact.

## CI integration

The CI workflow that drives this suite lives next to the code in
[`tests/viewport/ci-workflow.yml`](./ci-workflow.yml). It is *not*
committed under `.github/workflows/` from this PR because Devin's
GitHub OAuth integration does not have the `workflow` scope and the
remote rejects pushes that create or modify files there. To enable
automated viewport-regression checks in CI:

```bash
mkdir -p .github/workflows
cp tests/viewport/ci-workflow.yml .github/workflows/viewport.yml
git add .github/workflows/viewport.yml
git commit -m "Wire up viewport-regression CI"
```

The workflow runs the suite on every push / PR (`ubuntu-22.04`,
Node 20, Playwright Chromium), uploads the HTML report and any
failure traces as a 14-day artifact, and fails on any > 1% pixel diff.

## Running locally

First-time setup (installs the Playwright Chromium build + the system
libs it needs — only needed once per machine):

```bash
npx playwright install --with-deps chromium
```

Then:

```bash
# Run the suite against the current code (fails on any regression)
npm run test:viewport

# Open the HTML report from the most recent run
npx playwright show-report

# Regenerate baselines after an *intentional* UI change.
# Review the resulting diff in `git status` and commit the updated PNGs.
npm run test:viewport:update
```

The first run on a fresh machine downloads ~150 MB of browser binary
into `~/.cache/ms-playwright/`. Subsequent runs are local-only.

## When to update baselines

**Intentional** menu / canvas redesigns. Run
`npm run test:viewport:update`, then `git diff --stat` and visually
spot-check each updated PNG before committing.

**Unintentional** regressions are exactly what this suite is here to
catch — investigate the diff before deciding to re-baseline.

## Why baselines may not match across machines

Pixel-level snapshots are rendering-stack-sensitive. The suite is
configured to:

- Run on Chromium (Playwright's pinned build) only.
- Force `deviceScaleFactor: 1` so DPI is identical between a Retina
  laptop and a 1× CI runner.
- Pin `Math.random` to a deterministic Mulberry32 seed so anything
  random the menu computes during boot lays out identically.
- Disable all CSS transitions and animations.
- Wait for `document.fonts.ready` so Press Start 2P / VT323 are
  rasterised before snapshotting.

In practice this is enough for Linux Chromium to be byte-stable
between local and CI runs (both `ubuntu-22.04`). macOS / Windows
Chromium produce visually identical but byte-different renders due to
the OS-level font hinter — if you regenerate baselines on macOS, CI
will fail. **Generate baselines on Linux** (or in the Playwright
Docker image) before opening a PR.

## Adding a new viewport

1. Add `{ name: 'WxH', width: W, height: H }` to the `VIEWPORTS` array
   in `playwright.config.ts`.
2. Run `npm run test:viewport:update` to generate the baseline.
3. Commit `tests/viewport/__screenshots__/main-menu.spec.ts/WxH.png`.

## Adding a new screen / overlay to capture

1. Add a new `.spec.ts` file alongside `main-menu.spec.ts`. Reuse the
   `STABILITY_CSS` and `waitForMenuStable()` helpers (or the analogous
   wait pattern for the new screen).
2. Drive the UI to the screen of interest before the
   `expect(page).toHaveScreenshot()` call (e.g. click a menu button,
   start a battle, open an overlay).
3. Run `npm run test:viewport:update` to capture baselines for all
   seven viewports at once.
