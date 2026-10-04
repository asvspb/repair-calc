import { execute } from '../pool.js';
import { createJob } from './updateJob.queries.js';

// ═══════════════════════════════════════════════════════
// ЗАПИСЬ ЗАДАЧ ОБНОВЛЕНИЯ (вынесено из updateJob.repo.ts)
// ═══════════════════════════════════════════════════════

export { createJob };

export async function startJob(id: string): Promise<void> {
  await execute(
    `UPDATE update_jobs
       SET status = 'running',
           started_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'pending'`,
    [id],
  );
}

export async function completeJob(id: string): Promise<void> {
  await execute(
    `UPDATE update_jobs
       SET status = 'completed',
           completed_at = CURRENT_TIMESTAMP,
           duration_ms = TIMESTAMPDIFF(MICROSECOND, started_at, CURRENT_TIMESTAMP) DIV 1000
       WHERE id = ? AND status = 'running'`,
    [id],
  );
}

export async function failJob(
  id: string,
  error: string,
  details?: Record<string, unknown>,
): Promise<void> {
  await execute(
    `UPDATE update_jobs
       SET status = 'failed',
           completed_at = CURRENT_TIMESTAMP,
           error_message = ?,
           error_details = ?,
           duration_ms = TIMESTAMPDIFF(MICROSECOND, started_at, CURRENT_TIMESTAMP) DIV 1000
       WHERE id = ?`,
    [error, details ? JSON.stringify(details) : null, id],
  );
}

export async function cancelJob(id: string): Promise<boolean> {
  const result = await execute(
    `UPDATE update_jobs
       SET status = 'cancelled',
           completed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status IN ('pending', 'running')`,
    [id],
  );

  return result.affectedRows > 0;
}

export async function updateJobProgress(
  id: string,
  data: {
    total_items?: number;
    processed_items?: number;
    failed_items?: number;
    items_created?: number;
    items_updated?: number;
    items_skipped?: number;
  },
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

  await execute(`UPDATE update_jobs SET ${fields.join(', ')} WHERE id = ?`, values);
}
