import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  UpdateJobRepository,
  UpdateJobItemRepository,
  UpdateLogRepository,
  type JobType,
  type JobStatus,
} from '../../db/repositories/updateJob.repo.js';
import {
  PriceCatalogRepository,
  PriceSourceRepository,
} from '../../db/repositories/priceCatalog.repo.js';
import { PriceHistoryRepository } from '../../db/repositories/priceHistory.repo.js';
import { getUpdateRunner } from '../../services/update/runner.js';
import { runUpdateSchema, updateScheduleSchema } from './schemas.js';

import { authenticate } from '../../middleware/auth.js';
import { adminGuard } from '../../middleware/adminGuard.js';

export const router = Router();
router.use(authenticate, adminGuard);

/**
 * POST /run
 * Запуск обновления вручную
 */
router.post('/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = runUpdateSchema.parse(req.body);
    const userId = (req as any).user?.id;

    const runningJobs = await UpdateJobRepository.findRunning();
    if (runningJobs.length >= 3) {
      res.status(429).json({
        status: 'error',
        error: 'Too many running jobs. Please wait.',
      });
      return;
    }

    const runner = getUpdateRunner({
      batchSize: input.batchSize,
    });

    const job = await runner.runManual({
      city: input.city,
      categories: input.categories as any,
      sources: input.sources as any,
      force: input.force,
      priority: input.priority,
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
      res.status(400).json({
        status: 'error',
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }
    next(error);
  }
});

/**
 * GET /status/:jobId
 * Получить статус задачи обновления
 */
router.get('/status/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      res.status(400).json({
        status: 'error',
        error: 'Job ID is required',
      });
      return;
    }

    const job = await UpdateJobRepository.findById(jobId);
    if (!job) {
      return res.status(404).json({
        status: 'error',
        error: 'Job not found',
      });
    }

    const progress = await UpdateJobRepository.getProgress(jobId);
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
 * GET /jobs
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
 * POST /cancel/:jobId
 * Отменить running задачу
 */
router.post('/cancel/:jobId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      res.status(400).json({
        status: 'error',
        error: 'Job ID is required',
      });
      return;
    }

    const runner = getUpdateRunner();
    const cancelled = await runner.cancel(jobId);

    if (!cancelled) {
      res.status(400).json({
        status: 'error',
        error: 'Cannot cancel job. Job not found or not running.',
      });
      return;
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
 * POST /retry/:jobId
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

    const failedItems = await UpdateJobItemRepository.findFailed(jobId);
    if (failedItems.length === 0) {
      return res.status(400).json({
        status: 'error',
        error: 'No failed items to retry',
      });
    }

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

/**
 * GET /schedule
 * Получить текущее расписание
 */
router.get('/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
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
 * PUT /schedule
 * Обновить расписание (требует прав администратора)
 */
router.put('/schedule', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = updateScheduleSchema.parse(req.body);

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

/**
 * GET /health
 * Health check службы обновлений
 */
router.get('/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [sources, catalogStats, jobStats] = await Promise.all([
      PriceSourceRepository.findActive(),
      PriceCatalogRepository.getStats(),
      UpdateJobRepository.getStats(),
    ]);

    const parsersHealth = sources.reduce(
      (acc, source) => {
        acc[source.type] = {
          available: source.is_active && source.circuit_breaker_state !== 'open',
          circuitBreakerState: source.circuit_breaker_state,
          failures: source.circuit_breaker_failures,
        };
        return acc;
      },
      {} as Record<string, any>,
    );

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
 * GET /metrics
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
 * GET /logs/:jobId
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
