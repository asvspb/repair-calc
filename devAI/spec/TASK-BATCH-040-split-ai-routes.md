# TASK-BATCH-040-split-ai-routes

**Назначено:** coder **Подветка:** общая ветка refactor/monolith-splits-b2 (отдельный коммит)
**Зависит от:** нет **Статус:** ✅

## Цель (проверяемая)

`server/src/routes/ai.ts` (558 строк) распилен на handlers по эндпоинтам;
исходный путь — роутер-фасад. `server/tests/integration/aiRoutes.test.ts` и
`routeMounting.test.ts` зелёные БЕЗ правок; импортер `server/src/routes/index.ts`
не меняется.

## Read / Write (write — ЭКСКЛЮЗИВНО)

**Read:** `server/src/routes/ai.ts`, PLAN-monolith-splits-b1.md (секция B2).

**Write (новые, в `server/src/routes/ai/`):**

- `handlers/status.ts`, `handlers/history.ts`, `handlers/stats.ts`,
  `handlers/estimate.ts`, `handlers/suggestMaterials.ts`,
  `handlers/generateTemplate.ts`, `handlers/searchPrice.ts` — по одному на
  эндпоинт: экспортируемая async-функция handler (req, res, next)
- `server/src/routes/ai.ts` — фасад: Router + 7 строк router.get/post,
  подключающих handlers, + export default router

## Алгоритм (псевдокод)

```
каждый handler-файл: тело route-callback переносится байт-в-байт
  (Zod-валидация, res-ответы, next(error) — как есть);
  общие import'ы дублируются по необходимости (это нормально для handlers);
фасад: import { Router }; router.get('/status', statusHandler) и т.д.
  — те же пути, тот же порядок, тот же default export
```

**Edge-кейсы (бэкенд):** порядок регистрации маршрутов сохранить; не потерять
middleware-цепочку в параметрах маршрутов, если она в ai.ts сейчас; inline
Zod-схемы едут вместе со своим handler'ом.

**Логирование:** существующие winston-вызовы переносятся как есть.

## Запреты

- НЕ менять логику/статусы/форматы ответов; НЕ менять тесты и routes/index.ts;
- НЕ трогать services/ai/; новых зависимостей нет; файлы ≤400 строк.

## DoD

- [ ] gates зелёные (включая server-каскад); aiRoutes/routeMounting без правок зелёные
- [ ] 7 файлов handlers + фасад; все ≤400 строк
- [ ] developer_log дописан

## Эскалация: неоднозначность → к архитектору; 2 провала gate → к человеку
