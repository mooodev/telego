# Online Integration

## Что сделано

В проекте подготовлен отдельный онлайн-слой, чтобы сетевые функции не были размазаны по `GoBoard`.

- [`online/OnlineService.js`](/Users/meccu/Desktop/teleba/online/OnlineService.js) — единая точка для `fetch`, источников и описания онлайн-возможностей.
- [`online/OnlineBridge.js`](/Users/meccu/Desktop/teleba/online/OnlineBridge.js) — глобальные функции для быстрого доступа из консоли.
- [`goBoard.js`](/Users/meccu/Desktop/teleba/goBoard.js) — использует `OnlineService` и отдает наружу онлайн-состояние.
- [`ui/GameHUD.js`](/Users/meccu/Desktop/teleba/ui/GameHUD.js) — хранит и возвращает URL онлайн-источника пазлов.
- [`main.js`](/Users/meccu/Desktop/teleba/main.js) — поднимает bridge при старте приложения.

## Быстрые функции

После загрузки страницы в браузере доступны:

```js
telebaOnline.help()
telebaOnline.status()
telebaOnline.capabilities()
telebaOnline.getPuzzleFiles()
telebaOnline.getPuzzleSource()
telebaOnline.setPuzzleSource('https://github.com/gogameguru/go-problems/tree/master/weekly-go-problems')
await telebaOnline.loadPuzzleList()
await telebaOnline.openSelectedPuzzle()
await telebaOnline.openPuzzle('https://raw.githubusercontent.com/.../problem.sgf')
```

Также доступны:

```js
telebaBoard
teleba.board
teleba.online
```

`telebaBoard` — живой экземпляр `GoBoard`.

## Как устроено приложение

### Точки входа

- [`index.html`](/Users/meccu/Desktop/teleba/index.html) — HTML-оболочка, импорт TensorFlow.js и Three.js.
- [`main.js`](/Users/meccu/Desktop/teleba/main.js) — старт приложения.

### Главный orchestrator

- [`goBoard.js`](/Users/meccu/Desktop/teleba/goBoard.js) — центр приложения.
- Здесь собираются:
  - Three.js сцена
  - камеры и input events
  - `GoGame`
  - `KataGoEngine`
  - `GameHUD`
  - `SoundManager`
  - `OnlineService`

### Игровая логика

- [`game/GoGame.js`](/Users/meccu/Desktop/teleba/game/GoGame.js) — правила Go, легальность ходов, захваты, pass, scoring, history.

### AI

- [`ai/KataGoEngine.js`](/Users/meccu/Desktop/teleba/ai/KataGoEngine.js) — локальный анализ позиции через TensorFlow.js.
- [`kata/models/`](/Users/meccu/Desktop/teleba/kata/models) — модели `dan` и `kyu`.

### SGF и пазлы

- [`sgf/SgfParser.js`](/Users/meccu/Desktop/teleba/sgf/SgfParser.js) — парсинг SGF в дерево пазла.
- [`puzzles/GitHubPuzzleSource.js`](/Users/meccu/Desktop/teleba/puzzles/GitHubPuzzleSource.js) — обход GitHub-папки и сбор `.sgf`.

### HUD

- [`ui/GameHUD.js`](/Users/meccu/Desktop/teleba/ui/GameHUD.js) — DOM UI:
  - переключение 2D/3D
  - режимы игры
  - board size
  - AI controls
  - puzzle source / puzzle file
  - история лидерства
  - analysis panel
  - score review

### Визуал и звук

- [`goanimations.js`](/Users/meccu/Desktop/teleba/goanimations.js) — анимации.
- [`audio/SoundManager.js`](/Users/meccu/Desktop/teleba/audio/SoundManager.js) — звуки.
- [`textures/`](/Users/meccu/Desktop/teleba/textures) — текстуры доски и окружения.
- [`sounds/`](/Users/meccu/Desktop/teleba/sounds) — аудиоассеты.

## Как работает онлайн-интеграция

### Загрузка списка пазлов

1. Пользователь нажимает `Load Puzzle List`.
2. `GameHUD` передает URL в `GoBoard.handleHudAction(...)`.
3. `GoBoard.loadPuzzleList(...)` вызывает `OnlineService.loadPuzzleList(...)`.
4. `OnlineService` использует [`puzzles/GitHubPuzzleSource.js`](/Users/meccu/Desktop/teleba/puzzles/GitHubPuzzleSource.js).
5. `GoBoard` обновляет select, статус и `selectedPuzzleUrl`.

### Загрузка конкретного SGF

1. Пользователь выбирает SGF и нажимает `Open Puzzle`.
2. `GoBoard.loadPuzzleFromUrl(...)` вызывает `OnlineService.loadPuzzleText(...)`.
3. Текст уходит в `parseSgf(...)`.
4. `GoBoard.applyPuzzle(...)` переводит приложение в режим `puzzle`.

### Быстрый доступ извне

1. `main.js` создает `GoBoard`.
2. `attachOnlineBridge(...)` публикует API в `globalThis`.
3. Консоль, DevTools или внешний скрипт могут работать через `telebaOnline`, не лезя в приватную структуру класса.

## Где расширять дальше

Если появится backend, авторизация, облачные сохранения, матчмейкинг или свои источники пазлов, это лучше добавлять в `online/`.

Практическое правило:

- сетевые запросы, URL, провайдеры, токены, адаптеры API — `online/`
- игровое состояние, доска, AI, HUD, визуал — существующие доменные модули
