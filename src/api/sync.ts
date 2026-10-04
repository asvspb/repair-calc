/**
 * API-контракт POST /api/sync/push для флашера SYNC-V2 (спека §2.2, §3.4).
 *
 * Сервер расширяется в batch (в): entity `object`, `local-*` ID, `clientUpdatedAt`.
 * Клиент уже формирует целевой контракт; под флагом VITE_SYNC_V2 по умолчанию
 * флашер не активен (спека §4), поэтому до (в) расхождений в рантайме нет.
 */

import { httpClient, ApiError } from './httpClient';
import { ProjectsApiError } from './projects';

/** Сущности dirty-модели (спека §2.1); works/материалы — часть room */
export type SyncPushEntity = 'project' | 'object' | 'room';

/** Одно изменение в пачке push (спека §3.4) */
export interface SyncPushChange {
  /** ID изменения — детерминированно = entityId сущности (маппинг ответа conflicts) */
  id: string;
  entity: SyncPushEntity;
  entityId: string;
  timestamp: number;
  operation: 'create' | 'update';
  /** Сериализованное состояние сущности + clientUpdatedAt (tie-break, спека §3.1) */
  data: Record<string, unknown>;
}

export interface SyncConflict {
  id: string;
  entity: SyncPushEntity;
  entityId: string;
  /** Целевой контракт §3.4 (заполняется сервером с batch (в)) */
  serverUpdatedAt?: string;
  serverEntity?: Record<string, unknown>;
  /** Текущая форма ответа сервера (версионная) */
  serverVersion?: number;
  clientVersion?: number;
}

export interface SyncPushResult {
  synced: string[];
  conflicts: SyncConflict[];
}

/**
 * Отправка пачки изменений на POST /api/sync/push.
 * Ошибки конвертируются в ProjectsApiError (statusCode), чтобы
 * RequestQueue (isRateLimitError) мог ретраить 429 с backoff (спека §1.4, §2.2).
 */
export async function syncPush(changes: SyncPushChange[]): Promise<SyncPushResult> {
  try {
    const response = await httpClient.request<{ status: string; data: SyncPushResult }>(
      '/api/sync/push',
      {
        method: 'POST',
        body: JSON.stringify({ changes }),
      },
    );
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw new ProjectsApiError(error.message, error.statusCode);
    }
    throw error;
  }
}
