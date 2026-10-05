# TASK-BATCH-030-facade-cleanup

**Назначено:** coder **Подветка:** refactor/facade-cleanup-030 **База:** main **Статус:** ⬜

## Цель

`@deprecated`-фасады R1/R4 удалены; все потребители переведены на целевые пути (shared/utils, features/*); depcruise-легаси-allowlist сокращён до реально оставшегося.

## Алгоритм

1. Инвентаризация: grep по `src/components/**`, `src/hooks/**`, `src/api/**` — файлы-фасады (re-export + @deprecated).
2. Для каждого: grep потребителей (src/ + tests/ + e2e/) → перевести импорты (и vi.mock-пути!) на целевые пути → удалить фасад. Отдельный коммит на фасад/группу.
3. НЕ удалять фасады, у которых потребитель — barrel/внешняя точка, не поддающаяся тривиальной правке: зафиксировать в notes.
4. После каждой группы — pnpm run lint:deps; в финале — пересмотреть легаси-allowlist depcruise (пути, ставшие пустыми, убрать).
5. Если src/components|hooks|api опустели целиком — удалить пустые каталоги, INDEX.md обновить.

## Запреты

Поведение не меняется; ассерты не трогаются; новые файлы не создаются (кроме tests-правок).

## DoD

- [ ] Фасады удалены (или обоснованы в notes); allowlist сокращён; gates зелёные; INDEX/developer_log обновлены.

# TASK-BATCH-031-roomeditor-split

**Назначено:** coder **Подветка:** refactor/roomeditor-split-031 **База:** refactor/facade-cleanup-030 **Статус:** ⬜

## Цель

Импорты `features/rooms → features/works` устранены; исключения `pathNot: ^src/features/rooms` в правилах fsd-works/fsd-features удалены (правила стали строгими); e2e зелёные.

## Алгоритм (FSD-паттерн: композиция вверх)

1. Прочитай RoomEditor (src/features/rooms/ui/RoomEditor.tsx) — works-UI (WorkList, WorkCard, пикеры, useWorkTemplates).
2. Разбить: RoomEditor отвечает только за комнату/геометрию; works-часть — отдельный компонент в features/works, который RoomEditor НЕ импортирует. Связь — через слот: родитель (app-слой или компонент rooms-домена без works-импортов) рендерит `<RoomEditor ... slot={...}>` / children, либо works-панель монтируется рядом на уровне композиции (ContentArea/app). Выбор паттерна — по фактической связанности данных (если works-панель должна читать roomId — прокинуть через props/колбэк, не через импорт).
3. Убрать оба `pathNot: '^src/features/rooms'` исключения из .dependency-cruiser.cjs — правила теперь error без лазеек.
4. Проверить: grep 'features/works' в src/features/rooms/ → 0.
5. Компонентные тесты RoomEditor обновить (ассерты поведения не ослаблять; слот — новыми кейсами).

## DoD

- [ ] depcruise: правила fsd-features-no-cross-imports/fsd-works без исключений, 0 violations; e2e chromium зелёный (сам прогнал); gates зелёные.

# TASK-BATCH-032-sync-split

**Назначено:** coder **Подветка:** refactor/sync-split-032 **База:** refactor/roomeditor-split-031 **Статус:** ⬜

## Цель (P3-SPLIT-2)

`server/src/routes/sync.ts` ≤400 строк: вынести LWW/push-логику (lwwCompare + обработка push) в `server/src/services/sync-v2.service.ts`; роут — тонкая обвязка (валидация → сервис → ответ). Контракты HTTP не меняются; интеграционные тесты (14 кейсов LWW-матрицы) остаются зелёными БЕЗ правок ассертов — это критерий честности распила.

## DoD

- [ ] sync.ts ≤400; сервис ≤400; тесты без изменений ассертов зелёные; задача P3-SPLIT-2 в docs/TODO.md закрыта; gates зелёные.

# TASK-BATCH-033-contexts-to-zustand

**Назначено:** coder **Подветка:** refactor/contexts-zustand-033 **База:** refactor/sync-split-032 **Статус:** ⬜

## Цель

Легаси-контексты AuthContext и WorkTemplateContext заменены zustand-слайсами; контексты и их фасады удалены; AGENTS.md §7 «легаси-контексты» — актуализирован (больше не «не наращивать», а «удалены»).

## Алгоритм

1. Изучить src/features/auth/model/AuthContext.tsx и src/features/works/model/WorkTemplateContext.tsx + их потребителей (grep). Сверить с существующим src/store/createAuthSlice.ts (если уже покрывает — переиспользовать).
2. Слайс/стор: состояние+экшены контекста переносятся в zustand (createAuthSlice доработать / createWorkTemplateSlice создать); провайдеры из App.tsx убрать.
3. Потребителей (вкл. тесты с vi.mock и renderWithProviders-хелперы) перевести на store; тесты контекстов — переписать на стор (ассерты поведения сохранить).
4. Особая осторожность с AuthContext: persist-токенов/сессии не должен измениться (границы гостя!); проверить existing-тесты гостя.
5. Удалить контексты + фасады + записи в INDEX.md/AGENTS.md.

## Запреты

Сетевые вызовы/формат persist/границы гостя — без изменений; расхождение → notes.

## DoD

- [ ] grep AuthContext|WorkTemplateContext в src/ = 0; тесты гостя/авторизации зелёные; gates зелёные; лог/INDEX/AGENTS обновлены.
