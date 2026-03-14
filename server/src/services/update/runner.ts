/**
 * Update Runner - Управляет процессом обновления цен
 * UPDATE_SERVICE - Specification v1.1
 */

import {
  UpdateJobRepository,
  UpdateJobItemRepository,
  UpdateJobLockRepository,
  UpdateLogRepository,
  type UpdateJob,
  type UpdateJobItem,
  type JobProgress,
} from '../../db/repositories/updateJob.repo.js';
import {
  PriceCatalogRepository,
  PriceSourceRepository,
  type PriceCatalog,
  type CreatePriceCatalogInput,
  type PriceCategory,
  type SourceType,
} from '../../db/repositories/priceCatalog.repo.js';
import {
  PriceHistoryRepository,
  type CreatePriceHistoryInput,
} from '../../db/repositories/priceHistory.repo.js';
import type { PriceParser, PriceRequest, PriceResult } from './parsers/types.js';
import { CircuitBreaker } from './parsers/circuitBreaker.js';
import { RateLimiter } from './parsers/rateLimiter.js';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════
// КОНФИГУРАЦИЯ
// ═══════════════════════════════════════════════════════

export interface RunnerConfig {
  batchSize: number;              // Размер батча (по умолчанию 10)
  concurrentRequests: number;     // Параллельные запросы (по умолчанию 5)
  requestDelayMs: number;         // Задержка между запросами (500ms)
  cacheEnabled: boolean;          // Включить кэш
  cacheTtlMs: number;             // Время жизни кэша (1 час)
  anomalyDetectionEnabled: boolean;
  anomalyThresholdPercent: number;  // Порог аномалии (100%)
  lockTtlMs: number;              // Время жизни блокировки (5 минут)
}

const defaultConfig: RunnerConfig = {
  batchSize: 10,
  concurrentRequests: 5,
  requestDelayMs: 500,
  cacheEnabled: true,
  cacheTtlMs: 3600000, // 1 час
  anomalyDetectionEnabled: true,
  anomalyThresholdPercent: 100,
  lockTtlMs: 300000, // 5 минут
};

// ═══════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════

export interface RunOptions {
  city?: string;
  categories?: PriceCategory[];
  sources?: SourceType[];
  force?: boolean;
  triggeredBy?: string;
}

export interface ItemToUpdate {
  name: string;
  category: PriceCategory;
  city: string;
  unit?: string;
  existingPrice?: PriceCatalog;
}

// ═══════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════

export class UpdateRunner {
  private config: RunnerConfig;
  private parsers: Map<string, PriceParser> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private rateLimiters: Map<string, RateLimiter> = new Map();
  private cache: Map<string, { result: PriceResult; expiresAt: number }> = new Map();
  private abortController: AbortController | null = null;

  constructor(config: Partial<RunnerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  // ─── РЕГИСТРАЦИЯ ПАРСЕРОВ ────────────────────────────────

  registerParser(parser: PriceParser): void {
    this.parsers.set(parser.type, parser);
    this.circuitBreakers.set(
      parser.type,
      new CircuitBreaker({
        failureThreshold: 5,
        resetTimeoutMs: 600000, // 10 минут
      })
    );
    this.rateLimiters.set(
      parser.type,
      new RateLimiter(parser.getRateLimit().requestsPerMinute)
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
      const items = await this.getItemsToUpdate(options);
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
        }))
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

  // ─── ПОЛУЧЕНИЕ ЭЛЕМЕНТОВ ДЛЯ ОБНОВЛЕНИЯ ─────────────────────

  private async getItemsToUpdate(options: RunOptions): Promise<ItemToUpdate[]> {
    const items: ItemToUpdate[] = [];

    // Если указан город, получаем элементы для этого города
    if (options.city) {
      const stalePrices = await PriceCatalogRepository.findStale(1000);
      
      for (const price of stalePrices) {
        if (options.city && price.city !== options.city) continue;
        if (options.categories && !options.categories.includes(price.category)) continue;

        items.push({
          name: price.name,
          category: price.category,
          city: price.city,
          unit: price.unit,
          existingPrice: price,
        });
      }
    }

    // TODO: Добавить элементы из works/materials, которых нет в каталоге
    
    return items;
  }

  // ─── ОБРАБОТКА БАТЧАМИ ────────────────────────────────────

  private async processBatches(
    jobId: string,
    items: ItemToUpdate[],
    sources?: SourceType[]
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
        jobId
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
    sources?: SourceType[]
  ): Promise<void> {
    const concurrency = this.config.concurrentRequests;
    const chunks = this.chunkArray(batch, Math.ceil(batch.length / concurrency));

    await Promise.all(
      chunks.map(chunk => this.processChunk(jobId, chunk, sources))
    );
  }

  private async processChunk(
    jobId: string,
    items: ItemToUpdate[],
    sources?: SourceType[]
  ): Promise<void> {
    for (const item of items) {
      await this.processItem(jobId, item, sources);
    }
  }

  // ─── ОБРАБОТКА ОДНОГО ЭЛЕМЕНТА ──────────────────────────────

  private async processItem(
    jobId: string,
    item: ItemToUpdate,
    sources?: SourceType[]
  ): Promise<void> {
    const startTime = Date.now();
    const itemKey = this.getItemKey(item);

    try {
      // Проверка блокировки
      const isLocked = await UpdateJobLockRepository.isLocked(itemKey);
      if (isLocked) {
        await this.recordSkipped(jobId, item, 'Item is locked by another job');
        return;
      }

      // acquire lock
      const acquired = await UpdateJobLockRepository.acquire(
        jobId,
        itemKey,
        this.config.lockTtlMs
      );
      if (!acquired) {
        await this.recordSkipped(jobId, item, 'Failed to acquire lock');
        return;
      }

      try {
        // Проверка кэша
        const cacheKey = this.getCacheKey(item);
        if (this.config.cacheEnabled) {
          const cached = this.getFromCache(cacheKey);
          if (cached) {
            await this.savePrice(item, cached, jobId);
            await this.recordSuccess(jobId, item, cached, Date.now() - startTime, true);
            return;
          }
        }

        // Выбор источника
        const parser = this.selectParser(sources);
        if (!parser) {
          await this.recordFailed(jobId, item, 'No available parser');
          return;
        }

        // Проверка Circuit Breaker
        const cb = this.circuitBreakers.get(parser.type);
        if (cb && !cb.canExecute()) {
          await this.recordFailed(jobId, item, `Circuit breaker open for ${parser.type}`);
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
          const anomaly = PriceHistoryRepository.detectAnomaly(
            item.existingPrice.price_avg,
            result.prices.avg,
            this.config.anomalyThresholdPercent
          );
          if (anomaly.isAnomaly) {
            result.requiresReview = true;
            await UpdateLogRepository.warn(
              `Anomaly detected for ${item.name}: ${anomaly.changePercent.toFixed(1)}% change`,
              jobId,
              { item, anomaly }
            );
          }
        }

        // Сохраняем цену
        await this.savePrice(item, result, jobId, parser.type);

        // Кэшируем результат
        if (this.config.cacheEnabled) {
          this.saveToCache(cacheKey, result);
        }

        await this.recordSuccess(jobId, item, result, Date.now() - startTime, false, parser.type);
      } finally {
        // Освобождаем блокировку
        await UpdateJobLockRepository.release(jobId, itemKey);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.recordFailed(jobId, item, errorMessage);

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
        return !cb || cb.canExecute();
      })
      .sort((a, b) => {
        const limitA = a.getRateLimit();
        const limitB = b.getRateLimit();
        return limitB.requestsPerMinute - limitA.requestsPerMinute;
      });

    return availableParsers[0] || null;
  }

  // ─── СОХРАНЕНИЕ ЦЕНЫ ────────────────────────────────────────

  private async savePrice(
    item: ItemToUpdate,
    result: PriceResult,
    jobId: string,
    sourceType?: SourceType
  ): Promise<void> {
    const input: CreatePriceCatalogInput = {
      name: item.name,
      category: item.category,
      unit: item.unit,
      city: item.city,
      price_min: result.prices.min,
      price_avg: result.prices.avg,
      price_max: result.prices.max,
      currency: result.prices.currency,
      source_type: sourceType,
      confidence_score: result.confidenceScore,
      valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 дней
    };

    // Сохраняем или обновляем цену
    const priceCatalog = await PriceCatalogRepository.upsert(input);

    // Записываем историю
    const historyInput: CreatePriceHistoryInput = {
      price_catalog_id: priceCatalog.id,
      job_id: jobId,
      old_price_min: item.existingPrice?.price_min,
      old_price_avg: item.existingPrice?.price_avg,
      old_price_max: item.existingPrice?.price_max,
      new_price_min: result.prices.min,
      new_price_avg: result.prices.avg,
      new_price_max: result.prices.max,
      confidence_score: result.confidenceScore,
      requires_review: result.requiresReview,
    };

    // Вычисляем процент изменения
    if (item.existingPrice?.price_avg && result.prices.avg) {
      const changePercent =
        ((result.prices.avg - item.existingPrice.price_avg) /
          item.existingPrice.price_avg) *
        100;
      historyInput.price_change_percent = changePercent;
    }

    await PriceHistoryRepository.create(historyInput);
  }

  // ─── ЗАПИСЬ РЕЗУЛЬТАТОВ ─────────────────────────────────────

  private async recordSuccess(
    jobId: string,
    item: ItemToUpdate,
    result: PriceResult,
    durationMs: number,
    fromCache: boolean,
    sourceType?: SourceType
  ): Promise<void> {
    const jobItems = await UpdateJobItemRepository.findByJobId(jobId);
    const jobItem = jobItems.find(
      ji => ji.item_name === item.name && ji.city === item.city
    );

    if (jobItem) {
      // Получаем ID сохранённой цены
      const priceCatalog = await PriceCatalogRepository.findByNameCityCategory(
        item.name,
        item.city,
        item.category
      );

      if (priceCatalog && sourceType) {
        await UpdateJobItemRepository.completeItem(jobItem.id, {
          source: sourceType,
          price_catalog_id: priceCatalog.id,
          price_change: result.prices.avg - (item.existingPrice?.price_avg || 0),
        });
      }
    }

    // Обновляем прогресс задачи
    const job = await UpdateJobRepository.findById(jobId);
    if (job) {
      await UpdateJobRepository.updateProgress(jobId, {
        processed_items: job.processed_items + 1,
        items_updated: item.existingPrice ? job.items_updated + 1 : job.items_updated,
        items_created: !item.existingPrice ? job.items_created + 1 : job.items_created,
      });
    }
  }

  private async recordSkipped(
    jobId: string,
    item: ItemToUpdate,
    reason: string
  ): Promise<void> {
    const jobItems = await UpdateJobItemRepository.findByJobId(jobId);
    const jobItem = jobItems.find(
      ji => ji.item_name === item.name && ji.city === item.city
    );

    if (jobItem) {
      await UpdateJobItemRepository.skipItem(jobItem.id, reason);
    }

    const job = await UpdateJobRepository.findById(jobId);
    if (job) {
      await UpdateJobRepository.updateProgress(jobId, {
        processed_items: job.processed_items + 1,
        items_skipped: job.items_skipped + 1,
      });
    }
  }

  private async recordFailed(
    jobId: string,
    item: ItemToUpdate,
    error: string
  ): Promise<void> {
    const jobItems = await UpdateJobItemRepository.findByJobId(jobId);
    const jobItem = jobItems.find(
      ji => ji.item_name === item.name && ji.city === item.city
    );

    if (jobItem) {
      await UpdateJobItemRepository.failItem(jobItem.id, error);
    }

    const job = await UpdateJobRepository.findById(jobId);
    if (job) {
      await UpdateJobRepository.updateProgress(jobId, {
        processed_items: job.processed_items + 1,
        failed_items: job.failed_items + 1,
      });
    }
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

  // ─── КЭШИРОВАНИЕ ────────────────────────────────────────────

  private getCacheKey(item: ItemToUpdate): string {
    const data = `${item.name}:${item.city}:${item.category}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  private getFromCache(key: string): PriceResult | null {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
    this.cache.delete(key);
    return null;
  }

  private saveToCache(key: string, result: PriceResult): void {
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + this.config.cacheTtlMs,
    });
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