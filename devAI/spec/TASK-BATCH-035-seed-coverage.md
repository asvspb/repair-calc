# TASK-BATCH-035-seed-coverage

**Назначено:** coder **Подветка:** feat/price-seed-coverage-batch-035
**Зависит от:** TASK-BATCH-034 **Статус:** ⬜

## Цель (проверяемая)

`getItemsToUpdate` в серверном price-updater помимо устаревших цен каталога включает
элементы сида `shared/data/priceCatalogSeed.json`, которых в `price_catalog` для
указанного города нет вообще (закрытие TODO `server/src/services/update/runnerSteps.ts:46`).
Гарантия: элементы с СВЕЖЕЙ ценой в каталоге не ставятся в очередь (иначе каждый
запуск будет переспрашивать AI по всему каталогу).

## Read / Write (write — ЭКСКЛЮЗИВНО)

**Read:** `shared/data/priceCatalogSeed.json`, `server/src/db/repositories/priceCatalog.repo.ts`,
`server/src/services/update/utils/priority.ts`, `AGENTS.md`.

**Write:**

- `server/src/services/update/runnerSteps.ts` (правка getItemsToUpdate)
- `server/src/services/update/seedItems.ts` (новый — загрузка/фильтрация сида)
- `tests/server/` или рядом с кодом: `seedItems.test.ts` + дополнить тесты `runnerSteps` (новые файлы/директория тестов допустимы внутри server-структуры тестов — следуй существующему расположению тестов update-сервиса)

## Алгоритм (псевдокод)

```
seedItems.ts:
  export function loadSeedItems(): SeedItem[]   // парсит JSON (resolveJsonModule уже включён? проверить tsconfig; иначе fs.readFileSync+JSON.parse относительно import.meta.url)
  export function mergeSeedItems(rawItems, seed, city, existsFn): items
    // exists: Set имен уже попавших в rawItems (stale)
    // для каждого seed-элемента, если (name, category) не в rawItems:
    //   existing = await PriceCatalogRepository.findByNameCityCategory(name, city, category)
    //   если existing == null → добавить {name, category, city, unit} (existingPrice станет undefined после общего lookup)
    //   если existing != null и НЕ в stale-списке → пропустить (свежая цена, не трогаем)

runnerSteps.getItemsToUpdate:
  после сбора stale-элементов:
    seed = loadSeedItems()
    rawItems = mergeSeedItems(rawItems, seed, options.city, ...)
  остальной конвейер (itemsWithPrices → prioritizeItems) без изменений
  закомментированный TODO удалить
```

**Edge-кейсы:** seed-элемент совпадает по name с stale-элементом другой категории —
сравнивать по (name, category); JSON сида отсутствует/битый → лог warning через
`server/src/middleware/logger.ts` (winston) и работа только по stale (НЕ ронять раннер);
`options.city` не задан → сид не добавляется (текущее поведение: без города нет и stale).

**Логирование:** winston-логер (см. существующее использование в update-сервисе):
info «seed: добавлено N отсутствующих элементов», warning при ошибке чтения сида.

## Запреты

- НЕ менять репозитории/миграции/схему БД.
- НЕ менять приоритизацию и остальные шаги runner'а.
- НЕ импортировать `src/` в `server/` (только `shared/`).
- Цены по умолчанию из сида НЕ вставлять в БД (upsert сделает runner после AI-поиска).

## DoD

- [ ] `pnpm test` / `pnpm run lint` / `pnpm run lint:deps` зелёные
- [ ] тесты: свежий элемент каталога НЕ попадает в очередь; отсутствующий — попадает; дубль со stale — не дублируется; битый JSON → warning, раннер жив
- [ ] `devAI/developer_log.md` дописан
- [ ] секретов нет

## Эскалация: неоднозначность → к архитектору; 2 провала gate → к человеку
