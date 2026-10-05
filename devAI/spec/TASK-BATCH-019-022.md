# TASK-BATCH-019-sync-a (dirty-флаги)

**Назначлено:** coder **Подветка:** feat/sync-v2-a-019 **База:** main **Статус:** ⬜

## Цель

Раздел §5(а) спеки `devAI/spec/SPEC-SYNC-V2.md` (v1.1, УТВЕРЖДЕНА) — спека является
исчерпывающим ТЗ; обязательные к исполнению решения: §6.1 (пп. 1,2,5,6,7).

**Write-set, DoD, запреты** — строго по §5(а) спеки. Дополнительно: коммиты атомарные,
Conventional, трейлер «Co-Authored-By: GLM-5.3-Flash»; gates в корне; INDEX/developer_log
по регламенту; расхождение со спекой → notes, не молча.

## DoD (кратко; полнота — в спеке)

- [ ] Мутации project/object/room ставят dirty+updatedAt; переживают reload; гость без сети; поведение без изменений; gates зелёные.

# TASK-BATCH-020-sync-b (флашер)

**Назначлено:** coder **Подветка:** feat/sync-v2-b-020 **База:** feat/sync-v2-a-019 **Статус:** ⬜

## Цель

Раздел §5(б) спеки. Флашер рядом с apiClient.ts, переиспользует RequestQueue; триггеры §2.3;
решения §6.1 пп. 5,6 (гость — через saveAllProjects, итоги — отдельный контур).

**Write-set/DoD** — §5(б). Ключевое: под флагом не активен; оффлайн-сценарий покрыт тестом.

# TASK-BATCH-021-sync-c (LWW + сервер)

**Назначено:** coder **Подветка:** feat/sync-v2-c-021 **База:** feat/sync-v2-b-020 **Статус:** ⬜

## Цель

Раздел §5(в) спеки. Решения §6.1 пп. 1,2,3 (tie-break по id; расширяем существующий
/api/sync/push по §3.4; без нового роута), п.4 (без tombstones), п.8 (rate-limiter не трогаем).

**Write-set/DoD** — §5(в). Матрица конфликтов unit-тестами; обратная совместимость
(клиент без since получает полный pull).

# TASK-BATCH-022-r3-server-splits

**Назначено:** coder **Подветка:** refactor/server-splits-022 **База:** feat/sync-v2-c-021 **Статус:** ⬜

## Цель (ROADMAP R3, пере-скоуп по факту: update.ts уже распилен ранее)

Все перечисленные файлы ≤400 строк, публичные контракты (экспорты/роуты/SQL) не изменены.

## Файлы (по убыванию размера)

1. `server/src/db/repositories/updateJob.repo.ts` (811) → jobQueries/jobWrites/jobCleanup по внутренней связности.
2. `server/src/db/repositories/room.repo.ts` (777) → roomRead/roomWrite/roomWorks.
3. `server/src/routes/update/ab-test.routes.ts` (716) → вынести обработчики в ab-test.controller + схемы (контракт HTTP не меняется).
4. `server/src/services/update/parserManager.ts` (662) → парсеры-стратегии уже в parsers/ — вынести реестр/оркестрацию.
5. `server/src/services/update/runner.ts` (647) → шаги runner'а в отдельные модули.
6. `server/src/db/repositories/abTest.repo.ts` (640) → read/write части.
7. `server/src/routes/geometry.ts` (636) → контроллер + схемы.

## Правила

- Re-export фасады из прежних путей — импортёры не правятся.
- Каждый файл — отдельный коммит + pnpm run lint:deps после каждого.
- Интеграционные тесты существующие НЕ ослаблять; если на модуль нет тестов и он рискованный — добавить минимальный smoke ДО распила (как в batch-012).

## Write (ЭКСКЛЮЗИВНО)

Перечисленные файлы + новые модули рядом, server/tests/** (только добавление), INDEX.md, devAI/developer_log.md.

## DoD

- [ ] wc -l всех перечисленных ≤400 (или обоснование в notes, почему распил вреден); gates зелёные.

# TASK-BATCH-023-sync-d (переключение под флаг)

**Назначено:** coder **Подветка:** feat/sync-v2-d-023 **База:** main **Статус:** ⬜

## Цель

Раздел §5(г) спеки SPEC-SYNC-V2 (v1.1): `VITE_SYNC_V2=true` — весь жизненный цикл
(init pull → мутации → flush → конфликт) идёт через V2; без флага — побайтово прежнее
поведение; откат-план §4 проверен переключением флага.

**Write-set/DoD** — строго по §5(г) спеки: src/store/projectInitialize.ts (развилка),
фабрика провайдера src/api/storage/index.ts, env-примеры (.env.example, docker-compose.yml
— по фактическому списку env-файлов), e2e/, INDEX.md, docs/ARCHITECTURE.md §6, developer_log.md.

## Дополнения к спеке

- e2e: минимальный sync-сценарий V2 (мутация → flush → повторный init без потерь) отдельным
  спеком с env VITE_SYNC_V2=true; базовый набор — в старом режиме; оба зелёные.
- VITE_SYNC_V2 в прод-конфигах НЕ включать (проверка владельцем на dev — отдельно).
- Gates + pnpm exec playwright test (chromium) в обоих режимах — сам, итог в лог.

## DoD

- [ ] Оба режима e2e зелёные; откат переключением флага продемонстрирован; gates зелёные.
