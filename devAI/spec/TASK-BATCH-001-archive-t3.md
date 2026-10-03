# TASK-BATCH-001-archive-t3 (клиент архива: api + store + idMapper)

**Назначено:** coder **Подветка:** feat/archive-t3-batch-001
**Зависит от:** нет (T2 серверные эндпоинты уже в main) **Статус:** ⬜

## Цель (проверяемая)

Клиент умеет: получать список архивных проектов, восстанавливать проект,
безвозвратно удалять архивный проект; при hard-delete вычищаются idMapper-маппинги
проекта и всех его объектов/комнат; `pnpm test`/`pnpm run lint`/`pnpm run lint:deps`
зелёные; новые вызовы покрыты unit-тестами.

## Контракт сервера (уже в main, server/src/routes/projects.ts)

- `GET /api/projects/archived` → 200 `{status:'success', data: Project[]}` (только архивированные текущего пользователя).
- `PATCH /api/projects/:id/restore` → 200 `{status:'success', data: ProjectWithObjects}`; 404 Project not found; 400 Project is not archived.
- `DELETE /api/projects/:id/permanent` → 200 `{status:'success', data:{deleted:{objects:number, rooms:number}}}`; 404; 409 Archive the project first (тело ошибки — существующий формат errorHandler).

## Read

- `src/api/projects.ts` (образец: `deleteProject`, `getProjects`, класс `ProjectsApiError`, httpClient-обёртки)
- `src/store/createProjectSlice.ts` (строки ~120, ~405: работа с `idMapper`, `apiProvider.deleteProjectAsync`)
- `src/utils/idMapper.ts` (API маппера: `getServerId` и др.)
- `server/src/routes/projects.ts` (архивная секция «Archive endpoints (T2)»)
- `server/src/tests/integration/projectArchiveRoutes.test.ts` (ожидания статусов)

## Write (ЭКСКЛЮЗИВНО для этого batch'а)

- `src/api/projects.ts` — добавить `getArchivedProjects()`, `restoreProject(id)`, `permanentDeleteProject(id)` по образцу `deleteProject` (httpClient, тот же формат ответов/ошибок, никакой новой логики в api-слое).
- `src/store/createProjectSlice.ts` — экшены `fetchArchivedProjects`, `restoreProject`, `permanentDeleteProject`; для `permanentDeleteProject`: псевдокод ниже.
- `src/utils/idMapper.ts` — ТОЛЬКО если нет метода очистки маппингов по префиксу/проекту (см. псевдокод); не ломать существующий API.
- `tests/unit/` — новый файл тестов slice/api-вызовов (моки httpClient/apiProvider).
- `INDEX.md`, `devAI/developer_log.md` — по регламенту.

## Алгоритм (псевдокод)

```
permanentDeleteProject(projectId):
  state: deletingIds += projectId
  try:
    resp = api.permanentDeleteProject(serverId(projectId) ?? projectId)
    // вычистить локальное состояние:
    state.projects.remove(p => p.id == projectId)
    idMapper.clearProject(projectId)   // если метода нет — добавить: удалить маппинги
                                      // projectId и всех objects/rooms, чей локальный
                                      // parent-chain ведёт к projectId (обход дерева из state)
    toast/log 'Проект удалён безвозвратно (объектов: N, комнат: M)'
  catch e:
    log warn; пробросить для UI
  finally: deletingIds -= projectId

restoreProject(projectId):
  resp = api.restoreProject(serverId ?? id)
  заменить/добавить проект в state.projects (данные из resp.data)
```

## Edge-кейсы (обязательно)

- Гостевой режим (нет токена): вызовы не идут — на уровне apiProvider, как у существующих вызовов.
- `permanentDeleteProject` при 409 (проект активен) — ошибка доходит до UI, состояние не тронуто.
- restore при 400 (не в архиве) — то же.
- idempotency повторного клика: `deletingIds` гейтит повторный вызов.
- Stale closure: экшены через `set`/`get` стора, не кэшировать `state` снаружи.

## Логирование

Клиент — `src/utils/logger.ts` (info на успех restore/permanent, warn на ошибку, без PII).

## Запреты

- НЕ менять серверный код и контракты.
- НЕ трогать `src/contexts/` (легаси-контексты не наращивать — zustand канон).
- `as any`/`@ts-ignore`/пустые catch — запрещены.
- API-вызовы только через существующий httpClient в `src/api/`.

## DoD

- [ ] pnpm test / pnpm run lint / pnpm run lint:deps зелёные (сам перезапустил)
- [ ] Тесты на 3 новых api-функции и очистку idMapper
- [ ] INDEX.md + developer_log.md обновлены
- [ ] Секретов в коде нет

## Эскалация

Неоднозначность → к архитектору. 2 провала одного gate → к человеку.
