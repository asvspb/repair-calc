/**
 * Тесты для Priority Queue Utils
 * Фаза 8.4.4 - Приоритетная очередь задач
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateItemPriority,
  prioritizeItems,
  groupByPriorityCategory,
  compareJobPriority,
  JobPriorityQueue,
  JOB_PRIORITY_VALUES,
  type JobPriority,
} from '../../src/services/update/utils/priority.js';
import type { PriceCatalog } from '../../src/db/repositories/priceCatalog.repo.js';

// ═══════════════════════════════════════════════════════
// МОКИ
// ═══════════════════════════════════════════════════════

const createMockPrice = (overrides: Partial<PriceCatalog> = {}): PriceCatalog => ({
  id: 'test-id',
  name: 'Test Material',
  category: 'material',
  unit: 'м²',
  city: 'Москва',
  price_min: 100,
  price_avg: 150,
  price_max: 200,
  currency: 'RUB',
  source_type: 'ai_gemini',
  confidence_score: 0.8,
  description: null,
  metadata: null,
  valid_from: new Date(),
  valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  version: 1,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

// ═══════════════════════════════════════════════════════
// ТЕСТЫ calculateItemPriority
// ═══════════════════════════════════════════════════════

describe('calculateItemPriority', () => {
  it('должен возвращать score 100 для нового элемента (нет в БД)', () => {
    const result = calculateItemPriority({
      name: 'New Material',
      category: 'material',
      city: 'Москва',
      existingPrice: null,
    });

    expect(result.score).toBe(100);
    expect(result.reasons).toContain('Новый элемент (нет в БД)');
  });

  it('должен возвращать score 80 для просроченного элемента', () => {
    const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // вчера
    const price = createMockPrice({ valid_until: expiredDate });

    const result = calculateItemPriority({
      name: 'Expired Material',
      category: 'material',
      city: 'Москва',
      existingPrice: price,
    });

    expect(result.score).toBe(80);
    expect(result.reasons.some(r => r.includes('Просрочено'))).toBe(true);
  });

  it('должен возвращать score 60 для элемента старше 7 дней', () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 дней назад
    const price = createMockPrice({ updated_at: oldDate });

    const result = calculateItemPriority({
      name: 'Old Material',
      category: 'material',
      city: 'Москва',
      existingPrice: price,
    });

    expect(result.score).toBe(60);
    expect(result.reasons.some(r => r.includes('Устарело'))).toBe(true);
  });

  it('должен возвращать score 40 для элемента с низким confidence', () => {
    const price = createMockPrice({ confidence_score: 0.3 });

    const result = calculateItemPriority({
      name: 'Low Confidence Material',
      category: 'material',
      city: 'Москва',
      existingPrice: price,
    });

    expect(result.score).toBe(40);
    expect(result.reasons.some(r => r.includes('Низкий confidence'))).toBe(true);
  });

  it('должен возвращать score 20 для планового обновления', () => {
    const price = createMockPrice({
      confidence_score: 0.8,
      updated_at: new Date(),
      valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    const result = calculateItemPriority({
      name: 'Normal Material',
      category: 'material',
      city: 'Москва',
      existingPrice: price,
    });

    expect(result.score).toBe(20);
    expect(result.reasons).toContain('Плановое обновление');
  });

  it('должен суммировать несколько причин', () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const price = createMockPrice({
      updated_at: oldDate,
      valid_until: expiredDate,
      confidence_score: 0.3,
    });

    const result = calculateItemPriority({
      name: 'Problematic Material',
      category: 'material',
      city: 'Москва',
      existingPrice: price,
    });

    // 80 (просрочено) + 60 (устарело) + 40 (низкий confidence) = 180
    expect(result.score).toBe(180);
    expect(result.reasons.length).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════
// ТЕСТЫ prioritizeItems
// ═══════════════════════════════════════════════════════

describe('prioritizeItems', () => {
  it('должен сортировать элементы по убыванию приоритета', () => {
    const items = [
      { name: 'Normal', category: 'material' as const, city: 'Москва' },
      { name: 'New', category: 'material' as const, city: 'Москва' },
      { name: 'Old', category: 'material' as const, city: 'Москва' },
    ];

    const getExistingPrice = (item: { name: string }) => {
      if (item.name === 'New') return null; // Новый элемент -> score 100
      if (item.name === 'Old') {
        return createMockPrice({
          name: item.name,
          updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        });
      }
      return createMockPrice({ name: item.name }); // Normal -> score 20
    };

    const result = prioritizeItems(items, getExistingPrice);

    expect(result[0].name).toBe('New'); // score 100
    expect(result[1].name).toBe('Old'); // score 60
    expect(result[2].name).toBe('Normal'); // score 20
  });

  it('должен добавлять priorityScore и priorityReasons к элементам', () => {
    const items = [
      { name: 'Test', category: 'material' as const, city: 'Москва' },
    ];

    const result = prioritizeItems(items, () => null);

    expect(result[0].priorityScore).toBe(100);
    expect(result[0].priorityReasons).toContain('Новый элемент (нет в БД)');
  });
});

// ═══════════════════════════════════════════════════════
// ТЕСТЫ groupByPriorityCategory
// ═══════════════════════════════════════════════════════

describe('groupByPriorityCategory', () => {
  it('должен группировать элементы по категориям приоритета', () => {
    const items = [
      { name: 'Critical', category: 'material' as const, city: 'Москва', priorityScore: 100, priorityReasons: [] },
      { name: 'High', category: 'material' as const, city: 'Москва', priorityScore: 70, priorityReasons: [] },
      { name: 'Normal', category: 'material' as const, city: 'Москва', priorityScore: 40, priorityReasons: [] },
      { name: 'Low', category: 'material' as const, city: 'Москва', priorityScore: 10, priorityReasons: [] },
    ];

    const result = groupByPriorityCategory(items);

    expect(result.critical.length).toBe(1);
    expect(result.critical[0].name).toBe('Critical');
    expect(result.high.length).toBe(1);
    expect(result.high[0].name).toBe('High');
    expect(result.normal.length).toBe(1);
    expect(result.normal[0].name).toBe('Normal');
    expect(result.low.length).toBe(1);
    expect(result.low[0].name).toBe('Low');
  });

  it('должен возвращать пустые массивы для пустого списка', () => {
    const result = groupByPriorityCategory([]);

    expect(result.critical).toEqual([]);
    expect(result.high).toEqual([]);
    expect(result.normal).toEqual([]);
    expect(result.low).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════
// ТЕСТЫ JOB_PRIORITY_VALUES
// ═══════════════════════════════════════════════════════

describe('JOB_PRIORITY_VALUES', () => {
  it('должен иметь правильные значения приоритетов', () => {
    expect(JOB_PRIORITY_VALUES.high).toBe(1000);
    expect(JOB_PRIORITY_VALUES.normal).toBe(500);
    expect(JOB_PRIORITY_VALUES.low).toBe(100);
  });

  it('должен иметь убывающие значения', () => {
    expect(JOB_PRIORITY_VALUES.high).toBeGreaterThan(JOB_PRIORITY_VALUES.normal);
    expect(JOB_PRIORITY_VALUES.normal).toBeGreaterThan(JOB_PRIORITY_VALUES.low);
  });
});

// ═══════════════════════════════════════════════════════
// ТЕСТЫ compareJobPriority
// ═══════════════════════════════════════════════════════

describe('compareJobPriority', () => {
  it('должен сортировать по приоритету (high > normal > low)', () => {
    const a = { priority: 'normal' as JobPriority, createdAt: new Date() };
    const b = { priority: 'high' as JobPriority, createdAt: new Date() };

    expect(compareJobPriority(a, b)).toBeGreaterThan(0); // b (high) должен быть раньше
    expect(compareJobPriority(b, a)).toBeLessThan(0); // a (normal) должен быть позже
  });

  it('при равном приоритете должен сортировать по времени создания', () => {
    const earlier = new Date('2026-01-01');
    const later = new Date('2026-01-02');
    
    const a = { priority: 'normal' as JobPriority, createdAt: later };
    const b = { priority: 'normal' as JobPriority, createdAt: earlier };

    expect(compareJobPriority(a, b)).toBeGreaterThan(0); // b (раньше) должен быть раньше
    expect(compareJobPriority(b, a)).toBeLessThan(0); // a (позже) должен быть позже
  });

  it('должен использовать normal как приоритет по умолчанию', () => {
    const a = { createdAt: new Date() };
    const b = { priority: 'high' as JobPriority, createdAt: new Date() };

    expect(compareJobPriority(a, b)).toBeGreaterThan(0); // b (high) > a (normal default)
  });
});

// ═══════════════════════════════════════════════════════
// ТЕСТЫ JobPriorityQueue
// ═══════════════════════════════════════════════════════

describe('JobPriorityQueue', () => {
  let queue: JobPriorityQueue;

  beforeEach(() => {
    queue = new JobPriorityQueue();
  });

  describe('enqueue/dequeue', () => {
    it('должен добавлять и извлекать элементы', () => {
      queue.enqueue('job-1', 'normal', { test: 'data' });
      
      expect(queue.size()).toBe(1);
      
      const item = queue.dequeue();
      expect(item).toBeDefined();
      expect(item?.id).toBe('job-1');
      expect(item?.priority).toBe('normal');
      expect(queue.size()).toBe(0);
    });

    it('должен возвращать undefined при извлечении из пустой очереди', () => {
      expect(queue.dequeue()).toBeUndefined();
    });

    it('должен извлекать элементы в порядке приоритета', () => {
      queue.enqueue('job-low', 'low', {});
      queue.enqueue('job-high', 'high', {});
      queue.enqueue('job-normal', 'normal', {});

      expect(queue.dequeue()?.id).toBe('job-high');
      expect(queue.dequeue()?.id).toBe('job-normal');
      expect(queue.dequeue()?.id).toBe('job-low');
    });
  });

  describe('peek', () => {
    it('должен возвращать первый элемент без удаления', () => {
      queue.enqueue('job-1', 'high', {});
      queue.enqueue('job-2', 'low', {});

      const item = queue.peek();
      expect(item?.id).toBe('job-1');
      expect(queue.size()).toBe(2);
    });

    it('должен возвращать undefined для пустой очереди', () => {
      expect(queue.peek()).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('должен удалять элемент по ID', () => {
      queue.enqueue('job-1', 'high', {});
      queue.enqueue('job-2', 'normal', {});

      expect(queue.remove('job-1')).toBe(true);
      expect(queue.size()).toBe(1);
      expect(queue.peek()?.id).toBe('job-2');
    });

    it('должен возвращать false если элемент не найден', () => {
      queue.enqueue('job-1', 'high', {});
      expect(queue.remove('non-existent')).toBe(false);
      expect(queue.size()).toBe(1);
    });
  });

  describe('size/isEmpty', () => {
    it('должен корректно возвращать размер', () => {
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);

      queue.enqueue('job-1', 'normal', {});
      expect(queue.size()).toBe(1);
      expect(queue.isEmpty()).toBe(false);

      queue.enqueue('job-2', 'high', {});
      expect(queue.size()).toBe(2);
    });
  });

  describe('clear', () => {
    it('должен очищать очередь', () => {
      queue.enqueue('job-1', 'high', {});
      queue.enqueue('job-2', 'normal', {});

      queue.clear();

      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });
  });

  describe('getAll', () => {
    it('должен возвращать все элементы без data', () => {
      queue.enqueue('job-1', 'high', { secret: 'data' });
      queue.enqueue('job-2', 'normal', {});

      const all = queue.getAll();

      expect(all.length).toBe(2);
      expect(all[0].id).toBe('job-1');
      expect(all[0].priority).toBe('high');
      expect('data' in all[0]).toBe(false);
    });
  });
});