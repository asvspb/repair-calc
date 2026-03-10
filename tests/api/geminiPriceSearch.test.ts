/**
 * Тесты для поиска цен через Gemini
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Мокаем import.meta.env
vi.stubEnv('VITE_GEMINI_API_KEY', 'test-api-key');

// Мокаем fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

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

// Импортируем после моков
import {
  searchPrice,
  isGeminiConfigured,
} from '../../src/api/prices/geminiPriceSearch';

describe('geminiPriceSearch', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isGeminiConfigured', () => {
    it('should return true when API key is set', () => {
      // В тесте env замокан
      expect(isGeminiConfigured()).toBe(true);
    });
  });

  describe('searchPrice', () => {
    const mockGeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
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
                }),
              },
            ],
          },
        },
      ],
    };

    it('should search price successfully', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGeminiResponse),
      });

      const result = await searchPrice({
        productName: 'Обои',
        city: 'Москва',
      });

      expect(result.product).toBe('Обои флизелиновые');
      expect(result.prices.avg).toBe(1200);
      expect(result.sources).toHaveLength(3);
      expect(result.confidence).toBe('high');
    });

    it('should use cache on second call', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGeminiResponse),
      });

      // Первый вызов
      await searchPrice({
        productName: 'Плитка',
        city: 'Волгоград',
      });

      // Второй вызов - должен использовать кэш
      const result = await searchPrice({
        productName: 'Плитка',
        city: 'Волгоград',
      });

      // fetch должен быть вызван только 1 раз
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.prices.avg).toBe(1200);
    });

    it('should skip cache when skipCache is true', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockGeminiResponse),
      });

      // Первый вызов
      await searchPrice({
        productName: 'Краска',
        city: 'СПб',
      });

      // Второй вызов с skipCache
      await searchPrice({
        productName: 'Краска',
        city: 'СПб',
      }, { skipCache: true });

      // fetch должен быть вызван 2 раза
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('should handle markdown-formatted response', async () => {
      const markdownResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: '```json\n' + JSON.stringify({
                    product: 'Ламинат',
                    city: 'Москва',
                    prices: { min: 500, avg: 800, max: 1200, currency: 'RUB' },
                    sources: ['Леруа Мерлен'],
                    confidence: 'low',
                    lastUpdated: '2026-03-10',
                    disclaimer: 'Тест',
                  }) + '\n```',
                },
              ],
            },
          },
        ],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(markdownResponse),
      });

      const result = await searchPrice({
        productName: 'Ламинат',
        city: 'Москва',
      });

      expect(result.product).toBe('Ламинат');
      expect(result.prices.avg).toBe(800);
    });

    it('should throw on API error', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(searchPrice({
        productName: 'Тест',
        city: 'Москва',
      })).rejects.toMatchObject({
        type: 'invalidKey',
      });
    });

    it('should throw on rate limit', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limit exceeded'),
      });

      await expect(searchPrice({
        productName: 'Тест',
        city: 'Москва',
      }, { maxRetries: 0 })).rejects.toMatchObject({
        type: 'rateLimit',
        retryable: true,
      });
    });

    it('should throw on invalid JSON response', async () => {
      const invalidResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: 'not a valid json' }],
            },
          },
        ],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(invalidResponse),
      });

      await expect(searchPrice({
        productName: 'Тест',
        city: 'Москва',
      })).rejects.toMatchObject({
        type: 'parse',
      });
    });

    it('should throw on empty response', async () => {
      const emptyResponse = {
        candidates: [],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(emptyResponse),
      });

      await expect(searchPrice({
        productName: 'Тест',
        city: 'Москва',
      })).rejects.toMatchObject({
        type: 'parse',
      });
    });

    it('should retry on network error', async () => {
      // Первый вызов - ошибка сети
      fetchMock.mockRejectedValueOnce(new Error('network error'));
      
      // Второй вызов - успех
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockGeminiResponse),
      });

      const result = await searchPrice({
        productName: 'Тест',
        city: 'Москва',
      }, { maxRetries: 1 });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result.prices.avg).toBe(1200);
    });

    it('should fill missing prices with avg', async () => {
      const responseWithMissing = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    product: 'Тест',
                    city: 'Москва',
                    prices: { avg: 1000 },
                    sources: [],
                    confidence: 'low',
                    lastUpdated: '2026-03-10',
                    disclaimer: '',
                  }),
                },
              ],
            },
          },
        ],
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(responseWithMissing),
      });

      const result = await searchPrice({
        productName: 'Тест',
        city: 'Москва',
      }, { skipCache: true });

      expect(result.prices.min).toBe(1000);
      expect(result.prices.max).toBe(1000);
      expect(result.prices.currency).toBe('RUB');
    });
  });
});