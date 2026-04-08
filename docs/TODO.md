# TODO: Замечания и задачи по проекту Repair Calculator

**Дата:** 2026-03-04
**Обновлено:** 2026-04-08
**Источники:** [CODE_REVIEW.md](./CODE_REVIEW.md), ревью шаблонов работ, архитектурный анализ

---

## 🎯 Quick Wins (10–30 минут каждая)

> Задачи с большим эффектом и минимальными усилиями. Можно брать в любой момент.

| # | Задача | Файл | Эффект |
|---|--------|------|--------|
| QW-1 | Исправить опечатку: "Страниццы" → "Страницы" | `src/App.tsx` | Чистота кода |
| QW-2 | Удалить неиспользуемый импорт `ProtectedRoute` | `src/App.tsx` | Чистота кода |
| QW-3 | Исправить 4 failing теста в ObjectSettings | `tests/components/layout/ObjectSettings.test.tsx` | ✅ Зелёный CI |
| QW-4 | Вынести magic numbers debounce в константы (`SAVE_DEBOUNCE_MS`, `TOTALS_SAVE_DEBOUNCE_MS`) | `src/contexts/ProjectContext.tsx` | Читаемость |
| QW-5 | Удалить мёртвый код `handleDeleteActiveProject` | `src/App.tsx` | Уменьшение дублирования |
| QW-6 | Убрать фиктивные поля из auth middleware (`created_at`, `updated_at`) | `server/src/middleware/auth.ts` | Корректность данных |

---

## 🔴 Приоритет 1: Критические исправления (2–3 дня)

> **Зависимости:** None — можно начинать сразу.

### 1.1 Безопасность (не исправлено с v3.0)

- [ ] **C-1** Падение при отсутствии `JWT_SECRET` в production — `server/src/config/env.ts`
  - Если `NODE_ENV=production` и `JWT_SECRET` не задан → `throw new Error(...)`
- [ ] **C-2** Добавить `helmet` — `server/src/app.ts`, `server/package.json`
  - HTTP Security Headers: `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`
- [ ] **C-3** Убрать CORS bypass (`!origin`) — `server/src/app.ts`
  - Убрать `!origin` из условия или ограничить через env-переменную

### 1.2 Качество кода

- [ ] **C-4** Убрать 4× дублирование `isServerId`
  - Файлы: `idMapper.ts`, `apiStorageProvider.ts`, `ProjectContext.tsx`
  - Решение: оставить единственный `IdMapper.isServerId()` или экспортированную функцию из `idMapper.ts`
  - **→ Блокирует 3.1** (разделение ProjectContext)
- [ ] **C-5** Исправить `any` типы (~12 мест) — регрессия с v3.0
  - `App.tsx`, `apiStorageProvider.ts`, `DataManagementModal.tsx`, `SummaryView.tsx`, `projects.ts`
  - **→ Блокирует 3.1, 3.4** (декомпозиция с чистыми типами)
- [ ] **C-6** Убрать двойную инъекцию токена в `httpClient.ts`
  - Токен добавляется дважды: в interceptor и в `fetchWithTimeout`. Оставить только в interceptor

---

## 🟡 Приоритет 2: Производительность (2–3 дня)

- [ ] **2.1** `useMemo` для метрик и costs в RoomEditor — `src/components/RoomEditor.tsx`
  - Обернуть `calculateRoomMetrics` и `calculateRoomCosts` в `useMemo`
- [ ] **2.2** Убрать двойную нормализацию комнат
  - Файлы: `ProjectContext.tsx`, `RoomEditor.tsx`
  - Нормализовать только при загрузке данных (в ProjectContext)
- [ ] **2.3** Инкрементальное сохранение — `ProjectContext.tsx`
  - Сериализовать только изменённый проект, а не все проекты

---

## 🟠 Приоритет 3: Архитектура (5–8 дней)

> **Зависимости:** 3.1 зависит от **C-4** (isServerId) и **C-5** (any типы)

### 3.1 Декомпозиция ProjectContext (933 → 3 модуля)

- [ ] **3.1.1** Создать `useProjectState.ts` — чистый state management
- [ ] **3.1.2** Создать `useProjectSync.ts` — логика синхронизации и persistence
- [ ] **3.1.3** Создать `useObjectManagement.ts` — CRUD для объектов
- [ ] **3.1.4** Исправить stale closures в `deleteRoom`/`addRoom`/`reorderRooms` (перевести на `setProjects(prev => ...)`)

### 3.2 Декомпозиция крупных файлов

- [ ] **3.2.1** Декомпозиция RoomEditor (900 строк) — вынести обработчики в `useRoomHandlers.ts`
- [ ] **3.2.2** Декомпозиция BackupManager (837 строк) → `ExportPanel` + `ImportPanel` + `SyncPanel`
- [ ] **3.2.3** Декомпозиция routes/update.ts (2184 строки) → controller + service

### 3.3 Утилиты и консистентность

- [ ] **3.3.1** Единая утилита генерации ID — `utils/factories.ts`
  - Заменить 4+ разных способа генерации ID на `generateId(prefix)`
- [ ] **3.3.2** Заменить 52 `console.*` на logger — по всему `src/`
  - Добавить ESLint правило `no-console`
- [ ] **3.3.3** Заменить `require()` на `import()` в ESM-модуле — `apiStorageProvider.ts`
- [ ] **3.3.4** Использовать единые константы для localStorage keys — вынести из `apiStorageProvider.ts` в общий модуль

---

## 🧪 Приоритет 4: Тестирование (5–7 дней)

> **Зависимости:** 4.2 (тесты ProjectContext) — **после 3.1** (декомпозиция)

### Актуальное состояние

| Метрика | Значение |
|---------|----------|
| Всего тестов | 841 |
| Passing | 829 |
| Failing | 4 🔴 |
| Skipped | 8 |
| Тестовых файлов | 51 |

### Задачи

- [ ] **4.1** Компонентные тесты для RoomEditor (900 строк) — `RoomEditor.test.tsx`
- [ ] **4.2** Тесты для ProjectContext (933 строки) — `ProjectContext.test.tsx`
  - Loading, saving, sync, objects management
  - ⚠️ **После декомпозиции 3.1** — тестировать разделённые хуки
- [ ] **4.3** Тесты для httpClient — `httpClient.test.ts`
  - Retry logic, refresh token, timeout handling
- [ ] **4.4** Тесты для BackupManager — `BackupManager.test.tsx`
- [ ] **4.5** Дополнительные E2E для авторизации — `e2e/auth-sync.spec.ts`

---

## 🔧 Приоритет 5: Бэкенд (3–5 дней)

- [ ] **5.1** DI для репозиториев — `server/src/db/repositories/*.ts`
  - Статические методы → инстансы с dependency injection
- [ ] **5.2** Request ID middleware — `server/src/middleware/requestId.ts`
- [ ] **5.3** Per-user rate limiting — `server/src/middleware/rateLimiter.ts`

---

## 📚 Приоритет 6: Документация (1 день)

- [ ] **6.1** Обновить ARCHITECTURE.md — добавить Objects model, Auth, HttpClient
- [ ] **6.2** Обновить TODO.md — отметить выполненное

---

## 📋 Backlog: будущие фазы (после закрытия техдолга)

> ⚠️ **Не начинать**, пока не закрыты Приоритеты 1–3.

### Фаза 11: UI управления проектами и объектами

**Спецификация:** [PROJECTS_UI_PLAN.md](./PROJECTS_UI_PLAN.md)

#### Этап 11.1: Модальное окно "Мои проекты"

- [ ] **11.1.1** Создать `src/components/projects/ProjectsModal.tsx` ✅ (уже существует, 699 строк)
- [ ] **11.1.2** Рефакторинг BackupManager (837 строк) — **перенесено в 3.2.2**
- [ ] **11.1.3** Заменить кнопку "Данные" на "Мои проекты"

#### Этап 11.2: Интеграция UI объектов в сайдбар

- [ ] **11.2.1** ObjectSelector в сайдбар
- [ ] **11.2.2** Секция "Другие объекты" внизу сайдбара

#### Этап 11.3: Обновление SummaryView

- [ ] **11.3.1** Группировка итогов по объектам
- [ ] **11.3.2** Промежуточные итоги по каждому объекту

---

### Фаза 10: Offline-first (Опционально) — 2-3 дня

- [ ] **10.1** Установить idb (IndexedDB wrapper)
- [ ] **10.2** Реализовать OfflineQueue
- [ ] **10.3** POST /api/sync/push
- [ ] **10.4** GET /api/sync/pull
- [ ] **10.5** Детекция online/offline статуса
- [ ] **10.6** UI-индикатор синхронизации

---

### Фаза 9: PWA (Опционально) — 2-3 дня

- [ ] **9.1** Установить vite-plugin-pwa
- [ ] **9.2** Настроить service worker
- [ ] **9.3** Создать иконки
- [ ] **9.4** Протестировать offline-режим

---

## ✅ Выполнено

### Критичные (Blockers) — ВСЕ ИСПРАВЛЕНЫ

- [x] **Stale closure в `updateActiveProject`** — ✅ Исправлено ранее
- [x] **CSV-экспорт игнорирует extended/advanced режимы** — ✅ Исправлено 2026-03-04
- [x] **Расхождение портов** — ✅ Исправлено ранее
- [x] **Утечка API-ключа в клиентский бандл** — ✅ Исправлено ранее
- [x] **Rules of Hooks в `App.tsx`** — ✅ Исправлено 2026-03-09 (useEffect перемещён выше условного возврата)
- [x] **Кодировка MySQL (кириллица)** — ✅ Исправлено 2026-03-31 (см. [CYRILLIC_ENCODING_FIX.md](./CYRILLIC_ENCODING_FIX.md))

### Фаза 1: Декомпозиция App.tsx — ВЫПОЛНЕНО

- [x] **God Component `App.tsx`** — декомпозиция завершена. App.tsx теперь ~489 строк (было ~2700).
- [x] Типы вынесены в `src/types/`
- [x] Утилиты вынесены в `src/utils/` (geometry.ts, costs.ts, factories.ts, storage.ts)
- [x] Компоненты вынесены: `SummaryView`, `RoomEditor`, `BackupManager`, `RoomList`, `WorkList`, `NumberInput`
- [x] Хуки вынесены: `useProjects`, `useWorkTemplates`
- [x] Начальные данные вынесены в `src/data/initialData.ts`

### Зависимости

- [x] **Мёртвые зависимости** — `@google/genai`, `better-sqlite3`, `express`, `dotenv`, `motion` удалены ✅

### Шаблоны работ

- [x] **`CATEGORY_LABELS` в модальном окне** — исправлено, импортируется из `workTemplate.ts` ✅
- [x] **`index.ts` бочки обновлены** ✅

---

## 🚀 Архив выполненных фаз

<details>
<summary><strong>Фаза 6: Управление объектами</strong> — ✅ ЗАВЕРШЕНО</summary>

- [x] **6.1** Objects Save Fix — исправлены критические проблемы с сохранением
- [x] **6.2** Server repositories возвращают `project → objects → rooms` иерархию
- [x] **6.3** Frontend использует атомарные транзакционные сохранения
- [x] **6.4** Локальные ID объектов заменяются на server ID при синхронизации
- [x] **6.5** Helper functions в `src/utils/projectObjects.ts` для работы с объектами
- [x] **6.6** Автоматическая миграция старых проектов → objects[0].rooms
- [x] **6.7** Обратная совместимость с устаревшей структурой rooms

**Документация:** [OBJECTS_SAVE_FIX_COMPLETED.md](./OBJECTS_SAVE_FIX_COMPLETED.md)

</details>

<details>
<summary><strong>Фаза 3: Улучшение архитектуры</strong> — ✅ ВЫПОЛНЕНО</summary>

- [x] **3.1** Создать интерфейс `IStorageProvider` для абстракции storage
- [x] **3.2** Добавить React Error Boundaries
- [x] **3.3** Вынести глобальное состояние в Context API
- [x] **3.4** Добавить `React.memo` для тяжёлых компонентов

</details>

<details>
<summary><strong>Фаза 4: Тестирование</strong> — ✅ ВЫПОЛНЕНО</summary>

- [x] **4.1** Unit-тесты для utils
- [x] **4.2** Unit-тесты для хуков
- [x] **4.3** Integration тесты
- [x] **4.4** Расширение E2E тестов

</details>

<details>
<summary><strong>Фаза 7: Миграция на базу данных</strong> — ✅ ВЫПОЛНЕНО</summary>

- [x] **7.1** Express-сервер с MySQL + Knex
- [x] **7.2** JWT-аутентификация
- [x] **7.3** CRUD для projects, rooms, works, objects
- [x] **7.4** CRUD для геометрии (25+ endpoints)
- [x] **7.5** AI-интеграция (Gemini + Mistral)
- [x] **7.6** Unit и integration тесты

</details>

<details>
<summary><strong>Фаза 8: Update Service</strong> — ✅ ВЫПОЛНЕНО</summary>

- [x] **8.1** Миграции для таблиц Update Service
- [x] **8.2** AI-парсеры (Gemini, Mistral)
- [x] **8.3** Web Scraper парсеры
- [x] **8.4** Оптимизации (кэш, batch, приоритеты)
- [x] **8.5** Scheduler (cron)
- [x] **8.6** Мониторинг (health, metrics)
- [x] **8.7** Вебхуки, экспорт/импорт цен, A/B тестирование

</details>

---

## 📈 Метрики успеха

| Метрика | v1.0 | v3.0 | v4.0 | Целевое | Статус |
|---------|------|------|------|---------|--------|
| Размер App.tsx | ~2700 | 557 | 489 | <300 | 🟡 Улучшен |
| ProjectContext.tsx | — | 660 | 933 | <300 | 🔴 Ухудшение |
| RoomEditor.tsx | — | 896 | 900 | <400 | 🔴 Не улучшен |
| Покрытие тестами | ~5% | ~50% | ~55% | >70% | 🟡 |
| Типизация (any) | 3 | 0 | ~12 | 0 | 🔴 Регрессия |
| Failing тесты | 0 | 0 | 4 | 0 | 🔴 Регрессия |
| console.* в prod | — | — | 52 | 0 | 🟡 Новое |

### Крупные файлы (>500 строк):

| Файл | Строк | Статус |
|------|-------|--------|
| `data/workTemplatesCatalog.ts` | 1048 | 📊 Данные |
| `contexts/ProjectContext.tsx` | 933 | 🔴 Требует декомпозиции |
| `api/storage/apiStorageProvider.ts` | 933 | 🔴 Требует декомпозиции |
| `components/RoomEditor.tsx` | 900 | 🔴 Не улучшен |
| `components/BackupManager.tsx` | 837 | 🔴 Требует декомпозиции |
| `utils/roomHelpers.ts` | 814 | 🟡 Утилиты |
| `components/projects/ProjectsModal.tsx` | 699 | 🟡 |
| `hooks/useGeometryState.ts` | 597 | 🟡 Хук |
| `components/projects/CreateProjectModal.tsx` | 537 | 🟡 |
| `App.tsx` | 489 | 🟡 |
| `components/works/WorkCatalogPicker.tsx` | 453 | 🟡 |
| `components/projects/DataManagementModal.tsx` | 437 | 🟡 |
| `utils/materialCalculations.ts` | 416 | 🟡 Утилиты |
| `api/httpClient.ts` | 408 | 🟡 |

---

**См. также:** [CODE_REVIEW.md](./CODE_REVIEW.md), [ARCHITECTURE.md](./ARCHITECTURE.md)
