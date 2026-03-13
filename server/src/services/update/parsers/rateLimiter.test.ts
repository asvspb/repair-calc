/**
 * Тесты для Rate Limiter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from './rateLimiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial state', () => {
    it('should start with full capacity', () => {
      rateLimiter = new RateLimiter({
        requestsPerMinute: 10,
        requestsPerDay: 100,
      });

      expect(rateLimiter.getRemainingRequestsPerMinute()).toBe(10);
      expect(rateLimiter.getRemainingRequestsPerDay()).toBe(100);
    });

    it('should handle infinite daily limit', () => {
      rateLimiter = new RateLimiter({
        requestsPerMinute: 10,
      });

      expect(rateLimiter.getRemainingRequestsPerDay()).toBe(Infinity);
    });
  });

  describe('Per-minute limiting', () => {
    it('should allow requests within limit', async () => {
      rateLimiter = new RateLimiter({
        requestsPerMinute: 5,
        minDelayMs: 0,
      });

      for (let i = 0; i < 5; i++) {
        await rateLimiter.wait();
      }

      expect(rateLimiter.getRemainingRequestsPerMinute()).toBe(0);
    });

    it('should throttle when exceeding minute limit', async () => {
      rateLimiter = new RateLimiter({
        requestsPerMinute: 2,
        minDelayMs: 0,
      });

      // Первые 2 запроса проходят сразу
      await rateLimiter.wait();
      await rateLimiter.wait();

      // Третий запрос должен ждать
      const waitPromise = rateLimiter.wait();
      
      // Проматываем время на 1 минуту
      vi.advanceTimersByTime(60000);
      
      await waitPromise;

      expect(rateLimiter.getRemainingRequestsPerMinute()).toBe(0);
    });

    it('should clean old timestamps after minute passes', async () => {
      rateLimiter = new RateLimiter({
        requestsPerMinute: 2,
        minDelayMs: 0,
      });

      await rateLimiter.wait();
      await rateLimiter.wait();

      expect(rateLimiter.getRemainingRequestsPerMinute()).toBe(0);

      // Проматываем время на 1 минуту + 1 мс
      vi.advanceTimersByTime(60001);

      expect(rateLimiter.getRemainingRequestsPerMinute()).toBe(2);
    });
  });

  describe('Daily limit', () => {
    it('should track daily requests', async () => {
      rateLimiter = new RateLimiter({
        requestsPerMinute: 10,
        requestsPerDay: 5,
        minDelayMs: 0,
      });

      for (let i = 0; i < 5; i++) {
        await rateLimiter.wait();
      }

      expect(rateLimiter.getRemainingRequestsPerDay()).toBe(0);
    });

    it('should throw when exceeding daily limit', async () => {
      rateLimiter = new RateLimiter({
        requestsPerMinute: 10,
        requestsPerDay: 3,
        minDelayMs: 0,
      });

      for (let i = 0; i < 3; i++) {
        await rateLimiter.wait();
      }

      await expect(rateLimiter.wait()).rejects.toThrow('Daily rate limit exceeded');
    });

    it('should reset daily counter after 24 hours', async () => {
      rateLimiter = new RateLimiter({
        requestsPerMinute: 10,
        requestsPerDay: 2,
        minDelayMs: 0,
      });

      await rateLimiter.wait();
      await rateLimiter.wait();

      expect(rateLimiter.getRemainingRequestsPerDay()).toBe(0);

      // Проматываем 24 часа
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);

      expect(rateLimiter.getRemainingRequestsPerDay()).toBe(2);
    });
  });

  describe('Minimum delay', () => {
    it('should enforce minimum delay between requests', async () => {
      rateLimiter = new RateLimiter({
        requestsPerMinute: 100,
        minDelayMs: 100,
      });

      const startTime = Date.now();
      
      await rateLimiter.wait();
      const firstTime = Date.now() - startTime;
      
      await rateLimiter.wait();
      const secondTime = Date.now() - startTime;

      expect(firstTime).toBeLessThan(50); // Первый запрос почти мгновенный
      expect(secondTime - firstTime).toBeGreaterThanOrEqual(95); // Второй с задержкой
    });

    it('should account for time since last request', async () => {
      rateLimiter = new RateLimiter({
        requestsPerMinute: 100,
        minDelayMs: 100,
      });

      await rateLimiter.wait();
      
      // Ждём 50 мс
      vi.advanceTimersByTime(50);
      
      const startTime = Date.now();
      await rateLimiter.wait();
      const waitTime = Date.now() - startTime;

      expect(waitTime).toBeGreaterThanOrEqual(45); // Оставшиеся 50 мс
    });
  });

  describe('Combined limits', () => {
    it('should respect both minute and daily limits', async () => {
      rateLimiter = new RateLimiter({
        requestsPerMinute: 3,
        requestsPerDay: 5,
        minDelayMs: 0,
      });

      // Исчерпываем минутный лимит
      for (let i = 0; i < 3; i++) {
        await rateLimiter.wait();
      }

      expect(rateLimiter.getRemainingRequestsPerMinute()).toBe(0);
      expect(rateLimiter.getRemainingRequestsPerDay()).toBe(2);

      // Проматываем минуту
      vi.advanceTimersByTime(60000);

      expect(rateLimiter.getRemainingRequestsPerMinute()).toBe(3);
      expect(rateLimiter.getRemainingRequestsPerDay()).toBe(2);

      // Ещё 2 запроса
      await rateLimiter.wait();
      await rateLimiter.wait();

      expect(rateLimiter.getRemainingRequestsPerDay()).toBe(0);
    });
  });

  describe('Destroy', () => {
    it('should clear daily reset timeout', () => {
      rateLimiter = new RateLimiter({
        requestsPerMinute: 10,
        requestsPerDay: 100,
      });

      const destroySpy = vi.spyOn(global, 'clearTimeout');
      
      rateLimiter.destroy();

      expect(destroySpy).toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle zero requests per minute', async () => {
      rateLimiter = new RateLimiter({
        requestsPerMinute: 0,
        minDelayMs: 0,
      });

      await expect(rateLimiter.wait()).rejects.toThrow();
    });

    it('should handle large limits', async () => {
      rateLimiter = new RateLimiter({
        requestsPerMinute: 1000000,
        requestsPerDay: 1000000,
        minDelayMs: 0,
      });

      for (let i = 0; i < 100; i++) {
        await rateLimiter.wait();
      }

      expect(rateLimiter.getRemainingRequestsPerMinute()).toBe(999900);
      expect(rateLimiter.getRemainingRequestsPerDay()).toBe(999900);
    });
  });

  describe('Concurrent requests', () => {
    it('should handle concurrent wait calls', async () => {
      rateLimiter = new RateLimiter({
        requestsPerMinute: 5,
        minDelayMs: 0,
      });

      // 3 параллельных запроса
      const promises = [
        rateLimiter.wait(),
        rateLimiter.wait(),
        rateLimiter.wait(),
      ];

      await Promise.all(promises);

      expect(rateLimiter.getRemainingRequestsPerMinute()).toBe(2);
    });
  });
});
