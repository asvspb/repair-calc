# 📋 Техническое задание
## Ремонтный калькулятор — Многопользовательская архитектура с группировкой объектов

**Версия:** 1.1  
**Дата:** 2026-03-31  
**Статус:** Утверждено

---

## 0. Резюме изменений (v1.1)

| Раздел | Изменение | Основание |
|--------|-----------|-----------|
| 15.1 | Флаг `is_premium` перенесён в таблицу `users` | Ответ #2 |
| 15.1 | Добавлена таблица `deleted_entities` для отслеживания удалений | Ответ #3 |
| 15.2.0 | Добавлен сервис очистки устаревших записей (30 дней) | Ответ #3 |
| 15.2.2 | Формат `deleted` в sync/pull расширен до объектов с метаданными | Ответ #3 |
| 15.3.2 | Добавлено логирование всех запросов к старым эндпоинтам | Ответ #4 |
| 15.5.0 | Стратегия миграции: проект-группа "Мои объекты" | Ответ #1, #5 |
| 6.1.0 | Добавлен эндпоинт `/api/users/me` для проверки премиума | Ответ #2 |
| 11 | Убран массовый экспорт из требований | Ответ #7 |

---

## 1. Введение

### 1.1 Назначение документа

Настоящий документ описывает технические требования к модификации приложения "Ремонтный калькулятор" для поддержки многоуровневой структуры данных с группировкой объектов недвижимости.

### 1.2 Область применения

Документ предназначен для:
- Разработчиков приложения
- Тестировщиков
- Технических писателей

---

## 2. Терминология

| Термин | Определение | Пример |
|--------|-------------|--------|
| **Пользователь** | Зарегистрированный пользователь системы | `asv@asv.com` |
| **Проект** | Группа объектов недвижимости, объединённых по общим критериям | "Мои квартиры", "Дача", "Офисы" |
| **Объект** | Единица недвижимости в составе проекта | "Квартира на Колумба", "Дом в городе" |
| **Комната** | Помещение в составе объекта | "Спальня", "Кухня", "Ванная" |
| **Работа** | Вид ремонтных работ в комнате | "Заливка стяжки", "Поклейка обоев" |

---

## 3. Текущее состояние

### 3.1 Существующая архитектура

```
Пользователь (User)
└── Project (Проект = Объект)
    └── Room (Комната)
        └── Work (Работа)
            └── Material (Материал)
            └── Tool (Инструмент)
```

**Проблема:** Отсутствие возможности группировки нескольких объектов недвижимости в один проект.

### 3.2 Текущие данные пользователя

| Пользователь | ID |
|-------------|-----|
| asv@asv.com | `6b2b0699-3488-4f68-8c1d-c072873d2e67` |

| Проект (текущий) | ID | Город | Комнат |
|-----------------|-----|-------|--------|
| Квартира на Колумба | `5f79cd77-ee73-4ca9-ac35-9a032cc8bd6c` | Волгоград | 0 |
| Квартира на Танкистов | `da07594f-75d7-4c0e-ad48-4bacba6feff9` | Саратов | 0 |

---

## 4. Целевая архитектура

### 4.1 Новая структура данных

```
Пользователь (User)
└── Project (Проект-группа)
    └── Object (Объект недвижимости)
        └── Room (Комната)
            └── Work (Работа)
                └── Material (Материал)
                └── Tool (Инструмент)
```

### 4.2 Пример структуры

```
Пользователь: asv@asv.com
└── Проект: "Мои квартиры"
    ├── Объект: "Квартира на Колумба" (Волгоград)
    │   ├── Комната: "Спальня" (14 м²)
    │   ├── Комната: "Кухня" (10.5 м²)
    │   └── Комната: "Ванная" (4 м²)
    └── Объект: "Квартира на Танкистов" (Саратов)
        ├── Комната: "Спальня" (12 м²)
        ├── Комната: "Гостиная" (20.8 м²)
        └── Комната: "Кухня" (9 м²)
```

---

## 5. Требования к базе данных

### 5.1 Новая таблица `objects`

```sql
CREATE TABLE objects (
  id VARCHAR(36) PRIMARY KEY,
  project_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  
  -- Основная информация
  name VARCHAR(255) NOT NULL COMMENT 'Название объекта',
  city VARCHAR(100) COMMENT 'Город',
  address VARCHAR(500) COMMENT 'Полный адрес',
  
  -- Настройки
  use_ai_pricing BOOLEAN DEFAULT FALSE COMMENT 'Использовать ИИ для цен',
  last_ai_price_update TIMESTAMP NULL COMMENT 'Дата обновления цен через ИИ',
  
  -- Метаданные
  version INT DEFAULT 1 COMMENT 'Версия для оптимистичной блокировки',
  sort_order INT DEFAULT 0 COMMENT 'Порядок сортировки',
  
  -- Временные метки
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL COMMENT 'Дата мягкого удаления',
  
  -- Индексы
  INDEX idx_project_id (project_id),
  INDEX idx_user_id (user_id),
  INDEX idx_project_sort (project_id, sort_order),
  INDEX idx_deleted (deleted_at),
  
  -- Внешние ключи
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 5.2 Изменения в таблице `rooms`

```sql
ALTER TABLE rooms
  DROP FOREIGN KEY rooms_ibfk_1,  -- Старый FK на projects
  DROP INDEX idx_project_id;

ALTER TABLE rooms
  ADD COLUMN object_id VARCHAR(36) AFTER id,
  ADD CONSTRAINT fk_rooms_objects
    FOREIGN KEY (object_id) REFERENCES objects(id) ON DELETE CASCADE;

ALTER TABLE rooms
  ADD INDEX idx_object_id (object_id),
  ADD INDEX idx_object_sort (object_id, sort_order);

-- Миграция данных: перенос project_id в object_id
UPDATE rooms r
JOIN projects p ON r.project_id = p.id
SET r.object_id = p.id;  -- Временно, пока объекты не созданы
```

### 5.3 Изменения в таблице `projects`

```sql
ALTER TABLE projects
  MODIFY COLUMN name VARCHAR(255) COMMENT 'Название проекта-группы',
  ADD COLUMN description TEXT COMMENT 'Описание проекта',
  ADD COLUMN is_premium BOOLEAN DEFAULT FALSE COMMENT 'Премиум доступ';
```

### 5.4 Ограничения

```sql
-- Триггер для ограничения количества объектов в проекте (10 для бесплатных)
DELIMITER $$

CREATE TRIGGER check_object_limit_before_insert
BEFORE INSERT ON objects
FOR EACH ROW
BEGIN
  DECLARE object_count INT;
  DECLARE is_premium BOOLEAN;
  
  SELECT COUNT(*) INTO object_count
  FROM objects
  WHERE project_id = NEW.project_id AND deleted_at IS NULL;
  
  SELECT is_premium INTO is_premium
  FROM projects
  WHERE id = NEW.project_id;
  
  IF NOT is_premium AND object_count >= 10 THEN
    SIGNAL SQLSTATE '45000'
    SET MESSAGE_TEXT = 'Превышен лимит объектов в проекте (максимум 10 для бесплатных пользователей)';
  END IF;
END$$

DELIMITER ;
```

---

## 6. Требования к API

### 6.1 Новые эндпоинты

#### 6.1.0 Управление пользователем

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/users/me` | Текущий пользователь + статус премиума |
| PUT | `/api/users/me` | Обновление профиля пользователя |

**Пример ответа `/api/users/me`:**
```json
{
  "status": "success",
  "data": {
    "id": "6b2b0699-3488-4f68-8c1d-c072873d2e67",
    "email": "asv@asv.com",
    "name": null,
    "is_premium": false,
    "premium_expires_at": null,
    "limits": {
      "max_objects_per_project": 10,
      "max_projects": -1,
      "max_rooms_per_object": -1
    }
  }
}
```

#### 6.1.1 Управление объектами

| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/projects/:projectId/objects` | Создать объект в проекте |
| GET | `/api/objects/:id` | Получить объект с комнатами |
| PUT | `/api/objects/:id` | Обновить объект |
| DELETE | `/api/objects/:id` | Удалить объект |
| GET | `/api/objects` | Список всех объектов пользователя |

#### 6.1.2 Обновлённые эндпоинты проектов

| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/projects/:id` | Проект со всеми объектами и комнатами |
| PUT | `/api/projects/:id` | Обновить проект (группу) |

### 6.2 Форматы запросов/ответов

#### 6.2.1 Создание объекта

**Запрос:**
```http
POST /api/projects/:projectId/objects
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Квартира на Колумба",
  "city": "Волгоград",
  "address": "ул. Колумба, д. 15, кв. 42",
  "use_ai_pricing": false
}
```

**Ответ:**
```json
{
  "status": "success",
  "data": {
    "id": "uuid-объекта",
    "project_id": "uuid-проекта",
    "name": "Квартира на Колумба",
    "city": "Волгоград",
    "version": 1,
    "created_at": "2026-03-31T12:00:00Z"
  }
}
```

#### 6.2.2 Получение проекта с объектами

**Ответ:**
```json
{
  "status": "success",
  "data": {
    "id": "uuid-проекта",
    "name": "Мои квартиры",
    "objects": [
      {
        "id": "uuid-объекта-1",
        "name": "Квартира на Колумба",
        "city": "Волгоград",
        "rooms": [
          {
            "id": "uuid-комнаты",
            "name": "Спальня",
            "length": 4.0,
            "width": 3.5,
            "height": 2.6,
            "works": [...]
          }
        ]
      }
    ]
  }
}
```

---

## 7. Требования к фронтенду

### 7.1 Новая структура UI

```
┌─────────────────────────────────────────┐
│  Мой ремонт                             │
├─────────────────────────────────────────┤
│  📁 Проекты                             │
│  ├─ 🏢 Мои квартиры (2 объекта)        │
│  │  ├─ 🏠 Квартира на Колумба          │
│  │  └─ 🏠 Квартира на Танкистов        │
│  ├─ 🏢 Дача (1 объект)                 │
│  └─ ➕ Новый проект                    │
├─────────────────────────────────────────┤
│  [Общая смета по проекту]              │
└─────────────────────────────────────────┘
```

### 7.2 Новые компоненты

| Компонент | Назначение |
|-----------|----------|
| `ProjectList` | Список проектов-групп |
| `ObjectList` | Список объектов в проекте |
| `ObjectCard` | Карточка объекта с краткой информацией |
| `CreateProjectModal` | Модальное окно создания проекта |
| `CreateObjectModal` | Модальное окно создания объекта |

### 7.3 Изменения в существующих компонентах

| Компонент | Изменения |
|-----------|----------|
| `RoomList` | Отображение комнат в контексте объекта |
| `SummaryView` | Расчёт сметы по всем объектам проекта |
| `ProjectContext` | Поддержка уровня Object |

---

## 8. Экспорт и импорт

### 8.1 Уровни экспорта

| Уровень | Формат | Что содержит |
|---------|--------|-------------|
| Проект | JSON | Все объекты + все комнаты |
| Объект | JSON | Один объект + все комнаты |
| Комната | JSON | Одна комната со всеми работами |
| Смета | CSV | Сводная таблица по всем объектам |

### 8.2 Формат JSON (проект)

```json
{
  "version": "2.0",
  "exportedAt": "2026-03-31T12:00:00Z",
  "project": {
    "id": "uuid",
    "name": "Мои квартиры",
    "objects": [
      {
        "id": "uuid",
        "name": "Квартира на Колумба",
        "city": "Волгоград",
        "rooms": [...]
      }
    ]
  }
}
```

---

## 9. Логирование

### 9.1 Архитектура логирования

Проект использует **два структурированных логгера** вместо `console.*`:

| Среда | Логгер | Модуль |
|-------|--------|--------|
| Сервер | `winstonLogger` (Winston) | `server/src/middleware/logger.ts` |
| Клиент | Функции логирования | `src/utils/logger.ts` |
| Миграции Knex | `console.log` | CLI-контекст вне Express |

### 9.2 Формат логов (Winston)

```
2026-04-16 14:30:13 [info]: [POST /projects] Created project {"projectId":"uuid","name":"Мои квартиры","duration":13}
2026-04-16 14:30:13 [info]: [POST /projects/:id/objects] Создание нового объекта {"name":"Квартира на Колумба","localId":null,"serverId":"uuid"}
2026-04-16 14:30:14 [warn]: [GET /projects/:id] Project not found {"projectId":"uuid"}
2026-04-16 14:30:14 [error]: Request error {"errorMessage":"...","errorName":"..."}
```

### 9.3 Эндпоинты с логированием

Все эндпоинты из раздела 6 логируют через `winstonLogger` с метаданными:
- ID пользователя (при авторизованных запросах)
- ID проекта/объекта
- Название объекта
- Количество комнат/объектов
- Время выполнения операции (`duration` ms)

### 9.4 Клиентский логгер

```typescript
import { logError, logWarning, logDebug } from '../utils/logger';

logError('ProjectContext', 'saveProject', error, { projectId });
logWarning('Sync', 'Version conflict', { clientVersion, serverVersion });
logDebug('RoomEditor', 'Geometry change', { mode, dimensions });
```

> **Не используйте `console.*` напрямую.** Для предотвращения нарушений планируется ESLint правило `no-console`.

---

## 10. Ограничения и лицензии

### 10.1 Бесплатная версия

| Параметр | Ограничение |
|----------|-------------|
| Проектов | Неограниченно |
| Объектов в проекте | 10 |
| Комнат в объекте | Неограниченно |
| Экспорт | JSON, CSV |

### 10.2 Премиум версия

| Параметр | Ограничение |
|----------|-------------|
| Проектов | Неограниченно |
| Объектов в проекте | Неограниченно |
| Комнат в объекте | Неограниченно |
| Экспорт | JSON, CSV, Excel |
| AI-цены | Включено |

---

## 11. План реализации

### Этап 1: База данных (2 дня)

- [ ] Создать миграцию для таблицы `objects`
- [ ] Изменить таблицу `rooms` (добавить `object_id`)
- [ ] Создать триггер ограничения объектов
- [ ] Протестировать миграцию на тестовой БД

### Этап 2: Backend API (3 дня)

- [ ] Создать репозиторий `ObjectRepository`
- [ ] Реализовать CRUD для объектов
- [ ] Обновить `ProjectRepository` для работы с объектами
- [ ] Обновить `RoomRepository` для связи с объектами
- [ ] Добавить валидацию лимитов
- [ ] Покрыть тестами (unit + integration)

### Этап 3: Frontend (4 дня)

- [ ] Обновить типы TypeScript
- [ ] Создать компоненты для объектов
- [ ] Обновить `ProjectContext`
- [ ] Обновить UI списка проектов
- [ ] Обновить экспорт/импорт
- [ ] Протестировать в браузере

### Этап 4: Документация (1 день)

- [ ] Обновить `INDEX.md`
- [ ] Обновить `README.md`
- [ ] Обновить `docs/LOGGING.md`
- [ ] Создать руководство по миграции

### Этап 5: Тестирование (2 дня)

- [ ] E2E тесты
- [ ] Тесты производительности
- [ ] Проверка миграции данных
- [ ] Исправление багов

**Итого:** 12 рабочих дней

---

## 12. Критерии приёмки

### 12.1 Функциональные

- [ ] Создание проекта с объектами
- [ ] Добавление до 10 объектов в бесплатный проект
- [ ] Добавление неограниченного количества объектов в премиум
- [ ] Редактирование объекта
- [ ] Удаление объекта (мягкое)
- [ ] Экспорт проекта в JSON
- [ ] Импорт проекта из JSON

### 12.2 Нефункциональные

- [ ] Время ответа API < 200ms
- [ ] Поддержка 100+ одновременных пользователей
- [ ] Корректная работа миграции БД
- [ ] Обратная совместимость со старыми данными

### 12.3 Документация

- [ ] `INDEX.md` обновлён
- [ ] API документация актуальна
- [ ] Логи содержат полную информацию

---

## 13. Риски

| Риск | Вероятность | Влияние | Митигация |
|------|------------|---------|-----------|
| Потеря данных при миграции | Средняя | Высокое | Бэкап перед миграцией, тестирование |
| Нарушение обратной совместимости | Средняя | Высокое | Поддержка старого формата API |
| Превышение сроков | Низкая | Среднее | Поэтапная реализация |

---

## 14. Приложения

### Приложение A: Диаграмма ERD

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   users     │       │   projects  │       │   objects   │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │◄──────│ user_id (FK)│◄──────│ project_id  │
│ email       │   1:N │ id (PK)     │   1:N │ id (PK)     │
│ ...         │       │ name        │       │ name        │
└─────────────┘       │ ...         │       │ ...         │
                      └─────────────┘       └─────────────┘
                                                 │
                                                 │ 1:N
                                                 ▼
                                          ┌─────────────┐
                                          │    rooms    │
                                          ├─────────────┤
                                          │ object_id   │
                                          │ id (PK)     │
                                          │ name        │
                                          │ ...         │
                                          └─────────────┘
```

### Приложение B: Пример миграции данных

```sql
-- 1. Создать временную таблицу для маппинга
CREATE TEMPORARY TABLE project_to_object_mapping (
  old_project_id VARCHAR(36),
  new_object_id VARCHAR(36)
);

-- 2. Для каждого проекта создать объект
INSERT INTO objects (id, project_id, user_id, name, city)
SELECT 
  UUID(),
  p.id,
  p.user_id,
  p.name,
  p.city
FROM projects p
WHERE p.deleted_at IS NULL;

-- 3. Сохранить маппинг
INSERT INTO project_to_object_mapping (old_project_id, new_object_id)
SELECT p.id, o.id
FROM projects p
JOIN objects o ON p.user_id = o.user_id AND p.name = o.name;

-- 4. Обновить rooms
UPDATE rooms r
JOIN project_to_object_mapping m ON r.project_id = m.old_project_id
SET r.object_id = m.new_object_id;

-- 5. Удалить временную таблицу
DROP TEMPORARY TABLE project_to_object_mapping;
```

---

## 15. Дополнения к ТЗ (устранение замечаний Code Review)

Нижеприведённые разделы устраняют критические и важные замечания, выявленные при code review.

---

### 15.1 Knex-миграции

Все SQL-примеры из раздела 5 должны быть реализованы как Knex-миграции в файле `server/src/db/migrations/20260331_add_objects.ts`:

```typescript
import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 0. Создаём таблицу для отслеживания удалённых сущностей
  await knex.schema.createTable('deleted_entities', (table) => {
    table.string('id', 36).primary();
    table.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.enum('entity_type', ['project', 'object', 'room', 'work', 'material', 'tool']).notNullable();
    table.string('entity_id', 36).notNullable();  // ID удалённой сущности
    table.json('snapshot').nullable();  // JSON-снимок на момент удаления
    table.timestamp('deleted_at').defaultTo(knex.fn.now());
    table.timestamp('expires_at').notNullable();  // Дата физического удаления (30 дней)
    
    table.index(['user_id', 'deleted_at'], 'idx_deleted_entities_user');
    table.index(['expires_at'], 'idx_deleted_entities_expire');
  });

  // 1. Создаём таблицу objects
  await knex.schema.createTable('objects', (table) => {
    table.string('id', 36).primary();
    table.string('project_id', 36).notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.string('user_id', 36).notNullable().references('id').inTable('users').onDelete('CASCADE');

    // Основная информация
    table.string('name', 255).notNullable();
    table.string('city', 100);
    table.string('address', 500);

    // Настройки
    table.boolean('use_ai_pricing').defaultTo(false);
    table.timestamp('last_ai_price_update').nullable();

    // Метаданные
    table.integer('version').defaultTo(1);
    table.integer('sort_order').defaultTo(0);

    // Временные метки
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();

    // Индексы
    table.index(['project_id'], 'idx_object_project_id');
    table.index(['user_id'], 'idx_object_user_id');
    table.index(['project_id', 'sort_order'], 'idx_project_sort');
    table.index(['deleted_at'], 'idx_object_deleted');
  });

  // 2. Добавляем object_id в rooms
  await knex.schema.alterTable('rooms', (table) => {
    table.string('object_id', 36).nullable().after('id');
    table.index(['object_id'], 'idx_room_object_id');
    table.index(['object_id', 'sort_order'], 'idx_object_sort');
  });

  // 3. Добавляем is_premium в users (не в projects!)
  await knex.schema.alterTable('users', (table) => {
    table.boolean('is_premium').defaultTo(false).after('email');
    table.timestamp('premium_expires_at').nullable().after('is_premium');
  });

  // 4. Добавляем description в projects
  await knex.schema.alterTable('projects', (table) => {
    table.text('description').nullable();
  });

  // 5. Миграция данных: создаём проект-группу и переносим данные
  await migrateExistingData(knex);

  // 6. Добавляем внешний ключ после миграции данных
  await knex.schema.alterTable('rooms', (table) => {
    table.foreign('object_id').references('id').inTable('objects').onDelete('CASCADE');
  });
}

async function migrateExistingData(knex: Knex): Promise<void> {
  // Получаем всех пользователей
  const users = await knex('users').select('id', 'email');
  
  for (const user of users) {
    // Получаем все активные проекты пользователя
    const oldProjects = await knex('projects')
      .where('user_id', user.id)
      .andWhereNull('deleted_at')
      .select('id', 'name', 'city', 'use_ai_pricing', 'last_ai_price_update');
    
    if (oldProjects.length === 0) continue;
    
    // 1. Создаём проект-группу "Мои объекты"
    const defaultProjectId = crypto.randomUUID();
    await knex('projects').insert({
      id: defaultProjectId,
      user_id: user.id,
      name: 'Мои объекты',
      description: 'Автоматически созданный проект при миграции',
      is_premium: false,
      created_at: knex.fn.now(),
    });
    
    // 2. Для каждого старого проекта создаём объект
    for (const oldProject of oldProjects) {
      const objectId = crypto.randomUUID();
      
      await knex('objects').insert({
        id: objectId,
        project_id: defaultProjectId,
        user_id: user.id,
        name: oldProject.name,
        city: oldProject.city,
        use_ai_pricing: oldProject.use_ai_pricing || false,
        last_ai_price_update: oldProject.last_ai_price_update,
        version: 1,
        sort_order: 0,
        created_at: knex.fn.now(),
      });
      
      // 3. Переносим комнаты в новый объект
      await knex('rooms')
        .where('project_id', oldProject.id)
        .update({
          object_id: objectId,
          updated_at: knex.fn.now(),
        });
      
      // 4. Помечаем старый проект как удалённый
      await knex('projects')
        .where('id', oldProject.id)
        .update({
          deleted_at: knex.fn.now(),
          updated_at: knex.fn.now(),
        });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  // Откат в обратном порядке
  await knex.schema.alterTable('rooms', (table) => {
    table.dropForeign('object_id');
    table.dropColumn('object_id');
  });

  await knex.schema.dropTableIfExists('deleted_entities');
  await knex.schema.dropTableIfExists('objects');

  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('is_premium');
    table.dropColumn('premium_expires_at');
  });

  await knex.schema.alterTable('projects', (table) => {
    table.dropColumn('description');
  });
}
```

**Важно:** Лимит объектов (10 для бесплатных) реализуется **на уровне приложения**, не через MySQL-триггер:

```typescript
// server/src/middleware/validation.ts
const MAX_OBJECTS_FREE = 10;

export const validateObjectLimit = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { projectId } = req.params;
  const userId = req.user!.id;

  // Получаем статус премиума из users (не projects!)
  const user = await UserRepository.findById(userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Проверяем лимит только для бесплатных
  if (!user.is_premium) {
    const count = await ObjectRepository.countByProject(projectId);
    if (count >= MAX_OBJECTS_FREE) {
      return res.status(403).json({
        status: 'error',
        error: 'Превышен лимит объектов (максимум 10 для бесплатных пользователей)',
        code: 'OBJECT_LIMIT_REACHED',
        limit: MAX_OBJECTS_FREE,
        upgrade_url: '/api/users/upgrade'  // Ссылка на апгрейд
      });
    }
  }

  next();
};
```

---

### 15.2 Синхронизация (sync/pull, sync/push)

#### 15.2.0 Очистка устаревших удалённых сущностей

**Ежедневный job для очистки истёкших записей:**

```typescript
// server/src/services/cleanupService.ts
import { scheduleJob } from 'node-schedule';
import { query } from '../db/pool.js';
import { winstonLogger } from '../middleware/logger.js';

const DELETED_ENTITY_TTL_DAYS = 30;

export function startCleanupService() {
  // Запускаем каждый день в 3:00
  scheduleJob('0 3 * * *', async () => {
    winstonLogger.info('[CLEANUP] Начало очистки удалённых сущностей');
    
    const result = await query(`
      DELETE FROM deleted_entities
      WHERE expires_at < NOW()
    `);
    
    winstonLogger.info('[CLEANUP] Очистка завершена', { deletedCount: result.affectedRows });
  });
}
```

**При удалении сущности создаётся запись:**

```typescript
// При удалении объекта/комнаты/проекта
await knex('deleted_entities').insert({
  id: crypto.randomUUID(),
  user_id: userId,
  entity_type: 'object',  // или 'room', 'project'
  entity_id: deletedEntityId,
  snapshot: JSON.stringify(deletedEntity),  // Сохраняем снимок
  deleted_at: knex.fn.now(),
  expires_at: knex.raw('DATE_ADD(NOW(), INTERVAL ? DAY)', [DELETED_ENTITY_TTL_DAYS]),
});
```

#### 15.2.1 Расширение типа ChangeLogEntry

```typescript
// server/src/types/index.ts
export interface ChangeLogEntry {
  id: string;
  timestamp: number;
  operation: 'create' | 'update' | 'delete';
  entity: 'project' | 'object' | 'room' | 'work' | 'material' | 'tool' | 'opening' | 'subsection' | 'segment' | 'obstacle' | 'wall_section';
  entityId: string;
  data: unknown;
}
```

#### 15.2.2 Формат sync/pull с объектами

**Запрос:**
```http
GET /api/sync/pull?since=1711881600000
Authorization: Bearer {token}
```

**Ответ:**
```json
{
  "status": "success",
  "data": {
    "projects": [
      {
        "id": "uuid-проекта",
        "name": "Мои квартиры",
        "is_premium": false,
        "objects": [
          {
            "id": "uuid-объекта-1",
            "name": "Квартира на Колумба",
            "city": "Волгоград",
            "rooms": [
              {
                "id": "uuid-комнаты",
                "name": "Спальня",
                "length": 4.0,
                "width": 3.5,
                "height": 2.6,
                "works": "[]",
                "segments": "[]",
                // ... остальные JSON-поля
              }
            ]
          }
        ]
      }
    ],
    "deleted": {
      "projects": [
        {
          "entity_id": "uuid-удалённого-проекта",
          "deleted_at": 1711968000000
        }
      ],
      "objects": [
        {
          "entity_id": "uuid-удалённого-объекта",
          "deleted_at": 1711968000000
        }
      ],
      "rooms": [
        {
          "entity_id": "uuid-удалённой-комнаты",
          "deleted_at": 1711968000000
        }
      ]
    },
    "timestamp": 1711968000000
  }
}
```

**Примечание:** Данные об удалённых сущностях берутся из таблицы `deleted_entities` за последние 30 дней.

#### 15.2.3 Формат sync/push с объектами

**Запрос:**
```http
POST /api/sync/push
Authorization: Bearer {token}
Content-Type: application/json

{
  "changes": [
    {
      "id": "change-uuid",
      "timestamp": 1711968000000,
      "operation": "create",
      "entity": "object",
      "entityId": "new-object-uuid",
      "data": {
        "project_id": "project-uuid",
        "name": "Квартира на Танкистов",
        "city": "Саратов"
      }
    },
    {
      "id": "change-uuid-2",
      "timestamp": 1711968100000,
      "operation": "update",
      "entity": "room",
      "entityId": "room-uuid",
      "data": {
        "object_id": "new-object-uuid",
        "name": "Спальня",
        "length": 5.0
      }
    }
  ]
}
```

**Ответ:**
```json
{
  "status": "success",
  "data": {
    "accepted": ["change-uuid", "change-uuid-2"],
    "conflicts": []
  }
}
```

#### 15.2.4 Обновление ApiStorageProvider

```typescript
// src/api/storage/apiStorageProvider.ts - ключевые изменения

// Новый метод для синхронизации объектов
async syncObjects(projectId: string, objects: ObjectData[]): Promise<void> {
  const existingObjects = await this.loadObjectsByProject(projectId);
  const existingIds = new Set(existingObjects.map(o => o.id));

  for (const obj of objects) {
    if (existingIds.has(obj.id)) {
      await this.updateObjectAsync(obj);
    } else {
      await this.createObjectAsync(projectId, obj);
    }
  }
}

// Обновлённый saveProjectsAsync с поддержкой объектов
async saveProjectsAsync(projects: ProjectData[]): Promise<ProjectData[]> {
  // ... существующий код ...
  
  // Добавляем синхронизацию объектов
  for (const project of projects) {
    if (project.objects) {
      await this.syncObjects(project.id, project.objects);
    }
  }
}
```

---

### 15.3 Стратегия обратной совместимости API

#### 15.3.1 Версионирование

Используется header-based версионирование без изменения URL:

```http
Accept: application/vnd.repair-calc.v2+json
```

По умолчанию (без header) возвращается v1 для обратной совместимости.

#### 15.3.2 Логирование запросов к старым эндпоинтам

**Каждый запрос к старым эндпоинтам логируется** для аналитики использования:

```typescript
// server/src/middleware/deprecation.ts
export const logDeprecation = (req: Request, res: Response, next: NextFunction) => {
  const isV1 = req.headers.accept?.includes('v1') || !req.headers.accept;
  
  if (isV1) {
    winstonLogger.warn('[DEPRECATION] V1 API запрос', {
      method: req.method,
      path: req.path,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });
    
    // Добавляем заголовки депрекейшн
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', 'Sat, 01 Jun 2026 00:00:00 GMT');
    res.setHeader('Link', '</api/v2/projects>; rel="successor-version"');
  }
  
  next();
};
```

**Пример лога:**
```
2026-04-16 14:30:15 [warn]: [DEPRECATION] V1 API запрос {"method":"GET","path":"/api/projects/uuid","userAgent":"Mozilla/5.0...","ip":"192.168.1.1"}
```

#### 15.3.3 Параллельная работа старых и новых эндпоинтов

| Период | Старые эндпоинты | Новые эндпоинты |
|--------|-----------------|-----------------|
| Месяц 1-2 | Работают, deprecated warning | Работают |
| Месяц 3 | Работают в read-only | Работают |
| Месяц 4+ | Удалены | Работают |

**Deprecated header:**
```http
Deprecation: true
Sunset: Sat, 01 Jun 2026 00:00:00 GMT
Link: </api/v2/projects>; rel="successor-version"
```

#### 15.3.3 Трансформация ответов v1 → v2

Для старых клиентов сервер автоматически создаёт виртуальный объект:

```typescript
// server/src/routes/projects.ts
router.get('/:id', async (req, res) => {
  const project = await ProjectRepository.findByIdWithObjects(req.params.id);
  
  // Для v1 клиентов: создаём виртуальный объект из проекта
  if (req.headers.accept?.includes('v1')) {
    return res.json({
      ...project,
      // Виртуальный объект для совместимости
      rooms: project.objects?.[0]?.rooms || [],
      city: project.objects?.[0]?.city || project.city,
    });
  }
  
  // v2 формат
  res.json(project);
});
```

---

### 15.4 TypeScript-типы

#### 15.4.1 Фронтенд типы

```typescript
// src/types/index.ts - новые типы

export type ObjectData = {
  id: string;
  projectId: string;          // Ссылка на проект
  name: string;
  city?: string;
  address?: string;
  useAiPricing?: boolean;
  lastAiPriceUpdate?: string;
  rooms: RoomData[];
  version?: number;
  sortOrder?: number;
};

// Обновлённый ProjectData
export type ProjectData = {
  id: string;
  name: string;
  description?: string;
  isPremium?: boolean;
  objects: ObjectData[];      // Заменяет rooms
  version?: number;
  // Устаревшие поля (для миграции)
  city?: string;              // Deprecated: перенесено в ObjectData
  useAiPricing?: boolean;     // Deprecated: перенесено в ObjectData
  rooms?: RoomData[];         // Deprecated: для обратной совместимости
};

// Обновлённый RoomData
export type RoomData = {
  id: string;
  objectId?: string;          // Новое поле: ссылка на объект
  name: string;
  geometryMode: GeometryMode;
  length: number;
  width: number;
  height: number;
  // ... остальные поля без изменений
  // Устаревшие поля
  projectId?: string;         // Deprecated: заменено на objectId
};
```

#### 15.4.2 Бэкенд типы

```typescript
// server/src/types/index.ts - новые типы

export interface Object {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  city: string | null;
  address: string | null;
  use_ai_pricing: boolean;
  last_ai_price_update: Date | null;
  version: number;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ObjectWithRooms extends Object {
  rooms: Room[];
}

export interface ProjectWithObjects extends Project {
  objects: ObjectWithRooms[];
}

// Обновлённый Room
export interface Room {
  id: string;
  object_id: string;          // Заменяет project_id
  name: string;
  // ... остальные поля без изменений
  // Deprecated
  project_id?: string;        // Оставить для миграции
}
```

---

### 15.5 Изменения ProjectContext и ApiStorageProvider

#### 15.5.0 Стратегия миграции данных

**Решение:** Вариант A — создаётся проект-группа "Мои объекты"

Все существующие проекты пользователя объединяются в один проект-группу:

```typescript
// server/src/db/migrations/20260331_add_objects.ts

// 1. Создаём проект-группу для пользователя
const defaultProjectId = knex.fn.uuid();
await knex('projects').insert({
  id: defaultProjectId,
  user_id: userId,
  name: 'Мои объекты',  // Автоматическое имя по умолчанию
  description: 'Автоматически созданный проект',
  is_premium: false,
});

// 2. Для каждого старого проекта создаём объект в новой группе
for (const oldProject of oldProjects) {
  const objectId = knex.fn.uuid();
  
  await knex('objects').insert({
    id: objectId,
    project_id: defaultProjectId,  // Все объекты в одну группу
    user_id: userId,
    name: oldProject.name,  // "Квартира на Колумба"
    city: oldProject.city,  // "Волгоград"
    use_ai_pricing: oldProject.use_ai_pricing,
    last_ai_price_update: oldProject.last_ai_price_update,
  });
  
  // 3. Переносим комнаты из старого проекта в новый объект
  await knex('rooms')
    .where('project_id', oldProject.id)
    .update({
      object_id: objectId,
      project_id: null,  // Очищаем старую ссылку
    });
}

// 4. Старые проекты помечаем как удалённые
for (const oldProject of oldProjects) {
  await knex('projects')
    .where('id', oldProject.id)
    .update({ deleted_at: knex.fn.now() });
}
```

**Результат миграции для текущего пользователя:**
```
До:
└── Проект: "Квартира на Колумба" (без комнат)
└── Проект: "Квартира на Танкистов" (без комнат)

После:
└── Проект: "Мои объекты"
    ├── Объект: "Квартира на Колумба"
    └── Объект: "Квартира на Танкистов"
```

#### 15.5.1 Новое состояние в ProjectContext

```typescript
// src/contexts/ProjectContext.tsx

interface ProjectContextValue {
  // Существующие поля
  projects: ProjectData[];
  activeProjectId: string;
  activeProject: ProjectData | null;
  
  // Новые поля для объектов
  activeObjectId: string | null;
  activeObject: ObjectData | null;
  
  // Новые actions
  setActiveObjectId: (id: string | null) => void;
  createObject: (data: { projectId: string; name: string; city?: string }) => Promise<ObjectData>;
  updateObject: (object: ObjectData) => void;
  deleteObject: (objectId: string) => Promise<void>;
  
  // Обновлённые actions (теперь работают через activeObject)
  updateRoom: (room: RoomData) => void;
  addRoom: (room: RoomData) => void;
  deleteRoom: (roomId: string) => void;
}
```

#### 15.5.2 Реализация навигации

```typescript
// src/contexts/ProjectContext.tsx

// Иерархия: Project → Object → Room
const [activeProjectId, setActiveProjectIdState] = useState<string>('');
const [activeObjectId, setActiveObjectIdState] = useState<string | null>(null);

// Активный объект
const activeObject = useMemo(() => {
  if (!activeObjectId || !activeProject) return null;
  return activeProject.objects?.find(o => o.id === activeObjectId) || null;
}, [activeProject, activeObjectId]);

// Установка активного проекта сбрасывает активный объект
const setActiveProjectId = useCallback((id: string) => {
  setActiveProjectIdState(id);
  setActiveObjectIdState(null); // Сброс при переключении проекта
  StorageManager.saveActiveProject(id);
}, []);

// Установка активного объекта
const setActiveObjectId = useCallback((id: string | null) => {
  setActiveObjectIdState(id);
  if (id) {
    StorageManager.saveActiveObject(id);
  }
}, []);
```

#### 15.5.3 Обновление scheduleSave

```typescript
// src/contexts/ProjectContext.tsx

const scheduleSave = useCallback((newProjects: ProjectData[]) => {
  pendingSaveRef.current = newProjects;

  if (saveTimeoutRef.current) {
    clearTimeout(saveTimeoutRef.current);
  }

  saveTimeoutRef.current = setTimeout(() => {
    if (pendingSaveRef.current) {
      const projectsToSave = pendingSaveRef.current;

      const saveTask = async () => {
        // localStorage
        StorageManager.saveProjects(projectsToSave);
        setLastSaved(new Date());

        // Сервер (если авторизован)
        if (isAuthenticated) {
          const apiProvider = getApiProvider();
          await apiProvider.saveProjectsAsync(projectsToSave);
          
          // Сохраняем итоги для каждого объекта
          for (const project of projectsToSave) {
            for (const obj of project.objects || []) {
              await saveObjectTotals(obj);
            }
          }
          
          setLastSavedToServer(new Date());
        }
        pendingSaveRef.current = null;
      };

      saveQueue.enqueue(saveTask, projectsToSave);
    }
  }, 2000);
}, [isAuthenticated, getApiProvider]);
```

---

### 15.6 Надёжный алгоритм миграции данных

#### 15.6.1 Knex-миграция с маппингом по ID

```typescript
// server/src/db/migrations/20260331_add_objects.ts

export async function up(knex: Knex): Promise<void> {
  // 1. Создаём таблицу objects (см. 15.1)
  
  // 2. Миграция данных по ID (не по name!)
  const projects = await knex('projects')
    .select('id', 'user_id', 'name', 'city', 'use_ai_pricing', 'last_ai_price_update')
    .whereNull('deleted_at');

  for (const project of projects) {
    // Используем ID проекта как основу для ID объекта
    // Это позволяет сохранить связь для rollback
    const objectId = crypto.randomUUID();
    
    // Создаём объект из проекта
    await knex('objects').insert({
      id: objectId,
      project_id: project.id,
      user_id: project.user_id,
      name: project.name,
      city: project.city,
      use_ai_pricing: project.use_ai_pricing || false,
      last_ai_price_update: project.last_ai_price_update,
      version: 1,
      sort_order: 0,
    });

    // Обновляем комнаты: привязываем к новому объекту
    await knex('rooms')
      .where('project_id', project.id)
      .update({ object_id: objectId });
  }
  
  // 3. Миграция calculated_totals (итоги привязываем к объекту)
  await knex.schema.alterTable('calculated_totals', (table) => {
    table.string('object_id', 36).nullable();
    table.foreign('object_id').references('id').inTable('objects').onDelete('CASCADE');
  });
  
  // Копируем итоги проекта в итоги объекта
  await knex.raw(`
    INSERT INTO calculated_totals (object_id, total_area, total_works, total_materials, total_tools, grand_total, calculated_at)
    SELECT o.id, ct.total_area, ct.total_works, ct.total_materials, ct.total_tools, ct.grand_total, ct.calculated_at
    FROM calculated_totals ct
    JOIN objects o ON o.project_id = ct.project_id
  `);
}
```

#### 15.6.2 Миграция на фронтенде

```typescript
// src/utils/migration.ts

export function migrateProjectV1ToV2(project: ProjectDataV1): ProjectData {
  // Создаём объект из проекта v1
  const object: ObjectData = {
    id: crypto.randomUUID(),
    projectId: project.id,
    name: project.name,
    city: project.city,
    useAiPricing: project.useAiPricing,
    lastAiPriceUpdate: project.lastAiPriceUpdate,
    rooms: project.rooms.map(room => ({
      ...room,
      objectId: undefined, // Будет установлен при сохранении
    })),
  };

  return {
    id: project.id,
    name: project.name, // Проект-группа с тем же именем
    objects: [object],
    version: 2,
  };
}

export function needsV2Migration(projects: unknown[]): boolean {
  return projects.some(p => 
    p && typeof p === 'object' && 
    'rooms' in p && !('objects' in p)
  );
}
```

---

### 15.7 calculated_totals — привязка к объектам

#### 15.7.1 Изменения в БД

```typescript
// Миграция calculated_totals
await knex.schema.alterTable('calculated_totals', (table) => {
  table.string('object_id', 36).nullable();
  table.foreign('object_id').references('id').inTable('objects').onDelete('CASCADE');
  table.dropForeign('project_id'); // Убираем FK с project_id
  // project_id оставляем для агрегации итогов по проекту
});
```

#### 15.7.2 Логика расчёта итогов

```typescript
// server/src/services/totalsService.ts

// Итоги объекта = сумма по всем комнатам объекта
export async function calculateObjectTotals(objectId: string): Promise<ObjectTotals> {
  const rooms = await RoomRepository.findByObject(objectId);
  
  let totalArea = 0;
  let totalWorks = 0;
  let totalMaterials = 0;
  let totalTools = 0;

  for (const room of rooms) {
    const roomData = deserializeRoom(room);
    const metrics = calculateRoomMetrics(roomData);
    const costs = calculateRoomCosts(roomData);
    
    totalArea += metrics.floorArea;
    totalWorks += costs.totalWork;
    totalMaterials += costs.totalMaterial;
    totalTools += costs.totalTools;
  }

  return {
    object_id: objectId,
    total_area: totalArea,
    total_works: totalWorks,
    total_materials: totalMaterials,
    total_tools: totalTools,
    grand_total: totalWorks + totalMaterials + totalTools,
  };
}

// Итоги проекта = сумма итогов всех объектов
export async function calculateProjectTotals(projectId: string): Promise<ProjectTotals> {
  const objects = await ObjectRepository.findByProject(projectId);
  
  let grandTotal = 0;
  for (const obj of objects) {
    const totals = await calculateObjectTotals(obj.id);
    grandTotal += totals.grand_total;
  }

  return { project_id: projectId, grand_total: grandTotal };
}
```

---

### 15.8 Миграция AI Pricing

```typescript
// server/src/db/migrations/20260331_add_objects.ts (продолжение)

// Перенос use_ai_pricing с projects на objects уже выполнен в основной миграции
// Поле в projects оставляем для наследования при создании новых объектов

// Обновление AI-кеша
await knex.schema.alterTable('ai_requests', (table) => {
  table.string('object_id', 36).nullable();
  table.foreign('object_id').references('id').inTable('objects').onDelete('SET NULL');
});

// Миграция существующих записей
await knex.raw(`
  UPDATE ai_requests ar
  JOIN objects o ON o.project_id = ar.project_id
  SET ar.object_id = o.id
  WHERE ar.project_id IS NOT NULL
`);
```

---

### 15.9 Совместимость экспорта/импорта v1↔v2

#### 15.9.1 Формат v2.0

```json
{
  "version": "2.0",
  "exportedAt": "2026-03-31T12:00:00Z",
  "project": {
    "id": "uuid",
    "name": "Мои квартиры",
    "objects": [
      {
        "id": "uuid",
        "name": "Квартира на Колумба",
        "city": "Волгоград",
        "rooms": [...]
      }
    ]
  }
}
```

#### 15.9.2 Формат v1.0 (для импорта)

```json
{
  "version": "1.0",
  "exportedAt": "2026-03-30T12:00:00Z",
  "project": {
    "id": "uuid",
    "name": "Квартира на Колумба",
    "city": "Волгоград",
    "rooms": [...]
  }
}
```

#### 15.9.3 Конвертер v1 → v2

```typescript
// src/utils/importExport.ts

export function convertV1ToV2(data: ExportDataV1): ExportDataV2 {
  // v1 проект = один объект в v2
  const object: ObjectData = {
    id: crypto.randomUUID(),
    projectId: data.project.id,
    name: data.project.name,
    city: data.project.city,
    useAiPricing: data.project.useAiPricing,
    rooms: data.project.rooms.map(room => ({
      ...room,
      objectId: undefined,
    })),
  };

  // Создаём проект-группу
  return {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    project: {
      id: data.project.id,
      name: data.project.name,
      objects: [object],
    },
  };
}

export async function importProject(data: unknown): Promise<ProjectData> {
  const version = (data as any).version || '1.0';
  
  if (version === '1.0') {
    return convertV1ToV2(data as ExportDataV1).project;
  }
  
  if (version === '2.0') {
    return (data as ExportDataV2).project;
  }
  
  throw new Error(`Неподдерживаемая версия формата: ${version}`);
}
```

---

### 15.10 Zod-схемы валидации

```typescript
// server/src/middleware/validation.ts

import { z } from 'zod';

export const CreateObjectSchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(255, 'Максимум 255 символов'),
  city: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  use_ai_pricing: z.boolean().optional().default(false),
});

export const UpdateObjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  city: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  use_ai_pricing: z.boolean().optional(),
  last_ai_price_update: z.string().datetime().nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export const ObjectIdSchema = z.object({
  id: z.string().uuid('Некорректный ID объекта'),
});

export const ProjectIdSchema = z.object({
  projectId: z.string().uuid('Некорректный ID проекта'),
});

// Middleware для валидации
export const validateBody = (schema: z.ZodSchema) => 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          status: 'error',
          errors: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
```

---

### 15.11 Решение по полю city

**Решение:** Поле `city` переносится из `projects` в `objects` полностью.

| Этап | Действие |
|------|----------|
| Миграция | Значения `city` копируются из `projects` в создаваемые `objects` |
| После миграции | Поле `city` в `projects` остаётся для совместимости, но не используется |
| v2 API | `city` читается/пишется только в `objects` |
| UI | Поле города отображается на уровне объекта |

```sql
-- Миграция (в Knex)
UPDATE objects o
JOIN projects p ON p.id = o.project_id
SET o.city = p.city
WHERE o.city IS NULL;
```

---

### 15.12 Обновлённый план реализации

| Этап | Срок | Задачи |
|------|------|--------|
| 1. База данных | 3 дня | Knex-миграции, миграция данных, тестирование |
| 2. Backend API | 4 дня | Репозитории, CRUD, синхронизация, Zod-валидация |
| 3. Frontend | 5 дней | Типы, компоненты, контекст, экспорт/импорт |
| 4. Документация | 1 день | Обновление всех docs |
| 5. Тестирование | 3 дня | E2E, интеграция, миграция данных |

**Итого:** 16 рабочих дней (увеличено на 4 дня для учёта замечаний)

---

**Документ утверждён:**  
**Дата:** 2026-03-31  
**Версия:** 2.0 (с дополнениями Code Review)
