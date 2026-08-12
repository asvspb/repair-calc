# TODO: Актуальные задачи (Repair Calculator)

**Дата последнего обновления:** 2026-08-11
**Источник приоритетов:** [AUDIT-2026-08-11.md](./AUDIT-2026-08-11.md) (снимок состояния)
**Направление проекта:** [INDEX.md → 🧭 Компас](../INDEX.md)

> **Принцип ведения** (по `AI_DOCUMENTATION_GUIDELINES.md`): выполнил задачу —
> удали её отсюда и запиши веху в `PROGRESS.md` (его нужно создать — см. P2-3),
> краткое резюме — append в `devAI/developer_log.md`.

---

## 🔴 Приоритет 0: Операционное здоровье (блокирует всё)

### P0-1. План merge `refactor/architecture-v2` → `main`

Ветка на **+160 коммитов** к main (невлито ~5.5 мес.). Главный риск проекта.

- [ ] Решить стратегию: **big-bang** merge или **разбивка на тематические PR**:
  - [ ] БД-миграция MySQL→PostgreSQL + миграции
  - [ ] `src/domain` extract (чистая бизнес-логика)
  - [ ] zustand-slices (auth/object/room/sync/project)
  - [ ] IndexedDB (Dexie) persistence + sync push/pull
  - [ ] security: `adminGuard` RBAC, миграция `20260332_add_user_role`
  - [ ] update-service decomposition (`routes/update/`)
  - [ ] i18n scaffold (`react-i18next`)
- [ ] Запушить 5 локальных коммитов в origin/refactor/architecture-v2
- [ ] Определить: main обновляется только через merge refactor (refactor — новый «trunk»)?

### P0-2. Активировать CI

`.github/workflows/ci.yml` **уже написан** (`npm ci` → `lint` → `lint:deps` → `test`, триггеры push/PR на main и refactor/\*), но **не в VCS** → ни разу не запускался.

- [ ] Закоммитить `.github/workflows/ci.yml`
- [ ] (Опц.) Закоммитить хуки: `.husky/*` + `scripts/check-secrets.sh` + `scripts/ai-trailer-check.sh` (сейчас незакоммичены)
- [ ] Проверить первый прогон CI на refactor-ветке зелёным

---

## 🟠 Приоритет 1: Деплой и безопасность

### P1-1. Деплой актуального бэкенда

Прод-контейнер `:3994` крутит **старую сборку** (фикс двойного префикса роутинга закоммичен, но не задеплоен).

- [ ] `./scripts/deploy-local.sh` (тесты + линтеры + `docker compose build --no-cache`)
- [ ] Живая проверка путей: `GET /api/objects` (200, не 404), `POST /api/rooms/:id/works`

### P1-2. Ускорить сборку бэкенда (Docker browser-cache)

⚠️ **Коррекция (2026-08-12):** `playwright` — **runtime-зависимость** сервера (`import { chromium }` в `server/src/services/update/parsers/lemanaParser.ts`, `bazavitParser.ts` — скрейперы цен). Перенос в `devDependencies` **сломал бы prod** (`Cannot find module`). Прежний диагноз «не в той секции» неверен.

Реальная проблема — медленная установка browser-binaries при каждой сборке. Чинить кэшированием:

- [ ] Закэшировать `PLAYWRIGHT_BROWSERS_PATH` в Docker-слой (multi-stage cache, `--mount=type=cache`)
- [ ] (Опц.) Вынести `lint` → `eslint src/ tests/` отдельным коммитом (не связано с playwright)

### P1-3. `npm audit fix`

- [ ] 9 уязвимостей (2 low, 7 high; в т.ч. `ws`) — починить, проверить что не ломает runtime

---

## 🟡 Приоритет 2: Документация и гигиена

### P2-1. Триаж 12 незакоммиченных файлов (см. `git status`)

Ценная «висящая» работа — оформить по батчам:

- [ ] CI + husky-хуки → коммит `ci:` (вместе с P0-2)
- [ ] `.agents/AGENTS.md` (перевод DevOps-правил в RU) → `docs:`
- [ ] Фронт-тесты (`SummaryView.header/project`, `LeftSidebar.nav`, `i18n`) → `test:`
- [ ] `server/tests/integration/migrations.test.ts` → `test:`

### P2-2. Починить дрейф документации (по `AUDIT-2026-08-11.md` §6)

- [ ] `INDEX.md`: MySQL → PostgreSQL+Knex (частично выполнено 2026-08-11 — добить остатки)
- [ ] `AGENTS.md` §2: «Prisma» → **Knex** (SSOT содержит неверный факт; правка за владельцем)
- [ ] В `server/src/db/pool.ts` убрать остаточные комментарии про `mysql2`

### P2-3. Создать недостающие статусные документы

Регламент (`AI_DOCUMENTATION_GUIDELINES.md`) и TODO ссылаются на файлы, которых нет.

- [ ] `docs/PROGRESS.md` — лента завершённых вех (миграция на zustand, БД→PG, декомпозиция update.ts, i18n, IndexedDB, RBAC, фикс роутинга 2026-08-11)
- [ ] `docs/FRONTEND-STATUS.md` — статус фронтенда (или решить: объединить в PROGRESS.md)

### P2-4. Мелкая гигиена

- [ ] Выровнять версии: root `2.0.0` / server `1.0.0`
- [ ] Расширить `server/package.json` `lint` (`eslint src/`) на `tests/` — тесты сейчас не линтуются
- [ ] Проверить статус `AUDIT-2026-06-21.md §4.E` (prefer-const в createSyncSlice) — закрыть, если устранено

---

## 🟢 Приоритет 3: Качество кода (техдолг)

### P3-1. Декомпозиция крупных файлов (по `AUDIT-2026-06-21.md` §3 — перепроверить размеры)

- [ ] `src/components/RoomEditor.tsx` (~906) → вынести обработчики в хук
- [ ] `src/components/BackupManager.tsx` (~848) → `ExportPanel` + `ImportPanel` + `SyncPanel`
- [ ] `src/api/storage/apiStorageProvider.ts` (~1033) → `apiClient` + `projectApi` + `objectApi` + `roomApi`
- [ ] `src/components/projects/ProjectsModal.tsx` (~696)
- [ ] `src/store/createProjectSlice.ts` (~609) — оставить только доменные поля + CRUD
- [ ] `src/utils/roomHelpers.ts` (~811) — проверить размеры функций

### P3-2. Мёртвый код (подтверждён grep, 0 ссылок)

- [ ] `src/hooks/useProjects.ts` — дубликат store (legacy)
- [ ] `src/utils/projectContextPatch.ts` — заменён `utils/projectObjects.ts`
- [ ] `require()` в ESM: `src/api/storage/apiStorageProvider.ts`

### P3-3. Типизация

- [ ] 39 `as any` warnings (`server/src/routes/update/ab-test.routes.ts`, `jobs.routes.ts`, `import.routes.ts`, `priceHistory.repo.ts`) → заменить на типы
- [ ] Единая утилита ID: `utils/factories.ts` (`generateId(prefix)`), убрать дублирование
- [ ] Единые константы localStorage keys (`STORAGE_KEYS`)

### P3-4. Тестирование

- [ ] Распропустить E2E-тесты (часть `.skip`): core-workflow, costs, export-import, geometry, projects, regressions, responsive, room-input, rooms, work-templates, works
- [ ] Компонентные тесты: RoomEditor, BackupManager, httpClient (после декомпозиции)
- [ ] Добиться >80% pass rate для Chromium

---

## 📋 Бэклог (будущее)

- [ ] ObjectSelector в сайдбар; группировка итогов по объектам в SummaryView
- [ ] PWA: `vite-plugin-pwa`, Service Worker, оффлайн-индикатор (поверх IndexedDB)
- [ ] Swagger/OpenAPI для API (контракт уже частично в `docs/openapi.yaml`)
- [ ] Тёмная тема; печать сметы
- [ ] `fallow` / SonarQube — dead-code и Quality Gate (по стандарту Principal Architect)

---

**См. также:**

- [AUDIT-2026-08-11.md](./AUDIT-2026-08-11.md) — снимок состояния и дрейф
- [INDEX.md → 🧭 Компас](../INDEX.md) — направление и главный ориентир
- [ARCHITECTURE.md](./ARCHITECTURE.md) — архитектура
- [AUDIT-2026-06-21.md](./AUDIT-2026-06-21.md) — предыдущий аудит
