import { test, expect } from '@playwright/test';

test.describe('leaderboard integration', () => {
  test('syncs saved all-time and current-day records after authorization', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== '1280x576');

    await page.route('https://yandex.ru/games/sdk/v2', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '',
      });
    });
    await page.addInitScript(() => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Moscow',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());
      const get = (type: string) =>
        parts.find((part) => part.type === type)?.value ?? '0';
      const today = Number(`${get('year')}${get('month')}${get('day')}`);

      localStorage.setItem('asd_meta_v2', JSON.stringify({
        isShowed: true,
        bestLeaderboardScores: {
          endlessWaves: 42,
          [`dailyWaves:${today}`]: 17,
        },
      }));
      localStorage.setItem('asd_platform_launched_v1', '1');
      (window as any).__leaderboardSubmissions = [];
      (window as any).YaGames = {
        init: async () => ({
          features: {
            LoadingAPI: { ready() {} },
            GameplayAPI: { start() {}, stop() {} },
          },
          environment: { i18n: { lang: 'en' } },
          getPlayer: async () => ({ isAuthorized: () => true }),
          leaderboards: {
            setScore: async (board: string, score: number, extraData?: string) => {
              (window as any).__leaderboardSubmissions.push({
                board,
                score,
                extraData,
              });
            },
            getEntries: async () => ({ entries: [] }),
          },
        }),
      };
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => (window as any).__leaderboardSubmissions?.length === 2,
      null,
      { timeout: 10_000 },
    );

    const submissions = await page.evaluate(
      () => (window as any).__leaderboardSubmissions as Array<{
        board: string;
        score: number;
        extraData?: string;
      }>,
    );
    expect(submissions[0]).toMatchObject({
      board: 'endlessWaves',
      score: 42,
    });
    expect(submissions[1]?.board).toBe('dailyWaves');
    expect(submissions[1]?.score % 1_000_000).toBe(17);
    expect(JSON.parse(submissions[1]?.extraData ?? '{}').score).toBe(17);
  });

  test('shows both boards and filters Daily Event to the current Moscow day', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== '1280x576');

    await page.route('https://yandex.ru/games/sdk/v2', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: '',
      });
    });
    await page.addInitScript(() => {
      localStorage.setItem('asd_meta_v2', JSON.stringify({ isShowed: true }));
      localStorage.setItem('asd_platform_launched_v1', '1');
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Moscow',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(new Date());
      const get = (type: string) =>
        parts.find((part) => part.type === type)?.value ?? '0';
      const today = Number(`${get('year')}${get('month')}${get('day')}`);
      const yesterday = today - 1;

      (window as any).__leaderboardCalls = [];
      (window as any).YaGames = {
        init: async () => ({
          features: {
            LoadingAPI: { ready() {} },
            GameplayAPI: { start() {}, stop() {} },
          },
          environment: { i18n: { lang: 'en' } },
          getPlayer: async () => ({ isAuthorized: () => true }),
          leaderboards: {
            setScore: async () => {},
            getEntries: async (
              board: string,
              opts: { includeUser?: boolean; quantityTop?: number },
            ) => {
              (window as any).__leaderboardCalls.push({ board, opts });
              if (board === 'endlessWaves') {
                return {
                  entries: [{
                    rank: 1,
                    score: 42,
                    player: { publicName: 'Endless Ace' },
                  }],
                };
              }
              return {
                entries: [
                  {
                    rank: 1,
                    score: today * 1_000_000 + 17,
                    player: { publicName: 'Today Player' },
                  },
                  {
                    rank: 2,
                    score: yesterday * 1_000_000 + 99,
                    player: { publicName: 'Yesterday Player' },
                  },
                ],
              };
            },
          },
        }),
      };
    });

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      () => !document.body.classList.contains('app-booting'),
      null,
      { timeout: 15_000 },
    );

    await expect(page.locator('.mm-lb-card')).toBeVisible();
    await expect(page.locator('.lb-tab')).toHaveCount(2);
    await expect(page.locator('.lb-body')).toContainText('Endless Ace');
    await expect(page.locator('.lb-body')).toContainText('42');

    await page.locator('[data-tab="dailyWaves"]').click();
    await expect(page.locator('.lb-body')).toContainText('Today Player');
    await expect(page.locator('.lb-body')).toContainText('17');
    await expect(page.locator('.lb-body')).not.toContainText('Yesterday Player');
    await expect(page.locator('.lb-body')).not.toContainText('99');

    const calls = await page.evaluate(
      () => (window as any).__leaderboardCalls as Array<{
        board: string;
        opts: { quantityTop?: number };
      }>,
    );
    expect(calls.at(-1)).toEqual({
      board: 'dailyWaves',
      opts: { includeUser: false, quantityTop: 20, quantityAround: 0 },
    });
  });
});
