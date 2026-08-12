import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { syncPushSchema } from '../middleware/validation.js';
import { ProjectRepository } from '../db/repositories/project.repo.js';
import { ObjectRepository } from '../db/repositories/object.repo.js';
import { RoomRepository } from '../db/repositories/room.repo.js';
import type { AuthRequest, Conflict, ChangeLogEntry, Room } from '../types/index.js';
import { winstonLogger } from '../middleware/logger.js';

const router = Router();

// Middleware для детального логирования всех запросов
router.use((req, res, next) => {
  const userId = (req as AuthRequest).user?.id || 'ANONYMOUS';
  
  winstonLogger.info(`SYNC API ${req.method} ${req.path}`, {
    userId,
    body: req.method !== 'GET' && req.body && Object.keys(req.body).length > 0
      ? JSON.stringify(req.body).substring(0, 1000)
      : undefined,
  });
  
  next();
});

router.use(authenticate);

/**
 * POST /api/sync/push - Push local changes to server
 * Implements last-write-wins conflict resolution with version checking
 */
router.post('/push', async (req: AuthRequest, res, next) => {
  const userId = req.user!.id;
  const startTime = Date.now();
  
  try {
    const { changes } = syncPushSchema.parse(req.body);
    
    winstonLogger.info('[SYNC/PUSH] Начало синхронизации', { changesCount: changes.length });
    
    const synced: string[] = [];
    const conflicts: Conflict[] = [];

    // Process each change
    for (const change of changes) {
      try {
        const changeData = change as ChangeLogEntry & { id: string };
        const { id, entity, entityId, data, timestamp: _timestamp } = changeData;
        const clientVersion = (data as { version?: number })?.version ?? 0;
        const roomData = data as Partial<Room>;
        const projectData = data as { name?: string; city?: string; use_ai_pricing?: boolean };

        if (entity === 'project') {
          winstonLogger.info('[SYNC/PUSH] Проект', { entityId, name: projectData.name || 'N/A', city: projectData.city || null });
          
          const serverProject = await ObjectRepository.findByIdAndUserId(entityId, userId);

          if (!serverProject) {
            winstonLogger.warn('[SYNC/PUSH] Проект не найден на сервере', { entityId });
            conflicts.push({
              id,
              entity: 'project',
              entityId,
              serverVersion: 0,
              clientVersion,
            });
            continue;
          }

          const serverVersion = serverProject.version;
          
          if (clientVersion && clientVersion < serverVersion) {
            winstonLogger.warn('[SYNC/PUSH] Конфликт версий', { entityId, clientVersion, serverVersion });
            conflicts.push({
              id,
              entity: 'project',
              entityId,
              serverVersion,
              clientVersion,
            });
            continue;
          }

          const updateData: Partial<typeof serverProject> = {};
          if (projectData.name !== undefined) updateData.name = projectData.name;
          if (projectData.city !== undefined) updateData.city = projectData.city;
          if (projectData.use_ai_pricing !== undefined) updateData.use_ai_pricing = projectData.use_ai_pricing;

          await ProjectRepository.update(entityId, updateData);
          synced.push(id);
          winstonLogger.info('[SYNC/PUSH] Проект обновлён', { entityId });
          
        } else if (entity === 'room') {
          winstonLogger.info('[SYNC/PUSH] Комната', { entityId, name: roomData.name || 'N/A', dimensions: `${roomData.length}×${roomData.width}×${roomData.height}` });
          
          const serverRoom = await RoomRepository.findById(entityId);

          if (!serverRoom) {
            if (!roomData.object_id) {
              winstonLogger.error('[SYNC/PUSH] Нет project_id для комнаты', { entityId });
              throw new Error('project_id is required for room creation');
            }
            const roomId = await RoomRepository.create(roomData.object_id, roomData);
            synced.push(roomId.id);
            winstonLogger.info('[SYNC/PUSH] Комната создана', { roomId: roomId.id });
            continue;
          }

          const project = await ObjectRepository.findByIdAndUserId(serverRoom.object_id, userId);
          if (!project) {
            winstonLogger.warn('[SYNC/PUSH] Проект комнаты не найден', { entityId });
            conflicts.push({
              id,
              entity: 'room',
              entityId,
              serverVersion: 0,
              clientVersion,
            });
            continue;
          }

          const serverVersion = serverRoom.version ?? 0;
          if (clientVersion && clientVersion < serverVersion) {
            winstonLogger.warn('[SYNC/PUSH] Конфликт версий комнаты', { entityId });
            conflicts.push({
              id,
              entity: 'room',
              entityId,
              serverVersion,
              clientVersion,
            });
            continue;
          }

          const updateData: Partial<typeof serverRoom> = {};
          if (roomData.name !== undefined) updateData.name = roomData.name;
          if (roomData.geometry_mode !== undefined) updateData.geometry_mode = roomData.geometry_mode;
          if (roomData.length !== undefined) updateData.length = roomData.length;
          if (roomData.width !== undefined) updateData.width = roomData.width;
          if (roomData.height !== undefined) updateData.height = roomData.height;
          if (roomData.segments !== undefined) updateData.segments = roomData.segments;
          if (roomData.obstacles !== undefined) updateData.obstacles = roomData.obstacles;
          if (roomData.wall_sections !== undefined) updateData.wall_sections = roomData.wall_sections;
          if (roomData.sub_sections !== undefined) updateData.sub_sections = roomData.sub_sections;
          if (roomData.windows !== undefined) updateData.windows = roomData.windows;
          if (roomData.doors !== undefined) updateData.doors = roomData.doors;
          if (roomData.works !== undefined) updateData.works = roomData.works;

          await RoomRepository.update(entityId, updateData);
          synced.push(id);
          winstonLogger.info('[SYNC/PUSH] Комната обновлена', { entityId });
          
        }
      } catch (error) {
        winstonLogger.error('[SYNC/PUSH] Ошибка обработки изменения', { error });
        conflicts.push({
          id: change.id,
          entity: change.entity,
          entityId: change.entityId,
          serverVersion: 0,
          clientVersion: (change.data as { version?: number })?.version ?? 0,
        });
      }
    }

    const duration = Date.now() - startTime;
    winstonLogger.info('[SYNC/PUSH] Завершено', { duration, synced: synced.length, conflicts: conflicts.length });

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
router.get('/pull', async (req: AuthRequest, res, next) => {
  const userId = req.user!.id;
  const startTime = Date.now();

  try {
    winstonLogger.info('[SYNC/PULL] Загрузка данных', { userId });

    // Get all projects for user with objects
    const projects = await ProjectRepository.findAllByUserIdWithObjects(userId);

    // Подробное логирование каждого проекта
    winstonLogger.info('[SYNC/PULL] Найдено проектов', { count: projects.length });

    for (const project of projects) {
      const totalRooms = project.objects?.reduce((sum, obj) => sum + (obj.rooms?.length || 0), 0) || 0;
      winstonLogger.info('[SYNC/PULL] Проект', {
        id: project.id, name: project.name, city: project.city || null,
        objectsCount: project.objects?.length || 0, roomsCount: totalRooms,
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
