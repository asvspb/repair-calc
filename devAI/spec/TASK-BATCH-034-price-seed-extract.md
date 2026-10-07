# TASK-BATCH-034-price-seed-extract

**Назначено:** coder **Подветка:** feat/price-seed-coverage-batch-034
**Зависит от:** нет **Статус:** ✅

## Цель (проверяемая)

Канонический каталог работ/материалов/инструментов (`src/data/workTemplatesCatalog.ts`)
экспортирован в машиночитаемый сид для серверного price-updater'а: коммитится
`shared/data/priceCatalogSeed.json`, генерируемый скриптом; unit-тест доказывает,
что сид покрывает 100% каталога (все works, все материалы, все инструменты).

## Read / Write (write — ЭКСКЛЮЗИВНО)

**Read:** `src/data/workTemplatesCatalog.ts`, `src/types/workTemplate.ts`, `AGENTS.md`.

**Write:**

- `scripts/generate-price-seed.ts` (новый)
- `shared/data/priceCatalogSeed.json` (новый, сгенерированный, коммитится)
- `package.json` (ТОЛЬКО новый script `generate:price-seed` — больше ничего не менять)
- `tests/priceSeed.spec.ts` (новый)

## Алгоритм (псевдокод)

```
generate-price-seed.ts (запуск: pnpm tsx scripts/generate-price-seed.ts):
  import { WORK_TEMPLATES_CATALOG } from '../src/data/workTemplatesCatalog'
  entries = []
  для каждого work в каталоге:
    entries.push({ name: work.name, category: 'work', unit: work.unit })
    для каждого mat в work.materials (mat != null):
      entries.push({ name: mat.name, category: 'material', unit: mat.unit })
    для каждого tool в work.tools:
      entries.push({ name: tool.name, category: 'tool', unit: 'шт' })
  dedupe по (name, category) — первое вхождение выигрывает
  записать JSON: { version: 1, generatedAt: ISO-дата, items: entries }
    в shared/data/priceCatalogSeed.json (sorted by category, then name)
  лог: количество по категориям (console.info достаточно для CLI-скрипта)

tests/priceSeed.spec.ts:
  читать JSON; построить те же множества из каталога в рантайме;
  assert: каждое (name, category) каталога присутствует в сиде;
  assert: нет дублей (name, category); assert: unit непустой для всех;
  assert: category ∈ {'work','material','tool'}
```

**Edge-кейсы:** null-элементы в `work.materials` (фильтровать, см. initialData.ts);
дубли имён между работами (разные работы могут ссылаться на один материал — dedupe);
русские названия/юникод в JSON (`ensure_ascii`-эквивалент НЕ нужен, писать как есть).

**Логирование:** CLI `console.info` в скрипте; в тестах — без логов.

## Запреты

- НЕ переносить `workTemplatesCatalog.ts` в shared/ (только генерация JSON).
- НЕ трогать `src/` (кроме чтения) и `server/`.
- НЕ добавлять зависимости.
- Цены в сид НЕ включать (apdates их получит из AI-источников).

## DoD

- [ ] `pnpm test` / `pnpm run lint` / `pnpm run lint:deps` зелёные
- [ ] `pnpm run generate:price-seed` регенерирует JSON байт-в-байт идентично (кроме generatedAt)
- [ ] `devAI/developer_log.md` дописан
- [ ] секретов нет

## Эскалация: неоднозначность → к архитектору; 2 провала gate → к человеку
