/**
 * Web Scraper Aggregator
 * 
 * Агрегирует результаты из нескольких веб-скраперов:
 * - Lemana PRO (lemanapro.ru)
 * - Bazavit (bazavit.ru)
 * - Future: Ozon, YandexMarket, Petrovich
 * 
 * Особенности:
 * - Параллельные запросы к источникам
 * - Circuit Breaker для каждого источника
 * - Агрегация и усреднение цен
 * - Приоритизация источников
 * 
 * @package server/src/services/update/parsers
 */

import type { PriceParser, PriceRequest, PriceResult, RateLimit } from './types';
import { ParserError, CircuitBreakerOpenError } from './types';
import { LemanaParser } from './lemanaParser.js';
import { BazavitParser } from './bazavitParser.js';
import { CircuitBreaker } from './circuitBreaker.js';

/**
 * Конфигурация источника скрапера
 */
export interface ScraperSource {
  name: string;
  parser: PriceParser;
  priority: number;           // Чем меньше, тем выше приоритет
  enabled: boolean;
  circuitBreaker: CircuitBreaker;
}

/**
 * Результат скрапинга одного источника
 */
export interface ScraperResult {
  source: string;
  result?: PriceResult;
  error?: Error;
  durationMs: number;
  fromCache: boolean;
}

/**
 * Конфигурация WebScraperParser
 */
export interface WebScraperConfig {
  /** Параллельные запросы к источникам */
  concurrentRequests: boolean;
  /** Таймаут для каждого источника (мс) */
  sourceTimeoutMs: number;
  /** Минимальное количество успешных источников для валидного результата */
  minSuccessfulSources: number;
  /** Использовать кэширование */
  cacheEnabled: boolean;
  /** TTL кэша (мс) */
  cacheTtlMs: number;
  /** Порог Circuit Breaker */
  circuitBreakerThreshold: number;
  /** Timeout Circuit Breaker (мс) */
  circuitBreakerResetMs: number;
}

const DEFAULT_CONFIG: WebScraperConfig = {
  concurrentRequests: true,
  sourceTimeoutMs: 30000,      // 30 секунд
  minSuccessfulSources: 1,
  cacheEnabled: true,
  cacheTtlMs: 3600000,         // 1 час
  circuitBreakerThreshold: 5,
  circuitBreakerResetMs: 600000, // 10 минут
};

/**
 * In-memory кэш для результатов
 */
class ScraperCache {
  private cache = new Map<string, { result: PriceResult; expiresAt: number }>();

  get(key: string): PriceResult | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.result;
    }
    this.cache.delete(key);
    return null;
  }

  set(key: string, result: PriceResult, ttlMs: number): void {
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + ttlMs,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Web Scraper Aggregator
 * 
 * Объединяет несколько веб-скраперов и агрегирует их результаты.
 */
export class WebScraperParser implements PriceParser {
  name = 'Web Scraper Aggregator';
  type = 'web_scraper';

  private config: WebScraperConfig;
  private sources: ScraperSource[] = [];
  private cache: ScraperCache;

  constructor(config: Partial<WebScraperConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new ScraperCache();

    // Инициализация источников
    this.initializeSources();
  }

  /**
   * Инициализация источников скраперов
   */
  private initializeSources(): void {
    // Lemana PRO - высокий приоритет (бывший Леруа Мерлен)
    this.addSource({
      name: 'LemanaPRO',
      parser: new LemanaParser(),
      priority: 1,
      enabled: true,
    });

    // Bazavit - средний приоритет
    this.addSource({
      name: 'Bazavit',
      parser: new BazavitParser(),
      priority: 2,
      enabled: true,
    });

    // Future: Добавить другие источники
    // this.addSource({ name: 'Ozon', parser: new OzonParser(), priority: 3, enabled: false });
    // this.addSource({ name: 'YandexMarket', parser: new YandexMarketParser(), priority: 4, enabled: false });
    // this.addSource({ name: 'Petrovich', parser: new PetrovichParser(), priority: 5, enabled: false });
  }

  /**
   * Добавление источника
   */
  addSource(source: Omit<ScraperSource, 'circuitBreaker'>): void {
    this.sources.push({
      ...source,
      circuitBreaker: new CircuitBreaker(source.name, {
        threshold: this.config.circuitBreakerThreshold,
        resetTimeoutMs: this.config.circuitBreakerResetMs,
        halfOpenMaxRequests: 3,
      }),
    });

    // Сортировка по приоритету
    this.sources.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Включение/выключение источника
   */
  setSourceEnabled(name: string, enabled: boolean): void {
    const source = this.sources.find(s => s.name === name);
    if (source) {
      source.enabled = enabled;
    }
  }

  /**
   * Получение списка источников
   */
  getSources(): Array<{ name: string; priority: number; enabled: boolean; available: boolean }> {
    return this.sources.map(s => ({
      name: s.name,
      priority: s.priority,
      enabled: s.enabled,
      available: s.circuitBreaker.getState().state !== 'open',
    }));
  }

  /**
   * Проверка доступности (хотя бы один источник доступен)
   */
  async isAvailable(): Promise<boolean> {
    return this.sources.some(s => s.enabled && s.circuitBreaker.getState().state !== 'open');
  }

  /**
   * Получение ограничений (Rate Limit)
   */
  getRateLimit(): RateLimit {
    // Суммируем лимиты всех активных источников
    const activeSources = this.sources.filter(s => s.enabled);
    
    return {
      requestsPerMinute: Math.min(...activeSources.map(s => s.parser.getRateLimit().requestsPerMinute)),
      requestsPerDay: activeSources.reduce((sum, s) => sum + s.parser.getRateLimit().requestsPerDay, 0),
      concurrentRequests: activeSources.length,
    };
  }

  /**
   * Получение цены (агрегация из нескольких источников)
   */
  async fetch(request: PriceRequest): Promise<PriceResult> {
    const cacheKey = this.getCacheKey(request);

    // Проверка кэша
    if (this.config.cacheEnabled) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return { ...cached, raw: { ...cached.raw, fromCache: true } };
      }
    }

    // Получение результатов от всех источников
    const results = await this.fetchFromSources(request);

    // Проверка минимального количества успешных источников
    const successful = results.filter(r => r.result);
    if (successful.length < this.config.minSuccessfulSources) {
      const errors = results.filter(r => r.error).map(r => `${r.source}: ${r.error?.message}`);
      throw new ParserError(
        `Not enough successful sources (${successful.length}/${this.config.minSuccessfulSources}). Errors: ${errors.join('; ')}`,
        true
      );
    }

    // Агрегация результатов
    const aggregated = this.aggregateResults(successful, request);

    // Сохранение в кэш
    if (this.config.cacheEnabled) {
      this.cache.set(cacheKey, aggregated, this.config.cacheTtlMs);
    }

    return aggregated;
  }

  /**
   * Запрос к источникам
   */
  private async fetchFromSources(request: PriceRequest): Promise<ScraperResult[]> {
    const availableSources = this.sources.filter(
      s => s.enabled && s.circuitBreaker.getState().state !== 'open'
    );

    if (availableSources.length === 0) {
      throw new ParserError('No available web scraper sources', false);
    }

    if (this.config.concurrentRequests) {
      // Параллельные запросы
      return Promise.all(
        availableSources.map(source => this.fetchFromSource(source, request))
      );
    } else {
      // Последовательные запросы (по приоритету)
      const results: ScraperResult[] = [];
      for (const source of availableSources) {
        const result = await this.fetchFromSource(source, request);
        results.push(result);
        
        // Если получили хороший результат от высокоприоритетного источника, можно остановиться
        if (result.result && result.result.confidenceScore >= 0.8) {
          break;
        }
      }
      return results;
    }
  }

  /**
   * Запрос к одному источнику с Circuit Breaker
   */
  private async fetchFromSource(source: ScraperSource, request: PriceRequest): Promise<ScraperResult> {
    const startTime = Date.now();

    try {
      // Проверка Circuit Breaker
      const cbState = source.circuitBreaker.getState();
      if (cbState.state === 'open') {
        throw new CircuitBreakerOpenError(`Circuit breaker open for ${source.name}`);
      }

      // Выполнение запроса с таймаутом
      const result = await this.withTimeout(
        source.parser.fetch(request),
        this.config.sourceTimeoutMs
      );

      // Успех - сброс Circuit Breaker
      source.circuitBreaker.recordSuccess();

      return {
        source: source.name,
        result,
        durationMs: Date.now() - startTime,
        fromCache: false,
      };
    } catch (error) {
      // Ошибка - запись в Circuit Breaker
      source.circuitBreaker.recordFailure();

      return {
        source: source.name,
        error: error instanceof Error ? error : new Error('Unknown error'),
        durationMs: Date.now() - startTime,
        fromCache: false,
      };
    }
  }

  /**
   * Агрегация результатов из нескольких источников
   */
  private aggregateResults(results: ScraperResult[], request: PriceRequest): PriceResult {
    const allPrices: number[] = [];
    const allSources: string[] = [];
    let totalConfidence = 0;
    const rawData: Record<string, unknown> = {};

    for (const { source, result } of results) {
      if (!result) continue;

      allPrices.push(result.prices.avg);
      allSources.push(...result.sources);
      totalConfidence += result.confidenceScore;
      rawData[source] = {
        prices: result.prices,
        confidenceScore: result.confidenceScore,
      };
    }

    // Вычисление агрегированных цен
    const minPrice = Math.min(...results.map(r => r.result!.prices.min));
    const maxPrice = Math.max(...results.map(r => r.result!.prices.max));
    const avgPrice = allPrices.reduce((a, b) => a + b, 0) / allPrices.length;
    
    // Средняя уверенность с бонусом за количество источников
    const avgConfidence = totalConfidence / results.length;
    const sourceBonus = Math.min(0.1, results.length * 0.03);
    const finalConfidence = Math.min(1.0, avgConfidence + sourceBonus);

    // Уникальные источники
    const uniqueSources = [...new Set(allSources)];

    return {
      prices: {
        min: minPrice,
        avg: Math.round(avgPrice * 100) / 100, // Округление до 2 знаков
        max: maxPrice,
        currency: 'RUB',
      },
      sources: uniqueSources,
      confidenceScore: finalConfidence,
      raw: {
        aggregated: true,
        sourcesCount: results.length,
        sourceDetails: rawData,
        request: {
          itemName: request.itemName,
          category: request.category,
          city: request.city,
        },
      },
    };
  }

  /**
   * Ключ кэширования
   */
  private getCacheKey(request: PriceRequest): string {
    return `${request.itemName}:${request.city}:${request.category}`;
  }

  /**
   * Таймаут для Promise
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new ParserError('Request timeout', true)), timeoutMs)
      ),
    ]);
  }

  /**
   * Очистка кэша
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Размер кэша
   */
  getCacheSize(): number {
    return this.cache.size();
  }

  /**
   * Сброс Circuit Breaker для всех источников
   */
  resetCircuitBreakers(): void {
    for (const source of this.sources) {
      source.circuitBreaker.reset();
    }
  }

  /**
   * Закрытие всех парсеров
   */
  async close(): Promise<void> {
    for (const source of this.sources) {
      if ('close' in source.parser && typeof source.parser.close === 'function') {
        await (source.parser.close as () => Promise<void>)();
      }
    }
  }
}

/**
 * Singleton экземпляр
 */
let webScraperInstance: WebScraperParser | null = null;

/**
 * Получение singleton экземпляра WebScraperParser
 */
export function getWebScraper(config?: Partial<WebScraperConfig>): WebScraperParser {
  if (!webScraperInstance) {
    webScraperInstance = new WebScraperParser(config);
  }
  return webScraperInstance;
}

/**
 * Сброс singleton (для тестов)
 */
export function resetWebScraper(): void {
  if (webScraperInstance) {
    webScraperInstance.close().catch(() => {});
    webScraperInstance = null;
  }
}