# Alchemist's Shop Defender

Roguelike Tower Defense / Survival Strategy для веб-платформ (Yandex Games / CrazyGames). Реализация на чистом HTML5 Canvas + TypeScript + Vite, **без Unity** — статическая сборка зипуется одним архивом и заливается в Yandex Games Console.

Полный геймдизайн: [docs/GDD.md](docs/GDD.md). Текущая итерация — **вертикальный срез** (раздел 23 GDD): 5 волн, базовая склянка, 2 типа стоек, 3 типа врагов + мини-босс, золото, 11 карт, Overload.

## Стек

- **TypeScript + Vite** — статическая сборка, вывод в `dist/`.
- **HTML5 Canvas 2D** — лёгкий рендер, мгновенный старт (важно для YG SDK).
- **Yandex Games SDK** — интегрирован через тонкую обёртку [`src/yandex.ts`](src/yandex.ts). Если SDK не загрузился (локалка, CrazyGames, обычный веб) — все вызовы становятся no-op.

Никаких сторонних игровых движков нет — всё рисование, физика, AI и UI написаны вручную.

## Локальный запуск

```bash
npm install
npm run dev          # vite dev-server на http://localhost:5173
npm run build        # production-сборка в dist/
npm run preview      # локальный предпросмотр прод-сборки
npm run typecheck    # tsc --noEmit
npm run package      # npm run build + zip в alchemists-shop-defender.zip
```

Требования: Node.js 18+ (тест на v22.12). `npm install` не требует системных пакетов.

## Заливка на Yandex Games

1. Запусти `npm run package`. В корне появится `alchemists-shop-defender.zip` со статической сборкой (`index.html` в корне архива).
2. Загрузи zip в [Yandex Games Console](https://yandex.ru/dev/games/console) → "Добавить версию".
3. SDK уже подключён в [`index.html`](index.html). Wrapper [`src/yandex.ts`](src/yandex.ts) вызывает:
   - `LoadingAPI.ready()` — после инициализации, чтобы убрать спиннер площадки;
   - `GameplayAPI.start()` / `stop()` — на старте и на паузе забега, для корректной работы рекламы;
   - `adv.showRewardedVideo()` — задел под rewarded ads (пока не вызывается из геймплея, MVP).

## Управление

| Действие | PC | Touch |
| --- | --- | --- |
| Точный бросок склянки | ЛКМ | Tap |
| Открыть магазин стоек | ЛКМ по руне | Tap по руне |
| Активация Overload | `Q` или кнопка HUD | Кнопка HUD |
| Старт следующей волны | `Space` или кнопка HUD | Кнопка HUD |

Авто-бросок включён всегда: если игрок не кидает склянку вручную, Манекен сам кидает в ближайшего врага. Ручной бросок даёт +20% урона по центру взрыва.

## Структура проекта

```
src/
├── engine/        # game loop, ввод, математика, RNG
├── game/          # mannequin, enemies, towers, projectiles, waves, cards, overload, render
├── data/          # data-driven описания врагов, стоек, карт, волн
├── ui/            # HUD, оверлей карт, магазин стоек (HTML/CSS поверх Canvas)
├── yandex.ts      # обёртка Yandex Games SDK
└── main.ts        # точка входа: init, loop, переходы фаз
```

## Что входит в текущий PR (вертикальный срез)

- Манекен с HP, авто-бросок и ручной бросок усиленных склянок.
- 2 типа стоек (Игломет, Алхимическая мортира) с 3 уровнями апгрейда.
- 3 типа врагов (Слизень, Крыса-вор, Бронированный голем) + мини-босс «Большой Слизневой Комок» на волне 5.
- 5 волн по сценарию из [`src/data/waves.ts`](src/data/waves.ts), с подсветкой активных входов.
- Золото в забеге, покупка/апгрейд стоек на рунических точках.
- 11 карт улучшений (Common/Rare/Epic), выбор 1 из 3 после каждой волны.
- Overload (Громоотвод по умолчанию; меняется на Хронос через карту).
- Огненная лужа как первая стихийная реакция (карта «Горючая смесь»).
- Floating-text фидбек, HP-бары, пульсация активных входов, лут-магнетизм.

## Дальнейшие шаги (по GDD)

См. раздел 20 «Production roadmap» в [docs/GDD.md](docs/GDD.md). Следующие итерации:

- Этап 2: больше стоек/склянок, Кислота+Огонь и Ртуть+Эфир реакции, баланс на 15 волн.
- Этап 3: мета-валюты (Синяя/Древняя Эссенция), дерево Манекена, save/load, daily.
- Этап 4: 2-3 биома, новые враги, боссы 10/15, Endless, Battle Pass, rewarded ads.
- Этап 5: спрайты, звук, оптимизация, локализация, релиз.
