import { execute, query } from '../pool.js';
import type { RowDataPacket } from '../pool.js';
import { randomUUID } from 'crypto';
import type {
  ABTest,
  ABTestRepoThis,
  ABTestResult,
  ParserGroup,
  TestStatus,
  Winner,
  CreateABTestInput,
  ABTestResultInput,
} from './abTest.types.js';

// ═══════════════════════════════════════════════════════
// ЗАПИСЬ A/B ТЕСТОВ (вынесено из abTest.repo.ts).
// Методы вызываются на собранном объекте ABTestRepository —
// `this` указывает на него.
// ═══════════════════════════════════════════════════════

export const abTestWriteMethods = {
  async create(this: ABTestRepoThis, input: CreateABTestInput): Promise<ABTest> {
    const id = randomUUID();
    const now = new Date();

    await execute(
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
      ],
    );

    return this.findById(id) as Promise<ABTest>;
  },

  async update(
    this: ABTestRepoThis,
    id: string,
    data: Partial<{
      name: string;
      description: string;
      traffic_split: number;
      status: TestStatus;
      started_at: Date | null;
      ended_at: Date | null;
      winner: Winner | null;
      confidence_level: number | null;
      completed_by: string | null;
    }>,
  ): Promise<ABTest | null> {
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

    await execute(`UPDATE ab_tests SET ${fields.join(', ')} WHERE id = ?`, [...params, id] as any);

    return this.findById(id);
  },

  async delete(this: ABTestRepoThis, id: string): Promise<boolean> {
    const result = await execute('DELETE FROM ab_tests WHERE id = ?', [id]);
    return result.affectedRows > 0;
  },

  // ─── УПРАВЛЕНИЕ СТАТУСОМ ──────────────────────────────────

  async start(this: ABTestRepoThis, _id: string, _userId?: string): Promise<ABTest | null> {
    const test = await this.findById(_id);
    if (!test || test.status !== 'draft') {
      return null;
    }

    return this.update(_id, {
      status: 'running',
      started_at: new Date(),
    });
  },

  async pause(this: ABTestRepoThis, id: string): Promise<ABTest | null> {
    const test = await this.findById(id);
    if (!test || test.status !== 'running') {
      return null;
    }

    return this.update(id, { status: 'paused' });
  },

  async resume(this: ABTestRepoThis, id: string): Promise<ABTest | null> {
    const test = await this.findById(id);
    if (!test || test.status !== 'paused') {
      return null;
    }

    return this.update(id, { status: 'running' });
  },

  async complete(
    this: ABTestRepoThis,
    id: string,
    winner: Winner,
    confidenceLevel: number,
    userId?: string,
  ): Promise<ABTest | null> {
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

  async cancel(this: ABTestRepoThis, id: string, userId?: string): Promise<ABTest | null> {
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

  // ─── РЕЗУЛЬТАТЫ И СЧЁТЧИКИ ────────────────────────────────

  async addResult(this: ABTestRepoThis, input: ABTestResultInput): Promise<ABTestResult> {
    const id = randomUUID();

    await execute(
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
      ],
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

    const rows = await query<RowDataPacket[]>('SELECT * FROM ab_test_results WHERE id = ?', [id]);
    return rows[0] as unknown as ABTestResult;
  },

  async updateTestCounters(
    this: ABTestRepoThis,
    testId: string,
    group: ParserGroup,
    data: { success: boolean; responseTime?: number; price?: number },
  ): Promise<void> {
    const fieldPrefix = group === 'a' ? 'a' : 'b';

    // Получаем текущие значения
    const test = await this.findById(testId);
    if (!test) return;

    const totalRequests = (group === 'a' ? test.total_requests_a : test.total_requests_b) + 1;
    const successCount =
      (group === 'a' ? test.success_count_a : test.success_count_b) + (data.success ? 1 : 0);

    // Скользящее среднее для времени ответа
    const oldAvgTime = group === 'a' ? test.avg_response_time_a : test.avg_response_time_b;
    const newAvgTime = data.responseTime
      ? Math.round((oldAvgTime * (totalRequests - 1) + data.responseTime) / totalRequests)
      : oldAvgTime;

    // Скользящее среднее для цены
    const oldAvgPrice = parseFloat(
      group === 'a' ? test.avg_price_a || '0' : test.avg_price_b || '0',
    );
    const newAvgPrice = data.price
      ? (oldAvgPrice * (totalRequests - 1) + data.price) / totalRequests
      : oldAvgPrice;

    await execute(
      `UPDATE ab_tests SET
        total_requests_${fieldPrefix} = ?,
        success_count_${fieldPrefix} = ?,
        avg_response_time_${fieldPrefix} = ?,
        avg_price_${fieldPrefix} = ?,
        updated_at = ?
       WHERE id = ?`,
      [totalRequests, successCount, newAvgTime, newAvgPrice || null, new Date(), testId],
    );
  },

  async updateDailyStats(
    this: ABTestRepoThis,
    testId: string,
    group: ParserGroup,
    data: { success: boolean; responseTime?: number; price?: number },
  ): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    const id = `${testId}-${today}`;
    const fieldPrefix = group === 'a' ? 'a' : 'b';

    // Проверяем, есть ли запись за сегодня
    const existing = await query<RowDataPacket[]>(
      'SELECT id FROM ab_test_daily_stats WHERE test_id = ? AND date = ?',
      [testId, today],
    );

    if (existing.length === 0) {
      // Создаём новую запись
      await execute(
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
        ],
      );
    } else {
      // Обновляем существующую
      await execute(
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
        ],
      );
    }
  },
};
