# Developer Log - Repair Calculator

## 2026-04-14 - Fix TypeScript Narrowing in BackupManager

### Accomplishments:

- **Fixed Typing Error in BackupManager**: Resolved narrowing issues with `StorageManager.importFromJSON` using the `in` operator.
- **Fixed Type Mismatch in RoomEditor**: Corrected the signature of `handleLoadTemplate` to accept `WorkData`, matching the props of `WorkTemplatePickerModal`.
- **Fixed Narrowing in WorkTemplateSaveButton**: Resolved `Property 'needsConfirm' does not exist on type 'SaveResult'` by using property check narrowing (`'needsConfirm' in result`).

### Technical Details:

- Discriminated unions with boolean literal discriminants (`success: true | false`) can be fragile in some TypeScript versions/environments, especially in `else` blocks.
- The `in` operator provides a more robust guard for property existence in union types.
- Corrected a logic mismatch where a modal was expected to pass back `WorkData` but the receiving function expected `WorkTemplate`.

### Next Steps:

- Monitor for any similar narrowing issues in other components using `StorageManager`.
- (Optional) Refactor `StorageManager` return types to use named type aliases for better clarity.

## 2026-08-11 - Fix double-prefix route mounting (objects/works)

### Accomplishments:

- **Исправлен баг двойного префикса в `server/src/routes/index.ts`**: `objectsRoutes` и `worksRoutes` монтировались с префиксом (`router.use('/objects', …)`, `router.use('/works', …)`), хотя внутри себя объявляют по нескольку разных префиксов — реальные URL дублировались (`/api/objects/objects`, `/api/works/rooms/:id/works`). Оба смонтированы в корень (`router.use('/', …)`), как уже принято для `roomsRoutes`/`geometryRoutes`.
- **Добавлены интеграционные тесты** `server/tests/integration/routeMounting.test.ts` (8 тестов): ходят через настоящий агрегирующий роутер из `index.ts` (не монтируют под-роутер напрямую — иначе баг воспроизводился бы и тест «зеленел»), покрывают задокументированные пути и негативные кейсы (дубль-пути → 404, несуществующая комната → 404).

### Technical Details:

- Контракт подтверждён `docs/openapi.yaml`, `docs/ARCHITECTURE.md`, `TECHNICAL-SPECIFICATION.md`: целевые пути — `/api/objects`, `/api/projects/{projectId}/objects`, `/api/rooms/{roomId}/works`.
- Mutation-check: возврат бага роняет 6 из 8 тестов → тесты реально ловят регрессию.
- Хелпер `collectRoutePaths` опирается на внутренности Express 4 (разбор `layer.regexp.source`, `layer.name === 'router'`) — задокументирован комментарием-предупреждением про Express 5.

### Review (Архитектор-контролёр):

- Gates зелёные (запускал лично): `npm test` 934 passed | 4 skipped; `npm run lint` 0 errors (39 предсуществующих warnings в чужом коде); `npm run lint:deps` 0 violations (225 модулей); серверный набор 115 passed; mutation 6/8 fail.
- Write-set батча чист: ровно `server/src/routes/index.ts` + новый тест.

### Next Steps:

- Контейнер бэкенда на :3994 ещё содержит старую сборку (пересборка падала по таймауту >900с; причина — `playwright` в `dependencies` сервера тянется в рантайм-образ). Деплой — через `./scripts/deploy-local.sh`.
- P1-дефект (неродственный): в `vitest.config.ts` захардкожен абсолютный `@shared`-путь — чинится отдельным коммитом.

## [2026-08-11] TASK-BATCH-P2-2-doc-drift @ docs/p2-doc-drift-batch-01 @ 2fef795

- Сделано: `AGENTS.md` (Prisma→Knex: §2 ORM/БД, §3 структура `prisma/`→`server/src/db/`, §4 `db:migrate:dev`→`npm run migrate`, §7 слои, §9 навигация); `INDEX.md` (`pool.ts` — «mysql2-compat API»→Knex); `server/src/db/pool.ts` (комментарии про `mysql2` → «legacy RowDataPacket interface»/«legacy repo code», легаси-совместимость сохранена).
- Проверено: npm test ✅ (frontend 934 + server 115 passed) / lint ✅ (0 errors; 39 предсуществующих warnings в чужом коде) / lint:deps ✅ (0 violations, 225 модулей) / prettier ✅ (AGENTS.md/INDEX.md)
- Заметки: batch-файла `TASK-BATCH-NNN-*.md` в `devAI/spec/` нет — батч собран из `docs/TODO.md` P2-2 по решению Архитектора. Остаточный дрейф (вне write-set, на рассмотрение): `INDEX.md:23` «server/repositories/» (факт — `server/src/db/repositories/`); дерево миграций в `INDEX.md:166-171` не содержит `20260332_add_user_role` (есть в полном списке `INDEX.md:284`).

## 2026-08-11 - Documentation: project state audit + TODO overhaul + INDEX compass

### Accomplishments:

- **Создан `docs/AUDIT-2026-08-11.md`** — авторитетный снимок состояния (формат AUDIT-2026-06-21): метрики, статус по измерениям, топ-риски, roadmap, Documentation Drift. Вердикт: 🟡 операционный долг при здоровом коде.
- **Переписан `docs/TODO.md`** под текущую реальность: убрано выполненное в рефакторе (zustand, i18n, IndexedDB, sync, декомпозиция update.ts, dep-cruiser); добавлены приоритеты P0 (merge refactor→main, активация CI), P1 (деплой, audit fix), P2 (триаж 12 файлов, дрейф доков), P3 (техдолг).
- **`INDEX.md` — добавлена секция «🧭 Компас проекта»** (north star: что строим, главный ориентир, критический путь, принципы); обновлена дата (2026-06-21 → 2026-08-11); починен дрейф: MySQL→PostgreSQL+Knex, ProjectContext→zustand store, `update.ts`→модуль `update/`, добавлена миграция `20260332` (RBAC), баннер «устарело» над код-ревью 2026-04-17, ссылки на новый аудит и TODO.

### Technical Details:

- Дрейф SSOT: `AGENTS.md` §2 ошибочно указывает «Prisma» (реальность — Knex+PostgreSQL); `INDEX.md` указывал «MySQL 8». Зафиксировано в AUDIT §6; правка AGENTS.md оставлена за владельцем (привилегированный файл-инструкция).
- Обнаружено: `docs/PROGRESS.md` и `FRONTEND-STATUS.md` отсутствуют, хотя на них ссылаются регламент и TODO → заведены как задача P2-3.
- (Предыдущая запись Next Steps про P1 vitest — закрыта коммитом `c3a9f4c`.)

### Next Steps:

- P0: план merge `refactor/architecture-v2` → main (160 коммитов).
- P0: закоммитить `.github/workflows/ci.yml` (CI написан, но не в VCS).
- Привести `AGENTS.md` §2 в соответствие с реальностью (Knex, не Prisma).

## [2026-08-12] SPEC-005-NORMALIZATION — ТЗ «привести проект в норму»

- Создан `devAI/spec/SPEC-005-NORMALIZATION.md` (v1.0, Draft): план перевода проекта из 🟡 в 🟢 по измерениям `AUDIT-2026-08-11`.
- Решения владельца: merge `refactor/architecture-v2` → `main` через `--no-ff` (сохранить 164 атомарных коммита + явная граница); объём — разблокировка + техдолг (as-any отдельной фазой).
- Декомпозиция: 4 фазы, 9 task-batch'ей — 01 активация CI → 02 push → 03 merge; 04 триаж 12 файлов ∥ 05 верификация деплоя; 06 server-deps-hygiene → 07 audit-fix, 08 status-docs; 09 as-any cleanup. Карта конфликтов и параллельная безопасность прописаны (BATCH-06∩07 = server/package-lock.json → 07 строго после 06).
- Снимок в спеке: 164 коммита / +73k−10k строк / 263 новых файла (~62k LOC) вне main; CI untracked; 12 файлов в дереве; 9 незапушено; деплой ≈ актуален (бэкенд 11.08, фронт 22.06 ≈ код).
- DoD: main==refactor через --no-ff, CI green на main, дерево чистое, gates зелёные, audit 0, PROGRESS.md создан.
- Статус: Draft — ждёт аппрута владельцем → старт с Фазы 1 (BATCH-01 «Активация CI»).

## [2026-08-12] SPEC-005 Фаза 1+2 выполнена — проект разблокирован

- **Фаза 1 (разблок):** BATCH-01 активация CI (`b60b352`: workflow + husky secret/AI-trailer хуки + скрипты); BATCH-02 push refactor → origin (11 коммитов); BATCH-03 merge `--no-ff` refactor → main (`588c76b`, 164 коммита, 0 конфликтов) + push main. `main..refactor = 0`. CI жив — первый прогон запущен на main.
- **Фаза 2 (триаж):** BATCH-04 — 7 «висящих» файлов закоммичены (`72c406b` test: 4 фронт-теста + migrations; `b1050f8` docs: RU-AGENTS + шаблон плана). Рабочее дерево чистое.
- **BATCH-08:** создан `docs/PROGRESS.md` (вехи); INDEX compass обновлён (🟡→🟢, критпуть 1+2 ✅); AUDIT получил status-update.
- ⚠️ **BATCH-06 ОТМЕНЁН:** `playwright` — runtime-dep сервера (`import { chromium }` в `lemanaParser`/`bazavitParser`, скрейперы цен), перенос в devDeps сломал бы prod. Диагноз в AUDIT/TODO/SPEC исправлен. Медленная сборка → отдельная Docker-cache задача.
- **Нит:** commitlint `subject-case` требует lowercase-first subject (дважды ловил на `SPEC-…`/`RU-…`).

## [2026-08-12] SPEC-005 Шаг 3 — техдолг (audit, types, lint-scope, docker)

- **audit+version** (`a2fff40`): npm audit fix — 7 high → 0 (residual 1 low `esbuild`, devDep); server version 1.0.0 → 2.0.0.
- **types** (`d2928ea`): `as any` в update-роутах (9 сайтов) → `AuthRequest` + Zod-вывод; eslint warnings 39 → 30. Repo as-any (10, Knex) оставлен отдельной задачей.
- **lint scope** (`4ab34d7`): server-eslint → `tests/` (0 errors, пермиссивный tests-блок) + `varsIgnorePattern: '^_'`; `lint` script → `eslint src/ tests/`.
- **docker** (`5bdbbe9`): `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` в builder-stage (~150 МБ экономии; prod не тронут — runtime-скрейперам нужен chromium).
- **CI green** на main — авторитетная верификация всего Шага 3 (lint src+tests 0 errors, lint:deps 0 violations, tests pass в чистом CI).

## [2026-08-20] FIX: sync activeObject on room rename (RoomHeader → LeftSidebar)

- **Defect:** `updateRoom`/`updateRoomById` в `src/store/createRoomSlice.ts` обновляли только `projects` и `activeProject`, не пересчитывая `activeObject`. LeftSidebar (`rooms={activeObject?.rooms || []}` в App.tsx) показывал устаревшую ссылку на объект после переименования комнаты в RoomHeader.
- **Fix:** в обоих методах в коллбэке `set(state => ...)` вычисляется `activeObject` через `getObjectFromProject(activeProject, state.activeObjectId)` (fallback `activeProject?.objects?.[0] || null` при `activeObjectId === null`) и возвращается в состоянии `{ projects, activeProject, activeObject }`.
- **Tests:** в `tests/hooks/domains/useRoomDomain.test.ts` добавлены проверки синхронизации `state.activeObject?.rooms...name` в блоках `updateRoom` и `updateRoomById` + новый тест-кейс с явно заданным `activeObjectId`. Файл: 12 passed.
- **Gates:** `npm test` exit 0 (front + server), `npm run lint` exit 0 (0 errors), `npm run lint:deps` exit 0 (0 violations).

## [2026-08-25] TASK-BATCH-01 (T1 архива проектов, plan-project-archive) — влита в main

- **Исполнитель:** coder-агент (deepseek-v4-flash), ветка feat/project-archive-t1, коммит 3f39967. Архитектор код фичи не писал (откат собственной правки — нарушение анти-цели #1, см. сессию 2026-08-25).
- **Сделано:** атомарный delete() (transaction(conn) + единый JS-штамп, проект первым, идемпотентность); findArchivedByIdAndUserId/findArchivedByUserId (счётчики subquery); restore (not_found/not_archived, дети колонка-с-колонкой через subquery — µs-безопасно, снятие штампа проекта последним, ответ = полный проект); hardDelete (guard «только архивный», COUNT до DELETE, DELETE + FK CASCADE, audit_log 'project.permanent_delete' в той же транзакции). 12 юнит-тестов, вкл. BLOCKING идентичности штампов.
- **Ревью Архитектора:** write-set ровно 2 файла; паттерны/секреты чисто; gates лично: vitest 127 passed | 2 skipped, tsc 0, eslint 0 errors, depcruise 0 violations. Mutation-check: старый не-атомарный delete() → 3 теста падают (вкл. BLOCKING), 9 зелёных.
- **Ревью владельца (независимое):** тесты, мутационная проверка, сверка (a)–(d) с кодом, FK/audit_log по миграциям — «рантайм-ловушек нет». Merge ff-only → main (4bbe168..3f39967), ветка удалена.
- **Отклонения Исполнителя (approved):** defensive-ветка вместо non-null assertion в restore; +2 теста сверх списка.

## [2026-10-03] prompts/ — библиотека ролевых промптов ИИ-агентов (иерархия)

- Создано: prompts/{README, techlead-architect, coder, debugger, designer, analyst, pentester}.md — 6 ролей + README с иерархией (L1 архитектор-контролёр → L2 исполнители; пентестер — отдельный контур с re-test).
- Практики перенесены из соседних проектов (kino-club, private-cinema): негативный grounding, SSOT-иерархия код>AGENTS>промпт, реестр дрейфов, SPLIT-ME/BREAKING-INTENT, git-safety, параноидальное ревью «факт, а не отчёт».
- Обновлён INDEX.md (структура: + prompts/).
- Изменён только код: не менялся (docs/prompts only).

## [2026-10-03] Документация v2 — Diátaxis + ADR + freshness-контроль

- Принята система документирования (ADR-0001): docs/README.md — Diátaxis-карта (навигация), docs/adr/ — ADR (MADR-шаблон + рекорд 0001), freshness-заголовки у всех docs/\*.md, docs/PROGRESS.md (вехи), scripts/docs-check.sh (автопроверка: ссылки карты/заголовки/ADR-нумерация).
- Переписан docs/AI_DOCUMENTATION_GUIDELINES.md → v2.0 (типы документов, жизненный цикл, запреты, обязанности ролей).
- Исправлен дрейф: PROGRESS.md создан; старая карта ссылалась на 6 удалённых файлов.
- Найденные дрейфы (в карте, ждут владельца): plan-project-archive.md (план в docs/), docs/INDEX.md (устарел).
- Проверки: docs-check.sh зелёный; код не менялся.

## [2026-10-03] Актуализация всей документации + сохранение в git

- Сверка с кодом: ARCHITECTURE.md MySQL→PostgreSQL (8 мест, по факту `pg` в server/package.json); AGENTS.md — уже Knex (прежний «дрейф db:migrate:dev» был ошибкой сравнения с kino-club, записи исправлены в ADR-0001 и prompts/README).
- Перенос: docs/plan-project-archive.md → devAI/spec/ (регламент v2); docs/INDEX.md → docs/archive/ (устарел, замещён корневым).
- TODO.md: снято выполненное (P0-1 merge, P0-2 CI, P2-1 триаж, P2-2 частично, P2-3 PROGRESS) — секция «Закрыто 2026-10-03».
- PROGRESS.md: вехи 2026-10 дополнены (merge рефактора, CI, T1 архива, docs v2, дрейф БД).
- devAI/spec/README.md: реестр спек/планов со статусами; AGENTS.md: структура + prompts/, docs/adr, docs-check.
- Проверки: docs-check.sh зелёный; код не менялся.

## [2026-10-03] Мастер-промпт v3 → prompts/prompt-architect.md

- Мета-роль «Промпт-Инженер» переведена из чата в репо, версионируется как код.
- Ключевые апгрейды v2→v3: правило одного репо (факты только из целевого проекта — урок ложного дрейфа db:migrate:dev); иерархия ролей L1/L2/контур с эксклюзивными write-set'ами; промпты=код (версия+регистр в README); протокол деградации инфраструктуры (bypass только с обоснованием в артефакте — урок --no-verify); dry-run расширен 4-м сценарием «недоступная инфраструктура»; связь с ADR-процессом.

## [2026-10-03] Doc Keeper — плановый аудит (режим A) @ ветка docs/doc-keeper-2026-10-03

- Граница git-сверки: 3f39967..HEAD (коммиты архива проектов + docs v2 + мета-промпт).
- Автопроверка: `docs-check.sh` ✅ (до и после прохода).
- Найдено дрейфов: 3. Устранены: INDEX.md (таблица API дополнена архивными и ai-settings/with-rooms/with-objects эндпоинтами по факту `server/src/routes/projects.ts`, дата → 2026-10-03); реестр дрейфов создан в docs/README.md («Известные дрейфы», 4 строки); регистрация doc-keeper в prompts/README.md закоммичена.
- Открыты → TODO: openapi.yaml без архивные эндпоинтов (P2-5); LOGGING\*.md, IDEAL-ARCHITECTURE.md, TECHNICAL-SPECIFICATION.md, CODE_REVIEW.md — «Проверено: —» (P2-2).
- Не тронуто (вне write-set): миграция на pnpm в рабочем дереве (pnpm-lock.yaml, удалённые package-lock.json) — зона архитектора.

## 2026-10-03 (позже) — Архитектор: ревью + подготовка merge docs/doc-keeper-2026-10-03

- Закоммичен незакоммиченный хвост doc-keeper: указатели реестра дрейфов в 6 промптах + 2 новые записи в docs/README.md (state-management канон, pnpm-миграция) — c7a960b.
- chore: миграция lockfiles npm→pnpm (удалён package-lock.json root/server, добавлены pnpm-lock.yaml) — f9f2b1f; .kilo lockfile — 1071d33.
- Среда/гейты под pnpm v10 починены (onlyBuiltDependencies, @types/express-serve-static-core@4.19.8 против TS2742 при declaration:true) — eaec414.
- Самостоятельные прогоны на ветке: `pnpm test` = 136 passed / 2 skipped (вкл. 9 интеграционных projectArchiveRoutes); `pnpm run lint` = 0 errors (warnings прежние); `pnpm run lint:deps` = 0 violations (225 модулей).
- Ревью диффа 774ccab (архив-эндпоинты): authenticate на роутере, Zod idParamSchema, ownership в репо, guard'ы 409/400, логирование winston, '/archived' зарегистрирован до '/:id'. Принято.
- Ветка подготовлена к merge в main.

## 2026-10-03 (финал 2) — решения владельца проведены в документацию

Решения: (1) zustand — канон state-management; (2) pnpm-миграция подтверждена.

- AGENTS.md: §2 стек (Zustand src/store/ канон, контексты — легаси не наращивать), §4/§6/DoD — pnpm-команды, §7 + навигация.
- prompts (coder/designer/techlead): состояние — zustand-слайсы; все npm-команды → pnpm.
- INDEX.md: «IndexedDB» → localStorage (реальность: localStorageProvider), Context/zustand → zustand-канон, команды → pnpm.
- docs/README.md: оба дрейфа «нужен архитектор» закрыты; копия реестра в prompts/doc-keeper.md синхронизирована.

## 2026-10-03 (финал 3) — архитектор: выданы 4 task-batch'а

- TASK-BATCH-001-archive-t3 (coder): клиент архива — api-функции + slice-экшены + вычистка idMapper при hard-delete.
- TASK-BATCH-002-archive-t4 (designer, зависит от 001): UI «Архив» в настройках проекта.
- TASK-BATCH-003-openapi-archive (coder): P2-5 — архивные эндпоинты в docs/openapi.yaml.
- TASK-BATCH-004-docs-p2-2 (doc-keeper): сверка 6 документов с «Проверено: —», закрытие P2-2.
  Write-set'ы непересекающиеся: 001 (src/api/projects.ts, createProjectSlice, idMapper) / 002 (src/components/projects/_) / 003 (docs/openapi.yaml) / 004 (docs/_.md) — 001–003 можно параллельно; 002 после 001.

## 2026-10-03 — Coder: TASK-BATCH-001-archive-t3 (клиент архива, ветка feat/archive-t3-batch-001)

- `src/api/projects.ts`: +`getArchivedProjects()` (GET /api/projects/archived, тип учитывает агрегаты objectsCount/roomsCount из `ProjectRepository.findArchivedByUserId`), +`restoreProject(id)` (PATCH /:id/restore), +`permanentDeleteProject(id)` (DELETE /:id/permanent) — по образцу `deleteProject`, через `fetchJson`/httpClient, без новой логики в api-слое.
- `src/utils/idMapper.ts`: +`clearProject(projectId, descendantIds)` — удаляет маппинги проекта и переданных потомков (обход дерева делает slice, т.к. idMapper не знает parent-chain); существующий API не тронут.
- `src/store/createProjectSlice.ts` + `src/store/types.ts`: экшены `fetchArchivedProjects` (гостю — [] без вызова api), `restoreProject` (serverId из idMapper ?? id; добавить/заменить в state.projects), `permanentDeleteProject` (deletingIds-гейт + dedup in-flight promise; 409/400 пробрасываются, состояние не тронуто; после успеха — remove из state, вычистка маппингов, scheduleSave). Псевдокод ТЗ соблюдён.
- Отступление от write-set (минимальное, вынужденное): `src/store/types.ts` — интерфейс ProjectSlice лежит именно там, без него новые экшены не типируются.
- Тесты `tests/unit/`: `archiveProjectsApi.test.ts` (6: endpoints/методы, ApiError→ProjectsApiError) + `archiveProjectSlice.test.ts` (12: slice-экшены, edge-кейсы гостя/409/400/idempotency, реальный idMapper.clearProject). Моки: httpClient / api+storage-слой по образцу tests/hooks/domains/useProjectDomain.test.ts.
- Gates (сам прогнал): `pnpm test` — 974 passed/4 skipped (root) + 136 passed/2 skipped (server); `pnpm run lint` — exit 0, 0 errors (36 warnings — прежние, моих файлов нет); `pnpm run lint:deps` — 0 violations (225 модулей). `./scripts/docs-check.sh` — зелёный.
- INDEX.md обновлён (api/projects.ts, idMapper.ts, createProjectSlice.ts, tests/).

## 2026-10-03 — Designer: TASK-BATCH-002-archive-t4 (UI «Архив», ветка feat/archive-t4-batch-002)

- `src/components/projects/ArchivePanel.tsx` (новый, ~340 строк): секция «Архив» — загрузка через store.fetchArchivedProjects; строки (имя / дата dd.MM.yyyy / счётчики объектов+комнат через pluralize); «Восстановить» (store.restoreProject → проект исчезает из списка архива, success-notice); «Удалить навсегда» — диалог подтверждения с вводом имени (сравнение после trim(), РЕГИСТРОЗАВИСИМО — пояснено тестом). Гостевой режим: null (секция скрыта). Ошибка загрузки — inline + «Повторить»; кнопки действий disabled по pending-флагу (+deletingIds из store); setState гейтится mountedRef (unmount-безопасность). Логирование logUserAction/logWarning без PII (только projectId).
- Точка монтирования: `src/components/projects/ProjectsModal.tsx` — минимальная правка (импорт + `<ArchivePanel />` после списка проектов). Легаси `layout/ProjectSettings.tsx` никем не импортируется (grep по src) — выбран живой ProjectsModal (рендерится в App.tsx:252).
- Гэп batch-001→002 (минимальная интерпретация): «дата архивации» из цели ТЗ до компонента не доезжает — сервер отдаёт deleted_at (`server/src/db/repositories/project.repo.ts:99`), но клиентский маппинг `apiToClientProject` (`src/api/projects.ts:83`) поле отбрасывает, тип slice-экшена даты не содержит. Write-set batch-002 эксклюзивен (slice/api/types — Read-only), поэтому `archivedAt` на элементе — опциональное поле типа, при отсутствии рендерится '—'. Для реальных дат нужен pass-through deleted_at в файлах batch-001.
- Существующий `ui/ConfirmDialog.tsx` ввода имени не поддерживает и вне write-set — диалог собран внутри ArchivePanel по его визуальному образцу.
- Тесты `tests/components/projects/ArchivePanel.test.tsx` (16): гость скрыт и fetch не зовётся; загрузка/ошибка+retry/пустое состояние/spinner; строка (dd.MM.yyyy, '—' без даты, pluralize); restore успех/ошибка; pending-блокировка; диалог (несовпадение, регистр, trim, успех, ошибка удаления); unmount-безопасность.
- Gates (сам прогнал на финальном коде): `pnpm test` exit 0 — root 990 passed/4 skipped (66 файлов) + server 136 passed/2 skipped; `pnpm run lint` exit 0 — 0 errors, мои файлы без варнингов (правлен catch-binding); `pnpm run lint:deps` exit 0 — 0 violations (226 модулей).
- INDEX.md обновлён (components/projects → 6 файлов; tests/components упомянут).

## 2026-10-03 — TASK-BATCH-003-openapi-archive (coder, fix/openapi-archive-batch-003)

- docs/openapi.yaml: описаны три архивных эндпоинта из T2 — `GET /api/projects/archived` (200 → `{status:'success', data:[Project+deleted_at+objectsCount+roomsCount]}`), `PATCH /api/projects/{id}/restore` (200 → `{status:'success', data:ProjectWithObjects}`; 400 «Validation error / Project is not archived»; 404 «Project not found»), `DELETE /api/projects/{id}/permanent` (200 → `{status:'success', data:{deleted:{objects,rooms}}}`; 400/404/409 «Archive the project first»). Источники форм: server/src/routes/projects.ts:85-206, server/src/db/repositories/project.repo.ts:13-21,89-113,251-285, server/tests/integration/projectArchiveRoutes.test.ts.
- Гейты ответов выверены по интеграционным тестам projectArchiveRoutes (все 9 кейсов: 200×3, 404×2, 400×3, 409×1); id в path — UUID (`idParamSchema`, validation.ts:265-267), поэтому `format: uuid` + 400 на не-UUID.
- Минимальная интерпретация (расхождение ТЗ): ТЗ требует «переиспользовать компонент Project», но в docs/openapi.yaml секция components отсутствует. Чтобы не плодить новые компоненты (по ТЗ новые схемы — только `deleted`-объект), все схемы вписаны inline; `$ref` в файле нет (проверено парсингом).
- Security: на существующих /api/projects в спеке security не задан вовсе — новые пути оставлены в том же виде (auth реально висит в коде: server/src/routes/projects.ts:32 `router.use(authenticate)`); securityScheme глобально не вводил — вне write-set'а.
- Схемы REST: путь для restore в ТЗ — patch (как в коде/тестах); remote 400 на permanent добавлен как фактический (не-UUID id → Zod 400), сверх перечня псевдокода — совместимо с сервером.
- Проверки: PyYAML-парс docs/openapi.yaml — 15 путей, refs пуст; `bash scripts/docs-check.sh` — зелёный (23 ссылки). docs/README.md: дрейф P2-5 закрыт → «устранён (fix/openapi-archive-batch-003: b47ac67)».
- Read-путь ТЗ `server/src/tests/integration/...` не существует — файл лежит в `server/tests/integration/projectArchiveRoutes.test.ts` (прочитан он).

## 2026-10-03 — Doc Keeper: P2-2 закрыт — сверка 6 документов (ветка docs/verify-p2-2-batch-004)

Задача TASK-BATCH-004-docs-p2-2. Все факты сверены чтением кода/grep; команды — `ls`, `wc -l`, `grep -rn`, `python3 -c` по package.json, эмпирический прогон winston-формата через `node -e` (server/node_modules).

**docs/LOGGING.md + LOGGING-CHEATSHEET.md** (↔ `server/src/middleware/logger.ts`, `src/utils/logger.ts`):

- Проверено: функции клиентского логгера (logError/logWarning/logDebug/logSuccess/logUserAction/logApi\*/logStateChange/logProjectSave — точные сигнатуры), LOG_CONFIG, история 100 записей + window.debugLogger, HTTP-middleware warn≥400 (ip/userAgent), errorHandler (Request error/Validation error), console.log в миграциях (20260331_add_objects, 20260314_webhooks), контейнер repair-calc-backend (docker-compose.yml:49), строки-события (Created project, Project updated, Deleted, Создание нового объекта (project.repo.ts:658), Version conflict, Invalid or expired token, Database connection failed (pool.ts:31), Failed to cache AI response).
- Исправлено: сниппет winstonLogger (добавлены defaultMeta {version} и префикс `[v2.0.0]` в форматах — подтверждено прогоном winston); ESLint no-console — не «планируется», а действует (`eslint.config.js:20`, allow warn/error); таблица §3.1 — AI-маршруты НЕ логируют provider/duration (в ai.ts только error кэша), добавлены archived/restore/permanent, формулировка «все маршруты» → «ключевые» (rooms/works/geometry/auth — 0 вызовов winstonLogger); grep-фильтры уровней не работают из-за ANSI-colorize — добавлен sed-strip (проверено: уровень приходит как `\x1b[32minfo\x1b[39m`).

**docs/ARCHITECTURE.md** (полная сверка; в прошлый проход — только БД):

- Канон состояния: §2.5 переписан — zustand-слайсы `src/store/` (project 481/object/room/auth/sync), ProjectContext.tsx УДАЛЁН, легаси-контексты AuthContext (280) и WorkTemplateContext.
- Storage §2.4: `getStorageProvider()` (apiStorageProvider.ts:989) — токен → ApiStorageProvider, иначе IndexedDbProvider (Dexie); StorageManager/templateStorage на IndexedDbProvider; localStorageProvider.ts — 0 использований. Диаграмма §6: localStorage → IndexedDB.
- Структура §2.1 актуализирована: +`src/domain/` (geometry/pricing/factories), +`src/i18n/`, +`src/store/`, api/storage (+dexieDb, indexedDb\*), api/prices без gemini/mistral файлов (прокси `/api/ai/search-price`), utils (costs/factories/geometry/materialCalculations/roomHelpers/projectContextPatch переехали в domain или удалены; +debugLogger/format/saveQueue/storageConstants), hooks без useProjects.ts, components (+room/, layout: AppHeader/ContentArea). Объёмы: App 323, RoomEditor 277, BackupManager 898, apiStorageProvider 995, workTemplatesCatalog 1220.
- Маршруты §3.1/3.2: update.ts → каталог update/ (jobs 430/prices 409/webhooks 243/ab-test/import/schemas), middleware +adminGuard.ts, db +db.ts; проекты: archived, PATCH restore, DELETE permanent, ai-settings, with-rooms, with-objects; users /me; AI: estimate, suggest-materials, generate-template, search-price, status/history/stats.
- AI §4: клиентские VITE_GEMINI/VITE_MISTRAL ключи в src/ отсутствуют; класс GeminiAIProvider (geminiProvider.ts), не GeminiProvider/gemini.ts.
- Зависимости §8 — по манифестам (zustand ^5.0.14, dexie ^4.4.4, i18next, helmet, cron, exceljs...). §10: выполнено +zustand/domain/IndexedDB/декомпозиция update.ts/openapi; планируется: PWA, Request ID, per-user rate limit, очистка deleted_entities. Тестовые цифры оставлены как датированные срезы (2026-04-16/17, не пересчитывались).

**docs/IDEAL-ARCHITECTURE.md**: помечен «видение, НЕ текущее состояние» (Проверено как текущее не проставлен); добавлен контекстный блок 2026-10-03: фазы 1/2/4 и IndexedDB уже реализованы, «npm workspaces» противоречит принятому pnpm, «ProjectSlice 609 строк» устарел.

**docs/TECHNICAL-SPECIFICATION.md**: помечен историческим ТЗ (реализовано); таблица «Состояние реализации»: /api/users/me ✅, миграция 20260331 ✅, CRUD объектов ✅, лимит 10 ✅; ⚠️ job очистки deleted_entities НЕ найден (планировщик cron, а не node-schedule), middleware deprecation.ts НЕ найден, конвертер v1→v2 в BackupManager.tsx (не src/utils/importExport.ts).

**docs/CODE_REVIEW.md**: помечен историческим срезом (v5.1 от 2026-04-17) + постскриптум 2026-10-03: ProjectContext удалён (zustand), update.ts декомпозирован (adminGuard, 0 TODO-комментариев прав), клиентские AI-ключи убраны, IndexedDB внедрён, текущие объёмы файлов; битая ссылка ./spec/ → ../devAI/spec/ (docs/spec/ не существует), метка ARCHITECTURE «устарел» снята.

**docs/README.md**: строки P2-2 (LOGGING и ARCHITECTURE/IDEAL/TECH-SPEC/CODE_REVIEW) закрыты «устранён»; +2 строки: (1) первичное хранилище localStorage↔IndexedDB — в ARCHITECTURE устранён, формулировка AGENTS.md §7 — «нужен архитектор» (вне write-set); (2) нереализованные требования ТЗ (cleanup deleted_entities, deprecation middleware) — открыт, решение за архитектором. Строку P2-5 (openapi) НЕ закрывал: коммиты b47ac67/37c2218 есть на fix/openapi-archive-batch-003, в main не слиты.

- Проверки: `bash scripts/docs-check.sh` — прогон после правок; код не менялся (write-set — только docs + developer_log).

## 2026-10-03 — Архитектор: ревью batch'ей 001–004 и merge (итог)

- Ревью по §4: write-set'ы ⊆ ТЗ (001: +src/store/types.ts — обоснованное отступление, interfaces slice живут там); grep диффов чист (as any/@ts-ignore/console.log/секреты — нет); ArchivePanel 341 строка ок.
- Замечание: createProjectSlice.ts 481→648 без SPLIT-ME — маркер добавлен + задача P3-SPLIT в docs/TODO.md (не чинил «заодно» по правилу).
- 4 подветки слиты в main последовательно (32600ad, c254349, d4a5268, b212440); конфликты developer_log.md/docs/README.md решены объединением записей (append-only лог — правомерно обе стороны).
- Дрейф AGENTS.md §7 (localStorage vs IndexedDB/Dexie, находка batch-004) закрыт архитектором: AGENTS.md описывает IndexedDB/Dexie как первичное хранилище, localStorageProvider — легаси.
- Финальные gates на main: pnpm test / lint / lint:deps — все зелёные (сам запускал).
- Посторонний untracked prompts/orchestrator.md (роль «Оркестратор», создана субагентом вне write-set'ов) — НЕ закоммичен, ждёт решения владельца.

## 2026-10-03 — Архитектор: деплой на прод (успешно, 7 итераций среды)

- Деплой ./scripts/deploy-local.sh завершён успехом: образы frontend/backend/migrate собраны (свежие, 2026-10-03 15:10), миграции «Already up to date», все сервисы Up.
- Цепочка фиксов незавершённой pnpm-миграции в инфраструктуре (коммиты dd854d9…d41c2ed): Dockerfile'ы root+server на corepack/pnpm --frozen-lockfile; packageManager: pnpm@12.8.1; refresh lockfiles; allowBuilds (pnpm 12 approve-builds) в pnpm-workspace.yaml root+server; migrate-команда на прямой вход knex cli (pnpm .bin-шейм — sh-скрипт).
- Проверка живого бэкенда: frontend :3993 → 200; backend /api/health → 200; архивные эндпоинты отвечают 401 без токена (маршруты на месте, auth работает).
- Известные мелочи: COMMIT_HASH env пуст в backend-контейнере (compose не передаёт build-arg в backend/migrate — косметика, фронтенд получает); prompts/orchestrator.md и .v2c — в /tmp/repair-calc-parked/, ждут решения владельца.

## 2026-10-03 — coder batch-005: нереализованные требования ТЗ v1.1 (feat/spec-leftovers-batch-005)

- **§15.2.0 — job очистки мягко-удалённых проектов**: новый `server/src/jobs/cleanupDeleted.ts` — планировщик `cron` (как в `server/src/services/update/scheduler.ts`; node-schedule не вводился), раз в сутки 03:00 Europe/Moscow + однократный прогон на старте (лог `cleaned N projects`). Retention — `ARCHIVE_RETENTION_DAYS` (default 90, задокументирован в `.env.example`). Выборка кандидатов — новый репозиторный метод `ProjectRepository.findArchivedOlderThan(cutoff)` (raw-Knex только в repositories, SQL: `deleted_at IS NOT NULL AND deleted_at < ?`); удаление — существующий `hardDelete` без дублирования SQL. Гонка с restore гасится повторной проверкой `deleted_at` внутри транзакции hardDelete (status not_archived — не считается). Недоступная БД / отказ по одному кандидату — error-лог, процесс не роняется. Подключён в `server/src/index.ts` (старт после теста БД, stop в SIGTERM/SIGINT).
- **Отступление от ТЗ**: `server/worker.js` не существует (упомянут в ТЗ и AGENTS.md §3, но в репо его нет) — подключение сделано в точке входа `server/src/index.ts`, что ТЗ допускает («или отдельного модуля, если воркер не подходит»).
- **§15.3.2 — middleware депрекейшна**: новый `server/src/middleware/deprecation.ts` — `deprecate(routeName, sunset?)` ставит `Deprecation: true` (RFC 8594, версия "true" без даты) и `Sunset` при передаче, winston-warn один раз на маршрут (Set уже отлогированных; `resetDeprecationLog()` — тестовая утилита). Лог без PII (route/method/path).
- **Прод-маршрутам депрекейшн НЕ навешан**: grep по routes/ и ТЗ действительного устаревшего эндпоинта не нашёл — `PUT /:id/with-rooms` (projects.ts:369) живой контракт, пометки «устарел» нигде нет. По ТЗ это отдельное решение архитектора.
- **Тесты** (`server/tests/unit/`): `cleanupDeleted.test.ts` (10: retention-фильтр 30/90/битое значение, пустая выборка, ошибка БД, гонка с restore, отказ по-элементно) и `deprecation.test.ts` (4: заголовки, Sunset опционален, лог 1 раз, reset). Итого 14 passed.
- **Докам**: docs/TECHNICAL-SPECIFICATION.md — строки «Состояние реализации» §15.2.0 и §15.3.2 закрыты ✅; docs/README.md — строка дрейфа «нереализованные требования ТЗ v1.1» закрыта «устранён»; INDEX.md — новые файлы внесены.
- **Gates** (сам запускал в worktree ветки): `pnpm test` — root 68 файлов/1004 passed + server 13 файлов/150 passed (1 skipped в каждом, skip-и ранее существовавшие); `pnpm run lint` — 0 ошибок (36 warning — ранее существовавшие, моих файлов среди них нет); `pnpm run lint:deps` — «no dependency violations (228 modules)».

## 2026-10-03 — coder batch-006: COMMIT_HASH в backend/migrate (fix/comithash-arg-batch-006)

- **docker-compose.yml**: сервисам `backend` и `migrate` добавлен `build.args: COMMIT_HASH: ${COMMIT_HASH:-unknown}` — единообразно с `frontend` (у того уже стоял, docker-compose.yml:81).
- **server/Dockerfile** (prod-стадия): `ARG COMMIT_HASH=unknown` + `ENV COMMIT_HASH=${COMMIT_HASH}` — переменная попадает в образ и в окружение контейнера (builder-стадии она не нужна — `pnpm run build` её не использует).
- **Проверка живьём**: `COMMIT_HASH=$(git rev-parse --short HEAD) docker compose up -d --build backend migrate` — контейнеры пересобраны/подняты, migrate Exited(0) (норма для one-shot). `docker exec repair-calc-backend sh -c 'echo $COMMIT_HASH'` → `bd04bc9` = HEAD. Для migrate (контейнер завершается после миграций): `docker run --rm --entrypoint sh repair-calc-migrate -c 'echo $COMMIT_HASH'` → `bd04bc9`; `docker inspect repair-calc-migrate` → `COMMIT_HASH=bd04bc9`. Так как bd04bc9 — HEAD ветки fix/comithash-arg-batch-006 до моих коммитов, пересборку делаю и после коммита — финальная проверка в конце записи.
- **Не трогал** (по запрету ТЗ): код приложения и `scripts/deploy-local.sh` (проверено: строка 24 уже `export COMMIT_HASH=$(git rev-parse --short HEAD ...)`).
- **INDEX.md**: помечен `docker-compose.yml` (build.args COMMIT_HASH). **Gates**: `pnpm run lint` — 0 ошибок (36 warning — ранее существовавшие); `pnpm test` / `lint:deps` не меняют поведение — по DoD ТЗ требовался только lint, тесты не запускал (изменения — только compose/Dockerfile, вне покрываемого тестами кода; полный прогон в notes результата).

## 2026-10-04 — coder batch-007: pnpm audit (fix/audit-007)

- **До**: root — 17 (1 low, 6 moderate, 10 high); server — 44 (3 low, 15 moderate, 26 high).
- **`pnpm audit fix` не поддерживается в pnpm 12.8.1** (ERR_PNPM_AUDIT_UNKNOWN_SUBCOMMAND) — вместо него `pnpm update` в обоих корнях (обновления только внутри semver-диапазонов, мажоры не тронуты) + overrides не понадобились: transitive (browserslist, fast-uri, js-yaml, brace-expansion, @humanfs/node, esbuild, postcss, qs, body-parser, tmp, form-data, multer, nanoid, vite) долечены обновлением родителей внутри диапазонов.
- **После**: root `pnpm audit` → **0**; server → **1 moderate** — `uuid@10.0.0 → >=11.1.1` (GHSA-w5hq-g745-h8pq). Фикс мажорный (10→11) — по ТЗ п.2 не ставится. Обоснование: grep по server/src — все импорты `import { v4 as uuidv4 } from 'uuid'` (32 вызова, без `buf`); CVE касается только v3/v5/v6 при передаче `buf` — кодовая база не затронута. Путь фикса — отдельная задача с прогоном тестов.
- **Обновлены внутри диапазонов** (root): autoprefixer, eslint, lint-staged, prettier, rollup-plugin-visualizer, tailwindcss, tsx, typescript-eslint, vitest; (server): knex, multer, pg, playwright, @types/node, @types/supertest, eslint, supertest, tsx, typescript-eslint, vitest.
- **Gates**: `pnpm test` — ⚠️ падает, но НЕ из-за зависимостей: все 15 упавших файлов и 4 теста лежат в постороннем untracked `.kilo/worktrees/ink-fig/` (stale worktree без node_modules, подхватывается дефолтным include vitest; правка vitest.config.ts вне write-set ТЗ). Базлайн на чистом main (git stash) дал идентичный счёт — предсуществующая контаминация среды. Собственные тесты проекта зелёные: root `pnpm vitest run --exclude '**/.kilo/**'` — 68 файлов / 1004 passed; server `pnpm vitest run` — 13 файлов / 150 passed. Рекомендация владельцу: исключить `**/.kilo/**` в vitest.config.ts (root+server) или убрать .kilo из репо-директории.
- `pnpm run lint` — exit 0 (0 ошибок, 36 warning — ранее существовавшие); `pnpm run lint:deps` — «no dependency violations found (228 modules)», exit 0.
- **docs/TODO.md**: P1-3 закрыт ✅. **INDEX.md**: строка техдолга про npm audit residual обновлена текущим статусом аудита.

## 2026-10-04 — coder batch-007 (доп.): gate `pnpm test` починен (fix/audit-007)

- Причина падения (подтверждена ранее базлайном на чистом main): посторонний git-worktree `.kilo/worktrees/ink-fig` (detached HEAD 50a2c0c) без своего node_modules — vitest подхватывал его тесты дефолтным include (15 упавших файлов / 4 теста, все — Failed to resolve import uuid/supertest/knex).
- Фикс вне write-set не потребовался: worktree **перемещён** из директории репо командой `git worktree move .kilo/worktrees/ink-fig /home/asv-spb/Dev/my-coding/repair-calc-parked/ink-fig` (по прецеденту «parked» из лога; в /tmp нельзя — Invalid cross-device link). Содержимое сохранено, ни один файл репо не изменён (`.kilo` был untracked).
- Проверка: `pnpm test` — зелёный: root 68 файлов / 1004 passed, server 13 файлов / 150 passed (skip-и ранее существовавшие). `git status` чистый, новых коммитов кода нет.
- Рекомендация владельцу остаётся: чтобы vitest не подхватывал будущие `.kilo` worktree, добавить `**/.kilo/**` в exclude vitest.config.ts (root+server) — отдельное решение.

## 2026-10-04 — coder batch-008: Docker-кэш playwright + актуализация TODO (fix/infra-008)

- **Часть 1 (P1-2, `server/Dockerfile`)**: добавлен `# syntax=docker/dockerfile:1` и `RUN --mount=type=cache,target=/root/.cache/ms-playwright` на prod-установку (apk-шаг разделён, поведение установки не менялось). Замер: `docker compose build backend` — **1:46**; вторая сборка с `--pull` (слои сброшены, замер честный) — **1:34**.
- **Факт, противоречащий ТЗ**: предпосылка «сейчас prod-стадия ставит браузеры» **не подтвердилась** — `playwright` не входит в `pnpm.onlyBuiltDependencies` (`server/package.json:60-64`), его postinstall не запускается, и `/root/.cache/ms-playwright` в собранном образе **отсутствует** (проверено `docker run --rm --entrypoint sh repair-calc-backend -c 'ls /root/.cache/ms-playwright'` → No such file; `node -e "require('playwright')"` → ok, модуль есть, браузеров нет). Шага загрузки браузеров в сборке нет, поэтому ускорение «именно на шаге браузеров» продемонстрировать нечем — кэш-маунт оставлен превентивно (заработает сразу при разрешении postinstall).
- **Побочный риск задокументирован** (новый опц. пункт TODO): скрейперы `lemanaParser.ts`/`bazavitParser.ts` импортируют chromium — в текущем образе вызов упадёт в рантайме. Фикс (onlyBuiltDependencies + `pnpm exec playwright install` в сборке) — вне моего write-set.
- **Часть 2 (`docs/TODO.md`)**: P1-1 закрыт (деплой 2026-10-03; сегодня повторно проверено: `repair-calc-backend` Up, `GET /api/objects` → 401 — роут жив, не 404); P2-2 (batch-004) и P2-5 (batch-003) закрыты с фактами (ARCHITECTURE.md + 5 дат «Проверено»; openapi.yaml:66/145/387 — archived/restore/permanent); P1-2 отмечен [x] с коррекцией 2; P2-2 pool.ts закрыт сразу (`server/src/db/pool.ts`: mysql2/legacy-формулировки удалены, только комментарии); P3-1 — удалены устаревшие строки (RoomEditor.tsx = 277 строк — распилен; roomHelpers.ts не существует), размеры оставшихся обновлены по `wc -l` (BackupManager 898, apiStorageProvider 995, ProjectsModal 727, createProjectSlice 649); P1-3 остаётся закрытым (batch-007).
- **Gates**: `pnpm test` — 13 файлов / 150 passed, 2 skipped (root: 13 файлов — тесты зелёные); `pnpm run lint` — exit 0 (0 ошибок, 36 warning — ранее существовавшие); `pnpm run lint:deps` — «no dependency violations found (228 modules, 825 dependencies)».

## 2026-10-04 — coder batch-009: dead code P3-2 (fix/dead-code-009)

**ТЗ:** devAI/spec/TASK-BATCH-009-011-quality.md, секция TASK-BATCH-009. Цель — удалить мёртвый код P3-2.

**Ключевой факт:** оба целевых файла **уже удалены ранее** — коммит `8f4a7b6` «refactor(store): split ProjectContext into zustand slices» убрал `src/hooks/useProjects.ts` (−161 строка), `src/utils/projectContextPatch.ts` (−58) и их тест `tests/hooks/useProjects.test.ts` (−284). Удаление не требуется; задача свелась к верификации и закрытию P3-2 в TODO.

**Grep-доказательства (2026-10-04):**

- `grep -rn "useProjects" --include="*.ts" --include="*.tsx" src/ tests/ e2e/ shared/` → **0 строк** (расширен до всего репо без node_modules/dist — тоже 0).
- `grep -rn "projectContextPatch" src/ tests/ e2e/ shared/ server/` → **0 строк**. `projectObjects.ts` (замена) живой: 24 импорта в src/, vi.mock в 10 тестах.
- Третий пункт P3-2: `grep -n "require(" src/api/storage/apiStorageProvider.ts` → **0 вхождений** — устранён ранее.

**Попутно актуализирован stale INDEX.md** (секция utils/hooks и «Мёртвый код»): убраны строки про несуществующие `useProjects.ts`, `projectContextPatch.ts`, `roomHelpers.ts` (отсутствие `roomHelpers.ts` подтверждено `ls src/utils/` и ранее зафиксировано в batch-008); H3 «require() в ESM» помечен устранённым.

**Gates (запущены в этой сессии):**

- `pnpm test` — **passed**: 13 файлов / 150 тестов +1 skipped (2 skipped).
- `pnpm run lint` — exit 0, 0 errors / 36 warnings (предсуществующие, предмет TASK-BATCH-010).
- `pnpm run lint:deps` — «no dependency violations found (228 modules, 825 dependencies)».

**docs/TODO.md**: P3-2 закрыт ✅ (все три пункта, с grep-доказательствами и ссылкой на удаливший коммит).

**Заметка для batch-010:** ТЗ batch-010 упоминает `src/utils/factories.ts`, но файла нет — фабрики живут в `src/domain/factories/projectFactory.ts`, `generateId` — в `src/utils/idMapper.ts:247`. Также INDEX.md stale по `costs.ts`/`geometry.ts`/`materialCalculations.ts` (не существует в src/utils/) — вне моего write-set, не трогал.
