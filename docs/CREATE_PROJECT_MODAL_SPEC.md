# Техническое задание: Создание проекта через модальное окно

## 1. Обзор

Документ описывает реализацию функции создания нового проекта через модальное окно с обязательным вводом названия проекта и одного или более объектов.

## 2. Функциональные требования

### 2.1. Обязательные поля

| Поле | Обязательность | Валидация |
|------|---------------|-----------|
| Название проекта | **Да** | Непустая строка после trim() |
| Объекты | **Да (минимум 1)** | Хотя бы один непустой объект |

### 2.2. Опциональные поля

| Поле | Описание |
|------|----------|
| Город | Для поиска региональных цен |

### 2.3. Способы создания проекта

1. **Создание нового проекта** — ввод данных вручную
2. **Импорт из бекапа** — загрузка JSON файла с проектами

## 3. Архитектура компонентов

### 3.1. Компоненты

```
src/components/projects/
├── ProjectsModal.tsx      # Главное модальное окно управления проектами
├── CreateProjectModal.tsx # Модальное окно создания проекта
└── index.ts               # Экспорты
```

### 3.2. CreateProjectModal

**Props интерфейс:**
```typescript
interface CreateProjectModalProps {
  isOpen: boolean;                                    // Открыто ли модальное окно
  onClose: () => void;                                // Callback закрытия
  onCreate: (data: {                                  // Callback создания
    name: string;                                     // Название проекта
    city?: string;                                    // Город (опционально)
    objects: string[];                                // Массив названий объектов
  }) => void;
  onImportFromBackup?: (projects: ProjectData[]) => void; // Импорт из бекапа
  isCreating?: boolean;                               // Состояние загрузки
}
```

**Внутреннее состояние:**
```typescript
const [activeTab, setActiveTab] = useState<'new' | 'backup'>('new');
const [projectName, setProjectName] = useState('');
const [city, setCity] = useState('');
const [objects, setObjects] = useState<string[]>(['']);
const [errors, setErrors] = useState<{ projectName?: string; objects?: string }>({});
```

### 3.3. Интеграция с ProjectsModal

ProjectsModal открывает CreateProjectModal при нажатии кнопки "Новый проект":

```typescript
const [showCreateModal, setShowCreateModal] = useState(false);

// Кнопка в toolbar
<button onClick={() => setShowCreateModal(true)}>
  <Plus /> Новый проект
</button>

// Модальное окно
<CreateProjectModal
  isOpen={showCreateModal}
  onClose={() => setShowCreateModal(false)}
  onCreate={handleCreateProject}
  onImportFromBackup={handleImportFromBackup}
  isCreating={isCreating}
/>
```

## 4. Валидация формы

### 4.1. Функция валидации

```typescript
const validate = (): boolean => {
  const newErrors: { projectName?: string; objects?: string } = {};

  if (!projectName.trim()) {
    newErrors.projectName = 'Введите название проекта';
  }

  const validObjects = objects.filter(o => o.trim());
  if (validObjects.length === 0) {
    newErrors.objects = 'Добавьте хотя бы один объект';
  }

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};
```

### 4.2. Сообщения об ошибках

| Условие | Сообщение |
|---------|-----------|
| Пустое название проекта | "Введите название проекта" |
| Нет объектов | "Добавьте хотя бы один объект" |

## 5. API интеграция

### 5.1. ProjectContext.createProject

Метод контекста поддерживает создание проекта с объектами:

```typescript
interface CreateProjectData {
  name: string;
  city?: string;
  objects?: string[];  // Массив названий объектов
}

createProject: (data: CreateProjectData) => Promise<ProjectData>
```

### 5.2. Логика создания

**Для авторизованных пользователей:**
1. Создаёт проект на сервере через `apiProvider.createProjectAsync()`
2. Создаёт объекты в проекте
3. Сохраняет проект с объектами

**Для неавторизованных пользователей:**
1. Создаёт локальный проект с локальным ID
2. Создаёт объекты с локальными ID
3. Сохраняет в localStorage

### 5.3. Структура создаваемых объектов

```typescript
const objects: ObjectData[] = data.objects.map((objName, index) => ({
  id: generateId('obj'),
  projectId: newProject.id,
  name: objName,
  city: data.city,
  rooms: [],
  sortOrder: index,
}));
```

## 6. Управление объектами в форме

### 6.1. Добавление объекта

```typescript
const addObject = () => {
  setObjects([...objects, '']);
};
```

### 6.2. Удаление объекта

```typescript
const removeObject = (index: number) => {
  if (objects.length > 1) {  // Всегда остаётся минимум 1 поле
    const newObjects = objects.filter((_, i) => i !== index);
    setObjects(newObjects);
  }
};
```

### 6.3. Обновление объекта

```typescript
const updateObject = (index: number, value: string) => {
  const newObjects = [...objects];
  newObjects[index] = value;
  setObjects(newObjects);
};
```

## 7. Импорт из бекапа

### 7.1. Загрузка файла

```typescript
const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const result = StorageManager.importFromJSON(e.target?.result as string);
    if (result.success) {
      setBackupData(result.data);
      setSelectedProjectIds(new Set(result.data.projects.map(p => p.id)));
    }
  };
  reader.readAsText(file);
};
```

### 7.2. Выбор проектов для импорта

- Чекбоксы для каждого проекта
- Кнопки "Выбрать все" / "Снять выбор"
- Множественный выбор

## 8. UI/UX

### 8.1. Вкладки (Tabs)

- **"Создать новый"** (активна по умолчанию) — иконка Plus
- **"Из бекапа"** — иконка Upload

### 8.2. Форма создания

```
┌─────────────────────────────────────────────┐
│  Новый проект                           [X] │
├─────────────────────────────────────────────┤
│  [Создать новый]  [Из бекапа]               │
├─────────────────────────────────────────────┤
│                                             │
│  Название проекта *                         │
│  ┌─────────────────────────────────────┐    │
│  │ Например: Ремонт в новостройке      │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  Объекты *                                  │
│  ┌─────────────────────────────────────┐ 🗑 │
│  │ Например: Квартира                  │    │
│  └─────────────────────────────────────┘    │
│  ┌─────────────────────────────────────┐ 🗑 │
│  │ Название объекта                    │    │
│  └─────────────────────────────────────┘    │
│  [+ Добавить объект]                        │
│                                             │
│  Город                                      │
│  ┌─────────────────────────────────────┐    │
│  │ Например: Москва (для поиска цен)   │    │
│  └─────────────────────────────────────┘    │
│                                             │
│                        [Отмена] [Создать]   │
└─────────────────────────────────────────────┘
```

### 8.3. Accessibility

- `role="tablist"`, `role="tab"`, `role="tabpanel"`
- `aria-selected` для вкладок
- `aria-controls` и `aria-labelledby`
- `autoFocus` на поле названия проекта
- Закрытие по Escape

## 9. Тестовое покрытие

### 9.1. Файл тестов

`tests/components/CreateProjectModal.test.tsx`

### 9.2. Покрываемые сценарии

| Сценарий | Статус |
|----------|--------|
| Не рендерится когда закрыт | ✅ |
| Рендерится когда открыт | ✅ |
| Две вкладки: создать и бекап | ✅ |
| Вкладка "Создать" активна по умолчанию | ✅ |
| Переключение вкладок | ✅ |
| Поля формы: название, объекты, город | ✅ |
| Создание проекта с данными | ✅ |
| Добавление поля объекта | ✅ |
| Удаление поля объекта | ✅ |
| Ошибка без названия проекта | ✅ |
| Закрытие по кнопке Отмена | ✅ |
| Закрытие по Escape | ✅ |
| Загрузка файла бекапа | ✅ |
| Отображение списка проектов из бекапа | ✅ |
| Чекбоксы выбора проектов | ✅ |

### 9.3. Моки

```typescript
vi.mock('../../src/utils/storage', () => ({
  StorageManager: {
    importFromJSON: vi.fn(() => ({
      success: true,
      data: { projects: [...], activeProjectId: '...', exportedAt: '...' }
    }))
  }
}));

vi.mock('../../src/utils/projectObjects', () => ({
  migrateProjectToObjects: vi.fn((p) => p),
}));
```

## 10. Связанные файлы

| Файл | Назначение |
|------|------------|
| `src/components/projects/CreateProjectModal.tsx` | Компонент модального окна |
| `src/components/projects/ProjectsModal.tsx` | Родительский компонент |
| `src/contexts/ProjectContext.tsx` | Контекст с методом createProject |
| `src/utils/storage.ts` | StorageManager для импорта |
| `src/utils/projectObjects.ts` | Миграция проектов |
| `tests/components/CreateProjectModal.test.tsx` | Тесты |

## 11. Изменения в ProjectContext

### 11.1. Интерфейс createProject

```typescript
// До
createProject: (data: { name: string; city?: string }) => Promise<ProjectData>

// После
createProject: (data: { 
  name: string; 
  city?: string; 
  objects?: string[]  // Добавлена поддержка объектов
}) => Promise<ProjectData>
```

### 11.2. Логика создания объектов

При передаче `objects` в метод `createProject`, автоматически создаются объекты типа `ObjectData` с:
- Уникальным ID
- Связью с проектом через `projectId`
- `sortOrder` для упорядочивания
- Пустым массивом `rooms`

## 12. Статус реализации

| Компонент | Статус |
|-----------|--------|
| CreateProjectModal.tsx | ✅ Создан |
| ProjectsModal.tsx | ✅ Изменён |
| ProjectContext.tsx | ✅ Изменён |
| index.ts | ✅ Обновлён |
| CreateProjectModal.test.tsx | ✅ Создан |
| ProjectsModal.test.tsx | ✅ Изменён |
| App.tsx | ✅ Исправлена интеграция |

## 13. Исправления интеграции (07.04.2026)

### Проблема
При нажатии на кнопки "Новый проект" открывалась старая inline-форма вместо модального окна CreateProjectModal.

### Причина
В `App.tsx` функция `addNewProject` создавала проект напрямую через `createNewProject()` без открытия модального окна.

### Решение
Функция `addNewProject` переименована в `openCreateProjectModal` и теперь открывает `ProjectsModal`:

```typescript
// До
const addNewProject = () => {
  const newProject = createNewProject();
  updateProjects([...projects, newProject]);
  setActiveProjectId(newProject.id);
  setActiveTab('summary');
  setIsRightMobileMenuOpen(false);
};

// После
const openCreateProjectModal = () => {
  setIsProjectsModalOpen(true);
  setIsRightMobileMenuOpen(false);
};
```

### Изменённые места в App.tsx
1. Строка ~172: определение функции
2. Строка ~327: кнопка "Создать проект" (empty state)
3. Строка ~384: проп `onNewProject` в RightSidebar

---

*Документ создан: 07.04.2026*  
*Обновлён: 07.04.2026*
