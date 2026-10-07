# TASK-BATCH-042-tz-trivial-fixes

**Назначено:** coder **Подветка:** fix/tz-trace-042 (от main)
**Зависит от:** нет **Статус:** ⬜

## Цель (проверяемая)

Четыре тривиальные доработки из трассировки ТЗ v1.1 (решения №4, 9, 10, 11):
все gates зелёные, каждый пункт покрыт тестом.

## Read / Write (write — ЭКСКЛЮЗИВНО)

**Read:** `server/src/routes/users.ts`, `server/src/routes/objects.ts`,
`server/src/routes/sync/sync-v2.service.ts` (или где живёт ChangeLogEntry — см. grep),
`server/src/middleware/validation.ts`, devAI/spec/REQUIREMENTS-TRACE-v1.1.md (пункты 4/9/10/11).

**Write:**

- `server/src/routes/users.ts` — is_premium/premium_expires_at из БД (user-запись), не хардкод
- `server/src/schemas/` или `server/src/middleware/validation.ts` — Zod-схема createObjectSchema/updateObjectSchema (name обязателен, string, ≤200; city/address/use_ai_pricing опциональны с типами как в текущей деструктуризации)
- `server/src/routes/objects.ts` — POST/PUT объектов валидируются Zod (схемы из предыдущего пункта; формат ошибок — как у остальных Zod-валидируемых маршрутов)
- тип ChangeLogEntry: добавить 'object' в union (общий тип, вероятно shared/ или server/src/types) + убрать `as string` в sync-v2.service.ts:~74, заменив корректной обработкой кейса object
- тесты: `server/tests/` — is_premium из БД; Zod-ошибки POST/PUT объектов (400 с телом ошибки); лимит 10 объектов (409/400 — какой статус сейчас выдаётся при превышении, тот и тестировать); ChangeLogEntry-object кейс

## Алгоритм (псевдокод)

```
users.ts: responseData.is_premium = Boolean(user.is_premium);
  premium_expires_at = user.premium_expires_at ?? null (проверь фактические поля БД
  в миграции users; если колонок нет — НЕ добавлять миграцию, вернуть как есть из записи)
objects.ts: req.body → schema.parse / validate-хелпером проекта; провал → 400
  той же формой ответа, что используют другие Zod-маршруты (найди образец)
ChangeLogEntry: union + ветка object: существующее поведение для 'object' сохранить
  (сейчас as string скастывает — замени на явную ветку с тем же результатом)
```

**Edge-кейсы:** обратная совместимость /users/me (клиент читает is_premium?);
Zod не должен стать строже текущей деструктуризации (опциональные поля остаются опциональными);
существующие e2e/интеграционные тесты объектов не должны сломаться.

**Логирование:** существующее; при 400 Zod — как в других маршрутах.

## Запреты

- НЕ добавлять миграции БД; НЕ менять статусы ошибок; НЕ трогать другие маршруты;
- НЕ реализовывать премиум-логику (только честное чтение поля).

## DoD

- [ ] gates зелёные; новые тесты зелёные
- [ ] developer_log дописан; REQUIREMENTS-TRACE: пункты 4/9/10/11 → «доработано»

## Эскалация: неоднозначность → к архитектору; 2 провала gate → к человеку
