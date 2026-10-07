/**
 * Тесты getItemsToUpdate (runnerSteps): покрытие элементов сида.
 * TASK-BATCH-035: сид добавляет только отсутствующие в каталоге элементы.
 *
 * Сценарий "битый seed-файл" проверяется здесь на уровне контракта
 * loadSeedItems → [] (сам warning + [] покрыт в seedItems.test.ts).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════
// МОКИ РЕПОЗИТОРИЕВ И СИДА (изолируем БД и seed-файл)
// ═══════════════════════════════════════════════════════

vi.mock('../../src/db/repositories/updateJob.repo.js', () => ({
  UpdateJobRepository: {},
  UpdateJobItemRepository: {},
}));

vi.mock('../../src/db/repositories/priceHistory.repo.js', () => ({
  PriceHistoryRepository: {},
}));

const findStale = vi.fn();
const findByNameCityCategory = vi.fn();

vi.mock('../../src/db/repositories/priceCatalog.repo.js', () => ({
  PriceCatalogRepository: {
    findStale: (...args: unknown[]) => findStale(...args),
    findByNameCityCategory: (...args: unknown[]) => findByNameCityCategory(...args),
  },
}));

// Мокаем только loadSeedItems; mergeSeedItems — реальный (тестируем слияние целиком)
vi.mock('../../src/services/update/seedItems.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../../src/services/update/seedItems.js')>();
  return {
    ...actual,
    loadSeedItems: (...args: unknown[]) => loadSeedMock(...args),
  };
});

const loadSeedMock = vi.fn<typeof import('../../src/services/update/seedItems.js').loadSeedItems>();

import { getItemsToUpdate } from '../../src/services/update/runnerSteps.js';
import type { SeedItem } from '../../src/services/update/seedItems.js';
import type { PriceCatalog } from '../../src/db/repositories/priceCatalog.repo.js';

// ═══════════════════════════════════════════════════════
// ФИКССТУРЫ
// ═══════════════════════════════════════════════════════

const CITY = 'Москва';

const SEED: SeedItem[] = [
  { name: 'Укладка ламината', category: 'work', unit: 'м²' },
  { name: 'Ламинат', category: 'material', unit: 'упак' },
  { name: 'Подбойка для ламината', category: 'tool', unit: 'шт' },
  { name: 'Грунтовка', category: 'material', unit: 'л' },
];

const catalogRow = (name: string, category: string, stale = false): PriceCatalog =>
  ({
    id: `row-${name}`,
    name,
    category,
    unit: 'м²',
    city: CITY,
    price_min: 100,
    price_avg: 150,
    price_max: 200,
    currency: 'RUB',
    source_type: 'ai_search',
    confidence_score: 0.8,
    valid_until: new Date(stale ? 0 : Date.now() + 7 * 24 * 60 * 60 * 1000),
  }) as unknown as PriceCatalog;

beforeEach(() => {
  loadSeedMock.mockReset().mockReturnValue(SEED);
  findStale.mockReset().mockResolvedValue([]);
  findByNameCityCategory.mockReset().mockResolvedValue(null);
});

// ═══════════════════════════════════════════════════════
// ТЕСТЫ
// ═══════════════════════════════════════════════════════

describe('getItemsToUpdate: сид каталога', () => {
  it('без города сид не добавляется (как и stale)', async () => {
    const items = await getItemsToUpdate({});
    expect(items).toEqual([]);
    expect(loadSeedMock).not.toHaveBeenCalled();
    expect(findStale).not.toHaveBeenCalled();
  });

  it('элемент сида есть в каталоге со свежей ценой → НЕ попадает в очередь', async () => {
    // Все элементы сида "существуют и свежи" → в очереди ничего
    findByNameCityCategory.mockImplementation(async (name: string, _c: string, cat: string) =>
      catalogRow(name, cat),
    );

    const items = await getItemsToUpdate({ city: CITY });

    // lookup вызывался для всех seed-элементов, но очередь пуста
    const seedLookups = findByNameCityCategory.mock.calls.filter(([name]) =>
      SEED.some(s => s.name === name),
    );
    expect(seedLookups).toHaveLength(SEED.length);
    expect(items).toEqual([]);
  });

  it('элемент сида отсутствует в каталоге → попадает в очередь с высшим приоритетом', async () => {
    // Все элементы сида существуют, кроме 'Грунтовка'
    findByNameCityCategory.mockImplementation(async (name: string, _c: string, cat: string) =>
      name === 'Грунтовка' ? null : catalogRow(name, cat),
    );

    const items = await getItemsToUpdate({ city: CITY });

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Грунтовка');
    expect(items[0].category).toBe('material');
    expect(items[0].city).toBe(CITY);
    // Новый элемент без записи в БД — приоритет 100
    expect(items[0].priorityScore).toBeGreaterThanOrEqual(100);
  });

  it('seed-элемент, совпадающий со stale, не дублируется', async () => {
    // stale содержит 'Ламинат' (устаревшая цена)
    findStale.mockResolvedValue([catalogRow('Ламинат', 'material', true)]);
    findByNameCityCategory.mockImplementation(async (name: string, _c: string, cat: string) =>
      catalogRow(name, cat),
    );

    const items = await getItemsToUpdate({ city: CITY });

    const laminates = items.filter(i => i.name === 'Ламинат');
    expect(laminates).toHaveLength(1);
    expect(items).toHaveLength(1);
  });

  it('битый seed-файл (loadSeedItems → []) → раннер жив, работа только по stale', async () => {
    // Контракт: при битом JSON loadSeedItems возвращает [] (см. seedItems.test.ts)
    loadSeedMock.mockReturnValue([]);
    findStale.mockResolvedValue([catalogRow('Ламинат', 'material', true)]);
    findByNameCityCategory.mockImplementation(async (name: string, _c: string, cat: string) =>
      catalogRow(name, cat),
    );

    const items = await getItemsToUpdate({ city: CITY });

    expect(items.map(i => i.name)).toEqual(['Ламинат']);
  });

  it('categories-фильтр применяется и к seed-элементам', async () => {
    findByNameCityCategory.mockResolvedValue(null);

    const items = await getItemsToUpdate({ city: CITY, categories: ['material'] });

    for (const item of items) {
      expect(item.category).toBe('material');
    }
    expect(items).toHaveLength(SEED.filter(s => s.category === 'material').length);
  });
});
