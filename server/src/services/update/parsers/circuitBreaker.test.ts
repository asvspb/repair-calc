/**
 * Тесты для Circuit Breaker
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CircuitBreaker, CircuitBreakerConfig } from './circuitBreaker';
import { CircuitBreakerOpenError } from './types';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  const defaultConfig: CircuitBreakerConfig = {
    threshold: 3,
    resetTimeoutMs: 1000,  // 1 секунда для тестов
    halfOpenMaxRequests: 2,
  };

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker('test-parser', defaultConfig);
  });

  describe('Initial state', () => {
    it('should start in closed state', () => {
      const state = circuitBreaker.getState();
      expect(state.state).toBe('closed');
      expect(state.failures).toBe(0);
    });

    it('should be available initially', () => {
      expect(circuitBreaker.isAvailable()).toBe(true);
    });
  });

  describe('Closed state', () => {
    it('should execute function successfully', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should track failures', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      expect(circuitBreaker.getState().failures).toBe(1);

      await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      expect(circuitBreaker.getState().failures).toBe(2);
    });

    it('should reset failures on success', async () => {
      const failingFn = vi.fn().mockRejectedValueOnce(new Error('Error 1'))
        .mockRejectedValueOnce(new Error('Error 2'))
        .mockResolvedValueOnce('success');

      await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      await circuitBreaker.execute(failingFn);

      expect(circuitBreaker.getState().failures).toBe(0);
      expect(circuitBreaker.getState().state).toBe('closed');
    });
  });

  describe('Open state', () => {
    it('should open after threshold failures', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));

      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      }

      expect(circuitBreaker.getState().state).toBe('open');
      expect(circuitBreaker.isAvailable()).toBe(false);
    });

    it('should throw CircuitBreakerOpenError when open', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));

      // Открываем circuit breaker
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      }

      // Пытаемся выполнить - должно выбросить CircuitBreakerOpenError
      const successFn = vi.fn().mockResolvedValue('success');
      await expect(circuitBreaker.execute(successFn))
        .rejects
        .toThrow(CircuitBreakerOpenError);
    });

    it('should not increment failures when already open', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));

      // Открываем circuit breaker
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      }

      const failuresAfterOpen = circuitBreaker.getState().failures;

      // Пытаемся выполнить (будет выброшена CircuitBreakerOpenError)
      await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();

      expect(circuitBreaker.getState().failures).toBe(failuresAfterOpen);
    });
  });

  describe('Half-open state', () => {
    it('should transition to half-open after reset timeout', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));

      // Открываем circuit breaker
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      }

      expect(circuitBreaker.getState().state).toBe('open');

      // Ждём reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Следующий вызов должен перейти в half-open
      const successFn = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successFn);

      expect(circuitBreaker.getState().state).toBe('half-open');
    });

    it('should close after successful half-open requests', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));

      // Открываем circuit breaker
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      }

      // Ждём reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Выполняем успешные запросы в half-open состоянии
      const successFn = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successFn);
      await circuitBreaker.execute(successFn);

      expect(circuitBreaker.getState().state).toBe('closed');
      expect(circuitBreaker.getState().failures).toBe(0);
    });

    it('should reopen on failure in half-open state', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));

      // Открываем circuit breaker
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      }

      // Ждём reset timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Один успешный запрос
      const successFn = vi.fn().mockResolvedValue('success');
      await circuitBreaker.execute(successFn);

      expect(circuitBreaker.getState().state).toBe('half-open');

      // Один неудачный запрос - снова открываем
      await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();

      expect(circuitBreaker.getState().state).toBe('open');
    });
  });

  describe('Reset', () => {
    it('should manually reset to closed state', async () => {
      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));

      // Открываем circuit breaker
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingFn)).rejects.toThrow();
      }

      expect(circuitBreaker.getState().state).toBe('open');

      // Ручной сброс
      circuitBreaker.reset();

      expect(circuitBreaker.getState().state).toBe('closed');
      expect(circuitBreaker.getState().failures).toBe(0);
      expect(circuitBreaker.isAvailable()).toBe(true);
    });
  });

  describe('Custom configuration', () => {
    it('should use custom threshold', async () => {
      const customBreaker = new CircuitBreaker('test', {
        ...defaultConfig,
        threshold: 5,
      });

      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));

      for (let i = 0; i < 4; i++) {
        await expect(customBreaker.execute(failingFn)).rejects.toThrow();
      }

      expect(customBreaker.getState().state).toBe('closed');

      await expect(customBreaker.execute(failingFn)).rejects.toThrow();

      expect(customBreaker.getState().state).toBe('open');
    });

    it('should use custom reset timeout', async () => {
      const customBreaker = new CircuitBreaker('test', {
        ...defaultConfig,
        resetTimeoutMs: 500,
      });

      const failingFn = vi.fn().mockRejectedValue(new Error('Test error'));

      for (let i = 0; i < 3; i++) {
        await expect(customBreaker.execute(failingFn)).rejects.toThrow();
      }

      await new Promise(resolve => setTimeout(resolve, 600));

      const successFn = vi.fn().mockResolvedValue('success');
      await customBreaker.execute(successFn);

      expect(customBreaker.getState().state).toBe('half-open');
    });
  });
});
