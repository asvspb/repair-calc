import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  ABTestRepository,
  type ParserType as ABParserType,
  type TestStatus,
} from '../../db/repositories/abTest.repo.js';
import { getParserManager } from '../../services/update/parserManager.js';
import { createABTestSchema, updateABTestSchema, completeABTestSchema } from './schemas.js';

import { authenticate } from '../../middleware/auth.js';
import { adminGuard } from '../../middleware/adminGuard.js';

export const router = Router();

// Защищаем все A/B тесты правами администратора
router.use(authenticate, adminGuard);

/**
 * GET /ab-tests
 * Список A/B тестов
 */
router.get('/ab-tests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const status = req.query.status as TestStatus | undefined;
    const parser = req.query.parser as ABParserType | undefined;

    const { items, total } = await ABTestRepository.findMany({
      limit,
      offset,
      status,
      parser,
    });

    res.json({
      status: 'success',
      data: {
        tests: items.map(test => ({
          id: test.id,
          name: test.name,
          description: test.description,
          parsers: {
            a: test.parser_a,
            b: test.parser_b,
          },
          trafficSplit: test.traffic_split,
          status: test.status,
          results: {
            requestsA: test.total_requests_a,
            requestsB: test.total_requests_b,
            successA: test.success_count_a,
            successB: test.success_count_b,
            avgResponseTimeA: test.avg_response_time_a,
            avgResponseTimeB: test.avg_response_time_b,
          },
          winner: test.winner,
          confidenceLevel: test.confidence_level,
          startedAt: test.started_at,
          endedAt: test.ended_at,
          createdAt: test.created_at,
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
 * POST /ab-tests
 * Создать новый A/B тест
 */
router.post('/ab-tests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = createABTestSchema.parse(req.body);
    const userId = (req as any).user?.id;

    if (input.parser_a === input.parser_b) {
      return res.status(400).json({
        status: 'error',
        error: 'Parsers A and B must be different',
      });
    }

    const runningTests = await ABTestRepository.findRunning();
    const conflict = runningTests.find(
      t =>
        (t.parser_a === input.parser_a && t.parser_b === input.parser_b) ||
        (t.parser_a === input.parser_b && t.parser_b === input.parser_a),
    );

    if (conflict) {
      return res.status(409).json({
        status: 'error',
        error: 'A running test already exists with these parsers',
        details: { testId: conflict.id },
      });
    }

    const test = await ABTestRepository.create({
      name: input.name,
      description: input.description,
      parser_a: input.parser_a,
      parser_b: input.parser_b,
      traffic_split: input.traffic_split,
      created_by: userId,
    });

    res.status(201).json({
      status: 'success',
      data: {
        id: test.id,
        name: test.name,
        parsers: {
          a: test.parser_a,
          b: test.parser_b,
        },
        trafficSplit: test.traffic_split,
        status: test.status,
        createdAt: test.created_at,
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
 * GET /ab-tests/active
 * Получить текущий активный A/B тест
 */
router.get('/ab-tests/active', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parserManager = getParserManager();
    const config = parserManager.getABTestConfig();

    if (!config.enabled || !config.testId) {
      return res.json({
        status: 'success',
        data: {
          active: false,
          test: null,
        },
      });
    }

    const test = await ABTestRepository.findById(config.testId);
    if (!test) {
      return res.json({
        status: 'success',
        data: {
          active: false,
          test: null,
        },
      });
    }

    const stats = await ABTestRepository.getStats(config.testId);

    res.json({
      status: 'success',
      data: {
        active: true,
        test: {
          id: test.id,
          name: test.name,
          parsers: {
            a: test.parser_a,
            b: test.parser_b,
          },
          trafficSplit: test.traffic_split,
          stats: stats
            ? {
                groupA: stats.groupA,
                groupB: stats.groupB,
                winner: stats.winner,
                confidenceLevel: stats.confidenceLevel,
              }
            : null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /ab-tests/:id
 * Получить A/B тест по ID
 */
router.get('/ab-tests/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const test = await ABTestRepository.findById(id);
    if (!test) {
      return res.status(404).json({
        status: 'error',
        error: 'Test not found',
      });
    }

    const stats = await ABTestRepository.getStats(id);

    res.json({
      status: 'success',
      data: {
        id: test.id,
        name: test.name,
        description: test.description,
        parsers: {
          a: test.parser_a,
          b: test.parser_b,
        },
        trafficSplit: test.traffic_split,
        status: test.status,
        results: {
          requestsA: test.total_requests_a,
          requestsB: test.total_requests_b,
          successA: test.success_count_a,
          successB: test.success_count_b,
          avgResponseTimeA: test.avg_response_time_a,
          avgResponseTimeB: test.avg_response_time_b,
          avgPriceA: test.avg_price_a,
          avgPriceB: test.avg_price_b,
        },
        stats: stats
          ? {
              groupA: stats.groupA,
              groupB: stats.groupB,
              winner: stats.winner,
              confidenceLevel: stats.confidenceLevel,
            }
          : null,
        winner: test.winner,
        confidenceLevel: test.confidence_level,
        startedAt: test.started_at,
        endedAt: test.ended_at,
        createdAt: test.created_at,
        updatedAt: test.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /ab-tests/:id
 * Обновить A/B тест (только в статусе draft)
 */
router.put('/ab-tests/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const input = updateABTestSchema.parse(req.body);

    const test = await ABTestRepository.findById(id);
    if (!test) {
      return res.status(404).json({
        status: 'error',
        error: 'Test not found',
      });
    }

    if (test.status !== 'draft') {
      return res.status(400).json({
        status: 'error',
        error: 'Can only update tests in draft status',
      });
    }

    const updated = await ABTestRepository.update(id, {
      name: input.name,
      description: input.description,
      traffic_split: input.traffic_split,
    });

    res.json({
      status: 'success',
      data: {
        id: updated!.id,
        name: updated!.name,
        description: updated!.description,
        trafficSplit: updated!.traffic_split,
        status: updated!.status,
        updatedAt: updated!.updated_at,
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
 * DELETE /ab-tests/:id
 * Удалить A/B тест (только в статусе draft)
 */
router.delete('/ab-tests/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const test = await ABTestRepository.findById(id);
    if (!test) {
      return res.status(404).json({
        status: 'error',
        error: 'Test not found',
      });
    }

    if (test.status !== 'draft') {
      return res.status(400).json({
        status: 'error',
        error: 'Can only delete tests in draft status',
      });
    }

    const deleted = await ABTestRepository.delete(id);

    res.json({
      status: 'success',
      data: {
        id,
        deleted,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /ab-tests/:id/start
 * Запустить A/B тест
 */
router.post('/ab-tests/:id/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const test = await ABTestRepository.start(id, userId);
    if (!test) {
      return res.status(400).json({
        status: 'error',
        error: 'Cannot start test. Test not found or not in draft status.',
      });
    }

    const parserManager = getParserManager();
    await parserManager.enableABTest(test.id);

    res.json({
      status: 'success',
      data: {
        id: test.id,
        status: test.status,
        startedAt: test.started_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /ab-tests/:id/pause
 * Приостановить A/B тест
 */
router.post('/ab-tests/:id/pause', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const test = await ABTestRepository.pause(id);
    if (!test) {
      return res.status(400).json({
        status: 'error',
        error: 'Cannot pause test. Test not found or not running.',
      });
    }

    const parserManager = getParserManager();
    parserManager.disableABTest();

    res.json({
      status: 'success',
      data: {
        id: test.id,
        status: test.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /ab-tests/:id/resume
 * Возобновить A/B тест
 */
router.post('/ab-tests/:id/resume', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const test = await ABTestRepository.resume(id);
    if (!test) {
      return res.status(400).json({
        status: 'error',
        error: 'Cannot resume test. Test not found or not paused.',
      });
    }

    const parserManager = getParserManager();
    await parserManager.enableABTest(test.id);

    res.json({
      status: 'success',
      data: {
        id: test.id,
        status: test.status,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /ab-tests/:id/complete
 * Завершить A/B тест с указанием победителя
 */
router.post('/ab-tests/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const input = completeABTestSchema.parse(req.body);
    const userId = (req as any).user?.id;

    const test = await ABTestRepository.complete(id, input.winner, input.confidence_level, userId);
    if (!test) {
      return res.status(400).json({
        status: 'error',
        error: 'Cannot complete test. Test not found or not in running/paused status.',
      });
    }

    const parserManager = getParserManager();
    parserManager.disableABTest();

    res.json({
      status: 'success',
      data: {
        id: test.id,
        status: test.status,
        winner: test.winner,
        confidenceLevel: test.confidence_level,
        endedAt: test.ended_at,
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
 * POST /ab-tests/:id/cancel
 * Отменить A/B тест
 */
router.post('/ab-tests/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    const test = await ABTestRepository.cancel(id, userId);
    if (!test) {
      return res.status(400).json({
        status: 'error',
        error: 'Cannot cancel test. Test not found or already completed/cancelled.',
      });
    }

    const parserManager = getParserManager();
    parserManager.disableABTest();

    res.json({
      status: 'success',
      data: {
        id: test.id,
        status: test.status,
        endedAt: test.ended_at,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /ab-tests/:id/results
 * Получить результаты A/B теста
 */
router.get('/ab-tests/:id/results', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const parser_group = req.query.parser_group as 'a' | 'b' | undefined;
    const success =
      req.query.success === 'true' ? true : req.query.success === 'false' ? false : undefined;

    const test = await ABTestRepository.findById(id);
    if (!test) {
      return res.status(404).json({
        status: 'error',
        error: 'Test not found',
      });
    }

    const { items, total } = await ABTestRepository.getResults(id, {
      parser_group,
      success,
      limit,
      offset,
    });

    res.json({
      status: 'success',
      data: {
        testId: id,
        results: items.map(r => ({
          id: r.id,
          itemName: r.item_name,
          city: r.city,
          category: r.category,
          parserGroup: r.parser_group,
          parserType: r.parser_type,
          success: r.success,
          prices: {
            min: r.price_min,
            avg: r.price_avg,
            max: r.price_max,
            currency: r.currency,
          },
          confidenceScore: r.confidence_score,
          responseTimeMs: r.response_time_ms,
          errorMessage: r.error_message,
          createdAt: r.created_at,
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
 * GET /ab-tests/:id/stats
 * Получить статистику A/B теста
 */
router.get('/ab-tests/:id/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const test = await ABTestRepository.findById(id);
    if (!test) {
      return res.status(404).json({
        status: 'error',
        error: 'Test not found',
      });
    }

    const stats = await ABTestRepository.getStats(id);

    const dailyStats = await ABTestRepository.getDailyStats(id, 30);

    res.json({
      status: 'success',
      data: {
        testId: id,
        summary: stats,
        daily: dailyStats.map(d => ({
          date: d.date,
          groupA: {
            requests: d.requests_a,
            success: d.success_a,
            failures: d.failures_a,
            avgResponseTime: d.requests_a > 0 ? d.total_response_time_a / d.requests_a : 0,
            avgPrice: d.requests_a > 0 ? parseFloat(d.total_price_a) / d.requests_a : 0,
          },
          groupB: {
            requests: d.requests_b,
            success: d.success_b,
            failures: d.failures_b,
            avgResponseTime: d.requests_b > 0 ? d.total_response_time_b / d.requests_b : 0,
            avgPrice: d.requests_b > 0 ? parseFloat(d.total_price_b) / d.requests_b : 0,
          },
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /ab-tests/:id/check-completion
 * Проверить и автоматически завершить тест при достижении уверенности
 */
router.post(
  '/ab-tests/:id/check-completion',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const threshold = parseFloat(req.query.threshold as string) || 0.95;

      const test = await ABTestRepository.findById(id);
      if (!test) {
        return res.status(404).json({
          status: 'error',
          error: 'Test not found',
        });
      }

      if (test.status !== 'running') {
        return res.status(400).json({
          status: 'error',
          error: 'Test is not running',
        });
      }

      const stats = await ABTestRepository.getStats(id);
      if (!stats) {
        return res.json({
          status: 'success',
          data: {
            canComplete: false,
            reason: 'No results yet',
          },
        });
      }

      const minRequests = 100;
      if (stats.groupA.requests < minRequests || stats.groupB.requests < minRequests) {
        return res.json({
          status: 'success',
          data: {
            canComplete: false,
            reason: `Need at least ${minRequests} requests per group`,
            currentRequests: {
              groupA: stats.groupA.requests,
              groupB: stats.groupB.requests,
            },
          },
        });
      }

      if (stats.confidenceLevel !== null && stats.confidenceLevel >= threshold && stats.winner) {
        const userId = (req as any).user?.id;
        await ABTestRepository.complete(id, stats.winner, stats.confidenceLevel, userId);

        const parserManager = getParserManager();
        parserManager.disableABTest();

        return res.json({
          status: 'success',
          data: {
            canComplete: true,
            completed: true,
            winner: stats.winner,
            confidenceLevel: stats.confidenceLevel,
          },
        });
      }

      return res.json({
        status: 'success',
        data: {
          canComplete: false,
          reason: 'Confidence level below threshold',
          confidenceLevel: stats.confidenceLevel,
          threshold,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
