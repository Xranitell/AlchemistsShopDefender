import { test, expect } from '@playwright/test';

const SEED_SAVE = {
  isShowed: true,
  locale: 'en',
  localeUserChoice: true,
  tutorialDone: true,
  menuTutorialDone: true,
  pauseTutorialDone: true,
  cursedTutorialDone: true,
  settingsTutorialDone: true,
  blueEssence: 117,
  ancientEssence: 1,
  totalRuns: 6,
  bestWave: 15,
};

test.describe('talent laboratory fullscreen layout', () => {
  test('fills an upscaled CrazyGames viewport instead of starting at its center', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== '1280x576');
    await page.setViewportSize({ width: 1323, height: 741 });
    await page.addInitScript((seed) => {
      localStorage.setItem('asd_meta_v2', JSON.stringify(seed));
      localStorage.setItem('asd_platform_launched_v1', '1');
    }, SEED_SAVE);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.main-menu', {
      state: 'visible',
      timeout: 15_000,
    });
    await page.locator('.mm-lab-card').click();
    await page.waitForSelector('.meta-tree-panel', {
      state: 'visible',
      timeout: 5_000,
    });
    await page.evaluate(
      () => new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );

    const layout = await page.locator('.meta-tree-panel').evaluate((panel) => {
      const rect = panel.getBoundingClientRect();
      const style = getComputedStyle(panel);
      return {
        rect: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
        transform: style.transform,
        animationName: style.animationName,
      };
    });

    expect(layout.animationName).not.toContain('ui-panel-rise-in');
    // The 1280x720 design is fitted uniformly. At 1323x741 that leaves
    // a centered ~3px horizontal gutter because the aspect ratios differ.
    expect(layout.rect.left).toBeLessThanOrEqual(4);
    expect(layout.rect.top).toBeLessThanOrEqual(1);
    expect(layout.rect.right).toBeGreaterThanOrEqual(layout.viewport.width - 4);
    expect(layout.rect.bottom).toBeGreaterThanOrEqual(layout.viewport.height - 1);
    expect(layout.rect.width).toBeGreaterThanOrEqual(layout.viewport.width - 8);
    expect(layout.rect.height).toBeGreaterThanOrEqual(layout.viewport.height - 2);
  });
});
