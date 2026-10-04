# TODO: Актуальные задачи (Repair Calculator)

> **Статус:** актуально (живой бэклог) • **Проверено:** 2026-10-03

**Дата последнего обновления:** 2026-10-03
**Источник приоритетов:** [AUDIT-2026-08-11.md](./AUDIT-2026-08-11.md) (снимок состояния) + сверка 2026-10-03
**Направление проекта:** [INDEX.md → 🧭 Компас](../INDEX.md)

> **Принцип ведения** (по `AI_DOCUMENTATION_GUIDELINES.md`): выполнил задачу —
> удали её отсюда и запиши веху в [PROGRESS.md](./PROGRESS.md),
> краткое резюме — append в `devAI/developer_log.md`.

---

- [ ] **P3-SPLIT:** распил `src/store/createProjectSlice.ts` (648 строк > 400) — вынести архив-экшены (fetchArchivedProjects/restoreProject/permanentDeleteProject) в отдельный `createArchiveSlice.ts` (добавлено при ревью T3, маркер SPLIT-ME в файле)

## ✅ Закрыто 2026-10-03 (сверка TODO с фактическим состоянием)

- **P0-1** (merge `refactor/architecture-v2` → `main`) — выполнено: main содержит рефактор, актуальная рабочая ветка `feat/project-archive-t2`.
- **P0-2** (CI) — `ci.yml`, husky-хуки, `check-secrets.sh` закоммичены.
- **P2-1** (триаж незакоммиченных файлов) — файлы в git.
- **P2-2** частично — AGENTS.md уже Knex; ARCHITECTURE.md MySQL→PostgreSQL исправлено.
- **P2-3** — `docs/PROGRESS.md` создан; `FRONTEND-STATUS.md` решено не вести отдельно (вехи фронтенда — в PROGRESS.md).

## 🟠 Приоритет 1: Деплой и безопасность

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

- [x] 9 уязвимостей (2 low, 7 high; в т.ч. `ws`) — починить, проверить что не ломает runtime
      — **закрыто 2026-10-04** (`fix/audit-007`): root `pnpm audit` → 0; server → 1 moderate `uuid@10.0.0`
      (фикс 10→11 — мажорный, не ставится: в коде только `v4` без `buf` (32 вызова), CVE затрагивает
      v3/v5/v6 при передаче `buf`; запись в `devAI/developer_log.md`).

---

## 🟡 Приоритет 2: Документация и гигиена

### P2-2. Остатки дрейфа документации (по `AUDIT-2026-08-11.md` §6; AGENTS.md и ARCHITECTURE.md закрыты 2026-10-03)

- [ ] В `server/src/db/pool.ts` убрать остаточные комментарии про `mysql2` / legacy RowDataPacket
- [ ] Сверить `ARCHITECTURE.md` полностью (сейчас «Проверено» — только блок БД) и проставить даты остальным docs/\*.md с «Проверено: —» (LOGGING.md, LOGGING-CHEATSHEET.md, IDEAL-ARCHITECTURE.md, TECHNICAL-SPECIFICATION.md, CODE_REVIEW.md)
- [ ] **P2-5.** Дополнить `docs/openapi.yaml` эндпоинтами архива проектов: `GET /api/projects/archived`, `PATCH /api/projects/:id/restore`, `DELETE /api/projects/:id/permanent` (реестр дрейфов, 2026-10-03)

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
