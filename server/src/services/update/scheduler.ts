/**
 * Scheduler - Планировщик задач обновления цен
 * UPDATE_SERVICE - Specification v1.1
 */

import { CronJob } from 'cron';
import { getUpdateRunner } from './runner.js';
import { UpdateJobRepository, UpdateLogRepository } from '../../db/repositories/updateJob.repo.js';
import { PriceSourceRepository } from '../../db/repositories/priceCatalog.repo.js';

// ═══════════════════════════════════════════════════════
// КОНФИГУРАЦИЯ
// ═══════════════════════════════════════════════════════

export interface SchedulerConfig {
  enabled: boolean;
  cron: string;              // '0 3 * * *' = каждый день в 3:00
  timezone: string;          // 'Europe/Moscow'
  retryOnFailure: boolean;
  retryDelayMs: number;      // 5 минут
  maxRetries: number;        // 3
  maxConcurrentJobs: number; // Максимум одновременных задач
}

const defaultConfig: SchedulerConfig = {
  enabled: true,
  cron: '0 3 * * *',
  timezone: 'Europe/Moscow',
  retryOnFailure: true,
  retryDelayMs: 5 * 60 * 1000,
  maxRetries: 3,
  maxConcurrentJobs: 3,
};

// ═══════════════════════════════════════════════════════
// SCHEDULER
// ═══════════════════════════════════════════════════════

class SchedulerImpl {
  private cronJob: CronJob | null = null;
  private config: SchedulerConfig;
  private runningJobs = new Set<string>();
  private retryTimers = new Map<string, NodeJS.Timeout>();

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  // ─── УПРАВЛЕНИЕ ────────────────────────────────────────────

  /**
   * Запускает планировщик
   */
  start(): void {
    if (this.cronJob) {
      this.stop();
    }

    if (!this.config.enabled) {
      console.log('[Scheduler] Disabled by config');
      return;
    }

    try {
      this.cronJob = new CronJob(
        this.config.cron,
        () => this.runScheduledUpdate(),
        null,
        true,
        this.config.timezone
      );

      console.log(`[Scheduler] Started with cron: ${this.config.cron} (${this.config.timezone})`);
      console.log(`[Scheduler] Next run: ${this.getNextRun()?.toISOString()}`);
    } catch (error) {
      console.error('[Scheduler] Failed to start:', error);
    }
  }

  /**
   * Останавливает планировщик
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('[Scheduler] Stopped');
    }

    // Отменяем все retry таймеры
    for (const [jobId, timer] of this.retryTimers) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();
  }

  /**
   * Перезапускает с новой конфигурацией
   */
  restart(config: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...config };
    this.stop();
    this.start();
  }

  // ─── ЗАПУСК ОБНОВЛЕНИЯ ──────────────────────────────────────

  /**
   * Запускает плановое обновление
   */
  private async runScheduledUpdate(): Promise<void> {
    console.log('[Scheduler] Starting scheduled update...');

    // Проверяем лимит одновременных задач
    if (this.runningJobs.size >= this.config.maxConcurrentJobs) {
      console.warn('[Scheduler] Max concurrent jobs reached, skipping scheduled run');
      return;
    }

    try {
      const runner = getUpdateRunner();
      const job = await runner.runScheduled();

      this.runningJobs.add(job.id);

      // Ждём завершения
      await this.waitForCompletion(job.id);

      console.log(`[Scheduler] Job ${job.id} completed with status: ${job.status}`);

      // Обрабатываем retry при неудаче
      if (job.status === 'failed' && this.config.retryOnFailure) {
        await this.scheduleRetry(job.id);
      }
    } catch (error) {
      console.error('[Scheduler] Scheduled update failed:', error);
    } finally {
      this.runningJobs.clear();
    }
  }

  /**
   * Ждёт завершения задачи
   */
  private async waitForCompletion(jobId: string, timeout: number = 3600000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const job = await UpdateJobRepository.findById(jobId);
      
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      if (['completed', 'failed', 'cancelled'].includes(job.status)) {
        return;
      }

      // Ждём 5 секунд перед следующей проверкой
      await this.delay(5000);
    }

    throw new Error(`Job ${jobId} timed out`);
  }

  /**
   * Планирует повторную попытку
   */
  private async scheduleRetry(jobId: string, attempt: number = 1): Promise<void> {
    if (attempt > this.config.maxRetries) {
      console.log(`[Scheduler] Max retries (${this.config.maxRetries}) reached for job ${jobId}`);
      return;
    }

    console.log(`[Scheduler] Scheduling retry ${attempt}/${this.config.maxRetries} for job ${jobId}`);

    const timer = setTimeout(async () => {
      this.retryTimers.delete(jobId);

      try {
        const runner = getUpdateRunner();
        const newJob = await runner.runScheduled();

        this.runningJobs.add(newJob.id);
        await this.waitForCompletion(newJob.id);

        if (newJob.status === 'failed' && attempt < this.config.maxRetries) {
          await this.scheduleRetry(jobId, attempt + 1);
        }
      } catch (error) {
        console.error(`[Scheduler] Retry ${attempt} failed:`, error);
      } finally {
        this.runningJobs.clear();
      }
    }, this.config.retryDelayMs);

    this.retryTimers.set(jobId, timer);
  }

  // ─── СТАТУС И ИНФОРМАЦИЯ ────────────────────────────────────

  /**
   * Получает статус планировщика
   */
  getStatus(): {
    enabled: boolean;
    running: boolean;
    nextRun: Date | null;
    cron: string;
    timezone: string;
    runningJobs: number;
    maxConcurrentJobs: number;
  } {
    return {
      enabled: this.config.enabled,
      running: this.cronJob !== null,
      nextRun: this.getNextRun(),
      cron: this.config.cron,
      timezone: this.config.timezone,
      runningJobs: this.runningJobs.size,
      maxConcurrentJobs: this.config.maxConcurrentJobs,
    };
  }

  /**
   * Получает время следующего запуска
   */
  getNextRun(): Date | null {
    if (!this.cronJob) return null;
    
    const nextDates = this.cronJob.nextDates(1);
    return nextDates.length > 0 ? nextDates[0].toJSDate() : null;
  }

  /**
   * Получает последние запуски
   */
  async getRecentRuns(limit: number = 10): Promise<{
    id: string;
    status: string;
    createdAt: Date;
    completedAt: Date | null;
    durationMs: number | null;
    itemsUpdated: number;
    itemsFailed: number;
  }[]> {
    const jobs = await UpdateJobRepository.findRecent(limit);
    
    return jobs
      .filter(job => job.type === 'scheduled')
      .map(job => ({
        id: job.id,
        status: job.status,
        createdAt: job.created_at,
        completedAt: job.completed_at,
        durationMs: job.duration_ms,
        itemsUpdated: job.items_updated,
        itemsFailed: job.failed_items,
      }));
  }

  // ─── КОНФИГУРАЦИЯ ────────────────────────────────────────────

  /**
   * Устанавливает конфигурацию
   */
  setConfig(config: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Получает конфигурацию
   */
  getConfig(): SchedulerConfig {
    return { ...this.config };
  }

  // ─── HELPERS ──────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ═══════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════

let schedulerInstance: SchedulerImpl | null = null;

export function getScheduler(config?: Partial<SchedulerConfig>): SchedulerImpl {
  if (!schedulerInstance) {
    schedulerInstance = new SchedulerImpl(config);
  }
  return schedulerInstance;
}

export function resetScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stop();
    schedulerInstance = null;
  }
}

// Экспортируем класс для тестирования
export { SchedulerImpl };