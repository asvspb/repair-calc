# 📋 Код-ревью проекта repair-calc

**Дата:** 2026-03-27
**Версия:** 3.0
**Предыдущее ревью:** 2026-03-13 (v2.0)
**Статус:** Выявлены новые проблемы безопасности и архитектуры

---

## 📊 Сводка

| Категория | Оценка | Комментарий |
|-----------|--------|-------------|
| Архитектура | 🟡 Хорошо | Значительный прогресс, но есть fat-компоненты |
| Безопасность | 🔴 Требует внимания | Hardcoded секреты, нет helmet, CORS-bypass |
| Производительность | 🟡 Средне | Пересчёт на каждый рендер, двойная нормализация |
| Состояние и данные | 🟡 Средне | Stale closures, двойная ответственность контекста |
| Бэкенд | 🟡 Средне | Нет DI, нет транзакций, нет request tracing |
| Тестирование | 🟡 Средне | 402 теста, но нет компонентных тестов |

---

## ✅ Ранее исправленные проблемы (v1.0–v2.0)

<details>
<summary>Развернуть список (7 пунктов)</summary>

1. ~~**God Component App.tsx**~~ — декомпозиция 2700 → 557 строк ✅
2. ~~**Stale closure в updateActiveProject**~~ — functional updates ✅
3. ~~**CSV экспорт не учитывает сложную геометрию**~~ — `calculateRoomMetrics` ✅
4. ~~**Использование `any` типов**~~ — все заменены на конкретные типы ✅
5. ~~**Дублирование геометрических расчётов**~~ — единые функции в `geometry.ts`/`costs.ts` ✅
6. ~~**Несогласованные порты**~~ — Vite: 3993, Server: 3994 ✅
7. ~~**Rules of Hooks в App.tsx**~~ — useEffect перемещён выше условного возврата ✅

</details>

---

## 🔴 Критические проблемы (Blockers)

### C-1. Hardcoded JWT-секреты в fallback

**Файл:** `server/src/config/env.ts` (строки 17–19)

```typescript
jwt: {
  secret: process.env['JWT_SECRET'] || 'dev-secret-change-in-production',
  refreshSecret: process.env['JWT_REFRESH_SECRET'] || 'dev-refresh-secret-change-in-production',
},
```

**Проблема:** Если переменные окружения не заданы, сервер запускается с предсказуемым секретом. Любой может сгенерировать валидный JWT.

**Решение:** В production режиме при отсутствии `JWT_SECRET` сервер должен выбрасывать ошибку и не запускаться.

---

### C-2. Нет HTTP Security Headers (helmet)

**Файл:** `server/src/app.ts`

**Проблема:** Отсутствуют заголовки безопасности:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Strict-Transport-Security`
- `Content-Security-Policy`

**Решение:** Установить и подключить `helmet`.

---

### C-3. CORS обходится запросами без Origin

**Файл:** `server/src/app.ts` (строки 22–31)

```typescript
origin: config.nodeEnv === 'development'
  ? allowedOrigins
  : (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);  // !origin пропускает curl, Postman, server-to-server
      }
    },
```

**Проблема:** Запросы без заголовка `Origin` (curl, Postman, произвольные серверы) обходят CORS-защиту в production.

**Решение:** Убрать `!origin` из условия или ограничить разрешённые origins через env-переменную.

---

### C-4. Дублирование удаления проекта

**Файл:** `src/App.tsx` (строки 364–376)

```tsx
onClick={async () => {
  setShowDeleteConfirm(false);
  if (IdMapper.isServerId(activeProjectId)) {
    await deleteProject(activeProjectId);   // 1. Удаляет на сервере И локально
  }
  handleDeleteActiveProject();              // 2. Дублирует локальное удаление
}}
```

**Проблема:** `deleteProject` из контекста уже удаляет проект из state через `setProjects(prev => prev.filter(...))`. Второй вызов `handleDeleteActiveProject` дублирует это и может привести к гонке состояний.

**Решение:** Использовать только `deleteProject` из контекста для серверных проектов и `handleDeleteActiveProject` для локальных. Объединить логику.

---

### C-5. Создание проекта не синхронизируется с сервером

**Файл:** `src/App.tsx` (строки 208–214)

```tsx
const addNewProject = () => {
  const newProject = createNewProject();       // Всегда создаёт с local-ID
  updateProjects([...projects, newProject]);   // Не вызывает createProject из контекста
  setActiveProjectId(newProject.id);
};
```

**Проблема:** Для авторизованного пользователя проект создаётся с локальным ID и не синхронизируется с сервером. Контекст уже содержит `createProject`, который правильно создаёт проект на сервере.

**Решение:** Заменить на вызов `createProject({ name: 'Новый объект' })`.

---

## ⚠️ Проблемы средней серьёзности (Warnings)

### W-1. Пересчёт метрик на каждый рендер

**Файл:** `src/components/RoomEditor.tsx` (строки 55–67)

```tsx
const normalizedRoom = { ...room, segments: room.segments || [], ... };
const metrics = calculateRoomMetrics(normalizedRoom);
const { costs, total } = calculateRoomCosts(normalizedRoom);
```

**Проблема:** `calculateRoomMetrics` и `calculateRoomCosts` — нетривиальные вычисления, вызываемые при каждом рендере (каждое нажатие клавиши, клик, hover).

**Решение:** Обернуть в `useMemo` с зависимостью от `room`.

---

### W-2. Двойная нормализация данных комнаты

**Файлы:** `src/contexts/ProjectContext.tsx` (строки 24–35), `src/components/RoomEditor.tsx` (строки 55–64)

**Проблема:** `migrateRoom()` в ProjectContext и нормализация в RoomEditor выполняют одну и ту же работу (добавляют пустые массивы для `segments`, `obstacles`, `wallSections`, etc.). Данные нормализуются дважды.

**Решение:** Нормализовать только при загрузке данных (в ProjectContext). Убрать дублирование из RoomEditor.

---

### W-3. ProjectContext — двойная ответственность (660 строк)

**Файл:** `src/contexts/ProjectContext.tsx`

**Проблема:** Контекст одновременно управляет:
1. State (projects, activeProjectId, loading, errors)
2. Persistence (localStorage, API sync, debounce)
3. Бизнес-логика (расчёт totals, ID mapping, миграция)

**Решение:** Разделить на:
- `useProjectState.ts` — чистый state management
- `useProjectSync.ts` — логика синхронизации и persistence

---

### W-4. Stale closure в deleteRoom, addRoom, reorderRooms

**Файл:** `src/contexts/ProjectContext.tsx` (строки 425–462)

```typescript
const deleteRoom = useCallback((roomId: string) => {
  if (!activeProject) return;               // ← захват из замыкания
  const newRooms = activeProject.rooms.filter(r => r.id !== roomId);
  const updatedProject = { ...activeProject, rooms: newRooms };
  updateActiveProject(updatedProject);      // ← полный снимок
}, [activeProject, updateActiveProject]);
```

**Проблема:** `deleteRoom` захватывает `activeProject` из замыкания и использует полный снимок. При быстрых последовательных вызовах (удаление нескольких комнат подряд) может использовать устаревшие данные. В отличие от `updateRoomById`, который корректно использует functional update.

**Решение:** Перевести на `setProjects(prev => ...)` (аналогично `updateRoomById`).

---

### W-5. RoomEditor — 896 строк

**Файл:** `src/components/RoomEditor.tsx`

**Проблема:** Компонент содержит ~30 обработчиков событий, которые можно вынести в custom hook.

**Решение:** Создать `useRoomHandlers.ts` с handlers для работ, материалов и инструментов.

---

### W-6. Фиктивные поля в auth middleware

**Файл:** `server/src/middleware/auth.ts` (строки 25–31)

```typescript
req.user = {
  id: payload.userId,
  email: payload.email,
  name: null,
  created_at: new Date(),   // Фиктивные данные — не из БД
  updated_at: new Date(),
} as User;
```

**Проблема:** `created_at` и `updated_at` не соответствуют реальным данным пользователя. Если используются далее в логике — это источник багов.

**Решение:** Устанавливать только `{ id, email }` или загружать реального пользователя из БД.

---

### W-7. ID mapping теряется при перезагрузке

**Файл:** `src/utils/idMapper.ts`

**Проблема:** Маппинги local↔server ID хранятся только в памяти. При перезагрузке страницы все маппинги теряются, что может привести к дубликатам.

**Решение:** Сохранять маппинги в `localStorage`.

---

### W-8. Полная сериализация при каждом сохранении

**Файл:** `src/contexts/ProjectContext.tsx` (строки 284–338)

**Проблема:** `scheduleSave` сохраняет **все** проекты в localStorage при любом изменении одной работы в одной комнате. Для крупных проектов с многими комнатами это может быть ощутимо.

**Решение:** Инкрементальное сохранение — сериализовать только изменённый проект.

---

## 💡 Замечания (Nitpicks)

### N-1. Опечатка в App.tsx

**Файл:** `src/App.tsx` (строка 22)

```tsx
/** Страниццы аутентификации */  // → Страницы
```

---

### N-2. Неиспользуемый импорт ProtectedRoute

**Файл:** `src/App.tsx` (строка 10)

```tsx
import { LoginPage, RegisterPage, ProtectedRoute } from './components/auth';
// ProtectedRoute нигде не используется
```

---

### N-3. Неиспользуемый roomHeaderRef

**Файл:** `src/App.tsx` (строка 124)

```tsx
const roomHeaderRef = useRef<HTMLDivElement | null>(null);
// Объявлен, но нигде не используется
```

---

### N-4. Дублирование console.error рядом с logError

**Файлы:** `src/contexts/ProjectContext.tsx` (множество мест)

```typescript
logError('ProjectContext', 'Ошибка загрузки данных', err);
console.error('Error loading data:', err);  // Дубль
```

---

### N-5. Magic strings для ключей localStorage

**Файлы:** `src/api/storage/apiStorageProvider.ts`, `src/utils/storage.ts`

Строки `'repair-calc-projects'`, `'repair-calc-active-project'` повторяются в нескольких файлах. Вынести в общие константы.

---

## 🟢 Сильные стороны проекта

1. **Декомпозиция App.tsx** (2700 → 557 строк) — значительный прогресс
2. **Абстракция `IStorageProvider`** — чистый интерфейс для подмены storage
3. **Context API** вместо prop drilling — правильное решение для масштаба проекта
4. **Error Boundaries** — защита от крашей в рендере
5. **Optimistic locking** — поле `version` в таблице `projects`
6. **Request queue + rate limiting** в `ApiStorageProvider` — грамотная защита от 429
7. **Functional updates** в `updateRoomById` — корректная работа с быстрыми изменениями
8. **Каталог работ** с 19 типовыми шаблонами — полезный UX
9. **AI-интеграция** (Gemini + Mistral) — двойной fallback
10. **402 теста** с 100% покрытием для ключевых utils (geometry, costs, materialCalculations)

---

## 🔧 Состояние бэкенда

### Реализовано

| Компонент | Файлы | Статус |
|-----------|-------|--------|
| Express-сервер | `server/src/app.ts` | ✅ |
| MySQL + Knex | `server/src/db/pool.ts`, 14+ миграций | ✅ |
| JWT-аутентификация | `server/src/middleware/auth.ts`, `routes/auth.ts` | ✅ |
| CRUD: projects, rooms, works | `routes/projects.ts`, `rooms.ts`, `works.ts` | ✅ |
| CRUD: геометрия | `routes/geometry.ts` (25+ endpoints) | ✅ |
| AI-провайдеры | `services/ai/` (Gemini, Mistral) | ✅ |
| Update Service | `services/update/` (runner, scheduler, parsers) | ✅ |
| Вебхуки | `services/webhook.service.ts` | ✅ |
| 11 репозиториев | `db/repositories/*.repo.ts` | ✅ |

### Требует доработки

| Проблема | Приоритет |
|----------|-----------|
| Статические методы в репозиториях (нет DI) | Средний |
| Нет транзакций при комплексных операциях | Средний |
| Нет request ID / correlation ID | Низкий |
| Rate limiter глобальный, не per-user | Низкий |

---

## 🟢 Текущее покрытие тестами

| Категория | Количество |
|-----------|------------|
| Unit тесты (utils) | 220 |
| Unit тесты (hooks) | 72 |
| Integration тесты | 7 |
| API тесты | 22 |
| E2E тесты | 16 |
| **Итого** | **402** |

**Покрытие:** ~50%

### Пробелы в тестировании

- ❌ Нет компонентных тестов для `RoomEditor`, `App`, `ProjectContext`
- ❌ Нет тестов для `ApiStorageProvider` (queue, retry, cache)
- ❌ 16 E2E тестов — минимальное покрытие
- ❌ Нет тестов для серверных route handlers с реальной БД

---

## 📊 Итоговые метрики

| Метрика | Было (v1.0) | Стало (v3.0) | Целевое | Статус |
|---------|-------------|--------------|---------|--------|
| Размер App.tsx | ~2700 строк | ~557 строк | <300 | 🟡 |
| ProjectContext.tsx | — | 660 строк | <300 | 🔴 |
| RoomEditor.tsx | — | 896 строк | <400 | 🔴 |
| Покрытие тестами | ~5% | ~50% | >60% | 🟡 |
| Типизация (any) | 3 места | 0 | 0 | ✅ |
| Stale closures | 2 | 1 (deleteRoom) | 0 | 🟡 |

---

## 📋 План улучшений (приоритизированный)

### Приоритет 1: Критические (1–3 дня)

| # | Задача | Файлы | Сложность |
|---|--------|-------|-----------|
| 1.1 | Падение при отсутствии `JWT_SECRET` в production | `server/src/config/env.ts` | Низкая |
| 1.2 | Добавить `helmet` для HTTP security headers | `server/src/app.ts`, `server/package.json` | Низкая |
| 1.3 | Исправить дублирование удаления проекта | `src/App.tsx` | Низкая |
| 1.4 | Исправить `addNewProject` — использовать `createProject` | `src/App.tsx` | Низкая |
| 1.5 | Убрать фиктивные поля из auth middleware | `server/src/middleware/auth.ts` | Низкая |
| 1.6 | Убрать CORS bypass (`!origin`) в production | `server/src/app.ts` | Низкая |

### Приоритет 2: Производительность (2–3 дня)

| # | Задача | Файлы | Сложность |
|---|--------|-------|-----------|
| 2.1 | `useMemo` для метрик и costs в RoomEditor | `src/components/RoomEditor.tsx` | Низкая |
| 2.2 | Убрать двойную нормализацию комнат | `ProjectContext.tsx`, `RoomEditor.tsx` | Средняя |
| 2.3 | Инкрементальное сохранение (только изменённый проект) | `ProjectContext.tsx` | Средняя |

### Приоритет 3: Архитектура (3–5 дней)

| # | Задача | Файлы | Сложность |
|---|--------|-------|-----------|
| 3.1 | Разделить ProjectContext на state + persistence hooks | `ProjectContext.tsx` → `useProjectState.ts` + `useProjectSync.ts` | Высокая |
| 3.2 | Исправить stale closure в `deleteRoom`, `addRoom`, `reorderRooms` | `ProjectContext.tsx` | Средняя |
| 3.3 | Персистентный idMapper — сохранять в localStorage | `src/utils/idMapper.ts` | Низкая |
| 3.4 | Декомпозиция RoomEditor (896 строк) — custom hook для handlers | `RoomEditor.tsx` → `useRoomHandlers.ts` | Средняя |

### Приоритет 4: Тестирование (3–5 дней)

| # | Задача | Файлы | Сложность |
|---|--------|-------|-----------|
| 4.1 | Тесты для ApiStorageProvider (queue, retry, cache) | `apiStorageProvider.test.ts` | Высокая |
| 4.2 | Компонентные тесты для RoomEditor | `RoomEditor.test.tsx` | Средняя |
| 4.3 | Тесты для ProjectContext (loading, saving, sync) | `ProjectContext.test.tsx` | Высокая |
| 4.4 | Дополнительные E2E для авторизации и синхронизации | `e2e/auth-sync.spec.ts` | Средняя |

### Приоритет 5: Бэкенд (3–5 дней)

| # | Задача | Файлы | Сложность |
|---|--------|-------|-----------|
| 5.1 | DI для репозиториев — перейти от static к instance methods | `server/src/db/repositories/*.ts` | Высокая |
| 5.2 | Транзакции для комплексных операций | `server/src/db/repositories/project.repo.ts` | Средняя |
| 5.3 | Request ID middleware | `server/src/middleware/requestId.ts` | Низкая |
| 5.4 | Per-user rate limiting | `server/src/middleware/rateLimiter.ts` | Средняя |

### Приоритет 6: Документация (1 день)

| # | Задача | Файлы |
|---|--------|-------|
| 6.1 | Привести ARCHITECTURE.md в соответствие с реальным состоянием | `docs/ARCHITECTURE.md` |
| 6.2 | Обновить TODO.md — отметить выполненное | `docs/TODO.md` |

**Итого:** ~15–22 рабочих дней для полной реализации

---

## 🔗 Связанные документы

| Документ | Описание |
|----------|----------|
| [TODO.md](./TODO.md) | Актуальные задачи |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Архитектура проекта |
| [DATABASE_MIGRATION.md](./DATABASE_MIGRATION.md) | ТЗ миграции на БД |
| [PROGRESS.md](./PROGRESS.md) | История прогресса |

---

**Конец документа**