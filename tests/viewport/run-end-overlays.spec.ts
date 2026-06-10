import { test, expect, type Page } from '@playwright/test';

const SEED_SAVE = {
  isShowed: true,
  locale: 'en',
  localeUserChoice: true,
  tutorialDone: true,
  menuTutorialDone: true,
  pauseTutorialDone: true,
  cursedTutorialDone: true,
  settingsTutorialDone: true,
};

async function mountRunEndPanel(
  page: Page,
  panelClass: 'chest-overlay' | 'defeat-overlay',
): Promise<void> {
  await page.evaluate((className) => {
    const overlay = document.querySelector<HTMLElement>('#overlay');
    if (!overlay) throw new Error('Overlay root was not found');
    overlay.className = 'visible';
    overlay.innerHTML = `
      <div class="panel ${className}">
        <h2>Run complete</h2>
        <div style="width: 700px; height: 360px"></div>
      </div>
    `;
  }, panelClass);
  await page.waitForTimeout(320);
}

async function readPanelLayout(page: Page, selector: string) {
  return page.locator(selector).evaluate((panel) => {
    const rect = panel.getBoundingClientRect();
    const style = getComputedStyle(panel);
    return {
      animationName: style.animationName,
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
    };
  });
}

test.describe('run-end overlay placement', () => {
  test('keeps victory and defeat panels centered in an upscaled CrazyGames viewport', async ({
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

    for (const panelClass of ['chest-overlay', 'defeat-overlay'] as const) {
      await mountRunEndPanel(page, panelClass);
      const layout = await readPanelLayout(page, `.${panelClass}`);
      const centerX = (layout.rect.left + layout.rect.right) / 2;
      const centerY = (layout.rect.top + layout.rect.bottom) / 2;

      expect(layout.animationName).not.toContain('ui-panel-rise-in');
      expect(centerX).toBeCloseTo(layout.viewport.width / 2, 0);
      expect(centerY).toBeCloseTo(layout.viewport.height / 2, 0);
      expect(layout.rect.left).toBeGreaterThanOrEqual(0);
      expect(layout.rect.top).toBeGreaterThanOrEqual(0);
      expect(layout.rect.right).toBeLessThanOrEqual(layout.viewport.width);
      expect(layout.rect.bottom).toBeLessThanOrEqual(layout.viewport.height);
    }
  });
});
