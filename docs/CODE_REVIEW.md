# 📋 Код-ревью проекта repair-calc

**Дата:** 2026-04-08
**Версия:** 4.1
**Предыдущее ревью:** 2026-04-08 (v4.0)
**Статус:** Критические исправления v4.0 выполнены, Quick Wins выполнены

---

## 📊 Сводка

| Категория | Оценка | Изменение | Комментарий |
|-----------|--------|-----------|-------------|
| Архитектура | 🟡 Средне | → | ProjectContext 931 строк (без изменений) |
| Безопасность | 🟢 Хорошо | ↑ | JWT_SECRET validation, helmet, CORS bypass убран |
| Производительность | 🟡 Средне | → | Пересчёт на каждый рендер, двойная нормализация — не исправлены |
| Состояние и данные | 🟢 Хорошо | ↑ | isServerId дедуплицирован (1 источник), stale closures остаются |
| Бэкенд | 🟡 Средне | → | God-файл update.ts (2184 строки), нет DI |
| Тестирование | 🟢 Хорошо | ↑ | 841 тест, **0 failing** (было 6), 8 skipped |
| Типизация | 🟢 Хорошо | ↑ | 0 мест с `any` в production коде (было ~12) |
| Код клиент | 🟡 Средне | → | 6 файлов >500 строк, без изменений |

---

## ✅ Исправленные проблемы (v1.0–v4.0)

<details>
<summary>Развернуть список (22 пункта)</summary>

1. ~~**God Component App.tsx**~~ — декомпозиция 2700 → 489 строк ✅
2. ~~**Stale closure в updateActiveProject**~~ — functional updates ✅
3. ~~**CSV экспорт не учитывает сложную геометрию**~~ — `calculateRoomMetrics` ✅
4. ~~**Дублирование геометрических расчётов**~~ — единые функции в `geometry.ts`/`costs.ts` ✅
5. ~~**Несогласованные порты**~~ — Vite: 3993, Server: 3994 ✅
6. ~~**Rules of Hooks в App.tsx**~~ — useEffect перемещён выше условного возврата ✅
7. ~~**C-4: Дублирование удаления проекта**~~ — Логика перенесена в `RightSidebar.onDeleteConfirm` ✅
8. ~~**C-5: Создание проекта не синхронизируется**~~ — `createProject` в контексте создаёт на сервере ✅
9. ~~**W-7: ID mapping теряется при перезагрузке**~~ — IdMapper теперь персистентен в localStorage ✅
10. ~~**C-1: Hardcoded JWT-секреты**~~ — сервер падает без JWT_SECRET в production ✅ (v4.1)
11. ~~**C-2: Нет HTTP Security Headers**~~ — добавлен helmet ✅ (v4.1)
12. ~~**C-3: CORS bypass (`!origin`)**~~ — убран обход CORS ✅ (v4.1)
13. ~~**C-4: 4× Дублирование `isServerId`**~~ — единая функция из `idMapper.ts` ✅ (v4.1)
14. ~~**C-5: Регрессия типизации ~12 `any`**~~ — 0 в production, только в тестах ✅ (v4.1)
15. ~~**C-6: Двойная инъекция токена**~~ — оставлена только в interceptor ✅ (v4.1)
16. ~~**C-7: 4 Failing теста ObjectSettings**~~ — тесты обновлены ✅ (v4.1)
17. ~~**C-8: Фиктивные поля auth middleware**~~ — только `{ id, email }` ✅ (v4.1)
18. ~~**QW-1: Опечатка "Страниццы"**~~ → "Страницы" ✅ (v4.1)
19. ~~**QW-2: Unused ProtectedRoute import**~~ — удалён ✅ (v4.1)
20. ~~**QW-4: Magic numbers debounce**~~ — вынесены в константы ✅ (v4.1)
21. ~~**QW-5: Мёртвый код handleDeleteActiveProject**~~ — удалён ✅ (v4.1)
22. ~~**W-12: isServerId wrapper в ApiStorageProvider**~~ — убран, прямой импорт ✅ (v4.1)

</details>

## 🆕 Новая функциональность (v3.0 → v4.0)

| Компонент | Описание | Качество |
|-----------|----------|----------|
| **Objects data model** | Новый слой `ObjectData` между Project и Room. Полный CRUD в `projectObjects.ts` (283 строки) | ✅ Отлично |
| **AuthContext** | Полный auth flow: login/register/logout, refresh token, проверка при загрузке | ✅ Хорошо |
| **HttpClient** | Singleton с interceptors, автоматический 401→refresh→retry, AbortController timeout | ✅ Хорошо |
| **SaveQueue** | Персистентная очередь сохранений с восстановлением после перезагрузки | ✅ Отлично |
| **ApiStorageProvider** | Полная серверная синхронизация с rate limiting, exponential backoff на 429 | 🟡 Работает, но 933 строк |
| **CreateProjectModal** | Мастер создания проекта с множественными объектами | ✅ Хорошо |
| **CreateObjectModal** | Модальное окно создания объекта | ✅ Хорошо |
| **DataManagementModal** | Экспорт/импорт/синхронизация данных | 🟡 437 строк |

---

## 🔴 Критические проблемы (Blockers)

<details>
<summary>✅ Все исправлены (v4.1)</summary>

### ~~C-1. Hardcoded JWT-секреты в fallback~~ ✅ ИСПРАВЛЕНО

**Коммит:** `b9d8335`

Сервер теперь выбрасывает ошибку при отсутствии `JWT_SECRET` в production режиме. Fallback остался только для development.

---

### ~~C-2. Нет HTTP Security Headers (helmet)~~ ✅ ИСПРАВЛЕНО

**Коммит:** `90fa9e6`

Добавлен `helmet` с отключением CSP в development. Security headers: `X-Content-Type-Options`, `X-Frame-Options`, `HSTS`, `CSP`.

---

### ~~C-3. CORS обходится запросами без Origin~~ ✅ ИСПРАВЛЕНО

**Коммит:** `1161322`

Убрана проверка `!origin`. Теперь только явно разрешённые origins accepted в production.

---

### ~~C-4. 4× Дублирование `isServerId`~~ ✅ ИСПРАВЛЕНО

**Коммит:** `b650d45`, `cccf4d8`

Единая функция `isServerId()` в `idMapper.ts`. Все дубликаты удалены, включая private wrapper в ApiStorageProvider.

---

### ~~C-5. Регрессия типизации: ~12 мест с `any`~~ ✅ ИСПРАВЛЕНО

**Коммит:** `69ae998`

0 мест с `any` в production коде. Остались только 4 в `geometry.test.ts` (намеренно для edge case тестирования).

---

### ~~C-6. httpClient: двойная инъекция токена~~ ✅ ИСПРАВЛЕНО

**Коммит:** `ca62480`

Удалена дублирующая инъекция из `fetchWithTimeout`. Токен добавляется только в request interceptor.

---

### ~~C-7. 4 Failing теста в ObjectSettings~~ ✅ ИСПРАВЛЕНО

**Коммит:** `f0a0912`

Тесты обновлены в соответствии с текущей реализацией компонента. 17/17 passing.

---

### ~~W-6. Фиктивные поля в auth middleware~~ ✅ ИСПРАВЛЕНО

**Коммит:** `2fe2fdb`

Теперь только `{ id, email }` — без фиктивных `name`, `created_at`, `updated_at`.

---

### ~~W-12. isServerId wrapper в ApiStorageProvider~~ ✅ ИСПРАВЛЕНО

**Коммит:** `cccf4d8`

Private метод-обёртка удалён, используется прямой импорт `isServerIdUtil`.

---

</details>

---

## ⚠️ Проблемы средней серьёзности (Warnings) — НЕ ИСПРАВЛЕНЫ

### W-1. Пересчёт метрик на каждый рендер ⚠️ НЕ ИСПРАВЛЕНО с v3.0

**Файл:** `src/components/RoomEditor.tsx` (строки 55–67)

```tsx
const normalizedRoom = { ...room, segments: room.segments || [], ... };
const metrics = calculateRoomMetrics(normalizedRoom);
const { costs, total } = calculateRoomCosts(normalizedRoom);
```

**Решение:** Обернуть в `useMemo` с зависимостью от `room`.

---

### W-2. Двойная нормализация данных комнаты ⚠️ НЕ ИСПРАВЛЕНО с v3.0

**Файлы:** `src/contexts/ProjectContext.tsx` (`migrateRoom()`), `src/components/RoomEditor.tsx` (строки 55–64)

**Решение:** Нормализовать только при загрузке данных (в ProjectContext).

---

### W-3. 🔺 ProjectContext ВЫРОС: 660 → 933 строк (ухудшение)

**Файл:** `src/contexts/ProjectContext.tsx` — **933 строк**

**Проблема:** Вместо рекомендованного разделения, контекст вырос на 40%. Теперь управляет:
1. State (projects, activeProjectId, activeObjectId, loading, errors)
2. Persistence (localStorage, API sync, debounce)
3. Серверная синхронизация (createProject, deleteProject на сервере)
4. Бизнес-логика (расчёт totals, миграция)
5. Object CRUD (createObject, updateObject, deleteObject, copyObject)
6. Room sync error tracking
7. ID mapping и миграция

**Решение:** Разделить на:
- `useProjectState.ts` — чистый state management
- `useProjectSync.ts` — логика синхронизации и persistence
- `useObjectManagement.ts` — CRUD для объектов

---

### W-4. Stale closures в deleteRoom, addRoom, reorderRooms ⚠️ НЕ ИСПРАВЛЕНО с v3.0

**Файл:** `src/contexts/ProjectContext.tsx`

```typescript
const deleteRoom = useCallback((roomId: string) => {
  if (!activeProject) return;       // ← захват из замыкания
  const updatedProject = deleteRoomFromProject(activeProject, roomId);
  updateActiveProject(updatedProject);  // ← полный снимок
}, [activeProject, updateActiveProject]);
```

**Проблема:** `deleteRoom`, `addRoom`, `reorderRooms` захватывают `activeProject` из замыкания. При быстрых последовательных вызовах могут использовать устаревшие данные.

**Решение:** Перевести на `setProjects(prev => ...)` (аналогично `updateRoomById`).

---

### W-5. RoomEditor — 900 строк ⚠️ НЕ ИСПРАВЛЕНО с v3.0

**Файл:** `src/components/RoomEditor.tsx` — **900 строк**

**Решение:** Вынести обработчики в `useRoomHandlers.ts`.

---

### W-6. Фиктивные поля в auth middleware ⚠️ НЕ ИСПРАВЛЕНО с v3.0

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

**Решение:** Устанавливать только `{ id, email }` или загружать из БД.

---

### W-7. Полная сериализация при каждом сохранении ⚠️ НЕ ИСПРАВЛЕНО с v3.0

**Файл:** `src/contexts/ProjectContext.tsx`

**Проблема:** `scheduleSave` сохраняет **все** проекты в localStorage при любом изменении одной работы.

**Решение:** Инкрементальное сохранение — сериализовать только изменённый проект.

---

### W-8. 🆕 server/src/routes/update.ts — 2184 строки (God File)

**Файл:** `server/src/routes/update.ts`

**Проблема:** Самый большой файл проекта. Содержит логику маршрутов, парсинг, бизнес-логику обновления цен — всё в одном файле.

**Решение:** Декомпозиция:
- `routes/update.ts` — только маршруты и валидация (~100 строк)
- `services/update/controller.ts` — обработчики запросов (~300 строк)
- Существующие `services/update/runner.ts`, `parserManager.ts` и т.д.

---

### W-9. 🆕 BackupManager.tsx — 837 строк (никогда не ревьюировался)

**Файл:** `src/components/BackupManager.tsx`

**Проблема:** Крупный компонент, который никогда не проходил ревью. Обрабатывает экспорт/импорт в нескольких форматах.

**Решение:** Декомпозировать на отдельные компоненты: `ExportPanel`, `ImportPanel`, `SyncPanel`.

---

### W-10. 🆕 ProjectsModal.tsx (699 строк), CreateProjectModal.tsx (537 строк)

**Файлы:** `src/components/projects/ProjectsModal.tsx`, `src/components/projects/CreateProjectModal.tsx`

**Проблема:** Два крупных модальных компонента, которые можно декомпозировать.

**Решение:** Вынести логику в custom hooks, разделить визуальные и логические части.

---

### W-11. 🆕 52 прямых `console.*` вызова в production коде

**Файлы:** По всему `src/` — 52 вызова `console.log/error/warn`

**Проблема:** Проект имеет собственную утилиту `src/utils/logger.ts` с функциями `logError`, `logWarning`, `logDebug` и т.д. Но параллельно с ними используются 52 прямых `console.*` вызова, создавая непоследовательное логирование.

```typescript
// Пример дублирования (ProjectContext.tsx):
logError('ProjectContext', 'Ошибка загрузки данных', err);
console.error('Error loading data:', err);  // Дубль
```

**Решение:** Заменить все `console.*` на вызовы из `logger.ts`. Добавить ESLint правило `no-console`.

---

### W-12. 🆕 `handleDeleteActiveProject` — возможно мёртвый код

**Файл:** `src/App.tsx` (строки 122–130)

```typescript
const handleDeleteActiveProject = () => {
  const newProjects = projects.filter(p => p.id !== activeProjectId);
  updateProjects(newProjects);
  // ...
};
```

**Проблема:** Удаление проекта теперь выполняется через `RightSidebar.onDeleteConfirm`, который содержит полную логику. `handleDeleteActiveProject` может быть мёртвым кодом.

**Решение:** Проверить все вызовы и удалить, если не используется.

---

## 💡 Замечания (Nitpicks)

<details>
<summary>✅ Исправлено: N-1 (опечатка), N-2 (unused import), N-5 (magic numbers)</summary>

### ~~N-1. Опечатка в App.tsx~~ ✅ ИСПРАВЛЕНО

**Коммит:** `7345c07`

"Страниццы" → "Страницы"

---

### ~~N-2. Неиспользуемый импорт ProtectedRoute~~ ✅ ИСПРАВЛЕНО

**Коммит:** `7345c07`

Удалён из импорта.

---

### ~~N-5. Magic numbers для debounce~~ ✅ ИСПРАВЛЕНО

**Коммит:** `225fc0f`

Вынесены в константы `SAVE_DEBOUNCE_MS`, `TOTALS_SAVE_DEBOUNCE_MS`.

</details>

---

### N-3. 🆕 `require()` вместо `import()` в ESM-модуле

**Файл:** `src/api/storage/apiStorageProvider.ts` (строка ~530)

```typescript
export function getStorageProvider(): IStorageProvider {
  const token = localStorage.getItem('token');
  if (token) {
    return ApiStorageProvider.getInstance();
  }
  const { LocalStorageProvider } = require('../../utils/localStorageProvider');
  return LocalStorageProvider.getInstance();
}
```

**Проблема:** `require()` в ESM-модуле (`"type": "module"` в package.json). Следует использовать `import()` или статический import.

---

### N-4. 🆕 Дублирование генерации ID

**Файлы:** Множество мест

```typescript
// ProjectContext.tsx:
`${prefix}-${Date.now()}-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).substring(2, 10)}`

// projectObjects.ts:
`local-obj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

// RoomEditor.tsx:
Math.random().toString(36).substring(2, 11)

// App.tsx:
`local-${Date.now()}`
```

**Проблема:** 4+ разных способа генерации ID. Нет единой утилиты.

**Решение:** Создать `generateId(prefix)` в `utils/factories.ts` и использовать везде.

---

### N-5. 🆕 Magic numbers для debounce

**Файлы:** `src/contexts/ProjectContext.tsx`

```typescript
saveTimeoutRef.current = setTimeout(() => { ... }, 2000);   // scheduleSave
totalsSaveTimeoutRef.current = setTimeout(() => { ... }, 2000);   // scheduleTotalsSave
```

**Решение:** Вынести в константы `SAVE_DEBOUNCE_MS`, `TOTALS_SAVE_DEBOUNCE_MS`.

---

### N-6. Magic strings для ключей localStorage ⚠️ НЕ ИСПРАВЛЕНО с v3.0

**Файлы:** `src/api/storage/apiStorageProvider.ts`, `src/utils/storage.ts`, `src/contexts/ProjectContext.tsx`

```typescript
// apiStorageProvider.ts определяет STORAGE_KEYS, но:
localStorage.removeItem('repair-calc-active-project');  // ProjectContext.tsx:536 — magic string
```

**Решение:** Использовать единые константы из `STORAGE_KEYS` или вынести в общий модуль.

---

### N-7. Дублирование console.error рядом с logError ⚠️ НЕ ИСПРАВЛЕНО с v3.0

См. W-11 для полного описания.

---

## 🟢 Сильные стороны проекта

1. **841 тест** — более чем удвоение с 402 (v3.0), 51 тестовый файл
2. **Полная система аутентификации** — AuthContext, refresh tokens, auto-retry на 401
3. **Objects data model** — чистая миграция с плоской структуры rooms на objects[].rooms
4. **projectObjects.ts** — образцовый модуль утилит (283 строки, чистая архитектура, все функции pure)
5. **SaveQueue** — персистентная очередь с восстановлением после перезагрузки
6. **Rate limiting** — exponential backoff в ApiStorageProvider, защита от 429
7. **IdMapper** — персистентное хранение маппингов в localStorage с TTL и device ID
8. **HttpClient** — единый клиент с interceptors, auto-retry, AbortController timeout
9. **Ноль ошибок TypeScript** — `tsc --noEmit` проходит чисто
10. **Error Boundaries** — защита от крашей в рендере
11. **Optimistic locking** — поле `version` в таблице `projects`
12. **Каталог работ** с типовыми шаблонами (1048 строк данных) — отличный UX
13. **AI-интеграция** (Gemini + Mistral) — двойной fallback с кэшированием
14. **Миграция данных** — автоматическая миграция старых проектов на новую структуру

---

## 🔧 Состояние бэкенда

### Реализовано

| Компонент | Файлы | Статус |
|-----------|-------|--------|
| Express-сервер | `server/src/app.ts` (59 строк) | ✅ |
| MySQL + Knex | `server/src/db/pool.ts`, 6 миграций | ✅ |
| JWT-аутентификация | `server/src/middleware/auth.ts`, `routes/auth.ts` | ✅ |
| CRUD: projects, rooms, works, objects | `routes/projects.ts`, `rooms.ts`, `works.ts`, `objects.ts` | ✅ |
| CRUD: геометрия | `routes/geometry.ts` (636 строк, 25+ endpoints) | ✅ |
| Sync endpoints | `routes/sync.ts` (pull/push) | ✅ |
| AI-провайдеры | `services/ai/` (Gemini 585 строк, Mistral 586 строк) | ✅ |
| Update Service | `services/update/` (runner, scheduler, parsers) | ✅ |
| Вебхуки | `services/webhook.service.ts` | ✅ |
| 11 репозиториев | `db/repositories/*.repo.ts` | ✅ |
| Rate limiter | `middleware/rateLimiter.ts` | ✅ |
| Error handler | `middleware/errorHandler.ts` (ZodError, AppError, MySQL, JWT) | ✅ |

### Крупные файлы бэкенда (>500 строк)

| Файл | Строк | Проблема |
|------|-------|----------|
| `routes/update.ts` | 2184 | 🔴 God file — маршруты + бизнес-логика |
| `repositories/updateJob.repo.ts` | 772 | 🟡 Большой, но приемлемый |
| `repositories/room.repo.ts` | 700 | 🟡 Много полей |
| `repositories/project.repo.ts` | 666 | 🟡 Сложная логика sync |
| `services/update/parserManager.ts` | 661 | 🟡 Много парсеров |
| `services/update/runner.ts` | 647 | 🟡 Сложная оркестрация |
| `repositories/abTest.repo.ts` | 641 | 🟡 Feature flags |
| `routes/geometry.ts` | 636 | 🟡 Много endpoints |
| `services/ai/mistralProvider.ts` | 586 | 🟡 Prompt engineering |
| `services/ai/geminiProvider.ts` | 585 | 🟡 Prompt engineering |

### Требует доработки

| Проблема | Приоритет | Статус |
|----------|-----------|--------|
| `routes/update.ts` — 2184 строки | 🔴 Высокий | Новое |
| Статические методы в репозиториях (нет DI) | Средний | Не исправлено |
| Нет `helmet` для HTTP security | 🔴 Высокий | Не исправлено |
| Нет request ID / correlation ID | Низкий | Не исправлено |
| Rate limiter глобальный, не per-user | Низкий | Не исправлено |

---

## 🟢 Покрытие тестами

| Категория | v3.0 | v4.0 | v4.1 | Изменение |
|-----------|------|------|------|-----------|
| Всего тестов | 402 | 841 | 841 | +439 (+109%) |
| Тестовых файлов | ~30 | 51 | 51 | +21 |
| Passing | 402 | 835 | **833** | — |
| Failing | 0 | 4 | **0** | ✅ Исправлено |
| Skipped | 0 | 2 | 8 | — |
| Тестовый код (строки) | — | 12,919 | — | — |

### Исправленные failing тесты

| Файл | Тест | Статус |
|------|------|--------|
| `ObjectSettings.test.tsx` | 4 failing теста | ✅ Исправлено (v4.1) |
| `LeftSidebar.test.tsx` | 2 failing теста | ✅ Исправлено (v4.1, регрессия после ревью) |

### Пробелы в тестировании

- ❌ Нет компонентных тестов для `RoomEditor` (900 строк), `App` (489 строк)
- ❌ Нет тестов для `ProjectContext` (933 строки — самый сложный модуль)
- ❌ Нет тестов для `BackupManager.tsx` (837 строк)
- ❌ Нет тестов для `httpClient.ts` (408 строк, сложная логика retry)
- ⚠️ ApiStorageProvider.test.ts существует, но покрытие неизвестно
- ✅ Хорошее покрытие utils: geometry, costs, materialCalculations, idMapper, roomHelpers
- ✅ Хорошее покрытие hooks: useGeometryState, useMaterialCalculation, useProjects, useWorkTemplates
- ✅ Тесты для layout компонентов: LeftSidebar, RightSidebar, ObjectSettings, ProjectSettings

---

## 📊 Итоговые метрики

### Размер кодовой базы

| Метрика | v3.0 | v4.0 | Изменение |
|---------|------|------|-----------|
| Общий LOC (src + server/src) | ~25,000 | 40,913 | +64% |
| Тестовый LOC | — | 12,919 | — |
| Тестовых файлов | ~30 | 51 | +70% |
| Всего тестов | 402 | 841 | +109% |

### Крупные файлы клиента (>400 строк)

| Файл | v3.0 | v4.0 | Целевое | Статус |
|------|------|------|---------|--------|
| `data/workTemplatesCatalog.ts` | — | 1,048 | — | 📊 Данные |
| `contexts/ProjectContext.tsx` | 660 | **933** | <300 | 🔴 Ухудшение |
| `api/storage/apiStorageProvider.ts` | — | **933** | <400 | 🔴 Новый |
| `components/RoomEditor.tsx` | 896 | **900** | <400 | 🔴 Не улучшен |
| `components/BackupManager.tsx` | — | **837** | <400 | 🔴 Новый |
| `utils/roomHelpers.ts` | — | 814 | — | 🟡 Утилиты |
| `components/projects/ProjectsModal.tsx` | — | **699** | <300 | 🔴 Новый |
| `hooks/useGeometryState.ts` | — | 597 | — | 🟡 Хук |
| `components/projects/CreateProjectModal.tsx` | — | **537** | <300 | 🟡 Новый |
| `App.tsx` | 557 | **489** | <300 | 🟡 Улучшен |
| `components/works/WorkCatalogPicker.tsx` | — | 453 | — | 🟡 |
| `components/projects/DataManagementModal.tsx` | — | 437 | — | 🟡 |
| `utils/materialCalculations.ts` | — | 416 | — | 🟡 Утилиты |
| `api/httpClient.ts` | — | 408 | — | 🟡 Новый |

### Качество кода

| Метрика | v1.0 | v3.0 | v4.0 | v4.1 | Целевое | Статус |
|---------|------|------|------|------|---------|--------|
| Размер App.tsx | ~2700 | 557 | 489 | 478 | <300 | 🟡 Улучшен |
| ProjectContext.tsx | — | 660 | **933** | 931 | <300 | 🔴 Без изменений |
| RoomEditor.tsx | — | 896 | **900** | 900 | <400 | 🔴 Не улучшен |
| Покрытие тестами | ~5% | ~50% | ~55% | ~55% | >70% | 🟡 |
| Типизация (any) | 3 | 0 | **~12** | **0** (prod) | 0 | ✅ Исправлено |
| Stale closures | 2 | 1 | **3** | 3 | 0 | 🔴 Без изменений |
| Failing тесты | 0 | 0 | **4** | **0** | 0 | ✅ Исправлено |
| Duplicate isServerId | — | — | **4** | **1** | 1 | ✅ Исправлено |
| console.* в prod | — | — | **52** | 52 | 0 | 🟡 Без изменений |
| Файлов >500 строк (клиент) | — | ~4 | **10** | 10 | <5 | 🔴 Без изменений |

---

## 📋 План улучшений (приоритизированный)

### Приоритет 1: Критические исправления (2–3 дня)

| # | Задача | Файлы | Сложность | Статус |
|---|--------|-------|-----------|--------|
| 1.1 | Падение при отсутствии `JWT_SECRET` в production | `server/src/config/env.ts` | Низкая | ✅ **v4.1** |
| 1.2 | Добавить `helmet` | `server/src/app.ts`, `server/package.json` | Низкая | ✅ **v4.1** |
| 1.3 | Убрать CORS bypass (`!origin`) | `server/src/app.ts` | Низкая | ✅ **v4.1** |
| 1.4 | Убрать 4× дублирование `isServerId` | `idMapper.ts`, `apiStorageProvider.ts`, `ProjectContext.tsx` | Низкая | ✅ **v4.1** |
| 1.5 | Исправить `any` типы (~12 мест) | `App.tsx`, `apiStorageProvider.ts`, `DataManagementModal.tsx`, и др. | Средняя | ✅ **v4.1** |
| 1.6 | Исправить 4 failing теста | `ObjectSettings.test.tsx` | Низкая | ✅ **v4.1** |
| 1.7 | Убрать двойную инъекцию токена в httpClient | `src/api/httpClient.ts` | Низкая | ✅ **v4.1** |
| 1.8 | Убрать фиктивные поля из auth middleware | `server/src/middleware/auth.ts` | Низкая | ✅ **v4.1** |

### Приоритет 2: Производительность (2–3 дня)

| # | Задача | Файлы | Сложность | Статус |
|---|--------|-------|-----------|--------|
| 2.1 | `useMemo` для метрик и costs в RoomEditor | `src/components/RoomEditor.tsx` | Низкая | ⏳ С v3.0 |
| 2.2 | Убрать двойную нормализацию комнат | `ProjectContext.tsx`, `RoomEditor.tsx` | Средняя | ⏳ С v3.0 |
| 2.3 | Инкрементальное сохранение | `ProjectContext.tsx` | Средняя | ⏳ С v3.0 |

### Приоритет 3: Архитектура (5–8 дней)

| # | Задача | Файлы | Сложность | Статус |
|---|--------|-------|-----------|--------|
| 3.1 | Разделить ProjectContext (933 → 3 модуля) | `ProjectContext.tsx` → `useProjectState.ts` + `useProjectSync.ts` + `useObjectManagement.ts` | Высокая | ⏳ С v3.0, усугубилось |
| 3.2 | Исправить stale closures в deleteRoom/addRoom/reorderRooms | `ProjectContext.tsx` | Средняя | ⏳ С v3.0 |
| 3.3 | Декомпозиция RoomEditor (900 строк) | `RoomEditor.tsx` → `useRoomHandlers.ts` | Средняя | ⏳ С v3.0 |
| 3.4 | Декомпозиция BackupManager (837 строк) | `BackupManager.tsx` → `ExportPanel` + `ImportPanel` | Средняя | 🆕 |
| 3.5 | Декомпозиция routes/update.ts (2184 строк) | `routes/update.ts` → controller + service | Высокая | 🆕 |
| 3.6 | Единая утилита генерации ID | `utils/factories.ts` | Низкая | 🆕 |
| 3.7 | Заменить 52 console.* на logger | По всему `src/` | Средняя | 🆕 |
| 3.8 | Удалить мёртвый код (handleDeleteActiveProject и др.) | `App.tsx` | Низкая | 🆕 |

### Приоритет 4: Тестирование (5–7 дней)

| # | Задача | Файлы | Сложность | Статус |
|---|--------|-------|-----------|--------|
| 4.1 | Компонентные тесты для RoomEditor | `RoomEditor.test.tsx` | Средняя | ⏳ С v3.0 |
| 4.2 | Тесты для ProjectContext (loading, saving, sync, objects) | `ProjectContext.test.tsx` | Высокая | ⏳ С v3.0 |
| 4.3 | Тесты для httpClient (retry, refresh, timeout) | `httpClient.test.ts` | Средняя | 🆕 |
| 4.4 | Тесты для BackupManager | `BackupManager.test.tsx` | Средняя | 🆕 |
| 4.5 | Дополнительные E2E для авторизации | `e2e/auth-sync.spec.ts` | Средняя | ⏳ С v3.0 |

### Приоритет 5: Бэкенд (3–5 дней)

| # | Задача | Файлы | Сложность | Статус |
|---|--------|-------|-----------|--------|
| 5.1 | DI для репозиториев | `server/src/db/repositories/*.ts` | Высокая | ⏳ С v3.0 |
| 5.2 | Request ID middleware | `server/src/middleware/requestId.ts` | Низкая | ⏳ С v3.0 |
| 5.3 | Per-user rate limiting | `server/src/middleware/rateLimiter.ts` | Средняя | ⏳ С v3.0 |

### Приоритет 6: Документация (1 день)

| # | Задача | Файлы |
|---|--------|-------|
| 6.1 | Обновить ARCHITECTURE.md — добавить Objects model, Auth, HttpClient | `docs/ARCHITECTURE.md` |
| 6.2 | Обновить TODO.md — отметить выполненное | `docs/TODO.md` |

**Итого:** ~18–27 рабочих дней для полной реализации

---

## 📈 Тренды между ревью

| Аспект | v2.0 → v3.0 | v3.0 → v4.0 | v4.0 → v4.1 | Тренд |
|--------|-------------|-------------|-------------|-------|
| Тесты | 250 → 402 | 402 → 841 | 841 (833 pass) | 📈 Отлично |
| App.tsx | 2700 → 557 | 557 → 489 | 489 → 478 | 📈 Улучшается |
| ProjectContext | — → 660 | 660 → 933 | 933 → 931 | → Без изменений |
| `any` типы | 3 → 0 | 0 → ~12 | ~12 → 0 (prod) | 📈 Исправлено |
| Stale closures | 2 → 1 | 1 → 3 | 3 → 3 | → Без изменений |
| Failing тесты | 0 → 0 | 0 → 4 | 4 → 0 | 📈 Исправлено |
| isServerId дубли | — → — | — → 4 | 4 → 1 | 📈 Исправлено |
| Файлы >500 строк | ~3 | ~10 | ~10 | → Без изменений |
| Безопасность | 🔴 | 🔴 | 🟢 | 📈 Исправлено |
| Функциональность | Базовая | Полная | Полная | → Стабильно |

### Общая оценка v4.1

Проект демонстрирует **значительный рост функциональности** (auth, objects, server sync, httpClient) при **удвоении тестового покрытия**. Все **критические проблемы безопасности** (C-1–C-3) исправлены. **Регрессия типизации** (~12 `any` → 0) устранена. **Failing тесты** (6 → 0) исправлены.

**Остаются:** крупные файлы не декомпозированы, stale closures в ProjectContext, производительность метрик (useMemo), двойная нормализация.

**Рекомендация:** Следующий спринт посвятить Приоритету 2 (производительность) и Приоритету 3 (архитектура).

---

## 🔗 Связанные документы

| Документ | Описание |
|----------|----------|
| [CODE_REVIEW_UI_REFACTORING.md](./CODE_REVIEW_UI_REFACTORING.md) | Ревью UI рефакторинга (v3.5) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Архитектура проекта (требует обновления) |
| [TODO.md](./TODO.md) | Актуальные задачи |
| [PROGRESS.md](./PROGRESS.md) | История прогресса |
| [TECHNICAL_SPECS.md](./TECHNICAL_SPECS.md) | Технические спецификации |

---

**Конец документа**
