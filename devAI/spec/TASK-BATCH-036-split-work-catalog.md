# TASK-BATCH-036-split-work-catalog

**Назначено:** coder **Подветка:** работа в общей ветке refactor/monolith-splits-b1 (отдельный атомарный коммит)
**Зависит от:** нет **Статус:** ⬜

## Цель (проверяемая)

`src/data/workTemplatesCatalog.ts` (1220 строк) распилен на модули `src/data/catalog/`
по категориям работ; исходный путь остаётся фасадом (re-export) — импортеры
(`src/data/initialData.ts`, `src/features/works/ui/WorkCatalogPicker.tsx`,
`scripts/generate-price-seed.ts`, тесты) НЕ меняются. Поведение идентично:
`tests/priceSeed.spec.ts` и `tests/utils/workTemplatesCatalog.test.ts` зелёные без правок.

## Read / Write (write — ЭКСКЛЮЗИВНО)

**Read:** `src/data/workTemplatesCatalog.ts`, `src/types/workTemplate.ts`, PLAN-monolith-splits-b1.md.

**Write:**

- `src/data/catalog/tools.ts` (новый)
- `src/data/catalog/works-floor.ts`, `works-walls.ts`, `works-ceiling.ts`, `works-openings.ts`, `works-other.ts` (новые; работы распределяются по полю `category` — 'other' принимает всё не попавшее)
- `src/data/catalog/selectors.ts` (новый: getWorksByCategory/getCategoriesWithWorks/getWorkById/searchWorks/getPopularWorks + сборка WORK_TEMPLATES_CATALOG из частей)
- `src/data/workTemplatesCatalog.ts` (превращается в фасад: только re-export'ы)

## Алгоритм (псевдокод)

```
tools.ts: экспорт TOOLS (словарь инструментов, как есть, тип сохранить)
works-<cat>.ts: export const WORKS_<CAT>: WorkTemplateCatalog[] = [ ...соответствующие записи... ]
  (записи переносятся байт-в-байт, включая комментарии разделов — это перенос, не переписывание)
selectors.ts: import все части; export const WORK_TEMPLATES_CATALOG = [...FLOOR, ...WALLS, ...]
  (ПОРЯДОК как в исходном массиве — стабильность важна для getPopularWorks/поиска)
  + все query-функции переносятся как есть
фасад: export { WORK_TEMPLATES_CATALOG, getWorksByCategory, ... } from './catalog/selectors';
  export { TOOLS } from './catalog/tools'; export type {...} — все прежние экспорты сохранены
```

**Edge-кейсы:** порядок конкатенации = исходный порядок массива (проверь по id);
tools у объектов-литералов используют ключи-идентификаторы (подбойка и т.п.) — сохранить;
тип `ToolTemplate`-словаря не меняется.

**Логирование:** не требуется (данные).

## Запреты

- НЕ менять логику/значения/типы/комментарии данных; НЕ менять импортеры и тесты;
- НЕ трогать scripts/generate-price-seed.ts (его импорт фасада должен работать как раньше);
- новых зависимостей нет.

## DoD

- [ ] gates зелёные; тесты каталога и priceSeed проходят БЕЗ правок
- [ ] `git diff` показывает только перенос кода (проверка: pnpm tsx scripts/generate-price-seed.ts → JSON идентичен коммиту, кроме generatedAt)
- [ ] все новые файлы ≤400 строк
- [ ] developer_log дописан

## Эскалация: неоднозначность → к архитектору; 2 провала gate → к человеку
