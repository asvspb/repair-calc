/**
 * Тесты клиентских api-функций архива (T3, TASK-BATCH-001):
 * getArchivedProjects / restoreProject / permanentDeleteProject (src/api/projects.ts).
 * httpClient замокан — проверяем endpoint, метод и конвертацию ApiError → ProjectsApiError.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { requestMock } = vi.hoisted(() => ({ requestMock: vi.fn() }));

vi.mock('../../src/utils/logger', () => ({
  logApiRequest: vi.fn(),
  logApiSuccess: vi.fn(),
  logApiError: vi.fn(),
  logDebug: vi.fn(),
  logError: vi.fn(),
  logWarning: vi.fn(),
  logSuccess: vi.fn(),
}));

vi.mock('../../src/api/httpClient', () => {
  class ApiError extends Error {
    constructor(
      public message: string,
      public statusCode: number,
      public data?: unknown,
    ) {
      super(message);
      this.name = 'ApiError';
    }
  }
  return {
    ApiError,
    httpClient: { request: (...args: unknown[]) => requestMock(...args) },
    default: { request: (...args: unknown[]) => requestMock(...args) },
  };
});

import {
  getArchivedProjects,
  restoreProject,
  permanentDeleteProject,
  ProjectsApiError,
} from '../../src/features/projects/api/projects';
import { ApiError } from '../../src/api/httpClient';

describe('projects api: archive endpoints (T3)', () => {
  beforeEach(() => {
    requestMock.mockReset();
  });

  describe('getArchivedProjects', () => {
    it('запрашивает GET /api/projects/archived и возвращает payload', async () => {
      const payload = {
        status: 'success',
        data: [
          {
            id: 'srv-1',
            user_id: 'u1',
            name: 'Архивный проект',
            city: null,
            use_ai_pricing: false,
            last_ai_price_update: null,
            version: 1,
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
            objectsCount: 2,
            roomsCount: 5,
          },
        ],
      };
      requestMock.mockResolvedValueOnce(payload);

      const result = await getArchivedProjects();

      expect(requestMock).toHaveBeenCalledTimes(1);
      expect(requestMock).toHaveBeenCalledWith('/api/projects/archived', {});
      expect(result).toEqual(payload);
      expect(result.data[0].objectsCount).toBe(2);
      expect(result.data[0].roomsCount).toBe(5);
    });
  });

  describe('restoreProject', () => {
    it('отправляет PATCH /api/projects/:id/restore', async () => {
      const payload = { status: 'success', data: { id: 'srv-1', name: 'Восстановлен' } };
      requestMock.mockResolvedValueOnce(payload);

      const result = await restoreProject('srv-1');

      expect(requestMock).toHaveBeenCalledWith('/api/projects/srv-1/restore', { method: 'PATCH' });
      expect(result).toEqual(payload);
    });

    it('конвертирует ApiError 404 в ProjectsApiError', async () => {
      requestMock.mockRejectedValue(new ApiError('Project not found', 404));

      await expect(restoreProject('nope')).rejects.toBeInstanceOf(ProjectsApiError);
      await expect(restoreProject('nope')).rejects.toMatchObject({
        name: 'ProjectsApiError',
        statusCode: 404,
      });
    });
  });

  describe('permanentDeleteProject', () => {
    it('отправляет DELETE /api/projects/:id/permanent и возвращает счётчики', async () => {
      const payload = {
        status: 'success',
        data: { deleted: { objects: 3, rooms: 7 } },
      };
      requestMock.mockResolvedValueOnce(payload);

      const result = await permanentDeleteProject('srv-1');

      expect(requestMock).toHaveBeenCalledWith('/api/projects/srv-1/permanent', {
        method: 'DELETE',
      });
      expect(result.data.deleted).toEqual({ objects: 3, rooms: 7 });
    });

    it('пробрасывает ApiError 409 как ProjectsApiError', async () => {
      requestMock.mockRejectedValueOnce(new ApiError('Archive the project first', 409));

      await expect(permanentDeleteProject('active-1')).rejects.toMatchObject({
        name: 'ProjectsApiError',
        statusCode: 409,
      });
    });

    it('не конвертирует не-ApiError ошибки', async () => {
      const networkError = new Error('network down');
      requestMock.mockRejectedValueOnce(networkError);

      await expect(permanentDeleteProject('srv-1')).rejects.toBe(networkError);
    });
  });
});
