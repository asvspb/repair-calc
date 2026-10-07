/**
 * Загрузка и слияние сида каталога цен (shared/data/priceCatalogSeed.json)
 * в очередь обновления price-updater'а. TASK-BATCH-035.
 *
 * Сид добавляет в очередь только те элементы, которых в price_catalog
 * для города нет вообще. Элементы со свежей ценой не трогаем — иначе
 * каждый запуск будет переспрашивать AI по всему каталогу.
 */

import { readFileSync } from 'node:fs';
import { winstonLogger } from '../../middleware/logger.js';
import type { PriceCategory } from '../../db/repositories/priceCatalog.repo.js';

// server/src/services/update/ → корень репозитория (работает и из src, и из dist)
const SEED_PATH = '../../../../shared/data/priceCatalogSeed.json';

export interface SeedItem {
  name: string;
  category: PriceCategory;
  unit: string;
}

interface SeedFile {
  version: number;
  generatedAt: string;
  items: SeedItem[];
}

/** Элемент очереди обновления (тот же shape, что rawItems в runnerSteps). */
export interface RawUpdateItem {
  name: string;
  category: PriceCategory;
  city: string;
  unit?: string;
}

/** Lookup существующей записи каталога (обёртка над PriceCatalogRepository). */
export type ExistingLookup = (
  name: string,
  city: string,
  category: PriceCategory,
) => Promise<unknown | null>;

/**
 * Парсит JSON сида. При отсутствии/битом файле — warning и пустой список:
 * раннер продолжает работу только по stale-элементам.
 *
 * @param seedPath путь к seed-файлу (переопределяется в юнит-тестах)
 */
export function loadSeedItems(seedPath?: string): SeedItem[] {
  const target: string | URL = seedPath ?? new URL(SEED_PATH, import.meta.url);
  try {
    const raw = readFileSync(target, 'utf8');
    const parsed = JSON.parse(raw) as SeedFile;
    if (!Array.isArray(parsed.items)) {
      throw new Error('seed items is not an array');
    }
    return parsed.items.filter(
      (item): item is SeedItem =>
        !!item &&
        typeof item.name === 'string' &&
        typeof item.unit === 'string' &&
        typeof item.category === 'string',
    );
  } catch (error) {
    winstonLogger.warn('[seedItems] seed-файл недоступен или битый, работа только по stale', {
      seedPath: target.toString(),
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Добавляет к stale-элементам (rawItems) элементы сида, которых нет
 * в каталоге для города. Сравнение — по паре (name, category).
 */
export async function mergeSeedItems(
  rawItems: RawUpdateItem[],
  seed: SeedItem[],
  city: string,
  existsInCatalog: ExistingLookup,
): Promise<RawUpdateItem[]> {
  const present = new Set(rawItems.map(item => `${item.category}\u0000${item.name}`));
  const merged = [...rawItems];
  let added = 0;

  for (const item of seed) {
    const key = `${item.category}\u0000${item.name}`;
    // Уже в очереди (stale) — не дублируем
    if (present.has(key)) continue;

    // Есть в каталоге и не stale (stale уже выше) → свежая цена, не трогаем
    const existing = await existsInCatalog(item.name, city, item.category);
    if (existing != null) continue;

    merged.push({ name: item.name, category: item.category, city, unit: item.unit });
    present.add(key);
    added++;
  }

  if (added > 0) {
    winstonLogger.info(`[seedItems] seed: добавлено ${added} отсутствующих элементов`, { city });
  }
  return merged;
}
