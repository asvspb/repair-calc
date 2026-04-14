# 📋 Техническое задание: Repair Calculator (Мой ремонт)
## SPEC-001-SYSTEM — Полная системная спецификация

**Версия:** 2.0  
**Дата создания:** 2026-04-13  
**Статус:** Актуальное  
**Автор:** AI Code Reviewer  

---

## Содержание

1. [Введение](#1-введение)
2. [Глоссарий](#2-глоссарий)
3. [Общее описание системы](#3-общее-описание-системы)
4. [Стек технологий](#4-стек-технологий)
5. [Архитектура системы](#5-архитектура-системы)
6. [Модель данных](#6-модель-данных)
7. [Функциональные требования](#7-функциональные-требования)
8. [Модуль геометрии](#8-модуль-геометрии)
9. [Модуль работ и материалов](#9-модуль-работ-и-материалов)
10. [Модуль расчёта стоимости](#10-модуль-расчёта-стоимости)
11. [Модуль экспорта и импорта](#11-модуль-экспорта-и-импорта)
12. [AI-интеграция](#12-ai-интеграция)
13. [Backend API](#13-backend-api)
14. [Аутентификация и авторизация](#14-аутентификация-и-авторизация)
15. [Синхронизация данных](#15-синхронизация-данных)
16. [Компоненты UI](#16-компоненты-ui)
17. [Хранилище данных](#17-хранилище-данных)
18. [Тестирование](#18-тестирование)
19. [Инфраструктура и развёртывание](#19-инфраструктура-и-развёртывание)
20. [Ограничения и лицензирование](#20-ограничения-и-лицензирование)
21. [Нефункциональные требования](#21-нефункциональные-требования)
22. [Критерии приёмки](#22-критерии-приёмки)
23. [Известные ограничения и технический долг](#23-известные-ограничения-и-технический-долг)
24. [Связанные документы](#24-связанные-документы)

---

## 1. Введение

### 1.1 Назначение документа

Настоящий документ является полным системным техническим заданием приложения «Мой ремонт» (Repair Calculator). Описывает текущее состояние реализации, все функциональные и нефункциональные требования, модель данных, API и архитектуру.

### 1.2 Область применения

Документ предназначен для:
- Разработчиков (frontend, backend)
- AI-агентов, работающих с кодовой базой
- Тестировщиков
- Технических руководителей

### 1.3 Аббревиатуры

| Аббревиатура | Расшифровка |
|-------------|-------------|
| PWA | Progressive Web Application |
| JWT | JSON Web Token |
| CRUD | Create, Read, Update, Delete |
| AI | Artificial Intelligence |
| DnD | Drag and Drop |
| E2E | End-to-End (тестирование) |
| LOC | Lines of Code |
| FK | Foreign Key |
| PK | Primary Key |

---

## 2. Глоссарий

| Термин | Определение | Пример |
|--------|-------------|--------|
| **Пользователь** | Зарегистрированный пользователь системы | `asv@asv.com` |
| **Проект** | Группа объектов недвижимости | «Мои квартиры», «Дача» |
| **Объект** (Object) | Единица недвижимости в составе проекта | «Квартира на Колумба» |
| **Комната** (Room) | Помещение в составе объекта | «Спальня», «Кухня» |
| **Работа** (Work) | Вид ремонтных работ в комнате | «Заливка стяжки» |
| **Материал** (Material) | Стройматериал, необходимый для работы | «Цемент М500» |
| **Инструмент** (Tool) | Инструмент для выполнения работы | «Перфоратор (аренда)» |
| **Проём** (Opening) | Окно или дверь в стене | Окно 1.5×1.4 м |
| **Секция** (SubSection) | Подсекция комнаты в расширенном режиме | Прямоугольник, трапеция |
| **Сегмент** (Segment) | Прямоугольный участок пола в продвинутом режиме | Ниша, эркер |
| **Препятствие** (Obstacle) | Объект, влияющий на расчёт площади | Колонна, вентшахта |
| **Каталог работ** | Предустановленный набор типовых работ | 19 шаблонов |
| **Шаблон работы** | Сохранённый пользовательский набор работ | «Мой шаблон ванной» |

---

## 3. Общее описание системы

### 3.1 Назначение

Web-приложение для расчёта стоимости ремонтных работ в помещениях. Позволяет пользователю:
- Создавать проекты с несколькими объектами недвижимости
- Задавать геометрию комнат (три режима сложности)
- Выбирать виды работ из каталога или добавлять собственные
- Рассчитывать количество и стоимость материалов
- Получать общую смету по проекту
- Экспортировать данные в CSV/JSON
- Искать актуальные цены через AI

### 3.2 Целевая аудитория

- Владельцы квартир и домов, планирующие ремонт
- Прорабы и бригадиры
- Дизайнеры интерьеров

### 3.3 Иерархия данных

```
Пользователь (User)
└── Проект (Project) — группа объектов
    └── Объект (Object) — единица недвижимости
        └── Комната (Room) — помещение
            ├── Геометрия (Geometry) — размеры, проёмы
            └── Работа (Work) — вид ремонтных работ
                ├── Материал (Material) — стройматериалы
                └── Инструмент (Tool) — инструменты (покупка/аренда)
```

### 3.4 Текущий статус реализации

| Компонент | Статус | Версия |
|-----------|--------|--------|
| Frontend (React 19 + Vite 6) | ✅ Реализован | v4.2 |
| Backend (Express + TypeScript) | ✅ Реализован | v4.0 |
| Database (MySQL 8 + Knex) | ✅ Реализован | v4.0 |
| JWT-аутентификация | ✅ Реализован | v4.0 |
| AI-интеграция (Gemini + Mistral) | ✅ Реализован | v4.0 |
| Объекты (Object model) | ✅ Реализован | v4.0 |
| E2E тесты (Playwright) | 🟡 Частично | v4.2 |
| PWA / Offline-first | ❌ Планируется | — |

---

## 4. Стек технологий

### 4.1 Frontend

| Технология | Версия | Назначение |
|-----------|--------|-----------|
| React | ^19.0.0 | UI-фреймворк |
| TypeScript | ~5.8.2 | Типизация |
| Vite | ^6.2.0 | Сборка и dev-сервер |
| Tailwind CSS | ^4.1.14 | Стилизация |
| Lucide React | ^0.546.0 | Иконки |
| @dnd-kit | ^6.3+ / ^10.0.0 | Drag-and-drop |

### 4.2 Backend

| Технология | Версия | Назначение |
|-----------|--------|-----------|
| Node.js | 18+ | Серверная среда |
| Express | ^4.21.0 | HTTP-фреймворк |
| TypeScript | ~5.8 | Типизация |
| MySQL | 8.x | Реляционная СУБД |
| Knex | ^3.1.0 | Query builder + миграции |
| Zod | ^3.23.0 | Валидация |
| jsonwebtoken | ^9.0.2 | JWT-токены |
| bcryptjs | ^2.4.3 | Хеширование паролей |
| helmet | latest | HTTP Security Headers |

### 4.3 Тестирование

| Технология | Версия | Назначение |
|-----------|--------|-----------|
| Vitest | ^4.0.18 | Unit/Integration тесты |
| @testing-library/react | ^16.3.2 | Тестирование React-компонентов |
| @playwright/test | ^1.58.2 | E2E тесты |
| jsdom | ^26.1.0 | DOM-среда для тестов |

### 4.4 Инфраструктура

| Технология | Назначение |
|-----------|-----------|
| Docker + Docker Compose | Контейнеризация |
| Nginx (в контейнере) | Reverse proxy (план) |

---

## 5. Архитектура системы

### 5.1 Высокоуровневая диаграмма

```
┌──────────────────────────┐
│     React Client         │
│     (port 3993)          │
│                          │
│  ┌────────────────────┐  │      HTTP/REST
│  │  AuthContext        │  │  ←──────────────→  ┌─────────────────────┐
│  │  ProjectContext     │  │                    │  Express Server      │
│  │  WorkTemplateCtx    │  │                    │  (port 3994)         │
│  └────────────────────┘  │                    │                      │
│                          │                    │  ┌─────────────────┐ │
│  ┌────────────────────┐  │                    │  │ Routes          │ │
│  │  ApiStorageProvider │──│───────────────────→│  │ Middleware      │ │
│  │  HttpClient         │  │                    │  │ Services        │ │
│  │  SaveQueue          │  │                    │  │ Repositories    │ │
│  └────────────────────┘  │                    │  └────────┬────────┘ │
│                          │                    │           │          │
│  ┌────────────────────┐  │                    │  ┌────────▼────────┐ │
│  │  localStorage       │  │                    │  │   MySQL DB      │ │
│  │  (offline fallback) │  │                    │  │   (port 3306)   │ │
│  └────────────────────┘  │                    │  └─────────────────┘ │
└──────────────────────────┘                    └─────────────────────┘
```

### 5.2 Структура Frontend

```
src/
├── App.tsx                         # Корневой компонент (470 строк)
├── main.tsx                        # Entry point React
├── index.css                       # Tailwind CSS
│
├── api/                            # API-интеграции
│   ├── httpClient.ts               # HTTP-клиент (408 строк, singleton)
│   ├── projects.ts                 # API проектов (362 строки)
│   ├── totals.ts                   # API итогов
│   ├── users.ts                    # API пользователей
│   ├── storage/
│   │   ├── apiStorageProvider.ts   # Серверная синхронизация (1036 строк)
│   │   └── index.ts
│   └── prices/                     # AI-поиск цен
│       ├── geminiPriceSearch.ts    # Gemini API (314 строк)
│       ├── mistralPriceSearch.ts   # Mistral API (327 строк)
│       ├── unifiedSearch.ts        # Унифицированный поиск
│       ├── priceCache.ts           # Кэш цен
│       └── types.ts
│
├── components/                     # React-компоненты
│   ├── RoomEditor.tsx              # Редактор комнаты (902 строки)
│   ├── BackupManager.tsx           # Экспорт/импорт (837 строк)
│   ├── SummaryView.tsx             # Общая смета
│   │
│   ├── auth/                       # Аутентификация
│   │   ├── LoginPage.tsx
│   │   └── RegisterPage.tsx
│   │
│   ├── geometry/                   # Модуль геометрии (8 файлов)
│   │   ├── GeometrySection.tsx     # Контейнер (296 строк)
│   │   ├── ModeSelector.tsx        # Выбор режима
│   │   ├── SimpleGeometry.tsx      # Простая геометрия
│   │   ├── ExtendedGeometry.tsx    # Расширенная (секции)
│   │   ├── AdvancedGeometry.tsx    # Продвинутая (328 строк)
│   │   ├── SubSectionItem.tsx      # Элемент секции (320 строк)
│   │   ├── OpeningList.tsx         # Окна/двери
│   │   └── GeometryMetrics.tsx     # Метрики площади
│   │
│   ├── layout/                     # Макет приложения
│   │   ├── LeftSidebar.tsx         # Левая панель (комнаты, объекты)
│   │   └── RightSidebar.tsx        # Правая панель (проекты, настройки)
│   │
│   ├── objects/                    # Объекты недвижимости
│   │   ├── CreateObjectModal.tsx
│   │   └── ObjectSettings.tsx
│   │
│   ├── projects/                   # Управление проектами
│   │   ├── ProjectsModal.tsx       # Модалка проектов (698 строк)
│   │   ├── CreateProjectModal.tsx  # Создание проекта (537 строк)
│   │   └── DataManagementModal.tsx # Управление данными (437 строк)
│   │
│   ├── rooms/                      # Список комнат
│   │   ├── RoomList.tsx
│   │   └── RoomListItem.tsx
│   │
│   ├── works/                      # Работы и материалы (10 файлов)
│   │   ├── WorkList.tsx
│   │   ├── WorkListItem.tsx
│   │   ├── WorkCatalogPicker.tsx   # Выбор из каталога (454 строки)
│   │   ├── MaterialCalculationCard.tsx  # Расчёт материалов (300 строк)
│   │   ├── PaintMaterialCard.tsx   # Карточка краски
│   │   ├── TileMaterialCard.tsx    # Карточка плитки (284 строки)
│   │   └── ...
│   │
│   ├── summary/                    # Сводка по проекту
│   │   ├── SummaryMaterials.tsx
│   │   ├── SummaryTools.tsx
│   │   └── SummaryWorks.tsx
│   │
│   └── ui/                         # Базовые UI-компоненты
│       ├── ConfirmDialog.tsx
│       ├── ErrorBoundary.tsx
│       └── NumberInput.tsx
│
├── contexts/                       # React Context (стейт-менеджмент)
│   ├── ProjectContext.tsx          # Состояние проекта (982 строки)
│   ├── WorkTemplateContext.tsx     # Шаблоны работ
│   └── AuthContext.tsx             # Аутентификация (280 строк)
│
├── data/                           # Статические данные
│   ├── initialData.ts              # Демонстрационный проект (381 строка)
│   └── workTemplatesCatalog.ts     # Каталог типовых работ (1048 строк, 19 шаблонов)
│
├── hooks/                          # Кастомные React-хуки
│   ├── useGeometryState.ts         # Состояние геометрии (597 строк)
│   ├── useMaterialCalculation.ts   # Расчёт материалов
│   ├── useProjects.ts              # Хук проектов
│   └── useWorkTemplates.ts         # Хук шаблонов
│
├── types/                          # TypeScript типы
│   ├── index.ts                    # Основные типы (214 строк)
│   ├── storage.ts                  # IStorageProvider
│   └── workTemplate.ts            # Шаблоны работ
│
└── utils/                          # Утилиты
    ├── costs.ts                    # Расчёт стоимости
    ├── debugLogger.ts              # Debug-логирование
    ├── factories.ts                # Фабрики сущностей
    ├── format.ts                   # Форматирование
    ├── geometry.ts                 # Геометрические расчёты
    ├── idMapper.ts                 # ID mapping (local ↔ server)
    ├── localStorageProvider.ts     # localStorage провайдер
    ├── logger.ts                   # Логирование (280 строк)
    ├── materialCalculations.ts     # Формулы материалов (416 строк)
    ├── migration.ts                # Миграция данных (v1→v2)
    ├── projectContextPatch.ts      # Патч для контекста
    ├── projectObjects.ts           # Утилиты для Objects (380 строк, pure functions)
    ├── roomHelpers.ts              # Хелперы комнат (814 строк)
    ├── saveQueue.ts                # Персистентная очередь сохранений
    ├── storage.ts                  # StorageManager (281 строка)
    └── templateStorage.ts          # Хранилище шаблонов
```

### 5.3 Структура Backend

```
server/
├── src/
│   ├── app.ts                      # Express приложение
│   ├── index.ts                    # Entry point
│   │
│   ├── config/                     # Конфигурация
│   │   └── env.ts                  # Переменные окружения
│   │
│   ├── routes/                     # API маршруты
│   │   ├── auth.ts                 # Аутентификация
│   │   ├── projects.ts             # CRUD проектов (385 строк)
│   │   ├── rooms.ts                # CRUD комнат
│   │   ├── works.ts                # CRUD работ
│   │   ├── objects.ts              # CRUD объектов
│   │   ├── geometry.ts             # Геометрия (636 строк, 25+ endpoints)
│   │   ├── sync.ts                 # Синхронизация (311 строк)
│   │   ├── ai.ts                   # AI endpoints (463 строки)
│   │   └── update.ts               # Обновление цен (2184 строки)
│   │
│   ├── middleware/                  # Middleware
│   │   ├── auth.ts                 # JWT аутентификация
│   │   ├── rateLimiter.ts          # Rate limiting
│   │   ├── errorHandler.ts         # Обработка ошибок (ZodError, AppError, MySQL, JWT)
│   │   └── validation.ts           # Zod-валидация
│   │
│   ├── services/                   # Бизнес-логика
│   │   ├── ai/                     # AI-провайдеры
│   │   │   ├── geminiProvider.ts   # Gemini (585 строк)
│   │   │   └── mistralProvider.ts  # Mistral (586 строк)
│   │   ├── update/                 # Сервис обновления цен
│   │   │   ├── runner.ts           # Оркестрация (647 строк)
│   │   │   ├── parserManager.ts    # Менеджер парсеров (661 строка)
│   │   │   └── parsers/            # Парсеры (Bazavit, Lemana, web scraper)
│   │   └── webhook.service.ts      # Вебхуки
│   │
│   ├── db/
│   │   ├── pool.ts                 # MySQL connection pool
│   │   ├── migrations/             # Knex миграции (6+)
│   │   └── repositories/           # Data Access Layer (11 репозиториев)
│   │       ├── project.repo.ts     # Проекты (666 строк)
│   │       ├── room.repo.ts        # Комнаты (700 строк)
│   │       ├── updateJob.repo.ts   # Задачи обновления (772 строки)
│   │       ├── abTest.repo.ts      # A/B тесты (641 строка)
│   │       ├── priceCatalog.repo.ts # Каталог цен (483 строки)
│   │       └── ...
│   │
│   └── types/                      # TypeScript типы
│       └── index.ts
│
├── tests/                          # Тесты бэкенда
├── knexfile.ts                     # Конфигурация Knex
├── package.json
└── tsconfig.json
```

---

## 6. Модель данных

### 6.1 Диаграмма сущностей (ER)

```
┌──────────┐     1:N     ┌──────────┐     1:N     ┌──────────┐
│  users   │────────────→│ projects │────────────→│ objects  │
│          │             │          │             │          │
│ id (PK)  │             │ id (PK)  │             │ id (PK)  │
│ email    │             │ user_id  │             │project_id│
│ password │             │ name     │             │ user_id  │
│is_premium│             │ descr.   │             │ name     │
└──────────┘             └──────────┘             │ city     │
                                                  │ address  │
                                                  └────┬─────┘
                                                       │ 1:N
                                                  ┌────▼─────┐
                                                  │  rooms   │
                                                  │          │
                                                  │ id (PK)  │
                                                  │object_id │
                                                  │ name     │
                                                  │ geometry │
                                                  └────┬─────┘
                                                       │ 1:N
                                                  ┌────▼─────┐
                                                  │  works   │
                                                  │          │
                                                  │ id (PK)  │
                                                  │ room_id  │
                                                  │ name     │
                                                  └──┬───┬───┘
                                                     │   │
                                              1:N    │   │  1:N
                                          ┌──────────┘   └──────────┐
                                     ┌────▼─────┐             ┌────▼─────┐
                                     │materials │             │  tools   │
                                     │          │             │          │
                                     │ id (PK)  │             │ id (PK)  │
                                     │ work_id  │             │ work_id  │
                                     │ name     │             │ name     │
                                     │ quantity │             │ price    │
                                     │pricePerU │             │ isRent   │
                                     └──────────┘             └──────────┘
```

### 6.2 TypeScript типы (Frontend)

#### 6.2.1 ProjectData

```typescript
type ProjectData = {
  id: string;
  name: string;
  description?: string;
  isPremium?: boolean;
  objects: ObjectData[];          // Массив объектов недвижимости
  city?: string;                 // Deprecated → ObjectData.city
  useAiPricing?: boolean;        // Deprecated → ObjectData.useAiPricing
  lastAiPriceUpdate?: string;    // Deprecated
  version?: number;              // Оптимистичная блокировка
  rooms?: RoomData[];            // Deprecated → objects[0].rooms
};
```

#### 6.2.2 ObjectData

```typescript
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
```

#### 6.2.3 RoomData

```typescript
type RoomData = {
  id: string;
  name: string;
  geometryMode: 'simple' | 'extended' | 'advanced';
  // Базовые размеры
  length: number;
  width: number;
  height: number;
  // Проёмы
  windows: Opening[];
  doors: Opening[];
  // Работы
  works: WorkData[];
  // Расширенный режим
  subSections: RoomSubSection[];
  // Продвинутый режим
  segments: RoomSegment[];
  obstacles: Obstacle[];
  wallSections: WallSection[];
  // Данные по режимам (для переключения)
  simpleModeData?: SimpleModeData;
  extendedModeData?: ExtendedModeData;
  advancedModeData?: AdvancedModeData;
};
```

#### 6.2.4 WorkData

```typescript
type WorkData = {
  id: string;
  name: string;
  unit: string;                    // «м²», «п.м.», «шт.»
  enabled: boolean;
  workUnitPrice: number;           // Цена за единицу работы
  materials?: Material[];          // Материалы
  tools?: Tool[];                  // Инструменты
  calculationType: CalculationType; // floorArea | netWallArea | skirtingLength | customCount
  isCustom?: boolean;              // Пользовательская работа
  useManualQty?: boolean;          // Ручной ввод количества
  manualQty?: number;
};
```

#### 6.2.5 Material

```typescript
type Material = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  // Параметры авторасчёта
  coveragePerUnit?: number;      // м² в упаковке/рулоне
  consumptionRate?: number;       // расход на м²
  layers?: number;                // слои (для краски)
  piecesPerUnit?: number;         // шт. в упаковке
  wastePercent?: number;          // запас на подрезку %
  packageSize?: number;           // размер упаковки
  isPerimeter?: boolean;          // расчёт по периметру
  multiplier?: number;            // множитель
  calculatedQty?: number;         // вычисленное количество
  autoCalcEnabled?: boolean;      // авторасчёт включён
};
```

#### 6.2.6 Tool

```typescript
type Tool = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  isRent: boolean;                 // Аренда или покупка
  rentPeriod?: number;             // Период аренды (дни)
};
```

#### 6.2.7 Opening

```typescript
type Opening = {
  id: string;
  width: number;
  height: number;
  comment?: string;
};
```

#### 6.2.8 Вычисляемые типы

```typescript
type RoomMetrics = {
  floorArea: number;               // Площадь пола (м²)
  perimeter: number;               // Периметр (м)
  grossWallArea: number;           // Полная площадь стен (м²)
  windowsArea: number;             // Площадь окон (м²)
  doorsArea: number;               // Площадь дверей (м²)
  netWallArea: number;             // Чистая площадь стен (м²)
  skirtingLength: number;          // Длина плинтуса (м)
  volume: number;                  // Объём помещения (м³)
};

type RoomCosts = {
  costs: Record<string, WorkCosts>;
  totalWork: number;
  totalMaterial: number;
  totalTools: number;
  total: number;
};
```

### 6.3 Геометрические формы (Extended mode)

```typescript
type SectionShape = 'rectangle' | 'trapezoid' | 'triangle' | 'parallelogram';

type RoomSubSection = {
  id: string;
  name: string;
  shape: SectionShape;
  // Rectangle
  length: number;
  width: number;
  // Trapezoid
  base1?: number;
  base2?: number;
  depth?: number;
  side1?: number;
  side2?: number;
  // Triangle
  sideA?: number;
  sideB?: number;
  sideC?: number;
  // Parallelogram
  base?: number;
  side?: number;
  // Проёмы
  windows: Opening[];
  doors: Opening[];
};
```

---

## 7. Функциональные требования

### 7.1 Управление проектами

| ID | Требование | Статус |
|----|-----------|--------|
| FR-001 | Создание проекта с названием и городом | ✅ |
| FR-002 | Создание проекта с несколькими объектами | ✅ |
| FR-003 | Переименование проекта | ✅ |
| FR-004 | Удаление проекта (с подтверждением) | ✅ |
| FR-005 | Копирование проекта | ✅ |
| FR-006 | Переключение между проектами | ✅ |
| FR-007 | Автосохранение (debounce 2 сек) | ✅ |

### 7.2 Управление объектами

| ID | Требование | Статус |
|----|-----------|--------|
| FR-010 | Создание объекта в проекте | ✅ |
| FR-011 | Редактирование объекта (название, город, адрес) | ✅ |
| FR-012 | Удаление объекта | ✅ |
| FR-013 | Копирование объекта | ✅ |
| FR-014 | Переключение между объектами | ✅ |

### 7.3 Управление комнатами

| ID | Требование | Статус |
|----|-----------|--------|
| FR-020 | Создание комнаты с названием | ✅ |
| FR-021 | Удаление комнаты (с подтверждением) | ✅ |
| FR-022 | Переключение между комнатами через sidebar | ✅ |
| FR-023 | Drag-and-drop переупорядочивание комнат | ✅ |

### 7.4 Геометрия комнат

| ID | Требование | Статус |
|----|-----------|--------|
| FR-030 | Простая геометрия (длина × ширина × высота) | ✅ |
| FR-031 | Расширенная геометрия (секции разных форм) | ✅ |
| FR-032 | Продвинутая геометрия (сегменты, препятствия) | ✅ |
| FR-033 | Добавление окон и дверей c размерами | ✅ |
| FR-034 | Автоматический расчёт метрик (площадь, периметр, объём) | ✅ |
| FR-035 | Переключение режима с сохранением данных предыдущего | ✅ |

### 7.5 Работы и материалы

| ID | Требование | Статус |
|----|-----------|--------|
| FR-040 | Выбор работ из каталога (19 шаблонов) | ✅ |
| FR-041 | Добавление пользовательской работы | ✅ |
| FR-042 | Включение/выключение работ | ✅ |
| FR-043 | Ручной ввод цены за единицу работы | ✅ |
| FR-044 | Автоматический расчёт количества по геометрии | ✅ |
| FR-045 | Ручной ввод количества (override) | ✅ |
| FR-046 | Добавление материалов к работе | ✅ |
| FR-047 | Авторасчёт количества материалов | ✅ |
| FR-048 | Добавление инструментов (покупка/аренда) | ✅ |
| FR-049 | Сохранение и загрузка шаблонов работ | ✅ |

### 7.6 Смета и отчёты

| ID | Требование | Статус |
|----|-----------|--------|
| FR-050 | Сводная смета по проекту | ✅ |
| FR-051 | Группировка итогов по объектам | ✅ |
| FR-052 | Детализация по комнатам | ✅ |
| FR-053 | Отображение итогов: работы / материалы / инструменты | ✅ |

### 7.7 Экспорт / Импорт

| ID | Требование | Статус |
|----|-----------|--------|
| FR-060 | Экспорт проекта в JSON | ✅ |
| FR-061 | Импорт проекта из JSON | ✅ |
| FR-062 | Экспорт сметы в CSV | ✅ |
| FR-063 | Импорт/экспорт шаблонов работ | ✅ |

### 7.8 AI-интеграция

| ID | Требование | Статус |
|----|-----------|--------|
| FR-070 | Поиск цен через Gemini API | ✅ |
| FR-071 | Fallback на Mistral API | ✅ |
| FR-072 | Кэширование результатов AI-поиска | ✅ |
| FR-073 | Поиск цен с учётом города | ✅ |

### 7.9 Аутентификация

| ID | Требование | Статус |
|----|-----------|--------|
| FR-080 | Регистрация по email + пароль | ✅ |
| FR-081 | Вход по email + пароль (JWT) | ✅ |
| FR-082 | Auto-refresh token при 401 | ✅ |
| FR-083 | Выход из системы | ✅ |
| FR-084 | E2E-тесты: bypass аутентификации через `e2e-test-mode` | ✅ |

---

## 8. Модуль геометрии

### 8.1 Режимы геометрии

| Режим | Описание | Входные данные | Компонент |
|-------|----------|---------------|-----------|
| **Simple** | Одна прямоугольная комната | `length`, `width`, `height`, openings | `SimpleGeometry.tsx` |
| **Extended** | Комната из нескольких секций разных форм | `subSections[]` (rectangle/trapezoid/triangle/parallelogram) | `ExtendedGeometry.tsx` |
| **Advanced** | Профессиональный режим | `segments[]`, `obstacles[]`, `wallSections[]` | `AdvancedGeometry.tsx` |

### 8.2 Расчёт метрик (`src/utils/geometry.ts`)

| Метрика | Формула (Simple mode) |
|---------|----------------------|
| `floorArea` | `length × width` |
| `perimeter` | `2 × (length + width)` |
| `grossWallArea` | `perimeter × height` |
| `windowsArea` | `Σ(window.width × window.height)` |
| `doorsArea` | `Σ(door.width × door.height)` |
| `netWallArea` | `grossWallArea - windowsArea - doorsArea` |
| `skirtingLength` | `perimeter - Σ(door.width)` |
| `volume` | `floorArea × height` |

### 8.3 Формы секций (Extended mode)

| Форма | Площадь пола | Периметр |
|-------|-------------|----------|
| Rectangle | `length × width` | `2 × (length + width)` |
| Trapezoid | `(base1 + base2) / 2 × depth` | `base1 + base2 + side1 + side2` |
| Triangle | Формула Герона | `sideA + sideB + sideC` |
| Parallelogram | `base × depth` | `2 × (base + side)` |

### 8.4 Переключение режимов

При переключении режима:
1. Текущие данные сохраняются в `simpleModeData` / `extendedModeData` / `advancedModeData`
2. Данные нового режима загружаются (если были сохранены ранее)
3. Если данных нет — создаются значения по умолчанию

---

## 9. Модуль работ и материалов

### 9.1 Каталог типовых работ

Файл: `src/data/workTemplatesCatalog.ts` — 19 шаблонов работ:

| # | Работа | Тип расчёта | Единица |
|---|--------|-------------|---------|
| 1 | Заливка стяжки | floorArea | м² |
| 2 | Наливной пол | floorArea | м² |
| 3 | Укладка ламината | floorArea | м² |
| 4 | Укладка плитки (пол) | floorArea | м² |
| 5 | Выравнивание стен (штукатурка) | netWallArea | м² |
| 6 | Шпаклёвка стен | netWallArea | м² |
| 7 | Поклейка обоев | netWallArea | м² |
| 8 | Покраска стен | netWallArea | м² |
| 9 | Укладка плитки (стены) | netWallArea | м² |
| 10 | Установка плинтусов | skirtingLength | п.м. |
| 11 | Монтаж натяжного потолка | floorArea | м² |
| 12 | Покраска потолка | floorArea | м² |
| 13 | Электромонтаж (точки) | customCount | шт. |
| 14 | Сантехника (точки) | customCount | шт. |
| 15 | Установка дверей | customCount | шт. |
| 16 | Установка окон | customCount | шт. |
| 17 | Демонтажные работы | floorArea | м² |
| 18 | Вывоз мусора | floorArea | м² |
| 19 | Прочие работы | customCount | шт. |

### 9.2 Типы расчёта количества

| Тип | Описание | Примеры работ |
|-----|----------|--------------|
| `floorArea` | По площади пола | Стяжка, ламинат, потолок |
| `netWallArea` | По чистой площади стен (минус проёмы) | Обои, штукатурка, покраска |
| `skirtingLength` | По периметру минус двери | Плинтусы |
| `customCount` | Ручной ввод количества | Электрика, сантехника, двери |

### 9.3 Авторасчёт материалов (`src/utils/materialCalculations.ts`)

Параметры авторасчёта:

| Параметр | Описание | Пример |
|----------|----------|--------|
| `coveragePerUnit` | Покрытие одной упаковки (м²) | 2.18 м² (ламинат) |
| `consumptionRate` | Расход на м² | 0.15 кг/м² (краска) |
| `layers` | Количество слоёв | 2 |
| `wastePercent` | Запас на подрезку | 10% |
| `packageSize` | Размер упаковки | 25 кг |

**Формула общего случая:**

```
baseQuantity = area × consumptionRate × layers
withWaste = baseQuantity × (1 + wastePercent / 100)
packages = ceil(withWaste / packageSize)
```

---

## 10. Модуль расчёта стоимости

### 10.1 Расчёт стоимости (`src/utils/costs.ts`)

```
Стоимость работы = количество × workUnitPrice
Стоимость материалов = Σ(material.quantity × material.pricePerUnit)
Стоимость инструментов = Σ(tool.quantity × tool.price × (tool.isRent ? tool.rentPeriod : 1))

Итого по комнате = Σ(работа + материалы + инструменты) [для enabled работ]
Итого по объекту = Σ(итого по комнатам)
Итого по проекту = Σ(итого по объектам)
```

---

## 11. Модуль экспорта и импорта

### 11.1 JSON формат (v2.0)

```json
{
  "version": "2.0",
  "exportedAt": "2026-04-13T12:00:00Z",
  "project": {
    "id": "uuid",
    "name": "Мои квартиры",
    "objects": [
      {
        "id": "uuid",
        "name": "Квартира на Колумба",
        "city": "Волгоград",
        "rooms": [
          {
            "id": "uuid",
            "name": "Спальня",
            "geometryMode": "simple",
            "length": 4.0,
            "width": 3.5,
            "height": 2.6,
            "windows": [{ "id": "uuid", "width": 1.5, "height": 1.4 }],
            "doors": [{ "id": "uuid", "width": 0.9, "height": 2.1 }],
            "works": [...]
          }
        ]
      }
    ]
  }
}
```

### 11.2 CSV формат (смета)

```csv
Комната;Работа;Количество;Единица;Цена за ед.;Стоимость работы;Стоимость материалов;Итого
Спальня;Заливка стяжки;14.00;м²;800;11200;5600;16800
Спальня;Покраска стен;24.50;м²;350;8575;2100;10675
```

### 11.3 Обратная совместимость

Поддерживается импорт формата v1.0 (без `objects`). Автоматическая конвертация v1→v2 через `convertV1ToV2()`.

---

## 12. AI-интеграция

### 12.1 Архитектура

```
Frontend:                              Backend:
┌─────────────┐                   ┌─────────────────┐
│ unifiedSearch│ ───────────────→ │ POST /api/ai/*   │
│   ↓ fallback │                   │                   │
│ geminiSearch │                   │ geminiProvider.ts │
│   ↓ fallback │                   │ mistralProvider.ts│
│ mistralSearch│                   │                   │
└─────────────┘                   │ ┌───────────────┐ │
       ↓                           │ │  priceParser   │ │
┌─────────────┐                   │ │  webScraper    │ │
│  priceCache  │                   │ │  bazavitParser │ │
│ (localStorage)│                  │ │  lemanaParser  │ │
└─────────────┘                   │ └───────────────┘ │
                                   └─────────────────┘
```

### 12.2 Провайдеры

| Провайдер | Endpoint | Размер файла | Описание |
|-----------|----------|-------------|----------|
| Gemini | Gemini API | 585 строк | Промптированный поиск цен |
| Mistral | Mistral API | 586 строк | Fallback-провайдер |
| Web Scraper | Bazavit, Lemana | ~700 строк | Парсинг цен с сайтов |

---

## 13. Backend API

### 13.1 Эндпоинты

#### Аутентификация

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход (JWT) |
| POST | `/api/auth/refresh` | Обновление токена |
| GET | `/api/users/me` | Текущий пользователь |

#### Проекты

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/projects` | Список проектов пользователя |
| POST | `/api/projects` | Создать проект |
| GET | `/api/projects/:id` | Получить проект с объектами |
| PUT | `/api/projects/:id` | Обновить проект |
| DELETE | `/api/projects/:id` | Удалить проект |

#### Объекты

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/projects/:projectId/objects` | Создать объект |
| GET | `/api/objects/:id` | Получить объект |
| PUT | `/api/objects/:id` | Обновить объект |
| DELETE | `/api/objects/:id` | Удалить объект |

#### Комнаты

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/rooms/:id` | Получить комнату |
| PUT | `/api/rooms/:id` | Обновить комнату |
| DELETE | `/api/rooms/:id` | Удалить комнату |

#### Геометрия (25+ endpoints)

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/rooms/:id/openings` | Добавить проём |
| PUT | `/api/openings/:id` | Обновить проём |
| DELETE | `/api/openings/:id` | Удалить проём |
| POST | `/api/rooms/:id/subsections` | Добавить секцию |
| POST | `/api/rooms/:id/segments` | Добавить сегмент |
| ... | ... | ... |

#### Синхронизация

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/sync/pull?since=timestamp` | Получить изменения |
| POST | `/api/sync/push` | Отправить изменения |

#### AI

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/ai/estimate` | Оценка стоимости |
| POST | `/api/ai/suggest-materials` | Предложить материалы |

---

## 14. Аутентификация и авторизация

### 14.1 Flow

```
1. Регистрация: POST /api/auth/register → JWT (access + refresh)
2. Вход: POST /api/auth/login → JWT (access + refresh)
3. Запросы: Authorization: Bearer {access_token}
4. Истечение: 401 → автоматический refresh → повтор запроса
5. Выход: очистка токенов из localStorage
```

### 14.2 AuthContext

```typescript
interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: { id: string; email: string } | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
}
```

### 14.3 HttpClient

- Singleton с request/response interceptors
- Автоматическая инъекция JWT в заголовки
- Auto-retry при 401 (refresh token)
- AbortController timeout
- Exponential backoff при 429

---

## 15. Синхронизация данных

### 15.1 Стратегия

```
React State → localStorage (немедленно, debounce 2s)
                    ↓ (async, при наличии auth)
              Server API → MySQL
```

### 15.2 SaveQueue

Персистентная очередь сохранений:
- Сохраняет pending данные в localStorage
- Восстанавливает при перезагрузке
- Обрабатывает ошибки с retry
- `beforeunload` — экстренное сохранение

### 15.3 IdMapper

Маппинг локальных ID на серверные:
- `local-123` → `uuid-from-server`
- Персистентный в localStorage с TTL
- Device ID для идентификации клиента

### 15.4 Инкрементальное сохранение (v4.2)

При изменении одного проекта:
1. Сравнивает JSON сериализацию текущего и нового проекта
2. Если изменился только 1 проект — сохраняет только его (`saveProject`)
3. При множественных изменениях — полное сохранение (`saveProjects`)

---

## 16. Компоненты UI

### 16.1 Макет приложения

```
┌───────────────────────────────────────────────────────┐
│                     Header                             │
│   [Проект] > [Объект] > [Комната]                     │
├────────────┬──────────────────────────┬────────────────┤
│            │                          │                │
│  Левая     │    Основной контент      │    Правая      │
│  панель    │                          │    панель      │
│            │  ┌──────────────────┐    │                │
│  • Объекты │  │  SummaryView     │    │  • Проекты    │
│  • Комнаты │  │  или             │    │  • Настройки  │
│  • + Комн. │  │  RoomEditor      │    │  • Синхрон.   │
│            │  └──────────────────┘    │                │
│            │                          │                │
└────────────┴──────────────────────────┴────────────────┘
```

### 16.2 Адаптивность

- **Desktop:** трёхколоночный макет (sidebar + content + sidebar)
- **Mobile:** однокомпонентный с бургер-меню (LeftSidebar / RightSidebar)

### 16.3 Ключевые компоненты

| Компонент | Назначение | Размер |
|-----------|-----------|--------|
| `App.tsx` | Корневой компонент с роутингом auth | 470 строк |
| `RoomEditor.tsx` | Редактор комнаты (геометрия + работы + материалы) | 902 строки |
| `SummaryView.tsx` | Сводная смета по проекту | ~300 строк |
| `LeftSidebar.tsx` | Навигация (объекты, комнаты) | ~250 строк |
| `RightSidebar.tsx` | Управление (проекты, настройки, сохранение) | ~300 строк |
| `GeometrySection.tsx` | Контейнер геометрии с выбором режима | 296 строк |
| `WorkCatalogPicker.tsx` | Выбор работ из каталога | 454 строки |
| `NumberInput.tsx` | Числовой ввод с валидацией | ~100 строк |

---

## 17. Хранилище данных

### 17.1 localStorage

**Ключи:**
| Ключ | Описание |
|------|----------|
| `repair-calc-projects` | Массив проектов |
| `repair-calc-active-project` | ID активного проекта |
| `repair-calc-templates` | Шаблоны работ |
| `repair-calc-id-mappings` | Маппинг ID |
| `repair-calc-save-queue` | Очередь сохранений |
| `token` | JWT access token |
| `refreshToken` | JWT refresh token |

### 17.2 MySQL (серверная)

**Таблицы:** `users`, `projects`, `objects`, `rooms`, `works`, `materials`, `tools`, `openings`, `room_subsections`, `room_segments`, `room_obstacles`, `wall_sections`, `calculated_totals`, `ai_requests`, `deleted_entities`

**Миграции:** 6+ Knex-миграций

### 17.3 IStorageProvider (интерфейс)

```typescript
interface IStorageProvider {
  get<T>(key: string): T | null;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  clear(): void;
  getStorageInfo(): { used: number; total: number; percentage: number };
}
```

Реализации: `LocalStorageProvider`, `ApiStorageProvider`.

---

## 18. Тестирование

### 18.1 Статистика

| Категория | Количество | Фреймворк |
|-----------|-----------|-----------|
| Unit тесты (utils) | ~220 | Vitest |
| Unit тесты (hooks) | ~72 | Vitest + RTL |
| Unit тесты (компоненты) | ~150 | Vitest + RTL |
| Integration тесты | ~7 | Vitest |
| API тесты | ~22 | Vitest |
| E2E тесты | 52 (16 стабильных) | Playwright |
| Тесты бэкенда | ~50 | Vitest |
| **Итого** | **~841** | — |

### 18.2 Покрытие файлов

**100% покрытие:**
- `utils/geometry.ts`
- `utils/costs.ts`
- `utils/materialCalculations.ts`
- `hooks/useProjects.ts`
- `hooks/useWorkTemplates.ts`

**Нет тестов (критические пробелы):**
- `ProjectContext.tsx` (982 строки)
- `RoomEditor.tsx` (902 строки)
- `BackupManager.tsx` (837 строк)
- `httpClient.ts` (408 строк)

### 18.3 Команды

```bash
npm test              # Vitest unit/integration
npm run test:e2e      # Playwright E2E
npm run lint          # TypeScript type check (tsc --noEmit)
```

### 18.4 E2E конфигурация

- **Браузеры:** Chromium, Firefox, Mobile (Pixel 5)
- **Base URL:** `http://localhost:3993`
- **Тестовый режим:** `localStorage.setItem('e2e-test-mode', 'true')` — bypass auth
- **Data-testid:** добавлены во все ключевые UI-элементы

---

## 19. Инфраструктура и развёртывание

### 19.1 Docker

```yaml
# docker-compose.yml
services:
  frontend:
    build: .
    ports: ["3993:3993"]

  backend:
    build: ./server
    ports: ["3994:3994"]
    depends_on: [mysql]

  mysql:
    image: mysql:8
    ports: ["3306:3306"]
    environment:
      MYSQL_DATABASE: repair_calc
      MYSQL_ROOT_PASSWORD: ...
```

### 19.2 Переменные окружения

**Frontend (.env.local):**
```
VITE_GEMINI_API_KEY=your_key
VITE_API_BASE_URL=http://localhost:3994
```

**Backend (server/.env):**
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=...
DB_NAME=repair_calc
JWT_SECRET=your_secret       # Обязателен в production!
JWT_REFRESH_SECRET=your_secret
PORT=3994
```

### 19.3 Порты

| Сервис | Порт |
|--------|------|
| Frontend (Vite) | 3993 |
| Backend (Express) | 3994 |
| MySQL | 3306 |

---

## 20. Ограничения и лицензирование

### 20.1 Бесплатная версия

| Параметр | Ограничение |
|----------|-------------|
| Проектов | Неограниченно |
| Объектов в проекте | 10 |
| Комнат в объекте | Неограниченно |
| Экспорт | JSON, CSV |
| AI-поиск цен | Ограничен |

### 20.2 Премиум версия (планируется)

| Параметр | Ограничение |
|----------|-------------|
| Объектов в проекте | Неограниченно |
| Экспорт | JSON, CSV, Excel |
| AI-поиск цен | Без ограничений |

---

## 21. Нефункциональные требования

| ID | Требование | Значение | Статус |
|----|-----------|----------|--------|
| NFR-001 | Время отклика UI | < 100ms | ✅ |
| NFR-002 | Время ответа API | < 200ms | ✅ |
| NFR-003 | Автосохранение | Debounce 2 сек | ✅ |
| NFR-004 | Поддержка mobile | Responsive (Tailwind) | ✅ |
| NFR-005 | TypeScript strict mode | 0 `any` в production | ✅ |
| NFR-006 | Error boundary | Защита от крашей | ✅ |
| NFR-007 | HTTP Security | helmet, CORS | ✅ |
| NFR-008 | Offline-first | localStorage fallback | 🟡 Частично |
| NFR-009 | PWA | Service Worker | ❌ Планируется |
| NFR-010 | i18n | Только русский | 🟡 |

---

## 22. Критерии приёмки

### 22.1 Функциональные

- [x] CRUD проектов/объектов/комнат
- [x] Три режима геометрии работают корректно
- [x] Расчёт количества и стоимости
- [x] Экспорт/Импорт JSON и CSV
- [x] AI-поиск цен (Gemini + Mistral fallback)
- [x] Серверная синхронизация
- [x] JWT-аутентификация
- [ ] >80% E2E тестов проходят стабильно

### 22.2 Нефункциональные

- [x] 0 ошибок TypeScript (`tsc --noEmit`)
- [x] 0 `any` в production коде
- [x] 841 тест, 0 failing
- [x] Инкрементальное сохранение
- [ ] >70% покрытие тестами

---

## 23. Известные ограничения и технический долг

### 23.1 Архитектурный долг

| Проблема | Файл | Серьёзность | Описание |
|----------|------|-------------|----------|
| God Module | `ProjectContext.tsx` (982 строки) | 🔴 Высокая | 7+ ответственностей |
| God Module | `apiStorageProvider.ts` (1036 строк) | 🔴 Высокая | CRUD + sync + retry |
| God Component | `RoomEditor.tsx` (902 строки) | 🔴 Высокая | Нет декомпозиции |
| God File | `routes/update.ts` (2184 строки) | 🔴 Высокая | Маршруты + бизнес-логика |
| God Component | `BackupManager.tsx` (837 строк) | 🟡 Средняя | Export + Import + Sync |
| Stale closures | `ProjectContext.tsx` | 🟡 Средняя | `deleteRoom`, `addRoom`, `reorderRooms` |
| Дублирование ID | 4+ мест | 🟡 Средняя | Нет единой утилиты |
| Console.* | 64 вызова / 14 файлов | 🟡 Средняя | Есть logger, но не используется |
| Magic strings | localStorage keys | 🟡 Низкая | Не все используют STORAGE_KEYS |

### 23.2 Документация

| Проблема | Описание |
|----------|----------|
| `ARCHITECTURE.md` устарел | Сервер описан как «планируется», хотя реализован |
| `INDEX.md` устарел | Количество тестов, структура не актуальны |
| Нет API-документации | Swagger/OpenAPI отсутствует |

### 23.3 Тестирование

| Проблема | Описание |
|----------|----------|
| E2E нестабильны | 50/52 падают из-за устаревших селекторов |
| Нет тестов критических модулей | ProjectContext, RoomEditor, httpClient |
| Vitest требует Node.js 18+ | Текущая версия Node может быть несовместима |

---

## 24. Связанные документы

| Документ | Описание |
|----------|----------|
| [INDEX.md](../INDEX.md) | Индекс приложения |
| [TODO.md](../TODO.md) | Рабочий бэклог |
| [CODE_REVIEW.md](../CODE_REVIEW.md) | Код-ревью v5.0 |
| [ARCHITECTURE.md](../ARCHITECTURE.md) | Архитектура (требует обновления) |
| [PROGRESS.md](../PROGRESS.md) | Прогресс разработки |
| [TECHNICAL-SPECIFICATION.md](../TECHNICAL-SPECIFICATION.md) | ТЗ v1.1 — группировка объектов |
| [LOGGING.md](../LOGGING.md) | Спецификация логирования |

---

**Конец документа**

**Версия:** 2.0  
**Дата:** 2026-04-13  
**Строк кода (production):** ~40,850  
**Тестов:** 841
