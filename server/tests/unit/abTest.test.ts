/**
 * Тесты для A/B тестирования парсеров
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

import { ABTestRepository } from '../../src/db/repositories/abTest.repo.js';

describe('ABTestRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new A/B test', async () => {
      const mockTest = {
        id: 'test-123',
        name: 'Gemini vs Mistral',
        description: 'Сравнение AI парсеров',
        parser_a: 'ai_gemini',
        parser_b: 'ai_mistral',
        traffic_split: 50,
        status: 'draft',
        created_by: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);
      mockQuery.mockResolvedValueOnce([mockTest]);

      const result = await ABTestRepository.create({
        name: 'Gemini vs Mistral',
        description: 'Сравнение AI парсеров',
        parser_a: 'ai_gemini',
        parser_b: 'ai_mistral',
        traffic_split: 50,
      });

      expect(result.name).toBe('Gemini vs Mistral');
      expect(result.parser_a).toBe('ai_gemini');
      expect(result.parser_b).toBe('ai_mistral');
    });
  });

  describe('findById', () => {
    it('should return test by id', async () => {
      const mockTest = {
        id: 'test-123',
        name: 'Test',
        parser_a: 'ai_gemini',
        parser_b: 'ai_mistral',
        traffic_split: 50,
        status: 'running',
      };

      mockQuery.mockResolvedValueOnce([mockTest]);

      const result = await ABTestRepository.findById('test-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('test-123');
    });

    it('should return null for non-existent test', async () => {
      mockQuery.mockResolvedValueOnce([]);

      const result = await ABTestRepository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findMany', () => {
    it('should return list of tests with total', async () => {
      const mockTests = [
        { id: 'test-1', name: 'Test 1', status: 'completed' },
        { id: 'test-2', name: 'Test 2', status: 'running' },
      ];

      mockQuery.mockResolvedValueOnce([{ total: 2 }]);
      mockQuery.mockResolvedValueOnce(mockTests);

      const result = await ABTestRepository.findMany({ limit: 10, offset: 0 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status', async () => {
      mockQuery.mockResolvedValueOnce([{ total: 1 }]);
      mockQuery.mockResolvedValueOnce([{ id: 'test-1', status: 'running' }]);

      const result = await ABTestRepository.findMany({ status: 'running' });

      expect(result.items).toHaveLength(1);
    });
  });

  describe('findRunning', () => {
    it('should return all running tests', async () => {
      const mockTests = [
        { id: 'test-1', status: 'running' },
        { id: 'test-2', status: 'running' },
      ];

      mockQuery.mockResolvedValueOnce(mockTests);

      const result = await ABTestRepository.findRunning();

      expect(result).toHaveLength(2);
    });
  });

  describe('start', () => {
    it('should start a draft test', async () => {
      const mockTest = {
        id: 'test-123',
        status: 'draft',
        parser_a: 'ai_gemini',
        parser_b: 'ai_mistral',
        traffic_split: 50,
      };

      mockQuery.mockResolvedValueOnce([mockTest]); // findById
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]); // update
      mockQuery.mockResolvedValueOnce([{ ...mockTest, status: 'running' }]); // findById

      const result = await ABTestRepository.start('test-123');

      expect(result?.status).toBe('running');
    });

    it('should return null for non-draft test', async () => {
      const mockTest = {
        id: 'test-123',
        status: 'running',
      };

      mockQuery.mockResolvedValueOnce([mockTest]);

      const result = await ABTestRepository.start('test-123');

      expect(result).toBeNull();
    });
  });

  describe('complete', () => {
    it('should complete a running test', async () => {
      const mockTest = {
        id: 'test-123',
        status: 'running',
      };

      mockQuery.mockResolvedValueOnce([mockTest]);
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]);
      mockQuery.mockResolvedValueOnce([{ ...mockTest, status: 'completed', winner: 'parser_a' }]);

      const result = await ABTestRepository.complete('test-123', 'parser_a', 0.95);

      expect(result?.status).toBe('completed');
      expect(result?.winner).toBe('parser_a');
    });
  });

  describe('addResult', () => {
    it('should add test result and update counters', async () => {
      const mockTest = {
        id: 'test-123',
        total_requests_a: 0,
        total_requests_b: 0,
        success_count_a: 0,
        success_count_b: 0,
        avg_response_time_a: 0,
        avg_response_time_b: 0,
        avg_price_a: null,
        avg_price_b: null,
      };

      const mockResult = {
        id: 'result-123',
        test_id: 'test-123',
        item_name: 'Ламинат',
        city: 'Москва',
        category: 'material',
        parser_group: 'a',
        parser_type: 'ai_gemini',
        success: true,
        price_avg: '500',
        response_time_ms: 1500,
      };

      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]); // insert result
      mockQuery.mockResolvedValueOnce([mockTest]); // findById for counters
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]); // update counters
      mockQuery.mockResolvedValueOnce([]); // check daily stats
      mockExecute.mockResolvedValueOnce([{ affectedRows: 1 }]); // insert daily stats
      mockQuery.mockResolvedValueOnce([mockResult]); // get result

      const result = await ABTestRepository.addResult({
        test_id: 'test-123',
        item_name: 'Ламинат',
        city: 'Москва',
        category: 'material',
        parser_group: 'a',
        parser_type: 'ai_gemini',
        success: true,
        price_avg: 500,
        response_time_ms: 1500,
      });

      expect(result.success).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should calculate stats from results', async () => {
      const mockTest = {
        id: 'test-123',
        total_requests_a: 10,
        total_requests_b: 10,
        success_count_a: 8,
        success_count_b: 7,
        avg_response_time_a: 1200,
        avg_response_time_b: 1500,
        avg_price_a: '500.00',
        avg_price_b: '550.00',
      };

      mockQuery.mockResolvedValueOnce([mockTest]); // findById
      mockQuery.mockResolvedValueOnce([
        // stats aggregation
        {
          parser_group: 'a',
          requests: 10,
          success_count: 8,
          avg_response_time: 1200,
          avg_price: '500.00',
        },
        {
          parser_group: 'b',
          requests: 10,
          success_count: 7,
          avg_response_time: 1500,
          avg_price: '550.00',
        },
      ]);

      const result = await ABTestRepository.getStats('test-123');

      expect(result).toBeDefined();
      expect(result.testId).toBe('test-123');
    });
  });
});
