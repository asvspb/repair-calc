/**
 * Тесты для Totals API
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveTotals,
  getTotals,
  TotalsApiError,
  type TotalsData,
  type TotalsResponse,
} from '../../src/api/totals';
import { httpClient, ApiError } from '../../src/api/httpClient';

// Мокаем httpClient.request
const mockRequest = vi.spyOn(httpClient, 'request').mockImplementation(() => Promise.resolve({}));

// Мокаем localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('Totals API', () => {
  const mockTotalsData: TotalsData = {
    total_area: 150.5,
    total_works: 50000,
    total_materials: 75000,
    total_tools: 5000,
    grand_total: 130000,
  };

  const mockTotalsResponse: TotalsResponse = {
    project_id: 'project-123',
    total_area: 150.5,
    total_works: 50000,
    total_materials: 75000,
    total_tools: 5000,
    grand_total: 130000,
    calculated_at: '2026-03-15T10:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    localStorage.removeItem('token');
  });

  describe('saveTotals', () => {
    it('should save totals successfully', async () => {
      mockRequest.mockResolvedValueOnce({
        status: 'success',
        data: mockTotalsResponse,
      });

      const result = await saveTotals('project-123', mockTotalsData);

      expect(mockRequest).toHaveBeenCalledWith(
        '/api/totals/project-123',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(mockTotalsData),
        })
      );

      expect(result).toEqual(mockTotalsResponse);
      expect(result.project_id).toBe('project-123');
      expect(result.grand_total).toBe(130000);
    });

    it('should throw TotalsApiError on error response', async () => {
      mockRequest.mockRejectedValueOnce(new ApiError('Project not found', 404));

      await expect(saveTotals('project-123', mockTotalsData)).rejects.toThrow(TotalsApiError);

      let caughtError: Error | null = null;
      try {
        await saveTotals('project-123', mockTotalsData);
      } catch (error) {
        caughtError = error as Error;
        expect(caughtError.name).toBe('TotalsApiError');
        expect((caughtError as TotalsApiError).message).toBe('Project not found');
        expect((caughtError as TotalsApiError).statusCode).toBe(404);
      }
    });
  });

  describe('getTotals', () => {
    it('should get totals successfully', async () => {
      mockRequest.mockResolvedValueOnce({
        status: 'success',
        data: mockTotalsResponse,
      });

      const result = await getTotals('project-123');

      expect(mockRequest).toHaveBeenCalledWith(
        '/api/totals/project-123',
        expect.any(Object)
      );

      expect(result).toEqual(mockTotalsResponse);
    });

    it('should return null if totals not found', async () => {
      mockRequest.mockResolvedValueOnce({
        status: 'success',
        data: null,
      });

      const result = await getTotals('project-123');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      mockRequest.mockRejectedValueOnce(new ApiError('Project not found', 404));

      const result = await getTotals('project-123');

      expect(result).toBeNull();
    });
  });

  describe('TotalsApiError', () => {
    it('should create error with message and status code', () => {
      const error = new TotalsApiError('Test error', 500);

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.name).toBe('TotalsApiError');
    });
  });
});