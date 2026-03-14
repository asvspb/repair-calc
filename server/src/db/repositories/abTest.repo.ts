/**
 * Repository для A/B тестирования парсеров
 */

import { pool } from '../pool.js';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { randomUUID } from 'crypto';

// ═══════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════

export type ParserType = 'ai_gemini' | 'ai_mistral' | 'web_scraper' | 'api';
export type TestStatus = 'draft' | 'running' | 'paused' | 'completed' | 'cancelled';
export type ParserGroup = 'a' | 'b';
export type Winner = 'parser_a' | 'parser_b' | 'tie';

export interface ABTest {
  id: string;
  name: string;
  description: string | null;
  parser_a: ParserType;
  parser_b: ParserType;
  traffic_split: number;
  status: TestStatus;
  started_at: Date | null;
  ended_at: Date | null;
  total_requests_a: number;
  total_requests_b: number;
  success_count_a: number;
  success_count_b: number;
  avg_response_time_a: number;
  avg_response_time_b: number;
  avg_price_a: string | null;
  avg_price_b: string | null;
  winner: Winner | null;
  confidence_level: string | null;
  created_by: string | null;
  completed_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ABTestResult {
  id: string;
  test_id: string;
  item_name: string;
  city: string;
  category: string;
  parser_group: ParserGroup;
  parser_type: ParserType;
  success: boolean;
  price_min: string | null;
  price_avg: string | null;
  price_max: string | null;
  currency: string;
  confidence_score: string | null;
  response_time_ms: number | null;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface ABTestDailyStats {
  id: string;
  test_id: string;
  date: Date;
  requests_a: number;
  success_a: number;
  failures_a: number;
  total_response_time_a: number;
  total_price_a: string;
  requests_b: number;
  success_b: number;
  failures_b: number;
  total_response_time_b: number;
  total_price_b: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateABTestInput {
  name: string;
  description?: string;
  parser_a: ParserType;
  parser_b: ParserType;
  traffic_split?: number;
  created_by?: string;
}

export interface ABTestResultInput {
  test_id: string;
  item_name: string;
  city: string;
  category: string;
  parser_group: ParserGroup;
  parser_type: ParserType;
  success: boolean;
  price_min?: number;
  price_avg?: number;
  price_max?: number;
  currency?: string;
  confidence_score?: number;
  response_time_ms?: number;
  error_message?: string;
  metadata?: Record<string, unknown>;
}

export interface ABTestStats {
  testId: string;
  groupA: {
    requests: number;
    successRate: number;
    avgResponseTime: number;
    avgPrice: number | null;
  };
  groupB: {
    requests: number;
    successRate: number;
    avgResponseTime: number;
    avgPrice: number | null;
  };
  winner: Winner | null;
  confidenceLevel: number | null;
}

// ═══════════════════════════════════════════════════════
// РЕПОЗИТОРИЙ A/B ТЕСТОВ
// ═══════════════════════════════════════════════════════

export const ABTestRepository = {
  // ─── CRUD ОПЕРАЦИИ ────────────────────────────────────────

  async create(input: CreateABTestInput): Promise<ABTest> {
    const id = randomUUID();
    const now = new Date();

    await pool.execute<ResultSetHeader>(
      `INSERT INTO ab_tests (
        id, name, description, parser_a, parser_b, traffic_split,
        status, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)`,
      [
        id,
        input.name,
        input.description || null,
        input.parser_a,
        input.parser_b,
        input.traffic_split || 50,
        input.created_by || null,
        now,
        now,
      ]
    );

    return this.findById(id) as Promise<ABTest>;
  },

  async findById(id: string): Promise<ABTest | null> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM ab_tests WHERE id = ?',
      [id]
    );
    return rows[0] as ABTest | null;
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
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM ab_tests ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    // Items
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM ab_tests ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { items: rows as ABTest[], total };
  },

  async findRunning(): Promise<ABTest[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM ab_tests WHERE status = ?',
      ['running']
    );
    return rows as ABTest[];
  },

  async findActiveForParser(parserType: ParserType): Promise<ABTest[]> {
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM ab_tests 
       WHERE status = 'running' 
       AND (parser_a = ? OR parser_b = ?)`,
      [parserType, parserType]
    );
    return rows as ABTest[];
  },

  async update(id: string, data: Partial<{
    name: string;
    description: string;
    traffic_split: number;
    status: TestStatus;
    started_at: Date | null;
    ended_at: Date | null;
    winner: Winner | null;
    confidence_level: number | null;
    completed_by: string | null;
  }>): Promise<ABTest | null> {
    const fields: string[] = [];
    const params: unknown[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      params.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push('description = ?');
      params.push(data.description);
    }
    if (data.traffic_split !== undefined) {
      fields.push('traffic_split = ?');
      params.push(data.traffic_split);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      params.push(data.status);
    }
    if (data.started_at !== undefined) {
      fields.push('started_at = ?');
      params.push(data.started_at);
    }
    if (data.ended_at !== undefined) {
      fields.push('ended_at = ?');
      params.push(data.ended_at);
    }
    if (data.winner !== undefined) {
      fields.push('winner = ?');
      params.push(data.winner);
    }
    if (data.confidence_level !== undefined) {
      fields.push('confidence_level = ?');
      params.push(data.confidence_level);
    }
    if (data.completed_by !== undefined) {
      fields.push('completed_by = ?');
      params.push(data.completed_by);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push('updated_at = ?');
    params.push(new Date());

    await pool.execute<ResultSetHeader>(
      `UPDATE ab_tests SET ${fields.join(', ')} WHERE id = ?`,
      [...params, id]
    );

    return this.findById(id);
  },

  async delete(id: string): Promise<boolean> {
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM ab_tests WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  },

  // ─── УПРАВЛЕНИЕ СТАТУСОМ ──────────────────────────────────

  async start(id: string, userId?: string): Promise<ABTest | null> {
    const test = await this.findById(id);
    if (!test || test.status !== 'draft') {
      return null;
    }

    return this.update(id, {
      status: 'running',
      started_at: new Date(),
    });
  },

  async pause(id: string): Promise<ABTest | null> {
    const test = await this.findById(id);
    if (!test || test.status !== 'running') {
      return null;
    }

    return this.update(id, { status: 'paused' });
  },

  async resume(id: string): Promise<ABTest | null> {
    const test = await this.findById(id);
    if (!test || test.status !== 'paused') {
      return null;
    }

    return this.update(id, { status: 'running' });
  },

  async complete(id: string, winner: Winner, confidenceLevel: number, userId?: string): Promise<ABTest | null> {
    const test = await this.findById(id);
    if (!test || !['running', 'paused'].includes(test.status)) {
      return null;
    }

    return this.update(id, {
      status: 'completed',
      ended_at: new Date(),
      winner,
      confidence_level: confidenceLevel,
      completed_by: userId || null,
    });
  },

  async cancel(id: string, userId?: string): Promise<ABTest | null> {
    const test = await this.findById(id);
    if (!test || !['draft', 'running', 'paused'].includes(test.status)) {
      return null;
    }

    return this.update(id, {
      status: 'cancelled',
      ended_at: new Date(),
      completed_by: userId || null,
    });
  },

  // ─── РЕЗУЛЬТАТЫ ────────────────────────────────────────────

  async addResult(input: ABTestResultInput): Promise<ABTestResult> {
    const id = randomUUID();

    await pool.execute<ResultSetHeader>(
      `INSERT INTO ab_test_results (
        id, test_id, item_name, city, category, parser_group, parser_type,
        success, price_min, price_avg, price_max, currency, confidence_score,
        response_time_ms, error_message, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.test_id,
        input.item_name,
        input.city,
        input.category,
        input.parser_group,
        input.parser_type,
        input.success,
        input.price_min || null,
        input.price_avg || null,
        input.price_max || null,
        input.currency || 'RUB',
        input.confidence_score || null,
        input.response_time_ms || null,
        input.error_message || null,
        JSON.stringify(input.metadata || {}),
        new Date(),
      ]
    );

    // Обновляем агрегированные счётчики в тесте
    await this.updateTestCounters(input.test_id, input.parser_group, {
      success: input.success,
      responseTime: input.response_time_ms,
      price: input.price_avg,
    });

    // Обновляем дневную статистику
    await this.updateDailyStats(input.test_id, input.parser_group, {
      success: input.success,
      responseTime: input.response_time_ms,
      price: input.price_avg,
    });

    const [rows] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM ab_test_results WHERE id = ?',
      [id]
    );
    return rows[0] as ABTestResult;
  },

  async getResults(testId: string, options?: {
    parser_group?: ParserGroup;
    success?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ABTestResult[]; total: number }> {
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

    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM ab_test_results WHERE ${conditions.join(' AND ')}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM ab_test_results WHERE ${conditions.join(' AND ')} 
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { items: rows as ABTestResult[], total };
  },

  // ─── СТАТИСТИКА ────────────────────────────────────────────

  async getStats(testId: string): Promise<ABTestStats | null> {
    const test = await this.findById(testId);
    if (!test) return null;

    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        parser_group,
        COUNT(*) as requests,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
        AVG(response_time_ms) as avg_response_time,
        AVG(CAST(price_avg AS DECIMAL(12,2))) as avg_price
       FROM ab_test_results 
       WHERE test_id = ?
       GROUP BY parser_group`,
      [testId]
    );

    const statsA = rows.find((r) => r.parser_group === 'a');
    const statsB = rows.find((r) => r.parser_group === 'b');

    const groupA = {
      requests: statsA?.requests || 0,
      successRate: statsA ? (statsA.success_count / statsA.requests) * 100 : 0,
      avgResponseTime: statsA?.avg_response_time || 0,
      avgPrice: statsA?.avg_price || null,
    };

    const groupB = {
      requests: statsB?.requests || 0,
      successRate: statsB ? (statsB.success_count / statsB.requests) * 100 : 0,
      avgResponseTime: statsB?.avg_response_time || 0,
      avgPrice: statsB?.avg_price || null,
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
    groupB: { successRate: number; avgResponseTime: number; avgPrice: number | null }
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

  // ─── INTERNAL HELPERS ──────────────────────────────────────

  async updateTestCounters(
    testId: string,
    group: ParserGroup,
    data: { success: boolean; responseTime?: number; price?: number }
  ): Promise<void> {
    const fieldPrefix = group === 'a' ? 'a' : 'b';
    
    // Получаем текущие значения
    const test = await this.findById(testId);
    if (!test) return;

    const totalRequests = (group === 'a' ? test.total_requests_a : test.total_requests_b) + 1;
    const successCount = (group === 'a' ? test.success_count_a : test.success_count_b) + (data.success ? 1 : 0);

    // Скользящее среднее для времени ответа
    const oldAvgTime = group === 'a' ? test.avg_response_time_a : test.avg_response_time_b;
    const newAvgTime = data.responseTime 
      ? Math.round((oldAvgTime * (totalRequests - 1) + data.responseTime) / totalRequests)
      : oldAvgTime;

    // Скользящее среднее для цены
    const oldAvgPrice = parseFloat(group === 'a' ? (test.avg_price_a || '0') : (test.avg_price_b || '0'));
    const newAvgPrice = data.price 
      ? (oldAvgPrice * (totalRequests - 1) + data.price) / totalRequests
      : oldAvgPrice;

    await pool.execute<ResultSetHeader>(
      `UPDATE ab_tests SET 
        total_requests_${fieldPrefix} = ?,
        success_count_${fieldPrefix} = ?,
        avg_response_time_${fieldPrefix} = ?,
        avg_price_${fieldPrefix} = ?,
        updated_at = ?
       WHERE id = ?`,
      [
        totalRequests,
        successCount,
        newAvgTime,
        newAvgPrice || null,
        new Date(),
        testId,
      ]
    );
  },

  async updateDailyStats(
    testId: string,
    group: ParserGroup,
    data: { success: boolean; responseTime?: number; price?: number }
  ): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const id = `${testId}-${today}`;
    const fieldPrefix = group === 'a' ? 'a' : 'b';

    // Проверяем, есть ли запись за сегодня
    const [existing] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM ab_test_daily_stats WHERE test_id = ? AND date = ?',
      [testId, today]
    );

    if (existing.length === 0) {
      // Создаём новую запись
      await pool.execute<ResultSetHeader>(
        `INSERT INTO ab_test_daily_stats (
          id, test_id, date, 
          requests_${fieldPrefix}, success_${fieldPrefix}, failures_${fieldPrefix},
          total_response_time_${fieldPrefix}, total_price_${fieldPrefix},
          created_at, updated_at
        ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          testId,
          today,
          data.success ? 1 : 0,
          data.success ? 0 : 1,
          data.responseTime || 0,
          data.price || 0,
          new Date(),
          new Date(),
        ]
      );
    } else {
      // Обновляем существующую
      await pool.execute<ResultSetHeader>(
        `UPDATE ab_test_daily_stats SET 
          requests_${fieldPrefix} = requests_${fieldPrefix} + 1,
          success_${fieldPrefix} = success_${fieldPrefix} + ?,
          failures_${fieldPrefix} = failures_${fieldPrefix} + ?,
          total_response_time_${fieldPrefix} = total_response_time_${fieldPrefix} + ?,
          total_price_${fieldPrefix} = total_price_${fieldPrefix} + ?,
          updated_at = ?
         WHERE test_id = ? AND date = ?`,
        [
          data.success ? 1 : 0,
          data.success ? 0 : 1,
          data.responseTime || 0,
          data.price || 0,
          new Date(),
          testId,
          today,
        ]
      );
    }
  },

  async getDailyStats(testId: string, days?: number): Promise<ABTestDailyStats[]> {
    const limit = days || 30;
    
    const [rows] = await pool.execute<RowDataPacket[]>(
      `SELECT * FROM ab_test_daily_stats 
       WHERE test_id = ? 
       ORDER BY date DESC 
       LIMIT ?`,
      [testId, limit]
    );

    return rows as ABTestDailyStats[];
  },
};