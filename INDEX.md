# INDEX — Главный индексный файл проекта

**Последнее обновление:** 2026-10-05
**Версия приложения:** 2.0
**Состояние здоровья:** 🟢 операционно разблокирован (main актуален, CI жив); остатётся техдолг (см. [AUDIT-2026-08-11](./docs/AUDIT-2026-08-11.md))

---

## 🧭 Компас проекта (направление и главный ориентир)

> Эта секция — **north star** для агентов и разработчиков. Читай первой.
> Подробный снимок состояния — в [`docs/AUDIT-2026-08-11.md`](./docs/AUDIT-2026-08-11.md),
> бэклог и приоритеты — в [`docs/TODO.md`](./docs/TODO.md).

**Что мы строим.** Repair Calculator v2.0 — калькулятор стоимости ремонта:
проекты → объекты → комнаты, 3 режима геометрии, AI-поиск цен (серверный
прокси Gemini/Mistral), экспорт смет в Excel/CSV, JWT-auth, автосохранение
(localStorage + синхронизация с сервером).

**Главный ориентир.** Калькулятор должен оставаться **слоистым, тестируемым и
verifiable-by-tooling**: архитектура enforced через `dependency-cruiser`
(не на бумаге), бизнес-логика — в чистых модулях, состояние — в zustand-слайсах,
доступ к данным изолирован в `server/src/db/repositories/`. Любое изменение, нарушающее
слои или добавляющее `as any`/`console.log`/хардкод ключей, — регрессия ориентира.

**Текущий фазис (2026-08-12): 🟢 операционно разблокирован.**
Рефактор-ветка `refactor/architecture-v2` **влита в main** (merge `--no-ff` `588c76b`,
164 коммита); CI активирован (первый прогон запущен); рабочее дерево чистое.
Остаётся техдолг: repo `as any` (10, Knex-типизация — отдельная задача), Docker browser-cache (P1-2 — закрыт 2026-10-04, fix/infra-008: cache-mount в server/Dockerfile; факт — браузеры в образ не ставились, postinstall playwright заблокирован onlyBuiltDependencies). **pnpm audit (2026-10-04, fix/audit-007): root — 0; server — 1 moderate `uuid@10` (fix мажорный 10→11 не ставится: используется только `v4` без `buf`, CVE затрагивает v3/v5/v6 с `buf`; обоснование — devAI/developer_log.md).** Шаг 3 закрыл: audit 7 high→0, route `as any` (9), lint scope → `tests/`, Docker builder-skip.

**Критический путь (что делать следующим):**

1. ✅ ~~Влить `refactor/architecture-v2` → main~~ — **выполнено 2026-08-12** (merge `--no-ff` `588c76b`, 164 коммита).
2. ✅ ~~Активировать CI~~ — **выполнено 2026-08-12** (workflow в VCS, первый прогон запущен).
3. 🟡 Деплой актуального бэкенда через `./scripts/deploy-local.sh` (контейнер `:3994` отстаёт от кода).

**Куда движемся** (видение [`docs/IDEAL-ARCHITECTURE.md`](./docs/IDEAL-ARCHITECTURE.md)):
FSD-3-слоя, npm workspaces, dirty-flag sync, полная декомпозиция монолитов
(`RoomEditor`, `BackupManager`, `apiStorageProvider`), единая error-архитектура.

**Принципы (не нарушать):**

- Слои `routes → services → repositories`; ORM (**Knex**) изолирован в repositories.
- Компоненты по доменам `src/features/<Domain>/ui/` (легаси-каталог `src/components/` удалён в R4 030); состояние — zustand-слайсы `src/store/` (канон; легаси-контексты удалены в R4 033).
- Валидация входа — Zod в `server/schemas/`; секреты — только `.env`; ключи AI — только на сервере.
- Запреты: `as any`/`as unknown` без обоснования, `@ts-ignore`, пустые `catch`, `console.log` в проде.
- DoD любого ТЗ: `pnpm test` + `pnpm run lint` + `pnpm run lint:deps` зелёные; `INDEX.md`/`developer_log.md` актуальны.

---

## Назначение

Полная информация о состоянии проекта для AI-агентов.
**Правило:** После ЛЮБЫХ изменений в коде обновляйте этот файл.

---

## Структура проекта

```
repair-calc/
├── src/                              # Исходный код фронтенда
│   ├── app/                          # FSD-слой app: layout/ (шелл — AppHeader, ContentArea, сайдбары, настройки; R4 029)
│   ├── features/                     # FSD-фичи (переезд доменов завершён в R4, 024–029)
│   │   ├── auth/                     # Домен auth (R4 024): ui/, model/, api/
│   │   ├── works/                    # Домен works (R4 025): ui/, model/, api/
│   │   ├── summary/                  # Домен summary (R4 026): ui/ (SummaryView, Materials, Works, Tools), api/ (totals)
│   │   ├── rooms/                    # Домен rooms (R4 027): ui/ (RoomEditor — только комната/геометрия, works-панель — слот с app-слоя; RoomList, geometry/ и др.), model/ (useGeometryState), api/ (rooms)
│   │   ├── objects/                  # Домен objects (R4 028): ui/ (ObjectsList, ObjectCard, ObjectSelector, CreateObjectModal), api/ (objects)
│   │   ├── projects/                 # Домен projects (R4 029): ui/ (ProjectsModal, ProjectsList, CreateProjectModal, ArchivePanel и др.), model/ (useProjectsModal, useProjectExports, modalTypes), api/ (projects)
│   │   └── backup/                   # Домен backup (R4 029): ui/ (BackupManager, ExportPanel, ImportPanel, SyncPanel, LoadProjectDialog), model/ (helpers, types)
│   ├── api/                          # API клиенты
│   │   ├── httpClient.ts             # HTTP-клиент (interceptors, retry, timeout)
│   │   ├── projects.ts               # @deprecated фасад → src/features/projects/api/projects.ts (R4 029; живой потребитель — SyncPanel, снятие — пост-R4)
│   │   ├── rooms.ts                  # @deprecated фасад → src/features/rooms/api/rooms.ts (R4 027; живой потребитель — SyncPanel, снятие — пост-R4)
│   │   ├── sync.ts                   # SYNC-V2 push-контракт (POST /api/sync/push; batch б)
│   │   ├── users.ts                  # Users API
│   │   ├── storage/
│   │   │   ├── apiStorageProvider.ts # Storage через REST API (тонкий фасад, ~346 строк)
│   │   │   ├── apiClient.ts          # Очередь запросов: rate limiting, 429-ретраи, типы кэша/контекста
│   │   │   ├── syncFlusher.ts        # Флашер SYNC-V2 (batch б): дедуп, parent-before-child, батчи ≤50, триггеры online/30с/debounce; разбор 409 по LWW §3.3 (batch в); под VITE_SYNC_V2
│   │   │   ├── syncMerge.ts          # Pull-merge LWW (batch в): §3.1 слияние с dirty-картой, tie-break §3.2, удалённые на сервере §3.3
│   │   │   ├── projectApi.ts         # Полная/инкрементальная синхронизация проектов
│   │   │   ├── objectApi.ts          # CRUD проектов + payload-билдеры объектов
│   │   │   ├── roomApi.ts            # Синхронизация комнат + трекинг ошибок
│   │   │   └── index.ts
│   │   └── prices/                   # удалён — @deprecated фасады сняты (R4 030; домен works → src/features/works/api)
│   ├── components/                   # УДАЛЁН (R4 030): @deprecated фасады сняты, каталог пуст — импортируйте src/features/* напрямую
│   ├── contexts/                     # УДАЛЁН (R4 033): Auth/WorkTemplate контексты → zustand-слайсы src/store/
│   ├── data/
│   │   ├── initialData.ts           # Начальные данные
│   │   └── workTemplatesCatalog.ts  # Каталог типовых работ
│   ├── hooks/
│   │   └── ui/                       # UI-хуки app-слоя (model-хуки доменов — в src/features/*/model; фасады сняты R4 030)
│   ├── types/
│   │   ├── index.ts                  # Основные типы (ProjectData, ObjectData, RoomData...)
│   │   ├── auth.ts                   # Типы аутентификации
│   │   ├── storage.ts                # IStorageProvider
│   │   ├── workTemplate.ts           # Шаблоны работ
│   │   └── vite-env.d.ts
│   ├── utils/
│   │   ├── debugLogger.ts            # Отладочный логгер
│   │   ├── format.ts                 # Фасад → shared/utils/format (R1; расшивка импортов в R4)
│   │   ├── idMapper.ts               # Фасад → shared/utils/idMapper (R1; +clearProject: вычистка маппингов при hard-delete)
│   │   ├── localStorageProvider.ts   # localStorage StorageProvider (легаси, не наращивать)
│   │   ├── logger.ts                 # Фасад → shared/utils/logger (R1; расшивка импортов в R4)
│   │   ├── migration.ts              # Миграция данных (не переехал в R1: зависит от домена через projectObjects)
│   │   ├── projectObjects.ts         # Object-based project helpers
│   │   ├── saveQueue.ts              # Очередь сохранения
│   │   ├── storage.ts                # StorageManager
│   │   ├── storageConstants.ts       # Фасад → shared/utils/storageConstants (R1)
│   │   └── templateStorage.ts        # Хранилище шаблонов
│   ├── domain/                       # Чистая доменная логика (без React)
│   │   ├── factories/projectFactory.ts # createProject/createNewRoom/clone..., generateId(prefix) — единая генерация ID
│   │   ├── geometry/                 # geometry.ts, roomHelpers.ts
│   │   └── pricing/                  # costs.ts, materialCalculations.ts
│   ├── store/                        # Zustand-стор (мигрировано из ProjectContext)
│   │   ├── useProjectStore.ts        # Композиция слайсов (project + archive + room + object + sync + auth)
│   │   ├── createProjectSlice.ts     # Проекты: CRUD/активный проект (267); migrateProject ре-экспортируется
│   │   ├── createArchiveSlice.ts     # Архив: fetchArchivedProjects/restoreProject/permanentDeleteProject, deletingIds (P3-SPLIT)
│   │   ├── projectInitialize.ts      # initialize: загрузка с сервера/локально + миграции; развилка SYNC-V2 по VITE_SYNC_V2 (batch г)
│   │   ├── projectMigration.ts       # migrateProject/migrateRoom (вынесен из project-слайса)
│   │   ├── createObjectSlice.ts      # Объекты
│   │   ├── createRoomSlice.ts        # Комнаты
│   │   ├── createSyncSlice.ts        # Слушатели синхронизации
│   │   └── types.ts                  # StoreState = Project & Archive & Room & Object & Sync & Auth
│   ├── App.tsx                       # Корневой компонент (~276 строк)
│   ├── main.tsx                      # Точка входа
│   └── index.css                     # Глобальные стили (TailwindCSS)
│
├── shared/                           # Общие типы/утилиты (0 доменных зависимостей) — FSD-слой shared
│   ├── types.ts                      # Общие типы (ProjectData, ObjectData, RoomData...)
│   ├── ui/                           # R4 029: общий UI-кит (ConfirmDialog, ErrorBoundary, NumberInput) — из src/components/ui
│   └── utils/                        # R1: format, logger, storageConstants, idMapper (в src/utils — фасады)
│
├── server/                           # Backend (Node.js + Express)
│   ├── src/
│   │   ├── index.ts                  # Entry point
│   │   ├── app.ts                    # Express app setup
│   │   ├── config/
│   │   │   └── env.ts                # Конфигурация (DB, JWT, logging)
│   │   ├── routes/
│   │   │   ├── index.ts              # Роутер
│   │   │   ├── auth.ts               # Аутентификация
│   │   │   ├── projects.ts           # CRUD проектов
│   │   │   ├── objects.ts            # CRUD объектов
│   │   │   ├── rooms.ts              # CRUD комнат
│   │   │   ├── works.ts              # CRUD работ
│   │   │   ├── geometry.ts           # Маршруты геометрии (фасад; обработчики в geometry.controller.ts / geometry.advanced.controller.ts)
│   │   │   ├── ai.ts                 # AI-провайдеры
│   │   │   ├── sync.ts               # Синхронизация (pull/push) — тонкая обвязка (146): push → sync-v2.service
│   │   │   ├── totals.ts             # Итоги
│   │   │   ├── users.ts              # Пользователи
│   │   │   └── update.ts             # Сервис обновлений (2184 строки)
│   │   ├── middleware/
│   │   │   ├── auth.ts               # JWT аутентификация
│   │   │   ├── validation.ts         # Валидация (Zod)
│   │   │   ├── rateLimiter.ts        # Rate limiting
│   │   │   ├── logger.ts             # Winston логирование
│   │   │   ├── deprecation.ts        # Deprecation/Sunset заголовки (RFC 8594) + warn-лог раз на маршрут
│   │   │   └── errorHandler.ts       # Обработка ошибок
│   │   ├── jobs/
│   │   │   └── cleanupDeleted.ts     # Суточная очистка мягко-удалённых проектов (§15.2.0 ТЗ v1.1)
│   │   ├── db/
│   │   │   ├── pool.ts               # PostgreSQL pool (Knex)
│   │   │   ├── migrations/           # Knex миграции
│   │   │   │   ├── 20260313_initial.ts
│   │   │   │   ├── 20260314_ab_tests.ts
│   │   │   │   ├── 20260314_update_service.ts
│   │   │   │   ├── 20260314_webhooks.ts
│   │   │   │   ├── 20260315_room_json_fields.ts
│   │   │   │   ├── 20260331_add_objects.ts
│   │   │   │   └── 20260332_add_user_role.ts
│   │   │   └── repositories/         # Data access (12 файлов)
│   │   │       ├── abTest.repo.ts               # Фасад: сборка read/write (batch-022-r3)
│   │   │       ├── abTest.types.ts              # Типы A/B тестирования
│   │   │       ├── abTest.read.ts               # Чтение: поиск/результаты/статистика
│   │   │       ├── abTest.write.ts              # Запись: CRUD/статусы/счётчики
│   │   │       ├── aiRequest.repo.ts
│   │   │       ├── calculatedTotals.repo.ts
│   │   │       ├── object.repo.ts
│   │   │       ├── priceCatalog.repo.ts
│   │   │       ├── priceHistory.repo.ts
│   │   │       ├── project.repo.ts              # Фасад: create/update/delete + наследует цепочку ниже + ре-экспорты (P3-SPLIT)
│   │   │       ├── projectArchive.repo.ts       # Архив: findArchived*/restore/hardDelete/findArchivedOlderThan
│   │   │       ├── projectRead.repo.ts          # Чтение: findById*/findByUserId, варианты для sync
│   │   │       ├── projectUpdateRooms.repo.ts   # updateWithRooms (транзакция)
│   │   │       ├── projectUpdateObjects.repo.ts # updateWithObjects (транзакция)
│   │   │       ├── room.repo.ts                 # Фасад: сборка 6 репозиториев (batch-022-r3)
│   │   │       ├── roomRead.ts / roomWrite.ts   # Чтение/запись комнат
│   │   │       ├── roomWorks.ts / roomGeometry.ts # Проёмы+подсекции / сегменты+препятствия+стены
│   │   │       ├── updateJob.repo.ts            # Фасад: сборка types/queries/writes/items/cleanup (batch-022-r3)
│   │   │       ├── updateJob.types.ts / .queries.ts / .writes.ts / .items.ts / .cleanup.ts
│   │   │       ├── user.repo.ts
│   │   │       ├── webhook.repo.ts
│   │   │       └── work.repo.ts
│   │   ├── services/
│   │   │   ├── ai/                   # AI-провайдеры (Gemini, Mistral, cache, priceSearch)
│   │   │   ├── update/               # Сервис обновлений (parsers, scheduler, runner)
│   │   │   │   ├── parserManager.ts  # Оркестрация (фасад singleton); parserRegistry.ts / parserABTest.ts / parserManager.types.ts
│   │   │   │   ├── runner.ts         # UpdateRunner (≤400); runnerSteps.ts / runner.types.ts / runnerCache.ts
│   │   │   ├── sync-v2.service.ts    # LWW/push-логика SYNC-V2 (279): lwwCompare, SyncConflict, processSyncPush
│   │   │   └── webhook.service.ts
│   │   └── types/
│   │       └── index.ts
│   ├── tests/
│   ├── knexfile.ts
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── eslint.config.js
│   └── package.json
│
├── e2e/                              # E2E тесты (Playwright, 13 файлов)
│   ├── auth.spec.ts
│   ├── core-workflow.spec.ts
│   ├── costs.spec.ts
│   ├── export-import.spec.ts
│   ├── geometry.spec.ts
│   ├── objects.spec.ts
│   ├── projects.spec.ts
│   ├── regressions.spec.ts
│   ├── responsive.spec.ts
│   ├── room-input.spec.ts
│   ├── rooms.spec.ts
│   ├── works.spec.ts
│   └── work-templates.spec.ts
│   ├── helpers/                      # Хелперы спек: roomHelpers.ts (клики комнат, drawer-aware), sidebarHelpers.ts (drawer левого/правого сайдбара, Настройки/данные — 2026-10-04)
│
├── tests/                            # Unit/integration тесты (в т.ч. tests/unit/ — слайсы/клиентские api; tests/components/ — компонентные, в т.ч. ArchivePanel)
├── prompts/                          # Библиотека ролевых промптов ИИ-агентов (иерархия: techlead-architect → coder/debugger/designer/analyst; pentester — отдельный контур)
├── docs/                             # Документация (карта: docs/README.md; решения: docs/adr/)
│   └── adr/                          # Architecture Decision Records (MADR)
├── scripts/                          # Скрипты сборки и тестирования (+ docs-check.sh — автопроверка документации)
├── docker-compose.yml          # backend/migrate/frontend — build.args COMMIT_HASH (env в контейнерах)
├── Dockerfile
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── eslint.config.js
├── playwright.config.ts
└── README.md
```

---

## Ключевые файлы

### Фронтенд

| Файл                                    | Назначение                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/store/useProjectStore.ts`          | Глобальное состояние (zustand, слайсы) — пришёл на смену удалённому ProjectContext                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `src/store/createAuthSlice.ts`          | Auth-слайс (R4 033, бывш. AuthContext): user/isAuthenticated/authIsLoading/authError + initAuthCheck/login/register/logout/clearAuthError; публичный хук `useAuth` — `src/store/useAuth.ts` (на слое store, чтобы фичи не импортировали features/auth напрямую)                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `src/store/createWorkTemplateSlice.ts`  | Слайс шаблонов работ (R4 033, бывш. WorkTemplateContext): templates + initWorkTemplates/saveTemplate/loadTemplate/deleteTemplate/importTemplates; персист в TemplateStorage без изменений                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/store/createSyncSlice.ts`          | Sync-слайс: автосейв + dirty-модель SYNC-V2 (markDirty/restoreDirtyState, карта в Dexie `syncState`) + триггеры флашера (batch б) + счётчик `conflictsResolved` (batch в)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/api/storage/dexieDb.ts`            | Dexie `RepairCalcDB` (version 2: таблица `syncState` — персистентные dirty-флаги SYNC-V2 §2.1 + meta-запись `lastSyncAt` — batch г)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `tests/api/syncV2Initialize.test.ts`    | Развилка инициализации SYNC-V2 (batch г): полный/инкрементальный pull, LWW-merge, fallback, legacy-путь                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `e2e/sync-v2.spec.ts`                   | E2E SYNC-V2 «мутация → flush → повторный init» — только при `VITE_SYNC_V2=true` (batch г)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/features/auth/`                    | Домен auth (R4 batch 024): `ui/` (LoginPage, RegisterPage, ProtectedRoute), `model/` (auth.types; легаси-контекст AuthContext удалён (R4 033) — состояние/экшены в createAuthSlice + хук useAuth (src/store/useAuth.ts)), `api/auth.ts`. Старые пути (`src/components/auth`, `src/contexts/AuthContext.tsx`, `src/api/auth.ts`) — @deprecated фасады; depcruise-правило `fsd-auth-no-cross-imports` (error)                                                                                                                                                                                                                                                                                                                                  |
| `src/features/works/`                   | Домен works (R4 batch 025): `ui/` (RoomWorksSection — works-панель комнаты, монтируется слотом с app-слоя ContentArea, R4 031; 11 компонентов работ/материалов/поиска цен), `model/` (useWorkTemplates, useRoomWorksState — переведён из rooms в R4 031, WorkTemplateContext удалён (R4 033) — createWorkTemplateSlice в src/store), `api/` (AI-поиск цен: unifiedSearch, priceCache, types). Старые пути (`src/components/works`, `src/hooks/useWorkTemplates.ts`, `src/contexts/WorkTemplateContext.tsx`, `src/api/prices/*`) — @deprecated фасады; depcruise-правило `fsd-works-no-cross-imports` (error, без исключений с R4 031). `src/data/workTemplatesCatalog.ts` остался в data (используется вне works: `src/data/initialData.ts`) |
| `src/features/summary/`                 | Домен summary (R4 batch 026): `ui/` (SummaryView, SummaryMaterials, SummaryWorks, SummaryTools, barrel), `api/` (totals: saveTotals/getTotals). Старые пути (`src/components/summary/`, `src/components/SummaryView.tsx`, `src/api/totals.ts`) — @deprecated фасады; depcruise-правило `fsd-summary-no-cross-imports` (error). `src/components/summary/` удалён после переезда (внешних импортёров barrel не было — grep)                                                                                                                                                                                                                                                                                                                    |
| `src/api/httpClient.ts`                 | HTTP-клиент (interceptors, retry, timeout)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/api/storage/apiStorageProvider.ts` | Storage через REST API — тонкий фасад (346 стр.); внутри: `apiClient.ts` (очередь/ретраи), `projectApi.ts` (синхронизация), `objectApi.ts` (CRUD), `roomApi.ts` (комнаты)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/utils/storage.ts`                  | StorageManager (localStorage)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `shared/utils/idMapper.ts`              | Маппинг локальных/серверных ID (R1; `src/utils/idMapper.ts` — re-export-фасад)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/utils/projectObjects.ts`           | Object-based helpers (pure functions)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### Бэкенд

| Файл                                   | Назначение                                                                                                                                                            |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/src/routes/sync.ts`            | Sync API (pull/push; SYNC-V2: LWW на push по `clientUpdatedAt`, `?since=` на pull — batch в)                                                                          |
| `server/src/routes/projects.ts`        | Projects CRUD                                                                                                                                                         |
| `server/src/routes/update/`            | Сервис обновлений (декомпозирован: ab-test, import, jobs, prices, webhooks, schemas); ab-test — обработчики в ab-test.controller.ts / ab-test.lifecycle.controller.ts |
| `server/src/routes/geometry*.ts`       | Геометрия: фасад geometry.ts + geometry.controller.ts / geometry.advanced.controller.ts (batch-022-r3)                                                                |
| `server/src/config/env.ts`             | Конфигурация (DB, JWT, logging)                                                                                                                                       |
| `server/src/middleware/logger.ts`      | Winston логирование                                                                                                                                                   |
| `server/src/middleware/auth.ts`        | JWT аутентификация                                                                                                                                                    |
| `server/src/middleware/deprecation.ts` | Депрекейшн эндпоинтов: `Deprecation`/`Sunset` + warn-лог (экспорт; на маршруты не навешан)                                                                            |
| `server/src/jobs/cleanupDeleted.ts`    | Очистка архивных проектов старше `ARCHIVE_RETENTION_DAYS` (cron 03:00 + прогон на старте)                                                                             |

---

## База данных

### Таблицы

| Таблица            | Назначение                                             |
| ------------------ | ------------------------------------------------------ |
| `users`            | Пользователи                                           |
| `projects`         | Проекты (user_id, name, description)                   |
| `objects`          | Объекты недвижимости (project_id, name, city, address) |
| `rooms`            | Комнаты (object_id, name, geometry_mode, dimensions)   |
| `works`            | Работы (room_id, name, price, materials)               |
| `materials`        | Материалы (work_id, name, quantity, price)             |
| `tools`            | Инструменты (work_id, name, price, is_rent)            |
| `openings`         | Окна/двери (room_id, type, dimensions)                 |
| `ai_requests`      | История AI запросов                                    |
| `deleted_entities` | Отслеживание удалений (30 дней)                        |
| `audit_log`        | Лог аудита                                             |

### Миграции

```
server/src/db/migrations/
├── 20260313_initial.ts            # Начальная схема
├── 20260314_ab_tests.ts           # A/B тесты
├── 20260314_update_service.ts     # Service обновлений
├── 20260314_webhooks.ts           # Webhooks
├── 20260315_room_json_fields.ts   # JSON поля для комнат
├── 20260331_add_objects.ts        # Таблица objects + deleted_entities
└── 20260332_add_user_role.ts      # Роль user + RBAC (adminGuard)
```

---

## API Endpoints

### Аутентификация

| Метод | Endpoint             | Описание             |
| ----- | -------------------- | -------------------- |
| POST  | `/api/auth/register` | Регистрация          |
| POST  | `/api/auth/login`    | Вход                 |
| POST  | `/api/auth/refresh`  | Обновление токена    |
| GET   | `/api/auth/me`       | Текущий пользователь |
| POST  | `/api/auth/logout`   | Выход                |

### Проекты

| Метод  | Endpoint                         | Описание                                                             |
| ------ | -------------------------------- | -------------------------------------------------------------------- |
| GET    | `/api/projects`                  | Список проектов                                                      |
| POST   | `/api/projects`                  | Создание                                                             |
| GET    | `/api/projects/archived`         | Список архивных проектов (архив = soft-delete, колонка `deleted_at`) |
| GET    | `/api/projects/:id`              | Проект с объектами                                                   |
| PUT    | `/api/projects/:id`              | Обновление                                                           |
| DELETE | `/api/projects/:id`              | Удаление (soft-delete → архив)                                       |
| PATCH  | `/api/projects/:id/restore`      | Восстановление проекта из архива                                     |
| DELETE | `/api/projects/:id/permanent`    | Необратимое удаление проекта из БД                                   |
| PUT    | `/api/projects/:id/ai-settings`  | Обновление AI-настроек проекта                                       |
| PUT    | `/api/projects/:id/with-rooms`   | Обновление проекта вместе с комнатами                                |
| PUT    | `/api/projects/:id/with-objects` | Обновление проекта вместе с объектами                                |

### Объекты

| Метод  | Endpoint                           | Описание           |
| ------ | ---------------------------------- | ------------------ |
| GET    | `/api/objects`                     | Список объектов    |
| POST   | `/api/projects/:projectId/objects` | Создание объекта   |
| GET    | `/api/objects/:id`                 | Объект с комнатами |
| PUT    | `/api/objects/:id`                 | Обновление         |
| DELETE | `/api/objects/:id`                 | Удаление           |

### Синхронизация

| Метод | Endpoint         | Описание                                                              |
| ----- | ---------------- | --------------------------------------------------------------------- |
| GET   | `/api/sync/pull` | Получить данные (`?since=<ISO>` — инкрементально; без since — полный) |
| POST  | `/api/sync/push` | Отправить изменения (LWW по `clientUpdatedAt` + tie-break по id)      |

---

## Типы данных

### ProjectData

```typescript
type ProjectData = {
  id: string;
  name: string;
  description?: string;
  isPremium?: boolean;
  objects: ObjectData[];
  version?: number;
  rooms?: RoomData[]; // Deprecated (обратная совместимость)
  city?: string;
  useAiPricing?: boolean;
  lastAiPriceUpdate?: string;
  updatedAt?: string; // SYNC-V2 §2.1: ISO-метка мутации (dirty-модель)
};
```

### ObjectData

```typescript
type ObjectData = {
  id: string;
  projectId: string;
  name: string;
  city?: string;
  address?: string;
  useAiPricing?: boolean;
  rooms: RoomData[];
  version?: number;
  sortOrder?: number;
  updatedAt?: string; // SYNC-V2 §2.1
};
```

### RoomData

```typescript
type RoomData = {
  id: string;
  name: string;
  geometryMode: 'simple' | 'extended' | 'advanced';
  length: number;
  width: number;
  height: number;
  windows: Opening[];
  doors: Opening[];
  works: WorkData[];
  segments: RoomSegment[]; // Advanced mode
  obstacles: Obstacle[]; // Advanced mode
  wallSections: WallSection[]; // Advanced mode
  subSections: RoomSubSection[]; // Extended mode
  updatedAt?: string; // SYNC-V2 §2.1
};
```

---

## Технологии

### Фронтенд

- React 19
- TypeScript 5.8
- Vite 6
- TailwindCSS 4
- Lucide Icons
- @dnd-kit (drag-and-drop)

### Бэкенд

- Node.js + Express 4
- TypeScript
- PostgreSQL 16
- Knex.js (query builder + migrations)
- JWT (jsonwebtoken)
- Winston (logging)
- Zod (validation)
- Helmet (security)
- bcryptjs (password hashing)

### Инфраструктура

- Docker / Docker Compose
- Nginx (фронтенд)

---

## Запуск

### Локальная разработка

```bash
# Фронтенд
pnpm install
pnpm run dev  # http://localhost:3993

# Бэкенд (в Docker)
docker-compose up -d backend db
```

### Production

```bash
docker-compose up -d
```

---

## Тестирование

```bash
pnpm test             # Unit тесты (Vitest)
pnpm run test:e2e     # E2E тесты (Playwright)
pnpm run test:e2e:ui  # E2E с UI
pnpm run lint         # TypeScript + ESLint
pnpm run analyze:graph # Codegraph: переиндексация графа зависимостей
```

---

## Правила разработки

1. **Перед коммитом:** `pnpm test` + `pnpm run lint` + обновить `INDEX.md`
2. **Порт приложения:** Только **3993** (фронтенд), **3994** (бэкенд)
3. **Логирование:** Winston (сервер) + logger.ts (клиент), `no-console: error` в ESLint
4. **Миграции БД:** Только через Knex migrations

---

## Документация

- [README](./README.md) — Главная документация
- [docs/AUDIT-2026-08-11.md](./docs/AUDIT-2026-08-11.md) — **Актуальный аудит состояния** (операционное здоровье, дрейф документации, roadmap)
- [docs/TODO.md](./docs/TODO.md) — **Актуальный бэклог и приоритеты** (P0: merge refactor→main, активация CI)
- [docs/AUDIT-2026-06-21.md](./docs/AUDIT-2026-06-21.md) — Предыдущий аудит (снимок после миграции на zustand)
- [docs/IDEAL-ARCHITECTURE.md](./docs/IDEAL-ARCHITECTURE.md) — **Видение идеальной архитектуры** (v2: FSD-3-слоя, npm workspaces, dirty-flag sync, декомпозиция update.ts, error-архитектура)
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Архитектура проекта
- [docs/CODE_REVIEW.md](./docs/CODE_REVIEW.md) — Результаты ревью кода
- [docs/LOGGING.md](./docs/LOGGING.md) — Логирование
- [docs/DEBUG_INSTRUCTIONS.md](./docs/DEBUG_INSTRUCTIONS.md) — Инструкции по отладке
- [docs/TECHNICAL-SPECIFICATION.md](./docs/TECHNICAL-SPECIFICATION.md) — ТЗ v1.1

---

## Известные проблемы кода (Code Review 2026-04-17)

> ⚠️ **Раздел устарел.** Актуальный снимок проблем и дрейфа документации — в
> [`docs/AUDIT-2026-08-11.md`](./docs/AUDIT-2026-08-11.md) (§6 Documentation Drift).
> Ниже оставлено как историческая справка; часть пунктов уже закрыта рефактором.

### Критические (Security)

- **S1.** ~~API ключи Gemini/Mistral доступны в клиентском бандле~~ — **ИСПРАВЛЕНО**: AI-вызовы перенесены на серверный прокси `/api/ai/search-price`
- **S2.** 19 admin endpoints без проверки прав в `server/src/routes/update.ts`
- **S3.** Слабые fallback JWT секреты в `server/src/config/env.ts`

### Сломанный код

- **H1.** ~~`objects.ts` и `users.ts` импортируют несуществующий `fetchJson`~~ — **ИСПРАВЛЕНО**: `fetchJson` реализован в `httpClient.ts`
- **H2.** ~~`useMaterialCalculation.ts` — вызов hook внутри `useMemo`~~ — **ИСПРАВЛЕНО**: хук вызывается на верхнем уровне, `useMemo` оборачивает только расчёт
- **H3.** ~~`apiStorageProvider.ts` — `require()` в ESM-модуле~~ — **УСТРАНЕНО**: grep `require(` 2026-10-04 — 0 вхождений (`fix/dead-code-009`)

### Дублирование

- ~~`geminiPriceSearch.ts` / `mistralPriceSearch.ts`~~ — **УДАЛЕНО**: клиентские AI-модули удалены, поиск идёт через серверный прокси. Дублирование промптов устранено через `priceSearchHelpers.ts`
- `parseJSON()` в `projects.ts` и `rooms.ts`
- ~~`STORAGE_KEYS` в `storage.ts` и `apiStorageProvider.ts`~~ — **УСТРАНЕНО** (2026-10-04, `fix/typing-010`): единый источник `src/utils/storageConstants.ts` (STORAGE_KEYS + все ключи: token, refreshToken, e2e-test-mode, id-mappings, device-id, pending-save, migration-version, price-cache, dexie_migrated); значения ключей не менялись
- ~~Генерация ID~~ — **УСТРАНЕНО** (2026-10-04, `fix/typing-010`): единый `generateId(prefix)` в `src/domain/factories/projectFactory.ts`; 8 дублей (crypto.randomUUID / Math.random-обёртки) заменены. Остались legacy-генераторы `device-`/`local-` в `src/utils/idMapper.ts:80,248` (generateId() оттуда не импортируется)
- `API_BASE` в `httpClient.ts` и `auth.ts`

### Мёртвый код

- ~~`src/hooks/useProjects.ts`~~ — **УДАЛЁН** (коммит `8f4a7b6`); grep 2026-10-04: 0 ссылок
- `src/utils/debugLogger.ts` — дублирует logger.ts
- ~~`src/utils/projectContextPatch.ts`~~ — **УДАЛЁН** (коммит `8f4a7b6`); grep 2026-10-04: 0 ссылок

### Производительность

- `JSON.stringify` для сравнения объектов в ProjectContext
- Polling sync errors каждые 5 секунд
- `getAllRooms()` вызывается многократно без кэширования

---

**ВАЖНО:** После каждого изменения обновляйте этот файл!

---

## История изменений (кодревью)

### 2026-08-20: fix: sync activeObject on room rename

- **Изменено:** `src/store/createRoomSlice.ts` — `updateRoom` и `updateRoomById` теперь пересчитывают `activeObject` через `getObjectFromProject(activeProject, state.activeObjectId)` (fallback на первый объект при `activeObjectId === null`) и возвращают `{ projects, activeProject, activeObject }`. Дефект: после переименования комнаты в RoomHeader левая панель (LeftSidebar) не обновляла название из-за устаревшей ссылки на объект.
- **Изменено:** `tests/hooks/domains/useRoomDomain.test.ts` — проверки синхронизации `state.activeObject` в `updateRoom`/`updateRoomById` + тест с явным `activeObjectId` (12 passed).

### 2026-04-17: P0-SEC Исправление утечки API-ключей

- **Удалено:** `src/api/prices/geminiPriceSearch.ts`, `src/api/prices/mistralPriceSearch.ts`, `tests/api/geminiPriceSearch.test.ts`
- **Новое:** `server/src/services/ai/priceSearchHelpers.ts` — общий промпт и парсер для поиска цен
- **Изменено:** `src/api/prices/unifiedSearch.ts` — запросы через серверный прокси `/api/ai/search-price`
- **Изменено:** `server/src/routes/ai.ts` — добавлен эндпоинт `POST /api/ai/search-price` с кэшированием
- **Изменено:** `server/src/services/ai/geminiProvider.ts`, `mistralProvider.ts` — добавлен `searchPrice()`, убрано дублирование
- **Изменено:** `server/src/services/ai/aiCache.ts` — добавлен `'search-price'` в кэшируемые типы (TTL 6ч)
- **Изменено:** `.env.example` — API-ключи без `VITE_` префикса (серверные)
- **Новое:** `tests/api/unifiedSearch.test.ts` — тесты серверного прокси (7 тестов)
