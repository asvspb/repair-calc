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

// Мокаем fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

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
    // Clear any token from previous tests
    localStorage.removeItem('token');
  });

  describe('saveTotals', () => {
    it('should save totals successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: 'success',
          data: mockTotalsResponse,
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await saveTotals('project-123', mockTotalsData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/totals/project-123'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(mockTotalsData),
        }
      );

      // API returns { status, data }, function returns data
      expect(result).toEqual(mockTotalsResponse);
      expect(result.project_id).toBe('project-123');
      expect(result.grand_total).toBe(130000);
    });

    it('should include auth token if present', async () => {
      localStorage.setItem('token', 'test-token-123');

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: 'success',
          data: mockTotalsResponse,
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await saveTotals('project-123', mockTotalsData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/totals/project-123'),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token-123',
          },
          body: JSON.stringify(mockTotalsData),
        }
      );
    });

    it('should throw TotalsApiError on error response', async () => {
      const mockError = {
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({
          message: 'Project not found',
        }),
      };

      mockFetch.mockResolvedValueOnce(mockError);

      try {
        await saveTotals('project-123', mockTotalsData);
        fail('Expected saveTotals to throw TotalsApiError');
      } catch (error) {
        expect(error).toBeInstanceOf(TotalsApiError);
        expect((error as TotalsApiError).message).toBe('Project not found');
        expect((error as TotalsApiError).statusCode).toBe(404);
      }
    });

    it('should use default API URL if env var is not set', async () => {
      // Temporarily remove env var
      const originalEnv = import.meta.env.VITE_API_URL;
      import.meta.env.VITE_API_URL = undefined;

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: 'success',
          data: mockTotalsResponse,
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await saveTotals('project-123', mockTotalsData);

      // Should use default URL (localhost:3993 or localhost:3994 depending on config)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/totals/project-123'),
        expect.any(Object)
      );

      // Restore env var
      import.meta.env.VITE_API_URL = originalEnv;
    });
  });

  describe('getTotals', () => {
    it('should get totals successfully', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: 'success',
          data: mockTotalsResponse,
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await getTotals('project-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/totals/project-123'),
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      expect(result).toEqual(mockTotalsResponse);
    });

    it('should return null if totals not found', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: 'success',
          data: null,
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      const result = await getTotals('project-123');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const mockError = {
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({
          message: 'Project not found',
        }),
      };

      mockFetch.mockResolvedValueOnce(mockError);

      const result = await getTotals('project-123');

      expect(result).toBeNull();
    });

    it('should include auth token if present', async () => {
      localStorage.setItem('token', 'test-token-123');

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          status: 'success',
          data: mockTotalsResponse,
        }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse);

      await getTotals('project-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/totals/project-123'),
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer test-token-123',
          },
        }
      );
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
