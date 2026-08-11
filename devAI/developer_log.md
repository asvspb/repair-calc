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
