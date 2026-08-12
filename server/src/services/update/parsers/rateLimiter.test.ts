/**
 * Тесты для Rate Limiter
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from './rateLimiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
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

      expect(rateLimiter.getRemainingRequestsPerMinute()).toBe(0);

      // Третий запрос должен ждать
      const waitPromise = rateLimiter.wait();

      // Проматываем время на 1 минуту + 1 мс и синхронизируем Date.now()
      vi.advanceTimersByTime(60001);
      vi.setSystemTime(new Date('2026-01-01T00:01:00.001Z'));

      await waitPromise;

      // После выполнения 3-го запроса должно остаться 0 (2 старых timestamp очистились, 1 новый записался)
      expect(rateLimiter.getRemainingRequestsPerMinute()).toBe(1);
    });

    it('should clean old timestamps after minute passes', async () => {
      rateLimiter = new RateLimiter({
        requestsPerMinute: 2,
        minDelayMs: 0,
      });

      await rateLimiter.wait();
      await rateLimiter.wait();

      expect(rateLimiter.getRemainingRequestsPerMinute()).toBe(0);

      // Проматываем время на 1 минуту + 1 мс и синхронизируем Date.now()
      vi.advanceTimersByTime(60001);
      vi.setSystemTime(new Date('2026-01-01T00:01:00.001Z'));

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

      // Проматываем 24 часа и синхронизируем Date.now()
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
      vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));

      expect(rateLimiter.getRemainingRequestsPerDay()).toBe(2);
    });
  });

  describe('Minimum delay', () => {
    it('should enforce minimum delay between requests', async () => {
      rateLimiter = new RateLimiter({
        requestsPerMinute: 100,
        minDelayMs: 100,
      });

      // Первый запрос проходит мгновенно
      await rateLimiter.wait();
      
      // Второй запрос должен ждать minDelayMs
      const waitPromise = rateLimiter.wait();
      
      // Проматываем время на minDelayMs
      vi.advanceTimersByTime(100);
      
      await waitPromise;

      // Если дошли сюда без ошибки - тест пройден
      expect(rateLimiter.getRemainingRequestsPerMinute()).toBe(98);
    });

    it('should account for time since last request', async () => {
      rateLimiter = new RateLimiter({
        requestsPerMinute: 100,
        minDelayMs: 100,
      });

      await rateLimiter.wait();
      
      // Ждём 50 мс "времени"
      vi.advanceTimersByTime(50);
      
      // Следующий запрос должен ждать оставшиеся 50 мс
      const waitPromise = rateLimiter.wait();
      vi.advanceTimersByTime(50);
      await waitPromise;

      // Если дошли сюда без ошибки - тест пройден
      expect(rateLimiter.getRemainingRequestsPerMinute()).toBe(98);
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

      // Проматываем минуту и синхронизируем Date.now()
      vi.advanceTimersByTime(60000);
      vi.setSystemTime(new Date('2026-01-01T00:01:00Z'));

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
