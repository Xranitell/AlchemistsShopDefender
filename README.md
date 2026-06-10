# Alchemist's Shop: Rune Defense

Roguelike Tower Defense / Survival Strategy для веб-платформ (Yandex Games / CrazyGames). Реализация на чистом HTML5 Canvas + TypeScript + Vite, **без Unity** — статическая сборка зипуется одним архивом и заливается в Yandex Games Console.

Полный геймдизайн: [docs/GDD.md](docs/GDD.md). Текущая итерация — **вертикальный срез** (раздел 23 GDD): 5 волн, базовая склянка, 2 типа стоек, 3 типа врагов + мини-босс, золото, 11 карт, Overload.

## Стек

- **TypeScript + Vite** — статическая сборка, вывод в `dist/`.
- **HTML5 Canvas 2D** — лёгкий рендер, мгновенный старт (важно для YG SDK).
- **Платформенные SDK** — Yandex Games и CrazyGames SDK v3 подключаются через единый фасад [`src/platform.ts`](src/platform.ts). Каждая сборка загружает только SDK своей платформы.

Никаких сторонних игровых движков нет — всё рисование, физика, AI и UI написаны вручную.

## Локальный запуск

```bash
npm install
npm run dev          # vite dev-server на http://localhost:5173
npm run build        # production-сборка в dist/
npm run build:yandex # Yandex Games SDK
npm run build:crazygames # CrazyGames SDK v3
npm run preview      # локальный предпросмотр прод-сборки
npm run typecheck    # tsc --noEmit
npm run package      # npm run build + zip в alchemists-shop-rune-defense.zip
npm run optimize-assets  # пережимает PNG в public/sprites и MP3 в public/audio (требует pngquant, optipng, ffmpeg)
```

## CrazyGames leaderboard

CrazyGames supports one global weekly leaderboard per game. The CrazyGames
build submits the highest wave reached in a single run, across every mode,
through
`CrazyGames.SDK.user.submitScore`; the global list itself is rendered by the
CrazyGames platform and resets automatically each Monday at 09:00 UTC. The
game exposes only this one overall leaderboard in the CrazyGames build.

Yandex uses two global boards configured in the developer console:

- `endlessWaves`: all-time best wave reached in a single run across all modes.
- `dailyWaves`: daily best. The date is encoded into the submitted score and
  filtered on read so the visible ranking resets at 00:00 Europe/Moscow.

Both Yandex boards must use descending score order. `dailyWaves` must allow
scores above `21000000000000`, because its technical score includes the date.

Configure the Leaderboard tab in the CrazyGames Developer Portal with:

- Leaderboard guide: `Reach the highest wave in any mode`
- Metric type: `POINTS`
- Incremental scoring: `false`
- Score sorting: `DESC`
- Min/max score: `1` / `100000`
- Cooldown: `10` seconds
- Encryption key: `0zx7hxGV34IW2PnBXzkBnN/v7RjAOzprXFNayinyZks=`

The same key is embedded into the CrazyGames build through
`.env.crazygames`; this is expected for client-side leaderboard submission
and is not the server-side API key.

Требования: Node.js 18+ (тест на v22.12). `npm install` не требует системных пакетов.

## Заливка на Yandex Games

1. Запусти `npm run package`. В корне появится `alchemists-shop-rune-defense.zip` со статической сборкой (`index.html` в корне архива).
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

Бросок склянок только ручной — игрок целится мышью и стреляет ЛКМ. Точный ручной бросок даёт +20% урона по центру взрыва. Окно подготовки начинается ДО первой волны: 12 секунд на покупку первой стойки и осмотр арены.

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

- Манекен с HP и ручной бросок усиленных склянок.
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
