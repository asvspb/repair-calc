import { execute, query } from '../pool.js';
import type { RowDataPacket } from '../pool.js';
import { v4 as uuidv4 } from 'uuid';
import type {
  CreateJobItemInput,
  ItemStatus,
  SourceType,
  UpdateJobItem,
} from './updateJob.types.js';

// ═══════════════════════════════════════════════════════
// ЭЛЕМЕНТЫ И ПАРАМЕТРЫ ЗАДАЧ (вынесено из updateJob.repo.ts)
// ═══════════════════════════════════════════════════════

type ExecValues = Parameters<typeof execute>[1];

export class UpdateJobItemRepository {
  // ─── CREATE ────────────────────────────────────────────────

  static async create(input: CreateJobItemInput): Promise<UpdateJobItem> {
    const id = uuidv4();

    await execute(
      `INSERT INTO update_job_items (id, job_id, item_name, item_category, city)
       VALUES (?, ?, ?, ?, ?)`,
      [id, input.job_id, input.item_name, input.item_category, input.city],
    );

    const rows = await query<(UpdateJobItem & RowDataPacket)[]>(
      'SELECT * FROM update_job_items WHERE id = ?',
      [id],
    );

    return rows[0]!;
  }

  static async createMany(items: CreateJobItemInput[]): Promise<void> {
    if (items.length === 0) return;

    const values = items.map(item => [
      uuidv4(),
      item.job_id,
      item.item_name,
      item.item_category,
      item.city,
    ]);

    await execute(
      `INSERT INTO update_job_items (id, job_id, item_name, item_category, city) VALUES ?`,
      values as unknown as ExecValues,
    );
  }

  // ─── READ ────────────────────────────────────────────────

  static async findByJobId(jobId: string): Promise<UpdateJobItem[]> {
    const rows = await query<(UpdateJobItem & RowDataPacket)[]>(
      'SELECT * FROM update_job_items WHERE job_id = ? ORDER BY created_at ASC',
      [jobId],
    );

    return rows;
  }

  static async findPending(jobId: string): Promise<UpdateJobItem[]> {
    const rows = await query<(UpdateJobItem & RowDataPacket)[]>(
      "SELECT * FROM update_job_items WHERE job_id = ? AND status = 'pending' ORDER BY created_at ASC",
      [jobId],
    );

    return rows;
  }

  static async findFailed(jobId: string): Promise<UpdateJobItem[]> {
    const rows = await query<(UpdateJobItem & RowDataPacket)[]>(
      "SELECT * FROM update_job_items WHERE job_id = ? AND status = 'failed' ORDER BY created_at ASC",
      [jobId],
    );

    return rows;
  }

  // ─── UPDATE ────────────────────────────────────────────────

  static async startItem(id: string): Promise<void> {
    await execute(
      `UPDATE update_job_items
       SET status = 'pending', started_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id],
    );
  }

  static async completeItem(
    id: string,
    data: {
      source: SourceType;
      price_catalog_id: string;
      price_change?: number;
    },
  ): Promise<void> {
    await execute(
      `UPDATE update_job_items
       SET status = 'success',
           source = ?,
           price_catalog_id = ?,
           price_change = ?,
           completed_at = CURRENT_TIMESTAMP,
           duration_ms = TIMESTAMPDIFF(MICROSECOND, started_at, CURRENT_TIMESTAMP) DIV 1000
       WHERE id = ?`,
      [data.source, data.price_catalog_id, data.price_change || null, id],
    );
  }

  static async failItem(id: string, errorMessage: string): Promise<void> {
    await execute(
      `UPDATE update_job_items
       SET status = 'failed',
           error_message = ?,
           completed_at = CURRENT_TIMESTAMP,
           duration_ms = TIMESTAMPDIFF(MICROSECOND, started_at, CURRENT_TIMESTAMP) DIV 1000
       WHERE id = ?`,
      [errorMessage, id],
    );
  }

  static async skipItem(id: string, reason: string): Promise<void> {
    await execute(
      `UPDATE update_job_items
       SET status = 'skipped',
           error_message = ?,
           completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reason, id],
    );
  }

  // ─── СТАТИСТИКА ───────────────────────────────────────────

  static async getStats(jobId: string): Promise<{
    total: number;
    byStatus: Record<ItemStatus, number>;
  }> {
    const [totalRow] = await query<(RowDataPacket & { total: number })[]>(
      'SELECT COUNT(*) as total FROM update_job_items WHERE job_id = ?',
      [jobId],
    );

    const statusRows = await query<(RowDataPacket & { status: ItemStatus; count: number })[]>(
      'SELECT status, COUNT(*) as count FROM update_job_items WHERE job_id = ? GROUP BY status',
      [jobId],
    );

    const byStatus: Record<ItemStatus, number> = {
      pending: 0,
      success: 0,
      failed: 0,
      skipped: 0,
    };

    for (const row of statusRows) {
      byStatus[row.status] = row.count;
    }

    return {
      total: totalRow?.total || 0,
      byStatus,
    };
  }
}

export class UpdateJobParamRepository {
  static async set(jobId: string, name: string, value: unknown): Promise<void> {
    const id = uuidv4();

    await execute(
      `INSERT INTO update_job_params (id, job_id, param_name, param_value)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE param_value = VALUES(param_value)`,
      [id, jobId, name, JSON.stringify(value)],
    );
  }

  static async get(jobId: string, name: string): Promise<unknown | null> {
    const rows = await query<(RowDataPacket & { param_value: string })[]>(
      'SELECT param_value FROM update_job_params WHERE job_id = ? AND param_name = ?',
      [jobId, name],
    );

    if (!rows[0]) return null;

    try {
      return JSON.parse(rows[0].param_value);
    } catch {
      return rows[0].param_value;
    }
  }

  static async getAll(jobId: string): Promise<Record<string, unknown>> {
    const rows = await query<(RowDataPacket & { param_name: string; param_value: string })[]>(
      'SELECT param_name, param_value FROM update_job_params WHERE job_id = ?',
      [jobId],
    );

    const result: Record<string, unknown> = {};

    for (const row of rows) {
      try {
        result[row.param_name] = JSON.parse(row.param_value);
      } catch {
        result[row.param_name] = row.param_value;
      }
    }

    return result;
  }
}
