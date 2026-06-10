import { expect, test } from '@playwright/test';

test('CrazyGames uses one all-modes single-run leaderboard', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== '1280x576');

  await page.route(
    'https://sdk.crazygames.com/crazygames-sdk-v3.js',
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '',
      });
    },
  );
  await page.addInitScript(() => {
    localStorage.setItem('asd_meta_v2', JSON.stringify({
      isShowed: true,
      tutorialDone: true,
      bestLeaderboardScores: {
        endlessWaves: 42,
        'dailyWaves:20260610': 17,
      },
    }));
    localStorage.setItem('asd_platform_launched_v1', '1');
    localStorage.removeItem('asd_crazygames_leaderboard_best_v1');
    (window as any).__leaderboardSubmissions = [];
    (window as any).CrazyGames = {
      SDK: {
        init: async () => {},
        environment: 'crazygames',
        ad: {
          requestAd: () => {},
        },
        game: {
          gameplayStart() {},
          gameplayStop() {},
          addSettingsChangeListener() {},
        },
        user: {
          isUserAccountAvailable: false,
          getUser: async () => null,
          showAuthPrompt: async () => {
            throw new Error('Account unavailable in test');
          },
          addAuthListener() {},
          removeAuthListener() {},
          submitScore(payload: { score: number }) {
            (window as any).__leaderboardSubmissions.push(payload);
          },
        },
      },
    };
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.main-menu', {
    state: 'visible',
    timeout: 15_000,
  });
  await page.waitForFunction(
    () => (window as any).__leaderboardSubmissions?.length === 1,
    null,
    { timeout: 10_000 },
  );

  await expect(page.locator('.lb-tab')).toHaveCount(1);
  await expect(page.locator('[data-tab="endlessWaves"]')).toBeVisible();
  await expect(page.locator('[data-tab="dailyWaves"]')).toHaveCount(0);
  await expect(page.locator('.lb-body')).toContainText('42');

  const submissions = await page.evaluate(
    () => (window as any).__leaderboardSubmissions as Array<{ score: number }>,
  );
  expect(submissions).toHaveLength(1);
  expect(submissions[0]?.score).toBe(42);
});
