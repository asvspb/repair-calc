/**
 * Parser Manager - Управление парсерами цен (оркестрация)
 * UPDATE_SERVICE - Specification v1.1
 *
 * Разнос по внутренней связности:
 *  - parserRegistry.ts      — реестр (регистрации, circuit breaker'ы, rate limiter'ы, метрики);
 *  - parserManager.types.ts — типы;
 *  - parserABTest.ts        — контроллер A/B тестирования (конфиг, выбор, запись результатов).
 *
 * Поддержка A/B тестирования парсеров:
 * - Автоматическое распределение трафика между парсерами
 * - Запись результатов для анализа
 * - Определение оптимального парсера
 */

import type { PriceParser, PriceRequest, PriceResult } from './parsers/types.js';
import { PriceSourceRepository } from '../../db/repositories/priceCatalog.repo.js';
import { winstonLogger } from '../../middleware/logger.js';
import { ParserRegistry } from './parserRegistry.js';
import { ABTestController } from './parserABTest.js';
import type { ABTestConfig, ParserType } from './parserManager.types.js';

export * from './parserManager.types.js';

// ═══════════════════════════════════════════════════════
// PARSER MANAGER
// ═══════════════════════════════════════════════════════

class ParserManagerImpl {
  private registry: ParserRegistry = new ParserRegistry();
  private abTest: ABTestController;

  constructor() {
    this.abTest = new ABTestController(this.registry);
  }

  // ─── РЕЕСТР ────────────────────────────────────────────────

  registerParser(parser: PriceParser): void {
    this.registry.register(parser);
  }

  // ─── ВЫБОР ПАРСЕРА ────────────────────────────────────────

  /**
   * Выбирает лучший доступный парсер для запроса
   */
  selectSource(request: PriceRequest, preferredSources?: ParserType[]): PriceParser | null {
    // A/B тестирование (если включено)
    if (this.abTest.getConfig().enabled && !preferredSources) {
      return this.abTest.selectForABTest(request, req => this.selectSource(req));
    }

    // Фильтруем доступные парсеры
    const available = this.registry
      .entries()
      .filter(([type]) => {
        // Если указаны предпочтительные источники
        if (preferredSources && !preferredSources.includes(type)) {
          return false;
        }

        // Проверяем доступность
        return this.registry.isAvailable(type);
      })
      .sort(([, parserA], [, parserB]) => {
        // Сортируем по приоритету (по rate limit)
        const limitA = parserA.getRateLimit();
        const limitB = parserB.getRateLimit();
        return limitB.requestsPerMinute - limitA.requestsPerMinute;
      });

    return available[0]?.[1] || null;
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
    const cb = this.registry.getCircuitBreaker(parserType);
    if (cb && !cb.isAvailable()) {
      // Пробуем другой парсер
      const fallbackParser = this.selectSource(
        request,
        preferredSources?.filter(s => s !== parserType),
      );
      if (fallbackParser) {
        return this.fetchWithParser(fallbackParser, request);
      }
      throw new Error(`Circuit breaker is open for ${parserType}`);
    }

    // Rate limiting
    const limiter = this.registry.getRateLimiter(parserType);
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
      this.registry.recordSuccess(parserType, Date.now() - startTime);

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
        cb?.getState()?.failures || 1,
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

    const limiter = this.registry.getRateLimiter(parserType);
    if (limiter) {
      await limiter.wait();
    }

    try {
      const result = await parser.fetch(request);
      this.registry.recordSuccess(parserType, Date.now() - startTime);
      return result;
    } catch (error) {
      const cb = this.registry.getCircuitBreaker(parserType);
      if (cb) {
        cb.recordFailure();
      }
      throw error;
    }
  }

  // ─── ДОСТУПНОСТЬ И СОСТОЯНИЕ ──────────────────────────────

  /**
   * Получает информацию о всех парсерах
   */
  async getParsersInfo() {
    return this.registry.getParsersInfo();
  }

  /**
   * Обновляет состояние источника в БД
   */
  private async updateSourceState(
    type: ParserType,
    state: 'closed' | 'open' | 'half-open',
    failures: number,
  ): Promise<void> {
    try {
      const source = await PriceSourceRepository.findByType(type);
      if (source) {
        await PriceSourceRepository.updateCircuitBreaker(source.id, state, failures);
      }
    } catch (error) {
      // Игнорируем ошибки БД при обновлении состояния
      winstonLogger.error('Failed to update source state', { error });
    }
  }

  // ─── A/B ТЕСТИРОВАНИЕ (делегирование в parserABTest.ts) ────

  /**
   * Устанавливает конфигурацию A/B тестирования
   */
  setABTestConfig(config: Partial<ABTestConfig>): void {
    this.abTest.setConfig(config);
  }

  /**
   * Получает конфигурацию A/B тестирования
   */
  getABTestConfig(): ABTestConfig {
    return this.abTest.getConfig();
  }

  /**
   * Включает A/B тестирование для конкретного теста
   */
  async enableABTest(testId: string): Promise<boolean> {
    return this.abTest.enable(testId);
  }

  /**
   * Отключает A/B тестирование
   */
  disableABTest(): void {
    this.abTest.disable();
  }

  /**
   * Выбирает парсер для A/B теста с записью в результат.
   * Возвращает парсер и информацию о группе.
   */
  async selectForABTestWithTracking(request: PriceRequest) {
    return this.abTest.selectForABTestWithTracking(request);
  }

  /**
   * Выполняет запрос с A/B тестированием.
   * Автоматически записывает результат теста.
   */
  async fetchWithABTest(request: PriceRequest): Promise<PriceResult> {
    const abSelection = await this.abTest.selectForABTestWithTracking(request);

    if (!abSelection) {
      // A/B тест не активен - обычный запрос
      return this.fetch(request);
    }

    const { parser, selection } = abSelection;
    const parserType = parser.type as ParserType;
    const startTime = Date.now();

    // Rate limiting
    const limiter = this.registry.getRateLimiter(parserType);
    if (limiter) {
      await limiter.wait();
    }

    try {
      const result = await parser.fetch(request);
      const responseTime = Date.now() - startTime;

      // Успех - обновляем метрики
      const cb = this.registry.getCircuitBreaker(parserType);
      if (cb) {
        cb.recordSuccess();
      }
      this.registry.recordSuccess(parserType, responseTime);

      // Записываем результат A/B теста
      await this.abTest.recordResult({
        testId: selection.testId,
        request,
        parserGroup: selection.parserGroup,
        parserType: selection.parserType,
        success: true,
        result,
        responseTime,
      });

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Ошибка
      const cb = this.registry.getCircuitBreaker(parserType);
      if (cb) {
        cb.recordFailure();
      }

      // Записываем неудачный результат A/B теста
      await this.abTest.recordResult({
        testId: selection.testId,
        request,
        parserGroup: selection.parserGroup,
        parserType: selection.parserType,
        success: false,
        result: null,
        responseTime,
        error,
      });

      throw error;
    }
  }

  /**
   * Получает статистику активного A/B теста
   */
  async getABTestStats() {
    return this.abTest.getStats();
  }

  /**
   * Автоматически завершает тест при достижении достаточной уверенности
   */
  async checkAndCompleteABTest(confidenceThreshold = 0.95) {
    return this.abTest.checkAndComplete(confidenceThreshold);
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
