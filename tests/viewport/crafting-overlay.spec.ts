import { test, expect, type Page } from '@playwright/test';

/**
 * Viewport-regression suite for the crafting overlay (Зельеварка).
 *
 * Mirrors the structure of `main-menu.spec.ts` — boots the production
 * preview, freezes any motion, opens the crafting overlay from the
 * main menu's «My Shop» card, and captures a viewport screenshot. One
 * baseline image per viewport project lives next to the spec under
 * `__screenshots__/crafting-overlay.spec.ts/<projectName>.png`.
 *
 * The seed save written before navigation has:
 *  - The walkthrough flags pre-set so the brewery card isn't blocked
 *    by a tutorial step.
 *  - One brewed potion in slot 0 (rage) and a partial ingredient
 *    stockpile, so the recipes column shows a mix of brewable / not-
 *    brewable rows. Without seed data every recipe row would render
 *    as 'missing' and the cost-chip color baseline would be uniform.
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
  /* Crafting panel has its own decorative spark layer in the
   * dramatic-stage backdrop — same treatment. */
  .mp-stage .mp-spark { display: none !important; }
  * { caret-color: transparent !important; }
`;

const SEED_SAVE = {
  blueEssence: 69,
  ancientEssence: 0,
  epicKeys: 0,
  ancientKeys: 1,
  bonusRerolls: 0,
  tutorialDone: true,
  menuTutorialDone: true,
  pauseTutorialDone: true,
  dailyDay: 1,
  dailyLastClaim: '',
  bestWave: 0,
  ownedActiveModules: ['chronos'],
  ownedAuraModules: [],
  activeModule: 'chronos',
  auraModule: null,
  ingredients: {
    slime: 12,
    rat_fang: 6,
    sapper_ash: 5,
    mold_spore: 0,
    glass_shard: 1,
    iron_plate: 2,
    homunculus_fragment: 4,
  },
  inventory: ['rage', null, null, null],
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

async function openCrafting(page: Page): Promise<void> {
  await page.click('.mm-shop-card');
  await page.waitForSelector('.craft-panel', { state: 'visible', timeout: 5_000 });
  /* Two RAFs after open, so the dramatic-stage rotation snapshots in
   * a deterministic frame (animations are CSS-paused but the initial
   * compositor frame can still differ by a few pixels otherwise). */
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

test.describe('crafting overlay — first paint', () => {
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
    await openCrafting(page);
    await expect(page).toHaveScreenshot();
  });
});
