# Архитектура проекта Repair Calculator

**Дата:** 2026-03-13
**Статус:** Актуально
**Версия клиента:** React 19 + Vite 6

---

## 1. Обзор проекта

**Repair Calculator** — PWA-приложение для расчёта стоимости ремонтных работ. Позволяет:
- Создавать проекты с несколькими комнатами
- Рассчитывать площади стен, полов, потолков с учётом проёмов
- Вести каталог работ с материалами и инструментами
- Искать цены через AI (Gemini/Mistral)
- Экспортировать данные в CSV/JSON

### 1.1 Текущий статус (2026-03-13)

| Компонент | Статус | Описание |
|-----------|--------|----------|
| Клиент | ✅ Готов | React 19, Vite 6, TailwindCSS 4 |
| Хранилище | ✅ Готов | localStorage + IStorageProvider |
| Тесты | ✅ Готов | 402 теста (~50% покрытие) |
| Сервер | ❌ Не реализован | Планируется (см. DATABASE_MIGRATION.md) |
| База данных | ❌ Не реализована | MySQL (планируется) |
| AI-интеграция | 🟡 Частично | Клиентская реализация через Gemini API |

---

## 2. Клиентская архитектура

### 2.1 Структура файлов

```
src/
├── App.tsx                    # Главный компонент (~170 строк)
├── main.tsx                   # Entry point
├── index.css                  # Глобальные стили (TailwindCSS)
│
├── api/                       # API-интеграции
│   └── prices/                # Поиск цен через AI
│       ├── geminiPriceSearch.ts
│       ├── mistralPriceSearch.ts
│       ├── priceCache.ts
│       ├── unifiedSearch.ts
│       ├── types.ts
│       └── index.ts
│
├── components/                # React-компоненты
│   ├── BackupManager.tsx      # Экспорт/импорт проектов
│   ├── RoomEditor.tsx         # Редактор комнаты (~843 строки)
│   ├── SummaryView.tsx        # Общая смета
│   │
│   ├── geometry/              # Модуль геометрии
│   │   ├── index.ts
│   │   ├── GeometrySection.tsx    # Контейнер геометрии
│   │   ├── ModeSelector.tsx       # Выбор режима (simple/extended/advanced)
│   │   ├── SimpleGeometry.tsx     # Простая геометрия
│   │   ├── ExtendedGeometry.tsx   # Расширенная (секции)
│   │   ├── AdvancedGeometry.tsx    # Продвинутая (сегменты/препятствия)
│   │   ├── SubSectionItem.tsx     # Элемент секции
│   │   ├── OpeningList.tsx        # Окна/двери
│   │   └── GeometryMetrics.tsx    # Метрики площади
│   │
│   ├── rooms/                 # Список комнат
│   │   ├── index.ts
│   │   ├── RoomList.tsx
│   │   └── RoomListItem.tsx
│   │
│   ├── works/                 # Работы и материалы
│   │   ├── index.ts
│   │   ├── WorkList.tsx
│   │   ├── WorkListItem.tsx
│   │   ├── WorkCatalogPicker.tsx      # Выбор из каталога
│   │   ├── WorkTemplatePickerModal.tsx
│   │   ├── WorkTemplateSaveButton.tsx
│   │   ├── WorkPriceSearch.tsx         # Поиск цен работ
│   │   ├── MaterialCalculationCard.tsx # Расчёт материалов
│   │   ├── PaintMaterialCard.tsx       # Карточка краски
│   │   ├── TileMaterialCard.tsx        # Карточка плитки
│   │   └── MaterialPriceSearch.tsx      # Поиск цен материалов
│   │
│   ├── summary/               # Сводка по проекту
│   │   ├── index.ts
│   │   ├── SummaryMaterials.tsx
│   │   ├── SummaryTools.tsx
│   │   └── SummaryWorks.tsx
│   │
│   └── ui/                    # UI-компоненты
│       ├── ConfirmDialog.tsx
│       ├── ErrorBoundary.tsx
│       └── NumberInput.tsx
│
├── contexts/                  # React Context
│   ├── index.ts
│   ├── ProjectContext.tsx    # Состояние проекта
│   └── WorkTemplateContext.tsx
│
├── data/                      # Статические данные
│   ├── initialData.ts         # Начальный проект
│   └── workTemplatesCatalog.ts # Каталог типовых работ
│
├── hooks/                     # Кастомные хуки
│   ├── useGeometryState.ts   # Состояние геометрии
│   ├── useMaterialCalculation.ts
│   ├── useProjects.ts
│   └── useWorkTemplates.ts
│
├── types/                     # TypeScript типы
│   ├── index.ts               # Основные типы (ProjectData, RoomData, WorkData...)
│   ├── storage.ts             # IStorageProvider
│   └── workTemplate.ts        # Шаблоны работ
│
└── utils/                     # Утилиты
    ├── costs.ts               # Расчёт стоимости
    ├── factories.ts           # Фабрики создания сущностей
    ├── geometry.ts            # Геометрические расчёты
    ├── localStorageProvider.ts
    ├── materialCalculations.ts # Формулы расчёта материалов
    ├── roomHelpers.ts         # Хелперы для комнат
    ├── storage.ts             # StorageManager
    └── templateStorage.ts     # Хранилище шаблонов
```

### 2.2 Основные типы данных

```typescript
// src/types/index.ts

// Проект
type ProjectData = {
  id: string;
  name: string;
  rooms: RoomData[];
  city?: string;              // Город для поиска цен
  useAiPricing?: boolean;     // Использовать AI для цен
  lastAiPriceUpdate?: string; // Дата последнего обновления
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

### 2.4 Контекст проекта (ProjectContext)

```typescript
interface ProjectContextValue {
  // State
  projects: ProjectData[];
  activeProjectId: string;
  activeProject: ProjectData | null;
  isLoading: boolean;
  error: StorageError | null;
  lastSaved: Date | null;
  saveError: string | null;
  
  // Actions
  setActiveProjectId: (id: string) => void;
  updateProjects: (projects: ProjectData[]) => void;
  updateActiveProject: (project: ProjectData) => void;
  updateRoom: (room: RoomData) => void;
  updateRoomById: (roomId: string, updater: (prev: RoomData) => RoomData) => void;
  deleteRoom: (roomId: string) => void;
  addRoom: (room: RoomData) => void;
  reorderRooms: (rooms: RoomData[]) => void;
}
```

**Особенности:**
- Автосохранение с debounce (1 сек)
- Защита от потери данных при закрытии (`beforeunload`)
- Миграция данных при загрузке

---

## 3. Серверная архитектура (ПЛАНИРУЕТСЯ)

**Подробное ТЗ:** [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md)

### 3.1 Целевая архитектура

```
┌─────────────────┐     HTTP/REST      ┌─────────────────┐
│   React Client  │ ◄───────────────► │  Express Server  │
│   (port 3993)   │                    │   (port 3994)    │
└─────────────────┘                    └────────┬────────┘
                                                │
                                                ▼
                                       ┌─────────────────┐
                                       │    MySQL DB     │
                                       │   (port 3306)   │
                                       └─────────────────┘
```

### 3.2 Структура сервера (план)

```
server/
├── src/
│   ├── index.ts                    -- Entry point
│   ├── app.ts                      -- Express app setup
│   ├── config/                     -- Конфигурация
│   ├── routes/                     -- API роуты
│   ├── middleware/                 -- Auth, validation, error handling
│   ├── services/                   -- Бизнес-логика
│   │   ├── calculations.ts         -- Общие расчёты (из src/utils/)
│   │   └── ai/                     -- AI-провайдеры
│   ├── db/
│   │   ├── pool.ts                 -- MySQL pool
│   │   ├── migrations/             -- Knex миграции
│   │   └── repositories/           -- Data access
│   └── types/                       -- TypeScript типы
├── knexfile.ts
├── tsconfig.json
└── package.json
```

### 3.3 База данных (MySQL)

**ER-диаграмма:**

```
users 1──∞ projects 1──∞ rooms 1──∞ works 1──∞ materials
                                      └──∞ tools
rooms 1──∞ openings
rooms 1──∞ room_subsections (extended)
rooms 1──∞ room_segments (advanced)
rooms 1──∞ room_obstacles (advanced)
rooms 1──∞ wall_sections (advanced)
```

**Ключевые таблицы:**
- `users` — пользователи
- `projects` — проекты (user_id → users)
- `rooms` — комнаты (project_id → projects)
- `works` — работы (room_id → rooms)
- `materials` — материалы (work_id → works)
- `tools` — инструменты (work_id → works)
- `ai_requests` — лог AI-запросов

---

## 4. AI-интеграция

### 4.1 Текущая реализация (клиентская)

```typescript
// src/api/prices/geminiPriceSearch.ts
export async function searchPrices(
  query: string,
  city?: string
): Promise<PriceSearchResult[]> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  // ... запрос к Gemini API напрямую из браузера
}
```

**Ограничения:**
- API-ключ виден в бандле
- Нет кэширования на сервере
- Нет rate limiting

### 4.2 Планируемая реализация (серверная)

```typescript
// server/src/services/ai/gemini.ts
export class GeminiProvider implements AIProvider {
  name = 'gemini' as const;
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    // ... серверный запрос
  }
}
```

**API endpoints:**
- `POST /api/ai/estimate` — оценка стоимости по описанию
- `POST /api/ai/suggest-materials` — предложить материалы
- `POST /api/ai/generate-template` — шаблон работ для комнаты

---

## 5. PWA и Offline-first (ПЛАНИРУЕТСЯ)

### 5.1 Стратегия синхронизации

```
┌──────────────────┐    immediate     ┌───────────────┐
│   React State    │ ──────────────→  │  localStorage  │  ← Первичное хранилище
│   (UI)           │ ←──────────────  │  (persistent)  │
└──────────────────┘                  └───────┬────────┘
                                              │ async queue
                                      ┌───────▼────────┐
                                      │   Sync Queue    │  ← IndexedDB
                                      │   (pending ops) │
                                      └───────┬────────┘
                                              │ when online
                                      ┌───────▼────────┐
                                      │  Express API    │
                                      │  + MySQL        │
                                      └────────────────┘
```

### 5.2 Конфигурация PWA

```typescript
// vite.config.ts (план)
VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [{
      urlPattern: /^\/api\/.*/,
      handler: 'NetworkFirst',
    }],
  },
  manifest: {
    name: 'Мой ремонт — Калькулятор',
    short_name: 'Мой ремонт',
    theme_color: '#4f46e5',
    // ...
  },
})
```

---

## 6. Тестирование

### 6.1 Статистика тестов

| Категория | Количество |
|-----------|------------|
| Unit тесты (utils) | 220 |
| Unit тесты (hooks) | 72 |
| Integration тесты | 7 |
| API тесты | 22 |
| E2E тесты | 16 |
| **Итого** | **402** |

### 6.2 Покрытие по файлам

- `src/utils/geometry.ts` — 100%
- `src/utils/costs.ts` — 100%
- `src/utils/materialCalculations.ts` — 100%
- `src/hooks/useProjects.ts` — 100%
- `src/hooks/useWorkTemplates.ts` — 100%

---

## 7. Зависимости

### 7.1 Основные зависимости (клиент)

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

### 7.2 Планируемые зависимости (сервер)

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
    "uuid": "^10.0.0"
  }
}
```

---

## 8. Документация

| Файл | Описание |
|------|----------|
| [TODO.md](./TODO.md) | Актуальные задачи и прогресс |
| [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md) | ТЗ миграции на БД |
| [CODE_REVIEW.md](./CODE_REVIEW.md) | Результаты ревью кода |
| [PROGRESS.md](./PROGRESS.md) | История прогресса |
| [MATERIALS_CATALOG_FEATURE.md](./MATERIALS_CATALOG_FEATURE.md) | Спецификация каталога материалов |
| [REFACTORING_GEOMETRY_BLOCK.md](./REFACTORING_GEOMETRY_BLOCK.md) | ТЗ рефакторинга геометрии |
| [TECHNICAL_SPECS.md](./TECHNICAL_SPECS.md) | Технические спецификации |
| [WORK_TEMPLATES_SPEC.md](./WORK_TEMPLATES_SPEC.md) | Спецификация шаблонов работ |

---

## 9. Дорожная карта

### Выполнено ✅

1. ✅ Декомпозиция App.tsx (2700 → 170 строк)
2. ✅ Рефакторинг геометрии (GeometrySection, useGeometryState)
3. ✅ IStorageProvider абстракция
4. ✅ Каталог материалов и расчёт
5. ✅ Поиск цен через AI (клиентский)
6. ✅ 402 теста

### Планируется 🚧

1. **Фаза 7:** Миграция на БД (15-20 дней) — см. [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md)
   - Сервер на Express + MySQL
   - Аутентификация (JWT)
   - REST API для всех сущностей
   - Offline-first синхронизация
   - PWA

2. **Фаза 8:** AI-интеграция (серверная)
   - Защита API-ключей
   - Rate limiting
   - Кэширование ответов

---

**Последнее обновление:** 2026-03-13