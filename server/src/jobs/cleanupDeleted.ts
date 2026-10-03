/**
 * Периодическая очистка мягко-удалённых проектов (§15.2.0 ТЗ v1.1).
 *
 * Находит архивные проекты (deleted_at IS NOT NULL), заархивированные раньше
 * retention-периода (env ARCHIVE_RETENTION_DAYS, default 90 дней), и удаляет их
 * из БД насовсем через ProjectRepository.hardDelete (дети — по FK CASCADE,
 * аудит — внутри репозитория). Никакого raw-Knex вне repositories.
 *
 * Планировщик — `cron` (как в server/src/services/update/scheduler.ts):
 * раз в сутки + однократный прогон на старте. Ошибки (в т.ч. недоступная БД)
 * логируются, процесс не роняется.
 */

import { CronJob } from 'cron';
import { ProjectRepository } from '../db/repositories/project.repo.js';
import { winstonLogger } from '../middleware/logger.js';

const DEFAULT_RETENTION_DAYS = 90;
const CLEANUP_CRON = '0 3 * * *'; // раз в сутки в 03:00
const CRON_TIMEZONE = 'Europe/Moscow';

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Retention из env ARCHIVE_RETENTION_DAYS; нечисловое/неположительное значение —
 * warn и дефолт 90 (специально не валидируем жёстко: job не должен ронять старт).
 */
export function resolveRetentionDays(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.ARCHIVE_RETENTION_DAYS;
  if (raw === undefined || raw === '') return DEFAULT_RETENTION_DAYS;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    winstonLogger.warn('[CLEANUP] Invalid ARCHIVE_RETENTION_DAYS, using default', {
      value: raw,
      defaultDays: DEFAULT_RETENTION_DAYS,
    });
    return DEFAULT_RETENTION_DAYS;
  }
  return parsed;
}

export function getCutoffDate(retentionDays: number, now: number = Date.now()): Date {
  return new Date(now - retentionDays * DAY_MS);
}

/**
 * Один прогон очистки. Возвращает число фактически удалённых проектов.
 * Ошибку БД на выборке кандидатов ловим целиком; ошибку по конкретному
 * проекту — по-элементно, чтобы один битый кандидат не отменял остальные.
 */
export async function runCleanupDeleted(now: number = Date.now()): Promise<number> {
  const retentionDays = resolveRetentionDays();
  const cutoff = getCutoffDate(retentionDays, now);

  let candidates: { id: string; userId: string }[];
  try {
    candidates = await ProjectRepository.findArchivedOlderThan(cutoff);
  } catch (error) {
    // БД недоступна — логируем и выходим, процесс не роняем
    winstonLogger.error('[CLEANUP] Failed to list cleanup candidates', { error });
    return 0;
  }

  let cleaned = 0;
  for (const candidate of candidates) {
    try {
      const result = await ProjectRepository.hardDelete(candidate.id, candidate.userId);
      // 'not_archived' = проект восстановили между выборкой и удалением — пропускаем
      if (result.status === 'deleted') cleaned += 1;
    } catch (error) {
      winstonLogger.error('[CLEANUP] Failed to hard-delete project', {
        projectId: candidate.id,
        error,
      });
    }
  }

  winstonLogger.info(`[CLEANUP] cleaned ${cleaned} projects`, {
    candidates: candidates.length,
    retentionDays,
  });
  return cleaned;
}

let cronJob: CronJob | null = null;

/** Разовый прогон на старте — отдельной функцией, чтобы тесты звали напрямую. */
export function runInitialCleanup(): void {
  void runCleanupDeleted().catch(error => {
    // runCleanupDeleted не бросает; страховка от регрессии — чтобы прогон не убил старт
    winstonLogger.error('[CLEANUP] Initial run failed', { error });
  });
}

/** Запуск суточного расписания + однократного прогона на старте. Идемпотентен. */
export function startCleanupDeletedJob(): void {
  if (cronJob) return;

  try {
    cronJob = new CronJob(
      CLEANUP_CRON,
      () => {
        void runCleanupDeleted().catch(error => {
          winstonLogger.error('[CLEANUP] Scheduled run failed', { error });
        });
      },
      null,
      true,
      CRON_TIMEZONE,
    );
  } catch (error) {
    winstonLogger.error('[CLEANUP] Failed to start scheduler', { error });
    return;
  }

  winstonLogger.info('[CLEANUP] Scheduler started', {
    cron: CLEANUP_CRON,
    timezone: CRON_TIMEZONE,
  });
  runInitialCleanup();
}

export function stopCleanupDeletedJob(): void {
  if (!cronJob) return;
  cronJob.stop();
  cronJob = null;
  winstonLogger.info('[CLEANUP] Scheduler stopped');
}
