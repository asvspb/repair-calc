# TASK-BATCH-005-spec-leftovers (нереализованные требования ТЗ v1.1)

**Назначено:** coder **Подветка:** feat/spec-leftovers-batch-005
**Зависит от:** нет **Статус:** ⬜

## Цель (проверяемая)

Реализованы два требования ТЗ v1.1, помеченные как нереализованные: (1) job очистки
мягко-удалённых сущностей (`deleted_entities`); (2) middleware депрекейшна. Оба покрыты
тестами, gates зелёные, запись реестра дрейфов docs/README.md закрыта.

## Требование 1 — job очистки deleted_entities

По ТЗ §15.2.0 (см. docs/TECHNICAL-SPECIFICATION.md): периодическая очистка мягко-удалённых
проектов/объектов/комнат старше retention-периода (постоянное удаление из БД).

- Планировщик — `cron` (не node-schedule), запуск внутри `server/worker.js` (существующий
  фоновый воркер — прочитай его и follows его стилю) или отдельного модуля, если воркер
  не подходит.
- Retention — из env `ARCHIVE_RETENTION_DAYS` (default 90), документировать в `.env.example`.
- Логика: найти проекты с `deleted_at < now - retention` И статусом «в архиве» →
  hard-delete через существующий `ProjectRepository.hardDelete` (не дублировать SQL);
  никаких новых raw-Knex вне repositories.
- Окно запуска: раз в сутки; на старте — однократный прогон (лог «cleaned N projects»).
- Edge: пустой результат, БД недоступна (ошибка логируется, job не роняет процесс),
  гонка с параллельным restore (hardDelete уже гейтит «только архив»).

## Требование 2 — middleware депрекейшна

По ТЗ §15.3.2: `server/src/middleware/deprecation.ts` — пометка устаревших эндпоинтов.

- Экспорт `deprecate(headerName: string, sunset?: string)` — middleware, ставящий
  заголовки `Deprecation: true|@timestamp` (HTTP RFC 8594, версия="true" пока без даты)
  и `Sunset` (если передан), плюс winston-лог (warn, 1 раз на маршрут, не на запрос —
  простейший Set уже отлогированных).
- Применить на ДЕЙСТВИТЕЛЬНО устаревшем маршруте: найди grep'ом маршрут, помеченный
  устаревшим в коде/доках (например, заменённые PUT /:id/with-rooms vs новых); если
  такового нет — НЕ вешать ни на один прод-маршрут, только экспорт + тесты (регистрация
  реального депрекейта — отдельное решение архитектора; зафиксируй это в отчёте).

## Read

- `docs/TECHNICAL-SPECIFICATION.md` (§15.2.0, §15.3.2 — блок «Состояние реализации»)
- `server/worker.js`, `server/src/db/repositories/project.repo.ts` (hardDelete)
- `server/src/middleware/` (образцы middleware + logger.ts), `server/index.js` (монтирование)

## Write (ЭКСКЛЮЗИВНО)

- `server/worker.js` ИЛИ новый `server/src/jobs/cleanupDeleted.ts` (+ точка подключения в worker.js)
- `server/src/middleware/deprecation.ts` (новый)
- `.env.example` (retention-переменная)
- `server/tests/` — юнит/интеграционные тесты обоих
- `docs/README.md` (закрыть запись «нереализованные требования ТЗ»), `devAI/developer_log.md`, `INDEX.md` (при новых файлах)

## Запреты

- Никаких новых raw-Knex вне `server/src/db/repositories/`.
- Никаких `as any`/`@ts-ignore`/пустых catch; логи — winston, без PII.
- Не трогать маршруты/контракты существующих API.

## DoD

- [ ] pnpm test / lint / lint:deps зелёные (сам перезапустил)
- [ ] Тесты: cleanup (retention-фильтр, пусто, ошибка БД), deprecation (заголовки, лог 1 раз)
- [ ] docs/README.md: дрейф закрыт; лог дописан
- [ ] Секретов нет

## Эскалация

Неоднозначность → архитектору; 2 провала gate → человеку.
