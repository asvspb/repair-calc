# Архитектура проекта Repair Calculator

> **Статус:** актуально • **Проверено:** 2026-10-03 (ПОЛНАЯ сверка с кодом: структура `src/` и `server/src/`, состояние zustand, storage IndexedDB, маршруты, логирование, зависимости; блок БД сверён ранее)

**Дата:** 2026-06-08 (правки от 2026-10-03)
**Статус:** Актуально
**Версия клиента:** React 19 + Vite 6 + Zustand 5
**Версия сервера:** Express + PostgreSQL + Knex

---

## 1. Обзор проекта

**Repair Calculator** — PWA-приложение для расчёта стоимости ремонтных работ. Позволяет:

- Создавать проекты с несколькими объектами недвижимости
- Рассчитывать площади стен, полов, потолков с учётом проёмов
- Вести каталог работ с материалами и инструментами
- Искать цены через AI (Gemini/Mistral)
- Экспортировать данные в CSV/JSON

### 1.1 Текущий статус

> Таблица ниже — датированный срез (2026-04-17); численные показатели тестов
> того периода не пересчитывались. Структурные строки актуализированы 2026-10-03.

| Компонент      | Статус      | Описание                                                     |
| -------------- | ----------- | ------------------------------------------------------------ |
| Клиент         | ✅ Готов    | React 19, Vite 6, TailwindCSS 4, Zustand 5                   |
| Сервер         | ✅ Готов    | Express, PostgreSQL, Knex, JWT                               |
| База данных    | ✅ Готова   | PostgreSQL, миграции Knex                                    |
| Хранилище      | ✅ Готов    | IndexedDB (Dexie) + ApiStorageProvider при авторизации       |
| AI-интеграция  | ✅ Готов    | Через серверный прокси `/api/ai/*` (ключи только на сервере) |
| Аутентификация | ✅ Готова   | JWT tokens, регистрация/логин                                |
| Тесты          | ✅ 841 тест | 833 passed, 0 failed, 8 skipped (срез 2026-04-17)            |
| Логирование    | ✅ Готов    | Winston (сервер) + logger.ts (клиент)                        |
| ESLint         | ✅ Готов    | no-console: error (allow warn/error)                         |

---

## 2. Клиентская архитектура

### 2.1 Структура файлов

> Сверено с кодом 2026-10-03. Объёмы в строках — на эту дату.

```
src/
├── App.tsx                    # Главный компонент (323 строки)
├── main.tsx                   # Entry point
├── index.css                  # Глобальные стили (TailwindCSS)
│
├── api/                       # API-интеграции
│   ├── auth.ts                # Аутентификация
│   ├── httpClient.ts          # HTTP-клиент (interceptors, retry, timeout)
│   ├── objects.ts             # Objects API
│   ├── projects.ts            # Projects API
│   ├── rooms.ts               # Rooms API
│   ├── totals.ts              # Totals API
│   ├── users.ts               # Users API
│   ├── storage/
│   │   ├── apiStorageProvider.ts  # Storage через REST API (995 строк)
│   │   ├── indexedDbProvider.ts   # IndexedDB-провайдер (Dexie) — по умолчанию
│   │   ├── dexieDb.ts             # Схема Dexie
│   │   ├── indexedDbMigration.ts  # Перенос legacy localStorage → IndexedDB
│   │   └── index.ts
│   └── prices/                # Поиск цен через AI — ТОЛЬКО серверный прокси
│       ├── unifiedSearch.ts   # вызовы через httpClient → /api/ai/search-price
│       ├── priceCache.ts
│       ├── types.ts
│       └── index.ts
│
├── components/                # React-компоненты (по доменам)
│   ├── auth/                  # LoginPage, RegisterPage, ProtectedRoute
│   ├── geometry/              # 8 компонентов + index.ts (GeometrySection, ModeSelector, ...)
│   ├── layout/                # AppHeader, ContentArea, LeftSidebar, RightSidebar,
│   │                          #   ObjectSettings, ProjectSettings
│   ├── objects/               # CreateObjectModal, ObjectCard, ObjectSelector, ObjectsList
│   ├── projects/              # CreateProjectModal (574), DataManagementModal,
│   │                          #   ProjectsList, ProjectsModal (723)
│   ├── room/                  # RoomHeader, RoomMetricsSummary, useRoomWorksState
│   ├── rooms/                 # RoomList, RoomListItem
│   ├── works/                 # 12 файлов: WorkList, WorkCard, WorkCatalogPicker,
│   │                          #   MaterialCalculationCard, PaintMaterialCard, ...
│   ├── summary/               # SummaryMaterials, SummaryTools, SummaryWorks
│   ├── ui/                    # ConfirmDialog, ErrorBoundary, NumberInput
│   ├── BackupManager.tsx      # Экспорт/импорт проектов (898 строк)
│   ├── RoomEditor.tsx         # Редактор комнаты (277 строк)
│   └── SummaryView.tsx        # Общая смета
│
├── contexts/                  # ЛЕГАСИ (не наращивать, канон — zustand)
│   ├── index.ts
│   ├── AuthContext.tsx        # Аутентификация (JWT), 280 строк
│   └── WorkTemplateContext.tsx
│
├── domain/                    # ЧИСТАЯ бизнес-логика (без React)
│   ├── factories/             # projectFactory.ts
│   ├── geometry/              # geometry.ts (+ тесты), roomHelpers.ts
│   └── pricing/               # costs.ts, materialCalculations.ts
│
├── i18n/                      # i18next: index.ts, locales/, types.d.ts
│
├── store/                     # ZUSTAND — канон состояния
│   ├── useProjectStore.ts     # Композиция слайсов
│   ├── createProjectSlice.ts  # Проекты (481 строка)
│   ├── createObjectSlice.ts   # Объекты
│   ├── createRoomSlice.ts     # Комнаты
│   ├── createAuthSlice.ts     # Сессия
│   ├── createSyncSlice.ts     # Синхронизация
│   └── types.ts
│
├── data/                      # Статические данные
│   ├── initialData.ts         # Начальный проект
│   └── workTemplatesCatalog.ts # Каталог типовых работ (1220 строк)
│
├── hooks/                     # Кастомные хуки
│   ├── ui/                    # UI-хуки
│   ├── useGeometryState.ts    # Состояние геометрии (747 строк)
│   ├── useMaterialCalculation.ts
│   └── useWorkTemplates.ts
│
├── types/                     # TypeScript типы
│   ├── index.ts               # Реэкспорт основных типов из @shared/types (shared/types.ts)
│   ├── auth.ts                # Типы аутентификации
│   ├── storage.ts             # IStorageProvider
│   └── workTemplate.ts        # Шаблоны работ
│
└── utils/                     # Утилиты
    ├── debugLogger.ts         # Raw-console логгер, переживающий минификацию
    ├── format.ts              # Форматирование
    ├── localStorageProvider.ts # Легаси (использований в src/ нет)
    ├── logger.ts              # Структурированный логгер (logError, logWarning, logDebug)
    ├── storage.ts             # StorageManager (на IndexedDbProvider)
    ├── templateStorage.ts     # Хранилище шаблонов (на IndexedDbProvider)
    ├── saveQueue.ts           # Персистентная очередь сохранения
    ├── storageConstants.ts    # Ключи хранилища (STORAGE_KEYS)
    ├── idMapper.ts            # Маппинг локальных/серверных ID
    ├── projectObjects.ts      # Object-based helpers
    └── migration.ts           # Миграция данных
```

### 2.2 Основные типы данных

> Канон основных типов — `shared/types.ts`; `src/types/index.ts` реэкспортирует
> их через `@shared/types` (сверено 2026-10-03). Ниже — сокращённая выборка.

```typescript
// shared/types.ts (реэкспорт в src/types/index.ts)

// Проект (группа объектов)
type ProjectData = {
  id: string;
  name: string;
  description?: string;
  isPremium?: boolean;
  objects: ObjectData[]; // Объекты недвижимости
  version?: number;
  // Deprecated (для обратной совместимости)
  rooms?: RoomData[];
  city?: string;
  useAiPricing?: boolean;
  lastAiPriceUpdate?: string;
};

// Объект недвижимости
type ObjectData = {
  id: string;
  projectId: string;
  name: string;
  city?: string;
  address?: string;
  useAiPricing?: boolean;
  lastAiPriceUpdate?: string;
  rooms: RoomData[];
  version?: number;
  sortOrder?: number;
};

// Комната
type RoomData = {
  id: string;
  name: string;
  geometryMode: GeometryMode; // 'simple' | 'extended' | 'advanced'
  length: number;
  width: number;
  height: number;
  segments: RoomSegment[]; // Advanced mode
  obstacles: Obstacle[]; // Advanced mode
  wallSections: WallSection[]; // Advanced mode
  subSections: RoomSubSection[]; // Extended mode
  windows: Opening[];
  doors: Opening[];
  works: WorkData[];
  simpleModeData?: SimpleModeData;
  extendedModeData?: ExtendedModeData;
  advancedModeData?: AdvancedModeData;
  objectId?: string;
};

// Работа
type WorkData = {
  id: string;
  name: string;
  unit: string;
  enabled: boolean;
  workUnitPrice: number;
  materials?: Material[];
  tools?: Tool[];
  calculationType: CalculationType;
  isCustom?: boolean;
  useManualQty?: boolean;
  manualQty?: number;
};
```

### 2.3 Иерархия данных

```
Пользователь (users)
└── Проект (projects) — группа объектов
    └── Объект (objects) — недвижимость
        └── Комната (rooms)
            └── Работа (works)
                ├── Материал (materials)
                └── Инструмент (tools)
```

### 2.4 Хранилище (Storage)

**Абстракция:** `IStorageProvider` в `src/types/storage.ts`

```typescript
export interface IStorageProvider {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  clear(): void;
  getStorageInfo(): { used: number; total: number; percentage: number };
}
```

**Текущая реализация** (сверено 2026-10-03, `src/api/storage/apiStorageProvider.ts:989`):

- `getStorageProvider()` — авторизован → `ApiStorageProvider` (REST);
  не авторизован → `IndexedDbProvider` (Dexie, `src/api/storage/indexedDbProvider.ts`).
- `StorageManager` (`src/utils/storage.ts`) и шаблоны (`src/utils/templateStorage.ts`)
  работают на `IndexedDbProvider`.
- Перенос legacy-данных из localStorage — `src/api/storage/indexedDbMigration.ts`.
- `src/utils/localStorageProvider.ts` — легаси, использований в `src/` нет.

**Историческая заметка:** до 2026-06 каноничным первичным хранилищем был
localStorage (`LocalStorageProvider`); заменено на IndexedDB + API-синхронизацию.

### 2.5 Состояние: Zustand (канон) + легаси-контексты

**Канон нового кода — zustand-слайсы `src/store/`** (решение владельца от 2026-10-03,
`zustand@^5` в `package.json`):

| Слайс                   | Ответственность                              |
| ----------------------- | -------------------------------------------- |
| `createProjectSlice.ts` | Проекты: список, активный, CRUD (481 строка) |
| `createObjectSlice.ts`  | Объекты                                      |
| `createRoomSlice.ts`    | Комнаты                                      |
| `createAuthSlice.ts`    | Сессия, токены                               |
| `createSyncSlice.ts`    | Синхронизация, dirty-флаги                   |
| `useProjectStore.ts`    | Композиция слайсов в единый стор             |

**Легаси в `src/contexts/`** (не наращивать, мигрируются по мере касания):

- `AuthContext.tsx` (280 строк) — аутентификация JWT
  (`user`, `token`, `login/register/logout/refreshToken`).
- `WorkTemplateContext.tsx` — шаблоны работ.
- `ProjectContext.tsx` — **удалён**; состояние проекта переехало в zustand-слайсы.

**Особенности состояния:**

- Автосохранение с debounce (1-2 сек)
- Защита от потери данных при закрытии (`beforeunload`)
- Миграция данных при загрузке
- Синхронизация с сервером при авторизации

### 2.6 Переезд FSD (статус миграции)

> Цель: 3-слойка `app → features → shared` (см. `devAI/spec/ROADMAP-fsd.md`,
> видение — `docs/IDEAL-ARCHITECTURE.md`). Принцип — strangler-миграция:
> новое в целевой структуре, старое переезжает по мере касания.

**R1 — сделано (2026-10-04, `refactor/fsd-r1-017`, поведение не менялось):**

- Каркас каталогов: `src/app/`, `src/features/<auth,projects,objects,rooms,works,summary,archive>/`
  (по README-указателю; код не переезжает — переезд доменов в R4).
- depcruise-правила 3-слойки в «мягком режиме» (`.dependency-cruiser.cjs`):
  `fsd-app-layers`, `fsd-features-to-shared`, `fsd-features-no-cross-imports`
  (severity `warn` до R4); легаси-пути (`src/components`, `src/hooks`,
  `src/contexts`, `src/api`, `src/utils`) — во временном allowlist с пометкой R4.
- В `shared/utils/` переехали чистые утилиты (0 доменных зависимостей):
  `format.ts`, `logger.ts`, `storageConstants.ts`, `idMapper.ts`.
  В `src/utils/` остались re-export-фасады для легаси-импортов
  (`@deprecated`, расшивка импортов на `@shared/utils/*` — в R4).
- `src/utils/migration.ts` **не** переехал: не чистый — зависит от домена через
  `src/utils/projectObjects.ts` (`projectFactory`).

**Дальше:** R2 — спека sync-v2 (`devAI/spec/TASK-BATCH-016-018.md`, секция 018);
R4 — переезд доменов в `features/` по одному, allowlist пустеет, правила
depcruise повышаются до `error`.

---

## 3. Серверная архитектура

### 3.1 Структура сервера

> Сверено с кодом 2026-10-03.

```
server/
├── src/
│   ├── index.ts                    # Entry point
│   ├── app.ts                      # Express app setup
│   │
│   ├── config/                     # Конфигурация
│   │   └── env.ts                  # DB, JWT, logging config
│   │
│   ├── routes/                     # API роуты
│   │   ├── index.ts                # Роутер (маунт всех секций)
│   │   ├── auth.ts                 # Аутентификация
│   │   ├── projects.ts             # CRUD проектов + архив (archived/restore/permanent)
│   │   ├── objects.ts              # CRUD объектов
│   │   ├── rooms.ts                # CRUD комнат
│   │   ├── works.ts                # CRUD работ
│   │   ├── geometry.ts             # Геометрические расчёты (636 строк)
│   │   ├── ai.ts                   # AI-прокси (estimate, suggest-materials,
│   │   │                           #   generate-template, search-price)
│   │   ├── sync.ts                 # Синхронизация (pull/push)
│   │   ├── totals.ts               # Итоги
│   │   ├── users.ts                # Пользователи (/me)
│   │   └── update/                 # Сервис обновлений — декомпозирован из update.ts
│   │       ├── index.ts
│   │       ├── jobs.routes.ts      # (430 строк)
│   │       ├── prices.routes.ts    # (409 строк)
│   │       ├── webhooks.routes.ts  # (243 строки)
│   │       ├── ab-test.routes.ts
│   │       ├── import.routes.ts
│   │       └── schemas.ts          # Zod-схемы update-сервисов
│   │
│   ├── middleware/                 # Middleware
│   │   ├── auth.ts                 # JWT аутентификация
│   │   ├── adminGuard.ts           # RBAC для admin-эндпоинтов update-сервиса
│   │   ├── validation.ts           # Валидация (Zod)
│   │   ├── rateLimiter.ts          # Rate limiting
│   │   ├── logger.ts               # Логирование (winstonLogger)
│   │   └── errorHandler.ts         # Обработка ошибок
│   │
│   ├── db/
│   │   ├── db.ts                   # Инициализация Knex
│   │   ├── pool.ts                 # PostgreSQL pool
│   │   ├── migrations/             # Knex миграции (7 файлов, 2026-03-13…2026-03-32)
│   │   └── repositories/           # Data access (12 файлов)
│   │       ├── user.repo.ts
│   │       ├── project.repo.ts
│   │       ├── room.repo.ts
│   │       ├── object.repo.ts
│   │       ├── work.repo.ts
│   │       ├── abTest.repo.ts
│   │       ├── aiRequest.repo.ts
│   │       ├── calculatedTotals.repo.ts
│   │       ├── priceCatalog.repo.ts
│   │       ├── priceHistory.repo.ts
│   │       ├── updateJob.repo.ts
│   │       └── webhook.repo.ts
│   │
│   ├── services/                   # Бизнес-логика
│   │   ├── ai/                     # AI-провайдеры: geminiProvider.ts, mistralProvider.ts,
│   │   │                           #   aiCache.ts, priceSearchHelpers.ts
│   │   ├── update/                 # Сервис обновлений (parserManager, runner, scheduler)
│   │   └── webhook.service.ts
│   │
│   └── types/                      # TypeScript типы
│
├── knexfile.ts
├── tsconfig.json
└── package.json
```

### 3.2 API Endpoints

> Сверено с `server/src/routes/` 2026-10-03. Полный контракт — `docs/openapi.yaml`.

#### Аутентификация

| Метод | Endpoint             | Описание             |
| ----- | -------------------- | -------------------- |
| POST  | `/api/auth/register` | Регистрация          |
| POST  | `/api/auth/login`    | Вход                 |
| POST  | `/api/auth/refresh`  | Обновление токена    |
| GET   | `/api/auth/me`       | Текущий пользователь |
| POST  | `/api/auth/logout`   | Выход                |

#### Пользователи

| Метод | Endpoint        | Описание                               |
| ----- | --------------- | -------------------------------------- |
| GET   | `/api/users/me` | Текущий пользователь + статус премиума |
| PUT   | `/api/users/me` | Обновление профиля                     |

#### Проекты

| Метод  | Endpoint                         | Описание                 |
| ------ | -------------------------------- | ------------------------ |
| GET    | `/api/projects`                  | Список проектов          |
| POST   | `/api/projects`                  | Создание                 |
| GET    | `/api/projects/archived`         | Архивные проекты         |
| PATCH  | `/api/projects/:id/restore`      | Восстановление из архива |
| DELETE | `/api/projects/:id/permanent`    | Безвозвратное удаление   |
| GET    | `/api/projects/:id`              | Проект с объектами       |
| PUT    | `/api/projects/:id`              | Обновление               |
| DELETE | `/api/projects/:id`              | Удаление                 |
| PUT    | `/api/projects/:id/ai-settings`  | Настройки AI проекта     |
| PUT    | `/api/projects/:id/with-rooms`   | Сохранение с комнатами   |
| PUT    | `/api/projects/:id/with-objects` | Сохранение с объектами   |

#### Объекты

| Метод  | Endpoint                           | Описание           |
| ------ | ---------------------------------- | ------------------ |
| GET    | `/api/objects`                     | Список объектов    |
| POST   | `/api/projects/:projectId/objects` | Создание объекта   |
| GET    | `/api/objects/:id`                 | Объект с комнатами |
| PUT    | `/api/objects/:id`                 | Обновление         |
| DELETE | `/api/objects/:id`                 | Удаление           |

#### Синхронизация

| Метод | Endpoint         | Описание            |
| ----- | ---------------- | ------------------- |
| GET   | `/api/sync/pull` | Получить данные     |
| POST  | `/api/sync/push` | Отправить изменения |

Также есть секции `works`, `rooms`, `geometry`, `totals` и update-сервис
(`/api/update/*`, алиас `/api/prices/*`) — см. `docs/openapi.yaml`.

### 3.3 База данных (PostgreSQL)

**ER-диаграмма:**

```
users 1──∞ projects 1──∞ objects 1──∞ rooms 1──∞ works
                                              ├──∞ materials
                                              └──∞ tools
rooms 1──∞ openings
rooms 1──∞ room_subsections (extended)
rooms 1──∞ room_segments (advanced)
rooms 1──∞ room_obstacles (advanced)
rooms 1──∞ wall_sections (advanced)
```

**Ключевые таблицы:**

- `users` — пользователи (id, email, name, password_hash, is_premium)
- `projects` — проекты (user_id, name, description)
- `objects` — объекты недвижимости (project_id, name, city, address, use_ai_pricing)
- `rooms` — комнаты (object_id, name, geometry_mode, dimensions)
- `works` — работы (room_id, name, price, materials)
- `materials` — материалы (work_id, name, quantity, price)
- `tools` — инструменты (work_id, name, price, is_rent)
- `openings` — окна/двери (room_id, type, dimensions)
- `ai_requests` — лог AI-запросов
- `deleted_entities` — отслеживание удалений (30 дней)

---

## 4. AI-интеграция

> Сверено с кодом 2026-10-03. Клиентских API-ключей **нет** (`VITE_GEMINI_API_KEY` /
> `VITE_MISTRAL_API_KEY` в `src/` не встречаются) — все AI-вызовы идут через серверный
> прокси; ключи только в server-окружении.

### 4.1 Клиентская реализация

```typescript
// src/api/prices/unifiedSearch.ts — серверный прокси, без клиентских ключей
const response = await httpClient.post<SearchPriceResponse>('/api/ai/search-price', ...);
```

### 4.2 Серверная реализация

```typescript
// server/src/services/ai/geminiProvider.ts
export class GeminiAIProvider extends BaseAIProvider implements AIProvider {
  name = 'Google Gemini';
  // ... серверный запрос с защитой API-ключа
}
```

Аналогично `mistralProvider.ts`; кэш ответов — `aiCache.ts`.

**API endpoints** (`server/src/routes/ai.ts`):

- `POST /api/ai/estimate` — оценка стоимости по описанию
- `POST /api/ai/suggest-materials` — предложить материалы
- `POST /api/ai/generate-template` — генерация шаблона работ
- `POST /api/ai/search-price` — поиск цен (используется клиентом)
- `GET /api/ai/status`, `/api/ai/history`, `/api/ai/stats` — служебные

---

## 5. Логирование

### 5.1 Общая архитектура

Проект использует **два структурированных логгера** вместо прямых вызовов `console.*`:

| Среда             | Логгер                    | Модуль                            | Уровни                                         |
| ----------------- | ------------------------- | --------------------------------- | ---------------------------------------------- |
| **Сервер**        | `winstonLogger` (Winston) | `server/src/middleware/logger.ts` | `error`, `warn`, `info`, `debug`               |
| **Клиент**        | Функции логирования       | `src/utils/logger.ts`             | `error`, `warning`, `info`, `success`, `debug` |
| **Миграции Knex** | `console.log`             | —                                 | CLI-контекст, вне Express                      |

> **Важно:** ESLint правило `no-console: error` добавлено (2026-04-16). Все `console.*` заменены на структурированные логгеры.

### 5.2 Сервер — winstonLogger (Winston)

```typescript
// server/src/middleware/logger.ts
import winston from 'winston';
import { config } from '../config/env.js';

export const winstonLogger = winston.createLogger({
  level: config.logging.level, // Управляется через env
  defaultMeta: { version: appVersion }, // [v2.0.0] в каждой строке
  format: combine(
    errors({ stack: true }), // Автоматический стек-трейс
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat,
  ),
  transports: [
    new winston.transports.Console({
      format: combine(
        errors({ stack: true }),
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat,
      ),
    }),
  ],
});
```

**Использование в маршрутах:**

```typescript
import { winstonLogger } from '../middleware/logger.js';

winstonLogger.info('[POST /projects] Created project', {
  projectId: project.id,
  name: project.name,
  duration: Date.now() - startTime,
});
winstonLogger.warn('[GET /projects/:id] Project not found', { projectId: id });
winstonLogger.error('[POST /projects] Error', { duration, error });
```

**HTTP-логгер (middleware):**

```typescript
export function logger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;
    if (res.statusCode >= 400) {
      winstonLogger.warn(message, { ip: req.ip, userAgent: req.get('user-agent') });
    } else {
      winstonLogger.info(message);
    }
  });
  next();
}
```

**Преимущества над console.\*:**

- Уровни логирования с фильтрацией через `config.logging.level`
- Структурированные JSON-метаданные (парсимые ELK/Grafana)
- Автоматические стек-трейсы через `errors({ stack: true })`
- Расширяемые транспорты (файл, syslog, Elasticsearch, Datadog)
- Цветовой вывод через `colorize()`

### 5.3 Клиент — src/utils/logger.ts

```typescript
import { logError, logWarning, logDebug } from '../utils/logger';

logError('ProjectContext', 'saveProject', error, { projectId });
logWarning('Sync', 'Version conflict', { clientVersion, serverVersion });
logDebug('RoomEditor', 'Geometry change', { mode, dimensions });
```

**Ключевые возможности:**

- Категории и контекст: каждый лог имеет `category` + `action`
- История действий: последние 100 операций через `window.debugLogger`
- Группировка: `console.groupCollapsed()` — компактный вывод в DevTools
- Таймеры операций: `logStart/logEnd` — автоматический замер
- Отключение: `LOG_CONFIG.enabled = false`

---

## 6. Синхронизация данных

### 6.1 Архитектура синхронизации

```
┌──────────────────┐    immediate     ┌───────────────┐
│   React State    │ ──────────────→  │   IndexedDB   │  ← Первичное хранилище
│   (zustand+UI)   │ ←──────────────  │ (Dexie, local)│
└──────────────────┘                  └───────┬───────┘
                                              │ async (when authenticated)
                                      ┌───────▼───────┐
                                      │   Sync API    │
                                      │  /pull /push  │
                                      └───────┬───────┘
                                              │
                                      ┌───────▼───────┐
                                      │  Express API  │
                                      │  + PostgreSQL│
                                      └──────────────┘
```

### 6.2 Механизм синхронизации

- **Optimistic updates:** UI обновляется мгновенно, сохранение в фоне
- **Debounce:** 1-2 секунды задержка перед сохранением
- **Conflict resolution:** server wins при конфликтах
- **Offline support:** данные сохраняются в IndexedDB (Dexie; legacy localStorage
  переносится через `src/api/storage/indexedDbMigration.ts`)

---

## 7. Тестирование

### 7.1 Статистика тестов

| Категория          | Количество   |
| ------------------ | ------------ |
| Unit тесты (utils) | 220+         |
| Unit тесты (hooks) | 72+          |
| Integration тесты  | 7+           |
| API тесты          | 22+          |
| E2E тесты          | 13 файлов    |
| **Итого**          | **841 тест** |

### 7.2 Результаты (2026-04-16) — датированный срез, на 2026-10-03 не пересчитывался

- **Passed:** 833
- **Failed:** 0
- **Skipped:** 8

> **Примечание:** Добавлен мок `localStorage` в `tests/setup.ts` для совместимости с Vitest 4.x + jsdom 26, где `globalThis.localStorage` — пустой объект без Storage-методов. Это исправило 10 падений в `apiStorageProvider.test.ts` и `syncPull.test.ts`.
>
> **Логирование (2026-04-16):** Все `console.*` в клиенте заменены на `src/utils/logger.ts` (`logError`, `logWarning`, `logDebug`), в сервере — на `winstonLogger` из `server/src/middleware/logger.ts`. Миграции Knex оставлены на `console.log` (CLI-контекст).

### 7.3 E2E тесты (Playwright)

| Категория              | Статус                     |
| ---------------------- | -------------------------- |
| auth.spec.ts           | ✅ 3/3                     |
| objects.spec.ts        | ✅ 4/4                     |
| export-import.spec.ts  | 🔧 восстановлен (6 тестов) |
| core-workflow.spec.ts  | 🔧 восстановлен (3 теста)  |
| costs.spec.ts          | 🔧 восстановлен (3 теста)  |
| geometry.spec.ts       | 🔧 восстановлен (4 теста)  |
| projects.spec.ts       | 🔧 восстановлен (3 теста)  |
| rooms.spec.ts          | 🔧 восстановлен (5 тестов) |
| works.spec.ts          | 🔧 восстановлен (4 теста)  |
| work-templates.spec.ts | 🔧 восстановлен (7 тестов) |
| regressions.spec.ts    | 🔧 восстановлен (5 тестов) |
| responsive.spec.ts     | 🔧 восстановлен (2 теста)  |
| room-input.spec.ts     | 🔧 восстановлен (3 теста)  |

> **E2E стабилизация (2026-04-17):** Все `test.describe.skip` сняты. Тесты переведены на унифицированные фикстуры (`setupTestEnvironment`/`setupCleanEnvironment`) с API-моками через `page.route()`. Убраны хардкод JWT-токены. Селекторы обновлены на `data-testid`. Убраны `waitForTimeout` в пользу `toPass()` и `expect().toBeVisible()`.

### 7.4 Покрытие по файлам (срез 2026-04-16; файлы с тех пор переехали в `src/domain/`)

- `src/domain/geometry/geometry.ts` (ранее `src/utils/geometry.ts`) — 100%
- `src/domain/pricing/costs.ts` (ранее `src/utils/costs.ts`) — 100%
- `src/domain/pricing/materialCalculations.ts` (ранее `src/utils/materialCalculations.ts`) — 100%
- `src/hooks/useProjects.ts` — 100% (файл удалён как мёртвый код)
- `src/hooks/useWorkTemplates.ts` — 100%

---

## 8. Зависимости

> Сверено с `package.json` / `server/package.json` 2026-10-03. Пакетный менеджер — **pnpm**.
> Ниже — ключевые зависимости, полный список — в манифестах.

### 8.1 Основные зависимости (клиент)

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@tailwindcss/vite": "^4.1.14",
    "@vitejs/plugin-react": "^5.0.4",
    "dequal": "^2.0.3",
    "dexie": "^4.4.4",
    "i18next": "^26.3.1",
    "lucide-react": "^0.546.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-i18next": "^17.0.8",
    "vite": "^6.2.0",
    "zustand": "^5.0.14"
  }
}
```

### 8.2 Зависимости (сервер)

```json
{
  "dependencies": {
    "express": "^4.21.0",
    "cors": "^2.8.5",
    "helmet": "^8.1.0",
    "express-rate-limit": "^7.5.0",
    "pg": "^8.22.0",
    "knex": "^3.1.0",
    "zod": "^3.23.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "uuid": "^10.0.0",
    "winston": "^3.17.0",
    "cron": "^3.1.0",
    "multer": "^2.1.1",
    "exceljs": "^4.4.0",
    "dotenv": "^16.4.5"
  }
}
```

### 8.3 Development зависимости

```json
{
  "devDependencies": {
    "typescript": "~5.8.2",
    "vitest": "^4.0.18",
    "@playwright/test": "^1.58.2",
    "@testing-library/react": "^16.3.2",
    "eslint": "^10.2.0",
    "dependency-cruiser": "^17.4.3",
    "prettier": "^3.8.4"
  }
}
```

---

## 9. Документация

| Файл                                                               | Описание                                         |
| ------------------------------------------------------------------ | ------------------------------------------------ |
| [INDEX.md](../INDEX.md)                                            | Главный индексный файл                           |
| [TODO.md](./TODO.md)                                               | Актуальные задачи и прогресс                     |
| [TECHNICAL-SPECIFICATION.md](./TECHNICAL-SPECIFICATION.md)         | ТЗ v1.1 — группировка объектов                   |
| [CODE_REVIEW.md](./CODE_REVIEW.md)                                 | Исторические срезы ревью кода (v5.1, 2026-04-17) |
| [LOGGING.md](./LOGGING.md)                                         | Руководство по логированию                       |
| [DEBUG_INSTRUCTIONS.md](./DEBUG_INSTRUCTIONS.md)                   | Инструкции по отладке                            |
| [AI_DOCUMENTATION_GUIDELINES.md](./AI_DOCUMENTATION_GUIDELINES.md) | Правила ведения документации                     |

---

## 10. Дорожная карта

### Выполнено ✅

1. ✅ Декомпозиция App.tsx (2700 → 323 строк, 2026-10-03)
2. ✅ Рефакторинг геометрии (GeometrySection, useGeometryState)
3. ✅ IStorageProvider абстракция
4. ✅ Каталог материалов и расчёт
5. ✅ Поиск цен через AI (серверный прокси, ключи только на сервере)
6. ✅ Backend на Express + PostgreSQL
7. ✅ JWT аутентификация
8. ✅ Объектная модель (Project → Objects → Rooms)
9. ✅ Синхронизация IndexedDB ↔ API
10. ✅ 841 тест (срез 2026-04-17)
11. ✅ Состояние — zustand-слайсы `src/store/` (ProjectContext удалён)
12. ✅ Чистый доменный слой `src/domain/` (geometry, pricing, factories)
13. ✅ IndexedDB (Dexie) — первичное локальное хранилище
14. ✅ Декомпозиция `routes/update.ts` → `server/src/routes/update/` + `adminGuard.ts`
15. ✅ OpenAPI-контракт `docs/openapi.yaml`

### Планируется 🚧

1. **Декомпозиция:**
   - BackupManager (898 строк → панели)
   - ProjectsModal (723 строки) / CreateProjectModal (574 строки)

2. **Offline-first:**
   - PWA с Service Worker

3. **Улучшения:**
   - Request ID middleware
   - Per-user rate limiting
   - Очистка `deleted_entities` (требование ТЗ §15.2.0 — в коде job не найден, 2026-10-03)

---

**Последнее обновление:** 2026-10-03
