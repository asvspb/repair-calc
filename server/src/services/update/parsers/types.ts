/**
 * Типы и интерфейсы для парсеров цен
 * UPDATE_SERVICE - Specification v1.1
 */

/**
 * Запрос на получение цены
 */
export interface PriceRequest {
  itemName: string;
  category: 'work' | 'material' | 'tool';
  city: string;
  unit?: string;
}

/**
 * Результат парсинга цены
 */
export interface PriceResult {
  prices: {
    min: number;
    avg: number;
    max: number;
    currency: string;
  };
  sources: string[];
  confidenceScore: number;  // 0.00 - 1.00
  raw?: unknown;
  requiresReview?: boolean;  // Флаг аномалии
}

/**
 * Ограничения источника (Rate Limit)
 */
export interface RateLimit {
  requestsPerMinute: number;
  requestsPerDay: number;
  concurrentRequests: number;
}

/**
 * Интерфейс парсера
 */
export interface PriceParser {
  name: string;
  type: string;

  isAvailable(): Promise<boolean>;

  fetch(request: PriceRequest): Promise<PriceResult>;

  getRateLimit(): RateLimit;
}

/**
 * Состояние Circuit Breaker
 */
export interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailureTime: number | null;
}

/**
 * Результат парсинга товара из каталога
 */
export interface ParsedProduct {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  rawPrice: string;
  url: string;
  description?: string;
}

/**
 * Результат парсинга категории
 */
export interface ParsedCategory {
  id: string;
  name: string;
  href: string;
}

/**
 * Данные каталога
 */
export interface CatalogData {
  categories: ParsedCategory[];
  products: ParsedProduct[];
}

/**
 * Ошибка парсера
 */
export class ParserError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean = false,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ParserError';
  }
}

/**
 * Ошибка Circuit Breaker
 */
export class CircuitBreakerOpenError extends ParserError {
  constructor(message: string) {
    super(message, false, 'CIRCUIT_BREAKER_OPEN');
    this.name = 'CircuitBreakerOpenError';
  }
}
