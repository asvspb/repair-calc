# TASK-BATCH-038-split-use-geometry-state

**Назначено:** coder **Подветка:** общая ветка refactor/monolith-splits-b1 (отдельный коммит)
**Зависит от:** TASK-BATCH-037 (использует его фасад) **Статус:** ✅

## Цель (проверяемая)

`src/features/rooms/model/useGeometryState.ts` (748 строк) распилен: interface
`UseGeometryStateReturn` → тип-модуль; доменные handler-хуки → отдельные файлы;
главный хук — композитор ≤200 строк. Публичный API (имя хука, сигнатура, набор
возвращаемых полей) идентичен. Импортер (`RoomEditor.tsx`) не меняется.

## Read / Write (write — ЭКСКЛЮЗИВНО)

**Read:** `src/features/rooms/model/useGeometryState.ts`, PLAN-monolith-splits-b1.md.

**Write (новые, в `src/features/rooms/model/geometry/`):**

- `types.ts` — UseGeometryStateReturn (перенос интерфейса как есть)
- `useWindowDoorHandlers.ts` — add/remove/update Window|Door + updateSimpleField
- `useSubSectionHandlers.ts` — все SubSection-хендлеры
- `useAdvancedHandlers.ts` — Segment/Obstacle/WallSection-хендлеры
- `src/features/rooms/model/useGeometryState.ts` — композитор: UI-collapse state,
  handleGeometryModeChange, вызов трёх хуков, сборка возвращаемого объекта

## Алгоритм (псевдокод)

```
Каждый доменный хук: (roomId, updateRoom, updateRoomById) => { handler'ы }
  тела useCallback переносятся байт-в-байт (deps-массивы не менять!);
  generateId/roomHelpers импортируются из тех же мест, что и раньше.
Главный хук: сохраняет useState-блок и handleGeometryModeChange как есть,
деструктурирует три доменных хука, возвращает тот же объект в том же порядке.
```

**Edge-кейсы (React):** stale closures — deps каждого перенесённого useCallback
копируются точно; ensure порядок полей возвращаемого объекта неизменен (для
консьюмеров, деструктурирующих по позиции — их нет, но порядок сохраняем);
cleanup/AbortController здесь нет — не добавлять.

**Логирование:** не требуется.

## Запреты

- НЕ менять логику хендлеров, deps, порядок полей; НЕ менять RoomEditor.tsx;
- НЕ выносить UI-collapse state в доменные хуки; новых зависимостей нет.

## DoD

- [ ] gates зелёные; RoomEditor работает (типы совпадают — tsc это докажет)
- [ ] главный файл ≤200 строк, новые ≤400
- [ ] developer_log дописан

## Эскалация: неоднозначность → к архитектору; 2 провала gate → к человеку
