# TODO: Актуальные задачи (Repair Calculator)

**Дата последнего обновления:** 2026-04-13
**Статус версий:** Базовые фичи (v1-v4.2) завершены (основные модули, миграция API, рефакторинг UI, геометрия, Objects model, Auth, инкрементальное сохранение).

## 🔴 Приоритет 0: Стабилизация E2E-тестов (1–2 дня)
> **Контекст:** Инфраструктура Playwright готова (v4.2), добавлены `data-testid`, исправлены антипаттерны, но 50/52 тестов пока падают из-за устаревших текстовых селекторов в старых сценариях и проблем с загрузкой/авторизацией.

### Выполнено ✅

- `[x]` **Починить `e2e/objects.spec.ts`** (4/4 тестов) ✅ 2026-04-13
  - **Проблема:** JWT-токен из `fixtures.ts` был валиден для реального бэкенда → сервер возвращал реальные данные → перезаписывал тестовые
  - **Решение:** Очистка `token`/`refreshToken` в `beforeEach` перед `page.goto('/')`
  - **Также:** исправлены `getByRole('option')` → `selector.locator('option')` (options в `<select>` не visible); `window.confirm` → `page.once('dialog')`; строгие селекторы на `data-testid`

### Осталось сделать

- `[ ]` **Обновить селекторы на `data-testid`** в оставшихся файлах тестов:
  - `room-input.spec.ts` (3 теста)
  - `rooms.spec.ts` (5 тестов)
  - `geometry.spec.ts` (3 теста)
  - `works.spec.ts` (4 теста)
  - `core-workflow.spec.ts` (3 теста)
- `[ ]` **Починить `export-import.spec.ts` и `work-templates.spec.ts`** — те же проблемы с auth-токенами
- `[ ]` Убедиться, что тексты кнопок в тестах соответствуют реальному UI (особенно в блоке Geometry «Добавить окно/дверь»).
- `[ ]` Добиться >80% успешного прохождения тест-сьюта.

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
- `[ ]` Заменить 64 `console.*` на встроенный logger (добавить ESLint правило `no-console`)
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
- `[x]` Создать детализированное ТЗ — `docs/spec/SPEC-001-SYSTEM.md` ✅ 2026-04-13
- `[ ]` Обновить `docs/ARCHITECTURE.md` — добавить Objects model, Auth, HttpClient, сервер (уже реализован!)
- `[ ]` Обновить `docs/INDEX.md` — актуализировать количество тестов, структуру, зависимости

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
