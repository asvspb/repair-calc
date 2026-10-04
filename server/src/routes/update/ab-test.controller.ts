import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from '../../types/index.js';
import {
  ABTestRepository,
  type ABTest,
  type ABTestStats,
  type ParserType as ABParserType,
  type TestStatus,
} from '../../db/repositories/abTest.repo.js';
import { createABTestSchema, updateABTestSchema } from './schemas.js';

// ═══════════════════════════════════════════════════════
// ОБРАБОТЧИКИ CRUD/ЧТЕНИЯ A/B ТЕСТОВ (вынесено из ab-test.routes.ts)
// ═══════════════════════════════════════════════════════

interface StatsPayload {
  groupA: ABTestStats['groupA'];
  groupB: ABTestStats['groupB'];
  winner: ABTestStats['winner'];
  confidenceLevel: ABTestStats['confidenceLevel'];
}

function statsToPayload(stats: ABTestStats | null): StatsPayload | null {
  return stats
    ? {
        groupA: stats.groupA,
        groupB: stats.groupB,
        winner: stats.winner,
        confidenceLevel: stats.confidenceLevel,
      }
    : null;
}

function testToListItem(test: ABTest) {
  return {
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
  };
}

function testToDetail(test: ABTest, stats: ABTestStats | null) {
  return {
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
    stats: statsToPayload(stats),
    winner: test.winner,
    confidenceLevel: test.confidence_level,
    startedAt: test.started_at,
    endedAt: test.ended_at,
    createdAt: test.created_at,
    updatedAt: test.updated_at,
  };
}

/**
 * GET /ab-tests — список A/B тестов.
 */
export async function listTests(req: Request, res: Response, next: NextFunction): Promise<void> {
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
        tests: items.map(testToListItem),
        total,
        limit,
        offset,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /ab-tests — создать новый A/B тест.
 */
export async function createTest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = createABTestSchema.parse(req.body);
    const userId = (req as AuthRequest).user?.id;

    if (input.parser_a === input.parser_b) {
      res.status(400).json({
        status: 'error',
        error: 'Parsers A and B must be different',
      });
      return;
    }

    const runningTests = await ABTestRepository.findRunning();
    const conflict = runningTests.find(
      t =>
        (t.parser_a === input.parser_a && t.parser_b === input.parser_b) ||
        (t.parser_a === input.parser_b && t.parser_b === input.parser_a),
    );

    if (conflict) {
      res.status(409).json({
        status: 'error',
        error: 'A running test already exists with these parsers',
        details: { testId: conflict.id },
      });
      return;
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
 * GET /ab-tests/:id — получить A/B тест по ID.
 */
export async function getTest(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    res.json({
      status: 'success',
      data: testToDetail(test, stats),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /ab-tests/:id — обновить A/B тест (только в статусе draft).
 */
export async function updateTest(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const input = updateABTestSchema.parse(req.body);

    const test = await ABTestRepository.findById(id);
    if (!test) {
      res.status(404).json({
        status: 'error',
        error: 'Test not found',
      });
      return;
    }

    if (test.status !== 'draft') {
      res.status(400).json({
        status: 'error',
        error: 'Can only update tests in draft status',
      });
      return;
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
 * DELETE /ab-tests/:id — удалить A/B тест (только в статусе draft).
 */
export async function deleteTest(req: Request, res: Response, next: NextFunction): Promise<void> {
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

    if (test.status !== 'draft') {
      res.status(400).json({
        status: 'error',
        error: 'Can only delete tests in draft status',
      });
      return;
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
}

/**
 * GET /ab-tests/:id/results — результаты A/B теста.
 */
export async function getTestResults(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const parser_group = req.query.parser_group as 'a' | 'b' | undefined;
    const success =
      req.query.success === 'true' ? true : req.query.success === 'false' ? false : undefined;

    const test = await ABTestRepository.findById(id);
    if (!test) {
      res.status(404).json({
        status: 'error',
        error: 'Test not found',
      });
      return;
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
}
