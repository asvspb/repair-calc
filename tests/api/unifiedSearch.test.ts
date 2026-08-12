/**
 * Тесты для унифицированного поиска цен через серверный прокси
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

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

// Мокаем httpClient
const httpClientMock = {
  get: vi.fn(),
  post: vi.fn(),
};

vi.mock('../../src/api/httpClient', () => ({
  get httpClient() {
    return httpClientMock;
  },
}));

// Модули импортируются динамически в каждом тесте через vi.resetModules()
// чтобы сбросить кэш статуса AI

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
  httpClientMock.get.mockReset();
  httpClientMock.post.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Вспомогательная функция: мок успешного статуса AI
function mockAIStatusAvailable(providerType = 'ai_gemini') {
  httpClientMock.get.mockResolvedValueOnce({
    status: 'success',
    data: {
      available: true,
      provider: { name: providerType === 'ai_gemini' ? 'Google Gemini' : 'Mistral AI', type: providerType },
    },
  });
}

// Вспомогательная функция: мок результата поиска цены
function mockSearchPriceResult(overrides = {}) {
  const defaultResult = {
    product: 'Обои флизелиновые',
    city: 'Москва',
    prices: { min: 800, avg: 1200, max: 1800, currency: 'RUB' },
    sources: ['Леруа Мерлен', 'Петрович', 'ОБИ'],
    confidence: 'high' as const,
    lastUpdated: '2026-03-10',
    disclaimer: 'Данные ориентировочные',
  };

  return {
    status: 'success',
    data: { ...defaultResult, ...overrides },
    meta: { provider: 'Google Gemini', cached: false },
  };
}

describe('unifiedSearch (server proxy)', () => {
  describe('searchPrice', () => {
    it('should search price via server proxy', async () => {
      // Переимпортируем для чистого кэша
      vi.resetModules();

      // Переустанавливаем моки после resetModules
      const { httpClient: hc } = await import('../../src/api/httpClient');
      hc.get = httpClientMock.get;
      hc.post = httpClientMock.post;

      const { searchPrice: sp } = await import('../../src/api/prices/unifiedSearch');

      // Мокаем статус AI
      mockAIStatusAvailable();

      // Мокаем результат поиска
      httpClientMock.post.mockResolvedValueOnce(mockSearchPriceResult());

      const result = await sp({
        productName: 'Обои',
        city: 'Москва',
      });

      expect(result.product).toBe('Обои флизелиновые');
      expect(result.prices.avg).toBe(1200);
      expect(result.sources).toHaveLength(3);
      expect(result.confidence).toBe('high');

      // Проверяем что запрос пошёл на серверный прокси
      expect(httpClientMock.post).toHaveBeenCalledWith(
        '/api/ai/search-price',
        expect.objectContaining({
          productName: 'Обои',
          city: 'Москва',
          useCache: true,
        })
      );
    });

    it('should use client-side cache on second call', async () => {
      vi.resetModules();
      const { httpClient: hc } = await import('../../src/api/httpClient');
      hc.get = httpClientMock.get;
      hc.post = httpClientMock.post;

      const { searchPrice: sp } = await import('../../src/api/prices/unifiedSearch');

      mockAIStatusAvailable();
      httpClientMock.post.mockResolvedValueOnce(mockSearchPriceResult());

      // Первый вызов
      await sp({ productName: 'Плитка', city: 'Волгоград' });

      // Второй вызов — должен использовать клиентский кэш
      const result = await sp({ productName: 'Плитка', city: 'Волгоград' });

      // httpClient.post должен быть вызван только 1 раз
      expect(httpClientMock.post).toHaveBeenCalledTimes(1);
      expect(result.prices.avg).toBe(1200);
    });

    it('should skip cache when skipCache is true', async () => {
      vi.resetModules();
      const { httpClient: hc } = await import('../../src/api/httpClient');
      hc.get = httpClientMock.get;
      hc.post = httpClientMock.post;

      const { searchPrice: sp } = await import('../../src/api/prices/unifiedSearch');

      mockAIStatusAvailable();
      httpClientMock.post.mockResolvedValue(mockSearchPriceResult());

      // Первый вызов
      await sp({ productName: 'Краска', city: 'СПб' });

      // Второй вызов с skipCache
      await sp({ productName: 'Краска', city: 'СПб' }, { skipCache: true });

      // httpClient.post должен быть вызван 2 раза
      expect(httpClientMock.post).toHaveBeenCalledTimes(2);

      // Проверяем что useCache=false передано на сервер
      expect(httpClientMock.post).toHaveBeenLastCalledWith(
        '/api/ai/search-price',
        expect.objectContaining({ useCache: false })
      );
    });

    it('should throw when AI is not available on server', async () => {
      vi.resetModules();
      const { httpClient: hc } = await import('../../src/api/httpClient');
      hc.get = httpClientMock.get;
      hc.post = httpClientMock.post;

      const { searchPrice: sp } = await import('../../src/api/prices/unifiedSearch');

      // Мокаем статус: AI недоступен
      httpClientMock.get.mockResolvedValueOnce({
        status: 'success',
        data: { available: false, provider: null },
      });

      await expect(sp({ productName: 'Тест', city: 'Москва' })).rejects.toMatchObject({
        type: 'invalidKey',
        retryable: false,
      });
    });

    it('should retry on network error', async () => {
      vi.resetModules();
      const { httpClient: hc } = await import('../../src/api/httpClient');
      hc.get = httpClientMock.get;
      hc.post = httpClientMock.post;

      const { searchPrice: sp } = await import('../../src/api/prices/unifiedSearch');

      mockAIStatusAvailable();

      // Первый вызов - ошибка сети
      httpClientMock.post.mockRejectedValueOnce(new Error('Failed to fetch'));

      // Второй вызов - успех
      httpClientMock.post.mockResolvedValueOnce(mockSearchPriceResult());

      const result = await sp(
        { productName: 'Тест', city: 'Москва' },
        { maxRetries: 1 }
      );

      expect(httpClientMock.post).toHaveBeenCalledTimes(2);
      expect(result.prices.avg).toBe(1200);
    }, 10000);

    it('should throw rate limit error on 429', async () => {
      vi.resetModules();
      const { httpClient: hc } = await import('../../src/api/httpClient');
      hc.get = httpClientMock.get;
      hc.post = httpClientMock.post;

      const { searchPrice: sp } = await import('../../src/api/prices/unifiedSearch');

      mockAIStatusAvailable();

      // Ошибка 429
      const error = new Error('API error: 429 - rate limit exceeded');
      httpClientMock.post.mockRejectedValue(error);

      await expect(
        sp({ productName: 'Тест', city: 'Москва' }, { maxRetries: 0 })
      ).rejects.toMatchObject({
        type: 'rateLimit',
        retryable: true,
      });
    });

    it('should pass category and brand to server', async () => {
      vi.resetModules();
      const { httpClient: hc } = await import('../../src/api/httpClient');
      hc.get = httpClientMock.get;
      hc.post = httpClientMock.post;

      const { searchPrice: sp } = await import('../../src/api/prices/unifiedSearch');

      mockAIStatusAvailable();
      httpClientMock.post.mockResolvedValueOnce(mockSearchPriceResult());

      await sp({
        productName: 'Обои',
        city: 'Москва',
        category: 'отделка',
        brand: 'Palitra',
      });

      expect(httpClientMock.post).toHaveBeenCalledWith(
        '/api/ai/search-price',
        expect.objectContaining({
          category: 'отделка',
          brand: 'Palitra',
        })
      );
    });
  });
});
