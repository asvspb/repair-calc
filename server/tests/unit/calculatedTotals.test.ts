/**
 * Тесты для репозитория CalculatedTotals
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Мокаем функции query и execute из pool
vi.mock('../../src/db/pool.js', () => ({
  query: vi.fn(),
  execute: vi.fn(),
}));

import { query, execute } from '../../src/db/pool.js';
import { CalculatedTotalsRepository } from '../../src/db/repositories/calculatedTotals.repo.js';

const mockQuery = query as vi.MockedFunction<typeof query>;
const mockExecute = execute as vi.MockedFunction<typeof execute>;

describe('CalculatedTotalsRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('upsert', () => {
    it('should create new calculated totals for project', async () => {
      const projectId = 'project-123';
      const totalsData = {
        total_area: 150.5,
        total_works: 50000,
        total_materials: 75000,
        total_tools: 5000,
        grand_total: 130000,
      };

      const mockResult = {
        project_id: projectId,
        ...totalsData,
        calculated_at: new Date('2026-03-15T10:00:00.000Z'),
      };

      // Mock INSERT ... ON DUPLICATE KEY UPDATE - execute returns ResultSetHeader
      mockExecute.mockResolvedValueOnce({ affectedRows: 1 } as any);
      // Mock SELECT for retrieval - query returns rows array directly
      mockQuery.mockResolvedValueOnce([mockResult]);

      const result = await CalculatedTotalsRepository.upsert(projectId, totalsData);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO calculated_totals'),
        expect.arrayContaining([
          projectId,
          totalsData.total_area,
          totalsData.total_works,
          totalsData.total_materials,
          totalsData.total_tools,
          totalsData.grand_total,
        ])
      );

      expect(result).toEqual(mockResult);
      expect(result.project_id).toBe(projectId);
      expect(result.grand_total).toBe(130000);
    });

    it('should update existing calculated totals', async () => {
      const projectId = 'project-456';
      const updatedData = {
        total_area: 200.75,
        total_works: 65000,
        total_materials: 90000,
        total_tools: 7500,
        grand_total: 162500,
      };

      const mockUpdated = {
        project_id: projectId,
        ...updatedData,
        calculated_at: new Date('2026-03-15T12:00:00.000Z'),
      };

      mockExecute.mockResolvedValueOnce({ affectedRows: 2 } as any); // 2 = updated
      mockQuery.mockResolvedValueOnce([mockUpdated]);

      const result = await CalculatedTotalsRepository.upsert(projectId, updatedData);

      expect(result).toEqual(mockUpdated);
      expect(result.total_area).toBe(200.75);
      expect(result.grand_total).toBe(162500);
    });

    it('should throw error if totals cannot be retrieved after upsert', async () => {
      const projectId = 'project-789';
      const totalsData = {
        total_area: 100,
        total_works: 30000,
        total_materials: 40000,
        total_tools: 2000,
        grand_total: 72000,
      };

      mockExecute.mockResolvedValueOnce({ affectedRows: 1 } as any);
      mockQuery.mockResolvedValueOnce([]); // Empty result

      await expect(
        CalculatedTotalsRepository.upsert(projectId, totalsData)
      ).rejects.toThrow(
        `Failed to retrieve calculated totals for project ${projectId}`
      );
    });
  });

  describe('findByProjectId', () => {
    it('should return calculated totals for project', async () => {
      const projectId = 'project-123';
      const mockTotals = {
        project_id: projectId,
        total_area: 150.5,
        total_works: 50000,
        total_materials: 75000,
        total_tools: 5000,
        grand_total: 130000,
        calculated_at: new Date('2026-03-15T10:00:00.000Z'),
      };

      mockQuery.mockResolvedValueOnce([mockTotals]);

      const result = await CalculatedTotalsRepository.findByProjectId(projectId);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM calculated_totals WHERE project_id = ?'),
        [projectId]
      );

      expect(result).toEqual(mockTotals);
      expect(result?.project_id).toBe(projectId);
    });

    it('should return null for project without totals', async () => {
      const projectId = 'project-no-totals';

      mockQuery.mockResolvedValueOnce([]);

      const result = await CalculatedTotalsRepository.findByProjectId(projectId);

      expect(result).toBeNull();
    });
  });

  describe('deleteByProjectId', () => {
    it('should delete calculated totals for project', async () => {
      const projectId = 'project-delete';

      mockExecute.mockResolvedValueOnce({ affectedRows: 1 } as any);

      const result = await CalculatedTotalsRepository.deleteByProjectId(projectId);

      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM calculated_totals WHERE project_id = ?'),
        [projectId]
      );

      expect(result).toBe(true);
    });

    it('should return false if project has no totals', async () => {
      const projectId = 'project-no-totals';

      mockExecute.mockResolvedValueOnce({ affectedRows: 0 } as any);

      const result = await CalculatedTotalsRepository.deleteByProjectId(projectId);

      expect(result).toBe(false);
    });
  });
});
