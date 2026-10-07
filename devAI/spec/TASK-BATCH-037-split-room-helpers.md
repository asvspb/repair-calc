# TASK-BATCH-037-split-room-helpers

**Назначено:** coder **Подветка:** общая ветка refactor/monolith-splits-b1 (отдельный коммит)
**Зависит от:** нет **Статус:** ⬜

## Цель (проверяемая)

`src/domain/geometry/roomHelpers.ts` (765 строк) распилен в каталог
`src/domain/geometry/roomHelpers/`; исходный путь — фасад. Тест
`tests/domain/geometry/roomHelpers.test.ts` зелёный БЕЗ правок.

## Read / Write (write — ЭКСКЛЮЗИВНО)

**Read:** `src/domain/geometry/roomHelpers.ts`, PLAN-monolith-splits-b1.md.

**Write (новые):**

- `src/domain/geometry/roomHelpers/arrayUtils.ts` — updateRoomField, syncModeData (приватная — экспортировать как internal), updateSimpleField, updateArrayItem, addArrayItem, removeArrayItem
- `.../windowsDoors.ts` — addWindow/removeWindow/updateWindow/addDoor/removeDoor/updateDoor (+ приватный updateSubSectionArray — если используется только subsection-функциями, оставить в subSections.ts)
- `.../subSections.ts` — createSubSection, add/remove/updateSubSection, add/remove/updateSubSectionWindow|Door
- `.../segments.ts` — createSegment, add/remove/updateSegment
- `.../obstacles.ts` — createObstacle, add/remove/updateObstacle
- `.../wallSections.ts` — createWallSection, add/remove/updateWallSection
- `.../switchMode.ts` — switchGeometryMode
- `src/domain/geometry/roomHelpers.ts` — фасад: полный re-export прежнего публичного API

## Алгоритм (псевдокод)

Перенос функций байт-в-байт с их doc-комментариями; приватные хелперы
(syncModeData, updateSubSectionArray) экспортируются из своих модулей под именем
с префиксом без изменений и НЕ переэкспортируются фасадом (были приватны —
остаться недоступными снаружи). Фасад re-export'ирует только то, что было
экспортировано исходно, в том же наборе имён.

**Edge-кейсы:** циклические импорты между новыми модулями (например, subSections
использует windows-приваты) → допустим однонаправленный импорт internal-функций;
если возникает цикл — вынести общий приват в arrayUtils.

**Логирование:** не требуется.

## Запреты

- НЕ менять сигнатуры/логику; НЕ менять импортеры и тесты; НЕ создавать файлов >400 строк.

## DoD

- [ ] gates зелёные; roomHelpers.test.ts без правок зелёный
- [ ] набор экспортов фасада идентичен исходному (сверь по git show main:...roomHelpers.ts | grep export)
- [ ] developer_log дописан

## Эскалация: неоднозначность → к архитектору; 2 провала gate → к человеку
