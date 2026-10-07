# TASK-BATCH-016-orchestrator-rework

> ⚠️ Историческая спека. Роль «оркестратор» (L1.5) отменена владельцем 2026-10-07 — см. developer_log; текущая система ролей без неё (prompts/README.md).

**Назначено:** coder (доки/промпты) **Подветка:** docs/orchestrator-rework-016 **База:** main **Статус:** ⬜

## Цель

Роль «Оркестратор субагентов» доработана по замечаниям рецензента, зарегистрирована в системе ролей и закоммичена в репо (решение владельца: доработать и оставить).

## Замечания к устранению (из ревью 2026-10-03)

1. Конфликт с архитектором: оркестратор НЕ мержит, НЕ ревьюит по §4 (это L1-архитектор), НЕ выдаёт ТЗ (only dispatch+запуск+повторный прогон gates). Явно разделить: архитектор = ТЗ/ревью/merge; оркестратор = диспетчер запусков и оператор верификации «перезапусти сам».
2. Регистрация: реестр ролей в `prompts/README.md` (уровень L1.5), упоминание в `prompts/techlead-architect.md` §0 (архитектор может делегировать диспетчеризацию), SSOT-блок как у других ролей (код > AGENTS.md > промпт; реестр дрейфов docs/README.md; pnpm-среда).
3. Инструменты: описать фактический стек запуска (динамические воркфлоу/ZCode-агенты), запреты git-safety — общие.
4. Убрать дубль верификации: «проверка по факту» оркестратора = перезапуск gates + сверка diff ⊆ write-set; ревью качества кода — только архитектор.

## Read

prompts/orchestrator.md (в /tmp/repair-calc-parked/orchestrator.md — вернуть в рабочее дерево командой cp), prompts/README.md, prompts/techlead-architect.md, prompts/coder.md (стиль SSOT-блока)

## Write (ЭКСКЛЮЗИВНО)

prompts/orchestrator.md (из паркинга в репо, доработанный), prompts/README.md (реестр), prompts/techlead-architect.md (только строка про делегирование диспетчеризации), devAI/developer_log.md

## DoD

- [ ] Роль зарегистрирована, конфликты с L1 сняты (формулировки НЕ дают оркестратору merge/ревью/ТЗ); gates зелёные; лог дописан

# TASK-BATCH-017-fsd-r1

**Назначено:** coder **Подветка:** refactor/fsd-r1-017 **База:** docs/orchestrator-rework-016 **Статус:** ⬜

## Цель (ROADMAP R1)

Каркас 3-слойки + depcruise-правила в мягком режиме + первый механический переезд чистых утилит в shared/. Поведение приложения не меняется.

## Алгоритм

1. depcruise-конфиг: добавить правила `src/app/** → ниже только features/shared`, `src/features/** → ниже только shared`, features↔features запрещено; легаси-пути (src/components, src/hooks, src/contexts, src/api, src/utils) — во временный allowlist с комментарием «R4».
2. Каркас: src/app/README.md, src/features/<auth,projects,objects,rooms,works,summary,archive>/README.md (по строке-указателю «переезд в R4»).
3. Переезд в shared/ ТОЛЬКО чистых утилит 0 доменных зависимостей (проверить depcruise/dependency-graph): кандидаты — format, logger, storageConstants, idMapper, migration (если чистый); в src/utils остаются re-export-фасады для легаси-импортов. НЕ трогать: geometry/costs/materialCalculations (связаны с доменами — R4).
4. Каждый переезд — отдельный коммит; после каждого — pnpm run lint:deps.

## Write (ЭКСКЛЮЗИВНО)

.dependency-cruiser.cjs (или актуальный конфиг — найди), src/app/**, src/features/** (README), src/utils/**, shared/**, импортёры переехавших утилит (механическая замена импортов), INDEX.md, devAI/developer_log.md, docs/ARCHITECTURE.md (раздел «Переезд FSD» с фактом R1)

## Запреты

НЕ менять поведение; НЕ переезжать доменные модули; allowlist только с пометкой R4.

## DoD

- [ ] depcruise green с новыми правилами; переезды утилит — пофайлово закоммичены; gates зелёные

# TASK-BATCH-018-sync-v2-spec

**Назначено:** analyst **Подветка:** docs/sync-v2-spec-018 **База:** refactor/fsd-r1-017 **Статус:** ⬜

## Цель (ROADMAP R2, только документ)

Спецификация SYNC-V2 (dirty-flag + Last-Writer-Wins) в devAI/spec/SPEC-SYNC-V2.md — уровня «можно нарезать batch'и», БЕЗ единой строки кода. Спека идёт владельцу на утверждение ДО имплементации.

## Обязательные разделы спеки

1. Текущий sync (факты из кода: apiStorageProvider/apiClient, инкрементальный pull, очереди, rate-limit — со ссылками на файлы/строки).
2. Модель: dirty-флаги на сущность (где живут в слайсах, persist-формат в IndexedDB, граница «гостя»), исходящая очередь (дедуп, порядок, батчинг), flush-триггеры (online/интервал/действие).
3. LWW: поле сравнения (updated_at серверное vs клиентское), tie-break, что происходит при 409/удалённой на сервере сущности, гарантии для гостя.
4. Миграция: переход с текущего pull-всего, feature-flag SYNC_V2, откат-план.
5. Разрез на 4 batch'а имплементации (а-г из ROADMAP R2) с write-set'ами и DoD каждого.
6. Риски и открытые вопросы владельцу (списком).

## Read

src/api/storage/**, src/store/** (createSyncSlice), docs/IDEAL-ARCHITECTURE.md §offline-first, docs/ARCHITECTURE.md

## Write (ЭКСКЛЮЗИВНО)

devAI/spec/SPEC-SYNC-V2.md, devAI/developer_log.md

## DoD

- [ ] Спека самодостаточна (читатель без кода понимает модель), факты сверены с кодом (ссылки на строки), gates зелёные
