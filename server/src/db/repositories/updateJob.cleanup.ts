import { execute, query } from '../pool.js';
import type { RowDataPacket } from '../pool.js';
import { v4 as uuidv4 } from 'uuid';
import type { LogLevel, UpdateJobLock, UpdateLog } from './updateJob.types.js';

// ═══════════════════════════════════════════════════════
// БЛОКИРОВКИ И ЛОГИ ЗАДАЧ (вынесено из updateJob.repo.ts)
// ═══════════════════════════════════════════════════════

export class UpdateJobLockRepository {
  // ─── CREATE ────────────────────────────────────────────────

  static async acquire(
    jobId: string,
    itemKey: string,
    ttlMs: number = 300000, // 5 минут по умолчанию
  ): Promise<boolean> {
    try {
      const id = uuidv4();
      const expiresAt = new Date(Date.now() + ttlMs);

      await execute(
        `INSERT INTO update_job_locks (id, job_id, item_key, expires_at)
         VALUES (?, ?, ?, ?)`,
        [id, jobId, itemKey, expiresAt],
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
      [itemKey],
    );

    return (rows[0]?.total || 0) > 0;
  }

  static async getLock(itemKey: string): Promise<UpdateJobLock | null> {
    const rows = await query<(UpdateJobLock & RowDataPacket)[]>(
      `SELECT * FROM update_job_locks
       WHERE item_key = ? AND (expires_at IS NULL OR expires_at > NOW())`,
      [itemKey],
    );

    return rows[0] || null;
  }

  // ─── DELETE ────────────────────────────────────────────────

  static async release(jobId: string, itemKey: string): Promise<boolean> {
    const result = await execute('DELETE FROM update_job_locks WHERE job_id = ? AND item_key = ?', [
      jobId,
      itemKey,
    ]);

    return result.affectedRows > 0;
  }

  static async releaseAll(jobId: string): Promise<number> {
    const result = await execute('DELETE FROM update_job_locks WHERE job_id = ?', [jobId]);

    return result.affectedRows;
  }

  static async clearExpired(itemKey: string): Promise<boolean> {
    const result = await execute(
      'DELETE FROM update_job_locks WHERE item_key = ? AND expires_at IS NOT NULL AND expires_at <= NOW()',
      [itemKey],
    );

    return result.affectedRows > 0;
  }

  static async clearAllExpired(): Promise<number> {
    const result = await execute(
      'DELETE FROM update_job_locks WHERE expires_at IS NOT NULL AND expires_at <= NOW()',
      [],
    );

    return result.affectedRows;
  }
}

function parseContext(row: UpdateLog): UpdateLog {
  return {
    ...row,
    context: row.context
      ? typeof row.context === 'string'
        ? JSON.parse(row.context)
        : row.context
      : null,
  };
}

export class UpdateLogRepository {
  static async log(
    level: LogLevel,
    message: string,
    jobId?: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const id = uuidv4();

    await execute(
      `INSERT INTO update_logs (id, job_id, level, message, context)
       VALUES (?, ?, ?, ?, ?)`,
      [id, jobId || null, level, message, context ? JSON.stringify(context) : null],
    );
  }

  static async info(
    message: string,
    jobId?: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    return this.log('info', message, jobId, context);
  }

  static async debug(
    message: string,
    jobId?: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    return this.log('debug', message, jobId, context);
  }

  static async warn(
    message: string,
    jobId?: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    return this.log('warn', message, jobId, context);
  }

  static async error(
    message: string,
    jobId?: string,
    context?: Record<string, unknown>,
  ): Promise<void> {
    return this.log('error', message, jobId, context);
  }

  static async findByJobId(jobId: string, level?: LogLevel): Promise<UpdateLog[]> {
    let sql = 'SELECT * FROM update_logs WHERE job_id = ?';
    const params: string[] = [jobId];

    if (level) {
      sql += ' AND level = ?';
      params.push(level);
    }

    sql += ' ORDER BY created_at ASC';

    const rows = await query<(UpdateLog & RowDataPacket)[]>(sql, params);

    return rows.map(row => parseContext(row));
  }

  static async getRecent(level?: LogLevel, limit: number = 100): Promise<UpdateLog[]> {
    let sql = 'SELECT * FROM update_logs';
    const params: (string | number)[] = [];

    if (level) {
      sql += ' WHERE level = ?';
      params.push(level);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = await query<(UpdateLog & RowDataPacket)[]>(sql, params);

    return rows.map(row => parseContext(row));
  }
}
