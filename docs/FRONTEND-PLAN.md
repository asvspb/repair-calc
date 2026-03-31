# 🎨 Frontend Implementation Plan

## Статус: В ПРОЦЕССЕ

---

## ✅ Выполнено

### 1. Типы TypeScript
- ✅ `ObjectData` — объект недвижимости
- ✅ `ProjectData` — обновлён с `objects[]`
- ✅ Обратная совместимость через `rooms?`

### 2. API Clients
- ✅ `src/api/objects.ts` — CRUD для объектов
- ✅ `src/api/users.ts` — профиль пользователя

---

## 🔄 Требуется реализовать

### 3. ProjectContext (Критично)

**Файл:** `src/contexts/ProjectContext.tsx`

**Изменения:**
```typescript
// Старая структура
project.rooms[]

// Новая структура
project.objects[].rooms[]
```

**Методы для обновления:**
- `addRoom()` → добавлять в `objects[0].rooms`
- `updateRoom()` → обновлять в `objects[].rooms`
- `deleteRoom()` → удалять из `objects[].rooms`
- `addObject()` — новый метод
- `updateObject()` — новый метод
- `deleteObject()` — новый метод

**Миграция на лету:**
```typescript
function migrateProjectForUI(project: ProjectData): ProjectData {
  // Если есть rooms но нет objects — создаём первый объект
  if (project.rooms && project.rooms.length > 0 && !project.objects) {
    return {
      ...project,
      objects: [{
        id: uuid(),
        projectId: project.id,
        name: project.name,
        city: project.city,
        rooms: project.rooms,
      }],
      rooms: undefined,
    };
  }
  return project;
}
```

---

### 4. Компоненты (Новые)

#### ObjectList.tsx
**Файл:** `src/components/objects/ObjectList.tsx`

```typescript
interface ObjectListProps {
  objects: ObjectData[];
  activeObjectId: string;
  onObjectClick: (id: string) => void;
  onAddObject: () => void;
  onReorderObjects: (objects: ObjectData[]) => void;
}
```

#### ObjectCard.tsx
**Файл:** `src/components/objects/ObjectCard.tsx`

```typescript
interface ObjectCardProps {
  object: ObjectData;
  isActive: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}
```

#### CreateObjectModal.tsx
**Файл:** `src/components/objects/CreateObjectModal.tsx`

```typescript
interface CreateObjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; city?: string }) => void;
}
```

---

### 5. Обновление существующих компонентов

#### App.tsx
**Изменения:**
- Добавить уровень выбора объекта между проектом и комнатой
- Обновить навигацию: Проект → Объект → Комната

#### SummaryView.tsx
**Изменения:**
- Расчёт сметы по всем объектам и комнатам
- Группировка по объектам

```typescript
// Старая логика
project.rooms.forEach(room => {...})

// Новая логика
project.objects.forEach(object => {
  object.rooms.forEach(room => {...})
})
```

#### RoomList.tsx
**Изменения:**
- Контекст: комнаты текущего объекта
- Prop: `objectId` вместо `projectId`

---

### 6. Экспорт/Импорт

#### Формат JSON v2
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

#### Миграция при импорте
```typescript
function importJSONv1(data: any): ProjectData {
  // Старый формат с rooms напрямую в проекте
  if (data.rooms) {
    return {
      ...data,
      objects: [{
        id: uuid(),
        projectId: data.id,
        name: data.name,
        rooms: data.rooms,
      }],
    };
  }
  return data; // Новый формат
}
```

---

## 📊 Приоритеты

### Критично (блокирует работу)
1. [ ] ProjectContext — миграция данных
2. [ ] SummaryView — расчёт по объектам

### Важно (улучшает UX)
3. [ ] ObjectList — список объектов
4. [ ] ObjectCard — карточка объекта
5. [ ] CreateObjectModal — создание объекта

### Дополнительно
6. [ ] Экспорт/Импорт v2
7. [ ] E2E тесты

---

## 🎯 Минимальная реализация

Для быстрого запуска достаточно:

1. **ProjectContext** — автоматическая миграция `rooms` → `objects[0].rooms`
2. **SummaryView** — обход `objects[].rooms` вместо `rooms`
3. **API sync** — загрузка данных с сервера в новом формате

Это позволит приложению работать со старой структурой (один объект с комнатами).

---

## 📝 Примечания

- **Обратная совместимость:** Старые проекты с `rooms` должны работать
- **Миграция:** При первом сохранении конвертировать в новую структуру
- **UI:** Показать один объект как "псевдо-проект" для простоты
