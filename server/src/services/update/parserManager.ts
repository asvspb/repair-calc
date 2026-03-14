/**
 * Parser Manager - Управление парсерами цен
 * UPDATE_SERVICE - Specification v1.1
 */

import type { PriceParser, PriceRequest, PriceResult, RateLimit } from './parsers/types.js';
import { GeminiParser, getGeminiParser, isGeminiEnabled } from './parsers/gemini.js';
import { MistralParser, getMistralParser, isMistralEnabled } from './parsers/mistral.js';
import { CircuitBreaker } from './parsers/circuitBreaker.js';
import { RateLimiter } from './parsers/rateLimiter.js';
import { PriceSourceRepository } from '../../db/repositories/priceCatalog.repo.js';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════

export type ParserType = 'ai_gemini' | 'ai_mistral' | 'web_scraper' | 'api' | 'manual';

export interface ParserInfo {
  type: ParserType;
  name: string;
  available: boolean;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  rateLimit: RateLimit;
  lastSuccess: Date | null;
  avgResponseTimeMs: number | null;
}

export interface ABTestConfig {
  enabled: boolean;
  geminiWeight: number; // 0-100, процент запросов к Gemini
}

// ═══════════════════════════════════════════════════════
// PARSER MANAGER
// ═══════════════════════════════════════════════════════

class ParserManagerImpl {
  private parsers: Map<ParserType, PriceParser> = new Map();
  private circuitBreakers: Map<ParserType, CircuitBreaker> = new Map();
  private rateLimiters: Map<ParserType, RateLimiter> = new Map();
  private lastSuccess: Map<ParserType, Date> = new Map();
  private responseTimes: Map<ParserType, number[]> = new Map();
  private abTestConfig: ABTestConfig = {
    enabled: false,
    geminiWeight: 50,
  };

  constructor() {
    this.initializeParsers();
  }

  // ─── ИНИЦИАЛИЗАЦИЯ ────────────────────────────────────────

  private initializeParsers(): void {
    // Регистрируем Gemini
    if (isGeminiEnabled()) {
      const geminiParser = getGeminiParser();
      this.registerParser(geminiParser);
    }

    // Регистрируем Mistral
    if (isMistralEnabled()) {
      const mistralParser = getMistralParser();
      this.registerParser(mistralParser);
    }

    // Web scrapers будут добавлены позже
  }

  registerParser(parser: PriceParser): void {
    this.parsers.set(parser.type as ParserType, parser);
    this.circuitBreakers.set(
      parser.type as ParserType,
      new CircuitBreaker({
        failureThreshold: 5,
        resetTimeoutMs: 600000, // 10 минут
      })
    );
    this.rateLimiters.set(
      parser.type as ParserType,
      new RateLimiter(parser.getRateLimit().requestsPerMinute)
    );
    this.responseTimes.set(parser.type as ParserType, []);
  }

  // ─── ВЫБОР ПАРСЕРА ────────────────────────────────────────

  /**
   * Выбирает лучший доступный парсер для запроса
   */
  selectSource(request: PriceRequest, preferredSources?: ParserType[]): PriceParser | null {
    // A/B тестирование (если включено)
    if (this.abTestConfig.enabled && !preferredSources) {
      return this.selectForABTest(request);
    }

    // Фильтруем доступные парсеры
    const available = Array.from(this.parsers.entries())
      .filter(([type, parser]) => {
        // Если указаны предпочтительные источники
        if (preferredSources && !preferredSources.includes(type)) {
          return false;
        }

        // Проверяем доступность
        return this.isParserAvailable(type);
      })
      .sort(([typeA, parserA], [typeB, parserB]) => {
        // Сортируем по приоритету (по rate limit)
        const limitA = parserA.getRateLimit();
        const limitB = parserB.getRateLimit();
        return limitB.requestsPerMinute - limitA.requestsPerMinute;
      });

    return available[0]?.[1] || null;
  }

  /**
   * Выбор для A/B тестирования
   */
  private selectForABTest(request: PriceRequest): PriceParser | null {
    const hash = this.hashRequest(request);
    const lastChar = parseInt(hash.slice(-1), 16);
    
    // 50/50 распределение (или по конфигурации)
    const geminiWeight = this.abTestConfig.geminiWeight;
    
    if (lastChar < geminiWeight / 100 * 16) {
      const gemini = this.parsers.get('ai_gemini');
      if (gemini && this.isParserAvailable('ai_gemini')) {
        return gemini;
      }
    }
    
    const mistral = this.parsers.get('ai_mistral');
    if (mistral && this.isParserAvailable('ai_mistral')) {
      return mistral;
    }
    
    // Fallback на любой доступный
    return this.selectSource(request);
  }

  // ─── ВЫПОЛНЕНИЕ ЗАПРОСА ────────────────────────────────────

  /**
   * Выполняет запрос через выбранный парсер
   */
  async fetch(request: PriceRequest, preferredSources?: ParserType[]): Promise<PriceResult> {
    const parser = this.selectSource(request, preferredSources);
    
    if (!parser) {
      throw new Error('No available parser');
    }

    const parserType = parser.type as ParserType;
    const startTime = Date.now();

    // Проверяем Circuit Breaker
    const cb = this.circuitBreakers.get(parserType);
    if (cb && !cb.canExecute()) {
      // Пробуем другой парсер
      const fallbackParser = this.selectSource(request, preferredSources?.filter(s => s !== parserType));
      if (fallbackParser) {
        return this.fetchWithParser(fallbackParser, request);
      }
      throw new Error(`Circuit breaker is open for ${parserType}`);
    }

    // Rate limiting
    const limiter = this.rateLimiters.get(parserType);
    if (limiter) {
      await limiter.wait();
    }

    try {
      const result = await parser.fetch(request);
      
      // Успех
      if (cb) {
        cb.recordSuccess();
      }
      
      // Обновляем метрики
      this.recordSuccess(parserType, Date.now() - startTime);
      
      // Обновляем БД
      await this.updateSourceState(parserType, 'closed', 0);
      
      return result;
    } catch (error) {
      // Ошибка
      if (cb) {
        cb.recordFailure();
      }
      
      // Обновляем БД
      await this.updateSourceState(
        parserType,
        cb?.getState()?.state || 'open',
        cb?.getState()?.failures || 1
      );
      
      throw error;
    }
  }

  /**
   * Выполняет запрос через конкретный парсер
   */
  private async fetchWithParser(parser: PriceParser, request: PriceRequest): Promise<PriceResult> {
    const parserType = parser.type as ParserType;
    const startTime = Date.now();

    const limiter = this.rateLimiters.get(parserType);
    if (limiter) {
      await limiter.wait();
    }

    try {
      const result = await parser.fetch(request);
      this.recordSuccess(parserType, Date.now() - startTime);
      return result;
    } catch (error) {
      const cb = this.circuitBreakers.get(parserType);
      if (cb) {
        cb.recordFailure();
      }
      throw error;
    }
  }

  // ─── ДОСТУПНОСТЬ И СОСТОЯНИЕ ──────────────────────────────

  /**
   * Проверяет доступность парсера
   */
  private isParserAvailable(type: ParserType): boolean {
    const parser = this.parsers.get(type);
    if (!parser) return false;

    const cb = this.circuitBreakers.get(type);
    if (cb && !cb.canExecute()) return false;

    return true;
  }

  /**
   * Получает информацию о всех парсерах
   */
  async getParsersInfo(): Promise<ParserInfo[]> {
    const infos: ParserInfo[] = [];

    for (const [type, parser] of this.parsers) {
      const cb = this.circuitBreakers.get(type);
      const cbState = cb?.getState();
      const times = this.responseTimes.get(type) || [];

      infos.push({
        type,
        name: parser.name,
        available: this.isParserAvailable(type),
        circuitBreakerState: cbState?.state || 'closed',
        rateLimit: parser.getRateLimit(),
        lastSuccess: this.lastSuccess.get(type) || null,
        avgResponseTimeMs: times.length > 0
          ? times.reduce((a, b) => a + b, 0) / times.length
          : null,
      });
    }

    return infos;
  }

  // ─── МЕТРИКИ ────────────────────────────────────────────────

  /**
   * Записывает успешный результат
   */
  private recordSuccess(type: ParserType, responseTime: number): void {
    this.lastSuccess.set(type, new Date());
    
    const times = this.responseTimes.get(type) || [];
    times.push(responseTime);
    
    // Храним последние 100 измерений
    if (times.length > 100) {
      times.shift();
    }
    
    this.responseTimes.set(type, times);
  }

  /**
   * Обновляет состояние источника в БД
   */
  private async updateSourceState(
    type: ParserType,
    state: 'closed' | 'open' | 'half-open',
    failures: number
  ): Promise<void> {
    try {
      const source = await PriceSourceRepository.findByType(type);
      if (source) {
        await PriceSourceRepository.updateCircuitBreaker(source.id, state, failures);
      }
    } catch (error) {
      // Игнорируем ошибки БД при обновлении состояния
      console.error('Failed to update source state:', error);
    }
  }

  // ─── A/B ТЕСТИРОВАНИЕ ──────────────────────────────────────

  /**
   * Устанавливает конфигурацию A/B тестирования
   */
  setABTestConfig(config: Partial<ABTestConfig>): void {
    this.abTestConfig = {
      ...this.abTestConfig,
      ...config,
    };
  }

  /**
   * Получает конфигурацию A/B тестирования
   */
  getABTestConfig(): ABTestConfig {
    return { ...this.abTestConfig };
  }

  // ─── HELPERS ──────────────────────────────────────────────

  /**
   * Хэширует запрос для A/B тестирования
   */
  private hashRequest(request: PriceRequest): string {
    const data = `${request.itemName}:${request.city}:${request.category}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}

// ═══════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════

let parserManagerInstance: ParserManagerImpl | null = null;

export function getParserManager(): ParserManagerImpl {
  if (!parserManagerInstance) {
    parserManagerInstance = new ParserManagerImpl();
  }
  return parserManagerInstance;
}

export function resetParserManager(): void {
  parserManagerInstance = null;
}

// Экспортируем класс для тестирования
export { ParserManagerImpl };