# Техническое задание: Рефакторинг боковых панелей

## 1. Цель

Разгрузить левое меню, переместив часть функционала в новую правую панель.

## 2. Текущее состояние (AS-IS)

**Левое меню (ширина 320px / w-80):**
- Логотип
- Секция управления проектом (селектор, переименование, удаление)
- Секция "Объект ремонта"
- Поле "Город"
- Секция "Обзор" (Общая смета)
- Секция "Комнаты" (список с drag-and-drop)
- Секция "Другие объекты"
- Кнопки действий (Добавить комнату, Добавить объект, Новый проект)
- Секция пользователя

## 3. Целевое состояние (TO-BE)

### 3.1. Левое меню (ширина 280px)

| Элемент | Описание |
|---------|----------|
| Логотип | Без изменений |
| Секция "Обзор" | Кнопка "Общая смета" |
| Секция "Комнаты" | Список комнат текущего объекта с drag-and-drop |
| Кнопка "Добавить комнату" | Создание новой комнаты |

### 3.2. Правое меню (ширина 280px)

| Элемент | Описание |
|---------|----------|
| Секция управления проектом | Селектор, переименование, удаление |
| Секция "Объект ремонта" | Селектор объектов / название |
| Поле "Город" | Ввод города для поиска цен |
| Секция "Другие объекты" | Список других объектов проекта для переключения |
| Кнопка "Добавить объект ремонта" | Создание нового объекта |
| Кнопка "Новый проект" | Создание нового проекта |
| Секция пользователя | Аватар, имя, email, выход |

## 4. Итоговое распределение элементов

| Элемент | Левое меню | Правое меню |
|---------|------------|-------------|
| Логотип | ✅ | |
| Обзор / Общая смета | ✅ | |
| Список комнат текущего объекта | ✅ | |
| Добавить комнату | ✅ | |
| Селектор проекта | | ✅ |
| Переименовать проект | | ✅ |
| Удалить проект | | ✅ |
| Объект ремонта (селектор) | | ✅ |
| Город | | ✅ |
| Другие объекты | | ✅ |
| Добавить объект ремонта | | ✅ |
| Новый проект | | ✅ |
| Пользователь | | ✅ |

## 5. Адаптивность (Responsive)

| Экран | Левое меню | Правое меню |
|-------|------------|-------------|
| Desktop (md+) | Видно всегда, 280px | Видно всегда, 280px |
| Mobile | Скрыто, открывается кнопкой ☰ | Скрыто, открывается кнопкой ⚙️ |

### 5.1. Мобильная версия

- Добавить кнопку настроек (Settings icon) в header
- Правое меню выезжает справа при нажатии
- Левое меню выезжает слева при нажатии на ☰

## 6. Архитектурные изменения

### 6.1. Создать новые компоненты

| Файл | Описание |
|------|----------|
| `src/components/layout/LeftSidebar.tsx` | Левая панель навигации |
| `src/components/layout/RightSidebar.tsx` | Правая панель настроек |
| `src/components/layout/ProjectSettings.tsx` | Секция управления проектом |
| `src/components/layout/ObjectSettings.tsx` | Секция объекта ремонта |

### 6.2. Изменить структуру App.tsx

```tsx
// До:
<div className="flex"> 
  <aside>Левое меню (всё)</aside>
  <main>Контент</main>
</div>

// После:
<div className="flex">
  <LeftSidebar />
  <main>Контент</main>
  <RightSidebar />
</div>
```

## 7. Props для новых компонентов

### 7.1. LeftSidebar

```typescript
type LeftSidebarProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onAddRoom: () => void;
  isMobileMenuOpen: boolean;
  onMobileMenuClose: () => void;
};
```

### 7.2. RightSidebar

```typescript
type RightSidebarProps = {
  isMobileMenuOpen: boolean;
  onMobileMenuClose: () => void;
};
```

### 7.3. ProjectSettings

```typescript
type ProjectSettingsProps = {
  projects: ProjectData[];
  activeProjectId: string;
  activeProject: ProjectData | null;
  isSyncing: boolean;
  onProjectChange: (id: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onNewProject: () => void;
};
```

### 7.4. ObjectSettings

```typescript
type ObjectSettingsProps = {
  objects: ObjectData[];
  activeObjectId: string | null;
  activeObject: ObjectData | null;
  onObjectChange: (id: string) => void;
  onAddObject: () => void;
  city: string;
  onCityChange: (city: string) => void;
};
```

## 8. Файлы для изменения

| Файл | Действие |
|------|----------|
| `src/App.tsx` | Рефакторинг: вынести логику в компоненты |
| `src/components/layout/LeftSidebar.tsx` | Создать новый |
| `src/components/layout/RightSidebar.tsx` | Создать новый |
| `src/components/layout/ProjectSettings.tsx` | Создать новый |
| `src/components/layout/ObjectSettings.tsx` | Создать новый |
| `src/index.css` | Возможно, добавить стили |

## 9. Порядок реализации

1. [ ] Создать директорию `src/components/layout/`
2. [ ] Создать `ProjectSettings.tsx` (вынести из App.tsx)
3. [ ] Создать `ObjectSettings.tsx` (вынести из App.tsx)
4. [ ] Создать `RightSidebar.tsx` с UserSection
5. [ ] Создать `LeftSidebar.tsx` с навигацией
6. [ ] Обновить `App.tsx` - использовать новые компоненты
7. [ ] Добавить кнопку Settings в header для мобильных
8. [ ] Тестирование

## 10. Детали реализации

### 10.1. Правое меню (RightSidebar)

```tsx
<aside className="fixed inset-y-0 right-0 z-50 w-70 bg-white border-l border-gray-200 transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 flex flex-col h-screen">
  {/* Header */}
  <div className="p-4 border-b border-gray-200">
    <div className="flex justify-between items-center">
      <span className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Настройки</span>
      <button className="md:hidden" onClick={onClose}>
        <X className="w-5 h-5" />
      </button>
    </div>
  </div>

  {/* Project Settings */}
  <ProjectSettings {...projectSettingsProps} />

  {/* Object Settings */}
  <ObjectSettings {...objectSettingsProps} />

  {/* Actions */}
  <div className="p-4 space-y-3">
    <button onClick={onAddObject}>Добавить объект ремонта</button>
    <button onClick={onNewProject}>Новый проект</button>
  </div>

  {/* User Section */}
  <UserSection />
</aside>
```

### 10.2. Левое меню (LeftSidebar)

```tsx
<aside className="fixed inset-y-0 left-0 z-50 w-70 bg-white border-r border-gray-200 ...">
  {/* Logo */}
  <div className="flex items-center justify-center p-4 border-b">
    <img src="/logo.svg" alt="Мой ремонт" />
  </div>

  {/* Navigation */}
  <div className="flex-1 flex flex-col">
    {/* Обзор */}
    <button onClick={() => onTabChange('summary')}>Общая смета</button>

    {/* Комнаты */}
    <div className="flex-1 overflow-y-auto">
      <RoomList rooms={rooms} activeTab={activeTab} onRoomClick={onTabChange} />
    </div>

    {/* Другие объекты */}
    {otherObjects.length > 0 && <OtherObjectsList objects={otherObjects} />}
  </div>

  {/* Actions */}
  <div className="p-4">
    <button onClick={onAddRoom}>Добавить комнату</button>
  </div>
</aside>
```

### 10.3. Header для мобильных

```tsx
<header className="md:hidden bg-white border-b p-4 flex items-center gap-3">
  {/* Левое меню */}
  <button onClick={() => setLeftMenuOpen(true)}>
    <Menu className="w-6 h-6" />
  </button>

  {/* Заголовок */}
  <div className="flex-1">...</div>

  {/* Правое меню */}
  <button onClick={() => setRightMenuOpen(true)}>
    <Settings className="w-6 h-6" />
  </button>
</header>
```

## 11. Риски

| Риск | Решение |
|------|---------|
| Дублирование состояния между компонентами | Использовать контекст ProjectContext |
| Мобильная версия перегружена кнопками | Два раздельных меню |
| Ширина контента уменьшится | Уменьшить ширину панелей до 280px |

## 12. Критерии приёмки

- [ ] Левое меню содержит только навигацию по комнатам
- [ ] Правое меню содержит настройки проекта и объекта
- [ ] Оба меню корректно работают на desktop
- [ ] Оба меню открываются на мобильных через соответствующие кнопки
- [ ] Все существующие функции сохранены
- [ ] Нет регрессий в существующем функционале