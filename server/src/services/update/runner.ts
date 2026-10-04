/**
 * Update Runner - Управляет процессом обновления цен
 * UPDATE_SERVICE - Specification v1.1
 *
 * Разнос по внутренней связности:
 *  - runner.types.ts — конфигурация и типы;
 *  - runnerSteps.ts  — шаги без состояния (сбор элементов, сохранение цены, запись результатов).
 */

import {
  UpdateJobItemRepository,
  UpdateJobLockRepository,
  UpdateJobRepository,
  type UpdateJob,
  type JobProgress,
} from '../../db/repositories/updateJob.repo.js';
import type { SourceType } from '../../db/repositories/priceCatalog.repo.js';
import { PriceHistoryRepository } from '../../db/repositories/priceHistory.repo.js';
import type { PriceParser, PriceRequest } from './parsers/types.js';
import { CircuitBreaker } from './parsers/circuitBreaker.js';
import { RateLimiter } from './parsers/rateLimiter.js';
import type { PrioritizedItem } from './utils/priority.js';
import {
  getItemsToUpdate,
  recordFailed,
  recordSkipped,
  recordSuccess,
  savePrice,
} from './runnerSteps.js';
import {
  defaultConfig,
  type ItemToUpdate,
  type RunOptions,
  type RunnerConfig,
} from './runner.types.js';
import { cacheKey, getFromCache, saveToCache, type RunnerCache } from './runnerCache.js';
import { UpdateLogRepository } from '../../db/repositories/updateJob.repo.js';

export * from './runner.types.js';

// ═══════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════

export class UpdateRunner {
  private config: RunnerConfig;
  private parsers: Map<string, PriceParser> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private cache: RunnerCache = new Map();
  private abortController: AbortController | null = null;

  constructor(config: Partial<RunnerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  // ─── РЕГИСТРАЦИЯ ПАРСЕРОВ ────────────────────────────────

  registerParser(parser: PriceParser): void {
    this.parsers.set(parser.type, parser);
    this.circuitBreakers.set(
      parser.type,
      new CircuitBreaker(parser.type, {
        threshold: 5,
        resetTimeoutMs: 600000, // 10 минут
        halfOpenMaxRequests: 3,
      }),
    );
    this.rateLimiters.set(
      parser.type,
      new RateLimiter({ requestsPerMinute: parser.getRateLimit().requestsPerMinute }),
    );
  }

  // ─── ЗАПУСК ОБНОВЛЕНИЯ ────────────────────────────────────

  async runManual(options: RunOptions = {}): Promise<UpdateJob> {
    return this.run({
      type: 'manual',
      ...options,
    });
  }

  async runScheduled(): Promise<UpdateJob> {
    return this.run({ type: 'scheduled' });
  }

  private async run(options: RunOptions & { type: 'manual' | 'scheduled' }): Promise<UpdateJob> {
    // Создаём задачу
    const job = await UpdateJobRepository.create({
      type: options.type,
      city: options.city,
      categories: options.categories,
      sources: options.sources,
      triggered_by: options.triggeredBy,
    });

    this.abortController = new AbortController();

    try {
      // Логируем старт
      await UpdateLogRepository.info(`Update job started: type=${options.type}`, job.id, {
        city: options.city,
        categories: options.categories,
        sources: options.sources,
      });

      // Запускаем задачу
      await UpdateJobRepository.start(job.id);

      // Получаем элементы для обновления
      const items = await getItemsToUpdate(options);
      await UpdateJobRepository.updateProgress(job.id, { total_items: items.length });

      if (items.length === 0) {
        await UpdateLogRepository.info('No items to update', job.id);
        await UpdateJobRepository.complete(job.id);
        return UpdateJobRepository.findById(job.id) as Promise<UpdateJob>;
      }

      // Создаём элементы задачи
      await UpdateJobItemRepository.createMany(
        items.map(item => ({
          job_id: job.id,
          item_name: item.name,
          item_category: item.category,
          city: item.city,
        })),
      );

      // Обрабатываем батчами
      await this.processBatches(job.id, items, options.sources);

      // Завершаем задачу
      await UpdateJobRepository.complete(job.id);

      await UpdateLogRepository.info(`Update job completed: id=${job.id}`, job.id);

      return UpdateJobRepository.findById(job.id) as Promise<UpdateJob>;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await UpdateJobRepository.fail(job.id, errorMessage);
      await UpdateLogRepository.error(`Update job failed: ${errorMessage}`, job.id, {
        error: errorMessage,
      });
      throw error;
    } finally {
      this.abortController = null;
      // Освобождаем все блокировки
      await UpdateJobLockRepository.releaseAll(job.id);
    }
  }

  // ─── ОБРАБОТКА БАТЧАМИ ────────────────────────────────────

  private async processBatches(
    jobId: string,
    items: PrioritizedItem[],
    sources?: SourceType[],
  ): Promise<void> {
    const batches = this.chunkArray(items, this.config.batchSize);

    for (const [index, batch] of batches.entries()) {
      // Проверяем отмену
      if (this.abortController?.signal.aborted) {
        await UpdateLogRepository.warn('Job cancelled by user', jobId);
        throw new Error('Job cancelled');
      }

      await UpdateLogRepository.debug(
        `Processing batch ${index + 1}/${batches.length} (${batch.length} items)`,
        jobId,
      );

      // Параллельная обработка с ограничением конкурентности
      await this.processBatchWithConcurrency(jobId, batch, sources);

      // Задержка между батчами
      if (index < batches.length - 1) {
        await this.delay(this.config.requestDelayMs);
      }
    }
  }

  private async processBatchWithConcurrency(
    jobId: string,
    batch: ItemToUpdate[],
    sources?: SourceType[],
  ): Promise<void> {
    const concurrency = this.config.concurrentRequests;
    const chunks = this.chunkArray(batch, Math.ceil(batch.length / concurrency));

    await Promise.all(chunks.map(chunk => this.processChunk(jobId, chunk, sources)));
  }

  private async processChunk(
    jobId: string,
    items: ItemToUpdate[],
    sources?: SourceType[],
  ): Promise<void> {
    for (const item of items) {
      await this.processItem(jobId, item, sources);
    }
  }

  // ─── ОБРАБОТКА ОДНОГО ЭЛЕМЕНТА ──────────────────────────────

  private async processItem(
    jobId: string,
    item: ItemToUpdate,
    sources?: SourceType[],
  ): Promise<void> {
    const startTime = Date.now();
    const itemKey = this.getItemKey(item);

    try {
      // Проверка блокировки
      const isLocked = await UpdateJobLockRepository.isLocked(itemKey);
      if (isLocked) {
        await recordSkipped(jobId, item, 'Item is locked by another job');
        return;
      }

      // acquire lock
      const acquired = await UpdateJobLockRepository.acquire(jobId, itemKey, this.config.lockTtlMs);
      if (!acquired) {
        await recordSkipped(jobId, item, 'Failed to acquire lock');
        return;
      }

      try {
        // Проверка кэша
        const key = cacheKey(item);
        if (this.config.cacheEnabled) {
          const cached = getFromCache(this.cache, key);
          if (cached) {
            await savePrice(item, cached, jobId);
            await recordSuccess(jobId, item, cached, Date.now() - startTime, true);
            return;
          }
        }

        // Выбор источника
        const parser = this.selectParser(sources);
        if (!parser) {
          await recordFailed(jobId, item, 'No available parser');
          return;
        }

        // Проверка Circuit Breaker
        const cb = this.circuitBreakers.get(parser.type);
        if (cb && !cb.isAvailable()) {
          await recordFailed(jobId, item, `Circuit breaker open for ${parser.type}`);
          return;
        }

        // Rate Limiting
        const limiter = this.rateLimiters.get(parser.type);
        if (limiter) {
          await limiter.wait();
        }

        // Запрос к парсеру
        const request: PriceRequest = {
          itemName: item.name,
          category: item.category,
          city: item.city,
          unit: item.unit,
        };

        const result = await parser.fetch(request);

        // Успех - сбрасываем Circuit Breaker
        if (cb) {
          cb.recordSuccess();
        }

        // Проверка на аномалии
        if (this.config.anomalyDetectionEnabled && item.existingPrice) {
          const anomaly = await PriceHistoryRepository.detectAnomaly(
            item.existingPrice.price_avg,
            result.prices.avg,
            this.config.anomalyThresholdPercent,
          );
          if (anomaly.isAnomaly) {
            result.requiresReview = true;
            await UpdateLogRepository.warn(
              `Anomaly detected for ${item.name}: ${anomaly.changePercent.toFixed(1)}% change`,
              jobId,
              { item, anomaly },
            );
          }
        }

        // Сохраняем цену
        await savePrice(item, result, jobId, parser.type as SourceType);

        // Кэшируем результат
        if (this.config.cacheEnabled) {
          saveToCache(this.cache, key, result, this.config.cacheTtlMs);
        }

        await recordSuccess(
          jobId,
          item,
          result,
          Date.now() - startTime,
          false,
          parser.type as SourceType,
        );
      } finally {
        // Освобождаем блокировку
        await UpdateJobLockRepository.release(jobId, itemKey);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await recordFailed(jobId, item, errorMessage);

      // Записываем ошибку в Circuit Breaker
      const parser = this.parsers.values().next().value;
      if (parser) {
        const cb = this.circuitBreakers.get(parser.type);
        if (cb) {
          cb.recordFailure();
        }
      }
    }
  }

  // ─── ВЫБОР ПАРСЕРА ──────────────────────────────────────────

  private selectParser(sources?: SourceType[]): PriceParser | null {
    const availableParsers = Array.from(this.parsers.values())
      .filter(p => {
        if (sources && !sources.includes(p.type as SourceType)) {
          return false;
        }
        const cb = this.circuitBreakers.get(p.type);
        return !cb || cb.isAvailable();
      })
      .sort((a, b) => {
        const limitA = a.getRateLimit();
        const limitB = b.getRateLimit();
        return limitB.requestsPerMinute - limitA.requestsPerMinute;
      });

    return availableParsers[0] || null;
  }

  // ─── ОТМЕНА ЗАДАЧИ ──────────────────────────────────────────

  async cancel(jobId: string): Promise<boolean> {
    const job = await UpdateJobRepository.findById(jobId);
    if (!job || job.status !== 'running') {
      return false;
    }

    this.abortController?.abort();
    await UpdateJobRepository.cancel(jobId);
    await UpdateJobLockRepository.releaseAll(jobId);

    return true;
  }

  // ─── СТАТУС И ПРОГРЕСС ─────────────────────────────────────

  async getProgress(jobId: string): Promise<JobProgress | null> {
    return UpdateJobRepository.getProgress(jobId);
  }

  // ─── HELPERS ──────────────────────────────────────────────

  private getItemKey(item: ItemToUpdate): string {
    return `${item.name}:${item.city}:${item.category}`;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════

let runnerInstance: UpdateRunner | null = null;

export function getUpdateRunner(config?: Partial<RunnerConfig>): UpdateRunner {
  if (!runnerInstance) {
    runnerInstance = new UpdateRunner(config);
  }
  return runnerInstance;
}

export function resetUpdateRunner(): void {
  runnerInstance = null;
}
