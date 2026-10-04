# TODO: Актуальные задачи (Repair Calculator)

> **Статус:** актуально (живой бэклог) • **Проверено:** 2026-10-04

**Дата последнего обновления:** 2026-10-04
**Источник приоритетов:** [AUDIT-2026-08-11.md](./AUDIT-2026-08-11.md) (снимок состояния) + сверка 2026-10-03
**Направление проекта:** [INDEX.md → 🧭 Компас](../INDEX.md)

> **Принцип ведения** (по `AI_DOCUMENTATION_GUIDELINES.md`): выполнил задачу —
> удали её отсюда и запиши веху в [PROGRESS.md](./PROGRESS.md),
> краткое резюме — append в `devAI/developer_log.md`.

---

- [ ] **P3-SPLIT:** распил `src/store/createProjectSlice.ts` (648 строк > 400) — вынести архив-экшены (fetchArchivedProjects/restoreProject/permanentDeleteProject) в отдельный `createArchiveSlice.ts` (добавлено при ревью T3, маркер SPLIT-ME в файле)

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

### P2-4. Мелкая гигиена

- [ ] Выровнять версии: root `2.0.0` / server `1.0.0`
- [ ] Расширить `server/package.json` `lint` (`eslint src/`) на `tests/` — тесты сейчас не линтуются
- [ ] Проверить статус `AUDIT-2026-06-21.md §4.E` (prefer-const в createSyncSlice) — закрыть, если устранено

---

## 🟢 Приоритет 3: Качество кода (техдолг)

### P3-1. Декомпозиция крупных файлов (по `AUDIT-2026-06-21.md` §3 — перепроверить размеры)

Устаревшие строки удалены 2026-10-04 (`fix/infra-008`): `RoomEditor.tsx` уже 277 строк (распилен), `roomHelpers.ts` не существует. Актуальные размеры (`wc -l`, 2026-10-04):

- [ ] `src/components/BackupManager.tsx` (898) → `ExportPanel` + `ImportPanel` + `SyncPanel`
- [ ] `src/api/storage/apiStorageProvider.ts` (995) → `apiClient` + `projectApi` + `objectApi` + `roomApi`
- [ ] `src/components/projects/ProjectsModal.tsx` (727)
- [ ] `src/store/createProjectSlice.ts` (649) — оставить только доменные поля + CRUD

### P3-2. Мёртвый код — ✅ ЗАКРЫТО 2026-10-04 (`fix/dead-code-009`)

- [x] `src/hooks/useProjects.ts` — дубликат store (legacy) — **удалён ранее** (коммит `8f4a7b6`, refactor(split ProjectContext → zustand slices)); повторный grep 2026-10-04: 0 ссылок (src/, tests/, e2e/, shared/)
- [x] `src/utils/projectContextPatch.ts` — заменён `utils/projectObjects.ts` — **удалён ранее** (тот же коммит); grep 2026-10-04: 0 ссылок; `projectObjects.ts` живой (24 импорта в src/, 12 в tests/)
- [x] `require()` в ESM: `src/api/storage/apiStorageProvider.ts` — grep `require(`: 0 вхождений (устранён ранее)

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
