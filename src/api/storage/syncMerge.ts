/**
 * syncMerge — LWW-слияние pull-результата с локальным деревом (спека SPEC-SYNC-V2
 * §3.1, §3.2, §3.3; batch (в)).
 *
 * Правила для каждой сущности (project → object → room):
 *  - локальная не dirty → принимается серверная версия безусловно;
 *  - локальная dirty и local.updatedAt > server.updatedAt → остаётся локальная,
 *    dirty не снимается (уйдёт пушем);
 *  - локальная dirty и local.updatedAt <= server.updatedAt → LWW: сервер затирает
 *    локальную, dirty снимается, конфликт логируется и увеличивает conflictsResolved;
 *  - сущность удалена на сервере: локальная не dirty → удаляется локально;
 *    локальная dirty → остаётся и пересоздаётся пушем (без tombstones, §6.1 п.4).
 *
 * Tie-break (§3.2): при равенстве updatedAt побеждает больший лексикографически id;
 * id совпадают (та же сущность) → серверная сторона.
 */

import type { ObjectData, ProjectData, RoomData } from '@shared/types';
import type { DirtyEntityKind, DirtyMap } from '../../store/types';
import { logWarning } from '../../utils/logger';

/** Результат слияния pull-результата (§3.1) */
export interface SyncMergeResult {
  /** Слитое дерево проектов */
  projects: ProjectData[];
  /** Сущности, снятые с dirty (сервер затёр локальную версию) */
  resolvedDirty: Array<{ entityKind: DirtyEntityKind; entityId: string }>;
  /** Локально удалённые сущности (не dirty, отсутствуют на сервере — §3.3) */
  deletedLocally: Array<{ entityKind: DirtyEntityKind; entityId: string }>;
  /** Число LWW-конфликтов, разрешённых в пользу сервера (счётчик §3.1) */
  conflictsResolved: number;
}

/**
 * Выбор победителя LWW (§3.1 + tie-break §3.2). Серверная сторона побеждает
 * при равенстве меток, если id тоже равны (обычный случай: та же сущность).
 */
export function serverWinsLww(
  localUpdatedAt: string | undefined,
  serverUpdatedAt: string | undefined,
  localId: string,
  serverId: string,
): boolean {
  const localMs = new Date(localUpdatedAt ?? 0).getTime();
  const serverMs = new Date(serverUpdatedAt ?? 0).getTime();
  if (Number.isNaN(localMs) || Number.isNaN(serverMs)) return true;
  if (localMs > serverMs) return false;
  if (localMs < serverMs) return true;
  return localId <= serverId;
}

interface ResolvedEntities {
  resolvedDirty: Array<{ entityKind: DirtyEntityKind; entityId: string }>;
  deletedLocally: Array<{ entityKind: DirtyEntityKind; entityId: string }>;
  conflictsResolved: number;
}

function mergeRooms(
  serverRooms: RoomData[],
  localRooms: RoomData[],
  dirty: DirtyMap,
  acc: ResolvedEntities,
): RoomData[] {
  const byId = new Map<string, RoomData>();
  for (const room of serverRooms) byId.set(room.id, room);
  for (const room of localRooms) if (!byId.has(room.id)) byId.set(room.id, room);

  const merged: RoomData[] = [];
  for (const id of byId.keys()) {
    const serverRoom = serverRooms.find(r => r.id === id);
    const localRoom = localRooms.find(r => r.id === id);

    if (serverRoom && localRoom) {
      const isDirty = Boolean(dirty.room[id]);
      if (
        !isDirty ||
        serverWinsLww(localRoom.updatedAt, serverRoom.updatedAt, localRoom.id, serverRoom.id)
      ) {
        if (isDirty) {
          acc.conflictsResolved += 1;
          logWarning('SyncMerge', 'LWW: серверная версия комнаты затёрла локальную', {
            roomId: id,
            localUpdatedAt: localRoom.updatedAt,
            serverUpdatedAt: serverRoom.updatedAt,
          });
          acc.resolvedDirty.push({ entityKind: 'room', entityId: id });
        }
        merged.push(serverRoom);
      } else {
        merged.push(localRoom);
      }
    } else if (serverRoom) {
      merged.push(serverRoom);
    } else if (localRoom) {
      // §3.3: удалена на сервере
      if (dirty.room[id]) {
        // dirty — остаётся и пересоздаётся пушем
        merged.push(localRoom);
      } else {
        acc.deletedLocally.push({ entityKind: 'room', entityId: id });
      }
    }
  }
  return merged;
}

function mergeObjects(
  serverObjects: ObjectData[],
  localObjects: ObjectData[],
  dirty: DirtyMap,
  acc: ResolvedEntities,
): ObjectData[] {
  const byId = new Map<string, ObjectData>();
  for (const obj of serverObjects) byId.set(obj.id, obj);
  for (const obj of localObjects) if (!byId.has(obj.id)) byId.set(obj.id, obj);

  const merged: ObjectData[] = [];
  for (const id of byId.keys()) {
    const serverObj = serverObjects.find(o => o.id === id);
    const localObj = localObjects.find(o => o.id === id);

    let chosen: ObjectData;
    let chooseServer: boolean;
    if (serverObj && localObj) {
      const isDirty = Boolean(dirty.object[id]);
      chooseServer =
        !isDirty ||
        serverWinsLww(localObj.updatedAt, serverObj.updatedAt, localObj.id, serverObj.id);
      if (isDirty && chooseServer) {
        acc.conflictsResolved += 1;
        logWarning('SyncMerge', 'LWW: серверная версия объекта затёрла локальную', {
          objectId: id,
          localUpdatedAt: localObj.updatedAt,
          serverUpdatedAt: serverObj.updatedAt,
        });
        acc.resolvedDirty.push({ entityKind: 'object', entityId: id });
      }
      chosen = chooseServer ? serverObj : localObj;
    } else if (serverObj) {
      chosen = serverObj;
    } else if (localObj) {
      if (dirty.object[id]) {
        chosen = localObj; // dirty — пересоздаётся пушем (§3.3)
      } else {
        acc.deletedLocally.push({ entityKind: 'object', entityId: id });
        continue;
      }
    } else {
      continue;
    }

    const serverRooms = serverObj?.rooms ?? [];
    const localRooms = localObj?.rooms ?? [];
    chosen = { ...chosen, rooms: mergeRooms(serverRooms, localRooms, dirty, acc) };
    merged.push(chosen);
  }
  return merged;
}

/**
 * Слияние полного/инкрементального pull-результата с локальным деревом (§3.1, §3.3).
 * Чистая функция: локальное дерево и dirty-карта не мутируются.
 */
export function mergePull(
  serverProjects: ProjectData[],
  localProjects: ProjectData[],
  dirty: DirtyMap,
): SyncMergeResult {
  const acc: ResolvedEntities = { resolvedDirty: [], deletedLocally: [], conflictsResolved: 0 };

  const localById = new Map(localProjects.map(p => [p.id, p]));
  const serverIds = new Set(serverProjects.map(p => p.id));

  const merged: ProjectData[] = [];

  for (const serverProject of serverProjects) {
    const localProject = localById.get(serverProject.id);
    const isDirty = Boolean(dirty.project[serverProject.id]);

    let chosen: ProjectData = serverProject;
    if (localProject && isDirty) {
      if (
        serverWinsLww(
          localProject.updatedAt,
          serverProject.updatedAt,
          localProject.id,
          serverProject.id,
        )
      ) {
        acc.conflictsResolved += 1;
        logWarning('SyncMerge', 'LWW: серверная версия проекта затёрла локальную', {
          projectId: serverProject.id,
          localUpdatedAt: localProject.updatedAt,
          serverUpdatedAt: serverProject.updatedAt,
        });
        acc.resolvedDirty.push({ entityKind: 'project', entityId: serverProject.id });
      } else {
        chosen = localProject;
      }
    }

    const serverObjects = serverProject.objects ?? [];
    const localObjects = localProject?.objects ?? [];
    merged.push({
      ...chosen,
      objects: mergeObjects(serverObjects, localObjects, dirty, acc),
    });
  }

  // Проекты, отсутствующие в pull (удалены на сервере или отфильтрованы since)
  for (const localProject of localProjects) {
    if (serverIds.has(localProject.id)) continue;
    if (dirty.project[localProject.id]) {
      // dirty — сохранение данных важнее удаления с другого устройства (§3.3)
      merged.push(localProject);
    } else {
      acc.deletedLocally.push({ entityKind: 'project', entityId: localProject.id });
    }
  }

  return {
    projects: merged,
    resolvedDirty: acc.resolvedDirty,
    deletedLocally: acc.deletedLocally,
    conflictsResolved: acc.conflictsResolved,
  };
}
