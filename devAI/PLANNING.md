# Planning - Repair Calculator (Fix Room Renaming Sync in Left Sidebar)

## 1. Проблема и контекст

При переименовании комнаты в центральном редакторе (`RoomHeader` -> `RoomEditor`) название меняется в заголовках по центру (`AppHeader`), но остаётся старым в левом сайдбаре (`LeftSidebar`).

**Причина:**
В `src/store/createRoomSlice.ts` методы `updateRoom` и `updateRoomById` обновляют в Zustand-сторе только `projects` и `activeProject`, но не пересчитывают `activeObject`. Левый сайдбар (`LeftSidebar`) читает список комнат через пропс `rooms={activeObject?.rooms || []}` в `src/App.tsx`, из-за чего продолжает отображать устаревшую ссылку на объект до переключения или перезагрузки.

---

## 2. ТЗ на реализацию

### Файлы для изменения

- `src/store/createRoomSlice.ts`
- `tests/hooks/domains/useRoomDomain.test.ts`

### Алгоритм изменений

1. **`src/store/createRoomSlice.ts`:**
   - Импортировать `getObjectFromProject` из `../utils/projectObjects`.
   - В функциях `updateRoom` и `updateRoomById` внутри коллбэка `set(state => ...)` вычислять `activeObject`:
     ```ts
     const activeObject =
       activeProject && state.activeObjectId
         ? getObjectFromProject(activeProject, state.activeObjectId)
         : activeProject?.objects?.[0] || null;
     ```
   - Возвращать `{ projects: newProjects, activeProject, activeObject }`.

2. **`tests/hooks/domains/useRoomDomain.test.ts`:**
   - В тестах `describe('updateRoom', ...)` и `describe('updateRoomById', ...)` добавить проверки синхронизации `state.activeObject`:
     ```ts
     expect(state.activeObject?.rooms.find(r => r.id === 'room-1')?.name).toBe('Updated Room');
     ```
   - Добавить тест-кейс с явно заданным `activeObjectId`.

---

## 3. Граничные случаи & Защита

- При наличии нескольких объектов (`objects.length > 1`) и установленном `activeObjectId` комната должна корректно обновляться именно в активном объекте.
- Если `activeObjectId === null`, берется fallback на первый объект (`activeProject?.objects?.[0] || null`).
- Иммутабельность ссылок: обновлённый `activeObject` формируется из `activeProject`, без прямых мутаций существующих структур.

---

## 4. Definition of Done (DoD)

- [ ] При редактировании названия комнаты в поле ввода `RoomHeader` имя мгновенно обновляется в левом меню (`LeftSidebar`).
- [ ] `updateRoom` и `updateRoomById` в `src/store/createRoomSlice.ts` возвращают актуальный `activeObject`.
- [ ] Все тесты в `tests/hooks/domains/useRoomDomain.test.ts` проходят успешно (включая проверку `state.activeObject`).
- [ ] `npm test` — все тесты зелёные.
- [ ] `npm run lint` — 0 ошибок линтинга и типов.
- [ ] `npm run lint:deps` — 0 нарушений архитектуры зависимостей (`dependency-cruiser`).
