/**
 * Smoke-тесты фасада updateJob.repo до распила (TASK-BATCH-022-r3).
 * Гарантируют: публичный контракт (классы/типы) не меняется при разбиении файла.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockExecute, mockQuery } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockQuery: vi.fn(),
}));

vi.mock('../../src/db/pool.js', () => ({
  execute: mockExecute,
  query: mockQuery,
}));

import {
  UpdateJobRepository,
  UpdateJobItemRepository,
  UpdateJobParamRepository,
  UpdateJobLockRepository,
  UpdateLogRepository,
} from '../../src/db/repositories/updateJob.repo.js';

const jobRow = {
  id: 'job-1',
  type: 'manual',
  status: 'pending',
  city: null,
  categories: null,
  sources: null,
  triggered_by: null,
  total_items: 0,
  processed_items: 0,
  failed_items: 0,
  items_created: 0,
  items_updated: 0,
  items_skipped: 0,
  started_at: null,
  completed_at: null,
  duration_ms: null,
  error_message: null,
  error_details: null,
  created_at: new Date('2026-01-01'),
};

describe('updateJob.repo facade (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UpdateJobRepository.create вставляет и парсит строку', async () => {
    mockExecute.mockResolvedValueOnce({ affectedRows: 1 });
    mockQuery.mockResolvedValueOnce([{ ...jobRow, categories: '["walls"]' }]);

    const job = await UpdateJobRepository.create({ type: 'manual', categories: ['walls'] });

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(job.categories).toEqual(['walls']);
  });

  it('UpdateJobRepository.getProgress считает процент', async () => {
    mockQuery.mockResolvedValueOnce([{ total: 4, processed: 2, failed: 1 }]);

    const progress = await UpdateJobRepository.getProgress('job-1');

    expect(progress).toEqual({ total: 4, processed: 2, failed: 1, percent: 50 });
  });

  it('UpdateJobItemRepository.getStats агрегирует статусы', async () => {
    mockQuery.mockResolvedValueOnce([{ total: 3 }]).mockResolvedValueOnce([
      { status: 'success', count: 2 },
      { status: 'failed', count: 1 },
    ]);

    const stats = await UpdateJobItemRepository.getStats('job-1');

    expect(stats.total).toBe(3);
    expect(stats.byStatus).toEqual({ pending: 0, success: 2, failed: 1, skipped: 0 });
  });

  it('UpdateJobParamRepository.get парсит JSON-значение', async () => {
    mockQuery.mockResolvedValueOnce([{ param_value: '{"a":1}' }]);

    await expect(UpdateJobParamRepository.get('job-1', 'x')).resolves.toEqual({ a: 1 });
  });

  it('UpdateJobLockRepository.isLocked — есть активная блокировка', async () => {
    mockQuery.mockResolvedValueOnce([{ total: 1 }]);

    await expect(UpdateJobLockRepository.isLocked('walls:moscow')).resolves.toBe(true);
  });

  it('UpdateLogRepository.findByJobId распарсивает context', async () => {
    mockQuery.mockResolvedValueOnce([
      { id: 'log-1', job_id: 'job-1', level: 'info', message: 'ok', context: '{"k":1}' },
    ]);

    const logs = await UpdateLogRepository.findByJobId('job-1');

    expect(logs[0]?.context).toEqual({ k: 1 });
  });
});
