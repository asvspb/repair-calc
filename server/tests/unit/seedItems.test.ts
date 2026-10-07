/**
 * Тесты seedItems: загрузка сида + слияние с stale-элементами.
 * TASK-BATCH-035.
 */

import { describe, it, expect, vi, afterAll } from 'vitest';
import { writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadSeedItems,
  mergeSeedItems,
  type RawUpdateItem,
  type SeedItem,
} from '../../src/services/update/seedItems.js';
import { winstonLogger } from '../../src/middleware/logger.js';

// ═══════════════════════════════════════════════════════
// ФИКССТУРЫ (битый/отсутствующий seed-файл)
// ═══════════════════════════════════════════════════════

const tmpDir = mkdtempSync(join(tmpdir(), 'seeditems-test-'));
const brokenPath = join(tmpDir, 'broken.json');
writeFileSync(brokenPath, 'not-json{', 'utf8');
const missingPath = join(tmpDir, 'missing.json');

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ═══════════════════════════════════════════════════════
// ХЕЛПЕРЫ
// ═══════════════════════════════════════════════════════

const CITY = 'Москва';

const seedItem = (name: string, category: SeedItem['category'], unit = 'шт'): SeedItem => ({
  name,
  category,
  unit,
});

const rawItem = (name: string, category: SeedItem['category']): RawUpdateItem => ({
  name,
  category,
  city: CITY,
  unit: 'м²',
});

/** Фейковый lookup по каталогу: knows — множество ключей "category\u0000name" с записью в БД. */
const makeLookup = (knows: Set<string>) =>
  vi.fn(async (name: string, _city: string, category: string) =>
    knows.has(`${category}\u0000${name}`) ? { id: 'existing' } : null,
  );

// ═══════════════════════════════════════════════════════
// loadSeedItems
// ═══════════════════════════════════════════════════════

describe('loadSeedItems', () => {
  it('читает реальный seed-файл и возвращает непустой валидный список', () => {
    const items = loadSeedItems();
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(typeof item.name).toBe('string');
      expect(item.name.length).toBeGreaterThan(0);
      expect(['work', 'material', 'tool']).toContain(item.category);
      expect(item.unit).toMatch(/\S/);
    }
  });

  it('битый JSON → warning и пустой список, исключение наружу НЕ летит', () => {
    const warnSpy = vi.spyOn(winstonLogger, 'warn').mockImplementation(() => {});

    const items = loadSeedItems(brokenPath);

    expect(items).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    expect(() => loadSeedItems(brokenPath)).not.toThrow();

    warnSpy.mockRestore();
  });

  it('отсутствующий seed-файл → warning и пустой список', () => {
    const warnSpy = vi.spyOn(winstonLogger, 'warn').mockImplementation(() => {});

    expect(loadSeedItems(missingPath)).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

// ═══════════════════════════════════════════════════════
// mergeSeedItems
// ═══════════════════════════════════════════════════════

describe('mergeSeedItems', () => {
  const seed = [
    seedItem('Укладка ламината', 'work'),
    seedItem('Ламинат', 'material'),
    seedItem('Подбойка для ламината', 'tool'),
  ];

  it('элемента каталога нет вовсе → добавляется в очередь', async () => {
    const lookup = makeLookup(new Set()); // в БД ничего нет
    const merged = await mergeSeedItems([], seed, CITY, lookup);

    expect(merged).toHaveLength(3);
    expect(merged.map(i => `${i.category}/${i.name}`).sort()).toEqual(
      ['work/Укладка ламината', 'material/Ламинат', 'tool/Подбойка для ламината'].sort(),
    );
    for (const item of merged) {
      expect(item.city).toBe(CITY);
      expect(item.unit).toBeDefined();
    }
  });

  it('свежий элемент каталога (есть запись в БД) → НЕ попадает в очередь', async () => {
    const lookup = makeLookup(new Set(['work\u0000Укладка ламината']));
    const merged = await mergeSeedItems([], seed, CITY, lookup);

    expect(merged.map(i => i.name)).not.toContain('Укладка ламината');
    expect(merged).toHaveLength(2);
  });

  it('дубль со stale — не дублируется (первое вхождение выигрывает)', async () => {
    const stale = [rawItem('Ламинат', 'material')];
    const lookup = makeLookup(new Set());
    const merged = await mergeSeedItems(stale, seed, CITY, lookup);

    const laminates = merged.filter(i => i.name === 'Ламинат' && i.category === 'material');
    expect(laminates).toHaveLength(1);
    expect(merged).toHaveLength(3);
  });

  it('одно имя в разных категориях сравнивается по (name, category)', async () => {
    // 'Шпаклёвка' есть в stale как work; в сиде тот же name как material — добавляется
    const stale = [rawItem('Шпаклёвка', 'work')];
    const seedTwo = [seedItem('Шпаклёвка', 'work'), seedItem('Шпаклёвка', 'material')];
    const lookup = makeLookup(new Set());
    const merged = await mergeSeedItems(stale, seedTwo, CITY, lookup);

    // work-дубликат пропущен, material-элемент добавлен: stale work + seed material
    expect(merged).toHaveLength(2);
    expect(merged.filter(i => i.name === 'Шпаклёвка')).toHaveLength(2);
    expect(merged.filter(i => i.category === 'material' && i.name === 'Шпаклёвка')).toHaveLength(1);
  });

  it('пустой сид → rawItems без изменений', async () => {
    const lookup = makeLookup(new Set());
    const stale = [rawItem('Ламинат', 'material')];
    const merged = await mergeSeedItems(stale, [], CITY, lookup);
    expect(merged).toEqual(stale);
  });
});
