/**
 * Тесты сида каталога цен: shared/data/priceCatalogSeed.json
 * TASK-BATCH-034: доказывает, что сид покрывает 100% каталога
 * (все works, все материалы, все инструменты).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORK_TEMPLATES_CATALOG } from '../src/data/workTemplatesCatalog';

interface SeedItem {
  name: string;
  category: 'work' | 'material' | 'tool';
  unit: string;
}

interface SeedFile {
  version: number;
  generatedAt: string;
  items: SeedItem[];
}

const seedPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../shared/data/priceCatalogSeed.json',
);
const seed: SeedFile = JSON.parse(readFileSync(seedPath, 'utf8'));

/** Множества (name, category), построенные из каталога в рантайме — как в генераторе. */
function buildCatalogSets(): Set<string>[] {
  const works = new Set<string>();
  const materials = new Set<string>();
  const tools = new Set<string>();

  for (const work of WORK_TEMPLATES_CATALOG) {
    works.add(`work\u0000${work.name}`);
    for (const material of work.materials) {
      if (!material) continue;
      materials.add(`material\u0000${material.name}`);
    }
    for (const tool of work.tools) {
      if (!tool) continue;
      tools.add(`tool\u0000${tool.name}`);
    }
  }
  return [works, materials, tools];
}

const seedKeys = new Set(seed.items.map(item => `${item.category}\u0000${item.name}`));

describe('priceCatalogSeed.json', () => {
  it('покрывает 100% каталога: все работы', () => {
    const [works] = buildCatalogSets();
    for (const key of works) {
      expect(seedKeys.has(key), `работа отсутствует в сиде: ${key}`).toBe(true);
    }
  });

  it('покрывает 100% каталога: все материалы', () => {
    const [, materials] = buildCatalogSets();
    for (const key of materials) {
      expect(seedKeys.has(key), `материал отсутствует в сиде: ${key}`).toBe(true);
    }
  });

  it('покрывает 100% каталога: все инструменты', () => {
    const [, , tools] = buildCatalogSets();
    for (const key of tools) {
      expect(seedKeys.has(key), `инструмент отсутствует в сиде: ${key}`).toBe(true);
    }
  });

  it('не содержит дублей (name, category)', () => {
    const seen = new Set<string>();
    for (const item of seed.items) {
      const key = `${item.category}\u0000${item.name}`;
      expect(seen.has(key), `дубликат в сиде: ${key}`).toBe(false);
      seen.add(key);
    }
    expect(seen.size).toBe(seed.items.length);
  });

  it('unit непустой для всех элементов', () => {
    for (const item of seed.items) {
      expect(item.unit, `пустой unit у ${item.category}/${item.name}`).toMatch(/\S/);
    }
  });

  it('category ∈ {work, material, tool}', () => {
    for (const item of seed.items) {
      expect(['work', 'material', 'tool']).toContain(item.category);
    }
  });

  it('элементы отсортированы по category, затем name', () => {
    const sorted = [...seed.items].sort((a, b) =>
      a.category === b.category
        ? a.name.localeCompare(b.name, 'ru')
        : a.category < b.category
          ? -1
          : 1,
    );
    expect(seed.items).toEqual(sorted);
  });

  it('version = 1 и generatedAt — валидная ISO-дата', () => {
    expect(seed.version).toBe(1);
    expect(Number.isNaN(Date.parse(seed.generatedAt))).toBe(false);
  });
});
