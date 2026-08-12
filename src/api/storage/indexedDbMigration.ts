import { db } from './dexieDb';
import { STORAGE_KEYS } from '../../utils/storageConstants';
import { logError, logWarning, logDebug } from '../../utils/logger';
import type { ProjectData } from '@shared/types';
import type { WorkTemplate } from '../../types/workTemplate';

const MIGRATION_FLAG = 'dexie_migrated';
const BACKUP_PREFIX = 'dexie_backup_';

export async function runMigration(): Promise<void> {
  try {
    const migrated = localStorage.getItem(MIGRATION_FLAG);
    if (migrated === 'true') {
      return;
    }

    logDebug('IndexedDbMigration', 'Starting localStorage → IndexedDB migration');

    await migrateProjects();
    await migrateWorkTemplates();
    await migrateKeyValues();

    localStorage.setItem(MIGRATION_FLAG, 'true');
    logDebug('IndexedDbMigration', 'Migration completed successfully');
  } catch (error) {
    logError('IndexedDbMigration', 'Migration failed', error);
    throw error;
  }
}

async function migrateProjects(): Promise<void> {
  const raw = localStorage.getItem(STORAGE_KEYS.PROJECTS);
  if (!raw) return;

  try {
    const projects: ProjectData[] = JSON.parse(raw);
    if (!Array.isArray(projects) || projects.length === 0) return;

    createBackup(STORAGE_KEYS.PROJECTS, projects);

    await db.transaction('rw', db.projects, async () => {
      await db.projects.clear();
      await db.projects.bulkPut(projects);
    });

    logDebug('IndexedDbMigration', 'Projects migrated', { count: projects.length });
  } catch (error) {
    logError('IndexedDbMigration', 'Failed to migrate projects', error);
    throw error;
  }
}

async function migrateWorkTemplates(): Promise<void> {
  const raw = localStorage.getItem(STORAGE_KEYS.WORK_TEMPLATES);
  if (!raw) return;

  try {
    const templates: WorkTemplate[] = JSON.parse(raw);
    if (!Array.isArray(templates) || templates.length === 0) return;

    createBackup(STORAGE_KEYS.WORK_TEMPLATES, templates);

    await db.transaction('rw', db.workTemplates, async () => {
      await db.workTemplates.clear();
      await db.workTemplates.bulkPut(templates);
    });

    logDebug('IndexedDbMigration', 'Work templates migrated', { count: templates.length });
  } catch (error) {
    logError('IndexedDbMigration', 'Failed to migrate work templates', error);
    throw error;
  }
}

async function migrateKeyValues(): Promise<void> {
  const keysToMigrate = [
    STORAGE_KEYS.ACTIVE_PROJECT,
    STORAGE_KEYS.VERSION,
    STORAGE_KEYS.LAST_BACKUP,
  ];

  for (const key of keysToMigrate) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const value = JSON.parse(raw);

      createBackup(key, value);

      await db.keyValueStore.put({ key, value });
      logDebug('IndexedDbMigration', 'Key migrated', { key });
    } catch (error) {
      logWarning('IndexedDbMigration', 'Failed to migrate key', { key, error });
    }
  }
}

function createBackup(key: string, data: unknown): void {
  try {
    const backupKey = BACKUP_PREFIX + key;
    localStorage.setItem(backupKey, JSON.stringify(data));
  } catch {
    logWarning('IndexedDbMigration', 'Failed to create backup, skipping', { key });
  }
}
