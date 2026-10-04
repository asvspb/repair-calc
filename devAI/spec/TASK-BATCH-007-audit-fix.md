# TASK-BATCH-007-audit-fix

**Назначено:** coder **Подветка:** fix/audit-007 **База:** main **Статус:** ⬜

## Цель

`pnpm audit` (root и server) — 0 high/moderate или каждая непочиненная уязвимость объяснена (no-fix/ breaking). Gates зелёные.

## Алгоритм

1. `pnpm audit` в root и `server/` — зафиксировать список в developer_log.
2. `pnpm audit fix`; на оставшиеся — `pnpm audit fix --prod`? нет: оценивать по одному: если фикс мажорный (breaking) — не ставить, записать в отчёт с обоснованием.
3. Прогнать gates; если зависимость сломала тесты — откатить этот пакет и записать в отчёт.
4. Если фиксируются transitive-пакеты через overrides — использовать `pnpm.overrides` в package.json (аккуратно, минимально).

## Write (ЭКСКЛЮЗИВНО)

package.json, pnpm-lock.yaml, server/package.json, server/pnpm-lock.yaml, devAI/developer_log.md, docs/TODO.md (обновить P1-3).

## Запреты

Не апгрейдить мажорные версии фреймворков (express/vite/react). Никаких `--force`.

## DoD

- [ ] audit: 0 unfixable-high или построчное обоснование; gates зелёные; лог дописан.
