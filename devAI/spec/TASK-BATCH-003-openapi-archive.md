# TASK-BATCH-003-openapi-archive (P2-5: архивные эндпоинты в openapi.yaml)

**Назначено:** coder **Подветка:** fix/openapi-archive-batch-003
**Зависит от:** нет **Статус:** ⬜

## Цель (проверяемая)

`docs/openapi.yaml` описывает все три архивных эндпоинта из T2, совместимо с фактическими
ответами сервера; реестр дрейфов в `docs/README.md` — запись P2-5 закрыта.

## Read

- `docs/openapi.yaml` (существующие path-объекты /api/projects — стиль, схемы, теги; файл ~185 строк)
- `server/src/routes/projects.ts` (секция Archive endpoints: коды 200/400/404/409, формы ответов)
- `server/src/tests/integration/projectArchiveRoutes.test.ts` (эталон фактических статусов/тел)
- `server/src/db/repositories/project.repo.ts` (поля Project: archived_at и пр. — для схемы)

## Write (ЭКСКЛЮЗИВНО)

- `docs/openapi.yaml`
- `docs/README.md` (закрыть запись P2-5: «устранён (<коммит>)»)
- `devAI/developer_log.md`

## Алгоритм (псевдокод)

```
добавить paths:
  /api/projects/archived:
    get: 200 -> {status:'success', data: array<Project>}   // только archived
  /api/projects/{id}/restore:
    patch: 200 -> {status:'success', data: ProjectWithObjects}
           404 (Project not found), 400 (Project is not archived)
  /api/projects/{id}/permanent:
    delete: 200 -> {status:'success', data:{deleted:{objects:int, rooms:int}}}
            404, 409 (Archive the project first)
security на новые paths — та же, что у остальных /api/projects (bearer JWT)
```

## Edge-кейсы

- Порядок path'ов в файле не важен, но описание `/archived` не должно конфликтовать с `/{id}` (в OpenAI-спеке это просто разные шаблоны).
- Схемы переиспользовать существующие (компонент Project), новые — только `deleted`-объект.

## Логирование

Не требуется (docs-only).

## Запреты

- НЕ трогать серверный код — спека описывает то, что ЕСТЬ (если нашлось расхождение кода со спекой — стоп и эскалация архитектору, не «подгонять» спеку молча).

## DoD

- [ ] Все три эндпоинта + коды ошибок описаны и соответствуют тестам projectArchiveRoutes
- [ ] docs/README.md: P2-5 закрыт; developer_log.md дописан
- [ ] pnpm run lint — зелёный (yaml в lint не входит, но gates дешёвые — прогнать)

## Эскалация

Расхождение код↔спека сверх описанного → к архитектору.
