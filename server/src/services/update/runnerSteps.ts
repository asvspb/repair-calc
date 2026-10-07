import {
  UpdateJobItemRepository,
  UpdateJobRepository,
} from '../../db/repositories/updateJob.repo.js';
import {
  PriceCatalogRepository,
  type CreatePriceCatalogInput,
  type SourceType,
} from '../../db/repositories/priceCatalog.repo.js';
import {
  PriceHistoryRepository,
  type CreatePriceHistoryInput,
} from '../../db/repositories/priceHistory.repo.js';
import { prioritizeItems, type PrioritizedItem } from './utils/priority.js';
import { loadSeedItems, mergeSeedItems, type RawUpdateItem } from './seedItems.js';
import type { PriceResult } from './parsers/types.js';
import type { ItemToUpdate, RunOptions } from './runner.types.js';

// ═══════════════════════════════════════════════════════
// ШАГИ RUNNER'А БЕЗ СОСТОЯНИЯ (вынесено из runner.ts):
// сбор элементов, сохранение цены, запись результатов
// ═══════════════════════════════════════════════════════

/** Получение и приоритизация элементов для обновления. */
export async function getItemsToUpdate(options: RunOptions): Promise<PrioritizedItem[]> {
  let rawItems: RawUpdateItem[] = [];

  // Если указан город, получаем элементы для этого города
  if (options.city) {
    const stalePrices = await PriceCatalogRepository.findStale(1000);

    for (const price of stalePrices) {
      if (options.city && price.city !== options.city) continue;
      if (options.categories && !options.categories.includes(price.category)) continue;

      rawItems.push({
        name: price.name,
        category: price.category,
        city: price.city,
        unit: price.unit,
      });
    }

    // Элементы сида каталога, которых в price_catalog для города нет вообще
    const seed = loadSeedItems();
    const filteredSeed = options.categories
      ? seed.filter(item => options.categories?.includes(item.category))
      : seed;
    rawItems = await mergeSeedItems(rawItems, filteredSeed, options.city, (name, city, category) =>
      PriceCatalogRepository.findByNameCityCategory(name, city, category),
    );
  }

  // Ждём разрешения всех промисов для existingPrice
  const itemsWithPrices = await Promise.all(
    rawItems.map(async item => {
      const existingPrice = await PriceCatalogRepository.findByNameCityCategory(
        item.name,
        item.city,
        item.category,
      );
      return { ...item, existingPrice };
    }),
  );

  // Приоритизируем и сортируем по убыванию приоритета
  return prioritizeItems(itemsWithPrices, item => item.existingPrice);
}

/** Сохранение цены в каталог + запись истории. */
export async function savePrice(
  item: ItemToUpdate,
  result: PriceResult,
  jobId: string,
  sourceType?: SourceType,
): Promise<void> {
  const input: CreatePriceCatalogInput = {
    name: item.name,
    category: item.category,
    unit: item.unit,
    city: item.city,
    price_min: result.prices.min,
    price_avg: result.prices.avg,
    price_max: result.prices.max,
    currency: result.prices.currency,
    source_type: sourceType,
    confidence_score: result.confidenceScore,
    valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 дней
  };

  // Сохраняем или обновляем цену
  const priceCatalog = await PriceCatalogRepository.upsert(input);

  // Записываем историю
  const historyInput: CreatePriceHistoryInput = {
    price_catalog_id: priceCatalog.id,
    job_id: jobId,
    old_price_min: item.existingPrice?.price_min,
    old_price_avg: item.existingPrice?.price_avg,
    old_price_max: item.existingPrice?.price_max,
    new_price_min: result.prices.min,
    new_price_avg: result.prices.avg,
    new_price_max: result.prices.max,
    confidence_score: result.confidenceScore,
    requires_review: result.requiresReview,
  };

  // Вычисляем процент изменения
  if (item.existingPrice?.price_avg && result.prices.avg) {
    const changePercent =
      ((result.prices.avg - item.existingPrice.price_avg) / item.existingPrice.price_avg) * 100;
    historyInput.price_change_percent = changePercent;
  }

  await PriceHistoryRepository.create(historyInput);
}

/** Запись успешной обработки элемента + прогресс задачи. */
export async function recordSuccess(
  jobId: string,
  item: ItemToUpdate,
  result: PriceResult,
  _durationMs: number,
  _fromCache: boolean,
  sourceType?: SourceType,
): Promise<void> {
  const jobItems = await UpdateJobItemRepository.findByJobId(jobId);
  const jobItem = jobItems.find(ji => ji.item_name === item.name && ji.city === item.city);

  if (jobItem) {
    // Получаем ID сохранённой цены
    const priceCatalog = await PriceCatalogRepository.findByNameCityCategory(
      item.name,
      item.city,
      item.category,
    );

    if (priceCatalog && sourceType) {
      await UpdateJobItemRepository.completeItem(jobItem.id, {
        source: sourceType,
        price_catalog_id: priceCatalog.id,
        price_change: result.prices.avg - (item.existingPrice?.price_avg || 0),
      });
    }
  }

  // Обновляем прогресс задачи
  const job = await UpdateJobRepository.findById(jobId);
  if (job) {
    await UpdateJobRepository.updateProgress(jobId, {
      processed_items: job.processed_items + 1,
      items_updated: item.existingPrice ? job.items_updated + 1 : job.items_updated,
      items_created: !item.existingPrice ? job.items_created + 1 : job.items_created,
    });
  }
}

/** Запись пропущенного элемента + прогресс задачи. */
export async function recordSkipped(
  jobId: string,
  item: ItemToUpdate,
  reason: string,
): Promise<void> {
  const jobItems = await UpdateJobItemRepository.findByJobId(jobId);
  const jobItem = jobItems.find(ji => ji.item_name === item.name && ji.city === item.city);

  if (jobItem) {
    await UpdateJobItemRepository.skipItem(jobItem.id, reason);
  }

  const job = await UpdateJobRepository.findById(jobId);
  if (job) {
    await UpdateJobRepository.updateProgress(jobId, {
      processed_items: job.processed_items + 1,
      items_skipped: job.items_skipped + 1,
    });
  }
}

/** Запись неуспешной обработки элемента + прогресс задачи. */
export async function recordFailed(
  jobId: string,
  item: ItemToUpdate,
  error: string,
): Promise<void> {
  const jobItems = await UpdateJobItemRepository.findByJobId(jobId);
  const jobItem = jobItems.find(ji => ji.item_name === item.name && ji.city === item.city);

  if (jobItem) {
    await UpdateJobItemRepository.failItem(jobItem.id, error);
  }

  const job = await UpdateJobRepository.findById(jobId);
  if (job) {
    await UpdateJobRepository.updateProgress(jobId, {
      processed_items: job.processed_items + 1,
      failed_items: job.failed_items + 1,
    });
  }
}

/** Разбиение массива на чанки заданного размера (вынесено из runner.ts). */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/** Задержка между батчами (вынесено из runner.ts). */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
