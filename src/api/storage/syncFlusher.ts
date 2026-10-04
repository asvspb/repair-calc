/**
 * syncFlusher — исходящая очередь SYNC-V2 (спека SPEC-SYNC-V2 §2.2, §2.3, batch (б)).
 *
 * Один флашер на приложение: транспорт — RequestQueue (rate-limit 500 мс,
 * ретраи 429 c backoff); персистентность — Dexie syncState (batch (а)).
 * Триггеры: `online`, интервал 30 с, debounce 2 с после мутации.
 * Порядок: parent-before-child (project → object → room); дедуп — на уровне
 * dirty-карты. Под флагом VITE_SYNC_V2 по умолчанию не активен (спека §4).
 */

import type { ObjectData, ProjectData, RoomData } from '@shared/types';
import type { DirtyEntityKind, DirtyMap } from '../../store/types';
import { isServerId } from '../../utils/idMapper';
import { logDebug, logError, logWarning } from '../../utils/logger';
import { RequestQueue, isRateLimitError } from './apiClient';
import { ProjectsApiError } from '../projects';
import { clientToApiRoom } from '../rooms';
import { syncPush } from '../sync';
import type { SyncPushChange } from '../sync';

/** Размер пачки на один POST /api/sync/push (спека §2.2) */
export const FLUSH_BATCH_SIZE = 50;
/** Интервал фона (спека §2.3 п.2 — константа модуля, не env) */
export const FLUSH_INTERVAL_MS = 30000;
/** Debounce после мутации (спека §2.3 п.3 — наследует SAVE_DEBOUNCE_MS) */
export const FLUSH_DEBOUNCE_MS = 2000;

const MIN_REQUEST_INTERVAL = 500;
const MAX_RETRIES = 3;

/** Feature-flag SYNC-V2 (спека §4; прецедент VITE_E2E_TEST_MODE) */
export function isSyncV2Enabled(): boolean {
  return import.meta.env.VITE_SYNC_V2 === 'true';
}

/** Снимок состояния, по которому флашер строит пачку push */
export interface FlusherSnapshot {
  isAuthenticated: boolean;
  dirty: DirtyMap;
  /** Дерево проектов для резолва сущностей и parent-chain */
  projects: ProjectData[];
}

/** Обратные вызовы флашера (подключаются из sync-слайса) */
export interface FlusherDeps {
  getSnapshot: () => FlusherSnapshot;
  onFlushStart: () => void;
  onFlushEnd: (error: Error | null) => void;
  /** Подтверждение сущностей: снятие dirty + Dexie; gaveUp — с логом, без ретрая */
  onEntitiesResolved: (
    entries: Array<{ entityKind: DirtyEntityKind; entityId: string; gaveUp: boolean }>,
  ) => void;
}

export interface FlushAckEntry {
  entityKind: DirtyEntityKind;
  entityId: string;
  gaveUp: boolean;
}

/** Транспортный слой флашера — собственный экземпляр RequestQueue (спека §2.2) */
const flushQueue = new RequestQueue(MIN_REQUEST_INTERVAL, MAX_RETRIES);

export function countDirty(dirty: DirtyMap): number {
  return (
    Object.keys(dirty.project).length +
    Object.keys(dirty.object).length +
    Object.keys(dirty.room).length
  );
}

interface EntityIndex {
  projects: Map<string, ProjectData>;
  objects: Map<string, { obj: ObjectData; projectId: string }>;
  rooms: Map<string, { room: RoomData; objectId: string; projectId: string }>;
}

function buildEntityIndex(projects: ProjectData[]): EntityIndex {
  const index: EntityIndex = { projects: new Map(), objects: new Map(), rooms: new Map() };
  for (const project of projects) {
    index.projects.set(project.id, project);
    for (const obj of project.objects ?? []) {
      index.objects.set(obj.id, { obj, projectId: project.id });
      for (const room of obj.rooms ?? []) {
        index.rooms.set(room.id, { room, objectId: obj.id, projectId: project.id });
      }
    }
  }
  return index;
}

function projectPayload(project: ProjectData): Record<string, unknown> {
  return {
    name: project.name,
    city: project.city ?? null,
    use_ai_pricing: project.useAiPricing ?? false,
  };
}

function objectPayload(obj: ObjectData, projectId: string): Record<string, unknown> {
  return {
    name: obj.name,
    city: obj.city ?? null,
    project_id: projectId,
    sort_order: obj.sortOrder ?? 0,
  };
}

function roomPayload(room: RoomData, objectId: string): Record<string, unknown> {
  return { ...clientToApiRoom(room), object_id: objectId };
}

/**
 * Построение пачки изменений из dirty-карты. Порядок parent-before-child:
 * project → object → room (спека §2.2); внутри вида — сортировка по id для
 * детерминизма. Сущность, отсутствующая в локальном дереве (например, флаг
 * остался от удалённой записи), отдаётся как gaveUp — её нечем отправить.
 */
export function buildPushChanges(snapshot: FlusherSnapshot): {
  changes: SyncPushChange[];
  missing: Array<{ entityKind: DirtyEntityKind; entityId: string }>;
} {
  const index = buildEntityIndex(snapshot.projects);
  const changes: SyncPushChange[] = [];
  const missing: Array<{ entityKind: DirtyEntityKind; entityId: string }> = [];

  const pushChange = (
    entityKind: DirtyEntityKind,
    entityId: string,
    updatedAt: string,
    data: Record<string, unknown>,
  ) => {
    changes.push({
      id: entityId,
      entity: entityKind,
      entityId,
      timestamp: Date.now(),
      operation: isServerId(entityId) ? 'update' : 'create',
      data: { ...data, clientUpdatedAt: updatedAt },
    });
  };

  for (const entityId of Object.keys(snapshot.dirty.project).sort()) {
    const project = index.projects.get(entityId);
    if (!project) {
      missing.push({ entityKind: 'project', entityId });
      continue;
    }
    pushChange(
      'project',
      entityId,
      snapshot.dirty.project[entityId].updatedAt,
      projectPayload(project),
    );
  }

  for (const entityId of Object.keys(snapshot.dirty.object).sort()) {
    const entry = index.objects.get(entityId);
    if (!entry) {
      missing.push({ entityKind: 'object', entityId });
      continue;
    }
    pushChange(
      'object',
      entityId,
      snapshot.dirty.object[entityId].updatedAt,
      objectPayload(entry.obj, entry.projectId),
    );
  }

  for (const entityId of Object.keys(snapshot.dirty.room).sort()) {
    const entry = index.rooms.get(entityId);
    if (!entry) {
      missing.push({ entityKind: 'room', entityId });
      continue;
    }
    pushChange(
      'room',
      entityId,
      snapshot.dirty.room[entityId].updatedAt,
      roomPayload(entry.room, entry.objectId),
    );
  }

  return { changes, missing };
}

/** Сеть/429/5xx — элемент остаётся dirty (спека §2.2) */
function isTransientError(error: unknown): boolean {
  if (isRateLimitError(error)) return true;
  if (!(error instanceof ProjectsApiError)) return true; // сетевая ошибка без статуса
  return error.statusCode >= 500;
}

/**
 * Один проход флашера: строит пачки из dirty-карты, отправляет по ≤ FLUSH_BATCH_SIZE
 * на POST /api/sync/push, разбирает synced/conflicts. Ошибки сети/429 оставляют dirty,
 * 403/404/валидация снимают сущность с логом (спека §2.2).
 */
export async function flushOnce(deps: FlusherDeps): Promise<void> {
  if (!isSyncV2Enabled()) return;

  const snapshot = deps.getSnapshot();
  if (!snapshot.isAuthenticated) return;
  if (countDirty(snapshot.dirty) === 0) return;

  deps.onFlushStart();

  try {
    const { changes, missing } = buildPushChanges(snapshot);

    if (missing.length > 0) {
      logWarning('SyncFlusher', 'Dirty-сущности без локального состояния — сняты с очереди', {
        missing,
      });
    }

    const resolved: FlushAckEntry[] = missing.map(({ entityKind, entityId }) => ({
      entityKind,
      entityId,
      gaveUp: true,
    }));

    for (let offset = 0; offset < changes.length; offset += FLUSH_BATCH_SIZE) {
      const batch = changes.slice(offset, offset + FLUSH_BATCH_SIZE);
      try {
        const result = await flushQueue.enqueue(() => syncPush(batch));

        const syncedIds = new Set(result.synced);
        const conflictIds = new Set(result.conflicts.map(c => c.id));

        for (const change of batch) {
          if (syncedIds.has(change.id)) {
            resolved.push({ entityKind: change.entity, entityId: change.entityId, gaveUp: false });
          } else if (conflictIds.has(change.id)) {
            // §2.2: конфликт/403 — элемент снимается с очереди, фиксируется в логе;
            // LWW-слияние по serverUpdatedAt — batch (в)
            logWarning('SyncFlusher', 'Конфликт на push — сущность снята с очереди', {
              entity: change.entity,
              entityId: change.entityId,
              conflict: result.conflicts.find(c => c.id === change.id),
            });
            resolved.push({ entityKind: change.entity, entityId: change.entityId, gaveUp: true });
          } else {
            // Сервер не подтвердил и не отклонил — остаётся dirty до следующего флаша
            logDebug('SyncFlusher', 'Сущность без подтверждения сервера — остаётся dirty', {
              entity: change.entity,
              entityId: change.entityId,
            });
          }
        }
      } catch (error) {
        if (isTransientError(error)) {
          logWarning('SyncFlusher', 'Флаш не удался (сеть/429/5xx) — dirty сохранена', {
            batchSize: batch.length,
            error,
          });
          deps.onEntitiesResolved(resolved);
          deps.onFlushEnd(error instanceof Error ? error : new Error(String(error)));
          return;
        }
        // 403/404/валидация — пачка снимается с очереди
        logError('SyncFlusher', 'Флаш отклонён сервером — пачка снята с очереди', error, {
          batchSize: batch.length,
        });
        for (const change of batch) {
          resolved.push({ entityKind: change.entity, entityId: change.entityId, gaveUp: true });
        }
      }
    }

    if (resolved.length > 0) {
      deps.onEntitiesResolved(resolved);
    }
    deps.onFlushEnd(null);
  } catch (error) {
    logError('SyncFlusher', 'Непредвиденная ошибка флаша', error);
    deps.onFlushEnd(error instanceof Error ? error : new Error(String(error)));
  }
}

let activeDeps: FlusherDeps | null = null;
let actionTimer: ReturnType<typeof setTimeout> | null = null;
let intervalTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Debounce-триггер §2.3 п.3: вызывается из markDirty после мутации.
 * No-op, если флаг выключен или флашер не запущен.
 */
export function notifyDirtyChanged(): void {
  if (!isSyncV2Enabled() || !activeDeps) return;

  if (actionTimer) {
    clearTimeout(actionTimer);
  }
  actionTimer = setTimeout(() => {
    actionTimer = null;
    void flushOnce(activeDeps!);
  }, FLUSH_DEBOUNCE_MS);
}

/**
 * Запуск флашера: триггеры §2.3 — `online` (немедленный flush), интервал 30 с
 * при наличии dirty. Вызывается из initSyncListeners при включённом флаге.
 * @returns функция остановки (cleanup)
 */
export function startFlusher(deps: FlusherDeps): () => void {
  stopFlusher();
  activeDeps = deps;

  const handleOnline = () => {
    logDebug('SyncFlusher', 'Сеть восстановлена — flush');
    void flushOnce(deps);
  };
  const handleInterval = () => {
    if (countDirty(deps.getSnapshot().dirty) > 0) {
      void flushOnce(deps);
    }
  };

  window.addEventListener('online', handleOnline);
  intervalTimer = setInterval(handleInterval, FLUSH_INTERVAL_MS);

  return stopFlusher;
}

export function stopFlusher(): void {
  if (actionTimer) {
    clearTimeout(actionTimer);
    actionTimer = null;
  }
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
  activeDeps = null;
}
