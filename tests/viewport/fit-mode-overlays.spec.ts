import { test, expect, type Page } from '@playwright/test';

const SEED_SAVE = {
  isShowed: true,
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
  cursedTutorialDone: true,
  settingsTutorialDone: true,
  dailyDay: 1,
  dailyLastClaim: '',
  bestWave: 30,
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
    localStorage.setItem('asd_platform_launched_v1', '1');
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

async function openFreshMenu(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await waitForMenuStable(page);
}

async function waitForEntryAnimation(page: Page): Promise<void> {
  await page.waitForTimeout(320);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function expectPanelInsideViewport(page: Page, selector: string): Promise<void> {
  const bounds = await page.locator(selector).evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
  });

  expect(bounds.left).toBeGreaterThanOrEqual(-0.5);
  expect(bounds.top).toBeGreaterThanOrEqual(-0.5);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewport.width + 0.5);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewport.height + 0.5);

  expect(bounds.width).toBeGreaterThan(80);
  expect(bounds.height).toBeGreaterThan(80);
  expect(bounds.left).toBeLessThan(bounds.viewport.width * 0.5 - 8);
  expect(bounds.top).toBeLessThan(bounds.viewport.height * 0.5 - 8);
  expect(bounds.right).toBeGreaterThan(bounds.viewport.width * 0.5 + 8);
  expect(bounds.bottom).toBeGreaterThan(bounds.viewport.height * 0.5 + 8);
}

async function expectPanelCenteredWithoutPageScroll(
  page: Page,
  selector: string,
): Promise<void> {
  const layout = await page.locator(selector).evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
      animationName: style.animationName,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientWidth: document.documentElement.clientWidth,
        clientHeight: document.documentElement.clientHeight,
      },
    };
  });

  expect(layout.animationName).not.toContain('ui-panel-rise-in');
  expect(layout.centerX).toBeCloseTo(layout.viewport.width / 2, 0);
  expect(layout.centerY).toBeCloseTo(layout.viewport.height / 2, 0);
  expect(layout.document.scrollWidth).toBeLessThanOrEqual(
    layout.document.clientWidth,
  );
  expect(layout.document.scrollHeight).toBeLessThanOrEqual(
    layout.document.clientHeight,
  );
}

async function expectSettingsSlidersUsable(page: Page): Promise<void> {
  const slider = page.locator('.settings-volume-slider').first();
  const box = await slider.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThan(120);
  expect(box!.height).toBeGreaterThan(6);

  await page.mouse.move(box!.x + box!.width * 0.1, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.9, box!.y + box!.height / 2, { steps: 10 });
  await page.mouse.up();

  await expect(slider).toHaveValue(/[8-9][0-9]|100/);
}

test.describe('fit-mode overlay panel placement', () => {
  test.beforeEach(async ({ page }) => {
    await pinRandomness(page);
    await seedSave(page);
  });

  test('keeps menu overlays fully visible after entry animation', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== '768x398', 'Covered by the narrow phone project.');

    await openFreshMenu(page);
    await page.click('.mm-settings-gear');
    await page.waitForSelector('.settings-panel', { state: 'visible', timeout: 5_000 });
    await waitForEntryAnimation(page);
    await expectPanelInsideViewport(page, '.settings-panel');
    await expectSettingsSlidersUsable(page);

    await openFreshMenu(page);
    await page.click('.mm-battle-btn');
    await page.waitForSelector('.difficulty-panel', { state: 'visible', timeout: 5_000 });
    await waitForEntryAnimation(page);
    await expectPanelInsideViewport(page, '.difficulty-panel');

    await openFreshMenu(page);
    await page.click('.mm-battle-btn');
    await page.waitForSelector('.difficulty-ancient', { state: 'visible', timeout: 5_000 });
    await page.click('.difficulty-ancient');
    await page.waitForSelector('.modifier-preview-panel', { state: 'visible', timeout: 5_000 });
    await waitForEntryAnimation(page);
    await expectPanelInsideViewport(page, '.modifier-preview-panel');

    await openFreshMenu(page);
    await page.click('.mm-shop-card');
    await page.waitForSelector('.craft-panel', { state: 'visible', timeout: 5_000 });
    await waitForEntryAnimation(page);
    await expectPanelInsideViewport(page, '.craft-panel');
  });

  test('centers transform-scaled menu overlays in an upscaled CrazyGames viewport', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    test.skip(testInfo.project.name !== '1280x576');
    await page.setViewportSize({ width: 1323, height: 741 });

    await openFreshMenu(page);
    await page.click('.mm-settings-gear');
    await page.waitForSelector('.settings-panel', { state: 'visible', timeout: 5_000 });
    await waitForEntryAnimation(page);
    await expectPanelCenteredWithoutPageScroll(page, '.settings-panel');

    await openFreshMenu(page);
    await page.click('.mm-battle-btn');
    await page.waitForSelector('.difficulty-panel', { state: 'visible', timeout: 5_000 });
    await waitForEntryAnimation(page);
    await expectPanelCenteredWithoutPageScroll(page, '.difficulty-panel');

    await openFreshMenu(page);
    await page.click('.mm-shop-card');
    await page.waitForSelector('.craft-panel', { state: 'visible', timeout: 5_000 });
    await waitForEntryAnimation(page);
    await expectPanelCenteredWithoutPageScroll(page, '.craft-panel');

    await openFreshMenu(page);
    await page.click('.mm-battle-btn');
    await page.waitForSelector('.difficulty-ancient', { state: 'visible', timeout: 5_000 });
    await page.click('.difficulty-ancient');
    await page.waitForSelector('.modifier-preview-panel', {
      state: 'visible',
      timeout: 5_000,
    });
    await waitForEntryAnimation(page);
    await expectPanelCenteredWithoutPageScroll(page, '.modifier-preview-panel');
  });
});
