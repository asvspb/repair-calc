import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../../types/index.js';
import { ABTestRepository } from '../../db/repositories/abTest.repo.js';
import { getParserManager } from '../../services/update/parserManager.js';
import { completeABTestSchema } from './schemas.js';

// ═══════════════════════════════════════════════════════
// ОБРАБОТЧИКИ ЖИЗНЕННОГО ЦИКЛА A/B ТЕСТОВ
// (start/pause/resume/complete/cancel/active/check-completion,
//  вынесено из ab-test.routes.ts)
// ═══════════════════════════════════════════════════════

/**
 * GET /ab-tests/active — текущий активный A/B тест.
 */
export async function getActiveTest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parserManager = getParserManager();
    const config = parserManager.getABTestConfig();

    if (!config.enabled || !config.testId) {
      res.json({
        status: 'success',
        data: {
          active: false,
          test: null,
        },
      });
      return;
    }

    const test = await ABTestRepository.findById(config.testId);
    if (!test) {
      res.json({
        status: 'success',
        data: {
          active: false,
          test: null,
        },
      });
      return;
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
}

/**
 * POST /ab-tests/:id/start — запустить A/B тест.
 */
export async function startTest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).user?.id;

    const test = await ABTestRepository.start(id, userId);
    if (!test) {
      res.status(400).json({
        status: 'error',
        error: 'Cannot start test. Test not found or not in draft status.',
      });
      return;
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
}

/**
 * POST /ab-tests/:id/pause — приостановить A/B тест.
 */
export async function pauseTest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const test = await ABTestRepository.pause(id);
    if (!test) {
      res.status(400).json({
        status: 'error',
        error: 'Cannot pause test. Test not found or not running.',
      });
      return;
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
}

/**
 * POST /ab-tests/:id/resume — возобновить A/B тест.
 */
export async function resumeTest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const test = await ABTestRepository.resume(id);
    if (!test) {
      res.status(400).json({
        status: 'error',
        error: 'Cannot resume test. Test not found or not paused.',
      });
      return;
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
}

/**
 * POST /ab-tests/:id/complete — завершить A/B тест с указанием победителя.
 */
export async function completeTest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const input = completeABTestSchema.parse(req.body);
    const userId = (req as AuthRequest).user?.id;

    const test = await ABTestRepository.complete(id, input.winner, input.confidence_level, userId);
    if (!test) {
      res.status(400).json({
        status: 'error',
        error: 'Cannot complete test. Test not found or not in running/paused status.',
      });
      return;
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
      res.status(400).json({
        status: 'error',
        error: 'Validation error',
        details: error.errors,
      });
      return;
    }
    next(error);
  }
}

/**
 * POST /ab-tests/:id/cancel — отменить A/B тест.
 */
export async function cancelTest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).user?.id;

    const test = await ABTestRepository.cancel(id, userId);
    if (!test) {
      res.status(400).json({
        status: 'error',
        error: 'Cannot cancel test. Test not found or already completed/cancelled.',
      });
      return;
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
}

/**
 * GET /ab-tests/:id/stats — статистика A/B теста.
 */
export async function getTestStats(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const test = await ABTestRepository.findById(id);
    if (!test) {
      res.status(404).json({
        status: 'error',
        error: 'Test not found',
      });
      return;
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
}

/**
 * POST /ab-tests/:id/check-completion — проверить и автоматически завершить
 * тест при достижении уверенности.
 */
export async function checkTestCompletion(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const threshold = parseFloat(req.query.threshold as string) || 0.95;

    const test = await ABTestRepository.findById(id);
    if (!test) {
      res.status(404).json({
        status: 'error',
        error: 'Test not found',
      });
      return;
    }

    if (test.status !== 'running') {
      res.status(400).json({
        status: 'error',
        error: 'Test is not running',
      });
      return;
    }

    const stats = await ABTestRepository.getStats(id);
    if (!stats) {
      res.json({
        status: 'success',
        data: {
          canComplete: false,
          reason: 'No results yet',
        },
      });
      return;
    }

    const minRequests = 100;
    if (stats.groupA.requests < minRequests || stats.groupB.requests < minRequests) {
      res.json({
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
      return;
    }

    if (stats.confidenceLevel !== null && stats.confidenceLevel >= threshold && stats.winner) {
      const userId = (req as AuthRequest).user?.id;
      await ABTestRepository.complete(id, stats.winner, stats.confidenceLevel, userId);

      const parserManager = getParserManager();
      parserManager.disableABTest();

      res.json({
        status: 'success',
        data: {
          canComplete: true,
          completed: true,
          winner: stats.winner,
          confidenceLevel: stats.confidenceLevel,
        },
      });
      return;
    }

    res.json({
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
}
