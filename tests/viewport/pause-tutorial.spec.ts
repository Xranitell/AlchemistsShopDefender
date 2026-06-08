import { test, expect, type Page } from '@playwright/test';

const STABILITY_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
  .mm-sparks { display: none !important; }
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
  pauseTutorialDone: false,
  cursedTutorialDone: true,
  settingsTutorialDone: true,
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

async function openPauseTutorial(page: Page): Promise<void> {
  await page.click('.mm-battle-btn');
  await page.waitForSelector('.difficulty-card', { state: 'visible', timeout: 5_000 });
  await page.click('.difficulty-normal');
  await page.waitForSelector('.hud-pause-btn', { state: 'visible', timeout: 5_000 });
  await page.click('.hud-pause-btn');
  await page.waitForSelector('.pause-stats-overlay', { state: 'visible', timeout: 5_000 });
  await page.waitForSelector('.tutorial-tooltip', { state: 'visible', timeout: 5_000 });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function openAncientPauseTutorial(page: Page): Promise<void> {
  await page.click('.mm-battle-btn');
  await page.waitForSelector('.difficulty-ancient', { state: 'visible', timeout: 5_000 });
  await page.click('.difficulty-ancient');
  await page.waitForSelector('.mp-confirm', { state: 'visible', timeout: 5_000 });
  await page.click('.mp-confirm');
  await page.waitForSelector('.blessing-card', { state: 'visible', timeout: 5_000 });
  await page.locator('.blessing-card').first().click();
  await page.waitForSelector('.curse-card', { state: 'visible', timeout: 5_000 });
  await page.locator('.curse-card').first().click();
  await page.waitForSelector('.hud-pause-btn', { state: 'visible', timeout: 5_000 });
  await page.click('.hud-pause-btn');
  await page.waitForSelector('.pause-stats-overlay', { state: 'visible', timeout: 5_000 });
  await page.waitForSelector('.tutorial-tooltip', { state: 'visible', timeout: 5_000 });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function advanceToExitTutorialStep(page: Page): Promise<void> {
  for (let i = 0; i < 12; i++) {
    const text = await page.locator('.tutorial-text').textContent().catch(() => '');
    if (text?.includes('Exit to menu') || text?.includes('Выйти в меню')) break;
    await page.click('.tutorial-ok-btn');
    await page.waitForTimeout(220);
  }
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function expectTutorialInViewport(page: Page): Promise<void> {
  const bounds = await page.evaluate(() => {
    const read = (selector: string) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      if (!rect) return null;
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      };
    };
    return {
      group: read('.pause-stats-group'),
      row: read('.pause-stats-row'),
      exit: read('.pause-stats-exit-btn'),
      tooltip: read('.tutorial-tooltip'),
      ok: read('.tutorial-ok-btn'),
      skip: read('.tutorial-skip-btn'),
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });

  for (const rect of [bounds.group, bounds.row, bounds.exit, bounds.tooltip, bounds.ok]) {
    expect(rect).not.toBeNull();
    expect(rect!.left).toBeGreaterThanOrEqual(-0.5);
    expect(rect!.top).toBeGreaterThanOrEqual(-0.5);
    expect(rect!.right).toBeLessThanOrEqual(bounds.viewport.width + 0.5);
    expect(rect!.bottom).toBeLessThanOrEqual(bounds.viewport.height + 0.5);
  }
  if (bounds.skip) {
    expect(bounds.skip.left).toBeGreaterThanOrEqual(-0.5);
    expect(bounds.skip.top).toBeGreaterThanOrEqual(-0.5);
    expect(bounds.skip.right).toBeLessThanOrEqual(bounds.viewport.width + 0.5);
    expect(bounds.skip.bottom).toBeLessThanOrEqual(bounds.viewport.height + 0.5);
  }
}

test.describe('pause tutorial viewport bounds', () => {
  test.beforeEach(async ({ page }) => {
    await seedSave(page);
    await page.addStyleTag({ content: STABILITY_CSS }).catch(() => {
      /* Page has not loaded yet on the first call; harmless. */
    });
  });

  test('fits on the narrow phone viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== '768x398', 'Covered by the narrow phone project.');

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: STABILITY_CSS });
    await waitForMenuStable(page);
    await openPauseTutorial(page);
    await expectTutorialInViewport(page);
  });

  test('keeps the Ancient pause footer inside the phone viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== '768x398', 'Covered by the narrow phone project.');

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: STABILITY_CSS });
    await waitForMenuStable(page);
    await openAncientPauseTutorial(page);
    await advanceToExitTutorialStep(page);
    await expectTutorialInViewport(page);
  });

  test('repositions after the pause panel is resized', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== '1366x768', 'Uses the desktop project as the resize origin.');

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: STABILITY_CSS });
    await waitForMenuStable(page);
    await openPauseTutorial(page);
    await page.setViewportSize({ width: 768, height: 230 });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    await expectTutorialInViewport(page);
  });
});
