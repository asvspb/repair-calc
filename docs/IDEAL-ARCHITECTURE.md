# 🏗 Идеальная архитектура repair-calc (прагматичная редакция)

**Автор:** Principal Architect
**Дата:** 2026-06-21
**Редакция:** v2 — после ревью заказчика (solo-проект, эволюционный путь)
**Статус:** Концептуальный vision
**Назначение:** эталонная архитектура «как должно быть», на которую
ориентироваться при эволюции кода. **Не план Big Rewrite.**

> Связанные документы: [AUDIT-2026-06-21.md](./AUDIT-2026-06-21.md) — текущие
> долги; [ARCHITECTURE.md](./ARCHITECTURE.md) — фактическая архитектура.

---

## 0. Принципы проектирования

1. **Бизнес-логика вне React/Node** — в `packages/domain` как чистые функции
   (главный приоритет; см. §3).
2. **FSD в 3 слоя** (`app → features → shared`) — без 7 канонических слоёв
   (overkill для solo-проекта). См. §2.
3. **Тонкие сторы** — одна ответственность на стор; `ProjectSlice` разрезать.
4. **Offline-first, но простой**: dirty-flag + Last-Writer-Wins — без CRDT и
   merge-dialog (см. §4).
5. **Enforcing слоёв** через `dependency-cruiser` в CI — без этого слоёв нет.
6. **Без хардкода строк** — i18n; **последний** пункт в очереди, не параллельно.
7. **Ошибки — никогда тихие.** Типизированные ошибки + централизованный
   `ErrorHandler` (см. §8).
8. **Стек не трогаем без нужды:** Express + Knex остаются — работают.
   Контракты = **zod** (уже в проекте), без Prisma.

---

## 1. Структура репозитория: Monorepo на npm workspaces

Текущий проект смешивает `src/` (frontend) и `server/` в одном `package.json`.
Идеально — разделить на пакеты через **`npm workspaces`** (без pnpm/Turborepo —
overkill для 1–2 разработчиков).

```
repair-calc/
├── apps/
│   ├── web/                    # React-приложение (Vite)
│   │   └── src/
│   │       ├── app/            # композиционный корень (провайдеры, роутинг)
│   │       ├── features/       # доменные слайсы (§2)
│   │       └── shared/         # ui-кит, lib, config, api-клиент, i18n
│   └── server/                 # Node.js API (Express — оставляем)
│       └── src/
│           ├── modules/        # разбиение по домену (§6 — update.ts!)
│           └── shared/         # middleware, db, logging, errors
├── packages/
│   ├── domain/                 # ЧИСТАЯ бизнес-логика (геометрия, расчёты)
│   ├── shared-types/           # zod-схемы → типы (единый источник контрактов)
│   └── eslint-config/          # общие правила lint
├── tools/                      # codegen, dep-cruiser config
├── .dependency-cruiser.js      # enforcing слоёв
└── package.json                # workspaces: ["apps/*", "packages/*"]
```

**Что НЕ меняем:** Express, Knex, MySQL, JWT — работают, миграция ради
бенчмарков неоправдана.

**Убираем из v1:** отдельный `packages/ui-kit` — при одном фронтенде достаточно
`apps/web/src/shared/ui/`. OpenTelemetry/SonarQube — тяжёлая инфраструктура,
нужны только при росте команды.

---

## 2. FSD в 3 слоя на клиенте

Вместо канонических 7 слоёв FSD (app/processes/pages/widgets/features/entities/
shared) — упрощаем до **3**, достаточных для solo-проекта:

```
apps/web/src/
├── app/         # корень: провайдеры, роутинг, глобальные сторы/иниты
├── features/    # доменные слайсы (projects/, objects/, rooms/, works/,
│                #   geometry/, pricing/, auth/, sync/, export/)
└── shared/      # переиспользуемое: ui/, lib/, config/, api/, i18n/
```

**Правило направлений зависимостей (dependency-cruiser):**

```
app → features → shared        (строго сверху вниз)
```

- features **не** импортируют друг друга напрямую — только через `shared`
  или события/селекторы.
- обратные импорты и циклы **запрещены**, падают в CI.

Внутри `features/<name>/`:

```
features/projects/
├── api/        # запросы (локально в слайсе, не глобальный api/)
├── model/      # store-slice, типы, бизнес-правила
├── ui/         # компоненты слайса
└── index.ts    # public API (barrel) — что видно наружу
```

---

## 3. Доменный слой (`packages/domain`) — главный приоритет

Главная проблема текущего кода — бизнес-логика расползлась по компонентам
(`handleCopyProject`, ID-генерация, расчёты в `App.tsx`). Идеально: **вся
доменная логика в `packages/domain`** как чистые функции, не знающие о
React/Node.

```
packages/domain/src/
├── project/
│   ├── project.factory.ts      # createProject, cloneProject (монотонные ID)
│   ├── project.rules.ts        # инварианты, валидация
│   └── project.test.ts
├── room/
│   ├── room.geometry.ts        # площади, периметры, проёмы
│   └── room.test.ts
├── work/
│   ├── work.calculation.ts     # объёмы работ, расход материалов
│   └── work.test.ts
├── id/                          # единый генератор ID (crypto.randomUUID)
└── money/                       # тип Money, форматирование
```

**Преимущества:**

- 100% unit-покрытие чистыми тестами (без jsdom) — дёшево и быстро.
- Переиспользование на клиенте и сервере (валидация — один код).
- UI-компоненты становятся тонкими проекциями состояния.

Это **первый шаг** эволюции (§14): начать с `geometry`, `costs`, `factories`.

---

## 4. Offline-first: dirty-flag + Last-Writer-Wins (упрощённо)

Текущий подход: `scheduleSave`/`scheduleTotalsSave`/`JSON.stringify`-диффы,
поля ошибок разбросаны по слайсам, гонки таймеров.

### Принятая модель (прагматичная)

```
┌─────────────┐   mutate    ┌──────────────┐ persist   ┌───────────────┐
│   UI/store  │ ──────────► │  SyncManager │ ────────► │  IndexedDB    │
└─────────────┘             │              │           │  (Dexie)      │
                            └──────┬───────┘           └───────────────┘
                                   │ flush (online)
                                   ▼
                            ┌──────────────┐
                            │  HTTP /sync  │
                            └──────────────┘
```

- **Хранилище:** IndexedDB через **Dexie** вместо `localStorage` (последний —
  синхронный, ~5МБ, без транзакций; бомба замедленного действия).
- **Грязные сущности:** каждая мутация ставит `dirty: true` + `updatedAt` на
  затронутые сущности (project/object/room/work).
- **SyncManager** (один, изолирован в `features/sync`): на интервале / по
  онлайну пушит только `dirty`-сущности батчем на `/api/sync/push`, тянет
  `/api/sync/pull`.
- **Разрешение конфликтов:** **Last-Writer-Wins** по серверному `updatedAt`.
  Без CRDT, без merge-dialog — для solo-калькулятора этого достаточно.
- **Идемпотентность:** ключи операций по `entity.id + updatedAt`.
- Состояние sync в **`features/sync` slice**: `{status, dirtyCount, lastSyncAt,
errors}` — не пачкает доменные слайсы (устраняет смесь в `ProjectSlice`).

---

## 5. Миграция данных localStorage → IndexedDB (пропущено в v1)

Переход на IndexedDB **требует стратегии переноса** существующих данных
пользователей, иначе потеря данных при релизе.

### Алгоритм миграции (одноразовый, в `features/sync/migration`)

```
onAppInit():
  if indexedDB.hasFlag('migration_v1_done'):
    return  // уже мигрировано

  legacyData = localStorage.get(STORAGE_KEYS.PROJECTS)  // текущий ключ
  if legacyData == null:
    setFlag('migration_v1_done')
    return  // чистая установка

  try:
    parsed = safeParse(legacyData)          // zod-валидация схемы
    await dexie.bulkUpsert(parsed)
    // НЕ удаляем localStorage сразу — держим как бэкап N релизов
    localStorage.set(STORAGE_KEYS.PROJECTS + '_backup', legacyData)
    setFlag('migration_v1_done')
    logger.info('migration', { count: parsed.length })
  catch err:
    logger.error('migration_failed', err)
    // fallback: продолжаем работать с localStorage, ставим флаг ошибки
    setFlag('migration_v1_failed', err)
```

### Защитные меры

- **Флаг в IndexedDB** `migration_v1_done` — идемпотентность, не гоняем каждый старт.
- **Резервная копия** legacy-данных в localStorage — откат на N релизов.
- **zod-валидация** распарсенных данных — защита от повреждённых структур.
- **Неудача не ломает приложение:** fallback на localStorage + лог ошибки.
- **Метрика:** логировать количество мигрированных сущностей для мониторинга.
- Удаление legacy-копии — отдельный шаг через 2–3 релиза после подтверждения
  стабильности (с пометкой в `INDEX.md`).

---

## 6. Монолит `server/src/routes/update.ts` (2184 строки) — НЕ упомянут в v1

**Самый большой монолит во всём проекте.** Содержит маршруты + бизнес-логику
сервиса обновлений + admin-эндпоинты (без проверки прав — см. S2 в аудит).

### Декомпозиция по доменным модулям

```
apps/server/src/modules/
└── update-service/
    ├── routes/
    │   ├── jobs.routes.ts        # CRUD заданий обновления
    │   ├── parsers.routes.ts     # управление парсерами (admin)
    │   ├── runner.routes.ts      # запуск/статус (admin)
    │   └── webhooks.routes.ts    # колбэки завершения
    ├── services/
    │   ├── jobRunner.ts          # оркестрация (← services/update/runner.ts, 647)
    │   ├── parserManager.ts      # ← services/update/parserManager.ts, 662
    │   └── scheduler.ts          # cron-расписание
    ├── admin-guard.middleware.ts # RBAC на admin-эндпоинты (закрывает S2)
    └── index.ts                  # compose маршруты + guard
```

Связанные крупные файлы, подтягиваемые в модуль:

- `db/repositories/updateJob.repo.ts` (772) — оставить репозиторием, но
  разрезать на `jobQueries.ts` / `jobMutations.ts` при росте.
- `services/update/parsers/*` (webScraper 458, lemanaParser 375, ...) —
  единый интерфейс `IParser`, реализация в отдельных файлах.

**Приоритет:** декомпозиция `update.ts` — **серверный аналог** расщепления
`RoomEditor.tsx`, выполняется в той же волне рефакторинга.

---

## 7. Состояние: изолированные сторы

Текущий `ProjectSlice` (609 строк) смешивает 4 ответственности (домен +
auth + sync + persistence). Разрезаем:

| Store           | Ответственность                                                 |
| --------------- | --------------------------------------------------------------- |
| `projectsStore` | только домен: список, активный, CRUD (делегирует в SyncManager) |
| `objectsStore`  | объекты                                                         |
| `roomsStore`    | комнаты                                                         |
| `authStore`     | сессия, токены, user                                            |
| `syncStore`     | статус sync, dirty-флаги, ошибки                                |
| `uiStore`       | модалки, активная вкладка, мобильные меню                       |

Кросс-store взаимодействие — через **selectors/подписки**, не через взаимные
мутации. Typed selectors + `shallow`-сравнение для минимизации ре-рендеров.

---

## 8. Архитектура обработки ошибок (пропущена в v1)

### Типизированные ошибки

```
packages/shared-types/src/errors.ts
├── AppError (базовый, абстрактный)
│   ├── code: ErrorCode          // enum: 'VALIDATION' | 'NETWORK' | 'SYNC_CONFLICT' | ...
│   ├── message: string          // безопасное сообщение для UI
│   ├── cause?: unknown          // оригинальная ошибка (для логов)
│   ├── isOperational: boolean   // ожидаемая (бизнес) vs программная
│   └── context?: Record        // метаданные (entityId, op)
├── ValidationError  ← AppError
├── NetworkError     ← AppError
├── SyncError        ← AppError
└── NotFoundError    ← AppError
```

### Границы ошибок (error boundaries)

- **Клиент:** `shared/ui/ErrorBoundary` (есть в проекте) оборачивает критичные
  виджеты, **не только корень** — частичный fallback (падает одна карточка, не
  всё приложение). ErrorBoundary → `logger.error(ctx, err)` + fallback UI.
- **Сервер:** централизованный `errorHandler.ts` (есть) — единая точка
  преобразования `AppError → HTTP-ответ` со статусом из `code`.

### Retry-стратегия (в `shared/api`)

- Сетевые/5xx → экспоненциальная задержка (1с, 2с, 4с), макс. 3 попытки.
- 4xx → без retry (клиентская ошибка).
- Idempotent-ключи на мутирующие запросы (защита от дублей при retry).
- Таймаут запроса — единая константа в `shared/config`.

### Запреты (ESLint-уровень)

- `catch (e) {}` пустой → `no-empty` + кастомное правило на логирование.
- `alert` / `window.confirm` / `console.log|info` → error.
- Любая ошибка должна быть либо обработана (recovery), либо прокинута в
  ErrorBoundary / errorHandler, **никогда проглочена**.

---

## 9. Производительность и кэширование клиента

Калькулятор с геометрическими расчётами чувствителен к частому пересчёту
(`geometry.ts`, `materialCalculations.ts`, `costs.ts`). Текущее состояние:
`useMemo`/`useCallback` применяются **неравномерно** (есть в `useGeometryState`,
`useMaterialCalculation`, но не везде); zustand-селекторы **без `shallow`**
(0 совпадений по `shallow`/`.subscribe`) → избыточные ре-рендеры.

### Меры

- **Мемоизация тяжёлых вычислений:** `useMemo` для расчётов площадей/материалов
  с корректными deps; чистые функции домена (§3) мемоизируются сами по себе
  (referential transparency) — кэш на уровне аргументов при необходимости.
- **Zustand-селекторы с `shallow`:** `useProjectStore(selectProjects, shallow)` —
  сравнение по значению, а не по ссылке, для массивов/объектов. Убирает
  каскадные ре-рендеры при无关ных мутациях.
- **Дебаунс пересчёта при вводе размеров:** ввод `length`/`width`/`height` →
  debounce ~150–300мс перед пересчётом, чтобы не считать на каждый keystroke.
- **Виртуализация длинных списков** (`WorkList`, `RoomList` при росте) — только
  при измеренном замедлении (не преждевременно).
- **Профилирование:** React DevTools Profiler + измерение перед/после
  рефакторинга; цель — убрать ре-рендеры, а не «оптимизировать наугад».

> Принцип: оптимизация **по измерениям**, а не превентивная. Мемоизация и
> `shallow`-селекторы — базовая гигиена (внедрить сразу); виртуализация/более
> сложные техники — только при подтверждённом bottleneck.

---

## 10. Контракты: zod как единый источник (без Prisma)

**Решение:** Knex остаётся (работает), Prisma не вводим — его миграция ничего
не даёт при уже работающей БД.

- **`packages/shared-types`**: zod-схемы = runtime-валидация **и** TS-типы
  одновременно (`z.infer<typeof ProjectSchema>`).
- Клиент и сервер импортируют типы из `shared-types` — **ноль ручного
  дублирования**.
- Сервер: zod уже используется в `validation.ts`/`errorHandler.ts` — расширяем.
- БД: Knex-миграции остаются; соответствие схема↔zod проверяется
  контракт-тестами.

---

## 11. Тестирование (пирамида)

| Слой                       | Инструмент         | Цель покрытия                                   |
| -------------------------- | ------------------ | ----------------------------------------------- |
| **Domain** (чистая логика) | vitest             | ≥95% — самое дешёвое                            |
| **Store/features**         | vitest + msw       | ≥70% — msw-тесты хрупкие, баланс cost/benefit   |
| **UI компоненты**          | Testing Library    | критичные взаимодействия (snapshot/interaction) |
| **Сервер modules**         | vitest + supertest | ≥85%                                            |
| **Контракты**              | zod vs API schema  | авто-тесты                                      |
| **E2E**                    | Playwright         | 5–10 happy-path (smoke/крит-путей)              |

msw для моков HTTP на всех уровнях ниже E2E → стабильные детерминированные тесты.

> **Учёт существующей инфраструктуры:** E2E **уже есть** — `playwright.config.ts`
>
> - директория `e2e/` (13 spec-файлов, `fixtures/`, `helpers/`, `pages/`,
>   `test-utils.ts`). Сейчас в плохом состоянии (по `TODO.md`: 10 passed /
>   11 failed / ~135 skipped). Цель — **не с нуля, а оживить**: раскомментировать
>   `.skip`, поднять pass-rate (≥80% для Chromium), зафиксировать 5–10
>   стабильных happy-path, остальных не плодить. Unit-база (908 тестов) — уже
>   хороший фундамент; после выноса домена (§3) часть jsdom-тестов станет в ~10×
>   быстрее.

---

## 12. CI/CD (облегчённый)

```yaml
jobs:
  quality:
    - npm ci
    - npm run lint # eslint, 0 errors
    - npm run typecheck # tsc --noEmit (все workspaces)
    - npm run lint:deps # dependency-cruiser (0 циклов, слои)
    - npm test # vitest
    - npm run build # все приложения
  e2e:
    - npx playwright test # крит-пути
```

- **dependency-cruiser** — обязательный гейт: правила 3-слойного FSD,
  запрет `features → features`, запрет циклов.
- **Прекоммит:** `lint-staged` (eslint + prettier на изменённых файлах).
- **Убрано из v1:** SonarQube (тяжёлая инфраструктура), OpenTelemetry — вводить
  только при росте команды/нагрузки.
- SemVer + Conventional Commits → автогенерация changelog.

---

## 13. Безопасность

- **Секреты только на сервере** (текущий проект это уже исправил — AI через
  серверный прокси).
- **.env/\*.local** — gitignored; в репозитории только `.env.example`.
- **JWT:** короткий access + refresh; хранить refresh в httpOnly cookie (не
  localStorage) при возможности.
- **RBAC** для admin-эндпоинтов `update.ts` — `admin-guard.middleware.ts` (§6),
  закрывает дефект S2 аудита.
- **Валидация ввода** — zod на границе (сервер) + валидация ответов.
- **Rate limiting, helmet, CORS** — оставить как есть.

---

## 14. Эволюционный путь (не Big Rewrite)

Постепенная миграция по **фазам реального impact** (порядок согласован с
ревью Antigravity: серверный монолит поднимается раньше доменного слоя, т.к.
даёт наибольший эффект при наименьшем риске для UI).

### Фаза 1 — Гигиена (1–2 дня)

- [ ] Починить lint-ошибки аудита: `createSyncSlice.ts:56` (`prefer-const`),
      `WorkCatalogPicker.tsx:91` (`no-dupe-else-if`, dead branch).
- [ ] Удалить мёртвый код: `useProjects.ts`, `projectContextPatch.ts`.
- [ ] Заменить `window.confirm` → `ConfirmDialog` (`App.tsx:163`).
- [ ] Убрать `e2e-test-mode` из production-пути (`App.tsx:239`).

### Фаза 2 — Серверный монолит (3–5 дней) — §6

- [ ] Декомпозировать `update.ts` (2184) → `modules/update-service/{routes,services}`.
- [ ] Вынести бизнес-логику из route-хендлеров в сервисы.
- [ ] Добавить `admin-guard.middleware` (RBAC, закрывает дефект S2).

### Фаза 3 — Доменный слой на клиенте (3–5 дней) — §3

- [ ] Создать `packages/domain`: вынести `geometry`, `costs`, `factories` (с
      ID-генерацией, монотонные `crypto.randomUUID`).
- [ ] Перенести тесты; убедиться, что работают без jsdom (~10× быстрее).
- [ ] Убрать `handleCopyProject`/`JSON.parse(JSON.stringify)` из `App.tsx`.

### Фаза 4 — Изолированные сторы (2–3 дня) — §7

- [ ] Разрезать `ProjectSlice` → `projectsStore` + `authStore` + `syncStore` + `uiStore`.
- [ ] Кросс-store через selectors/подписки; `shallow`-сравнение (§9).

### Фаза 5 — Инфраструктура качества (2–3 дня) — §12

- [ ] `dependency-cruiser` + правила 3-слойного FSD + `lint:deps` в CI.
- [ ] Coverage threshold (`vitest --coverage`, fail < 70%).
- [ ] Оживить существующий E2E (§11): раскомментировать `.skip`, pass-rate ≥80%.

### Фаза 6 — Декомпозиция UI-монолитов (5–7 дней) — аудит §3

- [ ] `RoomEditor.tsx` (906) → 3–4 компонента.
- [ ] `BackupManager.tsx` (848) → разделить.
- [ ] `ProjectsModal.tsx` (696) / `CreateProjectModal.tsx` (537) → разделить.
- [ ] Правило: <250 строк/компонент, <100/функция.

### Фаза 7 — Persistence + Sync (3–5 дней) — §4, §5

- [ ] Внедрить Dexie (IndexedDB).
- [ ] Миграция localStorage → IndexedDB (§5, с резервной копией + zod-валидацией).
- [ ] `SyncManager` (standalone, не в store): dirty-flag + Last-Writer-Wins.

### Фаза 8 — Shared Types (2–3 дня) — §10

- [ ] `packages/shared-types` с zod-схемами → `z.infer` типы.
- [ ] Убрать дублирование типов клиент/сервер.

### Фаза 9 — Архитектура ошибок (2–3 дня) — §8

- [ ] Типизированные `AppError` + иерархия.
- [ ] ErrorBoundary на виджеты (частичный fallback) + retry-стратегия.

### Фаза 10 — i18n (фоновая, последняя)

- [ ] `react-i18next` + `ru.json` как единственная локаль.
- [ ] Мигрировать строки постепенно при касании файлов; новые строки — только
      через константы/словарь.

Каждая фаза — атомарная, реверсибельная, с зелёными тестами + `lint:deps`.

---

## 15. Ключевые отличия от текущей реализации (кратко)

| Аспект             | Текуще                                      | Идеально (v2)                                         |
| ------------------ | ------------------------------------------- | ----------------------------------------------------- |
| Группировка кода   | по типу (components/, utils/)               | FSD 3 слоя (app/features/shared)                      |
| Репозиторий        | один package.json                           | npm workspaces (apps/ + packages/)                    |
| Бизнес-логика      | в компонентах + utils вперемешку            | `packages/domain`, чистая                             |
| Синхронизация      | `scheduleSave`, гонки, JSON-диффы           | SyncManager + dirty-flag + LWW                        |
| Хранилище          | localStorage (5МБ, синхр.)                  | IndexedDB (Dexie) + миграция                          |
| Store              | ProjectSlice смешивает 4 отв.               | по стору на ответственность                           |
| Контракты          | дублирование типов                          | zod (Knex оставляем)                                  |
| Сервер             | Express + Knex                              | **оставляем** — работают                              |
| update.ts          | 2184 строки god-file                        | декомпозиция по модулям + RBAC                        |
| Ошибки             | ad-hoc, есть ErrorBoundary                  | типизированные AppError + retry + границы             |
| Производительность | useMemo неравномерно, селекторы без shallow | §9: shallow-селекторы, debounce ввода, профилирование |
| i18n               | хардкод строк                               | react-i18next (последним в очереди)                   |
| Циклы импортов     | неконтролируются                            | dependency-cruiser в CI                               |
| Quality Gate       | lint+test                                   | + dep-cruise (без SonarQube пока)                     |

---

## 16. Что осознанно НЕ делаем (scope-исключения)

Зафиксировано по итогам ревью — чтобы не возвращаться:

- ❌ **Fastify вместо Express** — миграция 2184-строчного сервера ради μs неоправдана.
- ❌ **Prisma вместо Knex** — Knex работает; zod даёт единый источник типов.
- ❌ **Отдельный `packages/ui-kit`** — при одном фронтенде `src/shared/ui/` достаточно.
- ❌ **SonarQube / OpenTelemetry** — тяжёлая инфраструктура; вводить при росте команды.
- ❌ **CRDT / op-log-merge-dialog** — dirty-flag + LWW достаточно для домена.
- ❌ **7 канонических слоёв FSD** — 3 слоя (`app/features/shared`) для solo.
- ❌ **pnpm + Turborepo** — npm workspaces хватает для 1–2 разработчиков.

---

**Итог (v2.1):** FSD-3-слоя + npm workspaces + чистый `packages/domain` +
SyncManager (dirty-flag/LWW) на IndexedDB (с миграцией) + изолированные сторы
(с `shallow`-мемоизацией) + zod-контракты (Knex оставляем) + типизированные
ошибки + enforced слои (dep-cruiser) + производительность по измерениям.
Серверный `update.ts` (2184) — приоритет декомпозиции (фаза 2). E2E-база уже
существует — оживляем, не строим с нуля. Стек не трогаем ради бенчмарков.
Эволюционно (10 фаз), не Big Rewrite.
