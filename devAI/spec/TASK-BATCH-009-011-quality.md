# TASK-BATCH-009-dead-code

**Назначено:** coder **Подветка:** fix/dead-code-009 **База:** fix/infra-008 **Статус:** ⬜

## Цель (P3-2)

Удалён мёртвый код, 0 ссылок после удаления, gates зелёные.

## Алгоритм

1. `src/hooks/useProjects.ts` — grep по src/ на импорты; если 0 — удалить. Если импорты есть — НЕ удалять, записать в отчёт (кто импортирует).
2. `src/utils/projectContextPatch.ts` — аналогично (заменён utils/projectObjects.ts).
3. Перепроверить grep'ом каждый перед удалением (TODO-список мог устареть).

## Write (ЭКСКЛЮЗИВНО)

src/hooks/useProjects.ts, src/utils/projectContextPatch.ts (удаление), возможные правки точек импорта (если внезапно найдутся), INDEX.md, devAI/developer_log.md, docs/TODO.md (закрыть P3-2 пункты).

## DoD

- [ ] Оба файла удалены ИЛИ обоснованно оставлены; grep-доказательства в логе; gates зелёные.

# TASK-BATCH-010-typing

**Назначено:** coder **Подветка:** fix/typing-010 **База:** fix/dead-code-009 **Статус:** ⬜

## Цель (P3-3)

`as any` warnings в lint сокращены до минимума (цель: 0 в server/src/routes/update/ и priceHistory.repo.ts); единый generateId; единые STORAGE_KEYS.

## Алгоритм

1. `pnpm run lint 2>&1 | grep "no-explicit-any"` — фактический список; чинить типами (Zod-infer, generics), НЕ дублирующими интерфейсами ради галочки; где тип восстановить за разумное время нельзя — оставить + записать в отчёт почему.
2. `src/utils/factories.ts`: единый `generateId(prefix)`; заменить дублирующие uuid-обёртки по src/ (grep'ом найти).
3. STORAGE_KEYS-константы для localStorage-ключей (найти все `localStorage.` и вынести ключи; БЕЗ смены значений ключей — риск потери данных пользователей).

## Write (ЭКСКЛЮЗИВНО)

server/src/routes/update/\*.ts, server/src/db/repositories/priceHistory.repo.ts, src/utils/factories.ts, точки вызовов uuid-обёрток и localStorage-ключей в src/, INDEX.md, devAI/developer_log.md, docs/TODO.md.

## Запреты

Значения localStorage-ключей НЕ менять (миграция данных — отдельная задача, если нужна — отметь в отчёте).

## DoD

- [ ] lint: 0 errors, no-explicit-any warnings сокращены (число до/после в логе); gates зелёные.

# TASK-BATCH-011-hygiene

**Назначено:** coder **Подветка:** fix/hygiene-011 **База:** fix/typing-010 **Статус:** ⬜

## Цель (P2-4)

Версии root/server выровнены (2.0.0/2.0.0); серверный lint покрывает tests/; AUDIT-2026-06-21 §4.E (prefer-const в createSyncSlice) закрыт или подтверждён устранённым.

## Алгоритм

1. server/package.json version → 2.0.0.
2. server/package.json scripts.lint → `eslint src/ tests/`; прогнать — если в tests/ накопились нарушения линта, ЧИНИТЬ только автоматические (eslint --fix) и тривиальные; нетривиальные — записать в отчёт, НЕ отключать правила.
3. grep prefer-const нарушение в src/store/createSyncSlice.ts — если есть, исправить.

## Write (ЭКСКЛЮЗИВНО)

server/package.json, server/tests/\*\* (только --fix правки), src/store/createSyncSlice.ts, devAI/developer_log.md, docs/TODO.md.

## DoD

- [ ] pnpm run lint гоняет и tests/ без errors; gates зелёные; лог дописан.
