import { query } from '../pool.js';
import type { RowDataPacket } from '../pool.js';
import type {
  ABTest,
  ABTestRepoThis,
  ABTestDailyStats,
  ABTestResult,
  ABTestStats,
  ParserGroup,
  ParserType,
  TestStatus,
  Winner,
} from './abTest.types.js';

// ═══════════════════════════════════════════════════════
// ЧТЕНИЕ A/B ТЕСТОВ (вынесено из abTest.repo.ts).
// Методы вызываются на собранном объекте ABTestRepository —
// `this` указывает на него.
// ═══════════════════════════════════════════════════════

export const abTestReadMethods = {
  async findById(id: string): Promise<ABTest | null> {
    const rows = await query<RowDataPacket[]>('SELECT * FROM ab_tests WHERE id = ?', [id]);
    return rows.length > 0 ? (rows[0] as unknown as ABTest) : null;
  },

  async findMany(options?: {
    status?: TestStatus;
    parser?: ParserType;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ABTest[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (options?.status) {
      conditions.push('status = ?');
      params.push(options.status);
    }

    if (options?.parser) {
      conditions.push('(parser_a = ? OR parser_b = ?)');
      params.push(options.parser, options.parser);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count
    const countRows = await query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM ab_tests ${whereClause}`,
      params as any,
    );
    const total = Number(countRows[0]?.total ?? 0);

    // Items
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const rows = await query<RowDataPacket[]>(
      `SELECT * FROM ab_tests ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset] as any,
    );

    return { items: rows as unknown as ABTest[], total };
  },

  async findRunning(): Promise<ABTest[]> {
    const rows = await query<RowDataPacket[]>('SELECT * FROM ab_tests WHERE status = ?', [
      'running',
    ]);
    return rows as unknown as ABTest[];
  },

  async findActiveForParser(parserType: ParserType): Promise<ABTest[]> {
    const rows = await query<RowDataPacket[]>(
      `SELECT * FROM ab_tests
       WHERE status = 'running'
       AND (parser_a = ? OR parser_b = ?)`,
      [parserType, parserType],
    );
    return rows as unknown as ABTest[];
  },

  async getResults(
    testId: string,
    options?: {
      parser_group?: ParserGroup;
      success?: boolean;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ items: ABTestResult[]; total: number }> {
    const conditions: string[] = ['test_id = ?'];
    const params: unknown[] = [testId];

    if (options?.parser_group) {
      conditions.push('parser_group = ?');
      params.push(options.parser_group);
    }

    if (options?.success !== undefined) {
      conditions.push('success = ?');
      params.push(options.success);
    }

    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const countRows = await query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM ab_test_results WHERE ${conditions.join(' AND ')}`,
      params as any,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const rows = await query<RowDataPacket[]>(
      `SELECT * FROM ab_test_results WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset] as any,
    );

    return { items: rows as unknown as ABTestResult[], total };
  },

  async getStats(this: ABTestRepoThis, testId: string): Promise<ABTestStats | null> {
    const test = await this.findById(testId);
    if (!test) return null;

    const rows = await query<RowDataPacket[]>(
      `SELECT
        parser_group,
        COUNT(*) as requests,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
        AVG(response_time_ms) as avg_response_time,
        AVG(CAST(price_avg AS DECIMAL(12,2))) as avg_price
       FROM ab_test_results
       WHERE test_id = ?
       GROUP BY parser_group`,
      [testId],
    );

    const statsA = rows.find(r => r.parser_group === 'a');
    const statsB = rows.find(r => r.parser_group === 'b');

    const reqA = Number(statsA?.requests || 0);
    const succA = Number(statsA?.success_count || 0);
    const groupA = {
      requests: reqA,
      successRate: reqA > 0 ? (succA / reqA) * 100 : 0,
      avgResponseTime: Number(statsA?.avg_response_time || 0),
      avgPrice: statsA?.avg_price ? Number(statsA.avg_price) : null,
    };

    const reqB = Number(statsB?.requests || 0);
    const succB = Number(statsB?.success_count || 0);
    const groupB = {
      requests: reqB,
      successRate: reqB > 0 ? (succB / reqB) * 100 : 0,
      avgResponseTime: Number(statsB?.avg_response_time || 0),
      avgPrice: statsB?.avg_price ? Number(statsB.avg_price) : null,
    };

    // Определяем победителя на основе статистики
    const { winner, confidenceLevel } = this.calculateWinner(groupA, groupB);

    return {
      testId,
      groupA,
      groupB,
      winner,
      confidenceLevel,
    };
  },

  calculateWinner(
    groupA: { successRate: number; avgResponseTime: number; avgPrice: number | null },
    groupB: { successRate: number; avgResponseTime: number; avgPrice: number | null },
  ): { winner: Winner; confidenceLevel: number } {
    // Оценка на основе success rate и времени ответа
    // Формула: score = successRate * 0.6 - avgResponseTime * 0.001 * 0.4

    const scoreA = groupA.successRate * 0.6 - groupA.avgResponseTime * 0.0004;
    const scoreB = groupB.successRate * 0.6 - groupB.avgResponseTime * 0.0004;

    const diff = Math.abs(scoreA - scoreB);
    const maxScore = Math.max(scoreA, scoreB);

    // Confidence level на основе разницы
    const confidenceLevel = Math.min(diff / maxScore, 1);

    if (scoreA > scoreB) {
      return { winner: 'parser_a', confidenceLevel };
    } else if (scoreB > scoreA) {
      return { winner: 'parser_b', confidenceLevel };
    }

    return { winner: 'tie', confidenceLevel: 0 };
  },

  async getDailyStats(testId: string, days?: number): Promise<ABTestDailyStats[]> {
    const limit = days || 30;

    const rows = await query<RowDataPacket[]>(
      `SELECT * FROM ab_test_daily_stats
       WHERE test_id = ?
       ORDER BY date DESC
       LIMIT ?`,
      [testId, limit],
    );

    return rows as unknown as ABTestDailyStats[];
  },
};
