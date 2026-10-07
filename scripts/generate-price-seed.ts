/**
 * Генератор сида каталога цен: shared/data/priceCatalogSeed.json
 *
 * Экспортирует канонический каталог работ/материалов/инструментов
 * (src/data/workTemplatesCatalog.ts) в машиночитаемый JSON для
 * серверного price-updater'а. Цены НЕ включаются — их обновляет AI.
 *
 * Запуск: pnpm run generate:price-seed
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORK_TEMPLATES_CATALOG } from '../src/data/workTemplatesCatalog';

type SeedCategory = 'work' | 'material' | 'tool';

interface SeedItem {
  name: string;
  category: SeedCategory;
  unit: string;
}

interface PriceCatalogSeed {
  version: 1;
  generatedAt: string;
  items: SeedItem[];
}

const TOOL_UNIT = 'шт';

function buildSeedItems(): SeedItem[] {
  const entries = new Map<string, SeedItem>();

  const push = (item: SeedItem): void => {
    const key = `${item.category}\u0000${item.name}`;
    // Dedupe по (name, category) — первое вхождение выигрывает
    if (!entries.has(key)) {
      entries.set(key, item);
    }
  };

  for (const work of WORK_TEMPLATES_CATALOG) {
    push({ name: work.name, category: 'work', unit: work.unit });

    for (const material of work.materials) {
      // В каталоге возможны null-элементы — фильтруем (см. initialData.ts)
      if (!material) continue;
      push({ name: material.name, category: 'material', unit: material.unit });
    }

    for (const tool of work.tools) {
      if (!tool) continue;
      push({ name: tool.name, category: 'tool', unit: TOOL_UNIT });
    }
  }

  // Сортировка: category, затем name
  return [...entries.values()].sort((a, b) =>
    a.category === b.category
      ? a.name.localeCompare(b.name, 'ru')
      : a.category < b.category
        ? -1
        : 1,
  );
}

function main(): void {
  const items = buildSeedItems();
  const seed: PriceCatalogSeed = {
    version: 1,
    generatedAt: new Date().toISOString(),
    items,
  };

  const outPath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../shared/data/priceCatalogSeed.json',
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');

  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});

  console.info(`[generate-price-seed] записано ${outPath}`);
  console.info(
    `[generate-price-seed] всего: ${items.length} | works: ${counts['work'] ?? 0} | materials: ${counts['material'] ?? 0} | tools: ${counts['tool'] ?? 0}`,
  );
}

main();
