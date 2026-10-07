# TASK-BATCH-039-split-initial-data

**Назначено:** coder **Подветка:** общая ветка refactor/monolith-splits-b1 (отдельный коммит)
**Зависит от:** TASK-BATCH-036 (использует его фасад) **Статус:** ⬜

## Цель (проверяемая)

`src/data/initialData.ts` (636 строк) распилен: фабрики → `src/data/demo/factories.ts`,
демо-комнаты по объектам → отдельные файлы; исходный путь — фасад, экспортирующий
`initialProjects`/`initialRooms` идентично. Импортер (`src/App.tsx`) не меняется.

## Read / Write (write — ЭКСКЛЮЗИВНО)

**Read:** `src/data/initialData.ts`, PLAN-monolith-splits-b1.md.

**Write (новые, в `src/data/demo/`):**

- `factories.ts` — createWorkFromTemplate, calculateSimpleMetrics, createRoom,
  createResidentialRoomWorks/createBathroomWorks/createBalconyWorks/createTechnicalRoomWorks,
  createDemoObject, createInitialProjects (приватные фабрики)
- `house.ts` — houseKitchen/LivingRoom/Bedroom/Bathroom/Balcony metrics + houseRooms
- `garage.ts`, `dacha.ts`, `shop.ts`, `warehouse.ts`, `workshop.ts` — аналогично по объектам
- `src/data/initialData.ts` — фасад: export { initialProjects } / { initialRooms } из factories

## Алгоритм (псевдокод)

```
factories.ts: createInitialProjects собирает демо-объекты, импортируя room-массивы
  из house/garage/dacha/shop/warehouse/workshop (однонаправленный граф: файлы
  объектов → factories; объекты между собой НЕ импортируют друг друга).
фасад: export const initialProjects = createInitialProjects(); export const initialRooms = houseRooms;
  (вычисление в фасаде ИЛИ ре-экспорт из factories — главное: значения идентичны,
  вычисляются один раз при импорте, как раньше)
```

**Edge-кейсы:** порядок комнат в каждом массиве и порядок объектов в
createInitialProjects — байт-в-байт (демо-данные видны пользователю);
id генерируются статически в данных — не «фиксить».

**Логирование:** не требуется.

## Запреты

- НЕ менять значения/структуру демо-данных и фабрик; НЕ менять App.tsx и тесты;
  НЕ трогать workTemplatesCatalog (импорт через его фасад); новых зависимостей нет.

## DoD

- [ ] gates зелёные
- [ ] `initialProjects`/`initialRooms` глубоко идентичны прежним (тест-скрипт:
      до/после JSON.stringify сравнение — приложи вывод в developer_log)
- [ ] все новые файлы ≤400 строк; developer_log дописан

## Эскалация: неоднозначность → к архитектору; 2 провала gate → к человеку
