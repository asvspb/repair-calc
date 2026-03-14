import { query, execute } from '../pool.js';
import { v4 as uuidv4 } from 'uuid';
import type { RowDataPacket } from 'mysql2/promise';
import { PriceCategory, SourceType } from './priceCatalog.repo.js';

// ═══════════════════════════════════════════════════════
// ТИПЫ
// ═══════════════════════════════════════════════════════

export type JobType = 'scheduled' | 'manual' | 'incremental';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ItemStatus = 'pending' | 'success' | 'failed' | 'skipped';

export interface UpdateJob {
  id: string;
  type: JobType;
  status: JobStatus;
  city: string | null;
  categories: PriceCategory[] | null;
  sources: SourceType[] | null;
  triggered_by: string | null;
  total_items: number;
  processed_items: number;
  failed_items: number;
  items_created: number;
  items_updated: number;
  items_skipped: number;
  started_at: Date | null;
  completed_at: Date | null;
  duration_ms: number | null;
  error_message: string | null;
  error_details: Record<string, unknown> | null;
  created_at: Date;
}

export interface UpdateJobItem {
  id: string;
  job_id: string;
  item_name: string;
  item_category: PriceCategory;
  city: string;
  status: ItemStatus;
  source: SourceType | null;
  price_catalog_id: string | null;
  price_change: number | null;
  error_message: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  duration_ms: number | null;
  created_at: Date;
}

export interface UpdateJobParam {
  id: string;
  job_id: string;
  param_name: string;
  param_value: unknown;
  created_at: Date;
}

export interface UpdateJobLock {
  id: string;
  job_id: string;
  item_key: string;
  locked_at: Date;
  expires_at: Date | null;
}

export interface CreateJobInput {
  type: JobType;
  city?: string;
  categories?: PriceCategory[];
  sources?: SourceType[];
  triggered_by?: string;
}

export interface CreateJobItemInput {
  job_id: string;
  item_name: string;
  item_category: PriceCategory;
  city: string;
}

export interface JobFilter {
  status?: JobStatus;
  type?: JobType;
  limit?: number;
  offset?: number;
}

export interface JobProgress {
  total: number;
  processed: number;
  failed: number;
  percent: number;
}

// ═══════════════════════════════════════════════════════
// РЕПОЗИТОРИЙ ЗАДАЧ ОБНОВЛЕНИЯ
// ═══════════════════════════════════════════════════════

export class UpdateJobRepository {
  // ─── CREATE ────────────────────────────────────────────────

  static async create(input: CreateJobInput): Promise<UpdateJob> {
    const id = uuidv4();
    
    await execute(
      `INSERT INTO update_jobs (
        id, type, city, categories, sources, triggered_by
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.type,
        input.city || null,
        input.categories ? JSON.stringify(input.categories) : null,
        input.sources ? JSON.stringify(input.sources) : null,
        input.triggered_by || null,
      ]
    );
    
    const rows = await query<(UpdateJob & RowDataPacket)[]>(
      'SELECT * FROM update_jobs WHERE id = ?',
      [id]
    );
    
    return this.parseRow(rows[0]!);
  }

  // ─── READ ────────────────────────────────────────────────

  static async findById(id: string): Promise<UpdateJob | null> {
    const rows = await query<(UpdateJob & RowDataPacket)[]>(
      'SELECT * FROM update_jobs WHERE id = ?',
      [id]
    );
    
    return rows[0] ? this.parseRow(rows[0]) : null;
  }

  static async findMany(filter: JobFilter = {}): Promise<{ items: UpdateJob[]; total: number }> {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (filter.status) {
      conditions.push('status = ?');
      params.push(filter.status);
    }
    if (filter.type) {
      conditions.push('type = ?');
      params.push(filter.type);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const countRows = await query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) as total FROM update_jobs ${whereClause}`,
      params
    );
    const total = countRows[0]?.total || 0;

    // Get items
    const limit = filter.limit || 20;
    const offset = filter.offset || 0;

    const rows = await query<(UpdateJob & RowDataPacket)[]>(
      `SELECT * FROM update_jobs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return {
      items: rows.map(row => this.parseRow(row)),
      total,
    };
  }

  static async findRunning(): Promise<UpdateJob[]> {
    const rows = await query<(UpdateJob & RowDataPacket)[]>(
      "SELECT * FROM update_jobs WHERE status = 'running' ORDER BY created_at DESC"
    );
    
    return rows.map(row => this.parseRow(row));
  }

  static async findRecent(limit: number = 10): Promise<UpdateJob[]> {
    const rows = await query<(UpdateJob & RowDataPacket)[]>(
      'SELECT * FROM update_jobs ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    
    return rows.map(row => this.parseRow(row));
  }

  // ─── UPDATE ────────────────────────────────────────────────

  static async start(id: string): Promise<void> {
    await execute(
      `UPDATE update_jobs 
       SET status = 'running', 
           started_at = CURRENT_TIMESTAMP 
       WHERE id = ? AND status = 'pending'`,
      [id]
    );
  }

  static async complete(id: string): Promise<void> {
    await execute(
      `UPDATE update_jobs 
       SET status = 'completed', 
           completed_at = CURRENT_TIMESTAMP,
           duration_ms = TIMESTAMPDIFF(MICROSECOND, started_at, CURRENT_TIMESTAMP) DIV 1000
       WHERE id = ? AND status = 'running'`,
      [id]
    );
  }

  static async fail(id: string, error: string, details?: Record<string, unknown>): Promise<void> {
    await execute(
      `UPDATE update_jobs 
       SET status = 'failed', 
           completed_at = CURRENT_TIMESTAMP,
           error_message = ?,
           error_details = ?,
           duration_ms = TIMESTAMPDIFF(MICROSECOND, started_at, CURRENT_TIMESTAMP) DIV 1000
       WHERE id = ?`,
      [error, details ? JSON.stringify(details) : null, id]
    );
  }

  static async cancel(id: string): Promise<boolean> {
    const result = await execute(
      `UPDATE update_jobs 
       SET status = 'cancelled', 
           completed_at = CURRENT_TIMESTAMP 
       WHERE id = ? AND status IN ('pending', 'running')`,
      [id]
    );
    
    return result.affectedRows > 0;
  }

  static async updateProgress(
    id: string,
    data: {
      total_items?: number;
      processed_items?: number;
      failed_items?: number;
      items_created?: number;
      items_updated?: number;
      items_skipped?: number;
    }
  ): Promise<void> {
    const fields: string[] = [];
    const values: (string | number)[] = [];

    if (data.total_items !== undefined) {
      fields.push('total_items = ?');
      values.push(data.total_items);
    }
    if (data.processed_items !== undefined) {
      fields.push('processed_items = ?');
      values.push(data.processed_items);
    }
    if (data.failed_items !== undefined) {
      fields.push('failed_items = ?');
      values.push(data.failed_items);
    }
    if (data.items_created !== undefined) {
      fields.push('items_created = ?');
      values.push(data.items_created);
    }
    if (data.items_updated !== undefined) {
      fields.push('items_updated = ?');
      values.push(data.items_updated);
    }
    if (data.items_skipped !== undefined) {
      fields.push('items_skipped = ?');
      values.push(data.items_skipped);
    }

    if (fields.length === 0) return;

    values.push(id);
    
    await execute(
      `UPDATE update_jobs SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  // ─── PROGRESS ──────────────────────────────────────────────

  static async getProgress(id: string): Promise<JobProgress | null> {
    const rows = await query<(RowDataPacket & { total: number; processed: number; failed: number })[]>(
      'SELECT total_items as total, processed_items as processed, failed_items as failed FROM update_jobs WHERE id = ?',
      [id]
    );
    
    if (!rows[0]) return null;
    
    const { total, processed, failed } = rows[0];
    const percent = total > 0 ? Math.round((processed / total) * 100) : 0;
    
    return { total, processed, failed, percent };
  }

  // ─── СТАТИСТИКА ───────────────────────────────────────────

  static async getStats(): Promise<{
    total: number;
    byStatus: Record<JobStatus, number>;
    byType: Record<JobType, number>;
    avgDurationMs: number | null;
    lastRunAt: Date | null;
  }> {
    const [totalRow] = await query<(RowDataPacket & { total: number })[]>(
      'SELECT COUNT(*) as total FROM update_jobs'
    );

    const statusRows = await query<(RowDataPacket & { status: JobStatus; count: number })[]>(
      'SELECT status, COUNT(*) as count FROM update_jobs GROUP BY status'
    );

    const typeRows = await query<(RowDataPacket & { type: JobType; count: number })[]>(
      'SELECT type, COUNT(*) as count FROM update_jobs GROUP BY type'
    );

    const [avgRow] = await query<(RowDataPacket & { avg: number | null })[]>(
      'SELECT AVG(duration_ms) as avg FROM update_jobs WHERE duration_ms IS NOT NULL'
    );

    const [lastRow] = await query<(RowDataPacket & { created_at: Date | null })[]>(
      "SELECT created_at FROM update_jobs WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 1"
    );

    const byStatus: Record<JobStatus, number> = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    
    for (const row of statusRows) {
      byStatus[row.status] = row.count;
    }

    const byType: Record<JobType, number> = {
      scheduled: 0,
      manual: 0,
      incremental: 0,
    };
    
    for (const row of typeRows) {
      byType[row.type] = row.count;
    }

    return {
      total: totalRow?.total || 0,
      byStatus,
      byType,
      avgDurationMs: avgRow?.avg || null,
      lastRunAt: lastRow?.created_at || null,
    };
  }

  // ─── HELPERS ──────────────────────────────────────────────

  private static parseRow(row: UpdateJob): UpdateJob {
    return {
      ...row,
      categories: row.categories ? (typeof row.categories === 'string' ? JSON.parse(row.categories) : row.categories) : null,
      sources: row.sources ? (typeof row.sources === 'string' ? JSON.parse(row.sources) : row.sources) : null,
      error_details: row.error_details ? (typeof row.error_details === 'string' ? JSON.parse(row.error_details) : row.error_details) : null,
    };
  }
}

// ═══════════════════════════════════════════════════════
// РЕПОЗИТОРИЙ ЭЛЕМЕНТОВ ЗАДАЧ
// ═══════════════════════════════════════════════════════

export class UpdateJobItemRepository {
  // ─── CREATE ────────────────────────────────────────────────

  static async create(input: CreateJobItemInput): Promise<UpdateJobItem> {
    const id = uuidv4();
    
    await execute(
      `INSERT INTO update_job_items (id, job_id, item_name, item_category, city)
       VALUES (?, ?, ?, ?, ?)`,
      [id, input.job_id, input.item_name, input.item_category, input.city]
    );
    
    const rows = await query<(UpdateJobItem & RowDataPacket)[]>(
      'SELECT * FROM update_job_items WHERE id = ?',
      [id]
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
      [values]
    );
  }

  // ─── READ ────────────────────────────────────────────────

  static async findByJobId(jobId: string): Promise<UpdateJobItem[]> {
    const rows = await query<(UpdateJobItem & RowDataPacket)[]>(
      'SELECT * FROM update_job_items WHERE job_id = ? ORDER BY created_at ASC',
      [jobId]
    );
    
    return rows;
  }

  static async findPending(jobId: string): Promise<UpdateJobItem[]> {
    const rows = await query<(UpdateJobItem & RowDataPacket)[]>(
      "SELECT * FROM update_job_items WHERE job_id = ? AND status = 'pending' ORDER BY created_at ASC",
      [jobId]
    );
    
    return rows;
  }

  static async findFailed(jobId: string): Promise<UpdateJobItem[]> {
    const rows = await query<(UpdateJobItem & RowDataPacket)[]>(
      "SELECT * FROM update_job_items WHERE job_id = ? AND status = 'failed' ORDER BY created_at ASC",
      [jobId]
    );
    
    return rows;
  }

  // ─── UPDATE ────────────────────────────────────────────────

  static async startItem(id: string): Promise<void> {
    await execute(
      `UPDATE update_job_items 
       SET status = 'pending', started_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [id]
    );
  }

  static async completeItem(
    id: string,
    data: {
      source: SourceType;
      price_catalog_id: string;
      price_change?: number;
    }
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
      [data.source, data.price_catalog_id, data.price_change || null, id]
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
      [errorMessage, id]
    );
  }

  static async skipItem(id: string, reason: string): Promise<void> {
    await execute(
      `UPDATE update_job_items 
       SET status = 'skipped', 
           error_message = ?,
           completed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reason, id]
    );
  }

  // ─── СТАТИСТИКА ───────────────────────────────────────────

  static async getStats(jobId: string): Promise<{
    total: number;
    byStatus: Record<ItemStatus, number>;
  }> {
    const [totalRow] = await query<(RowDataPacket & { total: number })[]>(
      'SELECT COUNT(*) as total FROM update_job_items WHERE job_id = ?',
      [jobId]
    );

    const statusRows = await query<(RowDataPacket & { status: ItemStatus; count: number })[]>(
      'SELECT status, COUNT(*) as count FROM update_job_items WHERE job_id = ? GROUP BY status',
      [jobId]
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

// ═══════════════════════════════════════════════════════
// РЕПОЗИТОРИЙ ПАРАМЕТРОВ ЗАДАЧ
// ═══════════════════════════════════════════════════════

export class UpdateJobParamRepository {
  static async set(jobId: string, name: string, value: unknown): Promise<void> {
    const id = uuidv4();
    
    await execute(
      `INSERT INTO update_job_params (id, job_id, param_name, param_value)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE param_value = VALUES(param_value)`,
      [id, jobId, name, JSON.stringify(value)]
    );
  }

  static async get(jobId: string, name: string): Promise<unknown | null> {
    const rows = await query<(RowDataPacket & { param_value: string })[]>(
      'SELECT param_value FROM update_job_params WHERE job_id = ? AND param_name = ?',
      [jobId, name]
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
      [jobId]
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

// ═══════════════════════════════════════════════════════
// РЕПОЗИТОРИЙ БЛОКИРОВОК
// ═══════════════════════════════════════════════════════

export class UpdateJobLockRepository {
  // ─── CREATE ────────────────────────────────────────────────

  static async acquire(
    jobId: string,
    itemKey: string,
    ttlMs: number = 300000 // 5 минут по умолчанию
  ): Promise<boolean> {
    try {
      const id = uuidv4();
      const expiresAt = new Date(Date.now() + ttlMs);
      
      await execute(
        `INSERT INTO update_job_locks (id, job_id, item_key, expires_at)
         VALUES (?, ?, ?, ?)`,
        [id, jobId, itemKey, expiresAt]
      );
      
      return true;
    } catch (error: unknown) {
      // Duplicate entry - already locked
      const mysqlError = error as { code?: string };
      if (mysqlError.code === 'ER_DUP_ENTRY') {
        // Check if expired
        const cleared = await this.clearExpired(itemKey);
        if (cleared) {
          // Retry
          return this.acquire(jobId, itemKey, ttlMs);
        }
        return false;
      }
      throw error;
    }
  }

  // ─── READ ────────────────────────────────────────────────

  static async isLocked(itemKey: string): Promise<boolean> {
    const rows = await query<(RowDataPacket & { total: number })[]>(
      `SELECT COUNT(*) as total FROM update_job_locks 
       WHERE item_key = ? AND (expires_at IS NULL OR expires_at > NOW())`,
      [itemKey]
    );
    
    return (rows[0]?.total || 0) > 0;
  }

  static async getLock(itemKey: string): Promise<UpdateJobLock | null> {
    const rows = await query<(UpdateJobLock & RowDataPacket)[]>(
      `SELECT * FROM update_job_locks 
       WHERE item_key = ? AND (expires_at IS NULL OR expires_at > NOW())`,
      [itemKey]
    );
    
    return rows[0] || null;
  }

  // ─── DELETE ────────────────────────────────────────────────

  static async release(jobId: string, itemKey: string): Promise<boolean> {
    const result = await execute(
      'DELETE FROM update_job_locks WHERE job_id = ? AND item_key = ?',
      [jobId, itemKey]
    );
    
    return result.affectedRows > 0;
  }

  static async releaseAll(jobId: string): Promise<number> {
    const result = await execute(
      'DELETE FROM update_job_locks WHERE job_id = ?',
      [jobId]
    );
    
    return result.affectedRows;
  }

  static async clearExpired(itemKey: string): Promise<boolean> {
    const result = await execute(
      'DELETE FROM update_job_locks WHERE item_key = ? AND expires_at IS NOT NULL AND expires_at <= NOW()',
      [itemKey]
    );
    
    return result.affectedRows > 0;
  }

  static async clearAllExpired(): Promise<number> {
    const result = await execute(
      'DELETE FROM update_job_locks WHERE expires_at IS NOT NULL AND expires_at <= NOW()'
    );
    
    return result.affectedRows;
  }
}

// ═══════════════════════════════════════════════════════
// РЕПОЗИТОРИЙ ЛОГОВ
// ═══════════════════════════════════════════════════════

export interface UpdateLog {
  id: string;
  job_id: string | null;
  level: 'info' | 'debug' | 'warn' | 'error';
  message: string;
  context: Record<string, unknown> | null;
  created_at: Date;
}

export class UpdateLogRepository {
  static async log(
    level: 'info' | 'debug' | 'warn' | 'error',
    message: string,
    jobId?: string,
    context?: Record<string, unknown>
  ): Promise<void> {
    const id = uuidv4();
    
    await execute(
      `INSERT INTO update_logs (id, job_id, level, message, context)
       VALUES (?, ?, ?, ?, ?)`,
      [id, jobId || null, level, message, context ? JSON.stringify(context) : null]
    );
  }

  static async info(message: string, jobId?: string, context?: Record<string, unknown>): Promise<void> {
    return this.log('info', message, jobId, context);
  }

  static async debug(message: string, jobId?: string, context?: Record<string, unknown>): Promise<void> {
    return this.log('debug', message, jobId, context);
  }

  static async warn(message: string, jobId?: string, context?: Record<string, unknown>): Promise<void> {
    return this.log('warn', message, jobId, context);
  }

  static async error(message: string, jobId?: string, context?: Record<string, unknown>): Promise<void> {
    return this.log('error', message, jobId, context);
  }

  static async findByJobId(jobId: string, level?: 'info' | 'debug' | 'warn' | 'error'): Promise<UpdateLog[]> {
    let sql = 'SELECT * FROM update_logs WHERE job_id = ?';
    const params: string[] = [jobId];
    
    if (level) {
      sql += ' AND level = ?';
      params.push(level);
    }
    
    sql += ' ORDER BY created_at ASC';
    
    const rows = await query<(UpdateLog & RowDataPacket)[]>(sql, params);
    
    return rows.map(row => ({
      ...row,
      context: row.context ? (typeof row.context === 'string' ? JSON.parse(row.context) : row.context) : null,
    }));
  }

  static async getRecent(level?: 'info' | 'debug' | 'warn' | 'error', limit: number = 100): Promise<UpdateLog[]> {
    let sql = 'SELECT * FROM update_logs';
    const params: (string | number)[] = [];
    
    if (level) {
      sql += ' WHERE level = ?';
      params.push(level);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);
    
    const rows = await query<(UpdateLog & RowDataPacket)[]>(sql, params);
    
    return rows.map(row => ({
      ...row,
      context: row.context ? (typeof row.context === 'string' ? JSON.parse(row.context) : row.context) : null,
    }));
  }
}