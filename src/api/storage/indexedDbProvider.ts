import type { IStorageProvider } from '../../types/storage';
import { StorageProviderError } from '../../types/storage';
import { db } from './dexieDb';
import { runMigration } from './indexedDbMigration';
import { STORAGE_KEYS } from '../../utils/storageConstants';
import { logError, logWarning } from '../../utils/logger';
import type { ProjectData } from '@shared/types';
import type { WorkTemplate } from '../../types/workTemplate';

const PROJECTS_KEY = STORAGE_KEYS.PROJECTS;
const TEMPLATES_KEY = STORAGE_KEYS.WORK_TEMPLATES;

export class IndexedDbProvider implements IStorageProvider {
  private static instance: IndexedDbProvider | null = null;
  private initPromise: Promise<void> | null = null;

  static getInstance(): IndexedDbProvider {
    if (!IndexedDbProvider.instance) {
      IndexedDbProvider.instance = new IndexedDbProvider();
    }
    return IndexedDbProvider.instance;
  }

  private constructor() {
    this.initPromise = this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      await runMigration();
    } catch (error) {
      logError('IndexedDbProvider', 'Migration failed', error);
    }
  }

  get<T>(key: string): T | null {
    logWarning('IndexedDbProvider', 'Sync get() called — returning null. Use getAsync() instead.', {
      key,
    });
    return null;
  }

  async getAsync<T>(key: string): Promise<T | null> {
    await this.initPromise;

    try {
      if (key === PROJECTS_KEY) {
        const projects = await db.projects.toArray();
        return projects as unknown as T;
      }

      if (key === TEMPLATES_KEY) {
        const templates = await db.workTemplates.toArray();
        return templates as unknown as T;
      }

      const entry = await db.keyValueStore.get(key);
      return (entry?.value as T) ?? null;
    } catch (error) {
      logError('IndexedDbProvider', 'Error reading from IndexedDB', error, { key });
      return null;
    }
  }

  set<T>(key: string, value: T): void {
    this.setAsync(key, value).catch(error => {
      logError('IndexedDbProvider', 'Fire-and-forget set() failed', error, { key });
    });
  }

  async setAsync<T>(key: string, value: T): Promise<void> {
    await this.initPromise;

    try {
      if (key === PROJECTS_KEY) {
        const projects = value as unknown as ProjectData[];
        await db.transaction('rw', db.projects, async () => {
          await db.projects.clear();
          if (projects.length > 0) {
            await db.projects.bulkPut(projects);
          }
        });
        return;
      }

      if (key === TEMPLATES_KEY) {
        const templates = value as unknown as WorkTemplate[];
        await db.transaction('rw', db.workTemplates, async () => {
          await db.workTemplates.clear();
          if (templates.length > 0) {
            await db.workTemplates.bulkPut(templates);
          }
        });
        return;
      }

      await db.keyValueStore.put({ key, value });
    } catch (error) {
      throw StorageProviderError.fromError(error);
    }
  }

  remove(key: string): void {
    this.removeAsync(key).catch(error => {
      logError('IndexedDbProvider', 'Fire-and-forget remove() failed', error, { key });
    });
  }

  async removeAsync(key: string): Promise<void> {
    await this.initPromise;

    try {
      if (key === PROJECTS_KEY) {
        await db.projects.clear();
        return;
      }

      if (key === TEMPLATES_KEY) {
        await db.workTemplates.clear();
        return;
      }

      await db.keyValueStore.delete(key);
    } catch (error) {
      logError('IndexedDbProvider', 'Error removing from IndexedDB', error, { key });
    }
  }

  clear(): void {
    this.clearAsync().catch(error => {
      logError('IndexedDbProvider', 'Fire-and-forget clear() failed', error);
    });
  }

  async clearAsync(): Promise<void> {
    await this.initPromise;

    try {
      await db.transaction('rw', db.projects, db.workTemplates, db.keyValueStore, async () => {
        await db.projects.clear();
        await db.workTemplates.clear();
        await db.keyValueStore.clear();
      });
    } catch (error) {
      logError('IndexedDbProvider', 'Error clearing IndexedDB', error);
    }
  }

  getStorageInfo(): { used: number; total: number; percentage: number } {
    return { used: 0, total: 50 * 1024 * 1024, percentage: 0 };
  }
}
