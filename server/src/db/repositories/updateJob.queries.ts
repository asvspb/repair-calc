import { execute, query } from '../pool.js';
import type { RowDataPacket } from '../pool.js';
import { v4 as uuidv4 } from 'uuid';
import type {
  CreateJobInput,
  JobFilter,
  JobProgress,
  JobStatus,
  JobType,
  UpdateJob,
} from './updateJob.types.js';

// ═══════════════════════════════════════════════════════
// ЧТЕНИЕ ЗАДАЧ ОБНОВЛЕНИЯ (вынесено из updateJob.repo.ts)
// ═══════════════════════════════════════════════════════

/** Разбор строки таблицы update_jobs (JSON-поля). */
export function parseUpdateJobRow(row: UpdateJob): UpdateJob {
  return {
    ...row,
    categories: row.categories
      ? typeof row.categories === 'string'
        ? JSON.parse(row.categories)
        : row.categories
      : null,
    sources: row.sources
      ? typeof row.sources === 'string'
        ? JSON.parse(row.sources)
        : row.sources
      : null,
    error_details: row.error_details
      ? typeof row.error_details === 'string'
        ? JSON.parse(row.error_details)
        : row.error_details
      : null,
  };
}

export async function createJob(input: CreateJobInput): Promise<UpdateJob> {
  const id = uuidv4();

  await executeInsert(input, id);

  const rows = await query<(UpdateJob & RowDataPacket)[]>(
    'SELECT * FROM update_jobs WHERE id = ?',
    [id],
  );

  return parseUpdateJobRow(rows[0]!);
}

async function executeInsert(input: CreateJobInput, id: string): Promise<void> {
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
    ],
  );
}

export async function findJobById(id: string): Promise<UpdateJob | null> {
  const rows = await query<(UpdateJob & RowDataPacket)[]>(
    'SELECT * FROM update_jobs WHERE id = ?',
    [id],
  );

  return rows[0] ? parseUpdateJobRow(rows[0]) : null;
}

export async function findJobs(
  filter: JobFilter = {},
): Promise<{ items: UpdateJob[]; total: number }> {
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
    params,
  );
  const total = countRows[0]?.total || 0;

  // Get items
  const limit = filter.limit || 20;
  const offset = filter.offset || 0;

  const rows = await query<(UpdateJob & RowDataPacket)[]>(
    `SELECT * FROM update_jobs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return {
    items: rows.map(row => parseUpdateJobRow(row)),
    total,
  };
}

export async function findRunningJobs(): Promise<UpdateJob[]> {
  const rows = await query<(UpdateJob & RowDataPacket)[]>(
    "SELECT * FROM update_jobs WHERE status = 'running' ORDER BY created_at DESC",
  );

  return rows.map(row => parseUpdateJobRow(row));
}

export async function findRecentJobs(limit: number = 10): Promise<UpdateJob[]> {
  const rows = await query<(UpdateJob & RowDataPacket)[]>(
    'SELECT * FROM update_jobs ORDER BY created_at DESC LIMIT ?',
    [limit],
  );

  return rows.map(row => parseUpdateJobRow(row));
}

export async function getJobProgress(id: string): Promise<JobProgress | null> {
  const rows = await query<
    (RowDataPacket & { total: number; processed: number; failed: number })[]
  >(
    'SELECT total_items as total, processed_items as processed, failed_items as failed FROM update_jobs WHERE id = ?',
    [id],
  );

  if (!rows[0]) return null;

  const { total, processed, failed } = rows[0];
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

  return { total, processed, failed, percent };
}

export async function getJobStats(): Promise<{
  total: number;
  byStatus: Record<JobStatus, number>;
  byType: Record<JobType, number>;
  avgDurationMs: number | null;
  lastRunAt: Date | null;
}> {
  const [totalRow] = await query<(RowDataPacket & { total: number })[]>(
    'SELECT COUNT(*) as total FROM update_jobs',
  );

  const statusRows = await query<(RowDataPacket & { status: JobStatus; count: number })[]>(
    'SELECT status, COUNT(*) as count FROM update_jobs GROUP BY status',
  );

  const typeRows = await query<(RowDataPacket & { type: JobType; count: number })[]>(
    'SELECT type, COUNT(*) as count FROM update_jobs GROUP BY type',
  );

  const [avgRow] = await query<(RowDataPacket & { avg: number | null })[]>(
    'SELECT AVG(duration_ms) as avg FROM update_jobs WHERE duration_ms IS NOT NULL',
  );

  const [lastRow] = await query<(RowDataPacket & { created_at: Date | null })[]>(
    "SELECT created_at FROM update_jobs WHERE status = 'completed' ORDER BY completed_at DESC LIMIT 1",
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
