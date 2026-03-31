# 🚀 План реализации — Версия 1.1

## Статус: Готово к реализации

**Утверждено:** 2026-03-31  
**Версия ТЗ:** 1.1

---

## 📋 Сводка изменений

| Компонент | Изменений | Сложность |
|-----------|-----------|-----------|
| База данных | 3 таблицы, 1 миграция | 🔴 Высокая |
| Backend API | 6 новых эндпоинтов | 🟡 Средняя |
| Frontend | 4 новых компонента | 🟡 Средняя |
| Синхронизация | Обновление sync/pull, sync/push | 🔴 Высокая |
| Документация | 5 файлов обновлено | 🟢 Низкая |

---

## 📁 Файлы для создания

### Миграции БД
- [ ] `server/src/db/migrations/20260331_add_objects.ts`

### Backend
- [ ] `server/src/db/repositories/object.repo.ts`
- [ ] `server/src/routes/objects.ts`
- [ ] `server/src/routes/users.ts`
- [ ] `server/src/middleware/deprecation.ts`
- [ ] `server/src/middleware/validation.ts` (обновить)
- [ ] `server/src/services/cleanupService.ts`
- [ ] `server/src/types/index.ts` (обновить)

### Frontend
- [ ] `src/types/index.ts` (обновить ObjectData, ProjectData)
- [ ] `src/api/objects.ts`
- [ ] `src/api/users.ts`
- [ ] `src/components/objects/ObjectList.tsx`
- [ ] `src/components/objects/ObjectCard.tsx`
- [ ] `src/components/objects/CreateObjectModal.tsx`
- [ ] `src/components/projects/CreateProjectModal.tsx`
- [ ] `src/contexts/ProjectContext.tsx` (обновить)
- [ ] `src/api/storage/apiStorageProvider.ts` (обновить)

### Документация
- [x] `docs/TECHNICAL-SPECIFICATION.md`
- [ ] `docs/MIGRATION_GUIDE.md`
- [ ] `INDEX.md` (обновить)
- [ ] `README.md` (обновить)

---

## 🎯 Этапы реализации

### Этап 1: База данных (2 дня)

**Файлы:** `server/src/db/migrations/20260331_add_objects.ts`

```bash
# Создать миграцию
cd server
npx knex migrate:make add_objects
```

**Задачи:**
- [ ] Создать таблицу `objects`
- [ ] Создать таблицу `deleted_entities`
- [ ] Добавить `is_premium` в `users`
- [ ] Добавить `object_id` в `rooms`
- [ ] Написать функцию `migrateExistingData()`
- [ ] Протестировать на тестовой БД

**Критерии приёмки:**
- Миграция применяется без ошибок
- Данные мигрируют корректно (1 проект → 1 объект)
- Откат миграции работает

---

### Этап 2: Backend Repository (1 день)

**Файлы:** `server/src/db/repositories/object.repo.ts`

**Методы:**
- [ ] `create(data)` — создание объекта
- [ ] `findById(id)` — поиск по ID
- [ ] `findByProjectId(projectId)` — список объектов проекта
- [ ] `findByUserId(userId)` — все объекты пользователя
- [ ] `update(id, data)` — обновление
- [ ] `delete(id)` — мягкое удаление
- [ ] `countByProject(projectId)` — подсчёт для лимита

**Критерии приёмки:**
- Все методы покрыты unit-тестами
- Лимит 10 объектов работает для бесплатных

---

### Этап 3: Backend API (2 дня)

**Файлы:** `server/src/routes/objects.ts`, `server/src/routes/users.ts`

**Эндпоинты:**
- [ ] `GET /api/users/me` — пользователь + лимиты
- [ ] `POST /api/projects/:projectId/objects` — создать объект
- [ ] `GET /api/objects` — список объектов
- [ ] `GET /api/objects/:id` — объект с комнатами
- [ ] `PUT /api/objects/:id` — обновить объект
- [ ] `DELETE /api/objects/:id` — удалить объект

**Middleware:**
- [ ] `validateObjectLimit` — проверка лимита
- [ ] `logDeprecation` — логирование старых запросов

**Критерии приёмки:**
- Все эндпоинты возвращают корректные данные
- Лимиты соблюдаются
- Логи пишутся

---

### Этап 4: Синхронизация (2 дня)

**Файлы:** `server/src/routes/sync.ts`

**Изменения:**
- [ ] Обновить `sync/pull` с поддержкой объектов
- [ ] Обновить `sync/push` с поддержкой объектов
- [ ] Добавить обработку `deleted` сущностей
- [ ] Интеграция с `deleted_entities`

**Критерии приёмки:**
- Синхронизация работает с новой структурой
- Удалённые сущности корректно передаются

---

### Этап 5: Frontend Типы (0.5 дня)

**Файлы:** `src/types/index.ts`

**Изменения:**
- [ ] Добавить `ObjectData`
- [ ] Обновить `ProjectData.objects`
- [ ] Обновить `RoomData.objectId`
- [ ] Добавить депрекейшн-комментарии

---

### Этап 6: Frontend API (0.5 дня)

**Файлы:** `src/api/objects.ts`, `src/api/users.ts`

**Методы:**
- [ ] `getUserMe()` — получить пользователя
- [ ] `getObjects()` — список объектов
- [ ] `getObject(id)` — объект с комнатами
- [ ] `createObject(projectId, data)` — создать
- [ ] `updateObject(id, data)` — обновить
- [ ] `deleteObject(id)` — удалить

---

### Этап 7: Frontend Компоненты (2 дня)

**Компоненты:**
- [ ] `ObjectList` — список объектов
- [ ] `ObjectCard` — карточка объекта
- [ ] `CreateObjectModal` — создание объекта
- [ ] `CreateProjectModal` — создание проекта

**Обновления:**
- [ ] `ProjectContext` — поддержка объектов
- [ ] `ApiStorageProvider` — синхронизация объектов
- [ ] `SummaryView` — смета по всем объектам

---

### Этап 8: Документация (1 день)

**Файлы:**
- [ ] `docs/MIGRATION_GUIDE.md` — руководство по миграции
- [ ] `INDEX.md` — обновить структуру
- [ ] `README.md` — обновить терминологию

---

## 📊 Итого

| Этап | Дней | Статус |
|------|------|--------|
| 1. База данных | 2 | ⏳ Ожидает |
| 2. Backend Repository | 1 | ⏳ Ожидает |
| 3. Backend API | 2 | ⏳ Ожидает |
| 4. Синхронизация | 2 | ⏳ Ожидает |
| 5. Frontend Типы | 0.5 | ⏳ Ожидает |
| 6. Frontend API | 0.5 | ⏳ Ожидает |
| 7. Frontend Компоненты | 2 | ⏳ Ожидает |
| 8. Документация | 1 | ⏳ Ожидает |

**Всего:** 11 рабочих дней

---

## ✅ Готовность к началу

- [x] ТЗ утверждено
- [x] Терминология определена
- [x] Структура БД спроектирована
- [x] API эндпоинты описаны
- [x] Форматы данных определены
- [x] Стратегия миграции утверждена
- [ ] Команда готова к реализации

---

**Следующий шаг:** Приступить к **Этапу 1** (База данных)
