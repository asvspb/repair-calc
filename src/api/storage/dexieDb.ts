import Dexie, { type Table } from 'dexie';
import type { ProjectData } from '@shared/types';
import type { WorkTemplate } from '../../types/workTemplate';

export interface KeyValueEntry {
  key: string;
  value: unknown;
}

/** Вид сущности в dirty-модели SYNC-V2 (спека §2.1: works/материалы — часть room) */
export type SyncEntityKind = 'project' | 'object' | 'room';

/** Запись персистентного dirty-флага (переживает reload — спека §2.1) */
export interface SyncStateEntry {
  /** `${entityKind}:${entityId}` */
  key: string;
  entityKind: SyncEntityKind;
  entityId: string;
  /** ISO-метка последней мутации сущности */
  updatedAt: string;
  op: 'upsert';
}

export function syncStateKey(entityKind: SyncEntityKind, entityId: string): string {
  return `${entityKind}:${entityId}`;
}

export class RepairCalcDB extends Dexie {
  projects!: Table<ProjectData, string>;
  workTemplates!: Table<WorkTemplate, string>;
  keyValueStore!: Table<KeyValueEntry, string>;
  syncState!: Table<SyncStateEntry, string>;

  constructor() {
    super('RepairCalcDB');

    this.version(1).stores({
      projects: 'id, updatedAt',
      workTemplates: 'id',
      keyValueStore: 'key',
    });

    // SYNC-V2 §6.1.7: только добавление таблицы syncState; индексы существующих таблиц не меняются
    this.version(2).stores({
      syncState: 'key',
    });
  }
}

export const db = new RepairCalcDB();

/** Персистентная запись dirty-флага (вызов из sync-слайса) */
export async function putSyncStateEntry(entry: SyncStateEntry): Promise<void> {
  await db.syncState.put(entry);
}

/** Полная карта персистентных dirty-флагов (восстановление при старте) */
export async function getAllSyncStateEntries(): Promise<SyncStateEntry[]> {
  return db.syncState.toArray();
}

/** Снятие персистентного dirty-флага (для флашера SYNC-V2 batch (б)) */
export async function deleteSyncStateEntry(key: string): Promise<void> {
  await db.syncState.delete(key);
}
