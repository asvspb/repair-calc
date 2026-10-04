/**
 * Фасад репозиториев задач обновления.
 *
 * Реализация разнесена по внутренней связности:
 *  - `updateJob.types.ts`   — типы;
 *  - `updateJob.queries.ts` — чтение задач;
 *  - `updateJob.writes.ts`  — запись задач (lifecycle + прогресс);
 *  - `updateJob.items.ts`   — элементы и параметры задач;
 *  - `updateJob.cleanup.ts` — блокировки и логи.
 *
 * Публичный контракт (имена классов, типы, сигнатуры) сохранён — импортёры не правятся.
 */

import {
  createJob,
  findJobById,
  findJobs,
  findRecentJobs,
  findRunningJobs,
  getJobProgress,
  getJobStats,
} from './updateJob.queries.js';
import {
  cancelJob,
  completeJob,
  failJob,
  startJob,
  updateJobProgress,
} from './updateJob.writes.js';

export * from './updateJob.types.js';
export { UpdateJobItemRepository, UpdateJobParamRepository } from './updateJob.items.js';
export { UpdateJobLockRepository, UpdateLogRepository } from './updateJob.cleanup.js';

export class UpdateJobRepository {
  static create = createJob;
  static findById = findJobById;
  static findMany = findJobs;
  static findRunning = findRunningJobs;
  static findRecent = findRecentJobs;
  static start = startJob;
  static complete = completeJob;
  static fail = failJob;
  static cancel = cancelJob;
  static updateProgress = updateJobProgress;
  static getProgress = getJobProgress;
  static getStats = getJobStats;
}
