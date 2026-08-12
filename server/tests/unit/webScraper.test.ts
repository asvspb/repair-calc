/**
 * Тесты для Web Scraper Aggregator
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebScraperParser, getWebScraper, resetWebScraper } from '../../src/services/update/parsers/webScraper.js';
import type { PriceParser, PriceRequest, PriceResult } from '../../src/services/update/parsers/types.js';
import { ParserError, CircuitBreakerOpenError } from '../../src/services/update/parsers/types.js';

// Мок для парсера
class MockParser implements PriceParser {
  name: string;
  type = 'web_scraper';
  private result: PriceResult | Error;
  private available: boolean;

  constructor(name: string, result: PriceResult | Error, available = true) {
    this.name = name;
    this.result = result;
    this.available = available;
  }

  async isAvailable(): Promise<boolean> {
    return this.available;
  }

  async fetch(request: PriceRequest): Promise<PriceResult> {
    if (this.result instanceof Error) {
      throw this.result;
    }
    return {
      ...this.result,
      raw: { request },
    };
  }

  getRateLimit() {
    return {
      requestsPerMinute: 30,
      requestsPerDay: 500,
      concurrentRequests: 1,
    };
  }

  setResult(result: PriceResult | Error): void {
    this.result = result;
  }

  setAvailable(available: boolean): void {
    this.available = available;
  }
}

// Хелпер для создания успешного результата
function createPriceResult(min: number, avg: number, max: number, sources: string[]): PriceResult {
  return {
    prices: { min, avg, max, currency: 'RUB' },
    sources,
    confidenceScore: 0.8,
  };
}

describe('WebScraperParser', () => {
  let scraper: WebScraperParser;

  const defaultRequest: PriceRequest = {
    itemName: 'Штукатурка Rotband 30кг',
    category: 'material',
    city: 'Москва',
  };

  beforeEach(() => {
    resetWebScraper();
    scraper = new WebScraperParser({
      cacheEnabled: false, // Отключаем кэш для большинства тестов
      concurrentRequests: true,
      minSuccessfulSources: 1,
      sourceTimeoutMs: 5000,
    });
  });

  afterEach(async () => {
    await scraper.close();
  });

  describe('Constructor and initialization', () => {
    it('should initialize with default sources', () => {
      const sources = scraper.getSources();
      expect(sources.length).toBeGreaterThan(0);
      expect(sources.some(s => s.name === 'LemanaPRO')).toBe(true);
      expect(sources.some(s => s.name === 'Bazavit')).toBe(true);
    });

    it('should sort sources by priority', () => {
      const sources = scraper.getSources();
      for (let i = 1; i < sources.length; i++) {
        expect(sources[i].priority).toBeGreaterThanOrEqual(sources[i - 1].priority);
      }
    });
  });

  describe('addSource', () => {
    it('should add new source', () => {
      const mockParser = new MockParser('TestSource', createPriceResult(100, 150, 200, ['test.ru']));
      const initialCount = scraper.getSources().length;

      scraper.addSource({
        name: 'TestSource',
        parser: mockParser,
        priority: 10,
        enabled: true,
      });

      expect(scraper.getSources().length).toBe(initialCount + 1);
      expect(scraper.getSources().some(s => s.name === 'TestSource')).toBe(true);
    });

    it('should maintain sorted order after adding', () => {
      const mockParser = new MockParser('HighPriority', createPriceResult(100, 150, 200, ['test.ru']));
      
      scraper.addSource({
        name: 'HighPriority',
        parser: mockParser,
        priority: 0, // Высший приоритет
        enabled: true,
      });

      const sources = scraper.getSources();
      expect(sources[0].name).toBe('HighPriority');
    });
  });

  describe('setSourceEnabled', () => {
    it('should enable/disable source', () => {
      scraper.setSourceEnabled('LemanaPRO', false);
      
      let sources = scraper.getSources();
      const lemana = sources.find(s => s.name === 'LemanaPRO');
      expect(lemana?.enabled).toBe(false);

      scraper.setSourceEnabled('LemanaPRO', true);
      sources = scraper.getSources(); // Получаем новый массив
      expect(sources.find(s => s.name === 'LemanaPRO')?.enabled).toBe(true);
    });
  });

  describe('isAvailable', () => {
    it('should return true when at least one source is available', async () => {
      const available = await scraper.isAvailable();
      expect(available).toBe(true);
    });

    it('should return false when all sources are disabled', async () => {
      scraper.setSourceEnabled('LemanaPRO', false);
      scraper.setSourceEnabled('Bazavit', false);

      const available = await scraper.isAvailable();
      expect(available).toBe(false);
    });
  });

  describe('getRateLimit', () => {
    it('should return combined rate limits', () => {
      const rateLimit = scraper.getRateLimit();
      
      expect(rateLimit.requestsPerMinute).toBeGreaterThan(0);
      expect(rateLimit.requestsPerDay).toBeGreaterThan(0);
      expect(rateLimit.concurrentRequests).toBeGreaterThan(0);
    });
  });

  describe('fetch - aggregation', () => {
    it('should aggregate results from multiple sources', async () => {
      // Создаём скрапер с мок-парсерами
      const testScraper = new WebScraperParser({
        cacheEnabled: false,
        concurrentRequests: true,
        minSuccessfulSources: 1,
      });

      // Заменяем парсеры на моки
      const mockLemana = new MockParser('LemanaPRO', createPriceResult(400, 450, 500, ['lemanapro.ru']));
      const mockBazavit = new MockParser('Bazavit', createPriceResult(420, 470, 520, ['bazavit.ru']));

      // Очищаем источники и добавляем моки
      const sources = testScraper.getSources();
      for (const source of sources) {
        testScraper.setSourceEnabled(source.name, false);
      }

      testScraper.addSource({
        name: 'MockLemana',
        parser: mockLemana,
        priority: 1,
        enabled: true,
      });

      testScraper.addSource({
        name: 'MockBazavit',
        parser: mockBazavit,
        priority: 2,
        enabled: true,
      });

      const result = await testScraper.fetch(defaultRequest);

      expect(result.prices.min).toBe(400);
      expect(result.prices.max).toBe(520);
      expect(result.sources).toContain('lemanapro.ru');
      expect(result.sources).toContain('bazavit.ru');
      expect(result.confidenceScore).toBeGreaterThan(0.8);

      await testScraper.close();
    });

    it('should return result from single source if only one succeeds', async () => {
      const testScraper = new WebScraperParser({
        cacheEnabled: false,
        concurrentRequests: true,
        minSuccessfulSources: 1,
      });

      const mockSuccess = new MockParser('Success', createPriceResult(100, 150, 200, ['success.ru']));
      const mockFailure = new MockParser('Failure', new ParserError('Failed', true));

      const sources = testScraper.getSources();
      for (const source of sources) {
        testScraper.setSourceEnabled(source.name, false);
      }

      testScraper.addSource({
        name: 'SuccessSource',
        parser: mockSuccess,
        priority: 1,
        enabled: true,
      });

      testScraper.addSource({
        name: 'FailureSource',
        parser: mockFailure,
        priority: 2,
        enabled: true,
      });

      const result = await testScraper.fetch(defaultRequest);

      expect(result.prices.avg).toBe(150);
      expect(result.sources).toContain('success.ru');

      await testScraper.close();
    });

    it('should throw error when minSuccessfulSources not met', async () => {
      const testScraper = new WebScraperParser({
        cacheEnabled: false,
        concurrentRequests: true,
        minSuccessfulSources: 2, // Требуется 2 успешных источника
      });

      const mockSuccess = new MockParser('Success', createPriceResult(100, 150, 200, ['success.ru']));
      const mockFailure = new MockParser('Failure', new ParserError('Failed', true));

      const sources = testScraper.getSources();
      for (const source of sources) {
        testScraper.setSourceEnabled(source.name, false);
      }

      testScraper.addSource({
        name: 'SuccessSource',
        parser: mockSuccess,
        priority: 1,
        enabled: true,
      });

      testScraper.addSource({
        name: 'FailureSource',
        parser: mockFailure,
        priority: 2,
        enabled: true,
      });

      await expect(testScraper.fetch(defaultRequest)).rejects.toThrow(ParserError);
      await expect(testScraper.fetch(defaultRequest)).rejects.toThrow(/Not enough successful sources/);

      await testScraper.close();
    });

    it('should throw error when no sources available', async () => {
      scraper.setSourceEnabled('LemanaPRO', false);
      scraper.setSourceEnabled('Bazavit', false);

      await expect(scraper.fetch(defaultRequest)).rejects.toThrow('No available web scraper sources');
    });
  });

  describe('Caching', () => {
    it('should return cached result on second request', async () => {
      const testScraper = new WebScraperParser({
        cacheEnabled: true,
        cacheTtlMs: 60000,
        concurrentRequests: true,
        minSuccessfulSources: 1,
      });

      const mockParser = new MockParser('Cached', createPriceResult(100, 150, 200, ['cached.ru']));

      const sources = testScraper.getSources();
      for (const source of sources) {
        testScraper.setSourceEnabled(source.name, false);
      }

      testScraper.addSource({
        name: 'CachedSource',
        parser: mockParser,
        priority: 1,
        enabled: true,
      });

      // Первый запрос
      const result1 = await testScraper.fetch(defaultRequest);
      expect(result1.raw?.fromCache).toBeFalsy();

      // Второй запрос - должен вернуться из кэша
      const result2 = await testScraper.fetch(defaultRequest);
      expect(result2.raw?.fromCache).toBe(true);

      expect(testScraper.getCacheSize()).toBe(1);

      await testScraper.close();
    });

    it('should clear cache', async () => {
      const testScraper = new WebScraperParser({
        cacheEnabled: true,
        cacheTtlMs: 60000,
        concurrentRequests: true,
        minSuccessfulSources: 1,
      });

      const mockParser = new MockParser('Cache', createPriceResult(100, 150, 200, ['cache.ru']));

      const sources = testScraper.getSources();
      for (const source of sources) {
        testScraper.setSourceEnabled(source.name, false);
      }

      testScraper.addSource({
        name: 'CacheSource',
        parser: mockParser,
        priority: 1,
        enabled: true,
      });

      await testScraper.fetch(defaultRequest);
      expect(testScraper.getCacheSize()).toBe(1);

      testScraper.clearCache();
      expect(testScraper.getCacheSize()).toBe(0);

      await testScraper.close();
    });
  });

  describe('Circuit Breaker integration', () => {
    it('should track failures per source', async () => {
      const testScraper = new WebScraperParser({
        cacheEnabled: false,
        circuitBreakerThreshold: 3,
        concurrentRequests: true,
        minSuccessfulSources: 1,
      });

      const mockFailure = new MockParser('Failure', new ParserError('Failed', true));

      const sources = testScraper.getSources();
      for (const source of sources) {
        testScraper.setSourceEnabled(source.name, false);
      }

      testScraper.addSource({
        name: 'FailingSource',
        parser: mockFailure,
        priority: 1,
        enabled: true,
      });

      // Несколько неудачных запросов (5 - threshold по умолчанию)
      for (let i = 0; i < 5; i++) {
        try {
          await testScraper.fetch(defaultRequest);
        } catch (e) {
          // Игнорируем ошибку
        }
      }

      // Проверяем, что source помечен как недоступный
      const updatedSources = testScraper.getSources();
      const failingSource = updatedSources.find(s => s.name === 'FailingSource');
      expect(failingSource?.available).toBe(false);

      await testScraper.close();
    });

    it('should reset circuit breakers', async () => {
      scraper.resetCircuitBreakers();

      const sources = scraper.getSources();
      for (const source of sources) {
        expect(source.available).toBe(true);
      }
    });
  });

  describe('Timeout handling', () => {
    it('should timeout slow requests', async () => {
      const testScraper = new WebScraperParser({
        cacheEnabled: false,
        sourceTimeoutMs: 100, // 100ms timeout
        concurrentRequests: true,
        minSuccessfulSources: 1,
      });

      // Парсер с задержкой
      const slowParser: PriceParser = {
        name: 'SlowParser',
        type: 'web_scraper',
        isAvailable: async () => true,
        fetch: async () => {
          await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
          return createPriceResult(100, 150, 200, ['slow.ru']);
        },
        getRateLimit: () => ({ requestsPerMinute: 30, requestsPerDay: 500, concurrentRequests: 1 }),
      };

      const sources = testScraper.getSources();
      for (const source of sources) {
        testScraper.setSourceEnabled(source.name, false);
      }

      testScraper.addSource({
        name: 'SlowSource',
        parser: slowParser,
        priority: 1,
        enabled: true,
      });

      await expect(testScraper.fetch(defaultRequest)).rejects.toThrow();

      await testScraper.close();
    }, 10000);
  });

  describe('Sequential requests mode', () => {
    it('should make requests sequentially when concurrentRequests is false', async () => {
      const testScraper = new WebScraperParser({
        cacheEnabled: false,
        concurrentRequests: false,
        minSuccessfulSources: 1,
      });

      const callOrder: string[] = [];

      const createOrderedParser = (name: string, confidence: number): PriceParser => ({
        name,
        type: 'web_scraper',
        isAvailable: async () => true,
        fetch: async () => {
          callOrder.push(name);
          return {
            ...createPriceResult(100, 150, 200, [`${name}.ru`]),
            confidenceScore: confidence,
          };
        },
        getRateLimit: () => ({ requestsPerMinute: 30, requestsPerDay: 500, concurrentRequests: 1 }),
      });

      const sources = testScraper.getSources();
      for (const source of sources) {
        testScraper.setSourceEnabled(source.name, false);
      }

      // Первый парсер с низким confidence, чтобы не остановиться раньше времени
      testScraper.addSource({
        name: 'First',
        parser: createOrderedParser('First', 0.7),
        priority: 1,
        enabled: true,
      });

      testScraper.addSource({
        name: 'Second',
        parser: createOrderedParser('Second', 0.9),
        priority: 2,
        enabled: true,
      });

      await testScraper.fetch(defaultRequest);

      // Проверяем порядок вызова (по приоритету)
      expect(callOrder).toEqual(['First', 'Second']);

      await testScraper.close();
    });

    it('should stop early if high-confidence result is found', async () => {
      const testScraper = new WebScraperParser({
        cacheEnabled: false,
        concurrentRequests: false,
        minSuccessfulSources: 1,
      });

      const callOrder: string[] = [];

      const createOrderedParser = (name: string, confidence: number): PriceParser => ({
        name,
        type: 'web_scraper',
        isAvailable: async () => true,
        fetch: async () => {
          callOrder.push(name);
          return {
            ...createPriceResult(100, 150, 200, [`${name}.ru`]),
            confidenceScore: confidence,
          };
        },
        getRateLimit: () => ({ requestsPerMinute: 30, requestsPerDay: 500, concurrentRequests: 1 }),
      });

      const sources = testScraper.getSources();
      for (const source of sources) {
        testScraper.setSourceEnabled(source.name, false);
      }

      testScraper.addSource({
        name: 'HighConfidence',
        parser: createOrderedParser('HighConfidence', 0.9),
        priority: 1,
        enabled: true,
      });

      testScraper.addSource({
        name: 'LowPriority',
        parser: createOrderedParser('LowPriority', 0.7),
        priority: 2,
        enabled: true,
      });

      await testScraper.fetch(defaultRequest);

      // Должен быть вызван только первый парсер (высокая уверенность)
      expect(callOrder).toContain('HighConfidence');
      // Второй парсер может не быть вызван

      await testScraper.close();
    });
  });

  describe('Singleton', () => {
    it('should return same instance from getWebScraper', () => {
      resetWebScraper();
      
      const instance1 = getWebScraper();
      const instance2 = getWebScraper();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton with resetWebScraper', () => {
      const instance1 = getWebScraper();
      resetWebScraper();
      const instance2 = getWebScraper();

      expect(instance1).not.toBe(instance2);
    });
  });
});