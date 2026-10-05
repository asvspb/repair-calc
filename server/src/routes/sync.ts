import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { syncPushSchema } from '../middleware/validation.js';
import { ProjectRepository } from '../db/repositories/project.repo.js';
import { processSyncPush } from '../services/sync-v2.service.js';
import type { AuthRequest } from '../types/index.js';
import { winstonLogger } from '../middleware/logger.js';

const router = Router();

// Middleware для детального логирования всех запросов
router.use((req, res, next) => {
  const userId = (req as AuthRequest).user?.id || 'ANONYMOUS';

  winstonLogger.info(`SYNC API ${req.method} ${req.path}`, {
    userId,
    body:
      req.method !== 'GET' && req.body && Object.keys(req.body).length > 0
        ? JSON.stringify(req.body).substring(0, 1000)
        : undefined,
  });

  next();
});

router.use(authenticate);

/**
 * POST /api/sync/push - Push local changes to server
 * SYNC-V2 (спека §3.4): LWW/push-логика в services/sync-v2.service.ts;
 * роут — валидация → сервис → ответ.
 */
router.post('/push', async (req: AuthRequest, res, next) => {
  const userId = req.user!.id;
  const startTime = Date.now();

  try {
    const { changes } = syncPushSchema.parse(req.body);

    winstonLogger.info('[SYNC/PUSH] Начало синхронизации', { changesCount: changes.length });

    const { synced, conflicts } = await processSyncPush(userId, changes);

    const duration = Date.now() - startTime;
    winstonLogger.info('[SYNC/PUSH] Завершено', {
      duration,
      synced: synced.length,
      conflicts: conflicts.length,
    });

    res.json({
      status: 'success',
      data: {
        synced,
        conflicts,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    winstonLogger.error('[SYNC/PUSH] Ошибка', { duration, error });
    next(error);
  }
});

// GET /api/sync/pull - Pull changes from server
// SYNC-V2 (спека §4): `?since=<ISO>` — инкрементальный pull, возвращаются только
// сущности с updated_at >= since (неизменённые проекты не отдаются). Без `since` —
// полный pull как сегодня (обратная совместимость со старым клиентом).
router.get('/pull', async (req: AuthRequest, res, next) => {
  const userId = req.user!.id;
  const startTime = Date.now();

  try {
    const sinceParam = typeof req.query.since === 'string' ? req.query.since : undefined;
    let sinceMs: number | null = null;
    if (sinceParam) {
      const parsed = new Date(sinceParam).getTime();
      sinceMs = Number.isNaN(parsed) ? null : parsed;
      if (sinceMs === null) {
        winstonLogger.warn('[SYNC/PULL] Некорректный since — выполняется полный pull', {
          since: sinceParam,
        });
      }
    }

    winstonLogger.info('[SYNC/PULL] Загрузка данных', { userId, since: sinceParam ?? null });

    // Get all projects for user with objects
    const allProjects = await ProjectRepository.findAllByUserIdWithObjects(userId);

    let projects = allProjects;
    if (sinceMs !== null) {
      projects = allProjects
        .map(project => {
          const objects = (project.objects ?? [])
            .map(obj => {
              const rooms = (obj.rooms ?? []).filter(
                room => new Date(room.updated_at).getTime() >= sinceMs!,
              );
              const objectChanged = new Date(obj.updated_at).getTime() >= sinceMs!;
              if (!objectChanged && rooms.length === 0) return null;
              return { ...obj, rooms };
            })
            .filter((obj): obj is NonNullable<typeof obj> => obj !== null);
          const projectChanged = new Date(project.updated_at).getTime() >= sinceMs!;
          if (!projectChanged && objects.length === 0) return null;
          return { ...project, objects };
        })
        .filter((project): project is NonNullable<typeof project> => project !== null);
    }

    // Подробное логирование каждого проекта
    winstonLogger.info('[SYNC/PULL] Найдено проектов', { count: projects.length });

    for (const project of projects) {
      const totalRooms =
        project.objects?.reduce((sum, obj) => sum + (obj.rooms?.length || 0), 0) || 0;
      winstonLogger.info('[SYNC/PULL] Проект', {
        id: project.id,
        name: project.name,
        city: project.city || null,
        objectsCount: project.objects?.length || 0,
        roomsCount: totalRooms,
      });
    }

    const response = {
      status: 'success',
      data: {
        projects,
        timestamp: Date.now(),
      },
    };

    const duration = Date.now() - startTime;
    winstonLogger.info('[SYNC/PULL] Завершено', { duration, projectsCount: projects.length });

    res.json(response);
  } catch (error) {
    const duration = Date.now() - startTime;
    winstonLogger.error('[SYNC/PULL] Ошибка', { duration, error });
    next(error);
  }
});

export default router;
