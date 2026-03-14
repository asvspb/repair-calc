/**
 * API Routes для Update Service
 * UPDATE_SERVICE - Specification v1.1
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  UpdateJobRepository,
  UpdateJobItemRepository,
  UpdateLogRepository,
  type JobType,
  type JobStatus,
} from '../db/repositories/updateJob.repo.js';
import {
  PriceCatalogRepository,
  PriceSourceRepository,
  type PriceCategory,
  type SourceType,
} from '../db/repositories/priceCatalog.repo.js';
import {
  PriceHistoryRepository,
} from '../db/repositories/priceHistory.repo.js';
import { getUpdateRunner } from '../services/update/runner.js';

export const router = Router();

// ═══════════════════════════════════════════════════════
// ВАЛИДАЦИЯ
// ═══════════════════════════════════════════════════════

const runUpdateSchema = z.object({
  city: z.string().max(100).optional(),
  categories: z.array(z.enum(['work', 'material', 'tool'])).optional(),
  sources: z.array(z.enum(['ai_gemini', 'ai_mistral', 'web_scraper', 'api'])).optional(),
  force: z.boolean().default(false),
  priority: z.enum(['high', 'normal', 'low']).default('normal'),
  batchSize: z.number().min(1).max(50).default(10),
});

const updateScheduleSchema = z.object({
  enabled: z.boolean(),
  cron: z.string().max(100),
  timezone: z.string().max(50),
});

const createPriceSchema = z.object({
  name: z.string().max(255),
  category: z.enum(['work', 'material', 'tool']),
  unit: z.string().max(36).default('м²'),
  city: z.string().max(100),
  price_min: z.number().min(0).optional(),
  price_avg: z.number().min(0).optional(),
  price_max: z.number().min(0).optional(),
  currency: z.string().length(3).default('RUB'),
  source_type: z.enum(['ai_gemini', 'ai_mistral', 'web_scraper', 'api', 'manual']).optional(),
  confidence_score: z.number().min(0).max(1).default(1),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ═══════════════════════════════════════════════════════
// УПРАВЛЕНИЕ ОБНОВЛЕНИЯМИ
// ═══════════════════════════════════════════════════════

/**
 * POST /api/update/run
 * Запуск обновления вручную
 */
router.post('/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = runUpdateSchema.parse(req.body);
    const userId = (req as any).user?.id;

    // Проверяем, есть ли уже запущенные задачи
    const runningJobs = await UpdateJobRepository.findRunning();
    if (runningJobs.length >= 3) {
      return res.status(429).json({
        status: 'error',
        error: 'Too many running jobs. Please wait.',
      });
    }

    const runner = getUpdateRunner({
      batchSize: input.batchSize,
    });

    const job = await runner.runManual({
      city: input.city,
      categories: input.categories as PriceCategory[],
      sources: input.sources as SourceType[],
      force: input.force,
      triggeredBy: userId,
    });

    res.json({
      status: 'success',
      data: {
        jobId: job.id,
        type: job.type,
        status: job.status,
        totalItems: job.total_items,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        status: 'error',
        error: 'Validation error',
        details: error.errors,
      });
    }
    next(error);
  }
});

/**
 * GET /api/update/status/:jobId
 * Получить статус задачи обновления
 */
router.get('/status/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;

    const job = await UpdateJobRepository.findById(jobId);
    if (!job) {
      return res.status(404).json({
        status: 'error',
        error: 'Job not found',
      });
    }

    const progress = await UpdateJobRepository.getProgress(jobId);
    const items = await UpdateJobItemRepository.findByJobId(jobId);

    // Батч-прогресс
    const batchSize = 10;
    const totalBatches = Math.ceil((progress?.total || 0) / batchSize);
    const currentBatch = Math.ceil((progress?.processed || 0) / batchSize);

    res.json({
      status: 'success',
      data: {
        id: job.id,
        type: job.type,
        status: job.status,
        progress: progress,
        batchProgress: {
          currentBatch,
          totalBatches,
          concurrentRequests: 5,
        },
        items: {
          created: job.items_created,
          updated: job.items_updated,
          skipped: job.items_skipped,
          failed: job.failed_items,
        },
        startedAt: job.started_at,
        completedAt: job.completed_at,
        durationMs: job.duration_ms,
        errorMessage: job.error_message,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/update/jobs
 * История задач обновления
 */
router.get('/jobs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as JobStatus | undefined;
    const type = req.query.type as JobType | undefined;

    const { items, total } = await UpdateJobRepository.findMany({
      limit,
      offset,
      status,
      type,
    });

    res.json({
      status: 'success',
      data: {
        jobs: items.map(job => ({
          id: job.id,
          type: job.type,
          status: job.status,
          itemsCreated: job.items_created,
          itemsUpdated: job.items_updated,
          itemsSkipped: job.items_skipped,
          failedItems: job.failed_items,
          durationMs: job.duration_ms,
          createdAt: job.created_at,
          completedAt: job.completed_at,
        })),
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/update/cancel/:jobId
 * Отменить running задачу
 */
router.post('/cancel/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;

    const runner = getUpdateRunner();
    const cancelled = await runner.cancel(jobId);

    if (!cancelled) {
      return res.status(400).json({
        status: 'error',
        error: 'Cannot cancel job. Job not found or not running.',
      });
    }

    res.json({
      status: 'success',
      data: {
        jobId,
        status: 'cancelled',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/update/retry/:jobId
 * Повторить failed задачу
 */
router.post('/retry/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const userId = (req as any).user?.id;

    const originalJob = await UpdateJobRepository.findById(jobId);
    if (!originalJob) {
      return res.status(404).json({
        status: 'error',
        error: 'Job not found',
      });
    }

    if (originalJob.status !== 'failed') {
      return res.status(400).json({
        status: 'error',
        error: 'Only failed jobs can be retried',
      });
    }

    // Получаем failed items
    const failedItems = await UpdateJobItemRepository.findFailed(jobId);
    if (failedItems.length === 0) {
      return res.status(400).json({
        status: 'error',
        error: 'No failed items to retry',
      });
    }

    // Запускаем новую задачу
    const runner = getUpdateRunner();
    const newJob = await runner.runManual({
      city: originalJob.city || undefined,
      categories: originalJob.categories || undefined,
      sources: originalJob.sources || undefined,
      triggeredBy: userId,
    });

    res.json({
      status: 'success',
      data: {
        jobId: newJob.id,
        originalJobId: jobId,
        status: newJob.status,
        retryItemsCount: failedItems.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════
// УПРАВЛЕНИЕ РАСПИСАНИЕМ
// ═══════════════════════════════════════════════════════

/**
 * GET /api/update/schedule
 * Получить текущее расписание
 */
router.get('/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Получить из scheduler_config
    res.json({
      status: 'success',
      data: {
        enabled: true,
        cron: '0 3 * * *',
        timezone: 'Europe/Moscow',
        nextRun: null,
        lastRun: null,
        lastRunStatus: null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/update/schedule
 * Обновить расписание (требует прав администратора)
 */
router.put('/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Проверить права администратора
    const input = updateScheduleSchema.parse(req.body);

    // TODO: Сохранить в scheduler_config

    res.json({
      status: 'success',
      data: {
        enabled: input.enabled,
        cron: input.cron,
        timezone: input.timezone,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        status: 'error',
        error: 'Validation error',
        details: error.errors,
      });
    }
    next(error);
  }
});

// ═══════════════════════════════════════════════════════
// КАТАЛОГ ЦЕН
// ═══════════════════════════════════════════════════════

/**
 * GET /api/prices
 * Поиск в каталоге цен
 */
router.get('/prices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = req.query.q as string | undefined;
    const city = req.query.city as string | undefined;
    const category = req.query.category as PriceCategory | undefined;
    const sourceType = req.query.sourceType as SourceType | undefined;
    const minConfidence = req.query.minConfidence ? parseFloat(req.query.minConfidence as string) : undefined;
    const stale = req.query.stale === 'true';
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const sortBy = (req.query.sortBy as 'name' | 'updated_at' | 'price_avg') || 'updated_at';
    const sortOrder = (req.query.sortOrder as 'asc' | 'desc') || 'desc';

    const { items, total } = await PriceCatalogRepository.search({
      q,
      city,
      category,
      sourceType,
      minConfidence,
      stale,
      limit,
      offset,
      sortBy,
      sortOrder,
    });

    res.json({
      status: 'success',
      data: {
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          unit: item.unit,
          city: item.city,
          prices: {
            min: item.price_min,
            avg: item.price_avg,
            max: item.price_max,
            currency: item.currency,
          },
          sourceType: item.source_type,
          confidenceScore: item.confidence_score,
          updatedAt: item.updated_at,
        })),
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/prices/:id
 * Получить цену по ID
 */
router.get('/prices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const item = await PriceCatalogRepository.findById(id);
    if (!item) {
      return res.status(404).json({
        status: 'error',
        error: 'Price not found',
      });
    }

    res.json({
      status: 'success',
      data: item,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/prices/:id/history
 * История изменений цены
 */
router.get('/prices/:id/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const history = await PriceHistoryRepository.findByCatalogId(id, limit);

    res.json({
      status: 'success',
      data: {
        priceCatalogId: id,
        history: history.map(h => ({
          id: h.id,
          oldPrices: {
            min: h.old_price_min,
            avg: h.old_price_avg,
            max: h.old_price_max,
          },
          newPrices: {
            min: h.new_price_min,
            avg: h.new_price_avg,
            max: h.new_price_max,
          },
          changePercent: h.price_change_percent,
          sourceId: h.source_id,
          confidenceScore: h.confidence_score,
          requiresReview: h.requires_review,
          createdAt: h.created_at,
        })),
        total: history.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/prices
 * Добавить цену вручную
 */
router.post('/prices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Проверить права администратора
    const input = createPriceSchema.parse(req.body);

    const price = await PriceCatalogRepository.create({
      name: input.name,
      category: input.category,
      unit: input.unit,
      city: input.city,
      price_min: input.price_min,
      price_avg: input.price_avg,
      price_max: input.price_max,
      currency: input.currency,
      source_type: input.source_type || 'manual',
      confidence_score: input.confidence_score,
      description: input.description,
      metadata: input.metadata,
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 дней для manual
    });

    res.status(201).json({
      status: 'success',
      data: price,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        status: 'error',
        error: 'Validation error',
        details: error.errors,
      });
    }
    next(error);
  }
});

/**
 * PUT /api/prices/:id
 * Обновить цену вручную
 */
router.put('/prices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Проверить права администратора
    const { id } = req.params;
    const input = req.body;

    const existing = await PriceCatalogRepository.findById(id);
    if (!existing) {
      return res.status(404).json({
        status: 'error',
        error: 'Price not found',
      });
    }

    const updated = await PriceCatalogRepository.update(id, {
      price_min: input.price_min,
      price_avg: input.price_avg,
      price_max: input.price_max,
      confidence_score: input.confidence_score,
      description: input.description,
      metadata: input.metadata,
    });

    res.json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/prices/:id
 * Удалить запись из каталога
 */
router.delete('/prices/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // TODO: Проверить права администратора
    const { id } = req.params;

    const deleted = await PriceCatalogRepository.delete(id);
    if (!deleted) {
      return res.status(404).json({
        status: 'error',
        error: 'Price not found',
      });
    }

    res.json({
      status: 'success',
      data: {
        id,
        deleted: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════
// МОНИТОРИНГ
// ═══════════════════════════════════════════════════════

/**
 * GET /api/update/health
 * Health check службы обновлений
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [sources, catalogStats, jobStats] = await Promise.all([
      PriceSourceRepository.findActive(),
      PriceCatalogRepository.getStats(),
      UpdateJobRepository.getStats(),
    ]);

    const parsersHealth = sources.reduce((acc, source) => {
      acc[source.type] = {
        available: source.is_active && source.circuit_breaker_state !== 'open',
        circuitBreakerState: source.circuit_breaker_state,
        failures: source.circuit_breaker_failures,
      };
      return acc;
    }, {} as Record<string, any>);

    res.json({
      status: 'ok',
      scheduler: {
        enabled: true,
        running: jobStats.byStatus.running > 0,
      },
      parsers: parsersHealth,
      catalog: {
        totalItems: catalogStats.total,
        staleItems: catalogStats.stale,
        itemsForReview: catalogStats.forReview,
        lastUpdated: catalogStats.lastUpdated,
      },
      jobs: {
        total: jobStats.total,
        running: jobStats.byStatus.running,
        pending: jobStats.byStatus.pending,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/update/metrics
 * Метрики производительности
 */
router.get('/metrics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [jobStats, catalogStats, historyStats] = await Promise.all([
      UpdateJobRepository.getStats(),
      PriceCatalogRepository.getStats(),
      PriceHistoryRepository.getStats(),
    ]);

    res.json({
      status: 'success',
      data: {
        jobsTotal: jobStats.total,
        jobsCompleted: jobStats.byStatus.completed,
        jobsFailed: jobStats.byStatus.failed,
        jobsCancelled: jobStats.byStatus.cancelled,
        avgDurationMs: jobStats.avgDurationMs,
        lastRunAt: jobStats.lastRunAt,
        catalogTotal: catalogStats.total,
        catalogByCategory: catalogStats.byCategory,
        staleItems: catalogStats.stale,
        anomaliesDetected: historyStats.forReview,
        avgPriceChangePercent: historyStats.avgChangePercent,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/update/logs/:jobId
 * Логи задачи
 */
router.get('/logs/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const level = req.query.level as 'info' | 'debug' | 'warn' | 'error' | undefined;

    const logs = await UpdateLogRepository.findByJobId(jobId, level);

    res.json({
      status: 'success',
      data: {
        jobId,
        logs: logs.map(log => ({
          id: log.id,
          level: log.level,
          message: log.message,
          context: log.context,
          createdAt: log.created_at,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;