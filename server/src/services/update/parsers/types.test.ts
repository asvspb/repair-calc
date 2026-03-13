/**
 * Тесты для типов и ошибок парсеров
 */

import { describe, it, expect } from 'vitest';
import { ParserError, CircuitBreakerOpenError } from './types';

describe('Parser Types', () => {
  describe('ParserError', () => {
    it('should create error with default values', () => {
      const error = new ParserError('Test error');

      expect(error.name).toBe('ParserError');
      expect(error.message).toBe('Test error');
      expect(error.retryable).toBe(false);
      expect(error.code).toBeUndefined();
    });

    it('should create error with custom retryable flag', () => {
      const error = new ParserError('Retryable error', true);

      expect(error.retryable).toBe(true);
    });

    it('should create error with custom code', () => {
      const error = new ParserError('Error with code', false, 'CUSTOM_CODE');

      expect(error.code).toBe('CUSTOM_CODE');
    });

    it('should be instance of Error', () => {
      const error = new ParserError('Test');

      expect(error).toBeInstanceOf(Error);
    });

    it('should preserve stack trace', () => {
      const error = new ParserError('Test error');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('ParserError');
    });
  });

  describe('CircuitBreakerOpenError', () => {
    it('should create error with correct name', () => {
      const error = new CircuitBreakerOpenError('Circuit is open');

      expect(error.name).toBe('CircuitBreakerOpenError');
      expect(error.message).toBe('Circuit is open');
    });

    it('should have retryable set to false', () => {
      const error = new CircuitBreakerOpenError('Circuit is open');

      expect(error.retryable).toBe(false);
    });

    it('should have code set to CIRCUIT_BREAKER_OPEN', () => {
      const error = new CircuitBreakerOpenError('Circuit is open');

      expect(error.code).toBe('CIRCUIT_BREAKER_OPEN');
    });

    it('should be instance of ParserError', () => {
      const error = new CircuitBreakerOpenError('Circuit is open');

      expect(error).toBeInstanceOf(ParserError);
    });

    it('should be instance of Error', () => {
      const error = new CircuitBreakerOpenError('Circuit is open');

      expect(error).toBeInstanceOf(Error);
    });
  });
});

describe('Type interfaces (compile-time checks)', () => {
  it('should accept valid PriceRequest', () => {
    const request = {
      itemName: 'Штукатурка',
      category: 'material' as const,
      city: 'Москва',
      unit: 'кг',
    };

    expect(request.itemName).toBe('Штукатурка');
    expect(request.category).toBe('material');
    expect(request.city).toBe('Москва');
    expect(request.unit).toBe('кг');
  });

  it('should accept valid PriceResult', () => {
    const result = {
      prices: {
        min: 100,
        avg: 150,
        max: 200,
        currency: 'RUB',
      },
      sources: ['shop1', 'shop2'],
      confidenceScore: 0.85,
      requiresReview: false,
    };

    expect(result.prices.avg).toBe(150);
    expect(result.confidenceScore).toBe(0.85);
  });

  it('should accept valid RateLimit', () => {
    const limit = {
      requestsPerMinute: 60,
      requestsPerDay: 1000,
      concurrentRequests: 5,
    };

    expect(limit.requestsPerMinute).toBe(60);
    expect(limit.concurrentRequests).toBe(5);
  });

  it('should accept valid CircuitBreakerState', () => {
    const state = {
      state: 'closed' as const,
      failures: 0,
      lastFailureTime: null,
    };

    expect(state.state).toBe('closed');
    expect(state.failures).toBe(0);
  });

  it('should accept valid ParsedProduct', () => {
    const product = {
      id: '123',
      categoryId: 'cat1',
      name: 'Товар',
      price: 1000,
      rawPrice: '1 000 ₽',
      url: 'https://example.com/product/123',
      description: 'Описание',
    };

    expect(product.id).toBe('123');
    expect(product.price).toBe(1000);
  });

  it('should accept valid ParsedCategory', () => {
    const category = {
      id: 'cat1',
      name: 'Категория',
      href: 'https://example.com/catalog/cat1',
    };

    expect(category.id).toBe('cat1');
    expect(category.name).toBe('Категория');
  });

  it('should accept valid CatalogData', () => {
    const data = {
      categories: [
        { id: 'cat1', name: 'Категория 1', href: 'https://example.com/cat1' },
      ],
      products: [
        { id: 'prod1', categoryId: 'cat1', name: 'Товар 1', price: 100, rawPrice: '100 ₽', url: 'https://example.com/prod1' },
      ],
    };

    expect(data.categories).toHaveLength(1);
    expect(data.products).toHaveLength(1);
  });
});

describe('Error type guards', () => {
  const isErrorWithCode = (error: unknown, code: string): error is ParserError => {
    return error instanceof ParserError && error.code === code;
  };

  it('should identify ParserError with specific code', () => {
    const error = new ParserError('Test', false, 'TEST_CODE');

    expect(isErrorWithCode(error, 'TEST_CODE')).toBe(true);
    expect(isErrorWithCode(error, 'OTHER_CODE')).toBe(false);
  });

  it('should identify CircuitBreakerOpenError', () => {
    const error = new CircuitBreakerOpenError('Open');

    expect(isErrorWithCode(error, 'CIRCUIT_BREAKER_OPEN')).toBe(true);
  });

  it('should reject non-ParserError', () => {
    const error = new Error('Regular error');

    expect(isErrorWithCode(error, 'TEST_CODE')).toBe(false);
  });
});
