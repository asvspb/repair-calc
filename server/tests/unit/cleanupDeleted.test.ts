/**
 * Unit-тесты job очистки мягко-удалённых проектов (§15.2.0 ТЗ v1.1):
 * retention-фильтр, пустая выборка, недоступная БД, гонка с restore,
 * отказоустойчивость по-элементно.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindArchivedOlderThan, mockHardDelete, mockLogger } = vi.hoisted(() => ({
  mockFindArchivedOlderThan: vi.fn(),
  mockHardDelete: vi.fn(),
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../src/db/repositories/project.repo.js', () => ({
  ProjectRepository: {
    findArchivedOlderThan: mockFindArchivedOlderThan,
    hardDelete: mockHardDelete,
  },
}));

vi.mock('../../src/middleware/logger.js', () => ({
  winstonLogger: mockLogger,
}));

import {
  DAY_MS,
  getCutoffDate,
  resolveRetentionDays,
  runCleanupDeleted,
} from '../../src/jobs/cleanupDeleted.js';

const NOW = Date.UTC(2026, 9, 3, 12, 0, 0);

describe('resolveRetentionDays', () => {
  const env = (value?: string) =>
    ({ ARCHIVE_RETENTION_DAYS: value }) as unknown as NodeJS.ProcessEnv;

  it('дефолт 90, когда переменная не задана', () => {
    expect(resolveRetentionDays(env(undefined))).toBe(90);
    expect(resolveRetentionDays(env(''))).toBe(90);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  it('парсит положительное целое', () => {
    expect(resolveRetentionDays(env('30'))).toBe(30);
  });

  it('нечисловое/неположительное значение — warn и дефолт 90', () => {
    expect(resolveRetentionDays(env('abc'))).toBe(90);
    expect(resolveRetentionDays(env('0'))).toBe(90);
    expect(resolveRetentionDays(env('-5'))).toBe(90);
    expect(mockLogger.warn).toHaveBeenCalledTimes(3);
  });
});

describe('getCutoffDate', () => {
  it('now минус retention дней', () => {
    expect(getCutoffDate(90, NOW).getTime()).toBe(NOW - 90 * DAY_MS);
  });
});

describe('runCleanupDeleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ARCHIVE_RETENTION_DAYS;
  });

  afterEach(() => {
    delete process.env.ARCHIVE_RETENTION_DAYS;
  });

  it('retention-фильтр: cutoff = now - retention дней, передаётся в выборку кандидатов', async () => {
    process.env.ARCHIVE_RETENTION_DAYS = '30';
    mockFindArchivedOlderThan.mockResolvedValue([]);

    await runCleanupDeleted(NOW);

    expect(mockFindArchivedOlderThan).toHaveBeenCalledTimes(1);
    const cutoff = mockFindArchivedOlderThan.mock.calls[0][0] as Date;
    expect(cutoff).toBeInstanceOf(Date);
    expect(Math.abs(cutoff.getTime() - (NOW - 30 * DAY_MS))).toBeLessThan(1000);
    expect(mockHardDelete).not.toHaveBeenCalled();
  });

  it('retention по умолчанию 90 дней, когда env не задан', async () => {
    mockFindArchivedOlderThan.mockResolvedValue([]);

    await runCleanupDeleted(NOW);

    const cutoff = mockFindArchivedOlderThan.mock.calls[0][0] as Date;
    expect(Math.abs(cutoff.getTime() - (NOW - 90 * DAY_MS))).toBeLessThan(1000);
  });

  it('пустая выборка: cleaned 0, hardDelete не вызывается, лог с нулём', async () => {
    mockFindArchivedOlderThan.mockResolvedValue([]);

    const cleaned = await runCleanupDeleted(NOW);

    expect(cleaned).toBe(0);
    expect(mockHardDelete).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('[CLEANUP] cleaned 0 projects', {
      candidates: 0,
      retentionDays: 90,
    });
  });

  it('удаляет каждого кандидата через hardDelete(id, userId); cleaned считает только deleted', async () => {
    mockFindArchivedOlderThan.mockResolvedValue([
      { id: 'p1', userId: 'u1' },
      { id: 'p2', userId: 'u2' },
    ]);
    mockHardDelete.mockImplementation(async (id: string) =>
      id === 'p1'
        ? { status: 'deleted', deleted: { objects: 1, rooms: 1 } }
        : { status: 'not_archived' },
    );

    const cleaned = await runCleanupDeleted(NOW);

    expect(cleaned).toBe(1);
    expect(mockHardDelete).toHaveBeenCalledWith('p1', 'u1');
    expect(mockHardDelete).toHaveBeenCalledWith('p2', 'u2');
    expect(mockLogger.info).toHaveBeenCalledWith('[CLEANUP] cleaned 1 projects', {
      candidates: 2,
      retentionDays: 90,
    });
  });

  it('ошибка БД на выборке: лог error, cleaned 0, процесс не роняется', async () => {
    mockFindArchivedOlderThan.mockRejectedValue(new Error('db down'));

    const cleaned = await runCleanupDeleted(NOW);

    expect(cleaned).toBe(0);
    expect(mockHardDelete).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith('[CLEANUP] Failed to list cleanup candidates', {
      error: expect.any(Error),
    });
  });

  it('ошибка hardDelete по одному кандидату не отменяет остальные', async () => {
    mockFindArchivedOlderThan.mockResolvedValue([
      { id: 'p1', userId: 'u1' },
      { id: 'p2', userId: 'u2' },
    ]);
    mockHardDelete.mockImplementation(async (id: string) => {
      if (id === 'p1') throw new Error('deadlock');
      return { status: 'deleted', deleted: { objects: 0, rooms: 0 } };
    });

    const cleaned = await runCleanupDeleted(NOW);

    expect(cleaned).toBe(1);
    expect(mockHardDelete).toHaveBeenCalledTimes(2);
    expect(mockLogger.error).toHaveBeenCalledWith('[CLEANUP] Failed to hard-delete project', {
      projectId: 'p1',
      error: expect.any(Error),
    });
  });
});
