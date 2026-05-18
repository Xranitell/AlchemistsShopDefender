import { test, expect, type Page } from '@playwright/test';

/**
 * Viewport-regression suite for the loadout overlay
 * (СНАРЯЖЕНИЕ МАНЕКЕНА — active module + aura picker).
 *
 * Mirrors the structure of `crafting-overlay.spec.ts` and
 * `modifier-preview.spec.ts` — boots the preview build, freezes any
 * motion, navigates Main Menu → Снаряжение manequin card, and
 * snapshots the panel at all 7 viewport projects.
 *
 * The seed save unlocks all 6 active modules and all 6 aura modules
 * so the panel is rendered at maximum content height (worst case for
 * scroll behaviour).
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
  /* Loadout overlay reuses the dramatic-stage particle layer. */
  .lo-panel .mp-spark { display: none !important; }
  * { caret-color: transparent !important; }
`;

const SEED_SAVE = {
  locale: 'ru',
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
  ownedActiveModules: ['lightning', 'chronos', 'transmute', 'alch_dome', 'frost_nova', 'vortex'],
  ownedAuraModules: ['ether_amp', 'thorn_shell', 'elem_reson', 'vital_pulse', 'gold_aura', 'long_range'],
  activeModule: 'chronos',
  auraModule: 'thorn_shell',
  ingredients: { slime: 12 },
  inventory: [null, null, null, null],
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

async function openLoadout(page: Page): Promise<void> {
  await page.click('.mm-loadout-card');
  await page.waitForSelector('.lo-panel', { state: 'visible', timeout: 5_000 });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

test.describe('loadout overlay — first paint', () => {
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
    await openLoadout(page);
    await expect(page).toHaveScreenshot();
  });
});
