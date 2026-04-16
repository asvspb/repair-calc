# Архитектура проекта Repair Calculator

**Дата:** 2026-04-16
**Статус:** Актуально
**Версия клиента:** React 19 + Vite 6
**Версия сервера:** Express + MySQL + Knex

---

## 1. Обзор проекта

**Repair Calculator** — PWA-приложение для расчёта стоимости ремонтных работ. Позволяет:
- Создавать проекты с несколькими объектами недвижимости
- Рассчитывать площади стен, полов, потолков с учётом проёмов
- Вести каталог работ с материалами и инструментами
- Искать цены через AI (Gemini/Mistral)
- Экспортировать данные в CSV/JSON

### 1.1 Текущий статус (2026-04-16)

| Компонент | Статус | Описание |
|-----------|--------|----------|
| Клиент | ✅ Готов | React 19, Vite 6, TailwindCSS 4 |
| Сервер | ✅ Готов | Express, MySQL, Knex, JWT |
| База данных | ✅ Готова | MySQL 8 с миграциями |
| Хранилище | ✅ Готов | localStorage + ApiStorageProvider |
| AI-интеграция | ✅ Готов | Клиентская + серверная реализация |
| Аутентификация | ✅ Готова | JWT tokens, регистрация/логин |
| Тесты | ✅ 841 тест | 833 passed, 0 failed, 8 skipped |

---

## 2. Клиентская архитектура

### 2.1 Структура файлов

```
src/
├── App.tsx                    # Главный компонент (~475 строк)
├── main.tsx                   # Entry point
├── index.css                  # Глобальные стили (TailwindCSS)
│
├── api/                       # API-интеграции
│   ├── auth.ts                # Аутентификация
│   ├── projects.ts            # Projects API
│   ├── rooms.ts               # Rooms API
│   ├── sync.ts                # Sync API (pull/push)
│   ├── users.ts               # Users API
│   ├── storage/
│   │   └── apiStorageProvider.ts  # Storage через API
│   └── prices/                # Поиск цен через AI
│       ├── geminiPriceSearch.ts
│       ├── mistralPriceSearch.ts
│       ├── priceCache.ts
│       ├── unifiedSearch.ts
│       └── types.ts
│
├── components/                # React-компоненты
│   ├── auth/                  # Аутентификация (3 файла)
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   └── ProtectedRoute.tsx
│   │
│   ├── geometry/              # Модуль геометрии (8 файлов)
│   │   ├── GeometrySection.tsx
│   │   ├── ModeSelector.tsx
│   │   ├── SimpleGeometry.tsx
│   │   ├── ExtendedGeometry.tsx
│   │   ├── AdvancedGeometry.tsx
│   │   ├── SubSectionItem.tsx
│   │   ├── OpeningList.tsx
│   │   └── GeometryMetrics.tsx
│   │
│   ├── layout/                # Layout компоненты (4 файла)
│   │   ├── LeftSidebar.tsx
│   │   ├── RightSidebar.tsx
│   │   ├── ObjectSettings.tsx
│   │   └── ProjectSettings.tsx
│   │
│   ├── objects/               # Управление объектами (4 файла)
│   │   ├── ObjectCard.tsx
│   │   ├── ObjectSelector.tsx
│   │   ├── ObjectsList.tsx
│   │   └── CreateObjectModal.tsx
│   │
│   ├── projects/              # Управление проектами (3 файла)
│   │   ├── ProjectsList.tsx
│   │   ├── ProjectsModal.tsx
│   │   └── DataManagementModal.tsx
│   │
│   ├── rooms/                 # Список комнат (2 файла)
│   │   ├── RoomList.tsx
│   │   └── RoomListItem.tsx
│   │
│   ├── works/                 # Работы и материалы (10 файлов)
│   │   ├── WorkList.tsx
│   │   ├── WorkListItem.tsx
│   │   ├── WorkCatalogPicker.tsx
│   │   ├── WorkTemplatePickerModal.tsx
│   │   ├── WorkTemplateSaveButton.tsx
│   │   ├── WorkPriceSearch.tsx
│   │   ├── MaterialCalculationCard.tsx
│   │   ├── MaterialPriceSearch.tsx
│   │   ├── PaintMaterialCard.tsx
│   │   └── TileMaterialCard.tsx
│   │
│   ├── summary/               # Сводка по проекту (3 файла)
│   │   ├── SummaryMaterials.tsx
│   │   ├── SummaryTools.tsx
│   │   └── SummaryWorks.tsx
│   │
│   ├── ui/                    # UI-компоненты (3 файла)
│   │   ├── ConfirmDialog.tsx
│   │   ├── ErrorBoundary.tsx
│   │   └── NumberInput.tsx
│   │
│   ├── BackupManager.tsx      # Экспорт/импорт проектов
│   ├── RoomEditor.tsx         # Редактор комнаты (~906 строк)
│   └── SummaryView.tsx        # Общая смета
│
├── contexts/                  # React Context
│   ├── index.ts
│   ├── AuthContext.tsx        # Аутентификация (JWT)
│   ├── ProjectContext.tsx     # Состояние проекта (~981 строка)
│   └── WorkTemplateContext.tsx
│
├── data/                      # Статические данные
│   ├── initialData.ts         # Начальный проект
│   └── workTemplatesCatalog.ts # Каталог типовых работ
│
├── hooks/                     # Кастомные хуки
│   ├── useGeometryState.ts    # Состояние геометрии
│   ├── useMaterialCalculation.ts
│   ├── useProjects.ts
│   └── useWorkTemplates.ts
│
├── types/                     # TypeScript типы
│   ├── index.ts               # Основные типы (ProjectData, ObjectData, RoomData...)
│   ├── auth.ts                # Типы аутентификации
│   ├── storage.ts             # IStorageProvider
│   └── workTemplate.ts        # Шаблоны работ
│
└── utils/                     # Утилиты
    ├── costs.ts               # Расчёт стоимости
    ├── factories.ts           # Фабрики создания сущностей
    ├── geometry.ts            # Геометрические расчёты
    ├── localStorageProvider.ts
    ├── logger.ts             # Структурированный логгер (logError, logWarning, logDebug)
    ├── materialCalculations.ts # Формулы расчёта материалов
    ├── roomHelpers.ts         # Хелперы для комнат
    ├── storage.ts             # StorageManager
    ├── templateStorage.ts     # Хранилище шаблонов
    ├── idMapper.ts            # Маппинг локальных/серверных ID
    ├── projectObjects.ts      # Object-based helpers
    ├── migration.ts           # Миграция данных
    └── projectContextPatch.ts  # Context patches
```

### 2.2 Основные типы данных

```typescript
// src/types/index.ts

// Проект (группа объектов)
type ProjectData = {
  id: string;
  name: string;
  description?: string;
  isPremium?: boolean;
  objects: ObjectData[];      // Объекты недвижимости
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
  geometryMode: GeometryMode;  // 'simple' | 'extended' | 'advanced'
  length: number;
  width: number;
  height: number;
  segments: RoomSegment[];      // Advanced mode
  obstacles: Obstacle[];         // Advanced mode
  wallSections: WallSection[];  // Advanced mode
  subSections: RoomSubSection[]; // Extended mode
  windows: Opening[];
  doors: Opening[];
  works: WorkData[];
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

### 2.3 Хранилище (Storage)

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

**Текущая реализация:** `LocalStorageProvider` — сохраняет данные в localStorage браузера.

**Архитектура готова к замене** на:
- `ApiStorageProvider` — сохранение через REST API
- `IndexedDBProvider` — оффлайн-хранение

### 2.4 Контексты

#### AuthContext
```typescript
interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}
```

#### ProjectContext
```typescript
interface ProjectContextValue {
  // State
  projects: ProjectData[];
  activeProjectId: string;
  activeProject: ProjectData | null;
  activeObjectId: string;
  activeObject: ObjectData | null;
  isLoading: boolean;
  isSyncing: boolean;
  
  // Actions
  setActiveProjectId: (id: string) => void;
  setActiveObjectId: (id: string) => void;
  updateProjects: (projects: ProjectData[]) => void;
  updateActiveProject: (project: ProjectData) => void;
  updateRoom: (room: RoomData) => void;
  updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => void;
  deleteRoom: (roomId: string) => void;
  addRoom: (room: RoomData) => void;
  reorderRooms: (rooms: RoomData[]) => void;
  
  // Object management
  createObject: (object: ObjectData) => void;
  updateObject: (object: ObjectData) => void;
  deleteObject: (objectId: string) => void;
  copyObject: (objectId: string) => void;
}
```

**Особенности:**
- Автосохранение с debounce (1-2 сек)
- Защита от потери данных при закрытии (`beforeunload`)
- Миграция данных при загрузке
- Синхронизация с сервером при авторизации

---

## 3. Серверная архитектура

### 3.1 Структура сервера

```
server/
├── src/
│   ├── index.ts                    # Entry point
│   ├── app.ts                      # Express app setup
│   │
│   ├── config/                     # Конфигурация
│   │   ├── database.ts
│   │   └── jwt.ts
│   │
│   ├── routes/                     # API роуты
│   │   ├── index.ts                # Роутер
│   │   ├── auth.ts                 # Аутентификация
│   │   ├── projects.ts             # CRUD проектов
│   │   ├── objects.ts              # CRUD объектов
│   │   ├── rooms.ts                # CRUD комнат
│   │   ├── works.ts                # CRUD работ
│   │   ├── geometry.ts             # Геометрические расчёты
│   │   ├── ai.ts                   # AI-провайдеры
│   │   ├── sync.ts                 # Синхронизация
│   │   ├── totals.ts               # Итоги
│   │   ├── users.ts                # Пользователи
│   │   └── update.ts               # Обновления
│   │
│   ├── middleware/                 # Middleware
│   │   ├── auth.ts                 # JWT аутентификация
│   │   ├── validation.ts           # Валидация (Zod)
│   │   ├── rateLimiter.ts          # Rate limiting
│   │   ├── logger.ts               # Логирование
│   │   └── errorHandler.ts         # Обработка ошибок
│   │
│   ├── db/
│   │   ├── pool.ts                 # MySQL pool
│   │   ├── migrations/             # Knex миграции
│   │   └── repositories/           # Data access
│   │       ├── user.repo.ts
│   │       ├── project.repo.ts
│   │       ├── room.repo.ts
│   │       └── object.repo.ts
│   │
│   ├── services/                   # Бизнес-логика
│   │   ├── calculations.ts
│   │   └── ai/                     # AI-провайдеры
│   │
│   └── types/                      # TypeScript типы
│
├── knexfile.ts
├── tsconfig.json
└── package.json
```

### 3.2 API Endpoints

#### Аутентификация
| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| POST | `/api/auth/refresh` | Обновление токена |
| GET | `/api/auth/me` | Текущий пользователь |
| POST | `/api/auth/logout` | Выход |

#### Проекты
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/projects` | Список проектов |
| POST | `/api/projects` | Создание |
| GET | `/api/projects/:id` | Проект с объектами |
| PUT | `/api/projects/:id` | Обновление |
| DELETE | `/api/projects/:id` | Удаление |

#### Объекты
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/objects` | Список объектов |
| POST | `/api/projects/:projectId/objects` | Создание объекта |
| GET | `/api/objects/:id` | Объект с комнатами |
| PUT | `/api/objects/:id` | Обновление |
| DELETE | `/api/objects/:id` | Удаление |

#### Синхронизация
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/sync/pull` | Получить данные |
| POST | `/api/sync/push` | Отправить изменения |

### 3.3 База данных (MySQL)

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

### 4.1 Клиентская реализация

```typescript
// src/api/prices/geminiPriceSearch.ts
export async function searchPrices(
  query: string,
  city?: string
): Promise<PriceSearchResult[]> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  // ... запрос к Gemini API
}
```

### 4.2 Серверная реализация

```typescript
// server/src/services/ai/gemini.ts
export class GeminiProvider implements AIProvider {
  name = 'gemini' as const;
  
  async chat(messages: ChatMessage[]): Promise<string> {
    // ... серверный запрос с защитой API-ключа
  }
}
```

**API endpoints:**
- `POST /api/ai/estimate` — оценка стоимости по описанию
- `POST /api/ai/suggest-materials` — предложить материалы

---

## 5. Логирование

### 5.1 Общая архитектура

Проект использует **два структурированных логгера** вместо прямых вызовов `console.*`:

| Среда | Логгер | Модуль | Уровни |
|-------|--------|--------|--------|
| **Сервер** | `winstonLogger` (Winston) | `server/src/middleware/logger.ts` | `error`, `warn`, `info`, `debug` |
| **Клиент** | Функции логирования | `src/utils/logger.ts` | `error`, `warning`, `info`, `success`, `debug` |
| **Миграции Knex** | `console.log` | — | CLI-контекст, вне Express |

> **Важно:** Для предотвращения возврата к `console.*` планируется добавить ESLint правило `no-console`.

### 5.2 Сервер — winstonLogger (Winston)

```typescript
// server/src/middleware/logger.ts
import winston from 'winston';
import { config } from '../config/env.js';

export const winstonLogger = winston.createLogger({
  level: config.logging.level,  // Управляется через env
  format: combine(
    errors({ stack: true }),     // Автоматический стек-трейс
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: combine(errors({ stack: true }), colorize(), timestamp(), logFormat),
    }),
  ],
});
```

**Использование в маршрутах:**
```typescript
import { winstonLogger } from '../middleware/logger.js';

winstonLogger.info('[POST /projects] Created project', {
  projectId: project.id, name: project.name, duration: Date.now() - startTime,
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

**Преимущества над console.*:**
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
│   React State    │ ──────────────→  │  localStorage  │  ← Первичное хранилище
│   (UI)           │ ←──────────────  │  (persistent)  │
└──────────────────┘                  └───────┬───────┘
                                              │ async (when authenticated)
                                      ┌───────▼───────┐
                                      │   Sync API    │
                                      │  /pull /push  │
                                      └───────┬───────┘
                                              │
                                      ┌───────▼───────┐
                                      │  Express API  │
                                      │  + MySQL      │
                                      └──────────────┘
```

### 6.2 Механизм синхронизации

- **Optimistic updates:** UI обновляется мгновенно, сохранение в фоне
- **Debounce:** 1-2 секунды задержка перед сохранением
- **Conflict resolution:** server wins при конфликтах
- **Offline support:** данные сохраняются в localStorage

---

## 7. Тестирование

### 7.1 Статистика тестов

| Категория | Количество |
|-----------|------------|
| Unit тесты (utils) | 220+ |
| Unit тесты (hooks) | 72+ |
| Integration тесты | 7+ |
| API тесты | 22+ |
| E2E тесты | 13 файлов |
| **Итого** | **841 тест** |

### 7.2 Результаты (2026-04-16)

- **Passed:** 833
- **Failed:** 0
- **Skipped:** 8

> **Примечание:** Добавлен мок `localStorage` в `tests/setup.ts` для совместимости с Vitest 4.x + jsdom 26, где `globalThis.localStorage` — пустой объект без Storage-методов. Это исправило 10 падений в `apiStorageProvider.test.ts` и `syncPull.test.ts`.
>
> **Логирование (2026-04-16):** Все `console.*` в клиенте заменены на `src/utils/logger.ts` (`logError`, `logWarning`, `logDebug`), в сервере — на `winstonLogger` из `server/src/middleware/logger.ts`. Миграции Knex оставлены на `console.log` (CLI-контекст).

### 7.3 E2E тесты (Playwright)

| Категория | Статус |
|-----------|--------|
| auth.spec.ts | ✅ 3/3 |
| objects.spec.ts | ✅ 4/4 |
| export-import.spec.ts | 🔧 восстановлен (6 тестов) |
| core-workflow.spec.ts | 🔧 восстановлен (3 теста) |
| costs.spec.ts | 🔧 восстановлен (3 теста) |
| geometry.spec.ts | 🔧 восстановлен (4 теста) |
| projects.spec.ts | 🔧 восстановлен (3 теста) |
| rooms.spec.ts | 🔧 восстановлен (5 тестов) |
| works.spec.ts | 🔧 восстановлен (4 теста) |
| work-templates.spec.ts | 🔧 восстановлен (7 тестов) |
| regressions.spec.ts | 🔧 восстановлен (5 тестов) |
| responsive.spec.ts | 🔧 восстановлен (2 теста) |
| room-input.spec.ts | 🔧 восстановлен (3 теста) |

> **E2E стабилизация (2026-04-17):** Все `test.describe.skip` сняты. Тесты переведены на унифицированные фикстуры (`setupTestEnvironment`/`setupCleanEnvironment`) с API-моками через `page.route()`. Убраны хардкод JWT-токены. Селекторы обновлены на `data-testid`. Убраны `waitForTimeout` в пользу `toPass()` и `expect().toBeVisible()`.

### 7.4 Покрытие по файлам

- `src/utils/geometry.ts` — 100%
- `src/utils/costs.ts` — 100%
- `src/utils/materialCalculations.ts` — 100%
- `src/hooks/useProjects.ts` — 100%
- `src/hooks/useWorkTemplates.ts` — 100%

---

## 8. Зависимости

### 8.1 Основные зависимости (клиент)

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@tailwindcss/vite": "^4.1.14",
    "@vitejs/plugin-react": "^5.0.4",
    "lucide-react": "^0.546.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "vite": "^6.2.0"
  }
}
```

### 8.2 Зависимости (сервер)

```json
{
  "dependencies": {
    "express": "^4.21.0",
    "cors": "^2.8.5",
    "mysql2": "^3.11.0",
    "knex": "^3.1.0",
    "zod": "^3.23.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "uuid": "^10.0.0",
    "winston": "^3.17.0"
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
    "@testing-library/react": "^16.3.2"
  }
}
```

---

## 9. Документация

| Файл | Описание |
|------|----------|
| [INDEX.md](../INDEX.md) | Главный индексный файл |
| [TODO.md](./TODO.md) | Актуальные задачи и прогресс |
| [TECHNICAL-SPECIFICATION.md](./TECHNICAL-SPECIFICATION.md) | ТЗ v1.1 — группировка объектов |
| [CODE_REVIEW.md](./CODE_REVIEW.md) | Результаты ревью кода v5.0 |
| [PROGRESS.md](./PROGRESS.md) | История прогресса |
| [FRONTEND-STATUS.md](./FRONTEND-STATUS.md) | Статус Frontend |
| [LOGGING.md](./LOGGING.md) | Руководство по логированию |
| [AI_DOCUMENTATION_GUIDELINES.md](./AI_DOCUMENTATION_GUIDELINES.md) | Правила ведения документации |

---

## 10. Дорожная карта

### Выполнено ✅

1. ✅ Декомпозиция App.tsx (2700 → 475 строк)
2. ✅ Рефакторинг геометрии (GeometrySection, useGeometryState)
3. ✅ IStorageProvider абстракция
4. ✅ Каталог материалов и расчёт
5. ✅ Поиск цен через AI (клиентский + серверный)
6. ✅ Backend на Express + MySQL
7. ✅ JWT аутентификация
8. ✅ Объектная модель (Project → Objects → Rooms)
9. ✅ Синхронизация localStorage ↔ API
10. ✅ 841 тест

### Планируется 🚧

1. **Декомпозиция:**
   - ProjectContext (981 строк → 3 модуля)
   - RoomEditor (906 строк → обработчики в хуки)
   - BackupManager (837 строк → панели)

2. **Offline-first:**
   - IndexedDB для pending changes
   - PWA с Service Worker

3. **Улучшения:**
   - Request ID middleware
   - Per-user rate limiting
   - Swagger/OpenAPI документация

---

**Последнее обновление:** 2026-04-17