/**
 * Rate Limiter для ограничения частоты запросов
 * 
 * @package server/src/services/update/parsers
 */

/**
 * Конфигурация Rate Limiter
 */
export interface RateLimiterConfig {
  requestsPerMinute: number;
  requestsPerDay?: number;
  minDelayMs?: number;  // Минимальная задержка между запросами
}

/**
 * Rate Limiter для парсеров
 */
export class RateLimiter {
  private requestTimestamps: number[] = [];
  private dailyRequestCount = 0;
  private lastRequestTime = 0;
  private dailyResetTimeout: NodeJS.Timeout | null = null;

  constructor(private config: RateLimiterConfig) {
    // Планируем сброс дневного счётчика
    this.scheduleDailyReset();
  }

  /**
   * Ожидание возможности выполнения запроса
   */
  async wait(): Promise<void> {
    // Проверка дневного лимита
    if (this.config.requestsPerDay && this.dailyRequestCount >= this.config.requestsPerDay) {
      throw new Error(`Daily rate limit exceeded (${this.config.requestsPerDay} requests)`);
    }

    // Проверка лимита в минуту
    await this.throttlePerMinute();

    // Минимальная задержка между запросами
    if (this.config.minDelayMs) {
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < this.config.minDelayMs) {
        await this.delay(this.config.minDelayMs - timeSinceLastRequest);
      }
    }

    // Обновляем счётчики
    this.requestTimestamps.push(Date.now());
    this.dailyRequestCount++;
    this.lastRequestTime = Date.now();
  }

  /**
   * Троттлинг по минутному лимиту
   */
  private async throttlePerMinute(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    // Удаляем старые timestamp
    this.requestTimestamps = this.requestTimestamps.filter(ts => ts > oneMinuteAgo);

    // Проверка лимита
    if (this.requestTimestamps.length >= this.config.requestsPerMinute) {
      const oldestTimestamp = this.requestTimestamps[0];
      const waitTime = oldestTimestamp + 60 * 1000 - now;

      if (waitTime > 0) {
        console.debug(`Rate limit: waiting ${waitTime}ms`);
        await this.delay(waitTime);
        // Рекурсивная проверка после ожидания
        return this.throttlePerMinute();
      }
    }
  }

  /**
   * Получение оставшихся запросов в минуту
   */
  getRemainingRequestsPerMinute(): number {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const recentRequests = this.requestTimestamps.filter(ts => ts > oneMinuteAgo).length;
    return Math.max(0, this.config.requestsPerMinute - recentRequests);
  }

  /**
   * Получение оставшихся запросов в день
   */
  getRemainingRequestsPerDay(): number {
    if (!this.config.requestsPerDay) {
      return Infinity;
    }
    return Math.max(0, this.config.requestsPerDay - this.dailyRequestCount);
  }

  /**
   * Сброс дневного счётчика
   */
  private scheduleDailyReset(): void {
    if (this.dailyResetTimeout) {
      clearTimeout(this.dailyResetTimeout);
    }

    // Сброс через 24 часа
    this.dailyResetTimeout = setTimeout(() => {
      this.dailyRequestCount = 0;
      console.info('RateLimiter: Daily request count reset');
      this.scheduleDailyReset();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Очистка ресурсов
   */
  destroy(): void {
    if (this.dailyResetTimeout) {
      clearTimeout(this.dailyResetTimeout);
      this.dailyResetTimeout = null;
    }
  }

  /**
   * Утилита задержки
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
