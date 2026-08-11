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
