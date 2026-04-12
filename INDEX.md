# 📖 INDEX - Главный индексный файл проекта

**Последнее обновление:** 2026-04-04
**Версия приложения:** 1.1

---

## 🎯 Назначение

Этот файл содержит полную информацию о состоянии проекта для AI-агентов.  
**Правило:** После ЛЮБЫХ изменений в коде обновляйте этот файл.

---

## 📁 Структура проекта

```
repair-calc/
├── src/                           # Исходный код фронтенда
│   ├── api/                       # API клиенты
│   │   ├── projects.ts            # Project API
│   │   ├── rooms.ts               # Room API
│   │   ├── auth.ts                # Auth API
│   │   ├── sync.ts                # Sync API
│   │   └── storage/
│   │       └── apiStorageProvider.ts  # Storage через API
│   ├── components/                # React компоненты
│   ├── contexts/                  # React Contexts
│   │   ├── AuthContext.tsx        # Аутентификация
│   │   └── ProjectContext.tsx     # Управление проектами
│   ├── data/                      # Статические данные
│   │   ├── initialData.ts         # Начальные данные
│   │   └── workTemplatesCatalog.ts # Шаблоны работ
│   ├── hooks/                     # Кастомные хуки
│   ├── types/                     # TypeScript типы
│   │   ├── index.ts               # Основные типы
│   │   ├── auth.ts                # Типы аутентификации
│   │   └── storage.ts             # Типы хранилища
  │   ├── utils/                     # Утилиты
  │   │   ├── storage.ts             # StorageManager
  │   │   ├── idMapper.ts            # Маппинг ID
  │   │   ├── costs.ts               # Расчёт стоимости
  │   │   ├── geometry.ts            # Геометрические расчёты
  │   │   ├── projectObjects.ts      # 🆕 Object-based project helpers (2026-04-04)
  │   │   ├── migration.ts           # Data migration utilities
  │   │   └── projectContextPatch.ts # 🆕 Context patches
│   ├── App.tsx                    # Корневой компонент
│   └── main.tsx                   # Точка входа
│
├── server/                        # Backend (Node.js + Express)
│   ├── src/
│   │   ├── routes/
│   │   │   ├── sync.ts            # 🆕 Sync endpoints с логированием
│   │   │   ├── projects.ts        # 🆕 Projects endpoints с логированием
│   │   │   ├── auth.ts            # Authentication
│   │   │   └── rooms.ts           # Room operations
│   │   ├── db/
│   │   │   ├── migrations/        # Миграции БД
│   │   │   └── repositories/      # Репозитории
│   │   │       ├── project.repo.ts
│   │   │       ├── room.repo.ts
│   │   │       └── user.repo.ts
│   │   ├── middleware/
│   │   │   ├── auth.ts            # JWT аутентификация
│   │   │   ├── validation.ts      # Валидация запросов
│   │   │   ├── rateLimiter.ts     # Rate limiting
│   │   │   ├── logger.ts          # 🆕 Детальное логирование
│   │   │   └── errorHandler.ts    # Обработка ошибок
│   │   ├── config/                # Конфигурация
│   │   ├── services/              # Бизнес-логика
│   │   └── types/                 # TypeScript типы
│   ├── dist/                      # Скомпилированный код
│   ├── knexfile.ts                # Knex конфигурация
│   └── package.json
│
├── database/                      # Дампы и скрипты БД
│   ├── lemana_data.json
│   ├── lemana_output.sql
│   ├── bazavit_data.json
│   └── bazavit_output.sql
│
├── docs/                          # 🆕 Документация
│   ├── README.md                  # Индекс документации
│   ├── LOGGING.md                 # 🆕 Руководство по логированию
│   ├── LOGGING-CHEATSHEET.md      # 🆕 Шпаргалка по логам
│   ├── API.md                     # API документация
│   ├── DATABASE.md                # Схема БД
│   └── TROUBLESHOOTING.md         # Отладка
│
├── scripts/                       # Скрипты
│   ├── get-actual-data.ts         # Скрипт Playwright для данных
│   └── debug-logger.js            # Скрипт отладки для браузера
│
├── tests/                         # Тесты
├── e2e/                           # E2E тесты (Playwright)
│
├── docker-compose.yml             # Docker конфигурация
├── Dockerfile                     # Фронтенд Dockerfile
├── package.json                   # Зависимости
├── tsconfig.json                  # TypeScript конфиг
├── vite.config.ts                 # Vite конфиг
└── README.md                      # Главная документация
```

---

## 🔑 Ключевые файлы

### Фронтенд

| Файл | Назначение |
|------|----------|
| `src/contexts/ProjectContext.tsx` | Управление состоянием проектов |
| `src/contexts/AuthContext.tsx` | Аутентификация пользователя |
| `src/api/storage/apiStorageProvider.ts` | Синхронизация с сервером |
| `src/utils/storage.ts` | StorageManager (localStorage) |
| `src/utils/idMapper.ts` | Маппинг локальных/серверных ID |

### Бэкенд

| Файл | Назначение |
|------|----------|
| `server/src/routes/sync.ts` | 🆕 Sync API с детальным логированием |
| `server/src/routes/projects.ts` | 🆕 Projects API с детальным логированием |
| `server/src/db/repositories/project.repo.ts` | Репозиторий проектов |
| `server/src/db/repositories/room.repo.ts` | Репозиторий комнат |
| `server/src/middleware/auth.ts` | JWT аутентификация |
| `server/src/middleware/logger.ts` | 🆕 Логирование запросов |

### Документация

| Файл | Назначение |
|------|----------|
| `docs/TECHNICAL-SPECIFICATION.md` | Техническое задание на архитектуру |
| `docs/LOGGING.md` | Полное руководство по логированию |
| `docs/LOGGING-CHEATSHEET.md` | Шпаргалка по командам логирования |
| `docs/README.md` | Индекс документации |
| `docs/AI_DOCUMENTATION_GUIDELINES.md` | 🆕 Инструкция для будущих ИИ |

---

## 🗄️ База данных

### Таблицы

| Таблица | Назначение |
|---------|----------|
| `users` | Пользователи |
| `projects` | Проекты (user_id, name, city, use_ai_pricing) |
| `rooms` | Комнаты (project_id, name, geometry_mode, dimensions) |
| `works` | Работы (room_id, name, price, materials) |
| `materials` | Материалы (work_id, name, quantity, price) |
| `tools` | Инструменты (work_id, name, price, is_rent) |
| `openings` | Окна/двери (room_id, type, dimensions) |
| `ai_requests` | История AI запросов |
| `audit_log` | Лог аудита |

### Миграции

```
server/src/db/migrations/
├── 20260313_initial.ts           # Начальная схема
├── 20260314_ab_tests.ts          # A/B тесты
├── 20260314_update_service.ts    # Service обновлений
├── 20260314_webhooks.ts          # Webhooks
└── 20260315_room_json_fields.ts  # JSON поля для комнат
```

---

## 🔌 API Endpoints

### Аутентификация

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/auth/register` | Регистрация |
| POST | `/api/auth/login` | Вход |
| POST | `/api/auth/refresh` | Обновление токена |
| GET | `/api/auth/me` | Текущий пользователь |
| POST | `/api/auth/logout` | Выход |

### Проекты

| Метод | Endpoint | Описание | 🆕 Логирование |
|-------|----------|----------|---------------|
| GET | `/api/projects` | Список проектов | ✅ |
| POST | `/api/projects` | Создание | ✅ |
| GET | `/api/projects/:id` | Проект с комнатами | ✅ |
| PUT | `/api/projects/:id` | Обновление | ✅ |
| DELETE | `/api/projects/:id` | Удаление | ✅ |
| PUT | `/api/projects/:id/with-rooms` | Обновление с комнатами | ✅ |
| PUT | `/api/projects/:id/ai-settings` | AI настройки | ✅ |

### Синхронизация

| Метод | Endpoint | Описание | 🆕 Логирование |
|-------|----------|----------|---------------|
| GET | `/api/sync/pull` | Получить данные | ✅ Детальное |
| POST | `/api/sync/push` | Отправить изменения | ✅ Детальное |

---

## 📊 Типы данных

### Project
```typescript
interface Project {
  id: string;                    // UUID
  name: string;
  city?: string;
  use_ai_pricing?: boolean;
  last_ai_price_update?: string;
  version?: number;
  rooms?: Room[];
}
```

### Room
```typescript
interface Room {
  id: string;                    // UUID
  name: string;
  geometry_mode: 'simple' | 'extended' | 'advanced';
  length: number;
  width: number;
  height: number;
  windows: Opening[];
  doors: Opening[];
  works: WorkData[];
  // ... mode-specific fields
}
```

### WorkData
```typescript
interface WorkData {
  id: string;
  name: string;
  unit: string;
  enabled: boolean;
  workUnitPrice: number;
  materials?: Material[];
  tools?: Tool[];
  count?: number;
  calculationType: CalculationType;
}
```

---

## 🛠️ Технологии

### Фронтенд
- React 19
- TypeScript 5.8
- Vite 6
- TailwindCSS 4
- Lucide Icons

### Бэкенд
- Node.js
- Express
- TypeScript
- MySQL 8
- Knex.js
- JWT

### Инфраструктура
- Docker
- Docker Compose
- Nginx (фронтенд)

---

## 🚀 Запуск

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

## 📝 Правила разработки

1. **Перед коммитом:**
   - `npm test` — тесты
   - `npm run lint` — проверка типов
   - Обновить `INDEX.md`

2. **Порт приложения:** Только **3993**

3. **Логирование:** Использовать формат с эмодзи для наглядности

4. **Миграции БД:** Только через Knex migrations

---

## 🔍 Логирование

### Включение детального логирования

Логи автоматически включены в `server/src/routes/sync.ts` и `server/src/routes/projects.ts`.

### Просмотр логов

```bash
# Прямой доступ
docker logs repair-calc-backend --tail 100

# В реальном времени
docker logs repair-calc-backend --tail 50 -f

# Фильтрация по проекту
docker logs repair-calc-backend 2>&1 | grep "da07594f-"
```

### Формат логов

```
📡 [timestamp] API ЗАПРОС
   Метод: GET
   Путь: /pull
   Пользователь: uuid

📥 [SYNC/PULL] Загрузка данных
   📊 Найдено проектов: N
   📁 ПРОЕКТ: "Name"
      Комнат: N
      Площадь: XX м²
```

📖 **Подробности:** [`docs/LOGGING.md`](./docs/LOGGING.md)

---

## 📦 Зависимости

### Основные

```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "express": "^4.x",
  "mysql2": "^3.x",
  "knex": "^3.x",
  "typescript": "~5.8.2"
}
```

### Dev

```json
{
  "vite": "^6.2.0",
  "vitest": "^4.0.18",
  "playwright": "^1.58.2",
  "@types/react": "^19.2.14"
}
```

---

## 🧪 Тестирование

```bash
# Unit тесты
npm test

# E2E тесты
npm run test:e2e

# E2E с UI
npm run test:e2e:ui
```

---

## 📚 Документы

- [README](./README.md) — Главная документация
- [docs/LOGGING.md](./docs/LOGGING.md) — Логирование
- [docs/LOGGING-CHEATSHEET.md](./docs/LOGGING-CHEATSHEET.md) — Шпаргалка
- [docs/README.md](./docs/README.md) — Индекс документации
- [docs/TECHNICAL-SPECIFICATION.md](./docs/TECHNICAL-SPECIFICATION.md) — ТЗ (v1.1)
- [docs/AI_DOCUMENTATION_GUIDELINES.md](./docs/AI_DOCUMENTATION_GUIDELINES.md) — 🆕 Правила по ведению документации

---

## ✅ Реализованные изменения (2026-04-04)

### Многопользовательская архитектура с группировкой объектов

**Статус:** ✅ ПОЛНОСТЬЮ ЗАВЕРШЕНО (Backend 100%, Frontend 100%)

**Структура данных:**
```
Пользователь
└── Проект (группа объектов)
    └── Объект (недвижимость)
        └── Комната
            └── Работа
                └── Материал/Инструмент
```

**База данных:**
- ✅ Таблица `objects` — объекты недвижимости
- ✅ Таблица `deleted_entities` — отслеживание удалений (30 дней)
- ✅ `users.is_premium` — флаг премиум-доступа
- ✅ `rooms.object_id` — связь с объектами

**API Endpoints:**
- ✅ `POST /api/projects/:projectId/objects` — создать объект
- ✅ `GET /api/objects` — список объектов
- ✅ `GET /api/objects/:id` — объект с комнатами
- ✅ `PUT /api/objects/:id` — обновить объект
- ✅ `DELETE /api/objects/:id` — удалить объект
- ✅ `GET /api/users/me` — профиль пользователя

**Лимиты:**
- Бесплатные: 10 объектов в проекте
- Премиум: безлимит

**Frontend:**
- ✅ Типы TypeScript (ObjectData, ProjectData)
- ✅ API Clients (objects.ts, users.ts)
- ✅ ProjectContext (updateRoom, deleteRoom, addRoom)
- ✅ SummaryView (расчёт по objects[])
- ✅ Helper Functions (projectObjects.ts)
- ✅ Objects Save Fix — исправлены критические проблемы с сохранением данных

**Миграция:**
- Автоматическая: старые проекты → objects[0].rooms
- Обратная совместимость: rooms? для старых данных

### Objects Save Fix (2026-04-01)

**Статус:** ✅ ЗАВЕРШЕНО

**Исправленные критические проблемы:**
- ✅ Server repositories возвращают полную иерархию `project → objects → rooms`
- ✅ Sync API корректно работает с новой структурой данных
- ✅ Frontend использует атомарные сохранения вместо room-by-room
- ✅ Локальные ID объектов заменяются на server ID при синхронизации
- ✅ Все существующие тесты проходят (641/641)

**Файлы:** 12 файлов изменено (3 backend, 6 frontend, 3 tests)

---

## 🔄 Полный рестарт (2026-03-31 22:21)

**Статус:** ✅ База данных очищена, объектная архитектура полностью реализована

**Команды для рестарта:**
```bash
docker-compose down
docker volume rm repair-calc_mysql_data
docker-compose build --no-cache
docker-compose up -d
```

**Текущее состояние:**
- Пользователей: 0
- Проектов: 0
- Объектов: 0
- Комнат: 0

**Следующий шаг:** Регистрация пользователя и создание первого проекта с объектами

### Текущий статус (2026-04-04)

**Мультипользовательская архитектура:** ✅ ГОТОВА К ПРОДАКШЕНУ
- Backend: 100% завершён
- Frontend: 100% завершён (включая Objects Save Fix)
- Тесты: 641/641 проходят
- Документация: обновлена

---

**⚠️ ВАЖНО:** После каждого изменения обновляйте этот файл!
