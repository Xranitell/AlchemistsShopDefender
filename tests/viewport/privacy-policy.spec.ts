import { test, expect } from '@playwright/test';

test.describe('platform launch privacy policy', () => {
  test('is required once on CrazyGames and absent on Yandex', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== '1280x576');

    await page.addInitScript(() => {
      localStorage.setItem('asd_meta_v2', JSON.stringify({
        isShowed: false,
        tutorialDone: true,
      }));
      localStorage.setItem('asd_platform_launched_v1', '1');
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const isCrazyGames =
      await page.locator('script[src*="crazygames-sdk"]').count() > 0;

    if (isCrazyGames) {
      const policy = page.locator('.privacy-policy-panel');
      await expect(policy).toBeVisible();
      await policy.locator('.privacy-policy-accept').click();
      await expect(policy).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => {
        const raw = localStorage.getItem('asd_meta_v2');
        return raw ? JSON.parse(raw).isShowed : false;
      })).toBe(true);

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('.privacy-policy-panel')).toHaveCount(0);
      return;
    }

    await page.waitForSelector('.main-menu', {
      state: 'visible',
      timeout: 15_000,
    });
    await expect(page.locator('.privacy-policy-panel')).toHaveCount(0);
  });
});
