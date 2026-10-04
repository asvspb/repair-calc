# TODO: Актуальные задачи (Repair Calculator)

> **Статус:** актуально (живой бэклог) • **Проверено:** 2026-10-04

**Дата последнего обновления:** 2026-10-04
**Источник приоритетов:** [AUDIT-2026-08-11.md](./AUDIT-2026-08-11.md) (снимок состояния) + сверка 2026-10-03
**Направление проекта:** [INDEX.md → 🧭 Компас](../INDEX.md)

> **Принцип ведения** (по `AI_DOCUMENTATION_GUIDELINES.md`): выполнил задачу —
> удали её отсюда и запиши веху в [PROGRESS.md](./PROGRESS.md),
> краткое резюме — append в `devAI/developer_log.md`.

---

- [x] **P3-SPLIT:** распил `src/store/createProjectSlice.ts` (648 строк > 400) — вынести архив-экшены (fetchArchivedProjects/restoreProject/permanentDeleteProject) в отдельный `createArchiveSlice.ts` — **закрыто 2026-10-04** (`refactor/split-store-repo-014`): архив-экшены в `createArchiveSlice.ts` (183) + `ArchiveSlice` в types.ts; дополнительно для порога ≤400 вынесены `projectInitialize.ts` (222) и `projectMigration.ts` (39), `createProjectSlice` стал 267, маркер SPLIT-ME снят; заодно `server/.../project.repo.ts` (854) распилен на `projectArchive.repo.ts` (186, findArchived*/restore/hardDelete) + `projectRead.repo.ts` (141) + `projectUpdateRooms.repo.ts` (197) + `projectUpdateObjects.repo.ts` (302) + фасад (113) — вся прежняя API доступна через `ProjectRepository` (цепочка наследования + ре-экспорты), Knex остался в repositories; тесты не ослаблялись (1043 front + 150 server зелёные)

## ✅ Закрыто 2026-10-03/04 (сверка TODO с фактическим состоянием)

- **P0-1** (merge `refactor/architecture-v2` → `main`) — выполнено: main содержит рефактор, актуальная рабочая ветка `feat/project-archive-t2`.
- **P0-2** (CI) — `ci.yml`, husky-хуки, `check-secrets.sh` закоммичены.
- **P2-1** (триаж незакоммиченных файлов) — файлы в git.
- **P2-2** частично — AGENTS.md уже Knex; ARCHITECTURE.md MySQL→PostgreSQL исправлено.
- **P2-3** — `docs/PROGRESS.md` создан; `FRONTEND-STATUS.md` решено не вести отдельно (вехи фронтенда — в PROGRESS.md).
- **P1-1** (деплой актуального бэкенда) — выполнено 2026-10-03 (`deploy-local.sh`), живая проверка путей пройдена; подтверждено 2026-10-04 (`fix/infra-008`): контейнер `repair-calc-backend` Up, `GET /api/objects` → 401 (роут существует, не 404).
- **P2-2** (пункты, кроме pool.ts — batch-004) — `ARCHITECTURE.md` полностью сверен (2026-10-03); даты «Проверено» проставлены в LOGGING.md, LOGGING-CHEATSHEET.md, IDEAL-ARCHITECTURE.md, TECHNICAL-SPECIFICATION.md, CODE_REVIEW.md (см. docs/README.md).
- **P2-5** (batch-003) — `docs/openapi.yaml` содержит `GET /api/projects/archived`, `PATCH /api/projects/{id}/restore`, `DELETE /api/projects/{id}/permanent` (строки 66/145/387, сверено 2026-10-04).

---

## 🟠 Приоритет 1: Деплой и безопасность

### P1-2. Ускорить сборку бэкенда (Docker browser-cache)

⚠️ **Коррекция (2026-08-12):** `playwright` — **runtime-зависимость** сервера (`import { chromium }` в `server/src/services/update/parsers/lemanaParser.ts`, `bazavitParser.ts` — скрейперы цен). Перенос в `devDependencies` **сломал бы prod** (`Cannot find module`). Прежний диагноз «не в той секции» неверен.

⚠️ **Коррекция 2 (2026-10-04, `fix/infra-008`):** в образе браузеры **не скачиваются вообще** — `playwright` не входит в `onlyBuiltDependencies` (`server/package.json:60`), pnpm не запускает его postinstall, `/root/.cache/ms-playwright` в собранном образе отсутствует (проверено `docker run --rm repair-calc-backend ls /root/.cache/ms-playwright`). Формулировка «prod-стадия ставит браузеры» не соответствовала факту. Кэш-маунт добавлен превентивно — заработает сразу, как только postinstall playwright будет разрешён.

- [x] Закэшировать `PLAYWRIGHT_BROWSERS_PATH` в Docker-слой — `server/Dockerfile`: `# syntax=docker/dockerfile:1` + `RUN --mount=type=cache,target=/root/.cache/ms-playwright` на prod-установке (`fix/infra-008`). Замер: `docker compose build backend` — 1:46; вторая с `--pull` (слои сброшены) — 1:34. Шаг загрузки браузеров в обеих сборках отсутствует (см. коррекцию 2), поэтому ускорение именно на этом шаге продемонстрировать нечем.
- [ ] (Опц.) Вынести `lint` → `eslint src/ tests/` отдельным коммитом (не связано с playwright)
- [ ] (Опц.) Разрешить postinstall playwright (`onlyBuiltDependencies` + `pnpm exec playwright install` в сборке) — иначе скрейперы `lemanaParser.ts`/`bazavitParser.ts` упадут в prod при обращении к chromium

### P1-3. `npm audit fix`

- [x] 9 уязвимостей (2 low, 7 high; в т.ч. `ws`) — починить, проверить что не ломает runtime
      — **закрыто 2026-10-04** (`fix/audit-007`): root `pnpm audit` → 0; server → 1 moderate `uuid@10.0.0`
      (фикс 10→11 — мажорный, не ставится: в коде только `v4` без `buf` (32 вызова), CVE затрагивает
      v3/v5/v6 при передаче `buf`; запись в `devAI/developer_log.md`).

---

## 🟡 Приоритет 2: Документация и гигиена

### P2-2 (остаток). pool.ts (по `AUDIT-2026-08-11.md` §6)

- [x] В `server/src/db/pool.ts` убрать остаточные комментарии про `mysql2` / legacy RowDataPacket
      — закрыто 2026-10-04 (`fix/infra-008`): mysql2-формулировки удалены, пояснение `any` оставлено.
      Остальные пункты P2-2 и P2-5 закрыты — см. блок «Закрыто».

### P2-4. Мелкая гигиена — ✅ ЗАКРЫТО 2026-10-04 (`fix/hygiene-011`)

- [x] Версии выровнены: root `2.0.0` / server `2.0.0` — проверено 2026-10-04 (grep `"version"` server/package.json → 2.0.0)
- [x] `server/package.json` `scripts.lint` = `eslint src/ tests/` — серверный lint покрывает tests/; `npx eslint src/ tests/` → 0 errors / 32 warnings (warnings — предмет P3-3, не отключались)
- [x] `AUDIT-2026-06-21.md §4.E` (prefer-const в createSyncSlice) — подтверждено устранённым: `npx eslint src/store/createSyncSlice.ts` — чисто; все `let` в файле реально переприсваиваются

---

## 🟢 Приоритет 3: Качество кода (техдолг)

### P3-1. Декомпозиция крупных файлов (по `AUDIT-2026-06-21.md` §3 — перепроверить размеры)

Устаревшие строки удалены 2026-10-04 (`fix/infra-008`): `RoomEditor.tsx` уже 277 строк (распилен), `roomHelpers.ts` не существует. Актуальные размеры (`wc -l`, 2026-10-04):

- [x] `src/components/BackupManager.tsx` (898) → контейнер (247) + `backup/` (`ExportPanel` 70 + `ImportPanel` 190 + `SyncPanel` 380 + `LoadProjectDialog` 107 + `types` 35 + `helpers` 8) — **закрыто 2026-10-04** (`refactor/split-ui-013`): публичный компонент `BackupManager` экспортируется из прежнего пути, поведение UI не изменено; новые компонентные тесты `tests/components/backup/` (5 файлов)
- [x] `src/api/storage/apiStorageProvider.ts` (995) → `apiClient` (177) + `projectApi` (319) + `objectApi` (261) + `roomApi` (99) + фасад (346) — **закрыто 2026-10-04** (`refactor/split-storage-012`): публичный API фасада не изменён, тесты `tests/api/apiStorageProvider.test.ts` зелёные до и после (6/6); `require()` в модуле отсутствовал (уже ESM)
- [x] `src/components/projects/ProjectsModal.tsx` (727) → контейнер (207) + `useProjectsModal` (366) + `useProjectExports` (67) + `ProjectListItem` (147) + `ServerSyncSection` (53) + `ImportStatusBanner` (48) + `modalTypes` (8) — **закрыто 2026-10-04** (`refactor/split-ui-013`); ArchivePanel не тронут; новые тесты `tests/components/projects/{ProjectListItem,ServerSyncSection,ImportStatusBanner}.test.tsx`
- [ ] `src/store/createProjectSlice.ts` (649) — оставить только доменные поля + CRUD

### P3-2. Мёртвый код — ✅ ЗАКРЫТО 2026-10-04 (`fix/dead-code-009`)

- [x] `src/hooks/useProjects.ts` — дубликат store (legacy) — **удалён ранее** (коммит `8f4a7b6`, refactor(split ProjectContext → zustand slices)); повторный grep 2026-10-04: 0 ссылок (src/, tests/, e2e/, shared/)
- [x] `src/utils/projectContextPatch.ts` — заменён `utils/projectObjects.ts` — **удалён ранее** (тот же коммит); grep 2026-10-04: 0 ссылок; `projectObjects.ts` живой (24 импорта в src/, 12 в tests/)
- [x] `require()` в ESM: `src/api/storage/apiStorageProvider.ts` — grep `require(`: 0 вхождений (устранён ранее)

### P3-3. Типизация

- [x] Целевые файлы `server/src/routes/update/*.ts` и `priceHistory.repo.ts`: 0 `no-explicit-any` (было 4: import.routes ×1, jobs.routes ×1, priceHistory.repo ×2 — закрыты типизированными кастами/generic-аккумулятором/`Record<string, unknown>`+narrowing, 2026-10-04, ветка `fix/typing-010`)
- [x] Единая утилита ID: `generateId(prefix)` в `src/domain/factories/projectFactory.ts` (файл `src/utils/factories.ts` не существует — канон у factory-модуля); дубли в `WorkTemplateContext`, `useWorkTemplates`, `useGeometryState`, `costs.ts`, `roomHelpers.ts`, `useRoomWorksState.ts`, `WorkCatalogPicker.tsx`, `projectObjects.ts` заменены. Остались legacy-генераторы в `src/utils/idMapper.ts:80,248` (`device-`/`local-` prefixed, generateId() из idMapper не импортируется нигде) — кандидат на удаление в отдельной dead-code задаче
- [x] Единые константы localStorage keys (`STORAGE_KEYS` в `src/utils/storageConstants.ts`): добавлены TOKEN/REFRESH_TOKEN/E2E_TEST_MODE/ID_MAPPINGS/DEVICE_ID/PENDING_SAVE/MIGRATION_VERSION/PRICE_CACHE/DEXIE_MIGRATED — **значения ключей не менялись**; все литеральные вызовы `localStorage.*` в src/ переведены на константы
- [ ] Остаток: 22 `no-explicit-any` вне целевых файлов (pool.ts, abTest/object/priceCatalog/project/room/updateJob.repo.ts, rateLimiter.ts, geometry.test.ts) — вне Write-скоупа batch-010; knx-репозитории требуют типизации строк Knex
- [ ] lint-предупреждения `no-unused-vars` в server/tests/ (10 шт.) — намеренно НЕ автофиксились в batch-011 (`--fix` их не удаляет автоматически-безопасно, удаление импортов — ручная тривиальная правка вне скоупа автоправок); 0 errors, только warnings

### P3-4. Тестирование

- [x] Распропустить E2E-тесты (часть `.skip`): core-workflow, costs, export-import, geometry, projects, regressions, responsive, room-input, rooms, work-templates, works — **закрыто 2026-10-04** (`test/e2e-unskip-015`): `.skip` уже сняты в a04180f, задача свелась к реальной проверке и фиксам; полный набор **159/159 passed** (chromium + firefox + mobile, два прогона подряд). Тривиальные фиксы только в e2e/: мобильный drawer-сайдбар (`e2e/helpers/sidebarHelpers.ts` — открытие/закрытие по классу, не по boundingBox в 200ms-переходе), навигация к комнатам/объектам/проектам через drawer, `openDataManagement` (у настольной кнопки настроек нет data-testid), `RoomEditorPage.deleteRoom` без чужой кнопки «Удалить» (модального подтверждения удаления комнаты в приложении нет — имена тестов скорректированы), удаление объекта через настоящий `ConfirmDialog` (не window.confirm), `Core Workflow`: «Общая смета» → «Смета проекта». Код приложения не менялся.
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
