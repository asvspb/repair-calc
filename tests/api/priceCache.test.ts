/**
 * Тесты для кэша цен
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildCacheKey,
  getCachedPrice,
  setCachedPrice,
  clearPriceCache,
  getCacheStats,
} from '../../src/api/prices/priceCache';
import type { PriceSearchResult } from '../../src/api/prices/types';

// Мокаем localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('priceCache', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('buildCacheKey', () => {
    it('should build key from all params', () => {
      const key = buildCacheKey({
        productName: 'Обои',
        city: 'Москва',
        category: 'стены',
        brand: 'Palitra',
      });
      expect(key).toBe('обои|москва|стены|palitra');
    });

    it('should handle missing optional params', () => {
      const key = buildCacheKey({
        productName: 'Краска',
        city: 'СПб',
      });
      expect(key).toBe('краска|спб||');
    });

    it('should normalize case', () => {
      const key1 = buildCacheKey({ productName: 'ОБОИ', city: 'МОСКВА' });
      const key2 = buildCacheKey({ productName: 'обои', city: 'москва' });
      expect(key1).toBe(key2);
    });

    it('should trim whitespace', () => {
      const key = buildCacheKey({
        productName: '  Плитка  ',
        city: '  Волгоград  ',
      });
      expect(key).toBe('плитка|волгоград||');
    });
  });

  describe('getCachedPrice / setCachedPrice', () => {
    const mockResult: PriceSearchResult = {
      product: 'Обои флизелиновые',
      city: 'Москва',
      prices: {
        min: 800,
        avg: 1200,
        max: 1800,
        currency: 'RUB',
      },
      sources: ['Леруа Мерлен', 'Петрович', 'ОБИ'],
      confidence: 'high',
      lastUpdated: '2026-03-10',
      disclaimer: 'Данные ориентировочные',
    };

    it('should return null for missing key', () => {
      const result = getCachedPrice('nonexistent');
      expect(result).toBeNull();
    });

    it('should set and get cached result', () => {
      const key = buildCacheKey({ productName: 'Обои', city: 'Москва' });
      setCachedPrice(key, mockResult);

      const cached = getCachedPrice(key);
      expect(cached).toEqual(mockResult);
    });

    it('should update existing key', () => {
      const key = buildCacheKey({ productName: 'Краска', city: 'СПб' });

      const result1: PriceSearchResult = {
        ...mockResult,
        prices: { ...mockResult.prices, avg: 500 },
      };
      setCachedPrice(key, result1);

      const result2: PriceSearchResult = {
        ...mockResult,
        prices: { ...mockResult.prices, avg: 600 },
      };
      setCachedPrice(key, result2);

      const cached = getCachedPrice(key);
      expect(cached?.prices.avg).toBe(600);
    });

    it('should store cache in localStorage', () => {
      const key = buildCacheKey({ productName: 'Плитка', city: 'Волгоград' });
      setCachedPrice(key, mockResult);

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const storedKey = localStorageMock.setItem.mock.calls[0][0];
      expect(storedKey).toBe('repair-calc-price-cache');
    });
  });

  describe('getCacheStats', () => {
    it('should return empty stats for empty cache', () => {
      const stats = getCacheStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.validEntries).toBe(0);
      expect(stats.oldestEntry).toBeNull();
      expect(stats.newestEntry).toBeNull();
    });

    it('should return correct stats', () => {
      const mockResult: PriceSearchResult = {
        product: 'Test',
        city: 'Test',
        prices: { min: 100, avg: 200, max: 300, currency: 'RUB' },
        sources: [],
        confidence: 'low',
        lastUpdated: '2026-03-10',
        disclaimer: '',
      };

      setCachedPrice('key1', mockResult);
      setCachedPrice('key2', mockResult);

      const stats = getCacheStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.validEntries).toBe(2);
      expect(stats.oldestEntry).not.toBeNull();
      expect(stats.newestEntry).not.toBeNull();
    });
  });

  describe('clearPriceCache', () => {
    it('should clear all cache', () => {
      const mockResult: PriceSearchResult = {
        product: 'Test',
        city: 'Test',
        prices: { min: 100, avg: 200, max: 300, currency: 'RUB' },
        sources: [],
        confidence: 'low',
        lastUpdated: '2026-03-10',
        disclaimer: '',
      };

      setCachedPrice('key1', mockResult);
      clearPriceCache();

      const stats = getCacheStats();
      expect(stats.totalEntries).toBe(0);
    });
  });
});