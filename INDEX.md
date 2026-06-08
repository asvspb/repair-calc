# INDEX — Главный индексный файл проекта

**Последнее обновление:** 2026-06-08
**Версия приложения:** 1.1

---

## Назначение

Полная информация о состоянии проекта для AI-агентов.
**Правило:** После ЛЮБЫХ изменений в коде обновляйте этот файл.

---

## Структура проекта

```
repair-calc/
├── src/                              # Исходный код фронтенда
│   ├── api/                          # API клиенты
│   │   ├── auth.ts                   # Аутентификация (JWT)
│   │   ├── httpClient.ts             # HTTP-клиент (interceptors, retry, timeout)
│   │   ├── objects.ts                # Objects API
│   │   ├── projects.ts               # Projects API
│   │   ├── rooms.ts                  # Rooms API
│   │   ├── totals.ts                 # Totals API
│   │   ├── users.ts                  # Users API
│   │   ├── storage/
│   │   │   ├── apiStorageProvider.ts # Storage через REST API
│   │   │   └── index.ts
│   │   └── prices/                   # AI поиск цен (через серверный прокси)
│   │       ├── priceCache.ts         # Клиентский кэш (localStorage)
│   │       ├── unifiedSearch.ts      # Унифицированный поиск → /api/ai/search-price
│   │       ├── types.ts
│   │       └── index.ts
│   ├── components/                   # React компоненты
│   │   ├── auth/                     # (4 файла: Login, Register, ProtectedRoute, index)
│   │   ├── geometry/                 # (9 файлов: Section, Mode, Simple/Extended/Advanced)
│   │   ├── layout/                   # (4 файла: LeftSidebar, RightSidebar, Settings)
│   │   ├── objects/                  # (5 файлов: Card, Selector, List, CreateModal, index)
│   │   ├── projects/                 # (5 файлов: List, Modal, DataMgmt, Create, index)
│   │   ├── rooms/                    # (3 файла: List, ListItem, index)
│   │   ├── works/                    # (11 файлов: WorkList, Materials, PriceSearch, index)
│   │   ├── summary/                  # (4 файла: Materials, Tools, Works, index)
│   │   ├── ui/                       # (3 файла: ConfirmDialog, ErrorBoundary, NumberInput)
│   │   ├── BackupManager.tsx
│   │   ├── RoomEditor.tsx
│   │   └── SummaryView.tsx
│   ├── contexts/                     # React Context
│   │   ├── AuthContext.tsx           # Аутентификация
│   │   ├── ProjectContext.tsx        # Управление проектами
│   │   ├── WorkTemplateContext.tsx   # Шаблоны работ
│   │   └── index.ts
│   ├── data/
│   │   ├── initialData.ts           # Начальные данные
│   │   └── workTemplatesCatalog.ts  # Каталог типовых работ
│   ├── hooks/
│   │   ├── useGeometryState.ts       # Состояние геометрии
│   │   ├── useMaterialCalculation.ts # Расчёт материалов
│   │   ├── useProjects.ts            # Хук проектов (legacy)
│   │   └── useWorkTemplates.ts       # Шаблоны работ
│   ├── types/
│   │   ├── index.ts                  # Основные типы (ProjectData, ObjectData, RoomData...)
│   │   ├── auth.ts                   # Типы аутентификации
│   │   ├── storage.ts                # IStorageProvider
│   │   ├── workTemplate.ts           # Шаблоны работ
│   │   └── vite-env.d.ts
│   ├── utils/
│   │   ├── costs.ts                  # Расчёт стоимости
│   │   ├── debugLogger.ts            # Отладочный логгер
│   │   ├── factories.ts              # Фабрики создания сущностей
│   │   ├── format.ts                 # Форматирование чисел
│   │   ├── geometry.ts               # Геометрические расчёты
│   │   ├── idMapper.ts               # Маппинг локальных/серверных ID
│   │   ├── localStorageProvider.ts   # localStorage StorageProvider
│   │   ├── logger.ts                 # Структурированный логгер
│   │   ├── materialCalculations.ts   # Формулы расчёта материалов
│   │   ├── migration.ts              # Миграция данных
│   │   ├── projectContextPatch.ts    # Context patches (legacy)
│   │   ├── projectObjects.ts         # Object-based project helpers
│   │   ├── roomHelpers.ts            # Хелперы для комнат
│   │   ├── saveQueue.ts              # Очередь сохранения
│   │   ├── storage.ts                # StorageManager
│   │   └── templateStorage.ts        # Хранилище шаблонов
│   ├── App.tsx                       # Корневой компонент (~470 строк)
│   ├── main.tsx                      # Точка входа
│   └── index.css                     # Глобальные стили (TailwindCSS)
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
│   │   │   ├── geometry.ts           # Геометрические расчёты
│   │   │   ├── ai.ts                 # AI-провайдеры
│   │   │   ├── sync.ts               # Синхронизация (pull/push)
│   │   │   ├── totals.ts             # Итоги
│   │   │   ├── users.ts              # Пользователи
│   │   │   └── update.ts             # Сервис обновлений (2184 строки)
│   │   ├── middleware/
│   │   │   ├── auth.ts               # JWT аутентификация
│   │   │   ├── validation.ts         # Валидация (Zod)
│   │   │   ├── rateLimiter.ts        # Rate limiting
│   │   │   ├── logger.ts             # Winston логирование
│   │   │   └── errorHandler.ts       # Обработка ошибок
│   │   ├── db/
│   │   │   ├── pool.ts               # MySQL pool
│   │   │   ├── migrations/           # Knex миграции
│   │   │   │   ├── 20260313_initial.ts
│   │   │   │   ├── 20260314_ab_tests.ts
│   │   │   │   ├── 20260314_update_service.ts
│   │   │   │   ├── 20260314_webhooks.ts
│   │   │   │   ├── 20260315_room_json_fields.ts
│   │   │   │   └── 20260331_add_objects.ts
│   │   │   └── repositories/         # Data access (12 файлов)
│   │   │       ├── abTest.repo.ts
│   │   │       ├── aiRequest.repo.ts
│   │   │       ├── calculatedTotals.repo.ts
│   │   │       ├── object.repo.ts
│   │   │       ├── priceCatalog.repo.ts
│   │   │       ├── priceHistory.repo.ts
│   │   │       ├── project.repo.ts
│   │   │       ├── room.repo.ts
│   │   │       ├── updateJob.repo.ts
│   │   │       ├── user.repo.ts
│   │   │       ├── webhook.repo.ts
│   │   │       └── work.repo.ts
│   │   ├── services/
│   │   │   ├── ai/                   # AI-провайдеры (Gemini, Mistral, cache, priceSearch)
│   │   │   ├── update/               # Сервис обновлений (parsers, scheduler, runner)
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
│
├── tests/                            # Unit/integration тесты
├── docs/                             # Документация
├── scripts/                          # Скрипты сборки и тестирования
├── docker-compose.yml
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

| Файл | Назначение |
|------|----------|
| `src/contexts/ProjectContext.tsx` | Управление состоянием проектов (~981 строка) |
| `src/contexts/AuthContext.tsx` | Аутентификация пользователя |
| `src/api/httpClient.ts` | HTTP-клиент (interceptors, retry, timeout) |
| `src/api/storage/apiStorageProvider.ts` | Синхронизация с сервером (~1036 строк) |
| `src/utils/storage.ts` | StorageManager (localStorage) |
| `src/utils/idMapper.ts` | Маппинг локальных/серверных ID |
| `src/utils/projectObjects.ts` | Object-based helpers (pure functions) |

### Бэкенд

| Файл | Назначение |
|------|----------|
| `server/src/routes/sync.ts` | Sync API (pull/push) |
| `server/src/routes/projects.ts` | Projects CRUD |
| `server/src/routes/update.ts` | Сервис обновлений (2184 строки) |
| `server/src/config/env.ts` | Конфигурация (DB, JWT, logging) |
| `server/src/middleware/logger.ts` | Winston логирование |
| `server/src/middleware/auth.ts` | JWT аутентификация |

---

## База данных

### Таблицы

| Таблица | Назначение |
|---------|----------|
| `users` | Пользователи |
| `projects` | Проекты (user_id, name, description) |
| `objects` | Объекты недвижимости (project_id, name, city, address) |
| `rooms` | Комнаты (object_id, name, geometry_mode, dimensions) |
| `works` | Работы (room_id, name, price, materials) |
| `materials` | Материалы (work_id, name, quantity, price) |
| `tools` | Инструменты (work_id, name, price, is_rent) |
| `openings` | Окна/двери (room_id, type, dimensions) |
| `ai_requests` | История AI запросов |
| `deleted_entities` | Отслеживание удалений (30 дней) |
| `audit_log` | Лог аудита |

### Миграции

```
server/src/db/migrations/
├── 20260313_initial.ts            # Начальная схема
├── 20260314_ab_tests.ts           # A/B тесты
├── 20260314_update_service.ts     # Service обновлений
├── 20260314_webhooks.ts           # Webhooks
├── 20260315_room_json_fields.ts   # JSON поля для комнат
└── 20260331_add_objects.ts        # Таблица objects + deleted_entities
```

---

## API Endpoints

### Аутентификация

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| POST | `/api/auth/refresh` | Обновление токена |
| GET | `/api/auth/me` | Текущий пользователь |
| POST | `/api/auth/logout` | Выход |

### Проекты

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/projects` | Список проектов |
| POST | `/api/projects` | Создание |
| GET | `/api/projects/:id` | Проект с объектами |
| PUT | `/api/projects/:id` | Обновление |
| DELETE | `/api/projects/:id` | Удаление |

### Объекты

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/objects` | Список объектов |
| POST | `/api/projects/:projectId/objects` | Создание объекта |
| GET | `/api/objects/:id` | Объект с комнатами |
| PUT | `/api/objects/:id` | Обновление |
| DELETE | `/api/objects/:id` | Удаление |

### Синхронизация

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/sync/pull` | Получить данные |
| POST | `/api/sync/push` | Отправить изменения |

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
  rooms?: RoomData[];    // Deprecated (обратная совместимость)
  city?: string;
  useAiPricing?: boolean;
  lastAiPriceUpdate?: string;
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
  segments: RoomSegment[];       // Advanced mode
  obstacles: Obstacle[];         // Advanced mode
  wallSections: WallSection[];   // Advanced mode
  subSections: RoomSubSection[]; // Extended mode
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
- MySQL 8
- Knex.js (migrations)
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
npm install
npm run dev  # http://localhost:3993

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
npm test             # Unit тесты (Vitest)
npm run test:e2e     # E2E тесты (Playwright)
npm run test:e2e:ui  # E2E с UI
npm run lint         # TypeScript + ESLint
npm run analyze:graph # Codegraph: переиндексация графа зависимостей
```

---

## Правила разработки

1. **Перед коммитом:** `npm test` + `npm run lint` + обновить `INDEX.md`
2. **Порт приложения:** Только **3993** (фронтенд), **3994** (бэкенд)
3. **Логирование:** Winston (сервер) + logger.ts (клиент), `no-console: error` в ESLint
4. **Миграции БД:** Только через Knex migrations

---

## Документация

- [README](./README.md) — Главная документация
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Архитектура проекта
- [docs/CODE_REVIEW.md](./docs/CODE_REVIEW.md) — Результаты ревью кода
- [docs/LOGGING.md](./docs/LOGGING.md) — Логирование
- [docs/DEBUG_INSTRUCTIONS.md](./docs/DEBUG_INSTRUCTIONS.md) — Инструкции по отладке
- [docs/TECHNICAL-SPECIFICATION.md](./docs/TECHNICAL-SPECIFICATION.md) — ТЗ v1.1

---

## Известные проблемы кода (Code Review 2026-04-17)

### Критические (Security)
- **S1.** ~~API ключи Gemini/Mistral доступны в клиентском бандле~~ — **ИСПРАВЛЕНО**: AI-вызовы перенесены на серверный прокси `/api/ai/search-price`
- **S2.** 19 admin endpoints без проверки прав в `server/src/routes/update.ts`
- **S3.** Слабые fallback JWT секреты в `server/src/config/env.ts`

### Сломанный код
- **H1.** `objects.ts` и `users.ts` импортируют несуществующий `fetchJson` из `httpClient`
- **H2.** `useMaterialCalculation.ts` — вызов hook внутри `useMemo` (Rules of Hooks violation)
- **H3.** `apiStorageProvider.ts` — `require()` в ESM-модуле

### Дублирование
- ~~`geminiPriceSearch.ts` / `mistralPriceSearch.ts`~~ — **УДАЛЕНО**: клиентские AI-модули удалены, поиск идёт через серверный прокси. Дублирование промптов устранено через `priceSearchHelpers.ts`
- `parseJSON()` в `projects.ts` и `rooms.ts`
- `STORAGE_KEYS` в `storage.ts` и `apiStorageProvider.ts`
- `API_BASE` в `httpClient.ts` и `auth.ts`

### Мёртвый код
- `src/hooks/useProjects.ts` — дублирует ProjectContext
- `src/utils/debugLogger.ts` — дублирует logger.ts
- `src/utils/projectContextPatch.ts` — заменён projectObjects.ts

### Производительность
- `JSON.stringify` для сравнения объектов в ProjectContext
- Polling sync errors каждые 5 секунд
- `getAllRooms()` вызывается многократно без кэширования

---

**ВАЖНО:** После каждого изменения обновляйте этот файл!

---

## История изменений (кодревью)

### 2026-04-17: P0-SEC Исправление утечки API-ключей
- **Удалено:** `src/api/prices/geminiPriceSearch.ts`, `src/api/prices/mistralPriceSearch.ts`, `tests/api/geminiPriceSearch.test.ts`
- **Новое:** `server/src/services/ai/priceSearchHelpers.ts` — общий промпт и парсер для поиска цен
- **Изменено:** `src/api/prices/unifiedSearch.ts` — запросы через серверный прокси `/api/ai/search-price`
- **Изменено:** `server/src/routes/ai.ts` — добавлен эндпоинт `POST /api/ai/search-price` с кэшированием
- **Изменено:** `server/src/services/ai/geminiProvider.ts`, `mistralProvider.ts` — добавлен `searchPrice()`, убрано дублирование
- **Изменено:** `server/src/services/ai/aiCache.ts` — добавлен `'search-price'` в кэшируемые типы (TTL 6ч)
- **Изменено:** `.env.example` — API-ключи без `VITE_` префикса (серверные)
- **Новое:** `tests/api/unifiedSearch.test.ts` — тесты серверного прокси (7 тестов)
