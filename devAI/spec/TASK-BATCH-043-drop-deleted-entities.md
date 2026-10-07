# TASK-BATCH-043-drop-deleted-entities

**Назначено:** coder **Подветка:** fix/tz-trace-042 (тот же batch-цикл, отдельный коммит; запускать ПОСЛЕ 042)
**Зависит от:** TASK-BATCH-042 **Статус:** ✅

## Цель (проверяемая)

Мёртвая таблица `deleted_entities` (записей не пишет/читает никто — доказано
трассировкой) удаляется миграцией; схема удаления финально = `deleted_at` +
cleanup-джоба. Gates зелёные, миграция применяется к dev-БД без ошибок.

## Read / Write (write — ЭКСКЛЮЗИВНО)

**Read:** `server/src/db/migrations/20260331_add_objects.ts` (как создавалась таблица),
`server/src/db/migrations/` (номерная конвенция), `server/src/jobs/cleanupDeleted.ts`.

**Write:**

- `server/src/db/migrations/<свежий номер>_drop_deleted_entities.ts` (новый)
- `server/tests/integration/migrations.test.ts` (дополнить: таблицы нет после миграций)
- `docs/ARCHITECTURE.md` (короткая правка в разделе о модели данных: удаление = soft-delete + retention-джоба; deleted_entities удалена как нереализованная идея ТЗ v1.1)

## Алгоритм (псевдокод)

```
миграция: export async up(knex) { await knex.schema.dropTableIfExists('deleted_entities') }
  down: воссоздать таблицу по определению из 20260331_add_objects.ts (для отката)
  // BREAKING-INTENT не нужен: данных нет (таблица никогда не заполнялась),
  // но упомяни удаление в developer_log
```

**Edge-кейсы:** прод-БД — таблица может содержать мусорные строки, никогда не
читавшиеся: drop безопасен; foreign keys из других таблиц на неё — проверить
grep'ом миграций (ожидается: нет).

**Логирование:** не требуется (миграция).

## Запреты

- НЕ трогать cleanupDeleted.ts и retention-логику; НЕ менять другие таблицы.

## DoD

- [ ] gates зелёные; миграция применена к локальной dev-БД (`cd server && pnpm run migrate`) — приложи вывод
- [ ] REQUIREMENTS-TRACE: пункт 1 → «закрыто»; developer_log дописан

## Эскалация: неоднозначность → к архитектору; 2 провала gate → к человеку
