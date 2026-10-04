import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { syncPushSchema } from '../middleware/validation.js';
import { ProjectRepository } from '../db/repositories/project.repo.js';
import { ObjectRepository } from '../db/repositories/object.repo.js';
import { RoomRepository } from '../db/repositories/room.repo.js';
import type {
  AuthRequest,
  Conflict,
  ChangeLogEntry,
  Room,
  Project,
  DbObject,
} from '../types/index.js';
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
 * LWW-сравнение SYNC-V2 (спека §3.1, §3.2, решение §6.1 пп.1-2).
 * Авторитет — серверное `updated_at`; `clientUpdatedAt` — информационно/tie-break.
 * При равенстве меток побеждает запись с бóльшим лексикографически `id`;
 * при равных `id` (одна и та же сущность — обычный случай push/pull) — серверная сторона.
 *
 * @returns 'conflict' — сервер новее (клиентская копия должна быть затёрта);
 *          'client' — клиентская запись не старее серверной (принять/оставить локальную).
 */
export function lwwCompare(
  serverUpdatedAt: Date | string | null | undefined,
  clientUpdatedAt: string | undefined,
  serverId: string,
  clientId: string,
): 'server' | 'client' {
  if (!clientUpdatedAt) {
    // Нет клиентской метки (старый клиент/новая сущность) — сравнивать нечем, принимаем
    return 'client';
  }

  const serverMs = new Date(serverUpdatedAt ?? 0).getTime();
  const clientMs = new Date(clientUpdatedAt).getTime();

  if (Number.isNaN(serverMs) || Number.isNaN(clientMs)) return 'client';
  if (clientMs > serverMs) return 'client';
  if (clientMs < serverMs) return 'server';
  // Ничья по времени: побеждает больший лексикографически id; при равных id — сервер.
  return clientId > serverId ? 'client' : 'server';
}

/** Расширенный результат конфликта §3.3: серверная версия целиком для LWW-слияния */
interface SyncConflict extends Conflict {
  serverUpdatedAt?: string;
  serverEntity?: unknown;
}

function toIso(value: Date | string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/**
 * POST /api/sync/push - Push local changes to server
 * SYNC-V2 (спека §3.4): конфликтность определяется сравнением `data.clientUpdatedAt`
 * против `updated_at` строки (LWW + tie-break §3.2), а не `version`.
 */
router.post('/push', async (req: AuthRequest, res, next) => {
  const userId = req.user!.id;
  const startTime = Date.now();

  try {
    const { changes } = syncPushSchema.parse(req.body);

    winstonLogger.info('[SYNC/PUSH] Начало синхронизации', { changesCount: changes.length });

    const synced: string[] = [];
    const conflicts: SyncConflict[] = [];

    // Process each change
    for (const change of changes) {
      try {
        const changeData = change as ChangeLogEntry & { id: string };
        const { id, entityId, data, timestamp: _timestamp } = changeData;
        // ChangeLogEntry.entity не знает 'object' — сравнение по строке (спека §3.4)
        const entity = changeData.entity as string;
        const clientUpdatedAt = (data as { clientUpdatedAt?: string })?.clientUpdatedAt;
        const roomData = data as Partial<Room>;
        const objectData = data as { name?: string; city?: string; sort_order?: number };
        const projectData = data as { name?: string; city?: string; use_ai_pricing?: boolean };

        if (entity === 'project') {
          winstonLogger.info('[SYNC/PUSH] Проект', {
            entityId,
            name: projectData.name || 'N/A',
            city: projectData.city || null,
          });

          const serverProject = await ProjectRepository.findByIdAndUserId(entityId, userId);

          if (!serverProject) {
            // Локально новая сущность (в т.ч. local-* ID) — создаём на сервере (спека §3.4)
            const created = await ProjectRepository.create(userId, {
              name: projectData.name ?? 'Без названия',
              city: projectData.city ?? undefined,
              use_ai_pricing: projectData.use_ai_pricing ?? false,
            });
            synced.push(id);
            winstonLogger.info('[SYNC/PUSH] Проект создан (upsert)', {
              entityId,
              serverId: created.id,
            });
            continue;
          }

          if (
            lwwCompare(serverProject.updated_at, clientUpdatedAt, serverProject.id, entityId) ===
            'server'
          ) {
            winstonLogger.warn('[SYNC/PUSH] Конфликт LWW (сервер новее)', {
              entityId,
              clientUpdatedAt,
            });
            conflicts.push({
              id,
              entity,
              entityId,
              serverVersion: serverProject.version,
              clientVersion: 0,
              serverUpdatedAt: toIso(serverProject.updated_at),
              serverEntity: serverProject,
            });
            continue;
          }

          const updateData: Partial<Project> = {};
          if (projectData.name !== undefined) updateData.name = projectData.name;
          if (projectData.city !== undefined) updateData.city = projectData.city;
          if (projectData.use_ai_pricing !== undefined)
            updateData.use_ai_pricing = projectData.use_ai_pricing;

          await ProjectRepository.update(entityId, updateData);
          synced.push(id);
          winstonLogger.info('[SYNC/PUSH] Проект обновлён', { entityId });
        } else if (entity === 'object') {
          winstonLogger.info('[SYNC/PUSH] Объект', { entityId, name: objectData.name || 'N/A' });

          const serverObject = await ObjectRepository.findByIdAndUserId(entityId, userId);

          if (!serverObject) {
            // Upsert-новый: требуется существующий проект владельца
            const projectId = (data as { project_id?: string }).project_id;
            if (!projectId) {
              winstonLogger.error('[SYNC/PUSH] Нет project_id для объекта', { entityId });
              throw new Error('project_id is required for object creation');
            }
            const project = await ProjectRepository.findByIdAndUserId(projectId, userId);
            if (!project) {
              winstonLogger.warn('[SYNC/PUSH] Проект объекта не найден', { entityId, projectId });
              conflicts.push({
                id,
                entity,
                entityId,
                serverVersion: 0,
                clientVersion: 0,
              });
              continue;
            }
            const created = await ObjectRepository.create(projectId, userId, {
              name: objectData.name ?? 'Без названия',
              city: objectData.city ?? null,
            });
            synced.push(id);
            winstonLogger.info('[SYNC/PUSH] Объект создан (upsert)', {
              entityId,
              serverId: created.id,
            });
            continue;
          }

          if (
            lwwCompare(serverObject.updated_at, clientUpdatedAt, serverObject.id, entityId) ===
            'server'
          ) {
            winstonLogger.warn('[SYNC/PUSH] Конфликт LWW объекта (сервер новее)', {
              entityId,
              clientUpdatedAt,
            });
            conflicts.push({
              id,
              entity,
              entityId,
              serverVersion: serverObject.version,
              clientVersion: 0,
              serverUpdatedAt: toIso(serverObject.updated_at),
              serverEntity: serverObject,
            });
            continue;
          }

          const updateData: Partial<DbObject> = {};
          if (objectData.name !== undefined) updateData.name = objectData.name;
          if (objectData.city !== undefined) updateData.city = objectData.city;
          if (objectData.sort_order !== undefined) updateData.sort_order = objectData.sort_order;

          await ObjectRepository.update(entityId, updateData);
          synced.push(id);
          winstonLogger.info('[SYNC/PUSH] Объект обновлён', { entityId });
        } else if (entity === 'room') {
          winstonLogger.info('[SYNC/PUSH] Комната', {
            entityId,
            name: roomData.name || 'N/A',
            dimensions: `${roomData.length}×${roomData.width}×${roomData.height}`,
          });

          const serverRoom = await RoomRepository.findById(entityId);

          if (!serverRoom) {
            if (!roomData.object_id) {
              winstonLogger.error('[SYNC/PUSH] Нет project_id для комнаты', { entityId });
              throw new Error('project_id is required for room creation');
            }
            const roomId = await RoomRepository.create(roomData.object_id, roomData);
            synced.push(id);
            winstonLogger.info('[SYNC/PUSH] Комната создана', { roomId: roomId.id });
            continue;
          }

          const project = await ObjectRepository.findByIdAndUserId(serverRoom.object_id, userId);
          if (!project) {
            winstonLogger.warn('[SYNC/PUSH] Проект комнаты не найден', { entityId });
            conflicts.push({
              id,
              entity,
              entityId,
              serverVersion: 0,
              clientVersion: 0,
            });
            continue;
          }

          if (
            lwwCompare(serverRoom.updated_at, clientUpdatedAt, serverRoom.id, entityId) === 'server'
          ) {
            winstonLogger.warn('[SYNC/PUSH] Конфликт LWW комнаты (сервер новее)', {
              entityId,
              clientUpdatedAt,
            });
            conflicts.push({
              id,
              entity,
              entityId,
              serverVersion: serverRoom.version ?? 0,
              clientVersion: 0,
              serverUpdatedAt: toIso(serverRoom.updated_at),
              serverEntity: serverRoom,
            });
            continue;
          }

          const updateData: Partial<Room> = {};
          if (roomData.name !== undefined) updateData.name = roomData.name;
          if (roomData.geometry_mode !== undefined)
            updateData.geometry_mode = roomData.geometry_mode;
          if (roomData.length !== undefined) updateData.length = roomData.length;
          if (roomData.width !== undefined) updateData.width = roomData.width;
          if (roomData.height !== undefined) updateData.height = roomData.height;
          if (roomData.segments !== undefined) updateData.segments = roomData.segments;
          if (roomData.obstacles !== undefined) updateData.obstacles = roomData.obstacles;
          if (roomData.wall_sections !== undefined)
            updateData.wall_sections = roomData.wall_sections;
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
          clientVersion: 0,
        });
      }
    }

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
