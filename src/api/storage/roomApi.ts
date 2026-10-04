/**
 * roomApi — синхронизация комнат проекта с сервером и трекинг ошибок синхронизации.
 * Вынесено из apiStorageProvider (TASK-BATCH-012).
 */

import type { ProjectData, RoomData } from '@shared/types';
import * as roomsApi from '../rooms';
import { getAllRooms } from '../../utils/projectObjects';
import { isServerId as isServerIdUtil } from '../../utils/idMapper';
import { logDebug, logError, logWarning } from '../../utils/logger';
import { isRateLimitError } from './apiClient';
import type { ApiSyncContext } from './apiClient';

export type RoomSyncErrorMap = Map<string, { error: Error; timestamp: number }>;

/**
 * Трекер ошибок синхронизации комнат (ключ: `${projectId}:${roomId}`)
 */
export class RoomSyncErrors {
  private errors: RoomSyncErrorMap = new Map();

  snapshot(): RoomSyncErrorMap {
    return new Map(this.errors);
  }

  clear(): void {
    this.errors.clear();
  }

  record(key: string, error: Error): void {
    this.errors.set(key, { error, timestamp: Date.now() });
  }

  remove(key: string): void {
    this.errors.delete(key);
  }
}

/**
 * Синхронизация комнат проекта с debounce для предотвращения rate limiting.
 * Возвращает массив ошибок для комнат, которые не удалось синхронизировать.
 */
export async function syncProjectRooms(
  ctx: ApiSyncContext,
  tracker: RoomSyncErrors,
  project: ProjectData,
  existingProjects: ProjectData[],
): Promise<Error[]> {
  const serverProject = existingProjects.find(p => p.id === project.id);
  const allRooms = getAllRooms(project);
  const serverRooms = serverProject ? getAllRooms(serverProject) : [];
  const existingRoomIds = new Set(serverRooms.map(r => r.id));
  const errors: Error[] = [];

  // Синхронизируем комнаты последовательно с rate limiting
  for (const room of allRooms) {
    await syncRoom(ctx, tracker, project, room, existingRoomIds, errors);
  }

  return errors;
}

async function syncRoom(
  ctx: ApiSyncContext,
  tracker: RoomSyncErrors,
  project: ProjectData,
  room: RoomData,
  existingRoomIds: Set<string>,
  errors: Error[],
): Promise<void> {
  const errorKey = `${project.id}:${room.id}`;
  const roomExistsOnServer = isServerIdUtil(room.id) && existingRoomIds.has(room.id);

  try {
    if (roomExistsOnServer) {
      await ctx.queue.enqueue(() => roomsApi.updateRoom(room.id, room), project.id);
      logDebug('ApiStorage', 'Комната обновлена', { roomId: room.id });
      // Clear any previous error for this room
      tracker.remove(errorKey);
    } else {
      await ctx.queue.enqueue(() => roomsApi.createRoom(project.id, room), project.id);
      logDebug('ApiStorage', 'Комната создана', { roomId: room.id, projectId: project.id });
      // Clear any previous error for this room
      tracker.remove(errorKey);
    }
  } catch (roomError) {
    // Игнорируем 429 ошибки для комнат - они будут обработаны retry logic
    if (isRateLimitError(roomError)) {
      logWarning('ApiStorage', 'Room sync rate limited, will retry', { roomId: room.id });
      // Не считаем 429 ошибкой, будет повторная попытка
    } else {
      const error = roomError instanceof Error ? roomError : new Error(String(roomError));
      logError('ApiStorage', 'Ошибка синхронизации комнаты', error, { roomId: room.id });
      // Сохраняем ошибку для последующего уведомления
      tracker.record(errorKey, error);
      errors.push(error);
    }
  }
}
