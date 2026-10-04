/**
 * apiClient — очередь запросов с rate limiting, ретраями на 429 (exponential backoff)
 * и проверка типа ошибки. Вынесено из apiStorageProvider (TASK-BATCH-012).
 */

import type { ProjectData } from '@shared/types';
import { ProjectsApiError } from '../projects';
import { RoomsApiError } from '../rooms';
import { logDebug, logError, logWarning } from '../../utils/logger';

/**
 * Элемент очереди запросов с rate limiting
 */
export interface QueuedRequest {
  execute: () => Promise<void>;
  retryCount: number;
  projectId?: string;
}

/**
 * Кэш проектов провайдера (Map + TTL). Абстракция над состоянием ApiStorageProvider,
 * чтобы модули projectApi/objectApi могли обновлять кэш без доступа к внутренностям класса.
 */
export interface ApiCache {
  values(): ProjectData[];
  set(id: string, project: ProjectData): void;
  delete(id: string): void;
  clear(): void;
  touchExpiry(): void;
}

/**
 * Контекст синхронизации: кэш + очередь. Передаётся в функции projectApi/objectApi.
 */
export interface ApiSyncContext {
  readonly cache: ApiCache;
  readonly queue: RequestQueue;
}

/**
 * Проверка на 429 ошибку (rate limit) от projects/rooms API
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof ProjectsApiError && error.statusCode === 429) {
    return true;
  }
  if (error instanceof RoomsApiError && error.statusCode === 429) {
    return true;
  }
  return false;
}

/**
 * Очередь запросов с rate limiting для предотвращения 429 ошибок.
 * Хранит множество удалённых проектов: запросы по ним пропускаются.
 */
export class RequestQueue {
  private requests: QueuedRequest[] = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private deletedProjects = new Set<string>();

  constructor(
    private readonly minInterval: number,
    private readonly maxRetries: number,
  ) {}

  /**
   * Добавление запроса в очередь с rate limiting
   */
  enqueue<T>(execute: () => Promise<T>, projectId?: string): Promise<T> {
    let resolvePromise: (value: T) => void;
    let rejectPromise: (error: Error) => void;

    const resultPromise = new Promise<T>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    const request: QueuedRequest = {
      execute: async () => {
        try {
          const result = await execute();
          resolvePromise!(result);
        } catch (error) {
          rejectPromise!(error instanceof Error ? error : new Error(String(error)));
          // Re-throw for processQueue error handling (retry logic)
          throw error;
        }
      },
      retryCount: 0,
      projectId,
    };

    this.requests.push(request);
    this.processQueue();

    return resultPromise;
  }

  /**
   * Отметка проекта как удаленный + очистка очереди от его запросов
   */
  markProjectDeleted(projectId: string): void {
    this.deletedProjects.add(projectId);
    this.requests = this.requests.filter(req => req.projectId !== projectId);
  }

  /**
   * Сброс кэша удаленных проектов
   */
  clearDeletedProjects(): void {
    this.deletedProjects.clear();
  }

  /**
   * Обработка очереди запросов
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requests.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.requests.length > 0) {
        const request = this.requests[0];

        // Проверяем, не удален ли проект
        if (request.projectId && this.deletedProjects.has(request.projectId)) {
          logDebug('ApiStorage', 'Пропуск запроса для удаленного проекта', {
            projectId: request.projectId,
          });
          this.requests.shift();
          continue;
        }

        // Rate limiting: ждем минимальный интервал между запросами
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.minInterval) {
          await new Promise(resolve =>
            setTimeout(resolve, this.minInterval - timeSinceLastRequest),
          );
        }

        try {
          this.lastRequestTime = Date.now();
          await request.execute();
          this.requests.shift();
        } catch (error) {
          // Обработка 429 ошибок с exponential backoff
          if (isRateLimitError(error) && request.retryCount < this.maxRetries) {
            request.retryCount++;
            const backoffDelay = Math.min(1000 * Math.pow(2, request.retryCount), 10000);
            logWarning(
              'ApiStorage',
              `Rate limit, повторная попытка ${request.retryCount}/${this.maxRetries} через ${backoffDelay}ms`,
            );

            // Не сдвигаем запрос, ждем и пробуем снова
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            // Продолжаем цикл с тем же запросом
          } else {
            // Максимум попыток исчерпан или другая ошибка
            this.requests.shift();
            // Reject уже был вызван внутри execute(), но логируем ошибку
            logError('ApiStorage', 'Ошибка запроса после всех попыток', error, {
              projectId: request.projectId,
            });
          }
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }
}
