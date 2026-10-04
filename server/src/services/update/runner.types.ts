import type { PriceCatalog } from '../../db/repositories/priceCatalog.repo.js';
import type { PriceCategory, SourceType } from '../../db/repositories/priceCatalog.repo.js';
import type { JobPriority } from './utils/priority.js';

// ═══════════════════════════════════════════════════════
// ТИПЫ RUNNER'А (вынесено из runner.ts)
// ═══════════════════════════════════════════════════════

export interface RunnerConfig {
  batchSize: number; // Размер батча (по умолчанию 10)
  concurrentRequests: number; // Параллельные запросы (по умолчанию 5)
  requestDelayMs: number; // Задержка между запросами (500ms)
  cacheEnabled: boolean; // Включить кэш
  cacheTtlMs: number; // Время жизни кэша (1 час)
  anomalyDetectionEnabled: boolean;
  anomalyThresholdPercent: number; // Порог аномалии (100%)
  lockTtlMs: number; // Время жизни блокировки (5 минут)
}

export const defaultConfig: RunnerConfig = {
  batchSize: 10,
  concurrentRequests: 5,
  requestDelayMs: 500,
  cacheEnabled: true,
  cacheTtlMs: 3600000, // 1 час
  anomalyDetectionEnabled: true,
  anomalyThresholdPercent: 100,
  lockTtlMs: 300000, // 5 минут
};

export interface RunOptions {
  city?: string;
  categories?: PriceCategory[];
  sources?: SourceType[];
  force?: boolean;
  triggeredBy?: string;
  priority?: JobPriority; // Приоритет задачи: 'high' | 'normal' | 'low'
}

export interface ItemToUpdate {
  name: string;
  category: PriceCategory;
  city: string;
  unit?: string;
  existingPrice?: PriceCatalog;
}
