# TODO: Замечания и задачи по проекту Repair Calculator

**Дата:** 2026-03-04
**Обновлено:** 2026-04-08 (v4.2 — Приоритет 2 выполнен)
**Источники:** [CODE_REVIEW.md](./CODE_REVIEW.md), ревью шаблонов работ, архитектурный анализ

---

## ✅ Выполнено

### Quick Wins (6/6) ✅ v4.1

| # | Задача | Коммит | Статус |
|---|--------|--------|--------|
| QW-1 | Опечатка "Страниццы" → "Страницы" | `7345c07` | ✅ |
| QW-2 | Unused `ProtectedRoute` import | `7345c07` | ✅ |
| QW-3 | 4 failing теста ObjectSettings | `f0a0912` | ✅ |
| QW-4 | Magic numbers debounce → константы | `225fc0f` | ✅ |
| QW-5 | Мёртвый код `handleDeleteActiveProject` | `d105946` | ✅ |
| QW-6 | Фиктивные поля auth middleware | `2fe2fdb` | ✅ |

### Приоритет 1: Критические (8/8) ✅ v4.1

| # | Задача | Коммит | Статус |
|---|--------|--------|--------|
| C-1 | JWT_SECRET validation в production | `b9d8335` | ✅ |
| C-2 | Helmet (security headers) | `90fa9e6` | ✅ |
| C-3 | CORS bypass (`!origin`) | `1161322` | ✅ |
| C-4 | 4× дублирование `isServerId` | `b650d45` | ✅ |
| C-5 | ~12 `any` → 0 в production | `69ae998` | ✅ |
| C-6 | Двойная инъекция токена | `ca62480` | ✅ |
| C-7 | Failing тесты ObjectSettings | `f0a0912` | ✅ |
| C-8 | Фиктивные поля auth middleware | `2fe2fdb` | ✅ |

### Пост-ревью исправления ✅ v4.1

| # | Задача | Коммит | Статус |
|---|--------|--------|--------|
| PR-1 | Удалить isServerId wrapper в ApiStorageProvider | `cccf4d8` | ✅ |
| PR-2 | 2 failing теста LeftSidebar | `cccf4d8` | ✅ |

---

### Выполнено ранее (v1.0–v4.0)

<details>
<summary>Развернуть (исторические задачи)</summary>

- [x] **Stale closure в `updateActiveProject`** — functional updates
- [x] **CSV-экспорт игнорирует extended/advanced режимы** — 2026-03-04
- [x] **Расхождение портов** — Vite: 3993, Server: 3994
- [x] **Утечка API-ключа в клиентский бандл**
- [x] **Rules of Hooks в `App.tsx`** — 2026-03-09
- [x] **Кодировка MySQL (кириллица)** — 2026-03-31
- [x] **God Component App.tsx** — декомпозиция 2700 → ~478 строк
- [x] **Мёртвые зависимости** — `@google/genai`, `better-sqlite3`, `express`, `dotenv`, `motion` удалены
- [x] **Шаблоны работ** — `CATEGORY_LABELS`, `index.ts` бочки

</details>

<details>
<summary>Выполненные фазы (3–8)</summary>

- [x] **Фаза 3:** IStorageProvider, Error Boundaries, Context API, React.memo
- [x] **Фаза 4:** Unit-тесты utils/hooks, integration, E2E
- [x] **Фаза 6:** Objects Save Fix, иерархия project→objects→rooms
- [x] **Фаза 7:** Express + MySQL + Knex, JWT, CRUD, AI (Gemini + Mistral)
- [x] **Фаза 8:** Update Service (AI-парсеры, scraper, scheduler, вебхуки)

</details>

---

## 🟡 Приоритет 2: Производительность (2–3 дня) ✅ ВЫПОЛНЕНО v4.2

> **Зависимости:** None — можно начинать сразу.

- [x] **2.1** `useMemo` для метрик и costs в RoomEditor — `src/components/RoomEditor.tsx` ✅ v4.2
  - Обернуть `calculateRoomMetrics` и `calculateRoomCosts` в `useMemo`
- [x] **2.2** Убрать двойную нормализацию комнат ✅ v4.2
  - Файлы: `ProjectContext.tsx`, `RoomEditor.tsx`
  - Нормализовать только при загрузке данных (в ProjectContext)
  - Добавлены assertion в `migrateRoom()` для development режима
- [x] **2.3** Инкрементальное сохранение — `ProjectContext.tsx` ✅ v4.2
  - Сериализовать только изменённый проект, а не все проекты
  - Добавлены методы `StorageManager.saveProject()` и `ApiStorageProvider.saveProjectAsync()`

---

## 🟠 Приоритет 3: Архитектура (5–8 дней)

### 3.1 Декомпозиция ProjectContext (931 → 3 модуля)

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
- [ ] **3.3.4** Использовать единые константы для localStorage keys

---

## 🧪 Приоритет 4: Тестирование (5–7 дней)

> **Зависимости:** 4.2 (тесты ProjectContext) — **после 3.1** (декомпозиция)

### Актуальное состояние

| Метрика | Значение |
|---------|----------|
| Всего тестов | 841 |
| **Passing** | **833** ✅ |
| **Failing** | **0** ✅ |
| Skipped | 8 |
| Тестовых файлов | 51 |

### Задачи

- [ ] **4.1** Компонентные тесты для RoomEditor (900 строк) — `RoomEditor.test.tsx`
- [ ] **4.2** Тесты для ProjectContext (931 строка) — `ProjectContext.test.tsx`
  - ⚠️ **После декомпозиции 3.1** — тестировать разделённые хуки
- [ ] **4.3** Тесты для httpClient — `httpClient.test.ts`
- [ ] **4.4** Тесты для BackupManager — `BackupManager.test.tsx`
- [ ] **4.5** Дополнительные E2E для авторизации — `e2e/auth-sync.spec.ts`

---

## 🔧 Приоритет 5: Бэкенд (3–5 дней)

- [ ] **5.1** DI для репозиториев — `server/src/db/repositories/*.ts`
- [ ] **5.2** Request ID middleware — `server/src/middleware/requestId.ts`
- [ ] **5.3** Per-user rate limiting — `server/src/middleware/rateLimiter.ts`

---

## 📚 Приоритет 6: Документация (1 день)

- [ ] **6.1** Обновить ARCHITECTURE.md — добавить Objects model, Auth, HttpClient
- [x] **6.2** Обновить TODO.md — отметить выполненное ✅ v4.1

---

## 📋 Backlog: будущие фазы (после закрытия техдолга)

> ⚠️ **Не начинать**, пока не закрыты Приоритеты 2–3.

### Фаза 11: UI управления проектами и объектами

**Спецификация:** [PROJECTS_UI_PLAN.md](./PROJECTS_UI_PLAN.md)

- [ ] **11.1** Рефакторинг BackupManager (837 строк) — **перенесено в 3.2.2**
- [ ] **11.2** ObjectSelector в сайдбар
- [ ] **11.3** Группировка итогов по объектам в SummaryView

### Фаза 10: Offline-first (Опционально) — 2-3 дня

- [ ] **10.1** Установить idb (IndexedDB wrapper)
- [ ] **10.2** Реализовать OfflineQueue
- [ ] **10.3** POST /api/sync/push, GET /api/sync/pull
- [ ] **10.4** Детекция online/offline статуса + UI-индикатор

### Фаза 9: PWA (Опционально) — 2-3 дня

- [ ] **9.1** Установить vite-plugin-pwa
- [ ] **9.2** Настроить service worker
- [ ] **9.3** Создать иконки
- [ ] **9.4** Протестировать offline-режим

---

## 📈 Метрики успеха

| Метрика | v1.0 | v3.0 | v4.0 | **v4.1** | **v4.2** | Целевое | Статус |
|---------|------|------|------|----------|----------|---------|--------|
| Размер App.tsx | ~2700 | 557 | 489 | **478** | 478 | <300 | 🟡 |
| ProjectContext.tsx | — | 660 | 933 | **931** | **982** | <300 | 🔴 |
| RoomEditor.tsx | — | 896 | 900 | **900** | 900 | <400 | 🔴 |
| Покрытие тестами | ~5% | ~50% | ~55% | **~55%** | ~55% | >70% | 🟡 |
| Типизация (any) | 3 | 0 | ~12 | **0** (prod) | 0 (prod) | 0 | ✅ |
| Failing тесты | 0 | 0 | 4 | **0** | 0 | 0 | ✅ |
| console.* в prod | — | — | 52 | **52** | 52 | 0 | 🟡 |
| Security issues | 🔴 | 🔴 | 🔴 | **🟢** | 🟢 | ✅ |
| Производительность | 🔴 | 🔴 | 🔴 | 🔴 | **🟢** | 🟢 | ✅ |

### Статистика тестов:

- **Всего тестов:** 841
- **Passing:** 833 ✅
- **Failing:** 0 ✅
- **Skipped:** 8

---

**См. также:** [CODE_REVIEW.md](./CODE_REVIEW.md), [ARCHITECTURE.md](./ARCHITECTURE.md)
