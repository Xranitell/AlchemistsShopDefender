import { expect, test } from '@playwright/test';

test('keeps the tutorial GO button tappable after portrait to landscape rotation', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== '768x398');

  await page.addInitScript(() => {
    localStorage.removeItem('asd_meta_v2');
    localStorage.removeItem('asd_meta_v1');
    localStorage.removeItem('asd_platform_launched_v1');
    localStorage.removeItem('asd_crazygames_launched_v1');
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#portrait-warning')).toBeVisible();

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#portrait-warning')).toBeHidden();

  const policy = page.locator('.privacy-policy-panel');
  if (await policy.count()) {
    await policy.locator('.privacy-policy-accept').click();
  }

  const go = page.locator('.hud-skip-btn');
  await expect(go).toBeVisible({ timeout: 15_000 });
  await expect(go).toBeEnabled();

  await go.click();
  await expect(page.locator('.hud-wave-value')).toContainText('1');
});
