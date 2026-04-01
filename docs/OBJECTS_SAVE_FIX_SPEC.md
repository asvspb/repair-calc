# Техническое задание: Исправление сохранения проектов с несколькими объектами

**Дата:** 2026-04-01  
**Статус:** 📋 Спецификация  
**Приоритет:** 🔴 Критический  

---

## 1. Описание проблемы

Текущая архитектура предполагает иерархию **Проект → Объект → Комната**, однако при работе с несколькими объектами данные сохраняются некорректно:

- Проект всегда сохраняется **как один объект** со всеми комнатами
- Второй и последующие объекты **не создаются на сервере**
- При загрузке данных с сервера структура объектов **теряется**

### Воспроизведение

1. Пользователь создаёт проект → backend автоматически создаёт первый объект
2. Комнаты добавляются через `POST /api/projects/:id/rooms` → все попадают в первый объект
3. Автосохранение использует старый путь (через `rooms`), а не новый (через `objects`)
4. При перезагрузке `syncPull` возвращает плоский список комнат без привязки к объектам

---

## 2. Корневые причины

Выявлено **8 точек разрыва** в потоке данных между frontend и backend.

### 2.1. Сервер не возвращает objects при создании проекта

**Файл:** `server/src/db/repositories/project.repo.ts` → `create()`  
**Файл:** `server/src/routes/projects.ts` → `POST /`

**Суть:** Backend в транзакции создаёт проект + первый объект, но `findById()` возвращает проект **без поля `objects`**. Frontend получает:

```json
{ "id": "uuid", "name": "Проект", "rooms": [] }
```

Вместо:

```json
{ "id": "uuid", "name": "Проект", "objects": [{ "id": "obj-uuid", "rooms": [] }] }
```

**Последствия:** Когда пользователь добавляет комнату, `addRoomToProject()` в `projectObjects.ts` создаёт **новый клиентский объект** с `crypto.randomUUID()`. Теперь на сервере один объект (из транзакции `create`), а на клиенте — другой (с другим ID). При сохранении через `updateWithObjects` серверный объект удаляется, клиентский создаётся заново.

### 2.2. `syncPull` не возвращает objects

**Файл:** `server/src/db/repositories/project.repo.ts` → `findAllByUserIdForSync()`  
**Файл:** `server/src/routes/sync.ts` → `GET /pull`

**Суть:** Метод `findAllByUserIdForSync()` загружает комнаты из всех объектов, но возвращает их **плоским списком** `rooms[]`:

```typescript
// Текущая реализация — возвращает { ...project, rooms: [...все комнаты...] }
static async findAllByUserIdForSync(userId: string): Promise<(Project & { rooms: Room[] })[]> {
  // ...
  for (const obj of objects) {
    const objRooms = await query(...);
    rooms = rooms.concat(objRooms);  // ← Всё сливается в один массив
  }
  return { ...project, rooms };
}
```

**Последствия:** При загрузке на клиенте `apiToClientProject()` не находит `objects` в ответе и создаёт проект со старой структурой `rooms[]`. Клиентская миграция `migrateProjectToObjects()` затем создаёт объекты с **новыми UUID**, которые не совпадают с серверными.

### 2.3. `POST /api/projects/:id/rooms` не привязывает комнату к объекту

**Файл:** `server/src/routes/rooms.ts`  
**Файл:** `server/src/db/repositories/room.repo.ts` → `create()`

**Суть:** Endpoint создания комнаты привязывает её к `project_id`, но может не указывать `object_id`. Комнаты становятся «осиротевшими» — не принадлежат ни одному объекту. Метод `findFullProject()` (см. п. 2.8) запрашивает комнаты по `project_id`, поэтому их видно, но связь с объектами потеряна.

**Текущий вызов на клиенте:**
```typescript
// src/api/rooms.ts
export async function createRoom(projectId: string, room: RoomData) {
  return fetchJson(`/api/projects/${projectId}/rooms`, { ... });
}
```

Объект не указывается — комната привязывается к проекту напрямую.

### 2.4. `reorderRooms` обновляет устаревшее поле `rooms`

**Файл:** `src/contexts/ProjectContext.tsx` → `reorderRooms()`

**Суть:**
```typescript
const reorderRooms = useCallback((newRooms: RoomData[]) => {
  const updatedProject = {
    ...activeProject,
    rooms: newRooms  // ← Обновляет устаревшее поле вместо objects[].rooms
  };
  updateActiveProject(updatedProject);
}, [activeProject, updateActiveProject]);
```

**Последствия:** Переупорядочивание комнат записывает данные в `project.rooms` вместо `project.objects[N].rooms`. При следующем сохранении данные в objects остаются старыми.

### 2.5. Локальный `createProject` без objects

**Файл:** `src/contexts/ProjectContext.tsx` → `createProject()` (ветка `!isAuthenticated`)

**Суть:**
```typescript
const newProject: ProjectData = {
  id: `local-${Date.now()}`,
  name: data.name,
  city: data.city,
  rooms: [],  // ← Нет objects: []
};
```

**Последствия:** Локальные проекты создаются без `objects`. При последующей миграции на сервер (когда пользователь авторизуется) структура объектов также отсутствует.

### 2.6. `createProjectAsync` не получает серверный объект

**Файл:** `src/api/storage/apiStorageProvider.ts` → `createProjectAsync()`

**Суть:** После вызова `projectsApi.createProject(data)` ответ сервера не содержит `objects`. Метод `apiToClientProject()` создаёт проект без объектов. Далее `migrateProject()` в ProjectContext добавляет `objects: []`.

Когда пользователь добавляет комнату, `addRoomToProject()` создаёт новый объект с `crypto.randomUUID()` (строка в `projectObjects.ts`). Этот UUID **не совпадает** с автоматически созданным на сервере.

### 2.7. Миграция проектов использует старый rooms API

**Файл:** `src/api/storage/apiStorageProvider.ts` → `saveProjectsAsync()` (ветка миграции)

**Суть:**
```typescript
// При миграции локального проекта на сервер:
for (const room of allRooms) {
  await roomsApi.createRoom(newProject.id, room);  // ← Старый API без object_id
}
```

**Последствия:** Комнаты создаются через `POST /projects/:id/rooms`, минуя привязку к объекту.

### 2.8. `GET /projects/:id` возвращает rooms, а не objects

**Файл:** `server/src/db/repositories/project.repo.ts` → `findFullProject()`

**Суть:**
```typescript
static async findFullProject(id: string, userId: string) {
  const rooms = await query(
    'SELECT * FROM rooms WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order',
    [id]
  );
  return { ...project, rooms };  // ← Плоский список, без objects
}
```

**Последствия:** Endpoint `GET /projects/:id` используется в `getProjectWithRoomsAsync()` и возвращает данные без иерархии объектов.

---

## 3. Схема текущего (сломанного) потока данных

```
Frontend                          Backend                       Database
─────────────────────────────────────────────────────────────────────────

1. createProject({name})  ──→  POST /api/projects
                                  │
                                  ├── INSERT projects (id=P1)
                                  ├── INSERT objects (id=O1, project_id=P1)  ← Авто
                                  └── findById(P1) → { id: P1, rooms: [] }   ← БЕЗ objects!
                          ←──  Response: { id: P1, rooms: [] }

2. addRoom(room)          ──→  addRoomToProject()
   │                              ├── objects.length === 0 → создаёт новый объект
   │                              └── { objects: [{ id: O2_LOCAL, rooms: [room] }] }
   │                                                    ↑ ДРУГОЙ ID, не O1!
   │
3. scheduleSave()         ──→  saveProjectsAsync()
   │                              ├── updateProjectAsync(project)
   │                              │     └── objects.length > 0
   │                              │           └── updateProjectWithObjects(P1, { objects: [O2_LOCAL] })
   │                              │                 ├── DELETE objects WHERE id NOT IN (O2_LOCAL)
   │                              │                 │     └── Удаляет O1 (серверный!)
   │                              │                 └── INSERT objects (id=O3_NEW)  ← Ещё новый ID
   │                              │
4. Перезагрузка           ──→  syncPull()
                                  └── findAllByUserIdForSync()
                                        └── returns { rooms: [...все комнаты плоско...] }
                          ←──  Response: { projects: [{ rooms: [...] }] }  ← БЕЗ objects!

5. apiToClientProject()        → objects не найден → создаёт { rooms: [...] }
   migrateProjectToObjects()   → создаёт { objects: [{ id: O4_NEW, rooms: [...] }] }
                                                         ↑ СНОВА НОВЫЙ ID
```

---

## 4. Целевая архитектура

### 4.1. Целевой поток данных

```
Frontend                          Backend                       Database
─────────────────────────────────────────────────────────────────────────

1. createProject({name})  ──→  POST /api/projects
                                  ├── INSERT projects + INSERT objects
                                  └── findByIdWithObjects(P1)
                          ←──  { id: P1, objects: [{ id: O1, rooms: [] }] }

2. addRoom(room)               addRoomToProject()
                                  └── objects[0] уже есть (id=O1)
                                  └── { objects: [{ id: O1, rooms: [room] }] }

3. scheduleSave()         ──→  PUT /api/projects/:id/with-objects
                                  └── { objects: [{ id: O1, rooms: [...] }] }
                                        ├── UPDATE objects WHERE id=O1
                                        └── UPSERT rooms

4. syncPull()             ──→  GET /api/sync/pull
                                  └── findAllByUserIdForSyncWithObjects()
                          ←──  { projects: [{ objects: [{ id: O1, rooms: [...] }] }] }

5. apiToClientProject()        → objects найден → { objects: [...] }
```

### 4.2. Принципы решения

1. **Сервер всегда возвращает полную иерархию** `project → objects → rooms`
2. **Клиент никогда не создаёт объекты с локальными UUID** — всегда использует ID с сервера
3. **Единственный endpoint для сохранения** — `PUT /projects/:id/with-objects`
4. **Старые endpoints (`/rooms`, `with-rooms`) помечены как deprecated** и перенаправляют на новые
5. **Обратная совместимость** — при загрузке данных без `objects` выполняется автомиграция

---

## 5. План задач

### Задача 1: Backend — возврат objects из всех endpoints

**Приоритет:** 🔴 Критический  
**Оценка:** 3–4 часа

#### 1.1. Новый метод `findByIdWithObjects` в `project.repo.ts`

```typescript
static async findByIdWithObjects(id: string, userId: string): Promise<ProjectWithObjects | null> {
  const project = await this.findByIdAndUserId(id, userId);
  if (!project) return null;

  const objects = await ObjectRepository.findProjectWithObjects(id);
  return { ...project, objects };
}
```

#### 1.2. Новый метод `findAllByUserIdForSyncWithObjects` в `project.repo.ts`

```typescript
static async findAllByUserIdForSyncWithObjects(userId: string)
  : Promise<(Project & { objects: ObjectWithRooms[] })[]> {
  const projects = await this.findByUserId(userId);
  return Promise.all(projects.map(async (project) => {
    const objects = await ObjectRepository.findProjectWithObjects(project.id);
    return { ...project, objects };
  }));
}
```

#### 1.3. Обновить `POST /api/projects` в `routes/projects.ts`

После создания проекта вернуть полную структуру с objects:

```typescript
// Вместо:
const project = await this.findById(id);
// Использовать:
const project = await ProjectRepository.findByIdWithObjects(id, req.user!.id);
```

#### 1.4. Обновить `GET /api/projects/:id` в `routes/projects.ts`

Заменить `findFullProject` на `findByIdWithObjects`.

#### 1.5. Обновить `GET /api/sync/pull` в `routes/sync.ts`

Использовать `findAllByUserIdForSyncWithObjects` вместо `findAllByUserIdForSync`.

#### 1.6. Обновить типы ответов

Добавить/обновить `ProjectWithObjects` тип в `server/src/types/index.ts`.

---

### Задача 2: Backend — привязка комнат к объектам

**Приоритет:** 🔴 Критический  
**Оценка:** 2 часа

#### 2.1. Обновить `POST /api/projects/:id/rooms`

Автоматически привязывать комнату к первому объекту проекта, если `object_id` не указан:

```typescript
router.post('/:projectId/rooms', async (req, res) => {
  // Если object_id не указан — находим первый объект проекта
  let objectId = req.body.object_id;
  if (!objectId) {
    const objects = await ObjectRepository.findByProjectId(projectId);
    if (objects.length > 0) {
      objectId = objects[0].id;
    } else {
      // Создаём объект, если нет
      const obj = await ObjectRepository.create(projectId, userId, { name: project.name });
      objectId = obj.id;
    }
  }
  const room = await RoomRepository.createForObject(objectId, data);
  // ...
});
```

#### 2.2. Проверить `RoomRepository.create` vs `createForObject`

Убедиться, что `createForObject` используется везде и правильно указывает `object_id` и `project_id`.

---

### Задача 3: Frontend — корректная инициализация после создания проекта

**Приоритет:** 🔴 Критический  
**Оценка:** 2–3 часа

#### 3.1. Обновить `apiToClientProject` в `src/api/projects.ts`

Парсинг `objects` из ответа сервера уже реализован, но нужно убедиться, что он работает корректно с новыми ответами сервера (после задачи 1).

#### 3.2. Обновить `createProjectAsync` в `apiStorageProvider.ts`

После создания проекта на сервере ответ уже будет содержать `objects`. Убедиться, что `apiToClientProject` правильно парсит его.

#### 3.3. Обновить локальный `createProject` в `ProjectContext.tsx`

Для неавторизованных пользователей:

```typescript
const newProject: ProjectData = {
  id: `local-${Date.now()}`,
  name: data.name,
  city: data.city,
  objects: [],  // ← Добавить
};
```

---

### Задача 4: Frontend — исправление reorderRooms

**Приоритет:** 🟡 Средний  
**Оценка:** 1 час

#### 4.1. Новая функция `reorderRoomsInProject` в `projectObjects.ts`

```typescript
export function reorderRoomsInProject(
  project: ProjectData,
  objectId: string,
  newRooms: RoomData[]
): ProjectData {
  if (!project.objects) return project;
  return {
    ...project,
    objects: project.objects.map(obj =>
      obj.id === objectId
        ? { ...obj, rooms: newRooms }
        : obj
    ),
  };
}
```

#### 4.2. Обновить `reorderRooms` в ProjectContext

Использовать новую функцию вместо прямой записи в `project.rooms`.

---

### Задача 5: Frontend — миграция saveProjectsAsync

**Приоритет:** 🔴 Критический  
**Оценка:** 2 часа

#### 5.1. Обновить ветку миграции локальных проектов

Вместо создания комнат поштучно через `roomsApi.createRoom()`, после создания проекта использовать `updateProjectWithObjects()` для атомарной записи всей иерархии:

```typescript
// Вместо:
for (const room of allRooms) {
  await roomsApi.createRoom(newProject.id, room);
}

// Использовать:
await projectsApi.updateProjectWithObjects(newProject.id, {
  name: project.name,
  objects: project.objects?.map(obj => ({
    name: obj.name,
    city: obj.city ?? null,
    rooms: obj.rooms.map(room => clientToApiRoom(room)),
  })) || [{
    name: project.name,
    rooms: allRooms.map(room => clientToApiRoom(room)),
  }],
});
```

#### 5.2. Обновить ветку обновления существующих проектов

`updateProjectAsync` уже проверяет `project.objects.length > 0` и использует `updateProjectWithObjects`. Нужно убедиться, что клиентские объекты содержат серверные ID (не локальные UUID).

---

### Задача 6: Frontend — удалить дублирование rooms/objects

**Приоритет:** 🟡 Средний  
**Оценка:** 1–2 часа

#### 6.1. Обновить тип `ProjectData`

Пометить `rooms` как `@deprecated` более явно, добавить runtime-проверки:

```typescript
export type ProjectData = {
  id: string;
  name: string;
  objects: ObjectData[];      // Единственный источник правды
  /** @deprecated Используйте objects[].rooms */
  rooms?: RoomData[];         // Только для обратной совместимости при загрузке
  // ...
};
```

#### 6.2. Ревизия всех мест использования `project.rooms`

Поиск по коду и замена на `getAllRooms(project)` или `project.objects[N].rooms`.

Известные места:
- `src/App.tsx` — частично исправлено, но есть остатки
- `src/contexts/ProjectContext.tsx` → `reorderRooms` (см. задачу 4)
- `src/utils/migration.ts` → `calculateSimilarity` — использует `local.rooms.length`
- `src/components/summary/*` — возможно используют прямой доступ

---

### Задача 7: Тестирование

**Приоритет:** 🔴 Критический  
**Оценка:** 3–4 часа

#### 7.1. Unit-тесты

- Тест `projectObjects.ts` — миграция, добавление/удаление комнат
- Тест `apiToClientProject` — парсинг ответа с objects
- Тест `project.repo.ts` — `findByIdWithObjects`, `findAllByUserIdForSyncWithObjects`

#### 7.2. Integration-тесты

- Создание проекта → проверка наличия objects в ответе
- Добавление комнаты → проверка привязки к object
- Сохранение проекта с 2 объектами → проверка на сервере
- Перезагрузка → проверка сохранности структуры objects

#### 7.3. E2E-тесты

- Полный цикл: создание проекта → добавление 2 объектов → добавление комнат → сохранение → перезагрузка → проверка

---

## 6. Порядок выполнения

```
Задача 1 (Backend endpoints)     ──┐
                                    ├──→ Задача 3 (Frontend инициализация)
Задача 2 (Backend привязка rooms) ─┘        │
                                             ├──→ Задача 5 (saveProjectsAsync)
                                             │
                                             ├──→ Задача 4 (reorderRooms)
                                             │
                                             └──→ Задача 6 (cleanup rooms/objects)
                                                      │
                                                      └──→ Задача 7 (Тестирование)
```

**Критический путь:** Задачи 1 → 3 → 5  
**Общая оценка:** 14–18 часов

---

## 7. Риски и ограничения

| Риск | Вероятность | Влияние | Митигация |
|------|------------|---------|----------|
| Потеря данных при миграции | Средняя | 🔴 | Бэкап в localStorage сохраняется; rollback через JSON-импорт |
| Несовместимость с кэшированными данными | Высокая | 🟡 | Клиентская `migrateProjectToObjects()` обрабатывает старый формат |
| Rate limiting при массовом обновлении | Средняя | 🟡 | Используем транзакционный `with-objects` вместо поштучных запросов |
| Ошибки в concurrent-сохранении | Низкая | 🟡 | `saveQueue` гарантирует последовательность |

---

## 8. Критерии приёмки

1. ✅ Создание проекта возвращает `objects[]` с первым объектом
2. ✅ `syncPull` возвращает полную иерархию `project → objects → rooms`
3. ✅ Добавление комнаты привязывает её к существующему объекту (не создаёт новый)
4. ✅ Сохранение проекта с 2+ объектами корректно записывает все объекты на сервер
5. ✅ После перезагрузки страницы структура objects сохраняется
6. ✅ `reorderRooms` работает с objects, а не с устаревшим `project.rooms`
7. ✅ Все существующие тесты проходят
8. ✅ Нет регрессий для однообъектных проектов
