/**
 * Circuit Breaker паттерн для защиты от сбоев парсеров
 * 
 * @package server/src/services/update/parsers
 */

import type { CircuitBreakerState } from './types';
import { CircuitBreakerOpenError } from './types';

/**
 * Конфигурация Circuit Breaker
 */
export interface CircuitBreakerConfig {
  threshold: number;           // Количество ошибок до открытия
  resetTimeoutMs: number;      // Время до попытки сброса
  halfOpenMaxRequests: number; // Максимум запросов в half-open состоянии
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  threshold: 5,
  resetTimeoutMs: 10 * 60 * 1000, // 10 минут
  halfOpenMaxRequests: 3,
};

/**
 * Circuit Breaker для парсеров
 */
export class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failures = 0;
  private successes = 0;
  private lastFailureTime: number | null = null;

  constructor(
    private parserType: string,
    private config: CircuitBreakerConfig = DEFAULT_CONFIG
  ) {}

  /**
   * Выполнение функции с защитой Circuit Breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      // Проверка на возможность перехода в half-open
      if (this.lastFailureTime && Date.now() - this.lastFailureTime > this.config.resetTimeoutMs) {
        this.state = 'half-open';
        console.info(`Circuit breaker for ${this.parserType} entering half-open state`);
      } else {
        throw new CircuitBreakerOpenError(
          `Circuit breaker for ${this.parserType} is open`
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Обработка успеха
   */
  private onSuccess(): void {
    this.successes++;

    if (this.state === 'half-open' && this.successes >= this.config.halfOpenMaxRequests) {
      this.state = 'closed';
      this.failures = 0;
      this.successes = 0;
      console.info(`Circuit breaker for ${this.parserType} closed (recovered)`);
    }
  }

  /**
   * Обработка ошибки
   */
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.successes = 0;

    if (this.state === 'half-open') {
      this.state = 'open';
      console.warn(`Circuit breaker for ${this.parserType} opened from half-open`);
    } else if (this.failures >= this.config.threshold) {
      this.state = 'open';
      console.warn(`Circuit breaker for ${this.parserType} opened after ${this.failures} failures`);
    }
  }

  /**
   * Публичный метод для записи успеха (для внешнего использования)
   */
  recordSuccess(): void {
    this.onSuccess();
  }

  /**
   * Публичный метод для записи ошибки (для внешнего использования)
   */
  recordFailure(): void {
    this.onFailure();
  }

  /**
   * Получение текущего состояния
   */
  getState(): CircuitBreakerState {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }

  /**
   * Сброс состояния (для ручного управления)
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    console.info(`Circuit breaker for ${this.parserType} manually reset`);
  }

  /**
   * Проверка доступности (не в открытом состоянии)
   */
  isAvailable(): boolean {
    return this.state !== 'open';
  }
}
