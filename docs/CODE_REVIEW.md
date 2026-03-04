# 📋 Код-ревью проекта repair-calc

**Дата:** 2026-03-04  
**Версия:** 1.0  
**Автор:** AI Agent (Augment Code)

---

## 🔴 Критические проблемы

### 1. God Component — App.tsx (~3000 строк)

**Проблема:** Основной файл `src/App.tsx` содержит:
- 20+ типов данных (Opening, WorkData, RoomData, ProjectData и др.)
- Начальные данные (initialRooms, initialProjects)
- Утилитарные функции (calculateRoomMetrics, calculateRoomCosts, migrateWorkData)
- 4 крупных компонента (SummaryView, RoomEditor, GeometrySection, и др.)
- Вся логика редактирования комнат

**Влияние:**
- Нарушение Single Responsibility Principle
- Затруднённое тестирование (невозможно импортировать функции отдельно)
- Долгие code review (изменения в одном месте требуют просмотра всего файла)
- Медленная сборка при изменениях

**Решение:** См. [План декомпозиции](#фаза-1-декомпозиция-1-2-недели--критическая)

---

### 2. Stale Closure в useProjects

**Файл:** `src/hooks/useProjects.ts`, строки 115-121

```typescript
// ПРОБЛЕМА: projects в замыкании может быть устаревшим
const updateActiveProject = useCallback((updatedProject: ProjectData) => {
  const newProjects = projects.map(p =>   // ← stale closure
    p.id === updatedProject.id ? updatedProject : p
  );
  setProjects(newProjects);
  scheduleSave(newProjects);
}, [projects, scheduleSave]);
```

**Решение:**
```typescript
const updateActiveProject = useCallback((updatedProject: ProjectData) => {
  setProjects(prevProjects => {
    const newProjects = prevProjects.map(p => 
      p.id === updatedProject.id ? updatedProject : p
    );
    scheduleSave(newProjects);
    return newProjects;
  });
}, [scheduleSave]);  // projects убрана из зависимостей
```

---

### 3. CSV экспорт не учитывает сложную геометрию

**Файл:** `src/utils/storage.ts`, строки 140-147

```typescript
// ПРОБЛЕМА: упрощённый расчёт, игнорирующий segments/obstacles
const floorArea = room.length * room.width;
const perimeter = (room.length + room.width) * 2;
```

**Влияние:** Экспортируемые данные не соответствуют расчётам в приложении для extended/advanced режимов.

**Решение:** Вынести `calculateRoomMetrics` в `src/utils/geometry.ts` и использовать в обоих местах.

---

## 🟠 Архитектурные недостатки

### 4. Использование `any` типов

**Файл:** `src/components/BackupManager.tsx`, строка 11

```typescript
onImportTemplates?: (templates: any[]) => void;  // потеря типобезопасности
```

**Решение:** Использовать `WorkTemplate[]` из `src/types/workTemplate.ts`.

---

### 5. GEMINI_API_KEY на клиенте

**Файл:** `vite.config.ts`, строки 10-12

```typescript
define: {
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
},
```

**Риск:** API-ключ будет виден в исходниках браузера.

**Решение:** Проксировать AI-запросы через бэкенд (см. [ARCHITECTURE.md](./ARCHITECTURE.md)).

---

### 6. Дублирование геометрических расчётов

- `calculateRoomMetrics` в App.tsx (~200 строк)
- Частичная копия в `storage.ts` для CSV-экспорта

**Решение:** Вынести в `src/utils/geometry.ts` и импортировать в оба места.

---

## 🟡 Проблемы качества кода

### 7. Несогласованные конфигурации портов

| Файл | Порт |
|------|------|
| vite.config.ts | 3993 |
| playwright.config.ts | 3995 |
| .env.example (SERVER_PORT) | 3994 |
| .env.example (APP_URL) | 3993 |

**Решение:** Привести playwright.config.ts к порту 3993.

---

### 8. Отсутствие валидации на границах

```typescript
// В useWorkTemplates.ts — что если template не найден?
const loadTemplate = useCallback((template: WorkTemplate, metrics?: RoomMetrics): WorkData => {
  // Нет проверки на undefined template
```

---

## 🟢 Покрытие тестами

### Текущее состояние:
- ✅ 1 unit-тест файл (`tests/App.test.tsx`) — тестирует NumberInput
- ✅ E2E тесты (`e2e/room-input.spec.ts`) — проверяют критический баг
- ❌ Нет тестов для: calculateRoomMetrics, calculateRoomCosts, StorageManager, TemplateStorage

### Рекомендации:
1. Добавить тесты для утилитарных функций после их выноса
2. Покрыть тестами миграцию данных
3. Добавить тесты для экспорта/импорта

---

## 📊 План улучшений (Roadmap)

### Фаза 1: Декомпозиция (1-2 недели) 🔴 Критическая

| Задача | Файлы | Приоритет |
|--------|-------|-----------|
| 1.1 Вынести типы | App.tsx → src/types/ | P0 |
| 1.2 Вынести расчёты | App.tsx → src/utils/geometry.ts, costs.ts | P0 |
| 1.3 Вынести SummaryView | App.tsx → src/components/SummaryView/ | P0 |
| 1.4 Вынести RoomEditor | App.tsx → src/components/RoomEditor/ | P0 |
| 1.5 Вынести GeometrySection | App.tsx → src/components/GeometrySection/ | P1 |
| 1.6 Вынести начальные данные | App.tsx → src/data/initialData.ts | P1 |

**Результат:** App.tsx сократится до ~300 строк (роутинг + композиция).

---

### Фаза 2: Исправление багов (3-5 дней) 🟠 Высокая

| Задача | Описание |
|--------|----------|
| 2.1 Stale closure | Исправить useProjects.ts с functional update |
| 2.2 CSV экспорт | Использовать общую функцию calculateRoomMetrics |
| 2.3 Типизация | Заменить `any` на конкретные типы |
| 2.4 Порты | Унифицировать конфигурацию портов |

---

### Фаза 3: Улучшение архитектуры (1 неделя) 🟡 Средняя

| Задача | Описание |
|--------|----------|
| 3.1 Абстракция storage | Создать интерфейс IStorageProvider для будущей замены на API |
| 3.2 Error Boundaries | Добавить React Error Boundaries для graceful degradation |
| 3.3 Context API | Вынести глобальное состояние (projects, templates) в Context |
| 3.4 Оптимизация memo | Добавить React.memo для тяжёлых компонентов |

---

### Фаза 4: Тестирование (1 неделя) 🟢 Средняя

| Задача | Покрытие |
|--------|----------|
| 4.1 Unit-тесты utils | geometry.ts, costs.ts, storage.ts |
| 4.2 Unit-тесты хуков | useProjects, useWorkTemplates |
| 4.3 Integration тесты | Полный flow создания/редактирования комнаты |
| 4.4 E2E расширение | Экспорт/импорт, работа с шаблонами |

---

### Фаза 5: Подготовка к бэкенду (согласно ARCHITECTURE.md)

| Задача | Описание |
|--------|----------|
| 5.1 PWA Manifest | Добавить service worker для offline |
| 5.2 API Client | Создать абстракцию для HTTP-запросов |
| 5.3 Sync Layer | Подготовить механизм синхронизации localStorage ↔ Server |
| 5.4 AI Integration | Проксирование запросов к Gemini/Mistral через бэкенд |

---

## 📈 Метрики успеха

| Метрика | Текущее | Целевое |
|---------|---------|---------|
| Размер App.tsx | ~3000 строк | <300 строк |
| Покрытие тестами | ~5% | >60% |
| Типизация (any) | 3 места | 0 |
| Время сборки | базовое | -20% |

---

## 🔗 Связанные документы

- [TODO.md](./TODO.md) — Текущий список задач
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Архитектурный план развития
- [WORK_TEMPLATES_SPEC.md](./WORK_TEMPLATES_SPEC.md) — Спецификация шаблонов работ

---

**Конец документа**

