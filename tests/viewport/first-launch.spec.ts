import { test, expect } from '@playwright/test';

test.describe('first launch routing', () => {
  test('enters gameplay once, then returns to the main menu', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== '1280x576');

    await page.addInitScript(() => {
      if (sessionStorage.getItem('first-launch-test-seeded') === '1') return;
      localStorage.removeItem('asd_meta_v2');
      localStorage.removeItem('asd_meta_v1');
      localStorage.removeItem('asd_platform_launched_v1');
      localStorage.removeItem('asd_crazygames_launched_v1');
      sessionStorage.setItem('first-launch-test-seeded', '1');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const isCrazyGames =
      await page.locator('script[src*="crazygames-sdk"]').count() > 0;
    if (isCrazyGames) {
      const policy = page.locator('.privacy-policy-panel');
      await expect(policy).toBeVisible();
      await policy.locator('.privacy-policy-accept').click();
    } else {
      await expect(page.locator('.privacy-policy-panel')).toHaveCount(0);
    }

    await page.waitForSelector('.hud-pause-btn', {
      state: 'visible',
      timeout: 15_000,
    });
    await expect(page.locator('.main-menu')).toHaveCount(0);
    await expect(page.locator('.privacy-policy-panel')).toHaveCount(0);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.main-menu', {
      state: 'visible',
      timeout: 15_000,
    });
    await expect(page.locator('.privacy-policy-panel')).toHaveCount(0);
  });
});
