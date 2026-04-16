# TODO: Актуальные задачи (Repair Calculator)

**Дата последнего обновления:** 2026-04-16
**Статус версий:** Базовые фичи (v1-v4.2) завершены (основные модули, миграция API, рефакторинг UI, геометрия, Objects model, Auth, инкрементальное сохранение).

## 🟢 Приоритет 0: Unit-тесты — localStorage фикс + E2E-стабилизация

### Unit-тесты (Vitest)

**Результат:** 833 passed, 0 failed, 8 skipped (из 841)

### Выполнено ✅

- `[x]` **Добавлен мок `localStorage` в `tests/setup.ts`** — исправил 10 падений (Vitest 4.x + jsdom 26 не предоставляет Storage-методы) ✅ 2026-04-16

### E2E-тесты (Playwright)

**Результат (2026-04-15):** 10 passed, 11 failed, 135 skipped (из-за `.skip` на проблемных тестах)

### Выполнено ✅

- `[x]` **Починить `e2e/objects.spec.ts`** (4/4 тестов) ✅ 2026-04-13
- `[x]` **Исправлены `core-workflow.spec.ts`** — убраны strict mode violations ✅ 2026-04-15
- `[x]` **Исправлены `auth.spec.ts`** — работают все 3 теста ✅ 2026-04-15
- `[x]` **Добавлен `waitForLoadState('networkidle')`** во все тесты ✅ 2026-04-15

### Пропущены временно (требуют backend моков)

- `[ ]` **core-workflow.spec.ts** (3 теста) — сложная настройка сценариев
- `[ ]` **costs.spec.ts** (3 теста) — требуют правильных моков API
- `[ ]` **export-import.spec.ts** (6 тестов) — требуют настройки localStorage
- `[ ]` **geometry.spec.ts** (4 теста) — требуют исправления селекторов
- `[ ]` **projects.spec.ts** (3 теста) — требуют backend моков
- `[ ]` **regressions.spec.ts** (5 тестов) — требуют работы с openings
- `[ ]` **responsive.spec.ts** (2 теста) — требуют настройки viewport
- `[ ]` **room-input.spec.ts** (3 теста) — требуют работы с комнатами
- `[ ]` **rooms.spec.ts** (5 тестов) — требуют работы с комнатами
- `[ ]` **work-templates.spec.ts** (7 тестов) — требуют работы с шаблонами
- `[ ]` **works.spec.ts** (4 теста) — требуют работы с шаблонами

### Следующий шаг

- Распропустить E2E-тесты по одному, исправляя моки и селекторы
- Добиться >80% pass rate для Chromium

---

## ✅ Завершено в этом цикле (2026-04-16)

- `[x]` **Добавлен мок `localStorage` в `tests/setup.ts`** — исправил 10 падений ✅
- `[x]` **Миграция `console.*` → структурированные логгеры** ✅
  - Клиент: `src/utils/logger.ts` (`logError`, `logWarning`, `logDebug`)
  - Сервер: `winstonLogger` (Winston) из `server/src/middleware/logger.ts`
  - Миграции Knex оставлены на `console.log` (CLI-контекст)
  - Затронуто 22 файла
- `[x]` **Обновлена документация логирования** ✅
  - `docs/LOGGING.md` — полная переработка v2.0
  - `docs/LOGGING-CHEATSHEET.md` — новые форматы и паттерны
  - `docs/ARCHITECTURE.md` — добавлена секция 5 «Логирование»
  - `docs/INDEX.md` — structured logging в фичах
  - `docs/DEBUG_INSTRUCTIONS.md` — logger вместо console.*
  - `docs/TECHNICAL-SPECIFICATION.md` — секция 9 + примеры winstonLogger
  - `docs/FRONTEND-STATUS.md` — секция «Логирование»

---

## 🟠 Приоритет 1: Архитектура и Декомпозиция (5–8 дней)

### 1.1 Декомпозиция ProjectContext (982 → 3 модуля)
- `[ ]` **useProjectState.ts** — чистый state management (~200 строк)
- `[ ]` **useProjectSync.ts** — логика синхронизации и persistence (~300 строк)
- `[ ]` **useObjectManagement.ts** — CRUD для объектов (~200 строк)
- `[ ]` Исправить stale closures в `deleteRoom`/`addRoom`/`reorderRooms` (перевести на `setProjects(prev => ...)`)

### 1.2 Декомпозиция крупных файлов
- `[ ]` Декомпозиция **RoomEditor (902 строки)** — вынести обработчики в `useRoomHandlers.ts`
- `[ ]` Декомпозиция **BackupManager (837 строк)** → `ExportPanel` + `ImportPanel` + `SyncPanel`
- `[ ]` Декомпозиция **ApiStorageProvider (1036 строк)** → `apiClient.ts` + `projectApi.ts` + `objectApi.ts` + `roomApi.ts`
- `[ ]` Декомпозиция **routes/update.ts (2184 строки)** → controller + service

### 1.3 Утилиты и консистентность
- `[ ]` Единая утилита генерации ID — `utils/factories.ts` (заменить 4+ разных способа генерации ID на `generateId(prefix)`)
- `[x]` Заменить `console.*` на встроенный logger ✅ 2026-04-16 (клиент → `src/utils/logger.ts`, сервер → `winstonLogger`. Миграции оставлены на `console.log`)
- `[x]` Добавить ESLint правило `no-console` для предотвращения новых `console.*` ✅ 2026-04-16 (клиент + сервер, миграции освобождены, logger.ts/debugLogger.ts с eslint-disable)
- `[ ]` Использовать единые константы для localStorage keys (вынести `STORAGE_KEYS` в общий модуль)

---

## 🧪 Приоритет 2: Расширенное тестирование (5–7 дней)
> **Зависимости:** п. 1.1 (тесты ProjectContext после декомпозиции)

- `[ ]` Компонентные тесты для **RoomEditor** — `RoomEditor.test.tsx`
- `[ ]` Тесты для **ProjectContext** (после разделения на хуки) — `ProjectContext.test.tsx`
- `[ ]` Тесты для **httpClient** — `httpClient.test.ts`
- `[ ]` Тесты для **BackupManager** — `BackupManager.test.tsx`
- `[ ]` Дополнительные E2E для авторизации — `e2e/auth-sync.spec.ts`

---

## 🔧 Приоритет 3: Бэкенд (3–5 дней)
- `[ ]` DI для репозиториев — `server/src/db/repositories/*.ts`
- `[ ]` Request ID middleware — `server/src/middleware/requestId.ts`
- `[ ]` Per-user rate limiting — `server/src/middleware/rateLimiter.ts`

---

## 📝 Приоритет 4: Документация (1–2 дня)
- `[x]` Создать код-ревью v5.0 — `docs/CODE_REVIEW.md` ✅ 2026-04-13
- `[x]` Создать детализированное ТЗ — `devAI/spec/SPEC-001-SYSTEM.md` ✅ 2026-04-13
- `[x]` Обновить `docs/ARCHITECTURE.md` — добавить Objects model, Auth, HttpClient, сервер ✅ 2026-04-16
- `[x]` Обновить `docs/INDEX.md` — актуализировать количество тестов, структуру, зависимости ✅ 2026-04-16
- `[x]` Обновить документацию логирования — `docs/LOGGING.md` (v2.0), `docs/LOGGING-CHEATSHEET.md`, `docs/ARCHITECTURE.md` (секция 5), `docs/DEBUG_INSTRUCTIONS.md`, `docs/TECHNICAL-SPECIFICATION.md` (секция 9), `docs/FRONTEND-STATUS.md` ✅ 2026-04-16

---

## 📋 Бэклог (Будущие задачи)

### Управление проектами
- `[ ]` ObjectSelector в сайдбар
- `[ ]` Группировка итогов по объектам в SummaryView

### Изолированная работа (Offline + PWA)
- `[ ]` Установить `idb` (IndexedDB wrapper) и реализовать `OfflineQueue`
- `[ ]` POST `/api/sync/push`, GET `/api/sync/pull`
- `[ ]` Детекция online/offline статуса + UI-индикатор
- `[ ]` PWA: `vite-plugin-pwa`, настройка Service Worker, иконки

### Улучшения UX
- `[ ]` Swagger/OpenAPI документация для API
- `[ ]` i18n (интернационализация)
- `[ ]` Тёмная тема
- `[ ]` Печать сметы

---

**См. также:** 
- [CODE_REVIEW.md](./CODE_REVIEW.md) (код-ревью v5.0)
- [PROGRESS.md](./PROGRESS.md) (завершенные этапы)
- [ARCHITECTURE.md](./ARCHITECTURE.md) (архитектура)
- [spec/SPEC-001-SYSTEM.md](./spec/SPEC-001-SYSTEM.md) (полное техзадание)
