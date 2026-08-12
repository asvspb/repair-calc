/**
 * Unit-тесты для каталога типовых работ
 */

import { describe, it, expect } from 'vitest';
import {
  WORK_TEMPLATES_CATALOG,
  getWorksByCategory,
  getCategoriesWithWorks,
  getWorkById,
  searchWorks,
  getPopularWorks,
} from '../../src/data/workTemplatesCatalog';
import type { WorkCategory } from '../../src/types/workTemplate';

describe('WORK_TEMPLATES_CATALOG', () => {
  it('should have ~20 works', () => {
    expect(WORK_TEMPLATES_CATALOG.length).toBeGreaterThanOrEqual(18);
    expect(WORK_TEMPLATES_CATALOG.length).toBeLessThanOrEqual(25);
  });

  it('all works should have required fields', () => {
    for (const work of WORK_TEMPLATES_CATALOG) {
      expect(work.id).toBeTruthy();
      expect(work.name).toBeTruthy();
      expect(work.unit).toBeTruthy();
      expect(work.calculationType).toBeTruthy();
      expect(work.category).toBeTruthy();
      expect(Array.isArray(work.materials)).toBe(true);
      expect(Array.isArray(work.tools)).toBe(true);
    }
  });

  it('all works should have unique IDs', () => {
    const ids = WORK_TEMPLATES_CATALOG.map((w) => w.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all materials should have required fields', () => {
    for (const work of WORK_TEMPLATES_CATALOG) {
      for (const material of work.materials) {
        expect(material.id).toBeTruthy();
        expect(material.name).toBeTruthy();
        expect(material.unit).toBeTruthy();
      }
    }
  });

  it('works with layers should have consumptionRate', () => {
    for (const work of WORK_TEMPLATES_CATALOG) {
      for (const material of work.materials) {
        if (material.layers && material.layers > 1) {
          expect(material.consumptionRate).toBeDefined();
          expect(material.consumptionRate).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('getWorksByCategory', () => {
  it('should return floor works', () => {
    const floorWorks = getWorksByCategory('floor');
    expect(floorWorks.length).toBeGreaterThan(0);
    expect(floorWorks.every((w) => w.category === 'floor')).toBe(true);
  });

  it('should return walls works', () => {
    const wallsWorks = getWorksByCategory('walls');
    expect(wallsWorks.length).toBeGreaterThan(0);
    expect(wallsWorks.every((w) => w.category === 'walls')).toBe(true);
  });

  it('should return ceiling works', () => {
    const ceilingWorks = getWorksByCategory('ceiling');
    expect(ceilingWorks.length).toBeGreaterThan(0);
    expect(ceilingWorks.every((w) => w.category === 'ceiling')).toBe(true);
  });

  it('should return openings works', () => {
    const openingsWorks = getWorksByCategory('openings');
    expect(openingsWorks.length).toBeGreaterThan(0);
    expect(openingsWorks.every((w) => w.category === 'openings')).toBe(true);
  });

  it('should return other works', () => {
    const otherWorks = getWorksByCategory('other');
    expect(otherWorks.length).toBeGreaterThan(0);
    expect(otherWorks.every((w) => w.category === 'other')).toBe(true);
  });

  it('should return empty array for unknown category', () => {
    // @ts-expect-error - testing invalid category
    const result = getWorksByCategory('unknown');
    expect(result).toEqual([]);
  });
});

describe('getCategoriesWithWorks', () => {
  it('should return all categories', () => {
    const categories = getCategoriesWithWorks();
    expect(categories).toHaveProperty('floor');
    expect(categories).toHaveProperty('walls');
    expect(categories).toHaveProperty('ceiling');
    expect(categories).toHaveProperty('openings');
    expect(categories).toHaveProperty('other');
  });

  it('total works should match catalog size', () => {
    const categories = getCategoriesWithWorks();
    const totalWorks = Object.values(categories).flat().length;
    expect(totalWorks).toBe(WORK_TEMPLATES_CATALOG.length);
  });
});

describe('getWorkById', () => {
  it('should find work by ID', () => {
    const work = getWorkById('laminate-flooring');
    expect(work).toBeDefined();
    expect(work?.name).toBe('Укладка ламината');
  });

  it('should return undefined for unknown ID', () => {
    const work = getWorkById('unknown-work');
    expect(work).toBeUndefined();
  });

  it('should find all works by their IDs', () => {
    for (const work of WORK_TEMPLATES_CATALOG) {
      const found = getWorkById(work.id);
      expect(found).toBe(work);
    }
  });
});

describe('searchWorks', () => {
  it('should find works by name', () => {
    const results = searchWorks('ламинат');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((w) => w.id === 'laminate-flooring')).toBe(true);
  });

  it('should find works by description', () => {
    const results = searchWorks('ванная');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should be case-insensitive', () => {
    const results1 = searchWorks('КРАСКА');
    const results2 = searchWorks('краска');
    expect(results1.length).toBe(results2.length);
  });

  it('should return empty array for no matches', () => {
    const results = searchWorks('несуществующая-работа-xyz');
    expect(results).toEqual([]);
  });

  it('should find partial matches', () => {
    const results = searchWorks('плит');
    expect(results.length).toBeGreaterThan(0);
    // Должен найти "Укладка плитки (пол)" и "Укладка плитки (стены)"
    expect(results.some((w) => w.id === 'tile-flooring')).toBe(true);
    expect(results.some((w) => w.id === 'tile-walls')).toBe(true);
  });
});

describe('getPopularWorks', () => {
  it('should return top N works by popularity', () => {
    const top5 = getPopularWorks(5);
    expect(top5.length).toBe(5);

    // Проверяем сортировку по убыванию popularity
    for (let i = 1; i < top5.length; i++) {
      expect((top5[i - 1].popularity || 0)).toBeGreaterThanOrEqual(
        top5[i].popularity || 0
      );
    }
  });

  it('should return all works if limit is greater than catalog size', () => {
    const allWorks = getPopularWorks(100);
    expect(allWorks.length).toBe(WORK_TEMPLATES_CATALOG.length);
  });

  it('default limit should be 5', () => {
    const defaultTop = getPopularWorks();
    expect(defaultTop.length).toBe(5);
  });

  it('most popular work should be laminate or wallpaper', () => {
    const top1 = getPopularWorks(1)[0];
    expect(['laminate-flooring', 'wallpaper-walls']).toContain(top1.id);
  });
});

describe('Material calculations setup', () => {
  it('coverage-based materials should have valid coveragePerUnit', () => {
    for (const work of WORK_TEMPLATES_CATALOG) {
      for (const material of work.materials) {
        if (material.coveragePerUnit !== undefined) {
          expect(material.coveragePerUnit).toBeGreaterThan(0);
        }
      }
    }
  });

  it('consumption-based materials should have valid consumptionRate', () => {
    for (const work of WORK_TEMPLATES_CATALOG) {
      for (const material of work.materials) {
        if (material.consumptionRate !== undefined) {
          expect(material.consumptionRate).toBeGreaterThan(0);
        }
      }
    }
  });

  it('wastePercent should be in valid range', () => {
    for (const work of WORK_TEMPLATES_CATALOG) {
      for (const material of work.materials) {
        if (material.wastePercent !== undefined) {
          expect(material.wastePercent).toBeGreaterThanOrEqual(0);
          expect(material.wastePercent).toBeLessThanOrEqual(50);
        }
      }
    }
  });

  it('layers should be at least 1 when defined', () => {
    for (const work of WORK_TEMPLATES_CATALOG) {
      for (const material of work.materials) {
        if (material.layers !== undefined) {
          expect(material.layers).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });

  it('perimeter-based materials should have multiplier', () => {
    for (const work of WORK_TEMPLATES_CATALOG) {
      for (const material of work.materials) {
        if (material.isPerimeter) {
          expect(material.multiplier).toBeDefined();
          expect(material.multiplier).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe('Work difficulty distribution', () => {
  it('should have works of all difficulty levels', () => {
    const difficulties = WORK_TEMPLATES_CATALOG.map((w) => w.difficulty);
    expect(difficulties).toContain('easy');
    expect(difficulties).toContain('medium');
    expect(difficulties).toContain('hard');
  });

  it('hard works should require specialists', () => {
    const hardWorks = WORK_TEMPLATES_CATALOG.filter((w) => w.difficulty === 'hard');
    // Электрика и сантехника должны быть hard
    expect(hardWorks.some((w) => w.id === 'electrical')).toBe(true);
    expect(hardWorks.some((w) => w.id === 'plumbing')).toBe(true);
  });
});

describe('Work estimation time', () => {
  it('all works should have estimatedTimePerUnit', () => {
    for (const work of WORK_TEMPLATES_CATALOG) {
      expect(work.estimatedTimePerUnit).toBeDefined();
      expect(work.estimatedTimePerUnit).toBeGreaterThan(0);
    }
  });

  it('complex works should take more time', () => {
    const tileFloor = getWorkById('tile-flooring');
    const painting = getWorkById('paint-walls');

    // Плитка занимает больше времени, чем покраска
    expect((tileFloor?.estimatedTimePerUnit || 0)).toBeGreaterThan(
      painting?.estimatedTimePerUnit || 0
    );
  });
});