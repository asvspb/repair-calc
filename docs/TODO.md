# TODO: Актуальные задачи (Repair Calculator)

**Дата последнего обновления:** 2026-04-12  
**Статус версий:** Базовые фичи (v1-v4.2) завершены (основные модули, миграция API, рефакторинг UI, геометрия). 

---

## 🟠 Приоритет 1: Архитектура и Декомпозиция (5–8 дней)

### 1.1 Декомпозиция ProjectContext (931 → 3 модуля)
- `[ ]` **useProjectState.ts** — чистый state management
- `[ ]` **useProjectSync.ts** — логика синхронизации и persistence
- `[ ]` **useObjectManagement.ts** — CRUD для объектов
- `[ ]` Исправить stale closures в `deleteRoom`/`addRoom`/`reorderRooms` (перевести на `setProjects(prev => ...)`)

### 1.2 Декомпозиция крупных файлов
- `[ ]` Декомпозиция **RoomEditor (900 строк)** — вынести обработчики в `useRoomHandlers.ts`
- `[ ]` Декомпозиция **BackupManager (837 строк)** → `ExportPanel` + `ImportPanel` + `SyncPanel`
- `[ ]` Декомпозиция **routes/update.ts (2184 строки)** → controller + service

### 1.3 Утилиты и консистентность
- `[ ]` Единая утилита генерации ID — `utils/factories.ts` (заменить 4+ разных способа генерации ID на `generateId(prefix)`)
- `[ ]` Заменить 52 `console.*` на встроенный logger (добавить ESLint правило `no-console`)
- `[ ]` Использовать единые константы для localStorage keys

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

## 📋 Бэклог (Будущие задачи)

### Управление проектами
- `[ ]` ObjectSelector в сайдбар
- `[ ]` Группировка итогов по объектам в SummaryView

### Изолированная работа (Offline + PWA)
- `[ ]` Установить `idb` (IndexedDB wrapper) и реализовать `OfflineQueue`
- `[ ]` POST `/api/sync/push`, GET `/api/sync/pull`
- `[ ]` Детекция online/offline статуса + UI-индикатор
- `[ ]` PWA: `vite-plugin-pwa`, настройка Service Worker, иконки

---

**См. также:** 
- [PROGRESS.md](./PROGRESS.md) (завершенные этапы)
- [ARCHITECTURE.md](./ARCHITECTURE.md) (архитектура)
