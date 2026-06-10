import { test, expect } from '@playwright/test';

const SEED_SAVE = {
  isShowed: true,
  locale: 'ru',
  localeUserChoice: true,
  tutorialDone: true,
  menuTutorialDone: true,
  pauseTutorialDone: true,
  cursedTutorialDone: true,
  settingsTutorialDone: true,
};

test.describe('card draft overflow', () => {
  test('has no scrollbar or scrollable overflow at 1920x860', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== '1280x576');
    await page.setViewportSize({ width: 1920, height: 860 });
    await page.addInitScript((seed) => {
      localStorage.setItem('asd_meta_v2', JSON.stringify(seed));
      localStorage.setItem('asd_platform_launched_v1', '1');
    }, SEED_SAVE);

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.main-menu', {
      state: 'visible',
      timeout: 15_000,
    });

    await page.evaluate(() => {
      const overlay = document.querySelector<HTMLElement>('#overlay')!;
      const card = (title: string, effect: string, rarity: string) => `
        <button class="card-rh rarity-${rarity}">
          <div class="card-rh-frame">
            <div class="card-rh-top"><div class="card-rh-glyph">△</div></div>
            <div class="card-rh-title">${title}</div>
            <div class="card-rh-divider"></div>
            <ul class="card-rh-effects">
              <li class="card-rh-bullet-pos">${effect}</li>
            </ul>
          </div>
        </button>`;

      overlay.className = 'visible cards-mode';
      overlay.innerHTML = `
        <div class="cards-stage">
          <h2 class="cards-stage-title">Волна 1 пройдена</h2>
          <p class="cards-stage-subtitle">
            Выбери одну карту улучшения. Между волнами можно докупить стойки.
          </p>
          <div class="cards-row-wrap">
            <div class="cards-rh">
              ${card('Алхимический хват I', '-6% к откату склянок', 'common')}
              ${card('Расширенные линзы II', '+10% к дальности стоек', 'rare')}
              ${card('Укреплённый каркас II', '+25 макс. Прочности Манекена и +25 текущей Прочности', 'rare')}
            </div>
          </div>
          <div class="cards-action-row">
            <button class="cards-action-pill">Пересдать <span class="cards-action-counter">50</span></button>
            <button class="cards-action-pill accent">Пересдать за рекламу</button>
            <button class="cards-action-pill danger">Пропустить</button>
          </div>
        </div>`;
    });

    await page.evaluate(
      () => new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );

    const layout = await page.locator('#overlay').evaluate((overlay) => {
      const stage = overlay.querySelector('.cards-stage')!;
      const stageRect = stage.getBoundingClientRect();
      const style = getComputedStyle(overlay);
      return {
        overflowX: style.overflowX,
        overflowY: style.overflowY,
        scrollbarWidth: style.scrollbarWidth,
        clientWidth: overlay.clientWidth,
        clientHeight: overlay.clientHeight,
        scrollWidth: overlay.scrollWidth,
        scrollHeight: overlay.scrollHeight,
        scrollLeft: overlay.scrollLeft,
        scrollTop: overlay.scrollTop,
        stage: {
          left: stageRect.left,
          top: stageRect.top,
          right: stageRect.right,
          bottom: stageRect.bottom,
        },
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      };
    });

    expect(layout.overflowX).toBe('hidden');
    expect(layout.overflowY).toBe('hidden');
    expect(layout.scrollbarWidth).toBe('none');
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight + 1);
    expect(layout.scrollLeft).toBe(0);
    expect(layout.scrollTop).toBe(0);
    expect(layout.stage.left).toBeGreaterThanOrEqual(-1);
    expect(layout.stage.top).toBeGreaterThanOrEqual(-1);
    expect(layout.stage.right).toBeLessThanOrEqual(layout.viewport.width + 1);
    expect(layout.stage.bottom).toBeLessThanOrEqual(layout.viewport.height + 1);

    await page.mouse.move(layout.viewport.width / 2, layout.viewport.height / 2);
    await page.mouse.wheel(0, 500);
    await expect.poll(
      () => page.locator('#overlay').evaluate((el) => el.scrollTop),
    ).toBe(0);
  });

  test('keeps all actions visible in Yandex mobile landscape embeds', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== '1280x576');
    await page.addInitScript((seed) => {
      localStorage.setItem('asd_meta_v2', JSON.stringify(seed));
      localStorage.setItem('asd_platform_launched_v1', '1');
    }, SEED_SAVE);

    const yandexEmbeds = [
      { name: 'iPhone 12 Pro', width: 844, height: 357 },
      { name: 'iPhone XR', width: 896, height: 381 },
      { name: 'Galaxy S20 Ultra', width: 915, height: 379 },
    ];

    for (const viewport of yandexEmbeds) {
      await test.step(viewport.name, async () => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.main-menu', {
          state: 'visible',
          timeout: 15_000,
        });

        await page.evaluate(() => {
          const overlay = document.querySelector<HTMLElement>('#overlay')!;
          const card = (title: string, effect: string, rarity: string) => `
            <button class="card-rh rarity-${rarity}">
              <div class="card-rh-frame">
                <div class="card-rh-top"><div class="card-rh-glyph">!</div></div>
                <div class="card-rh-title">${title}</div>
                <div class="card-rh-divider"></div>
                <ul class="card-rh-effects">
                  <li class="card-rh-bullet-pos">${effect}</li>
                </ul>
              </div>
            </button>`;

          overlay.className = 'visible cards-mode';
          overlay.innerHTML = `
            <div class="cards-stage">
              <h2 class="cards-stage-title">Волна 1 пройдена</h2>
              <p class="cards-stage-subtitle">
                Выбери одну карту улучшения. Между волнами можно докупить стойки.
              </p>
              <div class="cards-row-wrap">
                <div class="cards-rh">
                  ${card('Укреплённый каркас II', '+25 максимальной прочности', 'rare')}
                  ${card('Точная наводка I', '+8% к урону стоек', 'common')}
                  ${card('Смазанные механизмы I', '+6% к скорострельности стоек', 'common')}
                </div>
              </div>
              <div class="cards-action-row">
                <button class="cards-action-pill">
                  Пересдать <span class="cards-action-counter">50</span>
                </button>
                <button class="cards-action-pill accent">Пересдать за рекламу</button>
                <button class="cards-action-pill danger">Пропустить</button>
              </div>
            </div>`;
        });

        await page.evaluate(
          () => new Promise<void>((resolve) =>
            requestAnimationFrame(() =>
              requestAnimationFrame(() => resolve()))),
        );

        const layout = await page.locator('#overlay').evaluate((overlay) => {
          const rectOf = (element: Element) => {
            const rect = element.getBoundingClientRect();
            return {
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
            };
          };
          const style = getComputedStyle(overlay);
          const actionRow = overlay.querySelector('.cards-action-row')!;
          const buttons = Array.from(
            overlay.querySelectorAll('.cards-action-pill'),
            rectOf,
          );

          return {
            narrowFit: document.documentElement.classList.contains(
              'viewport-fitted-narrow',
            ),
            overflowX: style.overflowX,
            overflowY: style.overflowY,
            scrollbarWidth: style.scrollbarWidth,
            clientWidth: overlay.clientWidth,
            clientHeight: overlay.clientHeight,
            scrollWidth: overlay.scrollWidth,
            scrollHeight: overlay.scrollHeight,
            stage: rectOf(overlay.querySelector('.cards-stage')!),
            actionRow: rectOf(actionRow),
            buttons,
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
          };
        });

        expect(layout.narrowFit).toBe(true);
        expect(layout.overflowX).toBe('hidden');
        expect(layout.overflowY).toBe('hidden');
        expect(layout.scrollbarWidth).toBe('none');
        expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
        expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight + 1);
        expect(layout.stage.left).toBeGreaterThanOrEqual(-1);
        expect(layout.stage.top).toBeGreaterThanOrEqual(-1);
        expect(layout.stage.right).toBeLessThanOrEqual(layout.viewport.width + 1);
        expect(layout.stage.bottom).toBeLessThanOrEqual(layout.viewport.height + 1);
        expect(layout.actionRow.top).toBeGreaterThanOrEqual(0);
        expect(layout.actionRow.bottom).toBeLessThanOrEqual(
          layout.viewport.height + 1,
        );
        expect(layout.buttons).toHaveLength(3);

        for (const button of layout.buttons) {
          expect(button.left).toBeGreaterThanOrEqual(0);
          expect(button.top).toBeGreaterThanOrEqual(0);
          expect(button.right).toBeLessThanOrEqual(layout.viewport.width + 1);
          expect(button.bottom).toBeLessThanOrEqual(layout.viewport.height + 1);
        }

        await page.mouse.move(
          layout.viewport.width / 2,
          layout.viewport.height / 2,
        );
        await page.mouse.wheel(0, 500);
        await expect.poll(
          () => page.locator('#overlay').evaluate((el) => el.scrollTop),
        ).toBe(0);
      });
    }
  });
});
