/**
 * Тесты для A/B тестирования парсеров
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Мокаем pool
vi.mock('../../src/db/pool.js', () => ({
  pool: {
    execute: vi.fn(),
  },
}));

import { pool } from '../../src/db/pool.js';
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

      (pool.execute as any).mockResolvedValueOnce([{ affectedRows: 1 }]);
      (pool.execute as any).mockResolvedValueOnce([[mockTest]]);

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

      (pool.execute as any).mockResolvedValueOnce([[mockTest]]);

      const result = await ABTestRepository.findById('test-123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('test-123');
    });

    it('should return null for non-existent test', async () => {
      (pool.execute as any).mockResolvedValueOnce([[]]);

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

      (pool.execute as any).mockResolvedValueOnce([{ total: 2 }]);
      (pool.execute as any).mockResolvedValueOnce([mockTests]);

      const result = await ABTestRepository.findMany({ limit: 10, offset: 0 });

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by status', async () => {
      (pool.execute as any).mockResolvedValueOnce([{ total: 1 }]);
      (pool.execute as any).mockResolvedValueOnce([[{ id: 'test-1', status: 'running' }]]);

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

      (pool.execute as any).mockResolvedValueOnce([mockTests]);

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

      (pool.execute as any).mockResolvedValueOnce([[mockTest]]); // findById
      (pool.execute as any).mockResolvedValueOnce([{ affectedRows: 1 }]); // update
      (pool.execute as any).mockResolvedValueOnce([[{ ...mockTest, status: 'running' }]]); // findById

      const result = await ABTestRepository.start('test-123');

      expect(result?.status).toBe('running');
    });

    it('should return null for non-draft test', async () => {
      const mockTest = {
        id: 'test-123',
        status: 'running',
      };

      (pool.execute as any).mockResolvedValueOnce([[mockTest]]);

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

      (pool.execute as any).mockResolvedValueOnce([[mockTest]]);
      (pool.execute as any).mockResolvedValueOnce([{ affectedRows: 1 }]);
      (pool.execute as any).mockResolvedValueOnce([[{ ...mockTest, status: 'completed', winner: 'parser_a' }]]);

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

      (pool.execute as any).mockResolvedValueOnce([{ affectedRows: 1 }]); // insert result
      (pool.execute as any).mockResolvedValueOnce([[mockTest]]); // findById for counters
      (pool.execute as any).mockResolvedValueOnce([{ affectedRows: 1 }]); // update counters
      (pool.execute as any).mockResolvedValueOnce([[]]); // check daily stats
      (pool.execute as any).mockResolvedValueOnce([{ affectedRows: 1 }]); // insert daily stats
      (pool.execute as any).mockResolvedValueOnce([[mockResult]]); // get result

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
        parser_a: 'ai_gemini',
        parser_b: 'ai_mistral',
      };

      const mockStats = [
        {
          parser_group: 'a',
          requests: 100,
          success_count: 90,
          avg_response_time: 1500,
          avg_price: 500,
        },
        {
          parser_group: 'b',
          requests: 100,
          success_count: 85,
          avg_response_time: 2000,
          avg_price: 520,
        },
      ];

      (pool.execute as any).mockResolvedValueOnce([[mockTest]]);
      (pool.execute as any).mockResolvedValueOnce([mockStats]);

      const result = await ABTestRepository.getStats('test-123');

      expect(result).toBeDefined();
      expect(result?.groupA.requests).toBe(100);
      expect(result?.groupA.successRate).toBe(90);
      expect(result?.groupB.successRate).toBe(85);
    });
  });
});

describe('calculateWinner', () => {
  it('should declare parser_a as winner with better metrics', () => {
    const groupA = {
      successRate: 90,
      avgResponseTime: 1000,
      avgPrice: 500,
    };
    const groupB = {
      successRate: 80,
      avgResponseTime: 2000,
      avgPrice: 520,
    };

    const result = ABTestRepository.calculateWinner(groupA, groupB);

    expect(result.winner).toBe('parser_a');
    expect(result.confidenceLevel).toBeGreaterThan(0);
  });

  it('should declare parser_b as winner with better metrics', () => {
    const groupA = {
      successRate: 70,
      avgResponseTime: 3000,
      avgPrice: 600,
    };
    const groupB = {
      successRate: 95,
      avgResponseTime: 800,
      avgPrice: 480,
    };

    const result = ABTestRepository.calculateWinner(groupA, groupB);

    expect(result.winner).toBe('parser_b');
  });

  it('should declare tie for equal metrics', () => {
    const groupA = {
      successRate: 85,
      avgResponseTime: 1500,
      avgPrice: 500,
    };
    const groupB = {
      successRate: 85,
      avgResponseTime: 1500,
      avgPrice: 500,
    };

    const result = ABTestRepository.calculateWinner(groupA, groupB);

    expect(result.winner).toBe('tie');
    expect(result.confidenceLevel).toBe(0);
  });
});
