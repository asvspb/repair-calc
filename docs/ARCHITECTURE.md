# Архитектурный план: Repair Calculator — Server + AI + PWA

**Дата:** 2026-03-01
**Обновлено:** 2026-03-04
**Статус:** Планирование (Код-ревью завершён)
**Контекст:** Ответы на вопросы из [CODE_REVIEW.md](./CODE_REVIEW.md)

| Вопрос | Ответ | Влияние на архитектуру |
|---|---|---|
| Серверная часть | MySQL + Gemini + Mistral | Express backend, REST API, абстрактный AI-провайдер |
| Целевая аудитория | Внутренний инструмент | Упрощённая авторизация, "last write wins" для конфликтов |
| Масштабирование | Не планируется | Без Redis/очередей, один сервер, простой пул MySQL |
| `motion` (framer-motion) | Не нужен | Удалить из dependencies |
| PWA/Offline | Нужен | vite-plugin-pwa, offline-first с sync |

---

## Содержание

1. [Схема базы данных MySQL](#1-схема-базы-данных-mysql)
2. [Серверная архитектура](#2-серверная-архитектура)
3. [AI-интеграция (Gemini + Mistral)](#3-ai-интеграция-gemini--mistral)
4. [PWA / Offline-first архитектура](#4-pwa--offline-first-архитектура)
5. [Дорожная карта реализации](#5-дорожная-карта-реализации)
6. [Зависимости: что удалить / добавить / оставить](#6-зависимости)

---

## 1. Схема базы данных MySQL

### ER-диаграмма (текстовая)

```
projects 1──∞ rooms 1──∞ works 1──∞ materials
                │          └──∞ tools
                │
                ├──∞ openings (windows/doors)
                │     └── FK subsection_id (nullable)
                │
                ├──∞ room_subsections (extended mode)
                │
                ├──∞ room_segments (advanced mode)
                ├──∞ room_obstacles (advanced mode)
                └──∞ wall_sections (advanced mode)

ai_requests (лог AI-запросов, FK → projects)
```

### SQL-схема

```sql
-- ═══════════════════════════════════════════════════════
-- ПРОЕКТЫ
-- ═══════════════════════════════════════════════════════
CREATE TABLE projects (
  id          VARCHAR(36) PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════
-- КОМНАТЫ
-- height — общий для всех режимов
-- length/width — для simple + advanced режимов
-- ═══════════════════════════════════════════════════════
CREATE TABLE rooms (
  id             VARCHAR(36) PRIMARY KEY,
  project_id     VARCHAR(36) NOT NULL,
  name           VARCHAR(255) NOT NULL,
  geometry_mode  ENUM('simple','extended','advanced') DEFAULT 'simple',
  length         DECIMAL(10,3) DEFAULT 0,
  width          DECIMAL(10,3) DEFAULT 0,
  height         DECIMAL(10,3) DEFAULT 0,
  sort_order     INT DEFAULT 0,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- ═══════════════════════════════════════════════════════
-- ПРОЁМЫ (окна/двери)
-- Принадлежат комнате (simple/advanced) ИЛИ секции (extended)
-- ═══════════════════════════════════════════════════════
CREATE TABLE openings (
  id              VARCHAR(36) PRIMARY KEY,
  room_id         VARCHAR(36) NOT NULL,
  subsection_id   VARCHAR(36) NULL,
  type            ENUM('window','door') NOT NULL,
  width           DECIMAL(10,3) NOT NULL,
  height          DECIMAL(10,3) NOT NULL,
  sort_order      INT DEFAULT 0,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- ═══════════════════════════════════════════════════════
-- EXTENDED MODE: секции помещения (разные формы)
-- ═══════════════════════════════════════════════════════
CREATE TABLE room_subsections (
  id          VARCHAR(36) PRIMARY KEY,
  room_id     VARCHAR(36) NOT NULL,
  name        VARCHAR(255),
  shape       ENUM('rectangle','trapezoid','triangle','parallelogram') DEFAULT 'rectangle',
  -- Rectangle
  length      DECIMAL(10,3) DEFAULT 0,
  width       DECIMAL(10,3) DEFAULT 0,
  -- Trapezoid
  base1       DECIMAL(10,3) NULL,
  base2       DECIMAL(10,3) NULL,
  trap_height DECIMAL(10,3) NULL,
  side1       DECIMAL(10,3) NULL,
  side2       DECIMAL(10,3) NULL,
  -- Triangle
  side_a      DECIMAL(10,3) NULL,
  side_b      DECIMAL(10,3) NULL,
  side_c      DECIMAL(10,3) NULL,
  -- Parallelogram
  base        DECIMAL(10,3) NULL,
  para_height DECIMAL(10,3) NULL,
  side        DECIMAL(10,3) NULL,
  sort_order  INT DEFAULT 0,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

ALTER TABLE openings
  ADD FOREIGN KEY (subsection_id) REFERENCES room_subsections(id) ON DELETE CASCADE;

-- ═══════════════════════════════════════════════════════
-- ADVANCED MODE: сегменты, препятствия, перепады высот
-- ═══════════════════════════════════════════════════════
CREATE TABLE room_segments (
  id         VARCHAR(36) PRIMARY KEY,
  room_id    VARCHAR(36) NOT NULL,
  name       VARCHAR(255),
  length     DECIMAL(10,3) DEFAULT 0,
  width      DECIMAL(10,3) DEFAULT 0,
  operation  ENUM('add','subtract') DEFAULT 'subtract',
  sort_order INT DEFAULT 0,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE room_obstacles (
  id         VARCHAR(36) PRIMARY KEY,
  room_id    VARCHAR(36) NOT NULL,
  name       VARCHAR(255),
  type       ENUM('column','duct','niche','other') DEFAULT 'column',
  area       DECIMAL(10,3) DEFAULT 0,
  perimeter  DECIMAL(10,3) DEFAULT 0,
  operation  ENUM('add','subtract') DEFAULT 'subtract',
  sort_order INT DEFAULT 0,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE wall_sections (
  id         VARCHAR(36) PRIMARY KEY,
  room_id    VARCHAR(36) NOT NULL,
  name       VARCHAR(255),
  length     DECIMAL(10,3) DEFAULT 0,
  height     DECIMAL(10,3) DEFAULT 0,
  sort_order INT DEFAULT 0,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- ═══════════════════════════════════════════════════════
-- РАБОТЫ, МАТЕРИАЛЫ, ИНСТРУМЕНТЫ
-- ═══════════════════════════════════════════════════════
CREATE TABLE works (
  id                VARCHAR(36) PRIMARY KEY,
  room_id           VARCHAR(36) NOT NULL,
  name              VARCHAR(255) NOT NULL,
  unit              VARCHAR(50) DEFAULT 'м²',
  enabled           BOOLEAN DEFAULT TRUE,
  work_unit_price   DECIMAL(12,2) DEFAULT 0,
  calculation_type  ENUM('floorArea','netWallArea','skirtingLength','customCount') DEFAULT 'floorArea',
  count             INT NULL,
  manual_qty        DECIMAL(10,3) NULL,
  is_custom         BOOLEAN DEFAULT TRUE,
  sort_order        INT DEFAULT 0,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE materials (
  id             VARCHAR(36) PRIMARY KEY,
  work_id        VARCHAR(36) NOT NULL,
  name           VARCHAR(255),
  quantity       DECIMAL(10,3) DEFAULT 1,
  unit           VARCHAR(50) DEFAULT 'м²',
  price_per_unit DECIMAL(12,2) DEFAULT 0,
  sort_order     INT DEFAULT 0,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

CREATE TABLE tools (
  id          VARCHAR(36) PRIMARY KEY,
  work_id     VARCHAR(36) NOT NULL,
  name        VARCHAR(255),
  quantity    INT DEFAULT 1,
  price       DECIMAL(12,2) DEFAULT 0,
  is_rent     BOOLEAN DEFAULT FALSE,
  rent_period INT NULL,
  sort_order  INT DEFAULT 0,
  FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
);

-- ═══════════════════════════════════════════════════════
-- AI: история запросов (кэш и аналитика расходов)
-- ═══════════════════════════════════════════════════════
CREATE TABLE ai_requests (
  id           VARCHAR(36) PRIMARY KEY,
  project_id   VARCHAR(36) NULL,
  provider     ENUM('gemini','mistral') NOT NULL,
  request_type VARCHAR(50) NOT NULL,
  prompt_hash  VARCHAR(64),
  response     JSON,
  tokens_used  INT DEFAULT 0,
  cost_usd     DECIMAL(10,6) DEFAULT 0,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);
```

### Ключевые решения по схеме

- **Все режимы хранятся одновременно** — как в текущем localStorage. Поле `geometry_mode` определяет, какие таблицы участвуют в расчётах. При переключении режима данные не удаляются.
- **`openings.subsection_id` nullable** — в simple/advanced режиме проёмы принадлежат комнате (`subsection_id = NULL`), в extended — секции.
- **`sort_order`** везде — поддержка drag-and-drop порядка.
- **`VARCHAR(36)` для ID** — переход на `crypto.randomUUID()` вместо `Math.random()`.

---

## 2. Серверная архитектура

### Структура файлов

```
server/
├── src/
│   ├── index.ts                  -- Express entry point (порт 3994)
│   ├── config/
│   │   ├── database.ts           -- MySQL pool (mysql2/promise)
│   │   └── ai.ts                 -- API keys, provider configs
│   ├── routes/
│   │   ├── projects.ts           -- CRUD /api/projects
│   │   ├── rooms.ts              -- CRUD /api/rooms
│   │   ├── works.ts              -- CRUD /api/works
│   │   ├── ai.ts                 -- POST /api/ai/*
│   │   ├── sync.ts               -- POST /api/sync/push|pull
│   │   └── export.ts             -- GET /api/export/csv|json
│   ├── services/
│   │   ├── calculations.ts       -- shared: calculateRoomMetrics, calculateRoomCosts
│   │   └── ai/
│   │       ├── provider.ts       -- Abstract AIProvider interface
│   │       ├── gemini.ts         -- GeminiProvider (@google/genai)
│   │       ├── mistral.ts        -- MistralProvider (@mistralai/mistralai)
│   │       └── prompts.ts        -- Domain-specific prompt templates
│   ├── db/
│   │   ├── pool.ts               -- MySQL connection pool
│   │   ├── migrations/           -- Knex migration files
│   │   └── repositories/
│   │       ├── projects.repo.ts
│   │       ├── rooms.repo.ts
│   │       └── works.repo.ts
│   └── middleware/
│       ├── errorHandler.ts
│       └── validation.ts         -- zod-based request validation
├── knexfile.ts
├── tsconfig.json
└── package.json
```

### REST API

```
# ─── Проекты ────────────────────────────────────────
GET    /api/projects                    Список проектов
POST   /api/projects                    Создать проект
GET    /api/projects/:id                Полный проект (rooms + works + geometry)
PUT    /api/projects/:id                Обновить проект
DELETE /api/projects/:id                Удалить проект

# ─── Комнаты ────────────────────────────────────────
POST   /api/projects/:pid/rooms         Добавить комнату
GET    /api/rooms/:id                   Комната со всей геометрией и работами
PUT    /api/rooms/:id                   Обновить комнату
DELETE /api/rooms/:id                   Удалить комнату
PUT    /api/projects/:pid/rooms/order    Обновить порядок комнат (drag-and-drop)

# ─── Работы + Материалы + Инструменты ──────────────
POST   /api/rooms/:rid/works            Добавить работу
PUT    /api/works/:id                   Обновить работу
DELETE /api/works/:id                   Удалить работу
PUT    /api/rooms/:rid/works/order       Обновить порядок работ
POST   /api/works/:wid/materials        Добавить материал
PUT    /api/materials/:id               Обновить материал
DELETE /api/materials/:id               Удалить материал
POST   /api/works/:wid/tools            Добавить инструмент
PUT    /api/tools/:id                   Обновить инструмент
DELETE /api/tools/:id                   Удалить инструмент

# ─── Геометрия (extended/advanced) ─────────────────
POST   /api/rooms/:rid/subsections      Добавить секцию
PUT    /api/subsections/:id             Обновить секцию
DELETE /api/subsections/:id             Удалить секцию
POST   /api/rooms/:rid/segments         Добавить сегмент
POST   /api/rooms/:rid/obstacles        Добавить препятствие
POST   /api/rooms/:rid/wall-sections    Добавить перепад высоты
POST   /api/rooms/:rid/openings         Добавить проём (окно/дверь)

# ─── Синхронизация (offline-first) ─────────────────
POST   /api/sync/push                   Отправить локальные изменения на сервер
GET    /api/sync/pull?since=<timestamp> Получить изменения с сервера

# ─── AI ────────────────────────────────────────────
POST   /api/ai/estimate                 Оценка стоимости по описанию
POST   /api/ai/suggest-materials        Предложить материалы для работы
POST   /api/ai/generate-template        Шаблон работ для типа комнаты
POST   /api/ai/chat                     Свободный диалог о проекте

# ─── Экспорт/Импорт (серверный, с правильными расчётами) ──
GET    /api/export/csv/:projectId        Экспорт проекта в CSV
GET    /api/export/json                  Экспорт всех проектов в JSON
POST   /api/import/json                  Импорт проектов из JSON
```

### Конфигурация MySQL

```typescript
// server/src/db/pool.ts
import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'repair_calc',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
```

---

## 3. AI-интеграция (Gemini + Mistral)

### Абстрактный провайдер

```typescript
// server/src/services/ai/provider.ts
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface AIProvider {
  name: 'gemini' | 'mistral';
  chat(messages: ChatMessage[], options?: AIOptions): Promise<string>;
  generateStructured<T>(prompt: string, schema: object): Promise<T>;
}
```

### Провайдеры

```typescript
// server/src/services/ai/gemini.ts
import { GoogleGenAI } from '@google/genai';
import type { AIProvider, ChatMessage, AIOptions } from './provider';

export class GeminiProvider implements AIProvider {
  name = 'gemini' as const;
  private client: GoogleGenAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async chat(messages: ChatMessage[], options?: AIOptions): Promise<string> {
    const response = await this.client.models.generateContent({
      model: options?.model || 'gemini-2.5-flash',
      contents: messages.map(m => ({
        parts: [{ text: m.content }],
        role: m.role === 'assistant' ? 'model' : 'user',
      })),
    });
    return response.text || '';
  }

  async generateStructured<T>(prompt: string, schema: object): Promise<T> {
    const response = await this.chat([
      { role: 'system', content: `Respond ONLY with valid JSON matching this schema: ${JSON.stringify(schema)}` },
      { role: 'user', content: prompt },
    ]);
    return JSON.parse(response) as T;
  }
}
```

```typescript
// server/src/services/ai/mistral.ts
import { Mistral } from '@mistralai/mistralai';
import type { AIProvider, ChatMessage, AIOptions } from './provider';

export class MistralProvider implements AIProvider {
  name = 'mistral' as const;
  private client: Mistral;

  constructor(apiKey: string) {
    this.client = new Mistral({ apiKey });
  }

  async chat(messages: ChatMessage[], options?: AIOptions): Promise<string> {
    const response = await this.client.chat.complete({
      model: options?.model || 'mistral-small-latest',
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });
    return response.choices?.[0]?.message?.content as string || '';
  }

  async generateStructured<T>(prompt: string, schema: object): Promise<T> {
    const response = await this.chat([
      { role: 'system', content: `Respond ONLY with valid JSON matching this schema: ${JSON.stringify(schema)}` },
      { role: 'user', content: prompt },
    ]);
    return JSON.parse(response) as T;
  }
}
```

### Распределение задач по провайдерам

| Задача | Провайдер | Модель | Обоснование |
|---|---|---|---|
| Оценка стоимости по описанию | Gemini | `gemini-2.5-flash` | Хорошо понимает контекст, поддержка русского |
| Генерация шаблонов работ | Mistral | `mistral-small-latest` | Дешевле ($0.1/1M input), структурированный вывод |
| Предложение материалов | Gemini | `gemini-2.5-flash` | Нужны знания о стройматериалах и ценах |
| Классификация работ | Mistral | `mistral-small-latest` | Простая задача, Mistral дешевле |
| Свободный чат о проекте | Gemini | `gemini-2.5-flash` | Лучше для диалогов и рассуждений |
| Анализ фото помещения | Gemini | `gemini-2.5-flash` | Единственный с vision capabilities |

### AI-сценарии использования

#### Сценарий 1: «Оцени ремонт»
```
Пользователь: "Ванная 3×2м, стандартный ремонт, Москва"
→ AI генерирует: список работ с ценами, материалы, итого
→ Пользователь может импортировать как новую комнату
```

#### Сценарий 2: «Подбери материалы»
```
Пользователь выбирает работу "Укладка плитки"
→ AI предлагает:
   - Плитка (30×30, Kerama Marazzi, ~1200₽/м²)
   - Клей (Ceresit CM11, 25кг, ~450₽)
   - Затирка (Ceresit CE40, ~350₽)
→ Пользователь добавляет в materials[] одним кликом
```

#### Сценарий 3: «Шаблон для комнаты»
```
Пользователь создаёт комнату "Кухня"
→ AI предлагает типовой набор работ:
   - Укладка плитки на пол
   - Фартук из плитки
   - Покраска стен
   - Натяжной потолок
   - Электрика (10 точек)
→ С примерными ценами по региону
```

#### Сценарий 4: «Свободный чат»
```
Пользователь: "Как сэкономить на ремонте кухни? Бюджет 200к."
→ AI анализирует текущую смету и предлагает:
   - Заменить плитку на линолеум (-15к)
   - Покрасить стены вместо обоев (-8к)
   - Оставить натяжной потолок (оптимальное соотношение цена/качество)
```

---

## 4. PWA / Offline-first архитектура

### Стратегия синхронизации

```
┌──────────────────┐    immediate     ┌───────────────┐
│   React State    │ ──────────────→  │  localStorage  │  ← Первичное хранилище
│   (UI)           │ ←──────────────  │  (persistent)  │
└──────────────────┘                  └───────┬────────┘
                                              │ async queue
                                      ┌───────▼────────┐
                                      │   Sync Queue    │  ← IndexedDB (надёжнее)
                                      │   (pending ops) │
                                      └───────┬────────┘
                                              │ when online
                                      ┌───────▼────────┐
                                      │  Express API    │  ← Persistent backup + AI
                                      │  + MySQL        │
                                      └────────────────┘
```

- **Offline:** Всё работает как сейчас (localStorage). Изменения ставятся в очередь (IndexedDB).
- **Online:** Очередь сбрасывается на сервер. Конфликты: "last write wins" (для внутреннего инструмента достаточно).
- **AI:** Доступен только online. Кэш ответов в таблице `ai_requests`.

### Конфигурация vite-plugin-pwa

```typescript
// В vite.config.ts добавить:
import { VitePWA } from 'vite-plugin-pwa';

VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [{
      urlPattern: /^\/api\/.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 5,
      },
    }],
  },
  manifest: {
    name: 'Мой ремонт — Калькулятор',
    short_name: 'Мой ремонт',
    start_url: '/',
    display: 'standalone',
    theme_color: '#4f46e5',       // indigo-600 (текущая тема)
    background_color: '#f5f5f5',  // bg-[#f5f5f5]
    lang: 'ru',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
})
```

### Offline-индикатор в UI

```typescript
// src/hooks/useOnlineStatus.ts
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingChanges, setPendingChanges] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, pendingChanges };
}
```

---

## 5. Дорожная карта реализации

### Фаза 0: Подготовка (сделать сейчас)
- [ ] Создать этот документ `docs/ARCHITECTURE.md` ✅
- [ ] Обновить `.env.example` с новыми переменными

### Фаза 1: Исправление блокеров из CODE_REVIEW (1–2 дня)
- [ ] Fix stale closure в `useProjects.ts` (→ функциональное обновление `setProjects`)
- [ ] Fix порт в `playwright.config.ts` (3995 → 3993)
- [ ] Удалить `GEMINI_API_KEY` из `vite.config.ts` `define` блока
- [ ] Fix CSV-экспорт (переиспользовать `calculateRoomMetrics`/`calculateRoomCosts`)
- [ ] Удалить мёртвые зависимости: `better-sqlite3`, `dotenv`, `motion`
- [ ] Удалить `vite` из `dependencies` (оставить в `devDependencies`)

### Фаза 2: Декомпозиция App.tsx (3–5 дней)
- [ ] Вынести типы → `src/types/index.ts`
- [ ] Вынести расчёты → `src/utils/calculations.ts` (shared между клиентом и сервером)
- [ ] Вынести фабрики → `src/utils/factories.ts`
- [ ] Вынести `NumberInput` → `src/components/NumberInput.tsx`
- [ ] Вынести `SummaryView` → `src/components/SummaryView.tsx`
- [ ] Разбить `RoomEditor` на подкомпоненты:
  - `src/components/RoomEditor/index.tsx`
  - `src/components/RoomEditor/GeometrySection.tsx`
  - `src/components/RoomEditor/WorksSection.tsx`
- [ ] Добавить `useMemo` для `calculateRoomMetrics`/`calculateRoomCosts`
- [ ] Добавить `ErrorBoundary`
- [ ] Убрать дублирование обработчиков (generic `withModeSync` helper)

### Фаза 3: Express + MySQL (5–7 дней)
- [ ] Инициализировать `server/` с Express + TypeScript
- [ ] Настроить `mysql2/promise` connection pool
- [ ] Создать MySQL-схему и Knex-миграции
- [ ] Реализовать REST API: CRUD для всех сущностей
- [ ] Реализовать `POST /api/sync/push` и `GET /api/sync/pull`
- [ ] Перенести `calculations.ts` в shared-пакет (клиент + сервер)
- [ ] Добавить серверный CSV/JSON экспорт с корректными расчётами
- [ ] Добавить фронтенд-сервис синхронизации (`src/services/api.ts`)
- [ ] Добавить `zod`-валидацию для API-запросов

### Фаза 4: AI-интеграция (3–5 дней)
- [ ] Абстрактный `AIProvider` интерфейс
- [ ] `GeminiProvider` (`@google/genai` ≥ v1.43) — оценка стоимости, материалы, чат
- [ ] `MistralProvider` (`@mistralai/mistralai`) — шаблоны, классификация
- [ ] Промпт-шаблоны для строительной тематики (русский язык)
- [ ] UI: панель AI-ассистента (sidebar или модальное окно)
- [ ] Кэширование AI-ответов в таблице `ai_requests`
- [ ] Rate limiting для AI-запросов (внутренний инструмент, но контроль расходов)

### Фаза 5: PWA (2–3 дня)
- [ ] Установить `vite-plugin-pwa`
- [ ] Создать иконки (192, 512, maskable)
- [ ] Настроить manifest и service worker
- [ ] Добавить offline-детекцию и статус синхронизации в UI
- [ ] IndexedDB sync queue для offline-изменений (`idb` library)
- [ ] Тестирование offline-сценариев

### Итого: ~14–22 рабочих дня

---

## 6. Зависимости

### Удалить

| Пакет | Причина |
|---|---|
| `better-sqlite3` | Не нужен, используем MySQL |
| `dotenv` | Vite сам загружает `.env` |
| `motion` | Не используется, пользователь подтвердил — не нужен |
| `vite` из `dependencies` | Дублируется в `devDependencies` |

### Оставить / Обновить

| Пакет | Действие | Причина |
|---|---|---|
| `express` | ✅ Оставить | Будет использоваться для сервера |
| `@google/genai` | ⬆️ Обновить до `^1.43` | Gemini AI, текущая v1.29 устарела |
| `@types/express` | ✅ Оставить | TypeScript types для Express |

### Добавить (сервер)

| Пакет | Назначение |
|---|---|
| `mysql2` | MySQL-драйвер (promise API) |
| `knex` | Миграции БД |
| `@mistralai/mistralai` | Mistral AI SDK |
| `zod` | Валидация API-запросов и AI-ответов |
| `cors` | CORS для dev-режима (клиент :3993, сервер :3994) |
| `tsx` | ✅ Уже есть — запуск TypeScript сервера |

### Добавить (клиент / dev)

| Пакет | Назначение |
|---|---|
| `vite-plugin-pwa` | PWA-поддержка (service worker + manifest) |
| `idb` | IndexedDB wrapper для sync queue |

---

## Приложение: обновлённый .env.example

```env
# ─── AI ───────────────────────────────────────────
GEMINI_API_KEY="your-gemini-api-key"
MISTRAL_API_KEY="your-mistral-api-key"

# ─── MySQL ────────────────────────────────────────
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=repair_calc

# ─── Server ───────────────────────────────────────
SERVER_PORT=3994
APP_URL=http://localhost:3993
```
