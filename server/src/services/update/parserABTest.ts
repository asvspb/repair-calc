import type { PriceParser, PriceRequest, PriceResult } from './parsers/types.js';
import {
  ABTestRepository,
  type ParserGroup,
  type ParserType as ABParserType,
} from '../../db/repositories/abTest.repo.js';
import { winstonLogger } from '../../middleware/logger.js';
import type { ParserRegistry } from './parserRegistry.js';
import type { ABTestConfig, ABTestSelection, ParserType } from './parserManager.types.js';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════
// КОНТРОЛЛЕР A/B ТЕСТИРОВАНИЯ ПАРСЕРОВ
// (вынесено из parserManager.ts)
// ═══════════════════════════════════════════════════════

export class ABTestController {
  private registry: ParserRegistry;
  private abTestConfig: ABTestConfig = {
    enabled: false,
    testId: null,
    geminiWeight: 50,
  };

  constructor(registry: ParserRegistry) {
    this.registry = registry;
  }

  /**
   * Устанавливает конфигурацию A/B тестирования
   */
  setConfig(config: Partial<ABTestConfig>): void {
    this.abTestConfig = {
      ...this.abTestConfig,
      ...config,
    };
  }

  /**
   * Получает конфигурацию A/B тестирования
   */
  getConfig(): ABTestConfig {
    return { ...this.abTestConfig };
  }

  /**
   * Включает A/B тестирование для конкретного теста
   */
  async enable(testId: string): Promise<boolean> {
    try {
      const test = await ABTestRepository.findById(testId);
      if (!test || test.status !== 'running') {
        return false;
      }

      this.abTestConfig = {
        enabled: true,
        testId: test.id,
        geminiWeight: test.traffic_split,
      };

      return true;
    } catch (error) {
      winstonLogger.error('Failed to enable A/B test', { error });
      return false;
    }
  }

  /**
   * Отключает A/B тестирование
   */
  disable(): void {
    this.abTestConfig = {
      enabled: false,
      testId: null,
      geminiWeight: 50,
    };
  }

  /**
   * Выбор для A/B тестирования (legacy, по geminiWeight).
   * @param selectFallback выбор любого доступного парсера, если A/B-кандидаты недоступны
   */
  selectForABTest(
    request: PriceRequest,
    selectFallback: (request: PriceRequest) => PriceParser | null,
  ): PriceParser | null {
    const hash = this.hashRequest(request);
    const lastChar = parseInt(hash.slice(-1), 16);

    // 50/50 распределение (или по конфигурации)
    const geminiWeight = this.abTestConfig.geminiWeight;

    if (lastChar < (geminiWeight / 100) * 16) {
      const gemini = this.registry.getParser('ai_gemini');
      if (gemini && this.registry.isAvailable('ai_gemini')) {
        return gemini;
      }
    }

    const mistral = this.registry.getParser('ai_mistral');
    if (mistral && this.registry.isAvailable('ai_mistral')) {
      return mistral;
    }

    // Fallback на любой доступный
    return selectFallback(request);
  }

  /**
   * Выбирает парсер для A/B теста с записью в результат.
   * Возвращает парсер и информацию о группе.
   */
  async selectForABTestWithTracking(request: PriceRequest): Promise<{
    parser: PriceParser;
    selection: ABTestSelection;
  } | null> {
    if (!this.abTestConfig.enabled || !this.abTestConfig.testId) {
      return null;
    }

    try {
      const test = await ABTestRepository.findById(this.abTestConfig.testId);
      if (!test || test.status !== 'running') {
        // Тест больше не активен - отключаем
        this.disable();
        return null;
      }

      // Определяем группу на основе хэша
      const hash = this.hashRequest(request);
      const hashValue = parseInt(hash.slice(-8), 16); // Используем последние 8 hex символов
      const threshold = (test.traffic_split / 100) * 0xffffffff;

      let parserGroup: ParserGroup;
      let parserType: ParserType;

      if (hashValue < threshold) {
        parserGroup = 'a';
        parserType = test.parser_a as ParserType;
      } else {
        parserGroup = 'b';
        parserType = test.parser_b as ParserType;
      }

      // Проверяем доступность выбранного парсера
      const parser = this.registry.getParser(parserType);
      if (!parser || !this.registry.isAvailable(parserType)) {
        // Пробуем альтернативный парсер из теста
        const altParserType = parserGroup === 'a' ? test.parser_b : test.parser_a;
        const altParser = this.registry.getParser(altParserType as ParserType);

        if (altParser && this.registry.isAvailable(altParserType as ParserType)) {
          return {
            parser: altParser,
            selection: {
              testId: test.id,
              parserGroup: parserGroup === 'a' ? 'b' : 'a',
              parserType: altParserType as ParserType,
            },
          };
        }

        return null;
      }

      return {
        parser,
        selection: {
          testId: test.id,
          parserGroup,
          parserType,
        },
      };
    } catch (error) {
      winstonLogger.error('A/B test selection error', { error });
      return null;
    }
  }

  /**
   * Записывает результат A/B теста в БД
   */
  async recordResult(params: {
    testId: string;
    request: PriceRequest;
    parserGroup: ParserGroup;
    parserType: ParserType;
    success: boolean;
    result: PriceResult | null;
    responseTime: number;
    error?: unknown;
  }): Promise<void> {
    try {
      await ABTestRepository.addResult({
        test_id: params.testId,
        item_name: params.request.itemName,
        city: params.request.city,
        category: params.request.category,
        parser_group: params.parserGroup,
        parser_type: params.parserType as ABParserType,
        success: params.success,
        price_min: params.result?.prices.min,
        price_avg: params.result?.prices.avg,
        price_max: params.result?.prices.max,
        currency: params.result?.prices.currency,
        confidence_score: params.result?.confidenceScore,
        response_time_ms: params.responseTime,
        error_message: params.error instanceof Error ? params.error.message : undefined,
        metadata: {
          sources: params.result?.sources,
          itemName: params.request.itemName,
          unit: params.request.unit,
        },
      });
    } catch (dbError) {
      // Не прерываем выполнение при ошибке записи
      winstonLogger.error('Failed to record A/B test result', { error: dbError });
    }
  }

  /**
   * Получает статистику активного A/B теста
   */
  async getStats(): Promise<{
    testId: string | null;
    stats: Awaited<ReturnType<typeof ABTestRepository.getStats>> | null;
  }> {
    if (!this.abTestConfig.testId) {
      return { testId: null, stats: null };
    }

    try {
      const stats = await ABTestRepository.getStats(this.abTestConfig.testId);
      return { testId: this.abTestConfig.testId, stats };
    } catch (error) {
      winstonLogger.error('Failed to get A/B test stats', { error });
      return { testId: this.abTestConfig.testId, stats: null };
    }
  }

  /**
   * Автоматически завершает тест при достижении достаточной уверенности
   */
  async checkAndComplete(confidenceThreshold = 0.95): Promise<{
    completed: boolean;
    winner?: string;
    confidence?: number;
  }> {
    if (!this.abTestConfig.testId) {
      return { completed: false };
    }

    try {
      const stats = await ABTestRepository.getStats(this.abTestConfig.testId);
      if (!stats || stats.confidenceLevel === null) {
        return { completed: false };
      }

      // Проверяем минимальное количество запросов
      const minRequests = 100;
      if (stats.groupA.requests < minRequests || stats.groupB.requests < minRequests) {
        return { completed: false };
      }

      // Проверяем порог уверенности
      if (stats.confidenceLevel >= confidenceThreshold && stats.winner) {
        await ABTestRepository.complete(
          this.abTestConfig.testId,
          stats.winner,
          stats.confidenceLevel,
        );

        this.disable();

        return {
          completed: true,
          winner: stats.winner,
          confidence: stats.confidenceLevel,
        };
      }

      return { completed: false };
    } catch (error) {
      winstonLogger.error('Failed to check A/B test completion', { error });
      return { completed: false };
    }
  }

  /**
   * Хэширует запрос для A/B тестирования
   */
  private hashRequest(request: PriceRequest): string {
    const data = `${request.itemName}:${request.city}:${request.category}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
