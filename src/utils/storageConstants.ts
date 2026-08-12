/**
 * Storage constants — единый источник истины для ключей localStorage и версии.
 * Вынесен из storage.ts для разрыва циклической зависимости с templateStorage.ts.
 */
export const STORAGE_KEYS = {
  PROJECTS: 'repair-calc-projects',
  ACTIVE_PROJECT: 'repair-calc-active-project',
  VERSION: 'repair-calc-version',
  LAST_BACKUP: 'repair-calc-last-backup',
  WORK_TEMPLATES: 'repair-calc-work-templates',
} as const;

export const CURRENT_VERSION = '1.0.0';
