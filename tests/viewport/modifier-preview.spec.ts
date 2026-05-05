import { test, expect, type Page } from '@playwright/test';

/**
 * Viewport-regression suite for the modifier-preview overlay
 * (`ANCIENT DUNGEON / POINT OF NO RETURN` confirmation modal).
 *
 * Mirrors the structure of `main-menu.spec.ts` and
 * `crafting-overlay.spec.ts` — boots the preview build, freezes any
 * motion, navigates Main Menu → Battle → Difficulty Select → Ancient
 * card, and snapshots the panel.
 *
 * The seed save is rigged with 5 ancient keys so the user can click
 * the Ancient difficulty card without `consumeKey` failing. Locale is
 * pinned to `'en'` because that's the longest-text mode the panel has
 * to lay out (the user-reported repro for the original overflow bug
 * was in en locale at 1280×570).
 */

const STABILITY_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
  .mm-sparks { display: none !important; }
  /* Modifier-preview's dramatic stage has its own particle layer. */
  .mp-stage .mp-spark { display: none !important; }
  * { caret-color: transparent !important; }
`;

const SEED_SAVE = {
  locale: 'en',
  localeUserChoice: true,
  blueEssence: 99,
  ancientEssence: 99,
  epicKeys: 5,
  ancientKeys: 5,
  bonusRerolls: 0,
  tutorialDone: true,
  menuTutorialDone: true,
  pauseTutorialDone: true,
  dailyDay: 1,
  dailyLastClaim: '',
  bestWave: 30,
  ownedActiveModules: ['chronos'],
  ownedAuraModules: [],
  activeModule: 'chronos',
  auraModule: null,
  ingredients: { slime: 12 },
  inventory: [null, null, null, null],
  unlockedDifficulties: ['normal', 'endless', 'epic', 'ancient'],
};

async function pinRandomness(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let state = 0xc0ffee;
    Math.random = () => {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
}

async function seedSave(page: Page): Promise<void> {
  await page.addInitScript((seed) => {
    localStorage.setItem('asd_meta_v2', JSON.stringify(seed));
  }, SEED_SAVE);
}

async function waitForMenuStable(page: Page): Promise<void> {
  await page.waitForFunction(
    () => !document.body.classList.contains('app-booting'),
    null,
    { timeout: 15_000 },
  );
  await page.waitForSelector('.main-menu', { state: 'visible', timeout: 15_000 });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function openModifierPreview(page: Page): Promise<void> {
  await page.click('.mm-battle-btn');
  await page.waitForSelector('.difficulty-card', { state: 'visible', timeout: 5_000 });
  await page.click('.difficulty-ancient');
  await page.waitForSelector('.modifier-preview-panel', { state: 'visible', timeout: 5_000 });
  /* Two RAFs after open so the dramatic-stage rotating rays settle on
   * a deterministic frame (animations are CSS-paused but the initial
   * compositor frame still has sub-pixel jitter otherwise). */
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

test.describe('modifier preview — first paint', () => {
  test.beforeEach(async ({ page }) => {
    await pinRandomness(page);
    await seedSave(page);
    await page.addStyleTag({ content: STABILITY_CSS }).catch(() => {
      /* Page hasn't loaded yet on the first call; harmless. */
    });
  });

  test('matches baseline screenshot', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: STABILITY_CSS });
    await waitForMenuStable(page);
    await openModifierPreview(page);
    await expect(page).toHaveScreenshot();
  });
});
